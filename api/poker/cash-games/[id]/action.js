// Cash Game Action API
// POST: Process player action (fold, check, call, bet, raise, all_in)

import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { ObjectId } from 'mongodb';
import { processAction, getValidActions, sanitizeHandForPlayer } from '../../../lib/poker/gameEngine.js';
import { broadcastTableUpdate, sendPrivateCards, PUSHER_EVENTS } from '../../../lib/pusher.js';
import { HAND_STATUS, ACTIONS } from '../../../lib/poker/constants.js';
import { chooseBotAction } from '../../../lib/poker/botManager.js';
import { rateLimit } from '../../../lib/rateLimit.js';

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

    // Rate limit: 60 actions per minute (generous for poker)
    const allowed = await rateLimit(req, res, 'api');
    if (!allowed) return;

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid table ID' });
    }

    const user = await authenticate(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { action, amount = 0 } = req.body;

    if (!action) {
        return res.status(400).json({ error: 'Action is required' });
    }

    try {
        const cashTables = await getCollection('cash_tables');
        const hands = await getCollection('poker_hands');

        const table = await cashTables.findOne({ _id: new ObjectId(id) });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Check if user is seated
        const seat = table.seats.find(s => s.playerId && s.playerId.toString() === user.userId);
        if (!seat) {
            return res.status(400).json({ error: 'Not seated at this table' });
        }

        // Get current hand
        if (!table.currentHandId) {
            return res.status(400).json({ error: 'No active hand' });
        }

        const hand = await hands.findOne({ _id: table.currentHandId });
        if (!hand) {
            return res.status(400).json({ error: 'Hand not found' });
        }

        if (hand.status === HAND_STATUS.COMPLETE) {
            return res.status(400).json({ error: 'Hand is already complete' });
        }

        // Process the action using the game engine
        const result = await processAction(hand._id.toString(), user.userId, action, amount);

        // Update cash table seat chip stacks
        const updatedHand = await hands.findOne({ _id: table.currentHandId });

        // Find player's seat for broadcast
        const playerSeat = table.seats.find(s => s.playerId?.toString() === user.userId);

        // Broadcast player's action
        broadcastTableUpdate(id, PUSHER_EVENTS.PLAYER_ACTION, {
            playerId: user.userId,
            username: playerSeat?.username || 'Player',
            position: playerSeat?.position,
            action,
            amount: result.amount,
            pot: updatedHand.pot,
            currentBet: updatedHand.currentBet,
            actingPosition: updatedHand.actingPosition,
            status: updatedHand.status
        });

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

        // If hand is complete, check if we should start a new hand
        if (result.isHandComplete) {
            // Broadcast hand complete with winner info
            broadcastTableUpdate(id, PUSHER_EVENTS.HAND_COMPLETE, {
                winners: updatedHand.winners || [],
                pot: updatedHand.pot,
                handId: updatedHand._id.toString()
            });

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
                // Auto-start new hand after delay (wait for 5-second winner display)
                await new Promise(resolve => setTimeout(resolve, 6000));
                try {
                    await startNextHand(id);
                } catch (e) {
                    console.error('Error starting next hand:', e);
                }
            } else {
                // One player is bust, update status
                await cashTables.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'waiting' } }
                );
            }
        } else {
            // Hand is not complete, check if next player is a bot
            const users = await getCollection('users');
            const latestHand = await hands.findOne({ _id: table.currentHandId });

            if (latestHand && latestHand.status !== HAND_STATUS.COMPLETE) {
                const nextPlayer = latestHand.players.find(p => p.position === latestHand.actingPosition);
                if (nextPlayer) {
                    const nextUser = await users.findOne({ _id: nextPlayer.playerId });
                    if (nextUser && nextUser.isBot) {
                        // Trigger bot action synchronously with small delay for realism
                        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
                        try {
                            await processBotTurn(id, table.currentHandId);
                        } catch (e) {
                            console.error('Error processing bot turn:', e);
                        }
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            action,
            amount: result.amount,
            hand: result.hand,
            isHandComplete: result.isHandComplete
        });

    } catch (error) {
        console.error('Cash game action error:', error);
        return res.status(500).json({ error: error.message || 'Failed to process action' });
    }
}

async function startNextHand(tableId) {
    const cashTables = await getCollection('cash_tables');
    const hands = await getCollection('poker_hands');

    const table = await cashTables.findOne({ _id: new ObjectId(tableId) });
    if (!table) return;

    // Check if hand already started
    if (table.currentHandId) {
        const existingHand = await hands.findOne({ _id: table.currentHandId });
        if (existingHand && existingHand.status !== HAND_STATUS.COMPLETE) {
            return; // Hand already in progress
        }
    }

    const activePlayers = table.seats.filter(s => s.playerId && s.chipStack > 0);
    if (activePlayers.length < 2) return;

    // Sort active players by position for consistent ordering
    activePlayers.sort((a, b) => a.position - b.position);
    const activePositions = activePlayers.map(p => p.position);

    // Helper to find next active position after a given position
    const getNextActivePosition = (currentPos) => {
        const maxSeats = table.maxSeats || 6;
        for (let i = 1; i <= maxSeats; i++) {
            const nextPos = (currentPos + i) % maxSeats;
            if (activePositions.includes(nextPos)) {
                return nextPos;
            }
        }
        return currentPos;
    };

    // Import deck functions
    const { createDeck, shuffleDeck, dealHoleCards } = await import('../../../lib/poker/deck.js');
    const deck = shuffleDeck(createDeck());
    const { hands: holeCards, remaining: deckAfterDeal } = dealHoleCards(deck, activePlayers.length);

    // Rotate dealer to next active player
    const dealerPosition = getNextActivePosition(table.dealerPosition);

    // Determine blind positions based on player count
    let sbPosition, bbPosition, actingPosition;

    if (activePlayers.length === 2) {
        // Heads-up: dealer posts SB, other player posts BB, dealer acts first preflop
        sbPosition = dealerPosition;
        bbPosition = getNextActivePosition(dealerPosition);
        actingPosition = sbPosition; // Dealer/SB acts first in heads-up preflop
    } else {
        // 3+ players: SB is left of dealer, BB is left of SB, UTG acts first preflop
        sbPosition = getNextActivePosition(dealerPosition);
        bbPosition = getNextActivePosition(sbPosition);
        actingPosition = getNextActivePosition(bbPosition); // UTG acts first
    }

    const blinds = table.blinds;

    // Build players array (deal cards in seat order)
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

    // Check if first player to act is a bot and trigger synchronously
    const users = await getCollection('users');
    const firstActingPlayer = handPlayers.find(p => p.position === actingPosition);
    if (firstActingPlayer) {
        const firstUser = await users.findOne({ _id: firstActingPlayer.playerId });
        if (firstUser && firstUser.isBot) {
            // Trigger bot action synchronously with small delay for realism
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
            try {
                await processBotTurn(tableId, handId);
            } catch (e) {
                console.error('Error processing bot turn after new hand:', e);
            }
        }
    }
}

// Process a bot's turn
async function processBotTurn(tableId, handId) {
    const cashTables = await getCollection('cash_tables');
    const hands = await getCollection('poker_hands');
    const users = await getCollection('users');

    const hand = await hands.findOne({ _id: handId });
    if (!hand || hand.status === HAND_STATUS.COMPLETE) {
        return null;
    }

    // Find the acting player
    const actingPlayer = hand.players.find(p => p.position === hand.actingPosition);
    if (!actingPlayer) {
        return null;
    }

    // Verify it's a bot's turn
    const actingUser = await users.findOne({ _id: actingPlayer.playerId });
    if (!actingUser || !actingUser.isBot) {
        return null;
    }

    // Get valid actions and choose one
    const validActions = getValidActions(hand, actingPlayer);
    const { action, amount } = chooseBotAction(hand, actingPlayer, validActions);

    // Execute the action
    const result = await processAction(
        hand._id.toString(),
        actingPlayer.playerId.toString(),
        action,
        amount
    );

    // Update cash table seat chip stacks
    const table = await cashTables.findOne({ _id: new ObjectId(tableId) });
    const updatedHand = await hands.findOne({ _id: handId });

    for (const player of updatedHand.players) {
        const seatIdx = table.seats.findIndex(s => s.playerId?.toString() === player.playerId.toString());
        if (seatIdx !== -1) {
            await cashTables.updateOne(
                { _id: new ObjectId(tableId) },
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

    // Broadcast the bot's action
    broadcastTableUpdate(tableId, PUSHER_EVENTS.PLAYER_ACTION, {
        playerId: actingPlayer.playerId.toString(),
        username: actingUser.username,
        position: actingPlayer.position,
        action,
        amount: result.amount,
        pot: updatedHand.pot,
        currentBet: updatedHand.currentBet,
        actingPosition: updatedHand.actingPosition,
        status: updatedHand.status,
        isBot: true
    });

    // If hand is complete, handle next hand
    if (result.isHandComplete) {
        // Broadcast hand complete with winner info
        broadcastTableUpdate(tableId, PUSHER_EVENTS.HAND_COMPLETE, {
            winners: updatedHand.winners || [],
            pot: updatedHand.pot,
            handId: updatedHand._id.toString()
        });

        // Clear seat cards and bets (but keep currentHandId so frontend can see completed hand)
        await cashTables.updateOne(
            { _id: new ObjectId(tableId) },
            {
                $set: {
                    'seats.$[].cards': [],
                    'seats.$[].currentBet': 0,
                    updatedAt: new Date()
                }
            }
        );

        const refreshedTable = await cashTables.findOne({ _id: new ObjectId(tableId) });
        const playersWithChips = refreshedTable.seats.filter(s => s.playerId && s.chipStack > 0);

        if (playersWithChips.length >= 2) {
            // Delay before next hand (wait for 5-second winner display)
            await new Promise(resolve => setTimeout(resolve, 6000));
            try {
                await startNextHand(tableId);
            } catch (e) {
                console.error('Error starting next hand after bot action:', e);
            }
        } else {
            await cashTables.updateOne(
                { _id: new ObjectId(tableId) },
                { $set: { status: 'waiting' } }
            );
        }
    } else {
        // Check if next player is also a bot (for all-bot games or continued bot turns)
        const nextHand = await hands.findOne({ _id: handId });
        if (nextHand && nextHand.status !== HAND_STATUS.COMPLETE) {
            const nextPlayer = nextHand.players.find(p => p.position === nextHand.actingPosition);
            if (nextPlayer) {
                const nextUser = await users.findOne({ _id: nextPlayer.playerId });
                if (nextUser && nextUser.isBot) {
                    // Chain bot turns synchronously with delay
                    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
                    try {
                        await processBotTurn(tableId, handId);
                    } catch (e) {
                        console.error('Error processing next bot turn:', e);
                    }
                }
            }
        }
    }

    return { action, amount: result.amount, isHandComplete: result.isHandComplete };
}
