// Admin Add Coins API
// POST: Manually add coins to a user (admin only)

import { ObjectId } from 'mongodb';
import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';

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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const admin = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!admin?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { userId, username, email, coins, reason } = req.body;

        if (!coins || coins <= 0) {
            return res.status(400).json({ error: 'Invalid coin amount' });
        }

        // Find user by userId, username, or email
        let targetUser;
        if (userId) {
            targetUser = await users.findOne({ _id: new ObjectId(userId) });
        } else if (username) {
            targetUser = await users.findOne({ username });
        } else if (email) {
            targetUser = await users.findOne({ email });
        } else {
            return res.status(400).json({ error: 'Must provide userId, username, or email' });
        }

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Add coins
        const result = await users.findOneAndUpdate(
            { _id: targetUser._id },
            {
                $inc: { coinBalance: coins, lifetimeCoins: coins },
                $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );

        // Log the transaction
        const transactions = await getCollection('transactions');
        await transactions.insertOne({
            userId: targetUser._id,
            type: 'admin_credit',
            category: 'admin',
            amount: coins,
            balance: result.coinBalance,
            description: reason || 'Admin credit',
            metadata: { adminUserId: decoded.userId },
            createdAt: new Date()
        });

        res.status(200).json({
            success: true,
            user: {
                _id: targetUser._id.toString(),
                username: targetUser.username,
                email: targetUser.email
            },
            coinsAdded: coins,
            newBalance: result.coinBalance
        });
    } catch (error) {
        console.error('Admin add coins error:', error);
        res.status(500).json({ error: 'Failed to add coins' });
    }
}
