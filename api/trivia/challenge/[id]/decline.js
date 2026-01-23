// Decline a challenge
// POST /api/trivia/challenge/[id]/decline

import { authenticate } from '../../../lib/auth.js';
import { declineChallenge } from '../../../lib/trivia/challengeEngine.js';

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

        await declineChallenge(id, decoded.userId);

        // TODO: Send Pusher notification to challenger

        res.status(200).json({
            success: true,
            message: 'Challenge declined'
        });
    } catch (error) {
        console.error('Decline challenge error:', error);
        res.status(400).json({ error: error.message });
    }
}
