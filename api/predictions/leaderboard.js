import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 25, 100);

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const usersCollection = db.collection('users');

        // Leaderboard by current Diehard Dollar balance (exclude bots)
        const leaderboard = await usersCollection
            .find({ coinBalance: { $gt: 0 }, isBot: { $ne: true } })
            .project({ username: 1, coinBalance: 1 })
            .sort({ coinBalance: -1 })
            .limit(limit)
            .toArray();

        const enrichedLeaderboard = leaderboard.map((u, index) => ({
            rank: index + 1,
            username: u.username,
            coinBalance: u.coinBalance
        }));

        return res.status(200).json({ success: true, leaderboard: enrichedLeaderboard });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    } finally {
        await client.close();
    }
}
