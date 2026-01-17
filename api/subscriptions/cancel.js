// Subscription Cancel API
// POST: Cancel user's subscription (at period end)

import { authenticate } from '../lib/auth.js';
import { requestCancellation } from '../lib/subscriptions.js';
import { rateLimit } from '../lib/rateLimit.js';

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

    // Rate limit
    const allowed = await rateLimit(req, res, 'sensitive');
    if (!allowed) return;

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await requestCancellation(decoded.userId);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
    }
}
