// Vercel Serverless Function - Fetch Team Roster
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team } = req.query;

    if (!team) {
        return res.status(400).json({ error: 'Team parameter required' });
    }

    const teamConfig = {
        'eagles': { sport: 'football', league: 'nfl', id: 'phi', name: 'Eagles' },
        'phillies': { sport: 'baseball', league: 'mlb', id: 'phi', name: 'Phillies' },
        'sixers': { sport: 'basketball', league: 'nba', id: 'phi', name: '76ers' },
        '76ers': { sport: 'basketball', league: 'nba', id: 'phi', name: '76ers' },
        'flyers': { sport: 'hockey', league: 'nhl', id: 'phi', name: 'Flyers' },
        'union': { sport: 'soccer', league: 'usa.1', id: 'phi', name: 'Union' }
    };

    const config = teamConfig[team.toLowerCase()];
    if (!config) {
        return res.status(400).json({ error: 'Invalid team' });
    }

    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/teams/${config.id}/roster`;
        const response = await fetch(url);
        const data = await response.json();

        const players = [];
        const athletes = data.athletes || [];

        // Helper to extract player data
        const extractPlayer = (player) => ({
            name: player.displayName || player.fullName,
            firstName: player.firstName,
            lastName: player.lastName,
            number: player.jersey || '',
            position: player.position?.abbreviation || player.position?.name || '',
            positionFull: player.position?.displayName || player.position?.name || '',
            headshot: player.headshot?.href || null,
            status: player.status?.name || 'Active',
            college: player.college?.name || '',
            experience: player.experience?.years || 0,
            height: player.displayHeight || '',
            weight: player.displayWeight || ''
        });

        // Check if athletes array contains direct players or position groups
        for (const item of athletes) {
            if (item.items) {
                // NFL/MLB style: grouped by position with items array
                for (const player of item.items) {
                    players.push(extractPlayer(player));
                }
            } else if (item.displayName || item.fullName) {
                // NBA/NHL style: direct player objects
                players.push(extractPlayer(item));
            }
        }

        // Sort by position then number
        const positionOrder = {
            'QB': 1, 'RB': 2, 'WR': 3, 'TE': 4, 'OL': 5, 'OT': 5, 'OG': 5, 'C': 5,
            'DL': 6, 'DE': 6, 'DT': 6, 'LB': 7, 'CB': 8, 'S': 9, 'K': 10, 'P': 11,
            'G': 1, 'F': 2, 'C': 3, // Basketball
            'C': 1, 'LW': 2, 'RW': 2, 'D': 3, 'G': 4, // Hockey
            'P': 1, 'C': 2, '1B': 3, '2B': 4, '3B': 5, 'SS': 6, 'LF': 7, 'CF': 8, 'RF': 9, 'DH': 10, 'SP': 11, 'RP': 12 // Baseball
        };

        players.sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return (parseInt(a.number) || 99) - (parseInt(b.number) || 99);
        });

        res.status(200).json({
            team: config.name,
            players: players,
            count: players.length,
            updated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Roster fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch roster', message: error.message });
    }
}
