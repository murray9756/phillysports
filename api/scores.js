// Vercel Serverless Function - Fetch Philly Sports Scores
// Uses SportsDataIO as primary, ESPN as fallback

import { getTodayET, getYesterdayET, hoursSince } from './lib/timezone.js';

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

// SportsDataIO endpoint mapping
const SPORTSDATA_ENDPOINTS = {
    NFL: 'nfl',
    NBA: 'nba',
    MLB: 'mlb',
    NHL: 'nhl'
};

// ESPN fallback URLs
const ESPN_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/schedule',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/schedule',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/schedule'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;

    try {
        const scores = [];
        const sportsToFetch = ['NFL', 'NBA', 'MLB', 'NHL'];

        await Promise.all(sportsToFetch.map(async (sport) => {
            let scoreData = null;
            let source = 'sportsdata';

            // Try SportsDataIO first
            if (SPORTSDATA_API_KEY) {
                try {
                    scoreData = await fetchFromSportsDataIO(sport);
                    if (scoreData) {
                        source = 'sportsdata';
                    }
                } catch (e) {
                    console.error(`SportsDataIO ${sport} error:`, e.message);
                }
            }

            // Fall back to ESPN if SportsDataIO failed
            if (!scoreData) {
                try {
                    scoreData = await fetchFromESPN(sport);
                    if (scoreData) {
                        source = 'espn';
                    }
                } catch (e) {
                    console.error(`ESPN ${sport} error:`, e.message);
                }
            }

            if (scoreData) {
                const config = Object.values(TEAM_CONFIG).find(c => c.sport === sport);

                // Build link based on source
                const boxscoreLink = source === 'espn'
                    ? `/game-preview.html?id=${scoreData.gameId}&sport=${sport}&source=espn`
                    : `/game-preview.html?id=${scoreData.gameId}&sport=${sport}`;

                scores.push({
                    sport,
                    team: config?.name || sport,
                    teamColor: config?.color || '#666666',
                    homeTeam: scoreData.homeTeam,
                    homeScore: String(scoreData.homeScore),
                    awayTeam: scoreData.awayTeam,
                    awayScore: String(scoreData.awayScore),
                    isHome: scoreData.isHome,
                    date: scoreData.date,
                    gameId: scoreData.gameId,
                    status: scoreData.status,
                    link: boxscoreLink,
                    source
                });
            }
        }));

        // Fetch college basketball scores if requested
        if (teamFilter && COLLEGE_CONFIG[teamFilter]) {
            const college = COLLEGE_CONFIG[teamFilter];
            try {
                const collegeScore = await fetchCollegeScore(teamFilter, college);
                if (collegeScore) {
                    scores.push(collegeScore);
                }
            } catch (e) {
                console.error('College basketball fetch error:', e);
            }
        }

        // Filter out scores older than 72 hours
        const now = new Date();
        const maxAge = 72 * 60 * 60 * 1000;
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
            updated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Scores fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch scores', message: error.message });
    }
}

// Fetch recent completed game from SportsDataIO
async function fetchFromSportsDataIO(sport) {
    const endpoint = SPORTSDATA_ENDPOINTS[sport];
    if (!endpoint) return null;

    // Get recent games in Eastern Time - use ScoresByDate for last few days
    const today = getTodayET();
    const dates = [today];
    // Add previous days
    const todayDate = new Date(today + 'T12:00:00');
    for (let i = 1; i < 5; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }

    for (const date of dates) {
        const url = `https://api.sportsdata.io/v3/${endpoint}/scores/json/ScoresByDate/${date}?key=${SPORTSDATA_API_KEY}`;

        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const games = await response.json();

            // Find Philly team's most recent completed game
            const phillyGame = games.find(g =>
                (g.HomeTeam === 'PHI' || g.AwayTeam === 'PHI') &&
                (g.Status === 'Final' || g.Status === 'F/OT')
            );

            if (phillyGame) {
                const isHome = phillyGame.HomeTeam === 'PHI';
                return {
                    gameId: (phillyGame.GameID || phillyGame.ScoreID).toString(),
                    homeTeam: phillyGame.HomeTeam,
                    homeScore: phillyGame.HomeScore || phillyGame.HomeTeamScore || 0,
                    awayTeam: phillyGame.AwayTeam,
                    awayScore: phillyGame.AwayScore || phillyGame.AwayTeamScore || 0,
                    isHome,
                    date: phillyGame.DateTime || phillyGame.Day,
                    status: phillyGame.Status
                };
            }
        } catch (e) {
            console.log(`SportsDataIO ${sport} ${date} error:`, e.message);
        }
    }

    return null;
}

// Fetch recent completed game from ESPN (fallback)
async function fetchFromESPN(sport) {
    const url = ESPN_URLS[sport];
    if (!url) return null;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const events = data.events || [];

    // Find most recent completed game
    const completedGames = events.filter(e =>
        e.competitions?.[0]?.status?.type?.completed
    );

    const recentGame = completedGames[completedGames.length - 1];
    if (!recentGame) return null;

    const comp = recentGame.competitions[0];
    const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
    const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
    const phillyIsHome = homeTeam?.team?.abbreviation === 'PHI' ||
                        homeTeam?.team?.displayName?.includes('Philadelphia');

    return {
        gameId: recentGame.id,
        homeTeam: homeTeam?.team?.abbreviation || 'Home',
        homeScore: homeTeam?.score?.displayValue || homeTeam?.score || 0,
        awayTeam: awayTeam?.team?.abbreviation || 'Away',
        awayScore: awayTeam?.score?.displayValue || awayTeam?.score || 0,
        isHome: phillyIsHome,
        date: recentGame.date,
        status: comp.status?.type?.shortDetail || 'Final'
    };
}

// Fetch college basketball score
async function fetchCollegeScore(teamKey, college) {
    const COLLEGE_TEAMS = {
        villanova: { id: 'VILL' },
        penn: { id: 'PENN' },
        lasalle: { id: 'LAS' },
        drexel: { id: 'DREX' },
        stjosephs: { id: 'SJU' },
        temple: { id: 'TEM' }
    };

    const teamId = COLLEGE_TEAMS[teamKey]?.id;
    if (!teamId || !SPORTSDATA_API_KEY) return null;

    // Get current season
    const now = new Date();
    const year = now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();

    const url = `https://api.sportsdata.io/v3/cbb/scores/json/TeamSchedule/${year}/${teamId}?key=${SPORTSDATA_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const games = await response.json();
    const completedGames = games
        .filter(g => g.Status === 'Final' || g.Status === 'F/OT')
        .sort((a, b) => new Date(b.DateTime || b.Day) - new Date(a.DateTime || a.Day));

    const recentGame = completedGames[0];
    if (!recentGame) return null;

    const isHome = recentGame.HomeTeam === teamId;

    return {
        sport: 'NCAAB',
        team: college.name,
        teamColor: college.color,
        homeTeam: recentGame.HomeTeam,
        homeScore: String(recentGame.HomeTeamScore || 0),
        awayTeam: recentGame.AwayTeam,
        awayScore: String(recentGame.AwayTeamScore || 0),
        isHome,
        date: recentGame.DateTime || recentGame.Day,
        gameId: recentGame.GameID?.toString(),
        link: `/game-preview.html?id=${recentGame.GameID}&sport=NCAAB`
    };
}
