// Single Chat Room API
// GET /api/chat/rooms/[id] - Get room details and recent messages

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

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid room ID' });
    }

    try {
        const chatRooms = await getCollection('chat_rooms');
        const room = await chatRooms.findOne({ _id: new ObjectId(id) });

        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        // For group chats, verify user is a member
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

        // Get recent messages
        const chatMessages = await getCollection('chat_messages');
        const messages = await chatMessages.find({ roomId: room._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        // Reverse to show oldest first
        messages.reverse();

        // Get unique sender IDs
        const senderIds = [...new Set(messages.map(m => m.senderId.toString()))];
        const senderInfoMap = {};

        for (const senderId of senderIds) {
            senderInfoMap[senderId] = await getUserInfo(senderId);
        }

        // Format messages
        const formattedMessages = messages.map(msg => ({
            id: msg._id.toString(),
            senderId: msg.senderId.toString(),
            sender: senderInfoMap[msg.senderId.toString()],
            content: msg.content,
            type: msg.type || 'text',
            isOwn: auth && msg.senderId.toString() === auth.userId,
            createdAt: msg.createdAt
        }));

        // Format room
        const formattedRoom = {
            id: room._id.toString(),
            type: room.type,
            team: room.team,
            name: room.name,
            description: room.description,
            memberCount: room.members?.length || 0,
            ownerId: room.ownerId?.toString(),
            isOwner: auth && room.ownerId?.toString() === auth.userId
        };

        return res.status(200).json({
            room: formattedRoom,
            messages: formattedMessages
        });

    } catch (error) {
        console.error('Get chat room error:', error);
        return res.status(500).json({ error: 'Failed to fetch chat room' });
    }
}
