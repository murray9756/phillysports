// Diehard Dollar Purchase API
// POST: Create Stripe checkout session for coin pack purchase

import { ObjectId } from 'mongodb';
import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';
import { getStripeInstance } from '../lib/payments/stripe.js';
import { rateLimit } from '../lib/rateLimit.js';
import { COIN_PACKS } from './packs.js';

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

        const { packId } = req.body;

        // Find the pack
        const pack = COIN_PACKS.find(p => p.id === packId);
        if (!pack) {
            return res.status(400).json({ error: 'Invalid pack selected' });
        }

        const stripe = getStripeInstance();
        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create or get Stripe customer
        let customerId = user.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: decoded.userId,
                    username: user.username
                }
            });
            customerId = customer.id;

            await users.updateOne(
                { _id: new ObjectId(decoded.userId) },
                { $set: { stripeCustomerId: customerId } }
            );
        }

        const returnUrl = process.env.SITE_URL
            ? `${process.env.SITE_URL}/shop`
            : 'https://phillysports.com/shop';

        // Create checkout session for one-time payment
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${pack.name} - ${pack.coins.toLocaleString()} Diehard Dollars`,
                        description: pack.bonus > 0
                            ? `Includes ${pack.bonus.toLocaleString()} bonus coins!`
                            : `${pack.coins.toLocaleString()} Diehard Dollars`,
                        images: ['https://phillysports.com/images/diehard-dollars.png']
                    },
                    unit_amount: pack.priceUSD
                },
                quantity: 1
            }],
            success_url: `${returnUrl}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnUrl}?purchase=canceled`,
            metadata: {
                type: 'coin_purchase',
                userId: decoded.userId,
                packId: pack.id,
                coins: pack.coins.toString()
            }
        });

        res.status(200).json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url
        });
    } catch (error) {
        console.error('Coin purchase error:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
}
