// Admin: Manually activate subscription
// POST: Set subscription status for a user

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

        const { username, tier, stripeSubscriptionId, stripeCustomerId } = req.body;

        if (!username || !tier) {
            return res.status(400).json({ error: 'Username and tier required' });
        }

        if (!['diehard_plus', 'diehard_pro'].includes(tier)) {
            return res.status(400).json({ error: 'Tier must be diehard_plus or diehard_pro' });
        }

        const now = new Date();
        const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const result = await users.updateOne(
            { username: username.toLowerCase() },
            {
                $set: {
                    subscriptionTier: tier,
                    subscriptionStatus: 'active',
                    subscriptionStartDate: now,
                    subscriptionEndDate: endDate,
                    subscriptionInterval: 'month',
                    stripeSubscriptionId: stripeSubscriptionId || null,
                    stripeCustomerId: stripeCustomerId || null,
                    updatedAt: now
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: `Activated ${tier} subscription for ${username}`
        });
    } catch (error) {
        console.error('Activate subscription error:', error);
        res.status(500).json({ error: 'Failed to activate subscription' });
    }
}
