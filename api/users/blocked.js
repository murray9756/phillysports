// Blocked Users API
// GET /api/users/blocked - List blocked users

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { getUserInfo } from '../lib/community.js';

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

    const auth = await authenticate(req);
    if (!auth) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const userBlocks = await getCollection('user_blocks');
        const blocks = await userBlocks.find({
            blockerId: new ObjectId(auth.userId)
        }).sort({ createdAt: -1 }).toArray();

        // Get user info for each blocked user
        const blockedUsers = await Promise.all(
            blocks.map(async block => {
                const userInfo = await getUserInfo(block.blockedId);
                return {
                    userId: block.blockedId.toString(),
                    ...userInfo,
                    blockedAt: block.createdAt
                };
            })
        );

        return res.status(200).json({ blockedUsers });

    } catch (error) {
        console.error('Get blocked users error:', error);
        return res.status(500).json({ error: 'Failed to get blocked users' });
    }
}
