// Comment Replies API
// POST /api/comments/[id]/replies - Create reply to a comment

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { sanitizeString } from '../../lib/validate.js';
import { addCoins, getDailyEarnings, COINS_PER_COMMENT, DAILY_COMMENT_COIN_LIMIT } from '../../lib/coins.js';
import { parseMentions, sendMentionNotifications } from '../../lib/mentions.js';

const MAX_DEPTH = 3;

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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id: parentId } = req.query;
        const { content } = req.body;

        if (!parentId || !ObjectId.isValid(parentId)) {
            return res.status(400).json({ error: 'Invalid comment ID' });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Reply content is required' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ error: 'Reply must be 1000 characters or less' });
        }

        const comments = await getCollection('comments');
        const users = await getCollection('users');

        // Get parent comment
        const parentComment = await comments.findOne({
            _id: new ObjectId(parentId),
            status: { $ne: 'deleted' }
        });

        if (!parentComment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check depth limit
        const parentDepth = parentComment.depth || 0;
        if (parentDepth >= MAX_DEPTH) {
            return res.status(400).json({ error: 'Maximum reply depth reached' });
        }

        // Rate limit: max 1 reply per 30 seconds
        const userId = new ObjectId(decoded.userId);
        const recentReply = await comments.findOne({
            userId,
            createdAt: { $gte: new Date(Date.now() - 30000) }
        });

        if (recentReply) {
            return res.status(429).json({ error: 'Please wait before replying again' });
        }

        // Parse mentions
        const sanitizedContent = sanitizeString(content, 1000);
        const mentionedUsernames = parseMentions(sanitizedContent);

        // Create reply
        const newReply = {
            userId,
            parentId: new ObjectId(parentId),
            articleUrl: parentComment.articleUrl,
            content: sanitizedContent,
            mentions: mentionedUsernames,
            upvotes: 0,
            downvotes: 0,
            score: 0,
            replyCount: 0,
            depth: parentDepth + 1,
            status: 'active',
            likes: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await comments.insertOne(newReply);
        newReply._id = result.insertedId;

        // Update parent's reply count
        await comments.updateOne(
            { _id: new ObjectId(parentId) },
            { $inc: { replyCount: 1 } }
        );

        // Get user info
        const user = await users.findOne(
            { _id: userId },
            { projection: { password: 0, email: 0, notifications: 0, savedArticles: 0 } }
        );

        // Award coins for replying (if under daily limit)
        let coinsEarned = 0;
        try {
            const dailyEarnings = await getDailyEarnings(decoded.userId, 'comment');
            if (dailyEarnings.total < DAILY_COMMENT_COIN_LIMIT) {
                await addCoins(
                    decoded.userId,
                    COINS_PER_COMMENT,
                    'comment',
                    'Posted a reply',
                    { commentId: newReply._id.toString(), articleUrl: parentComment.articleUrl }
                );
                coinsEarned = COINS_PER_COMMENT;
            }
        } catch (coinError) {
            console.error('Failed to award reply coins:', coinError);
        }

        // Send mention notifications
        if (mentionedUsernames.length > 0) {
            try {
                await sendMentionNotifications({
                    mentionedUsernames,
                    mentionerId: decoded.userId,
                    mentionerUsername: user.username,
                    contentType: 'comment',
                    contentId: newReply._id.toString(),
                    contentPreview: sanitizedContent,
                    url: parentComment.articleUrl
                });
            } catch (mentionError) {
                console.error('Failed to send mention notifications:', mentionError);
            }
        }

        // Notify parent comment author (if not self)
        if (parentComment.userId.toString() !== decoded.userId) {
            try {
                const { sendNotification } = await import('../../notifications/send.js');
                const parentUser = await users.findOne({ _id: parentComment.userId });

                if (parentUser) {
                    await sendNotification(
                        parentComment.userId.toString(),
                        'reply',
                        `${user.username} replied to your comment`,
                        sanitizedContent.substring(0, 100),
                        `/article.html?url=${encodeURIComponent(parentComment.articleUrl)}`,
                        { commentId: newReply._id.toString() }
                    );
                }
            } catch (notifyError) {
                console.error('Failed to notify parent author:', notifyError);
            }
        }

        res.status(201).json({
            message: 'Reply posted',
            coinsEarned,
            reply: {
                _id: newReply._id.toString(),
                userId: newReply.userId.toString(),
                parentId: newReply.parentId.toString(),
                articleUrl: newReply.articleUrl,
                content: newReply.content,
                user: {
                    _id: user._id.toString(),
                    username: user.username,
                    displayName: user.displayName,
                    profilePhoto: user.profilePhoto,
                    favoriteTeam: user.favoriteTeam
                },
                upvotes: 0,
                downvotes: 0,
                score: 0,
                replyCount: 0,
                depth: newReply.depth,
                replies: [],
                mentions: mentionedUsernames,
                createdAt: newReply.createdAt,
                updatedAt: newReply.updatedAt
            }
        });
    } catch (error) {
        console.error('Create reply error:', error);
        res.status(500).json({ error: 'Failed to create reply' });
    }
}
