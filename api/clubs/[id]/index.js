// Single Club API
// GET /api/clubs/[id] - Get club details
// PUT /api/clubs/[id] - Update club (owner/admin only)
// DELETE /api/clubs/[id] - Delete club (owner only)

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import {
    validateClubData,
    formatClub,
    canManageClub,
    isClubOwner,
    getClubRole
} from '../../lib/social.js';

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
        return handleGetClub(req, res, id);
    }

    if (req.method === 'PUT') {
        return handleUpdateClub(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleDeleteClub(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetClub(req, res, clubId) {
    try {
        const clubs = await getCollection('fan_clubs');

        // Get club with owner and member info
        const results = await clubs.aggregate([
            { $match: { _id: new ObjectId(clubId) } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'ownerId',
                    foreignField: '_id',
                    as: 'ownerInfo'
                }
            },
            { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();

        if (results.length === 0) {
            return res.status(404).json({ error: 'Club not found' });
        }

        const club = results[0];

        // Check if user is authenticated to show membership status
        const auth = await authenticate(req);
        let userMembership = null;
        if (auth) {
            const member = club.members?.find(m => m.userId.toString() === auth.userId);
            if (member) {
                userMembership = {
                    role: member.role,
                    status: member.status,
                    joinedAt: member.joinedAt
                };
            }
        }

        // Get recent members (limit to 10 for preview)
        const recentMembers = (club.members || [])
            .filter(m => m.status === 'active')
            .slice(0, 10)
            .map(m => ({
                userId: m.userId.toString(),
                username: m.username,
                displayName: m.displayName,
                profilePhoto: m.profilePhoto,
                role: m.role,
                joinedAt: m.joinedAt
            }));

        return res.status(200).json({
            success: true,
            club: {
                ...formatClub(club),
                owner: club.ownerInfo ? {
                    userId: club.ownerInfo._id.toString(),
                    username: club.ownerInfo.username,
                    displayName: club.ownerInfo.displayName,
                    profilePhoto: club.ownerInfo.profilePhoto
                } : null,
                recentMembers,
                userMembership
            }
        });

    } catch (error) {
        console.error('Get club error:', error);
        return res.status(500).json({ error: 'Failed to fetch club' });
    }
}

async function handleUpdateClub(req, res, clubId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permissions
        const canManage = await canManageClub(clubId, auth.userId);
        if (!canManage) {
            return res.status(403).json({ error: 'You do not have permission to update this club' });
        }

        const { name, description, team, type, tags, socialLinks, coverImage, logoImage, settings } = req.body;

        // Validate input
        const errors = validateClubData({ name, description, team, type });
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        const clubs = await getCollection('fan_clubs');

        // Build update object
        const updateData = {
            updatedAt: new Date()
        };

        if (name) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim().substring(0, 500);
        if (team) updateData.team = team;
        if (type) updateData.type = type;
        if (coverImage !== undefined) updateData.coverImage = coverImage;
        if (logoImage !== undefined) updateData.logoImage = logoImage;
        if (Array.isArray(tags)) {
            updateData.tags = tags.slice(0, 10).map(t => t.toLowerCase().trim());
        }
        if (socialLinks) {
            updateData.socialLinks = {
                facebook: socialLinks.facebook || null,
                twitter: socialLinks.twitter || null,
                instagram: socialLinks.instagram || null,
                discord: socialLinks.discord || null
            };
        }
        if (settings) {
            updateData['settings.allowMemberEvents'] = settings.allowMemberEvents ?? true;
            updateData['settings.requireApproval'] = settings.requireApproval ?? false;
            updateData['settings.allowInvites'] = settings.allowInvites ?? true;
        }

        const result = await clubs.findOneAndUpdate(
            { _id: new ObjectId(clubId) },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Club not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Club updated successfully',
            club: formatClub(result)
        });

    } catch (error) {
        console.error('Update club error:', error);
        return res.status(500).json({ error: 'Failed to update club' });
    }
}

async function handleDeleteClub(req, res, clubId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Only owner can delete
        const isOwner = await isClubOwner(clubId, auth.userId);
        if (!isOwner) {
            return res.status(403).json({ error: 'Only the club owner can delete this club' });
        }

        const clubs = await getCollection('fan_clubs');

        const result = await clubs.deleteOne({ _id: new ObjectId(clubId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Club not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Club deleted successfully'
        });

    } catch (error) {
        console.error('Delete club error:', error);
        return res.status(500).json({ error: 'Failed to delete club' });
    }
}
