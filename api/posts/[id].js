import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { sanitizeString } from '../lib/validate.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Valid post ID is required' });
    }

    const posts = await getCollection('posts');
    const postId = new ObjectId(id);

    if (req.method === 'GET') {
        try {
            const post = await posts.findOne({ _id: postId });

            if (!post) {
                return res.status(404).json({ error: 'Post not found' });
            }

            // If post is draft, only admin can view
            if (post.status === 'draft') {
                const decoded = await authenticate(req);
                const users = await getCollection('users');
                const user = decoded ? await users.findOne({ _id: new ObjectId(decoded.userId) }) : null;
                if (!user?.isAdmin) {
                    return res.status(404).json({ error: 'Post not found' });
                }
            }

            res.status(200).json({
                post: {
                    ...post,
                    _id: post._id.toString(),
                    authorId: post.authorId?.toString()
                }
            });
        } catch (error) {
            console.error('Get post error:', error);
            res.status(500).json({ error: 'Failed to get post' });
        }
        return;
    }

    // PUT and DELETE require admin auth
    const decoded = await authenticate(req);
    if (!decoded) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const users = await getCollection('users');
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
    if (!user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    if (req.method === 'PUT') {
        try {
            const { title, content, excerpt, image, team, status } = req.body;

            const existingPost = await posts.findOne({ _id: postId });
            if (!existingPost) {
                return res.status(404).json({ error: 'Post not found' });
            }

            const updateData = { updatedAt: new Date() };

            if (title !== undefined) updateData.title = sanitizeString(title, 200);
            if (content !== undefined) updateData.content = content;
            if (excerpt !== undefined) updateData.excerpt = sanitizeString(excerpt, 300);
            if (image !== undefined) updateData.image = image || null;
            if (team !== undefined) updateData.team = team || null;
            if (status !== undefined) {
                updateData.status = status === 'published' ? 'published' : 'draft';
                // Set publishedAt when first published
                if (status === 'published' && !existingPost.publishedAt) {
                    updateData.publishedAt = new Date();
                }
            }

            await posts.updateOne({ _id: postId }, { $set: updateData });

            const updatedPost = await posts.findOne({ _id: postId });

            res.status(200).json({
                message: 'Post updated',
                post: {
                    ...updatedPost,
                    _id: updatedPost._id.toString(),
                    authorId: updatedPost.authorId?.toString()
                }
            });
        } catch (error) {
            console.error('Update post error:', error);
            res.status(500).json({ error: 'Failed to update post' });
        }
        return;
    }

    if (req.method === 'DELETE') {
        try {
            const result = await posts.deleteOne({ _id: postId });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Post not found' });
            }

            res.status(200).json({ message: 'Post deleted' });
        } catch (error) {
            console.error('Delete post error:', error);
            res.status(500).json({ error: 'Failed to delete post' });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}
