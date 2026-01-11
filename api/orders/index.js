// Orders API
// GET: Get user's order history

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
            type, // 'all', 'shop', 'marketplace'
            status, // 'pending', 'paid', 'shipped', 'delivered', 'cancelled'
            page = 1,
            limit = 20
        } = req.query;

        const orders = await getCollection('orders');

        // Build query - get orders where user is the buyer
        const query = {
            buyerId: new ObjectId(decoded.userId)
        };

        if (type === 'shop') {
            query.orderType = 'shop';
        } else if (type === 'marketplace') {
            query.orderType = 'marketplace';
        }

        if (status) {
            if (status === 'pending') {
                query.paymentStatus = 'pending';
            } else if (status === 'paid') {
                query.paymentStatus = 'paid';
                query.fulfillmentStatus = 'unfulfilled';
            } else if (status === 'shipped') {
                query.fulfillmentStatus = 'shipped';
            } else if (status === 'delivered') {
                query.fulfillmentStatus = 'delivered';
            } else if (status === 'cancelled') {
                query.fulfillmentStatus = 'cancelled';
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 50);

        const [results, totalCount] = await Promise.all([
            orders.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            orders.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            orders: results.map(order => ({
                _id: order._id.toString(),
                orderNumber: order.orderNumber,
                orderType: order.orderType,
                items: order.items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    pricePerItem: item.pricePerItem,
                    currency: item.currency,
                    isDigital: item.isDigital
                })),
                totalUSD: order.totalUSD,
                totalDiehardDollars: order.totalDiehardDollars,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                fulfillmentStatus: order.fulfillmentStatus,
                trackingNumber: order.trackingNumber,
                sellerUsername: order.sellerUsername,
                createdAt: order.createdAt,
                paidAt: order.paidAt,
                shippedAt: order.shippedAt,
                deliveredAt: order.deliveredAt
            })),
            pagination: {
                page: parseInt(page),
                limit: limitNum,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to get orders' });
    }
}
