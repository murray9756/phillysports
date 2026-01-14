// Bot Manager - AI player management for poker games
// Handles bot creation, bot actions, and auto-play logic

import { getCollection } from '../mongodb.js';
import { ObjectId } from 'mongodb';

export const BOT_NAMES = [
    'PokerBot_Phil', 'CardShark_AI', 'BluffMaster3000', 'ChipStacker',
    'RiverRat_Bot', 'AllIn_Andy', 'FoldEmFrank', 'BettyBets',
    'CallStation_Cal', 'RaiseRicky', 'CheckChuck', 'LuckyLouie',
    'AceHunter', 'PotCommitted', 'NittyNate', 'AggroAnnie'
];

/**
 * Get or create a bot user
 * @param {string} preferredName - Optional preferred bot name
 * @returns {Object} Bot user document
 */
export async function getOrCreateBot(preferredName = null) {
    const users = await getCollection('users');

    // Generate unique bot name
    const baseName = preferredName || BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const botName = baseName + '_' + Date.now().toString(36).slice(-4);

    // Create new bot user
    const botUser = {
        email: `${botName.toLowerCase()}@bot.phillysports.com`,
        username: botName,
        displayName: baseName.replace(/_/g, ' '),
        password: 'bot_password_not_used',
        isBot: true,
        coinBalance: 100000, // Bots have unlimited funds essentially
        lifetimeCoins: 100000,
        badges: ['bot'],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await users.insertOne(botUser);
    return { ...botUser, _id: result.insertedId };
}

/**
 * Add a bot to a cash table
 * @param {string} tableId - Cash table ID
 * @returns {Object} Result with bot info
 */
export async function addBotToCashTable(tableId) {
    const cashTables = await getCollection('cash_tables');

    const table = await cashTables.findOne({ _id: new ObjectId(tableId) });
    if (!table) {
        throw new Error('Table not found');
    }

    // Find open seat
    const openSeatIndex = table.seats.findIndex(s => !s.playerId);
    if (openSeatIndex === -1) {
        throw new Error('Table is full');
    }

    // Get or create a bot
    const bot = await getOrCreateBot();
    const buyIn = table.buyIn || 1000;

    // Seat the bot
    const seatUpdate = {
        position: openSeatIndex,
        playerId: bot._id,
        username: bot.displayName || bot.username,
        chipStack: buyIn,
        isActive: true,
        isSittingOut: false,
        cards: [],
        currentBet: 0,
        joinedAt: new Date(),
        isBot: true
    };

    await cashTables.updateOne(
        { _id: new ObjectId(tableId) },
        {
            $set: {
                [`seats.${openSeatIndex}`]: seatUpdate,
                updatedAt: new Date()
            }
        }
    );

    return {
        success: true,
        bot: {
            odUserId: bot._id,
            odUsername: bot.displayName || bot.username,
            odPosition: openSeatIndex,
            odChipStack: buyIn
        }
    };
}

/**
 * Evaluate preflop hand strength (0-1 scale)
 */
function evaluatePreflopStrength(holeCards) {
    if (!holeCards || holeCards.length !== 2) return 0.3;

    const card1 = holeCards[0];
    const card2 = holeCards[1];
    const rank1 = card1.slice(0, -1);
    const rank2 = card2.slice(0, -1);
    const suit1 = card1.slice(-1);
    const suit2 = card2.slice(-1);

    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const val1 = rankValues[rank1] || 5;
    const val2 = rankValues[rank2] || 5;
    const highCard = Math.max(val1, val2);
    const lowCard = Math.min(val1, val2);

    const isPair = rank1 === rank2;
    const isSuited = suit1 === suit2;
    const gap = highCard - lowCard;
    const isConnected = gap === 1;
    const isOneGap = gap === 2;

    let strength = 0;

    // Pairs
    if (isPair) {
        strength = 0.5 + (val1 / 14) * 0.5; // AA = 1.0, 22 = 0.57
    } else {
        // High card value
        strength = (highCard + lowCard) / 28 * 0.5; // Base strength from card values

        // Suited bonus
        if (isSuited) strength += 0.08;

        // Connectivity bonus
        if (isConnected) strength += 0.06;
        else if (isOneGap) strength += 0.03;

        // Premium hands bonus
        if (highCard === 14) { // Ace high
            strength += 0.1;
            if (lowCard >= 10) strength += 0.1; // AT+
        }
        if (highCard === 13 && lowCard >= 10) strength += 0.08; // KT+
    }

    return Math.min(1, Math.max(0, strength));
}

/**
 * Evaluate postflop hand strength based on community cards
 */
function evaluatePostflopStrength(holeCards, communityCards) {
    if (!holeCards || holeCards.length !== 2) return 0.3;
    if (!communityCards || communityCards.length === 0) return evaluatePreflopStrength(holeCards);

    const allCards = [...holeCards, ...communityCards];
    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

    // Extract ranks and suits
    const ranks = allCards.map(c => rankValues[c.slice(0, -1)] || 5);
    const suits = allCards.map(c => c.slice(-1));
    const holeRanks = holeCards.map(c => rankValues[c.slice(0, -1)] || 5);

    // Count rank occurrences
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);

    // Count suit occurrences
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);

    let strength = 0.2; // Base

    // Check for pairs, trips, etc using hole cards
    const maxRankCount = Math.max(...Object.values(rankCounts));
    const pairCount = Object.values(rankCounts).filter(c => c >= 2).length;

    // Do we have a pair using our hole cards?
    const holeCardsUsed = holeRanks.some(hr => rankCounts[hr] >= 2);

    if (maxRankCount >= 4 && holeCardsUsed) strength = 0.95; // Quads
    else if (maxRankCount === 3 && pairCount >= 2 && holeCardsUsed) strength = 0.9; // Full house
    else if (Math.max(...Object.values(suitCounts)) >= 5) {
        // Possible flush - check if we contribute
        const flushSuit = Object.entries(suitCounts).find(([s, c]) => c >= 5)?.[0];
        const holeSuitsMatch = holeCards.filter(c => c.slice(-1) === flushSuit).length;
        if (holeSuitsMatch >= 1) strength = 0.85;
        else strength = 0.3; // Board flush, we don't have it
    }
    else if (maxRankCount === 3 && holeCardsUsed) strength = 0.75; // Trips
    else if (pairCount >= 2 && holeCardsUsed) strength = 0.65; // Two pair
    else if (maxRankCount === 2 && holeCardsUsed) {
        // One pair - strength depends on pair rank
        const pairRank = Object.entries(rankCounts).find(([r, c]) => c === 2)?.[0];
        strength = 0.4 + (parseInt(pairRank) / 14) * 0.2;
    }
    else {
        // High card only
        strength = 0.15 + (Math.max(...holeRanks) / 14) * 0.15;
    }

    // Check for straight potential (simplified)
    const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b);
    for (let i = 0; i <= sortedRanks.length - 5; i++) {
        if (sortedRanks[i + 4] - sortedRanks[i] === 4) {
            // Found a straight - check if we contribute
            const straightRanks = sortedRanks.slice(i, i + 5);
            if (holeRanks.some(hr => straightRanks.includes(hr))) {
                strength = Math.max(strength, 0.8);
            }
        }
    }

    return Math.min(1, Math.max(0, strength));
}

/**
 * Smart bot AI to choose an action
 * @param {Object} hand - Current hand state
 * @param {Object} player - Bot player state
 * @param {Array} validActions - List of valid actions
 * @returns {Object} { action, amount }
 */
export function chooseBotAction(hand, player, validActions) {
    const toCall = hand.currentBet - player.currentRoundBet;
    const potAfterCall = hand.pot + toCall;
    const potOdds = toCall > 0 ? toCall / potAfterCall : 0;
    const stackToCallRatio = toCall > 0 ? player.chipStackCurrent / toCall : Infinity;

    // Evaluate hand strength
    const isPreflop = hand.status === 'preflop' || !hand.communityCards || hand.communityCards.length === 0;
    const handStrength = isPreflop
        ? evaluatePreflopStrength(player.holeCards)
        : evaluatePostflopStrength(player.holeCards, hand.communityCards);

    // Random factor for unpredictability (0-1)
    const randomFactor = Math.random();

    // Aggression modifier (varies per decision)
    const aggression = 0.3 + Math.random() * 0.4; // 0.3-0.7

    // === DECISION LOGIC ===

    // If we can check (no bet to call)
    if (validActions.includes('check')) {
        // Strong hand - often bet for value
        if (handStrength > 0.7) {
            if (validActions.includes('bet') && randomFactor < 0.7) {
                const betSize = Math.floor(hand.pot * (0.5 + handStrength * 0.5));
                return { action: 'bet', amount: Math.max(hand.minRaise || 20, betSize) };
            }
        }
        // Medium hand - sometimes bet, sometimes check
        else if (handStrength > 0.45) {
            if (validActions.includes('bet') && randomFactor < 0.35) {
                const betSize = Math.floor(hand.pot * 0.5);
                return { action: 'bet', amount: Math.max(hand.minRaise || 20, betSize) };
            }
        }
        // Weak hand - usually check, occasional bluff
        else {
            if (validActions.includes('bet') && randomFactor < 0.15) {
                // Bluff
                const betSize = Math.floor(hand.pot * 0.6);
                return { action: 'bet', amount: Math.max(hand.minRaise || 20, betSize) };
            }
        }
        return { action: 'check', amount: 0 };
    }

    // If there's a bet to call
    if (toCall > 0) {
        // Calculate if call is profitable based on hand strength vs pot odds
        const callThreshold = potOdds + 0.1; // Need slightly better than pot odds

        // Premium hands (strength > 0.75) - raise or call
        if (handStrength > 0.75) {
            if (validActions.includes('raise') && randomFactor < 0.6) {
                const raiseSize = hand.currentBet + Math.floor(hand.pot * (0.6 + handStrength * 0.4));
                return { action: 'raise', amount: Math.min(raiseSize, player.chipStackCurrent) };
            }
            if (validActions.includes('all_in') && handStrength > 0.85 && randomFactor < 0.3) {
                return { action: 'all_in', amount: 0 };
            }
            if (validActions.includes('call')) {
                return { action: 'call', amount: 0 };
            }
        }

        // Good hands (0.5-0.75) - usually call, sometimes raise
        else if (handStrength > 0.5) {
            if (validActions.includes('raise') && randomFactor < 0.25 * aggression) {
                const raiseSize = hand.currentBet + Math.floor(hand.pot * 0.5);
                return { action: 'raise', amount: Math.min(raiseSize, player.chipStackCurrent) };
            }
            // Call if pot odds are decent or bet isn't too big
            if (handStrength > callThreshold || stackToCallRatio > 5) {
                if (validActions.includes('call')) {
                    return { action: 'call', amount: 0 };
                }
            }
            // Fold if bet is too big relative to hand strength
            if (validActions.includes('fold') && randomFactor < 0.4) {
                return { action: 'fold', amount: 0 };
            }
            if (validActions.includes('call')) {
                return { action: 'call', amount: 0 };
            }
        }

        // Mediocre hands (0.3-0.5) - call small bets, fold to big ones
        else if (handStrength > 0.3) {
            // Only call if bet is small relative to pot and stack
            if (stackToCallRatio > 10 && potOdds < 0.25) {
                if (validActions.includes('call') && randomFactor < 0.5) {
                    return { action: 'call', amount: 0 };
                }
            }
            // Occasional bluff raise
            if (validActions.includes('raise') && randomFactor < 0.1) {
                const raiseSize = hand.currentBet + Math.floor(hand.pot * 0.7);
                return { action: 'raise', amount: Math.min(raiseSize, player.chipStackCurrent) };
            }
            // Usually fold
            if (validActions.includes('fold')) {
                return { action: 'fold', amount: 0 };
            }
        }

        // Weak hands (< 0.3) - mostly fold
        else {
            // Rare bluff
            if (validActions.includes('raise') && randomFactor < 0.08) {
                const raiseSize = hand.currentBet + Math.floor(hand.pot * 0.75);
                return { action: 'raise', amount: Math.min(raiseSize, player.chipStackCurrent) };
            }
            // Call only if very cheap
            if (stackToCallRatio > 20 && randomFactor < 0.2) {
                if (validActions.includes('call')) {
                    return { action: 'call', amount: 0 };
                }
            }
            // Fold weak hands
            if (validActions.includes('fold')) {
                return { action: 'fold', amount: 0 };
            }
        }

        // Fallback to call if we can't fold
        if (validActions.includes('call')) {
            return { action: 'call', amount: 0 };
        }
        if (validActions.includes('all_in')) {
            return { action: 'all_in', amount: 0 };
        }
    }

    // Default: first valid action
    return { action: validActions[0], amount: 0 };
}

/**
 * Check if the acting player is a bot and process their turn
 * @param {string} tableId - Table ID
 * @param {string} tableType - 'cash' or 'tournament'
 * @returns {Object|null} Result if bot acted, null if human's turn
 */
export async function processBotTurnIfNeeded(tableId, tableType = 'cash') {
    const users = await getCollection('users');
    const hands = await getCollection('poker_hands');
    const tables = await getCollection(tableType === 'cash' ? 'cash_tables' : 'poker_tables');

    const table = await tables.findOne({ _id: new ObjectId(tableId) });
    if (!table || !table.currentHandId) {
        return null;
    }

    const hand = await hands.findOne({ _id: table.currentHandId });
    if (!hand || hand.status === 'complete') {
        return null;
    }

    // Find the acting player
    const actingPlayer = hand.players.find(p => p.position === hand.actingPosition);
    if (!actingPlayer) {
        return null;
    }

    // Check if acting player is a bot
    const actingUser = await users.findOne({ _id: actingPlayer.playerId });
    if (!actingUser || !actingUser.isBot) {
        return null; // Not a bot, human needs to act
    }

    // Import game engine functions
    const { processAction, getValidActions } = await import('./gameEngine.js');

    // Get valid actions and choose one
    const validActions = getValidActions(hand, actingPlayer);
    const { action, amount } = chooseBotAction(hand, actingPlayer, validActions);

    // Small delay for realism (300-800ms)
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    // Execute the action
    const result = await processAction(
        hand._id.toString(),
        actingPlayer.playerId.toString(),
        action,
        amount
    );

    return {
        success: true,
        bot: actingUser.username,
        action,
        amount: result.amount,
        isHandComplete: result.isHandComplete
    };
}

/**
 * Fill tournament with bot players
 * @param {string} tournamentId - Tournament ID
 * @param {number} targetCount - Target number of players (fills to this count)
 * @returns {Object} Result with created bots
 */
export async function fillTournamentWithBots(tournamentId, targetCount = null) {
    const tournaments = await getCollection('tournaments');
    const users = await getCollection('users');
    const registrations = await getCollection('tournament_registrations');

    const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
    if (!tournament) {
        throw new Error('Tournament not found');
    }

    const currentPlayers = tournament.registeredPlayers?.length || 0;
    const maxPlayers = tournament.maxPlayers || 9;
    const target = targetCount || maxPlayers;
    const neededBots = Math.min(target - currentPlayers, maxPlayers - currentPlayers);

    if (neededBots <= 0) {
        return { success: true, botsAdded: 0, message: 'No bots needed' };
    }

    const createdBots = [];

    for (let i = 0; i < neededBots; i++) {
        const bot = await getOrCreateBot(BOT_NAMES[i % BOT_NAMES.length]);

        // Deduct buy-in from bot (they have plenty)
        if (tournament.buyIn > 0) {
            await users.updateOne(
                { _id: bot._id },
                { $inc: { coinBalance: -tournament.buyIn } }
            );
        }

        // Register bot for tournament
        await tournaments.updateOne(
            { _id: tournament._id },
            {
                $push: { registeredPlayers: bot._id },
                $inc: { prizePool: tournament.buyIn || 0 }
            }
        );

        // Create registration record
        await registrations.insertOne({
            tournamentId: tournament._id,
            odUserId: bot._id,
            registeredAt: new Date(),
            buyIn: tournament.buyIn || 0,
            status: 'registered',
            chipCount: tournament.startingChips,
            isBot: true
        });

        createdBots.push({
            odUserId: bot._id,
            odUsername: bot.displayName || bot.username
        });
    }

    return {
        success: true,
        botsAdded: createdBots.length,
        bots: createdBots
    };
}
