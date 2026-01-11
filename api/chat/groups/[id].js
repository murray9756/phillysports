// Single Group API
// PUT /api/chat/groups/[id] - Update group
// DELETE /api/chat/groups/[id] - Delete group

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const auth = await authenticate(req);
    if (!auth) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid group ID' });
    }

    if (req.method === 'PUT') {
        return handleUpdateGroup(req, res, auth, id);
    }

    if (req.method === 'DELETE') {
        return handleDeleteGroup(req, res, auth, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleUpdateGroup(req, res, auth, groupId) {
    try {
        const chatRooms = await getCollection('chat_rooms');
        const group = await chatRooms.findOne({
            _id: new ObjectId(groupId),
            type: 'group'
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user is owner or admin
        const member = group.members?.find(m => m.userId.toString() === auth.userId);
        if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
            return res.status(403).json({ error: 'Not authorized to edit this group' });
        }

        const { name, description } = req.body;
        const update = { updatedAt: new Date() };

        if (name) {
            if (name.trim().length < 3) {
                return res.status(400).json({ error: 'Group name must be at least 3 characters' });
            }
            update.name = name.trim().substring(0, 50);
        }

        if (description !== undefined) {
            update.description = description.trim().substring(0, 200);
        }

        await chatRooms.updateOne(
            { _id: new ObjectId(groupId) },
            { $set: update }
        );

        return res.status(200).json({ message: 'Group updated successfully' });

    } catch (error) {
        console.error('Update group error:', error);
        return res.status(500).json({ error: 'Failed to update group' });
    }
}

async function handleDeleteGroup(req, res, auth, groupId) {
    try {
        const chatRooms = await getCollection('chat_rooms');
        const group = await chatRooms.findOne({
            _id: new ObjectId(groupId),
            type: 'group'
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Only owner can delete
        if (group.ownerId.toString() !== auth.userId) {
            return res.status(403).json({ error: 'Only the owner can delete this group' });
        }

        // Delete group
        await chatRooms.deleteOne({ _id: new ObjectId(groupId) });

        // Delete all messages
        const chatMessages = await getCollection('chat_messages');
        await chatMessages.deleteMany({ roomId: new ObjectId(groupId) });

        return res.status(200).json({ message: 'Group deleted successfully' });

    } catch (error) {
        console.error('Delete group error:', error);
        return res.status(500).json({ error: 'Failed to delete group' });
    }
}
