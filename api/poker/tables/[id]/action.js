// Player Action API
// POST: Submit a player action (fold, check, call, bet, raise, all_in)

import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { processAction, getCurrentHand, getValidActions } from '../../../lib/poker/gameEngine.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  // Set CORS headers
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
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id: tableId } = req.query;
    const { action, amount = 0, handId } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    const tables = await getCollection('poker_tables');

    // Get table
    const table = await tables.findOne({ _id: new ObjectId(tableId) });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Verify user is at this table
    const userSeat = table.seats.find(s =>
      s.playerId && s.playerId.toString() === user.userId
    );
    if (!userSeat) {
      return res.status(403).json({ error: 'You are not seated at this table' });
    }

    // Get current hand
    const hand = await getCurrentHand(tableId);
    if (!hand) {
      return res.status(400).json({ error: 'No active hand' });
    }

    // Verify hand ID matches (prevents stale actions)
    if (handId && hand._id.toString() !== handId) {
      return res.status(400).json({ error: 'Hand has changed. Please refresh.' });
    }

    // Verify it's user's turn
    const player = hand.players.find(p => p.playerId.toString() === user.userId);
    if (!player) {
      return res.status(400).json({ error: 'You are not in this hand' });
    }

    if (hand.actingPosition !== player.position) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    // Validate action
    const validActions = getValidActions(hand, player);
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action: ${action}`,
        validActions
      });
    }

    // Process the action
    const result = await processAction(hand._id.toString(), user.userId, action, amount);

    return res.status(200).json({
      success: true,
      action: result.action,
      amount: result.amount,
      hand: result.hand,
      isHandComplete: result.isHandComplete
    });

  } catch (error) {
    console.error('Action error:', error);
    return res.status(400).json({ error: error.message || 'Action failed' });
  }
}
