// Founders List API
// GET: Get list of all founders (public)

import { getCollection } from '../lib/mongodb.js';
import { FOUNDERS_CLUB_LIMIT } from '../lib/subscriptions.js';

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
        const users = await getCollection('users');

        // Get all founders, sorted by founder number
        const founders = await users.find(
            { founderNumber: { $exists: true, $ne: null } },
            {
                projection: {
                    username: 1,
                    founderNumber: 1,
                    founderJoinedAt: 1,
                    avatar: 1
                }
            }
        ).sort({ founderNumber: 1 }).toArray();

        const foundersList = founders.map(f => ({
            number: f.founderNumber,
            username: f.username,
            joinedAt: f.founderJoinedAt,
            avatar: f.avatar || null
        }));

        res.status(200).json({
            success: true,
            founders: foundersList,
            stats: {
                current: foundersList.length,
                limit: FOUNDERS_CLUB_LIMIT,
                spotsRemaining: Math.max(0, FOUNDERS_CLUB_LIMIT - foundersList.length),
                percentFull: Math.round((foundersList.length / FOUNDERS_CLUB_LIMIT) * 100)
            }
        });
    } catch (error) {
        console.error('Founders list error:', error);
        res.status(500).json({ error: 'Failed to get founders list' });
    }
}
