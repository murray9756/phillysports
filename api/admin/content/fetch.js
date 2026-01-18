// Admin Content Fetch API
// POST: Fetch content from all active sources (or specific source)

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

// Simple RSS parser - no external dependencies
async function parseRSS(feedUrl) {
    try {
        const response = await fetch(feedUrl, {
            headers: {
                'User-Agent': 'PhillySports/1.0 (+https://phillysports.com)'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const xml = await response.text();
        const items = [];

        // Extract items from RSS feed using regex (simple approach)
        const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

        for (const itemXml of itemMatches.slice(0, 20)) { // Limit to 20 items
            const title = extractTag(itemXml, 'title');
            const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
            const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded');
            const pubDate = extractTag(itemXml, 'pubDate');
            const author = extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator');

            // Try to find image
            let thumbnail = null;
            const mediaContent = itemXml.match(/url=["']([^"']+\.(jpg|jpeg|png|gif|webp))/i);
            if (mediaContent) {
                thumbnail = mediaContent[1];
            } else {
                const imgMatch = description?.match(/src=["']([^"']+\.(jpg|jpeg|png|gif|webp))/i);
                if (imgMatch) {
                    thumbnail = imgMatch[1];
                }
            }

            if (title && link) {
                items.push({
                    title: cleanText(title),
                    sourceUrl: link,
                    description: cleanText(description)?.substring(0, 500),
                    thumbnail,
                    author: cleanText(author),
                    publishedAt: pubDate ? new Date(pubDate) : null  // Don't fake dates
                });
            }
        }

        return items;
    } catch (error) {
        console.error(`Error fetching RSS ${feedUrl}:`, error.message);
        return [];
    }
}

function extractTag(xml, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? (match[1] || match[2])?.trim() : null;
}

function cleanText(text) {
    if (!text) return null;
    return text
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
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

        const { sourceId } = req.body;

        const sourcesCollection = await getCollection('content_sources');
        const queue = await getCollection('content_queue');
        const curated = await getCollection('curated_content');

        // Get sources to fetch
        const filter = { active: true, type: 'rss' };
        if (sourceId) {
            filter._id = new ObjectId(sourceId);
        }

        const sources = await sourcesCollection.find(filter).toArray();

        if (sources.length === 0) {
            return res.status(404).json({ error: 'No active RSS sources found' });
        }

        let totalFetched = 0;
        let totalNew = 0;
        let totalAutoPublished = 0;
        const results = [];

        for (const source of sources) {
            if (!source.feedUrl) continue;

            console.log(`Fetching: ${source.name}, teams: ${JSON.stringify(source.teams)}, feedUrl: ${source.feedUrl}`);

            const items = await parseRSS(source.feedUrl);
            totalFetched += items.length;

            let newItems = 0;
            let autoPublished = 0;
            let skippedNoDate = 0;
            let skippedOld = 0;

            // Only include items from the last 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            for (const item of items) {
                // Skip items without a valid date
                if (!item.publishedAt || !(item.publishedAt instanceof Date) || isNaN(item.publishedAt.getTime())) {
                    skippedNoDate++;
                    continue;
                }
                // Skip items older than 24 hours
                if (item.publishedAt < oneDayAgo) {
                    skippedOld++;
                    continue;
                }

                // Check if already in queue or published
                const existingInQueue = await queue.findOne({ sourceUrl: item.sourceUrl });
                const existingInCurated = await curated.findOne({ sourceUrl: item.sourceUrl });
                if (existingInQueue || existingInCurated) continue;

                // If source is set to auto-publish, go directly to curated_content
                // But only if the content is newer than when the source was added
                if (source.autoPublish) {
                    const sourceCreatedAt = source.createdAt || new Date(0);
                    if (item.publishedAt < sourceCreatedAt) {
                        // Skip old content - only auto-publish new posts
                        continue;
                    }
                    await curated.insertOne({
                        type: source.category,
                        sourceUrl: item.sourceUrl,
                        sourceName: source.name,
                        sourceLogoUrl: source.logoUrl || null,
                        title: item.title,
                        description: item.description,
                        thumbnail: item.thumbnail || source.logoUrl || null,
                        author: item.author,
                        publishedAt: item.publishedAt,
                        curatedAt: new Date(),
                        curatedBy: null, // Auto-published
                        curatorUsername: null,
                        curatorNote: null,
                        curatorReview: null,
                        teams: source.teams || ['eagles', 'phillies', 'sixers', 'flyers'],
                        featured: false,
                        featuredOnPages: [],
                        status: 'published',
                        autoPublished: true
                    });

                    autoPublished++;
                    totalAutoPublished++;
                } else {
                    // Add to queue for manual review
                    // Use source's teams as default categories
                    await queue.insertOne({
                        sourceId: source._id,
                        sourceName: source.name,
                        sourceLogoUrl: source.logoUrl || null,
                        sourceUrl: item.sourceUrl,
                        type: source.category,
                        title: item.title,
                        description: item.description,
                        thumbnail: item.thumbnail,
                        author: item.author,
                        publishedAt: item.publishedAt,
                        fetchedAt: new Date(),
                        status: 'pending',
                        teams: source.teams || []
                    });
                }

                newItems++;
                totalNew++;
            }

            // Update last fetched time
            await sourcesCollection.updateOne(
                { _id: source._id },
                { $set: { lastFetched: new Date() } }
            );

            console.log(`Source ${source.name}: fetched=${items.length}, skippedNoDate=${skippedNoDate}, skippedOld=${skippedOld}, new=${newItems}`);

            results.push({
                source: source.name,
                fetched: items.length,
                skippedNoDate,
                skippedOld,
                new: newItems,
                autoPublished: autoPublished
            });
        }

        res.status(200).json({
            success: true,
            totalSources: sources.length,
            totalFetched,
            totalNew,
            totalAutoPublished,
            results
        });
    } catch (error) {
        console.error('Admin content fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
}
