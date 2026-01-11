import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

// Default badges if collection is empty
const DEFAULT_BADGES = [
    // Team Fan Badges (100 coins each)
    { _id: 'eagles_fan', name: 'Eagles Fan', icon: '🦅', cost: 100, rarity: 'common', category: 'team', description: 'Show your Eagles pride!' },
    { _id: 'phillies_fan', name: 'Phillies Fan', icon: '⚾', cost: 100, rarity: 'common', category: 'team', description: 'Ring the bell for the Fightins!' },
    { _id: 'sixers_fan', name: 'Sixers Fan', icon: '🏀', cost: 100, rarity: 'common', category: 'team', description: 'Trust the Process!' },
    { _id: 'flyers_fan', name: 'Flyers Fan', icon: '🏒', cost: 100, rarity: 'common', category: 'team', description: 'Broad Street Bullies!' },

    // Achievement Badges (earned, not purchased)
    { _id: 'early_adopter', name: 'Early Adopter', icon: '🌟', cost: 0, rarity: 'rare', category: 'achievement', description: 'Joined during the early days' },
    { _id: 'super_commenter', name: 'Super Commenter', icon: '💬', cost: 0, rarity: 'rare', category: 'achievement', description: 'Posted 100+ comments' },
    { _id: 'streak_master', name: 'Streak Master', icon: '🔥', cost: 0, rarity: 'epic', category: 'achievement', description: '30-day login streak' },

    // Premium Badges (500 coins each)
    { _id: 'philly_sports_vip', name: 'Philly Sports VIP', icon: '👑', cost: 500, rarity: 'rare', category: 'premium', description: 'A true Philly sports supporter' },
    { _id: 'prediction_pro', name: 'Prediction Pro', icon: '🎯', cost: 500, rarity: 'rare', category: 'premium', description: 'Master of game predictions' },
    { _id: 'tailgate_king', name: 'Tailgate King', icon: '🍖', cost: 500, rarity: 'rare', category: 'premium', description: 'Life of the parking lot party' },

    // Epic Badges (1000 coins each)
    { _id: 'championship_dreamer', name: 'Championship Dreamer', icon: '🏆', cost: 1000, rarity: 'epic', category: 'premium', description: 'Believes in all Philly teams' },
    { _id: 'philly_phanatic', name: 'Philly Phanatic', icon: '💚', cost: 1000, rarity: 'epic', category: 'premium', description: 'Ultimate Philly fan status' },

    // Legendary Badge (5000 coins)
    { _id: 'philly_legend', name: 'Philly Legend', icon: '⭐', cost: 5000, rarity: 'legendary', category: 'legendary', description: 'The ultimate Philly sports status' }
];

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const badgesCollection = db.collection('badges');

        // Check if badges exist, if not seed them
        const count = await badgesCollection.countDocuments();
        if (count === 0) {
            await badgesCollection.insertMany(DEFAULT_BADGES);
        }

        // Get all badges
        const badges = await badgesCollection.find({}).toArray();

        // Group by category
        const grouped = {
            team: badges.filter(b => b.category === 'team'),
            premium: badges.filter(b => b.category === 'premium'),
            legendary: badges.filter(b => b.category === 'legendary'),
            achievement: badges.filter(b => b.category === 'achievement')
        };

        res.status(200).json({
            badges,
            grouped,
            success: true
        });
    } catch (error) {
        console.error('Shop fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch shop items' });
    } finally {
        await client.close();
    }
}
