// Admin Bets Management
// GET: List bets with filters
// POST: Manual actions - score, settle
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { addCoins } from '../../lib/coins.js';
import { fetchScoresByDate } from '../../lib/sportsdata.js';
import { evaluateBet, calculatePayout, recalculateParlayAfterPush } from '../../lib/betting.js';

// Team name mappings for better matching
const TEAM_MAPPINGS = {
    // NHL
    'philadelphia flyers': { abbr: 'PHI', short: 'Flyers' },
    'colorado avalanche': { abbr: 'COL', short: 'Avalanche' },
    'pittsburgh penguins': { abbr: 'PIT', short: 'Penguins' },
    'new york rangers': { abbr: 'NYR', short: 'Rangers' },
    'new york islanders': { abbr: 'NYI', short: 'Islanders' },
    'new jersey devils': { abbr: 'NJD', short: 'Devils' },
    'washington capitals': { abbr: 'WSH', short: 'Capitals' },
    'boston bruins': { abbr: 'BOS', short: 'Bruins' },
    'detroit red wings': { abbr: 'DET', short: 'Red Wings' },
    'chicago blackhawks': { abbr: 'CHI', short: 'Blackhawks' },
    'tampa bay lightning': { abbr: 'TB', short: 'Lightning' },
    'florida panthers': { abbr: 'FLA', short: 'Panthers' },
    'carolina hurricanes': { abbr: 'CAR', short: 'Hurricanes' },
    'toronto maple leafs': { abbr: 'TOR', short: 'Maple Leafs' },
    'montreal canadiens': { abbr: 'MTL', short: 'Canadiens' },
    'ottawa senators': { abbr: 'OTT', short: 'Senators' },
    'buffalo sabres': { abbr: 'BUF', short: 'Sabres' },
    'vegas golden knights': { abbr: 'VGK', short: 'Golden Knights' },
    'seattle kraken': { abbr: 'SEA', short: 'Kraken' },
    'los angeles kings': { abbr: 'LA', short: 'Kings' },
    'anaheim ducks': { abbr: 'ANA', short: 'Ducks' },
    'san jose sharks': { abbr: 'SJ', short: 'Sharks' },
    'calgary flames': { abbr: 'CGY', short: 'Flames' },
    'edmonton oilers': { abbr: 'EDM', short: 'Oilers' },
    'vancouver canucks': { abbr: 'VAN', short: 'Canucks' },
    'winnipeg jets': { abbr: 'WPG', short: 'Jets' },
    'minnesota wild': { abbr: 'MIN', short: 'Wild' },
    'dallas stars': { abbr: 'DAL', short: 'Stars' },
    'nashville predators': { abbr: 'NSH', short: 'Predators' },
    'st louis blues': { abbr: 'STL', short: 'Blues' },
    'columbus blue jackets': { abbr: 'CBJ', short: 'Blue Jackets' },
    'arizona coyotes': { abbr: 'ARI', short: 'Coyotes' },
    'utah hockey club': { abbr: 'UTA', short: 'Hockey Club' },

    // NFL
    'philadelphia eagles': { abbr: 'PHI', short: 'Eagles' },
    'dallas cowboys': { abbr: 'DAL', short: 'Cowboys' },
    'new york giants': { abbr: 'NYG', short: 'Giants' },
    'washington commanders': { abbr: 'WAS', short: 'Commanders' },

    // NBA
    'philadelphia 76ers': { abbr: 'PHI', short: '76ers' },
    'boston celtics': { abbr: 'BOS', short: 'Celtics' },
    'new york knicks': { abbr: 'NY', short: 'Knicks' },
    'brooklyn nets': { abbr: 'BKN', short: 'Nets' },

    // MLB
    'philadelphia phillies': { abbr: 'PHI', short: 'Phillies' },
    'new york mets': { abbr: 'NYM', short: 'Mets' },
    'atlanta braves': { abbr: 'ATL', short: 'Braves' }
};

function normalizeTeamForMatching(name) {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    const mapping = TEAM_MAPPINGS[lower];
    if (mapping) return mapping.abbr;
    // Return the last word as a fallback (e.g., "Flyers" from "Philadelphia Flyers")
    return lower.split(' ').pop();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const betsCollection = await getCollection('bets');

        // GET - List bets
        if (req.method === 'GET') {
            const { status, sport, userId, limit = 50 } = req.query;

            const query = {};
            if (status) query.status = status;
            if (sport) query.sport = sport;
            if (userId && ObjectId.isValid(userId)) query.userId = new ObjectId(userId);

            const bets = await betsCollection
                .find(query)
                .sort({ placedAt: -1 })
                .limit(parseInt(limit))
                .toArray();

            // Summary
            const summary = {
                pending: await betsCollection.countDocuments({ status: 'pending' }),
                won: await betsCollection.countDocuments({ status: 'won' }),
                lost: await betsCollection.countDocuments({ status: 'lost' }),
                push: await betsCollection.countDocuments({ status: 'push' })
            };

            return res.status(200).json({
                success: true,
                bets: bets.map(b => ({
                    ...b,
                    _id: b._id.toString(),
                    userId: b.userId.toString()
                })),
                count: bets.length,
                summary
            });
        }

        // POST - Admin actions
        if (req.method === 'POST') {
            const { action, betId, outcome, homeScore, awayScore } = req.body;

            if (!betId || !ObjectId.isValid(betId)) {
                return res.status(400).json({ error: 'Invalid bet ID' });
            }

            const bet = await betsCollection.findOne({ _id: new ObjectId(betId) });
            if (!bet) {
                return res.status(404).json({ error: 'Bet not found' });
            }

            if (action === 'view') {
                // Just return bet details with debug info
                return res.status(200).json({
                    success: true,
                    bet: {
                        ...bet,
                        _id: bet._id.toString(),
                        userId: bet.userId.toString()
                    },
                    debug: {
                        homeTeamNormalized: normalizeTeamForMatching(bet.homeTeam),
                        awayTeamNormalized: normalizeTeamForMatching(bet.awayTeam),
                        commenceDate: bet.commenceTime ? new Date(bet.commenceTime).toISOString().split('T')[0] : null
                    }
                });
            }

            if (action === 'rescore') {
                // Try to fetch scores and rescore
                if (bet.status !== 'pending') {
                    return res.status(400).json({ error: 'Bet already settled' });
                }

                const sport = bet.sport;
                const date = bet.commenceTime ? new Date(bet.commenceTime).toISOString().split('T')[0] : null;

                if (!sport || !date) {
                    return res.status(400).json({ error: 'Missing sport or date info on bet' });
                }

                try {
                    const scores = await fetchScoresByDate(sport, date);
                    console.log(`Fetched ${scores.length} ${sport} scores for ${date}`);

                    // Try to find matching game
                    const homeNorm = normalizeTeamForMatching(bet.homeTeam);
                    const awayNorm = normalizeTeamForMatching(bet.awayTeam);

                    let matchedGame = null;
                    for (const game of scores) {
                        const gameHome = (game.HomeTeam || '').toUpperCase();
                        const gameAway = (game.AwayTeam || '').toUpperCase();

                        if ((gameHome === homeNorm.toUpperCase() || gameHome.includes(homeNorm.toUpperCase())) &&
                            (gameAway === awayNorm.toUpperCase() || gameAway.includes(awayNorm.toUpperCase()))) {
                            matchedGame = game;
                            break;
                        }
                    }

                    if (!matchedGame) {
                        return res.status(400).json({
                            error: 'Could not find matching game',
                            debug: {
                                searchingFor: { home: homeNorm, away: awayNorm },
                                gamesFound: scores.map(g => ({ home: g.HomeTeam, away: g.AwayTeam, status: g.Status }))
                            }
                        });
                    }

                    const isFinal = matchedGame.Status === 'Final' || matchedGame.Status === 'F' ||
                                    matchedGame.Status === 'F/OT' || matchedGame.IsClosed === true;

                    if (!isFinal) {
                        return res.status(400).json({
                            error: 'Game not yet final',
                            game: { home: matchedGame.HomeTeam, away: matchedGame.AwayTeam, status: matchedGame.Status }
                        });
                    }

                    // Score the bet
                    const result = {
                        homeScore: matchedGame.HomeScore ?? matchedGame.HomeTeamScore ?? 0,
                        awayScore: matchedGame.AwayScore ?? matchedGame.AwayTeamScore ?? 0
                    };

                    const betOutcome = evaluateBet(bet.selection, result);
                    let actualPayout = 0;

                    if (betOutcome === 'won') {
                        actualPayout = bet.potentialPayout;
                    } else if (betOutcome === 'push') {
                        actualPayout = bet.wagerAmount;
                    }

                    await betsCollection.updateOne(
                        { _id: bet._id },
                        {
                            $set: {
                                status: betOutcome,
                                actualPayout,
                                result: {
                                    homeScore: result.homeScore,
                                    awayScore: result.awayScore,
                                    totalScore: result.homeScore + result.awayScore,
                                    scoredAt: new Date()
                                },
                                settledAt: new Date()
                            }
                        }
                    );

                    if (actualPayout > 0) {
                        const desc = betOutcome === 'won'
                            ? `Won bet: ${bet.awayTeam} @ ${bet.homeTeam}`
                            : `Push: ${bet.awayTeam} @ ${bet.homeTeam}`;

                        await addCoins(
                            bet.userId,
                            actualPayout,
                            betOutcome === 'won' ? 'bet_win' : 'bet_push',
                            desc,
                            { betId: bet._id.toString() },
                            { skipMultiplier: true }
                        );
                    }

                    return res.status(200).json({
                        success: true,
                        action: 'rescore',
                        outcome: betOutcome,
                        result,
                        payout: actualPayout
                    });
                } catch (error) {
                    return res.status(500).json({ error: `Failed to fetch scores: ${error.message}` });
                }
            }

            if (action === 'manual_settle') {
                // Manually settle with provided outcome
                if (bet.status !== 'pending') {
                    return res.status(400).json({ error: 'Bet already settled' });
                }

                if (!outcome || !['won', 'lost', 'push'].includes(outcome)) {
                    return res.status(400).json({ error: 'Invalid outcome. Use: won, lost, or push' });
                }

                let actualPayout = 0;
                if (outcome === 'won') {
                    actualPayout = bet.potentialPayout;
                } else if (outcome === 'push') {
                    actualPayout = bet.wagerAmount;
                }

                const resultData = {
                    homeScore: homeScore ?? null,
                    awayScore: awayScore ?? null,
                    totalScore: (homeScore != null && awayScore != null) ? homeScore + awayScore : null,
                    manuallySettled: true,
                    scoredAt: new Date()
                };

                await betsCollection.updateOne(
                    { _id: bet._id },
                    {
                        $set: {
                            status: outcome,
                            actualPayout,
                            result: resultData,
                            settledAt: new Date()
                        }
                    }
                );

                if (actualPayout > 0) {
                    const desc = outcome === 'won'
                        ? `Won bet: ${bet.awayTeam} @ ${bet.homeTeam}`
                        : `Push: ${bet.awayTeam} @ ${bet.homeTeam}`;

                    await addCoins(
                        bet.userId,
                        actualPayout,
                        outcome === 'won' ? 'bet_win' : 'bet_push',
                        desc,
                        { betId: bet._id.toString() },
                        { skipMultiplier: true }
                    );
                }

                return res.status(200).json({
                    success: true,
                    action: 'manual_settle',
                    outcome,
                    payout: actualPayout
                });
            }

            if (action === 'trigger_scoring') {
                // Trigger the scoring cron manually
                const { scorePendingBets } = await import('../../bets/score.js');
                const results = await scorePendingBets();

                return res.status(200).json({
                    success: true,
                    action: 'trigger_scoring',
                    ...results
                });
            }

            return res.status(400).json({ error: 'Invalid action. Use: view, rescore, manual_settle, or trigger_scoring' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin bets error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
