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
 * Simple bot AI to choose an action
 * @param {Object} hand - Current hand state
 * @param {Object} player - Bot player state
 * @param {Array} validActions - List of valid actions
 * @returns {Object} { action, amount }
 */
export function chooseBotAction(hand, player, validActions) {
    const toCall = hand.currentBet - player.currentRoundBet;
    const potOdds = toCall > 0 ? toCall / (hand.pot + toCall) : 0;
    const chipRatio = player.chipStackCurrent / (hand.pot || 1);

    // Random factor for unpredictability
    const randomFactor = Math.random();

    // If we can check, usually check (60% of time)
    if (validActions.includes('check')) {
        if (randomFactor < 0.6) {
            return { action: 'check', amount: 0 };
        }
        // Sometimes bet when we can check
        if (validActions.includes('bet') && randomFactor > 0.8) {
            const betAmount = Math.floor(hand.pot * 0.5);
            return { action: 'bet', amount: Math.max(hand.minRaise || hand.currentBet, betAmount) };
        }
        return { action: 'check', amount: 0 };
    }

    // If there's a bet to call
    if (toCall > 0) {
        // Fold if the call is too expensive (more than 30% of our stack) and we're unlucky
        if (toCall > player.chipStackCurrent * 0.3 && randomFactor < 0.3) {
            if (validActions.includes('fold')) {
                return { action: 'fold', amount: 0 };
            }
        }

        // Usually call (60% of time)
        if (validActions.includes('call') && randomFactor < 0.7) {
            return { action: 'call', amount: 0 };
        }

        // Sometimes raise (20% of time if we have chips)
        if (validActions.includes('raise') && randomFactor > 0.8) {
            const raiseAmount = hand.currentBet + Math.floor(hand.pot * 0.5);
            return { action: 'raise', amount: raiseAmount };
        }

        // Go all-in occasionally (5% of time)
        if (validActions.includes('all_in') && randomFactor > 0.95) {
            return { action: 'all_in', amount: 0 };
        }

        // Default to calling
        if (validActions.includes('call')) {
            return { action: 'call', amount: 0 };
        }

        // If we can't call, go all-in or fold
        if (validActions.includes('all_in')) {
            return { action: 'all_in', amount: 0 };
        }
        if (validActions.includes('fold')) {
            return { action: 'fold', amount: 0 };
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
