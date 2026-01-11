// Shop PayPal Capture Order API
// POST: Capture a PayPal payment after user approval

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { capturePayPalOrder } from '../../../lib/payments/paypal.js';

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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { paypalOrderId } = req.body;

        if (!paypalOrderId) {
            return res.status(400).json({ error: 'PayPal order ID is required' });
        }

        const orders = await getCollection('orders');
        const products = await getCollection('shop_products');

        // Find the order
        const order = await orders.findOne({
            paypalOrderId,
            buyerId: new ObjectId(decoded.userId),
            paymentStatus: 'pending'
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found or already processed' });
        }

        // Capture the payment
        const captureResult = await capturePayPalOrder(paypalOrderId);

        if (captureResult.status !== 'COMPLETED') {
            return res.status(400).json({
                error: 'Payment capture failed',
                details: captureResult
            });
        }

        // Get capture ID for potential refunds
        const captureId = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id;

        // Update order status
        await orders.updateOne(
            { _id: order._id },
            {
                $set: {
                    paymentStatus: 'paid',
                    paidAt: new Date(),
                    updatedAt: new Date(),
                    'paypalCaptureId': captureId
                }
            }
        );

        // Update inventory for each item
        for (const item of order.items) {
            if (item.variant) {
                // Update variant inventory
                await products.updateOne(
                    {
                        _id: item.productId,
                        'variants._id': item.variant._id
                    },
                    {
                        $inc: {
                            'variants.$.inventory': -item.quantity,
                            salesCount: item.quantity
                        }
                    }
                );
            } else {
                // Update product inventory (if not unlimited)
                await products.updateOne(
                    {
                        _id: item.productId,
                        inventory: { $ne: -1 }
                    },
                    {
                        $inc: {
                            inventory: -item.quantity,
                            salesCount: item.quantity
                        }
                    }
                );
            }
        }

        // Handle digital items - mark as delivered
        const hasDigitalItems = order.items.some(i => i.isDigital);
        if (hasDigitalItems) {
            await orders.updateOne(
                { _id: order._id },
                {
                    $set: {
                        digitalDeliveryStatus: 'delivered',
                        digitalDeliveredAt: new Date()
                    }
                }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Payment successful',
            orderId: order._id.toString(),
            orderNumber: order.orderNumber
        });

    } catch (error) {
        console.error('PayPal capture error:', error);
        res.status(500).json({ error: error.message || 'Failed to capture payment' });
    }
}
