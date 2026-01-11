// PayPal Payment Utilities
// Handles PayPal order creation, capture, and refunds

const PAYPAL_API = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';

let accessTokenCache = null;
let accessTokenExpiry = null;

/**
 * Get PayPal access token (cached)
 * @returns {Promise<string>}
 */
async function getAccessToken() {
    // Return cached token if still valid (with 60s buffer)
    if (accessTokenCache && accessTokenExpiry && Date.now() < accessTokenExpiry - 60000) {
        return accessTokenCache;
    }

    const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString('base64');

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`PayPal auth failed: ${error}`);
    }

    const data = await response.json();
    accessTokenCache = data.access_token;
    accessTokenExpiry = Date.now() + (data.expires_in * 1000);

    return accessTokenCache;
}

/**
 * Create a PayPal order
 * @param {Object} options - Order options
 * @param {number} options.amount - Amount in cents
 * @param {string} options.orderId - Internal order ID for reference
 * @param {string} options.description - Order description
 * @param {string} options.returnUrl - URL to redirect after approval
 * @param {string} options.cancelUrl - URL to redirect if cancelled
 * @returns {Promise<Object>} PayPal order object
 */
export async function createPayPalOrder({ amount, orderId, description, returnUrl, cancelUrl }) {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: orderId,
                description: description || 'PhillySports.com Purchase',
                amount: {
                    currency_code: 'USD',
                    value: (amount / 100).toFixed(2)
                }
            }],
            application_context: {
                brand_name: 'PhillySports.com',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: returnUrl,
                cancel_url: cancelUrl
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal order creation failed: ${JSON.stringify(error)}`);
    }

    return response.json();
}

/**
 * Capture a PayPal order after approval
 * @param {string} paypalOrderId - PayPal order ID
 * @returns {Promise<Object>} Capture result
 */
export async function capturePayPalOrder(paypalOrderId) {
    const accessToken = await getAccessToken();

    const response = await fetch(
        `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}/capture`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal capture failed: ${JSON.stringify(error)}`);
    }

    return response.json();
}

/**
 * Get PayPal order details
 * @param {string} paypalOrderId - PayPal order ID
 * @returns {Promise<Object>} Order details
 */
export async function getPayPalOrder(paypalOrderId) {
    const accessToken = await getAccessToken();

    const response = await fetch(
        `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal get order failed: ${JSON.stringify(error)}`);
    }

    return response.json();
}

/**
 * Refund a captured PayPal payment
 * @param {string} captureId - The capture ID from the payment
 * @param {number} amount - Amount in cents (optional, defaults to full refund)
 * @param {string} reason - Refund reason
 * @returns {Promise<Object>} Refund result
 */
export async function refundPayPalPayment(captureId, amount = null, reason = null) {
    const accessToken = await getAccessToken();

    const body = {};
    if (amount) {
        body.amount = {
            currency_code: 'USD',
            value: (amount / 100).toFixed(2)
        };
    }
    if (reason) {
        body.note_to_payer = reason;
    }

    const response = await fetch(
        `${PAYPAL_API}/v2/payments/captures/${captureId}/refund`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal refund failed: ${JSON.stringify(error)}`);
    }

    return response.json();
}

/**
 * Verify PayPal webhook signature
 * @param {Object} headers - Request headers
 * @param {Object} body - Webhook body
 * @returns {Promise<boolean>} Whether signature is valid
 */
export async function verifyWebhookSignature(headers, body) {
    const accessToken = await getAccessToken();

    const response = await fetch(
        `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth_algo: headers['paypal-auth-algo'],
                cert_url: headers['paypal-cert-url'],
                transmission_id: headers['paypal-transmission-id'],
                transmission_sig: headers['paypal-transmission-sig'],
                transmission_time: headers['paypal-transmission-time'],
                webhook_id: process.env.PAYPAL_WEBHOOK_ID,
                webhook_event: body
            })
        }
    );

    if (!response.ok) {
        return false;
    }

    const data = await response.json();
    return data.verification_status === 'SUCCESS';
}
