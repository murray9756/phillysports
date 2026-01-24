// Game Preview/Detail API - Fetches comprehensive game data from SportsDataIO
// GET /api/game/[id]?sport=NFL

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

    const { id } = req.query;
    const sport = (req.query.sport || 'NFL').toUpperCase();

    if (!id) {
        return res.status(400).json({ error: 'Game ID is required' });
    }

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
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
        // Fetch game details, box score, and odds in parallel
        const [gameData, oddsData, standingsData] = await Promise.all([
            fetchGameDetails(endpoint, id, sport),
            fetchGameOdds(endpoint, id).catch(() => null),
            fetchStandings(endpoint, sport).catch(() => null)
        ]);

        if (!gameData) {
            return res.status(404).json({ error: 'Game not found' });
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
                homeTeam: {
                    abbr: gameData.homeTeam,
                    name: gameData.homeTeamName,
                    score: gameData.homeScore,
                    record: homeRecord,
                    logo: getTeamLogo(sport, gameData.homeTeam)
                },
                awayTeam: {
                    abbr: gameData.awayTeam,
                    name: gameData.awayTeamName,
                    score: gameData.awayScore,
                    record: awayRecord,
                    logo: getTeamLogo(sport, gameData.awayTeam)
                },
                odds: oddsData,
                weather: gameData.weather,
                quarter: gameData.quarter,
                timeRemaining: gameData.timeRemaining,
                possession: gameData.possession,
                boxScore: gameData.boxScore
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Game preview error:', error);
        res.status(500).json({ error: 'Failed to fetch game data', message: error.message });
    }
}

async function fetchGameDetails(endpoint, gameId, sport) {
    // Try box score first (has more data), fall back to schedule
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
                weather: game.ForecastDescription || game.Weather,
                boxScore: extractBoxScore(data, sport)
            };
        }
    } catch (e) {
        console.log('Box score not available, trying schedule:', e.message);
    }

    // Fall back to games by date or schedule lookup
    return null;
}

function extractBoxScore(data, sport) {
    if (!data) return null;

    // Extract key stats based on sport
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
            timeOfPossession: game.HomeTeamTimeOfPossession
        };
        boxScore.away = {
            totalYards: game.AwayTeamTotalYards,
            passingYards: game.AwayTeamPassingYards,
            rushingYards: game.AwayTeamRushingYards,
            turnovers: game.AwayTeamTurnovers,
            timeOfPossession: game.AwayTeamTimeOfPossession
        };
    } else if (sport === 'NBA') {
        const game = data.Game || data;
        boxScore.home = {
            rebounds: game.HomeTeamRebounds,
            assists: game.HomeTeamAssists,
            steals: game.HomeTeamSteals,
            blocks: game.HomeTeamBlocks
        };
        boxScore.away = {
            rebounds: game.AwayTeamRebounds,
            assists: game.AwayTeamAssists,
            steals: game.AwayTeamSteals,
            blocks: game.AwayTeamBlocks
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

    // Get consensus odds (usually first or most common sportsbook)
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
        (new Date().getMonth() >= 10 ? year + 1 : year) : year;

    const url = `https://api.sportsdata.io/v3/${endpoint}/scores/json/Standings/${season}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    return await response.json();
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
        conferenceRank: team.ConferenceRank
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
        // NFL common opponents
        KC: 'Kansas City Chiefs',
        BUF: 'Buffalo Bills',
        SF: 'San Francisco 49ers',
        // NBA
        PHI_NBA: 'Philadelphia 76ers',
        BOS: 'Boston Celtics',
        NYK: 'New York Knicks',
        MIL: 'Milwaukee Bucks',
        // MLB
        PHI_MLB: 'Philadelphia Phillies',
        NYM: 'New York Mets',
        ATL: 'Atlanta Braves',
        // NHL
        PHI_NHL: 'Philadelphia Flyers',
        PIT: 'Pittsburgh Penguins',
        NYR: 'New York Rangers'
    };

    return teamNames[abbr] || abbr;
}
