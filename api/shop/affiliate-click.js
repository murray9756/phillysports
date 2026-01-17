// Affiliate Click Tracking API
// POST: Track outbound clicks to affiliate links

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { rateLimit } from '../lib/rateLimit.js';

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

    // Rate limit
    const allowed = await rateLimit(req, res, 'api');
    if (!allowed) return;

    try {
        const { productId } = req.body;

        if (!productId || !ObjectId.isValid(productId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const products = await getCollection('shop_products');
        const clicks = await getCollection('affiliate_clicks');

        // Get product
        const product = await products.findOne({ _id: new ObjectId(productId) });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!product.isAffiliate || !product.affiliateLink) {
            return res.status(400).json({ error: 'Not an affiliate product' });
        }

        // Get user if authenticated
        let userId = null;
        try {
            const decoded = await authenticate(req);
            if (decoded) userId = decoded.userId;
        } catch (e) {
            // Anonymous click is fine
        }

        // Get client info
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.headers['x-real-ip'] ||
                   'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const referer = req.headers['referer'] || null;

        // Record the click
        await clicks.insertOne({
            productId: new ObjectId(productId),
            productName: product.name,
            affiliateSource: product.affiliateSource,
            affiliateLink: product.affiliateLink,
            userId: userId ? new ObjectId(userId) : null,
            ip,
            userAgent,
            referer,
            createdAt: new Date()
        });

        // Increment click count on product
        await products.updateOne(
            { _id: new ObjectId(productId) },
            {
                $inc: { affiliateClicks: 1 },
                $set: { lastClickedAt: new Date() }
            }
        );

        res.status(200).json({
            success: true,
            redirectUrl: product.affiliateLink
        });
    } catch (error) {
        console.error('Affiliate click error:', error);
        res.status(500).json({ error: 'Failed to track click' });
    }
}
