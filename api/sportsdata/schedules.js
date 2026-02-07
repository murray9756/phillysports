// Schedules API - Uses ESPN free API
// GET /api/sportsdata/schedules?sport=NFL&team=PHI

const ESPN_SPORT_PATHS = {
    NFL: 'football/nfl',
    NBA: 'basketball/nba',
    MLB: 'baseball/mlb',
    NHL: 'hockey/nhl'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, team } = req.query;

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();
        const games = await fetchSchedule(sportUpper, team);

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            team: team || 'all',
            games
        });
    } catch (error) {
        console.error('Schedules API error:', error);
        return res.status(500).json({ error: 'Failed to fetch schedules' });
    }
}

async function fetchSchedule(sport, team) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) throw new Error(`Unsupported sport: ${sport}`);

    // If team specified, fetch team schedule; otherwise fetch today's scoreboard
    let url;
    if (team) {
        const teamLower = team.toLowerCase();
        url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamLower}/schedule`;
    } else {
        // Fetch multiple days
        const dates = [];
        for (let i = -3; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            dates.push(d.toISOString().split('T')[0].replace(/-/g, ''));
        }
        // Just fetch today's scoreboard as default
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '');
        url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${today}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    const events = data.events || [];

    return events.map(event => {
        const comp = event.competitions?.[0];
        if (!comp) return null;

        const homeTeam = comp.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = comp.competitors?.find(c => c.homeAway === 'away');
        const status = comp.status?.type;

        return {
            id: event.id,
            date: event.date,
            dateDisplay: formatGameDate(event.date),
            homeTeam: homeTeam?.team?.abbreviation || '',
            awayTeam: awayTeam?.team?.abbreviation || '',
            homeScore: parseInt(homeTeam?.score) || 0,
            awayScore: parseInt(awayTeam?.score) || 0,
            status: status?.shortDetail || status?.description || 'Scheduled',
            channel: comp.broadcasts?.[0]?.names?.[0] || null,
            stadium: comp.venue?.fullName || null,
            isHome: team ? homeTeam?.team?.abbreviation?.toUpperCase() === team.toUpperCase() : null
        };
    }).filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));
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
