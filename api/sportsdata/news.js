// News & Injuries API - Uses ESPN free API
// GET /api/sportsdata/news?sport=NFL&team=PHI

import { getCollection } from '../lib/mongodb.js';

const ESPN_SPORT_PATHS = {
    NFL: 'football/nfl',
    NBA: 'basketball/nba',
    MLB: 'baseball/mlb',
    NHL: 'hockey/nhl'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, team, addToQueue } = req.query;

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();

        const [news, injuries] = await Promise.all([
            fetchNews(sportUpper, team),
            fetchInjuries(sportUpper, team)
        ]);

        let addedToQueue = 0;
        if (addToQueue === 'true') {
            addedToQueue = await addNewsToQueue(news, sportUpper);
        }

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            team: team || 'all',
            news,
            injuries,
            addedToQueue
        });
    } catch (error) {
        console.error('News API error:', error);
        return res.status(500).json({ error: 'Failed to fetch news' });
    }
}

async function fetchNews(sport, team) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) return [];

    // ESPN news endpoint - team-specific if team provided
    let url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/news`;
    if (team) {
        // Try team-specific news via team schedule page which includes news
        url += `?team=${team.toLowerCase()}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const articles = data.articles || [];

        return articles.slice(0, 50).map(item => ({
            id: item.id || item.dataSourceIdentifier,
            title: item.headline || item.title,
            content: item.description || item.story?.substring(0, 500),
            source: 'ESPN',
            author: item.byline,
            url: item.links?.web?.href || item.links?.api?.self?.href,
            team: team || null,
            categories: item.categories?.map(c => c.description || c.type) || [],
            updated: item.published || item.lastModified,
            isPhilly: team?.toUpperCase() === 'PHI',
            sport,
            image: item.images?.[0]?.url || null
        }));
    } catch (e) {
        console.error('ESPN news fetch error:', e.message);
        return [];
    }
}

async function fetchInjuries(sport, team) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) return [];

    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/injuries`;
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        let allInjuries = [];

        // ESPN returns injuries grouped by team
        for (const teamGroup of (data.injuries || data || [])) {
            const teamAbbr = teamGroup.team?.abbreviation || '';
            const teamInjuries = (teamGroup.injuries || []).map(injury => ({
                playerId: injury.athlete?.id,
                playerName: injury.athlete?.displayName,
                team: teamAbbr,
                position: injury.athlete?.position?.abbreviation,
                status: injury.status,
                bodyPart: injury.type || injury.details?.detail,
                practiceStatus: injury.status,
                practiceDescription: injury.longComment || injury.shortComment,
                updated: injury.date
            }));
            allInjuries.push(...teamInjuries);
        }

        // Filter by team if specified
        if (team) {
            allInjuries = allInjuries.filter(i => i.team?.toUpperCase() === team.toUpperCase());
        } else {
            // Default to Philly teams
            allInjuries = allInjuries.filter(i => i.team === 'PHI');
        }

        return allInjuries;
    } catch (e) {
        console.error('ESPN injuries fetch error:', e.message);
        return [];
    }
}

async function addNewsToQueue(newsItems, sport) {
    if (!newsItems || newsItems.length === 0) return 0;

    try {
        const queueCollection = await getCollection('content_queue');

        const existingIds = new Set();
        const existing = await queueCollection.find({
            'sourceData.newsId': { $in: newsItems.map(n => n.id?.toString()) }
        }).toArray();

        existing.forEach(e => existingIds.add(e.sourceData?.newsId));

        const newItems = newsItems.filter(n => !existingIds.has(n.id?.toString()));

        if (newItems.length === 0) return 0;

        const queueItems = newItems.map(news => ({
            type: 'news',
            title: news.title,
            description: news.content?.substring(0, 500),
            sourceUrl: news.url,
            sourceName: 'ESPN',
            sourceData: {
                newsId: news.id?.toString(),
                sport,
                team: news.team,
                author: news.author
            },
            team: news.team || sport,
            tags: [sport.toLowerCase(), news.team?.toLowerCase()].filter(Boolean),
            status: 'pending',
            priority: news.isPhilly ? 'high' : 'normal',
            fetchedAt: new Date(),
            createdAt: new Date()
        }));

        await queueCollection.insertMany(queueItems);
        return queueItems.length;
    } catch (error) {
        console.error('Failed to add news to queue:', error);
        return 0;
    }
}
