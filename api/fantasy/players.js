// Fantasy Players API - DraftKings Salaries
// GET: Returns real players with DFS salaries from DraftKings public API
// Free, no API key required

import { getCollection } from '../lib/mongodb.js';
import { getTodayET } from '../lib/timezone.js';
import { fetchPlayersForDate } from '../lib/draftkings.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sport, date, contestId } = req.query;

    if (!sport) {
        return res.status(400).json({ error: 'Sport is required' });
    }

    try {
        const targetDate = date || getTodayET();
        const sportUpper = sport.toUpperCase();

        // Fetch players with DraftKings salaries
        let { players, games } = await fetchPlayersForDate(sportUpper, targetDate);

        // Filter by contestId if provided
        if (contestId && players.length > 0) {
            try {
                const contestsCollection = await getCollection('fantasy_contests');
                const { ObjectId } = await import('mongodb');
                const contest = await contestsCollection.findOne({ _id: new ObjectId(contestId) });

                // Only filter if contest has gameIds AND players have gameIds that match
                if (contest && contest.gameIds && contest.gameIds.length > 0) {
                    const validGameIds = new Set(contest.gameIds.map(id => id.toString()));
                    const filtered = players.filter(p => p.gameId && validGameIds.has(p.gameId.toString()));
                    // Only apply filter if it finds matches (gameId formats may differ)
                    if (filtered.length > 0) {
                        players = filtered;
                        games = games.filter(g => g.id && validGameIds.has(g.id.toString()));
                    }
                }
            } catch (err) {
                console.error('Error filtering by contest:', err.message);
            }
        }

        return res.status(200).json({
            success: true,
            players,
            games,
            sport: sportUpper,
            date: targetDate,
            source: 'draftkings',
            totalPlayers: players.length
        });
    } catch (error) {
        console.error('Fantasy players error:', error);
        return res.status(500).json({ error: 'Failed to fetch players: ' + error.message });
    }
}
