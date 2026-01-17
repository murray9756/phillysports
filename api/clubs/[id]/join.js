// Join Club API
// POST /api/clubs/[id]/join - Join a club

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserInfo } from '../../lib/community.js';
import { isClubMember, awardFirstClubBonus } from '../../lib/social.js';

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

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid club ID' });
    }

    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const clubs = await getCollection('fan_clubs');

        // Get club
        const club = await clubs.findOne({ _id: new ObjectId(id) });
        if (!club) {
            return res.status(404).json({ error: 'Club not found' });
        }

        // Check if already a member
        const isMember = await isClubMember(id, auth.userId);
        if (isMember) {
            return res.status(400).json({ error: 'You are already a member of this club' });
        }

        // Check if user has pending request
        const hasPendingRequest = club.members?.some(
            m => m.userId.toString() === auth.userId && m.status === 'pending'
        );
        if (hasPendingRequest) {
            return res.status(400).json({ error: 'Your membership request is pending approval' });
        }

        // Check if club is full
        if (club.maxMembers && club.memberCount >= club.maxMembers) {
            return res.status(400).json({ error: 'This club is full' });
        }

        // Check club type and determine status
        const userInfo = await getUserInfo(auth.userId);
        const now = new Date();

        let memberStatus = 'active';
        let message = 'You have joined the club!';

        if (club.type === 'private' && club.settings?.requireApproval) {
            memberStatus = 'pending';
            message = 'Your membership request has been submitted for approval';
        } else if (club.type === 'invite-only') {
            return res.status(403).json({ error: 'This club is invite-only' });
        }

        const newMember = {
            userId: new ObjectId(auth.userId),
            username: userInfo.username,
            displayName: userInfo.displayName,
            profilePhoto: userInfo.profilePhoto,
            role: 'member',
            joinedAt: now,
            status: memberStatus
        };

        // Add member to club
        const updateResult = await clubs.updateOne(
            { _id: new ObjectId(id) },
            {
                $push: { members: newMember },
                $inc: { memberCount: memberStatus === 'active' ? 1 : 0 },
                $set: { updatedAt: now }
            }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(500).json({ error: 'Failed to join club' });
        }

        // Check if this is user's first club and award bonus
        let bonusAwarded = null;
        if (memberStatus === 'active') {
            // Count user's active club memberships
            const userClubs = await clubs.countDocuments({
                'members.userId': new ObjectId(auth.userId),
                'members.status': 'active'
            });

            if (userClubs === 1) {
                bonusAwarded = await awardFirstClubBonus(auth.userId);
            }
        }

        return res.status(200).json({
            success: true,
            message,
            status: memberStatus,
            coinsAwarded: bonusAwarded?.amount || 0
        });

    } catch (error) {
        console.error('Join club error:', error);
        return res.status(500).json({ error: 'Failed to join club' });
    }
}
