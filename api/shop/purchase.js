import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

import { spendCoins } from '../lib/coins.js';

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get auth token
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

    const { badgeId } = req.body;
    if (!badgeId) {
        return res.status(400).json({ error: 'Badge ID required' });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const usersCollection = db.collection('users');
        const badgesCollection = db.collection('badges');

        // Get the badge
        const badge = await badgesCollection.findOne({ _id: badgeId });
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        // Check if badge is purchasable
        if (badge.cost === 0) {
            return res.status(400).json({ error: 'This badge cannot be purchased - it must be earned' });
        }

        // Get user
        const user = await usersCollection.findOne({ _id: new ObjectId(decoded.userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user already owns this badge
        const userBadges = user.badges || [];
        if (userBadges.includes(badgeId)) {
            return res.status(400).json({ error: 'You already own this badge' });
        }

        // Check if user has enough coins
        const currentBalance = user.coinBalance || 0;
        if (currentBalance < badge.cost) {
            return res.status(400).json({
                error: 'Not enough Diehard Dollars',
                required: badge.cost,
                current: currentBalance
            });
        }

        // Spend coins and add badge to user
        await spendCoins(
            decoded.userId,
            badge.cost,
            'badge',
            `Purchased ${badge.name} badge`,
            { badgeId: badge._id }
        );

        // Add badge to user's badges array
        await usersCollection.updateOne(
            { _id: new ObjectId(decoded.userId) },
            { $push: { badges: badgeId } }
        );

        // Get updated balance
        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(decoded.userId) });

        res.status(200).json({
            success: true,
            message: `Successfully purchased ${badge.name}!`,
            badge,
            newBalance: updatedUser.coinBalance,
            badges: updatedUser.badges
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: error.message || 'Failed to complete purchase' });
    } finally {
        await client.close();
    }
}
