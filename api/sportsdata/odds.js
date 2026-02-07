// Odds & Betting Lines API - Uses TheOddsAPI
// GET /api/sportsdata/odds?sport=NFL
// GET /api/sportsdata/odds?sport=NFL&team=PHI

const ODDS_API_KEY = process.env.ODDS_API_KEY;

const ODDS_API_SPORT_KEYS = {
    'NFL': 'americanfootball_nfl',
    'NBA': 'basketball_nba',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sport, team, gameId } = req.query;

    if (!ODDS_API_KEY) {
        return res.status(500).json({ error: 'Odds API key not configured' });
    }

    try {
        const sportUpper = (sport || 'NFL').toUpperCase();
        const sportKey = ODDS_API_SPORT_KEYS[sportUpper];

        if (!sportKey) {
            return res.status(400).json({ error: 'Invalid sport. Valid: NFL, NBA, MLB, NHL' });
        }

        const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,h2h,totals&oddsFormat=american`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`TheOddsAPI fetch failed: ${response.status}`);
        }

        let games = await response.json();

        // Filter by team if specified
        if (team) {
            const teamUpper = team.toUpperCase();
            games = games.filter(g =>
                g.home_team?.toUpperCase().includes(teamUpper) ||
                g.away_team?.toUpperCase().includes(teamUpper)
            );
        }

        // Filter by gameId if specified
        if (gameId) {
            games = games.filter(g => g.id === gameId);
        }

        const odds = games.map(game => transformOdds(game, sportUpper));

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

function transformOdds(game, sport) {
    const PREFERRED = ['draftkings', 'fanduel', 'betmgm', 'caesars'];
    const bookmakers = game.bookmakers || [];
    let bookmaker = null;
    for (const pref of PREFERRED) {
        bookmaker = bookmakers.find(b => b.key === pref);
        if (bookmaker) break;
    }
    if (!bookmaker) bookmaker = bookmakers[0];

    const spread = bookmaker?.markets?.find(m => m.key === 'spreads');
    const moneyline = bookmaker?.markets?.find(m => m.key === 'h2h');
    const total = bookmaker?.markets?.find(m => m.key === 'totals');

    const homeSpread = spread?.outcomes?.find(o => o.name === game.home_team);
    const awaySpread = spread?.outcomes?.find(o => o.name === game.away_team);
    const homeMl = moneyline?.outcomes?.find(o => o.name === game.home_team);
    const awayMl = moneyline?.outcomes?.find(o => o.name === game.away_team);
    const over = total?.outcomes?.find(o => o.name === 'Over');
    const under = total?.outcomes?.find(o => o.name === 'Under');

    const isPhilly = game.home_team?.includes('Philadelphia') || game.away_team?.includes('Philadelphia');
    const phillyIsHome = game.home_team?.includes('Philadelphia');

    return {
        gameId: game.id,
        date: game.commence_time,
        dateDisplay: formatGameDate(game.commence_time),
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        status: null,

        spread: {
            home: homeSpread?.point || null,
            away: awaySpread?.point || null,
            homeOdds: homeSpread?.price || null,
            awayOdds: awaySpread?.price || null
        },
        moneyline: {
            home: homeMl?.price || null,
            away: awayMl?.price || null
        },
        total: {
            overUnder: over?.point || null,
            overOdds: over?.price || null,
            underOdds: under?.price || null
        },

        live: null,

        sportsbooks: bookmakers.map(b => {
            const bSpread = b.markets?.find(m => m.key === 'spreads')?.outcomes?.find(o => o.name === game.home_team);
            const bMlHome = b.markets?.find(m => m.key === 'h2h')?.outcomes?.find(o => o.name === game.home_team);
            const bMlAway = b.markets?.find(m => m.key === 'h2h')?.outcomes?.find(o => o.name === game.away_team);
            const bTotal = b.markets?.find(m => m.key === 'totals')?.outcomes?.find(o => o.name === 'Over');
            return {
                name: formatBookmakerName(b.key),
                spread: bSpread?.point || null,
                moneylineHome: bMlHome?.price || null,
                moneylineAway: bMlAway?.price || null,
                total: bTotal?.point || null
            };
        }),

        display: {
            spread: homeSpread ? formatSpread(homeSpread.point, game.home_team) : null,
            moneyline: (homeMl && awayMl) ? formatMoneyline(homeMl.price, awayMl.price, game.home_team, game.away_team) : null,
            total: over ? `O/U ${over.point}` : null
        },

        isPhilly,
        phillyIsHome,
        phillySpread: phillyIsHome ? (homeSpread?.point || null) : (awaySpread?.point || null),
        phillyMoneyline: phillyIsHome ? (homeMl?.price || null) : (awayMl?.price || null)
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

function formatBookmakerName(key) {
    const names = {
        'draftkings': 'DraftKings',
        'fanduel': 'FanDuel',
        'betmgm': 'BetMGM',
        'caesars': 'Caesars',
        'pointsbetus': 'PointsBet'
    };
    return names[key] || key;
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
