// Admin: Refund and cancel subscription for a user
// POST: { email: "user@example.com" }

import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

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
        // Check admin auth
        const decoded = await authenticate(req);
        if (!decoded || decoded.email !== 'kevin@phillysports.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        const results = {
            subscriptionCanceled: false,
            refunds: []
        };

        // Cancel subscription if exists
        if (user.stripeSubscriptionId) {
            try {
                await stripe.subscriptions.cancel(user.stripeSubscriptionId);
                results.subscriptionCanceled = true;
            } catch (e) {
                results.subscriptionError = e.message;
            }
        }

        // Find and refund all payments for this customer
        if (user.stripeCustomerId) {
            const charges = await stripe.charges.list({
                customer: user.stripeCustomerId,
                limit: 10
            });

            for (const charge of charges.data) {
                if (charge.refunded) {
                    results.refunds.push({ id: charge.id, status: 'already refunded' });
                    continue;
                }

                try {
                    const refund = await stripe.refunds.create({
                        charge: charge.id
                    });
                    results.refunds.push({
                        id: charge.id,
                        amount: charge.amount / 100,
                        status: 'refunded',
                        refundId: refund.id
                    });
                } catch (e) {
                    results.refunds.push({ id: charge.id, status: 'error', error: e.message });
                }
            }
        }

        // Reset user subscription status
        await users.updateOne(
            { _id: user._id },
            {
                $set: {
                    subscriptionTier: 'free',
                    subscriptionStatus: null,
                    updatedAt: new Date()
                },
                $unset: {
                    stripeSubscriptionId: '',
                    subscriptionStartDate: '',
                    subscriptionEndDate: '',
                    subscriptionInterval: ''
                }
            }
        );

        res.status(200).json({
            success: true,
            email: user.email,
            ...results
        });
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: error.message });
    }
}
