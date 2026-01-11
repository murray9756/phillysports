// Group Chat API
// POST /api/chat/groups - Create new group chat

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

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

    try {
        const { name, description } = req.body;

        if (!name || name.trim().length < 3) {
            return res.status(400).json({ error: 'Group name must be at least 3 characters' });
        }

        if (name.length > 50) {
            return res.status(400).json({ error: 'Group name cannot exceed 50 characters' });
        }

        const chatRooms = await getCollection('chat_rooms');
        const userIdObj = new ObjectId(auth.userId);
        const now = new Date();

        // Create group
        const newGroup = {
            type: 'group',
            name: name.trim(),
            description: description?.trim().substring(0, 200) || '',
            ownerId: userIdObj,
            members: [{
                userId: userIdObj,
                role: 'owner',
                joinedAt: now
            }],
            isPublic: false,
            maxMembers: 50,
            messageCount: 0,
            lastMessageAt: null,
            createdAt: now,
            updatedAt: now
        };

        const result = await chatRooms.insertOne(newGroup);

        return res.status(201).json({
            message: 'Group created successfully',
            group: {
                id: result.insertedId.toString(),
                name: newGroup.name,
                description: newGroup.description,
                memberCount: 1,
                isOwner: true
            }
        });

    } catch (error) {
        console.error('Create group error:', error);
        return res.status(500).json({ error: 'Failed to create group' });
    }
}
