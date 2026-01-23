// Vercel Serverless Function - Fetch Philly Sports Scores
// Uses SportsDataIO for all sports data

import {
    fetchTeamSchedule,
    fetchScoresByDate,
    isPhillyTeam,
    getCurrentSeason,
    getTeamLogo,
    COLLEGE_TEAMS
} from './lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// Team configurations
const TEAM_CONFIG = {
    eagles: { sport: 'NFL', abbr: 'PHI', name: 'Eagles', color: '#004C54' },
    sixers: { sport: 'NBA', abbr: 'PHI', name: '76ers', color: '#006BB6' },
    '76ers': { sport: 'NBA', abbr: 'PHI', name: '76ers', color: '#006BB6' },
    phillies: { sport: 'MLB', abbr: 'PHI', name: 'Phillies', color: '#E81828' },
    flyers: { sport: 'NHL', abbr: 'PHI', name: 'Flyers', color: '#F74902' },
    union: { sport: 'MLS', abbr: 'PHI', name: 'Union', color: '#B49759' }
};

// College team configurations
const COLLEGE_CONFIG = {
    villanova: { name: 'Villanova', color: '#003366', sport: 'NCAAB' },
    penn: { name: 'Penn', color: '#011F5B', sport: 'NCAAB' },
    lasalle: { name: 'La Salle', color: '#00833E', sport: 'NCAAB' },
    drexel: { name: 'Drexel', color: '#07294D', sport: 'NCAAB' },
    stjosephs: { name: 'St. Josephs', color: '#9E1B32', sport: 'NCAAB' },
    temple: { name: 'Temple', color: '#9D2235', sport: 'NCAAB' }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const scores = [];

        // Fetch scores for each major sport
        const sportsToFetch = ['NFL', 'NBA', 'MLB', 'NHL'];

        await Promise.all(sportsToFetch.map(async (sport) => {
            try {
                // Get scores from the last few days to find most recent Philly game
                const today = new Date();
                let foundGame = null;

                // Check the last 7 days for completed Philly games
                for (let daysAgo = 0; daysAgo <= 7 && !foundGame; daysAgo++) {
                    const checkDate = new Date(today);
                    checkDate.setDate(checkDate.getDate() - daysAgo);
                    const dateStr = checkDate.toISOString().split('T')[0];

                    try {
                        const dayScores = await fetchScoresByDate(sport, dateStr);
                        // Find completed Philly games from this day
                        const phillyGames = dayScores.filter(g =>
                            (g.HomeTeam === 'PHI' || g.AwayTeam === 'PHI') &&
                            (g.Status === 'Final' || g.Status === 'F/OT' || g.IsClosed)
                        );

                        if (phillyGames.length > 0) {
                            foundGame = phillyGames[0];
                        }
                    } catch (e) {
                        // Day might not have games, continue
                    }
                }

                if (foundGame) {
                    const isHome = foundGame.HomeTeam === 'PHI';
                    const config = Object.values(TEAM_CONFIG).find(c => c.sport === sport);

                    scores.push({
                        sport,
                        team: config?.name || sport,
                        teamColor: config?.color || '#666666',
                        homeTeam: foundGame.HomeTeam,
                        homeScore: String(foundGame.HomeScore ?? foundGame.HomeTeamScore ?? 0),
                        awayTeam: foundGame.AwayTeam,
                        awayScore: String(foundGame.AwayScore ?? foundGame.AwayTeamScore ?? 0),
                        isHome,
                        date: foundGame.DateTime || foundGame.Day,
                        gameId: (foundGame.GameID || foundGame.ScoreID)?.toString(),
                        status: foundGame.Status
                    });
                }
            } catch (e) {
                console.error(`${sport} fetch error:`, e.message);
            }
        }));

        // Fetch MLS (Union) - SportsDataIO may not have MLS, keep ESPN fallback
        try {
            const mlsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/schedule');
            const mlsData = await mlsRes.json();
            const unionGames = mlsData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
            const recentUnionGame = unionGames[unionGames.length - 1];
            if (recentUnionGame) {
                const comp = recentUnionGame.competitions[0];
                const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
                const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
                scores.push({
                    sport: 'MLS',
                    team: 'Union',
                    teamColor: '#B49759',
                    homeTeam: homeTeam?.team?.shortDisplayName || 'Home',
                    homeScore: String(homeTeam?.score?.displayValue || homeTeam?.score || '0'),
                    awayTeam: awayTeam?.team?.shortDisplayName || 'Away',
                    awayScore: String(awayTeam?.score?.displayValue || awayTeam?.score || '0'),
                    isHome: homeTeam?.team?.displayName?.includes('Philadelphia'),
                    date: recentUnionGame.date
                });
            }
        } catch (e) { console.error('MLS fetch error:', e); }

        // Fetch college basketball scores if requested
        if (teamFilter && COLLEGE_CONFIG[teamFilter]) {
            const college = COLLEGE_CONFIG[teamFilter];
            try {
                // Use SportsDataIO for college basketball
                const season = getCurrentSeason('NCAAB');
                const url = `https://api.sportsdata.io/v3/cbb/scores/json/TeamSchedule/${season}/${COLLEGE_TEAMS[teamFilter]?.id || teamFilter.toUpperCase()}?key=${SPORTSDATA_API_KEY}`;
                const response = await fetch(url);

                if (response.ok) {
                    const games = await response.json();
                    const completedGames = games
                        .filter(g => g.Status === 'Final' || g.Status === 'F/OT')
                        .sort((a, b) => new Date(b.DateTime || b.Day) - new Date(a.DateTime || a.Day));

                    const recentGame = completedGames[0];
                    if (recentGame) {
                        const teamAbbr = COLLEGE_TEAMS[teamFilter]?.id || teamFilter.toUpperCase();
                        const isHome = recentGame.HomeTeam === teamAbbr;

                        scores.push({
                            sport: 'NCAAB',
                            team: college.name,
                            teamColor: college.color,
                            homeTeam: recentGame.HomeTeam,
                            homeScore: String(recentGame.HomeTeamScore || 0),
                            awayTeam: recentGame.AwayTeam,
                            awayScore: String(recentGame.AwayTeamScore || 0),
                            isHome,
                            date: recentGame.DateTime || recentGame.Day,
                            gameId: recentGame.GameID?.toString()
                        });
                    }
                }
            } catch (e) {
                console.error('College basketball fetch error:', e);
            }
        }

        // Filter by team if specified
        let filteredScores = scores;
        if (teamFilter) {
            const teamMap = {
                'eagles': 'Eagles',
                'phillies': 'Phillies',
                'sixers': '76ers',
                '76ers': '76ers',
                'flyers': 'Flyers',
                'union': 'Union',
                ...Object.fromEntries(
                    Object.entries(COLLEGE_CONFIG).map(([key, val]) => [key, val.name])
                )
            };
            const targetTeam = teamMap[teamFilter];
            if (targetTeam) {
                filteredScores = scores.filter(s => s.team === targetTeam);
            }
        }

        res.status(200).json({
            scores: filteredScores,
            updated: new Date().toISOString(),
            source: 'sportsdata'
        });
    } catch (error) {
        console.error('Scores fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch scores', message: error.message });
    }
}
