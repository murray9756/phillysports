// Admin Content - Clear Queue
// DELETE: Remove all pending items from the content queue

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Authenticate admin
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const admin = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!admin?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const queue = await getCollection('content_queue');

        // Delete all pending items
        const result = await queue.deleteMany({ status: 'pending' });

        res.status(200).json({
            success: true,
            message: `Cleared ${result.deletedCount} items from queue`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Clear queue error:', error);
        res.status(500).json({ error: 'Failed to clear queue' });
    }
}
