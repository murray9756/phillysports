// POST /api/premium/email/reset-password - Reset @phillysports.com email password
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserBenefits } from '../../lib/subscriptions.js';
import { resetEmailPassword, generatePassword } from '../../lib/zoho.js';
import { sendEmail } from '../../lib/email.js';
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

    // Rate limit
    const allowed = await rateLimit(req, res, 'sensitive');
    if (!allowed) return;

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
        if (!benefits.customEmail) {
            return res.status(403).json({
                error: 'Custom email addresses require Diehard Premium',
                upgradeCta: true
            });
        }

        const users = await getCollection('users');
        const currentUser = await users.findOne({ _id: userIdObj });

        if (!currentUser?.premiumEmail?.email) {
            return res.status(400).json({ error: 'You do not have a @phillysports.com email' });
        }

        // Generate new password
        const newPassword = generatePassword();

        // Reset in Zoho
        const resetResult = await resetEmailPassword(currentUser.premiumEmail.prefix, newPassword);

        if (!resetResult.success) {
            console.error('Failed to reset Zoho password:', resetResult.error);
            return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
        }

        // Send new password to user's personal email
        const personalEmail = currentUser.email;
        if (personalEmail) {
            try {
                await sendEmail(
                    personalEmail,
                    'Your @phillysports.com Password Has Been Reset',
                    `
                    <h2>Password Reset</h2>
                    <p>Your @phillysports.com email password has been reset.</p>

                    <p><strong>Email:</strong> ${currentUser.premiumEmail.email}</p>
                    <p><strong>New Password:</strong> ${newPassword}</p>

                    <p><strong>Webmail:</strong> <a href="https://mail.zoho.com">mail.zoho.com</a></p>

                    <p style="color: #8b0000;">Please change your password after logging in.</p>

                    <p>- PhillySports.com</p>
                    `
                );
            } catch (emailError) {
                console.error('Failed to send password email:', emailError);
            }
        }

        return res.status(200).json({
            success: true,
            email: currentUser.premiumEmail.email,
            message: 'Password reset! Check your personal email for the new password.',
            temporaryPassword: newPassword,
            webmail: 'https://mail.zoho.com'
        });

    } catch (error) {
        console.error('Reset email password error:', error);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
}
