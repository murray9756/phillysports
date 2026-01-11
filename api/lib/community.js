// Community System Helper Library
// Shared utilities for forums, DMs, and chat

import { ObjectId } from 'mongodb';
import { getCollection } from './mongodb.js';
import { addCoins, getDailyEarnings } from './coins.js';

// Reward constants
export const FORUM_POST_REWARD = 10;
export const FORUM_REPLY_REWARD = 5;
export const LIKE_RECEIVED_REWARD = 2;

export const DAILY_POST_LIMIT = 50;      // Max 50 DD from posts (5 posts)
export const DAILY_REPLY_LIMIT = 50;     // Max 50 DD from replies (10 replies)
export const DAILY_LIKE_LIMIT = 20;      // Max 20 DD from likes received (10 likes)

// Forum categories for each team
export const DEFAULT_CATEGORIES = [
    { name: 'Game Day', slug: 'game-day', description: 'Live game discussions and reactions', sortOrder: 1 },
    { name: 'Trade Talk', slug: 'trade-talk', description: 'Trades, free agency, and roster moves', sortOrder: 2 },
    { name: 'News & Analysis', slug: 'news-analysis', description: 'Breaking news and in-depth analysis', sortOrder: 3 },
    { name: 'Off-Topic', slug: 'off-topic', description: 'Everything else Philly sports related', sortOrder: 4 }
];

export const TEAMS = ['eagles', 'phillies', 'sixers', 'flyers'];

/**
 * Initialize forum categories for all teams
 */
export async function seedForumCategories() {
    const categories = await getCollection('forum_categories');

    for (const team of TEAMS) {
        for (const cat of DEFAULT_CATEGORIES) {
            await categories.updateOne(
                { team, slug: cat.slug },
                {
                    $setOnInsert: {
                        team,
                        name: cat.name,
                        slug: cat.slug,
                        description: cat.description,
                        sortOrder: cat.sortOrder,
                        isActive: true,
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
        }
    }
}

/**
 * Initialize team chat rooms
 */
export async function seedTeamChatRooms() {
    const chatRooms = await getCollection('chat_rooms');

    const teamNames = {
        eagles: 'Eagles Fan Chat',
        phillies: 'Phillies Fan Chat',
        sixers: '76ers Fan Chat',
        flyers: 'Flyers Fan Chat'
    };

    for (const team of TEAMS) {
        await chatRooms.updateOne(
            { type: 'team', team },
            {
                $setOnInsert: {
                    type: 'team',
                    team,
                    name: teamNames[team],
                    description: `Live chat for ${teamNames[team].replace(' Fan Chat', '')} fans`,
                    members: [],
                    maxMembers: null,
                    messageCount: 0,
                    lastMessageAt: null,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
    }
}

/**
 * Get user info for embedding in posts/messages
 */
export async function getUserInfo(userId) {
    const users = await getCollection('users');
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await users.findOne(
        { _id: userIdObj },
        { projection: { username: 1, displayName: 1, profilePhoto: 1, favoriteTeam: 1 } }
    );

    return user ? {
        userId: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
        favoriteTeam: user.favoriteTeam
    } : null;
}

/**
 * Check if user is blocked by another user
 */
export async function isBlocked(blockerId, blockedId) {
    const blocks = await getCollection('user_blocks');
    const block = await blocks.findOne({
        blockerId: typeof blockerId === 'string' ? new ObjectId(blockerId) : blockerId,
        blockedId: typeof blockedId === 'string' ? new ObjectId(blockedId) : blockedId
    });
    return !!block;
}

/**
 * Check if either user has blocked the other
 */
export async function hasBlockRelationship(userId1, userId2) {
    const id1 = typeof userId1 === 'string' ? new ObjectId(userId1) : userId1;
    const id2 = typeof userId2 === 'string' ? new ObjectId(userId2) : userId2;

    const blocks = await getCollection('user_blocks');
    const block = await blocks.findOne({
        $or: [
            { blockerId: id1, blockedId: id2 },
            { blockerId: id2, blockedId: id1 }
        ]
    });
    return !!block;
}

/**
 * Award coins for forum post with daily limit check
 */
export async function awardPostCoins(userId) {
    const dailyEarnings = await getDailyEarnings(userId, 'forum_post');

    if (dailyEarnings.total >= DAILY_POST_LIMIT) {
        return { awarded: false, reason: 'daily_limit', amount: 0 };
    }

    await addCoins(userId, FORUM_POST_REWARD, 'forum_post', 'Created forum post');
    return { awarded: true, amount: FORUM_POST_REWARD };
}

/**
 * Award coins for forum reply with daily limit check
 */
export async function awardReplyCoins(userId) {
    const dailyEarnings = await getDailyEarnings(userId, 'forum_reply');

    if (dailyEarnings.total >= DAILY_REPLY_LIMIT) {
        return { awarded: false, reason: 'daily_limit', amount: 0 };
    }

    await addCoins(userId, FORUM_REPLY_REWARD, 'forum_reply', 'Replied to forum post');
    return { awarded: true, amount: FORUM_REPLY_REWARD };
}

/**
 * Award coins for receiving a like with daily limit check
 */
export async function awardLikeCoins(userId) {
    const dailyEarnings = await getDailyEarnings(userId, 'like_received');

    if (dailyEarnings.total >= DAILY_LIKE_LIMIT) {
        return { awarded: false, reason: 'daily_limit', amount: 0 };
    }

    await addCoins(userId, LIKE_RECEIVED_REWARD, 'like_received', 'Received a like on forum post');
    return { awarded: true, amount: LIKE_RECEIVED_REWARD };
}

/**
 * Sanitize content - strip dangerous HTML but allow basic formatting
 */
export function sanitizeContent(content) {
    if (!content) return '';

    // Remove script tags and event handlers
    let sanitized = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');

    // Trim and limit length
    return sanitized.trim();
}

/**
 * Validate post content
 */
export function validatePostContent(title, content) {
    const errors = [];

    if (!title || title.trim().length < 5) {
        errors.push('Title must be at least 5 characters');
    }
    if (title && title.length > 200) {
        errors.push('Title cannot exceed 200 characters');
    }
    if (!content || content.trim().length < 20) {
        errors.push('Content must be at least 20 characters');
    }
    if (content && content.length > 10000) {
        errors.push('Content cannot exceed 10,000 characters');
    }

    return errors;
}

/**
 * Validate reply content
 */
export function validateReplyContent(content) {
    const errors = [];

    if (!content || content.trim().length < 2) {
        errors.push('Reply must be at least 2 characters');
    }
    if (content && content.length > 5000) {
        errors.push('Reply cannot exceed 5,000 characters');
    }

    return errors;
}

/**
 * Validate message content
 */
export function validateMessageContent(content) {
    const errors = [];

    if (!content || content.trim().length < 1) {
        errors.push('Message cannot be empty');
    }
    if (content && content.length > 2000) {
        errors.push('Message cannot exceed 2,000 characters');
    }

    return errors;
}

/**
 * Format post for API response
 */
export function formatPost(post, author = null) {
    return {
        id: post._id.toString(),
        categoryId: post.categoryId.toString(),
        team: post.team,
        title: post.title,
        content: post.content,
        isPinned: post.isPinned || false,
        isLocked: post.isLocked || false,
        viewCount: post.viewCount || 0,
        replyCount: post.replyCount || 0,
        likeCount: post.likeCount || 0,
        likes: (post.likes || []).map(id => id.toString()),
        lastReplyAt: post.lastReplyAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: author || {
            userId: post.authorId.toString(),
            username: post.authorUsername,
            displayName: post.authorDisplayName,
            profilePhoto: post.authorProfilePhoto,
            favoriteTeam: post.authorFavoriteTeam
        }
    };
}

/**
 * Format reply for API response
 */
export function formatReply(reply, author = null) {
    return {
        id: reply._id.toString(),
        postId: reply.postId.toString(),
        content: reply.content,
        likeCount: reply.likeCount || 0,
        likes: (reply.likes || []).map(id => id.toString()),
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: author || {
            userId: reply.authorId.toString(),
            username: reply.authorUsername,
            displayName: reply.authorDisplayName,
            profilePhoto: reply.authorProfilePhoto,
            favoriteTeam: reply.authorFavoriteTeam
        }
    };
}

/**
 * Create database indexes for community collections
 */
export async function createCommunityIndexes() {
    const forumCategories = await getCollection('forum_categories');
    const forumPosts = await getCollection('forum_posts');
    const forumReplies = await getCollection('forum_replies');
    const conversations = await getCollection('conversations');
    const directMessages = await getCollection('direct_messages');
    const chatRooms = await getCollection('chat_rooms');
    const chatMessages = await getCollection('chat_messages');
    const userBlocks = await getCollection('user_blocks');

    // Forum categories
    await forumCategories.createIndex({ team: 1, sortOrder: 1 });
    await forumCategories.createIndex({ team: 1, slug: 1 }, { unique: true });

    // Forum posts
    await forumPosts.createIndex({ team: 1, categoryId: 1, isPinned: -1, lastReplyAt: -1 });
    await forumPosts.createIndex({ authorId: 1, createdAt: -1 });
    await forumPosts.createIndex({ status: 1 });

    // Forum replies
    await forumReplies.createIndex({ postId: 1, createdAt: 1 });
    await forumReplies.createIndex({ authorId: 1 });

    // Conversations
    await conversations.createIndex({ participants: 1 });
    await conversations.createIndex({ participants: 1, lastMessageAt: -1 });

    // Direct messages
    await directMessages.createIndex({ conversationId: 1, createdAt: 1 });

    // Chat rooms
    await chatRooms.createIndex({ type: 1, team: 1 });
    await chatRooms.createIndex({ 'members.userId': 1 });

    // Chat messages
    await chatMessages.createIndex({ roomId: 1, createdAt: -1 });

    // User blocks
    await userBlocks.createIndex({ blockerId: 1, blockedId: 1 }, { unique: true });
    await userBlocks.createIndex({ blockedId: 1 });
}
