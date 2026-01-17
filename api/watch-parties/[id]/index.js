// Single Watch Party API
// GET /api/watch-parties/[id] - Get party details
// PUT /api/watch-parties/[id] - Update party (host only)
// DELETE /api/watch-parties/[id] - Cancel party (host only)

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { formatWatchParty, validateEventData } from '../../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid party ID' });
    }

    if (req.method === 'GET') {
        return handleGetParty(req, res, id);
    }

    if (req.method === 'PUT') {
        return handleUpdateParty(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleCancelParty(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetParty(req, res, partyId) {
    try {
        const parties = await getCollection('watch_parties');

        const results = await parties.aggregate([
            { $match: { _id: new ObjectId(partyId) } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'hostId',
                    foreignField: '_id',
                    as: 'hostInfo'
                }
            },
            { $unwind: { path: '$hostInfo', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'fan_clubs',
                    localField: 'clubId',
                    foreignField: '_id',
                    as: 'clubInfo'
                }
            },
            { $unwind: { path: '$clubInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();

        if (results.length === 0) {
            return res.status(404).json({ error: 'Watch party not found' });
        }

        const party = results[0];

        // Check user's RSVP status
        const auth = await authenticate(req);
        let userRsvp = null;
        if (auth) {
            const attendee = party.attendees?.find(a => a.userId.toString() === auth.userId);
            if (attendee) {
                userRsvp = {
                    status: attendee.status,
                    guestCount: attendee.guestCount,
                    rsvpAt: attendee.rsvpAt
                };
            }
        }

        // Get attendee details (limit to 20 for preview)
        const attendeeIds = (party.attendees || [])
            .filter(a => a.status === 'going')
            .slice(0, 20)
            .map(a => a.userId);

        let attendeeDetails = [];
        if (attendeeIds.length > 0) {
            const users = await getCollection('users');
            const userDocs = await users.find(
                { _id: { $in: attendeeIds } },
                { projection: { username: 1, displayName: 1, profilePhoto: 1 } }
            ).toArray();

            attendeeDetails = userDocs.map(u => ({
                userId: u._id.toString(),
                username: u.username,
                displayName: u.displayName,
                profilePhoto: u.profilePhoto
            }));
        }

        return res.status(200).json({
            success: true,
            party: {
                ...formatWatchParty(party, party.hostInfo ? {
                    userId: party.hostInfo._id.toString(),
                    username: party.hostInfo.username,
                    displayName: party.hostInfo.displayName,
                    profilePhoto: party.hostInfo.profilePhoto
                } : null),
                club: party.clubInfo ? {
                    id: party.clubInfo._id.toString(),
                    name: party.clubInfo.name,
                    slug: party.clubInfo.slug
                } : null,
                attendees: attendeeDetails,
                userRsvp,
                isHost: auth ? party.hostId.toString() === auth.userId : false
            }
        });

    } catch (error) {
        console.error('Get watch party error:', error);
        return res.status(500).json({ error: 'Failed to fetch watch party' });
    }
}

async function handleUpdateParty(req, res, partyId) {
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

        if (party.hostId.toString() !== auth.userId) {
            return res.status(403).json({ error: 'Only the host can update this party' });
        }

        const {
            title,
            description,
            gameTime,
            location,
            virtualLink,
            capacity,
            costPerPerson,
            amenities
        } = req.body;

        const errors = validateEventData({ title, description }, 'watch-party');
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        const updateData = { updatedAt: new Date() };

        if (title) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim().substring(0, 2000);
        if (gameTime) updateData.gameTime = new Date(gameTime);
        if (location && party.locationType !== 'virtual') {
            updateData.location = {
                name: location.name?.trim() || party.location?.name,
                address: location.address?.trim() || '',
                city: location.city?.trim() || '',
                state: location.state?.trim() || '',
                zip: location.zip?.trim() || '',
                coordinates: location.coordinates || party.location?.coordinates,
                googlePlaceId: location.googlePlaceId || party.location?.googlePlaceId
            };
        }
        if (virtualLink && party.locationType === 'virtual') {
            updateData.virtualLink = virtualLink;
        }
        if (capacity !== undefined) updateData.capacity = capacity ? parseInt(capacity) : null;
        if (costPerPerson !== undefined) updateData.costPerPerson = parseFloat(costPerPerson) || 0;
        if (Array.isArray(amenities)) updateData.amenities = amenities.slice(0, 10);

        const result = await parties.findOneAndUpdate(
            { _id: new ObjectId(partyId) },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        return res.status(200).json({
            success: true,
            message: 'Watch party updated successfully',
            party: formatWatchParty(result)
        });

    } catch (error) {
        console.error('Update watch party error:', error);
        return res.status(500).json({ error: 'Failed to update watch party' });
    }
}

async function handleCancelParty(req, res, partyId) {
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

        if (party.hostId.toString() !== auth.userId) {
            return res.status(403).json({ error: 'Only the host can cancel this party' });
        }

        await parties.updateOne(
            { _id: new ObjectId(partyId) },
            {
                $set: {
                    status: 'cancelled',
                    updatedAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Watch party cancelled'
        });

    } catch (error) {
        console.error('Cancel watch party error:', error);
        return res.status(500).json({ error: 'Failed to cancel watch party' });
    }
}
