// GET /api/premium/email - Get user's premium email status
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserBenefits } from '../../lib/subscriptions.js';

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

        const userId = user._id || user.userId;
        const userIdObj = new ObjectId(userId);

        // Check premium status
        const benefits = await getUserBenefits(userId);

        const users = await getCollection('users');
        const currentUser = await users.findOne({ _id: userIdObj });

        const premiumEmail = currentUser?.premiumEmail;

        if (!benefits.customEmail) {
            return res.status(200).json({
                eligible: false,
                hasEmail: false,
                message: 'Upgrade to Diehard Premium to get your @phillysports.com email',
                upgradeCta: true
            });
        }

        if (premiumEmail?.email) {
            return res.status(200).json({
                eligible: true,
                hasEmail: true,
                email: premiumEmail.email,
                createdAt: premiumEmail.createdAt,
                status: premiumEmail.status,
                webmail: 'https://mail.zoho.com',
                imapServer: 'imap.zoho.com',
                smtpServer: 'smtp.zoho.com'
            });
        }

        // Premium but hasn't claimed email yet
        return res.status(200).json({
            eligible: true,
            hasEmail: false,
            suggestedEmail: `${user.username.toLowerCase()}@phillysports.com`,
            message: 'Claim your free @phillysports.com email address!'
        });

    } catch (error) {
        console.error('Get email status error:', error);
        return res.status(500).json({ error: 'Failed to get email status' });
    }
}
