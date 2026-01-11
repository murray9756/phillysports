import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

import { transferCoins } from '../lib/coins.js';

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const MIN_TIP = 5;
const MAX_TIP = 500;
const DAILY_TIP_LIMIT = 1000;

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

    const { recipientId, amount, message } = req.body;

    if (!recipientId) {
        return res.status(400).json({ error: 'Recipient ID required' });
    }

    const tipAmount = parseInt(amount);
    if (isNaN(tipAmount) || tipAmount < MIN_TIP || tipAmount > MAX_TIP) {
        return res.status(400).json({
            error: `Tip amount must be between ${MIN_TIP} and ${MAX_TIP} coins`
        });
    }

    if (recipientId === decoded.userId) {
        return res.status(400).json({ error: "You can't tip yourself" });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const usersCollection = db.collection('users');
        const transactionsCollection = db.collection('transactions');

        // Get sender
        const sender = await usersCollection.findOne({ _id: new ObjectId(decoded.userId) });
        if (!sender) {
            return res.status(404).json({ error: 'Sender not found' });
        }

        // Get recipient
        const recipient = await usersCollection.findOne({ _id: new ObjectId(recipientId) });
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        // Check if recipient accepts tips (optional setting)
        if (recipient.disableTips) {
            return res.status(400).json({ error: 'This user is not accepting tips' });
        }

        // Check sender balance
        if ((sender.coinBalance || 0) < tipAmount) {
            return res.status(400).json({
                error: 'Not enough coins',
                required: tipAmount,
                current: sender.coinBalance || 0
            });
        }

        // Check daily tip limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyTipsSent = await transactionsCollection.aggregate([
            {
                $match: {
                    userId: new ObjectId(decoded.userId),
                    type: 'tip_sent',
                    createdAt: { $gte: today }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $abs: '$amount' } }
                }
            }
        ]).toArray();

        const todayTotal = dailyTipsSent[0]?.total || 0;
        if (todayTotal + tipAmount > DAILY_TIP_LIMIT) {
            return res.status(400).json({
                error: `Daily tip limit reached. You can send ${DAILY_TIP_LIMIT - todayTotal} more coins today.`,
                remaining: DAILY_TIP_LIMIT - todayTotal
            });
        }

        // Perform transfer
        const description = message
            ? `Tip to ${recipient.username}: "${message.substring(0, 100)}"`
            : `Tip to ${recipient.username}`;

        await transferCoins(decoded.userId, recipientId, tipAmount, description);

        // Get updated balance
        const updatedSender = await usersCollection.findOne({ _id: new ObjectId(decoded.userId) });

        res.status(200).json({
            success: true,
            message: `Successfully tipped ${recipient.username} ${tipAmount} coins!`,
            newBalance: updatedSender.coinBalance,
            recipientUsername: recipient.username
        });
    } catch (error) {
        console.error('Tip error:', error);
        res.status(500).json({ error: error.message || 'Failed to send tip' });
    } finally {
        await client.close();
    }
}
