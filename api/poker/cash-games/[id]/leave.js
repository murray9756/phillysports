// Leave Cash Table API
// POST: Leave table and cash out remaining chips

import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { addCoins } from '../../../lib/coins.js';
import { ObjectId } from 'mongodb';
import { broadcastTableUpdate } from '../../../lib/pusher.js';
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

    const user = await authenticate(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const cashTables = await getCollection('cash_tables');
        const hands = await getCollection('poker_hands');
        const users = await getCollection('users');

        const table = await cashTables.findOne({ _id: new ObjectId(id) });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Find user's seat
        const seatIndex = table.seats.findIndex(s => s.playerId && s.playerId.toString() === user.userId);
        if (seatIndex === -1) {
            return res.status(400).json({ error: 'Not seated at this table' });
        }

        const seat = table.seats[seatIndex];
        const forceLeave = req.query.force === 'true';

        // Check if hand is in progress
        if (table.currentHandId && !forceLeave) {
            const currentHand = await hands.findOne({ _id: table.currentHandId });
            if (currentHand && currentHand.status !== HAND_STATUS.COMPLETE) {
                // Check if player is still active in the hand
                const handPlayer = currentHand.players.find(p => p.playerId.toString() === user.userId);
                if (handPlayer && !handPlayer.isFolded) {
                    // Check if the game is stuck (only 1 player at table, or bot is missing)
                    const activePlayers = table.seats.filter(s => s.playerId);
                    const otherPlayers = activePlayers.filter(s => s.playerId.toString() !== user.userId);

                    if (otherPlayers.length === 0) {
                        // Table has only one player - stuck state, clean up and allow leave
                        console.log('Allowing leave - stuck state detected (no other players)');
                        // Mark hand as complete since there's no opponent
                        await hands.updateOne(
                            { _id: table.currentHandId },
                            {
                                $set: {
                                    status: HAND_STATUS.COMPLETE,
                                    endedAt: new Date(),
                                    notes: 'Opponent left - hand cancelled'
                                }
                            }
                        );
                        await cashTables.updateOne(
                            { _id: new ObjectId(id) },
                            { $set: { currentHandId: null } }
                        );
                    } else {
                        return res.status(400).json({
                            error: 'Cannot leave during an active hand. Fold first or wait for hand to complete.'
                        });
                    }
                }
            }
        }

        // If force leaving during a hand, mark the hand as complete and forfeit
        if (forceLeave && table.currentHandId) {
            const currentHand = await hands.findOne({ _id: table.currentHandId });
            if (currentHand && currentHand.status !== HAND_STATUS.COMPLETE) {
                // Mark hand as complete with the player forfeiting
                await hands.updateOne(
                    { _id: table.currentHandId },
                    {
                        $set: {
                            status: HAND_STATUS.COMPLETE,
                            endedAt: new Date(),
                            notes: 'Player force-left the table'
                        }
                    }
                );
            }
            // Clear the current hand from the table
            await cashTables.updateOne(
                { _id: new ObjectId(id) },
                { $set: { currentHandId: null } }
            );
        }

        // Cash out remaining chips
        const cashOutAmount = seat.chipStack;
        if (cashOutAmount > 0) {
            await addCoins(
                user.userId,
                cashOutAmount,
                'cash_game_cashout',
                `Cashed out from ${table.name}`,
                { tableId: id, chipStack: cashOutAmount }
            );
        }

        // Clear the seat
        await cashTables.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    [`seats.${seatIndex}`]: {
                        position: seatIndex,
                        playerId: null,
                        username: null,
                        chipStack: 0,
                        isActive: false,
                        isSittingOut: false,
                        cards: [],
                        currentBet: 0,
                        joinedAt: null
                    },
                    updatedAt: new Date()
                }
            }
        );

        // Check remaining players
        const updatedTable = await cashTables.findOne({ _id: new ObjectId(id) });
        const remainingPlayers = updatedTable.seats.filter(s => s.playerId);

        // Update table status
        if (remainingPlayers.length < 2) {
            await cashTables.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: 'waiting',
                        currentHandId: null
                    }
                }
            );
        }

        // Broadcast player left
        broadcastTableUpdate(id, 'player-left', {
            playerId: user.userId,
            username: seat.username,
            position: seatIndex,
            cashOut: cashOutAmount,
            playerCount: remainingPlayers.length
        });

        // Get updated balance
        const updatedUser = await users.findOne({ _id: new ObjectId(user.userId) });

        return res.status(200).json({
            success: true,
            message: 'Left table successfully',
            cashOut: cashOutAmount,
            newBalance: updatedUser?.coinBalance || 0
        });

    } catch (error) {
        console.error('Leave cash table error:', error);
        return res.status(500).json({ error: 'Failed to leave table' });
    }
}
