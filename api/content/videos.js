// Public Videos API
// GET: Get curated video content (YouTube, TikTok) for display

import { getCollection } from '../lib/mongodb.js';

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
        const {
            team,           // Filter by team
            platform,       // Filter by platform (youtube, tiktok)
            limit = 10,
            offset = 0
        } = req.query;

        const curated = await getCollection('curated_content');

        // Build filter for video content
        const filter = {
            status: 'published',
            type: { $in: ['youtube', 'tiktok', 'video'] }
        };

        if (team) {
            filter.teams = team;
        }

        if (platform) {
            if (platform === 'youtube') {
                filter.type = 'youtube';
            } else if (platform === 'tiktok') {
                filter.type = 'tiktok';
            }
        }

        const videos = await curated
            .find(filter)
            .sort({ curatedAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .toArray();

        const total = await curated.countDocuments(filter);

        const formatVideo = (item) => ({
            _id: item._id.toString(),
            type: item.type,
            platform: item.platform,
            sourceUrl: item.sourceUrl,
            title: item.title,
            description: item.description,
            thumbnail: item.thumbnail,
            author: item.author,
            authorUrl: item.authorUrl,
            curatedAt: item.curatedAt,
            curatorReview: item.curatorReview,
            teams: item.teams,
            embedHtml: item.embedHtml,
            embedWidth: item.embedWidth,
            embedHeight: item.embedHeight
        });

        res.status(200).json({
            videos: videos.map(formatVideo),
            total,
            hasMore: parseInt(offset) + videos.length < total
        });
    } catch (error) {
        console.error('Videos API error:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
}
