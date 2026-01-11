// Bets API - Place and list bets
// POST: Place a new bet (single or parlay)
// GET: List user's bets with filters

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { verifyToken, getTokenFromRequest } from '../lib/auth.js';
import { spendCoins } from '../lib/coins.js';
import {
    calculatePayout,
    calculateParlayPayout,
    americanToDecimal
} from '../lib/betting.js';
import { hasGameStarted } from '../lib/espn.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Authenticate user
    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = new ObjectId(decoded.userId);

    if (req.method === 'POST') {
        return handlePlaceBet(req, res, userId);
    } else if (req.method === 'GET') {
        return handleListBets(req, res, userId);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handlePlaceBet(req, res, userId) {
    try {
        const { betType, wagerAmount } = req.body;

        // Validate wager amount
        if (!wagerAmount || wagerAmount <= 0) {
            return res.status(400).json({ error: 'Invalid wager amount' });
        }

        // Round to whole number
        const wager = Math.floor(wagerAmount);

        if (betType === 'single') {
            return handleSingleBet(req, res, userId, wager);
        } else if (betType === 'parlay') {
            return handleParlayBet(req, res, userId, wager);
        }

        return res.status(400).json({ error: 'Invalid bet type. Must be "single" or "parlay"' });
    } catch (error) {
        console.error('Place bet error:', error);
        return res.status(500).json({ error: error.message || 'Failed to place bet' });
    }
}

async function handleSingleBet(req, res, userId, wagerAmount) {
    const {
        gameId,
        sport,
        sportKey,
        homeTeam,
        awayTeam,
        commenceTime,
        selection,
        oddsSource
    } = req.body;

    // Validate required fields
    if (!gameId || !homeTeam || !awayTeam || !commenceTime || !selection) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate selection
    if (!selection.type || !selection.side || selection.odds === undefined) {
        return res.status(400).json({ error: 'Invalid selection' });
    }

    // Check if game has started
    if (hasGameStarted(commenceTime)) {
        return res.status(400).json({ error: 'Cannot bet on a game that has already started' });
    }

    // Calculate potential payout
    const potentialPayout = calculatePayout(wagerAmount, selection.odds);

    // Deduct wager from balance
    let newBalance;
    try {
        newBalance = await spendCoins(
            userId,
            wagerAmount,
            'bet_wager',
            `Bet on ${awayTeam} @ ${homeTeam}`,
            { gameId, betType: 'single' }
        );
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    // Create bet document
    const bets = await getCollection('bets');
    const bet = {
        userId,
        betType: 'single',
        gameId,
        sport: sport || sportKey?.split('_')[1]?.toUpperCase(),
        sportKey,
        homeTeam,
        awayTeam,
        commenceTime: new Date(commenceTime),
        selection: {
            type: selection.type,
            side: selection.side,
            point: selection.point || null,
            odds: selection.odds
        },
        wagerAmount,
        potentialPayout,
        actualPayout: 0,
        status: 'pending',
        result: null,
        oddsSource: oddsSource || 'unknown',
        placedAt: new Date(),
        settledAt: null
    };

    const result = await bets.insertOne(bet);

    return res.status(201).json({
        success: true,
        bet: { ...bet, _id: result.insertedId },
        potentialPayout,
        newBalance
    });
}

async function handleParlayBet(req, res, userId, wagerAmount) {
    const { legs, oddsSource } = req.body;

    // Validate legs
    if (!legs || !Array.isArray(legs)) {
        return res.status(400).json({ error: 'Parlay requires legs array' });
    }

    if (legs.length < 2) {
        return res.status(400).json({ error: 'Parlay must have at least 2 legs' });
    }

    if (legs.length > 10) {
        return res.status(400).json({ error: 'Parlay cannot exceed 10 legs' });
    }

    // Check for duplicate games
    const gameIds = legs.map(l => l.gameId);
    if (new Set(gameIds).size !== gameIds.length) {
        return res.status(400).json({ error: 'Parlay cannot contain duplicate games' });
    }

    // Validate each leg and check if games have started
    for (const leg of legs) {
        if (!leg.gameId || !leg.homeTeam || !leg.awayTeam || !leg.commenceTime || !leg.selection) {
            return res.status(400).json({ error: 'Each leg must have gameId, teams, commenceTime, and selection' });
        }

        if (!leg.selection.type || !leg.selection.side || leg.selection.odds === undefined) {
            return res.status(400).json({ error: 'Each leg must have valid selection with type, side, and odds' });
        }

        if (hasGameStarted(leg.commenceTime)) {
            return res.status(400).json({
                error: `Cannot include ${leg.awayTeam} @ ${leg.homeTeam} - game has already started`
            });
        }
    }

    // Calculate parlay odds and payout
    const { combinedOdds, potentialPayout } = calculateParlayPayout(
        wagerAmount,
        legs.map(l => ({ odds: l.selection.odds }))
    );

    // Deduct wager from balance
    let newBalance;
    try {
        newBalance = await spendCoins(
            userId,
            wagerAmount,
            'bet_wager',
            `${legs.length}-leg parlay`,
            { betType: 'parlay', legCount: legs.length }
        );
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    // Create bet document
    const bets = await getCollection('bets');
    const bet = {
        userId,
        betType: 'parlay',
        legs: legs.map(leg => ({
            gameId: leg.gameId,
            sport: leg.sport || leg.sportKey?.split('_')[1]?.toUpperCase(),
            sportKey: leg.sportKey,
            homeTeam: leg.homeTeam,
            awayTeam: leg.awayTeam,
            commenceTime: new Date(leg.commenceTime),
            selection: {
                type: leg.selection.type,
                side: leg.selection.side,
                point: leg.selection.point || null,
                odds: leg.selection.odds
            },
            status: 'pending',
            result: null
        })),
        combinedOdds,
        wagerAmount,
        potentialPayout,
        actualPayout: 0,
        status: 'pending',
        oddsSource: oddsSource || 'unknown',
        placedAt: new Date(),
        settledAt: null
    };

    const result = await bets.insertOne(bet);

    return res.status(201).json({
        success: true,
        bet: { ...bet, _id: result.insertedId },
        potentialPayout,
        combinedOdds,
        newBalance
    });
}

async function handleListBets(req, res, userId) {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        const bets = await getCollection('bets');

        // Build query
        const query = { userId };
        if (status && status !== 'all') {
            query.status = status;
        }

        // Fetch bets
        const betsList = await bets.find(query)
            .sort({ placedAt: -1 })
            .skip(parseInt(offset))
            .limit(Math.min(parseInt(limit), 100))
            .toArray();

        // Get total count
        const total = await bets.countDocuments(query);

        // Calculate summary stats
        const summaryPipeline = [
            { $match: { userId } },
            {
                $group: {
                    _id: null,
                    totalWagered: { $sum: '$wagerAmount' },
                    totalWon: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'won'] }, '$actualPayout', 0]
                        }
                    },
                    totalPartial: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'partial'] }, '$actualPayout', 0]
                        }
                    },
                    totalPush: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'push'] }, '$wagerAmount', 0]
                        }
                    },
                    pendingCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    wonCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] }
                    },
                    lostCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] }
                    },
                    pushCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'push'] }, 1, 0] }
                    },
                    totalBets: { $sum: 1 }
                }
            }
        ];

        const summaryResult = await bets.aggregate(summaryPipeline).toArray();
        const summary = summaryResult[0] || {
            totalWagered: 0,
            totalWon: 0,
            pendingCount: 0,
            wonCount: 0,
            lostCount: 0,
            pushCount: 0,
            totalBets: 0
        };

        // Calculate win rate (excluding pending and push)
        const resolvedBets = summary.wonCount + summary.lostCount;
        const winRate = resolvedBets > 0
            ? Math.round((summary.wonCount / resolvedBets) * 100) / 100
            : 0;

        return res.status(200).json({
            success: true,
            bets: betsList.map(b => ({
                ...b,
                _id: b._id.toString(),
                userId: b.userId.toString()
            })),
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + betsList.length < total
            },
            summary: {
                ...summary,
                winRate,
                netProfit: (summary.totalWon + summary.totalPartial + summary.totalPush) - summary.totalWagered
            }
        });
    } catch (error) {
        console.error('List bets error:', error);
        return res.status(500).json({ error: 'Failed to fetch bets' });
    }
}
