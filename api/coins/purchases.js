// Coin Purchase History API
// GET: Get user's coin purchase history

import { ObjectId } from 'mongodb';
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

        const purchases = await getCollection('coin_purchases');

        const userPurchases = await purchases
            .find({ userId: new ObjectId(decoded.userId) })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

        // Calculate totals
        const totalSpent = userPurchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
        const totalCoins = userPurchases.reduce((sum, p) => sum + (p.coins || 0), 0);

        res.status(200).json({
            purchases: userPurchases.map(p => ({
                _id: p._id.toString(),
                packId: p.packId,
                coins: p.coins,
                amountPaid: p.amountPaid,
                amountDisplay: `$${(p.amountPaid / 100).toFixed(2)}`,
                status: p.status,
                createdAt: p.createdAt
            })),
            totals: {
                purchases: userPurchases.length,
                spent: totalSpent,
                spentDisplay: `$${(totalSpent / 100).toFixed(2)}`,
                coins: totalCoins
            }
        });
    } catch (error) {
        console.error('Purchase history error:', error);
        res.status(500).json({ error: 'Failed to get purchase history' });
    }
}
