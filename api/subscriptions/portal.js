// Subscription Portal API
// POST: Create Stripe customer portal session for billing management

import { authenticate } from '../lib/auth.js';
import { createPortalSession } from '../lib/subscriptions.js';
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
    const allowed = await rateLimit(req, res, 'api');
    if (!allowed) return;

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const returnUrl = process.env.SITE_URL
            ? `${process.env.SITE_URL}/membership`
            : 'https://phillysports.com/membership';

        const session = await createPortalSession(decoded.userId, returnUrl);

        res.status(200).json({
            success: true,
            portalUrl: session.url
        });
    } catch (error) {
        console.error('Portal session error:', error);
        res.status(500).json({ error: error.message || 'Failed to create portal session' });
    }
}
