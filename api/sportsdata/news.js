// SportsDataIO News & Injuries API
// GET /api/sportsdata/news?sport=NFL&team=PHI
// GET /api/sportsdata/news?sport=NFL&addToQueue=true (adds to curation queue)

import { getCollection } from '../lib/mongodb.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, team, playerId, addToQueue } = req.query;

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();

        // Fetch news and injuries
        const [news, injuries] = await Promise.all([
            fetchNews(sportUpper, team, playerId),
            fetchInjuries(sportUpper, team)
        ]);

        // Optionally add to curation queue
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

async function fetchNews(sport, team, playerId) {
    let url;

    if (playerId) {
        // Player-specific news
        const endpoints = {
            NFL: `https://api.sportsdata.io/v3/nfl/scores/json/NewsByPlayerID/${playerId}`,
            NBA: `https://api.sportsdata.io/v3/nba/scores/json/NewsByPlayerID/${playerId}`,
            MLB: `https://api.sportsdata.io/v3/mlb/scores/json/NewsByPlayerID/${playerId}`,
            NHL: `https://api.sportsdata.io/v3/nhl/scores/json/NewsByPlayerID/${playerId}`
        };
        url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    } else if (team) {
        // Team-specific news
        const endpoints = {
            NFL: `https://api.sportsdata.io/v3/nfl/scores/json/NewsByTeam/${team}`,
            NBA: `https://api.sportsdata.io/v3/nba/scores/json/NewsByTeam/${team}`,
            MLB: `https://api.sportsdata.io/v3/mlb/scores/json/NewsByTeam/${team}`,
            NHL: `https://api.sportsdata.io/v3/nhl/scores/json/NewsByTeam/${team}`
        };
        url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    } else {
        // All recent news
        const endpoints = {
            NFL: 'https://api.sportsdata.io/v3/nfl/scores/json/News',
            NBA: 'https://api.sportsdata.io/v3/nba/scores/json/News',
            MLB: 'https://api.sportsdata.io/v3/mlb/scores/json/News',
            NHL: 'https://api.sportsdata.io/v3/nhl/scores/json/News'
        };
        url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        console.error(`News fetch failed: ${response.status}`);
        return [];
    }

    const newsItems = await response.json();

    // Filter to Philly-related news if no specific team requested
    let filteredNews = newsItems;
    if (!team && !playerId) {
        filteredNews = newsItems.filter(item =>
            item.Team === 'PHI' ||
            item.TeamID === 21 || // Eagles
            item.TeamID === 20 || // 76ers
            item.TeamID === 22 || // Phillies
            item.TeamID === 15    // Flyers
        );
    }

    return filteredNews.slice(0, 50).map(item => ({
        id: item.NewsID,
        title: item.Title,
        content: item.Content,
        source: item.Source || 'SportsDataIO',
        author: item.Author,
        url: item.Url,
        team: item.Team,
        teamId: item.TeamID,
        playerId: item.PlayerID,
        playerName: item.PlayerID ? `Player ${item.PlayerID}` : null,
        categories: item.Categories || [],
        updated: item.Updated,
        timeAgo: item.TimeAgo,
        isPhilly: item.Team === 'PHI',
        sport
    }));
}

async function fetchInjuries(sport, team) {
    const endpoints = {
        NFL: 'https://api.sportsdata.io/v3/nfl/scores/json/Injuries',
        NBA: 'https://api.sportsdata.io/v3/nba/scores/json/Injuries',
        MLB: 'https://api.sportsdata.io/v3/mlb/scores/json/Injuries',
        NHL: 'https://api.sportsdata.io/v3/nhl/scores/json/Injuries'
    };

    const url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Injuries fetch failed: ${response.status}`);
        return [];
    }

    let injuries = await response.json();

    // Filter by team
    if (team) {
        injuries = injuries.filter(i => i.Team?.toUpperCase() === team.toUpperCase());
    } else {
        // Filter to Philly teams only
        injuries = injuries.filter(i => i.Team === 'PHI');
    }

    return injuries.map(injury => ({
        playerId: injury.PlayerID,
        playerName: injury.Name,
        team: injury.Team,
        position: injury.Position,
        status: injury.Status,
        bodyPart: injury.BodyPart,
        injuryStartDate: injury.InjuryStartDate,
        practiceStatus: injury.DeclaredInactive ? 'Out' : (injury.PracticeStatus || 'Unknown'),
        practiceDescription: injury.PracticeDescription,
        updated: injury.Updated
    }));
}

async function addNewsToQueue(newsItems, sport) {
    if (!newsItems || newsItems.length === 0) return 0;

    try {
        const queueCollection = await getCollection('content_queue');

        // Check which items are already in queue
        const existingIds = new Set();
        const existing = await queueCollection.find({
            'sourceData.newsId': { $in: newsItems.map(n => n.id?.toString()) }
        }).toArray();

        existing.forEach(e => existingIds.add(e.sourceData?.newsId));

        // Add new items to queue
        const newItems = newsItems.filter(n => !existingIds.has(n.id?.toString()));

        if (newItems.length === 0) return 0;

        const queueItems = newItems.map(news => ({
            type: 'news',
            title: news.title,
            description: news.content?.substring(0, 500),
            sourceUrl: news.url,
            sourceName: 'SportsDataIO',
            sourceData: {
                newsId: news.id?.toString(),
                sport,
                team: news.team,
                author: news.author
            },
            team: getTeamName(news.team),
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

function getTeamName(abbr) {
    const teams = {
        PHI: 'Eagles', // Could be any Philly team
        DAL: 'Cowboys',
        NYG: 'Giants',
        WAS: 'Commanders'
        // Add more as needed
    };
    return teams[abbr] || abbr;
}
