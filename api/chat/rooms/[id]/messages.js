// Chat Room Messages API
// GET /api/chat/rooms/[id]/messages - Get messages (paginated)
// POST /api/chat/rooms/[id]/messages - Send message

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { getUserInfo, validateMessageContent } from '../../../lib/community.js';
import { getPusher } from '../../../lib/pusher.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid room ID' });
    }

    if (req.method === 'GET') {
        return handleGetMessages(req, res, id);
    }

    if (req.method === 'POST') {
        return handleSendMessage(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetMessages(req, res, roomId) {
    try {
        const chatRooms = await getCollection('chat_rooms');
        const room = await chatRooms.findOne({ _id: new ObjectId(roomId) });

        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        // For group chats, verify membership
        const auth = await authenticate(req);
        if (room.type === 'group') {
            if (!auth) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const isMember = room.members?.some(m => m.userId.toString() === auth.userId);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this group' });
            }
        }

        const { before, limit = 50 } = req.query;
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

        const chatMessages = await getCollection('chat_messages');
        const query = { roomId: room._id };

        if (before && ObjectId.isValid(before)) {
            const beforeMsg = await chatMessages.findOne({ _id: new ObjectId(before) });
            if (beforeMsg) {
                query.createdAt = { $lt: beforeMsg.createdAt };
            }
        }

        const messages = await chatMessages.find(query)
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .toArray();

        messages.reverse();

        // Get sender info
        const senderIds = [...new Set(messages.map(m => m.senderId.toString()))];
        const senderInfoMap = {};
        for (const senderId of senderIds) {
            senderInfoMap[senderId] = await getUserInfo(senderId);
        }

        const formattedMessages = messages.map(msg => ({
            id: msg._id.toString(),
            senderId: msg.senderId.toString(),
            sender: senderInfoMap[msg.senderId.toString()],
            content: msg.content,
            type: msg.type || 'text',
            isOwn: auth && msg.senderId.toString() === auth.userId,
            createdAt: msg.createdAt
        }));

        return res.status(200).json({ messages: formattedMessages });

    } catch (error) {
        console.error('Get messages error:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
}

async function handleSendMessage(req, res, roomId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { content } = req.body;

        const errors = validateMessageContent(content);
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        const chatRooms = await getCollection('chat_rooms');
        const room = await chatRooms.findOne({ _id: new ObjectId(roomId) });

        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        // For group chats, verify membership
        if (room.type === 'group') {
            const isMember = room.members?.some(m => m.userId.toString() === auth.userId);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this group' });
            }
        }

        const chatMessages = await getCollection('chat_messages');
        const userIdObj = new ObjectId(auth.userId);
        const now = new Date();

        // Create message
        const newMessage = {
            roomId: room._id,
            senderId: userIdObj,
            content: content.trim(),
            type: 'text',
            status: 'active',
            createdAt: now
        };

        const result = await chatMessages.insertOne(newMessage);

        // Update room
        await chatRooms.updateOne(
            { _id: room._id },
            {
                $set: {
                    lastMessageAt: now,
                    lastMessagePreview: content.substring(0, 100)
                },
                $inc: { messageCount: 1 }
            }
        );

        // Get sender info
        const senderInfo = await getUserInfo(auth.userId);

        // Broadcast via Pusher
        const pusher = getPusher();
        if (pusher) {
            const channelName = room.type === 'team'
                ? `presence-chat-${room.team}`
                : `private-group-${roomId}`;

            try {
                await pusher.trigger(channelName, 'message', {
                    id: result.insertedId.toString(),
                    senderId: auth.userId,
                    sender: senderInfo,
                    content: content.trim(),
                    createdAt: now
                });
            } catch (e) {
                console.error('Pusher error:', e);
            }
        }

        return res.status(201).json({
            message: {
                id: result.insertedId.toString(),
                senderId: auth.userId,
                sender: senderInfo,
                content: content.trim(),
                type: 'text',
                isOwn: true,
                createdAt: now
            }
        });

    } catch (error) {
        console.error('Send message error:', error);
        return res.status(500).json({ error: 'Failed to send message' });
    }
}
