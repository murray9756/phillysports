// Comment Delete API
// DELETE /api/comments/[id]/delete - Soft delete own comment

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id: commentId } = req.query;

        if (!commentId || !ObjectId.isValid(commentId)) {
            return res.status(400).json({ error: 'Invalid comment ID' });
        }

        const comments = await getCollection('comments');

        // Get comment
        const comment = await comments.findOne({
            _id: new ObjectId(commentId)
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check ownership
        if (comment.userId.toString() !== user.userId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        // Check if already deleted
        if (comment.status === 'deleted') {
            return res.status(400).json({ error: 'Comment already deleted' });
        }

        // Soft delete - keep comment for threading but mark as deleted
        await comments.updateOne(
            { _id: new ObjectId(commentId) },
            {
                $set: {
                    status: 'deleted',
                    content: '[deleted]',
                    deletedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        // Decrement parent's reply count if this is a reply
        if (comment.parentId) {
            await comments.updateOne(
                { _id: comment.parentId },
                { $inc: { replyCount: -1 } }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Comment deleted'
        });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
}
