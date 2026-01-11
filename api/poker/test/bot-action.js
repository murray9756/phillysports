// Bot Action API
// POST: Make a bot player take an action (auto-play)

import { getCollection } from '../../lib/mongodb.js';
import { getCurrentHand, processAction, getValidActions } from '../../lib/poker/gameEngine.js';
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
    const { tableId } = req.body;

    if (!tableId) {
      return res.status(400).json({ error: 'Table ID required' });
    }

    const tables = await getCollection('poker_tables');
    const users = await getCollection('users');

    // Get table
    const table = await tables.findOne({ _id: new ObjectId(tableId) });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get current hand
    const hand = await getCurrentHand(tableId);
    if (!hand) {
      return res.status(400).json({ error: 'No active hand', needsNewHand: true });
    }

    if (hand.status === 'complete') {
      return res.status(200).json({
        success: true,
        message: 'Hand is complete',
        handComplete: true
      });
    }

    // Find the player whose turn it is
    const actingPlayer = hand.players.find(p => p.position === hand.actingPosition);
    if (!actingPlayer) {
      return res.status(400).json({ error: 'No acting player found' });
    }

    // Check if acting player is a bot
    const actingUser = await users.findOne({ _id: actingPlayer.playerId });
    if (!actingUser) {
      return res.status(400).json({ error: 'Player not found' });
    }

    if (!actingUser.isBot) {
      return res.status(200).json({
        success: true,
        message: 'Waiting for human player',
        waitingFor: actingUser.username,
        position: hand.actingPosition,
        isBot: false
      });
    }

    // Bot AI: Choose an action
    const validActions = getValidActions(hand, actingPlayer);
    const { action, amount } = chooseBotAction(hand, actingPlayer, validActions);

    // Execute the action
    const result = await processAction(
      hand._id.toString(),
      actingPlayer.playerId.toString(),
      action,
      amount
    );

    return res.status(200).json({
      success: true,
      bot: actingUser.username,
      action,
      amount: result.amount,
      isHandComplete: result.isHandComplete
    });

  } catch (error) {
    console.error('Bot action error:', error);
    return res.status(500).json({ error: error.message || 'Bot action failed' });
  }
}

/**
 * Simple bot AI to choose an action
 */
function chooseBotAction(hand, player, validActions) {
  const toCall = hand.currentBet - player.currentRoundBet;
  const potOdds = toCall / (hand.pot + toCall);
  const chipRatio = player.chipStackCurrent / hand.pot;

  // Random factor for unpredictability
  const randomFactor = Math.random();

  // If we can check, usually check (60% of time)
  if (validActions.includes('check')) {
    if (randomFactor < 0.6) {
      return { action: 'check', amount: 0 };
    }
    // Sometimes bet when we can check
    if (validActions.includes('bet') && randomFactor > 0.8) {
      const betAmount = Math.floor(hand.pot * 0.5);
      return { action: 'bet', amount: Math.max(hand.minRaise, betAmount) };
    }
    return { action: 'check', amount: 0 };
  }

  // If there's a bet to call
  if (toCall > 0) {
    // Fold if the call is too expensive (more than 30% of our stack) and we're unlucky
    if (toCall > player.chipStackCurrent * 0.3 && randomFactor < 0.3) {
      if (validActions.includes('fold')) {
        return { action: 'fold', amount: 0 };
      }
    }

    // Usually call (60% of time)
    if (validActions.includes('call') && randomFactor < 0.7) {
      return { action: 'call', amount: 0 };
    }

    // Sometimes raise (20% of time if we have chips)
    if (validActions.includes('raise') && randomFactor > 0.8) {
      const raiseAmount = hand.currentBet + Math.floor(hand.pot * 0.5);
      return { action: 'raise', amount: raiseAmount };
    }

    // Go all-in occasionally (5% of time)
    if (validActions.includes('all_in') && randomFactor > 0.95) {
      return { action: 'all_in', amount: 0 };
    }

    // Default to calling
    if (validActions.includes('call')) {
      return { action: 'call', amount: 0 };
    }

    // If we can't call, go all-in or fold
    if (validActions.includes('all_in')) {
      return { action: 'all_in', amount: 0 };
    }
    if (validActions.includes('fold')) {
      return { action: 'fold', amount: 0 };
    }
  }

  // Default: first valid action
  return { action: validActions[0], amount: 0 };
}
