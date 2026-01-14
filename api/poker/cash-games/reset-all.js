// Reset ALL cash tables - admin endpoint
// POST: Clear all seats from all cash tables

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

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

        // Get all cash tables
        const tables = await cashTables.find({}).toArray();

        let tablesReset = 0;

        for (const table of tables) {
            // Create empty seats
            const emptySeats = [];
            for (let i = 0; i < (table.maxSeats || 2); i++) {
                emptySeats.push({
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

            // Reset the table
            await cashTables.updateOne(
                { _id: table._id },
                {
                    $set: {
                        seats: emptySeats,
                        currentHandId: null,
                        status: 'waiting',
                        dealerPosition: 0,
                        updatedAt: new Date()
                    }
                }
            );

            // Mark any hands as complete
            if (table.currentHandId) {
                await hands.updateOne(
                    { _id: table.currentHandId },
                    {
                        $set: {
                            status: 'complete',
                            endedAt: new Date(),
                            notes: 'Table reset by admin'
                        }
                    }
                );
            }

            tablesReset++;
        }

        return res.status(200).json({
            success: true,
            message: `Reset ${tablesReset} tables`,
            tablesReset
        });

    } catch (error) {
        console.error('Reset all tables error:', error);
        return res.status(500).json({ error: 'Failed to reset tables: ' + error.message });
    }
}
