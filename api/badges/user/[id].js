// User Badges API - Get a user's badge collection
import { getCollection } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { BADGES } from '../index.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'User ID required' });
        }

        let userId;
        try {
            userId = new ObjectId(id);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const usersCollection = await getCollection('users');
        const userBadgesCollection = await getCollection('user_badges');

        // Get user
        const user = await usersCollection.findOne(
            { _id: userId },
            { projection: { username: 1, displayName: 1, topBadge: 1, badgeCount: 1 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's unlocked badges
        const unlockedBadges = await userBadgesCollection.find({ userId }).toArray();
        const unlockedMap = new Map(unlockedBadges.map(b => [b.badgeId, b]));

        // Build badge collection with unlock status
        const badgeCollection = BADGES.map(badge => {
            const unlocked = unlockedMap.get(badge.id);
            return {
                id: badge.id,
                icon: badge.icon,
                name: badge.name,
                description: badge.description,
                category: badge.category,
                rarity: badge.rarity,
                ddReward: badge.ddReward,
                isUnlocked: !!unlocked,
                unlockedAt: unlocked?.unlockedAt || null
            };
        });

        // Get top badge info
        let topBadgeInfo = null;
        if (user.topBadge) {
            const badge = BADGES.find(b => b.id === user.topBadge);
            if (badge) {
                topBadgeInfo = {
                    id: badge.id,
                    icon: badge.icon,
                    name: badge.name
                };
            }
        }

        // Group badges by category
        const badgesByCategory = {
            activity: badgeCollection.filter(b => b.category === 'activity'),
            milestone: badgeCollection.filter(b => b.category === 'milestone'),
            team: badgeCollection.filter(b => b.category === 'team')
        };

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                topBadge: topBadgeInfo,
                badgeCount: unlockedBadges.length
            },
            badges: badgeCollection,
            badgesByCategory,
            totalBadges: BADGES.length,
            unlockedCount: unlockedBadges.length
        });
    } catch (error) {
        console.error('User badges error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
