// Subscription Upgrade API
// POST: Upgrade/downgrade subscription tier

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

        if (!newTier || !['diehard_plus', 'diehard_pro'].includes(newTier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be diehard_plus or diehard_pro' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No active subscription to upgrade' });
        }

        if (user.subscriptionTier === newTier) {
            return res.status(400).json({ error: 'Already on this tier' });
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        // Get current subscription
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        if (subscription.status !== 'active') {
            return res.status(400).json({ error: 'Subscription is not active' });
        }

        // Determine the new price ID based on tier and current interval
        const interval = subscription.items.data[0].price.recurring.interval;
        const priceKey = `STRIPE_PRICE_${newTier.toUpperCase()}_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
        const newPriceId = process.env[priceKey];

        if (!newPriceId) {
            console.error(`Missing price ID for ${priceKey}`);
            return res.status(500).json({ error: 'Price configuration error' });
        }

        // Update subscription with proration
        const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
            items: [{
                id: subscription.items.data[0].id,
                price: newPriceId
            }],
            proration_behavior: 'always_invoice', // Immediately charge/credit the difference
            metadata: {
                tier: newTier,
                userId: decoded.userId
            }
        });

        // Update user in database
        await users.updateOne(
            { _id: user._id },
            {
                $set: {
                    subscriptionTier: newTier,
                    updatedAt: new Date()
                }
            }
        );

        // Get the prorated amount from the latest invoice
        let proratedAmount = null;
        try {
            const invoices = await stripe.invoices.list({
                subscription: user.stripeSubscriptionId,
                limit: 1
            });
            if (invoices.data.length > 0) {
                proratedAmount = invoices.data[0].amount_due / 100;
            }
        } catch (e) {
            // Ignore invoice lookup errors
        }

        const tierNames = {
            'diehard_plus': 'Diehard+',
            'diehard_pro': 'Diehard Pro'
        };

        res.status(200).json({
            success: true,
            message: `Upgraded to ${tierNames[newTier]}`,
            previousTier: user.subscriptionTier,
            newTier: newTier,
            proratedCharge: proratedAmount
        });
    } catch (error) {
        console.error('Upgrade error:', error);
        res.status(500).json({ error: error.message || 'Failed to upgrade subscription' });
    }
}
