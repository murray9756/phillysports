// Order Details API
// GET: Get single order details

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

        const { id } = req.query;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }

        const orders = await getCollection('orders');

        const order = await orders.findOne({ _id: new ObjectId(id) });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verify user is buyer or seller
        const isBuyer = order.buyerId.toString() === decoded.userId;
        const isSeller = order.sellerId?.toString() === decoded.userId;

        if (!isBuyer && !isSeller) {
            return res.status(403).json({ error: 'Not authorized to view this order' });
        }

        res.status(200).json({
            success: true,
            order: {
                _id: order._id.toString(),
                orderNumber: order.orderNumber,
                orderType: order.orderType,
                buyerUsername: order.buyerUsername,
                sellerUsername: order.sellerUsername,
                items: order.items.map(item => ({
                    productId: item.productId.toString(),
                    productType: item.productType,
                    name: item.name,
                    variant: item.variant,
                    quantity: item.quantity,
                    pricePerItem: item.pricePerItem,
                    currency: item.currency,
                    totalPrice: item.totalPrice,
                    isDigital: item.isDigital
                })),
                subtotalUSD: order.subtotalUSD,
                subtotalDiehardDollars: order.subtotalDiehardDollars,
                shippingUSD: order.shippingUSD,
                taxUSD: order.taxUSD,
                totalUSD: order.totalUSD,
                totalDiehardDollars: order.totalDiehardDollars,
                commissionRate: isSeller ? order.commissionRate : undefined,
                commissionAmountUSD: isSeller ? order.commissionAmountUSD : undefined,
                sellerPayoutUSD: isSeller ? order.sellerPayoutUSD : undefined,
                sellerPayoutDD: isSeller ? order.sellerPayoutDD : undefined,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                shippingAddress: isBuyer || isSeller ? order.shippingAddress : undefined,
                shippingMethod: order.shippingMethod,
                fulfillmentStatus: order.fulfillmentStatus,
                trackingNumber: order.trackingNumber,
                trackingUrl: order.trackingUrl,
                digitalDeliveryStatus: order.digitalDeliveryStatus,
                disputeStatus: order.disputeStatus,
                disputeReason: order.disputeReason,
                buyerNotes: isBuyer ? order.buyerNotes : undefined,
                sellerNotes: isSeller ? order.sellerNotes : undefined,
                createdAt: order.createdAt,
                paidAt: order.paidAt,
                shippedAt: order.shippedAt,
                deliveredAt: order.deliveredAt,
                // Indicate user's role
                userRole: isBuyer ? 'buyer' : 'seller'
            }
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to get order' });
    }
}
