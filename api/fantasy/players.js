// Fantasy Players API
// GET: Returns players for a given sport and date for lineup building

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sport, date } = req.query;

    if (!sport) {
        return res.status(400).json({ error: 'Sport is required' });
    }

    try {
        // Generate sample players based on sport
        // In production, this would fetch from a real fantasy sports data provider
        const players = generateSamplePlayers(sport.toUpperCase());

        return res.status(200).json({
            success: true,
            players,
            sport: sport.toUpperCase(),
            date: date || new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        console.error('Fantasy players error:', error);
        return res.status(500).json({ error: 'Failed to fetch players' });
    }
}

function generateSamplePlayers(sport) {
    const sportConfigs = {
        NFL: {
            positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
            teams: [
                { abbr: 'PHI', name: 'Eagles', opponent: 'vs DAL' },
                { abbr: 'DAL', name: 'Cowboys', opponent: '@ PHI' },
                { abbr: 'NYG', name: 'Giants', opponent: 'vs WAS' },
                { abbr: 'WAS', name: 'Commanders', opponent: '@ NYG' }
            ],
            players: [
                { name: 'Jalen Hurts', position: 'QB', team: 'PHI', salary: 8500 },
                { name: 'Saquon Barkley', position: 'RB', team: 'PHI', salary: 9000 },
                { name: 'AJ Brown', position: 'WR', team: 'PHI', salary: 7800 },
                { name: 'DeVonta Smith', position: 'WR', team: 'PHI', salary: 7200 },
                { name: 'Dallas Goedert', position: 'TE', team: 'PHI', salary: 5500 },
                { name: 'Jake Elliott', position: 'K', team: 'PHI', salary: 4500 },
                { name: 'Eagles D/ST', position: 'DEF', team: 'PHI', salary: 4000 },
                { name: 'Dak Prescott', position: 'QB', team: 'DAL', salary: 7500 },
                { name: 'CeeDee Lamb', position: 'WR', team: 'DAL', salary: 8200 },
                { name: 'Rico Dowdle', position: 'RB', team: 'DAL', salary: 5800 },
                { name: 'Jake Ferguson', position: 'TE', team: 'DAL', salary: 4800 },
                { name: 'Daniel Jones', position: 'QB', team: 'NYG', salary: 5500 },
                { name: 'Malik Nabers', position: 'WR', team: 'NYG', salary: 6500 },
                { name: 'Devin Singletary', position: 'RB', team: 'NYG', salary: 5200 },
                { name: 'Jayden Daniels', position: 'QB', team: 'WAS', salary: 7000 },
                { name: 'Terry McLaurin', position: 'WR', team: 'WAS', salary: 6800 },
                { name: 'Brian Robinson', position: 'RB', team: 'WAS', salary: 5500 }
            ]
        },
        NBA: {
            positions: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'],
            teams: [
                { abbr: 'PHI', name: '76ers', opponent: 'vs BOS' },
                { abbr: 'BOS', name: 'Celtics', opponent: '@ PHI' },
                { abbr: 'NYK', name: 'Knicks', opponent: 'vs BKN' },
                { abbr: 'BKN', name: 'Nets', opponent: '@ NYK' }
            ],
            players: [
                { name: 'Joel Embiid', position: 'C', team: 'PHI', salary: 10500 },
                { name: 'Tyrese Maxey', position: 'PG', team: 'PHI', salary: 8200 },
                { name: 'Paul George', position: 'SF', team: 'PHI', salary: 7500 },
                { name: 'Caleb Martin', position: 'SF', team: 'PHI', salary: 4500 },
                { name: 'Kelly Oubre Jr', position: 'SG', team: 'PHI', salary: 5200 },
                { name: 'Jayson Tatum', position: 'SF', team: 'BOS', salary: 9800 },
                { name: 'Jaylen Brown', position: 'SG', team: 'BOS', salary: 8000 },
                { name: 'Derrick White', position: 'PG', team: 'BOS', salary: 6200 },
                { name: 'Jalen Brunson', position: 'PG', team: 'NYK', salary: 8500 },
                { name: 'Karl-Anthony Towns', position: 'C', team: 'NYK', salary: 8800 },
                { name: 'OG Anunoby', position: 'SF', team: 'NYK', salary: 6000 },
                { name: 'Cam Thomas', position: 'SG', team: 'BKN', salary: 7200 },
                { name: 'Nic Claxton', position: 'C', team: 'BKN', salary: 5500 }
            ]
        },
        MLB: {
            positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
            teams: [
                { abbr: 'PHI', name: 'Phillies', opponent: 'vs NYM' },
                { abbr: 'NYM', name: 'Mets', opponent: '@ PHI' },
                { abbr: 'ATL', name: 'Braves', opponent: 'vs MIA' },
                { abbr: 'MIA', name: 'Marlins', opponent: '@ ATL' }
            ],
            players: [
                { name: 'Bryce Harper', position: '1B', team: 'PHI', salary: 5800 },
                { name: 'Kyle Schwarber', position: 'OF', team: 'PHI', salary: 5200 },
                { name: 'Trea Turner', position: 'SS', team: 'PHI', salary: 5500 },
                { name: 'JT Realmuto', position: 'C', team: 'PHI', salary: 4800 },
                { name: 'Alec Bohm', position: '3B', team: 'PHI', salary: 4500 },
                { name: 'Nick Castellanos', position: 'OF', team: 'PHI', salary: 4200 },
                { name: 'Zack Wheeler', position: 'P', team: 'PHI', salary: 9500 },
                { name: 'Aaron Nola', position: 'P', team: 'PHI', salary: 8200 },
                { name: 'Francisco Lindor', position: 'SS', team: 'NYM', salary: 5600 },
                { name: 'Pete Alonso', position: '1B', team: 'NYM', salary: 5000 },
                { name: 'Mark Vientos', position: '3B', team: 'NYM', salary: 4800 },
                { name: 'Ronald Acuna Jr', position: 'OF', team: 'ATL', salary: 6000 },
                { name: 'Ozzie Albies', position: '2B', team: 'ATL', salary: 4500 },
                { name: 'Matt Olson', position: '1B', team: 'ATL', salary: 4800 }
            ]
        },
        NHL: {
            positions: ['C', 'W', 'D', 'G', 'UTIL'],
            teams: [
                { abbr: 'PHI', name: 'Flyers', opponent: 'vs PIT' },
                { abbr: 'PIT', name: 'Penguins', opponent: '@ PHI' },
                { abbr: 'NYR', name: 'Rangers', opponent: 'vs NJD' },
                { abbr: 'NJD', name: 'Devils', opponent: '@ NYR' }
            ],
            players: [
                { name: 'Travis Konecny', position: 'W', team: 'PHI', salary: 7200 },
                { name: 'Matvei Michkov', position: 'W', team: 'PHI', salary: 6800 },
                { name: 'Owen Tippett', position: 'W', team: 'PHI', salary: 5500 },
                { name: 'Morgan Frost', position: 'C', team: 'PHI', salary: 5000 },
                { name: 'Sean Couturier', position: 'C', team: 'PHI', salary: 4800 },
                { name: 'Travis Sanheim', position: 'D', team: 'PHI', salary: 4500 },
                { name: 'Samuel Ersson', position: 'G', team: 'PHI', salary: 7500 },
                { name: 'Sidney Crosby', position: 'C', team: 'PIT', salary: 8000 },
                { name: 'Evgeni Malkin', position: 'C', team: 'PIT', salary: 6500 },
                { name: 'Bryan Rust', position: 'W', team: 'PIT', salary: 5800 },
                { name: 'Artemi Panarin', position: 'W', team: 'NYR', salary: 8200 },
                { name: 'Adam Fox', position: 'D', team: 'NYR', salary: 7000 },
                { name: 'Jack Hughes', position: 'C', team: 'NJD', salary: 8500 },
                { name: 'Jesper Bratt', position: 'W', team: 'NJD', salary: 7200 }
            ]
        }
    };

    const config = sportConfigs[sport] || sportConfigs.NFL;

    // Add IDs, team abbrs, and opponent info
    return config.players.map((player, index) => {
        const teamInfo = config.teams.find(t => t.abbr === player.team);
        return {
            id: `${sport}-${player.team}-${index}`,
            name: player.name,
            position: player.position,
            team: teamInfo?.name || player.team,
            teamAbbreviation: player.team,
            salary: player.salary,
            opponent: teamInfo?.opponent || 'TBD',
            projectedPoints: Math.round((player.salary / 1000) * (Math.random() * 0.4 + 0.8) * 10) / 10,
            imageUrl: null
        };
    });
}
