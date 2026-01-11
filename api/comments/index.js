import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { sanitizeString } from '../lib/validate.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            const { articleUrl, limit = 50 } = req.query;

            if (!articleUrl) {
                return res.status(400).json({ error: 'Article URL is required' });
            }

            const comments = await getCollection('comments');
            const users = await getCollection('users');

            const articleComments = await comments.find({ articleUrl })
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .toArray();

            const userIds = [...new Set(articleComments.map(c => c.userId.toString()))];
            const commentUsers = await users.find(
                { _id: { $in: userIds.map(id => new ObjectId(id)) } },
                { projection: { password: 0, email: 0, notifications: 0, savedArticles: 0 } }
            ).toArray();

            const userMap = {};
            commentUsers.forEach(u => {
                userMap[u._id.toString()] = {
                    _id: u._id.toString(),
                    username: u.username,
                    displayName: u.displayName,
                    profilePhoto: u.profilePhoto,
                    favoriteTeam: u.favoriteTeam
                };
            });

            const enrichedComments = articleComments.map(comment => ({
                ...comment,
                _id: comment._id.toString(),
                userId: comment.userId.toString(),
                user: userMap[comment.userId.toString()],
                likesCount: comment.likes?.length || 0
            }));

            res.status(200).json({ comments: enrichedComments });
        } catch (error) {
            console.error('Get comments error:', error);
            res.status(500).json({ error: 'Failed to get comments' });
        }
        return;
    }

    if (req.method === 'POST') {
        try {
            const decoded = await authenticate(req);
            if (!decoded) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { articleUrl, content } = req.body;

            if (!articleUrl) {
                return res.status(400).json({ error: 'Article URL is required' });
            }

            if (!content || content.trim().length === 0) {
                return res.status(400).json({ error: 'Comment content is required' });
            }

            if (content.length > 1000) {
                return res.status(400).json({ error: 'Comment must be 1000 characters or less' });
            }

            const comments = await getCollection('comments');
            const userId = new ObjectId(decoded.userId);

            const newComment = {
                userId,
                articleUrl,
                content: sanitizeString(content, 1000),
                likes: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await comments.insertOne(newComment);
            newComment._id = result.insertedId;

            const users = await getCollection('users');
            const user = await users.findOne(
                { _id: userId },
                { projection: { password: 0, email: 0, notifications: 0, savedArticles: 0 } }
            );

            res.status(201).json({
                message: 'Comment posted',
                comment: {
                    ...newComment,
                    _id: newComment._id.toString(),
                    userId: newComment.userId.toString(),
                    user: {
                        _id: user._id.toString(),
                        username: user.username,
                        displayName: user.displayName,
                        profilePhoto: user.profilePhoto,
                        favoriteTeam: user.favoriteTeam
                    },
                    likesCount: 0
                }
            });
        } catch (error) {
            console.error('Post comment error:', error);
            res.status(500).json({ error: 'Failed to post comment' });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}
