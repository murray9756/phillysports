// Admin eBay Search API
// GET: Search eBay for products to curate

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { searchItems, getItem, getItemByLegacyId, PHILLY_TEAM_SEARCHES, EBAY_CATEGORIES } from '../../lib/ebay.js';

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

        const { query, itemId, legacyId, team, category, limit = 20, offset = 0, sort } = req.query;

        // If itemId or legacyId provided, get single item details
        if (itemId) {
            const item = await getItem(itemId);
            return res.status(200).json({ success: true, item });
        }

        if (legacyId) {
            const item = await getItemByLegacyId(legacyId);
            return res.status(200).json({ success: true, item });
        }

        // Build search query
        let searchQuery = query;

        // If team preset selected, use that
        if (team && PHILLY_TEAM_SEARCHES[team]) {
            // Pick a random search from the team's presets if no query provided
            const presets = PHILLY_TEAM_SEARCHES[team];
            searchQuery = query || presets[0];
        }

        if (!searchQuery) {
            return res.status(400).json({
                error: 'Search query required',
                presets: {
                    teams: Object.keys(PHILLY_TEAM_SEARCHES),
                    categories: EBAY_CATEGORIES
                }
            });
        }

        // Search eBay
        const results = await searchItems({
            query: searchQuery,
            category: category || null,
            limit: parseInt(limit),
            offset: parseInt(offset),
            sort: sort || 'newlyListed'
        });

        // Check which items are already imported
        const products = await getCollection('shop_products');
        const existingProducts = await products.find({
            isAffiliate: true,
            affiliateSource: 'ebay',
            externalProductId: { $in: results.items.map(item => item.legacyItemId || item.itemId) }
        }).toArray();

        const importedIds = new Set(existingProducts.map(p => p.externalProductId));

        // Mark items that are already imported
        const itemsWithStatus = results.items.map(item => ({
            ...item,
            alreadyImported: importedIds.has(item.legacyItemId) || importedIds.has(item.itemId)
        }));

        res.status(200).json({
            success: true,
            query: searchQuery,
            total: results.total,
            offset: results.offset,
            limit: results.limit,
            items: itemsWithStatus,
            presets: {
                teams: Object.keys(PHILLY_TEAM_SEARCHES),
                categories: EBAY_CATEGORIES
            }
        });
    } catch (error) {
        console.error('eBay search error:', error);
        res.status(500).json({ error: error.message || 'Failed to search eBay' });
    }
}
