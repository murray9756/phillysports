import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

import { adminAwardCoins } from '../../lib/coins.js';

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');

        // Check if user is admin
        const adminUser = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
        if (!adminUser || !adminUser.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { targetUsername, amount, note } = req.body;

        if (!targetUsername) {
            return res.status(400).json({ error: 'Target username required' });
        }

        const coinAmount = parseInt(amount);
        if (isNaN(coinAmount) || coinAmount <= 0 || coinAmount > 100000) {
            return res.status(400).json({ error: 'Amount must be between 1 and 100,000' });
        }

        // Find target user
        const targetUser = await db.collection('users').findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Award coins
        await adminAwardCoins(
            decoded.userId,
            targetUser._id.toString(),
            coinAmount,
            note || `Admin award from ${adminUser.username}`
        );

        // Get updated user balance
        const updatedUser = await db.collection('users').findOne({ _id: targetUser._id });

        res.status(200).json({
            success: true,
            message: `Awarded ${coinAmount} coins to ${targetUsername}`,
            newBalance: updatedUser.coinBalance,
            targetUsername: updatedUser.username
        });
    } catch (error) {
        console.error('Admin award error:', error);
        res.status(500).json({ error: error.message || 'Failed to award coins' });
    } finally {
        await client.close();
    }
}
