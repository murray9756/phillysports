// Order Utilities
// Handles order number generation and order-related helpers

import { getCollection } from '../mongodb.js';

/**
 * Generate a unique order number
 * Format: PS-YYYY-NNNNNN (e.g., PS-2026-000001)
 * @returns {Promise<string>}
 */
export async function generateOrderNumber() {
    const orders = await getCollection('orders');
    const year = new Date().getFullYear();

    // Get count of orders this year
    const count = await orders.countDocuments({
        createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${year + 1}-01-01`)
        }
    });

    const paddedCount = String(count + 1).padStart(6, '0');
    return `PS-${year}-${paddedCount}`;
}

/**
 * Calculate order totals
 * @param {Object[]} items - Array of order items
 * @param {string} currency - 'usd' or 'diehard_dollars'
 * @param {number} shippingCost - Shipping cost in cents (USD only)
 * @returns {{ subtotal: number, shipping: number, tax: number, total: number }}
 */
export function calculateOrderTotals(items, currency, shippingCost = 0) {
    const subtotal = items.reduce((sum, item) => {
        return sum + (item.pricePerItem * item.quantity);
    }, 0);

    // Tax calculation (simplified - would need real tax API for production)
    // Only apply to USD transactions
    const tax = currency === 'usd' ? 0 : 0; // Tax handled separately if needed

    const total = subtotal + shippingCost + tax;

    return {
        subtotal,
        shipping: shippingCost,
        tax,
        total
    };
}

/**
 * Calculate marketplace commission
 * @param {number} amount - Sale amount
 * @param {string} currency - 'usd' or 'diehard_dollars'
 * @returns {{ commission: number, sellerPayout: number, rate: number }}
 */
export function calculateCommission(amount, currency) {
    // 10% for USD, 5% for Diehard Dollars (to encourage DD usage)
    const rate = currency === 'usd' ? 0.10 : 0.05;
    const commission = Math.round(amount * rate);
    const sellerPayout = amount - commission;

    return {
        commission,
        sellerPayout,
        rate
    };
}

/**
 * Validate order can be created
 * @param {Object} listing - The marketplace listing
 * @param {number} requestedQuantity - Quantity being purchased
 * @param {string} buyerId - The buyer's user ID
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePurchase(listing, requestedQuantity, buyerId) {
    // Check listing is available
    if (listing.moderationStatus !== 'approved') {
        return { valid: false, error: 'This listing is not available for purchase' };
    }

    if (listing.status !== 'active') {
        return { valid: false, error: 'This listing is no longer active' };
    }

    // Check expiration
    if (listing.expiresAt && new Date(listing.expiresAt) < new Date()) {
        return { valid: false, error: 'This listing has expired' };
    }

    // Check quantity
    if (listing.quantity < requestedQuantity) {
        return {
            valid: false,
            error: `Only ${listing.quantity} item(s) available`
        };
    }

    // Check not buying own listing
    if (listing.sellerId.toString() === buyerId) {
        return { valid: false, error: "You cannot purchase your own listing" };
    }

    return { valid: true, error: null };
}

/**
 * Format price for display
 * @param {number} amount - Amount in cents
 * @param {string} currency - 'usd' or 'diehard_dollars'
 * @returns {string}
 */
export function formatPrice(amount, currency) {
    if (currency === 'usd') {
        return `$${(amount / 100).toFixed(2)}`;
    }
    return `${amount.toLocaleString()} DD`;
}

/**
 * Get order status display info
 * @param {Object} order - The order object
 * @returns {{ status: string, color: string, description: string }}
 */
export function getOrderStatusInfo(order) {
    const statuses = {
        // Payment statuses
        'pending': { status: 'Payment Pending', color: 'yellow', description: 'Awaiting payment' },
        'paid': { status: 'Paid', color: 'green', description: 'Payment received' },
        'failed': { status: 'Payment Failed', color: 'red', description: 'Payment was not successful' },
        'refunded': { status: 'Refunded', color: 'gray', description: 'Order has been refunded' },

        // Fulfillment statuses
        'unfulfilled': { status: 'Processing', color: 'blue', description: 'Order is being prepared' },
        'shipped': { status: 'Shipped', color: 'blue', description: 'Order has been shipped' },
        'delivered': { status: 'Delivered', color: 'green', description: 'Order has been delivered' },
        'cancelled': { status: 'Cancelled', color: 'red', description: 'Order was cancelled' }
    };

    // Determine primary status to show
    if (order.paymentStatus === 'refunded') {
        return statuses['refunded'];
    }
    if (order.paymentStatus === 'failed') {
        return statuses['failed'];
    }
    if (order.paymentStatus === 'pending') {
        return statuses['pending'];
    }
    if (order.fulfillmentStatus === 'cancelled') {
        return statuses['cancelled'];
    }
    if (order.fulfillmentStatus) {
        return statuses[order.fulfillmentStatus] || statuses['unfulfilled'];
    }

    return statuses['pending'];
}

/**
 * Check if order can be cancelled
 * @param {Object} order - The order object
 * @returns {boolean}
 */
export function canCancelOrder(order) {
    // Can only cancel if payment is pending or if not yet shipped
    if (order.paymentStatus === 'pending') {
        return true;
    }
    if (order.paymentStatus === 'paid' && order.fulfillmentStatus === 'unfulfilled') {
        return true;
    }
    return false;
}

/**
 * Check if order can be disputed
 * @param {Object} order - The order object
 * @returns {boolean}
 */
export function canDisputeOrder(order) {
    // Can dispute if paid and within 14 days of delivery
    if (order.paymentStatus !== 'paid') {
        return false;
    }
    if (order.disputeStatus && order.disputeStatus !== 'none') {
        return false; // Already has a dispute
    }

    // Allow disputes for 14 days after delivery or 30 days after payment
    const disputeDeadline = order.deliveredAt
        ? new Date(order.deliveredAt.getTime() + 14 * 24 * 60 * 60 * 1000)
        : new Date(order.paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return new Date() < disputeDeadline;
}
