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
            const { team, status, limit = 20 } = req.query;
            const posts = await getCollection('posts');

            const query = { status: 'published' };
            if (team) query.team = team;

            // If admin requests with status param, check auth
            if (req.query.status === 'all') {
                const decoded = await authenticate(req);
                if (decoded?.isAdmin) {
                    delete query.status;
                }
            }

            const results = await posts.find(query)
                .sort({ publishedAt: -1 })
                .limit(parseInt(limit))
                .toArray();

            res.status(200).json({
                posts: results.map(post => ({
                    ...post,
                    _id: post._id.toString(),
                    authorId: post.authorId?.toString()
                }))
            });
        } catch (error) {
            console.error('Get posts error:', error);
            res.status(500).json({ error: 'Failed to get posts' });
        }
        return;
    }

    if (req.method === 'POST') {
        try {
            const decoded = await authenticate(req);
            if (!decoded) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Check if user is admin
            const users = await getCollection('users');
            const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
            if (!user?.isAdmin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { title, content, excerpt, image, team, status = 'draft' } = req.body;

            if (!title || title.trim().length === 0) {
                return res.status(400).json({ error: 'Title is required' });
            }

            if (!content || content.trim().length === 0) {
                return res.status(400).json({ error: 'Content is required' });
            }

            const posts = await getCollection('posts');

            const newPost = {
                title: sanitizeString(title, 200),
                content: content, // Allow HTML for rich text
                excerpt: sanitizeString(excerpt || content.substring(0, 200), 300),
                image: image || null,
                team: team || null,
                status: status === 'published' ? 'published' : 'draft',
                authorId: new ObjectId(decoded.userId),
                authorName: user.displayName || user.username,
                publishedAt: status === 'published' ? new Date() : null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await posts.insertOne(newPost);
            newPost._id = result.insertedId;

            res.status(201).json({
                message: 'Post created',
                post: {
                    ...newPost,
                    _id: newPost._id.toString(),
                    authorId: newPost.authorId.toString()
                }
            });
        } catch (error) {
            console.error('Create post error:', error);
            res.status(500).json({ error: 'Failed to create post' });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}
