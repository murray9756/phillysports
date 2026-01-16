// Post Replies API
// POST /api/forums/posts/[id]/replies - Create reply to post

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import {
    getUserInfo,
    validateReplyContent,
    sanitizeContent,
    formatReply,
    awardReplyCoins
} from '../../../lib/community.js';
import { parseMentions, sendMentionNotifications, getContentUrl } from '../../../lib/mentions.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id: postId } = req.query;
        const { content } = req.body;

        if (!postId || !ObjectId.isValid(postId)) {
            return res.status(400).json({ error: 'Invalid post ID' });
        }

        // Validate content
        const errors = validateReplyContent(content);
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        // Verify post exists and is not locked
        const posts = await getCollection('forum_posts');
        const post = await posts.findOne({ _id: new ObjectId(postId), status: 'active' });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.isLocked) {
            return res.status(403).json({ error: 'This post is locked and cannot receive replies' });
        }

        // Rate limit: max 1 reply per 30 seconds
        const replies = await getCollection('forum_replies');
        const recentReply = await replies.findOne({
            authorId: new ObjectId(auth.userId),
            createdAt: { $gte: new Date(Date.now() - 30000) }
        });

        if (recentReply) {
            return res.status(429).json({ error: 'Please wait before replying again' });
        }

        // Get author info
        const authorInfo = await getUserInfo(auth.userId);

        // Create reply
        const now = new Date();
        const sanitizedContent = sanitizeContent(content).substring(0, 5000);
        const mentionedUsernames = parseMentions(sanitizedContent);

        const newReply = {
            postId: new ObjectId(postId),
            authorId: new ObjectId(auth.userId),
            authorUsername: authorInfo.username,
            authorDisplayName: authorInfo.displayName,
            authorProfilePhoto: authorInfo.profilePhoto,
            authorFavoriteTeam: authorInfo.favoriteTeam,
            content: sanitizedContent,
            mentions: mentionedUsernames,
            likes: [],
            likeCount: 0,
            upvotes: 0,
            downvotes: 0,
            score: 0,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const result = await replies.insertOne(newReply);

        // Update post reply count and last reply time
        await posts.updateOne(
            { _id: new ObjectId(postId) },
            {
                $inc: { replyCount: 1 },
                $set: {
                    lastReplyAt: now,
                    lastReplyById: new ObjectId(auth.userId)
                }
            }
        );

        // Award coins for replying
        const reward = await awardReplyCoins(auth.userId);

        // Send mention notifications
        if (mentionedUsernames.length > 0) {
            try {
                const replyUrl = getContentUrl('forum_reply', result.insertedId.toString(), { postId });
                await sendMentionNotifications({
                    mentionedUsernames,
                    mentionerId: auth.userId,
                    mentionerUsername: authorInfo.username,
                    contentType: 'forum_reply',
                    contentId: result.insertedId.toString(),
                    contentPreview: sanitizedContent,
                    url: replyUrl
                });
            } catch (mentionError) {
                console.error('Failed to send mention notifications:', mentionError);
            }
        }

        return res.status(201).json({
            message: 'Reply posted successfully',
            reply: formatReply({ ...newReply, _id: result.insertedId }, authorInfo),
            coinsAwarded: reward.awarded ? reward.amount : 0
        });

    } catch (error) {
        console.error('Create reply error:', error);
        return res.status(500).json({ error: 'Failed to create reply' });
    }
}
