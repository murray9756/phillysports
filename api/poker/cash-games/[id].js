// Cash Table State API
// GET: Get current table state including hand

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';
import { sanitizeHandForPlayer, getValidActions } from '../../lib/poker/gameEngine.js';
import { HAND_STATUS } from '../../lib/poker/constants.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid table ID' });
    }

    try {
        const user = await authenticate(req);
        const cashTables = await getCollection('cash_tables');
        const hands = await getCollection('poker_hands');

        const table = await cashTables.findOne({ _id: new ObjectId(id) });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Get current hand if exists
        let currentHand = null;
        let validActions = [];
        let userSeat = null;

        if (table.currentHandId) {
            const hand = await hands.findOne({ _id: table.currentHandId });
            if (hand && hand.status !== HAND_STATUS.COMPLETE) {
                currentHand = user
                    ? sanitizeHandForPlayer(hand, user.userId)
                    : sanitizeHandForPlayer(hand, 'spectator');

                // Get valid actions if it's this user's turn
                if (user) {
                    const player = hand.players.find(p => p.playerId.toString() === user.userId);
                    if (player && player.position === hand.actingPosition && !player.isFolded && !player.isAllIn) {
                        validActions = getValidActions(hand, player);
                    }
                }
            }
        }

        // Find user's seat
        if (user) {
            const seat = table.seats.find(s => s.playerId && s.playerId.toString() === user.userId);
            if (seat) {
                userSeat = {
                    position: seat.position,
                    chipStack: seat.chipStack,
                    isActive: seat.isActive
                };
            }
        }

        // Build response
        const response = {
            success: true,
            table: {
                _id: table._id,
                name: table.name,
                status: table.status,
                blinds: table.blinds,
                buyIn: table.buyIn,
                maxSeats: table.maxSeats,
                dealerPosition: table.dealerPosition,
                handsPlayed: table.handsPlayed || 0,
                seats: table.seats.map(seat => ({
                    position: seat.position,
                    playerId: seat.playerId?.toString() || null,
                    username: seat.username,
                    chipStack: seat.chipStack,
                    isActive: seat.isActive,
                    isSittingOut: seat.isSittingOut,
                    currentBet: seat.currentBet || 0,
                    // Only show cards if it's the user or showdown
                    cards: (user && seat.playerId?.toString() === user.userId) ||
                           (currentHand?.status === HAND_STATUS.SHOWDOWN)
                        ? seat.cards
                        : seat.cards?.length > 0 ? ['back', 'back'] : []
                }))
            },
            currentHand,
            validActions,
            userSeat,
            isSeated: !!userSeat,
            canJoin: !userSeat && table.seats.some(s => !s.playerId),
            canLeave: !!userSeat && (!currentHand || currentHand.status === HAND_STATUS.COMPLETE),
            canRebuy: userSeat && userSeat.chipStack === 0
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Get cash table error:', error);
        return res.status(500).json({ error: 'Failed to get table state' });
    }
}
