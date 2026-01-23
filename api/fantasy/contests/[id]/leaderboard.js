// Fantasy Contest Leaderboard
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { ObjectId } from 'mongodb';

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
        const { id } = req.query;
        const { limit = 50, offset = 0 } = req.query;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid contest ID' });
        }

        const contestsCollection = await getCollection('fantasy_contests');
        const contest = await contestsCollection.findOne({ _id: new ObjectId(id) });

        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }

        const entriesCollection = await getCollection('fantasy_entries');

        // Get total count
        const totalEntries = await entriesCollection.countDocuments({ contestId: new ObjectId(id) });

        // Get leaderboard entries
        const entries = await entriesCollection
            .find({ contestId: new ObjectId(id) })
            .sort({ totalPoints: -1, createdAt: 1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .toArray();

        // Add rank to entries with player points
        const rankedEntries = entries.map((entry, index) => {
            const playerPointsMap = {};
            if (entry.playerPoints) {
                for (const pp of entry.playerPoints) {
                    playerPointsMap[pp.playerId] = pp.points;
                }
            }
            return {
                rank: parseInt(offset) + index + 1,
                userId: entry.userId?.toString(),
                username: entry.username,
                totalPoints: entry.totalPoints || 0,
                lineup: entry.lineup.map(p => ({
                    position: p.position,
                    playerName: p.playerName,
                    playerPosition: p.playerPosition,
                    salary: p.salary,
                    points: playerPointsMap[p.playerId] || 0
                })),
                payout: entry.payout || 0,
                isPaid: contest.status === 'completed' && entry.payout > 0
            };
        });

        // Get user's entry if logged in
        let userEntry = null;
        let userRank = null;
        const user = await authenticate(req);
        if (user) {
            userEntry = await entriesCollection.findOne({
                contestId: new ObjectId(id),
                userId: user._id
            });

            if (userEntry) {
                // Calculate user's rank
                const higherScores = await entriesCollection.countDocuments({
                    contestId: new ObjectId(id),
                    totalPoints: { $gt: userEntry.totalPoints }
                });
                userRank = higherScores + 1;
            }
        }

        return res.status(200).json({
            success: true,
            contest: {
                _id: contest._id,
                title: contest.title,
                sport: contest.sport,
                status: contest.status,
                prizePool: contest.prizePool,
                prizeStructure: contest.prizeStructure,
                entryCount: contest.entryCount
            },
            leaderboard: rankedEntries,
            totalEntries,
            userEntry: userEntry ? {
                rank: userRank,
                totalPoints: userEntry.totalPoints || 0,
                lineup: userEntry.lineup.map(p => {
                    const pts = userEntry.playerPoints?.find(pp => pp.playerId === p.playerId);
                    return {
                        ...p,
                        points: pts?.points || 0
                    };
                }),
                payout: userEntry.payout || 0
            } : null
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
