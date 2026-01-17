// Subscription Status API
// GET: Get current user's subscription status and benefits

import { authenticate } from '../lib/auth.js';
import { getSubscriptionStatus, TIER_BENEFITS, SUBSCRIPTION_TIERS } from '../lib/subscriptions.js';

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
            // Return free tier info for unauthenticated users
            return res.status(200).json({
                tier: SUBSCRIPTION_TIERS.FREE,
                tierName: 'Free',
                status: 'none',
                benefits: TIER_BENEFITS[SUBSCRIPTION_TIERS.FREE],
                isActive: false,
                availableTiers: [
                    {
                        tier: SUBSCRIPTION_TIERS.DIEHARD_PLUS,
                        ...TIER_BENEFITS[SUBSCRIPTION_TIERS.DIEHARD_PLUS]
                    },
                    {
                        tier: SUBSCRIPTION_TIERS.DIEHARD_PRO,
                        ...TIER_BENEFITS[SUBSCRIPTION_TIERS.DIEHARD_PRO]
                    }
                ]
            });
        }

        const status = await getSubscriptionStatus(decoded.userId);

        res.status(200).json({
            ...status,
            availableTiers: [
                {
                    tier: SUBSCRIPTION_TIERS.DIEHARD_PLUS,
                    ...TIER_BENEFITS[SUBSCRIPTION_TIERS.DIEHARD_PLUS]
                },
                {
                    tier: SUBSCRIPTION_TIERS.DIEHARD_PRO,
                    ...TIER_BENEFITS[SUBSCRIPTION_TIERS.DIEHARD_PRO]
                }
            ]
        });
    } catch (error) {
        console.error('Subscription status error:', error);
        res.status(500).json({ error: 'Failed to get subscription status' });
    }
}
