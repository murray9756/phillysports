// Player Stats API - Uses ESPN free API
// GET /api/sportsdata/players?sport=NFL&team=PHI

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

    const { sport, team, query } = req.query;

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();

        let result;
        if (query) {
            result = await searchPlayers(query);
        } else {
            result = await fetchTeamPlayers(sportUpper, team);
        }

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            ...result
        });
    } catch (error) {
        console.error('Players API error:', error);
        return res.status(500).json({ error: 'Failed to fetch player data' });
    }
}

async function searchPlayers(query) {
    const url = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(query)}&limit=20&type=player`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`ESPN search error: ${response.status}`);

    const data = await response.json();
    const results = data.results || [];

    const players = results.map(item => ({
        id: item.id,
        name: item.displayName || item.name,
        team: item.team?.abbreviation || '',
        teamName: item.team?.displayName || '',
        position: item.position || '',
        number: item.jersey || '',
        headshot: item.headshot?.href || null,
        link: item.links?.web?.athletes?.href || null
    }));

    return { players };
}

async function fetchTeamPlayers(sport, team) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) throw new Error(`Unsupported sport: ${sport}`);

    const teamAbbr = (team || 'phi').toLowerCase();
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamAbbr}/roster`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`ESPN roster error: ${response.status}`);

    const data = await response.json();
    const athletes = data.athletes || [];
    const players = [];

    for (const group of athletes) {
        for (const player of (group.items || [])) {
            players.push({
                id: player.id,
                name: player.displayName || player.fullName,
                firstName: player.firstName,
                lastName: player.lastName,
                team: team?.toUpperCase() || 'PHI',
                position: player.position?.abbreviation || '',
                number: player.jersey || '',
                height: player.displayHeight || '',
                weight: player.displayWeight || '',
                age: player.age,
                college: player.college?.name || '',
                experience: player.experience?.years || 0,
                birthDate: player.dateOfBirth,
                photoUrl: player.headshot?.href || null,
                status: player.status?.name || 'Active',
                injury: player.injuries?.[0] ? {
                    status: player.injuries[0].status,
                    bodyPart: player.injuries[0].type,
                    notes: player.injuries[0].details?.detail
                } : null
            });
        }
    }

    return { players };
}
