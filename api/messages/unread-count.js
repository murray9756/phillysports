// Unread Count API
// GET /api/messages/unread-count - Get total unread message count

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

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
        const conversations = await getCollection('conversations');
        const userIdObj = new ObjectId(auth.userId);

        // Get all conversations and sum unread counts
        const results = await conversations.find({
            participants: userIdObj,
            status: 'active'
        }).toArray();

        let totalUnread = 0;
        results.forEach(conv => {
            totalUnread += conv.unreadCounts?.[auth.userId] || 0;
        });

        return res.status(200).json({
            unreadCount: totalUnread,
            conversationCount: results.length
        });

    } catch (error) {
        console.error('Unread count error:', error);
        return res.status(500).json({ error: 'Failed to get unread count' });
    }
}
