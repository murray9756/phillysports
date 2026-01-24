// User Leaderboard API - Top users by Diehard Dollars
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
        const { limit = 10 } = req.query;
        const users = await getCollection('users');

        // Get top users by coin balance
        const leaderboard = await users.find(
            { coinBalance: { $gt: 0 } },
            {
                projection: {
                    username: 1,
                    displayName: 1,
                    coinBalance: 1,
                    avatarUrl: 1
                }
            }
        )
        .sort({ coinBalance: -1 })
        .limit(parseInt(limit))
        .toArray();

        return res.status(200).json({
            success: true,
            leaderboard: leaderboard.map(user => ({
                username: user.username,
                displayName: user.displayName || user.username,
                coins: user.coinBalance || 0,
                avatarUrl: user.avatarUrl
            }))
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
}
