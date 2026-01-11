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
import { fetchAllScoreboards, findGameResult, SPORT_KEY_MAP } from '../lib/espn.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Optional: Add admin/cron auth check
    // For now, allow any POST request (can be called manually or via cron)

    try {
        const results = await scorePendingBets();
        return res.status(200).json({
            success: true,
            ...results
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
    const sportsNeeded = new Set();
    const datesNeeded = new Set();

    for (const bet of pendingBets) {
        if (bet.betType === 'single') {
            const sport = bet.sport || SPORT_KEY_MAP[bet.sportKey];
            if (sport) sportsNeeded.add(sport);
            if (bet.commenceTime) {
                datesNeeded.add(new Date(bet.commenceTime).toDateString());
            }
        } else if (bet.betType === 'parlay') {
            for (const leg of bet.legs) {
                const sport = leg.sport || SPORT_KEY_MAP[leg.sportKey];
                if (sport) sportsNeeded.add(sport);
                if (leg.commenceTime) {
                    datesNeeded.add(new Date(leg.commenceTime).toDateString());
                }
            }
        }
    }

    // Fetch scoreboards for needed sports
    const scoreboards = await fetchAllScoreboards(Array.from(sportsNeeded));

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

    // Award payout if won or push
    if (actualPayout > 0) {
        const description = outcome === 'won'
            ? `Won bet: ${bet.awayTeam} @ ${bet.homeTeam}`
            : `Push: ${bet.awayTeam} @ ${bet.homeTeam}`;

        await addCoins(
            bet.userId,
            actualPayout,
            outcome === 'won' ? 'bet_win' : 'bet_push',
            description,
            { betId: bet._id.toString() }
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

        // Award payout if parlay is fully settled with winnings
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
                { betId: bet._id.toString() }
            );
        }

        return parlayStatus !== 'pending';
    }

    return false;
}

export { scorePendingBets };
