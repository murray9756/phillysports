// Cash Game Bot Action API
// POST: Process bot player action if it's a bot's turn

import { getCollection } from '../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { processAction, getValidActions } from '../../../lib/poker/gameEngine.js';
import { chooseBotAction, processBotTurnIfNeeded } from '../../../lib/poker/botManager.js';
import { broadcastTableUpdate, PUSHER_EVENTS } from '../../../lib/pusher.js';
import { HAND_STATUS } from '../../../lib/poker/constants.js';

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

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid table ID' });
    }

    try {
        const cashTables = await getCollection('cash_tables');
        const hands = await getCollection('poker_hands');
        const users = await getCollection('users');

        const table = await cashTables.findOne({ _id: new ObjectId(id) });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Get current hand
        if (!table.currentHandId) {
            return res.status(200).json({
                success: true,
                message: 'No active hand',
                needsNewHand: true
            });
        }

        const hand = await hands.findOne({ _id: table.currentHandId });
        if (!hand) {
            return res.status(200).json({
                success: true,
                message: 'Hand not found',
                needsNewHand: true
            });
        }

        if (hand.status === HAND_STATUS.COMPLETE) {
            return res.status(200).json({
                success: true,
                message: 'Hand is complete',
                handComplete: true
            });
        }

        // Find the acting player
        const actingPlayer = hand.players.find(p => p.position === hand.actingPosition);
        if (!actingPlayer) {
            return res.status(400).json({ error: 'No acting player found' });
        }

        // Check if acting player is a bot
        const actingUser = await users.findOne({ _id: actingPlayer.playerId });
        if (!actingUser) {
            return res.status(400).json({ error: 'Player not found' });
        }

        if (!actingUser.isBot) {
            return res.status(200).json({
                success: true,
                message: 'Waiting for human player',
                waitingFor: actingUser.username,
                position: hand.actingPosition,
                isBot: false
            });
        }

        // Bot AI: Choose an action
        const validActions = getValidActions(hand, actingPlayer);
        const { action, amount } = chooseBotAction(hand, actingPlayer, validActions);

        // Small delay for realism
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        // Execute the action
        const result = await processAction(
            hand._id.toString(),
            actingPlayer.playerId.toString(),
            action,
            amount
        );

        // Update cash table seat chip stacks
        const updatedHand = await hands.findOne({ _id: table.currentHandId });

        for (const player of updatedHand.players) {
            const seatIdx = table.seats.findIndex(s => s.playerId?.toString() === player.playerId.toString());
            if (seatIdx !== -1) {
                await cashTables.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            [`seats.${seatIdx}.chipStack`]: player.chipStackCurrent,
                            [`seats.${seatIdx}.currentBet`]: player.currentRoundBet,
                            [`seats.${seatIdx}.isActive`]: !player.isFolded && !player.isAllIn
                        }
                    }
                );
            }
        }

        // If hand is complete, handle next hand
        if (result.isHandComplete) {
            // Clear seat cards and bets (but keep currentHandId so frontend can see completed hand)
            await cashTables.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        'seats.$[].cards': [],
                        'seats.$[].currentBet': 0,
                        updatedAt: new Date()
                    }
                }
            );

            // Check if both players still have chips
            const refreshedTable = await cashTables.findOne({ _id: new ObjectId(id) });
            const playersWithChips = refreshedTable.seats.filter(s => s.playerId && s.chipStack > 0);

            if (playersWithChips.length >= 2) {
                // Auto-start new hand after short delay
                setTimeout(async () => {
                    try {
                        const { startNextHand } = await import('./action.js');
                        // Note: startNextHand is defined in action.js, we'll import and use it
                        await startNextHandForCashGame(id);
                    } catch (e) {
                        console.error('Error starting next hand:', e);
                    }
                }, 3000);
            } else {
                // One player is bust, update status
                await cashTables.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'waiting' } }
                );
            }
        }

        // Broadcast the action
        broadcastTableUpdate(id, PUSHER_EVENTS.PLAYER_ACTION, {
            playerId: actingPlayer.playerId.toString(),
            username: actingUser.username,
            action,
            amount: result.amount,
            pot: updatedHand.pot,
            currentBet: updatedHand.currentBet,
            isBot: true
        });

        return res.status(200).json({
            success: true,
            bot: actingUser.username,
            action,
            amount: result.amount,
            isHandComplete: result.isHandComplete,
            hand: result.hand
        });

    } catch (error) {
        console.error('Cash game bot action error:', error);
        return res.status(500).json({ error: error.message || 'Bot action failed' });
    }
}

// Helper function to start next hand (duplicated from action.js for modularity)
async function startNextHandForCashGame(tableId) {
    const cashTables = await getCollection('cash_tables');
    const hands = await getCollection('poker_hands');

    const table = await cashTables.findOne({ _id: new ObjectId(tableId) });
    if (!table) return;

    // Check if hand already started
    if (table.currentHandId) {
        const existingHand = await hands.findOne({ _id: table.currentHandId });
        if (existingHand && existingHand.status !== 'complete') {
            return; // Hand already in progress
        }
    }

    const activePlayers = table.seats.filter(s => s.playerId && s.chipStack > 0);
    if (activePlayers.length < 2) return;

    // Import deck functions
    const { createDeck, shuffleDeck, dealHoleCards } = await import('../../../lib/poker/deck.js');
    const deck = shuffleDeck(createDeck());
    const { hands: holeCards, remaining: deckAfterDeal } = dealHoleCards(deck, activePlayers.length);

    // Rotate dealer
    const dealerPosition = ((table.dealerPosition || 0) + 1) % 2;
    const sbPosition = dealerPosition;
    const bbPosition = (dealerPosition + 1) % 2;

    const blinds = table.blinds;

    // Build players array
    const handPlayers = activePlayers.map((seat, idx) => ({
        playerId: seat.playerId,
        position: seat.position,
        holeCards: holeCards[idx],
        chipStackStart: seat.chipStack,
        chipStackCurrent: seat.chipStack,
        totalBet: 0,
        currentRoundBet: 0,
        isAllIn: false,
        isFolded: false,
        hasActed: false
    }));

    // Post blinds
    let pot = 0;
    const actions = [];

    const sbPlayer = handPlayers.find(p => p.position === sbPosition);
    const sbAmount = Math.min(blinds.small, sbPlayer.chipStackCurrent);
    sbPlayer.chipStackCurrent -= sbAmount;
    sbPlayer.totalBet += sbAmount;
    sbPlayer.currentRoundBet = sbAmount;
    pot += sbAmount;
    if (sbPlayer.chipStackCurrent === 0) sbPlayer.isAllIn = true;
    actions.push({
        playerId: sbPlayer.playerId,
        action: 'small_blind',
        amount: sbAmount,
        timestamp: new Date(),
        street: 'preflop'
    });

    const bbPlayer = handPlayers.find(p => p.position === bbPosition);
    const bbAmount = Math.min(blinds.big, bbPlayer.chipStackCurrent);
    bbPlayer.chipStackCurrent -= bbAmount;
    bbPlayer.totalBet += bbAmount;
    bbPlayer.currentRoundBet = bbAmount;
    pot += bbAmount;
    if (bbPlayer.chipStackCurrent === 0) bbPlayer.isAllIn = true;
    actions.push({
        playerId: bbPlayer.playerId,
        action: 'big_blind',
        amount: bbAmount,
        timestamp: new Date(),
        street: 'preflop'
    });

    const actingPosition = sbPosition;

    const hand = {
        tableId: new ObjectId(tableId),
        tableType: 'cash',
        tournamentId: null,
        handNumber: (table.handsPlayed || 0) + 1,
        status: 'preflop',
        deck: deckAfterDeal,
        communityCards: [],
        pot,
        sidePots: [],
        currentBet: blinds.big,
        minRaise: blinds.big,
        lastRaise: blinds.big,
        actingPosition,
        dealerPosition,
        sbPosition,
        bbPosition,
        players: handPlayers,
        actions,
        winners: [],
        startedAt: new Date(),
        endedAt: null
    };

    const result = await hands.insertOne(hand);
    const handId = result.insertedId;

    await cashTables.updateOne(
        { _id: new ObjectId(tableId) },
        {
            $set: {
                currentHandId: handId,
                dealerPosition,
                status: 'playing',
                updatedAt: new Date()
            },
            $inc: { handsPlayed: 1 }
        }
    );

    // Update seats
    for (const player of handPlayers) {
        const seatIdx = table.seats.findIndex(s => s.playerId?.toString() === player.playerId.toString());
        if (seatIdx !== -1) {
            await cashTables.updateOne(
                { _id: new ObjectId(tableId) },
                {
                    $set: {
                        [`seats.${seatIdx}.chipStack`]: player.chipStackCurrent,
                        [`seats.${seatIdx}.cards`]: player.holeCards,
                        [`seats.${seatIdx}.currentBet`]: player.currentRoundBet,
                        [`seats.${seatIdx}.isActive`]: true
                    }
                }
            );
        }
    }

    // Broadcast new hand
    const { broadcastTableUpdate, sendPrivateCards, PUSHER_EVENTS } = await import('../../../lib/pusher.js');

    broadcastTableUpdate(tableId, PUSHER_EVENTS.NEW_HAND, {
        handId: handId.toString(),
        handNumber: hand.handNumber,
        dealerPosition,
        smallBlindPosition: sbPosition,
        bigBlindPosition: bbPosition,
        actingPosition: hand.actingPosition,
        pot: hand.pot,
        currentBet: hand.currentBet,
        players: handPlayers.map(p => ({
            playerId: p.playerId.toString(),
            position: p.position,
            chipStack: p.chipStackCurrent,
            currentBet: p.currentRoundBet,
            isAllIn: p.isAllIn
        }))
    });

    // Send private hole cards
    for (const player of handPlayers) {
        sendPrivateCards(player.playerId.toString(), tableId, player.holeCards);
    }
}
