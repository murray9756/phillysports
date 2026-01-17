import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT_SECRET is required - no fallback for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('WARNING: JWT_SECRET not set. Using insecure default for development only.');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-insecure-key-do-not-use-in-production';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

export async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

export function generateToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email,
            username: user.username
        },
        EFFECTIVE_JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, EFFECTIVE_JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export function getTokenFromRequest(req) {
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
        if (tokenCookie) {
            return tokenCookie.split('=')[1];
        }
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return null;
}

export async function authenticate(req) {
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

export function setAuthCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
        `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`
    ]);
}

export function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', [
        'auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    ]);
}
