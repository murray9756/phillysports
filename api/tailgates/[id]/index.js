// Tailgate Detail API
// GET /api/tailgates/[id] - Get tailgate details
// PUT /api/tailgates/[id] - Update tailgate
// DELETE /api/tailgates/[id] - Cancel tailgate

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { formatTailgate, TEAMS } from '../../lib/social.js';

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
        return res.status(400).json({ error: 'Invalid tailgate ID' });
    }

    if (req.method === 'GET') {
        return handleGetTailgate(req, res, id);
    }

    if (req.method === 'PUT') {
        return handleUpdateTailgate(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleCancelTailgate(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetTailgate(req, res, tailgateId) {
    try {
        const tailgates = await getCollection('tailgates');

        const results = await tailgates.aggregate([
            { $match: { _id: new ObjectId(tailgateId) } },
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
            return res.status(404).json({ error: 'Tailgate not found' });
        }

        const tailgate = results[0];

        // Get attendee details
        const attendeeIds = tailgate.attendees?.map(a => a.userId) || [];
        const contributorIds = tailgate.contributions?.map(c => c.userId) || [];
        const allUserIds = [...new Set([...attendeeIds, ...contributorIds].map(id => id.toString()))];

        let userMap = {};
        if (allUserIds.length > 0) {
            const users = await getCollection('users');
            const userDocs = await users.find({
                _id: { $in: allUserIds.map(id => new ObjectId(id)) }
            }, {
                projection: { username: 1, displayName: 1, profilePhoto: 1 }
            }).toArray();

            userMap = userDocs.reduce((acc, user) => {
                acc[user._id.toString()] = user;
                return acc;
            }, {});
        }

        const formatted = formatTailgate(tailgate, tailgate.hostInfo ? {
            userId: tailgate.hostInfo._id.toString(),
            username: tailgate.hostInfo.username,
            displayName: tailgate.hostInfo.displayName,
            profilePhoto: tailgate.hostInfo.profilePhoto
        } : null);

        // Add attendee details
        formatted.attendees = tailgate.attendees?.map(a => ({
            userId: a.userId.toString(),
            username: userMap[a.userId.toString()]?.username || 'Unknown',
            displayName: userMap[a.userId.toString()]?.displayName || 'Unknown User',
            profilePhoto: userMap[a.userId.toString()]?.profilePhoto || null,
            status: a.status,
            guestCount: a.guestCount || 0,
            rsvpAt: a.rsvpAt
        })) || [];

        // Add contribution details with user info
        formatted.contributions = tailgate.contributions?.map(c => ({
            userId: c.userId.toString(),
            username: userMap[c.userId.toString()]?.username || 'Unknown',
            displayName: userMap[c.userId.toString()]?.displayName || 'Unknown User',
            profilePhoto: userMap[c.userId.toString()]?.profilePhoto || null,
            item: c.item,
            quantity: c.quantity,
            status: c.status,
            claimedAt: c.claimedAt
        })) || [];

        // Add club info
        formatted.club = tailgate.clubInfo ? {
            id: tailgate.clubInfo._id.toString(),
            name: tailgate.clubInfo.name,
            slug: tailgate.clubInfo.slug
        } : null;

        return res.status(200).json({
            success: true,
            tailgate: formatted
        });

    } catch (error) {
        console.error('Get tailgate error:', error);
        return res.status(500).json({ error: 'Failed to fetch tailgate' });
    }
}

async function handleUpdateTailgate(req, res, tailgateId) {
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

        // Only host can update
        if (tailgate.hostId.toString() !== auth.userId) {
            return res.status(403).json({ error: 'Only the host can update this tailgate' });
        }

        const {
            title,
            description,
            team,
            location,
            schedule,
            visibility,
            capacity,
            costPerPerson,
            costType,
            neededItems,
            amenities,
            rules
        } = req.body;

        const updates = { updatedAt: new Date() };

        if (title) {
            if (title.trim().length < 5) {
                return res.status(400).json({ error: 'Title must be at least 5 characters' });
            }
            updates.title = title.trim();
        }
        if (description !== undefined) {
            updates.description = description.trim().substring(0, 2000);
        }
        if (team && TEAMS.includes(team)) {
            updates.team = team;
        }
        if (location) {
            updates.location = {
                ...tailgate.location,
                ...location
            };
        }
        if (schedule) {
            updates.schedule = {
                arrivalTime: schedule.arrivalTime ? new Date(schedule.arrivalTime) : tailgate.schedule.arrivalTime,
                kickoffTime: schedule.kickoffTime ? new Date(schedule.kickoffTime) : tailgate.schedule.kickoffTime,
                endTime: schedule.endTime ? new Date(schedule.endTime) : tailgate.schedule.endTime
            };
        }
        if (visibility) {
            updates.visibility = visibility;
        }
        if (capacity !== undefined) {
            updates.capacity = capacity ? parseInt(capacity) : null;
        }
        if (costPerPerson !== undefined) {
            updates.costPerPerson = parseFloat(costPerPerson) || 0;
        }
        if (costType) {
            updates.costType = costType;
        }
        if (neededItems !== undefined) {
            updates.neededItems = Array.isArray(neededItems) ? neededItems.slice(0, 20).map(item => ({
                item: item.item?.trim() || item,
                quantity: item.quantity || 1,
                claimedBy: item.claimedBy || null
            })) : [];
        }
        if (amenities !== undefined) {
            updates.amenities = Array.isArray(amenities) ? amenities.slice(0, 15) : [];
        }
        if (rules !== undefined) {
            updates.rules = Array.isArray(rules) ? rules.slice(0, 10).map(r => r.trim()) : [];
        }

        await tailgates.updateOne(
            { _id: new ObjectId(tailgateId) },
            { $set: updates }
        );

        const updated = await tailgates.findOne({ _id: new ObjectId(tailgateId) });

        return res.status(200).json({
            success: true,
            message: 'Tailgate updated successfully',
            tailgate: formatTailgate(updated)
        });

    } catch (error) {
        console.error('Update tailgate error:', error);
        return res.status(500).json({ error: 'Failed to update tailgate' });
    }
}

async function handleCancelTailgate(req, res, tailgateId) {
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

        // Only host can cancel
        if (tailgate.hostId.toString() !== auth.userId) {
            return res.status(403).json({ error: 'Only the host can cancel this tailgate' });
        }

        if (tailgate.status === 'cancelled') {
            return res.status(400).json({ error: 'Tailgate is already cancelled' });
        }

        await tailgates.updateOne(
            { _id: new ObjectId(tailgateId) },
            {
                $set: {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Tailgate cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel tailgate error:', error);
        return res.status(500).json({ error: 'Failed to cancel tailgate' });
    }
}
