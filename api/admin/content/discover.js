// Admin Content Source Discovery API
// POST: Discover RSS feeds and metadata from a URL

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

// Common RSS feed paths to try
const COMMON_RSS_PATHS = [
    '/feed',
    '/rss',
    '/feed.xml',
    '/rss.xml',
    '/atom.xml',
    '/feeds/posts/default',
    '/blog/feed',
    '/news/feed',
    '/feed/rss',
    '/rss/feed',
    '/index.xml',
    '/?feed=rss2',
    '/rss2',
];

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

        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Normalize URL
        let baseUrl;
        try {
            baseUrl = new URL(url);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const result = await discoverSource(baseUrl.href);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Source discovery error:', error);
        res.status(500).json({ error: 'Failed to discover source' });
    }
}

async function discoverSource(url) {
    const baseUrl = new URL(url);
    const origin = baseUrl.origin;

    // Step 1: Fetch the page and look for RSS links
    let pageHtml = '';
    let pageTitle = '';
    let pageDescription = '';
    let foundFeeds = [];
    let siteLogos = [];

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PhillySports/1.0 (+https://phillysports.com)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';

        // If the URL itself is an RSS feed
        if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
            const feedInfo = await validateFeed(url);
            if (feedInfo.valid) {
                // Try to get logos from the origin site
                siteLogos = await extractSiteLogos(origin);
                return {
                    success: true,
                    source: {
                        name: feedInfo.title || extractDomain(url),
                        type: 'rss',
                        feedUrl: url,
                        category: guessCategory(feedInfo.title, feedInfo.description),
                        description: feedInfo.description,
                        itemCount: feedInfo.itemCount,
                        logos: siteLogos
                    },
                    message: 'RSS feed detected directly'
                };
            }
        }

        pageHtml = await response.text();

        // Extract page metadata
        pageTitle = extractMeta(pageHtml, 'og:site_name') ||
                    extractMeta(pageHtml, 'og:title') ||
                    extractTitle(pageHtml) ||
                    extractDomain(url);

        pageDescription = extractMeta(pageHtml, 'og:description') ||
                         extractMeta(pageHtml, 'description') ||
                         '';

        // Extract site logos from the page
        siteLogos = extractLogosFromHtml(pageHtml, origin);

        // Look for RSS/Atom links in the HTML
        foundFeeds = extractFeedLinks(pageHtml, origin);

    } catch (error) {
        console.error('Failed to fetch page:', error.message);
    }

    // Step 2: Validate found feed links
    for (const feedUrl of foundFeeds) {
        const feedInfo = await validateFeed(feedUrl);
        if (feedInfo.valid) {
            return {
                success: true,
                source: {
                    name: feedInfo.title || pageTitle || extractDomain(url),
                    type: 'rss',
                    feedUrl: feedUrl,
                    category: guessCategory(feedInfo.title, feedInfo.description || pageDescription),
                    description: feedInfo.description || pageDescription,
                    itemCount: feedInfo.itemCount,
                    logos: siteLogos
                },
                message: 'RSS feed found in page'
            };
        }
    }

    // Step 3: Try common RSS paths
    for (const path of COMMON_RSS_PATHS) {
        const testUrl = origin + path;
        const feedInfo = await validateFeed(testUrl);
        if (feedInfo.valid) {
            return {
                success: true,
                source: {
                    name: feedInfo.title || pageTitle || extractDomain(url),
                    type: 'rss',
                    feedUrl: testUrl,
                    category: guessCategory(feedInfo.title, feedInfo.description || pageDescription),
                    description: feedInfo.description || pageDescription,
                    itemCount: feedInfo.itemCount,
                    logos: siteLogos
                },
                message: `RSS feed found at ${path}`
            };
        }
    }

    // Step 4: Try to scrape articles from the page
    if (pageHtml) {
        const articles = scrapeArticles(pageHtml, origin);
        if (articles.length > 0) {
            return {
                success: true,
                source: {
                    name: pageTitle || extractDomain(url),
                    type: 'scrape',
                    feedUrl: url,
                    category: guessCategory(pageTitle, pageDescription),
                    description: pageDescription,
                    itemCount: articles.length,
                    sampleArticles: articles.slice(0, 3),
                    logos: siteLogos
                },
                message: `No RSS found, but detected ${articles.length} article links. Scraping may work.`,
                warning: 'Scraping is less reliable than RSS feeds'
            };
        }
    }

    // Step 5: Nothing found
    return {
        success: false,
        error: 'Could not find RSS feed or scrapable content',
        suggestions: [
            'Try adding /feed or /rss to the URL',
            'Check if the site has a dedicated RSS page',
            'Some sites require authentication or block automated access'
        ],
        metadata: {
            name: pageTitle || extractDomain(url),
            description: pageDescription,
            logos: siteLogos
        }
    };
}

// Extract logos from HTML page
function extractLogosFromHtml(html, origin) {
    const logos = [];
    const seen = new Set();

    // 1. Apple touch icons (usually high quality)
    const appleTouchRegex = /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/gi;
    let match;
    while ((match = appleTouchRegex.exec(html)) !== null) {
        const url = makeAbsolute(match[1], origin);
        if (!seen.has(url)) {
            logos.push({ url, type: 'apple-touch-icon', priority: 1 });
            seen.add(url);
        }
    }

    // 2. og:image (site's chosen social image)
    const ogImage = extractMeta(html, 'og:image');
    if (ogImage) {
        const url = makeAbsolute(ogImage, origin);
        if (!seen.has(url)) {
            logos.push({ url, type: 'og:image', priority: 2 });
            seen.add(url);
        }
    }

    // 3. Favicons (32x32 or larger preferred)
    const faviconRegex = /<link[^>]+rel=["'](?:icon|shortcut icon)[^"']*["'][^>]+href=["']([^"']+)["']/gi;
    while ((match = faviconRegex.exec(html)) !== null) {
        const url = makeAbsolute(match[1], origin);
        // Skip tiny favicons
        if (!url.includes('16x16') && !seen.has(url)) {
            logos.push({ url, type: 'favicon', priority: 3 });
            seen.add(url);
        }
    }

    // 4. Look for logo in header/nav images
    const headerLogoRegex = /<(?:header|nav)[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/(?:header|nav)>/gi;
    while ((match = headerLogoRegex.exec(html)) !== null) {
        const url = makeAbsolute(match[1], origin);
        if (!seen.has(url)) {
            logos.push({ url, type: 'header-logo', priority: 4 });
            seen.add(url);
        }
    }

    // 5. Images with "logo" in class/id/alt/src
    const logoImgRegex = /<img[^>]+(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']|<img[^>]+src=["']([^"']*logo[^"']+)["']/gi;
    while ((match = logoImgRegex.exec(html)) !== null) {
        const url = makeAbsolute(match[1] || match[2], origin);
        if (!seen.has(url)) {
            logos.push({ url, type: 'logo-class', priority: 5 });
            seen.add(url);
        }
    }

    // 6. Default favicon path
    const defaultFavicon = origin + '/favicon.ico';
    if (!seen.has(defaultFavicon)) {
        logos.push({ url: defaultFavicon, type: 'default-favicon', priority: 6 });
    }

    // Sort by priority and return top 6
    return logos.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

// Fetch logos from a site (when we only have the origin, not the HTML)
async function extractSiteLogos(origin) {
    try {
        const response = await fetch(origin, {
            headers: {
                'User-Agent': 'PhillySports/1.0 (+https://phillysports.com)',
                'Accept': 'text/html'
            },
            redirect: 'follow'
        });

        if (response.ok) {
            const html = await response.text();
            return extractLogosFromHtml(html, origin);
        }
    } catch (e) {
        console.error('Failed to fetch logos from origin:', e.message);
    }

    // Return default favicon as fallback
    return [{ url: origin + '/favicon.ico', type: 'default-favicon', priority: 6 }];
}

function makeAbsolute(url, origin) {
    if (!url) return origin + '/favicon.ico';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return origin + url;
    if (url.startsWith('http')) return url;
    return origin + '/' + url;
}

async function validateFeed(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PhillySports/1.0 (+https://phillysports.com)',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            return { valid: false };
        }

        const text = await response.text();

        // Check if it's valid RSS/Atom
        const isRss = text.includes('<rss') || text.includes('<feed') || text.includes('<channel>');
        if (!isRss) {
            return { valid: false };
        }

        // Extract feed info
        const title = extractTag(text, 'title');
        const description = extractTag(text, 'description') || extractTag(text, 'subtitle');

        // Count items
        const itemMatches = text.match(/<item[^>]*>|<entry[^>]*>/gi) || [];

        return {
            valid: true,
            title: cleanText(title),
            description: cleanText(description),
            itemCount: itemMatches.length
        };
    } catch (error) {
        return { valid: false };
    }
}

function extractFeedLinks(html, origin) {
    const feeds = [];

    // Look for <link rel="alternate" type="application/rss+xml">
    const linkRegex = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
    const links = html.match(linkRegex) || [];

    for (const link of links) {
        if (link.includes('rss') || link.includes('atom') || link.includes('feed')) {
            const hrefMatch = link.match(/href=["']([^"']+)["']/i);
            if (hrefMatch) {
                let feedUrl = hrefMatch[1];
                // Make absolute URL
                if (feedUrl.startsWith('/')) {
                    feedUrl = origin + feedUrl;
                } else if (!feedUrl.startsWith('http')) {
                    feedUrl = origin + '/' + feedUrl;
                }
                feeds.push(feedUrl);
            }
        }
    }

    // Also look for <a> links to feeds
    const aRegex = /<a[^>]+href=["']([^"']*(?:rss|feed|atom)[^"']*)["'][^>]*>/gi;
    let match;
    while ((match = aRegex.exec(html)) !== null) {
        let feedUrl = match[1];
        if (feedUrl.startsWith('/')) {
            feedUrl = origin + feedUrl;
        } else if (!feedUrl.startsWith('http')) {
            feedUrl = origin + '/' + feedUrl;
        }
        if (!feeds.includes(feedUrl)) {
            feeds.push(feedUrl);
        }
    }

    return feeds;
}

function scrapeArticles(html, origin) {
    const articles = [];

    // Look for common article patterns
    const patterns = [
        // <article> tags
        /<article[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/article>/gi,
        // Cards with headlines
        /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*(?:article|post|story|headline|news)[^"']*["'][^>]*>/gi,
        // h2/h3 inside links
        /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<h[23][^>]*>[\s\S]*?<\/h[23]>[\s\S]*?<\/a>/gi
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            let url = match[1];
            // Filter out non-article links
            if (url.includes('#') || url.includes('javascript:') ||
                url.includes('/tag/') || url.includes('/category/') ||
                url.includes('/author/') || url.includes('/page/')) {
                continue;
            }
            // Make absolute
            if (url.startsWith('/')) {
                url = origin + url;
            } else if (!url.startsWith('http')) {
                url = origin + '/' + url;
            }
            // Dedupe
            if (!articles.includes(url) && url.includes(origin)) {
                articles.push(url);
            }
        }
    }

    return articles.slice(0, 10);
}

function extractMeta(html, name) {
    // Try property first (og:tags)
    const propRegex = new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const propMatch = html.match(propRegex);
    if (propMatch) return propMatch[1];

    // Try name
    const nameRegex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const nameMatch = html.match(nameRegex);
    if (nameMatch) return nameMatch[1];

    // Try reversed order (content before name)
    const revRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i');
    const revMatch = html.match(revRegex);
    if (revMatch) return revMatch[1];

    return null;
}

function extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? cleanText(match[1]) : null;
}

function extractTag(xml, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? (match[1] || match[2])?.trim() : null;
}

function cleanText(text) {
    if (!text) return null;
    return text
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function extractDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        // Remove www. and get readable name
        return hostname.replace(/^www\./, '').split('.')[0];
    } catch {
        return 'Unknown';
    }
}

function guessCategory(title, description) {
    const text = ((title || '') + ' ' + (description || '')).toLowerCase();

    if (text.includes('podcast') || text.includes('audio') || text.includes('listen')) {
        return 'podcast';
    }
    if (text.includes('video') || text.includes('youtube') || text.includes('watch')) {
        return 'video';
    }
    if (text.includes('twitter') || text.includes('tweet') || text.includes('social')) {
        return 'social';
    }
    return 'news';
}
