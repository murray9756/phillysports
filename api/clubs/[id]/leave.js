// Leave Club API
// POST /api/clubs/[id]/leave - Leave a club

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getClubRole } from '../../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid club ID' });
    }

    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check membership
        const role = await getClubRole(id, auth.userId);
        if (!role) {
            return res.status(400).json({ error: 'You are not a member of this club' });
        }

        // Owner cannot leave - they must transfer ownership or delete the club
        if (role === 'owner') {
            return res.status(400).json({
                error: 'Club owners cannot leave. Please transfer ownership or delete the club.'
            });
        }

        const clubs = await getCollection('fan_clubs');

        // Remove member from club
        const result = await clubs.updateOne(
            { _id: new ObjectId(id) },
            {
                $pull: {
                    members: { userId: new ObjectId(auth.userId) },
                    admins: new ObjectId(auth.userId)
                },
                $inc: { memberCount: -1 },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ error: 'Failed to leave club' });
        }

        return res.status(200).json({
            success: true,
            message: 'You have left the club'
        });

    } catch (error) {
        console.error('Leave club error:', error);
        return res.status(500).json({ error: 'Failed to leave club' });
    }
}
