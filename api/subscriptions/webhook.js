// Stripe Webhook
// POST: Handle Stripe webhook events for subscriptions and purchases

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { constructWebhookEvent } from '../lib/payments/stripe.js';
import {
    activateSubscription,
    cancelSubscription,
    expireSubscription
} from '../lib/subscriptions.js';

export const config = {
    api: {
        bodyParser: false // Need raw body for webhook verification
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

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;

                // Handle subscription checkouts
                if (session.mode === 'subscription' && session.subscription) {
                    console.log('Checkout completed for subscription:', session.subscription);

                    // Also activate here as backup (in case subscription.created doesn't have metadata)
                    const userId = session.metadata?.userId;
                    const tier = session.metadata?.tier;

                    if (userId && tier) {
                        const users = await getCollection('users');
                        const now = new Date();
                        const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                        await users.updateOne(
                            { _id: new ObjectId(userId) },
                            {
                                $set: {
                                    subscriptionTier: tier,
                                    subscriptionStatus: 'active',
                                    subscriptionStartDate: now,
                                    subscriptionEndDate: endDate,
                                    subscriptionInterval: session.metadata?.interval || 'month',
                                    stripeSubscriptionId: session.subscription,
                                    updatedAt: now
                                }
                            }
                        );
                        console.log(`Subscription activated via checkout for user ${userId}, tier ${tier}`);
                    }
                }

                // Handle coin pack purchases
                if (session.mode === 'payment' && session.metadata?.type === 'coin_purchase') {
                    const userId = session.metadata.userId;
                    const coins = parseInt(session.metadata.coins, 10);
                    const packId = session.metadata.packId;

                    if (userId && coins > 0) {
                        const users = await getCollection('users');
                        const purchases = await getCollection('coin_purchases');

                        // Check if already processed (idempotency)
                        const existing = await purchases.findOne({ stripeSessionId: session.id });
                        if (existing) {
                            console.log(`Coin purchase already processed: ${session.id}`);
                            break;
                        }

                        // Add coins to user
                        await users.updateOne(
                            { _id: new ObjectId(userId) },
                            {
                                $inc: { diehardDollars: coins },
                                $set: { updatedAt: new Date() }
                            }
                        );

                        // Record purchase
                        await purchases.insertOne({
                            userId: new ObjectId(userId),
                            stripeSessionId: session.id,
                            stripePaymentIntent: session.payment_intent,
                            packId,
                            coins,
                            amountPaid: session.amount_total,
                            currency: session.currency,
                            status: 'completed',
                            createdAt: new Date()
                        });

                        console.log(`Added ${coins} Diehard Dollars to user ${userId}`);
                    }
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                let userId = subscription.metadata?.userId;

                // If no userId in metadata, try to find user by customer ID
                if (!userId && subscription.customer) {
                    const users = await getCollection('users');
                    const user = await users.findOne({ stripeCustomerId: subscription.customer });
                    if (user) {
                        userId = user._id.toString();
                        console.log(`Found user ${userId} by customer ID ${subscription.customer}`);
                    }
                }

                if (!userId) {
                    console.error('No userId found - metadata:', subscription.metadata, 'customer:', subscription.customer);
                    break;
                }

                if (subscription.status === 'active') {
                    await activateSubscription(userId, subscription);
                    console.log(`Subscription activated for user ${userId}`);
                } else if (subscription.status === 'canceled') {
                    await cancelSubscription(userId);
                    console.log(`Subscription canceled for user ${userId}`);
                } else if (subscription.status === 'past_due') {
                    // Update user status but don't remove access yet
                    const users = await getCollection('users');
                    await users.updateOne(
                        { stripeSubscriptionId: subscription.id },
                        { $set: { subscriptionStatus: 'past_due', updatedAt: new Date() } }
                    );
                    console.log(`Subscription past due for user ${userId}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const userId = subscription.metadata?.userId;

                if (userId) {
                    await expireSubscription(userId);
                    console.log(`Subscription expired for user ${userId}`);
                } else {
                    // Find user by subscription ID
                    const users = await getCollection('users');
                    const user = await users.findOne({ stripeSubscriptionId: subscription.id });
                    if (user) {
                        await expireSubscription(user._id.toString());
                        console.log(`Subscription expired for user ${user._id}`);
                    }
                }
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object;

                // Log successful payment
                if (invoice.subscription) {
                    console.log(`Invoice paid for subscription ${invoice.subscription}`);

                    // Could award bonus coins on renewal here
                    const users = await getCollection('users');
                    const user = await users.findOne({ stripeSubscriptionId: invoice.subscription });
                    if (user) {
                        // Optionally award renewal bonus
                        // await addCoins(user._id, 100, 'subscription_renewal', 'Subscription renewal bonus');
                    }
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;

                if (invoice.subscription) {
                    console.log(`Payment failed for subscription ${invoice.subscription}`);

                    // Notify user of payment failure
                    const users = await getCollection('users');
                    const user = await users.findOne({ stripeSubscriptionId: invoice.subscription });
                    if (user) {
                        // Could send notification here
                        // await sendNotification(user._id, 'payment_failed', ...)
                    }
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
}
