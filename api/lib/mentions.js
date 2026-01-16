// Mentions Helper Library - Parsing and notification helpers
import { getCollection } from './mongodb.js';
import { ObjectId } from 'mongodb';

/**
 * Parse @mentions from content
 * @param {string} content - The text content to parse
 * @returns {string[]} Array of unique usernames mentioned (lowercase)
 */
export function parseMentions(content) {
    if (!content || typeof content !== 'string') return [];

    const mentionRegex = /@(\w{3,20})/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
        mentions.push(match[1].toLowerCase());
    }

    return [...new Set(mentions)]; // Return unique mentions
}

/**
 * Validate mentioned usernames and get their user IDs
 * @param {string[]} usernames - Array of usernames to validate
 * @returns {Promise<Object[]>} Array of user objects { _id, username }
 */
export async function validateMentions(usernames) {
    if (!usernames || usernames.length === 0) return [];

    const usersCollection = await getCollection('users');
    const users = await usersCollection.find({
        username: { $in: usernames.map(u => new RegExp(`^${u}$`, 'i')) }
    }, {
        projection: { _id: 1, username: 1, displayName: 1 }
    }).toArray();

    return users;
}

/**
 * Send mention notifications to mentioned users
 * @param {Object} options
 * @param {string[]} options.mentionedUsernames - Usernames that were mentioned
 * @param {ObjectId|string} options.mentionerId - User ID of the person who mentioned
 * @param {string} options.mentionerUsername - Username of the person who mentioned
 * @param {string} options.contentType - Type of content (comment, forum_post, etc.)
 * @param {string} options.contentId - ID of the content
 * @param {string} options.contentPreview - Preview of the content (truncated)
 * @param {string} options.url - URL to the content
 */
export async function sendMentionNotifications(options) {
    const {
        mentionedUsernames,
        mentionerId,
        mentionerUsername,
        contentType,
        contentId,
        contentPreview,
        url
    } = options;

    if (!mentionedUsernames || mentionedUsernames.length === 0) return;

    const usersCollection = await getCollection('users');

    // Get mentioned users
    const mentionedUsers = await usersCollection.find({
        username: { $in: mentionedUsernames.map(u => new RegExp(`^${u}$`, 'i')) }
    }).toArray();

    // Import send notification helper
    const { sendNotification } = await import('../notifications/send.js');

    for (const user of mentionedUsers) {
        // Don't notify yourself
        if (user._id.toString() === mentionerId.toString()) continue;

        // Check if user wants mention notifications
        const prefs = user.notificationPreferences?.socialAlerts;
        if (prefs?.mention === false) continue;

        // Truncate preview
        const preview = contentPreview.length > 100
            ? contentPreview.substring(0, 100) + '...'
            : contentPreview;

        try {
            await sendNotification(
                user._id.toString(),
                'mention',
                `@${mentionerUsername} mentioned you`,
                preview,
                url,
                { contentType, contentId }
            );
        } catch (error) {
            console.error(`Failed to send mention notification to ${user.username}:`, error);
        }
    }
}

/**
 * Content type to collection name mapping
 */
export const CONTENT_COLLECTIONS = {
    'comment': 'comments',
    'forum_post': 'forum_posts',
    'forum_reply': 'forum_replies',
    'game_thread_comment': 'game_thread_comments'
};

/**
 * Get content URL based on type
 */
export function getContentUrl(contentType, contentId, additionalData = {}) {
    switch (contentType) {
        case 'comment':
            return additionalData.articleUrl || '/';
        case 'forum_post':
            return `/community/forums/post.html?id=${contentId}`;
        case 'forum_reply':
            return `/community/forums/post.html?id=${additionalData.postId}#reply-${contentId}`;
        case 'game_thread_comment':
            return `/game-thread.html?id=${additionalData.threadId}`;
        default:
            return '/';
    }
}
