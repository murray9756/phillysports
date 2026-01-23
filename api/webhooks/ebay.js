// eBay Marketplace Account Deletion Webhook
// Handles verification challenge and deletion notifications
// Required for eBay API production access

import crypto from 'crypto';

// Your verification token from eBay Developer portal
const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN || '';

export default async function handler(req, res) {
    // Handle GET request - verification challenge
    if (req.method === 'GET') {
        const challengeCode = req.query.challenge_code;

        if (!challengeCode) {
            return res.status(400).json({ error: 'Missing challenge_code' });
        }

        // Create response hash: SHA256(challengeCode + verificationToken + endpoint)
        const endpoint = `https://phillysports.com/api/webhooks/ebay`;
        const hash = crypto
            .createHash('sha256')
            .update(challengeCode + VERIFICATION_TOKEN + endpoint)
            .digest('hex');

        // Return the challenge response
        return res.status(200).json({
            challengeResponse: hash
        });
    }

    // Handle POST request - actual deletion notification
    if (req.method === 'POST') {
        // Log the notification (we don't store eBay user data, so nothing to delete)
        console.log('eBay deletion notification received:', req.body);

        // Acknowledge receipt
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
