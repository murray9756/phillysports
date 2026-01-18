// Admin Content Sources API
// GET: List all content sources
// POST: Add new content source
// PATCH: Update content source
// DELETE: Remove content source

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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

        const sources = await getCollection('content_sources');

        if (req.method === 'GET') {
            const { type, active } = req.query;

            const filter = {};
            if (type) filter.type = type;
            if (active !== undefined) filter.active = active === 'true';

            const items = await sources
                .find(filter)
                .sort({ name: 1 })
                .toArray();

            res.status(200).json({
                sources: items.map(s => ({
                    _id: s._id.toString(),
                    name: s.name,
                    type: s.type,
                    feedUrl: s.feedUrl,
                    logoUrl: s.logoUrl,
                    category: s.category,
                    teams: s.teams || [],
                    active: s.active,
                    autoPublish: s.autoPublish || false,
                    lastFetched: s.lastFetched,
                    createdAt: s.createdAt
                })),
                total: items.length
            });
        } else if (req.method === 'POST') {
            const { name, type, feedUrl, logoUrl, category, teams, autoPublish } = req.body;

            if (!name || !type) {
                return res.status(400).json({ error: 'Name and type are required' });
            }

            if (!['rss', 'youtube', 'twitter', 'manual'].includes(type)) {
                return res.status(400).json({ error: 'Invalid type. Must be rss, youtube, twitter, or manual' });
            }

            if (!['news', 'podcast', 'video', 'social'].includes(category)) {
                return res.status(400).json({ error: 'Invalid category. Must be news, podcast, video, or social' });
            }

            const newSource = {
                name,
                type,
                feedUrl: feedUrl || null,
                logoUrl: logoUrl || null,
                category,
                teams: teams || ['eagles', 'phillies', 'sixers', 'flyers'],
                active: true,
                autoPublish: autoPublish || false,
                lastFetched: null,
                createdAt: new Date(),
                createdBy: new ObjectId(decoded.userId)
            };

            const result = await sources.insertOne(newSource);

            res.status(201).json({
                success: true,
                source: {
                    _id: result.insertedId.toString(),
                    ...newSource
                }
            });
        } else if (req.method === 'PATCH') {
            const { sourceId, name, type, feedUrl, logoUrl, category, teams, active, autoPublish } = req.body;

            if (!sourceId) {
                return res.status(400).json({ error: 'sourceId required' });
            }

            const update = { updatedAt: new Date() };
            if (name !== undefined) update.name = name;
            if (type !== undefined) update.type = type;
            if (feedUrl !== undefined) update.feedUrl = feedUrl;
            if (logoUrl !== undefined) update.logoUrl = logoUrl;
            if (category !== undefined) update.category = category;
            if (teams !== undefined) update.teams = teams;
            if (active !== undefined) update.active = active;
            if (autoPublish !== undefined) update.autoPublish = autoPublish;

            const result = await sources.findOneAndUpdate(
                { _id: new ObjectId(sourceId) },
                { $set: update },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Source not found' });
            }

            res.status(200).json({
                success: true,
                source: {
                    _id: result._id.toString(),
                    name: result.name,
                    type: result.type,
                    feedUrl: result.feedUrl,
                    logoUrl: result.logoUrl,
                    category: result.category,
                    teams: result.teams,
                    active: result.active,
                    autoPublish: result.autoPublish || false
                }
            });
        } else if (req.method === 'DELETE') {
            const { sourceId } = req.body;

            if (!sourceId) {
                return res.status(400).json({ error: 'sourceId required' });
            }

            const result = await sources.deleteOne({ _id: new ObjectId(sourceId) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Source not found' });
            }

            res.status(200).json({ success: true });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Admin content sources error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
}
