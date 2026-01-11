// Shop PayPal Create Order API
// POST: Create a PayPal order for shop purchases

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { createPayPalOrder } from '../../../lib/payments/paypal.js';
import { generateOrderNumber, calculateOrderTotals } from '../../../lib/orders/utils.js';

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

        const { items, shippingAddressId, shippingMethod, returnUrl, cancelUrl } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Cart items are required' });
        }

        const products = await getCollection('shop_products');
        const orders = await getCollection('orders');
        const addresses = await getCollection('shipping_addresses');
        const users = await getCollection('users');

        // Get buyer info
        const buyer = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!buyer) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate and calculate items
        const orderItems = [];
        let requiresShipping = false;

        for (const item of items) {
            const product = await products.findOne({
                _id: new ObjectId(item.productId),
                status: 'active'
            });

            if (!product) {
                return res.status(400).json({
                    error: `Product not found: ${item.productId}`
                });
            }

            let price = product.priceUSD;
            let variantInfo = null;

            if (item.variantId && product.hasVariants) {
                const variant = product.variants?.find(
                    v => v._id.toString() === item.variantId
                );
                if (!variant) {
                    return res.status(400).json({
                        error: `Variant not found for ${product.name}`
                    });
                }
                if (!variant.isAvailable || variant.inventory < item.quantity) {
                    return res.status(400).json({
                        error: `${product.name} (${variant.name}) is out of stock`
                    });
                }
                if (variant.priceUSD) {
                    price = variant.priceUSD;
                }
                variantInfo = {
                    _id: variant._id,
                    name: variant.name,
                    sku: variant.sku
                };
            } else if (!product.hasVariants) {
                if (product.inventory !== -1 && product.inventory < item.quantity) {
                    return res.status(400).json({
                        error: `${product.name} is out of stock`
                    });
                }
            }

            if (product.productType === 'physical') {
                requiresShipping = true;
            }

            orderItems.push({
                productId: product._id,
                productType: 'shop_product',
                name: product.name,
                variant: variantInfo,
                quantity: item.quantity,
                pricePerItem: price,
                currency: 'usd',
                totalPrice: price * item.quantity,
                isDigital: product.productType === 'digital'
            });
        }

        // Get shipping address if required
        let shippingAddress = null;
        let shippingCost = 0;

        if (requiresShipping) {
            if (!shippingAddressId) {
                return res.status(400).json({
                    error: 'Shipping address required for physical items'
                });
            }

            const address = await addresses.findOne({
                _id: new ObjectId(shippingAddressId),
                userId: new ObjectId(decoded.userId)
            });

            if (!address) {
                return res.status(400).json({ error: 'Shipping address not found' });
            }

            shippingAddress = {
                fullName: address.fullName,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country,
                phone: address.phone
            };

            switch (shippingMethod) {
                case 'express':
                    shippingCost = 1999;
                    break;
                case 'priority':
                    shippingCost = 999;
                    break;
                case 'standard':
                default:
                    shippingCost = 599;
            }
        }

        // Calculate totals
        const totals = calculateOrderTotals(orderItems, 'usd', shippingCost);

        // Generate order number
        const orderNumber = await generateOrderNumber();

        // Create order
        const order = {
            orderNumber,
            buyerId: new ObjectId(decoded.userId),
            buyerUsername: buyer.username,
            buyerEmail: buyer.email,
            sellerId: null,
            sellerUsername: null,
            orderType: 'shop',
            items: orderItems,
            subtotalUSD: totals.subtotal,
            subtotalDiehardDollars: 0,
            shippingUSD: totals.shipping,
            taxUSD: totals.tax,
            totalUSD: totals.total,
            totalDiehardDollars: 0,
            commissionRate: null,
            commissionAmountUSD: null,
            commissionAmountDD: null,
            sellerPayoutUSD: null,
            sellerPayoutDD: null,
            paymentMethod: 'paypal',
            paymentStatus: 'pending',
            stripePaymentIntentId: null,
            paypalOrderId: null,
            diehardDollarsTransactionId: null,
            shippingAddress,
            shippingMethod: requiresShipping ? (shippingMethod || 'standard') : null,
            fulfillmentStatus: 'unfulfilled',
            trackingNumber: null,
            trackingUrl: null,
            shippedAt: null,
            deliveredAt: null,
            digitalDeliveryStatus: orderItems.some(i => i.isDigital) ? 'pending' : null,
            digitalDeliveredAt: null,
            disputeStatus: null,
            buyerNotes: null,
            sellerNotes: null,
            adminNotes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            paidAt: null
        };

        // Insert order
        const result = await orders.insertOne(order);
        order._id = result.insertedId;

        // Create PayPal order
        const paypalOrder = await createPayPalOrder({
            amount: totals.total,
            orderId: order._id.toString(),
            description: `PhillySports.com Order #${orderNumber}`,
            returnUrl: returnUrl || `${process.env.SITE_URL}/orders/${order._id}?success=true`,
            cancelUrl: cancelUrl || `${process.env.SITE_URL}/shop?cancelled=true`
        });

        // Update order with PayPal order ID
        await orders.updateOne(
            { _id: order._id },
            { $set: { paypalOrderId: paypalOrder.id } }
        );

        // Find approval URL
        const approvalUrl = paypalOrder.links?.find(l => l.rel === 'approve')?.href;

        res.status(200).json({
            success: true,
            paypalOrderId: paypalOrder.id,
            approvalUrl,
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            totals: {
                subtotal: totals.subtotal,
                shipping: totals.shipping,
                tax: totals.tax,
                total: totals.total
            }
        });

    } catch (error) {
        console.error('PayPal create order error:', error);
        res.status(500).json({ error: error.message || 'Failed to create PayPal order' });
    }
}
