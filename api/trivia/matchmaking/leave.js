// Leave matchmaking queue
// POST /api/trivia/matchmaking/leave

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import { addCoins } from '../../lib/coins.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = decoded.userId;
        const queue = await getCollection('trivia_matchmaking_queue');

        // Find and remove from queue
        const entry = await queue.findOneAndDelete({
            userId: new ObjectId(userId),
            status: 'waiting'
        });

        if (!entry) {
            return res.status(400).json({ error: 'Not in matchmaking queue' });
        }

        // Refund the locked wager (no multiplier - returning coins)
        await addCoins(
            userId,
            entry.wagerAmount,
            'trivia_wager_refund',
            'Left matchmaking queue - wager refunded',
            {},
            { skipMultiplier: true }
        );

        res.status(200).json({
            success: true,
            message: 'Left matchmaking queue',
            refunded: entry.wagerAmount
        });
    } catch (error) {
        console.error('Matchmaking leave error:', error);
        res.status(500).json({ error: error.message });
    }
}
