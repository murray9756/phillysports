// Admin Affiliate Stats API
// GET: View affiliate product performance analytics

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

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

        const { period = '30d' } = req.query;

        const products = await getCollection('shop_products');
        const clicks = await getCollection('affiliate_clicks');

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get all affiliate products
        const affiliateProducts = await products.find({ isAffiliate: true }).toArray();

        // Get clicks in period
        const periodClicks = await clicks.countDocuments({
            createdAt: { $gte: startDate }
        });

        // Get clicks by source
        const clicksBySource = await clicks.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$affiliateSource',
                    clicks: { $sum: 1 }
                }
            },
            { $sort: { clicks: -1 } }
        ]).toArray();

        // Get top products by clicks
        const topProducts = await clicks.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$productId',
                    productName: { $first: '$productName' },
                    affiliateSource: { $first: '$affiliateSource' },
                    clicks: { $sum: 1 }
                }
            },
            { $sort: { clicks: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Get daily clicks trend
        const dailyClicks = await clicks.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    clicks: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        // Calculate estimated revenue (clicks * avg commission rate * estimated conversion)
        const avgCommissionRate = 0.07; // 7% average
        const estimatedConversionRate = 0.02; // 2% conversion estimate
        const avgOrderValue = 75; // $75 average order
        const estimatedRevenue = periodClicks * estimatedConversionRate * avgOrderValue * avgCommissionRate;

        res.status(200).json({
            period,
            summary: {
                totalAffiliateProducts: affiliateProducts.length,
                totalClicks: periodClicks,
                estimatedRevenue: `$${estimatedRevenue.toFixed(2)}`,
                avgClicksPerProduct: affiliateProducts.length > 0
                    ? (periodClicks / affiliateProducts.length).toFixed(1)
                    : 0
            },
            clicksBySource: clicksBySource.map(s => ({
                source: s._id,
                clicks: s.clicks
            })),
            topProducts: topProducts.map(p => ({
                productId: p._id?.toString(),
                name: p.productName,
                source: p.affiliateSource,
                clicks: p.clicks
            })),
            dailyTrend: dailyClicks.map(d => ({
                date: d._id,
                clicks: d.clicks
            }))
        });
    } catch (error) {
        console.error('Affiliate stats error:', error);
        res.status(500).json({ error: 'Failed to get affiliate stats' });
    }
}
