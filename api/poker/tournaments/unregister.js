// Tournament Unregistration API
// POST: Unregister from a tournament (refund buyIn)

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { addCoins } from '../../lib/coins.js';
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
    const user = await authenticate(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID required' });
    }

    const tournaments = await getCollection('tournaments');
    const registrations = await getCollection('tournament_registrations');

    // Get tournament
    const tournament = await tournaments.findOne({
      _id: new ObjectId(tournamentId)
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check tournament is still in registration phase (can only unregister before it starts)
    if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
      return res.status(400).json({
        error: 'Cannot unregister from a tournament that has already started'
      });
    }

    const userId = new ObjectId(user.userId);

    // Check if user is registered
    const isRegistered = tournament.registeredPlayers.some(
      id => id.toString() === user.userId
    );

    if (!isRegistered) {
      return res.status(400).json({ error: 'You are not registered for this tournament' });
    }

    // Remove user from tournament
    const result = await tournaments.findOneAndUpdate(
      {
        _id: tournament._id,
        status: TOURNAMENT_STATUS.REGISTRATION
      },
      {
        $pull: { registeredPlayers: userId },
        $inc: { prizePool: -tournament.buyIn },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(400).json({ error: 'Unregistration failed. Please try again.' });
    }

    // Update registration record
    await registrations.updateOne(
      {
        tournamentId: tournament._id,
        userId
      },
      {
        $set: {
          status: 'unregistered',
          unregisteredAt: new Date()
        }
      }
    );

    // Refund buy-in (no multiplier - returning coins)
    let newBalance = 0;
    if (tournament.buyIn > 0) {
      newBalance = await addCoins(
        user.userId,
        tournament.buyIn,
        'poker_refund',
        `Tournament unregister refund: ${tournament.name}`,
        { tournamentId: tournament._id },
        { skipMultiplier: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Unregistered from ${tournament.name}`,
      refund: tournament.buyIn,
      newBalance
    });

  } catch (error) {
    console.error('Tournament unregistration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
