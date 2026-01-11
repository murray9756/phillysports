// Seed Test Tournaments API
// POST: Create sample tournaments for testing

import { getCollection } from '../../lib/mongodb.js';
import { BLIND_STRUCTURES, PRIZE_STRUCTURES, DEFAULTS, TOURNAMENT_STATUS } from '../../lib/poker/constants.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tournaments = await getCollection('tournaments');

    // Check if we already have tournaments
    const existingCount = await tournaments.countDocuments({
      status: { $in: [TOURNAMENT_STATUS.REGISTRATION, TOURNAMENT_STATUS.RUNNING] }
    });

    if (existingCount >= 5) {
      return res.status(400).json({
        error: 'Already have active tournaments',
        count: existingCount
      });
    }

    // Create test tournaments
    const testTournaments = [
      {
        name: 'Philly Freeroll',
        type: 'sit_n_go',
        status: TOURNAMENT_STATUS.REGISTRATION,
        buyIn: 0,
        prizePool: 500, // House-funded freeroll
        prizeStructure: PRIZE_STRUCTURES[6],
        maxPlayers: 6,
        minPlayers: 3,
        registeredPlayers: [],
        startingChips: DEFAULTS.STARTING_CHIPS,
        blindStructure: BLIND_STRUCTURES.quick,
        currentBlindLevel: 0,
        scheduledStart: null,
        startedAt: null,
        endedAt: null,
        winners: [],
        tableIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Eagles Fan Tournament',
        type: 'sit_n_go',
        status: TOURNAMENT_STATUS.REGISTRATION,
        buyIn: 50,
        prizePool: 0,
        prizeStructure: PRIZE_STRUCTURES[6],
        maxPlayers: 6,
        minPlayers: 3,
        registeredPlayers: [],
        startingChips: DEFAULTS.STARTING_CHIPS,
        blindStructure: BLIND_STRUCTURES.quick,
        currentBlindLevel: 0,
        scheduledStart: null,
        startedAt: null,
        endedAt: null,
        winners: [],
        tableIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'High Roller Championship',
        type: 'sit_n_go',
        status: TOURNAMENT_STATUS.REGISTRATION,
        buyIn: 500,
        prizePool: 0,
        prizeStructure: PRIZE_STRUCTURES[9],
        maxPlayers: 9,
        minPlayers: 3,
        registeredPlayers: [],
        startingChips: 3000,
        blindStructure: BLIND_STRUCTURES.standard,
        currentBlindLevel: 0,
        scheduledStart: null,
        startedAt: null,
        endedAt: null,
        winners: [],
        tableIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Lunch Break Turbo',
        type: 'sit_n_go',
        status: TOURNAMENT_STATUS.REGISTRATION,
        buyIn: 100,
        prizePool: 0,
        prizeStructure: PRIZE_STRUCTURES[6],
        maxPlayers: 6,
        minPlayers: 2,
        registeredPlayers: [],
        startingChips: 1000,
        blindStructure: BLIND_STRUCTURES.quick,
        currentBlindLevel: 0,
        scheduledStart: null,
        startedAt: null,
        endedAt: null,
        winners: [],
        tableIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await tournaments.insertMany(testTournaments);

    return res.status(201).json({
      success: true,
      message: `Created ${result.insertedCount} test tournaments`,
      tournaments: testTournaments.map((t, i) => ({
        _id: result.insertedIds[i],
        name: t.name,
        buyIn: t.buyIn,
        maxPlayers: t.maxPlayers
      }))
    });

  } catch (error) {
    console.error('Seed tournaments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
