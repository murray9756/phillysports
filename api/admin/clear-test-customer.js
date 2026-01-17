// Admin: Clear test Stripe customer ID
// POST: Remove stripeCustomerId so live mode creates a new one

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

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
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username required' });
        }

        // Find user and clear their test Stripe data
        const result = await users.updateOne(
            { username: username.toLowerCase() },
            {
                $unset: {
                    stripeCustomerId: '',
                    stripeSubscriptionId: '',
                    subscriptionTier: '',
                    subscriptionStatus: '',
                    subscriptionStartDate: '',
                    subscriptionEndDate: '',
                    subscriptionInterval: ''
                },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: `Cleared Stripe test data for ${username}. They can now subscribe in live mode.`
        });
    } catch (error) {
        console.error('Clear test customer error:', error);
        res.status(500).json({ error: 'Failed to clear test customer' });
    }
}
