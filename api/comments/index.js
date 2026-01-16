import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { sanitizeString } from '../lib/validate.js';
import { addCoins, getDailyEarnings, COINS_PER_COMMENT, DAILY_COMMENT_COIN_LIMIT } from '../lib/coins.js';
import { parseMentions, sendMentionNotifications } from '../lib/mentions.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            const { articleUrl, limit = 50, sort = 'newest' } = req.query;

            if (!articleUrl) {
                return res.status(400).json({ error: 'Article URL is required' });
            }

            const comments = await getCollection('comments');
            const users = await getCollection('users');

            // Determine sort order
            let sortOrder = {};
            switch (sort) {
                case 'top':
                    sortOrder = { score: -1, createdAt: -1 };
                    break;
                case 'controversial':
                    sortOrder = { replyCount: -1, downvotes: -1, createdAt: -1 };
                    break;
                case 'newest':
                default:
                    sortOrder = { createdAt: -1 };
            }

            // Get top-level comments only (no parentId)
            const topLevelComments = await comments.find({
                articleUrl,
                parentId: { $exists: false },
                status: { $ne: 'deleted' }
            })
                .sort(sortOrder)
                .limit(parseInt(limit))
                .toArray();

            // Get all replies for these comments (up to depth 3)
            const topLevelIds = topLevelComments.map(c => c._id);
            const allReplies = await comments.find({
                articleUrl,
                parentId: { $in: topLevelIds },
                status: { $ne: 'deleted' }
            })
                .sort({ createdAt: 1 })
                .toArray();

            // Get nested replies (depth 2 and 3)
            const replyIds = allReplies.map(r => r._id);
            const nestedReplies = await comments.find({
                articleUrl,
                parentId: { $in: replyIds },
                status: { $ne: 'deleted' }
            })
                .sort({ createdAt: 1 })
                .toArray();

            // Combine all comments for user lookup
            const allComments = [...topLevelComments, ...allReplies, ...nestedReplies];
            const userIds = [...new Set(allComments.map(c => c.userId.toString()))];
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

            // Helper to format a comment
            const formatComment = (comment) => ({
                _id: comment._id.toString(),
                userId: comment.userId.toString(),
                parentId: comment.parentId?.toString() || null,
                articleUrl: comment.articleUrl,
                content: comment.content,
                user: userMap[comment.userId.toString()],
                likesCount: comment.likes?.length || 0,
                upvotes: comment.upvotes || 0,
                downvotes: comment.downvotes || 0,
                score: comment.score || 0,
                replyCount: comment.replyCount || 0,
                depth: comment.depth || 0,
                mentions: comment.mentions || [],
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt
            });

            // Build nested structure
            const nestedReplyMap = {};
            nestedReplies.forEach(reply => {
                const parentId = reply.parentId.toString();
                if (!nestedReplyMap[parentId]) nestedReplyMap[parentId] = [];
                nestedReplyMap[parentId].push(formatComment(reply));
            });

            const replyMap = {};
            allReplies.forEach(reply => {
                const parentId = reply.parentId.toString();
                if (!replyMap[parentId]) replyMap[parentId] = [];
                const formatted = formatComment(reply);
                formatted.replies = nestedReplyMap[reply._id.toString()] || [];
                replyMap[parentId].push(formatted);
            });

            const enrichedComments = topLevelComments.map(comment => {
                const formatted = formatComment(comment);
                formatted.replies = replyMap[comment._id.toString()] || [];
                return formatted;
            });

            // Get total comment count for article
            const totalCount = await comments.countDocuments({
                articleUrl,
                status: { $ne: 'deleted' }
            });

            res.status(200).json({
                comments: enrichedComments,
                totalCount
            });
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

            // Parse mentions from content
            const sanitizedContent = sanitizeString(content, 1000);
            const mentionedUsernames = parseMentions(sanitizedContent);

            const newComment = {
                userId,
                articleUrl,
                content: sanitizedContent,
                mentions: mentionedUsernames,
                upvotes: 0,
                downvotes: 0,
                score: 0,
                replyCount: 0,
                depth: 0,
                status: 'active',
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

            // Award coins for commenting (if under daily limit)
            let coinsEarned = 0;
            try {
                const dailyEarnings = await getDailyEarnings(decoded.userId, 'comment');
                if (dailyEarnings.total < DAILY_COMMENT_COIN_LIMIT) {
                    await addCoins(
                        decoded.userId,
                        COINS_PER_COMMENT,
                        'comment',
                        'Posted a comment',
                        { commentId: newComment._id.toString(), articleUrl }
                    );
                    coinsEarned = COINS_PER_COMMENT;
                }
            } catch (coinError) {
                console.error('Failed to award comment coins:', coinError);
            }

            // Send mention notifications
            if (mentionedUsernames.length > 0) {
                try {
                    await sendMentionNotifications({
                        mentionedUsernames,
                        mentionerId: decoded.userId,
                        mentionerUsername: user.username,
                        contentType: 'comment',
                        contentId: newComment._id.toString(),
                        contentPreview: sanitizedContent,
                        url: articleUrl
                    });
                } catch (mentionError) {
                    console.error('Failed to send mention notifications:', mentionError);
                }
            }

            res.status(201).json({
                message: 'Comment posted',
                coinsEarned,
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
                    likesCount: 0,
                    upvotes: 0,
                    downvotes: 0,
                    score: 0,
                    replyCount: 0,
                    depth: 0,
                    replies: [],
                    mentions: mentionedUsernames
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
