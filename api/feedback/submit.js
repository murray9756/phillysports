// Feedback Submit API
// POST: Submit bug report or feature request, award 100 DD to logged-in users

import { ObjectId } from 'mongodb';
import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';
import { rateLimit } from '../lib/rateLimit.js';

const REWARD_COINS = 100;

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

    // Rate limit to prevent spam (max 10 per hour)
    const allowed = await rateLimit(req, res, 'feedback');
    if (!allowed) return;

    try {
        const { type, description, page } = req.body;

        // Validate input
        if (!type || !['bug', 'feature'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Must be "bug" or "feature"' });
        }

        if (!description || description.trim().length < 10) {
            return res.status(400).json({ error: 'Description must be at least 10 characters' });
        }

        if (description.length > 2000) {
            return res.status(400).json({ error: 'Description must be less than 2000 characters' });
        }

        // Check if user is logged in (optional - can submit anonymously but no reward)
        const decoded = await authenticate(req);
        const userId = decoded?.userId;

        const feedback = await getCollection('feedback');
        const users = await getCollection('users');
        const transactions = await getCollection('transactions');

        let coinsAwarded = 0;
        let newBalance = null;

        // Create feedback document
        const feedbackDoc = {
            type,
            description: description.trim(),
            page: page || 'unknown',
            userId: userId ? new ObjectId(userId) : null,
            status: 'new',
            createdAt: new Date(),
            userAgent: req.headers['user-agent'] || null,
            ip: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null
        };

        // If logged in, check daily submission limit and award coins
        if (userId) {
            // Check how many submissions today (limit to 5 rewarded per day)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todaySubmissions = await feedback.countDocuments({
                userId: new ObjectId(userId),
                createdAt: { $gte: today },
                coinsAwarded: { $gt: 0 }
            });

            if (todaySubmissions < 5) {
                // Award coins
                const user = await users.findOneAndUpdate(
                    { _id: new ObjectId(userId) },
                    {
                        $inc: { coinBalance: REWARD_COINS, lifetimeCoins: REWARD_COINS },
                        $set: { updatedAt: new Date() }
                    },
                    { returnDocument: 'after' }
                );

                if (user) {
                    coinsAwarded = REWARD_COINS;
                    newBalance = user.coinBalance;
                    feedbackDoc.coinsAwarded = REWARD_COINS;

                    // Log transaction
                    await transactions.insertOne({
                        userId: new ObjectId(userId),
                        type: 'earn',
                        category: 'feedback',
                        amount: REWARD_COINS,
                        balance: newBalance,
                        description: `Submitted ${type === 'bug' ? 'bug report' : 'feature request'}`,
                        createdAt: new Date()
                    });
                }
            } else {
                feedbackDoc.coinsAwarded = 0;
            }

            // Get username for the feedback record
            const user = await users.findOne({ _id: new ObjectId(userId) });
            if (user) {
                feedbackDoc.username = user.username;
                feedbackDoc.email = user.email;
            }
        }

        // Insert feedback
        const result = await feedback.insertOne(feedbackDoc);

        res.status(200).json({
            success: true,
            message: type === 'bug'
                ? 'Bug report submitted. Thank you for helping improve the site!'
                : 'Feature request submitted. We appreciate your input!',
            feedbackId: result.insertedId.toString(),
            coinsAwarded,
            newBalance,
            isLoggedIn: !!userId
        });
    } catch (error) {
        console.error('Feedback submit error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
}
