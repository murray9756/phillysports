// My Listings API
// GET: Get user's own marketplace listings

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const {
            status, // 'all', 'pending', 'active', 'sold', 'expired', 'rejected'
            page = 1,
            limit = 20
        } = req.query;

        const listings = await getCollection('marketplace_listings');

        // Build query
        const query = {
            sellerId: new ObjectId(decoded.userId)
        };

        if (status && status !== 'all') {
            if (status === 'pending') {
                query.moderationStatus = 'pending';
            } else if (status === 'active') {
                query.moderationStatus = 'approved';
                query.status = 'active';
            } else if (status === 'sold') {
                query.status = 'sold';
            } else if (status === 'expired') {
                query.$or = [
                    { status: 'expired' },
                    { expiresAt: { $lt: new Date() }, status: 'active' }
                ];
            } else if (status === 'rejected') {
                query.moderationStatus = 'rejected';
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 50);

        const [results, totalCount] = await Promise.all([
            listings.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            listings.countDocuments(query)
        ]);

        // Get counts by status
        const [pendingCount, activeCount, soldCount, rejectedCount] = await Promise.all([
            listings.countDocuments({ sellerId: new ObjectId(decoded.userId), moderationStatus: 'pending' }),
            listings.countDocuments({ sellerId: new ObjectId(decoded.userId), moderationStatus: 'approved', status: 'active', expiresAt: { $gt: new Date() } }),
            listings.countDocuments({ sellerId: new ObjectId(decoded.userId), status: 'sold' }),
            listings.countDocuments({ sellerId: new ObjectId(decoded.userId), moderationStatus: 'rejected' })
        ]);

        res.status(200).json({
            success: true,
            listings: results.map(listing => ({
                _id: listing._id.toString(),
                title: listing.title,
                category: listing.category,
                team: listing.team,
                condition: listing.condition,
                productType: listing.productType,
                acceptsUSD: listing.acceptsUSD,
                acceptsDiehardDollars: listing.acceptsDiehardDollars,
                priceUSD: listing.priceUSD,
                priceDiehardDollars: listing.priceDiehardDollars,
                quantity: listing.quantity,
                quantitySold: listing.quantitySold,
                images: listing.images,
                moderationStatus: listing.moderationStatus,
                moderationNotes: listing.moderationNotes,
                status: listing.status,
                expiresAt: listing.expiresAt,
                viewCount: listing.viewCount,
                favoriteCount: listing.favoriteCount,
                createdAt: listing.createdAt,
                publishedAt: listing.publishedAt,
                isExpired: listing.expiresAt && new Date(listing.expiresAt) < new Date()
            })),
            counts: {
                pending: pendingCount,
                active: activeCount,
                sold: soldCount,
                rejected: rejectedCount,
                total: pendingCount + activeCount + soldCount + rejectedCount
            },
            pagination: {
                page: parseInt(page),
                limit: limitNum,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    } catch (error) {
        console.error('Get my listings error:', error);
        res.status(500).json({ error: 'Failed to get listings' });
    }
}
