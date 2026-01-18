// Admin Content - Source Stats / Leaderboard
// GET: Get stats on which sources get published the most

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

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
        // Authenticate admin
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const admin = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!admin?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const curated = await getCollection('curated_content');

        // Aggregate published content by source
        const stats = await curated.aggregate([
            {
                $match: { status: 'published' }
            },
            {
                $group: {
                    _id: '$sourceName',
                    count: { $sum: 1 },
                    lastPublished: { $max: '$curatedAt' }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 50
            }
        ]).toArray();

        // Get total published count
        const totalPublished = await curated.countDocuments({ status: 'published' });

        res.status(200).json({
            success: true,
            totalPublished,
            leaderboard: stats.map((s, index) => ({
                rank: index + 1,
                sourceName: s._id || 'Unknown',
                publishedCount: s.count,
                lastPublished: s.lastPublished,
                percentage: totalPublished > 0 ? ((s.count / totalPublished) * 100).toFixed(1) : 0
            }))
        });
    } catch (error) {
        console.error('Source stats error:', error);
        res.status(500).json({ error: 'Failed to get source stats' });
    }
}
