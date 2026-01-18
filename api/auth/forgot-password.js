// Forgot Password API
// POST: Request password reset via email or SMS

import { getCollection } from '../lib/mongodb.js';
import { rateLimit } from '../lib/rateLimit.js';
import { sendPasswordResetEmail, sendPasswordResetCode } from '../lib/email.js';
import { sendPasswordResetSMS } from '../lib/sms.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Strict rate limit for password reset
    const allowed = await rateLimit(req, res, 'strict');
    if (!allowed) return;

    try {
        const { email, phone, method = 'email' } = req.body;

        // Validate input
        if (method === 'email' && !email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        if (method === 'sms' && !phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const users = await getCollection('users');
        let user;

        if (method === 'email') {
            user = await users.findOne({ email: email.toLowerCase() });
        } else if (method === 'sms') {
            // Normalize phone number for lookup
            const normalizedPhone = phone.replace(/\D/g, '');
            user = await users.findOne({
                $or: [
                    { phone: normalizedPhone },
                    { phone: '+1' + normalizedPhone },
                    { phone: phone }
                ]
            });
        }

        // Always return success to prevent email/phone enumeration
        if (!user) {
            console.log(`Password reset requested for non-existent ${method}: ${email || phone}`);
            return res.status(200).json({
                success: true,
                message: method === 'email'
                    ? 'If an account exists with that email, you will receive a password reset link.'
                    : 'If an account exists with that phone number, you will receive a reset code.'
            });
        }

        const now = new Date();

        if (method === 'email') {
            // Generate reset token for email link
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
            const resetTokenExpiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

            await users.updateOne(
                { _id: user._id },
                {
                    $set: {
                        passwordResetToken: resetTokenHash,
                        passwordResetExpiry: resetTokenExpiry,
                        updatedAt: now
                    }
                }
            );

            // Send email with reset link
            await sendPasswordResetEmail(user.email, resetToken, user.username);
        } else if (method === 'sms') {
            // Generate 6-digit code for SMS
            const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
            const resetCodeHash = crypto.createHash('sha256').update(resetCode).digest('hex');
            const resetCodeExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

            await users.updateOne(
                { _id: user._id },
                {
                    $set: {
                        passwordResetCode: resetCodeHash,
                        passwordResetCodeExpiry: resetCodeExpiry,
                        passwordResetCodeAttempts: 0,
                        updatedAt: now
                    }
                }
            );

            // Send SMS with code
            const phoneToSend = user.phone || phone;
            await sendPasswordResetSMS(phoneToSend, resetCode);
        }

        res.status(200).json({
            success: true,
            message: method === 'email'
                ? 'If an account exists with that email, you will receive a password reset link.'
                : 'If an account exists with that phone number, you will receive a reset code.',
            // Return user ID for code verification flow (only for SMS)
            ...(method === 'sms' && { userId: user._id.toString() })
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
}
