// Live Ticker API - Get live Philly games with play-by-play
// GET /api/live-ticker
// Uses SportsDataIO for live scores, falls back to ESPN

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// ESPN fallback URLs
const ESPN_SCOREBOARD_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

const ESPN_SUMMARY_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary'
};

// Philly teams identification
const PHILLY_TEAMS = {
    NFL: { names: ['eagles', 'philadelphia eagles'], abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png' },
    NBA: { names: ['76ers', 'sixers', 'philadelphia 76ers'], abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png' },
    MLB: { names: ['phillies', 'philadelphia phillies'], abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png' },
    NHL: { names: ['flyers', 'philadelphia flyers'], abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nhl/500/phi.png' }
};

function isPhillyTeam(teamName, sport) {
    if (!teamName) return false;
    const normalized = teamName.toLowerCase();
    const patterns = PHILLY_TEAMS[sport]?.names || [];
    return patterns.some(p => normalized.includes(p));
}

function getScore(score) {
    if (typeof score === 'object' && score !== null) {
        return parseInt(score.displayValue || score.value || '0', 10);
    }
    return parseInt(score || '0', 10);
}

async function fetchESPNGameSummary(sport, eventId) {
    const url = `${ESPN_SUMMARY_URLS[sport]}?event=${eventId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Error fetching summary for ${sport} ${eventId}:`, error);
        return null;
    }
}

function extractRecentPlays(summary, sport) {
    const plays = [];

    if (sport === 'NFL') {
        // Get recent drives/plays
        const drives = summary?.drives?.current || summary?.drives?.previous?.[0];
        if (drives?.plays) {
            const recentPlays = drives.plays.slice(-3);
            recentPlays.forEach(play => {
                if (play.text) {
                    plays.push({
                        text: play.text,
                        clock: play.clock?.displayValue,
                        type: play.type?.text
                    });
                }
            });
        }
    } else if (sport === 'NBA') {
        // Get recent plays from plays array
        const playList = summary?.plays || [];
        const recentPlays = playList.slice(-5);
        recentPlays.forEach(play => {
            if (play.text) {
                plays.push({
                    text: play.text,
                    clock: play.clock?.displayValue,
                    team: play.team?.abbreviation
                });
            }
        });
    } else if (sport === 'NHL') {
        // Get recent plays
        const playList = summary?.plays || [];
        const recentPlays = playList.slice(-5);
        recentPlays.forEach(play => {
            if (play.text) {
                plays.push({
                    text: play.text,
                    clock: play.clock?.displayValue,
                    period: play.period?.number
                });
            }
        });
    } else if (sport === 'MLB') {
        // Get recent at-bats/plays
        const atBats = summary?.atBats || [];
        const recentAtBats = atBats.slice(-3);
        recentAtBats.forEach(ab => {
            if (ab.result) {
                plays.push({
                    text: ab.result,
                    batter: ab.batter?.athlete?.shortName,
                    pitcher: ab.pitcher?.athlete?.shortName
                });
            }
        });

        // Also check for plays array
        const playList = summary?.plays || [];
        const recentPlays = playList.slice(-3);
        recentPlays.forEach(play => {
            if (play.text && !plays.find(p => p.text === play.text)) {
                plays.push({
                    text: play.text,
                    inning: play.period?.number
                });
            }
        });
    }

    return plays.slice(-3); // Return last 3 plays
}

function extractSituationESPN(summary, sport) {
    const situation = {};

    if (sport === 'NFL') {
        const sit = summary?.situation;
        if (sit) {
            situation.down = sit.down;
            situation.distance = sit.distance;
            situation.yardLine = sit.yardLine;
            situation.possession = sit.possession?.abbreviation;
            situation.isRedZone = sit.isRedZone;
            if (sit.down && sit.distance) {
                situation.display = `${sit.down}${getOrdinal(sit.down)} & ${sit.distance}`;
            }
        }
    } else if (sport === 'MLB') {
        const sit = summary?.situation;
        if (sit) {
            situation.balls = sit.balls;
            situation.strikes = sit.strikes;
            situation.outs = sit.outs;
            situation.onFirst = sit.onFirst;
            situation.onSecond = sit.onSecond;
            situation.onThird = sit.onThird;
            situation.batter = sit.batter?.athlete?.shortName;
            situation.pitcher = sit.pitcher?.athlete?.shortName;
            situation.display = `${sit.balls}-${sit.strikes}, ${sit.outs} out${sit.outs !== 1 ? 's' : ''}`;
        }
    }

    return situation;
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let liveGames = [];
        let source = 'espn';

        // Try SportsDataIO first if API key is configured
        if (SPORTSDATA_API_KEY) {
            try {
                liveGames = await fetchFromSportsDataIO();
                source = 'sportsdata';
            } catch (e) {
                console.error('SportsDataIO error, falling back to ESPN:', e.message);
                liveGames = await fetchFromESPN();
            }
        } else {
            liveGames = await fetchFromESPN();
        }

        // Sort: in-progress first, then by game time
        liveGames.sort((a, b) => {
            if (a.status.isInProgress && !b.status.isInProgress) return -1;
            if (!a.status.isInProgress && b.status.isInProgress) return 1;
            return new Date(a.gameTime) - new Date(b.gameTime);
        });

        return res.status(200).json({
            success: true,
            games: liveGames,
            count: liveGames.length,
            timestamp: new Date().toISOString(),
            source
        });

    } catch (error) {
        console.error('Live ticker error:', error);
        return res.status(500).json({ error: 'Failed to fetch live games' });
    }
}

// Fetch live scores from SportsDataIO
async function fetchFromSportsDataIO() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '-');
    const liveGames = [];

    const sportConfigs = [
        { sport: 'NFL', endpoint: 'nfl', season: '2024REG' },
        { sport: 'NBA', endpoint: 'nba', season: '2025' },
        { sport: 'MLB', endpoint: 'mlb', season: '2025' },
        { sport: 'NHL', endpoint: 'nhl', season: '2025' }
    ];

    // Fetch all sports in parallel
    const results = await Promise.all(
        sportConfigs.map(async ({ sport, endpoint }) => {
            try {
                const url = `https://api.sportsdata.io/v3/${endpoint}/scores/json/ScoresByDate/${today}?key=${SPORTSDATA_API_KEY}`;
                const response = await fetch(url);
                if (!response.ok) return { sport, games: [] };
                const games = await response.json();
                return { sport, games: games || [] };
            } catch (e) {
                console.error(`SportsDataIO ${sport} error:`, e.message);
                return { sport, games: [] };
            }
        })
    );

    // Process each sport's games
    for (const { sport, games } of results) {
        for (const game of games) {
            // Check if Philly team is playing
            const homeIsPhilly = isPhillyTeamSportsData(game.HomeTeam, sport);
            const awayIsPhilly = isPhillyTeamSportsData(game.AwayTeam, sport);
            if (!homeIsPhilly && !awayIsPhilly) continue;

            const isInProgress = game.Status === 'InProgress';
            const isFinal = game.Status === 'Final' || game.Status === 'F/OT';
            const isScheduled = game.Status === 'Scheduled';

            // Only include live or recently finished games
            if (!isInProgress && !isFinal) continue;
            if (isFinal) {
                const gameDate = new Date(game.DateTime);
                const now = new Date();
                const hoursSinceStart = (now - gameDate) / (1000 * 60 * 60);
                if (hoursSinceStart > 3) continue;
            }

            const gameData = {
                id: game.GameID?.toString() || game.ScoreID?.toString(),
                sport,
                homeTeam: {
                    name: game.HomeTeam,
                    shortName: game.HomeTeam,
                    score: game.HomeScore || 0,
                    logo: getTeamLogo(sport, game.HomeTeam),
                    isPhilly: homeIsPhilly
                },
                awayTeam: {
                    name: game.AwayTeam,
                    shortName: game.AwayTeam,
                    score: game.AwayScore || 0,
                    logo: getTeamLogo(sport, game.AwayTeam),
                    isPhilly: awayIsPhilly
                },
                status: {
                    state: isInProgress ? 'in' : (isFinal ? 'post' : 'pre'),
                    description: getStatusDescription(game, sport),
                    detail: game.Status,
                    period: game.Period || game.Inning || game.Quarter,
                    clock: game.TimeRemainingMinutes ? `${game.TimeRemainingMinutes}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}` : null,
                    isInProgress,
                    isFinal
                },
                gameTime: game.DateTime,
                venue: game.StadiumDetails?.Name || game.Stadium,
                broadcast: game.Channel,
                recentPlays: [],
                situation: getSituation(game, sport)
            };

            // Get play-by-play if available and game is in progress
            if (isInProgress && game.GameID) {
                try {
                    const plays = await fetchPlayByPlay(sport, game.GameID);
                    gameData.recentPlays = plays;
                } catch (e) {
                    // Play-by-play not available, continue without it
                }
            }

            liveGames.push(gameData);
        }
    }

    return liveGames;
}

function isPhillyTeamSportsData(teamAbbr, sport) {
    if (!teamAbbr) return false;
    const phillyAbbrs = {
        NFL: ['PHI'],
        NBA: ['PHI'],
        MLB: ['PHI'],
        NHL: ['PHI']
    };
    return phillyAbbrs[sport]?.includes(teamAbbr.toUpperCase());
}

function getTeamLogo(sport, teamAbbr) {
    const sportPath = {
        NFL: 'nfl',
        NBA: 'nba',
        MLB: 'mlb',
        NHL: 'nhl'
    };
    return `https://a.espncdn.com/i/teamlogos/${sportPath[sport]}/500/${teamAbbr?.toLowerCase()}.png`;
}

function getStatusDescription(game, sport) {
    if (game.Status === 'Final' || game.Status === 'F/OT') {
        return game.Status === 'F/OT' ? 'Final/OT' : 'Final';
    }
    if (game.Status === 'InProgress') {
        if (sport === 'NFL') {
            return `Q${game.Quarter || 1} ${game.TimeRemainingMinutes || 0}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}`;
        } else if (sport === 'NBA') {
            return `Q${game.Quarter || 1} ${game.TimeRemainingMinutes || 0}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}`;
        } else if (sport === 'NHL') {
            return `P${game.Period || 1} ${game.TimeRemainingMinutes || 0}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}`;
        } else if (sport === 'MLB') {
            const half = game.InningHalf === 'T' ? 'Top' : 'Bot';
            return `${half} ${game.Inning || 1}`;
        }
    }
    return game.Status;
}

function getSituation(game, sport) {
    const situation = {};

    if (sport === 'NFL' && game.Status === 'InProgress') {
        if (game.Down && game.Distance) {
            situation.down = game.Down;
            situation.distance = game.Distance;
            situation.yardLine = game.YardLine;
            situation.possession = game.Possession;
            situation.display = `${game.Down}${getOrdinal(game.Down)} & ${game.Distance}`;
        }
    } else if (sport === 'MLB' && game.Status === 'InProgress') {
        if (game.Balls !== undefined) {
            situation.balls = game.Balls;
            situation.strikes = game.Strikes;
            situation.outs = game.Outs;
            situation.display = `${game.Balls}-${game.Strikes}, ${game.Outs} out${game.Outs !== 1 ? 's' : ''}`;
        }
    }

    return situation;
}

async function fetchPlayByPlay(sport, gameId) {
    const sportEndpoints = {
        NFL: 'nfl',
        NBA: 'nba',
        MLB: 'mlb',
        NHL: 'nhl'
    };

    try {
        const url = `https://api.sportsdata.io/v3/${sportEndpoints[sport]}/pbp/json/PlayByPlay/${gameId}?key=${SPORTSDATA_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const plays = data.Plays || data.PlayByPlays || [];

        // Return last 3 plays
        return plays.slice(-3).map(play => ({
            text: play.Description || play.PlayDescription || play.Text,
            clock: play.TimeRemaining,
            type: play.PlayType
        })).filter(p => p.text);
    } catch (e) {
        return [];
    }
}

// ESPN fallback function
async function fetchFromESPN() {
    const liveGames = [];
    const sports = ['NFL', 'NBA', 'NHL', 'MLB'];

    // Fetch all scoreboards in parallel
    const scoreboardResults = await Promise.all(
        sports.map(async (sport) => {
            try {
                const response = await fetch(ESPN_SCOREBOARD_URLS[sport]);
                if (!response.ok) return { sport, events: [] };
                const data = await response.json();
                return { sport, events: data.events || [] };
            } catch (error) {
                console.error(`Error fetching ${sport}:`, error);
                return { sport, events: [] };
            }
        })
    );

    // Process each sport's games (ESPN)
    for (const { sport, events } of scoreboardResults) {
        for (const event of events) {
            const competition = event.competitions?.[0];
            if (!competition) continue;

            const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
            if (!homeTeam || !awayTeam) continue;

            // Check if Philly team is playing
            const homeIsPhilly = isPhillyTeam(homeTeam.team?.displayName, sport);
            const awayIsPhilly = isPhillyTeam(awayTeam.team?.displayName, sport);
            if (!homeIsPhilly && !awayIsPhilly) continue;

            const status = competition.status?.type;
            const isInProgress = status?.state === 'in' || status?.name === 'STATUS_IN_PROGRESS';
            const isFinal = status?.completed === true;

            // Only include live or recently finished games (within 2 hours)
            const gameDate = new Date(event.date);
            const now = new Date();
            const hoursSinceStart = (now - gameDate) / (1000 * 60 * 60);

            if (!isInProgress && !isFinal) continue;
            if (isFinal && hoursSinceStart > 2) continue;

            const gameData = {
                id: event.id,
                sport,
                homeTeam: {
                    name: homeTeam.team?.displayName,
                    shortName: homeTeam.team?.abbreviation,
                    score: getScore(homeTeam.score),
                    logo: homeTeam.team?.logo,
                    isPhilly: homeIsPhilly
                },
                awayTeam: {
                    name: awayTeam.team?.displayName,
                    shortName: awayTeam.team?.abbreviation,
                    score: getScore(awayTeam.score),
                    logo: awayTeam.team?.logo,
                    isPhilly: awayIsPhilly
                },
                status: {
                    state: status?.state,
                    description: status?.description || status?.shortDetail,
                    detail: status?.detail,
                    period: competition.status?.period,
                    clock: competition.status?.displayClock,
                    isInProgress,
                    isFinal
                },
                gameTime: event.date,
                venue: competition.venue?.fullName,
                broadcast: competition.broadcasts?.[0]?.names?.[0],
                recentPlays: [],
                situation: {}
            };

            // Fetch play-by-play for in-progress games
            if (isInProgress) {
                const summary = await fetchESPNGameSummary(sport, event.id);
                if (summary) {
                    gameData.recentPlays = extractRecentPlays(summary, sport);
                    gameData.situation = extractSituationESPN(summary, sport);
                }
            }

            liveGames.push(gameData);
        }
    }

    return liveGames;
}
