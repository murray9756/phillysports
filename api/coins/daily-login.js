import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { addCoins, DAILY_LOGIN_BASE, STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS } from '../lib/coins.js';
import { rateLimit } from '../lib/rateLimit.js';
import { getDailyCoinMultiplier } from '../lib/subscriptions.js';

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

        // Calculate bonus with premium multiplier
        const streakBonus = Math.min((newStreak - 1) * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
        const baseTotal = DAILY_LOGIN_BASE + streakBonus;

        // Get premium multiplier (2x for Diehard+ and Diehard Pro)
        const multiplier = await getDailyCoinMultiplier(decoded.userId);
        const totalBonus = baseTotal * multiplier;
        const isPremium = multiplier > 1;

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

        // Award coins
        const newBalance = await addCoins(
            decoded.userId,
            totalBonus,
            'daily_login',
            `Daily login bonus (Day ${newStreak})`,
            { streak: newStreak, baseBonus: DAILY_LOGIN_BASE, streakBonus }
        );

        res.status(200).json({
            message: isPremium ? 'Premium daily bonus claimed!' : 'Daily bonus claimed!',
            coinsEarned: totalBonus,
            baseBonus: DAILY_LOGIN_BASE,
            streakBonus,
            premiumMultiplier: multiplier,
            isPremium,
            streak: newStreak,
            newBalance,
            nextClaimAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        });
    } catch (error) {
        console.error('Daily login error:', error);
        res.status(500).json({ error: 'Failed to claim daily bonus' });
    }
}
