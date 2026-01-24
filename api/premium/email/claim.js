// POST /api/premium/email/claim - Claim a @phillysports.com email address
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserBenefits } from '../../lib/subscriptions.js';
import { validateEmailPrefix, isEmailAvailable, createEmailAccount, generatePassword } from '../../lib/zoho.js';
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

    // Rate limit - this is a sensitive operation
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

        // Check if user already has an email
        if (currentUser?.premiumEmail?.email) {
            return res.status(400).json({
                error: 'You already have a @phillysports.com email',
                currentEmail: currentUser.premiumEmail.email
            });
        }

        // Get requested prefix (default to username)
        let { prefix } = req.body;
        if (!prefix) {
            prefix = user.username;
        }

        // Validate prefix format
        const validation = validateEmailPrefix(prefix);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const normalizedPrefix = prefix.toLowerCase();

        // Check if already claimed by another user
        const existingClaim = await users.findOne({
            'premiumEmail.prefix': normalizedPrefix,
            _id: { $ne: userIdObj }
        });

        if (existingClaim) {
            return res.status(400).json({
                error: 'This email is already claimed by another user',
                suggestion: `${user.username}@phillysports.com`
            });
        }

        // Check Zoho availability
        const zohoCheck = await isEmailAvailable(normalizedPrefix);
        if (!zohoCheck.available) {
            return res.status(400).json({
                error: 'This email address is not available',
                suggestion: `${user.username}@phillysports.com`
            });
        }

        // Generate a secure password for the email account
        const emailPassword = generatePassword();

        // Create the email account in Zoho
        const displayName = currentUser?.displayName || user.username;
        const createResult = await createEmailAccount(normalizedPrefix, displayName, emailPassword);

        if (!createResult.success) {
            console.error('Failed to create Zoho email:', createResult.error);
            return res.status(500).json({ error: 'Failed to create email account. Please try again.' });
        }

        // Store the email info in user record
        const emailData = {
            prefix: normalizedPrefix,
            email: createResult.email,
            zohoAccountId: createResult.accountId,
            createdAt: new Date(),
            status: 'active'
        };

        await users.updateOne(
            { _id: userIdObj },
            { $set: { premiumEmail: emailData, updatedAt: new Date() } }
        );

        // Send welcome email with login credentials
        const personalEmail = currentUser?.email;
        if (personalEmail) {
            try {
                await sendEmail(
                    personalEmail,
                    'Your @phillysports.com Email is Ready!',
                    `
                    <h2>Welcome to your new email!</h2>
                    <p>Your @phillysports.com email address has been created:</p>
                    <p style="font-size: 1.2em; font-weight: bold; color: #1a5c3a;">${createResult.email}</p>

                    <h3>Login Details</h3>
                    <p><strong>Webmail:</strong> <a href="https://mail.zoho.com">mail.zoho.com</a></p>
                    <p><strong>Email:</strong> ${createResult.email}</p>
                    <p><strong>Temporary Password:</strong> ${emailPassword}</p>

                    <p style="color: #8b0000;"><strong>Important:</strong> Please change your password after your first login.</p>

                    <h3>Email Settings</h3>
                    <p>To use with an email client (Outlook, Apple Mail, etc.):</p>
                    <ul>
                        <li>IMAP Server: imap.zoho.com (Port 993, SSL)</li>
                        <li>SMTP Server: smtp.zoho.com (Port 465, SSL)</li>
                    </ul>

                    <p>Thanks for being a Diehard Premium member!</p>
                    <p>- PhillySports.com</p>
                    `
                );
            } catch (emailError) {
                console.error('Failed to send welcome email:', emailError);
                // Don't fail the request, email was still created
            }
        }

        return res.status(201).json({
            success: true,
            email: createResult.email,
            message: `Your email ${createResult.email} has been created! Check your inbox for login details.`,
            webmail: 'https://mail.zoho.com',
            temporaryPassword: emailPassword // Only shown once
        });

    } catch (error) {
        console.error('Claim email error:', error);
        return res.status(500).json({ error: 'Failed to claim email address' });
    }
}
