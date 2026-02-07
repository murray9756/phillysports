// Standings API - Uses ESPN free API
// GET /api/sportsdata/standings?sport=NFL

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

    const { sport } = req.query;

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();
        const standings = await fetchStandings(sportUpper);

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            standings
        });
    } catch (error) {
        console.error('Standings API error:', error);
        return res.status(500).json({ error: 'Failed to fetch standings' });
    }
}

async function fetchStandings(sport) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) throw new Error(`Unsupported sport: ${sport}`);

    const url = `https://site.api.espn.com/apis/v2/sports/${sportPath}/standings`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`ESPN standings API error: ${response.status}`);
    }

    const data = await response.json();
    const grouped = {};

    // ESPN returns children array with conferences/divisions
    const children = data.children || [];

    for (const conference of children) {
        const confName = conference.name || conference.abbreviation || 'League';

        // Some sports have divisions within conferences
        const divisions = conference.children || [conference];

        for (const division of divisions) {
            const divName = division.name || confName;
            const standings = division.standings?.entries || [];

            if (!grouped[divName]) {
                grouped[divName] = [];
            }

            for (const entry of standings) {
                const team = entry.team || {};
                const stats = {};

                // Extract all stats into a map
                for (const stat of (entry.stats || [])) {
                    stats[stat.name] = stat.value;
                    if (stat.displayValue) stats[stat.name + '_display'] = stat.displayValue;
                }

                grouped[divName].push({
                    team: team.abbreviation || '',
                    teamName: team.shortDisplayName || team.displayName || '',
                    city: team.location || '',
                    wins: stats.wins || 0,
                    losses: stats.losses || 0,
                    ties: stats.ties || 0,
                    otLosses: stats.OTLosses || stats.overtimeLosses || 0,
                    winPct: stats.winPercent || stats.winPct || (stats.wins / (stats.wins + stats.losses) || 0),
                    gamesBack: stats.gamesBehind || stats.gamesBack || 0,
                    streak: stats.streak_display || stats.streak || null,
                    lastTen: stats.Last_Ten_Record_display || null,
                    homeRecord: stats.Home_display || stats.homeRecord_display || null,
                    awayRecord: stats.Road_display || stats.awayRecord_display || null,
                    divisionRecord: stats.vs_div_display || stats.divisionRecord_display || null,
                    conferenceRecord: stats.vs_conf_display || stats.conferenceRecord_display || null,
                    pointsFor: stats.pointsFor || stats.runsScored || stats.goalsFor || 0,
                    pointsAgainst: stats.pointsAgainst || stats.runsAgainst || stats.goalsAgainst || 0,
                    pointDiff: stats.differential || stats.pointDifferential || 0,
                    isPhilly: team.abbreviation === 'PHI',
                    division: divName,
                    conference: confName
                });
            }
        }
    }

    // Sort each division by wins desc, win pct desc
    Object.keys(grouped).forEach(div => {
        grouped[div].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.winPct - a.winPct;
        });

        grouped[div].forEach((team, idx) => {
            team.rank = idx + 1;
        });
    });

    return grouped;
}
