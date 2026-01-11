// Chat Rooms API
// GET /api/chat/rooms - List available chat rooms

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { TEAMS, seedTeamChatRooms } from '../../lib/community.js';

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

    try {
        const chatRooms = await getCollection('chat_rooms');

        // Seed team chat rooms if none exist
        const teamRoomCount = await chatRooms.countDocuments({ type: 'team' });
        if (teamRoomCount === 0) {
            await seedTeamChatRooms();
        }

        // Get team chat rooms
        const teamRooms = await chatRooms.find({ type: 'team' })
            .sort({ team: 1 })
            .toArray();

        // Format team rooms
        const formattedTeamRooms = teamRooms.map(room => ({
            id: room._id.toString(),
            type: 'team',
            team: room.team,
            name: room.name,
            description: room.description,
            memberCount: room.members?.length || 0,
            lastMessageAt: room.lastMessageAt
        }));

        // If authenticated, also get user's group chats
        let groupRooms = [];
        const auth = await authenticate(req);

        if (auth) {
            const userGroups = await chatRooms.find({
                type: 'group',
                'members.userId': new ObjectId(auth.userId)
            }).sort({ lastMessageAt: -1 }).toArray();

            groupRooms = userGroups.map(room => ({
                id: room._id.toString(),
                type: 'group',
                name: room.name,
                description: room.description,
                memberCount: room.members?.length || 0,
                lastMessageAt: room.lastMessageAt,
                isOwner: room.ownerId?.toString() === auth.userId
            }));
        }

        return res.status(200).json({
            teamRooms: formattedTeamRooms,
            groupRooms
        });

    } catch (error) {
        console.error('Get chat rooms error:', error);
        return res.status(500).json({ error: 'Failed to fetch chat rooms' });
    }
}
