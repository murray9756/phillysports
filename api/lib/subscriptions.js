// Subscription Management Library
// Handles Diehard+ and Diehard Pro membership tiers

import { ObjectId } from 'mongodb';
import { getCollection } from './mongodb.js';
import { getStripeInstance } from './payments/stripe.js';

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
    FREE: 'free',
    DIEHARD_PLUS: 'diehard_plus',
    DIEHARD_PRO: 'diehard_pro'
};

// Tier benefits
export const TIER_BENEFITS = {
    [SUBSCRIPTION_TIERS.FREE]: {
        name: 'Free',
        price: 0,
        dailyCoinMultiplier: 1,
        adFree: false,
        exclusiveBadges: false,
        earlyRaffleAccess: false,
        exclusiveForums: false,
        priorityPoker: false,
        monthlyMerchDiscount: null,
        customEmail: false
    },
    [SUBSCRIPTION_TIERS.DIEHARD_PLUS]: {
        name: 'Diehard+',
        priceMonthly: 499, // cents
        priceAnnual: 4490, // cents ($44.90/year = ~$3.74/mo)
        dailyCoinMultiplier: 2,
        adFree: true,
        exclusiveBadges: true,
        earlyRaffleAccess: true,
        exclusiveForums: false,
        priorityPoker: false,
        monthlyMerchDiscount: null,
        customEmail: false
    },
    [SUBSCRIPTION_TIERS.DIEHARD_PRO]: {
        name: 'Diehard Pro',
        priceMonthly: 999, // cents
        priceAnnual: 8900, // cents ($89/year = ~$7.42/mo)
        dailyCoinMultiplier: 2,
        adFree: true,
        exclusiveBadges: true,
        earlyRaffleAccess: true,
        exclusiveForums: true,
        priorityPoker: true,
        monthlyMerchDiscount: 10, // 10% off
        customEmail: true // @phillysports.com
    }
};

// Stripe Price IDs (set these in environment variables after creating products in Stripe)
const STRIPE_PRICE_IDS = {
    diehard_plus_monthly: process.env.STRIPE_PRICE_DIEHARD_PLUS_MONTHLY,
    diehard_plus_annual: process.env.STRIPE_PRICE_DIEHARD_PLUS_ANNUAL,
    diehard_pro_monthly: process.env.STRIPE_PRICE_DIEHARD_PRO_MONTHLY,
    diehard_pro_annual: process.env.STRIPE_PRICE_DIEHARD_PRO_ANNUAL
};

/**
 * Get user's current subscription status
 */
export async function getSubscriptionStatus(userId) {
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne(
        { _id: userIdObj },
        {
            projection: {
                subscriptionTier: 1,
                subscriptionStatus: 1,
                subscriptionStartDate: 1,
                subscriptionEndDate: 1,
                subscriptionInterval: 1,
                stripeCustomerId: 1,
                stripeSubscriptionId: 1
            }
        }
    );

    if (!user) return null;

    const tier = user.subscriptionTier || SUBSCRIPTION_TIERS.FREE;
    const benefits = TIER_BENEFITS[tier];

    return {
        tier,
        tierName: benefits.name,
        status: user.subscriptionStatus || 'none',
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        interval: user.subscriptionInterval,
        benefits,
        isActive: user.subscriptionStatus === 'active' || tier === SUBSCRIPTION_TIERS.FREE
    };
}

/**
 * Create Stripe checkout session for subscription
 */
export async function createCheckoutSession(userId, tier, interval, returnUrl) {
    const stripe = getStripeInstance();
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne({ _id: userIdObj });
    if (!user) throw new Error('User not found');

    // Get the correct price ID
    const priceKey = `${tier}_${interval}`;
    const priceId = STRIPE_PRICE_IDS[priceKey];

    if (!priceId) {
        throw new Error(`Price ID not configured for ${priceKey}. Set STRIPE_PRICE_${priceKey.toUpperCase()} env var.`);
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
                userId: userId.toString(),
                username: user.username
            }
        });
        customerId = customer.id;

        // Save customer ID
        await users.updateOne(
            { _id: userIdObj },
            { $set: { stripeCustomerId: customerId } }
        );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
            price: priceId,
            quantity: 1
        }],
        success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?canceled=true`,
        metadata: {
            userId: userId.toString(),
            tier,
            interval
        },
        subscription_data: {
            metadata: {
                userId: userId.toString(),
                tier
            }
        },
        allow_promotion_codes: true
    });

    return {
        sessionId: session.id,
        url: session.url
    };
}

/**
 * Handle successful subscription (called from webhook)
 */
export async function activateSubscription(userId, subscriptionData) {
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const tier = subscriptionData.metadata?.tier || SUBSCRIPTION_TIERS.DIEHARD_PLUS;
    const interval = subscriptionData.items?.data[0]?.price?.recurring?.interval || 'month';

    await users.updateOne(
        { _id: userIdObj },
        {
            $set: {
                subscriptionTier: tier,
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(subscriptionData.current_period_start * 1000),
                subscriptionEndDate: new Date(subscriptionData.current_period_end * 1000),
                subscriptionInterval: interval,
                stripeSubscriptionId: subscriptionData.id,
                updatedAt: new Date()
            }
        }
    );

    // Award premium badge if not already awarded
    const badges = await getCollection('user_badges');
    const badgeName = tier === SUBSCRIPTION_TIERS.DIEHARD_PRO ? 'Diehard Pro' : 'Diehard+';

    const existingBadge = await badges.findOne({
        userId: userIdObj,
        badge: badgeName
    });

    if (!existingBadge) {
        await badges.insertOne({
            userId: userIdObj,
            badge: badgeName,
            earnedAt: new Date(),
            source: 'subscription'
        });
    }

    return { tier, status: 'active' };
}

/**
 * Handle subscription cancellation (called from webhook)
 */
export async function cancelSubscription(userId) {
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Keep access until period end (status will be 'canceled' but tier remains)
    await users.updateOne(
        { _id: userIdObj },
        {
            $set: {
                subscriptionStatus: 'canceled',
                updatedAt: new Date()
            }
        }
    );

    return { status: 'canceled' };
}

/**
 * Handle subscription expiration (called from webhook or cron)
 */
export async function expireSubscription(userId) {
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    await users.updateOne(
        { _id: userIdObj },
        {
            $set: {
                subscriptionTier: SUBSCRIPTION_TIERS.FREE,
                subscriptionStatus: 'expired',
                stripeSubscriptionId: null,
                updatedAt: new Date()
            }
        }
    );

    return { tier: SUBSCRIPTION_TIERS.FREE, status: 'expired' };
}

/**
 * Cancel subscription via API
 */
export async function requestCancellation(userId) {
    const stripe = getStripeInstance();
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne({ _id: userIdObj });
    if (!user?.stripeSubscriptionId) {
        throw new Error('No active subscription found');
    }

    // Cancel at period end (user keeps access until then)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true
    });

    await users.updateOne(
        { _id: userIdObj },
        {
            $set: {
                subscriptionStatus: 'canceling',
                updatedAt: new Date()
            }
        }
    );

    return {
        status: 'canceling',
        message: 'Your subscription will end at the current billing period'
    };
}

/**
 * Reactivate a canceled subscription (before period ends)
 */
export async function reactivateSubscription(userId) {
    const stripe = getStripeInstance();
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne({ _id: userIdObj });
    if (!user?.stripeSubscriptionId) {
        throw new Error('No subscription found');
    }

    // Remove cancel_at_period_end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false
    });

    await users.updateOne(
        { _id: userIdObj },
        {
            $set: {
                subscriptionStatus: 'active',
                updatedAt: new Date()
            }
        }
    );

    return { status: 'active' };
}

/**
 * Get daily coin multiplier for user
 */
export async function getDailyCoinMultiplier(userId) {
    const status = await getSubscriptionStatus(userId);
    if (!status || !status.isActive) return 1;
    return status.benefits.dailyCoinMultiplier;
}

/**
 * Check if user has specific benefit
 */
export async function hasBenefit(userId, benefit) {
    const status = await getSubscriptionStatus(userId);
    if (!status || !status.isActive) return false;
    return status.benefits[benefit] === true;
}

/**
 * Create Stripe customer portal session (for managing billing)
 */
export async function createPortalSession(userId, returnUrl) {
    const stripe = getStripeInstance();
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne({ _id: userIdObj });
    if (!user?.stripeCustomerId) {
        throw new Error('No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl
    });

    return { url: session.url };
}
