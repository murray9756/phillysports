// Vercel Serverless Function - Fetch College Basketball Conference Standings
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team } = req.query;

    // Conference mapping for each team
    const teamConferences = {
        'villanova': { conference: 'Big East', confId: '4' },
        'penn': { conference: 'Ivy League', confId: '22' },
        'lasalle': { conference: 'Atlantic 10', confId: '3' },
        'drexel': { conference: 'CAA', confId: '10' },
        'stjosephs': { conference: 'Atlantic 10', confId: '3' },
        'temple': { conference: 'AAC', confId: '62' }
    };

    // Team colors for display
    const teamColors = {
        'villanova': '#003366',
        'penn': '#011F5B',
        'lasalle': '#00833E',
        'drexel': '#07294D',
        'stjosephs': '#9E1B32',
        'temple': '#9D2235'
    };

    // Team ESPN IDs for highlighting
    const teamIds = {
        'villanova': '2678',
        'penn': '219',
        'lasalle': '2325',
        'drexel': '2182',
        'stjosephs': '2603',
        'temple': '218'
    };

    if (!team) {
        return res.status(400).json({ error: 'Team parameter required' });
    }

    const teamKey = team.toLowerCase();
    const confInfo = teamConferences[teamKey];

    if (!confInfo) {
        return res.status(400).json({ error: 'Invalid team. Valid options: villanova, penn, lasalle, drexel, stjosephs, temple' });
    }

    try {
        // Fetch conference standings from ESPN
        const url = `https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings?group=${confInfo.confId}`;
        const response = await fetch(url);
        const data = await response.json();

        const standings = [];
        const entries = data.standings?.entries || [];

        for (const entry of entries) {
            const teamData = entry.team;
            const stats = entry.stats || [];

            // Extract relevant stats
            const getStatValue = (name) => {
                const stat = stats.find(s => s.name === name || s.abbreviation === name);
                return stat?.displayValue || stat?.value || '0';
            };

            standings.push({
                rank: parseInt(getStatValue('playoffSeed')) || standings.length + 1,
                teamId: teamData?.id,
                teamName: teamData?.shortDisplayName || teamData?.displayName,
                teamLogo: teamData?.logos?.[0]?.href || null,
                wins: getStatValue('wins') || getStatValue('W'),
                losses: getStatValue('losses') || getStatValue('L'),
                confWins: getStatValue('conferenceWins') || getStatValue('CONF_W') || '-',
                confLosses: getStatValue('conferenceLosses') || getStatValue('CONF_L') || '-',
                winPct: getStatValue('winPercent') || getStatValue('PCT'),
                streak: getStatValue('streak') || '-',
                isHighlighted: teamData?.id === teamIds[teamKey]
            });
        }

        // Sort by conference wins (descending), then overall wins
        standings.sort((a, b) => {
            const confWinA = parseInt(a.confWins) || 0;
            const confWinB = parseInt(b.confWins) || 0;
            if (confWinA !== confWinB) return confWinB - confWinA;
            return (parseInt(b.wins) || 0) - (parseInt(a.wins) || 0);
        });

        // Add rank after sorting
        standings.forEach((team, index) => {
            team.rank = index + 1;
        });

        res.status(200).json({
            conference: confInfo.conference,
            team: teamKey,
            teamColor: teamColors[teamKey],
            standings: standings,
            updated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Standings fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch standings', message: error.message });
    }
}
