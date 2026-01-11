// Marketplace Listings API
// GET: Browse approved listings with filtering
// POST: Create new listing (requires auth, pending approval)

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { validateListing } from '../lib/marketplace/validate.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET - Browse listings (public)
    if (req.method === 'GET') {
        try {
            const {
                category,
                team,
                condition,
                productType,
                minPrice,
                maxPrice,
                currency = 'usd',
                search,
                sellerId,
                sort = 'newest',
                page = 1,
                limit = 24
            } = req.query;

            const listings = await getCollection('marketplace_listings');

            // Build query - only show approved, active listings (unless filtering by seller)
            const query = {
                moderationStatus: 'approved',
                status: 'active',
                expiresAt: { $gt: new Date() }
            };

            // If filtering by seller, show all their listings regardless of status
            if (sellerId) {
                delete query.moderationStatus;
                delete query.status;
                delete query.expiresAt;
                query.sellerId = new ObjectId(sellerId);
            }

            if (category) query.category = category;
            if (team) query.team = team;
            if (condition) query.condition = condition;
            if (productType) query.productType = productType;

            // Price filtering based on currency
            if (currency === 'usd') {
                query.acceptsUSD = true;
                if (minPrice) {
                    query.priceUSD = { $gte: parseInt(minPrice) };
                }
                if (maxPrice) {
                    query.priceUSD = { ...query.priceUSD, $lte: parseInt(maxPrice) };
                }
            } else if (currency === 'diehard_dollars') {
                query.acceptsDiehardDollars = true;
                if (minPrice) {
                    query.priceDiehardDollars = { $gte: parseInt(minPrice) };
                }
                if (maxPrice) {
                    query.priceDiehardDollars = { ...query.priceDiehardDollars, $lte: parseInt(maxPrice) };
                }
            }

            // Text search
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Sorting
            let sortOption = { createdAt: -1 };
            switch (sort) {
                case 'price_asc':
                    sortOption = { priceUSD: 1 };
                    break;
                case 'price_desc':
                    sortOption = { priceUSD: -1 };
                    break;
                case 'popular':
                    sortOption = { viewCount: -1, createdAt: -1 };
                    break;
                case 'ending':
                    sortOption = { expiresAt: 1 };
                    break;
                case 'newest':
                default:
                    sortOption = { createdAt: -1 };
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const limitNum = Math.min(parseInt(limit), 100);

            const [results, totalCount] = await Promise.all([
                listings.find(query)
                    .sort(sortOption)
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
                    description: listing.description.substring(0, 200) + (listing.description.length > 200 ? '...' : ''),
                    category: listing.category,
                    team: listing.team,
                    condition: listing.condition,
                    productType: listing.productType,
                    acceptsUSD: listing.acceptsUSD,
                    acceptsDiehardDollars: listing.acceptsDiehardDollars,
                    priceUSD: listing.priceUSD,
                    priceDiehardDollars: listing.priceDiehardDollars,
                    quantity: listing.quantity,
                    images: listing.images,
                    moderationStatus: listing.moderationStatus,
                    status: listing.status,
                    expiresAt: listing.expiresAt,
                    viewCount: listing.viewCount,
                    favoriteCount: listing.favoriteCount,
                    createdAt: listing.createdAt
                })),
                pagination: {
                    page: parseInt(page),
                    limit: limitNum,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limitNum)
                }
            });
        } catch (error) {
            console.error('Get listings error:', error);
            res.status(500).json({ error: 'Failed to get listings' });
        }
        return;
    }

    // POST - Create listing (requires auth)
    if (req.method === 'POST') {
        try {
            const decoded = await authenticate(req);
            if (!decoded) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Validate listing data
            const validation = validateListing(req.body);
            if (!validation.isValid) {
                return res.status(400).json({
                    error: validation.errors[0],
                    errors: validation.errors
                });
            }

            const users = await getCollection('users');
            const listings = await getCollection('marketplace_listings');

            const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const {
                title,
                description,
                category,
                team,
                condition,
                productType,
                acceptsUSD,
                acceptsDiehardDollars,
                priceUSD,
                priceDiehardDollars,
                quantity,
                shippingInfo,
                digitalDelivery,
                images
            } = req.body;

            // Sanitize text inputs
            const sanitize = (str, maxLen) => {
                if (!str) return '';
                return str.trim().substring(0, maxLen);
            };

            const newListing = {
                sellerId: new ObjectId(decoded.userId),
                sellerUsername: user.username,
                title: sanitize(title, 200),
                description: sanitize(description, 5000),
                category,
                team: team || null,
                condition,
                productType,
                acceptsUSD: Boolean(acceptsUSD),
                acceptsDiehardDollars: Boolean(acceptsDiehardDollars),
                priceUSD: acceptsUSD ? parseInt(priceUSD) : null,
                priceDiehardDollars: acceptsDiehardDollars ? parseInt(priceDiehardDollars) : null,
                quantity: parseInt(quantity) || 1,
                quantitySold: 0,
                shippingInfo: productType === 'physical' ? {
                    shipsFrom: shippingInfo?.shipsFrom || '',
                    handlingTime: parseInt(shippingInfo?.handlingTime) || 3,
                    shippingOptions: shippingInfo?.shippingOptions || [{
                        method: 'standard',
                        priceUSD: 599,
                        estimatedDays: '5-7'
                    }]
                } : null,
                digitalDelivery: productType === 'digital' ? {
                    type: digitalDelivery?.type || 'email',
                    description: digitalDelivery?.description || ''
                } : null,
                images: (images || []).slice(0, 8).map(img => ({
                    url: img.url,
                    isPrimary: img.isPrimary || false
                })),
                moderationStatus: 'pending',
                moderationNotes: null,
                moderatedBy: null,
                moderatedAt: null,
                status: 'active',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                viewCount: 0,
                favoriteCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                publishedAt: null
            };

            const result = await listings.insertOne(newListing);
            newListing._id = result.insertedId;

            res.status(201).json({
                success: true,
                message: 'Listing created and pending approval. You will be notified when it goes live.',
                listing: {
                    _id: newListing._id.toString(),
                    sellerId: newListing.sellerId.toString(),
                    title: newListing.title,
                    moderationStatus: newListing.moderationStatus,
                    createdAt: newListing.createdAt
                }
            });
        } catch (error) {
            console.error('Create listing error:', error);
            res.status(500).json({ error: 'Failed to create listing' });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}
