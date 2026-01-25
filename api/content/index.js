// Public Curated Content API
// GET: Get curated content for display on site

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
            team,           // Filter by single team (legacy, eagles, phillies, sixers, flyers)
            teams,          // Filter by multiple teams (comma-separated, OR logic)
            type,           // Filter by type (news, podcast, video, social)
            featured,       // Get only featured content
            page = 'home',  // Which page to get featured for
            limit = 20,
            offset = 0
        } = req.query;

        const curated = await getCollection('curated_content');

        // Build filter
        const filter = { status: 'published' };

        // Support both single team (legacy) and multiple teams (new OR filter)
        if (teams) {
            // Multiple teams - use $in for OR filtering
            const teamList = teams.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
            if (teamList.length > 0) {
                filter.teams = { $in: teamList };
            }
        } else if (team) {
            filter.teams = team;
        }

        if (type) {
            // Map filter types to actual database types
            if (type === 'video') {
                // Videos can be youtube, tiktok, or video
                filter.type = { $in: ['video', 'youtube', 'tiktok'] };
            } else if (type === 'article') {
                // Articles can be article or news
                filter.type = { $in: ['article', 'news'] };
            } else {
                filter.type = type;
            }
        }

        if (featured === 'true') {
            filter.featured = true;
            filter.featuredOnPages = page;
        }

        // Get featured item separately if not explicitly requesting featured only
        let featuredItem = null;
        if (featured !== 'true' && featured !== 'false') {
            const featuredFilter = {
                status: 'published',
                featured: true,
                featuredOnPages: page
            };
            // Apply team filter to featured item (supports both single and multi)
            if (teams) {
                const teamList = teams.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                if (teamList.length > 0) {
                    featuredFilter.teams = { $in: teamList };
                }
            } else if (team) {
                featuredFilter.teams = team;
            }
            // Apply type filter to featured item
            if (type) {
                if (type === 'video') {
                    featuredFilter.type = { $in: ['video', 'youtube', 'tiktok'] };
                } else if (type === 'article') {
                    featuredFilter.type = { $in: ['article', 'news'] };
                } else {
                    featuredFilter.type = type;
                }
            }

            featuredItem = await curated.findOne(featuredFilter);
        }

        // Get content list
        const listFilter = { ...filter };
        if (featured !== 'true') {
            // Exclude the featured item from the list
            if (featuredItem) {
                listFilter._id = { $ne: featuredItem._id };
            }
            delete listFilter.featured;
            delete listFilter.featuredOnPages;
        }

        const items = await curated
            .find(listFilter)
            .sort({ curatedAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .toArray();

        const total = await curated.countDocuments(listFilter);

        const formatItem = (item) => ({
            _id: item._id.toString(),
            type: item.type,
            sourceUrl: item.sourceUrl,
            sourceName: item.sourceName,
            title: item.title,
            description: item.description,
            thumbnail: item.thumbnail,
            author: item.author,
            authorUrl: item.authorUrl,
            publishedAt: item.publishedAt,
            curatedAt: item.curatedAt,
            curatorUsername: item.curatorUsername,
            curatorNote: item.curatorNote,
            curatorReview: item.curatorReview,
            teams: item.teams,
            featured: item.featured,
            // Video embed data
            platform: item.platform,
            embedHtml: item.embedHtml,
            embedWidth: item.embedWidth,
            embedHeight: item.embedHeight
        });

        res.status(200).json({
            featured: featuredItem ? formatItem(featuredItem) : null,
            items: items.map(formatItem),
            total,
            hasMore: parseInt(offset) + items.length < total
        });
    } catch (error) {
        console.error('Curated content error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
}
