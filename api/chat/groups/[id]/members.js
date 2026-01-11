// Group Members API
// POST /api/chat/groups/[id]/members - Add member
// DELETE /api/chat/groups/[id]/members?userId=xxx - Remove member

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { getUserInfo, hasBlockRelationship } from '../../../lib/community.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
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

    if (req.method === 'POST') {
        return handleAddMember(req, res, auth, id);
    }

    if (req.method === 'DELETE') {
        return handleRemoveMember(req, res, auth, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleAddMember(req, res, auth, groupId) {
    try {
        const { userId } = req.body;

        if (!userId || !ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const chatRooms = await getCollection('chat_rooms');
        const group = await chatRooms.findOne({
            _id: new ObjectId(groupId),
            type: 'group'
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user is owner or admin
        const currentMember = group.members?.find(m => m.userId.toString() === auth.userId);
        if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
            return res.status(403).json({ error: 'Not authorized to add members' });
        }

        // Check if already a member
        const existingMember = group.members?.find(m => m.userId.toString() === userId);
        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member' });
        }

        // Check max members
        if (group.members?.length >= (group.maxMembers || 50)) {
            return res.status(400).json({ error: 'Group has reached maximum members' });
        }

        // Check if target user exists
        const users = await getCollection('users');
        const targetUser = await users.findOne({ _id: new ObjectId(userId) });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check for blocks
        const blocked = await hasBlockRelationship(auth.userId, userId);
        if (blocked) {
            return res.status(403).json({ error: 'Cannot add this user' });
        }

        // Add member
        await chatRooms.updateOne(
            { _id: new ObjectId(groupId) },
            {
                $push: {
                    members: {
                        userId: new ObjectId(userId),
                        role: 'member',
                        joinedAt: new Date()
                    }
                },
                $set: { updatedAt: new Date() }
            }
        );

        const userInfo = await getUserInfo(userId);

        return res.status(200).json({
            message: 'Member added successfully',
            member: userInfo
        });

    } catch (error) {
        console.error('Add member error:', error);
        return res.status(500).json({ error: 'Failed to add member' });
    }
}

async function handleRemoveMember(req, res, auth, groupId) {
    try {
        const { userId } = req.query;

        if (!userId || !ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const chatRooms = await getCollection('chat_rooms');
        const group = await chatRooms.findOne({
            _id: new ObjectId(groupId),
            type: 'group'
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Cannot remove owner
        if (group.ownerId.toString() === userId) {
            return res.status(400).json({ error: 'Cannot remove the owner' });
        }

        // Check permissions
        const currentMember = group.members?.find(m => m.userId.toString() === auth.userId);
        const targetMember = group.members?.find(m => m.userId.toString() === userId);

        if (!targetMember) {
            return res.status(404).json({ error: 'User is not a member' });
        }

        // Owner can remove anyone, admin can remove members, members can only remove themselves
        const canRemove =
            group.ownerId.toString() === auth.userId ||
            (currentMember?.role === 'admin' && targetMember.role === 'member') ||
            auth.userId === userId;

        if (!canRemove) {
            return res.status(403).json({ error: 'Not authorized to remove this member' });
        }

        // Remove member
        await chatRooms.updateOne(
            { _id: new ObjectId(groupId) },
            {
                $pull: { members: { userId: new ObjectId(userId) } },
                $set: { updatedAt: new Date() }
            }
        );

        return res.status(200).json({ message: 'Member removed successfully' });

    } catch (error) {
        console.error('Remove member error:', error);
        return res.status(500).json({ error: 'Failed to remove member' });
    }
}
