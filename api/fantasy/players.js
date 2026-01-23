// Fantasy Players API
// GET: Returns real players with DFS salaries from SportsDataIO
// Fallback to ESPN if no API key configured
// Supports contestId filtering to show only players from games in the contest

import { getCollection } from '../lib/mongodb.js';

// SportsDataIO API key - set in environment variable
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

    try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        let players;
        let games = [];
        let source = 'espn';

        // Try SportsDataIO first if API key is configured
        if (SPORTSDATA_API_KEY) {
            try {
                const result = await fetchPlayersFromSportsDataIO(sport.toUpperCase(), targetDate);
                players = result.players;
                games = result.games;
                source = 'sportsdata';
            } catch (e) {
                console.error('SportsDataIO error, falling back to ESPN:', e.message);
                const result = await fetchPlayersFromESPN(sport.toUpperCase(), targetDate);
                players = result.players;
                games = result.games;
            }
        } else {
            // Fallback to ESPN (no salaries)
            const result = await fetchPlayersFromESPN(sport.toUpperCase(), targetDate);
            players = result.players;
            games = result.games;
        }

        // Filter by contestId if provided
        if (contestId && players.length > 0) {
            try {
                const contestsCollection = await getCollection('fantasy_contests');
                const { ObjectId } = await import('mongodb');
                const contest = await contestsCollection.findOne({ _id: new ObjectId(contestId) });

                if (contest && contest.gameIds && contest.gameIds.length > 0) {
                    const validGameIds = new Set(contest.gameIds.map(id => id.toString()));
                    players = players.filter(p => p.gameId && validGameIds.has(p.gameId.toString()));
                    games = games.filter(g => validGameIds.has(g.id.toString()));
                }
            } catch (err) {
                console.error('Error filtering by contest:', err.message);
            }
        }

        return res.status(200).json({
            success: true,
            players,
            games,
            sport: sport.toUpperCase(),
            date: targetDate,
            source,
            totalPlayers: players.length
        });
    } catch (error) {
        console.error('Fantasy players error:', error);
        return res.status(500).json({ error: 'Failed to fetch players' });
    }
}

// Fetch players with DFS salaries from SportsDataIO
async function fetchPlayersFromSportsDataIO(sport, targetDate) {
    const sportConfig = {
        NFL: { endpoint: 'nfl', season: '2024REG' },
        NBA: { endpoint: 'nba', season: '2025' },
        MLB: { endpoint: 'mlb', season: '2025' },
        NHL: { endpoint: 'nhl', season: '2025' }
    };

    const config = sportConfig[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    // SportsDataIO DFS Projections endpoint
    const url = `https://api.sportsdata.io/v3/${config.endpoint}/projections/json/DfsSlatesByDate/${targetDate}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    const slates = await response.json();

    if (!slates || slates.length === 0) {
        // No slates for this date, try to get player list from ESPN with games
        return await fetchPlayersFromESPN(sport, targetDate);
    }

    // Get the first slate's players (usually main slate)
    const mainSlate = slates.find(s => s.Operator === 'DraftKings') || slates[0];

    if (!mainSlate || !mainSlate.DfsSlateGames) {
        return await fetchPlayersFromESPN(sport, targetDate);
    }

    // Extract games from the slate
    const games = (mainSlate.DfsSlateGames || []).map(g => ({
        id: g.GameID?.toString() || g.Game?.GameID?.toString(),
        homeTeam: g.Game?.HomeTeam,
        awayTeam: g.Game?.AwayTeam,
        gameTime: g.Game?.DateTime,
        status: g.Game?.Status
    }));

    // Fetch player projections for this slate
    const playersUrl = `https://api.sportsdata.io/v3/${config.endpoint}/projections/json/DfsSlatePlayersBySlateID/${mainSlate.SlateID}?key=${SPORTSDATA_API_KEY}`;
    const playersResponse = await fetch(playersUrl);

    if (!playersResponse.ok) {
        throw new Error(`SportsDataIO players API error: ${playersResponse.status}`);
    }

    const slatePlayers = await playersResponse.json();

    const players = slatePlayers.map(player => ({
        id: player.PlayerID?.toString() || player.OperatorPlayerID,
        name: player.OperatorPlayerName || player.Name,
        position: player.OperatorPosition || player.Position,
        team: player.Team,
        teamAbbreviation: player.Team,
        salary: player.OperatorSalary || 5000,
        opponent: player.Opponent || 'TBD',
        projectedPoints: player.FantasyPoints || player.OperatorFantasyPoints || 0,
        imageUrl: null,
        gameTime: player.GameTime,
        gameId: player.SlateGameID?.toString() || player.GameID?.toString(),
        slateId: mainSlate.SlateID
    }));

    return { players, games };
}

function calculateSalaryFromPosition(sport, position) {
    const positionValues = {
        NFL: { QB: 7500, RB: 6500, WR: 6000, TE: 5000, K: 4500, DEF: 4000, default: 5000 },
        NBA: { PG: 7000, SG: 6500, SF: 6500, PF: 6000, C: 7000, default: 6000 },
        MLB: { SP: 9000, RP: 5000, C: 4500, '1B': 5000, '2B': 4500, '3B': 5000, SS: 5500, OF: 5000, default: 5000 },
        NHL: { C: 6000, LW: 5500, RW: 5500, D: 5000, G: 7000, default: 5500 }
    };

    const sportPos = positionValues[sport] || positionValues.NFL;
    return sportPos[position] || sportPos.default;
}

// Fetch real players from ESPN API with games for the date
async function fetchPlayersFromESPN(sport, targetDate) {
    const sportPath = getESPNSportPath(sport);

    // Format date for ESPN (YYYYMMDD)
    const dateObj = new Date(targetDate);
    const formattedDate = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;

    // First get games for the date
    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${formattedDate}`;
    let games = [];
    const teamsPlaying = new Map();

    try {
        const scoreboardResponse = await fetch(scoreboardUrl);
        if (scoreboardResponse.ok) {
            const scoreboardData = await scoreboardResponse.json();
            const events = scoreboardData.events || [];

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
        }
    } catch (e) {
        console.error('Failed to fetch scoreboard:', e.message);
    }

    // If no games today, return empty
    if (teamsPlaying.size === 0) {
        return { players: [], games: [] };
    }

    // Fetch rosters for teams playing
    const players = [];
    const rosterBaseUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams`;

    for (const [teamId, teamInfo] of teamsPlaying) {
        try {
            const rosterUrl = `${rosterBaseUrl}/${teamId}/roster`;
            const rosterResponse = await fetch(rosterUrl);
            if (!rosterResponse.ok) continue;

            const rosterData = await rosterResponse.json();
            const athletes = rosterData.athletes || [];

            for (const positionGroup of athletes) {
                const groupAthletes = positionGroup.items || [];
                for (const athlete of groupAthletes) {
                    const position = athlete.position?.abbreviation || mapESPNPosition(sport, positionGroup.position) || 'UTIL';

                    players.push({
                        id: athlete.id,
                        name: athlete.fullName || athlete.displayName,
                        team: teamInfo.name,
                        teamAbbreviation: teamInfo.abbreviation,
                        position,
                        salary: calculateSalaryFromPosition(sport, position),
                        opponent: teamInfo.opponent,
                        isHome: teamInfo.isHome,
                        gameId: teamInfo.gameId,
                        gameTime: teamInfo.gameTime,
                        projectedPoints: 0,
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

    return { players, games };
}

function mapESPNPosition(sport, position) {
    const mapping = {
        NFL: { 'Quarterback': 'QB', 'Running Back': 'RB', 'Wide Receiver': 'WR', 'Tight End': 'TE', 'Kicker': 'K', 'Defense': 'DEF' },
        NBA: { 'Point Guard': 'PG', 'Shooting Guard': 'SG', 'Small Forward': 'SF', 'Power Forward': 'PF', 'Center': 'C' },
        MLB: { 'Starting Pitcher': 'SP', 'Relief Pitcher': 'RP', 'Catcher': 'C', 'Outfielder': 'OF' },
        NHL: { 'Center': 'C', 'Left Wing': 'LW', 'Right Wing': 'RW', 'Defenseman': 'D', 'Goalie': 'G' }
    };
    return mapping[sport]?.[position] || position;
}

function getESPNSportPath(sport) {
    const paths = {
        NFL: 'football/nfl',
        NBA: 'basketball/nba',
        MLB: 'baseball/mlb',
        NHL: 'hockey/nhl'
    };
    return paths[sport] || 'football/nfl';
}

