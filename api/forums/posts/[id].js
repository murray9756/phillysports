// Single Forum Post API
// GET /api/forums/posts/[id] - Get single post with replies
// PUT /api/forums/posts/[id] - Update post
// DELETE /api/forums/posts/[id] - Delete post

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import {
    validatePostContent,
    sanitizeContent,
    formatPost,
    formatReply
} from '../../lib/community.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid post ID' });
    }

    if (req.method === 'GET') {
        return handleGetPost(req, res, id);
    }

    if (req.method === 'PUT') {
        return handleUpdatePost(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleDeletePost(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetPost(req, res, postId) {
    try {
        const posts = await getCollection('forum_posts');

        // Get post with author info
        const results = await posts.aggregate([
            { $match: { _id: new ObjectId(postId), status: 'active' } },
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

        if (results.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = results[0];

        // Increment view count
        await posts.updateOne(
            { _id: new ObjectId(postId) },
            { $inc: { viewCount: 1 } }
        );

        // Get replies
        const replies = await getCollection('forum_replies');
        const replyResults = await replies.aggregate([
            { $match: { postId: new ObjectId(postId), status: 'active' } },
            { $sort: { createdAt: 1 } },
            { $limit: 100 },
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

        // Format post
        const formattedPost = formatPost(post, {
            userId: post.authorId.toString(),
            username: post.authorInfo?.username || 'Unknown',
            displayName: post.authorInfo?.displayName || 'Unknown User',
            profilePhoto: post.authorInfo?.profilePhoto || null,
            favoriteTeam: post.authorInfo?.favoriteTeam || null
        });

        // Format replies
        const formattedReplies = replyResults.map(reply => formatReply(reply, {
            userId: reply.authorId.toString(),
            username: reply.authorInfo?.username || 'Unknown',
            displayName: reply.authorInfo?.displayName || 'Unknown User',
            profilePhoto: reply.authorInfo?.profilePhoto || null,
            favoriteTeam: reply.authorInfo?.favoriteTeam || null
        }));

        // Get category info
        const categories = await getCollection('forum_categories');
        const category = await categories.findOne({ _id: post.categoryId });

        return res.status(200).json({
            post: formattedPost,
            replies: formattedReplies,
            category: category ? {
                id: category._id.toString(),
                name: category.name,
                slug: category.slug
            } : null
        });

    } catch (error) {
        console.error('Get post error:', error);
        return res.status(500).json({ error: 'Failed to fetch post' });
    }
}

async function handleUpdatePost(req, res, postId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const posts = await getCollection('forum_posts');
        const post = await posts.findOne({ _id: new ObjectId(postId), status: 'active' });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check ownership or admin
        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(auth.userId) });
        const isAdmin = user?.isAdmin || false;

        if (post.authorId.toString() !== auth.userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to edit this post' });
        }

        const { title, content } = req.body;

        // Validate content if provided
        if (title || content) {
            const errors = validatePostContent(
                title || post.title,
                content || post.content
            );
            if (errors.length > 0) {
                return res.status(400).json({ error: errors.join('. ') });
            }
        }

        // Build update
        const update = { updatedAt: new Date() };
        if (title) update.title = sanitizeContent(title).substring(0, 200);
        if (content) update.content = sanitizeContent(content).substring(0, 10000);

        await posts.updateOne(
            { _id: new ObjectId(postId) },
            { $set: update }
        );

        return res.status(200).json({ message: 'Post updated successfully' });

    } catch (error) {
        console.error('Update post error:', error);
        return res.status(500).json({ error: 'Failed to update post' });
    }
}

async function handleDeletePost(req, res, postId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const posts = await getCollection('forum_posts');
        const post = await posts.findOne({ _id: new ObjectId(postId), status: 'active' });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check ownership or admin
        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(auth.userId) });
        const isAdmin = user?.isAdmin || false;

        if (post.authorId.toString() !== auth.userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }

        // Soft delete
        await posts.updateOne(
            { _id: new ObjectId(postId) },
            { $set: { status: 'deleted', updatedAt: new Date() } }
        );

        // Also soft delete all replies
        const replies = await getCollection('forum_replies');
        await replies.updateMany(
            { postId: new ObjectId(postId) },
            { $set: { status: 'deleted' } }
        );

        return res.status(200).json({ message: 'Post deleted successfully' });

    } catch (error) {
        console.error('Delete post error:', error);
        return res.status(500).json({ error: 'Failed to delete post' });
    }
}
