// PayPal Webhook Handler
// POST: Handles PayPal webhook events

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { verifyWebhookSignature } from '../lib/payments/paypal.js';
import { addCoins } from '../lib/coins.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    try {
        // Verify webhook signature
        const isValid = await verifyWebhookSignature(req.headers, req.body);

        if (!isValid) {
            console.error('PayPal webhook signature verification failed');
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body;
        const eventType = event.event_type;

        const orders = await getCollection('orders');
        const products = await getCollection('shop_products');
        const listings = await getCollection('marketplace_listings');

        switch (eventType) {
            case 'CHECKOUT.ORDER.APPROVED': {
                // Order approved by buyer, ready to capture
                // This is informational - capture happens via our API
                console.log('PayPal order approved:', event.resource.id);
                break;
            }

            case 'PAYMENT.CAPTURE.COMPLETED': {
                const capture = event.resource;
                const customId = capture.custom_id || capture.invoice_id;

                // Find order by PayPal order ID or custom ID
                let order;
                if (customId && ObjectId.isValid(customId)) {
                    order = await orders.findOne({ _id: new ObjectId(customId) });
                }

                if (!order) {
                    // Try to find by PayPal order ID from supplementary data
                    const paypalOrderId = event.resource.supplementary_data?.related_ids?.order_id;
                    if (paypalOrderId) {
                        order = await orders.findOne({ paypalOrderId });
                    }
                }

                if (!order) {
                    console.log('Order not found for PayPal capture:', capture.id);
                    break;
                }

                if (order.paymentStatus === 'paid') {
                    console.log('Order already marked as paid:', order.orderNumber);
                    break;
                }

                // Update order status
                await orders.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            paymentStatus: 'paid',
                            paidAt: new Date(),
                            paypalCaptureId: capture.id,
                            updatedAt: new Date()
                        }
                    }
                );

                console.log(`Payment captured for order ${order.orderNumber}`);

                // Update inventory
                for (const item of order.items) {
                    if (item.productType === 'shop_product') {
                        if (item.variant) {
                            await products.updateOne(
                                { _id: item.productId, 'variants._id': item.variant._id },
                                {
                                    $inc: {
                                        'variants.$.inventory': -item.quantity,
                                        salesCount: item.quantity
                                    }
                                }
                            );
                        } else {
                            await products.updateOne(
                                { _id: item.productId, inventory: { $ne: -1 } },
                                {
                                    $inc: {
                                        inventory: -item.quantity,
                                        salesCount: item.quantity
                                    }
                                }
                            );
                        }
                    } else if (item.productType === 'marketplace_listing') {
                        await listings.updateOne(
                            { _id: item.productId },
                            {
                                $inc: { quantity: -item.quantity, quantitySold: item.quantity },
                                $set: { updatedAt: new Date() }
                            }
                        );

                        // Mark as sold if no quantity left
                        const listing = await listings.findOne({ _id: item.productId });
                        if (listing && listing.quantity <= 0) {
                            await listings.updateOne(
                                { _id: item.productId },
                                { $set: { status: 'sold' } }
                            );
                        }
                    }
                }

                // Handle digital items
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

                break;
            }

            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.DECLINED': {
                const capture = event.resource;
                const customId = capture.custom_id || capture.invoice_id;

                if (customId && ObjectId.isValid(customId)) {
                    await orders.updateOne(
                        { _id: new ObjectId(customId) },
                        {
                            $set: {
                                paymentStatus: 'failed',
                                updatedAt: new Date()
                            }
                        }
                    );
                    console.log(`Payment failed for order: ${customId}`);
                }
                break;
            }

            case 'PAYMENT.CAPTURE.REFUNDED': {
                const refund = event.resource;

                // Find order by capture ID
                const order = await orders.findOne({ paypalCaptureId: refund.id });

                if (order) {
                    await orders.updateOne(
                        { _id: order._id },
                        {
                            $set: {
                                paymentStatus: 'refunded',
                                fulfillmentStatus: 'cancelled',
                                updatedAt: new Date()
                            }
                        }
                    );

                    // Restore inventory
                    for (const item of order.items) {
                        if (item.productType === 'shop_product') {
                            if (item.variant) {
                                await products.updateOne(
                                    { _id: item.productId, 'variants._id': item.variant._id },
                                    {
                                        $inc: {
                                            'variants.$.inventory': item.quantity,
                                            salesCount: -item.quantity
                                        }
                                    }
                                );
                            } else {
                                await products.updateOne(
                                    { _id: item.productId, inventory: { $ne: -1 } },
                                    {
                                        $inc: {
                                            inventory: item.quantity,
                                            salesCount: -item.quantity
                                        }
                                    }
                                );
                            }
                        } else if (item.productType === 'marketplace_listing') {
                            await listings.updateOne(
                                { _id: item.productId },
                                {
                                    $inc: { quantity: item.quantity, quantitySold: -item.quantity },
                                    $set: { status: 'active', updatedAt: new Date() }
                                }
                            );
                        }
                    }

                    console.log(`Refund processed for order ${order.orderNumber}`);
                }
                break;
            }

            default:
                console.log(`Unhandled PayPal event type: ${eventType}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('PayPal webhook error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
}
