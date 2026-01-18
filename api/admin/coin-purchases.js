// Admin Coin Purchases API
// GET: List all coin purchases (admin only)

import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if admin
        const users = await getCollection('users');
        const admin = await users.findOne({ _id: decoded.userId });
        if (!admin?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const purchases = await getCollection('coin_purchases');

        const allPurchases = await purchases
            .find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        // Get user info for each purchase
        const userIds = [...new Set(allPurchases.map(p => p.userId.toString()))];
        const purchaseUsers = await users.find({
            _id: { $in: userIds.map(id => new (await import('mongodb')).ObjectId(id)) }
        }).toArray();

        const userMap = {};
        purchaseUsers.forEach(u => {
            userMap[u._id.toString()] = { username: u.username, email: u.email };
        });

        res.status(200).json({
            purchases: allPurchases.map(p => ({
                _id: p._id.toString(),
                userId: p.userId.toString(),
                user: userMap[p.userId.toString()] || { username: 'Unknown' },
                packId: p.packId,
                coins: p.coins,
                amountPaid: p.amountPaid,
                amountDisplay: `$${((p.amountPaid || 0) / 100).toFixed(2)}`,
                stripeSessionId: p.stripeSessionId,
                status: p.status,
                createdAt: p.createdAt
            })),
            total: allPurchases.length
        });
    } catch (error) {
        console.error('Admin coin purchases error:', error);
        res.status(500).json({ error: 'Failed to get purchases' });
    }
}
