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
            if (hand) {
                currentHand = user
                    ? sanitizeHandForPlayer(hand, user.userId)
                    : sanitizeHandForPlayer(hand, 'spectator');

                // Get valid actions if it's this user's turn and hand not complete
                if (user && hand.status !== HAND_STATUS.COMPLETE) {
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
            } else {
                // Log for debugging if user should be seated but isn't found
                console.log('User seat lookup debug:', {
                    userId: user.userId,
                    seats: table.seats.map(s => ({
                        position: s.position,
                        playerId: s.playerId?.toString(),
                        chipStack: s.chipStack
                    }))
                });
            }
        }

        // Determine if it's the user's turn
        const isYourTurn = validActions.length > 0;

        // Check for stuck state (user seated alone with stale hand)
        const seatedPlayers = table.seats.filter(s => s.playerId);
        let isStuckState = false;
        let stuckReason = null;

        if (userSeat && seatedPlayers.length === 1) {
            // Only one player at table
            if (table.currentHandId) {
                // Has a hand but no opponent - definitely stuck
                isStuckState = true;
                stuckReason = 'Opponent left during hand';
            } else if (table.status === 'playing') {
                // Table says playing but only one player and no hand
                isStuckState = true;
                stuckReason = 'Waiting for opponent';
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
            isYourTurn,
            userSeat,
            isSeated: !!userSeat,
            canJoin: !userSeat && table.seats.some(s => !s.playerId),
            canLeave: !!userSeat, // Always allow leaving - will fold if hand in progress
            canRebuy: userSeat && userSeat.chipStack === 0,
            isStuckState,
            stuckReason
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Get cash table error:', error);
        return res.status(500).json({ error: 'Failed to get table state' });
    }
}
