// Set Top Badge API - Set user's display badge
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { BADGES } from './index.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { badgeId } = req.body;

        // Allow clearing top badge
        if (badgeId === null || badgeId === '') {
            const usersCollection = await getCollection('users');
            await usersCollection.updateOne(
                { _id: user._id },
                { $unset: { topBadge: '' } }
            );

            return res.status(200).json({
                success: true,
                topBadge: null
            });
        }

        if (!badgeId) {
            return res.status(400).json({ error: 'Badge ID required' });
        }

        // Verify badge exists
        const badge = BADGES.find(b => b.id === badgeId);
        if (!badge) {
            return res.status(400).json({ error: 'Invalid badge ID' });
        }

        // Verify user has unlocked this badge
        const userBadgesCollection = await getCollection('user_badges');
        const userBadge = await userBadgesCollection.findOne({
            userId: user._id,
            badgeId: badgeId
        });

        if (!userBadge) {
            return res.status(403).json({ error: 'You have not unlocked this badge' });
        }

        // Set as top badge
        const usersCollection = await getCollection('users');
        await usersCollection.updateOne(
            { _id: user._id },
            { $set: { topBadge: badgeId } }
        );

        return res.status(200).json({
            success: true,
            topBadge: {
                id: badge.id,
                icon: badge.icon,
                name: badge.name
            }
        });
    } catch (error) {
        console.error('Set top badge error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
