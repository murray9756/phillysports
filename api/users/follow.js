import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

export default async function handler(req, res) {
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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: 'Target user ID is required' });
        }

        if (targetUserId === decoded.userId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const users = await getCollection('users');
        const currentUserId = new ObjectId(decoded.userId);
        const targetId = new ObjectId(targetUserId);

        const targetUser = await users.findOne({ _id: targetId });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentUser = await users.findOne({ _id: currentUserId });
        const isFollowing = currentUser.following?.some(id => id.toString() === targetUserId);

        if (isFollowing) {
            await users.updateOne(
                { _id: currentUserId },
                { $pull: { following: targetId }, $set: { updatedAt: new Date() } }
            );
            await users.updateOne(
                { _id: targetId },
                { $pull: { followers: currentUserId }, $set: { updatedAt: new Date() } }
            );

            res.status(200).json({ message: 'Unfollowed successfully', following: false });
        } else {
            await users.updateOne(
                { _id: currentUserId },
                { $addToSet: { following: targetId }, $set: { updatedAt: new Date() } }
            );
            await users.updateOne(
                { _id: targetId },
                { $addToSet: { followers: currentUserId }, $set: { updatedAt: new Date() } }
            );

            res.status(200).json({ message: 'Followed successfully', following: true });
        }
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ error: 'Failed to follow/unfollow user' });
    }
}
