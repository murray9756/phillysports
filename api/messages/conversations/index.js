// Conversations API
// GET /api/messages/conversations - List user's conversations
// POST /api/messages/conversations - Start new conversation

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserInfo, hasBlockRelationship } from '../../lib/community.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Require authentication
    const auth = await authenticate(req);
    if (!auth) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.method === 'GET') {
        return handleGetConversations(req, res, auth);
    }

    if (req.method === 'POST') {
        return handleStartConversation(req, res, auth);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetConversations(req, res, auth) {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const conversations = await getCollection('conversations');
        const userIdObj = new ObjectId(auth.userId);

        // Get conversations where user is a participant
        const results = await conversations.aggregate([
            { $match: { participants: userIdObj, status: 'active' } },
            { $sort: { lastMessageAt: -1 } },
            { $skip: skip },
            { $limit: limitNum }
        ]).toArray();

        // Get other participants' info
        const formattedConversations = await Promise.all(results.map(async conv => {
            const otherUserId = conv.participants.find(p => p.toString() !== auth.userId);
            const otherUser = await getUserInfo(otherUserId);
            const unreadCount = conv.unreadCounts?.[auth.userId] || 0;

            return {
                id: conv._id.toString(),
                otherUser,
                lastMessageAt: conv.lastMessageAt,
                lastMessagePreview: conv.lastMessagePreview,
                lastMessageBy: conv.lastMessageBy?.toString(),
                unreadCount,
                createdAt: conv.createdAt
            };
        }));

        // Get total count
        const total = await conversations.countDocuments({
            participants: userIdObj,
            status: 'active'
        });

        return res.status(200).json({
            conversations: formattedConversations,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get conversations error:', error);
        return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
}

async function handleStartConversation(req, res, auth) {
    try {
        const { userId, message } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (message.length > 2000) {
            return res.status(400).json({ error: 'Message cannot exceed 2000 characters' });
        }

        // Cannot message yourself
        if (userId === auth.userId) {
            return res.status(400).json({ error: 'Cannot start conversation with yourself' });
        }

        // Check if user exists
        const users = await getCollection('users');
        const targetUser = await users.findOne({ _id: new ObjectId(userId) });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check for blocks
        const blocked = await hasBlockRelationship(auth.userId, userId);
        if (blocked) {
            return res.status(403).json({ error: 'Cannot message this user' });
        }

        const conversations = await getCollection('conversations');
        const directMessages = await getCollection('direct_messages');
        const userIdObj = new ObjectId(auth.userId);
        const targetIdObj = new ObjectId(userId);

        // Check if conversation already exists
        let conversation = await conversations.findOne({
            participants: { $all: [userIdObj, targetIdObj] }
        });

        const now = new Date();

        if (!conversation) {
            // Create new conversation
            const newConversation = {
                participants: [userIdObj, targetIdObj],
                lastMessageAt: now,
                lastMessagePreview: message.substring(0, 100),
                lastMessageBy: userIdObj,
                unreadCounts: {
                    [auth.userId]: 0,
                    [userId]: 1
                },
                status: 'active',
                createdAt: now,
                updatedAt: now
            };

            const result = await conversations.insertOne(newConversation);
            conversation = { ...newConversation, _id: result.insertedId };
        } else {
            // Update existing conversation
            await conversations.updateOne(
                { _id: conversation._id },
                {
                    $set: {
                        lastMessageAt: now,
                        lastMessagePreview: message.substring(0, 100),
                        lastMessageBy: userIdObj,
                        status: 'active',
                        updatedAt: now
                    },
                    $inc: { [`unreadCounts.${userId}`]: 1 }
                }
            );
        }

        // Create message
        const newMessage = {
            conversationId: conversation._id,
            senderId: userIdObj,
            content: message.trim(),
            readBy: [userIdObj],
            status: 'sent',
            createdAt: now
        };

        await directMessages.insertOne(newMessage);

        // Get other user info
        const otherUser = await getUserInfo(userId);

        return res.status(201).json({
            message: 'Conversation started',
            conversation: {
                id: conversation._id.toString(),
                otherUser,
                lastMessageAt: now,
                lastMessagePreview: message.substring(0, 100),
                unreadCount: 0
            }
        });

    } catch (error) {
        console.error('Start conversation error:', error);
        return res.status(500).json({ error: 'Failed to start conversation' });
    }
}
