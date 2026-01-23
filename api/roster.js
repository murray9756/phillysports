// Vercel Serverless Function - Fetch Team Roster
// Uses SportsDataIO for all sports data

import { fetchTeamRoster, COLLEGE_TEAMS } from './lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// Team configurations
const TEAM_CONFIG = {
    'eagles': { sport: 'NFL', abbr: 'PHI', name: 'Eagles' },
    'phillies': { sport: 'MLB', abbr: 'PHI', name: 'Phillies' },
    'sixers': { sport: 'NBA', abbr: 'PHI', name: '76ers' },
    '76ers': { sport: 'NBA', abbr: 'PHI', name: '76ers' },
    'flyers': { sport: 'NHL', abbr: 'PHI', name: 'Flyers' },
    'union': { sport: 'MLS', abbr: 'PHI', name: 'Union' }
};

// College team configurations
const COLLEGE_CONFIG = {
    'villanova': { sport: 'NCAAB', name: 'Villanova' },
    'penn': { sport: 'NCAAB', name: 'Penn' },
    'lasalle': { sport: 'NCAAB', name: 'La Salle' },
    'drexel': { sport: 'NCAAB', name: 'Drexel' },
    'stjosephs': { sport: 'NCAAB', name: 'St. Josephs' },
    'temple': { sport: 'NCAAB', name: 'Temple' }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team } = req.query;

    if (!team) {
        return res.status(400).json({ error: 'Team parameter required' });
    }

    const teamLower = team.toLowerCase();
    const config = TEAM_CONFIG[teamLower];
    const collegeConfig = COLLEGE_CONFIG[teamLower];

    if (!config && !collegeConfig) {
        return res.status(400).json({ error: 'Invalid team' });
    }

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        let players = [];
        let teamName = '';

        if (config) {
            // Pro team roster
            teamName = config.name;

            // MLS not supported by SportsDataIO, fall back to ESPN
            if (config.sport === 'MLS') {
                const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/roster';
                const response = await fetch(url);
                const data = await response.json();

                const athletes = data.athletes || [];
                for (const item of athletes) {
                    if (item.items) {
                        for (const player of item.items) {
                            players.push(extractESPNPlayer(player));
                        }
                    } else if (item.displayName || item.fullName) {
                        players.push(extractESPNPlayer(item));
                    }
                }
            } else {
                // Use SportsDataIO for pro sports
                const rosterData = await fetchTeamRoster(config.sport, config.abbr);

                players = rosterData.map(player => ({
                    name: `${player.FirstName || ''} ${player.LastName || ''}`.trim() || player.Name,
                    firstName: player.FirstName,
                    lastName: player.LastName,
                    number: player.Jersey || player.Number || '',
                    position: player.Position || '',
                    positionFull: player.PositionCategory || player.Position || '',
                    headshot: player.PhotoUrl || null,
                    status: player.Status || 'Active',
                    college: player.College || '',
                    experience: player.Experience || 0,
                    height: player.Height ? formatHeight(player.Height) : '',
                    weight: player.Weight ? `${player.Weight} lbs` : '',
                    playerId: player.PlayerID?.toString()
                }));
            }
        } else if (collegeConfig) {
            // College team roster
            teamName = collegeConfig.name;
            const teamId = COLLEGE_TEAMS[teamLower]?.id || teamLower.toUpperCase();

            const url = `https://api.sportsdata.io/v3/cbb/scores/json/Players/${teamId}?key=${SPORTSDATA_API_KEY}`;
            const response = await fetch(url);

            if (response.ok) {
                const rosterData = await response.json();
                players = rosterData.map(player => ({
                    name: `${player.FirstName || ''} ${player.LastName || ''}`.trim(),
                    firstName: player.FirstName,
                    lastName: player.LastName,
                    number: player.Jersey || '',
                    position: player.Position || '',
                    positionFull: player.Position || '',
                    headshot: player.PhotoUrl || null,
                    status: player.Status || 'Active',
                    college: '',
                    experience: player.Class || '',
                    height: player.Height ? formatHeight(player.Height) : '',
                    weight: player.Weight ? `${player.Weight} lbs` : '',
                    playerId: player.PlayerID?.toString()
                }));
            }
        }

        // Sort by position then number
        const positionOrder = {
            'QB': 1, 'RB': 2, 'WR': 3, 'TE': 4, 'OL': 5, 'OT': 5, 'OG': 5, 'C': 5,
            'DL': 6, 'DE': 6, 'DT': 6, 'LB': 7, 'CB': 8, 'S': 9, 'K': 10, 'P': 11,
            'G': 1, 'F': 2, // Basketball
            'LW': 2, 'RW': 2, 'D': 3, // Hockey
            '1B': 3, '2B': 4, '3B': 5, 'SS': 6, 'LF': 7, 'CF': 8, 'RF': 9, 'DH': 10, 'SP': 11, 'RP': 12 // Baseball
        };

        players.sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return (parseInt(a.number) || 99) - (parseInt(b.number) || 99);
        });

        res.status(200).json({
            team: teamName,
            players: players,
            count: players.length,
            updated: new Date().toISOString(),
            source: 'sportsdata'
        });
    } catch (error) {
        console.error('Roster fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch roster', message: error.message });
    }
}

function formatHeight(inches) {
    if (!inches) return '';
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
}

function extractESPNPlayer(player) {
    const playerLink = player.links?.find(l => l.rel?.includes('playercard'))?.href || null;
    return {
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
        weight: player.displayWeight || '',
        link: playerLink
    };
}
