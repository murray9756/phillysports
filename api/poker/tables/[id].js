// Table State API
// GET: Get current table state

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getCurrentHand, sanitizeHandForPlayer } from '../../lib/poker/gameEngine.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id: tableId } = req.query;
    const user = await authenticate(req);

    const tables = await getCollection('poker_tables');
    const tournaments = await getCollection('tournaments');

    const table = await tables.findOne({ _id: new ObjectId(tableId) });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get tournament info if applicable
    let tournament = null;
    if (table.tournamentId) {
      tournament = await tournaments.findOne({ _id: table.tournamentId });
    }

    // Get current hand if exists
    let currentHand = null;
    if (table.currentHandId) {
      const hand = await getCurrentHand(tableId);
      if (hand && user) {
        currentHand = sanitizeHandForPlayer(hand, user.userId);
      } else if (hand) {
        // Non-authenticated view - hide all hole cards
        currentHand = sanitizeHandForPlayer(hand, 'spectator');
      }
    }

    // Check if user is at this table
    const userSeat = user ? table.seats.find(s =>
      s.playerId && s.playerId.toString() === user.userId
    ) : null;

    // Sanitize table data for response
    const tableState = {
      _id: table._id,
      tournamentId: table.tournamentId,
      status: table.status,
      maxSeats: table.maxSeats,
      dealerPosition: table.dealerPosition,
      handsPlayed: table.handsPlayed || 0,
      seats: table.seats.map(seat => ({
        position: seat.position,
        playerId: seat.playerId,
        username: seat.username,
        chipStack: seat.chipStack,
        isActive: seat.isActive,
        isSittingOut: seat.isSittingOut,
        lastAction: seat.lastAction,
        currentBet: seat.currentBet || 0,
        // Only show cards to the player who owns them (or during showdown)
        cards: (user && seat.playerId?.toString() === user.userId) ? seat.cards : null
      })),
      tournament: tournament ? {
        _id: tournament._id,
        name: tournament.name,
        buyIn: tournament.buyIn,
        prizePool: tournament.prizePool,
        prizeStructure: tournament.prizeStructure,
        currentBlindLevel: tournament.currentBlindLevel,
        blindStructure: tournament.blindStructure,
        registeredCount: tournament.registeredPlayers?.length || 0,
        maxPlayers: tournament.maxPlayers
      } : null,
      currentHand,
      userSeat: userSeat ? {
        position: userSeat.position,
        chipStack: userSeat.chipStack,
        cards: userSeat.cards
      } : null
    };

    // Get valid actions if it's user's turn
    let validActions = [];
    if (currentHand && userSeat && currentHand.actingPosition === userSeat.position) {
      const { getValidActions } = await import('../../lib/poker/gameEngine.js');
      const player = currentHand.players.find(p => p.position === userSeat.position);
      if (player && !player.isFolded && !player.isAllIn) {
        validActions = getValidActions(currentHand, player);
      }
    }

    return res.status(200).json({
      success: true,
      table: tableState,
      validActions,
      isYourTurn: currentHand && userSeat && currentHand.actingPosition === userSeat.position
    });

  } catch (error) {
    console.error('Table state error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
