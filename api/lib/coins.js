import { ObjectId } from 'mongodb';
import { getCollection } from './mongodb.js';

// Earning limits
export const DAILY_COMMENT_COIN_LIMIT = 50;
export const COINS_PER_COMMENT = 5;
export const DAILY_LOGIN_BASE = 10;
export const STREAK_BONUS_PER_DAY = 5;
export const MAX_STREAK_BONUS = 35;

/**
 * Add coins to a user's balance
 */
export async function addCoins(userId, amount, category, description, metadata = {}) {
    const users = await getCollection('users');
    const transactions = await getCollection('transactions');

    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Update user balance atomically
    const result = await users.findOneAndUpdate(
        { _id: userIdObj },
        {
            $inc: {
                coinBalance: amount,
                lifetimeCoins: amount > 0 ? amount : 0
            },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!result) throw new Error('User not found');

    // Log transaction
    await transactions.insertOne({
        userId: userIdObj,
        type: amount > 0 ? 'earn' : 'adjustment',
        category,
        amount,
        balance: result.coinBalance,
        description,
        metadata,
        createdAt: new Date()
    });

    return result.coinBalance;
}

/**
 * Deduct coins as a penalty (won't go below 0)
 */
export async function deductCoins(userId, amount, category, description, metadata = {}) {
    const users = await getCollection('users');
    const transactions = await getCollection('transactions');

    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Get current balance
    const user = await users.findOne({ _id: userIdObj });
    if (!user) throw new Error('User not found');

    // Calculate actual deduction (don't go below 0)
    const currentBalance = user.coinBalance || 0;
    const actualDeduction = Math.min(amount, currentBalance);

    if (actualDeduction <= 0) {
        return currentBalance; // Nothing to deduct
    }

    // Deduct coins
    const result = await users.findOneAndUpdate(
        { _id: userIdObj },
        {
            $inc: { coinBalance: -actualDeduction },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    // Log transaction
    await transactions.insertOne({
        userId: userIdObj,
        type: 'penalty',
        category,
        amount: -actualDeduction,
        balance: result.coinBalance,
        description,
        metadata,
        createdAt: new Date()
    });

    return { newBalance: result.coinBalance, deducted: actualDeduction };
}

/**
 * Spend coins from a user's balance
 */
export async function spendCoins(userId, amount, category, description, metadata = {}) {
    const users = await getCollection('users');
    const transactions = await getCollection('transactions');

    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Check balance and deduct atomically
    const result = await users.findOneAndUpdate(
        {
            _id: userIdObj,
            coinBalance: { $gte: amount }
        },
        {
            $inc: { coinBalance: -amount },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!result) {
        // Check if user exists
        const user = await users.findOne({ _id: userIdObj });
        if (!user) throw new Error('User not found');
        throw new Error('Insufficient balance');
    }

    // Log transaction
    await transactions.insertOne({
        userId: userIdObj,
        type: 'spend',
        category,
        amount: -amount,
        balance: result.coinBalance,
        description,
        metadata,
        createdAt: new Date()
    });

    return result.coinBalance;
}

/**
 * Transfer coins between users (for tipping)
 */
export async function transferCoins(fromUserId, toUserId, amount, description) {
    const users = await getCollection('users');
    const transactions = await getCollection('transactions');

    const fromId = typeof fromUserId === 'string' ? new ObjectId(fromUserId) : fromUserId;
    const toId = typeof toUserId === 'string' ? new ObjectId(toUserId) : toUserId;

    // Deduct from sender
    const sender = await users.findOneAndUpdate(
        {
            _id: fromId,
            coinBalance: { $gte: amount }
        },
        {
            $inc: { coinBalance: -amount },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!sender) {
        const user = await users.findOne({ _id: fromId });
        if (!user) throw new Error('Sender not found');
        throw new Error('Insufficient balance');
    }

    // Add to recipient
    const recipient = await users.findOneAndUpdate(
        { _id: toId },
        {
            $inc: {
                coinBalance: amount,
                lifetimeCoins: amount
            },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!recipient) {
        // Rollback sender's deduction
        await users.updateOne(
            { _id: fromId },
            { $inc: { coinBalance: amount } }
        );
        throw new Error('Recipient not found');
    }

    // Log both transactions
    const now = new Date();
    await transactions.insertMany([
        {
            userId: fromId,
            type: 'tip_sent',
            category: 'tip',
            amount: -amount,
            balance: sender.coinBalance,
            description: `Tip sent: ${description}`,
            metadata: { relatedUserId: toId },
            createdAt: now
        },
        {
            userId: toId,
            type: 'tip_received',
            category: 'tip',
            amount: amount,
            balance: recipient.coinBalance,
            description: `Tip received: ${description}`,
            metadata: { relatedUserId: fromId },
            createdAt: now
        }
    ]);

    return { senderBalance: sender.coinBalance, recipientBalance: recipient.coinBalance };
}

/**
 * Get user's coin balance and stats
 */
export async function getBalance(userId) {
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne(
        { _id: userIdObj },
        { projection: { coinBalance: 1, lifetimeCoins: 1, dailyLoginStreak: 1 } }
    );

    return user ? {
        balance: user.coinBalance || 0,
        lifetime: user.lifetimeCoins || 0,
        streak: user.dailyLoginStreak || 0
    } : null;
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(userId, limit = 50, offset = 0) {
    const transactions = await getCollection('transactions');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const results = await transactions.find({ userId: userIdObj })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

    return results.map(t => ({
        ...t,
        _id: t._id.toString(),
        userId: t.userId.toString(),
        metadata: t.metadata?.relatedUserId
            ? { ...t.metadata, relatedUserId: t.metadata.relatedUserId.toString() }
            : t.metadata
    }));
}

/**
 * Check if user can earn coins today (for rate limiting)
 */
export async function getDailyEarnings(userId, category) {
    const transactions = await getCollection('transactions');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await transactions.aggregate([
        {
            $match: {
                userId: userIdObj,
                category,
                type: 'earn',
                createdAt: { $gte: today }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]).toArray();

    return result[0] || { total: 0, count: 0 };
}

/**
 * Admin award coins
 */
export async function adminAwardCoins(adminUserId, targetUserId, amount, note) {
    const users = await getCollection('users');
    const transactions = await getCollection('transactions');

    const adminId = typeof adminUserId === 'string' ? new ObjectId(adminUserId) : adminUserId;
    const targetId = typeof targetUserId === 'string' ? new ObjectId(targetUserId) : targetUserId;

    // Verify admin
    const admin = await users.findOne({ _id: adminId });
    if (!admin?.isAdmin) throw new Error('Admin access required');

    // Award coins
    const result = await users.findOneAndUpdate(
        { _id: targetId },
        {
            $inc: {
                coinBalance: amount,
                lifetimeCoins: amount > 0 ? amount : 0
            },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!result) throw new Error('Target user not found');

    // Log transaction
    await transactions.insertOne({
        userId: targetId,
        type: 'admin_award',
        category: 'admin',
        amount,
        balance: result.coinBalance,
        description: `Admin award: ${note}`,
        metadata: { adminUserId: adminId, adminNote: note },
        createdAt: new Date()
    });

    return result.coinBalance;
}
