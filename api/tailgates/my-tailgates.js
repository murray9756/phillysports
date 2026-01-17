// My Tailgates API
// GET /api/tailgates/my-tailgates - Get user's tailgates (hosting and attending)

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { formatTailgate } from '../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { type = 'all', status = 'upcoming' } = req.query;
        const tailgates = await getCollection('tailgates');

        const now = new Date();

        // Build query
        let query = {};

        if (type === 'hosting') {
            query.hostId = new ObjectId(auth.userId);
        } else if (type === 'attending') {
            query['attendees.userId'] = new ObjectId(auth.userId);
            query.hostId = { $ne: new ObjectId(auth.userId) };
        } else {
            // All tailgates user is involved with
            query.$or = [
                { hostId: new ObjectId(auth.userId) },
                { 'attendees.userId': new ObjectId(auth.userId) }
            ];
        }

        // Status filter
        if (status === 'upcoming') {
            query['schedule.arrivalTime'] = { $gte: now };
            query.status = { $ne: 'cancelled' };
        } else if (status === 'past') {
            query['schedule.arrivalTime'] = { $lt: now };
        }

        const results = await tailgates.aggregate([
            { $match: query },
            { $sort: { 'schedule.arrivalTime': status === 'past' ? -1 : 1 } },
            { $limit: 50 },
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

        const formatted = results.map(tailgate => {
            const userAttendee = tailgate.attendees?.find(a => a.userId.toString() === auth.userId);
            const userContributions = tailgate.contributions?.filter(c => c.userId.toString() === auth.userId) || [];

            return {
                ...formatTailgate(tailgate, tailgate.hostInfo ? {
                    userId: tailgate.hostInfo._id.toString(),
                    username: tailgate.hostInfo.username,
                    displayName: tailgate.hostInfo.displayName,
                    profilePhoto: tailgate.hostInfo.profilePhoto
                } : null),
                club: tailgate.clubInfo ? {
                    id: tailgate.clubInfo._id.toString(),
                    name: tailgate.clubInfo.name
                } : null,
                isHost: tailgate.hostId.toString() === auth.userId,
                userRsvp: userAttendee ? {
                    status: userAttendee.status,
                    guestCount: userAttendee.guestCount
                } : null,
                userContributions: userContributions.map(c => ({
                    item: c.item,
                    quantity: c.quantity,
                    status: c.status
                }))
            };
        });

        return res.status(200).json({
            success: true,
            tailgates: formatted,
            count: formatted.length
        });

    } catch (error) {
        console.error('Get my tailgates error:', error);
        return res.status(500).json({ error: 'Failed to fetch your tailgates' });
    }
}
