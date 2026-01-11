// Check Blinds API
// POST: Check if blinds need to increase and advance if needed

import { getCollection } from '../../lib/mongodb.js';
import { advanceBlindLevel } from '../../lib/poker/tournamentManager.js';
import { broadcastTableUpdate, PUSHER_EVENTS } from '../../lib/pusher.js';
import { TOURNAMENT_STATUS } from '../../lib/poker/constants.js';
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
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID required' });
    }

    const tournaments = await getCollection('tournaments');
    const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.status !== TOURNAMENT_STATUS.RUNNING) {
      return res.status(200).json({
        success: true,
        message: 'Tournament not running',
        advanced: false
      });
    }

    // Check if it's time to advance blinds
    const now = new Date();
    if (!tournament.nextBlindIncrease || now < new Date(tournament.nextBlindIncrease)) {
      // Not time yet
      const timeUntilNext = tournament.nextBlindIncrease
        ? Math.max(0, new Date(tournament.nextBlindIncrease) - now)
        : 0;

      return res.status(200).json({
        success: true,
        advanced: false,
        currentLevel: tournament.currentBlindLevel,
        currentBlinds: tournament.blindStructure[tournament.currentBlindLevel],
        timeUntilNextLevel: Math.floor(timeUntilNext / 1000)
      });
    }

    // Time to advance blinds
    const newBlinds = await advanceBlindLevel(tournamentId);

    // Broadcast blind increase to all tables
    if (tournament.tableIds) {
      for (const tableId of tournament.tableIds) {
        broadcastTableUpdate(tableId.toString(), PUSHER_EVENTS.BLIND_INCREASE, {
          level: tournament.currentBlindLevel + 1,
          smallBlind: newBlinds.smallBlind,
          bigBlind: newBlinds.bigBlind,
          ante: newBlinds.ante || 0
        });
      }
    }

    // Get updated tournament for next blind time
    const updatedTournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
    const timeUntilNext = updatedTournament.nextBlindIncrease
      ? Math.max(0, new Date(updatedTournament.nextBlindIncrease) - new Date())
      : 0;

    return res.status(200).json({
      success: true,
      advanced: true,
      newLevel: updatedTournament.currentBlindLevel,
      newBlinds,
      timeUntilNextLevel: Math.floor(timeUntilNext / 1000)
    });

  } catch (error) {
    console.error('Check blinds error:', error);
    return res.status(500).json({ error: error.message || 'Failed to check blinds' });
  }
}
