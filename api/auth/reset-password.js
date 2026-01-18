// Reset Password API
// POST: Reset password using the reset token

import { getCollection } from '../lib/mongodb.js';
import { hashPassword } from '../lib/auth.js';
import { rateLimit } from '../lib/rateLimit.js';
import { validatePassword } from '../lib/validate.js';
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

    // Strict rate limit
    const allowed = await rateLimit(req, res, 'strict');
    if (!allowed) return;

    try {
        const { token, password, confirmPassword } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Reset token is required' });
        }

        if (!password) {
            return res.status(400).json({ error: 'New password is required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        // Validate password strength
        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        // Hash the token to compare with stored hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const users = await getCollection('users');
        const user = await users.findOne({
            passwordResetToken: tokenHash,
            passwordResetExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash the new password
        const hashedPassword = await hashPassword(password);

        // Update password and clear reset fields
        await users.updateOne(
            { _id: user._id },
            {
                $set: {
                    password: hashedPassword,
                    updatedAt: new Date()
                },
                $unset: {
                    passwordResetToken: '',
                    passwordResetExpiry: '',
                    passwordResetCode: '',
                    passwordResetCodeExpiry: '',
                    passwordResetCodeAttempts: ''
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}
