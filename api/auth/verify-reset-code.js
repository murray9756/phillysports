// Verify Reset Code API
// POST: Verify the code sent via SMS/email and return a reset token

import { getCollection } from '../lib/mongodb.js';
import { rateLimit } from '../lib/rateLimit.js';
import { ObjectId } from 'mongodb';
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
        const { userId, code } = req.body;

        if (!userId || !code) {
            return res.status(400).json({ error: 'User ID and code are required' });
        }

        // Validate code format (6 digits)
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: 'Invalid code format' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        // Check if code exists and not expired
        if (!user.passwordResetCode || !user.passwordResetCodeExpiry) {
            return res.status(400).json({ error: 'No reset code requested' });
        }

        // Check attempts (max 5)
        if (user.passwordResetCodeAttempts >= 5) {
            return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
        }

        // Increment attempts
        await users.updateOne(
            { _id: user._id },
            { $inc: { passwordResetCodeAttempts: 1 } }
        );

        // Check expiry
        if (new Date() > new Date(user.passwordResetCodeExpiry)) {
            return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
        }

        // Verify code
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        if (codeHash !== user.passwordResetCode) {
            const remainingAttempts = 5 - (user.passwordResetCodeAttempts + 1);
            return res.status(400).json({
                error: `Invalid code. ${remainingAttempts} attempts remaining.`
            });
        }

        // Code is valid - generate a reset token for the password reset step
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await users.updateOne(
            { _id: user._id },
            {
                $set: {
                    passwordResetToken: resetTokenHash,
                    passwordResetExpiry: resetTokenExpiry,
                    updatedAt: new Date()
                },
                $unset: {
                    passwordResetCode: '',
                    passwordResetCodeExpiry: '',
                    passwordResetCodeAttempts: ''
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Code verified successfully',
            resetToken
        });
    } catch (error) {
        console.error('Verify reset code error:', error);
        res.status(500).json({ error: 'Failed to verify code' });
    }
}
