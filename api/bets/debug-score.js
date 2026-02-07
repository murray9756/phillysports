// Debug endpoint to trace why a specific bet isn't scoring
// POST /api/bets/debug-score
// Admin-only

import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';
import { fetchScoresByDate } from '../lib/sportsdata.js';

const TEAM_NAME_TO_ABBR = {
    'philadelphia flyers': 'PHI', 'flyers': 'PHI',
    'colorado avalanche': 'COL', 'avalanche': 'COL',
    'philadelphia eagles': 'PHI', 'eagles': 'PHI',
    'philadelphia 76ers': 'PHI', '76ers': 'PHI',
    'philadelphia phillies': 'PHI', 'phillies': 'PHI'
};

function normalizeTeamName(name) {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    if (TEAM_NAME_TO_ABBR[lower]) return TEAM_NAME_TO_ABBR[lower];
    if (name.length <= 3) return name.toUpperCase();
    return lower.split(' ').pop();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const decoded = await authenticate(req);
        if (!decoded || !decoded.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const bets = await getCollection('bets');
        const pendingBets = await bets.find({ status: 'pending' }).toArray();

        const debug = [];

        for (const bet of pendingBets) {
            const sport = bet.sport;
            const dt = new Date(bet.commenceTime);
            const utcDate = dt.toISOString().split('T')[0];
            const utcHour = dt.getUTCHours();

            const datesToCheck = [utcDate];
            if (utcHour < 10) {
                const prevDay = new Date(dt);
                prevDay.setUTCDate(prevDay.getUTCDate() - 1);
                datesToCheck.push(prevDay.toISOString().split('T')[0]);
            }

            const homeAbbr = normalizeTeamName(bet.homeTeam);
            const awayAbbr = normalizeTeamName(bet.awayTeam);

            const betDebug = {
                betId: bet._id.toString(),
                sport,
                homeTeam: bet.homeTeam,
                awayTeam: bet.awayTeam,
                homeAbbr,
                awayAbbr,
                commenceTime: bet.commenceTime,
                utcDate,
                utcHour,
                datesToCheck,
                apiResults: []
            };

            for (const date of datesToCheck) {
                try {
                    const scores = await fetchScoresByDate(sport, date);
                    const gamesInfo = scores.map(g => ({
                        home: g.HomeTeam,
                        away: g.AwayTeam,
                        status: g.Status,
                        isClosed: g.IsClosed,
                        homeScore: g.HomeScore ?? g.HomeTeamScore,
                        awayScore: g.AwayScore ?? g.AwayTeamScore,
                        dateTime: g.DateTime || g.Day
                    }));

                    // Find matching game
                    const match = scores.find(g => {
                        const gameHome = (g.HomeTeam || '').toUpperCase();
                        const gameAway = (g.AwayTeam || '').toUpperCase();
                        return (gameHome === homeAbbr.toUpperCase() && gameAway === awayAbbr.toUpperCase());
                    });

                    betDebug.apiResults.push({
                        date,
                        gamesCount: scores.length,
                        allGames: gamesInfo,
                        matchFound: !!match,
                        matchDetails: match ? {
                            home: match.HomeTeam,
                            away: match.AwayTeam,
                            status: match.Status,
                            isClosed: match.IsClosed,
                            homeScore: match.HomeScore ?? match.HomeTeamScore,
                            awayScore: match.AwayScore ?? match.AwayTeamScore
                        } : null
                    });
                } catch (e) {
                    betDebug.apiResults.push({
                        date,
                        error: e.message
                    });
                }
            }

            debug.push(betDebug);
        }

        res.status(200).json({ debug });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
