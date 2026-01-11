// Shop Diehard Dollars Checkout API
// POST: Purchase shop items with Diehard Dollars

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { spendCoins, getBalance } from '../../lib/coins.js';
import { generateOrderNumber } from '../../lib/orders/utils.js';

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

        const { items, shippingAddressId, shippingMethod } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Cart items are required' });
        }

        const products = await getCollection('shop_products');
        const orders = await getCollection('orders');
        const addresses = await getCollection('shipping_addresses');
        const users = await getCollection('users');

        // Get buyer info and balance
        const buyer = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!buyer) {
            return res.status(404).json({ error: 'User not found' });
        }

        const balance = await getBalance(decoded.userId);
        const currentBalance = balance?.balance || 0;

        // Validate and calculate items
        const orderItems = [];
        let requiresShipping = false;
        let totalDD = 0;

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

            // Check if product accepts Diehard Dollars
            if (!product.priceDiehardDollars) {
                return res.status(400).json({
                    error: `${product.name} is not available for Diehard Dollars purchase`
                });
            }

            let price = product.priceDiehardDollars;
            let variantInfo = null;

            // Handle variants
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

            const itemTotal = price * item.quantity;
            totalDD += itemTotal;

            orderItems.push({
                productId: product._id,
                productType: 'shop_product',
                name: product.name,
                variant: variantInfo,
                quantity: item.quantity,
                pricePerItem: price,
                currency: 'diehard_dollars',
                totalPrice: itemTotal,
                isDigital: product.productType === 'digital'
            });
        }

        // Check balance
        if (currentBalance < totalDD) {
            return res.status(400).json({
                error: 'Insufficient Diehard Dollars',
                required: totalDD,
                current: currentBalance
            });
        }

        // Get shipping address if required
        let shippingAddress = null;

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
        }

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
            subtotalUSD: 0,
            subtotalDiehardDollars: totalDD,
            shippingUSD: 0,
            taxUSD: 0,
            totalUSD: 0,
            totalDiehardDollars: totalDD,
            commissionRate: null,
            commissionAmountUSD: null,
            commissionAmountDD: null,
            sellerPayoutUSD: null,
            sellerPayoutDD: null,
            paymentMethod: 'diehard_dollars',
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

        // Spend Diehard Dollars
        try {
            await spendCoins(
                decoded.userId,
                totalDD,
                'shop_purchase',
                `Shop purchase: Order #${orderNumber}`,
                { orderId: order._id.toString(), orderNumber }
            );
        } catch (coinError) {
            // Delete the order if coin spending fails
            await orders.deleteOne({ _id: order._id });
            return res.status(400).json({
                error: coinError.message || 'Failed to process payment'
            });
        }

        // Update order status to paid
        await orders.updateOne(
            { _id: order._id },
            {
                $set: {
                    paymentStatus: 'paid',
                    paidAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        // Update inventory for each item
        for (const item of orderItems) {
            if (item.variant) {
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

        // Handle digital items
        const hasDigitalItems = orderItems.some(i => i.isDigital);
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

        // Get updated balance
        const newBalance = await getBalance(decoded.userId);

        res.status(200).json({
            success: true,
            message: 'Purchase complete!',
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            totalSpent: totalDD,
            newBalance: newBalance?.balance || 0
        });

    } catch (error) {
        console.error('Diehard Dollars checkout error:', error);
        res.status(500).json({ error: error.message || 'Failed to process purchase' });
    }
}
