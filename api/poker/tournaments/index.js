// Tournament List API
// GET: List available tournaments
// POST: Create a new tournament (admin only)

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { BLIND_STRUCTURES, PRIZE_STRUCTURES, DEFAULTS, TOURNAMENT_STATUS } from '../../lib/poker/constants.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return await listTournaments(req, res);
    } else if (req.method === 'POST') {
      return await createTournament(req, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Tournament API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function listTournaments(req, res) {
  const user = await authenticate(req);
  const tournaments = await getCollection('tournaments');

  const { status, type, limit = 20 } = req.query;

  // Build query
  const query = {};
  if (status) {
    query.status = status;
  } else {
    // Default: show registration open and running tournaments
    query.status = { $in: [TOURNAMENT_STATUS.REGISTRATION, TOURNAMENT_STATUS.RUNNING] };
  }
  if (type) {
    query.type = type;
  }

  const tournamentList = await tournaments
    .find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .toArray();

  // Add user registration status if authenticated
  const response = tournamentList.map(t => {
    const isRegistered = user && t.registeredPlayers?.some(
      id => id.toString() === user.userId
    );
    return {
      _id: t._id,
      name: t.name,
      type: t.type,
      status: t.status,
      buyIn: t.buyIn,
      prizePool: t.prizePool,
      prizeStructure: t.prizeStructure,
      maxPlayers: t.maxPlayers,
      minPlayers: t.minPlayers,
      registeredCount: t.registeredPlayers?.length || 0,
      startingChips: t.startingChips,
      blindStructure: t.blindStructure?.[0], // Just first level for preview
      scheduledStart: t.scheduledStart,
      startedAt: t.startedAt,
      isRegistered,
      createdAt: t.createdAt
    };
  });

  return res.status(200).json({
    success: true,
    tournaments: response
  });
}

async function createTournament(req, res) {
  const user = await authenticate(req);

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user is admin
  const users = await getCollection('users');
  const userDoc = await users.findOne({ _id: new ObjectId(user.userId) });

  if (!userDoc?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const {
    name,
    type = 'sit_n_go',
    buyIn = 100,
    maxPlayers = 9,
    minPlayers = 3,
    startingChips = DEFAULTS.STARTING_CHIPS,
    blindStructureType = 'quick',
    scheduledStart = null
  } = req.body;

  // Validation
  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: 'Tournament name must be at least 3 characters' });
  }

  if (buyIn < 0 || buyIn > 10000) {
    return res.status(400).json({ error: 'Buy-in must be between 0 and 10000' });
  }

  if (maxPlayers < 2 || maxPlayers > 9) {
    return res.status(400).json({ error: 'Max players must be between 2 and 9' });
  }

  // Get blind structure
  const blindStructure = BLIND_STRUCTURES[blindStructureType] || BLIND_STRUCTURES.quick;

  // Get prize structure based on player count
  const prizeStructure = PRIZE_STRUCTURES[maxPlayers] || PRIZE_STRUCTURES[9];

  const tournaments = await getCollection('tournaments');

  const tournament = {
    name: name.trim(),
    type,
    status: TOURNAMENT_STATUS.REGISTRATION,
    buyIn,
    prizePool: 0, // Will increase as players register
    prizeStructure,
    maxPlayers,
    minPlayers,
    registeredPlayers: [],
    startingChips,
    blindStructure,
    currentBlindLevel: 0,
    scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
    startedAt: null,
    endedAt: null,
    winners: [],
    tableIds: [],
    createdBy: new ObjectId(user.userId),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await tournaments.insertOne(tournament);

  return res.status(201).json({
    success: true,
    tournament: {
      ...tournament,
      _id: result.insertedId
    }
  });
}
