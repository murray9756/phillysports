// Send Message API
// POST /api/messages/conversations/[id]/messages - Send message

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { hasBlockRelationship, validateMessageContent } from '../../../lib/community.js';
import { getPusher } from '../../../lib/pusher.js';

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

    const auth = await authenticate(req);
    if (!auth) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.query;
    const { content } = req.body;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Validate content
    const errors = validateMessageContent(content);
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
    }

    try {
        const conversations = await getCollection('conversations');
        const directMessages = await getCollection('direct_messages');
        const userIdObj = new ObjectId(auth.userId);

        // Get conversation and verify user is a participant
        const conversation = await conversations.findOne({
            _id: new ObjectId(id),
            participants: userIdObj
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get other participant
        const otherUserId = conversation.participants.find(p => p.toString() !== auth.userId);

        // Check for blocks
        const blocked = await hasBlockRelationship(auth.userId, otherUserId.toString());
        if (blocked) {
            return res.status(403).json({ error: 'Cannot message this user' });
        }

        const now = new Date();

        // Create message
        const newMessage = {
            conversationId: conversation._id,
            senderId: userIdObj,
            content: content.trim(),
            readBy: [userIdObj],
            status: 'sent',
            createdAt: now
        };

        const result = await directMessages.insertOne(newMessage);

        // Update conversation
        await conversations.updateOne(
            { _id: conversation._id },
            {
                $set: {
                    lastMessageAt: now,
                    lastMessagePreview: content.substring(0, 100),
                    lastMessageBy: userIdObj,
                    updatedAt: now
                },
                $inc: { [`unreadCounts.${otherUserId.toString()}`]: 1 }
            }
        );

        // Send real-time notification via Pusher
        const pusher = getPusher();
        if (pusher) {
            try {
                await pusher.trigger(`private-dm-${id}`, 'dm-message', {
                    id: result.insertedId.toString(),
                    senderId: auth.userId,
                    content: content.trim(),
                    createdAt: now
                });

                // Notify other user
                await pusher.trigger(`private-user-${otherUserId.toString()}`, 'notification', {
                    type: 'dm',
                    conversationId: id,
                    preview: content.substring(0, 50)
                });
            } catch (e) {
                console.error('Pusher error:', e);
            }
        }

        return res.status(201).json({
            message: {
                id: result.insertedId.toString(),
                senderId: auth.userId,
                content: content.trim(),
                isOwn: true,
                createdAt: now
            }
        });

    } catch (error) {
        console.error('Send message error:', error);
        return res.status(500).json({ error: 'Failed to send message' });
    }
}
