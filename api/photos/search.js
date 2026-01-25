/**
 * Photo Search API
 * GET /api/photos/search?q=keywords&team=eagles&limit=5
 *
 * Searches the photo database for matching images based on keywords.
 * Used to find relevant thumbnails for news articles.
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { q, team, limit = 1 } = req.query;

    if (!q && !team) {
        return res.status(400).json({ error: 'Search query (q) or team required' });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const photosCollection = db.collection('photos');

        // Build search query
        const query = { status: 'active' };
        const orConditions = [];

        if (q) {
            // Extract keywords from search query (split on spaces, filter short words)
            const searchTerms = q.toLowerCase()
                .split(/\s+/)
                .filter(term => term.length > 2)
                .slice(0, 10); // Limit to 10 terms

            if (searchTerms.length > 0) {
                // Search in keywords array and description
                orConditions.push({
                    keywords: { $in: searchTerms.map(t => new RegExp(t, 'i')) }
                });
                orConditions.push({
                    description: { $regex: searchTerms.join('|'), $options: 'i' }
                });
                orConditions.push({
                    title: { $regex: searchTerms.join('|'), $options: 'i' }
                });
            }
        }

        if (team) {
            orConditions.push({ teams: team.toLowerCase() });
        }

        if (orConditions.length > 0) {
            query.$or = orConditions;
        }

        // Find matching photos, prioritize by relevance score
        const photos = await photosCollection
            .find(query)
            .sort({ priority: -1, usedCount: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .toArray();

        if (photos.length === 0) {
            return res.status(200).json({
                success: true,
                photos: [],
                message: 'No matching photos found'
            });
        }

        // Return photo URLs
        return res.status(200).json({
            success: true,
            photos: photos.map(p => ({
                _id: p._id.toString(),
                url: p.url,
                title: p.title,
                teams: p.teams,
                keywords: p.keywords
            }))
        });

    } catch (error) {
        console.error('Photo search error:', error);
        return res.status(500).json({ error: 'Failed to search photos' });
    } finally {
        await client.close();
    }
}
