// Subscription Checkout API
// POST: Create Stripe checkout session for subscription

import { authenticate } from '../lib/auth.js';
import { createCheckoutSession, SUBSCRIPTION_TIERS } from '../lib/subscriptions.js';
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

        const { tier, interval = 'month' } = req.body;

        // Validate tier
        if (!tier || ![SUBSCRIPTION_TIERS.DIEHARD_PLUS, SUBSCRIPTION_TIERS.DIEHARD_PRO].includes(tier)) {
            return res.status(400).json({ error: 'Invalid subscription tier' });
        }

        // Validate interval
        if (!['month', 'year'].includes(interval)) {
            return res.status(400).json({ error: 'Invalid billing interval' });
        }

        // Map tier to Stripe price key format
        const tierKey = tier === SUBSCRIPTION_TIERS.DIEHARD_PLUS ? 'diehard_plus' : 'diehard_pro';
        const intervalKey = interval === 'year' ? 'annual' : 'monthly';

        const returnUrl = process.env.SITE_URL
            ? `${process.env.SITE_URL}/membership.html`
            : 'https://phillysports.com/membership.html';

        const session = await createCheckoutSession(
            decoded.userId,
            tierKey,
            intervalKey,
            returnUrl
        );

        res.status(200).json({
            success: true,
            sessionId: session.sessionId,
            checkoutUrl: session.url
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
}
