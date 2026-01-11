import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const users = await getCollection('users');

        const results = await users.find(
            {
                $or: [
                    { username: { $regex: q, $options: 'i' } },
                    { displayName: { $regex: q, $options: 'i' } }
                ]
            },
            {
                projection: { password: 0, email: 0, notifications: 0, savedArticles: 0 }
            }
        )
        .limit(parseInt(limit))
        .toArray();

        res.status(200).json({
            users: results.map(user => ({
                _id: user._id.toString(),
                username: user.username,
                displayName: user.displayName,
                favoriteTeam: user.favoriteTeam,
                profilePhoto: user.profilePhoto,
                followersCount: user.followers?.length || 0
            }))
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
}
