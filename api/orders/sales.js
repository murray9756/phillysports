// Seller Sales API
// GET: Get seller's sales history (marketplace orders where user is seller)

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

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

        const {
            status, // 'pending', 'paid', 'shipped', 'delivered'
            page = 1,
            limit = 20
        } = req.query;

        const orders = await getCollection('orders');

        // Build query - get orders where user is the seller
        const query = {
            sellerId: new ObjectId(decoded.userId),
            orderType: 'marketplace'
        };

        if (status) {
            if (status === 'pending') {
                query.paymentStatus = 'pending';
            } else if (status === 'needs_shipping') {
                query.paymentStatus = 'paid';
                query.fulfillmentStatus = 'unfulfilled';
            } else if (status === 'shipped') {
                query.fulfillmentStatus = 'shipped';
            } else if (status === 'delivered') {
                query.fulfillmentStatus = 'delivered';
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 50);

        const [results, totalCount, stats] = await Promise.all([
            orders.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            orders.countDocuments(query),
            // Get sales stats
            orders.aggregate([
                { $match: { sellerId: new ObjectId(decoded.userId), paymentStatus: 'paid' } },
                {
                    $group: {
                        _id: null,
                        totalSalesUSD: { $sum: '$sellerPayoutUSD' },
                        totalSalesDD: { $sum: '$sellerPayoutDD' },
                        totalOrders: { $sum: 1 },
                        totalCommissionUSD: { $sum: '$commissionAmountUSD' },
                        totalCommissionDD: { $sum: '$commissionAmountDD' }
                    }
                }
            ]).toArray()
        ]);

        const salesStats = stats[0] || {
            totalSalesUSD: 0,
            totalSalesDD: 0,
            totalOrders: 0,
            totalCommissionUSD: 0,
            totalCommissionDD: 0
        };

        // Count orders needing action
        const needsShippingCount = await orders.countDocuments({
            sellerId: new ObjectId(decoded.userId),
            orderType: 'marketplace',
            paymentStatus: 'paid',
            fulfillmentStatus: 'unfulfilled'
        });

        res.status(200).json({
            success: true,
            sales: results.map(order => ({
                _id: order._id.toString(),
                orderNumber: order.orderNumber,
                buyerUsername: order.buyerUsername,
                items: order.items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    pricePerItem: item.pricePerItem,
                    currency: item.currency
                })),
                totalUSD: order.totalUSD,
                totalDiehardDollars: order.totalDiehardDollars,
                commissionAmountUSD: order.commissionAmountUSD,
                commissionAmountDD: order.commissionAmountDD,
                sellerPayoutUSD: order.sellerPayoutUSD,
                sellerPayoutDD: order.sellerPayoutDD,
                paymentStatus: order.paymentStatus,
                fulfillmentStatus: order.fulfillmentStatus,
                shippingAddress: order.shippingAddress,
                trackingNumber: order.trackingNumber,
                createdAt: order.createdAt,
                paidAt: order.paidAt,
                shippedAt: order.shippedAt
            })),
            stats: {
                totalEarningsUSD: salesStats.totalSalesUSD || 0,
                totalEarningsDD: salesStats.totalSalesDD || 0,
                totalOrders: salesStats.totalOrders || 0,
                totalCommissionPaidUSD: salesStats.totalCommissionUSD || 0,
                totalCommissionPaidDD: salesStats.totalCommissionDD || 0,
                needsShipping: needsShippingCount
            },
            pagination: {
                page: parseInt(page),
                limit: limitNum,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({ error: 'Failed to get sales' });
    }
}
