// Stripe Payment Utilities
// Handles PaymentIntent creation and management

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a PaymentIntent for checkout
 * @param {Object} options - Payment options
 * @param {number} options.amount - Amount in cents
 * @param {string} options.currency - Currency code (default: 'usd')
 * @param {Object} options.metadata - Additional metadata for the payment
 * @returns {Promise<Stripe.PaymentIntent>}
 */
export async function createPaymentIntent({ amount, currency = 'usd', metadata = {} }) {
    return stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
        automatic_payment_methods: { enabled: true }
    });
}

/**
 * Retrieve a PaymentIntent by ID
 * @param {string} paymentIntentId - The PaymentIntent ID
 * @returns {Promise<Stripe.PaymentIntent>}
 */
export async function retrievePaymentIntent(paymentIntentId) {
    return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Cancel a PaymentIntent
 * @param {string} paymentIntentId - The PaymentIntent ID
 * @returns {Promise<Stripe.PaymentIntent>}
 */
export async function cancelPaymentIntent(paymentIntentId) {
    return stripe.paymentIntents.cancel(paymentIntentId);
}

/**
 * Create a refund for a PaymentIntent
 * @param {string} paymentIntentId - The PaymentIntent ID
 * @param {number} amount - Amount to refund in cents (optional, defaults to full refund)
 * @param {string} reason - Refund reason (optional)
 * @returns {Promise<Stripe.Refund>}
 */
export async function createRefund(paymentIntentId, amount = null, reason = null) {
    const refundParams = {
        payment_intent: paymentIntentId
    };

    if (amount) {
        refundParams.amount = amount;
    }

    if (reason) {
        refundParams.reason = reason;
    }

    return stripe.refunds.create(refundParams);
}

/**
 * Construct and verify a webhook event
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Stripe.Event}
 */
export function constructWebhookEvent(payload, signature) {
    return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );
}

/**
 * Get Stripe instance for advanced operations
 * @returns {Stripe}
 */
export function getStripeInstance() {
    return stripe;
}
