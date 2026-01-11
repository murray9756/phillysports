// New Hand API
// POST: Start a new hand at a table

import { getCollection } from '../../../lib/mongodb.js';
import { startNewHand } from '../../../lib/poker/gameEngine.js';
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

  try {
    const { id: tableId } = req.query;

    if (!tableId) {
      return res.status(400).json({ error: 'Table ID required' });
    }

    const tables = await getCollection('poker_tables');
    const hands = await getCollection('poker_hands');

    // Get table
    const table = await tables.findOne({ _id: new ObjectId(tableId) });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check if there's an active hand
    const activeHand = await hands.findOne({
      tableId: table._id,
      status: { $nin: ['complete'] }
    });

    if (activeHand) {
      return res.status(400).json({
        error: 'Hand already in progress',
        handId: activeHand._id.toString(),
        status: activeHand.status
      });
    }

    // Check we have enough active players
    const activePlayers = table.seats.filter(s => s.playerId && s.chipStack > 0);
    if (activePlayers.length < 2) {
      return res.status(400).json({
        error: 'Not enough players with chips',
        activePlayers: activePlayers.length,
        required: 2
      });
    }

    // Start new hand
    const hand = await startNewHand(tableId);

    return res.status(200).json({
      success: true,
      handId: hand._id.toString(),
      handNumber: hand.handNumber,
      status: hand.status,
      pot: hand.pot,
      actingPosition: hand.actingPosition
    });

  } catch (error) {
    console.error('New hand error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start new hand' });
  }
}
