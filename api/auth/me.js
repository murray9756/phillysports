import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(200).json({ user: null });
        }

        const users = await getCollection('users');
        const user = await users.findOne(
            { _id: new ObjectId(decoded.userId) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(200).json({ user: null });
        }

        res.status(200).json({
            user: {
                _id: user._id.toString(),
                username: user.username,
                email: user.email,
                displayName: user.displayName,
                favoriteTeam: user.favoriteTeam,
                profilePhoto: user.profilePhoto,
                bio: user.bio,
                following: user.following?.map(id => id.toString()) || [],
                followers: user.followers?.map(id => id.toString()) || [],
                savedArticles: user.savedArticles || [],
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'Failed to check authentication' });
    }
}
