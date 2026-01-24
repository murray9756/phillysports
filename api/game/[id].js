// Game Preview/Detail API - Fetches comprehensive game data from SportsDataIO
// GET /api/game/[id]?sport=NFL

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// ESPN sport path mapping
const ESPN_SPORT_PATHS = {
    NFL: 'football/nfl',
    NBA: 'basketball/nba',
    MLB: 'baseball/mlb',
    NHL: 'hockey/nhl'
};

// Fetch game data from ESPN API
async function fetchFromEspn(gameId, sport) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) {
        console.log('ESPN: Unknown sport path for', sport);
        return null;
    }

    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${gameId}`;
    console.log('ESPN fetch URL:', url);

    const response = await fetch(url);
    if (!response.ok) {
        console.log('ESPN fetch failed with status:', response.status);
        return null;
    }

    const data = await response.json();
    console.log('ESPN data received, has header:', !!data.header);

    if (!data.header?.competitions?.[0]) {
        console.log('ESPN: No competitions found in header');
        return null;
    }

    const comp = data.header.competitions[0];
    const homeTeam = comp.competitors?.find(c => c.homeAway === 'home');
    const awayTeam = comp.competitors?.find(c => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) {
        console.log('ESPN: Missing home or away team');
        return null;
    }

    // Extract box score stats from ESPN
    const boxScore = extractEspnBoxScore(data, sport);

    return {
        id: gameId,
        sport,
        status: comp.status?.type?.description || 'Final',
        dateTime: comp.date,
        venue: data.gameInfo?.venue?.fullName || comp.venue?.fullName,
        channel: comp.broadcasts?.[0]?.media?.shortName,
        weather: data.gameInfo?.weather?.displayValue,
        homeTeam: {
            abbr: homeTeam.team?.abbreviation,
            name: homeTeam.team?.displayName,
            score: parseInt(homeTeam.score) || 0,
            record: homeTeam.record?.[0]?.summary ? { display: homeTeam.record[0].summary } : null,
            logo: homeTeam.team?.logos?.[0]?.href
        },
        awayTeam: {
            abbr: awayTeam.team?.abbreviation,
            name: awayTeam.team?.displayName,
            score: parseInt(awayTeam.score) || 0,
            record: awayTeam.record?.[0]?.summary ? { display: awayTeam.record[0].summary } : null,
            logo: awayTeam.team?.logos?.[0]?.href
        },
        odds: extractEspnOdds(data),
        boxScore,
        source: 'espn'
    };
}

function extractEspnBoxScore(data, sport) {
    if (!data.boxscore?.teams) return null;

    const homeTeam = data.boxscore.teams.find(t => t.homeAway === 'home');
    const awayTeam = data.boxscore.teams.find(t => t.homeAway === 'away');
    const homeStats = homeTeam?.statistics || [];
    const awayStats = awayTeam?.statistics || [];

    const getStatValue = (stats, name) => {
        const stat = stats.find(s => s.name === name || s.label === name);
        return stat?.displayValue || stat?.value || null;
    };

    if (sport === 'NFL') {
        return {
            home: {
                teamName: homeTeam?.team?.displayName || homeTeam?.team?.abbreviation,
                totalYards: getStatValue(homeStats, 'totalYards') || getStatValue(homeStats, 'Total Yards'),
                passingYards: getStatValue(homeStats, 'netPassingYards') || getStatValue(homeStats, 'Passing'),
                rushingYards: getStatValue(homeStats, 'rushingYards') || getStatValue(homeStats, 'Rushing'),
                turnovers: getStatValue(homeStats, 'turnovers') || getStatValue(homeStats, 'Turnovers'),
                firstDowns: getStatValue(homeStats, 'firstDowns') || getStatValue(homeStats, 'First Downs')
            },
            away: {
                teamName: awayTeam?.team?.displayName || awayTeam?.team?.abbreviation,
                totalYards: getStatValue(awayStats, 'totalYards') || getStatValue(awayStats, 'Total Yards'),
                passingYards: getStatValue(awayStats, 'netPassingYards') || getStatValue(awayStats, 'Passing'),
                rushingYards: getStatValue(awayStats, 'rushingYards') || getStatValue(awayStats, 'Rushing'),
                turnovers: getStatValue(awayStats, 'turnovers') || getStatValue(awayStats, 'Turnovers'),
                firstDowns: getStatValue(awayStats, 'firstDowns') || getStatValue(awayStats, 'First Downs')
            }
        };
    } else if (sport === 'NBA') {
        return {
            home: {
                teamName: homeTeam?.team?.displayName || homeTeam?.team?.abbreviation,
                rebounds: getStatValue(homeStats, 'rebounds'),
                assists: getStatValue(homeStats, 'assists'),
                steals: getStatValue(homeStats, 'steals'),
                blocks: getStatValue(homeStats, 'blocks'),
                turnovers: getStatValue(homeStats, 'turnovers'),
                fieldGoalPct: getStatValue(homeStats, 'fieldGoalPct')
            },
            away: {
                teamName: awayTeam?.team?.displayName || awayTeam?.team?.abbreviation,
                rebounds: getStatValue(awayStats, 'rebounds'),
                assists: getStatValue(awayStats, 'assists'),
                steals: getStatValue(awayStats, 'steals'),
                blocks: getStatValue(awayStats, 'blocks'),
                turnovers: getStatValue(awayStats, 'turnovers'),
                fieldGoalPct: getStatValue(awayStats, 'fieldGoalPct')
            }
        };
    }

    return null;
}

function extractEspnOdds(data) {
    const odds = data.pickcenter?.[0];
    if (!odds) return null;

    return {
        spread: odds.details,
        overUnder: odds.overUnder,
        homeMoneyLine: odds.homeTeamOdds?.moneyLine,
        awayMoneyLine: odds.awayTeamOdds?.moneyLine,
        sportsbook: odds.provider?.name
    };
}

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

    const { id, source } = req.query;
    const sport = (req.query.sport || 'NFL').toUpperCase();
    const useEspn = source === 'espn';

    if (!id) {
        return res.status(400).json({ error: 'Game ID is required' });
    }

    // If ESPN source, use ESPN data
    if (useEspn) {
        try {
            console.log('Fetching from ESPN, gameId:', id, 'sport:', sport);
            const espnData = await fetchFromEspn(id, sport);
            if (espnData) {
                // Also fetch season stats for the teams
                const sportEndpoint = { NFL: 'nfl', NBA: 'nba', MLB: 'mlb', NHL: 'nhl' }[sport];
                if (sportEndpoint && espnData.homeTeam?.abbr && espnData.awayTeam?.abbr) {
                    try {
                        const teamStats = await fetchTeamSeasonStats(sportEndpoint, sport, espnData.homeTeam.abbr, espnData.awayTeam.abbr);
                        if (teamStats) {
                            espnData.homeTeam.seasonStats = teamStats.home;
                            espnData.awayTeam.seasonStats = teamStats.away;
                        }
                    } catch (statsErr) {
                        console.log('Season stats fetch failed:', statsErr.message);
                    }
                }
                return res.status(200).json({ success: true, game: espnData });
            } else {
                console.log('ESPN returned no data for gameId:', id);
                return res.status(404).json({ error: 'Game not found in ESPN', gameId: id, sport });
            }
        } catch (e) {
            console.error('ESPN fetch error:', e.message);
            return res.status(500).json({ error: 'ESPN fetch failed', message: e.message });
        }
    }

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    const sportEndpoints = {
        NFL: 'nfl',
        NBA: 'nba',
        MLB: 'mlb',
        NHL: 'nhl',
        NCAAB: 'cbb',
        NCAAF: 'cfb'
    };

    const endpoint = sportEndpoints[sport];
    if (!endpoint) {
        return res.status(400).json({ error: `Unsupported sport: ${sport}` });
    }

    try {
        // Fetch game from schedule/scores endpoint first (works for all games)
        const gameData = await fetchGameFromSchedule(endpoint, id, sport);

        if (!gameData) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Fetch additional data in parallel
        const [oddsData, standingsData, teamStats, injuries] = await Promise.all([
            fetchGameOdds(endpoint, id).catch(() => null),
            fetchStandings(endpoint, sport).catch(() => null),
            fetchTeamSeasonStats(endpoint, sport, gameData.homeTeam, gameData.awayTeam).catch(() => null),
            fetchInjuries(endpoint, sport, gameData.homeTeam, gameData.awayTeam).catch(() => null)
        ]);

        // If game is in progress or completed, get box score
        let boxScore = null;
        if (gameData.status !== 'Scheduled') {
            boxScore = await fetchBoxScore(endpoint, id, sport).catch(() => null);
        }

        // Get team records from standings
        const homeRecord = getTeamRecord(standingsData, gameData.homeTeam, sport);
        const awayRecord = getTeamRecord(standingsData, gameData.awayTeam, sport);

        // Build response
        const response = {
            success: true,
            game: {
                id: gameData.gameId,
                sport,
                status: gameData.status,
                dateTime: gameData.dateTime,
                venue: gameData.venue,
                channel: gameData.channel,
                weather: gameData.weather,
                homeTeam: {
                    abbr: gameData.homeTeam,
                    name: gameData.homeTeamName,
                    score: gameData.homeScore,
                    record: homeRecord,
                    logo: getTeamLogo(sport, gameData.homeTeam),
                    seasonStats: teamStats?.home || null
                },
                awayTeam: {
                    abbr: gameData.awayTeam,
                    name: gameData.awayTeamName,
                    score: gameData.awayScore,
                    record: awayRecord,
                    logo: getTeamLogo(sport, gameData.awayTeam),
                    seasonStats: teamStats?.away || null
                },
                odds: oddsData,
                injuries: injuries,
                quarter: gameData.quarter,
                timeRemaining: gameData.timeRemaining,
                possession: gameData.possession,
                boxScore: boxScore
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Game preview error:', error);
        res.status(500).json({ error: 'Failed to fetch game data', message: error.message });
    }
}

// Fetch game from Score/Schedule endpoint (works for all game states)
async function fetchGameFromSchedule(endpoint, gameId, sport) {
    // Use ScoresByDate or direct Score endpoint
    const url = `https://api.sportsdata.io/v3/${endpoint}/scores/json/Score/${gameId}?key=${SPORTSDATA_API_KEY}`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            const game = await response.json();
            if (game) {
                return {
                    gameId: game.GameID || game.ScoreID || gameId,
                    status: game.Status,
                    dateTime: game.DateTime || game.Day,
                    venue: game.StadiumDetails?.Name || game.Stadium,
                    channel: game.Channel,
                    homeTeam: game.HomeTeam,
                    homeTeamName: game.HomeTeamName || getFullTeamName(sport, game.HomeTeam),
                    homeScore: game.HomeScore || game.HomeTeamScore || 0,
                    awayTeam: game.AwayTeam,
                    awayTeamName: game.AwayTeamName || getFullTeamName(sport, game.AwayTeam),
                    awayScore: game.AwayScore || game.AwayTeamScore || 0,
                    quarter: game.Quarter || game.Period,
                    timeRemaining: game.TimeRemaining || game.TimeRemainingMinutes,
                    possession: game.Possession,
                    weather: game.ForecastDescription || game.Weather
                };
            }
        }
    } catch (e) {
        console.log('Score endpoint failed, trying BoxScore:', e.message);
    }

    // Fallback to BoxScore endpoint
    const boxScoreUrl = `https://api.sportsdata.io/v3/${endpoint}/stats/json/BoxScore/${gameId}?key=${SPORTSDATA_API_KEY}`;
    try {
        const response = await fetch(boxScoreUrl);
        if (response.ok) {
            const data = await response.json();
            const game = data.Game || data;
            return {
                gameId: game.GameID || game.ScoreID || gameId,
                status: game.Status,
                dateTime: game.DateTime || game.Day,
                venue: game.StadiumDetails?.Name || game.Stadium,
                channel: game.Channel,
                homeTeam: game.HomeTeam,
                homeTeamName: game.HomeTeamName || getFullTeamName(sport, game.HomeTeam),
                homeScore: game.HomeScore || game.HomeTeamScore || 0,
                awayTeam: game.AwayTeam,
                awayTeamName: game.AwayTeamName || getFullTeamName(sport, game.AwayTeam),
                awayScore: game.AwayScore || game.AwayTeamScore || 0,
                quarter: game.Quarter || game.Period,
                timeRemaining: game.TimeRemaining || game.TimeRemainingMinutes,
                possession: game.Possession,
                weather: game.ForecastDescription || game.Weather
            };
        }
    } catch (e) {
        console.log('BoxScore endpoint also failed:', e.message);
    }

    return null;
}

// Fetch box score for in-progress/completed games
async function fetchBoxScore(endpoint, gameId, sport) {
    const url = `https://api.sportsdata.io/v3/${endpoint}/stats/json/BoxScore/${gameId}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return extractBoxScore(data, sport);
}

function extractBoxScore(data, sport) {
    if (!data) return null;

    const boxScore = {
        home: {},
        away: {}
    };

    if (sport === 'NFL') {
        const game = data.Game || data;
        boxScore.home = {
            totalYards: game.HomeTeamTotalYards,
            passingYards: game.HomeTeamPassingYards,
            rushingYards: game.HomeTeamRushingYards,
            turnovers: game.HomeTeamTurnovers,
            timeOfPossession: game.HomeTeamTimeOfPossession,
            firstDowns: game.HomeTeamFirstDowns
        };
        boxScore.away = {
            totalYards: game.AwayTeamTotalYards,
            passingYards: game.AwayTeamPassingYards,
            rushingYards: game.AwayTeamRushingYards,
            turnovers: game.AwayTeamTurnovers,
            timeOfPossession: game.AwayTeamTimeOfPossession,
            firstDowns: game.AwayTeamFirstDowns
        };
    } else if (sport === 'NBA') {
        const game = data.Game || data;
        boxScore.home = {
            rebounds: game.HomeTeamRebounds,
            assists: game.HomeTeamAssists,
            steals: game.HomeTeamSteals,
            blocks: game.HomeTeamBlocks,
            turnovers: game.HomeTeamTurnovers,
            fieldGoalPct: game.HomeTeamFieldGoalPercentage
        };
        boxScore.away = {
            rebounds: game.AwayTeamRebounds,
            assists: game.AwayTeamAssists,
            steals: game.AwayTeamSteals,
            blocks: game.AwayTeamBlocks,
            turnovers: game.AwayTeamTurnovers,
            fieldGoalPct: game.AwayTeamFieldGoalPercentage
        };
    } else if (sport === 'MLB') {
        const game = data.Game || data;
        boxScore.home = {
            hits: game.HomeTeamHits,
            errors: game.HomeTeamErrors,
            runs: game.HomeTeamRuns
        };
        boxScore.away = {
            hits: game.AwayTeamHits,
            errors: game.AwayTeamErrors,
            runs: game.AwayTeamRuns
        };
    } else if (sport === 'NHL') {
        const game = data.Game || data;
        boxScore.home = {
            shots: game.HomeTeamShots,
            powerPlayGoals: game.HomeTeamPowerPlayGoals,
            penaltyMinutes: game.HomeTeamPenaltyMinutes
        };
        boxScore.away = {
            shots: game.AwayTeamShots,
            powerPlayGoals: game.AwayTeamPowerPlayGoals,
            penaltyMinutes: game.AwayTeamPenaltyMinutes
        };
    }

    return boxScore;
}

async function fetchGameOdds(endpoint, gameId) {
    const url = `https://api.sportsdata.io/v3/${endpoint}/odds/json/GameOddsByGameID/${gameId}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    // Get consensus odds
    const odds = data[0];
    return {
        spread: odds.HomePointSpread,
        overUnder: odds.OverUnder,
        homeMoneyLine: odds.HomeMoneyLine,
        awayMoneyLine: odds.AwayMoneyLine,
        sportsbook: odds.Sportsbook
    };
}

async function fetchStandings(endpoint, sport) {
    const year = new Date().getFullYear();
    const season = sport === 'NBA' || sport === 'NHL' ?
        (new Date().getMonth() >= 9 ? year + 1 : year) : year;

    const url = `https://api.sportsdata.io/v3/${endpoint}/scores/json/Standings/${season}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    return await response.json();
}

// Fetch team season stats from ESPN
async function fetchTeamSeasonStats(endpoint, sport, homeTeam, awayTeam) {
    try {
        // Use ESPN for more reliable stats
        const sportPath = ESPN_SPORT_PATHS[sport];
        if (!sportPath) return null;

        // Fetch both teams' stats in parallel
        const [homeData, awayData] = await Promise.all([
            fetchEspnTeamStats(sportPath, homeTeam, sport),
            fetchEspnTeamStats(sportPath, awayTeam, sport)
        ]);

        return {
            home: homeData,
            away: awayData
        };
    } catch (e) {
        console.error('ESPN team stats error:', e.message);
        return null;
    }
}

async function fetchEspnTeamStats(sportPath, teamAbbr, sport) {
    // ESPN team ID mappings by sport
    const NBA_TEAM_IDS = {
        ATL: '1', BOS: '2', BKN: '17', CHA: '30', CHI: '4', CLE: '5', DAL: '6', DEN: '7',
        DET: '8', GS: '9', GSW: '9', HOU: '10', IND: '11', LAC: '12', LAL: '13', MEM: '29',
        MIA: '14', MIL: '15', MIN: '16', NO: '3', NOP: '3', NY: '18', NYK: '18', OKC: '25',
        ORL: '19', PHI: '20', PHX: '21', POR: '22', SAC: '23', SA: '24', SAS: '24',
        TOR: '28', UTA: '26', WAS: '27', UTAH: '26'
    };
    const NFL_TEAM_IDS = {
        ARI: '22', ATL: '1', BAL: '33', BUF: '2', CAR: '29', CHI: '3', CIN: '4', CLE: '5',
        DAL: '6', DEN: '7', DET: '8', GB: '9', HOU: '34', IND: '11', JAX: '30', KC: '12',
        LAC: '24', LAR: '14', LV: '13', MIA: '15', MIN: '16', NE: '17', NO: '18', NYG: '19',
        NYJ: '20', PHI: '21', PIT: '23', SEA: '26', SF: '25', TB: '27', TEN: '10', WAS: '28'
    };
    const NHL_TEAM_IDS = {
        ANA: '25', ARI: '53', BOS: '1', BUF: '2', CGY: '3', CAR: '7', CHI: '4', COL: '17',
        CBJ: '29', DAL: '9', DET: '5', EDM: '6', FLA: '8', LA: '26', LAK: '26', MIN: '30',
        MTL: '10', NSH: '18', NJ: '11', NYI: '12', NYR: '13', OTT: '14', PHI: '4', PIT: '15',
        SJ: '28', SEA: '55', STL: '19', TB: '20', TOR: '21', VAN: '22', VGK: '54', WAS: '23', WSH: '23', WPG: '52'
    };
    const MLB_TEAM_IDS = {
        ARI: '29', ATL: '15', BAL: '1', BOS: '2', CHC: '16', CWS: '4', CIN: '17', CLE: '5',
        COL: '27', DET: '6', HOU: '18', KC: '7', LAA: '3', LAD: '19', MIA: '28', MIL: '8',
        MIN: '9', NYM: '21', NYY: '10', OAK: '11', PHI: '22', PIT: '23', SD: '25', SF: '26',
        SEA: '12', STL: '24', TB: '30', TEX: '13', TOR: '14', WAS: '20', WSH: '20'
    };

    const teamIdMap = sport === 'NBA' ? NBA_TEAM_IDS :
                      sport === 'NFL' ? NFL_TEAM_IDS :
                      sport === 'NHL' ? NHL_TEAM_IDS :
                      sport === 'MLB' ? MLB_TEAM_IDS : {};

    const teamId = teamIdMap[teamAbbr];
    if (!teamId) {
        console.log('No ESPN team ID for:', teamAbbr);
        return null;
    }

    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamId}/statistics`;
    console.log('ESPN team stats URL:', url);

    const response = await fetch(url);
    if (!response.ok) {
        console.log('ESPN team stats failed:', response.status);
        return null;
    }

    const data = await response.json();
    return formatEspnTeamStats(data, sport);
}

function formatEspnTeamStats(data, sport) {
    if (!data?.results?.stats?.categories) return null;

    // Flatten all stats from all categories into one array
    const allStats = [];
    for (const category of data.results.stats.categories) {
        if (category.stats) {
            allStats.push(...category.stats);
        }
    }

    const getStat = (name) => {
        const stat = allStats.find(s => s.name === name || s.abbreviation === name);
        return stat?.value ?? stat?.displayValue ?? null;
    };

    if (sport === 'NBA') {
        return {
            pointsPerGame: getStat('avgPoints') || getStat('pointsPerGame'),
            reboundsPerGame: getStat('avgRebounds') || getStat('reboundsPerGame'),
            assistsPerGame: getStat('avgAssists') || getStat('assistsPerGame'),
            fieldGoalPct: getStat('fieldGoalPct'),
            threePointPct: getStat('threePointFieldGoalPct')
        };
    } else if (sport === 'NFL') {
        return {
            pointsPerGame: getStat('avgPointsFor') || getStat('pointsPerGame'),
            yardsPerGame: getStat('totalYardsPerGame'),
            passingYardsPerGame: getStat('netPassingYardsPerGame'),
            rushingYardsPerGame: getStat('rushingYardsPerGame'),
            pointsAllowedPerGame: getStat('avgPointsAgainst')
        };
    } else if (sport === 'NHL') {
        return {
            goalsPerGame: getStat('goalsFor') ? (parseFloat(getStat('goalsFor')) / parseFloat(getStat('gamesPlayed') || 1)).toFixed(2) : null,
            goalsAgainstPerGame: getStat('goalsAgainst') ? (parseFloat(getStat('goalsAgainst')) / parseFloat(getStat('gamesPlayed') || 1)).toFixed(2) : null,
            powerPlayPct: getStat('powerPlayPct'),
            penaltyKillPct: getStat('penaltyKillPct')
        };
    }

    return null;
}

function formatTeamStats(stats, sport) {
    if (!stats) return null;

    // Helper to get value from multiple possible field names
    const getVal = (...keys) => {
        for (const key of keys) {
            if (stats[key] !== undefined && stats[key] !== null) {
                return stats[key];
            }
        }
        return null;
    };

    const games = getVal('Games', 'GamesPlayed') || 1;

    if (sport === 'NFL') {
        const score = getVal('Score', 'PointsFor', 'Points');
        const offYards = getVal('OffensiveYards', 'TotalYards', 'Yards');
        const passYards = getVal('PassingYards', 'NetPassingYards');
        const rushYards = getVal('RushingYards');
        const oppScore = getVal('OpponentScore', 'PointsAgainst');

        return {
            pointsPerGame: score ? (score / games).toFixed(1) : null,
            yardsPerGame: offYards ? (offYards / games).toFixed(1) : null,
            passingYardsPerGame: passYards ? (passYards / games).toFixed(1) : null,
            rushingYardsPerGame: rushYards ? (rushYards / games).toFixed(1) : null,
            pointsAllowedPerGame: oppScore ? (oppScore / games).toFixed(1) : null
        };
    } else if (sport === 'NBA') {
        const points = getVal('Points', 'PointsPerGame');
        const rebounds = getVal('Rebounds', 'TotalRebounds', 'ReboundsPerGame');
        const assists = getVal('Assists', 'AssistsPerGame');
        const fgPct = getVal('FieldGoalsPercentage', 'FieldGoalPercentage', 'FGPct');
        const threePct = getVal('ThreePointersPercentage', 'ThreePointerPercentage', 'ThreePct');

        // Check if values are per-game already (less than a reasonable max) or season totals
        const isPerGame = points && points < 200;

        return {
            pointsPerGame: points ? (isPerGame ? points.toFixed(1) : (points / games).toFixed(1)) : null,
            reboundsPerGame: rebounds ? (isPerGame ? rebounds.toFixed(1) : (rebounds / games).toFixed(1)) : null,
            assistsPerGame: assists ? (isPerGame ? assists.toFixed(1) : (assists / games).toFixed(1)) : null,
            fieldGoalPct: fgPct ? fgPct.toFixed(1) : null,
            threePointPct: threePct ? threePct.toFixed(1) : null
        };
    } else if (sport === 'MLB') {
        const runs = getVal('Runs', 'RunsScored');
        const avg = getVal('BattingAverage', 'AVG');
        const era = getVal('EarnedRunAverage', 'ERA');
        const hr = getVal('HomeRuns', 'HR');

        return {
            runsPerGame: runs ? (runs / games).toFixed(2) : null,
            battingAverage: avg ? (avg < 1 ? avg.toFixed(3) : (avg / 1000).toFixed(3)) : null,
            era: era ? era.toFixed(2) : null,
            homeRuns: hr || null
        };
    } else if (sport === 'NHL') {
        const goals = getVal('Goals', 'GoalsFor');
        const goalsAgainst = getVal('GoalsAgainst', 'GoalsAllowed');
        const ppPct = getVal('PowerPlayPercentage', 'PPPct');
        const pkPct = getVal('PenaltyKillPercentage', 'PKPct');

        return {
            goalsPerGame: goals ? (goals / games).toFixed(2) : null,
            goalsAgainstPerGame: goalsAgainst ? (goalsAgainst / games).toFixed(2) : null,
            powerPlayPct: ppPct ? ppPct.toFixed(1) : null,
            penaltyKillPct: pkPct ? pkPct.toFixed(1) : null
        };
    }

    return null;
}

// Fetch injuries for both teams
async function fetchInjuries(endpoint, sport, homeTeam, awayTeam) {
    const url = `https://api.sportsdata.io/v3/${endpoint}/scores/json/Injuries?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const allInjuries = await response.json();

    // Filter to just injuries for these teams
    const homeInjuries = allInjuries.filter(i => i.Team === homeTeam).slice(0, 5).map(i => ({
        player: i.Name,
        position: i.Position,
        status: i.Status,
        injury: i.BodyPart
    }));

    const awayInjuries = allInjuries.filter(i => i.Team === awayTeam).slice(0, 5).map(i => ({
        player: i.Name,
        position: i.Position,
        status: i.Status,
        injury: i.BodyPart
    }));

    return {
        home: homeInjuries,
        away: awayInjuries
    };
}

function getTeamRecord(standings, teamAbbr, sport) {
    if (!standings || !teamAbbr) return null;

    const team = standings.find(t => t.Team === teamAbbr || t.Key === teamAbbr);
    if (!team) return null;

    return {
        wins: team.Wins,
        losses: team.Losses,
        ties: team.Ties || 0,
        winPct: team.Percentage || (team.Wins / (team.Wins + team.Losses)).toFixed(3),
        divisionRank: team.DivisionRank,
        conferenceRank: team.ConferenceRank,
        streak: team.Streak,
        lastTen: team.LastTenWins ? `${team.LastTenWins}-${team.LastTenLosses}` : null
    };
}

function getTeamLogo(sport, teamAbbr) {
    if (!teamAbbr) return null;

    const sportLogos = {
        NFL: `https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbr.toLowerCase()}.png`,
        NBA: `https://a.espncdn.com/i/teamlogos/nba/500/${teamAbbr.toLowerCase()}.png`,
        MLB: `https://a.espncdn.com/i/teamlogos/mlb/500/${teamAbbr.toLowerCase()}.png`,
        NHL: `https://a.espncdn.com/i/teamlogos/nhl/500/${teamAbbr.toLowerCase()}.png`
    };

    return sportLogos[sport] || null;
}

function getFullTeamName(sport, abbr) {
    const teamNames = {
        // NFL NFC East
        PHI: 'Philadelphia Eagles',
        DAL: 'Dallas Cowboys',
        NYG: 'New York Giants',
        WAS: 'Washington Commanders',
        // NFL common
        KC: 'Kansas City Chiefs',
        BUF: 'Buffalo Bills',
        SF: 'San Francisco 49ers',
        DET: 'Detroit Lions',
        BAL: 'Baltimore Ravens',
        MIA: 'Miami Dolphins',
        GB: 'Green Bay Packers',
        MIN: 'Minnesota Vikings',
        // NBA
        PHI: 'Philadelphia 76ers',
        BOS: 'Boston Celtics',
        NYK: 'New York Knicks',
        MIL: 'Milwaukee Bucks',
        CLE: 'Cleveland Cavaliers',
        OKC: 'Oklahoma City Thunder',
        // MLB
        PHI: 'Philadelphia Phillies',
        NYM: 'New York Mets',
        ATL: 'Atlanta Braves',
        LAD: 'Los Angeles Dodgers',
        // NHL
        PHI: 'Philadelphia Flyers',
        PIT: 'Pittsburgh Penguins',
        NYR: 'New York Rangers',
        NJD: 'New Jersey Devils'
    };

    return teamNames[abbr] || abbr;
}
