// Cron Job: Fetch Content from Sources (RSS, beehiiv, etc.)
// Runs every 15 minutes to pull new content from configured sources
// Protected by Vercel cron secret or admin auth

import { ObjectId } from 'mongodb';
import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';

// Beehiiv newsletter scraper - fetches from sitemap and extracts post metadata
async function parseBeehiiv(sitemapUrl, siteUrl) {
    try {
        const response = await fetch(sitemapUrl, {
            headers: {
                'User-Agent': 'PhillySports/1.0 (+https://phillysports.com)'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const sitemapXml = await response.text();

        // Parse sitemap for post URLs and lastmod dates
        const postMatches = sitemapXml.matchAll(/<loc>([^<]+\/p\/[^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g);
        const posts = [];
        for (const match of postMatches) {
            posts.push({ url: match[1], date: match[2] });
        }

        // Sort by date (most recent first) and take top 10
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentPosts = posts.slice(0, 10);

        // Fetch metadata from each post page
        const items = [];
        for (const post of recentPosts) {
            try {
                const postRes = await fetch(post.url, {
                    headers: {
                        'User-Agent': 'PhillySports/1.0 (+https://phillysports.com)'
                    }
                });
                const postHtml = await postRes.text();

                // Extract meta tags
                const titleMatch = postHtml.match(/<meta property="og:title" content="([^"]+)"/);
                const descMatch = postHtml.match(/<meta property="og:description" content="([^"]+)"/);
                const imageMatch = postHtml.match(/<meta property="og:image" content="([^"]+)"/);

                if (titleMatch) {
                    items.push({
                        title: cleanText(titleMatch[1]),
                        sourceUrl: post.url,
                        description: descMatch ? cleanText(descMatch[1])?.substring(0, 500) : null,
                        thumbnail: imageMatch ? imageMatch[1] : null,
                        author: null,
                        publishedAt: new Date(post.date)
                    });
                }
            } catch (e) {
                console.error('Beehiiv post fetch error:', e.message);
            }
        }

        return items;
    } catch (error) {
        console.error(`Error fetching beehiiv ${sitemapUrl}:`, error.message);
        return [];
    }
}

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

// Verify this is a legitimate cron request
function verifyCronRequest(req) {
    // Vercel cron jobs include this header
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
        return true;
    }

    // Also allow if called from Vercel's internal cron system
    // Vercel sets x-vercel-cron-secret header for cron jobs
    const vercelCronHeader = req.headers['x-vercel-cron-secret'];
    if (vercelCronHeader && vercelCronHeader === cronSecret) {
        return true;
    }

    return false;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET (for cron) or POST (for manual trigger)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify authorization - either cron secret or admin auth
        const isCronRequest = verifyCronRequest(req);
        let isAdminRequest = false;

        if (!isCronRequest) {
            // Try admin authentication for manual triggers
            const decoded = await authenticate(req);
            if (decoded) {
                const users = await getCollection('users');
                const admin = await users.findOne({ _id: new ObjectId(decoded.userId) });
                if (admin?.isAdmin) {
                    isAdminRequest = true;
                }
            }
        }

        // If neither cron nor admin, reject
        if (!isCronRequest && !isAdminRequest) {
            // In development, allow unauthenticated requests
            if (process.env.NODE_ENV !== 'development') {
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }

        const sourcesCollection = await getCollection('content_sources');
        const queue = await getCollection('content_queue');
        const curated = await getCollection('curated_content');

        // Get all active sources (RSS and beehiiv)
        const sources = await sourcesCollection.find({
            active: true,
            type: { $in: ['rss', 'beehiiv'] }
        }).toArray();

        if (sources.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No active sources found',
                totalSources: 0,
                totalFetched: 0,
                totalNew: 0
            });
        }

        let totalFetched = 0;
        let totalNew = 0;
        let totalAutoPublished = 0;
        const results = [];

        for (const source of sources) {
            if (!source.feedUrl) continue;

            console.log(`Fetching from source: ${source.name}, teams: ${JSON.stringify(source.teams)}`);

            // Parse based on source type
            let items = [];
            if (source.type === 'beehiiv') {
                items = await parseBeehiiv(source.feedUrl, source.siteUrl);
            } else {
                items = await parseRSS(source.feedUrl);
            }
            totalFetched += items.length;

            let newItems = 0;
            let autoPublished = 0;

            // Only include items from the last 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            for (const item of items) {
                // Skip items without a valid date or older than 24 hours
                if (!item.publishedAt || !(item.publishedAt instanceof Date) || isNaN(item.publishedAt.getTime())) {
                    console.log(`Skipping item without valid date: ${item.title}`);
                    continue;
                }
                if (item.publishedAt < oneDayAgo) {
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

            results.push({
                source: source.name,
                fetched: items.length,
                new: newItems,
                autoPublished: autoPublished
            });
        }

        // Log the cron run
        console.log(`[Cron] Content fetch completed: ${totalNew} new items from ${sources.length} sources`);

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            totalSources: sources.length,
            totalFetched,
            totalNew,
            totalAutoPublished,
            results
        });
    } catch (error) {
        console.error('Cron content fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
}
