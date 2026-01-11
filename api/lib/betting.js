// Betting utilities - odds conversion, payout calculation, bet evaluation

/**
 * Convert American odds to decimal odds
 * -110 -> 1.909 (bet $110 to win $100, total return $210)
 * +150 -> 2.50 (bet $100 to win $150, total return $250)
 */
export function americanToDecimal(americanOdds) {
    if (americanOdds > 0) {
        return (americanOdds / 100) + 1;
    } else {
        return (100 / Math.abs(americanOdds)) + 1;
    }
}

/**
 * Calculate payout for a single bet
 * Returns total payout including original wager
 */
export function calculatePayout(wagerAmount, americanOdds) {
    const decimalOdds = americanToDecimal(americanOdds);
    return Math.round(wagerAmount * decimalOdds * 100) / 100;
}

/**
 * Calculate profit (payout minus wager)
 */
export function calculateProfit(wagerAmount, americanOdds) {
    return calculatePayout(wagerAmount, americanOdds) - wagerAmount;
}

/**
 * Calculate parlay combined odds and payout
 * Multiplies decimal odds of all legs together
 */
export function calculateParlayPayout(wagerAmount, legs) {
    const combinedDecimalOdds = legs.reduce((acc, leg) => {
        return acc * americanToDecimal(leg.odds);
    }, 1);

    return {
        combinedOdds: Math.round(combinedDecimalOdds * 1000) / 1000,
        potentialPayout: Math.round(wagerAmount * combinedDecimalOdds * 100) / 100
    };
}

/**
 * Recalculate parlay payout excluding pushed legs
 */
export function recalculateParlayAfterPush(wagerAmount, legs) {
    const activeLegOdds = legs.filter(l => l.status === 'won');

    if (activeLegOdds.length === 0) {
        // All pushed - return original wager
        return { status: 'push', payout: wagerAmount };
    }

    if (activeLegOdds.length === 1) {
        // Single leg remaining - treat as single bet
        const payout = calculatePayout(wagerAmount, activeLegOdds[0].odds);
        return { status: 'partial', payout };
    }

    // Multiple legs remaining - recalculate parlay
    const { potentialPayout } = calculateParlayPayout(wagerAmount, activeLegOdds);
    return { status: 'partial', payout: potentialPayout };
}

/**
 * Evaluate spread bet outcome
 *
 * Spread betting: The favorite must win by more than the spread
 * Home -3.5: Home team must win by > 3.5 points
 * Away +3.5: Away team can lose by < 3.5 points (or win)
 *
 * @param {Object} selection - { side: 'home'|'away', point: -3.5 }
 * @param {Object} result - { homeScore: 28, awayScore: 24 }
 * @returns {string} 'won' | 'lost' | 'push'
 */
export function evaluateSpreadBet(selection, result) {
    const { side, point } = selection;
    const { homeScore, awayScore } = result;

    if (side === 'home') {
        // Home team with spread (e.g., -3.5)
        // Adjusted home score = homeScore + point (point is negative for favorites)
        const adjustedHomeScore = homeScore + point;
        if (adjustedHomeScore > awayScore) return 'won';
        if (adjustedHomeScore < awayScore) return 'lost';
        return 'push';
    } else {
        // Away team with spread (e.g., +3.5)
        // Adjusted away score = awayScore + point (point is positive for underdogs)
        const adjustedAwayScore = awayScore + point;
        if (adjustedAwayScore > homeScore) return 'won';
        if (adjustedAwayScore < homeScore) return 'lost';
        return 'push';
    }
}

/**
 * Evaluate moneyline bet outcome
 *
 * @param {Object} selection - { side: 'home'|'away' }
 * @param {Object} result - { homeScore: 28, awayScore: 24 }
 * @returns {string} 'won' | 'lost' | 'push'
 */
export function evaluateMoneylineBet(selection, result) {
    const { side } = selection;
    const { homeScore, awayScore } = result;

    // Tie = push (rare in most sports due to OT)
    if (homeScore === awayScore) {
        return 'push';
    }

    const homeWon = homeScore > awayScore;

    if (side === 'home') {
        return homeWon ? 'won' : 'lost';
    } else {
        return homeWon ? 'lost' : 'won';
    }
}

/**
 * Evaluate total (over/under) bet outcome
 *
 * @param {Object} selection - { side: 'over'|'under', point: 45.5 }
 * @param {Object} result - { homeScore: 28, awayScore: 24 }
 * @returns {string} 'won' | 'lost' | 'push'
 */
export function evaluateTotalBet(selection, result) {
    const { side, point } = selection;
    const { homeScore, awayScore } = result;
    const totalScore = homeScore + awayScore;

    if (side === 'over') {
        if (totalScore > point) return 'won';
        if (totalScore < point) return 'lost';
        return 'push';
    } else {
        if (totalScore < point) return 'won';
        if (totalScore > point) return 'lost';
        return 'push';
    }
}

/**
 * Evaluate any bet type
 *
 * @param {Object} selection - { type: 'spread'|'moneyline'|'total', side, point?, odds }
 * @param {Object} result - { homeScore, awayScore }
 * @returns {string} 'won' | 'lost' | 'push'
 */
export function evaluateBet(selection, result) {
    switch (selection.type) {
        case 'spread':
            return evaluateSpreadBet(selection, result);
        case 'moneyline':
            return evaluateMoneylineBet(selection, result);
        case 'total':
            return evaluateTotalBet(selection, result);
        default:
            throw new Error(`Unknown bet type: ${selection.type}`);
    }
}

/**
 * Format American odds for display
 * -110 -> "-110"
 * +150 -> "+150"
 */
export function formatOdds(odds) {
    if (odds > 0) {
        return `+${odds}`;
    }
    return String(odds);
}

/**
 * Format spread point for display
 * -3.5 -> "-3.5"
 * 3.5 -> "+3.5"
 * 0 -> "PK" (pick'em)
 */
export function formatPoint(point) {
    if (point === 0) return 'PK';
    if (point > 0) return `+${point}`;
    return String(point);
}

/**
 * Normalize team name for matching
 * "Philadelphia Eagles" -> "eagles"
 * "76ers" -> "76ers"
 */
export function normalizeTeamName(name) {
    if (!name) return '';
    // Extract last word (usually the team name) and lowercase
    const parts = name.toLowerCase().trim().split(/\s+/);
    return parts[parts.length - 1].replace(/[^a-z0-9]/g, '');
}

/**
 * Check if two team names match (fuzzy)
 */
export function teamsMatch(name1, name2) {
    const n1 = normalizeTeamName(name1);
    const n2 = normalizeTeamName(name2);
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}
