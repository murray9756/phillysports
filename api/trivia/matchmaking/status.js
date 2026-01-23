// Check matchmaking queue status
// GET /api/trivia/matchmaking/status

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

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
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = decoded.userId;
        const queue = await getCollection('trivia_matchmaking_queue');
        const challenges = await getCollection('trivia_challenges');

        // Check if user is in queue
        const entry = await queue.findOne({
            userId: new ObjectId(userId),
            status: 'waiting'
        });

        if (!entry) {
            // Check if they were matched
            const recentMatch = await challenges.findOne({
                $or: [
                    { 'challenger.userId': new ObjectId(userId) },
                    { 'challenged.userId': new ObjectId(userId) }
                ],
                matchmakingType: 'random',
                status: 'active',
                acceptedAt: { $gte: new Date(Date.now() - 60000) } // Last minute
            });

            if (recentMatch) {
                return res.status(200).json({
                    inQueue: false,
                    matched: true,
                    challengeId: recentMatch._id.toString()
                });
            }

            return res.status(200).json({
                inQueue: false,
                matched: false
            });
        }

        // Count others waiting in same tier
        const othersWaiting = await queue.countDocuments({
            userId: { $ne: new ObjectId(userId) },
            wagerAmount: entry.wagerAmount,
            status: 'waiting'
        });

        const waitTime = Math.round((Date.now() - new Date(entry.joinedAt).getTime()) / 1000);

        res.status(200).json({
            inQueue: true,
            matched: false,
            wagerAmount: entry.wagerAmount,
            waitTimeSeconds: waitTime,
            othersInTier: othersWaiting
        });
    } catch (error) {
        console.error('Matchmaking status error:', error);
        res.status(500).json({ error: error.message });
    }
}
