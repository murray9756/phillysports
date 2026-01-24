// POST /api/premium/email/send - Send an email
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserBenefits } from '../../lib/subscriptions.js';
import { sendEmail } from '../../lib/zoho.js';
import { rateLimit } from '../../lib/rateLimit.js';

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

    // Rate limit sending
    const allowed = await rateLimit(req, res, 'standard');
    if (!allowed) return;

    try {
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = user._id || user.userId;
        const benefits = await getUserBenefits(userId);

        if (!benefits.customEmail) {
            return res.status(403).json({ error: 'Premium membership required', upgradeCta: true });
        }

        const users = await getCollection('users');
        const currentUser = await users.findOne({ _id: new ObjectId(userId) });

        if (!currentUser?.premiumEmail?.zohoAccountId) {
            return res.status(400).json({ error: 'No email account linked', needsSetup: true });
        }

        const { to, cc, bcc, subject, content, inReplyTo } = req.body;

        if (!to) {
            return res.status(400).json({ error: 'Recipient (to) is required' });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const toAddresses = to.split(',').map(e => e.trim());
        for (const email of toAddresses) {
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: `Invalid email address: ${email}` });
            }
        }

        const result = await sendEmail(currentUser.premiumEmail.zohoAccountId, {
            to,
            cc,
            bcc,
            subject: subject || '',
            content: content || '',
            inReplyTo,
            isHtml: true
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to send email' });
        }

        return res.status(200).json({
            success: true,
            messageId: result.messageId,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error('Send email error:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
}
