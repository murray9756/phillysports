// Subscription Downgrade API
// POST: Schedule downgrade to lower tier at period end

import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';
import { rateLimit } from '../lib/rateLimit.js';
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

    const allowed = await rateLimit(req, res, 'sensitive');
    if (!allowed) return;

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { newTier } = req.body;

        if (!newTier || !['diehard_plus', 'free'].includes(newTier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be diehard_plus or free' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No active subscription' });
        }

        // Validate downgrade path
        if (user.subscriptionTier === 'diehard_plus' && newTier !== 'free') {
            return res.status(400).json({ error: 'Can only downgrade to free from Plus' });
        }
        if (user.subscriptionTier === 'diehard_pro' && !['diehard_plus', 'free'].includes(newTier)) {
            return res.status(400).json({ error: 'Invalid downgrade tier' });
        }
        if (user.subscriptionTier === newTier) {
            return res.status(400).json({ error: 'Already on this tier' });
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        if (subscription.status !== 'active') {
            return res.status(400).json({ error: 'Subscription is not active' });
        }

        const periodEnd = new Date(subscription.current_period_end * 1000);

        if (newTier === 'free') {
            // Cancel at period end (same as regular cancel)
            await stripe.subscriptions.update(user.stripeSubscriptionId, {
                cancel_at_period_end: true
            });

            await users.updateOne(
                { _id: user._id },
                {
                    $set: {
                        subscriptionStatus: 'canceling',
                        scheduledTier: 'free',
                        updatedAt: new Date()
                    }
                }
            );
        } else {
            // Downgrade to Plus at period end using subscription schedule
            const interval = subscription.items.data[0].price.recurring.interval;
            const priceKey = `STRIPE_PRICE_DIEHARD_PLUS_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
            const newPriceId = process.env[priceKey];

            if (!newPriceId) {
                return res.status(500).json({ error: 'Price configuration error' });
            }

            // Schedule the price change for the next billing period
            await stripe.subscriptions.update(user.stripeSubscriptionId, {
                items: [{
                    id: subscription.items.data[0].id,
                    price: newPriceId
                }],
                proration_behavior: 'none', // No proration - change happens at renewal
                billing_cycle_anchor: 'unchanged'
            });

            await users.updateOne(
                { _id: user._id },
                {
                    $set: {
                        // Keep current tier until webhook confirms the change
                        scheduledTier: newTier,
                        updatedAt: new Date()
                    }
                }
            );
        }

        const tierNames = {
            'diehard_plus': 'Diehard+',
            'diehard_pro': 'Diehard Pro',
            'free': 'Free'
        };

        res.status(200).json({
            success: true,
            message: newTier === 'free'
                ? `Your subscription will be canceled on ${periodEnd.toLocaleDateString()}`
                : `You'll be downgraded to ${tierNames[newTier]} on ${periodEnd.toLocaleDateString()}`,
            currentTier: user.subscriptionTier,
            scheduledTier: newTier,
            effectiveDate: periodEnd.toISOString()
        });
    } catch (error) {
        console.error('Downgrade error:', error);
        res.status(500).json({ error: error.message || 'Failed to downgrade subscription' });
    }
}
