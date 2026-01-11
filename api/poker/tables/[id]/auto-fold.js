// Auto-Fold API
// POST: Automatically fold a player who has exceeded their time limit

import { getCollection } from '../../../lib/mongodb.js';
import { processAction, getCurrentHand } from '../../../lib/poker/gameEngine.js';
import { ObjectId } from 'mongodb';

// Action timeout in seconds (30 seconds default)
const ACTION_TIMEOUT = 30;

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

    // Get current hand
    const hand = await getCurrentHand(tableId);
    if (!hand) {
      return res.status(200).json({
        success: true,
        message: 'No active hand',
        autoFolded: false
      });
    }

    if (hand.status === 'complete') {
      return res.status(200).json({
        success: true,
        message: 'Hand is complete',
        autoFolded: false
      });
    }

    // Check if current player has exceeded time limit
    const lastActionTime = hand.lastActionAt || hand.createdAt;
    const timeSinceAction = (Date.now() - new Date(lastActionTime).getTime()) / 1000;

    if (timeSinceAction < ACTION_TIMEOUT) {
      return res.status(200).json({
        success: true,
        message: 'Player still has time',
        autoFolded: false,
        timeRemaining: Math.ceil(ACTION_TIMEOUT - timeSinceAction)
      });
    }

    // Find the acting player
    const actingPlayer = hand.players.find(p => p.position === hand.actingPosition);
    if (!actingPlayer) {
      return res.status(400).json({ error: 'No acting player found' });
    }

    // Check if player can check (no bet to call)
    const toCall = hand.currentBet - actingPlayer.currentRoundBet;
    const action = toCall > 0 ? 'fold' : 'check';

    // Execute the auto-action
    const result = await processAction(
      hand._id.toString(),
      actingPlayer.playerId.toString(),
      action,
      0
    );

    // Update hand with last action time
    await hands.updateOne(
      { _id: hand._id },
      { $set: { lastActionAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      autoFolded: true,
      action,
      playerId: actingPlayer.playerId.toString(),
      position: actingPlayer.position,
      isHandComplete: result.isHandComplete
    });

  } catch (error) {
    console.error('Auto-fold error:', error);
    return res.status(500).json({ error: error.message || 'Auto-fold failed' });
  }
}
