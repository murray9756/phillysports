// Subscription Management Library
// Handles Diehard Premium membership (single tier)

import { ObjectId } from 'mongodb';
import { getCollection } from './mongodb.js';
import { getStripeInstance } from './payments/stripe.js';

// Founders Club - first 76 premium subscribers get lifetime enhanced benefits
export const FOUNDERS_CLUB_LIMIT = 76;

// Subscription tiers - simplified to just Free and Premium
export const SUBSCRIPTION_TIERS = {
    FREE: 'free',
    PREMIUM: 'premium',
    // Legacy mappings for existing users
    DIEHARD_PLUS: 'premium',
    DIEHARD_PRO: 'premium'
};

// Tier benefits
export const TIER_BENEFITS = {
    free: {
        name: 'Free',
        price: 0,
        coinMultiplier: 1,              // 1x on all earnings
        monthlyBonusCoins: 0,           // No monthly grant
        freeContestEntriesPerWeek: 0,   // No free contest entries
        exclusiveRaffles: false,        // No access to Premium Raffles (graded cards, tickets)
        premiumBadge: false,            // No premium badge
        noSellerFees: false,            // Pay 5% seller fee
        customEmail: false,             // No @phillysports.com email
        canCreatePrivatePoker: false,   // Cannot create private poker games
        adFree: false
    },
    premium: {
        name: 'Diehard Premium',
        priceMonthly: 499,              // $4.99/month
        priceYearly: 3999,              // $39.99/year (~33% savings)
        coinMultiplier: 2,              // 2x on ALL earnings (login, comments, trivia, referrals)
        monthlyBonusCoins: 500,         // 500 DD monthly grant
        freeContestEntriesPerWeek: 1,   // 1 free premium contest entry per week
        exclusiveRaffles: true,         // Access to Premium Raffles (graded cards, tickets, better prizes)
        premiumBadge: true,             // Gold premium badge
        noSellerFees: true,             // No marketplace seller fees
        customEmail: true,              // @phillysports.com email
        canCreatePrivatePoker: true,    // Can create/host private poker games
        adFree: true
    },
    // Legacy tier mappings (redirect to premium benefits)
    diehard_plus: null,  // Mapped to premium
    diehard_pro: null    // Mapped to premium
};

// Founders Club benefits - enhanced premium for first 76 subscribers
export const FOUNDER_BENEFITS = {
    name: 'Founders Club',
    coinMultiplier: 3,              // 3x on ALL earnings (vs 2x for regular premium)
    monthlyBonusCoins: 1000,        // 1000 DD monthly grant (vs 500)
    freeContestEntriesPerWeek: 2,   // 2 free premium contest entries per week (vs 1)
    exclusiveRaffles: true,
    premiumBadge: true,
    founderBadge: true,             // Special Founders Club badge
    noSellerFees: true,
    customEmail: true,
    canCreatePrivatePoker: true,
    adFree: true,
    foundersEvents: true,           // Access to founders-only events
    earlyAccess: true,              // Early access to new features
    canVoteOnFeatures: true         // Vote on site features, changes, and roadmap
};

// Helper to get actual benefits (handles legacy tier names)
export function getTierBenefits(tier) {
    // Normalize tier name
    const normalizedTier = tier?.toLowerCase() || 'free';

    // Legacy tier mapping
    if (normalizedTier === 'diehard_plus' || normalizedTier === 'diehard_pro') {
        return TIER_BENEFITS.premium;
    }

    return TIER_BENEFITS[normalizedTier] || TIER_BENEFITS.free;
}

// Stripe Price IDs (quarterly and annual options only)
const STRIPE_PRICE_IDS = {
    premium_quarterly: process.env.STRIPE_PRICE_PREMIUM_QUARTERLY,
    premium_yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
    // Legacy support (map old tiers to new quarterly)
    premium_monthly: process.env.STRIPE_PRICE_PREMIUM_QUARTERLY,
    diehard_plus_monthly: process.env.STRIPE_PRICE_PREMIUM_QUARTERLY,
    diehard_plus_annual: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
    diehard_pro_monthly: process.env.STRIPE_PRICE_PREMIUM_QUARTERLY,
    diehard_pro_annual: process.env.STRIPE_PRICE_PREMIUM_YEARLY
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
                stripeSubscriptionId: 1,
                isFounder: 1,
                founderNumber: 1
            }
        }
    );

    if (!user) return null;

    const rawTier = user.subscriptionTier || 'free';
    // Normalize legacy tiers to 'premium'
    const tier = (rawTier === 'diehard_plus' || rawTier === 'diehard_pro') ? 'premium' : rawTier;

    // Founders get enhanced benefits (lifetime, even if subscription lapses and returns)
    const isFounder = user.isFounder === true;
    const isPremiumActive = tier === 'premium' && user.subscriptionStatus === 'active';

    // Use founder benefits if they're a founder AND have active premium
    const benefits = (isFounder && isPremiumActive) ? FOUNDER_BENEFITS : getTierBenefits(tier);

    return {
        tier,
        tierName: isFounder && isPremiumActive ? 'Founders Club' : benefits.name,
        status: user.subscriptionStatus || 'none',
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        interval: user.subscriptionInterval,
        benefits,
        isActive: user.subscriptionStatus === 'active' || tier === 'free',
        isPremium: isPremiumActive,
        isFounder,
        founderNumber: user.founderNumber || null
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

    // Always use 'premium' tier now (normalize legacy tiers)
    const rawTier = subscriptionData.metadata?.tier || 'premium';
    const tier = (rawTier === 'diehard_plus' || rawTier === 'diehard_pro') ? 'premium' : rawTier;
    const interval = subscriptionData.items?.data[0]?.price?.recurring?.interval || 'month';

    // Check if user already has a founder number (don't reassign)
    const existingUser = await users.findOne({ _id: userIdObj });
    let isFounder = existingUser?.isFounder || false;
    let founderNumber = existingUser?.founderNumber || null;

    // If no founder number yet, check if they qualify for Founders Club
    if (!founderNumber) {
        // Count how many founders we have
        const founderCount = await users.countDocuments({
            founderNumber: { $exists: true, $ne: null }
        });

        if (founderCount < FOUNDERS_CLUB_LIMIT) {
            founderNumber = founderCount + 1;
            isFounder = true;
            console.log(`New Founders Club member #${founderNumber}: ${existingUser?.username || userId}`);
        }
    }

    const updateFields = {
        subscriptionTier: tier,
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(subscriptionData.current_period_start * 1000),
        subscriptionEndDate: new Date(subscriptionData.current_period_end * 1000),
        subscriptionInterval: interval,
        stripeSubscriptionId: subscriptionData.id,
        updatedAt: new Date()
    };

    // Add founder fields if they qualify
    if (founderNumber && !existingUser?.founderNumber) {
        updateFields.isFounder = true;
        updateFields.founderNumber = founderNumber;
        updateFields.founderJoinedAt = new Date();
    }

    await users.updateOne(
        { _id: userIdObj },
        { $set: updateFields }
    );

    // Award badges
    const badges = await getCollection('user_badges');

    // Premium badge
    const premiumBadgeName = 'Diehard Premium';
    const existingPremiumBadge = await badges.findOne({
        userId: userIdObj,
        badge: premiumBadgeName
    });

    if (!existingPremiumBadge) {
        await badges.insertOne({
            userId: userIdObj,
            badge: premiumBadgeName,
            earnedAt: new Date(),
            source: 'subscription'
        });
    }

    // Founders Club badge (if they're a founder)
    if (isFounder) {
        const founderBadgeName = 'Founders Club';
        const existingFounderBadge = await badges.findOne({
            userId: userIdObj,
            badge: founderBadgeName
        });

        if (!existingFounderBadge) {
            await badges.insertOne({
                userId: userIdObj,
                badge: founderBadgeName,
                earnedAt: new Date(),
                source: 'founders_club',
                founderNumber: founderNumber,
                description: `Founder #${founderNumber} of 76`
            });
        }
    }

    return { tier, status: 'active', isFounder, founderNumber };
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
                subscriptionTier: 'free',
                subscriptionStatus: 'expired',
                stripeSubscriptionId: null,
                updatedAt: new Date()
            }
        }
    );

    return { tier: 'free', status: 'expired' };
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
 * Get coin multiplier for user (applies to ALL earnings)
 * Founders get 3x, Premium gets 2x, Free gets 1x
 */
export async function getCoinMultiplier(userId) {
    const status = await getSubscriptionStatus(userId);
    if (!status || !status.isActive) return 1;
    return status.benefits.coinMultiplier || 1;
}

/**
 * Check if user is a Founders Club member
 */
export async function isFounderMember(userId) {
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne(
        { _id: userIdObj },
        { projection: { isFounder: 1, founderNumber: 1 } }
    );

    return {
        isFounder: user?.isFounder === true,
        founderNumber: user?.founderNumber || null
    };
}

/**
 * Get count of current founders (for display purposes)
 */
export async function getFoundersCount() {
    const users = await getCollection('users');
    const count = await users.countDocuments({
        founderNumber: { $exists: true, $ne: null }
    });
    return {
        current: count,
        limit: FOUNDERS_CLUB_LIMIT,
        spotsRemaining: Math.max(0, FOUNDERS_CLUB_LIMIT - count)
    };
}

// Alias for backward compatibility
export const getDailyCoinMultiplier = getCoinMultiplier;

/**
 * Check if user has specific benefit
 */
export async function hasBenefit(userId, benefit) {
    const status = await getSubscriptionStatus(userId);
    if (!status || !status.isActive) return false;
    return status.benefits[benefit] === true;
}

/**
 * Get all benefits for a user
 */
export async function getUserBenefits(userId) {
    const status = await getSubscriptionStatus(userId);
    if (!status || !status.isActive) return getTierBenefits('free');
    return status.benefits;
}

/**
 * Check if user is a premium subscriber
 */
export async function isPremiumUser(userId) {
    const status = await getSubscriptionStatus(userId);
    return status?.isPremium || false;
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
