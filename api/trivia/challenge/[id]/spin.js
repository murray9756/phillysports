// Pick a category and get a question
// POST /api/trivia/challenge/[id]/spin
// Body: { category: "Eagles" } (optional - if omitted, picks random missing category)

import { authenticate } from '../../../lib/auth.js';
import { spinWheel } from '../../../lib/trivia/challengeEngine.js';

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
        const { category } = req.body || {};

        const result = await spinWheel(id, decoded.userId, category || null);

        res.status(200).json({
            success: true,
            category: result.category,
            question: result.question
        });
    } catch (error) {
        console.error('Pick category error:', error);
        res.status(400).json({ error: error.message });
    }
}
