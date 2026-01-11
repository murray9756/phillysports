// Pusher Server Integration
// Real-time event broadcasting for poker tables

import Pusher from 'pusher';

let pusherInstance = null;

/**
 * Get Pusher instance (singleton)
 */
export function getPusher() {
  if (!pusherInstance) {
    // Check for required environment variables
    if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY ||
        !process.env.PUSHER_SECRET || !process.env.PUSHER_CLUSTER) {
      console.warn('Pusher environment variables not configured - real-time updates disabled');
      return null;
    }

    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true
    });
  }
  return pusherInstance;
}

/**
 * Broadcast game state update to a table channel
 */
export async function broadcastTableUpdate(tableId, eventType, data) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(`table-${tableId}`, eventType, data);
  } catch (error) {
    console.error('Pusher broadcast error:', error);
  }
}

/**
 * Send private hole cards to a specific player
 */
export async function sendPrivateCards(userId, tableId, cards) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(`private-user-${userId}`, 'hole-cards', {
      tableId,
      cards
    });
  } catch (error) {
    console.error('Pusher private card error:', error);
  }
}

/**
 * Broadcast multiple events at once (more efficient)
 */
export async function broadcastBatch(events) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    // Pusher supports batch triggers
    await pusher.triggerBatch(events.map(e => ({
      channel: e.channel,
      name: e.event,
      data: e.data
    })));
  } catch (error) {
    console.error('Pusher batch broadcast error:', error);
  }
}

// Event types for consistency
export const PUSHER_EVENTS = {
  // Table events (public)
  GAME_STATE: 'game-state',
  PLAYER_ACTION: 'player-action',
  COMMUNITY_CARDS: 'community-cards',
  POT_UPDATE: 'pot-update',
  HAND_COMPLETE: 'hand-complete',
  NEW_HAND: 'new-hand',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  PLAYER_ELIMINATED: 'player-eliminated',
  BLIND_INCREASE: 'blind-increase',
  TOURNAMENT_COMPLETE: 'tournament-complete',

  // Private events (per user)
  HOLE_CARDS: 'hole-cards',
  YOUR_TURN: 'your-turn'
};
