// Admin Content - Quick Add
// POST: Add any URL (video, article, blog post) directly to the queue for curation

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import { fetchOEmbed, detectPlatform, getVideoThumbnail } from '../../lib/oembed.js';

// Fetch Open Graph meta tags from a URL
async function fetchOpenGraph(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PhillySports/1.0 (+https://phillysports.com)'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Extract og:meta tags
        const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
                          html.match(/<title[^>]*>([^<]+)<\/title>/i);

        const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ||
                         html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

        const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

        const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);

        const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']author["']/i);

        const publishedMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i);

        // Try to find favicon/logo - prefer larger icons
        const appleTouchIcon = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i) ||
                               html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i);
        const largeIcon = html.match(/<link[^>]*rel=["']icon["'][^>]*sizes=["'](\d+)x\d+["'][^>]*href=["']([^"']+)["']/i);
        const faviconMatch = appleTouchIcon ||
                            (largeIcon ? { 1: largeIcon[2] } : null) ||
                            html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i) ||
                            html.match(/<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i);

        // Clean and decode HTML entities
        const cleanText = (text) => {
            if (!text) return null;
            return text
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#x27;/g, "'")
                .replace(/&#x2F;/g, '/')
                .trim();
        };

        // Resolve relative URLs
        const resolveUrl = (relativeUrl) => {
            if (!relativeUrl) return null;
            if (relativeUrl.startsWith('http')) return relativeUrl;
            try {
                const base = new URL(url);
                return new URL(relativeUrl, base).href;
            } catch {
                return relativeUrl;
            }
        };

        // Use Google's favicon service as fallback (returns 128px icon)
        let favicon = resolveUrl(faviconMatch?.[1]);
        if (!favicon) {
            try {
                const domain = new URL(url).hostname;
                favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
            } catch {}
        }

        return {
            title: cleanText(titleMatch?.[1]),
            description: cleanText(descMatch?.[1])?.substring(0, 500),
            image: resolveUrl(imageMatch?.[1]),
            siteName: cleanText(siteNameMatch?.[1]),
            author: cleanText(authorMatch?.[1]),
            publishedAt: publishedMatch?.[1] ? new Date(publishedMatch[1]) : null,
            favicon
        };
    } catch (error) {
        console.error('OpenGraph fetch error:', error.message);
        return { error: error.message };
    }
}

// Extract domain name from URL for default source name
function extractDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        // Remove www. prefix and get domain name
        return hostname.replace(/^www\./, '').split('.')[0];
    } catch {
        return 'Unknown';
    }
}

// Capitalize first letter
function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
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

        const {
            url,
            sourceName: providedSourceName,
            sourceLogoUrl: providedLogoUrl,
            contentType: providedType,
            addToQueue = true
        } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Check if URL already exists in queue or curated content
        const queue = await getCollection('content_queue');
        const curated = await getCollection('curated_content');

        const existingInQueue = await queue.findOne({ sourceUrl: url });
        const existingInCurated = await curated.findOne({ sourceUrl: url });

        if (existingInQueue) {
            return res.status(409).json({
                error: 'This content is already in your curation queue',
                existingId: existingInQueue._id.toString()
            });
        }

        if (existingInCurated) {
            return res.status(409).json({
                error: 'This content has already been published',
                existingId: existingInCurated._id.toString()
            });
        }

        // Detect if it's a video platform
        const platform = detectPlatform(url);
        let queueItem;

        if (platform) {
            // Video platform (YouTube, TikTok) - use oEmbed
            const embedData = await fetchOEmbed(url);

            if (embedData.error) {
                console.warn('oEmbed fetch warning:', embedData.error);
            }

            queueItem = {
                sourceId: null,
                sourceName: providedSourceName || (platform === 'youtube' ? 'YouTube' : 'TikTok'),
                sourceLogoUrl: providedLogoUrl || null,
                sourceUrl: url,
                type: platform,
                title: embedData.title || `${platform === 'youtube' ? 'YouTube' : 'TikTok'} Video`,
                description: null,
                thumbnail: embedData.thumbnail || (platform === 'youtube' ? getVideoThumbnail(url) : null),
                author: embedData.author || null,
                authorUrl: embedData.authorUrl || null,
                publishedAt: new Date(),
                fetchedAt: new Date(),
                status: 'pending',
                platform: platform,
                embedHtml: embedData.html || null,
                embedWidth: embedData.width || null,
                embedHeight: embedData.height || null,
                addedBy: admin._id,
                addedByUsername: admin.username
            };
        } else {
            // Regular URL (article, blog post, etc.) - use OpenGraph
            const ogData = await fetchOpenGraph(url);

            if (ogData.error) {
                console.warn('OpenGraph fetch warning:', ogData.error);
            }

            // Determine source name: provided > og:site_name > domain
            const sourceName = providedSourceName || ogData.siteName || capitalize(extractDomain(url));

            queueItem = {
                sourceId: null,
                sourceName: sourceName,
                sourceLogoUrl: providedLogoUrl || ogData.favicon || null,
                sourceUrl: url,
                type: providedType || 'article',
                title: ogData.title || 'Untitled Article',
                description: ogData.description || null,
                thumbnail: ogData.image || null,
                author: ogData.author || null,
                authorUrl: null,
                publishedAt: ogData.publishedAt || new Date(),
                fetchedAt: new Date(),
                status: 'pending',
                platform: null,
                embedHtml: null,
                embedWidth: null,
                embedHeight: null,
                addedBy: admin._id,
                addedByUsername: admin.username
            };
        }

        if (addToQueue) {
            // Add to queue for review
            const result = await queue.insertOne(queueItem);

            return res.status(200).json({
                success: true,
                message: platform ? 'Video added to curation queue' : 'Article added to curation queue',
                isVideo: !!platform,
                item: {
                    _id: result.insertedId.toString(),
                    ...queueItem
                }
            });
        } else {
            // Direct publish (skip queue)
            const curatedItem = {
                type: queueItem.type,
                sourceUrl: url,
                sourceName: queueItem.sourceName,
                sourceLogoUrl: queueItem.sourceLogoUrl,
                title: queueItem.title,
                description: queueItem.description,
                thumbnail: queueItem.thumbnail,
                author: queueItem.author,
                authorUrl: queueItem.authorUrl,
                publishedAt: queueItem.publishedAt,
                curatedAt: new Date(),
                curatedBy: admin._id,
                curatorUsername: admin.username,
                curatorNote: null,
                curatorReview: null,
                teams: ['eagles', 'phillies', 'sixers', 'flyers'],
                featured: false,
                featuredOnPages: [],
                status: 'published',
                platform: queueItem.platform,
                embedHtml: queueItem.embedHtml,
                embedWidth: queueItem.embedWidth,
                embedHeight: queueItem.embedHeight
            };

            const result = await curated.insertOne(curatedItem);

            return res.status(200).json({
                success: true,
                message: 'Content published directly',
                isVideo: !!platform,
                item: {
                    _id: result.insertedId.toString(),
                    ...curatedItem
                }
            });
        }
    } catch (error) {
        console.error('Quick add error:', error);
        res.status(500).json({ error: 'Failed to add content' });
    }
}
