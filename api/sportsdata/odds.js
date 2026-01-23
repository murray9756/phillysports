// SportsDataIO Odds & Betting Lines API
// GET /api/sportsdata/odds?sport=NFL
// GET /api/sportsdata/odds?sport=NFL&team=PHI

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, team, gameId } = req.query;

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();

        let odds;
        if (gameId) {
            odds = await fetchGameOdds(sportUpper, gameId);
        } else {
            odds = await fetchUpcomingOdds(sportUpper, team);
        }

        return res.status(200).json({
            success: true,
            sport: sportUpper,
            team: team || 'all',
            odds
        });
    } catch (error) {
        console.error('Odds API error:', error);
        return res.status(500).json({ error: 'Failed to fetch odds' });
    }
}

async function fetchUpcomingOdds(sport, team) {
    // Get today's date and next 7 days
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);

    const formatDate = (d) => d.toISOString().split('T')[0];

    const endpoints = {
        NFL: `https://api.sportsdata.io/v3/nfl/odds/json/GameOddsByWeek/2024REG/1`,
        NBA: `https://api.sportsdata.io/v3/nba/odds/json/GameOddsByDate/${formatDate(today)}`,
        MLB: `https://api.sportsdata.io/v3/mlb/odds/json/GameOddsByDate/${formatDate(today)}`,
        NHL: `https://api.sportsdata.io/v3/nhl/odds/json/GameOddsByDate/${formatDate(today)}`
    };

    // For NFL, we need to get the current week
    if (sport === 'NFL') {
        try {
            const weekUrl = `https://api.sportsdata.io/v3/nfl/scores/json/CurrentWeek?key=${SPORTSDATA_API_KEY}`;
            const weekResponse = await fetch(weekUrl);
            if (weekResponse.ok) {
                const currentWeek = await weekResponse.json();
                endpoints.NFL = `https://api.sportsdata.io/v3/nfl/odds/json/GameOddsByWeek/2024REG/${currentWeek}`;
            }
        } catch (e) {
            console.error('Failed to get current NFL week');
        }
    }

    const url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Odds fetch failed: ${response.status}`);
    }

    let games = await response.json();

    // Filter by team if specified
    if (team) {
        const teamUpper = team.toUpperCase();
        games = games.filter(g =>
            g.HomeTeam?.toUpperCase() === teamUpper ||
            g.AwayTeam?.toUpperCase() === teamUpper
        );
    } else {
        // Filter to Philly teams
        games = games.filter(g =>
            g.HomeTeam === 'PHI' || g.AwayTeam === 'PHI'
        );
    }

    return games.map(game => transformOdds(game, sport));
}

async function fetchGameOdds(sport, gameId) {
    const endpoints = {
        NFL: `https://api.sportsdata.io/v3/nfl/odds/json/GameOdds/${gameId}`,
        NBA: `https://api.sportsdata.io/v3/nba/odds/json/GameOdds/${gameId}`,
        MLB: `https://api.sportsdata.io/v3/mlb/odds/json/GameOdds/${gameId}`,
        NHL: `https://api.sportsdata.io/v3/nhl/odds/json/GameOdds/${gameId}`
    };

    const url = `${endpoints[sport]}?key=${SPORTSDATA_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Game odds fetch failed: ${response.status}`);
    }

    const game = await response.json();
    return transformOdds(game, sport);
}

function transformOdds(game, sport) {
    // Get consensus odds (or first available)
    const pregameOdds = game.PregameOdds || [];
    const consensus = pregameOdds.find(o => o.Sportsbook === 'Consensus') ||
                      pregameOdds.find(o => o.Sportsbook === 'DraftKings') ||
                      pregameOdds.find(o => o.Sportsbook === 'FanDuel') ||
                      pregameOdds[0] || {};

    const liveOdds = game.LiveOdds || [];
    const liveConsensus = liveOdds.find(o => o.Sportsbook === 'Consensus') ||
                          liveOdds[0] || {};

    return {
        gameId: game.GameId || game.ScoreID,
        date: game.DateTime || game.Day,
        dateDisplay: formatGameDate(game.DateTime || game.Day),
        homeTeam: game.HomeTeam,
        awayTeam: game.AwayTeam,
        status: game.Status,

        // Pregame lines
        spread: {
            home: consensus.HomePointSpread,
            away: consensus.AwayPointSpread,
            homeOdds: consensus.HomePointSpreadPayout,
            awayOdds: consensus.AwayPointSpreadPayout
        },
        moneyline: {
            home: consensus.HomeMoneyLine,
            away: consensus.AwayMoneyLine
        },
        total: {
            overUnder: consensus.OverUnder,
            overOdds: consensus.OverPayout,
            underOdds: consensus.UnderPayout
        },

        // Live lines (if game in progress)
        live: liveConsensus.HomePointSpread ? {
            spread: {
                home: liveConsensus.HomePointSpread,
                away: liveConsensus.AwayPointSpread
            },
            moneyline: {
                home: liveConsensus.HomeMoneyLine,
                away: liveConsensus.AwayMoneyLine
            },
            total: {
                overUnder: liveConsensus.OverUnder
            }
        } : null,

        // All sportsbook odds for comparison
        sportsbooks: pregameOdds.map(o => ({
            name: o.Sportsbook,
            spread: o.HomePointSpread,
            moneylineHome: o.HomeMoneyLine,
            moneylineAway: o.AwayMoneyLine,
            total: o.OverUnder
        })),

        // Formatted display strings
        display: {
            spread: formatSpread(consensus.HomePointSpread, game.HomeTeam),
            moneyline: formatMoneyline(consensus.HomeMoneyLine, consensus.AwayMoneyLine, game.HomeTeam, game.AwayTeam),
            total: consensus.OverUnder ? `O/U ${consensus.OverUnder}` : null
        },

        isPhilly: game.HomeTeam === 'PHI' || game.AwayTeam === 'PHI',
        phillyIsHome: game.HomeTeam === 'PHI',
        phillySpread: game.HomeTeam === 'PHI' ? consensus.HomePointSpread : consensus.AwayPointSpread,
        phillyMoneyline: game.HomeTeam === 'PHI' ? consensus.HomeMoneyLine : consensus.AwayMoneyLine
    };
}

function formatSpread(spread, team) {
    if (!spread && spread !== 0) return null;
    const sign = spread > 0 ? '+' : '';
    return `${team} ${sign}${spread}`;
}

function formatMoneyline(homeML, awayML, homeTeam, awayTeam) {
    if (!homeML && !awayML) return null;
    const formatML = (ml) => ml > 0 ? `+${ml}` : ml;
    return `${homeTeam} ${formatML(homeML)} / ${awayTeam} ${formatML(awayML)}`;
}

function formatGameDate(dateStr) {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}
