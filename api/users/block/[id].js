// Unblock User API
// DELETE /api/users/block/[id] - Unblock a user

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticate(req);
    if (!auth) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
        const userBlocks = await getCollection('user_blocks');

        // Delete block
        const result = await userBlocks.deleteOne({
            blockerId: new ObjectId(auth.userId),
            blockedId: new ObjectId(id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Block not found' });
        }

        return res.status(200).json({ message: 'User unblocked successfully' });

    } catch (error) {
        console.error('Unblock user error:', error);
        return res.status(500).json({ error: 'Failed to unblock user' });
    }
}
