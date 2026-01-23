// Unified Marketplace API
// GET: Browse all products (eBay affiliate + user listings + raffles + curated tickets) with filtering

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
            source = 'all',  // 'all', 'ebay', 'user', 'raffles', 'tickets'
            category,
            team,
            condition,
            minPrice,
            maxPrice,
            currency = 'usd',
            search,
            sort = 'newest',
            page = 1,
            limit = 24
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100);

        let allItems = [];
        let ebayCount = 0;
        let userCount = 0;
        let raffleCount = 0;
        let ticketCount = 0;

        // Fetch eBay products if source is 'all' or 'ebay'
        if (source === 'all' || source === 'ebay') {
            const ebayItems = await fetchEbayProducts({
                category, team, condition, minPrice, maxPrice, currency, search
            });
            ebayCount = ebayItems.length;
            allItems = allItems.concat(ebayItems);
        }

        // Fetch user listings if source is 'all' or 'user'
        if (source === 'all' || source === 'user') {
            const userItems = await fetchUserListings({
                category, team, condition, minPrice, maxPrice, currency, search
            });
            userCount = userItems.length;
            allItems = allItems.concat(userItems);
        }

        // Fetch raffles if source is 'all' or 'raffles'
        if (source === 'all' || source === 'raffles') {
            const raffleItems = await fetchRaffles({
                team, search
            });
            raffleCount = raffleItems.length;
            allItems = allItems.concat(raffleItems);
        }

        // Fetch curated tickets if source is 'all' or 'tickets'
        if (source === 'all' || source === 'tickets') {
            const ticketItems = await fetchTicketListings({
                team, search, minPrice, maxPrice
            });
            ticketCount = ticketItems.length;
            allItems = allItems.concat(ticketItems);
        }

        // Sort combined results
        allItems = sortItems(allItems, sort, currency);

        // Get total before pagination
        const totalCount = allItems.length;

        // Paginate
        const paginatedItems = allItems.slice(skip, skip + limitNum);

        res.status(200).json({
            success: true,
            items: paginatedItems,
            counts: {
                ebay: ebayCount,
                user: userCount,
                raffles: raffleCount,
                tickets: ticketCount,
                total: totalCount
            },
            pagination: {
                page: parseInt(page),
                limit: limitNum,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });

    } catch (error) {
        console.error('Unified marketplace error:', error);
        res.status(500).json({ error: 'Failed to get items' });
    }
}

// Fetch eBay affiliate products from shop_products collection
async function fetchEbayProducts(filters) {
    const { category, team, condition, minPrice, maxPrice, currency, search } = filters;

    const products = await getCollection('shop_products');

    const query = {
        status: 'active',
        isAffiliate: true,
        affiliateSource: 'ebay'
    };

    // Map unified categories to shop_products categories
    if (category) {
        const categoryMap = {
            'apparel': 'apparel',
            'jerseys': 'apparel',
            'memorabilia': 'memorabilia',
            'cards': 'cards',
            'tickets': 'tickets',
            'other': 'other'
        };
        query.category = categoryMap[category] || category;
    }

    if (team) query.team = team;

    // eBay products have condition in ebayData
    if (condition) {
        query['ebayData.condition'] = { $regex: condition, $options: 'i' };
    }

    // Price filtering
    if (currency === 'usd' || currency === 'both') {
        if (minPrice) query.priceUSD = { $gte: parseInt(minPrice) * 100 };
        if (maxPrice) query.priceUSD = { ...query.priceUSD, $lte: parseInt(maxPrice) * 100 };
    }

    // Text search
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { shortDescription: { $regex: search, $options: 'i' } }
        ];
    }

    const results = await products.find(query).toArray();

    // Transform to unified format
    return results.map(product => ({
        _id: product._id.toString(),
        source: 'ebay',
        sourceType: 'affiliate',
        title: product.name,
        description: product.shortDescription || '',
        images: product.images || [],
        category: product.category,
        team: product.team,
        condition: product.ebayData?.condition || 'Unknown',
        priceUSD: product.priceUSD,
        priceDiehardDollars: null, // eBay products are USD only
        acceptsUSD: true,
        acceptsDiehardDollars: false,
        seller: {
            username: product.ebayData?.seller?.username || 'eBay Seller',
            isOfficial: false
        },
        affiliateLink: product.affiliateLink,
        externalProductId: product.externalProductId,
        inStock: true, // eBay items are assumed in stock
        quantity: 1,
        expiresAt: null,
        viewCount: product.viewCount || 0,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
    }));
}

// Fetch user listings from marketplace_listings collection
async function fetchUserListings(filters) {
    const { category, team, condition, minPrice, maxPrice, currency, search } = filters;

    const listings = await getCollection('marketplace_listings');

    const query = {
        moderationStatus: 'approved',
        status: 'active',
        expiresAt: { $gt: new Date() }
    };

    if (category) query.category = category;
    if (team) query.team = team;
    if (condition) query.condition = condition;

    // Price and currency filtering
    if (currency === 'usd') {
        query.acceptsUSD = true;
        if (minPrice) query.priceUSD = { $gte: parseInt(minPrice) * 100 };
        if (maxPrice) query.priceUSD = { ...query.priceUSD, $lte: parseInt(maxPrice) * 100 };
    } else if (currency === 'diehard_dollars') {
        query.acceptsDiehardDollars = true;
        if (minPrice) query.priceDiehardDollars = { $gte: parseInt(minPrice) };
        if (maxPrice) query.priceDiehardDollars = { ...query.priceDiehardDollars, $lte: parseInt(maxPrice) };
    }

    // Text search
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    const results = await listings.find(query).toArray();

    // Transform to unified format
    return results.map(listing => ({
        _id: listing._id.toString(),
        source: 'user',
        sourceType: 'listing',
        title: listing.title,
        description: listing.description?.substring(0, 200) || '',
        images: listing.images || [],
        category: listing.category,
        team: listing.team,
        condition: listing.condition,
        priceUSD: listing.priceUSD,
        priceDiehardDollars: listing.priceDiehardDollars,
        acceptsUSD: listing.acceptsUSD,
        acceptsDiehardDollars: listing.acceptsDiehardDollars,
        seller: {
            username: listing.sellerUsername,
            sellerId: listing.sellerId?.toString(),
            isOfficial: false
        },
        affiliateLink: null, // User listings don't have affiliate links
        inStock: listing.quantity > 0,
        quantity: listing.quantity,
        expiresAt: listing.expiresAt,
        viewCount: listing.viewCount || 0,
        favoriteCount: listing.favoriteCount || 0,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt
    }));
}

// Fetch active raffles from raffles collection
async function fetchRaffles(filters) {
    const { team, search } = filters;

    const raffles = await getCollection('raffles');

    const query = {
        status: 'active',
        drawDate: { $gt: new Date() }  // Only show raffles that haven't drawn yet
    };

    if (team) query.team = team;

    // Text search
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    const results = await raffles.find(query).toArray();

    // Transform to unified format
    return results.map(raffle => ({
        _id: raffle._id.toString(),
        source: 'raffle',
        sourceType: 'raffle',
        title: raffle.title,
        description: raffle.description?.substring(0, 200) || '',
        images: raffle.images || [],
        category: 'raffle',
        team: raffle.team,
        condition: null,
        priceUSD: null,
        priceDiehardDollars: raffle.ticketPrice || 10,  // Ticket price in DD
        acceptsUSD: false,
        acceptsDiehardDollars: true,
        seller: {
            username: 'PhillySports.com',
            isOfficial: true
        },
        affiliateLink: null,
        // Raffle-specific fields
        ticketPrice: raffle.ticketPrice || 10,
        estimatedValue: raffle.estimatedValue,
        totalTicketsSold: raffle.totalTicketsSold || 0,
        maxTicketsPerUser: raffle.maxTicketsPerUser,
        drawDate: raffle.drawDate,
        inStock: true,
        quantity: null,  // Unlimited tickets
        expiresAt: raffle.drawDate,  // Use draw date for "ending soon" sort
        viewCount: 0,
        createdAt: raffle.createdAt,
        updatedAt: raffle.updatedAt
    }));
}

// Fetch curated ticket listings from shop_products collection
async function fetchTicketListings(filters) {
    const { team, search, minPrice, maxPrice } = filters;

    const products = await getCollection('shop_products');

    const query = {
        category: 'tickets',
        status: 'active',
        'ticketData.status': 'available',
        'ticketData.eventDate': { $gt: new Date() }  // Only future events
    };

    if (team) query.team = team;

    // Price filtering (priceUSD is in cents)
    if (minPrice) query.priceUSD = { $gte: parseInt(minPrice) * 100 };
    if (maxPrice) query.priceUSD = { ...query.priceUSD, $lte: parseInt(maxPrice) * 100 };

    // Text search
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { 'ticketData.eventTitle': { $regex: search, $options: 'i' } },
            { 'ticketData.venue': { $regex: search, $options: 'i' } }
        ];
    }

    const results = await products.find(query)
        .sort({ 'ticketData.eventDate': 1 })  // Sort by event date
        .toArray();

    // Transform to unified format
    return results.map(ticket => ({
        _id: ticket._id.toString(),
        source: 'ticket',
        sourceType: 'curated',
        title: ticket.name,
        description: `${ticket.ticketData.eventTitle} at ${ticket.ticketData.venue}`,
        images: ticket.images || [],
        category: 'tickets',
        team: ticket.team,
        condition: null,
        priceUSD: ticket.priceUSD,
        priceDiehardDollars: null,
        acceptsUSD: true,
        acceptsDiehardDollars: false,
        seller: {
            username: 'PhillySports.com',
            isOfficial: true
        },
        affiliateLink: null,
        // Ticket-specific fields
        ticketData: {
            eventTitle: ticket.ticketData.eventTitle,
            eventDate: ticket.ticketData.eventDate,
            venue: ticket.ticketData.venue,
            city: ticket.ticketData.city,
            section: ticket.ticketData.section,
            row: ticket.ticketData.row,
            quantity: ticket.ticketData.quantity,
            pricePerTicket: ticket.ticketData.pricePerTicket,
            tier: ticket.ticketData.tier,
            source: ticket.ticketData.source,
            sourceUrl: ticket.ticketData.sourceUrl
        },
        inStock: true,
        quantity: ticket.ticketData.quantity,
        expiresAt: ticket.ticketData.eventDate,  // Expires at event time
        viewCount: 0,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
    }));
}

// Sort items based on sort option
function sortItems(items, sort, currency) {
    switch (sort) {
        case 'price_asc':
            return items.sort((a, b) => {
                const priceA = currency === 'diehard_dollars' ? (a.priceDiehardDollars || Infinity) : (a.priceUSD || Infinity);
                const priceB = currency === 'diehard_dollars' ? (b.priceDiehardDollars || Infinity) : (b.priceUSD || Infinity);
                return priceA - priceB;
            });
        case 'price_desc':
            return items.sort((a, b) => {
                const priceA = currency === 'diehard_dollars' ? (a.priceDiehardDollars || 0) : (a.priceUSD || 0);
                const priceB = currency === 'diehard_dollars' ? (b.priceDiehardDollars || 0) : (b.priceUSD || 0);
                return priceB - priceA;
            });
        case 'popular':
            return items.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        case 'ending':
            // User listings that expire soonest first, eBay items (no expiry) at the end
            return items.sort((a, b) => {
                if (!a.expiresAt && !b.expiresAt) return 0;
                if (!a.expiresAt) return 1;
                if (!b.expiresAt) return -1;
                return new Date(a.expiresAt) - new Date(b.expiresAt);
            });
        case 'newest':
        default:
            return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
}
