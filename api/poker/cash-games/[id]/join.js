// Join Cash Table API
// POST: Join table with buy-in

import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { spendCoins } from '../../../lib/coins.js';
import { ObjectId } from 'mongodb';
import { startNewHand } from '../../../lib/poker/gameEngine.js';
import { broadcastTableUpdate, PUSHER_EVENTS } from '../../../lib/pusher.js';
import { CASH_TABLE_CONFIG } from '../index.js';

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

    const user = await authenticate(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const cashTables = await getCollection('cash_tables');
        const users = await getCollection('users');

        const table = await cashTables.findOne({ _id: new ObjectId(id) });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Check if user is already seated at this table
        const existingSeat = table.seats.find(s => s.playerId && s.playerId.toString() === user.userId);
        if (existingSeat) {
            return res.status(400).json({ error: 'Already seated at this table' });
        }

        // Check if user is seated at another cash table
        const otherTable = await cashTables.findOne({
            _id: { $ne: new ObjectId(id) },
            'seats.playerId': new ObjectId(user.userId)
        });
        if (otherTable) {
            return res.status(400).json({ error: 'Already seated at another cash table. Leave that table first.' });
        }

        // Find open seat
        const openSeatIndex = table.seats.findIndex(s => !s.playerId);
        if (openSeatIndex === -1) {
            return res.status(400).json({ error: 'Table is full' });
        }

        // Get user details
        const userDoc = await users.findOne({ _id: new ObjectId(user.userId) });
        if (!userDoc) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check balance
        const buyIn = CASH_TABLE_CONFIG.buyIn;
        if ((userDoc.coinBalance || 0) < buyIn) {
            return res.status(400).json({
                error: `Insufficient balance. Need ${buyIn} DD to join.`,
                required: buyIn,
                current: userDoc.coinBalance || 0
            });
        }

        // Deduct buy-in
        await spendCoins(
            user.userId,
            buyIn,
            'cash_game_buyin',
            `Cash game buy-in at ${table.name}`,
            { tableId: id }
        );

        // Seat player
        const seatUpdate = {
            playerId: new ObjectId(user.userId),
            username: userDoc.displayName || userDoc.username,
            chipStack: buyIn,
            isActive: true,
            isSittingOut: false,
            cards: [],
            currentBet: 0,
            joinedAt: new Date()
        };

        await cashTables.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    [`seats.${openSeatIndex}`]: { ...table.seats[openSeatIndex], ...seatUpdate },
                    updatedAt: new Date()
                }
            }
        );

        // Refresh table
        let updatedTable = await cashTables.findOne({ _id: new ObjectId(id) });
        let seatedPlayers = updatedTable.seats.filter(s => s.playerId);

        // Broadcast player joined
        broadcastTableUpdate(id, 'player-joined', {
            playerId: user.userId,
            username: seatUpdate.username,
            position: openSeatIndex,
            chipStack: buyIn,
            playerCount: seatedPlayers.length,
            maxSeats: updatedTable.maxSeats
        });

        console.log('Seats after human joined:', JSON.stringify(updatedTable.seats.map(s => ({
            pos: s.position,
            id: s.playerId?.toString(),
            name: s.username
        }))));
        console.log('Seated players count:', seatedPlayers.length);

        // Start a hand if 2+ players and no hand in progress
        let handStarted = false;
        if (seatedPlayers.length >= 2 && !updatedTable.currentHandId) {
            try {
                await cashTables.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'playing' } }
                );

                const handResult = await startCashGameHand(id, updatedTable);
                handStarted = true;

                // Check if first player to act is a bot
                if (handResult && handResult.hand) {
                    const actingPosition = handResult.hand.actingPosition;
                    const actingSeat = updatedTable.seats.find(s => s.position === actingPosition);
                    if (actingSeat?.isBot) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                        try {
                            const { processBotTurnIfNeeded } = await import('../../../lib/poker/botManager.js');
                            await processBotTurnIfNeeded(id, 'cash');
                        } catch (e) {
                            console.error('Error processing bot turn:', e);
                        }
                    }
                }
            } catch (e) {
                console.error('Error starting hand:', e);
            }
        }

        // Get updated balance
        const updatedUser = await users.findOne({ _id: new ObjectId(user.userId) });

        return res.status(200).json({
            success: true,
            message: 'Joined table successfully',
            seat: {
                position: openSeatIndex,
                chipStack: buyIn
            },
            handStarted,
            newBalance: updatedUser?.coinBalance || 0,
            seatedPlayers: seatedPlayers.length,
            maxSeats: updatedTable.maxSeats
        });

    } catch (error) {
        console.error('Join cash table error:', error);
        return res.status(500).json({ error: error.message || 'Failed to join table' });
    }
}

async function startCashGameHand(tableId, table) {
    const cashTables = await getCollection('cash_tables');
    const hands = await getCollection('poker_hands');

    const activePlayers = table.seats.filter(s => s.playerId && s.chipStack > 0);
    if (activePlayers.length < 2) {
        throw new Error('Not enough players to start hand');
    }

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

    // Create deck
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
        actingPosition = sbPosition;
    } else {
        // 3+ players: SB is left of dealer, BB is left of SB, UTG acts first preflop
        sbPosition = getNextActivePosition(dealerPosition);
        bbPosition = getNextActivePosition(sbPosition);
        actingPosition = getNextActivePosition(bbPosition);
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

    // Small blind
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

    // Big blind
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

    // Create hand document
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

    // Update cash table
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

    // Update seat chip stacks and cards
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

    return { handId, hand };
}
