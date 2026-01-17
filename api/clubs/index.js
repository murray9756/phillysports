// Fan Clubs API
// GET /api/clubs - List clubs
// POST /api/clubs - Create new club

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { getUserInfo } from '../lib/community.js';
import {
    generateSlug,
    validateClubData,
    formatClub,
    awardClubCreateCoins,
    CLUB_TYPES
} from '../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return handleGetClubs(req, res);
    }

    if (req.method === 'POST') {
        return handleCreateClub(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetClubs(req, res) {
    try {
        const {
            team,
            type,
            search,
            featured,
            page = 1,
            limit = 20,
            sort = 'popular' // popular, recent, name
        } = req.query;

        const clubs = await getCollection('fan_clubs');

        // Build query
        const query = {};
        if (team && team !== 'all') query.team = team;
        if (type && CLUB_TYPES.includes(type)) query.type = type;
        if (featured === 'true') query.isFeatured = true;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Determine sort order
        let sortOrder = {};
        switch (sort) {
            case 'recent':
                sortOrder = { createdAt: -1 };
                break;
            case 'name':
                sortOrder = { name: 1 };
                break;
            case 'popular':
            default:
                sortOrder = { isFeatured: -1, memberCount: -1, createdAt: -1 };
        }

        // Calculate pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Get total count
        const total = await clubs.countDocuments(query);

        // Get clubs with owner info
        const results = await clubs.aggregate([
            { $match: query },
            { $sort: sortOrder },
            { $skip: skip },
            { $limit: limitNum },
            {
                $lookup: {
                    from: 'users',
                    localField: 'ownerId',
                    foreignField: '_id',
                    as: 'ownerInfo'
                }
            },
            { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();

        // Format clubs
        const formatted = results.map(club => ({
            ...formatClub(club),
            owner: club.ownerInfo ? {
                userId: club.ownerInfo._id.toString(),
                username: club.ownerInfo.username,
                displayName: club.ownerInfo.displayName,
                profilePhoto: club.ownerInfo.profilePhoto
            } : null
        }));

        return res.status(200).json({
            success: true,
            clubs: formatted,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get clubs error:', error);
        return res.status(500).json({ error: 'Failed to fetch clubs' });
    }
}

async function handleCreateClub(req, res) {
    try {
        // Authenticate user
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { name, description, team, type, tags, socialLinks } = req.body;

        // Validate input
        const errors = validateClubData({ name, description, team, type });
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        const clubs = await getCollection('fan_clubs');

        // Generate slug and check for duplicates
        let slug = generateSlug(name);
        let slugExists = await clubs.findOne({ slug });
        let counter = 1;
        while (slugExists) {
            slug = `${generateSlug(name)}-${counter}`;
            slugExists = await clubs.findOne({ slug });
            counter++;
        }

        // Rate limit: max 3 clubs per user
        const userClubCount = await clubs.countDocuments({
            ownerId: new ObjectId(auth.userId)
        });

        if (userClubCount >= 3) {
            return res.status(400).json({ error: 'You can only create up to 3 clubs' });
        }

        // Get creator info
        const userInfo = await getUserInfo(auth.userId);

        // Create club
        const now = new Date();
        const newClub = {
            name: name.trim(),
            slug,
            description: description?.trim().substring(0, 500) || '',
            team: team || 'all',
            type: type || 'public',
            coverImage: null,
            logoImage: null,
            ownerId: new ObjectId(auth.userId),
            admins: [new ObjectId(auth.userId)],
            members: [{
                userId: new ObjectId(auth.userId),
                username: userInfo.username,
                displayName: userInfo.displayName,
                profilePhoto: userInfo.profilePhoto,
                role: 'owner',
                joinedAt: now,
                status: 'active'
            }],
            memberCount: 1,
            maxMembers: null,
            settings: {
                allowMemberEvents: true,
                requireApproval: type === 'private',
                allowInvites: true
            },
            tags: Array.isArray(tags) ? tags.slice(0, 10).map(t => t.toLowerCase().trim()) : [],
            socialLinks: {
                facebook: socialLinks?.facebook || null,
                twitter: socialLinks?.twitter || null,
                instagram: socialLinks?.instagram || null,
                discord: socialLinks?.discord || null
            },
            stats: {
                eventsHosted: 0,
                watchPartiesHosted: 0,
                tailgatesHosted: 0
            },
            isVerified: false,
            isFeatured: false,
            createdAt: now,
            updatedAt: now
        };

        const result = await clubs.insertOne(newClub);

        // Award coins for creating club
        const reward = await awardClubCreateCoins(auth.userId);

        return res.status(201).json({
            success: true,
            message: 'Club created successfully',
            club: {
                ...formatClub({ ...newClub, _id: result.insertedId }),
                owner: {
                    userId: auth.userId,
                    username: userInfo.username,
                    displayName: userInfo.displayName,
                    profilePhoto: userInfo.profilePhoto
                }
            },
            coinsAwarded: reward.amount
        });

    } catch (error) {
        console.error('Create club error:', error);
        return res.status(500).json({ error: 'Failed to create club' });
    }
}
