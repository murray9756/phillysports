// Game Preview/Detail API - Fetches comprehensive game data from ESPN
// GET /api/game/[id]?sport=NFL

// ESPN sport path mapping
const ESPN_SPORT_PATHS = {
    NFL: 'football/nfl',
    NBA: 'basketball/nba',
    MLB: 'baseball/mlb',
    NHL: 'hockey/nhl',
    NCAAB: 'basketball/mens-college-basketball',
    NCAAF: 'football/college-football'
};

// ESPN team ID maps for team stats
const ESPN_TEAM_IDS = {
    NBA: {
        ATL: '1', BOS: '2', BKN: '17', CHA: '30', CHI: '4', CLE: '5', DAL: '6', DEN: '7',
        DET: '8', GS: '9', GSW: '9', HOU: '10', IND: '11', LAC: '12', LAL: '13', MEM: '29',
        MIA: '14', MIL: '15', MIN: '16', NO: '3', NOP: '3', NY: '18', NYK: '18', OKC: '25',
        ORL: '19', PHI: '20', PHX: '21', POR: '22', SAC: '23', SA: '24', SAS: '24',
        TOR: '28', UTA: '26', WAS: '27'
    },
    NFL: {
        ARI: '22', ATL: '1', BAL: '33', BUF: '2', CAR: '29', CHI: '3', CIN: '4', CLE: '5',
        DAL: '6', DEN: '7', DET: '8', GB: '9', HOU: '34', IND: '11', JAX: '30', KC: '12',
        LAC: '24', LAR: '14', LV: '13', MIA: '15', MIN: '16', NE: '17', NO: '18', NYG: '19',
        NYJ: '20', PHI: '21', PIT: '23', SEA: '26', SF: '25', TB: '27', TEN: '10', WAS: '28'
    },
    NHL: {
        ANA: '25', BOS: '1', BUF: '2', CGY: '3', CAR: '7', CHI: '4', COL: '17',
        CBJ: '29', DAL: '9', DET: '5', EDM: '6', FLA: '8', LA: '26', LAK: '26', MIN: '30',
        MTL: '10', NSH: '18', NJ: '11', NYI: '12', NYR: '13', OTT: '14', PHI: '15', PIT: '16',
        SJ: '28', SEA: '55', STL: '19', TB: '20', TOR: '21', VAN: '22', VGK: '54', WAS: '23', WSH: '23', WPG: '52',
        UTA: '53'
    },
    MLB: {
        ARI: '29', ATL: '15', BAL: '1', BOS: '2', CHC: '16', CWS: '4', CIN: '17', CLE: '5',
        COL: '27', DET: '6', HOU: '18', KC: '7', LAA: '3', LAD: '19', MIA: '28', MIL: '8',
        MIN: '9', NYM: '21', NYY: '10', OAK: '11', PHI: '22', PIT: '23', SD: '25', SF: '26',
        SEA: '12', STL: '24', TB: '30', TEX: '13', TOR: '14', WAS: '20', WSH: '20'
    }
};

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

    try {
        const espnData = await fetchFromEspn(id, sport);
        if (espnData) {
            // Fetch season stats for both teams
            if (espnData.homeTeam?.abbr && espnData.awayTeam?.abbr) {
                try {
                    const teamStats = await fetchTeamSeasonStats(sport, espnData.homeTeam.abbr, espnData.awayTeam.abbr);
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
            return res.status(404).json({ error: 'Game not found', gameId: id, sport });
        }
    } catch (e) {
        console.error('Game fetch error:', e.message);
        return res.status(500).json({ error: 'Failed to fetch game data', message: e.message });
    }
}

// Fetch game data from ESPN API
async function fetchFromEspn(gameId, sport) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) return null;

    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${gameId}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    if (!data.header?.competitions?.[0]) return null;

    const comp = data.header.competitions[0];
    const homeTeam = comp.competitors?.find(c => c.homeAway === 'home');
    const awayTeam = comp.competitors?.find(c => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) return null;

    // Extract box score, odds, injuries
    const boxScore = extractEspnBoxScore(data, sport);
    const injuries = extractEspnInjuries(data);

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
        injuries,
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
        const nameLower = name.toLowerCase();
        const stat = stats.find(s =>
            s.name?.toLowerCase() === nameLower ||
            s.label?.toLowerCase() === nameLower
        );
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
                rebounds: getStatValue(homeStats, 'rebounds') || getStatValue(homeStats, 'totalRebounds'),
                assists: getStatValue(homeStats, 'assists'),
                steals: getStatValue(homeStats, 'steals'),
                blocks: getStatValue(homeStats, 'blocks'),
                turnovers: getStatValue(homeStats, 'turnovers'),
                fieldGoalPct: getStatValue(homeStats, 'fieldGoalPct')
            },
            away: {
                teamName: awayTeam?.team?.displayName || awayTeam?.team?.abbreviation,
                rebounds: getStatValue(awayStats, 'rebounds') || getStatValue(awayStats, 'totalRebounds'),
                assists: getStatValue(awayStats, 'assists'),
                steals: getStatValue(awayStats, 'steals'),
                blocks: getStatValue(awayStats, 'blocks'),
                turnovers: getStatValue(awayStats, 'turnovers'),
                fieldGoalPct: getStatValue(awayStats, 'fieldGoalPct')
            }
        };
    } else if (sport === 'MLB') {
        return {
            home: {
                teamName: homeTeam?.team?.displayName || homeTeam?.team?.abbreviation,
                hits: getStatValue(homeStats, 'hits'),
                errors: getStatValue(homeStats, 'errors'),
                runs: getStatValue(homeStats, 'runs')
            },
            away: {
                teamName: awayTeam?.team?.displayName || awayTeam?.team?.abbreviation,
                hits: getStatValue(awayStats, 'hits'),
                errors: getStatValue(awayStats, 'errors'),
                runs: getStatValue(awayStats, 'runs')
            }
        };
    } else if (sport === 'NHL') {
        return {
            home: {
                teamName: homeTeam?.team?.displayName || homeTeam?.team?.abbreviation,
                shots: getStatValue(homeStats, 'shots'),
                powerPlayGoals: getStatValue(homeStats, 'powerPlayGoals'),
                penaltyMinutes: getStatValue(homeStats, 'penaltyMinutes')
            },
            away: {
                teamName: awayTeam?.team?.displayName || awayTeam?.team?.abbreviation,
                shots: getStatValue(awayStats, 'shots'),
                powerPlayGoals: getStatValue(awayStats, 'powerPlayGoals'),
                penaltyMinutes: getStatValue(awayStats, 'penaltyMinutes')
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

function extractEspnInjuries(data) {
    const injuries = data.injuries;
    if (!injuries || injuries.length === 0) return null;

    const result = { home: [], away: [] };

    for (const team of injuries) {
        const side = team.homeAway === 'home' ? 'home' : 'away';
        const teamInjuries = (team.injuries || []).slice(0, 5).map(i => ({
            player: i.athlete?.displayName,
            position: i.athlete?.position?.abbreviation,
            status: i.status,
            injury: i.type || i.details?.detail
        }));
        result[side] = teamInjuries;
    }

    return result;
}

// Fetch team season stats from ESPN
async function fetchTeamSeasonStats(sport, homeTeam, awayTeam) {
    const sportPath = ESPN_SPORT_PATHS[sport];
    if (!sportPath) return null;

    const [homeData, awayData] = await Promise.all([
        fetchEspnTeamStats(sportPath, homeTeam, sport),
        fetchEspnTeamStats(sportPath, awayTeam, sport)
    ]);

    return { home: homeData, away: awayData };
}

async function fetchEspnTeamStats(sportPath, teamAbbr, sport) {
    const teamIdMap = ESPN_TEAM_IDS[sport] || {};
    const teamId = teamIdMap[teamAbbr];
    if (!teamId) return null;

    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamId}/statistics`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return formatEspnTeamStats(data, sport);
}

function formatEspnTeamStats(data, sport) {
    if (!data?.results?.stats?.categories) return null;

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

    const round1 = (val) => val !== null && val !== undefined ? parseFloat(val).toFixed(1) : null;

    if (sport === 'NBA') {
        return {
            pointsPerGame: round1(getStat('avgPoints') || getStat('pointsPerGame')),
            reboundsPerGame: round1(getStat('avgRebounds') || getStat('reboundsPerGame')),
            assistsPerGame: round1(getStat('avgAssists') || getStat('assistsPerGame')),
            fieldGoalPct: round1(getStat('fieldGoalPct')),
            threePointPct: round1(getStat('threePointFieldGoalPct'))
        };
    } else if (sport === 'NFL') {
        return {
            pointsPerGame: round1(getStat('avgPointsFor') || getStat('pointsPerGame')),
            yardsPerGame: round1(getStat('totalYardsPerGame')),
            passingYardsPerGame: round1(getStat('netPassingYardsPerGame')),
            rushingYardsPerGame: round1(getStat('rushingYardsPerGame')),
            pointsAllowedPerGame: round1(getStat('avgPointsAgainst'))
        };
    } else if (sport === 'NHL') {
        const gamesPlayed = parseFloat(getStat('gamesPlayed')) || 1;
        return {
            goalsPerGame: getStat('goalsFor') ? (parseFloat(getStat('goalsFor')) / gamesPlayed).toFixed(1) : null,
            goalsAgainstPerGame: getStat('goalsAgainst') ? (parseFloat(getStat('goalsAgainst')) / gamesPlayed).toFixed(1) : null,
            powerPlayPct: round1(getStat('powerPlayPct')),
            penaltyKillPct: round1(getStat('penaltyKillPct'))
        };
    } else if (sport === 'MLB') {
        return {
            runsPerGame: round1(getStat('runs') ? parseFloat(getStat('runs')) / (parseFloat(getStat('gamesPlayed')) || 1) : null),
            battingAverage: getStat('avg') || getStat('battingAverage'),
            era: getStat('ERA') || getStat('earnedRunAverage'),
            homeRuns: getStat('homeRuns')
        };
    }

    return null;
}
