// Poker Table Chat API
// GET: Fetch chat messages for a table
// POST: Send a chat message

import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id: tableId } = req.query;

    if (!tableId) {
        return res.status(400).json({ error: 'Table ID required' });
    }

    try {
        if (req.method === 'GET') {
            return await getMessages(req, res, tableId);
        } else if (req.method === 'POST') {
            return await sendMessage(req, res, tableId);
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Chat API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Get chat messages for a table
 */
async function getMessages(req, res, tableId) {
    const { after } = req.query;
    const chat = await getCollection('poker_chat');

    // Build query
    const query = { tableId };

    // If 'after' is provided, only get messages after that ID
    if (after && ObjectId.isValid(after)) {
        query._id = { $gt: new ObjectId(after) };
    }

    // Get last 50 messages (or new ones if 'after' is specified)
    const messages = await chat
        .find(query)
        .sort({ createdAt: 1 })
        .limit(after ? 20 : 50)
        .toArray();

    return res.status(200).json({
        success: true,
        messages
    });
}

/**
 * Send a chat message
 */
async function sendMessage(req, res, tableId) {
    const user = await authenticate(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message required' });
    }

    // Sanitize and validate message
    const cleanMessage = message.trim().slice(0, 200);
    if (cleanMessage.length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Verify table exists
    const tables = await getCollection('poker_tables');
    const table = await tables.findOne({ _id: new ObjectId(tableId) });

    if (!table) {
        return res.status(404).json({ error: 'Table not found' });
    }

    // Create chat message
    const chat = await getCollection('poker_chat');
    const chatMessage = {
        tableId,
        userId: user.userId,
        username: user.username,
        message: cleanMessage,
        type: 'user',
        createdAt: new Date()
    };

    const result = await chat.insertOne(chatMessage);
    chatMessage._id = result.insertedId;

    // Clean up old messages (keep last 200 per table)
    const messageCount = await chat.countDocuments({ tableId });
    if (messageCount > 200) {
        const oldMessages = await chat
            .find({ tableId })
            .sort({ createdAt: 1 })
            .limit(messageCount - 200)
            .toArray();

        if (oldMessages.length > 0) {
            const oldIds = oldMessages.map(m => m._id);
            await chat.deleteMany({ _id: { $in: oldIds } });
        }
    }

    return res.status(200).json({
        success: true,
        message: chatMessage
    });
}

/**
 * Helper function to add system messages (for use by other modules)
 */
export async function addSystemMessage(tableId, message) {
    const chat = await getCollection('poker_chat');

    const chatMessage = {
        tableId,
        userId: null,
        username: 'System',
        message,
        type: 'system',
        createdAt: new Date()
    };

    const result = await chat.insertOne(chatMessage);
    chatMessage._id = result.insertedId;

    return chatMessage;
}
