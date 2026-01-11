// Mark Conversation Read API
// POST /api/messages/conversations/[id]/read - Mark conversation as read

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
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

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
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

        // Reset unread count
        await conversations.updateOne(
            { _id: conversation._id },
            { $set: { [`unreadCounts.${auth.userId}`]: 0 } }
        );

        // Mark all messages as read
        await directMessages.updateMany(
            {
                conversationId: conversation._id,
                senderId: { $ne: userIdObj },
                readBy: { $ne: userIdObj }
            },
            { $addToSet: { readBy: userIdObj } }
        );

        // Send read receipt via Pusher
        const pusher = getPusher();
        if (pusher) {
            try {
                await pusher.trigger(`private-dm-${id}`, 'dm-read', {
                    userId: auth.userId
                });
            } catch (e) {
                console.error('Pusher error:', e);
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Mark read error:', error);
        return res.status(500).json({ error: 'Failed to mark as read' });
    }
}
