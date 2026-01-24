import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { addCoins, grantCoins, DAILY_LOGIN_BASE, STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS } from '../lib/coins.js';
import { rateLimit } from '../lib/rateLimit.js';
import { getSubscriptionStatus, getUserBenefits } from '../lib/subscriptions.js';

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

    // Rate limit: 60 requests per minute (general API limit)
    const allowed = await rateLimit(req, res, 'api');
    if (!allowed) return;

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastLogin = user.lastDailyLogin ? new Date(user.lastDailyLogin) : null;
        const lastLoginDay = lastLogin
            ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate())
            : null;

        // Check if already claimed today
        if (lastLoginDay && lastLoginDay.getTime() === today.getTime()) {
            return res.status(400).json({
                error: 'Daily bonus already claimed today',
                nextClaimAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
            });
        }

        // Calculate streak
        let newStreak = 1;
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastLoginDay && lastLoginDay.getTime() === yesterday.getTime()) {
            // Continued streak
            newStreak = (user.dailyLoginStreak || 0) + 1;
        }
        // else: streak resets to 1

        // Get subscription status and benefits
        const subscriptionStatus = await getSubscriptionStatus(decoded.userId);
        const benefits = subscriptionStatus?.benefits || { coinMultiplier: 1, monthlyBonusCoins: 0 };
        const isPremium = subscriptionStatus?.isPremium || false;
        const multiplier = benefits.coinMultiplier || 1;

        // Calculate bonus (multiplier is now applied by addCoins)
        const streakBonus = Math.min((newStreak - 1) * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
        const baseTotal = DAILY_LOGIN_BASE + streakBonus;

        // Check if user qualifies for monthly bonus (premium only)
        let monthlyBonusAwarded = 0;
        if (isPremium && benefits.monthlyBonusCoins > 0) {
            const currentMonth = now.toISOString().slice(0, 7); // "2026-01"
            const lastMonthlyBonus = user.lastMonthlyBonus;

            if (lastMonthlyBonus !== currentMonth) {
                // Award monthly bonus (no multiplier on grants)
                await grantCoins(
                    decoded.userId,
                    benefits.monthlyBonusCoins,
                    'monthly_bonus',
                    'Monthly Premium Bonus',
                    { month: currentMonth }
                );
                monthlyBonusAwarded = benefits.monthlyBonusCoins;

                // Update last monthly bonus timestamp
                await users.updateOne(
                    { _id: new ObjectId(decoded.userId) },
                    { $set: { lastMonthlyBonus: currentMonth } }
                );
            }
        }

        // Update user streak info
        await users.updateOne(
            { _id: new ObjectId(decoded.userId) },
            {
                $set: {
                    lastDailyLogin: now,
                    dailyLoginStreak: newStreak,
                    updatedAt: now
                }
            }
        );

        // Award daily login coins (multiplier applied by addCoins)
        const loginResult = await addCoins(
            decoded.userId,
            baseTotal,
            'daily_login',
            `Daily login bonus (Day ${newStreak})`,
            { streak: newStreak, baseBonus: DAILY_LOGIN_BASE, streakBonus }
        );

        const totalEarned = loginResult.amountEarned + monthlyBonusAwarded;

        res.status(200).json({
            message: monthlyBonusAwarded > 0
                ? 'Premium daily bonus + Monthly bonus claimed!'
                : (isPremium ? 'Premium daily bonus claimed!' : 'Daily bonus claimed!'),
            coinsEarned: totalEarned,
            dailyBonus: loginResult.amountEarned,
            baseBonus: DAILY_LOGIN_BASE,
            streakBonus,
            premiumMultiplier: loginResult.multiplier,
            isPremium,
            monthlyBonus: monthlyBonusAwarded > 0 ? {
                amount: monthlyBonusAwarded,
                message: `${monthlyBonusAwarded} DD Monthly Premium Grant!`
            } : null,
            streak: newStreak,
            newBalance: loginResult.newBalance,
            nextClaimAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        });
    } catch (error) {
        console.error('Daily login error:', error);
        res.status(500).json({ error: 'Failed to claim daily bonus' });
    }
}
