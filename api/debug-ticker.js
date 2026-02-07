// Debug endpoint to see raw ESPN scoreboard responses
// GET /api/debug-ticker

import { getTodayET, getYesterdayET } from './lib/timezone.js';

const ESPN_SPORT_PATHS = {
    NFL: 'football/nfl',
    NBA: 'basketball/nba',
    MLB: 'baseball/mlb',
    NHL: 'hockey/nhl'
};

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

    for (const sport of ['NHL', 'NBA', 'NFL', 'MLB']) {
        const sportPath = ESPN_SPORT_PATHS[sport];
        results.sports[sport] = { today: [], yesterday: [] };

        for (const [label, date] of [['today', today], ['yesterday', yesterday]]) {
            try {
                const espnDate = date.replace(/-/g, '');
                const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${espnDate}`;
                const response = await fetch(url);

                if (!response.ok) {
                    results.sports[sport][label] = { error: response.status };
                    continue;
                }

                const data = await response.json();
                const events = data.events || [];

                // Filter to Philly games and show key fields
                const phillyGames = events.filter(e => {
                    const comp = e.competitions?.[0];
                    if (!comp) return false;
                    return comp.competitors?.some(c =>
                        c.team?.abbreviation === 'PHI'
                    );
                }).map(e => {
                    const comp = e.competitions[0];
                    const home = comp.competitors?.find(c => c.homeAway === 'home');
                    const away = comp.competitors?.find(c => c.homeAway === 'away');
                    return {
                        matchup: `${away?.team?.abbreviation || '?'} @ ${home?.team?.abbreviation || '?'}`,
                        status: comp.status?.type?.shortDetail || comp.status?.type?.description || 'Unknown',
                        score: `${away?.score || 0}-${home?.score || 0}`,
                        dateTime: e.date,
                        gameId: e.id
                    };
                });

                results.sports[sport][label] = phillyGames.length > 0 ? phillyGames : 'No Philly games';
            } catch (e) {
                results.sports[sport][label] = { error: e.message };
            }
        }
    }

    return res.status(200).json(results);
}
