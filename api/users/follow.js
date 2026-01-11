const { ObjectId } = require('mongodb');
const { getCollection } = require('../lib/mongodb');
const { authenticate } = require('../lib/auth');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Authenticate user
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: 'Target user ID is required' });
        }

        if (!ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const currentUserId = new ObjectId(decoded.userId);
        const targetId = new ObjectId(targetUserId);

        // Can't follow yourself
        if (currentUserId.equals(targetId)) {
            return res.status(400).json({ error: 'You cannot follow yourself' });
        }

        const users = await getCollection('users');

        // Check if target user exists
        const targetUser = await users.findOne({ _id: targetId });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if already following
        const currentUser = await users.findOne({ _id: currentUserId });
        const isFollowing = currentUser.following?.some(id => id.equals(targetId));

        if (isFollowing) {
            // Unfollow
            await users.updateOne(
                { _id: currentUserId },
                { $pull: { following: targetId } }
            );
            await users.updateOne(
                { _id: targetId },
                { $pull: { followers: currentUserId } }
            );

            res.status(200).json({
                message: 'Unfollowed successfully',
                following: false
            });
        } else {
            // Follow
            await users.updateOne(
                { _id: currentUserId },
                { $addToSet: { following: targetId } }
            );
            await users.updateOne(
                { _id: targetId },
                {
                    $addToSet: { followers: currentUserId },
                    $push: {
                        notifications: {
                            type: 'follow',
                            message: `${currentUser.displayName || currentUser.username} started following you`,
                            fromUserId: currentUserId,
                            read: false,
                            createdAt: new Date()
                        }
                    }
                }
            );

            res.status(200).json({
                message: 'Followed successfully',
                following: true
            });
        }
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ error: 'Failed to update follow status' });
    }
};
