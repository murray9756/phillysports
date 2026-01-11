// Single Conversation API
// GET /api/messages/conversations/[id] - Get conversation with messages

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserInfo } from '../../lib/community.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await authenticate(req);
    if (!auth) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    try {
        const conversations = await getCollection('conversations');
        const directMessages = await getCollection('direct_messages');
        const userIdObj = new ObjectId(auth.userId);

        // Get conversation
        const conversation = await conversations.findOne({
            _id: new ObjectId(id),
            participants: userIdObj
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get other participant info
        const otherUserId = conversation.participants.find(p => p.toString() !== auth.userId);
        const otherUser = await getUserInfo(otherUserId);

        // Get messages (most recent 50)
        const { page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const messages = await directMessages.find({
            conversationId: conversation._id
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray();

        // Reverse to show oldest first
        messages.reverse();

        // Format messages
        const formattedMessages = messages.map(msg => ({
            id: msg._id.toString(),
            senderId: msg.senderId.toString(),
            content: msg.content,
            isOwn: msg.senderId.toString() === auth.userId,
            readBy: msg.readBy.map(id => id.toString()),
            createdAt: msg.createdAt
        }));

        // Mark as read
        await conversations.updateOne(
            { _id: conversation._id },
            { $set: { [`unreadCounts.${auth.userId}`]: 0 } }
        );

        // Mark messages as read
        await directMessages.updateMany(
            {
                conversationId: conversation._id,
                senderId: { $ne: userIdObj },
                readBy: { $ne: userIdObj }
            },
            { $addToSet: { readBy: userIdObj } }
        );

        return res.status(200).json({
            conversation: {
                id: conversation._id.toString(),
                otherUser,
                createdAt: conversation.createdAt
            },
            messages: formattedMessages,
            pagination: {
                page: pageNum,
                limit: limitNum
            }
        });

    } catch (error) {
        console.error('Get conversation error:', error);
        return res.status(500).json({ error: 'Failed to fetch conversation' });
    }
}
