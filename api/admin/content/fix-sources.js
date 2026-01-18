// Admin Content Sources - Fix Broken URLs and Teams
// POST: Updates existing sources with correct URLs and team categories

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

// Map URLs to correct teams (both old and new URLs)
const URL_FIXES = {
    // SB Nation sites - old URLs
    'https://www.bleedinggreennation.com/rss/current': {
        newUrl: 'https://www.bleedinggreennation.com/rss/index.xml',
        teams: ['eagles']
    },
    'https://www.thegoodphight.com/rss/current': {
        newUrl: 'https://www.thegoodphight.com/rss/index.xml',
        teams: ['phillies']
    },
    'https://www.libertyballers.com/rss/current': {
        newUrl: 'https://www.libertyballers.com/rss/index.xml',
        teams: ['sixers']
    },
    'https://www.broadstreethockey.com/rss/current': {
        newUrl: 'https://www.broadstreethockey.com/rss/index.xml',
        teams: ['flyers']
    },
    'https://www.vuhoops.com/rss/current': {
        newUrl: 'https://www.vuhoops.com/rss/index.xml',
        teams: ['college']
    },
    'https://www.blackshoediaries.com/rss/current': {
        newUrl: 'https://www.blackshoediaries.com/rss/index.xml',
        teams: ['college']
    },

    // SB Nation sites - new URLs (in case already fixed)
    'https://www.bleedinggreennation.com/rss/index.xml': {
        teams: ['eagles']
    },
    'https://www.thegoodphight.com/rss/index.xml': {
        teams: ['phillies']
    },
    'https://www.libertyballers.com/rss/index.xml': {
        teams: ['sixers']
    },
    'https://www.broadstreethockey.com/rss/index.xml': {
        teams: ['flyers']
    },
    'https://www.vuhoops.com/rss/index.xml': {
        teams: ['college']
    },
    'https://www.blackshoediaries.com/rss/index.xml': {
        teams: ['college']
    },

    // Local Philly sources
    'https://www.crossingbroad.com/feed': {
        teams: ['eagles', 'phillies', 'sixers', 'flyers']
    },
    'https://www.phillyvoice.com/feed/section/sports/': {
        teams: ['eagles', 'phillies', 'sixers', 'flyers']
    },
    'https://www.nbcsports.com/philadelphia/rss': {
        teams: ['eagles', 'phillies', 'sixers', 'flyers']
    },
    'https://eagleswire.usatoday.com/feed/': {
        teams: ['eagles']
    },
    'https://www.philliesnation.com/feed/': {
        teams: ['phillies']
    },
    'https://flyersnation.com/feed/': {
        teams: ['flyers']
    },
    'https://dotesports.com/feed': {
        teams: ['esports']
    },
    'https://www.dexerto.com/feed/': {
        teams: ['esports']
    },
    'https://www.buyingsandlot.com/sitemap.xml': {
        teams: ['youth', 'general']
    }
};

// Sources to disable (broken/dead)
const SOURCES_TO_DISABLE = [
    'https://www.inquirer.com/arcio/rss/category/sports/',
    'https://sixerswire.usatoday.com/feed/',
    'https://theowlprowl.com/feed/',
    'https://www.thescoreesports.com/feed/esports.rss',
    'https://feeds.megaphone.fm/birds-with-friends',
    'https://feeds.simplecast.com/CvXJXmRj',
    'https://anchor.fm/s/24badf78/podcast/rss'
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

        let urlsFixed = 0;
        let teamsUpdated = 0;
        let disabled = 0;
        const results = [];

        // Fix URLs and teams
        for (const [oldUrl, fix] of Object.entries(URL_FIXES)) {
            const update = { teams: fix.teams };
            if (fix.newUrl) {
                update.feedUrl = fix.newUrl;
            }

            const result = await sourcesCollection.updateOne(
                { feedUrl: oldUrl },
                { $set: update }
            );

            if (result.matchedCount > 0) {
                if (fix.newUrl) urlsFixed++;
                teamsUpdated++;
                results.push({
                    oldUrl,
                    newUrl: fix.newUrl || oldUrl,
                    teams: fix.teams,
                    status: 'fixed'
                });
            }
        }

        // Delete broken sources that can't be fixed
        for (const url of SOURCES_TO_DISABLE) {
            const result = await sourcesCollection.deleteOne({ feedUrl: url });

            if (result.deletedCount > 0) {
                disabled++;
                results.push({ url, status: 'deleted' });
            }
        }

        res.status(200).json({
            success: true,
            message: `Fixed ${urlsFixed} URLs, updated ${teamsUpdated} teams, deleted ${disabled} broken sources`,
            urlsFixed,
            teamsUpdated,
            disabled,
            results
        });
    } catch (error) {
        console.error('Fix sources error:', error);
        res.status(500).json({ error: 'Failed to fix sources' });
    }
}
