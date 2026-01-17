// Live Ticker API - Get live Philly games with play-by-play
// GET /api/live-ticker

const SCOREBOARD_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

const SUMMARY_URLS = {
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

async function fetchGameSummary(sport, eventId) {
    const url = `${SUMMARY_URLS[sport]}?event=${eventId}`;
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

function extractSituation(summary, sport) {
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
        const liveGames = [];
        const sports = ['NFL', 'NBA', 'NHL', 'MLB'];

        // Fetch all scoreboards in parallel
        const scoreboardResults = await Promise.all(
            sports.map(async (sport) => {
                try {
                    const response = await fetch(SCOREBOARD_URLS[sport]);
                    if (!response.ok) return { sport, events: [] };
                    const data = await response.json();
                    return { sport, events: data.events || [] };
                } catch (error) {
                    console.error(`Error fetching ${sport}:`, error);
                    return { sport, events: [] };
                }
            })
        );

        // Process each sport's games
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
                const isScheduled = status?.state === 'pre';

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
                    const summary = await fetchGameSummary(sport, event.id);
                    if (summary) {
                        gameData.recentPlays = extractRecentPlays(summary, sport);
                        gameData.situation = extractSituation(summary, sport);
                    }
                }

                liveGames.push(gameData);
            }
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
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Live ticker error:', error);
        return res.status(500).json({ error: 'Failed to fetch live games' });
    }
}
