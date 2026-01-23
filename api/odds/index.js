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

// TheOddsAPI sport keys for all sports (used as fallback for pro sports)
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
    const targetDate = date || new Date().toISOString().split('T')[0];

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
            // Fetch all sports - filter to Philly teams only
            const [proGames, collegeGames] = await Promise.all([
                fetchProSportsOdds(team, targetDate, true),  // phillyOnly=true
                fetchCollegeSportsOdds()
            ]);
            games = [...proGames, ...collegeGames];
        } else if (PRO_SPORTS.includes(sportUpper)) {
            // Specific pro sport selected - show all games for that sport
            games = await fetchSportsDataOdds(sportUpper, team, targetDate, false);  // phillyOnly=false
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
async function fetchProSportsOdds(team, targetDate, phillyOnly = true) {
    const allGames = [];
    for (const sport of PRO_SPORTS) {
        try {
            const games = await fetchSportsDataOdds(sport, team, targetDate, phillyOnly);
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

// Fetch odds for pro sports - tries SportsDataIO first, falls back to TheOddsAPI
async function fetchSportsDataOdds(sport, team, targetDate, phillyOnly = true) {
    // Try SportsDataIO first
    let games = await fetchFromSportsDataIO(sport, team, targetDate, phillyOnly);

    // If no results from SportsDataIO, fall back to TheOddsAPI
    if (games.length === 0 && ODDS_API_KEY) {
        console.log(`SportsDataIO returned no ${sport} odds, trying TheOddsAPI fallback`);
        games = await fetchTheOddsAPIData(sport, phillyOnly);
    }

    return games;
}

// Fetch from SportsDataIO (primary source for pro sports)
async function fetchFromSportsDataIO(sport, team, targetDate, phillyOnly = true) {
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

    const dateToUse = targetDate || new Date().toISOString().split('T')[0];

    // Get current week for NFL, target date for others
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
        url = `https://api.sportsdata.io/v3/${endpoint}/odds/json/GameOddsByDate/${dateToUse}?key=${SPORTSDATA_API_KEY}`;
    }

    console.log(`Fetching ${sport} odds from SportsDataIO: ${url.replace(SPORTSDATA_API_KEY, 'XXX')}`);

    const response = await fetch(url);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`SportsDataIO odds fetch failed for ${sport}: ${response.status} - ${errorText}`);
        return [];
    }

    let games = await response.json();
    console.log(`SportsDataIO ${sport} odds response: ${games.length} games found`);

    // Debug: log first game structure to see field names
    if (games.length > 0) {
        const firstGame = games[0];
        console.log(`SportsDataIO ${sport} first game fields:`, Object.keys(firstGame).join(', '));
        console.log(`SportsDataIO ${sport} HomeTeam value:`, firstGame.HomeTeam, '| AwayTeam:', firstGame.AwayTeam);
        console.log(`SportsDataIO ${sport} HomeTeamName value:`, firstGame.HomeTeamName, '| AwayTeamName:', firstGame.AwayTeamName);
    }

    // Filter by team if specified
    if (team) {
        const teamUpper = team.toUpperCase();
        games = games.filter(g =>
            g.HomeTeam?.toUpperCase() === teamUpper ||
            g.AwayTeam?.toUpperCase() === teamUpper
        );
    } else if (phillyOnly) {
        // Filter to Philly teams when viewing "all sports"
        games = games.filter(g =>
            g.HomeTeam === 'PHI' || g.AwayTeam === 'PHI'
        );
    }
    // If phillyOnly is false and no team specified, return all games

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
        homeTeam: game.HomeTeam || game.HomeTeamName || game.Home || 'Home',
        awayTeam: game.AwayTeam || game.AwayTeamName || game.Away || 'Away',
        bookmaker: consensus.Sportsbook || 'Consensus',
        odds: Object.keys(odds).length > 0 ? odds : null,
        status: game.Status,
        lastUpdate: new Date().toISOString(),
        source: 'sportsdata'
    };
}

// Fetch odds from TheOddsAPI (all sports)
async function fetchTheOddsAPIData(sport, phillyOnly = false) {
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

    // Filter to Philly teams if requested (for pro sports)
    if (phillyOnly && PRO_SPORTS.includes(sport)) {
        const phillyTeams = {
            NFL: ['Philadelphia Eagles', 'Eagles'],
            NBA: ['Philadelphia 76ers', '76ers', 'Sixers'],
            MLB: ['Philadelphia Phillies', 'Phillies'],
            NHL: ['Philadelphia Flyers', 'Flyers']
        };
        const teamNames = phillyTeams[sport] || [];
        data = data.filter(game =>
            teamNames.some(name =>
                game.home_team?.includes(name) || game.away_team?.includes(name)
            )
        );
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
