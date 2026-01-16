// Fantasy Players API - Fetch players with salaries for a sport/date
import { getCollection } from '../../lib/mongodb.js';

// ESPN roster URLs by sport
const ROSTER_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams'
};

const SCOREBOARD_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Base salaries by position
const BASE_SALARIES = {
    NFL: { QB: 7500, RB: 6000, WR: 5500, TE: 4500, K: 4000, DEF: 4000, LB: 4000, DB: 4000, DL: 4000 },
    NBA: { PG: 6500, SG: 6000, SF: 5500, PF: 5500, C: 5000, G: 6000, F: 5500 },
    MLB: { SP: 8000, RP: 5000, C: 4500, '1B': 5000, '2B': 5000, '3B': 5000, SS: 5000, OF: 5000, DH: 5000 },
    NHL: { C: 6000, LW: 5500, RW: 5500, D: 5000, G: 7000 }
};

// Position mappings for ESPN positions
const POSITION_MAP = {
    NFL: {
        'Quarterback': 'QB', 'Running Back': 'RB', 'Wide Receiver': 'WR',
        'Tight End': 'TE', 'Kicker': 'K', 'Linebacker': 'LB',
        'Defensive Back': 'DB', 'Defensive Lineman': 'DL', 'Safety': 'DB',
        'Cornerback': 'DB', 'Outside Linebacker': 'LB', 'Middle Linebacker': 'LB',
        'Defensive End': 'DL', 'Defensive Tackle': 'DL', 'Fullback': 'RB'
    },
    NBA: {
        'Point Guard': 'PG', 'Shooting Guard': 'SG', 'Small Forward': 'SF',
        'Power Forward': 'PF', 'Center': 'C', 'Guard': 'G', 'Forward': 'F'
    },
    MLB: {
        'Starting Pitcher': 'SP', 'Relief Pitcher': 'RP', 'Catcher': 'C',
        'First Baseman': '1B', 'Second Baseman': '2B', 'Third Baseman': '3B',
        'Shortstop': 'SS', 'Left Fielder': 'OF', 'Center Fielder': 'OF',
        'Right Fielder': 'OF', 'Designated Hitter': 'DH', 'Pitcher': 'SP',
        'Outfielder': 'OF'
    },
    NHL: {
        'Center': 'C', 'Left Wing': 'LW', 'Right Wing': 'RW',
        'Defenseman': 'D', 'Goalie': 'G', 'Winger': 'RW'
    }
};

function formatDateForESPN(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// Calculate salary based on position and add variance
function calculateSalary(sport, position, playerName) {
    const baseSalaries = BASE_SALARIES[sport] || {};
    const base = baseSalaries[position] || 5000;

    // Add some variance based on player name hash for consistency
    const hash = playerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variance = (hash % 3000) - 1000; // -1000 to +2000

    return Math.max(3000, Math.min(10000, base + variance));
}

// Map ESPN position to fantasy position
function mapPosition(sport, espnPosition) {
    const mapping = POSITION_MAP[sport] || {};
    return mapping[espnPosition] || espnPosition;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sport, date, contestId } = req.query;

        if (!sport || !['NFL', 'NBA', 'MLB', 'NHL'].includes(sport)) {
            return res.status(400).json({ error: 'Invalid sport. Must be NFL, NBA, MLB, or NHL' });
        }

        // Get games for the date
        const targetDate = date || new Date().toISOString().split('T')[0];
        const formattedDate = formatDateForESPN(targetDate);
        const scoreboardUrl = `${SCOREBOARD_URLS[sport]}?dates=${formattedDate}`;

        const scoreboardResponse = await fetch(scoreboardUrl);
        const scoreboardData = await scoreboardResponse.json();
        const events = scoreboardData.events || [];

        if (events.length === 0) {
            return res.status(200).json({
                success: true,
                sport,
                date: targetDate,
                players: [],
                games: [],
                message: 'No games found for this date'
            });
        }

        // Extract teams playing today
        const teamsPlaying = new Map();
        const games = [];

        for (const event of events) {
            const competition = event.competitions?.[0];
            if (!competition) continue;

            const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');

            if (homeTeam?.team) {
                teamsPlaying.set(homeTeam.team.id, {
                    id: homeTeam.team.id,
                    name: homeTeam.team.displayName,
                    abbreviation: homeTeam.team.abbreviation,
                    opponent: awayTeam?.team?.displayName,
                    isHome: true,
                    gameId: event.id,
                    gameTime: event.date
                });
            }
            if (awayTeam?.team) {
                teamsPlaying.set(awayTeam.team.id, {
                    id: awayTeam.team.id,
                    name: awayTeam.team.displayName,
                    abbreviation: awayTeam.team.abbreviation,
                    opponent: homeTeam?.team?.displayName,
                    isHome: false,
                    gameId: event.id,
                    gameTime: event.date
                });
            }

            games.push({
                id: event.id,
                homeTeam: homeTeam?.team?.displayName,
                awayTeam: awayTeam?.team?.displayName,
                gameTime: event.date,
                status: competition.status?.type?.description
            });
        }

        // Fetch rosters for all teams playing
        const players = [];
        const rosterBaseUrl = ROSTER_URLS[sport];

        for (const [teamId, teamInfo] of teamsPlaying) {
            try {
                const rosterUrl = `${rosterBaseUrl}/${teamId}/roster`;
                const rosterResponse = await fetch(rosterUrl);
                const rosterData = await rosterResponse.json();

                const athletes = rosterData.athletes || [];

                for (const positionGroup of athletes) {
                    const groupAthletes = positionGroup.items || [];
                    for (const athlete of groupAthletes) {
                        const espnPosition = athlete.position?.displayName || positionGroup.position || 'Unknown';
                        const mappedPosition = mapPosition(sport, espnPosition);
                        const salary = calculateSalary(sport, mappedPosition, athlete.fullName || '');

                        players.push({
                            id: athlete.id,
                            name: athlete.fullName || athlete.displayName,
                            team: teamInfo.name,
                            teamAbbreviation: teamInfo.abbreviation,
                            position: mappedPosition,
                            espnPosition: espnPosition,
                            salary,
                            opponent: teamInfo.opponent,
                            isHome: teamInfo.isHome,
                            gameId: teamInfo.gameId,
                            gameTime: teamInfo.gameTime,
                            imageUrl: athlete.headshot?.href || null
                        });
                    }
                }
            } catch (err) {
                console.error(`Error fetching roster for team ${teamId}:`, err.message);
            }
        }

        // Sort by salary descending
        players.sort((a, b) => b.salary - a.salary);

        // If contestId provided, filter to only players for that contest's games
        if (contestId) {
            const contestsCollection = await getCollection('fantasy_contests');
            const { ObjectId } = await import('mongodb');
            const contest = await contestsCollection.findOne({ _id: new ObjectId(contestId) });
            if (contest && contest.gameIds) {
                const validGameIds = new Set(contest.gameIds);
                const filteredPlayers = players.filter(p => validGameIds.has(p.gameId));
                return res.status(200).json({
                    success: true,
                    sport,
                    date: targetDate,
                    players: filteredPlayers,
                    games: games.filter(g => validGameIds.has(g.id)),
                    totalPlayers: filteredPlayers.length
                });
            }
        }

        return res.status(200).json({
            success: true,
            sport,
            date: targetDate,
            players,
            games,
            totalPlayers: players.length
        });
    } catch (error) {
        console.error('Fantasy players error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
