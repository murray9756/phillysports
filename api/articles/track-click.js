// Track article clicks by source
import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { source, articleUrl, title, team } = req.body;

        if (!source || !articleUrl) {
            return res.status(400).json({ error: 'Source and articleUrl required' });
        }

        const clicksCollection = await getCollection('article_clicks');
        const sourcesCollection = await getCollection('source_stats');

        // Record the click
        await clicksCollection.insertOne({
            source: source,
            articleUrl: articleUrl,
            title: title || null,
            team: team || null,
            clickedAt: new Date(),
            userAgent: req.headers['user-agent'] || null
        });

        // Update source stats (upsert)
        await sourcesCollection.updateOne(
            { source: source },
            {
                $inc: { totalClicks: 1 },
                $set: { lastClickAt: new Date() },
                $setOnInsert: {
                    source: source,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Track click error:', error);
        return res.status(500).json({ error: 'Failed to track click' });
    }
}
