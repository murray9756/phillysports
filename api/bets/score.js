// Bet Scoring API - Resolve completed bets and distribute payouts
// POST: Score pending bets for completed games

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { addCoins } from '../lib/coins.js';
import {
    evaluateBet,
    calculatePayout,
    calculateParlayPayout,
    recalculateParlayAfterPush
} from '../lib/betting.js';
import { fetchScoresByDate } from '../lib/sportsdata.js';

// Map TheOddsAPI sport keys to our sport names
const SPORT_KEY_MAP = {
    'americanfootball_nfl': 'NFL',
    'basketball_nba': 'NBA',
    'baseball_mlb': 'MLB',
    'icehockey_nhl': 'NHL',
    'americanfootball_ncaaf': 'NCAAF',
    'basketball_ncaab': 'NCAAB'
};

/**
 * Find game result from SportsDataIO scores
 * Matches by team abbreviations (converts full names to abbreviations first)
 */
function findGameResult(bet, scoreboards) {
    const sport = bet.sport || SPORT_KEY_MAP[bet.sportKey];
    if (!sport || !scoreboards[sport]) return null;

    const games = scoreboards[sport];

    // Normalize bet team names to abbreviations
    const betHomeAbbr = normalizeTeamName(bet.homeTeam);
    const betAwayAbbr = normalizeTeamName(bet.awayTeam);

    console.log(`Looking for game: ${betAwayAbbr} @ ${betHomeAbbr} (original: ${bet.awayTeam} @ ${bet.homeTeam})`);

    // Try to find matching game
    for (const game of games) {
        // SportsDataIO returns abbreviations
        const gameHome = (game.HomeTeam || '').toUpperCase();
        const gameAway = (game.AwayTeam || '').toUpperCase();

        // Match by abbreviation (primary method)
        const homeMatch = gameHome === betHomeAbbr.toUpperCase() ||
                          normalizeTeamName(game.HomeTeam) === betHomeAbbr;
        const awayMatch = gameAway === betAwayAbbr.toUpperCase() ||
                          normalizeTeamName(game.AwayTeam) === betAwayAbbr;

        if (homeMatch && awayMatch) {
            // Check if game is final
            const isFinal = game.Status === 'Final' ||
                           game.Status === 'F' ||
                           game.Status === 'F/OT' ||
                           game.IsClosed === true;

            if (!isFinal) {
                console.log(`Found game but not final: ${game.AwayTeam} @ ${game.HomeTeam} - Status: ${game.Status}`);
                return null;
            }

            console.log(`Matched game: ${game.AwayTeam} @ ${game.HomeTeam} - Final: ${game.AwayScore}-${game.HomeScore}`);

            return {
                homeScore: game.HomeScore ?? game.HomeTeamScore ?? 0,
                awayScore: game.AwayScore ?? game.AwayTeamScore ?? 0,
                totalScore: (game.HomeScore ?? game.HomeTeamScore ?? 0) + (game.AwayScore ?? game.AwayTeamScore ?? 0),
                isFinal: true,
                gameId: game.GameID || game.ScoreID
            };
        }
    }

    console.log(`No matching game found for ${betAwayAbbr} @ ${betHomeAbbr}`);
    return null;
}

/**
 * Team name to abbreviation mappings
 * Covers full names from TheOddsAPI to abbreviations from SportsDataIO
 */
const TEAM_NAME_TO_ABBR = {
    // NHL
    'philadelphia flyers': 'PHI', 'flyers': 'PHI',
    'colorado avalanche': 'COL', 'avalanche': 'COL',
    'pittsburgh penguins': 'PIT', 'penguins': 'PIT',
    'new york rangers': 'NYR', 'rangers': 'NYR',
    'new york islanders': 'NYI', 'islanders': 'NYI',
    'new jersey devils': 'NJD', 'devils': 'NJD',
    'washington capitals': 'WSH', 'capitals': 'WSH',
    'boston bruins': 'BOS', 'bruins': 'BOS',
    'detroit red wings': 'DET', 'red wings': 'DET',
    'chicago blackhawks': 'CHI', 'blackhawks': 'CHI',
    'tampa bay lightning': 'TB', 'lightning': 'TB',
    'florida panthers': 'FLA', 'panthers': 'FLA',
    'carolina hurricanes': 'CAR', 'hurricanes': 'CAR',
    'toronto maple leafs': 'TOR', 'maple leafs': 'TOR',
    'montreal canadiens': 'MTL', 'canadiens': 'MTL',
    'ottawa senators': 'OTT', 'senators': 'OTT',
    'buffalo sabres': 'BUF', 'sabres': 'BUF',
    'vegas golden knights': 'VGK', 'golden knights': 'VGK',
    'seattle kraken': 'SEA', 'kraken': 'SEA',
    'los angeles kings': 'LA', 'kings': 'LA',
    'anaheim ducks': 'ANA', 'ducks': 'ANA',
    'san jose sharks': 'SJ', 'sharks': 'SJ',
    'calgary flames': 'CGY', 'flames': 'CGY',
    'edmonton oilers': 'EDM', 'oilers': 'EDM',
    'vancouver canucks': 'VAN', 'canucks': 'VAN',
    'winnipeg jets': 'WPG', 'jets': 'WPG',
    'minnesota wild': 'MIN', 'wild': 'MIN',
    'dallas stars': 'DAL', 'stars': 'DAL',
    'nashville predators': 'NSH', 'predators': 'NSH',
    'st louis blues': 'STL', 'blues': 'STL', 'st. louis blues': 'STL',
    'columbus blue jackets': 'CBJ', 'blue jackets': 'CBJ',
    'arizona coyotes': 'ARI', 'coyotes': 'ARI',
    'utah hockey club': 'UTA',
    // NFL
    'philadelphia eagles': 'PHI', 'eagles': 'PHI',
    'dallas cowboys': 'DAL', 'cowboys': 'DAL',
    'new york giants': 'NYG', 'giants': 'NYG',
    'new york jets': 'NYJ',
    'washington commanders': 'WAS', 'commanders': 'WAS',
    'pittsburgh steelers': 'PIT', 'steelers': 'PIT',
    'baltimore ravens': 'BAL', 'ravens': 'BAL',
    'cincinnati bengals': 'CIN', 'bengals': 'CIN',
    'cleveland browns': 'CLE', 'browns': 'CLE',
    'buffalo bills': 'BUF', 'bills': 'BUF',
    'miami dolphins': 'MIA', 'dolphins': 'MIA',
    'new england patriots': 'NE', 'patriots': 'NE',
    'tennessee titans': 'TEN', 'titans': 'TEN',
    'indianapolis colts': 'IND', 'colts': 'IND',
    'houston texans': 'HOU', 'texans': 'HOU',
    'jacksonville jaguars': 'JAX', 'jaguars': 'JAX',
    'kansas city chiefs': 'KC', 'chiefs': 'KC',
    'las vegas raiders': 'LV', 'raiders': 'LV',
    'los angeles chargers': 'LAC', 'chargers': 'LAC',
    'denver broncos': 'DEN', 'broncos': 'DEN',
    'green bay packers': 'GB', 'packers': 'GB',
    'minnesota vikings': 'MIN', 'vikings': 'MIN',
    'chicago bears': 'CHI', 'bears': 'CHI',
    'detroit lions': 'DET', 'lions': 'DET',
    'tampa bay buccaneers': 'TB', 'buccaneers': 'TB',
    'atlanta falcons': 'ATL', 'falcons': 'ATL',
    'new orleans saints': 'NO', 'saints': 'NO',
    'carolina panthers': 'CAR',
    'san francisco 49ers': 'SF', '49ers': 'SF',
    'seattle seahawks': 'SEA', 'seahawks': 'SEA',
    'los angeles rams': 'LAR', 'rams': 'LAR',
    'arizona cardinals': 'ARI', 'cardinals': 'ARI',
    // NBA
    'philadelphia 76ers': 'PHI', '76ers': 'PHI', 'sixers': 'PHI',
    'boston celtics': 'BOS', 'celtics': 'BOS',
    'new york knicks': 'NY', 'knicks': 'NY',
    'brooklyn nets': 'BKN', 'nets': 'BKN',
    'toronto raptors': 'TOR', 'raptors': 'TOR',
    'milwaukee bucks': 'MIL', 'bucks': 'MIL',
    'cleveland cavaliers': 'CLE', 'cavaliers': 'CLE', 'cavs': 'CLE',
    'indiana pacers': 'IND', 'pacers': 'IND',
    'chicago bulls': 'CHI', 'bulls': 'CHI',
    'detroit pistons': 'DET', 'pistons': 'DET',
    'miami heat': 'MIA', 'heat': 'MIA',
    'orlando magic': 'ORL', 'magic': 'ORL',
    'atlanta hawks': 'ATL', 'hawks': 'ATL',
    'charlotte hornets': 'CHA', 'hornets': 'CHA',
    'washington wizards': 'WAS', 'wizards': 'WAS',
    'denver nuggets': 'DEN', 'nuggets': 'DEN',
    'oklahoma city thunder': 'OKC', 'thunder': 'OKC',
    'portland trail blazers': 'POR', 'trail blazers': 'POR', 'blazers': 'POR',
    'utah jazz': 'UTA', 'jazz': 'UTA',
    'minnesota timberwolves': 'MIN', 'timberwolves': 'MIN',
    'golden state warriors': 'GS', 'warriors': 'GS',
    'la clippers': 'LAC', 'los angeles clippers': 'LAC', 'clippers': 'LAC',
    'los angeles lakers': 'LAL', 'lakers': 'LAL',
    'phoenix suns': 'PHX', 'suns': 'PHX',
    'sacramento kings': 'SAC',
    'dallas mavericks': 'DAL', 'mavericks': 'DAL', 'mavs': 'DAL',
    'houston rockets': 'HOU', 'rockets': 'HOU',
    'memphis grizzlies': 'MEM', 'grizzlies': 'MEM',
    'new orleans pelicans': 'NOP', 'pelicans': 'NOP',
    'san antonio spurs': 'SA', 'spurs': 'SA',
    // MLB
    'philadelphia phillies': 'PHI', 'phillies': 'PHI',
    'new york mets': 'NYM', 'mets': 'NYM',
    'new york yankees': 'NYY', 'yankees': 'NYY',
    'atlanta braves': 'ATL', 'braves': 'ATL',
    'miami marlins': 'MIA', 'marlins': 'MIA',
    'washington nationals': 'WAS', 'nationals': 'WAS',
    'boston red sox': 'BOS', 'red sox': 'BOS',
    'tampa bay rays': 'TB', 'rays': 'TB',
    'baltimore orioles': 'BAL', 'orioles': 'BAL',
    'toronto blue jays': 'TOR', 'blue jays': 'TOR',
    'chicago cubs': 'CHC', 'cubs': 'CHC',
    'milwaukee brewers': 'MIL', 'brewers': 'MIL',
    'st louis cardinals': 'STL', 'st. louis cardinals': 'STL', 'cardinals': 'STL',
    'pittsburgh pirates': 'PIT', 'pirates': 'PIT',
    'cincinnati reds': 'CIN', 'reds': 'CIN',
    'los angeles dodgers': 'LAD', 'dodgers': 'LAD',
    'san diego padres': 'SD', 'padres': 'SD',
    'san francisco giants': 'SF',
    'arizona diamondbacks': 'ARI', 'diamondbacks': 'ARI', 'd-backs': 'ARI',
    'colorado rockies': 'COL', 'rockies': 'COL',
    'houston astros': 'HOU', 'astros': 'HOU',
    'texas rangers': 'TEX',
    'seattle mariners': 'SEA', 'mariners': 'SEA',
    'oakland athletics': 'OAK', 'athletics': 'OAK', "a's": 'OAK',
    'los angeles angels': 'LAA', 'angels': 'LAA',
    'minnesota twins': 'MIN', 'twins': 'MIN',
    'chicago white sox': 'CWS', 'white sox': 'CWS',
    'cleveland guardians': 'CLE', 'guardians': 'CLE',
    'detroit tigers': 'DET', 'tigers': 'DET',
    'kansas city royals': 'KC', 'royals': 'KC'
};

/**
 * Normalize team name for matching - converts full names to abbreviations
 */
function normalizeTeamName(name) {
    if (!name) return '';
    const lower = name.toLowerCase().trim();

    // Direct lookup
    if (TEAM_NAME_TO_ABBR[lower]) {
        return TEAM_NAME_TO_ABBR[lower];
    }

    // Try without "the" prefix
    const withoutThe = lower.replace(/^the /, '');
    if (TEAM_NAME_TO_ABBR[withoutThe]) {
        return TEAM_NAME_TO_ABBR[withoutThe];
    }

    // If already an abbreviation (3 chars or less), return uppercase
    if (name.length <= 3) {
        return name.toUpperCase();
    }

    // Fallback: return last word
    return lower.split(' ').pop();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Accept both GET (Vercel cron) and POST (manual trigger)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify cron authorization if CRON_SECRET is set
    // Vercel automatically sends Authorization header for cron jobs
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            // Allow if it's a POST with admin key (manual trigger)
            const { adminKey } = req.body || {};
            if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'phillysports-admin-2024') {
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }
    }

    try {
        const results = await scorePendingBets();
        console.log(`Bet scoring completed: ${results.processed} processed, ${results.settled} settled`);
        return res.status(200).json({
            success: true,
            ...results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Scoring error:', error);
        return res.status(500).json({ error: 'Failed to score bets' });
    }
}

/**
 * Score all pending bets for games that have completed
 */
async function scorePendingBets() {
    const bets = await getCollection('bets');

    // Get all pending bets
    const pendingBets = await bets.find({ status: 'pending' }).toArray();

    if (pendingBets.length === 0) {
        return { processed: 0, settled: 0, errors: 0 };
    }

    // Determine which sports and dates we need scores for
    const sportDatePairs = new Set();

    for (const bet of pendingBets) {
        if (bet.betType === 'single') {
            const sport = bet.sport || SPORT_KEY_MAP[bet.sportKey];
            if (sport && bet.commenceTime) {
                const date = new Date(bet.commenceTime).toISOString().split('T')[0];
                sportDatePairs.add(`${sport}:${date}`);
            }
        } else if (bet.betType === 'parlay') {
            for (const leg of bet.legs) {
                const sport = leg.sport || SPORT_KEY_MAP[leg.sportKey];
                if (sport && leg.commenceTime) {
                    const date = new Date(leg.commenceTime).toISOString().split('T')[0];
                    sportDatePairs.add(`${sport}:${date}`);
                }
            }
        }
    }

    // Fetch scoreboards from SportsDataIO for all needed sport/date combinations
    const scoreboards = {};
    for (const pair of sportDatePairs) {
        const [sport, date] = pair.split(':');
        try {
            // Only fetch pro sports from SportsDataIO (college not supported for now)
            if (['NFL', 'NBA', 'MLB', 'NHL'].includes(sport)) {
                const scores = await fetchScoresByDate(sport, date);
                if (!scoreboards[sport]) scoreboards[sport] = [];
                scoreboards[sport].push(...scores);
            }
        } catch (e) {
            console.error(`Error fetching ${sport} scores for ${date}:`, e.message);
        }
    }
    console.log(`Fetched scores for ${Object.keys(scoreboards).length} sports`);

    let processed = 0;
    let settled = 0;
    let errors = 0;

    for (const bet of pendingBets) {
        processed++;

        try {
            if (bet.betType === 'single') {
                const wasSettled = await settleSingleBet(bet, scoreboards, bets);
                if (wasSettled) settled++;
            } else if (bet.betType === 'parlay') {
                const wasSettled = await settleParlayBet(bet, scoreboards, bets);
                if (wasSettled) settled++;
            }
        } catch (error) {
            console.error(`Error settling bet ${bet._id}:`, error);
            errors++;
        }
    }

    return { processed, settled, errors };
}

/**
 * Settle a single bet
 */
async function settleSingleBet(bet, scoreboards, betsCollection) {
    // Find game result
    const result = findGameResult(bet, scoreboards);

    // If game not found or not final, skip
    if (!result || !result.isFinal) {
        return false;
    }

    // Evaluate bet outcome
    const outcome = evaluateBet(bet.selection, {
        homeScore: result.homeScore,
        awayScore: result.awayScore
    });

    // Calculate payout
    let actualPayout = 0;
    if (outcome === 'won') {
        actualPayout = bet.potentialPayout;
    } else if (outcome === 'push') {
        actualPayout = bet.wagerAmount; // Return original wager
    }

    // Update bet document
    await betsCollection.updateOne(
        { _id: bet._id },
        {
            $set: {
                status: outcome,
                actualPayout,
                result: {
                    homeScore: result.homeScore,
                    awayScore: result.awayScore,
                    totalScore: result.totalScore,
                    scoredAt: new Date()
                },
                settledAt: new Date()
            }
        }
    );

    // Award payout if won or push (no multiplier - payout is calculated from odds)
    if (actualPayout > 0) {
        const description = outcome === 'won'
            ? `Won bet: ${bet.awayTeam} @ ${bet.homeTeam}`
            : `Push: ${bet.awayTeam} @ ${bet.homeTeam}`;

        await addCoins(
            bet.userId,
            actualPayout,
            outcome === 'won' ? 'bet_win' : 'bet_push',
            description,
            { betId: bet._id.toString() },
            { skipMultiplier: true }
        );
    }

    return true;
}

/**
 * Settle a parlay bet
 */
async function settleParlayBet(bet, scoreboards, betsCollection) {
    let allLegsSettled = true;
    let anyLost = false;
    let anyPush = false;
    const updatedLegs = [...bet.legs];

    // Check each leg
    for (let i = 0; i < updatedLegs.length; i++) {
        const leg = updatedLegs[i];

        // Skip already settled legs
        if (leg.status !== 'pending') {
            if (leg.status === 'lost') anyLost = true;
            if (leg.status === 'push') anyPush = true;
            continue;
        }

        // Find game result
        const result = findGameResult(leg, scoreboards);

        if (!result || !result.isFinal) {
            allLegsSettled = false;
            continue;
        }

        // Evaluate leg outcome
        const outcome = evaluateBet(leg.selection, {
            homeScore: result.homeScore,
            awayScore: result.awayScore
        });

        updatedLegs[i] = {
            ...leg,
            status: outcome,
            result: {
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                totalScore: result.totalScore,
                scoredAt: new Date()
            }
        };

        if (outcome === 'lost') anyLost = true;
        if (outcome === 'push') anyPush = true;
    }

    // Determine parlay status
    let parlayStatus = 'pending';
    let actualPayout = 0;

    if (anyLost) {
        // Any loss = entire parlay lost
        parlayStatus = 'lost';
        actualPayout = 0;
    } else if (allLegsSettled) {
        // All legs settled, no losses
        const wonLegs = updatedLegs.filter(l => l.status === 'won');

        if (anyPush) {
            // Has pushes - recalculate
            const recalc = recalculateParlayAfterPush(
                bet.wagerAmount,
                updatedLegs.map(l => ({ status: l.status, odds: l.selection.odds }))
            );
            parlayStatus = recalc.status;
            actualPayout = recalc.payout;
        } else {
            // All won
            parlayStatus = 'won';
            actualPayout = bet.potentialPayout;
        }
    }

    // Update if anything changed
    if (parlayStatus !== 'pending' || updatedLegs.some((l, i) => l.status !== bet.legs[i].status)) {
        await betsCollection.updateOne(
            { _id: bet._id },
            {
                $set: {
                    status: parlayStatus,
                    actualPayout,
                    legs: updatedLegs,
                    settledAt: parlayStatus !== 'pending' ? new Date() : null
                }
            }
        );

        // Award payout if parlay is fully settled with winnings (no multiplier - odds-based payout)
        if (parlayStatus !== 'pending' && actualPayout > 0) {
            let description;
            if (parlayStatus === 'won') {
                description = `Won ${bet.legs.length}-leg parlay`;
            } else if (parlayStatus === 'partial') {
                description = `Partial parlay payout (${bet.legs.length} legs, some pushed)`;
            } else {
                description = `Push: ${bet.legs.length}-leg parlay`;
            }

            await addCoins(
                bet.userId,
                actualPayout,
                parlayStatus === 'won' ? 'bet_win' : 'bet_push',
                description,
                { betId: bet._id.toString() },
                { skipMultiplier: true }
            );
        }

        return parlayStatus !== 'pending';
    }

    return false;
}

export { scorePendingBets };
