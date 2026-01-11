// Start Tournament API
// POST: Start a tournament (when enough players registered)

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { startTournament } from '../../lib/poker/tournamentManager.js';
import { TOURNAMENT_STATUS } from '../../lib/poker/constants.js';
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
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID required' });
    }

    const tournaments = await getCollection('tournaments');

    // Get tournament
    const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check if tournament can be started
    if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
      return res.status(400).json({ error: 'Tournament is not in registration phase' });
    }

    if (tournament.registeredPlayers.length < tournament.minPlayers) {
      return res.status(400).json({
        error: `Need at least ${tournament.minPlayers} players to start`,
        current: tournament.registeredPlayers.length,
        required: tournament.minPlayers
      });
    }

    // For sit-n-go, anyone can start when minimum is met
    // For scheduled tournaments, check if it's time
    if (tournament.type === 'scheduled' && tournament.scheduledStart) {
      if (new Date() < new Date(tournament.scheduledStart)) {
        return res.status(400).json({
          error: 'Tournament has not reached scheduled start time',
          scheduledStart: tournament.scheduledStart
        });
      }
    }

    // Start the tournament
    const result = await startTournament(tournamentId);

    return res.status(200).json({
      success: true,
      message: 'Tournament started!',
      ...result
    });

  } catch (error) {
    console.error('Start tournament error:', error);
    return res.status(400).json({ error: error.message || 'Failed to start tournament' });
  }
}
