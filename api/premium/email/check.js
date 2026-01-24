// GET /api/premium/email/check?prefix=xxx - Check if email is available
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserBenefits } from '../../lib/subscriptions.js';
import { validateEmailPrefix, isEmailAvailable } from '../../lib/zoho.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Require authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check premium status
        const userId = user._id || user.userId;
        const benefits = await getUserBenefits(userId);
        if (!benefits.customEmail) {
            return res.status(403).json({
                error: 'Custom email addresses require Diehard Premium',
                upgradeCta: true
            });
        }

        const { prefix } = req.query;

        if (!prefix) {
            return res.status(400).json({ error: 'Email prefix is required' });
        }

        // Validate prefix format
        const validation = validateEmailPrefix(prefix);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error, available: false });
        }

        // Check if already claimed by another user in our database
        const users = await getCollection('users');
        const existingClaim = await users.findOne({
            'premiumEmail.prefix': prefix.toLowerCase(),
            _id: { $ne: userId }
        });

        if (existingClaim) {
            return res.status(200).json({
                available: false,
                email: `${prefix.toLowerCase()}@phillysports.com`,
                reason: 'Already claimed by another user'
            });
        }

        // Check Zoho to see if email exists there
        const zohoCheck = await isEmailAvailable(prefix);

        return res.status(200).json({
            available: zohoCheck.available,
            email: zohoCheck.email,
            reason: zohoCheck.available ? null : 'Email already exists'
        });

    } catch (error) {
        console.error('Check email error:', error);
        return res.status(500).json({ error: 'Failed to check email availability' });
    }
}
