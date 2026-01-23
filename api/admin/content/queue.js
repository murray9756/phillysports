// Admin Content Queue API
// GET: Get pending content items for review
// POST: Manually add item to queue
// PATCH: Publish or skip a queue item

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import { fetchOEmbed, detectPlatform, extractYouTubeId, getVideoThumbnail } from '../../lib/oembed.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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

        const queue = await getCollection('content_queue');
        const curated = await getCollection('curated_content');

        if (req.method === 'GET') {
            const { status = 'pending', type, limit = 50, offset = 0 } = req.query;

            const filter = {};
            if (status) filter.status = status;
            if (type) filter.type = type;

            const items = await queue
                .find(filter)
                .sort({ fetchedAt: -1 })
                .skip(parseInt(offset))
                .limit(parseInt(limit))
                .toArray();

            const total = await queue.countDocuments(filter);

            // Get counts by status
            const counts = await queue.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray();

            const statusCounts = { pending: 0, published: 0, skipped: 0 };
            counts.forEach(c => {
                if (c._id) statusCounts[c._id] = c.count;
            });

            res.status(200).json({
                items: items.map(item => ({
                    _id: item._id.toString(),
                    sourceId: item.sourceId?.toString(),
                    sourceName: item.sourceName,
                    sourceUrl: item.sourceUrl,
                    type: item.type,
                    title: item.title,
                    description: item.description,
                    thumbnail: item.thumbnail,
                    author: item.author,
                    publishedAt: item.publishedAt,
                    fetchedAt: item.fetchedAt,
                    status: item.status,
                    teams: item.teams
                })),
                total,
                statusCounts
            });
        } else if (req.method === 'POST') {
            // Manually add an item to the queue
            const { sourceUrl, sourceName, type, title, description, thumbnail, author, publishedAt } = req.body;

            if (!sourceUrl || !title || !type) {
                return res.status(400).json({ error: 'sourceUrl, title, and type are required' });
            }

            // Check for duplicate
            const existing = await queue.findOne({ sourceUrl });
            if (existing) {
                return res.status(400).json({ error: 'This URL is already in the queue' });
            }

            const newItem = {
                sourceId: null, // Manual entry
                sourceName: sourceName || 'Manual',
                sourceUrl,
                type,
                title,
                description: description || null,
                thumbnail: thumbnail || null,
                author: author || null,
                publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
                fetchedAt: new Date(),
                status: 'pending',
                addedBy: new ObjectId(decoded.userId)
            };

            const result = await queue.insertOne(newItem);

            res.status(201).json({
                success: true,
                item: {
                    _id: result.insertedId.toString(),
                    ...newItem
                }
            });
        } else if (req.method === 'PATCH') {
            // Publish or skip an item
            const {
                itemId,
                action,  // 'publish' or 'skip'
                // For publishing:
                curatorNote,
                curatorReview,
                teams,
                featured,
                featuredOnPages,
                imageUrl,
                thumbnail,  // Accept both imageUrl and thumbnail
                contentType  // article, podcast, video, tweet, picture
            } = req.body;

            if (!itemId) {
                return res.status(400).json({ error: 'itemId required' });
            }

            if (!['publish', 'skip'].includes(action)) {
                return res.status(400).json({ error: 'action must be "publish" or "skip"' });
            }

            const item = await queue.findOne({ _id: new ObjectId(itemId) });
            if (!item) {
                return res.status(404).json({ error: 'Queue item not found' });
            }

            if (item.status !== 'pending') {
                return res.status(400).json({ error: 'Item has already been processed' });
            }

            if (action === 'skip') {
                // Delete the item from queue - no need to keep skipped items
                await queue.deleteOne({ _id: new ObjectId(itemId) });

                return res.status(200).json({ success: true, action: 'skipped' });
            }

            // Publish the item
            const finalType = contentType || item.type || 'article';

            // For video content (tiktok, youtube), fetch oEmbed data
            let embedData = null;
            let finalThumbnail = thumbnail || imageUrl || item.thumbnail;
            const platform = detectPlatform(item.sourceUrl);

            if (finalType === 'tiktok' || finalType === 'youtube' || finalType === 'video') {
                if (platform === 'tiktok' || platform === 'youtube') {
                    embedData = await fetchOEmbed(item.sourceUrl);

                    // Use oEmbed thumbnail if no custom thumbnail provided
                    if (!finalThumbnail && embedData?.thumbnailUrl) {
                        finalThumbnail = embedData.thumbnailUrl;
                    }

                    // For YouTube, we can generate a predictable thumbnail URL
                    if (!finalThumbnail && platform === 'youtube') {
                        finalThumbnail = getVideoThumbnail(item.sourceUrl);
                    }
                }
            }

            const curatedItem = {
                type: finalType,
                sourceUrl: item.sourceUrl,
                sourceName: item.sourceName,
                title: embedData?.title || item.title,
                description: item.description,
                thumbnail: finalThumbnail,
                author: embedData?.authorName || item.author,
                authorUrl: embedData?.authorUrl || null,
                publishedAt: item.publishedAt,
                curatedAt: new Date(),
                curatedBy: new ObjectId(decoded.userId),
                curatorUsername: admin.username,
                curatorNote: curatorNote || null,
                curatorReview: curatorReview || null,
                teams: teams || ['eagles', 'phillies', 'sixers', 'flyers'],
                featured: featured || false,
                featuredOnPages: featuredOnPages || [],
                status: 'published',
                // Video embed data
                platform: platform,
                embedHtml: embedData?.embedHtml || null,
                embedWidth: embedData?.width || null,
                embedHeight: embedData?.height || null
            };

            // If setting as featured, unfeatured any existing featured items for those pages
            if (featured && featuredOnPages?.length > 0) {
                await curated.updateMany(
                    {
                        featured: true,
                        featuredOnPages: { $in: featuredOnPages }
                    },
                    {
                        $set: { featured: false },
                        $pull: { featuredOnPages: { $in: featuredOnPages } }
                    }
                );
            }

            const result = await curated.insertOne(curatedItem);

            // Delete the queue item - content is now in curated_content
            await queue.deleteOne({ _id: new ObjectId(itemId) });

            res.status(200).json({
                success: true,
                action: 'published',
                content: {
                    _id: result.insertedId.toString(),
                    ...curatedItem
                }
            });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Admin content queue error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
}
