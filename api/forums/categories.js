// Forum Categories API
// GET /api/forums/categories - List all categories by team

import { getCollection } from '../lib/mongodb.js';
import { TEAMS, seedForumCategories } from '../lib/community.js';

export default async function handler(req, res) {
    // Set CORS headers
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
        const { team } = req.query;

        // Validate team if provided
        if (team && !TEAMS.includes(team)) {
            return res.status(400).json({ error: 'Invalid team. Must be one of: ' + TEAMS.join(', ') });
        }

        const categories = await getCollection('forum_categories');

        // Seed categories if none exist
        const count = await categories.countDocuments();
        if (count === 0) {
            await seedForumCategories();
        }

        // Build query
        const query = { isActive: true };
        if (team) {
            query.team = team;
        }

        // Get categories
        const results = await categories.find(query)
            .sort({ team: 1, sortOrder: 1 })
            .toArray();

        // Get post counts for each category
        const posts = await getCollection('forum_posts');
        const postCounts = await posts.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$categoryId', count: { $sum: 1 } } }
        ]).toArray();

        const countMap = {};
        postCounts.forEach(pc => {
            countMap[pc._id.toString()] = pc.count;
        });

        // Format response
        const formatted = results.map(cat => ({
            id: cat._id.toString(),
            team: cat.team,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            postCount: countMap[cat._id.toString()] || 0
        }));

        // Group by team if no specific team requested
        if (!team) {
            const grouped = {};
            TEAMS.forEach(t => {
                grouped[t] = formatted.filter(c => c.team === t);
            });
            return res.status(200).json({ categories: grouped });
        }

        return res.status(200).json({ categories: formatted });

    } catch (error) {
        console.error('Forum categories error:', error);
        return res.status(500).json({ error: 'Failed to fetch categories' });
    }
}
