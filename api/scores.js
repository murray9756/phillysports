// Vercel Serverless Function - Fetch Philly Sports Scores
// Uses ESPN API for reliable score data

import {
    fetchTeamSchedule,
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

        // ESPN endpoints for scores (more reliable for real data)
        const ESPN_URLS = {
            NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule',
            NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/schedule',
            MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/schedule',
            NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/schedule'
        };

        const sportsToFetch = ['NFL', 'NBA', 'MLB', 'NHL'];

        await Promise.all(sportsToFetch.map(async (sport) => {
            try {
                // Use ESPN for scores (has real data)
                const espnUrl = ESPN_URLS[sport];
                const response = await fetch(espnUrl);
                if (!response.ok) throw new Error('ESPN fetch failed');

                const data = await response.json();
                const events = data.events || [];

                // Find most recent completed game
                const completedGames = events.filter(e =>
                    e.competitions?.[0]?.status?.type?.completed
                );

                const recentGame = completedGames[completedGames.length - 1];
                if (recentGame) {
                    const comp = recentGame.competitions[0];
                    const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
                    const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
                    const phillyIsHome = homeTeam?.team?.abbreviation === 'PHI' ||
                                        homeTeam?.team?.displayName?.includes('Philadelphia');

                    const config = Object.values(TEAM_CONFIG).find(c => c.sport === sport);

                    // Link to our game preview page instead of ESPN
                    const boxscoreLink = `/game-preview.html?id=${recentGame.id}&sport=${sport}&source=espn`;

                    scores.push({
                        sport,
                        team: config?.name || sport,
                        teamColor: config?.color || '#666666',
                        homeTeam: homeTeam?.team?.abbreviation || homeTeam?.team?.shortDisplayName || 'Home',
                        homeScore: String(homeTeam?.score?.displayValue || homeTeam?.score || '0'),
                        awayTeam: awayTeam?.team?.abbreviation || awayTeam?.team?.shortDisplayName || 'Away',
                        awayScore: String(awayTeam?.score?.displayValue || awayTeam?.score || '0'),
                        isHome: phillyIsHome,
                        date: recentGame.date,
                        gameId: recentGame.id,
                        status: comp.status?.type?.shortDetail || 'Final',
                        link: boxscoreLink
                    });
                }
            } catch (e) {
                console.error(`${sport} fetch error:`, e.message);
            }
        }));

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

        // Filter out scores older than 72 hours
        const now = new Date();
        const maxAge = 72 * 60 * 60 * 1000; // 72 hours in ms
        let filteredScores = scores.filter(s => {
            if (!s.date) return false;
            const gameDate = new Date(s.date);
            return (now - gameDate) <= maxAge;
        });

        // Filter by team if specified
        if (teamFilter) {
            const teamMap = {
                'eagles': 'Eagles',
                'phillies': 'Phillies',
                'sixers': '76ers',
                '76ers': '76ers',
                'flyers': 'Flyers',
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
            source: 'espn'
        });
    } catch (error) {
        console.error('Scores fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch scores', message: error.message });
    }
}
// Deploy Fri Jan 23 19:26:23 EST 2026
