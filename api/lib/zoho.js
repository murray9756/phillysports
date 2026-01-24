// Zoho Mail API integration for @phillysports.com email addresses
// Docs: https://www.zoho.com/mail/help/api/

const ZOHO_CONFIG = {
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    refreshToken: process.env.ZOHO_REFRESH_TOKEN,
    orgId: process.env.ZOHO_ORG_ID,
    domain: 'phillysports.com',
    accountsUrl: 'https://accounts.zoho.com',
    mailAdminUrl: 'https://mail.zoho.com/api/organization'
};

let accessToken = null;
let tokenExpiry = null;

// Get a valid access token (refresh if needed)
async function getAccessToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
        return accessToken;
    }

    const params = new URLSearchParams({
        refresh_token: ZOHO_CONFIG.refreshToken,
        client_id: ZOHO_CONFIG.clientId,
        client_secret: ZOHO_CONFIG.clientSecret,
        grant_type: 'refresh_token'
    });

    const response = await fetch(`${ZOHO_CONFIG.accountsUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Zoho token refresh failed:', error);
        throw new Error('Failed to refresh Zoho access token');
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    return accessToken;
}

// Make an authenticated request to Zoho Mail Admin API
async function zohoRequest(endpoint, method = 'GET', body = null) {
    const token = await getAccessToken();

    const options = {
        method,
        headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const url = `${ZOHO_CONFIG.mailAdminUrl}/${ZOHO_CONFIG.orgId}${endpoint}`;
    const response = await fetch(url, options);

    const data = await response.json();

    if (!response.ok) {
        console.error('Zoho API error:', data);
        throw new Error(data.data?.message || 'Zoho API request failed');
    }

    return data;
}

// Check if an email address is available
export async function isEmailAvailable(emailPrefix) {
    const email = `${emailPrefix.toLowerCase()}@${ZOHO_CONFIG.domain}`;

    try {
        // Try to get user details - if it fails, email is available
        const result = await zohoRequest(`/accounts/${email}`);
        // If we get here, the email exists
        return { available: false, email };
    } catch (error) {
        // Email doesn't exist, so it's available
        return { available: true, email };
    }
}

// Create a new email account
export async function createEmailAccount(emailPrefix, displayName, password) {
    const email = `${emailPrefix.toLowerCase()}@${ZOHO_CONFIG.domain}`;

    const userData = {
        primaryEmailAddress: email,
        displayName: displayName,
        password: password,
        userType: 'member', // or 'admin'
        role: 'member',
        country: 'us',
        language: 'en'
    };

    try {
        const result = await zohoRequest('/accounts', 'POST', userData);
        return {
            success: true,
            email,
            accountId: result.data?.accountId,
            message: `Email ${email} created successfully`
        };
    } catch (error) {
        console.error('Create email error:', error);
        return {
            success: false,
            email,
            error: error.message
        };
    }
}

// Delete an email account
export async function deleteEmailAccount(emailPrefix) {
    const email = `${emailPrefix.toLowerCase()}@${ZOHO_CONFIG.domain}`;

    try {
        await zohoRequest(`/accounts/${email}`, 'DELETE');
        return { success: true, email };
    } catch (error) {
        console.error('Delete email error:', error);
        return { success: false, email, error: error.message };
    }
}

// Get email account details
export async function getEmailAccount(emailPrefix) {
    const email = `${emailPrefix.toLowerCase()}@${ZOHO_CONFIG.domain}`;

    try {
        const result = await zohoRequest(`/accounts/${email}`);
        return {
            exists: true,
            email,
            accountId: result.data?.accountId,
            displayName: result.data?.displayName,
            status: result.data?.accountStatus
        };
    } catch (error) {
        return { exists: false, email };
    }
}

// Reset password for an email account
export async function resetEmailPassword(emailPrefix, newPassword) {
    const email = `${emailPrefix.toLowerCase()}@${ZOHO_CONFIG.domain}`;

    try {
        await zohoRequest(`/accounts/${email}`, 'PUT', {
            password: newPassword,
            isPasswordResetRequired: false
        });
        return { success: true, email };
    } catch (error) {
        console.error('Reset password error:', error);
        return { success: false, email, error: error.message };
    }
}

// Generate a secure random password
export function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Validate email prefix (only alphanumeric, dots, underscores, hyphens)
export function validateEmailPrefix(prefix) {
    if (!prefix || prefix.length < 3 || prefix.length > 30) {
        return { valid: false, error: 'Email prefix must be 3-30 characters' };
    }

    // Only allow alphanumeric, dots, underscores, hyphens
    // Must start and end with alphanumeric
    const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
    if (!validPattern.test(prefix)) {
        return { valid: false, error: 'Email can only contain letters, numbers, dots, underscores, and hyphens' };
    }

    // No consecutive dots
    if (prefix.includes('..')) {
        return { valid: false, error: 'Email cannot contain consecutive dots' };
    }

    // Reserved prefixes
    const reserved = ['admin', 'support', 'help', 'info', 'contact', 'noreply', 'no-reply',
                      'postmaster', 'webmaster', 'abuse', 'sales', 'team', 'hello', 'mail'];
    if (reserved.includes(prefix.toLowerCase())) {
        return { valid: false, error: 'This email prefix is reserved' };
    }

    return { valid: true };
}

export default {
    isEmailAvailable,
    createEmailAccount,
    deleteEmailAccount,
    getEmailAccount,
    resetEmailPassword,
    generatePassword,
    validateEmailPrefix
};
