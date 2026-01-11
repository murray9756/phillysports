const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

// Hash password
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// Compare password with hash
async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Extract token from request (cookie or header)
function getTokenFromRequest(req) {
    // Check cookie first
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
        if (tokenCookie) {
            return tokenCookie.split('=')[1];
        }
    }

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return null;
}

// Authentication middleware for API routes
async function authenticate(req) {
    const token = getTokenFromRequest(req);
    if (!token) {
        return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return null;
    }

    return decoded;
}

// Set auth cookie
function setAuthCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
        `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`
    ]);
}

// Clear auth cookie
function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', [
        'auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    ]);
}

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
    getTokenFromRequest,
    authenticate,
    setAuthCookie,
    clearAuthCookie
};
