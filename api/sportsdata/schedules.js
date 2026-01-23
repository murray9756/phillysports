// SportsDataIO Schedules API
// GET /api/sportsdata/schedules?sport=NFL&team=PHI

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, team, season } = req.query;

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();
        const currentSeason = season || getCurrentSeason(sportUpper);

        const schedules = await fetchSchedule(sportUpper, currentSeason, team);

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            season: currentSeason,
            team: team || 'all',
            games: schedules
        });
    } catch (error) {
        console.error('Schedules API error:', error);
        return res.status(500).json({ error: 'Failed to fetch schedules' });
    }
}

function getCurrentSeason(sport) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    switch (sport) {
        case 'NFL':
            return month >= 3 && month <= 8 ? `${year}PRE` : `${year}REG`;
        case 'NBA':
        case 'NHL':
            return month >= 9 ? year + 1 : year;
        case 'MLB':
            return year;
        default:
            return year;
    }
}

async function fetchSchedule(sport, season, team) {
    const endpoints = {
        NFL: `https://api.sportsdata.io/v3/nfl/scores/json/Schedules/${season}`,
        NBA: `https://api.sportsdata.io/v3/nba/scores/json/Games/${season}`,
        MLB: `https://api.sportsdata.io/v3/mlb/scores/json/Games/${season}`,
        NHL: `https://api.sportsdata.io/v3/nhl/scores/json/Games/${season}`
    };

    const url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    let games = await response.json();

    // Filter by team if specified
    if (team) {
        const teamUpper = team.toUpperCase();
        games = games.filter(g =>
            g.HomeTeam?.toUpperCase() === teamUpper ||
            g.AwayTeam?.toUpperCase() === teamUpper
        );
    }

    // Transform to consistent format
    return games.map(game => ({
        id: game.GameID || game.ScoreID,
        date: game.DateTime || game.Day,
        dateDisplay: formatGameDate(game.DateTime || game.Day),
        homeTeam: game.HomeTeam,
        awayTeam: game.AwayTeam,
        homeScore: game.HomeScore,
        awayScore: game.AwayScore,
        status: game.Status,
        channel: game.Channel,
        stadium: game.StadiumDetails?.Name || game.Stadium,
        week: game.Week,
        isHome: team ? game.HomeTeam?.toUpperCase() === team.toUpperCase() : null,
        // Sport-specific
        quarter: game.Quarter,
        period: game.Period,
        inning: game.Inning
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function formatGameDate(dateStr) {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}
