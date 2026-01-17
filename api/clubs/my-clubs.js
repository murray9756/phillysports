// My Clubs API
// GET /api/clubs/my-clubs - Get user's clubs

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { formatClub } from '../lib/social.js';

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

        const { role, status = 'active' } = req.query;

        const clubs = await getCollection('fan_clubs');

        // Build match query
        const matchQuery = {
            'members.userId': new ObjectId(auth.userId),
            'members.status': status
        };

        if (role) {
            matchQuery['members.role'] = role;
        }

        // Get user's clubs with their membership info
        const results = await clubs.aggregate([
            { $match: matchQuery },
            {
                $addFields: {
                    userMembership: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: '$members',
                                    as: 'm',
                                    cond: { $eq: ['$$m.userId', new ObjectId(auth.userId)] }
                                }
                            },
                            0
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'ownerId',
                    foreignField: '_id',
                    as: 'ownerInfo'
                }
            },
            { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } },
            { $sort: { 'userMembership.joinedAt': -1 } }
        ]).toArray();

        const formatted = results.map(club => ({
            ...formatClub(club),
            owner: club.ownerInfo ? {
                userId: club.ownerInfo._id.toString(),
                username: club.ownerInfo.username,
                displayName: club.ownerInfo.displayName,
                profilePhoto: club.ownerInfo.profilePhoto
            } : null,
            userMembership: club.userMembership ? {
                role: club.userMembership.role,
                status: club.userMembership.status,
                joinedAt: club.userMembership.joinedAt
            } : null
        }));

        return res.status(200).json({
            success: true,
            clubs: formatted,
            count: formatted.length
        });

    } catch (error) {
        console.error('Get my clubs error:', error);
        return res.status(500).json({ error: 'Failed to fetch your clubs' });
    }
}
