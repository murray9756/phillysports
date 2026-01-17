// Admin Stripe Setup API
// POST: Create subscription products and prices in Stripe

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { getStripeInstance } from '../lib/payments/stripe.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Authenticate and verify admin
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const stripe = getStripeInstance();

        if (req.method === 'GET') {
            // List existing products and prices
            const products = await stripe.products.list({ limit: 100, active: true });
            const prices = await stripe.prices.list({ limit: 100, active: true });

            const subscriptionProducts = products.data.filter(p =>
                p.metadata?.type === 'subscription' ||
                p.name?.includes('Diehard')
            );

            return res.status(200).json({
                products: subscriptionProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    metadata: p.metadata
                })),
                prices: prices.data
                    .filter(pr => subscriptionProducts.some(p => p.id === pr.product))
                    .map(pr => ({
                        id: pr.id,
                        productId: pr.product,
                        unitAmount: pr.unit_amount,
                        currency: pr.currency,
                        recurring: pr.recurring,
                        nickname: pr.nickname
                    }))
            });
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const results = {
            products: [],
            prices: [],
            envVars: {}
        };

        // Create Diehard+ Product
        const diehardPlusProduct = await stripe.products.create({
            name: 'Diehard+',
            description: 'Premium membership with 2x daily coins, ad-free experience, exclusive badges, and early raffle access',
            metadata: {
                type: 'subscription',
                tier: 'diehard_plus'
            }
        });
        results.products.push({ name: 'Diehard+', id: diehardPlusProduct.id });

        // Diehard+ Monthly Price
        const diehardPlusMonthly = await stripe.prices.create({
            product: diehardPlusProduct.id,
            unit_amount: 499, // $4.99
            currency: 'usd',
            recurring: {
                interval: 'month'
            },
            nickname: 'Diehard+ Monthly'
        });
        results.prices.push({ name: 'Diehard+ Monthly', id: diehardPlusMonthly.id, amount: '$4.99/mo' });
        results.envVars.STRIPE_PRICE_DIEHARD_PLUS_MONTHLY = diehardPlusMonthly.id;

        // Diehard+ Annual Price
        const diehardPlusAnnual = await stripe.prices.create({
            product: diehardPlusProduct.id,
            unit_amount: 4490, // $44.90/year (~$3.74/mo)
            currency: 'usd',
            recurring: {
                interval: 'year'
            },
            nickname: 'Diehard+ Annual'
        });
        results.prices.push({ name: 'Diehard+ Annual', id: diehardPlusAnnual.id, amount: '$44.90/year' });
        results.envVars.STRIPE_PRICE_DIEHARD_PLUS_ANNUAL = diehardPlusAnnual.id;

        // Create Diehard Pro Product
        const diehardProProduct = await stripe.products.create({
            name: 'Diehard Pro',
            description: 'Ultimate membership with all Diehard+ benefits plus exclusive forums, priority poker tables, monthly merch discounts, and @phillysports.com email',
            metadata: {
                type: 'subscription',
                tier: 'diehard_pro'
            }
        });
        results.products.push({ name: 'Diehard Pro', id: diehardProProduct.id });

        // Diehard Pro Monthly Price
        const diehardProMonthly = await stripe.prices.create({
            product: diehardProProduct.id,
            unit_amount: 999, // $9.99
            currency: 'usd',
            recurring: {
                interval: 'month'
            },
            nickname: 'Diehard Pro Monthly'
        });
        results.prices.push({ name: 'Diehard Pro Monthly', id: diehardProMonthly.id, amount: '$9.99/mo' });
        results.envVars.STRIPE_PRICE_DIEHARD_PRO_MONTHLY = diehardProMonthly.id;

        // Diehard Pro Annual Price
        const diehardProAnnual = await stripe.prices.create({
            product: diehardProProduct.id,
            unit_amount: 8900, // $89/year (~$7.42/mo)
            currency: 'usd',
            recurring: {
                interval: 'year'
            },
            nickname: 'Diehard Pro Annual'
        });
        results.prices.push({ name: 'Diehard Pro Annual', id: diehardProAnnual.id, amount: '$89/year' });
        results.envVars.STRIPE_PRICE_DIEHARD_PRO_ANNUAL = diehardProAnnual.id;

        // Store the price IDs in a config collection for reference
        const config = await getCollection('site_config');
        await config.updateOne(
            { key: 'stripe_prices' },
            {
                $set: {
                    key: 'stripe_prices',
                    prices: results.envVars,
                    products: results.products,
                    createdAt: new Date(),
                    createdBy: new ObjectId(decoded.userId)
                }
            },
            { upsert: true }
        );

        res.status(200).json({
            success: true,
            message: 'Stripe products and prices created successfully',
            ...results,
            instructions: [
                'Add the following environment variables to your Vercel project:',
                '',
                ...Object.entries(results.envVars).map(([k, v]) => `${k}=${v}`),
                '',
                'Then configure a webhook endpoint at:',
                'https://phillysports.com/api/subscriptions/webhook',
                '',
                'Webhook events to listen for:',
                '- customer.subscription.created',
                '- customer.subscription.updated',
                '- customer.subscription.deleted',
                '- invoice.paid',
                '- invoice.payment_failed',
                '- checkout.session.completed'
            ]
        });
    } catch (error) {
        console.error('Stripe setup error:', error);

        // Handle duplicate product errors
        if (error.code === 'resource_already_exists') {
            return res.status(400).json({
                error: 'Products already exist in Stripe',
                message: 'Use GET to view existing products or delete them in Stripe Dashboard first'
            });
        }

        res.status(500).json({ error: error.message || 'Failed to setup Stripe' });
    }
}
