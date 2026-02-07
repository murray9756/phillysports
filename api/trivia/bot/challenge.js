// Trivia Bot - Create a challenge against a user
// POST /api/trivia/bot/challenge
// Admin-only endpoint to test head-to-head trivia
//
// Body: { targetUsername: "murray44", wagerAmount: 25 }

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import { createChallenge, WAGER_TIERS } from '../../lib/trivia/challengeEngine.js';
import { addCoins } from '../../lib/coins.js';

const BOT_USERNAME = 'TriviaBot';
const BOT_EMAIL = 'triviabot@phillysports.com';

/**
 * Get or create the bot user account
 */
async function getOrCreateBot() {
    const users = await getCollection('users');

    let bot = await users.findOne({ username: BOT_USERNAME });
    if (bot) return bot;

    // Create bot user
    const result = await users.insertOne({
        username: BOT_USERNAME,
        email: BOT_EMAIL,
        displayName: 'Trivia Bot',
        isBot: true,
        isAdmin: false,
        coinBalance: 10000,
        createdAt: new Date(),
        avatar: null,
        bio: 'I am the PhillySports Trivia Bot. Challenge accepted!'
    });

    return await users.findOne({ _id: result.insertedId });
}

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
        // Admin-only
        const decoded = await authenticate(req);
        if (!decoded || !decoded.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { targetUsername = 'murray44', wagerAmount = 25 } = req.body || {};

        if (!WAGER_TIERS.includes(wagerAmount)) {
            return res.status(400).json({ error: 'Invalid wager', validTiers: WAGER_TIERS });
        }

        // Get or create bot
        const bot = await getOrCreateBot();

        // Make sure bot has enough coins
        if ((bot.coinBalance || 0) < wagerAmount) {
            await addCoins(bot._id.toString(), 10000, 'bot_refill', 'Bot coin refill', {}, { skipMultiplier: true });
        }

        // Find target user
        const users = await getCollection('users');
        const target = await users.findOne({
            username: { $regex: new RegExp(`^${targetUsername}$`, 'i') }
        });

        if (!target) {
            return res.status(404).json({ error: `User "${targetUsername}" not found` });
        }

        // Create challenge: bot challenges the target user
        const challenge = await createChallenge(
            bot._id.toString(),
            target._id.toString(),
            wagerAmount,
            'direct'
        );

        res.status(201).json({
            success: true,
            message: `TriviaBot challenged @${targetUsername} for ${wagerAmount} DD!`,
            challengeId: challenge._id.toString(),
            botUserId: bot._id.toString(),
            status: challenge.status
        });

    } catch (error) {
        console.error('Bot challenge error:', error);
        res.status(500).json({ error: error.message });
    }
}
