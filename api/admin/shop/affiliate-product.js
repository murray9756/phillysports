// Admin Add Affiliate Product API
// POST: Add a new affiliate product to the shop

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

// Valid affiliate sources
const VALID_SOURCES = ['rally_house', 'fanatics', 'ebay', 'amazon', 'dicks', 'under_armour', 'stubhub', 'seatgeek'];

// Valid categories for affiliate products (no sportsbook!)
const VALID_CATEGORIES = ['apparel', 'memorabilia', 'tickets', 'cards', 'collectibles', 'equipment', 'accessories'];

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

        const {
            name,
            shortDescription,
            category,
            subcategory,
            team,
            priceUSD,
            compareAtPrice,
            images,
            affiliateSource,
            affiliateLink,
            externalProductId,
            isFeatured = false
        } = req.body;

        // Validation
        if (!name || name.length < 3) {
            return res.status(400).json({ error: 'Product name is required (min 3 characters)' });
        }

        if (!category || !VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({
                error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
            });
        }

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                error: 'At least one product image is required for affiliate products'
            });
        }

        if (!affiliateSource || !VALID_SOURCES.includes(affiliateSource)) {
            return res.status(400).json({
                error: `Invalid affiliate source. Must be one of: ${VALID_SOURCES.join(', ')}`
            });
        }

        if (!affiliateLink || !affiliateLink.startsWith('http')) {
            return res.status(400).json({ error: 'Valid affiliate link URL is required' });
        }

        if (!priceUSD || priceUSD < 0) {
            return res.status(400).json({ error: 'Valid price is required' });
        }

        const products = await getCollection('shop_products');

        // Create slug from name
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') +
            '-' + Date.now().toString(36);

        const product = {
            name,
            slug,
            shortDescription: shortDescription || '',
            description: shortDescription || '', // Same as short for affiliates
            category,
            subcategory: subcategory || null,
            team: team || null,
            priceUSD: parseFloat(priceUSD),
            priceDiehardDollars: null, // Affiliates are USD only
            compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
            productType: 'physical',
            images,
            hasVariants: false,
            variants: [],
            inventory: -1, // -1 means unlimited/external
            status: 'active',
            isFeatured,
            // Affiliate-specific fields
            isAffiliate: true,
            affiliateSource,
            affiliateLink,
            externalProductId: externalProductId || null,
            affiliateCommissionRate: getCommissionRate(affiliateSource),
            affiliateClicks: 0,
            lastClickedAt: null,
            // Metadata
            createdBy: new ObjectId(decoded.userId),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await products.insertOne(product);

        res.status(201).json({
            success: true,
            message: 'Affiliate product created',
            product: {
                _id: result.insertedId.toString(),
                name: product.name,
                slug: product.slug,
                affiliateSource: product.affiliateSource,
                affiliateLink: product.affiliateLink
            }
        });
    } catch (error) {
        console.error('Add affiliate product error:', error);
        res.status(500).json({ error: 'Failed to add affiliate product' });
    }
}

// Get commission rate by source
function getCommissionRate(source) {
    const rates = {
        rally_house: 0.10,
        fanatics: 0.10,
        ebay: 0.04,
        amazon: 0.04,
        dicks: 0.05,
        under_armour: 0.05,
        stubhub: 0.06,
        seatgeek: 0.06
    };
    return rates[source] || 0.05;
}
