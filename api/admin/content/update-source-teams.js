// Admin Content Sources - Update Teams for Existing Sources
// POST: Updates all existing sources with correct team categories

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';

// Map feedUrl to correct teams
const SOURCE_TEAMS_MAP = {
    // Local Philly - all teams
    'https://www.crossingbroad.com/feed': ['eagles', 'phillies', 'sixers', 'flyers'],
    'https://www.phillyvoice.com/feed/section/sports/': ['eagles', 'phillies', 'sixers', 'flyers'],
    'https://www.nbcsports.com/philadelphia/rss': ['eagles', 'phillies', 'sixers', 'flyers'],
    'https://www.inquirer.com/arcio/rss/category/sports/': ['eagles', 'phillies', 'sixers', 'flyers'],

    // Eagles only
    'https://www.bleedinggreennation.com/rss/current': ['eagles'],
    'https://eagleswire.usatoday.com/feed/': ['eagles'],
    'https://feeds.megaphone.fm/birds-with-friends': ['eagles'],

    // Phillies only
    'https://www.thegoodphight.com/rss/current': ['phillies'],
    'https://www.philliesnation.com/feed/': ['phillies'],
    'https://feeds.simplecast.com/CvXJXmRj': ['phillies'],
    'https://anchor.fm/s/24badf78/podcast/rss': ['phillies'],

    // Sixers only
    'https://www.libertyballers.com/rss/current': ['sixers'],
    'https://sixerswire.usatoday.com/feed/': ['sixers'],

    // Flyers only
    'https://www.broadstreethockey.com/rss/current': ['flyers'],
    'https://flyersnation.com/feed/': ['flyers'],

    // College only
    'https://www.vuhoops.com/rss/current': ['college'],
    'https://theowlprowl.com/feed/': ['college'],
    'https://www.blackshoediaries.com/rss/current': ['college'],

    // Esports only
    'https://dotesports.com/feed': ['esports'],
    'https://www.thescoreesports.com/feed/esports.rss': ['esports'],
    'https://www.dexerto.com/feed/': ['esports'],

    // Youth/General
    'https://www.buyingsandlot.com/sitemap.xml': ['youth', 'general']
};

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

        let updated = 0;
        let notFound = 0;
        const results = [];

        // Update each source
        for (const [feedUrl, teams] of Object.entries(SOURCE_TEAMS_MAP)) {
            const result = await sourcesCollection.updateOne(
                { feedUrl: feedUrl },
                { $set: { teams: teams } }
            );

            if (result.matchedCount > 0) {
                updated++;
                results.push({ feedUrl, teams, status: 'updated' });
            } else {
                notFound++;
                results.push({ feedUrl, teams, status: 'not found' });
            }
        }

        res.status(200).json({
            success: true,
            message: `Updated ${updated} sources, ${notFound} not found in database`,
            updated,
            notFound,
            results
        });
    } catch (error) {
        console.error('Update source teams error:', error);
        res.status(500).json({ error: 'Failed to update source teams' });
    }
}
