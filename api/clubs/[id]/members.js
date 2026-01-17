// Club Members API
// GET /api/clubs/[id]/members - List club members
// PUT /api/clubs/[id]/members - Update member role (admin only)
// DELETE /api/clubs/[id]/members - Remove member (admin only)

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { canManageClub, isClubOwner, formatMember } from '../../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid club ID' });
    }

    if (req.method === 'GET') {
        return handleGetMembers(req, res, id);
    }

    if (req.method === 'PUT') {
        return handleUpdateMember(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleRemoveMember(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetMembers(req, res, clubId) {
    try {
        const { status, role, page = 1, limit = 50 } = req.query;

        const clubs = await getCollection('fan_clubs');
        const club = await clubs.findOne({ _id: new ObjectId(clubId) });

        if (!club) {
            return res.status(404).json({ error: 'Club not found' });
        }

        // Filter and paginate members
        let members = club.members || [];

        if (status) {
            members = members.filter(m => m.status === status);
        }
        if (role) {
            members = members.filter(m => m.role === role);
        }

        const total = members.length;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const paginatedMembers = members.slice(skip, skip + limitNum);

        return res.status(200).json({
            success: true,
            members: paginatedMembers.map(m => formatMember(m)),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get members error:', error);
        return res.status(500).json({ error: 'Failed to fetch members' });
    }
}

async function handleUpdateMember(req, res, clubId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const canManage = await canManageClub(clubId, auth.userId);
        if (!canManage) {
            return res.status(403).json({ error: 'You do not have permission to manage members' });
        }

        const { userId, role, status } = req.body;

        if (!userId || !ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Cannot modify owner
        const clubs = await getCollection('fan_clubs');
        const club = await clubs.findOne({ _id: new ObjectId(clubId) });

        if (!club) {
            return res.status(404).json({ error: 'Club not found' });
        }

        const targetMember = club.members?.find(m => m.userId.toString() === userId);
        if (!targetMember) {
            return res.status(404).json({ error: 'Member not found' });
        }

        if (targetMember.role === 'owner') {
            return res.status(403).json({ error: 'Cannot modify the club owner' });
        }

        // Only owner can promote to admin
        if (role === 'admin') {
            const isOwner = await isClubOwner(clubId, auth.userId);
            if (!isOwner) {
                return res.status(403).json({ error: 'Only the owner can promote members to admin' });
            }
        }

        // Build update
        const updateFields = {};
        if (role && ['admin', 'moderator', 'member'].includes(role)) {
            updateFields['members.$.role'] = role;

            // Update admins array
            if (role === 'admin') {
                await clubs.updateOne(
                    { _id: new ObjectId(clubId) },
                    { $addToSet: { admins: new ObjectId(userId) } }
                );
            } else {
                await clubs.updateOne(
                    { _id: new ObjectId(clubId) },
                    { $pull: { admins: new ObjectId(userId) } }
                );
            }
        }
        if (status && ['active', 'pending', 'banned'].includes(status)) {
            updateFields['members.$.status'] = status;

            // Update member count if status changes
            if (status === 'active' && targetMember.status !== 'active') {
                await clubs.updateOne(
                    { _id: new ObjectId(clubId) },
                    { $inc: { memberCount: 1 } }
                );
            } else if (status !== 'active' && targetMember.status === 'active') {
                await clubs.updateOne(
                    { _id: new ObjectId(clubId) },
                    { $inc: { memberCount: -1 } }
                );
            }
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        updateFields.updatedAt = new Date();

        await clubs.updateOne(
            {
                _id: new ObjectId(clubId),
                'members.userId': new ObjectId(userId)
            },
            { $set: updateFields }
        );

        return res.status(200).json({
            success: true,
            message: 'Member updated successfully'
        });

    } catch (error) {
        console.error('Update member error:', error);
        return res.status(500).json({ error: 'Failed to update member' });
    }
}

async function handleRemoveMember(req, res, clubId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const canManage = await canManageClub(clubId, auth.userId);
        if (!canManage) {
            return res.status(403).json({ error: 'You do not have permission to remove members' });
        }

        const { userId } = req.body;

        if (!userId || !ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const clubs = await getCollection('fan_clubs');
        const club = await clubs.findOne({ _id: new ObjectId(clubId) });

        if (!club) {
            return res.status(404).json({ error: 'Club not found' });
        }

        const targetMember = club.members?.find(m => m.userId.toString() === userId);
        if (!targetMember) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Cannot remove owner
        if (targetMember.role === 'owner') {
            return res.status(403).json({ error: 'Cannot remove the club owner' });
        }

        // Admins can only be removed by owner
        if (targetMember.role === 'admin') {
            const isOwner = await isClubOwner(clubId, auth.userId);
            if (!isOwner) {
                return res.status(403).json({ error: 'Only the owner can remove admins' });
            }
        }

        await clubs.updateOne(
            { _id: new ObjectId(clubId) },
            {
                $pull: {
                    members: { userId: new ObjectId(userId) },
                    admins: new ObjectId(userId)
                },
                $inc: { memberCount: targetMember.status === 'active' ? -1 : 0 },
                $set: { updatedAt: new Date() }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Member removed successfully'
        });

    } catch (error) {
        console.error('Remove member error:', error);
        return res.status(500).json({ error: 'Failed to remove member' });
    }
}
