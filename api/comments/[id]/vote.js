// Comment Vote API
// POST /api/comments/[id]/vote - Upvote or downvote a comment

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id: commentId } = req.query;
        const { vote } = req.body;

        if (!commentId || !ObjectId.isValid(commentId)) {
            return res.status(400).json({ error: 'Invalid comment ID' });
        }

        if (vote !== 1 && vote !== -1 && vote !== 0) {
            return res.status(400).json({ error: 'Vote must be 1, -1, or 0' });
        }

        const comments = await getCollection('comments');
        const votesCollection = await getCollection('content_votes');

        // Check comment exists
        const comment = await comments.findOne({
            _id: new ObjectId(commentId),
            status: { $ne: 'deleted' }
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const userId = new ObjectId(user.userId);
        const commentIdObj = new ObjectId(commentId);

        // Get existing vote
        const existingVote = await votesCollection.findOne({
            contentType: 'comment',
            contentId: commentIdObj,
            userId
        });

        const oldVote = existingVote?.vote || 0;
        const newVote = vote;

        // Calculate vote changes
        let upvoteChange = 0;
        let downvoteChange = 0;

        // Remove old vote effect
        if (oldVote === 1) upvoteChange--;
        if (oldVote === -1) downvoteChange--;

        // Add new vote effect
        if (newVote === 1) upvoteChange++;
        if (newVote === -1) downvoteChange++;

        // Update or remove vote record
        if (newVote === 0) {
            if (existingVote) {
                await votesCollection.deleteOne({
                    contentType: 'comment',
                    contentId: commentIdObj,
                    userId
                });
            }
        } else {
            await votesCollection.updateOne(
                {
                    contentType: 'comment',
                    contentId: commentIdObj,
                    userId
                },
                {
                    $set: {
                        vote: newVote,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
        }

        // Update comment vote counts
        const updateResult = await comments.findOneAndUpdate(
            { _id: commentIdObj },
            {
                $inc: {
                    upvotes: upvoteChange,
                    downvotes: downvoteChange,
                    score: upvoteChange - downvoteChange
                }
            },
            { returnDocument: 'after' }
        );

        const updated = updateResult;

        res.status(200).json({
            success: true,
            upvotes: updated?.upvotes || 0,
            downvotes: updated?.downvotes || 0,
            score: updated?.score || 0,
            userVote: newVote
        });
    } catch (error) {
        console.error('Comment vote error:', error);
        res.status(500).json({ error: 'Failed to vote on comment' });
    }
}
