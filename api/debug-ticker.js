// Debug endpoint to see raw SportsDataIO responses
// GET /api/debug-ticker

import { getTodayET, getYesterdayET } from './lib/timezone.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const today = getTodayET();
    const yesterday = getYesterdayET();
    const serverNow = new Date();

    const results = {
        serverDate: serverNow.toISOString(),
        serverDateLocal: serverNow.toString(),
        calculatedDates: { today, yesterday },
        sports: {}
    };

    // Check NHL
    for (const sport of ['NHL', 'NBA', 'NFL', 'MLB']) {
        const endpoint = sport.toLowerCase();
        results.sports[sport] = { today: [], yesterday: [] };

        for (const [label, date] of [['today', today], ['yesterday', yesterday]]) {
            try {
                const url = `https://api.sportsdata.io/v3/${endpoint}/scores/json/ScoresByDate/${date}?key=${SPORTSDATA_API_KEY}`;
                const response = await fetch(url);

                if (!response.ok) {
                    results.sports[sport][label] = { error: response.status };
                    continue;
                }

                const games = await response.json();

                // Filter to Philly games and show key fields
                const phillyGames = games.filter(g =>
                    g.HomeTeam === 'PHI' || g.AwayTeam === 'PHI'
                ).map(g => ({
                    matchup: `${g.AwayTeam} @ ${g.HomeTeam}`,
                    status: g.Status,
                    score: `${g.AwayScore || g.AwayTeamScore || 0}-${g.HomeScore || g.HomeTeamScore || 0}`,
                    dateTime: g.DateTime,
                    gameId: g.GameID || g.ScoreID
                }));

                results.sports[sport][label] = phillyGames.length > 0 ? phillyGames : 'No Philly games';
            } catch (e) {
                results.sports[sport][label] = { error: e.message };
            }
        }
    }

    return res.status(200).json(results);
}
