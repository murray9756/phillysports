// Admin API - Set minimum balance for all users
// POST: Ensure all users have at least the specified minimum balance

import { getCollection } from '../../lib/mongodb.js';

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
        const { minimumBalance = 5000, adminKey } = req.body;

        // Simple admin key check (in production, use proper auth)
        if (adminKey !== 'phillysports-admin-2024') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const users = await getCollection('users');

        // Update all non-bot users with balance below minimum
        const result = await users.updateMany(
            {
                isBot: { $ne: true },
                $or: [
                    { coinBalance: { $lt: minimumBalance } },
                    { coinBalance: { $exists: false } }
                ]
            },
            {
                $set: {
                    coinBalance: minimumBalance,
                    updatedAt: new Date()
                },
                $max: {
                    lifetimeCoins: minimumBalance
                }
            }
        );

        // Get stats
        const totalUsers = await users.countDocuments({ isBot: { $ne: true } });
        const usersUpdated = result.modifiedCount;

        // Log the action
        const transactions = await getCollection('transactions');
        await transactions.insertOne({
            type: 'admin_balance_adjustment',
            description: `Set minimum balance to ${minimumBalance} DD for all users`,
            usersAffected: usersUpdated,
            minimumBalance,
            adminAction: true,
            createdAt: new Date()
        });

        return res.status(200).json({
            success: true,
            message: `Updated ${usersUpdated} users to minimum balance of ${minimumBalance} DD`,
            stats: {
                totalUsers,
                usersUpdated,
                usersAlreadyAboveMinimum: totalUsers - usersUpdated
            }
        });

    } catch (error) {
        console.error('Set minimum balance error:', error);
        return res.status(500).json({ error: 'Failed to update balances' });
    }
}
