import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const type = req.query.type || 'predictions'; // 'predictions', 'coins', 'streak'
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const usersCollection = db.collection('users');
        const predictionsCollection = db.collection('predictions');

        if (type === 'predictions') {
            // Leaderboard by prediction accuracy
            const leaderboard = await predictionsCollection.aggregate([
                { $match: { status: { $in: ['won', 'lost'] } } },
                {
                    $group: {
                        _id: '$userId',
                        totalPredictions: { $sum: 1 },
                        correctPredictions: {
                            $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] }
                        },
                        coinsWon: { $sum: '$coinsWon' }
                    }
                },
                {
                    $match: { totalPredictions: { $gte: 5 } } // Min 5 predictions to qualify
                },
                {
                    $addFields: {
                        accuracy: {
                            $multiply: [
                                { $divide: ['$correctPredictions', '$totalPredictions'] },
                                100
                            ]
                        }
                    }
                },
                { $sort: { accuracy: -1, correctPredictions: -1 } },
                { $limit: limit }
            ]).toArray();

            // Get usernames
            const userIds = leaderboard.map(l => l._id);
            const users = await usersCollection
                .find({ _id: { $in: userIds } })
                .project({ username: 1, badges: 1 })
                .toArray();

            const usersMap = {};
            users.forEach(u => { usersMap[u._id.toString()] = u; });

            const enrichedLeaderboard = leaderboard.map((l, index) => ({
                rank: index + 1,
                username: usersMap[l._id.toString()]?.username || 'Unknown',
                badges: usersMap[l._id.toString()]?.badges || [],
                totalPredictions: l.totalPredictions,
                correctPredictions: l.correctPredictions,
                accuracy: Math.round(l.accuracy * 10) / 10,
                coinsWon: l.coinsWon
            }));

            return res.status(200).json({ success: true, leaderboard: enrichedLeaderboard, type: 'predictions' });
        }

        if (type === 'coins') {
            // Leaderboard by lifetime coins
            const leaderboard = await usersCollection
                .find({ lifetimeCoins: { $gt: 0 } })
                .project({ username: 1, lifetimeCoins: 1, coinBalance: 1, badges: 1, dailyLoginStreak: 1 })
                .sort({ lifetimeCoins: -1 })
                .limit(limit)
                .toArray();

            const enrichedLeaderboard = leaderboard.map((u, index) => ({
                rank: index + 1,
                username: u.username,
                badges: u.badges || [],
                lifetimeCoins: u.lifetimeCoins,
                currentBalance: u.coinBalance,
                loginStreak: u.dailyLoginStreak || 0
            }));

            return res.status(200).json({ success: true, leaderboard: enrichedLeaderboard, type: 'coins' });
        }

        if (type === 'streak') {
            // Leaderboard by login streak
            const leaderboard = await usersCollection
                .find({ dailyLoginStreak: { $gt: 0 } })
                .project({ username: 1, dailyLoginStreak: 1, badges: 1 })
                .sort({ dailyLoginStreak: -1 })
                .limit(limit)
                .toArray();

            const enrichedLeaderboard = leaderboard.map((u, index) => ({
                rank: index + 1,
                username: u.username,
                badges: u.badges || [],
                loginStreak: u.dailyLoginStreak
            }));

            return res.status(200).json({ success: true, leaderboard: enrichedLeaderboard, type: 'streak' });
        }

        return res.status(400).json({ error: 'Invalid type parameter' });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    } finally {
        await client.close();
    }
}
