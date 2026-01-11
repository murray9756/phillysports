const { ObjectId } = require('mongodb');
const { getCollection } = require('../lib/mongodb');
const { authenticate } = require('../lib/auth');
const { validateProfileUpdate, sanitizeString } = require('../lib/validate');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Authenticate user
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { displayName, bio, favoriteTeam, profilePhoto } = req.body;

        // Validate input
        const validation = validateProfileUpdate({ bio, favoriteTeam });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
        }

        const users = await getCollection('users');
        const userId = new ObjectId(decoded.userId);

        // Build update object with only provided fields
        const updateFields = { updatedAt: new Date() };

        if (displayName !== undefined) {
            updateFields.displayName = sanitizeString(displayName, 50);
        }

        if (bio !== undefined) {
            updateFields.bio = sanitizeString(bio, 500);
        }

        if (favoriteTeam !== undefined) {
            updateFields.favoriteTeam = favoriteTeam?.toLowerCase() || null;
        }

        if (profilePhoto !== undefined) {
            // For simplicity, we're storing as URL or base64
            // In production, you'd want to upload to a storage service
            updateFields.profilePhoto = profilePhoto;
        }

        // Update user
        await users.updateOne(
            { _id: userId },
            { $set: updateFields }
        );

        // Get updated user
        const updatedUser = await users.findOne(
            { _id: userId },
            { projection: { password: 0 } }
        );

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                ...updatedUser,
                _id: updatedUser._id.toString()
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};
