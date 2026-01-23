// Get specific challenge state
// GET /api/trivia/challenge/[id]

import { authenticate } from '../../lib/auth.js';
import { getChallengeState, handleTimeout } from '../../lib/trivia/challengeEngine.js';

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

        const { id } = req.query;

        // Check for timeout first
        await handleTimeout(id);

        // Get challenge state
        const state = await getChallengeState(id, decoded.userId);

        res.status(200).json(state);
    } catch (error) {
        console.error('Get challenge error:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            error: error.message
        });
    }
}
