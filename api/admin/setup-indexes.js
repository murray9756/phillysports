// Admin Setup Indexes API
// POST: Create necessary database indexes (run once during deployment)

import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';
import { setupRateLimitIndexes } from '../lib/rateLimit.js';
import { ObjectId } from 'mongodb';

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
        // Authenticate and verify admin
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const results = [];

        // Setup rate limiting indexes
        try {
            await setupRateLimitIndexes();
            results.push({ collection: 'rate_limits', status: 'success' });
        } catch (error) {
            results.push({ collection: 'rate_limits', status: 'error', message: error.message });
        }

        // Add other indexes here as needed
        // Example: User indexes
        try {
            await users.createIndex({ email: 1 }, { unique: true });
            await users.createIndex({ username: 1 }, { unique: true });
            results.push({ collection: 'users', status: 'success' });
        } catch (error) {
            results.push({ collection: 'users', status: 'error', message: error.message });
        }

        // Orders indexes
        try {
            const orders = await getCollection('orders');
            await orders.createIndex({ buyerId: 1 });
            await orders.createIndex({ sellerId: 1 });
            await orders.createIndex({ orderNumber: 1 }, { unique: true });
            await orders.createIndex({ createdAt: -1 });
            results.push({ collection: 'orders', status: 'success' });
        } catch (error) {
            results.push({ collection: 'orders', status: 'error', message: error.message });
        }

        // Marketplace listings indexes
        try {
            const listings = await getCollection('marketplace_listings');
            await listings.createIndex({ sellerId: 1 });
            await listings.createIndex({ status: 1 });
            await listings.createIndex({ moderationStatus: 1 });
            await listings.createIndex({ createdAt: -1 });
            results.push({ collection: 'marketplace_listings', status: 'success' });
        } catch (error) {
            results.push({ collection: 'marketplace_listings', status: 'error', message: error.message });
        }

        res.status(200).json({
            success: true,
            message: 'Database indexes setup complete',
            results
        });
    } catch (error) {
        console.error('Setup indexes error:', error);
        res.status(500).json({ error: 'Failed to setup indexes' });
    }
}
