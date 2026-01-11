// Block User API
// POST /api/users/block - Block a user

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

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

    const auth = await authenticate(req);
    if (!auth) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { userId } = req.body;

        if (!userId || !ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Cannot block yourself
        if (userId === auth.userId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }

        // Check if user exists
        const users = await getCollection('users');
        const targetUser = await users.findOne({ _id: new ObjectId(userId) });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userBlocks = await getCollection('user_blocks');

        // Check if already blocked
        const existingBlock = await userBlocks.findOne({
            blockerId: new ObjectId(auth.userId),
            blockedId: new ObjectId(userId)
        });

        if (existingBlock) {
            return res.status(400).json({ error: 'User is already blocked' });
        }

        // Create block
        await userBlocks.insertOne({
            blockerId: new ObjectId(auth.userId),
            blockedId: new ObjectId(userId),
            createdAt: new Date()
        });

        // Remove any follow relationship
        await users.updateOne(
            { _id: new ObjectId(auth.userId) },
            { $pull: { following: new ObjectId(userId) } }
        );
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { followers: new ObjectId(auth.userId) } }
        );

        return res.status(200).json({ message: 'User blocked successfully' });

    } catch (error) {
        console.error('Block user error:', error);
        return res.status(500).json({ error: 'Failed to block user' });
    }
}
