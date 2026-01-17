// Get source statistics for leaderboard
import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { period, limit } = req.query;
        const maxResults = Math.min(parseInt(limit) || 25, 100);

        const sourcesCollection = await getCollection('source_stats');
        const clicksCollection = await getCollection('article_clicks');

        // Get time filter for period
        let timeFilter = {};
        const now = new Date();

        if (period === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            timeFilter = { clickedAt: { $gte: startOfDay } };
        } else if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            timeFilter = { clickedAt: { $gte: weekAgo } };
        } else if (period === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            timeFilter = { clickedAt: { $gte: monthAgo } };
        }

        let sources = [];

        if (Object.keys(timeFilter).length > 0) {
            // Aggregate clicks for the time period
            sources = await clicksCollection.aggregate([
                { $match: timeFilter },
                {
                    $group: {
                        _id: '$source',
                        totalClicks: { $sum: 1 },
                        lastClickAt: { $max: '$clickedAt' }
                    }
                },
                { $sort: { totalClicks: -1 } },
                { $limit: maxResults },
                {
                    $project: {
                        source: '$_id',
                        totalClicks: 1,
                        lastClickAt: 1,
                        _id: 0
                    }
                }
            ]).toArray();
        } else {
            // Get all-time stats
            sources = await sourcesCollection
                .find({})
                .sort({ totalClicks: -1 })
                .limit(maxResults)
                .toArray();
        }

        // Add rank
        sources = sources.map((s, index) => ({
            rank: index + 1,
            source: s.source,
            totalClicks: s.totalClicks,
            lastClickAt: s.lastClickAt
        }));

        // Get total clicks across all sources
        const totalStats = await sourcesCollection.aggregate([
            { $group: { _id: null, totalClicks: { $sum: '$totalClicks' }, sourceCount: { $sum: 1 } } }
        ]).toArray();

        return res.status(200).json({
            success: true,
            sources: sources,
            totalClicks: totalStats[0]?.totalClicks || 0,
            sourceCount: totalStats[0]?.sourceCount || 0,
            period: period || 'all-time'
        });
    } catch (error) {
        console.error('Source stats error:', error);
        return res.status(500).json({ error: 'Failed to get source stats' });
    }
}
