// Ship Order API
// POST: Mark order as shipped (seller only)

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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;
        const { trackingNumber, trackingUrl, carrier } = req.body;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }

        const orders = await getCollection('orders');

        const order = await orders.findOne({ _id: new ObjectId(id) });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verify user is the seller
        if (order.sellerId?.toString() !== decoded.userId) {
            return res.status(403).json({ error: 'Only the seller can mark orders as shipped' });
        }

        // Verify order is paid and not already shipped
        if (order.paymentStatus !== 'paid') {
            return res.status(400).json({ error: 'Order is not paid yet' });
        }

        if (order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered') {
            return res.status(400).json({ error: 'Order is already shipped' });
        }

        // Check if order has physical items
        const hasPhysicalItems = order.items.some(item => !item.isDigital);
        if (!hasPhysicalItems) {
            return res.status(400).json({ error: 'This order contains only digital items' });
        }

        // Build tracking URL if carrier provided but no URL
        let finalTrackingUrl = trackingUrl;
        if (trackingNumber && carrier && !trackingUrl) {
            const carrierUrls = {
                'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
                'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
                'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
                'dhl': `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`
            };
            finalTrackingUrl = carrierUrls[carrier.toLowerCase()] || null;
        }

        // Update order
        const result = await orders.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $set: {
                    fulfillmentStatus: 'shipped',
                    trackingNumber: trackingNumber || null,
                    trackingUrl: finalTrackingUrl || null,
                    shippedAt: new Date(),
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        // TODO: Send notification to buyer that order has shipped

        res.status(200).json({
            success: true,
            message: 'Order marked as shipped',
            order: {
                _id: result._id.toString(),
                orderNumber: result.orderNumber,
                fulfillmentStatus: result.fulfillmentStatus,
                trackingNumber: result.trackingNumber,
                trackingUrl: result.trackingUrl,
                shippedAt: result.shippedAt
            }
        });
    } catch (error) {
        console.error('Ship order error:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
}
