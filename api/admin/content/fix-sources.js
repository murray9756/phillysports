// Admin Content Sources - Fix Broken URLs and Teams
// POST: Updates existing sources with correct URLs and team categories

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

// Determine categories based on source name or URL
function getCategoriesForSource(source) {
    const name = (source.name || '').toLowerCase();
    const url = (source.feedUrl || '').toLowerCase();

    // Eagles sources
    if (name.includes('eagle') || name.includes('bleeding green') ||
        url.includes('bleedinggreen') || url.includes('eagleswire') ||
        url.includes('birds-with-friends')) {
        return ['eagles'];
    }

    // Phillies sources
    if (name.includes('philli') || name.includes('good phight') ||
        url.includes('thegoodphight') || url.includes('philliesnation')) {
        return ['phillies'];
    }

    // Sixers sources
    if (name.includes('sixer') || name.includes('liberty baller') ||
        url.includes('libertyballers') || url.includes('sixerswire')) {
        return ['sixers'];
    }

    // Flyers sources
    if (name.includes('flyer') || name.includes('broad street hockey') ||
        url.includes('broadstreethockey') || url.includes('flyersnation')) {
        return ['flyers'];
    }

    // College sources
    if (name.includes('villanova') || name.includes('vuhoops') ||
        name.includes('temple') || name.includes('owl') ||
        name.includes('penn state') || name.includes('black shoe') ||
        url.includes('vuhoops') || url.includes('blackshoediaries') ||
        url.includes('owlprowl')) {
        return ['college'];
    }

    // Esports sources
    if (name.includes('esport') || name.includes('dexerto') ||
        url.includes('esport') || url.includes('dexerto') ||
        url.includes('dotesports')) {
        return ['esports'];
    }

    // Youth/newsletter sources
    if (name.includes('sandlot') || name.includes('youth') ||
        url.includes('buyingsandlot')) {
        return ['youth', 'general'];
    }

    // Multi-team Philly sources (Crossing Broad, PhillyVoice, NBC Sports Philly, Inquirer)
    if (name.includes('crossing broad') || name.includes('phillyvoice') ||
        name.includes('nbc sports') || name.includes('inquirer') ||
        url.includes('crossingbroad') || url.includes('phillyvoice') ||
        url.includes('nbcsports.com/philadelphia') || url.includes('inquirer')) {
        return ['eagles', 'phillies', 'sixers', 'flyers'];
    }

    // Default: all major teams
    return ['eagles', 'phillies', 'sixers', 'flyers'];
}

// URL fixes for broken feeds
const URL_FIXES = {
    'https://www.bleedinggreennation.com/rss/current': 'https://www.bleedinggreennation.com/rss/index.xml',
    'https://www.thegoodphight.com/rss/current': 'https://www.thegoodphight.com/rss/index.xml',
    'https://www.libertyballers.com/rss/current': 'https://www.libertyballers.com/rss/index.xml',
    'https://www.broadstreethockey.com/rss/current': 'https://www.broadstreethockey.com/rss/index.xml',
    'https://www.vuhoops.com/rss/current': 'https://www.vuhoops.com/rss/index.xml',
    'https://www.blackshoediaries.com/rss/current': 'https://www.blackshoediaries.com/rss/index.xml'
};

// Sources to delete (broken/dead)
const SOURCES_TO_DELETE = [
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
        let categoriesUpdated = 0;
        let deleted = 0;
        const results = [];

        // Get ALL sources from database
        const allSources = await sourcesCollection.find({}).toArray();
        console.log(`Found ${allSources.length} sources to process`);

        for (const source of allSources) {
            const updates = {};
            let needsUpdate = false;

            // Check if URL needs fixing
            if (source.feedUrl && URL_FIXES[source.feedUrl]) {
                updates.feedUrl = URL_FIXES[source.feedUrl];
                urlsFixed++;
                needsUpdate = true;
            }

            // Determine and set categories based on name/URL
            const categories = getCategoriesForSource(source);
            if (!source.teams || source.teams.length === 0 ||
                JSON.stringify(source.teams.sort()) !== JSON.stringify(categories.sort())) {
                updates.teams = categories;
                categoriesUpdated++;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await sourcesCollection.updateOne(
                    { _id: source._id },
                    { $set: updates }
                );
                results.push({
                    name: source.name,
                    feedUrl: updates.feedUrl || source.feedUrl,
                    categories: updates.teams || source.teams,
                    status: 'updated'
                });
                console.log(`Updated: ${source.name} -> categories: ${JSON.stringify(updates.teams || source.teams)}`);
            }
        }

        // Delete broken sources that can't be fixed
        for (const url of SOURCES_TO_DELETE) {
            const result = await sourcesCollection.deleteOne({ feedUrl: url });

            if (result.deletedCount > 0) {
                deleted++;
                results.push({ url, status: 'deleted' });
                console.log(`Deleted: ${url}`);
            }
        }

        res.status(200).json({
            success: true,
            message: `Fixed ${urlsFixed} URLs, updated ${categoriesUpdated} categories, deleted ${deleted} broken sources`,
            urlsFixed,
            categoriesUpdated,
            deleted,
            results
        });
    } catch (error) {
        console.error('Fix sources error:', error);
        res.status(500).json({ error: 'Failed to fix sources' });
    }
}
