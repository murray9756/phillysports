// Join random matchmaking queue
// POST /api/trivia/matchmaking/join

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import { createChallenge, WAGER_TIERS } from '../../lib/trivia/challengeEngine.js';
import { deductCoins } from '../../lib/coins.js';

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
        const { wagerAmount } = req.body;

        if (!wagerAmount || !WAGER_TIERS.includes(wagerAmount)) {
            return res.status(400).json({
                error: 'Invalid wager amount',
                validTiers: WAGER_TIERS
            });
        }

        const users = await getCollection('users');
        const queue = await getCollection('trivia_matchmaking_queue');

        // Get user info and verify balance
        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if ((user.coinBalance || 0) < wagerAmount) {
            return res.status(400).json({ error: 'Insufficient coins for wager' });
        }

        // Check if already in queue
        const existingEntry = await queue.findOne({
            userId: new ObjectId(userId),
            status: 'waiting'
        });
        if (existingEntry) {
            return res.status(400).json({ error: 'Already in matchmaking queue' });
        }

        // Look for opponent with same wager tier
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const opponent = await queue.findOne({
            userId: { $ne: new ObjectId(userId) },
            wagerAmount,
            status: 'waiting',
            joinedAt: { $gte: fiveMinutesAgo }
        });

        if (opponent) {
            // Found match! Create challenge
            await queue.updateOne(
                { _id: opponent._id },
                { $set: { status: 'matched' } }
            );

            // Lock wager from this user
            await deductCoins(userId, wagerAmount, 'trivia_wager', 'Trivia challenge wager locked');

            // Create the challenge (opponent's wager already locked when they joined)
            const challenge = await createChallenge(
                opponent.userId.toString(),  // Opponent goes first (they've been waiting)
                userId,
                wagerAmount,
                'random'
            );

            // Add the pot from this user (createChallenge already deducted from challenger)
            // Update the challenge to include both wagers
            const challenges = await getCollection('trivia_challenges');
            await challenges.updateOne(
                { _id: challenge._id },
                {
                    $set: {
                        pot: wagerAmount * 2,
                        challenged: {
                            userId: new ObjectId(userId),
                            username: user.username
                        }
                    }
                }
            );

            // TODO: Send Pusher notifications to both players

            res.status(200).json({
                matched: true,
                challengeId: challenge._id.toString(),
                opponent: {
                    username: opponent.username
                }
            });
        } else {
            // No match - join queue
            // Lock wager while in queue
            await deductCoins(userId, wagerAmount, 'trivia_wager_queue', 'Trivia matchmaking wager locked');

            await queue.insertOne({
                userId: new ObjectId(userId),
                username: user.username,
                wagerAmount,
                status: 'waiting',
                joinedAt: new Date()
            });

            res.status(200).json({
                matched: false,
                inQueue: true,
                message: 'Waiting for opponent...'
            });
        }
    } catch (error) {
        console.error('Matchmaking join error:', error);
        res.status(500).json({ error: error.message });
    }
}
