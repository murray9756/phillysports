// Odds API - Fetch betting odds from The Odds API
// GET: Returns odds for games across NFL, NBA, MLB, NHL, NCAAF, NCAAB

import { getCollection } from '../lib/mongodb.js';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Cache duration: 15 minutes
const CACHE_DURATION_MS = 15 * 60 * 1000;

// Sport key mapping for The Odds API
const SPORT_KEYS = {
    'NFL': 'americanfootball_nfl',
    'NBA': 'basketball_nba',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAB': 'basketball_ncaab'
};

// Sport display names
const SPORT_NAMES = {
    'americanfootball_nfl': 'NFL',
    'basketball_nba': 'NBA',
    'baseball_mlb': 'MLB',
    'icehockey_nhl': 'NHL',
    'americanfootball_ncaaf': 'NCAAF',
    'basketball_ncaab': 'NCAAB'
};

// Preferred bookmakers (in order of preference)
const PREFERRED_BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbetus'];

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

    const { sport, date } = req.query;

    // Validate sport parameter
    if (sport && !SPORT_KEYS[sport.toUpperCase()]) {
        return res.status(400).json({
            error: 'Invalid sport',
            validSports: Object.keys(SPORT_KEYS)
        });
    }

    try {
        // Check cache first
        const cacheKey = `odds_${date || 'today'}_${sport || 'all'}`;
        const cachedData = await getCachedOdds(cacheKey);

        if (cachedData) {
            return res.status(200).json({
                success: true,
                games: cachedData.games,
                lastUpdated: cachedData.lastUpdated,
                cached: true
            });
        }

        // Check if API key is configured
        if (!ODDS_API_KEY) {
            // Return mock data for development/demo
            return res.status(200).json({
                success: true,
                games: getMockOddsData(sport),
                lastUpdated: new Date().toISOString(),
                cached: false,
                demo: true,
                debug: {
                    keyPresent: !!process.env.ODDS_API_KEY,
                    keyLength: process.env.ODDS_API_KEY ? process.env.ODDS_API_KEY.length : 0
                }
            });
        }

        // Fetch from The Odds API
        const games = await fetchOddsFromAPI(sport);

        // Cache the results
        await cacheOdds(cacheKey, games);

        return res.status(200).json({
            success: true,
            games,
            lastUpdated: new Date().toISOString(),
            cached: false
        });

    } catch (error) {
        console.error('Odds API error:', error);

        // Try to return stale cache on error
        const staleData = await getStaleCache(sport);
        if (staleData) {
            return res.status(200).json({
                success: true,
                games: staleData.games,
                lastUpdated: staleData.lastUpdated,
                cached: true,
                stale: true,
                warning: 'Showing cached data due to API error'
            });
        }

        return res.status(500).json({
            error: 'Failed to fetch odds',
            message: error.message
        });
    }
}

async function fetchOddsFromAPI(sportFilter) {
    const allGames = [];
    const sportsToFetch = sportFilter
        ? [SPORT_KEYS[sportFilter.toUpperCase()]]
        : Object.values(SPORT_KEYS);

    for (const sportKey of sportsToFetch) {
        try {
            const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,h2h,totals&oddsFormat=american`;

            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Failed to fetch ${sportKey}:`, response.status);
                continue;
            }

            const data = await response.json();

            // Track remaining API requests
            const remaining = response.headers.get('x-requests-remaining');
            if (remaining) {
                await trackAPIUsage(parseInt(remaining));
            }

            // Process each game
            for (const game of data) {
                const processedGame = processGameOdds(game, sportKey);
                if (processedGame) {
                    allGames.push(processedGame);
                }
            }
        } catch (e) {
            console.error(`Error fetching ${sportKey}:`, e);
        }
    }

    // Sort by commence time
    allGames.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

    return allGames;
}

function processGameOdds(game, sportKey) {
    // Find preferred bookmaker
    const bookmaker = findPreferredBookmaker(game.bookmakers);
    if (!bookmaker) return null;

    // Extract odds from bookmaker
    const spreadMarket = bookmaker.markets?.find(m => m.key === 'spreads');
    const moneylineMarket = bookmaker.markets?.find(m => m.key === 'h2h');
    const totalMarket = bookmaker.markets?.find(m => m.key === 'totals');

    // Build odds object
    const odds = {};

    // Spread
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

    // Total (Over/Under)
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
        sport: SPORT_NAMES[sportKey] || sportKey,
        sportKey,
        commenceTime: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        bookmaker: formatBookmakerName(bookmaker.key),
        odds,
        lastUpdate: bookmaker.last_update || new Date().toISOString()
    };
}

function findPreferredBookmaker(bookmakers) {
    if (!bookmakers || bookmakers.length === 0) return null;

    for (const preferred of PREFERRED_BOOKMAKERS) {
        const found = bookmakers.find(b => b.key === preferred);
        if (found) return found;
    }

    // Return first available if no preferred found
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

async function getCachedOdds(cacheKey) {
    try {
        const cache = await getCollection('odds_cache');
        const cached = await cache.findOne({
            cacheKey,
            expiresAt: { $gt: new Date() }
        });
        return cached;
    } catch (e) {
        console.error('Cache read error:', e);
        return null;
    }
}

async function cacheOdds(cacheKey, games) {
    try {
        const cache = await getCollection('odds_cache');
        await cache.updateOne(
            { cacheKey },
            {
                $set: {
                    cacheKey,
                    games,
                    lastUpdated: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + CACHE_DURATION_MS),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch (e) {
        console.error('Cache write error:', e);
    }
}

async function getStaleCache(sport) {
    try {
        const cache = await getCollection('odds_cache');
        const stale = await cache.findOne(
            { cacheKey: { $regex: sport || '' } },
            { sort: { updatedAt: -1 } }
        );
        return stale;
    } catch (e) {
        return null;
    }
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

// Mock data for development/demo when API key not configured
function getMockOddsData(sportFilter) {
    const mockGames = [
        {
            id: 'mock-nfl-1',
            sport: 'NFL',
            sportKey: 'americanfootball_nfl',
            commenceTime: new Date(Date.now() + 86400000).toISOString(),
            homeTeam: 'Philadelphia Eagles',
            awayTeam: 'Dallas Cowboys',
            bookmaker: 'DraftKings',
            odds: {
                spread: { home: { point: -3.5, price: -110 }, away: { point: 3.5, price: -110 } },
                moneyline: { home: -175, away: 150 },
                total: { over: { point: 45.5, price: -110 }, under: { point: 45.5, price: -110 } }
            },
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'mock-nba-1',
            sport: 'NBA',
            sportKey: 'basketball_nba',
            commenceTime: new Date(Date.now() + 43200000).toISOString(),
            homeTeam: 'Philadelphia 76ers',
            awayTeam: 'Boston Celtics',
            bookmaker: 'DraftKings',
            odds: {
                spread: { home: { point: 2.5, price: -110 }, away: { point: -2.5, price: -110 } },
                moneyline: { home: 115, away: -135 },
                total: { over: { point: 218.5, price: -110 }, under: { point: 218.5, price: -110 } }
            },
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'mock-nhl-1',
            sport: 'NHL',
            sportKey: 'icehockey_nhl',
            commenceTime: new Date(Date.now() + 72000000).toISOString(),
            homeTeam: 'Philadelphia Flyers',
            awayTeam: 'New York Rangers',
            bookmaker: 'FanDuel',
            odds: {
                spread: { home: { point: 1.5, price: -180 }, away: { point: -1.5, price: 155 } },
                moneyline: { home: 145, away: -170 },
                total: { over: { point: 6.5, price: -115 }, under: { point: 6.5, price: -105 } }
            },
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'mock-mlb-1',
            sport: 'MLB',
            sportKey: 'baseball_mlb',
            commenceTime: new Date(Date.now() + 100000000).toISOString(),
            homeTeam: 'Philadelphia Phillies',
            awayTeam: 'New York Mets',
            bookmaker: 'DraftKings',
            odds: {
                spread: { home: { point: -1.5, price: 130 }, away: { point: 1.5, price: -150 } },
                moneyline: { home: -145, away: 125 },
                total: { over: { point: 8.5, price: -110 }, under: { point: 8.5, price: -110 } }
            },
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'mock-ncaaf-1',
            sport: 'NCAAF',
            sportKey: 'americanfootball_ncaaf',
            commenceTime: new Date(Date.now() + 150000000).toISOString(),
            homeTeam: 'Penn State Nittany Lions',
            awayTeam: 'Ohio State Buckeyes',
            bookmaker: 'BetMGM',
            odds: {
                spread: { home: { point: 7.5, price: -110 }, away: { point: -7.5, price: -110 } },
                moneyline: { home: 250, away: -310 },
                total: { over: { point: 52.5, price: -110 }, under: { point: 52.5, price: -110 } }
            },
            lastUpdate: new Date().toISOString()
        },
        {
            id: 'mock-ncaab-1',
            sport: 'NCAAB',
            sportKey: 'basketball_ncaab',
            commenceTime: new Date(Date.now() + 60000000).toISOString(),
            homeTeam: 'Villanova Wildcats',
            awayTeam: 'Duke Blue Devils',
            bookmaker: 'Caesars',
            odds: {
                spread: { home: { point: 4.5, price: -110 }, away: { point: -4.5, price: -110 } },
                moneyline: { home: 165, away: -195 },
                total: { over: { point: 142.5, price: -110 }, under: { point: 142.5, price: -110 } }
            },
            lastUpdate: new Date().toISOString()
        }
    ];

    if (sportFilter) {
        return mockGames.filter(g => g.sport === sportFilter.toUpperCase());
    }
    return mockGames;
}
