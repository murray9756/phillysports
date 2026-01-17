// Tailgate RSVP API
// POST /api/tailgates/[id]/rsvp - RSVP to tailgate
// DELETE /api/tailgates/[id]/rsvp - Cancel RSVP

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
        return res.status(400).json({ error: 'Invalid tailgate ID' });
    }

    if (req.method === 'POST') {
        return handleRsvp(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleCancelRsvp(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleRsvp(req, res, tailgateId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { status = 'going', guestCount = 0 } = req.body;

        if (!['going', 'maybe'].includes(status)) {
            return res.status(400).json({ error: 'Invalid RSVP status' });
        }

        const tailgates = await getCollection('tailgates');
        const tailgate = await tailgates.findOne({ _id: new ObjectId(tailgateId) });

        if (!tailgate) {
            return res.status(404).json({ error: 'Tailgate not found' });
        }

        if (tailgate.status === 'cancelled') {
            return res.status(400).json({ error: 'This tailgate has been cancelled' });
        }

        // Check if tailgate is in the past
        if (new Date(tailgate.schedule.arrivalTime) < new Date()) {
            return res.status(400).json({ error: 'Cannot RSVP to past tailgates' });
        }

        // Check visibility restrictions
        if (tailgate.visibility === 'club-only' && tailgate.clubId) {
            const isMember = await isClubMember(tailgate.clubId.toString(), auth.userId);
            if (!isMember) {
                return res.status(403).json({ error: 'This tailgate is only for club members' });
            }
        }

        // Check capacity
        if (tailgate.capacity) {
            const currentGoing = tailgate.attendees?.filter(a => a.status === 'going')
                .reduce((sum, a) => sum + 1 + (a.guestCount || 0), 0) || 0;

            const existingRsvp = tailgate.attendees?.find(a => a.userId.toString() === auth.userId);
            const existingCount = existingRsvp ? 1 + (existingRsvp.guestCount || 0) : 0;
            const newCount = 1 + parseInt(guestCount);

            if (status === 'going' && (currentGoing - existingCount + newCount) > tailgate.capacity) {
                return res.status(400).json({ error: 'This tailgate is at capacity' });
            }
        }

        const now = new Date();
        const existingAttendee = tailgate.attendees?.find(a => a.userId.toString() === auth.userId);

        if (existingAttendee) {
            // Update existing RSVP
            await tailgates.updateOne(
                {
                    _id: new ObjectId(tailgateId),
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
            await tailgates.updateOne(
                { _id: new ObjectId(tailgateId) },
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
        const updatedTailgate = await tailgates.findOne({ _id: new ObjectId(tailgateId) });
        const goingCount = updatedTailgate.attendees?.filter(a => a.status === 'going').length || 0;

        await tailgates.updateOne(
            { _id: new ObjectId(tailgateId) },
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

async function handleCancelRsvp(req, res, tailgateId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const tailgates = await getCollection('tailgates');
        const tailgate = await tailgates.findOne({ _id: new ObjectId(tailgateId) });

        if (!tailgate) {
            return res.status(404).json({ error: 'Tailgate not found' });
        }

        // Cannot cancel host's RSVP
        if (tailgate.hostId.toString() === auth.userId) {
            return res.status(400).json({ error: 'The host cannot cancel their RSVP' });
        }

        const existingAttendee = tailgate.attendees?.find(a => a.userId.toString() === auth.userId);
        if (!existingAttendee) {
            return res.status(400).json({ error: 'You have not RSVPed to this tailgate' });
        }

        // Also remove any contributions
        await tailgates.updateOne(
            { _id: new ObjectId(tailgateId) },
            {
                $pull: {
                    attendees: { userId: new ObjectId(auth.userId) },
                    contributions: { userId: new ObjectId(auth.userId) }
                },
                $inc: { attendeeCount: existingAttendee.status === 'going' ? -1 : 0 },
                $set: { updatedAt: new Date() }
            }
        );

        // Unclaim any needed items
        await tailgates.updateOne(
            { _id: new ObjectId(tailgateId) },
            {
                $set: {
                    'neededItems.$[item].claimedBy': null
                }
            },
            {
                arrayFilters: [{ 'item.claimedBy': new ObjectId(auth.userId) }]
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
