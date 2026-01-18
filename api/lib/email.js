// Email utility using Zoho SMTP
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer');

// Zoho SMTP configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_PASSWORD
    }
});

export async function sendEmail({ to, subject, text, html }) {
    if (!process.env.ZOHO_EMAIL || !process.env.ZOHO_PASSWORD) {
        console.error('Zoho email credentials not configured');
        throw new Error('Email service not configured');
    }

    const mailOptions = {
        from: `PhillySports.com <${process.env.ZOHO_EMAIL}>`,
        to,
        subject,
        text,
        html
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent:', result.messageId);
        return result;
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
}

export async function sendPasswordResetEmail(email, resetToken, username) {
    const resetUrl = `${process.env.SITE_URL || 'https://www.phillysports.com'}/reset-password.html?token=${resetToken}`;

    const subject = 'Reset Your PhillySports.com Password';

    const text = `
Hi ${username},

You requested to reset your password for PhillySports.com.

Click this link to reset your password:
${resetUrl}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

- The PhillySports.com Team
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8b0000; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #8b0000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>PhillySports.com</h1>
        </div>
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${username},</p>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
            <p><strong>This link expires in 1 hour.</strong></p>
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 PhillySports.com. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

    return sendEmail({ to: email, subject, text, html });
}

export async function sendPasswordResetCode(email, code, username) {
    const subject = 'Your PhillySports.com Password Reset Code';

    const text = `
Hi ${username},

Your password reset code is: ${code}

This code expires in 10 minutes.

If you didn't request this, please ignore this email.

- The PhillySports.com Team
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8b0000; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: #fff; padding: 20px; border-radius: 8px; border: 2px dashed #8b0000; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>PhillySports.com</h1>
        </div>
        <div class="content">
            <h2>Password Reset Code</h2>
            <p>Hi ${username},</p>
            <p>Your password reset code is:</p>
            <div class="code">${code}</div>
            <p><strong>This code expires in 10 minutes.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 PhillySports.com. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

    return sendEmail({ to: email, subject, text, html });
}
