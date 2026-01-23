// Odds API - Unified endpoint
// Pro sports (NFL, NBA, MLB, NHL) -> SportsDataIO
// College sports (NCAAF, NCAAB) -> TheOddsAPI

import { getCollection } from '../lib/mongodb.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Cache duration: 15 minutes
const CACHE_DURATION_MS = 15 * 60 * 1000;

// Pro sports use SportsDataIO
const PRO_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL'];

// College sports use TheOddsAPI
const COLLEGE_SPORTS = ['NCAAF', 'NCAAB'];
const COLLEGE_SPORT_KEYS = {
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

    const { sport, team } = req.query;
    const sportUpper = sport?.toUpperCase();

    // Validate sport parameter
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
            const [proGames, collegeGames] = await Promise.all([
                fetchProSportsOdds(team),
                fetchCollegeSportsOdds()
            ]);
            games = [...proGames, ...collegeGames];
        } else if (PRO_SPORTS.includes(sportUpper)) {
            // Pro sport - use SportsDataIO
            games = await fetchSportsDataOdds(sportUpper, team);
        } else if (COLLEGE_SPORTS.includes(sportUpper)) {
            // College sport - use TheOddsAPI
            games = await fetchTheOddsAPIData(sportUpper);
        }

        // Sort by commence time
        games.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

        return res.status(200).json({
            success: true,
            games,
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

// Fetch all pro sports odds from SportsDataIO
async function fetchProSportsOdds(team) {
    const allGames = [];
    for (const sport of PRO_SPORTS) {
        try {
            const games = await fetchSportsDataOdds(sport, team);
            allGames.push(...games);
        } catch (e) {
            console.error(`Error fetching ${sport} odds:`, e.message);
        }
    }
    return allGames;
}

// Fetch all college sports odds from TheOddsAPI
async function fetchCollegeSportsOdds() {
    if (!ODDS_API_KEY) return [];

    const allGames = [];
    for (const sport of COLLEGE_SPORTS) {
        try {
            const games = await fetchTheOddsAPIData(sport);
            allGames.push(...games);
        } catch (e) {
            console.error(`Error fetching ${sport} odds:`, e.message);
        }
    }
    return allGames;
}

// Fetch odds from SportsDataIO (pro sports)
async function fetchSportsDataOdds(sport, team) {
    if (!SPORTSDATA_API_KEY) {
        console.warn('SPORTSDATA_API_KEY not configured');
        return [];
    }

    const endpoints = {
        NFL: 'nfl',
        NBA: 'nba',
        MLB: 'mlb',
        NHL: 'nhl'
    };

    const endpoint = endpoints[sport];
    if (!endpoint) return [];

    // Get current week for NFL, today's date for others
    let url;
    if (sport === 'NFL') {
        // Get current NFL week
        try {
            const weekUrl = `https://api.sportsdata.io/v3/nfl/scores/json/CurrentWeek?key=${SPORTSDATA_API_KEY}`;
            const weekResponse = await fetch(weekUrl);
            if (weekResponse.ok) {
                const currentWeek = await weekResponse.json();
                url = `https://api.sportsdata.io/v3/nfl/odds/json/GameOddsByWeek/2025REG/${currentWeek}?key=${SPORTSDATA_API_KEY}`;
            }
        } catch (e) {
            console.error('Failed to get NFL week, using default');
        }
        if (!url) {
            url = `https://api.sportsdata.io/v3/nfl/odds/json/GameOddsByWeek/2025REG/1?key=${SPORTSDATA_API_KEY}`;
        }
    } else {
        const today = new Date().toISOString().split('T')[0];
        url = `https://api.sportsdata.io/v3/${endpoint}/odds/json/GameOddsByDate/${today}?key=${SPORTSDATA_API_KEY}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        console.error(`SportsDataIO odds fetch failed for ${sport}:`, response.status);
        return [];
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
        // Default: filter to Philly teams
        games = games.filter(g =>
            g.HomeTeam === 'PHI' || g.AwayTeam === 'PHI'
        );
    }

    // Transform to unified format
    return games.map(game => transformSportsDataGame(game, sport));
}

// Transform SportsDataIO game to unified format
function transformSportsDataGame(game, sport) {
    const pregameOdds = game.PregameOdds || [];
    const consensus = pregameOdds.find(o => o.Sportsbook === 'Consensus') ||
                      pregameOdds.find(o => o.Sportsbook === 'DraftKings') ||
                      pregameOdds.find(o => o.Sportsbook === 'FanDuel') ||
                      pregameOdds[0] || {};

    const odds = {};

    // Spread
    if (consensus.HomePointSpread !== null && consensus.HomePointSpread !== undefined) {
        odds.spread = {
            home: { point: consensus.HomePointSpread, price: consensus.HomePointSpreadPayout || -110 },
            away: { point: consensus.AwayPointSpread, price: consensus.AwayPointSpreadPayout || -110 }
        };
    }

    // Moneyline
    if (consensus.HomeMoneyLine !== null && consensus.HomeMoneyLine !== undefined) {
        odds.moneyline = {
            home: consensus.HomeMoneyLine,
            away: consensus.AwayMoneyLine
        };
    }

    // Total
    if (consensus.OverUnder !== null && consensus.OverUnder !== undefined) {
        odds.total = {
            over: { point: consensus.OverUnder, price: consensus.OverPayout || -110 },
            under: { point: consensus.OverUnder, price: consensus.UnderPayout || -110 }
        };
    }

    return {
        id: game.GameId || game.ScoreID,
        sport,
        commenceTime: game.DateTime || game.Day,
        homeTeam: game.HomeTeam,
        awayTeam: game.AwayTeam,
        bookmaker: consensus.Sportsbook || 'Consensus',
        odds: Object.keys(odds).length > 0 ? odds : null,
        status: game.Status,
        lastUpdate: new Date().toISOString(),
        source: 'sportsdata'
    };
}

// Fetch odds from TheOddsAPI (college sports only)
async function fetchTheOddsAPIData(sport) {
    if (!ODDS_API_KEY) {
        console.warn('ODDS_API_KEY not configured for college sports');
        return [];
    }

    const sportKey = COLLEGE_SPORT_KEYS[sport];
    if (!sportKey) return [];

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,h2h,totals&oddsFormat=american`;

    const response = await fetch(url);
    if (!response.ok) {
        console.error(`TheOddsAPI fetch failed for ${sport}:`, response.status);
        return [];
    }

    const data = await response.json();

    // Track remaining API requests
    const remaining = response.headers.get('x-requests-remaining');
    if (remaining) {
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

// Preferred bookmakers for TheOddsAPI
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
        const month = new Date().toISOString().slice(0, 7);
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
