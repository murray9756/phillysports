// Rate Limiting Library
// Uses MongoDB to track request counts with sliding window algorithm

import { getCollection } from './mongodb.js';

// Default rate limit configurations
const RATE_LIMITS = {
    // Auth endpoints - strict limits to prevent brute force
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10,
        message: 'Too many attempts. Please try again in 15 minutes.'
    },
    // Password reset - very strict
    passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        message: 'Too many password reset attempts. Please try again in an hour.'
    },
    // API endpoints - general limit
    api: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60,
        message: 'Too many requests. Please slow down.'
    },
    // Sensitive actions (payments, transfers)
    sensitive: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 20,
        message: 'Rate limit exceeded for sensitive operations.'
    },
    // Search/scraping protection
    search: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30,
        message: 'Too many search requests. Please slow down.'
    }
};

/**
 * Get client identifier from request
 * Uses IP address, falling back to user ID if authenticated
 */
function getClientIdentifier(req, userId = null) {
    // Try to get real IP from various headers (Vercel/Cloudflare/proxy)
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const cfConnectingIp = req.headers['cf-connecting-ip'];

    const ip = cfConnectingIp ||
               (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
               realIp ||
               req.socket?.remoteAddress ||
               'unknown';

    // If user is authenticated, combine IP with userId for more precise limiting
    if (userId) {
        return `${ip}:${userId}`;
    }

    return ip;
}

/**
 * Check rate limit for a request
 * @param {string} identifier - Client identifier (IP or IP:userId)
 * @param {string} endpoint - Endpoint path or category
 * @param {string} limitType - Type of rate limit to apply (auth, api, sensitive, etc.)
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date, retryAfter: number}>}
 */
export async function checkRateLimit(identifier, endpoint, limitType = 'api') {
    const config = RATE_LIMITS[limitType] || RATE_LIMITS.api;
    const { windowMs, maxRequests } = config;

    const rateLimits = await getCollection('rate_limits');
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // Create a unique key for this identifier + endpoint combination
    const key = `${identifier}:${endpoint}`;

    // Find existing rate limit record
    const record = await rateLimits.findOne({ key });

    if (!record) {
        // First request - create new record
        await rateLimits.insertOne({
            key,
            identifier,
            endpoint,
            requests: [now],
            createdAt: now,
            expiresAt: new Date(now.getTime() + windowMs)
        });

        return {
            allowed: true,
            remaining: maxRequests - 1,
            resetAt: new Date(now.getTime() + windowMs),
            retryAfter: 0
        };
    }

    // Filter requests within the current window
    const recentRequests = record.requests.filter(
        timestamp => new Date(timestamp) > windowStart
    );

    if (recentRequests.length >= maxRequests) {
        // Rate limit exceeded
        const oldestRequest = new Date(Math.min(...recentRequests.map(r => new Date(r).getTime())));
        const resetAt = new Date(oldestRequest.getTime() + windowMs);
        const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);

        return {
            allowed: false,
            remaining: 0,
            resetAt,
            retryAfter,
            message: config.message
        };
    }

    // Add new request and update record
    recentRequests.push(now);

    await rateLimits.updateOne(
        { key },
        {
            $set: {
                requests: recentRequests,
                expiresAt: new Date(now.getTime() + windowMs)
            }
        }
    );

    return {
        allowed: true,
        remaining: maxRequests - recentRequests.length,
        resetAt: new Date(now.getTime() + windowMs),
        retryAfter: 0
    };
}

/**
 * Rate limit middleware for API handlers
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 * @param {string} limitType - Type of rate limit to apply
 * @param {string} userId - Optional user ID for authenticated requests
 * @returns {Promise<boolean>} - Returns true if request is allowed, false if rate limited
 */
export async function rateLimit(req, res, limitType = 'api', userId = null) {
    try {
        const identifier = getClientIdentifier(req, userId);
        const endpoint = req.url?.split('?')[0] || '/unknown';

        const result = await checkRateLimit(identifier, endpoint, limitType);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', RATE_LIMITS[limitType]?.maxRequests || 60);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

        if (!result.allowed) {
            res.setHeader('Retry-After', result.retryAfter);
            res.status(429).json({
                error: result.message,
                retryAfter: result.retryAfter
            });
            return false;
        }

        return true;
    } catch (error) {
        // Log error but don't block request if rate limiting fails
        console.error('Rate limit check failed:', error);
        return true;
    }
}

/**
 * Create TTL index for automatic cleanup of old rate limit records
 * Call this once during app initialization
 */
export async function setupRateLimitIndexes() {
    try {
        const rateLimits = await getCollection('rate_limits');

        // Create TTL index to automatically delete expired records
        await rateLimits.createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0 }
        );

        // Create index for faster lookups
        await rateLimits.createIndex({ key: 1 }, { unique: true });

        console.log('Rate limit indexes created successfully');
    } catch (error) {
        // Index might already exist
        if (error.code !== 85) { // 85 = IndexOptionsConflict (already exists)
            console.error('Failed to create rate limit indexes:', error);
        }
    }
}

export { RATE_LIMITS };
