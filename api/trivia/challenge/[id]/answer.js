// Submit an answer
// POST /api/trivia/challenge/[id]/answer

import { authenticate } from '../../../lib/auth.js';
import { submitAnswer, getChallengeState } from '../../../lib/trivia/challengeEngine.js';

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

        const result = await submitAnswer(id, decoded.userId, answer);

        // TODO: Send Pusher events for answer result, pie piece won, game over

        // Get updated state
        const state = await getChallengeState(id, decoded.userId);

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
