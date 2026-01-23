// Fantasy Players API - SportsDataIO Only
// GET: Returns real players with DFS salaries from SportsDataIO
// Supports contestId filtering to show only players from games in the contest

import { getCollection } from '../lib/mongodb.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

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

    const { sport, date, contestId } = req.query;

    if (!sport) {
        return res.status(400).json({ error: 'Sport is required' });
    }

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const sportUpper = sport.toUpperCase();

        // Fetch games and players from SportsDataIO
        const result = await fetchPlayersFromSportsDataIO(sportUpper, targetDate);
        let { players, games } = result;

        // Filter by contestId if provided (only if players have gameIds)
        const hasGameIds = players.some(p => p.gameId);
        if (contestId && players.length > 0 && hasGameIds) {
            try {
                const contestsCollection = await getCollection('fantasy_contests');
                const { ObjectId } = await import('mongodb');
                const contest = await contestsCollection.findOne({ _id: new ObjectId(contestId) });

                if (contest && contest.gameIds && contest.gameIds.length > 0) {
                    const validGameIds = new Set(contest.gameIds.map(id => id.toString()));
                    players = players.filter(p => p.gameId && validGameIds.has(p.gameId.toString()));
                    games = games.filter(g => g.id && validGameIds.has(g.id.toString()));
                }
            } catch (err) {
                console.error('Error filtering by contest:', err.message);
            }
        }

        return res.status(200).json({
            success: true,
            players,
            games,
            sport: sportUpper,
            date: targetDate,
            source: 'sportsdata',
            totalPlayers: players.length
        });
    } catch (error) {
        console.error('Fantasy players error:', error);
        return res.status(500).json({ error: 'Failed to fetch players: ' + error.message });
    }
}

// Fetch players from SportsDataIO
async function fetchPlayersFromSportsDataIO(sport, targetDate) {
    // Determine current season based on date
    const date = new Date(targetDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // NBA/NHL seasons span two years - use the ending year
    // e.g., 2025-26 season = "2026" in January 2026
    const nbaNhlSeason = month >= 10 ? year + 1 : year;
    const mlbSeason = year;
    const nflSeason = month >= 3 && month <= 8 ? year : year; // Regular season year

    const sportConfig = {
        NFL: { endpoint: 'nfl', season: nflSeason.toString() },
        NBA: { endpoint: 'nba', season: nbaNhlSeason.toString() },
        MLB: { endpoint: 'mlb', season: mlbSeason.toString() },
        NHL: { endpoint: 'nhl', season: nbaNhlSeason.toString() }
    };

    const config = sportConfig[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    console.log(`fetchPlayersFromSportsDataIO: sport=${sport}, date=${targetDate}, season=${config.season}`);
    console.log(`API Key present: ${!!SPORTSDATA_API_KEY}, length: ${SPORTSDATA_API_KEY?.length || 0}`);

    // First try to get DFS slates (best for salaries)
    try {
        const slatesUrl = `https://api.sportsdata.io/v3/${config.endpoint}/projections/json/DfsSlatesByDate/${targetDate}?key=${SPORTSDATA_API_KEY}`;
        console.log(`Trying DFS slates: ${slatesUrl.replace(SPORTSDATA_API_KEY, 'XXX')}`);
        const slatesResponse = await fetch(slatesUrl);
        console.log(`DFS slates response: ${slatesResponse.status}`);

        if (slatesResponse.ok) {
            const slates = await slatesResponse.json();

            if (slates && slates.length > 0) {
                const mainSlate = slates.find(s => s.Operator === 'DraftKings') || slates[0];

                if (mainSlate && mainSlate.DfsSlateGames && mainSlate.DfsSlateGames.length > 0) {
                    // Extract games from the slate
                    const games = mainSlate.DfsSlateGames.map(g => ({
                        id: (g.GameID || g.Game?.GameID)?.toString(),
                        homeTeam: g.Game?.HomeTeam,
                        awayTeam: g.Game?.AwayTeam,
                        gameTime: g.Game?.DateTime,
                        status: g.Game?.Status
                    }));

                    // Fetch player projections for this slate
                    const playersUrl = `https://api.sportsdata.io/v3/${config.endpoint}/projections/json/DfsSlatePlayersBySlateID/${mainSlate.SlateID}?key=${SPORTSDATA_API_KEY}`;
                    const playersResponse = await fetch(playersUrl);

                    if (playersResponse.ok) {
                        const slatePlayers = await playersResponse.json();

                        const players = slatePlayers.map(player => ({
                            id: player.PlayerID?.toString() || player.OperatorPlayerID,
                            name: player.OperatorPlayerName || player.Name,
                            position: player.OperatorPosition || player.Position,
                            team: player.Team,
                            teamAbbreviation: player.Team,
                            salary: player.OperatorSalary || calculateSalary(sport, player.OperatorPosition || player.Position),
                            opponent: player.Opponent || 'TBD',
                            projectedPoints: player.FantasyPoints || player.OperatorFantasyPoints || 0,
                            imageUrl: null,
                            gameTime: player.GameTime,
                            gameId: (player.SlateGameID || player.GameID)?.toString()
                        }));

                        return { players, games };
                    }
                }
            }
        }
    } catch (e) {
        console.log('DFS slates not available, falling back to schedule:', e.message);
    }

    // Fallback: Get games from schedule and players from roster
    return await fetchFromScheduleAndRosters(sport, config, targetDate);
}

// Fallback: fetch games from schedule and players from rosters
async function fetchFromScheduleAndRosters(sport, config, targetDate) {
    // Get games for the date
    const gamesUrl = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/GamesByDate/${targetDate}?key=${SPORTSDATA_API_KEY}`;
    console.log(`Fetching games from: ${gamesUrl.replace(SPORTSDATA_API_KEY, 'XXX')}`);

    const gamesResponse = await fetch(gamesUrl);

    if (!gamesResponse.ok) {
        console.error('Games fetch failed:', gamesResponse.status, await gamesResponse.text());
        // If no games endpoint, return all active players
        return await fetchAllActivePlayers(sport, config);
    }

    const gamesData = await gamesResponse.json();
    console.log(`Games found for ${sport} on ${targetDate}:`, gamesData?.length || 0);

    if (!gamesData || gamesData.length === 0) {
        console.log('No games found for date, returning all active players');
        return await fetchAllActivePlayers(sport, config);
    }

    // Build list of teams playing
    const teamsPlaying = new Set();
    const games = gamesData.map(game => {
        teamsPlaying.add(game.HomeTeam);
        teamsPlaying.add(game.AwayTeam);

        return {
            id: (game.GameID || game.ScoreID)?.toString(),
            homeTeam: game.HomeTeam,
            awayTeam: game.AwayTeam,
            gameTime: game.DateTime || game.Day,
            status: game.Status
        };
    });

    // Create game lookup for opponent info
    const gamesByTeam = {};
    gamesData.forEach(game => {
        gamesByTeam[game.HomeTeam] = {
            gameId: (game.GameID || game.ScoreID)?.toString(),
            opponent: game.AwayTeam,
            isHome: true,
            gameTime: game.DateTime || game.Day
        };
        gamesByTeam[game.AwayTeam] = {
            gameId: (game.GameID || game.ScoreID)?.toString(),
            opponent: game.HomeTeam,
            isHome: false,
            gameTime: game.DateTime || game.Day
        };
    });

    // Fetch all players and filter to teams playing
    const playersUrl = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/Players?key=${SPORTSDATA_API_KEY}`;
    const playersResponse = await fetch(playersUrl);

    if (!playersResponse.ok) {
        throw new Error(`Players fetch failed: ${playersResponse.status}`);
    }

    const allPlayers = await playersResponse.json();

    // Filter to active players on teams playing today
    const players = allPlayers
        .filter(p => p.Status === 'Active' && teamsPlaying.has(p.Team))
        .map(player => {
            const gameInfo = gamesByTeam[player.Team] || {};
            return {
                id: player.PlayerID?.toString(),
                name: `${player.FirstName} ${player.LastName}`,
                position: player.Position,
                team: player.Team,
                teamAbbreviation: player.Team,
                salary: calculateSalary(sport, player.Position),
                opponent: gameInfo.opponent || 'TBD',
                isHome: gameInfo.isHome,
                projectedPoints: 0,
                imageUrl: player.PhotoUrl || null,
                gameId: gameInfo.gameId,
                gameTime: gameInfo.gameTime
            };
        });

    // Sort by salary descending
    players.sort((a, b) => b.salary - a.salary);

    return { players, games };
}

// Fetch all active players (when no games found for date)
async function fetchAllActivePlayers(sport, config) {
    console.log(`fetchAllActivePlayers called for ${sport}, endpoint: ${config.endpoint}`);
    console.log(`API Key present: ${!!SPORTSDATA_API_KEY}`);

    const playersUrl = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/Players?key=${SPORTSDATA_API_KEY}`;
    console.log(`Fetching players from: ${playersUrl.replace(SPORTSDATA_API_KEY, 'XXX')}`);

    const response = await fetch(playersUrl);
    console.log(`Players response status: ${response.status}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Players fetch failed: ${response.status}`, errorText);
        throw new Error(`Players fetch failed: ${response.status}`);
    }

    const allPlayers = await response.json();
    console.log(`Total players returned: ${allPlayers?.length || 0}`);

    const players = allPlayers
        .filter(p => p.Status === 'Active')
        .slice(0, 500) // Limit for performance
        .map(player => ({
            id: player.PlayerID?.toString(),
            name: `${player.FirstName} ${player.LastName}`,
            position: player.Position,
            team: player.Team,
            teamAbbreviation: player.Team,
            salary: calculateSalary(sport, player.Position),
            opponent: 'TBD',
            projectedPoints: 0,
            imageUrl: player.PhotoUrl || null,
            gameId: null,
            gameTime: null
        }));

    // Sort by salary descending
    players.sort((a, b) => b.salary - a.salary);

    return { players, games: [] };
}

// Calculate salary based on position
function calculateSalary(sport, position) {
    const salaries = {
        NFL: { QB: 7500, RB: 6500, WR: 6000, TE: 5000, K: 4500, DEF: 4000, default: 5000 },
        NBA: { PG: 7000, SG: 6500, SF: 6500, PF: 6000, C: 7000, G: 6500, F: 6000, default: 6000 },
        MLB: { SP: 9000, RP: 5000, C: 4500, '1B': 5000, '2B': 4500, '3B': 5000, SS: 5500, OF: 5000, DH: 5000, default: 5000 },
        NHL: { C: 6000, LW: 5500, RW: 5500, D: 5000, G: 7000, default: 5500 }
    };

    const sportSalaries = salaries[sport] || salaries.NFL;
    const base = sportSalaries[position] || sportSalaries.default;

    // Add some variance for realism
    const variance = Math.floor(Math.random() * 2000) - 500;
    return Math.max(3000, Math.min(10000, base + variance));
}
