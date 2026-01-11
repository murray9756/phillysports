// Shop Products API
// GET: Browse site merchandise with filtering and pagination

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            category,
            team,
            productType,
            minPrice,
            maxPrice,
            currency = 'usd',
            search,
            featured,
            sort = 'newest',
            page = 1,
            limit = 24
        } = req.query;

        const products = await getCollection('shop_products');

        // Build query - only show active products
        const query = { status: 'active' };

        if (category) query.category = category;
        if (team) query.team = team;
        if (productType) query.productType = productType;
        if (featured === 'true') query.isFeatured = true;

        // Price filtering
        if (currency === 'usd') {
            if (minPrice) {
                query.priceUSD = { $gte: parseInt(minPrice) };
            }
            if (maxPrice) {
                query.priceUSD = { ...query.priceUSD, $lte: parseInt(maxPrice) };
            }
        } else if (currency === 'diehard_dollars') {
            query.priceDiehardDollars = { $ne: null };
            if (minPrice) {
                query.priceDiehardDollars = { $gte: parseInt(minPrice) };
            }
            if (maxPrice) {
                query.priceDiehardDollars = { ...query.priceDiehardDollars, $lte: parseInt(maxPrice) };
            }
        }

        // Text search
        if (search) {
            query.$text = { $search: search };
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
            case 'name_asc':
                sortOption = { name: 1 };
                break;
            case 'name_desc':
                sortOption = { name: -1 };
                break;
            case 'popular':
                sortOption = { salesCount: -1, createdAt: -1 };
                break;
            case 'newest':
            default:
                sortOption = { createdAt: -1 };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100);

        const [results, totalCount] = await Promise.all([
            products.find(query)
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            products.countDocuments(query)
        ]);

        // Format products for response
        const formattedProducts = results.map(product => ({
            _id: product._id.toString(),
            name: product.name,
            slug: product.slug,
            shortDescription: product.shortDescription,
            category: product.category,
            subcategory: product.subcategory,
            team: product.team,
            priceUSD: product.priceUSD,
            priceDiehardDollars: product.priceDiehardDollars,
            compareAtPrice: product.compareAtPrice,
            productType: product.productType,
            hasVariants: product.hasVariants,
            variants: product.variants?.map(v => ({
                _id: v._id.toString(),
                name: v.name,
                sku: v.sku,
                attributes: v.attributes,
                priceUSD: v.priceUSD,
                isAvailable: v.isAvailable && v.inventory > 0
            })),
            images: product.images,
            isFeatured: product.isFeatured,
            inStock: product.hasVariants
                ? product.variants?.some(v => v.inventory > 0)
                : product.inventory > 0 || product.inventory === -1
        }));

        res.status(200).json({
            success: true,
            products: formattedProducts,
            pagination: {
                page: parseInt(page),
                limit: limitNum,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to get products' });
    }
}
