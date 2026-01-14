// Reset ALL cash tables - admin endpoint
// POST: Delete all tables and recreate with current config (6-seat tables)

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { CASH_TABLE_CONFIG } from './index.js';

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

    // Auth optional for now - can be called to reset tables
    // const user = await authenticate(req);

    try {
        const cashTables = await getCollection('cash_tables');
        const hands = await getCollection('poker_hands');

        // Mark all cash game hands as complete
        await hands.updateMany(
            { tableType: 'cash', status: { $ne: 'complete' } },
            {
                $set: {
                    status: 'complete',
                    endedAt: new Date(),
                    notes: 'Table reset by admin'
                }
            }
        );

        // Delete all existing cash tables
        const deleteResult = await cashTables.deleteMany({});

        // Create new 6-seat tables
        const tableNames = ['The Linc', 'South Philly', 'Broad Street'];
        const newTables = [];

        for (const name of tableNames) {
            const seats = [];
            for (let i = 0; i < CASH_TABLE_CONFIG.maxSeats; i++) {
                seats.push({
                    position: i,
                    playerId: null,
                    username: null,
                    chipStack: 0,
                    isActive: false,
                    isSittingOut: false,
                    cards: [],
                    currentBet: 0,
                    joinedAt: null
                });
            }

            const table = {
                name,
                status: 'waiting',
                blinds: CASH_TABLE_CONFIG.blinds,
                buyIn: CASH_TABLE_CONFIG.buyIn,
                maxSeats: CASH_TABLE_CONFIG.maxSeats,
                dealerPosition: 0,
                currentHandId: null,
                handsPlayed: 0,
                seats,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            newTables.push(table);
        }

        await cashTables.insertMany(newTables);

        return res.status(200).json({
            success: true,
            message: `Deleted ${deleteResult.deletedCount} old tables, created ${newTables.length} new ${CASH_TABLE_CONFIG.maxSeats}-seat tables`,
            tablesDeleted: deleteResult.deletedCount,
            tablesCreated: newTables.length,
            maxSeats: CASH_TABLE_CONFIG.maxSeats
        });

    } catch (error) {
        console.error('Reset all tables error:', error);
        return res.status(500).json({ error: 'Failed to reset tables: ' + error.message });
    }
}
