// Mentions Search API - User autocomplete for @mentions
import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const { q, limit = 5 } = req.query;

        if (!q || q.length < 1) {
            return res.status(200).json({ success: true, users: [] });
        }

        const searchLimit = Math.min(parseInt(limit) || 5, 10);
        const searchTerm = q.trim();

        const usersCollection = await getCollection('users');

        // Search by username or displayName (case-insensitive prefix match)
        const users = await usersCollection.find({
            $or: [
                { username: { $regex: `^${searchTerm}`, $options: 'i' } },
                { displayName: { $regex: `^${searchTerm}`, $options: 'i' } }
            ]
        }, {
            projection: {
                _id: 1,
                username: 1,
                displayName: 1,
                profilePhoto: 1,
                favoriteTeam: 1
            }
        })
        .limit(searchLimit)
        .toArray();

        return res.status(200).json({
            success: true,
            users: users.map(u => ({
                id: u._id.toString(),
                username: u.username,
                displayName: u.displayName || u.username,
                profilePhoto: u.profilePhoto || null,
                favoriteTeam: u.favoriteTeam || null
            }))
        });
    } catch (error) {
        console.error('Mention search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
