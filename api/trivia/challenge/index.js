// Trivia Challenge API
// POST: Create a challenge
// GET: Get user's challenges (pending, active, history)

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import {
    createChallenge,
    getPendingChallenges,
    getActiveChallenges,
    getChallengeHistory,
    WAGER_TIERS
} from '../../lib/trivia/challengeEngine.js';
import { sendTriviaNotification, PUSHER_EVENTS } from '../../lib/pusher.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Authenticate user
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = decoded.userId;

        if (req.method === 'POST') {
            // Create a new challenge
            const { challengedUserId, challengedUsername, wagerAmount } = req.body;

            if (!wagerAmount || !WAGER_TIERS.includes(wagerAmount)) {
                return res.status(400).json({
                    error: 'Invalid wager amount',
                    validTiers: WAGER_TIERS
                });
            }

            // If username provided but not ID, look up the user
            let targetUserId = challengedUserId;
            if (!targetUserId && challengedUsername) {
                const users = await getCollection('users');
                const targetUser = await users.findOne({
                    username: { $regex: new RegExp(`^${challengedUsername}$`, 'i') }
                });
                if (!targetUser) {
                    return res.status(404).json({ error: 'User not found' });
                }
                if (targetUser._id.toString() === userId) {
                    return res.status(400).json({ error: 'Cannot challenge yourself' });
                }
                targetUserId = targetUser._id.toString();
            }

            if (!targetUserId) {
                return res.status(400).json({ error: 'challengedUserId or challengedUsername required' });
            }

            try {
                const challenge = await createChallenge(userId, targetUserId, wagerAmount, 'direct');

                // Send Pusher notification to challenged user
                await sendTriviaNotification(targetUserId, PUSHER_EVENTS.TRIVIA_CHALLENGE_RECEIVED, {
                    challengeId: challenge._id.toString(),
                    challenger: challenge.challenger,
                    wagerAmount,
                    message: `${challenge.challenger.username} challenged you to trivia for ${wagerAmount} DD!`
                });

                res.status(201).json({
                    success: true,
                    challenge: {
                        _id: challenge._id.toString(),
                        status: challenge.status,
                        wagerAmount: challenge.wagerAmount,
                        challenged: challenge.challenged,
                        expiresAt: challenge.expiresAt
                    }
                });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        } else if (req.method === 'GET') {
            // Get user's challenges
            const { type = 'all' } = req.query;

            const result = {};

            if (type === 'all' || type === 'pending') {
                result.pending = await getPendingChallenges(userId);
            }

            if (type === 'all' || type === 'active') {
                result.active = await getActiveChallenges(userId);
            }

            if (type === 'all' || type === 'history') {
                result.history = await getChallengeHistory(userId);
            }

            res.status(200).json(result);
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Trivia challenge error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}
