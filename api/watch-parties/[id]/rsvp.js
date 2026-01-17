// Watch Party RSVP API
// POST /api/watch-parties/[id]/rsvp - RSVP to party
// DELETE /api/watch-parties/[id]/rsvp - Cancel RSVP

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { isClubMember } from '../../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid party ID' });
    }

    if (req.method === 'POST') {
        return handleRsvp(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleCancelRsvp(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleRsvp(req, res, partyId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { status = 'going', guestCount = 0 } = req.body;

        if (!['going', 'maybe'].includes(status)) {
            return res.status(400).json({ error: 'Invalid RSVP status' });
        }

        const parties = await getCollection('watch_parties');
        const party = await parties.findOne({ _id: new ObjectId(partyId) });

        if (!party) {
            return res.status(404).json({ error: 'Watch party not found' });
        }

        if (party.status === 'cancelled') {
            return res.status(400).json({ error: 'This party has been cancelled' });
        }

        // Check if party is in the past
        if (new Date(party.gameTime) < new Date()) {
            return res.status(400).json({ error: 'Cannot RSVP to past parties' });
        }

        // Check visibility restrictions
        if (party.visibility === 'club-only' && party.clubId) {
            const isMember = await isClubMember(party.clubId.toString(), auth.userId);
            if (!isMember) {
                return res.status(403).json({ error: 'This party is only for club members' });
            }
        }

        // Check capacity
        if (party.capacity) {
            const currentGoing = party.attendees?.filter(a => a.status === 'going')
                .reduce((sum, a) => sum + 1 + (a.guestCount || 0), 0) || 0;

            const existingRsvp = party.attendees?.find(a => a.userId.toString() === auth.userId);
            const existingCount = existingRsvp ? 1 + (existingRsvp.guestCount || 0) : 0;
            const newCount = 1 + parseInt(guestCount);

            if (status === 'going' && (currentGoing - existingCount + newCount) > party.capacity) {
                return res.status(400).json({ error: 'This party is at capacity' });
            }
        }

        const now = new Date();
        const existingAttendee = party.attendees?.find(a => a.userId.toString() === auth.userId);

        if (existingAttendee) {
            // Update existing RSVP
            await parties.updateOne(
                {
                    _id: new ObjectId(partyId),
                    'attendees.userId': new ObjectId(auth.userId)
                },
                {
                    $set: {
                        'attendees.$.status': status,
                        'attendees.$.guestCount': parseInt(guestCount) || 0,
                        'attendees.$.rsvpAt': now,
                        updatedAt: now
                    }
                }
            );
        } else {
            // Add new RSVP
            await parties.updateOne(
                { _id: new ObjectId(partyId) },
                {
                    $push: {
                        attendees: {
                            userId: new ObjectId(auth.userId),
                            status,
                            guestCount: parseInt(guestCount) || 0,
                            rsvpAt: now
                        }
                    },
                    $set: { updatedAt: now }
                }
            );
        }

        // Update attendee count
        const updatedParty = await parties.findOne({ _id: new ObjectId(partyId) });
        const goingCount = updatedParty.attendees?.filter(a => a.status === 'going').length || 0;

        await parties.updateOne(
            { _id: new ObjectId(partyId) },
            { $set: { attendeeCount: goingCount } }
        );

        return res.status(200).json({
            success: true,
            message: status === 'going' ? "You're going!" : "You're a maybe",
            rsvp: {
                status,
                guestCount: parseInt(guestCount) || 0,
                rsvpAt: now
            }
        });

    } catch (error) {
        console.error('RSVP error:', error);
        return res.status(500).json({ error: 'Failed to RSVP' });
    }
}

async function handleCancelRsvp(req, res, partyId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const parties = await getCollection('watch_parties');
        const party = await parties.findOne({ _id: new ObjectId(partyId) });

        if (!party) {
            return res.status(404).json({ error: 'Watch party not found' });
        }

        // Cannot cancel host's RSVP
        if (party.hostId.toString() === auth.userId) {
            return res.status(400).json({ error: 'The host cannot cancel their RSVP' });
        }

        const existingAttendee = party.attendees?.find(a => a.userId.toString() === auth.userId);
        if (!existingAttendee) {
            return res.status(400).json({ error: 'You have not RSVPed to this party' });
        }

        await parties.updateOne(
            { _id: new ObjectId(partyId) },
            {
                $pull: { attendees: { userId: new ObjectId(auth.userId) } },
                $inc: { attendeeCount: existingAttendee.status === 'going' ? -1 : 0 },
                $set: { updatedAt: new Date() }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'RSVP cancelled'
        });

    } catch (error) {
        console.error('Cancel RSVP error:', error);
        return res.status(500).json({ error: 'Failed to cancel RSVP' });
    }
}
