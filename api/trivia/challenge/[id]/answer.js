// Submit an answer
// POST /api/trivia/challenge/[id]/answer

import { authenticate } from '../../../lib/auth.js';
import { submitAnswer, getChallengeState } from '../../../lib/trivia/challengeEngine.js';
import { sendTriviaNotification, PUSHER_EVENTS } from '../../../lib/pusher.js';
import { getCollection } from '../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

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

        const { id } = req.query;
        const { answer } = req.body;

        if (!answer) {
            return res.status(400).json({ error: 'Answer is required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        const result = await submitAnswer(id, decoded.userId, answer);

        // Get updated state
        const state = await getChallengeState(id, decoded.userId);

        // Determine opponent
        const opponentId = state.challenger.userId === decoded.userId
            ? state.challenged.userId
            : state.challenger.userId;

        // Send notifications based on result
        if (state.status === 'complete') {
            // Game over - notify opponent
            await sendTriviaNotification(opponentId, PUSHER_EVENTS.TRIVIA_MATCH_COMPLETE, {
                challengeId: id,
                winner: state.winner,
                message: state.winner.userId === decoded.userId
                    ? `${user.username} won the trivia challenge!`
                    : `You won the trivia challenge!`
            });
        } else if (!result.correct) {
            // Wrong answer - turn changes, notify opponent it's their turn
            await sendTriviaNotification(opponentId, PUSHER_EVENTS.TRIVIA_YOUR_TURN, {
                challengeId: id,
                opponent: { username: user.username },
                message: `It's your turn in trivia vs ${user.username}!`
            });
        }

        res.status(200).json({
            success: true,
            ...result,
            challenge: state
        });
    } catch (error) {
        console.error('Submit answer error:', error);
        res.status(400).json({ error: error.message });
    }
}
