// Admin eBay Import API
// POST: Import an eBay item to the shop as an affiliate product

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getItem, getItemByLegacyId, buildAffiliateLink } from '../../lib/ebay.js';

// Map eBay conditions to our format
const CONDITION_MAP = {
    'New': 'new',
    'New with tags': 'new',
    'New without tags': 'new',
    'New with defects': 'new',
    'Open box': 'like_new',
    'Certified - Refurbished': 'refurbished',
    'Excellent - Refurbished': 'refurbished',
    'Very Good - Refurbished': 'refurbished',
    'Good - Refurbished': 'refurbished',
    'Seller refurbished': 'refurbished',
    'Like New': 'like_new',
    'Pre-owned': 'used',
    'Used': 'used',
    'For parts or not working': 'parts'
};

// Determine category from item
function determineCategory(item) {
    const title = (item.title || '').toLowerCase();
    const categories = item.categories?.map(c => c.name?.toLowerCase()) || [];
    const allText = title + ' ' + categories.join(' ');

    if (allText.includes('jersey') || allText.includes('shirt') || allText.includes('hoodie') || allText.includes('hat') || allText.includes('cap')) {
        return 'apparel';
    }
    if (allText.includes('card') || allText.includes('trading')) {
        return 'cards';
    }
    if (allText.includes('autograph') || allText.includes('signed') || allText.includes('signature')) {
        return 'memorabilia';
    }
    if (allText.includes('ticket') || allText.includes('stub')) {
        return 'tickets';
    }
    if (allText.includes('bobblehead') || allText.includes('figurine') || allText.includes('pennant') || allText.includes('poster')) {
        return 'collectibles';
    }
    if (allText.includes('ball') || allText.includes('helmet') || allText.includes('equipment')) {
        return 'equipment';
    }

    return 'memorabilia'; // Default
}

// Determine team from item
function determineTeam(item) {
    const title = (item.title || '').toLowerCase();

    if (title.includes('eagle') || title.includes('birds') || title.includes('hurts') || title.includes('kelce')) {
        return 'eagles';
    }
    if (title.includes('philli') || title.includes('phanatic') || title.includes('harper') || title.includes('wheeler')) {
        return 'phillies';
    }
    if (title.includes('sixer') || title.includes('76er') || title.includes('embiid') || title.includes('iverson')) {
        return 'sixers';
    }
    if (title.includes('flyer') || title.includes('hockey') || title.includes('giroux')) {
        return 'flyers';
    }

    return null; // Unknown team
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
            itemId,
            legacyId,
            // Optional overrides
            customTitle,
            customDescription,
            customCategory,
            customTeam,
            isFeatured = false
        } = req.body;

        if (!itemId && !legacyId) {
            return res.status(400).json({ error: 'itemId or legacyId required' });
        }

        // Fetch full item details from eBay
        let item;
        if (legacyId) {
            item = await getItemByLegacyId(legacyId);
        } else {
            item = await getItem(itemId);
        }

        if (!item) {
            return res.status(404).json({ error: 'Item not found on eBay' });
        }

        const products = await getCollection('shop_products');

        // Check if already imported
        const externalId = item.legacyItemId || item.itemId;
        const existing = await products.findOne({
            isAffiliate: true,
            affiliateSource: 'ebay',
            externalProductId: externalId
        });

        if (existing) {
            return res.status(400).json({
                error: 'Item already imported',
                productId: existing._id.toString()
            });
        }

        // Build affiliate link
        const affiliateLink = buildAffiliateLink(item.itemWebUrl);

        // Determine category and team
        const category = customCategory || determineCategory(item);
        const team = customTeam || determineTeam(item);

        // Get high-res images if available
        let images = item.images || [];
        // eBay thumbnails are small, try to get larger versions
        images = images.map(url => {
            // Replace thumbnail size indicator with larger size
            return url.replace(/s-l\d+\./, 's-l1600.');
        });

        // Ensure at least one image
        if (images.length === 0) {
            return res.status(400).json({ error: 'Item has no images' });
        }

        // Build product name (clean up eBay title)
        const name = customTitle || item.title
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200);

        // Build description
        const description = customDescription || [
            item.shortDescription || '',
            item.condition ? `Condition: ${item.condition}` : '',
            item.brand ? `Brand: ${item.brand}` : '',
            item.seller?.username ? `Seller: ${item.seller.username} (${item.seller.feedbackPercentage || 'N/A'}% positive)` : ''
        ].filter(Boolean).join('\n\n');

        // Create slug
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') +
            '-' + Date.now().toString(36);

        // Build product document
        const product = {
            name,
            slug,
            shortDescription: item.shortDescription || description.slice(0, 200),
            description,
            category,
            subcategory: null,
            team,
            priceUSD: item.price || 0,
            priceDiehardDollars: null, // Affiliates are USD only
            compareAtPrice: null,
            productType: 'physical',
            images,
            hasVariants: false,
            variants: [],
            inventory: -1, // External product
            status: 'active',
            isFeatured,

            // eBay-specific fields
            isAffiliate: true,
            affiliateSource: 'ebay',
            affiliateLink,
            externalProductId: externalId,
            affiliateCommissionRate: 0.04, // eBay Partner Network rate

            // eBay metadata
            ebayData: {
                itemId: item.itemId,
                legacyItemId: item.legacyItemId,
                condition: item.condition,
                conditionNormalized: CONDITION_MAP[item.condition] || 'unknown',
                seller: item.seller,
                location: item.location,
                shippingCost: item.shippingCost,
                freeShipping: item.freeShipping,
                buyingOptions: item.buyingOptions,
                itemEndDate: item.itemEndDate,
                quantityAvailable: item.quantityAvailable,
                returnTerms: item.returnTerms,
                originalUrl: item.itemWebUrl,
                fetchedAt: new Date()
            },

            // Tracking
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
            message: 'eBay item imported successfully',
            product: {
                _id: result.insertedId.toString(),
                name: product.name,
                slug: product.slug,
                category: product.category,
                team: product.team,
                priceUSD: product.priceUSD,
                images: product.images,
                affiliateLink: product.affiliateLink
            }
        });
    } catch (error) {
        console.error('eBay import error:', error);
        res.status(500).json({ error: error.message || 'Failed to import eBay item' });
    }
}
