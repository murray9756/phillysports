// SMS utility using Twilio
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let twilioClient = null;

function getTwilioClient() {
    if (twilioClient) return twilioClient;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
    }

    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
}

export async function sendSMS({ to, message }) {
    if (!process.env.TWILIO_PHONE_NUMBER) {
        throw new Error('Twilio phone number not configured');
    }

    const client = getTwilioClient();

    // Normalize phone number (ensure it has country code)
    let phoneNumber = to.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
        phoneNumber = '1' + phoneNumber; // Add US country code
    }
    if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber;
    }

    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });
        console.log('SMS sent:', result.sid);
        return result;
    } catch (error) {
        console.error('SMS send error:', error);
        throw error;
    }
}

export async function sendPasswordResetSMS(phoneNumber, code) {
    const message = `Your PhillySports.com password reset code is: ${code}. This code expires in 10 minutes.`;
    return sendSMS({ to: phoneNumber, message });
}

export async function sendVerificationSMS(phoneNumber, code) {
    const message = `Your PhillySports.com verification code is: ${code}. This code expires in 10 minutes.`;
    return sendSMS({ to: phoneNumber, message });
}
