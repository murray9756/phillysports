// Tournament Registration API
// POST: Register for a tournament (spend buyIn)

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { spendCoins } from '../../lib/coins.js';
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
    const users = await getCollection('users');

    // Get tournament
    const tournament = await tournaments.findOne({
      _id: new ObjectId(tournamentId)
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check tournament is in registration phase
    if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
      return res.status(400).json({ error: 'Tournament is not accepting registrations' });
    }

    // Check if tournament is full
    if (tournament.registeredPlayers.length >= tournament.maxPlayers) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    // Check if user is already registered
    const userId = new ObjectId(user.userId);
    const isRegistered = tournament.registeredPlayers.some(
      id => id.toString() === user.userId
    );

    if (isRegistered) {
      return res.status(400).json({ error: 'You are already registered for this tournament' });
    }

    // Get user's current balance
    const userDoc = await users.findOne({ _id: userId });

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough coins for buy-in
    if (tournament.buyIn > 0 && (userDoc.coinBalance || 0) < tournament.buyIn) {
      return res.status(400).json({
        error: 'Insufficient Diehard Dollars',
        required: tournament.buyIn,
        balance: userDoc.coinBalance || 0
      });
    }

    // Spend coins for buy-in (if not a freeroll)
    let newBalance = userDoc.coinBalance || 0;
    if (tournament.buyIn > 0) {
      try {
        newBalance = await spendCoins(
          user.userId,
          tournament.buyIn,
          'poker_buyin',
          `Tournament buy-in: ${tournament.name}`,
          { tournamentId: tournament._id }
        );
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    // Register user for tournament
    const result = await tournaments.findOneAndUpdate(
      {
        _id: tournament._id,
        status: TOURNAMENT_STATUS.REGISTRATION,
        'registeredPlayers': { $ne: userId }
      },
      {
        $push: { registeredPlayers: userId },
        $inc: { prizePool: tournament.buyIn },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      // Refund if registration failed
      if (tournament.buyIn > 0) {
        const { addCoins } = await import('../../lib/coins.js');
        await addCoins(
          user.userId,
          tournament.buyIn,
          'poker_refund',
          `Registration failed refund: ${tournament.name}`,
          { tournamentId: tournament._id }
        );
      }
      return res.status(400).json({ error: 'Registration failed. Please try again.' });
    }

    // Create registration record
    const registrations = await getCollection('tournament_registrations');
    await registrations.insertOne({
      tournamentId: tournament._id,
      userId,
      registeredAt: new Date(),
      buyIn: tournament.buyIn,
      status: 'registered',
      chipCount: tournament.startingChips,
      finalPosition: null,
      prizeWon: 0
    });

    // Check if tournament should auto-start (sit-n-go when full)
    if (tournament.type === 'sit_n_go' &&
        result.registeredPlayers.length >= tournament.maxPlayers) {
      // Tournament is full - mark for starting
      await tournaments.updateOne(
        { _id: tournament._id },
        { $set: { shouldStart: true } }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Registered for ${tournament.name}`,
      tournament: {
        _id: result._id,
        name: result.name,
        registeredCount: result.registeredPlayers.length,
        maxPlayers: result.maxPlayers,
        prizePool: result.prizePool,
        status: result.status
      },
      buyInPaid: tournament.buyIn,
      newBalance
    });

  } catch (error) {
    console.error('Tournament registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
