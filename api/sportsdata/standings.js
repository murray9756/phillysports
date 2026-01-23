// SportsDataIO Standings API
// GET /api/sportsdata/standings?sport=NFL

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, season } = req.query;

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();
        const currentSeason = season || getCurrentSeason(sportUpper);

        const standings = await fetchStandings(sportUpper, currentSeason);

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            season: currentSeason,
            standings
        });
    } catch (error) {
        console.error('Standings API error:', error);
        return res.status(500).json({ error: 'Failed to fetch standings' });
    }
}

function getCurrentSeason(sport) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    switch (sport) {
        case 'NFL':
            return month >= 3 && month <= 7 ? year - 1 : year;
        case 'NBA':
        case 'NHL':
            return month >= 9 ? year + 1 : year;
        case 'MLB':
            return year;
        default:
            return year;
    }
}

async function fetchStandings(sport, season) {
    const endpoints = {
        NFL: `https://api.sportsdata.io/v3/nfl/scores/json/Standings/${season}`,
        NBA: `https://api.sportsdata.io/v3/nba/scores/json/Standings/${season}`,
        MLB: `https://api.sportsdata.io/v3/mlb/scores/json/Standings/${season}`,
        NHL: `https://api.sportsdata.io/v3/nhl/scores/json/Standings/${season}`
    };

    const url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    const data = await response.json();

    // Group by division/conference
    const grouped = {};

    data.forEach(team => {
        const division = team.Division || team.Conference || 'League';
        if (!grouped[division]) {
            grouped[division] = [];
        }

        grouped[division].push({
            team: team.Team,
            teamName: team.Name,
            city: team.City,
            wins: team.Wins,
            losses: team.Losses,
            ties: team.Ties || 0,
            otLosses: team.OvertimeLosses || 0,
            winPct: team.Percentage || (team.Wins / (team.Wins + team.Losses) || 0),
            gamesBack: team.GamesBack || team.GamesBehind || 0,
            streak: team.Streak || team.StreakDescription,
            lastTen: team.LastTenWins ? `${team.LastTenWins}-${team.LastTenLosses}` : null,
            homeRecord: team.HomeWins !== undefined ? `${team.HomeWins}-${team.HomeLosses}` : null,
            awayRecord: team.AwayWins !== undefined ? `${team.AwayWins}-${team.AwayLosses}` : null,
            divisionRecord: team.DivisionWins !== undefined ? `${team.DivisionWins}-${team.DivisionLosses}` : null,
            conferenceRecord: team.ConferenceWins !== undefined ? `${team.ConferenceWins}-${team.ConferenceLosses}` : null,
            pointsFor: team.PointsFor || team.RunsScored || team.GoalsFor,
            pointsAgainst: team.PointsAgainst || team.RunsAgainst || team.GoalsAgainst,
            pointDiff: team.NetPoints || team.RunDifferential || (team.GoalsFor - team.GoalsAgainst),
            isPhilly: team.Team === 'PHI',
            division: team.Division,
            conference: team.Conference
        });
    });

    // Sort each division by wins (desc) then win pct
    Object.keys(grouped).forEach(div => {
        grouped[div].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.winPct - a.winPct;
        });

        // Add rank
        grouped[div].forEach((team, idx) => {
            team.rank = idx + 1;
        });
    });

    return grouped;
}
