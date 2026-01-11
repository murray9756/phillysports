// Admin Marketplace Pending Listings API
// GET: Get all listings pending moderation

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

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
        // Authenticate and verify admin
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { page = 1, limit = 20, status = 'pending' } = req.query;

        const listings = await getCollection('marketplace_listings');

        // Build query
        const query = {};
        if (status === 'pending') {
            query.moderationStatus = 'pending';
        } else if (status === 'flagged') {
            query.moderationStatus = 'flagged';
        } else if (status === 'all') {
            // No filter - show all
        } else {
            query.moderationStatus = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100);

        const [results, totalCount] = await Promise.all([
            listings.find(query)
                .sort({ createdAt: 1 }) // Oldest first (FIFO)
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            listings.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            listings: results.map(listing => ({
                _id: listing._id.toString(),
                sellerId: listing.sellerId.toString(),
                sellerUsername: listing.sellerUsername,
                title: listing.title,
                description: listing.description,
                category: listing.category,
                team: listing.team,
                condition: listing.condition,
                productType: listing.productType,
                acceptsUSD: listing.acceptsUSD,
                acceptsDiehardDollars: listing.acceptsDiehardDollars,
                priceUSD: listing.priceUSD,
                priceDiehardDollars: listing.priceDiehardDollars,
                quantity: listing.quantity,
                shippingInfo: listing.shippingInfo,
                digitalDelivery: listing.digitalDelivery,
                images: listing.images,
                moderationStatus: listing.moderationStatus,
                moderationNotes: listing.moderationNotes,
                status: listing.status,
                createdAt: listing.createdAt
            })),
            pagination: {
                page: parseInt(page),
                limit: limitNum,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            },
            counts: {
                pending: await listings.countDocuments({ moderationStatus: 'pending' }),
                flagged: await listings.countDocuments({ moderationStatus: 'flagged' }),
                approved: await listings.countDocuments({ moderationStatus: 'approved' }),
                rejected: await listings.countDocuments({ moderationStatus: 'rejected' })
            }
        });
    } catch (error) {
        console.error('Get pending listings error:', error);
        res.status(500).json({ error: 'Failed to get pending listings' });
    }
}
