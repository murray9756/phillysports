// Admin Content Sources - Seed Default Sources
// POST: Add default Philly sports news sources to the curation system
// This should only be run once to initialize the sources

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

const DEFAULT_SOURCES = [
    // ===== LOCAL PHILLY SPORTS COVERAGE =====
    {
        name: 'Crossing Broad',
        type: 'rss',
        feedUrl: 'https://www.crossingbroad.com/feed',
        logoUrl: 'https://www.crossingbroad.com/wp-content/uploads/2023/01/cropped-CB-Logo-2023-1-192x192.png',
        category: 'news',
        teams: ['eagles', 'phillies', 'sixers', 'flyers'],
        active: true,
        autoPublish: false,
        description: 'Philadelphia sports blog covering Eagles, Phillies, Sixers, and Flyers'
    },
    {
        name: 'PhillyVoice Sports',
        type: 'rss',
        feedUrl: 'https://www.phillyvoice.com/feed/section/sports/',
        logoUrl: 'https://www.phillyvoice.com/favicon.ico',
        category: 'news',
        teams: ['eagles', 'phillies', 'sixers', 'flyers'],
        active: true,
        autoPublish: false,
        description: 'Philadelphia sports coverage from PhillyVoice'
    },
    {
        name: 'NBC Sports Philadelphia',
        type: 'rss',
        feedUrl: 'https://www.nbcsports.com/philadelphia/rss',
        logoUrl: 'https://www.nbcsports.com/favicon.ico',
        category: 'news',
        teams: ['eagles', 'phillies', 'sixers', 'flyers'],
        active: true,
        autoPublish: false,
        description: 'Official NBC Sports Philadelphia coverage'
    },
    {
        name: 'Philadelphia Inquirer Sports',
        type: 'rss',
        feedUrl: 'https://www.inquirer.com/arcio/rss/category/sports/',
        logoUrl: 'https://www.inquirer.com/favicon.ico',
        category: 'news',
        teams: ['eagles', 'phillies', 'sixers', 'flyers'],
        active: true,
        autoPublish: false,
        description: 'Philadelphia Inquirer sports coverage'
    },

    // ===== EAGLES =====
    {
        name: 'Bleeding Green Nation',
        type: 'rss',
        feedUrl: 'https://www.bleedinggreennation.com/rss/current',
        logoUrl: 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396113/bgn_icon.0.png',
        category: 'news',
        teams: ['eagles'],
        active: true,
        autoPublish: false,
        description: 'Eagles coverage from SB Nation'
    },
    {
        name: 'Eagles Wire',
        type: 'rss',
        feedUrl: 'https://eagleswire.usatoday.com/feed/',
        logoUrl: null,
        category: 'news',
        teams: ['eagles'],
        active: true,
        autoPublish: false,
        description: 'Eagles coverage from USA Today'
    },

    // ===== PHILLIES =====
    {
        name: 'The Good Phight',
        type: 'rss',
        feedUrl: 'https://www.thegoodphight.com/rss/current',
        logoUrl: 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396225/goodphight_icon.0.png',
        category: 'news',
        teams: ['phillies'],
        active: true,
        autoPublish: false,
        description: 'Phillies coverage from SB Nation'
    },
    {
        name: 'Phillies Nation',
        type: 'rss',
        feedUrl: 'https://www.philliesnation.com/feed/',
        logoUrl: null,
        category: 'news',
        teams: ['phillies'],
        active: true,
        autoPublish: false,
        description: 'Phillies news and analysis'
    },

    // ===== SIXERS =====
    {
        name: 'Liberty Ballers',
        type: 'rss',
        feedUrl: 'https://www.libertyballers.com/rss/current',
        logoUrl: 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396183/libballers_icon.0.png',
        category: 'news',
        teams: ['sixers'],
        active: true,
        autoPublish: false,
        description: 'Sixers coverage from SB Nation'
    },
    {
        name: 'Sixers Wire',
        type: 'rss',
        feedUrl: 'https://sixerswire.usatoday.com/feed/',
        logoUrl: null,
        category: 'news',
        teams: ['sixers'],
        active: true,
        autoPublish: false,
        description: 'Sixers coverage from USA Today'
    },

    // ===== FLYERS =====
    {
        name: 'Broad Street Hockey',
        type: 'rss',
        feedUrl: 'https://www.broadstreethockey.com/rss/current',
        logoUrl: 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396071/bsh_icon.0.png',
        category: 'news',
        teams: ['flyers'],
        active: true,
        autoPublish: false,
        description: 'Flyers coverage from SB Nation'
    },
    {
        name: 'Flyers Nation',
        type: 'rss',
        feedUrl: 'https://flyersnation.com/feed/',
        logoUrl: null,
        category: 'news',
        teams: ['flyers'],
        active: true,
        autoPublish: false,
        description: 'Flyers news and analysis'
    },

    // ===== UNION =====
    {
        name: 'Brotherly Game',
        type: 'rss',
        feedUrl: 'https://www.brotherlygame.com/rss/current',
        logoUrl: null,
        category: 'news',
        teams: ['union'],
        active: true,
        autoPublish: false,
        description: 'Philadelphia Union coverage from SB Nation'
    },

    // ===== COLLEGE - BIG 5 + PENN STATE =====
    {
        name: 'VU Hoops (Villanova)',
        type: 'rss',
        feedUrl: 'https://www.vuhoops.com/rss/current',
        logoUrl: null,
        category: 'news',
        teams: ['college'],
        active: true,
        autoPublish: false,
        description: 'Villanova Wildcats basketball coverage from SB Nation'
    },
    {
        name: 'The Owl Prowl (Temple)',
        type: 'rss',
        feedUrl: 'https://theowlprowl.com/feed/',
        logoUrl: null,
        category: 'news',
        teams: ['college'],
        active: true,
        autoPublish: false,
        description: 'Temple Owls coverage'
    },
    {
        name: 'Black Shoe Diaries (Penn State)',
        type: 'rss',
        feedUrl: 'https://www.blackshoediaries.com/rss/current',
        logoUrl: null,
        category: 'news',
        teams: ['college'],
        active: true,
        autoPublish: false,
        description: 'Penn State Nittany Lions coverage from SB Nation'
    },

    // ===== ESPORTS =====
    {
        name: 'Dot Esports',
        type: 'rss',
        feedUrl: 'https://dotesports.com/feed',
        logoUrl: 'https://dotesports.com/favicon.ico',
        category: 'news',
        teams: ['esports'],
        active: true,
        autoPublish: false,
        description: 'Esports news and coverage'
    },
    {
        name: 'The Score Esports',
        type: 'rss',
        feedUrl: 'https://www.thescoreesports.com/feed/esports.rss',
        logoUrl: null,
        category: 'news',
        teams: ['esports'],
        active: true,
        autoPublish: false,
        description: 'Esports coverage from The Score'
    },
    {
        name: 'Dexerto',
        type: 'rss',
        feedUrl: 'https://www.dexerto.com/feed/',
        logoUrl: null,
        category: 'news',
        teams: ['esports'],
        active: true,
        autoPublish: false,
        description: 'Esports and gaming news'
    },

    // ===== NEWSLETTERS (beehiiv) =====
    {
        name: 'Buying Sandlot',
        type: 'beehiiv',
        feedUrl: 'https://www.buyingsandlot.com/sitemap.xml',
        siteUrl: 'https://www.buyingsandlot.com',
        logoUrl: null,
        category: 'newsletter',
        teams: ['youth', 'general'],
        active: true,
        autoPublish: false,
        description: 'Youth sports newsletter covering the business of youth athletics'
    },

    // ===== PODCASTS =====
    {
        name: 'Birds with Friends (Eagles)',
        type: 'rss',
        feedUrl: 'https://feeds.megaphone.fm/birds-with-friends',
        logoUrl: null,
        category: 'podcast',
        teams: ['eagles'],
        active: true,
        autoPublish: false,
        description: 'Eagles podcast'
    },
    {
        name: 'Talkin Baseball (Phillies)',
        type: 'rss',
        feedUrl: 'https://feeds.simplecast.com/CvXJXmRj',
        logoUrl: null,
        category: 'podcast',
        teams: ['phillies'],
        active: true,
        autoPublish: false,
        description: 'MLB and Phillies podcast from Jomboy Media'
    },
    {
        name: 'Ricky and Reds (Phillies)',
        type: 'rss',
        feedUrl: 'https://anchor.fm/s/24badf78/podcast/rss',
        logoUrl: null,
        category: 'podcast',
        teams: ['phillies'],
        active: true,
        autoPublish: false,
        description: 'Phillies fan podcast'
    }
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

        const sourcesCollection = await getCollection('content_sources');

        let added = 0;
        let skipped = 0;
        const results = [];

        for (const source of DEFAULT_SOURCES) {
            // Check if source already exists (by feedUrl)
            const existing = await sourcesCollection.findOne({ feedUrl: source.feedUrl });

            if (existing) {
                skipped++;
                results.push({ name: source.name, status: 'skipped', reason: 'Already exists' });
                continue;
            }

            // Add the source
            await sourcesCollection.insertOne({
                ...source,
                createdAt: new Date(),
                lastFetched: null
            });

            added++;
            results.push({ name: source.name, status: 'added' });
        }

        res.status(200).json({
            success: true,
            message: `Added ${added} sources, skipped ${skipped} existing sources`,
            added,
            skipped,
            results
        });
    } catch (error) {
        console.error('Seed sources error:', error);
        res.status(500).json({ error: 'Failed to seed sources' });
    }
}
