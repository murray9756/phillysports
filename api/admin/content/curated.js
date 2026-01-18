// Admin Curated Content Management API
// GET: List all curated content
// PATCH: Update curated content
// DELETE: Archive/remove curated content

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
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

        const curated = await getCollection('curated_content');

        if (req.method === 'GET') {
            const { status = 'published', type, team, featured, limit = 50, offset = 0 } = req.query;

            const filter = {};
            if (status) filter.status = status;
            if (type) filter.type = type;
            if (team) filter.teams = team;
            if (featured === 'true') filter.featured = true;

            const items = await curated
                .find(filter)
                .sort({ curatedAt: -1 })
                .skip(parseInt(offset))
                .limit(parseInt(limit))
                .toArray();

            const total = await curated.countDocuments(filter);

            // Get counts by type
            const typeCounts = await curated.aggregate([
                { $match: { status: 'published' } },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]).toArray();

            const counts = { news: 0, podcast: 0, video: 0, social: 0 };
            typeCounts.forEach(c => {
                if (c._id) counts[c._id] = c.count;
            });

            res.status(200).json({
                items: items.map(item => ({
                    _id: item._id.toString(),
                    type: item.type,
                    sourceUrl: item.sourceUrl,
                    sourceName: item.sourceName,
                    title: item.title,
                    description: item.description,
                    thumbnail: item.thumbnail,
                    author: item.author,
                    publishedAt: item.publishedAt,
                    curatedAt: item.curatedAt,
                    curatorUsername: item.curatorUsername,
                    curatorNote: item.curatorNote,
                    curatorReview: item.curatorReview,
                    teams: item.teams,
                    featured: item.featured,
                    featuredOnPages: item.featuredOnPages,
                    status: item.status
                })),
                total,
                typeCounts: counts
            });
        } else if (req.method === 'PATCH') {
            const {
                contentId,
                curatorNote,
                curatorReview,
                teams,
                featured,
                featuredOnPages,
                thumbnail,
                status
            } = req.body;

            if (!contentId) {
                return res.status(400).json({ error: 'contentId required' });
            }

            const update = { updatedAt: new Date() };
            if (curatorNote !== undefined) update.curatorNote = curatorNote;
            if (curatorReview !== undefined) update.curatorReview = curatorReview;
            if (teams !== undefined) update.teams = teams;
            if (thumbnail !== undefined) update.thumbnail = thumbnail;
            if (status !== undefined) update.status = status;

            // Handle featured update
            if (featured !== undefined) {
                update.featured = featured;
                if (featured && featuredOnPages?.length > 0) {
                    update.featuredOnPages = featuredOnPages;
                    update.featuredAt = new Date();

                    // Unfeatured any existing featured items for those pages
                    await curated.updateMany(
                        {
                            _id: { $ne: new ObjectId(contentId) },
                            featured: true,
                            featuredOnPages: { $in: featuredOnPages }
                        },
                        {
                            $set: { featured: false },
                            $pull: { featuredOnPages: { $in: featuredOnPages } }
                        }
                    );
                } else if (!featured) {
                    update.featuredOnPages = [];
                }
            }

            const result = await curated.findOneAndUpdate(
                { _id: new ObjectId(contentId) },
                { $set: update },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Content not found' });
            }

            res.status(200).json({
                success: true,
                content: {
                    _id: result._id.toString(),
                    title: result.title,
                    curatorNote: result.curatorNote,
                    curatorReview: result.curatorReview,
                    teams: result.teams,
                    featured: result.featured,
                    featuredOnPages: result.featuredOnPages,
                    status: result.status
                }
            });
        } else if (req.method === 'DELETE') {
            const { contentId } = req.body;

            if (!contentId) {
                return res.status(400).json({ error: 'contentId required' });
            }

            // Soft delete - change status to archived
            const result = await curated.findOneAndUpdate(
                { _id: new ObjectId(contentId) },
                {
                    $set: {
                        status: 'archived',
                        archivedAt: new Date(),
                        archivedBy: new ObjectId(decoded.userId)
                    }
                },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Content not found' });
            }

            res.status(200).json({ success: true });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Admin curated content error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
}
