import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const users = await getCollection('users');
        let user;

        if (ObjectId.isValid(id)) {
            user = await users.findOne(
                { _id: new ObjectId(id) },
                { projection: { password: 0, email: 0, notifications: 0 } }
            );
        }

        if (!user) {
            user = await users.findOne(
                { username: id.toLowerCase() },
                { projection: { password: 0, email: 0, notifications: 0 } }
            );
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Determine subscription tier name for display
        const tierNames = {
            'diehard_plus': 'Diehard+',
            'diehard_pro': 'Diehard Pro'
        };
        const subscriptionTier = user.subscriptionTier || 'free';
        const isSubscribed = subscriptionTier !== 'free' && user.subscriptionStatus === 'active';

        res.status(200).json({
            user: {
                _id: user._id.toString(),
                username: user.username,
                displayName: user.displayName,
                favoriteTeam: user.favoriteTeam,
                profilePhoto: user.profilePhoto,
                bio: user.bio,
                following: user.following?.map(id => id.toString()) || [],
                followers: user.followers?.map(id => id.toString()) || [],
                savedArticles: user.savedArticles || [],
                createdAt: user.createdAt,
                // Subscription fields (public)
                subscriptionTier,
                subscriptionTierName: tierNames[subscriptionTier] || 'Free',
                isSubscribed
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
}
