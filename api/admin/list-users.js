// Admin: List users (for finding accounts)
// GET: Returns all users (admin only)

import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const decoded = await authenticate(req);
        if (!decoded || decoded.email !== 'kevin@phillysports.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const users = await getCollection('users');
        const allUsers = await users.find({}, {
            projection: {
                _id: 1,
                username: 1,
                email: 1,
                createdAt: 1,
                subscriptionTier: 1
            }
        }).sort({ createdAt: -1 }).limit(50).toArray();

        res.status(200).json({ users: allUsers });
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: error.message });
    }
}
