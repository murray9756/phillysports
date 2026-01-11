// Stripe Webhook Handler
// POST: Handles Stripe webhook events (payment success, failure, refunds)

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { constructWebhookEvent } from '../lib/payments/stripe.js';
import { addCoins } from '../lib/coins.js';
import { calculateCommission } from '../lib/orders/utils.js';

// Disable body parsing - Stripe needs raw body for signature verification
export const config = {
    api: {
        bodyParser: false
    }
};

async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const buf = await buffer(req);
    const signature = req.headers['stripe-signature'];

    let event;
    try {
        event = constructWebhookEvent(buf, signature);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const orders = await getCollection('orders');
    const products = await getCollection('shop_products');
    const listings = await getCollection('marketplace_listings');

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                const { orderId, orderType, orderNumber } = paymentIntent.metadata;

                if (!orderId) {
                    console.log('PaymentIntent without orderId metadata');
                    break;
                }

                // Update order status
                const order = await orders.findOneAndUpdate(
                    { _id: new ObjectId(orderId), paymentStatus: 'pending' },
                    {
                        $set: {
                            paymentStatus: 'paid',
                            paidAt: new Date(),
                            updatedAt: new Date()
                        }
                    },
                    { returnDocument: 'after' }
                );

                if (!order) {
                    console.log(`Order not found or already processed: ${orderId}`);
                    break;
                }

                console.log(`Payment succeeded for order ${orderNumber}`);

                // Update inventory
                for (const item of order.items) {
                    if (item.productType === 'shop_product') {
                        // Site shop product
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
                        // Marketplace listing
                        await listings.updateOne(
                            { _id: item.productId },
                            {
                                $inc: {
                                    quantity: -item.quantity,
                                    quantitySold: item.quantity
                                },
                                $set: { updatedAt: new Date() }
                            }
                        );

                        // Check if listing is sold out
                        const listing = await listings.findOne({ _id: item.productId });
                        if (listing && listing.quantity <= 0) {
                            await listings.updateOne(
                                { _id: item.productId },
                                { $set: { status: 'sold' } }
                            );
                        }
                    }
                }

                // Handle marketplace seller payout
                if (orderType === 'marketplace' && order.sellerId) {
                    // For real money sales, would typically use Stripe Connect
                    // For now, log the payout amount for manual processing
                    console.log(`Marketplace sale: Seller ${order.sellerUsername} earned $${(order.sellerPayoutUSD / 100).toFixed(2)}`);

                    // Could also credit seller's DD balance as a bonus
                    // await addCoins(order.sellerId.toString(), 10, 'marketplace_sale_bonus', 'Bonus for marketplace sale');
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

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                const { orderId, orderNumber } = paymentIntent.metadata;

                if (!orderId) break;

                await orders.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            paymentStatus: 'failed',
                            updatedAt: new Date()
                        }
                    }
                );

                console.log(`Payment failed for order ${orderNumber}`);
                break;
            }

            case 'charge.refunded': {
                const charge = event.data.object;
                const paymentIntentId = charge.payment_intent;

                // Find the order by Stripe PaymentIntent ID
                const order = await orders.findOne({ stripePaymentIntentId: paymentIntentId });

                if (!order) {
                    console.log(`Order not found for PaymentIntent: ${paymentIntentId}`);
                    break;
                }

                // Determine if full or partial refund
                const refundedAmount = charge.amount_refunded;
                const totalAmount = charge.amount;
                const isFullRefund = refundedAmount >= totalAmount;

                await orders.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
                            fulfillmentStatus: 'cancelled',
                            updatedAt: new Date()
                        }
                    }
                );

                // Restore inventory for full refunds
                if (isFullRefund) {
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
                                    $inc: {
                                        quantity: item.quantity,
                                        quantitySold: -item.quantity
                                    },
                                    $set: {
                                        status: 'active',
                                        updatedAt: new Date()
                                    }
                                }
                            );
                        }
                    }
                }

                console.log(`Refund processed for order ${order.orderNumber}`);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
}
