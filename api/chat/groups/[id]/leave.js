// Leave Group API
// POST /api/chat/groups/[id]/leave - Leave group

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';

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
        return res.status(400).json({ error: 'Invalid group ID' });
    }

    try {
        const chatRooms = await getCollection('chat_rooms');
        const group = await chatRooms.findOne({
            _id: new ObjectId(id),
            type: 'group'
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user is a member
        const member = group.members?.find(m => m.userId.toString() === auth.userId);
        if (!member) {
            return res.status(400).json({ error: 'You are not a member of this group' });
        }

        // Owner cannot leave (must delete or transfer ownership)
        if (group.ownerId.toString() === auth.userId) {
            return res.status(400).json({
                error: 'Owner cannot leave. Transfer ownership or delete the group.'
            });
        }

        // Remove member
        await chatRooms.updateOne(
            { _id: new ObjectId(id) },
            {
                $pull: { members: { userId: new ObjectId(auth.userId) } },
                $set: { updatedAt: new Date() }
            }
        );

        return res.status(200).json({ message: 'Left group successfully' });

    } catch (error) {
        console.error('Leave group error:', error);
        return res.status(500).json({ error: 'Failed to leave group' });
    }
}
