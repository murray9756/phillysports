// Odds API - Unified endpoint
// All sports use TheOddsAPI

import { getCollection } from '../lib/mongodb.js';

const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Get today's date in US Eastern time (YYYY-MM-DD format)
function getLocalDate() {
    const now = new Date();
    const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = eastern.getFullYear();
    const month = String(eastern.getMonth() + 1).padStart(2, '0');
    const day = String(eastern.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Cache duration: 15 minutes
const CACHE_DURATION_MS = 15 * 60 * 1000;

const PRO_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL'];
const COLLEGE_SPORTS = ['NCAAF', 'NCAAB'];

// TheOddsAPI sport keys
const ODDS_API_SPORT_KEYS = {
    'NFL': 'americanfootball_nfl',
    'NBA': 'basketball_nba',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAB': 'basketball_ncaab'
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

    const { sport, team, date } = req.query;
    const sportUpper = sport?.toUpperCase();
    const targetDate = date || getLocalDate();

    console.log(`Odds API called: sport=${sportUpper || 'all'}, date=${targetDate}`);

    const validSports = [...PRO_SPORTS, ...COLLEGE_SPORTS];
    if (sportUpper && !validSports.includes(sportUpper)) {
        return res.status(400).json({
            error: 'Invalid sport',
            validSports
        });
    }

    try {
        let games = [];

        if (!sportUpper) {
            // Fetch all sports
            const allResults = await Promise.all(
                validSports.map(s => fetchTheOddsAPIData(s).catch(e => {
                    console.error(`TheOddsAPI ${s} error:`, e.message);
                    return [];
                }))
            );
            games = allResults.flat();
        } else {
            games = await fetchTheOddsAPIData(sportUpper);
            console.log(`Got ${games.length} games for ${sportUpper}`);
        }

        // Filter out completed/in-progress games
        const now = new Date();
        const upcomingGames = games.filter(game => {
            const gameTime = new Date(game.commenceTime);
            const isCompleted = game.status === 'Final' || game.status === 'F' || game.status === 'F/OT';
            const isInProgress = game.status === 'InProgress';
            const isScheduled = game.status === 'Scheduled' || !game.status;
            const timeOk = gameTime > now || isScheduled;

            return !isCompleted && !isInProgress && timeOk;
        });

        console.log(`Filtered to ${upcomingGames.length} upcoming games (removed ${games.length - upcomingGames.length} started/completed)`);

        // Sort by commence time
        upcomingGames.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

        return res.status(200).json({
            success: true,
            games: upcomingGames,
            sport: sportUpper || 'all',
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Odds API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch odds',
            message: error.message
        });
    }
}

// Fetch odds from TheOddsAPI
async function fetchTheOddsAPIData(sport) {
    if (!ODDS_API_KEY) {
        console.warn('ODDS_API_KEY not configured');
        return [];
    }

    const sportKey = ODDS_API_SPORT_KEYS[sport];
    if (!sportKey) return [];

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,h2h,totals&oddsFormat=american`;

    console.log(`Fetching ${sport} odds from TheOddsAPI: ${sportKey}`);

    const response = await fetch(url);
    if (!response.ok) {
        console.error(`TheOddsAPI fetch failed for ${sport}:`, response.status);
        return [];
    }

    let data = await response.json();
    console.log(`TheOddsAPI ${sport} odds response: ${data.length} games found`);

    // Track remaining API requests
    const remaining = response.headers.get('x-requests-remaining');
    if (remaining) {
        console.log(`TheOddsAPI requests remaining: ${remaining}`);
        await trackAPIUsage(parseInt(remaining));
    }

    return data.map(game => transformTheOddsAPIGame(game, sport));
}

// Transform TheOddsAPI game to unified format
function transformTheOddsAPIGame(game, sport) {
    const bookmaker = findPreferredBookmaker(game.bookmakers);
    if (!bookmaker) {
        return {
            id: game.id,
            sport,
            commenceTime: game.commence_time,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            bookmaker: null,
            odds: null,
            lastUpdate: new Date().toISOString(),
            source: 'theoddsapi'
        };
    }

    const odds = {};

    // Spread
    const spreadMarket = bookmaker.markets?.find(m => m.key === 'spreads');
    if (spreadMarket?.outcomes) {
        const homeSpread = spreadMarket.outcomes.find(o => o.name === game.home_team);
        const awaySpread = spreadMarket.outcomes.find(o => o.name === game.away_team);
        if (homeSpread && awaySpread) {
            odds.spread = {
                home: { point: homeSpread.point, price: homeSpread.price },
                away: { point: awaySpread.point, price: awaySpread.price }
            };
        }
    }

    // Moneyline
    const moneylineMarket = bookmaker.markets?.find(m => m.key === 'h2h');
    if (moneylineMarket?.outcomes) {
        const homeMl = moneylineMarket.outcomes.find(o => o.name === game.home_team);
        const awayMl = moneylineMarket.outcomes.find(o => o.name === game.away_team);
        if (homeMl && awayMl) {
            odds.moneyline = {
                home: homeMl.price,
                away: awayMl.price
            };
        }
    }

    // Total
    const totalMarket = bookmaker.markets?.find(m => m.key === 'totals');
    if (totalMarket?.outcomes) {
        const over = totalMarket.outcomes.find(o => o.name === 'Over');
        const under = totalMarket.outcomes.find(o => o.name === 'Under');
        if (over && under) {
            odds.total = {
                over: { point: over.point, price: over.price },
                under: { point: under.point, price: under.price }
            };
        }
    }

    return {
        id: game.id,
        sport,
        commenceTime: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        bookmaker: formatBookmakerName(bookmaker.key),
        odds: Object.keys(odds).length > 0 ? odds : null,
        lastUpdate: bookmaker.last_update || new Date().toISOString(),
        source: 'theoddsapi'
    };
}

// Preferred bookmakers
const PREFERRED_BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbetus'];

function findPreferredBookmaker(bookmakers) {
    if (!bookmakers || bookmakers.length === 0) return null;

    for (const preferred of PREFERRED_BOOKMAKERS) {
        const found = bookmakers.find(b => b.key === preferred);
        if (found) return found;
    }
    return bookmakers[0];
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

async function trackAPIUsage(remaining) {
    try {
        const usage = await getCollection('api_usage');
        const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 7);
        await usage.updateOne(
            { api: 'odds-api', month },
            {
                $inc: { requestCount: 1 },
                $set: { remainingRequests: remaining, lastRequest: new Date() }
            },
            { upsert: true }
        );
    } catch (e) {
        console.error('Usage tracking error:', e);
    }
}
