// Marketplace Purchase API
// POST: Purchase a marketplace listing

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { spendCoins, addCoins } from '../lib/coins.js';
import { createPaymentIntent } from '../lib/payments/stripe.js';
import { createPayPalOrder } from '../lib/payments/paypal.js';
import { generateOrderNumber, calculateCommission, validatePurchase } from '../lib/orders/utils.js';

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

        const {
            listingId,
            quantity = 1,
            paymentMethod, // 'stripe', 'paypal', 'diehard_dollars'
            shippingAddressId,
            shippingOption = 'standard'
        } = req.body;

        if (!listingId) {
            return res.status(400).json({ error: 'Listing ID is required' });
        }

        if (!paymentMethod || !['stripe', 'paypal', 'diehard_dollars'].includes(paymentMethod)) {
            return res.status(400).json({ error: 'Valid payment method is required' });
        }

        const listings = await getCollection('marketplace_listings');
        const orders = await getCollection('orders');
        const addresses = await getCollection('shipping_addresses');
        const users = await getCollection('users');

        // Get listing
        const listing = await listings.findOne({
            _id: new ObjectId(listingId)
        });

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        // Validate purchase
        const purchaseValidation = validatePurchase(listing, quantity, decoded.userId);
        if (!purchaseValidation.valid) {
            return res.status(400).json({ error: purchaseValidation.error });
        }

        // Validate payment method acceptance
        if (paymentMethod === 'diehard_dollars' && !listing.acceptsDiehardDollars) {
            return res.status(400).json({ error: 'This listing does not accept Diehard Dollars' });
        }
        if ((paymentMethod === 'stripe' || paymentMethod === 'paypal') && !listing.acceptsUSD) {
            return res.status(400).json({ error: 'This listing does not accept USD' });
        }

        // Get buyer info
        const buyer = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!buyer) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get shipping address for physical items
        let shippingAddress = null;
        let shippingCost = 0;

        if (listing.productType === 'physical') {
            if (!shippingAddressId) {
                return res.status(400).json({ error: 'Shipping address required for physical items' });
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

            // Get shipping cost from listing options
            const selectedShipping = listing.shippingInfo?.shippingOptions?.find(
                opt => opt.method === shippingOption
            );
            if (selectedShipping) {
                shippingCost = selectedShipping.priceUSD || 0;
            }
        }

        // Calculate totals based on payment method
        const currency = paymentMethod === 'diehard_dollars' ? 'diehard_dollars' : 'usd';
        const itemPrice = currency === 'diehard_dollars' ? listing.priceDiehardDollars : listing.priceUSD;
        const subtotal = itemPrice * quantity;
        const shipping = currency === 'usd' ? shippingCost : 0;
        const total = subtotal + shipping;

        // Calculate commission
        const commission = calculateCommission(subtotal, currency);

        // Generate order number
        const orderNumber = await generateOrderNumber();

        // Create order object
        const order = {
            orderNumber,
            buyerId: new ObjectId(decoded.userId),
            buyerUsername: buyer.username,
            buyerEmail: buyer.email,
            sellerId: listing.sellerId,
            sellerUsername: listing.sellerUsername,
            orderType: 'marketplace',
            items: [{
                productId: listing._id,
                productType: 'marketplace_listing',
                name: listing.title,
                variant: null,
                quantity,
                pricePerItem: itemPrice,
                currency,
                totalPrice: subtotal,
                isDigital: listing.productType === 'digital'
            }],
            subtotalUSD: currency === 'usd' ? subtotal : 0,
            subtotalDiehardDollars: currency === 'diehard_dollars' ? subtotal : 0,
            shippingUSD: shipping,
            taxUSD: 0,
            totalUSD: currency === 'usd' ? total : 0,
            totalDiehardDollars: currency === 'diehard_dollars' ? total : 0,
            commissionRate: commission.rate,
            commissionAmountUSD: currency === 'usd' ? commission.commission : null,
            commissionAmountDD: currency === 'diehard_dollars' ? commission.commission : null,
            sellerPayoutUSD: currency === 'usd' ? commission.sellerPayout : null,
            sellerPayoutDD: currency === 'diehard_dollars' ? commission.sellerPayout : null,
            paymentMethod,
            paymentStatus: 'pending',
            stripePaymentIntentId: null,
            paypalOrderId: null,
            diehardDollarsTransactionId: null,
            shippingAddress,
            shippingMethod: listing.productType === 'physical' ? shippingOption : null,
            fulfillmentStatus: listing.productType === 'digital' ? 'processing' : 'unfulfilled',
            trackingNumber: null,
            trackingUrl: null,
            shippedAt: null,
            deliveredAt: null,
            digitalDeliveryStatus: listing.productType === 'digital' ? 'pending' : null,
            digitalDeliveredAt: null,
            disputeStatus: null,
            buyerNotes: null,
            sellerNotes: null,
            adminNotes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            paidAt: null
        };

        // Process based on payment method
        if (paymentMethod === 'diehard_dollars') {
            // Check buyer balance
            if ((buyer.coinBalance || 0) < total) {
                return res.status(400).json({
                    error: 'Insufficient Diehard Dollars',
                    required: total,
                    current: buyer.coinBalance || 0
                });
            }

            // Insert order first
            const result = await orders.insertOne(order);
            order._id = result.insertedId;

            try {
                // Deduct from buyer
                await spendCoins(
                    decoded.userId,
                    total,
                    'marketplace_purchase',
                    `Purchased: ${listing.title}`,
                    { orderId: order._id.toString(), listingId: listing._id.toString() }
                );

                // Add to seller (minus commission)
                await addCoins(
                    listing.sellerId.toString(),
                    commission.sellerPayout,
                    'marketplace_sale',
                    `Sold: ${listing.title}`,
                    { orderId: order._id.toString(), commission: commission.commission }
                );
            } catch (coinError) {
                // Rollback order if coin operations fail
                await orders.deleteOne({ _id: order._id });
                throw coinError;
            }

            // Update order status
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

            // Update listing quantity
            await listings.findOneAndUpdate(
                { _id: listing._id },
                {
                    $inc: { quantity: -quantity, quantitySold: quantity },
                    $set: {
                        status: listing.quantity - quantity <= 0 ? 'sold' : 'active',
                        updatedAt: new Date()
                    }
                }
            );

            // Handle digital delivery
            if (listing.productType === 'digital') {
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

            return res.status(200).json({
                success: true,
                message: 'Purchase complete!',
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                totalSpent: total,
                currency: 'diehard_dollars'
            });
        }

        // For Stripe/PayPal, create pending order first
        const result = await orders.insertOne(order);
        order._id = result.insertedId;

        if (paymentMethod === 'stripe') {
            // Create Stripe PaymentIntent
            const paymentIntent = await createPaymentIntent({
                amount: total,
                currency: 'usd',
                metadata: {
                    orderNumber: order.orderNumber,
                    orderId: order._id.toString(),
                    orderType: 'marketplace',
                    buyerId: decoded.userId,
                    sellerId: listing.sellerId.toString()
                }
            });

            // Update order with Stripe ID
            await orders.updateOne(
                { _id: order._id },
                { $set: { stripePaymentIntentId: paymentIntent.id } }
            );

            return res.status(200).json({
                success: true,
                requiresPayment: true,
                paymentMethod: 'stripe',
                clientSecret: paymentIntent.client_secret,
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                totals: {
                    subtotal,
                    shipping,
                    commission: commission.commission,
                    total
                }
            });
        }

        if (paymentMethod === 'paypal') {
            // Create PayPal order
            const paypalOrder = await createPayPalOrder({
                amount: total,
                orderId: order._id.toString(),
                description: `PhillySports Marketplace: ${listing.title}`,
                returnUrl: `${process.env.SITE_URL}/marketplace/order/${order._id}?success=true`,
                cancelUrl: `${process.env.SITE_URL}/marketplace/listing/${listing._id}?cancelled=true`
            });

            // Update order with PayPal ID
            await orders.updateOne(
                { _id: order._id },
                { $set: { paypalOrderId: paypalOrder.id } }
            );

            const approvalUrl = paypalOrder.links?.find(l => l.rel === 'approve')?.href;

            return res.status(200).json({
                success: true,
                requiresPayment: true,
                paymentMethod: 'paypal',
                paypalOrderId: paypalOrder.id,
                approvalUrl,
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                totals: {
                    subtotal,
                    shipping,
                    commission: commission.commission,
                    total
                }
            });
        }

        return res.status(400).json({ error: 'Invalid payment method' });

    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: error.message || 'Failed to process purchase' });
    }
}
