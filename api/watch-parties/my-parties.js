// My Watch Parties API
// GET /api/watch-parties/my-parties - Get user's parties (hosting and attending)

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { formatWatchParty } from '../lib/social.js';

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
        const parties = await getCollection('watch_parties');

        const now = new Date();

        // Build query
        let query = {};

        if (type === 'hosting') {
            query.hostId = new ObjectId(auth.userId);
        } else if (type === 'attending') {
            query['attendees.userId'] = new ObjectId(auth.userId);
            query.hostId = { $ne: new ObjectId(auth.userId) };
        } else {
            // All parties user is involved with
            query.$or = [
                { hostId: new ObjectId(auth.userId) },
                { 'attendees.userId': new ObjectId(auth.userId) }
            ];
        }

        // Status filter
        if (status === 'upcoming') {
            query.gameTime = { $gte: now };
            query.status = { $ne: 'cancelled' };
        } else if (status === 'past') {
            query.gameTime = { $lt: now };
        }

        const results = await parties.aggregate([
            { $match: query },
            { $sort: { gameTime: status === 'past' ? -1 : 1 } },
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

        const formatted = results.map(party => {
            const userAttendee = party.attendees?.find(a => a.userId.toString() === auth.userId);
            return {
                ...formatWatchParty(party, party.hostInfo ? {
                    userId: party.hostInfo._id.toString(),
                    username: party.hostInfo.username,
                    displayName: party.hostInfo.displayName,
                    profilePhoto: party.hostInfo.profilePhoto
                } : null),
                club: party.clubInfo ? {
                    id: party.clubInfo._id.toString(),
                    name: party.clubInfo.name
                } : null,
                isHost: party.hostId.toString() === auth.userId,
                userRsvp: userAttendee ? {
                    status: userAttendee.status,
                    guestCount: userAttendee.guestCount
                } : null
            };
        });

        return res.status(200).json({
            success: true,
            parties: formatted,
            count: formatted.length
        });

    } catch (error) {
        console.error('Get my parties error:', error);
        return res.status(500).json({ error: 'Failed to fetch your parties' });
    }
}
