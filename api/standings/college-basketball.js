// College Basketball Conference Standings - Uses ESPN free API

// Conference mapping for each team
const TEAM_CONFERENCES = {
    'villanova': { conference: 'Big East', espnGroupId: '4' },
    'penn': { conference: 'Ivy League', espnGroupId: '22' },
    'lasalle': { conference: 'Atlantic 10', espnGroupId: '3' },
    'drexel': { conference: 'CAA', espnGroupId: '10' },
    'stjosephs': { conference: 'Atlantic 10', espnGroupId: '3' },
    'temple': { conference: 'AAC', espnGroupId: '62' }
};

// ESPN team abbreviations for highlighting
const TEAM_ABBRS = {
    'villanova': 'VILL',
    'penn': 'PENN',
    'lasalle': 'LAS',
    'drexel': 'DREX',
    'stjosephs': 'SJU',
    'temple': 'TEM'
};

const TEAM_COLORS = {
    'villanova': '#003366',
    'penn': '#011F5B',
    'lasalle': '#00833E',
    'drexel': '#07294D',
    'stjosephs': '#9E1B32',
    'temple': '#9D2235'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team } = req.query;

    if (!team) {
        return res.status(400).json({ error: 'Team parameter required' });
    }

    const teamKey = team.toLowerCase();
    const confInfo = TEAM_CONFERENCES[teamKey];

    if (!confInfo) {
        return res.status(400).json({
            error: 'Invalid team. Valid options: villanova, penn, lasalle, drexel, stjosephs, temple'
        });
    }

    try {
        const teamAbbr = TEAM_ABBRS[teamKey] || teamKey.toUpperCase();

        // Fetch standings from ESPN
        const url = `https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings?group=${confInfo.espnGroupId}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`ESPN API error: ${response.status}`);
        }

        const data = await response.json();

        // Parse ESPN standings response
        const standings = [];
        const children = data.children || [data];

        for (const group of children) {
            const entries = group.standings?.entries || [];

            for (const entry of entries) {
                const entryTeam = entry.team || {};
                const stats = {};

                for (const stat of (entry.stats || [])) {
                    stats[stat.name] = stat.value;
                    if (stat.displayValue) stats[stat.name + '_display'] = stat.displayValue;
                }

                standings.push({
                    rank: 0,
                    teamId: entryTeam.id,
                    teamName: entryTeam.displayName || entryTeam.shortDisplayName || '',
                    teamAbbr: entryTeam.abbreviation || '',
                    teamLogo: entryTeam.logos?.[0]?.href || null,
                    wins: stats.wins || stats.overall_display?.split('-')?.[0] || 0,
                    losses: stats.losses || stats.overall_display?.split('-')?.[1] || 0,
                    confWins: stats.vsConf_Wins || 0,
                    confLosses: stats.vsConf_Losses || 0,
                    winPct: stats.winPercent ? (stats.winPercent * 100).toFixed(1) + '%' : '0%',
                    streak: stats.streak_display || '-',
                    isHighlighted: entryTeam.abbreviation === teamAbbr
                });
            }
        }

        // Sort by conference wins desc, then overall wins
        standings.sort((a, b) => {
            if (a.confWins !== b.confWins) return b.confWins - a.confWins;
            if (a.confLosses !== b.confLosses) return a.confLosses - b.confLosses;
            return b.wins - a.wins;
        });

        standings.forEach((team, index) => {
            team.rank = index + 1;
        });

        res.status(200).json({
            conference: confInfo.conference,
            team: teamKey,
            teamColor: TEAM_COLORS[teamKey],
            standings,
            updated: new Date().toISOString(),
            source: 'espn'
        });
    } catch (error) {
        console.error('Standings fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch standings', message: error.message });
    }
}
