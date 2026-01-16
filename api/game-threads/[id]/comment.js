// Post Comment to Game Thread
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getPusher } from '../../lib/pusher.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        // Authenticate user
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Please log in to comment' });
        }

        const { id } = req.query;
        const { content } = req.body;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid thread ID' });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }

        if (content.length > 500) {
            return res.status(400).json({ error: 'Comment too long (max 500 characters)' });
        }

        const threadsCollection = await getCollection('game_threads');
        const commentsCollection = await getCollection('game_thread_comments');
        const usersCollection = await getCollection('users');

        // Get thread
        const thread = await threadsCollection.findOne({ _id: new ObjectId(id) });
        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Get user info
        const userDoc = await usersCollection.findOne({ _id: new ObjectId(user.userId) });
        const username = userDoc?.username || user.username || 'Anonymous';

        // Create comment
        const comment = {
            threadId: new ObjectId(id),
            userId: new ObjectId(user.userId),
            username,
            content: content.trim(),
            createdAt: new Date()
        };

        const result = await commentsCollection.insertOne(comment);
        comment._id = result.insertedId;

        // Update comment count
        await threadsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $inc: { commentCount: 1 },
                $set: { updatedAt: new Date() }
            }
        );

        // Broadcast to Pusher
        const pusher = getPusher();
        if (pusher) {
            try {
                await pusher.trigger(thread.pusherChannel, 'new-comment', {
                    _id: comment._id.toString(),
                    userId: user.userId,
                    username,
                    content: comment.content,
                    createdAt: comment.createdAt
                });
            } catch (e) {
                console.error('Pusher error:', e);
            }
        }

        return res.status(201).json({
            success: true,
            comment: {
                _id: comment._id,
                username,
                content: comment.content,
                createdAt: comment.createdAt
            }
        });
    } catch (error) {
        console.error('Comment error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
