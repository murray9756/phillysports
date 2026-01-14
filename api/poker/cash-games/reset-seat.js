// Reset user's seat at all cash tables
// POST: Force clear user from any cash table they're stuck at

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { addCoins } from '../../lib/coins.js';
import { ObjectId } from 'mongodb';

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

    const user = await authenticate(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const cashTables = await getCollection('cash_tables');
        const hands = await getCollection('poker_hands');
        const users = await getCollection('users');

        // Find all tables where user is seated
        const tablesWithUser = await cashTables.find({
            'seats.playerId': new ObjectId(user.userId)
        }).toArray();

        if (tablesWithUser.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'You are not seated at any cash tables',
                tablesCleared: 0
            });
        }

        let totalCashOut = 0;
        const clearedTables = [];

        for (const table of tablesWithUser) {
            // Find user's seat
            const seatIndex = table.seats.findIndex(
                s => s.playerId && s.playerId.toString() === user.userId
            );

            if (seatIndex === -1) continue;

            const seat = table.seats[seatIndex];
            const chipStack = seat.chipStack || 0;

            // Cash out chips
            if (chipStack > 0) {
                await addCoins(
                    user.userId,
                    chipStack,
                    'cash_game_force_cashout',
                    `Force cashout from ${table.name}`,
                    { tableId: table._id.toString() }
                );
                totalCashOut += chipStack;
            }

            // Clear ALL seats (including bots) and reset table completely
            const emptySeats = table.seats.map((s, idx) => ({
                position: idx,
                playerId: null,
                username: null,
                chipStack: 0,
                isActive: false,
                isSittingOut: false,
                cards: [],
                currentBet: 0,
                joinedAt: null
            }));

            await cashTables.updateOne(
                { _id: table._id },
                {
                    $set: {
                        seats: emptySeats,
                        currentHandId: null,
                        status: 'waiting',
                        dealerPosition: 0,
                        handsPlayed: 0,
                        updatedAt: new Date()
                    }
                }
            );

            // Also clear any active hands for this table
            if (table.currentHandId) {
                await hands.updateOne(
                    { _id: table.currentHandId },
                    {
                        $set: {
                            status: 'complete',
                            endedAt: new Date(),
                            notes: 'Force reset by player'
                        }
                    }
                );
            }

            clearedTables.push({
                tableId: table._id.toString(),
                tableName: table.name,
                chipsCashedOut: chipStack
            });
        }

        // Get updated balance
        const updatedUser = await users.findOne({ _id: new ObjectId(user.userId) });

        return res.status(200).json({
            success: true,
            message: `Cleared ${clearedTables.length} table(s)`,
            tablesCleared: clearedTables.length,
            tables: clearedTables,
            totalCashOut,
            newBalance: updatedUser?.coinBalance || 0
        });

    } catch (error) {
        console.error('Reset seat error:', error);
        return res.status(500).json({ error: 'Failed to reset seat: ' + error.message });
    }
}
