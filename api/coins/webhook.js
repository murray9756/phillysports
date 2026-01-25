// Coin Purchase Webhook
// POST: Handle Stripe webhook events for coin pack purchases

import { getCollection } from '../lib/mongodb.js';
import { constructWebhookEvent } from '../lib/payments/stripe.js';
import { addCoins } from '../lib/coins.js';
import { ObjectId } from 'mongodb';
import { COIN_PACKS } from './packs.js';

export const config = {
    api: {
        bodyParser: false
    }
};

async function getRawBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    let event;

    try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['stripe-signature'];

        if (!signature) {
            return res.status(400).json({ error: 'Missing stripe-signature header' });
        }

        event = constructWebhookEvent(rawBody, signature);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            // Only handle coin purchases (not subscriptions)
            if (session.mode === 'payment' && session.metadata?.type === 'coin_purchase') {
                const userId = session.metadata.userId;
                const packId = session.metadata.packId;
                const coins = parseInt(session.metadata.coins);

                if (!userId || !packId || !coins) {
                    console.error('Missing metadata in coin purchase webhook');
                    return res.status(400).json({ error: 'Missing metadata' });
                }

                // Check if this purchase was already processed (idempotency)
                const purchases = await getCollection('coin_purchases');
                const existing = await purchases.findOne({ stripeSessionId: session.id });

                if (existing) {
                    console.log('Coin purchase already processed:', session.id);
                    return res.status(200).json({ received: true, duplicate: true });
                }

                // Find the pack for description
                const pack = COIN_PACKS.find(p => p.id === packId);
                const packName = pack?.name || 'Coin Pack';

                // Award coins to user (no multiplier - paid purchase)
                const newBalance = await addCoins(
                    userId,
                    coins,
                    'purchase',
                    `Purchased ${packName}`,
                    {
                        packId,
                        amountPaid: session.amount_total,
                        stripeSessionId: session.id
                    },
                    { skipMultiplier: true }
                );

                // Record the purchase
                await purchases.insertOne({
                    userId: new ObjectId(userId),
                    packId,
                    coins,
                    amountPaid: session.amount_total,
                    currency: session.currency,
                    stripeSessionId: session.id,
                    stripePaymentIntentId: session.payment_intent,
                    status: 'completed',
                    createdAt: new Date()
                });

                console.log(`Awarded ${coins} coins to user ${userId}, new balance: ${newBalance}`);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Coin webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
}
