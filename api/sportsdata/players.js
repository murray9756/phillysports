// SportsDataIO Player Stats API
// GET /api/sportsdata/players?sport=NFL&team=PHI
// GET /api/sportsdata/players?sport=NFL&playerId=123

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, team, playerId, season } = req.query;

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();
        const currentSeason = season || getCurrentSeason(sportUpper);

        let result;
        if (playerId) {
            result = await fetchPlayerDetails(sportUpper, playerId, currentSeason);
        } else {
            result = await fetchTeamPlayers(sportUpper, team, currentSeason);
        }

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            season: currentSeason,
            ...result
        });
    } catch (error) {
        console.error('Players API error:', error);
        return res.status(500).json({ error: 'Failed to fetch player data' });
    }
}

function getCurrentSeason(sport) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    switch (sport) {
        case 'NFL':
            return month >= 3 && month <= 7 ? year - 1 : year;
        case 'NBA':
        case 'NHL':
            return month >= 9 ? year + 1 : year;
        case 'MLB':
            return year;
        default:
            return year;
    }
}

async function fetchTeamPlayers(sport, team, season) {
    const endpoints = {
        NFL: 'https://api.sportsdata.io/v3/nfl/scores/json/Players',
        NBA: 'https://api.sportsdata.io/v3/nba/scores/json/Players',
        MLB: 'https://api.sportsdata.io/v3/mlb/scores/json/Players',
        NHL: 'https://api.sportsdata.io/v3/nhl/scores/json/Players'
    };

    const url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    let players = await response.json();

    // Filter by team if specified
    if (team) {
        const teamUpper = team.toUpperCase();
        players = players.filter(p => p.Team?.toUpperCase() === teamUpper);
    }

    // Filter active players only
    players = players.filter(p => p.Status === 'Active');

    return {
        players: players.map(p => transformPlayer(p, sport))
    };
}

async function fetchPlayerDetails(sport, playerId, season) {
    const endpoints = {
        NFL: `https://api.sportsdata.io/v3/nfl/scores/json/Player/${playerId}`,
        NBA: `https://api.sportsdata.io/v3/nba/scores/json/Player/${playerId}`,
        MLB: `https://api.sportsdata.io/v3/mlb/scores/json/Player/${playerId}`,
        NHL: `https://api.sportsdata.io/v3/nhl/scores/json/Player/${playerId}`
    };

    // Fetch player info
    const playerUrl = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    const playerResponse = await fetch(playerUrl);

    if (!playerResponse.ok) {
        throw new Error(`Player not found: ${playerId}`);
    }

    const player = await playerResponse.json();

    // Try to fetch season stats
    let stats = null;
    try {
        const statsEndpoints = {
            NFL: `https://api.sportsdata.io/v3/nfl/stats/json/PlayerSeasonStats/${season}`,
            NBA: `https://api.sportsdata.io/v3/nba/stats/json/PlayerSeasonStats/${season}`,
            MLB: `https://api.sportsdata.io/v3/mlb/stats/json/PlayerSeasonStats/${season}`,
            NHL: `https://api.sportsdata.io/v3/nhl/stats/json/PlayerSeasonStats/${season}`
        };

        const statsUrl = `${statsEndpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
        const statsResponse = await fetch(statsUrl);

        if (statsResponse.ok) {
            const allStats = await statsResponse.json();
            stats = allStats.find(s => s.PlayerID == playerId);
        }
    } catch (e) {
        console.error('Failed to fetch player stats:', e.message);
    }

    return {
        player: transformPlayer(player, sport),
        stats: stats ? transformStats(stats, sport) : null
    };
}

function transformPlayer(player, sport) {
    return {
        id: player.PlayerID,
        name: `${player.FirstName} ${player.LastName}`,
        firstName: player.FirstName,
        lastName: player.LastName,
        team: player.Team,
        teamName: player.TeamName,
        position: player.Position,
        number: player.Number || player.Jersey,
        height: player.Height,
        weight: player.Weight,
        age: player.Age,
        college: player.College,
        experience: player.Experience,
        birthDate: player.BirthDate,
        photoUrl: player.PhotoUrl,
        status: player.Status,
        injury: player.InjuryStatus ? {
            status: player.InjuryStatus,
            bodyPart: player.InjuryBodyPart,
            notes: player.InjuryNotes,
            startDate: player.InjuryStartDate
        } : null
    };
}

function transformStats(stats, sport) {
    // Common stats
    const base = {
        games: stats.Games || stats.Started,
        playerId: stats.PlayerID,
        team: stats.Team,
        season: stats.Season
    };

    switch (sport) {
        case 'NFL':
            return {
                ...base,
                passing: {
                    attempts: stats.PassingAttempts,
                    completions: stats.PassingCompletions,
                    yards: stats.PassingYards,
                    touchdowns: stats.PassingTouchdowns,
                    interceptions: stats.PassingInterceptions,
                    rating: stats.PassingRating
                },
                rushing: {
                    attempts: stats.RushingAttempts,
                    yards: stats.RushingYards,
                    touchdowns: stats.RushingTouchdowns,
                    yardsPerAttempt: stats.RushingYardsPerAttempt
                },
                receiving: {
                    targets: stats.ReceivingTargets,
                    receptions: stats.Receptions,
                    yards: stats.ReceivingYards,
                    touchdowns: stats.ReceivingTouchdowns,
                    yardsPerReception: stats.ReceivingYardsPerReception
                },
                fantasyPoints: stats.FantasyPoints,
                fantasyPointsPPR: stats.FantasyPointsPPR
            };

        case 'NBA':
            return {
                ...base,
                points: stats.Points,
                rebounds: stats.Rebounds,
                assists: stats.Assists,
                steals: stats.Steals,
                blocks: stats.BlockedShots,
                turnovers: stats.Turnovers,
                minutes: stats.Minutes,
                fieldGoalsMade: stats.FieldGoalsMade,
                fieldGoalsAttempted: stats.FieldGoalsAttempted,
                fieldGoalPct: stats.FieldGoalsPercentage,
                threePointersMade: stats.ThreePointersMade,
                threePointersAttempted: stats.ThreePointersAttempted,
                threePointPct: stats.ThreePointersPercentage,
                freeThrowsMade: stats.FreeThrowsMade,
                freeThrowsAttempted: stats.FreeThrowsAttempted,
                freeThrowPct: stats.FreeThrowsPercentage,
                fantasyPoints: stats.FantasyPoints
            };

        case 'MLB':
            return {
                ...base,
                batting: {
                    atBats: stats.AtBats,
                    hits: stats.Hits,
                    runs: stats.Runs,
                    homeRuns: stats.HomeRuns,
                    rbi: stats.RunsBattedIn,
                    stolenBases: stats.StolenBases,
                    average: stats.BattingAverage,
                    obp: stats.OnBasePercentage,
                    slg: stats.SluggingPercentage,
                    ops: stats.OnBasePlusSlugging
                },
                pitching: stats.Wins !== undefined ? {
                    wins: stats.Wins,
                    losses: stats.Losses,
                    era: stats.EarnedRunAverage,
                    strikeouts: stats.Strikeouts,
                    walks: stats.Walks,
                    inningsPitched: stats.InningsPitchedFull,
                    saves: stats.Saves,
                    whip: stats.WalksHitsPerInningsPitched
                } : null,
                fantasyPoints: stats.FantasyPoints
            };

        case 'NHL':
            return {
                ...base,
                goals: stats.Goals,
                assists: stats.Assists,
                points: stats.Points,
                plusMinus: stats.PlusMinus,
                penaltyMinutes: stats.PenaltyMinutes,
                powerPlayGoals: stats.PowerPlayGoals,
                powerPlayAssists: stats.PowerPlayAssists,
                shots: stats.Shots,
                shootingPct: stats.ShootingPercentage,
                goalie: stats.Wins !== undefined ? {
                    wins: stats.Wins,
                    losses: stats.Losses,
                    otLosses: stats.OvertimeLosses,
                    savePercentage: stats.SavePercentage,
                    goalsAgainstAverage: stats.GoalsAgainstAverage,
                    shutouts: stats.Shutouts
                } : null,
                fantasyPoints: stats.FantasyPoints
            };

        default:
            return base;
    }
}
