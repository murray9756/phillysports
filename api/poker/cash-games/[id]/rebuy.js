// Rebuy Cash Table API
// POST: Rebuy chips when busted

import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { spendCoins } from '../../../lib/coins.js';
import { ObjectId } from 'mongodb';
import { broadcastTableUpdate } from '../../../lib/pusher.js';
import { CASH_TABLE_CONFIG } from '../index.js';
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

        // Check if player has chips already
        if (seat.chipStack > 0) {
            return res.status(400).json({ error: 'Can only rebuy when chip stack is 0' });
        }

        // Check if hand is in progress (can't rebuy mid-hand if somehow still in)
        if (table.currentHandId) {
            const currentHand = await hands.findOne({ _id: table.currentHandId });
            if (currentHand && currentHand.status !== HAND_STATUS.COMPLETE) {
                const handPlayer = currentHand.players.find(p => p.playerId.toString() === user.userId);
                if (handPlayer && !handPlayer.isFolded && handPlayer.chipStackCurrent > 0) {
                    return res.status(400).json({ error: 'Cannot rebuy during active hand' });
                }
            }
        }

        // Get user details and check balance
        const userDoc = await users.findOne({ _id: new ObjectId(user.userId) });
        if (!userDoc) {
            return res.status(404).json({ error: 'User not found' });
        }

        const buyIn = CASH_TABLE_CONFIG.buyIn;
        if ((userDoc.coinBalance || 0) < buyIn) {
            return res.status(400).json({
                error: `Insufficient balance. Need ${buyIn} DD to rebuy.`,
                required: buyIn,
                current: userDoc.coinBalance || 0
            });
        }

        // Deduct rebuy amount
        await spendCoins(
            user.userId,
            buyIn,
            'cash_game_rebuy',
            `Cash game rebuy at ${table.name}`,
            { tableId: id }
        );

        // Add chips to seat
        await cashTables.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    [`seats.${seatIndex}.chipStack`]: buyIn,
                    [`seats.${seatIndex}.isActive`]: true,
                    updatedAt: new Date()
                }
            }
        );

        // Broadcast rebuy
        broadcastTableUpdate(id, 'player-rebuy', {
            playerId: user.userId,
            username: seat.username,
            position: seatIndex,
            chipStack: buyIn
        });

        // Check if we can start a new hand
        const updatedTable = await cashTables.findOne({ _id: new ObjectId(id) });
        const playersWithChips = updatedTable.seats.filter(s => s.playerId && s.chipStack > 0);

        let handStarted = false;
        if (playersWithChips.length >= 2 && !updatedTable.currentHandId) {
            // Can start a new hand - will be triggered by action.js startNextHand or frontend
            handStarted = true;
        }

        // Get updated balance
        const updatedUser = await users.findOne({ _id: new ObjectId(user.userId) });

        return res.status(200).json({
            success: true,
            message: 'Rebuy successful',
            chipStack: buyIn,
            newBalance: updatedUser?.coinBalance || 0,
            handStarted
        });

    } catch (error) {
        console.error('Rebuy error:', error);
        return res.status(500).json({ error: error.message || 'Failed to rebuy' });
    }
}
