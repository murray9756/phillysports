// Forum Posts API
// GET /api/forums/posts - List posts
// POST /api/forums/posts - Create new post

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import {
    TEAMS,
    getUserInfo,
    validatePostContent,
    sanitizeContent,
    formatPost,
    awardPostCoins
} from '../../lib/community.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return handleGetPosts(req, res);
    }

    if (req.method === 'POST') {
        return handleCreatePost(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetPosts(req, res) {
    try {
        const {
            team,
            categoryId,
            authorId,
            page = 1,
            limit = 20,
            sort = 'recent' // recent, active, popular
        } = req.query;

        // Validate team if provided
        if (team && !TEAMS.includes(team)) {
            return res.status(400).json({ error: 'Invalid team' });
        }

        const posts = await getCollection('forum_posts');

        // Build query
        const query = { status: 'active' };
        if (team) query.team = team;
        if (categoryId) query.categoryId = new ObjectId(categoryId);
        if (authorId) query.authorId = new ObjectId(authorId);

        // Determine sort order
        let sortOrder = {};
        switch (sort) {
            case 'active':
                sortOrder = { isPinned: -1, lastReplyAt: -1 };
                break;
            case 'popular':
                sortOrder = { isPinned: -1, likeCount: -1, replyCount: -1 };
                break;
            case 'recent':
            default:
                sortOrder = { isPinned: -1, createdAt: -1 };
        }

        // Calculate pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Get total count
        const total = await posts.countDocuments(query);

        // Get posts with author info
        const results = await posts.aggregate([
            { $match: query },
            { $sort: sortOrder },
            { $skip: skip },
            { $limit: limitNum },
            {
                $lookup: {
                    from: 'users',
                    localField: 'authorId',
                    foreignField: '_id',
                    as: 'authorInfo'
                }
            },
            { $unwind: { path: '$authorInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();

        // Format posts
        const formatted = results.map(post => formatPost(post, {
            userId: post.authorId.toString(),
            username: post.authorInfo?.username || 'Unknown',
            displayName: post.authorInfo?.displayName || 'Unknown User',
            profilePhoto: post.authorInfo?.profilePhoto || null,
            favoriteTeam: post.authorInfo?.favoriteTeam || null
        }));

        return res.status(200).json({
            posts: formatted,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get posts error:', error);
        return res.status(500).json({ error: 'Failed to fetch posts' });
    }
}

async function handleCreatePost(req, res) {
    try {
        // Authenticate user
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { categoryId, title, content } = req.body;

        // Validate required fields
        if (!categoryId) {
            return res.status(400).json({ error: 'Category is required' });
        }

        // Validate content
        const errors = validatePostContent(title, content);
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        // Verify category exists
        const categories = await getCollection('forum_categories');
        const category = await categories.findOne({
            _id: new ObjectId(categoryId),
            isActive: true
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Rate limit: max 1 post per minute
        const posts = await getCollection('forum_posts');
        const recentPost = await posts.findOne({
            authorId: new ObjectId(auth.userId),
            createdAt: { $gte: new Date(Date.now() - 60000) }
        });

        if (recentPost) {
            return res.status(429).json({ error: 'Please wait before posting again' });
        }

        // Get author info
        const authorInfo = await getUserInfo(auth.userId);

        // Create post
        const now = new Date();
        const newPost = {
            categoryId: new ObjectId(categoryId),
            team: category.team,
            authorId: new ObjectId(auth.userId),
            authorUsername: authorInfo.username,
            authorDisplayName: authorInfo.displayName,
            authorProfilePhoto: authorInfo.profilePhoto,
            authorFavoriteTeam: authorInfo.favoriteTeam,
            title: sanitizeContent(title).substring(0, 200),
            content: sanitizeContent(content).substring(0, 10000),
            isPinned: false,
            isLocked: false,
            viewCount: 0,
            replyCount: 0,
            lastReplyAt: now,
            likes: [],
            likeCount: 0,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const result = await posts.insertOne(newPost);

        // Award coins for posting
        const reward = await awardPostCoins(auth.userId);

        return res.status(201).json({
            message: 'Post created successfully',
            post: formatPost({ ...newPost, _id: result.insertedId }, authorInfo),
            coinsAwarded: reward.awarded ? reward.amount : 0
        });

    } catch (error) {
        console.error('Create post error:', error);
        return res.status(500).json({ error: 'Failed to create post' });
    }
}
