// Fix eBay affiliate links
// POST /api/admin/ebay/fix-links
// Updates all existing eBay products to use direct URL format instead of rover

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

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

        const products = await getCollection('shop_products');
        const campaignId = process.env.EBAY_AFFILIATE_CAMPAIGN_ID;

        if (!campaignId) {
            return res.status(400).json({ error: 'EBAY_AFFILIATE_CAMPAIGN_ID not configured' });
        }

        // Find all eBay affiliate products
        const ebayProducts = await products.find({
            isAffiliate: true,
            affiliateSource: 'ebay'
        }).toArray();

        let updated = 0;
        let errors = [];

        for (const product of ebayProducts) {
            try {
                // Get the original eBay URL from ebayData or parse from old affiliate link
                let originalUrl = product.ebayData?.originalUrl;

                // If no original URL stored, try to extract from rover link
                if (!originalUrl && product.affiliateLink) {
                    const match = product.affiliateLink.match(/mpre=([^&]+)/);
                    if (match) {
                        originalUrl = decodeURIComponent(match[1]);
                    }
                }

                if (!originalUrl) {
                    errors.push({ id: product._id.toString(), error: 'No original URL found' });
                    continue;
                }

                // Build new affiliate link with direct URL params
                const url = new URL(originalUrl);
                url.searchParams.set('mkevt', '1');
                url.searchParams.set('mkcid', '1');
                url.searchParams.set('mkrid', '711-53200-19255-0');
                url.searchParams.set('campid', campaignId);
                url.searchParams.set('toolid', '10001');

                const newAffiliateLink = url.toString();

                // Update the product
                await products.updateOne(
                    { _id: product._id },
                    {
                        $set: {
                            affiliateLink: newAffiliateLink,
                            'ebayData.originalUrl': originalUrl,
                            updatedAt: new Date()
                        }
                    }
                );

                updated++;
            } catch (err) {
                errors.push({ id: product._id.toString(), error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Updated ${updated} of ${ebayProducts.length} eBay products`,
            updated,
            total: ebayProducts.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Fix eBay links error:', error);
        res.status(500).json({ error: error.message || 'Failed to fix links' });
    }
}
