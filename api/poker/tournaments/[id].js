// Tournament Details API
// GET: Get full tournament details including tables

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
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
    const { id: tournamentId } = req.query;
    const user = await authenticate(req);

    const tournaments = await getCollection('tournaments');
    const tables = await getCollection('poker_tables');
    const users = await getCollection('users');
    const registrations = await getCollection('tournament_registrations');

    // Get tournament
    const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get registered players with usernames
    let registeredPlayers = [];
    if (tournament.registeredPlayers.length > 0) {
      const playerDocs = await users.find({
        _id: { $in: tournament.registeredPlayers }
      }).project({ _id: 1, username: 1 }).toArray();

      registeredPlayers = playerDocs.map(p => ({
        odPlayerId: p._id,
        username: p.username
      }));
    }

    // Get tables if tournament is running
    let tournamentTables = [];
    if (tournament.tableIds && tournament.tableIds.length > 0) {
      const tableDocs = await tables.find({
        _id: { $in: tournament.tableIds }
      }).toArray();

      tournamentTables = tableDocs.map(t => ({
        _id: t._id,
        status: t.status,
        playerCount: t.seats.filter(s => s.playerId && s.chipStack > 0).length,
        maxSeats: t.maxSeats,
        handsPlayed: t.handsPlayed || 0,
        // Include seat info
        seats: t.seats.map(s => ({
          position: s.position,
          username: s.username,
          chipStack: s.chipStack,
          isActive: s.isActive
        }))
      }));
    }

    // Check if current user is registered and get their status
    let userStatus = null;
    if (user) {
      const isRegistered = tournament.registeredPlayers.some(
        id => id.toString() === user.userId
      );

      if (isRegistered) {
        const reg = await registrations.findOne({
          tournamentId: tournament._id,
          userId: new ObjectId(user.userId)
        });

        userStatus = {
          isRegistered: true,
          status: reg?.status || 'registered',
          finalPosition: reg?.finalPosition,
          prizeWon: reg?.prizeWon
        };

        // Find user's table if tournament is running
        if (tournament.status === 'running') {
          for (const table of tournamentTables) {
            const userSeat = table.seats.find(s =>
              s.username === (await users.findOne({ _id: new ObjectId(user.userId) }))?.username
            );
            if (userSeat) {
              userStatus.tableId = table._id;
              userStatus.seat = userSeat;
              break;
            }
          }
        }
      }
    }

    // Calculate time until next blind level
    let nextBlindIn = null;
    if (tournament.status === 'running' && tournament.nextBlindIncrease) {
      nextBlindIn = Math.max(0, new Date(tournament.nextBlindIncrease) - new Date());
    }

    const response = {
      _id: tournament._id,
      name: tournament.name,
      type: tournament.type,
      status: tournament.status,
      buyIn: tournament.buyIn,
      prizePool: tournament.prizePool,
      prizeStructure: tournament.prizeStructure,
      maxPlayers: tournament.maxPlayers,
      minPlayers: tournament.minPlayers,
      registeredCount: tournament.registeredPlayers.length,
      registeredPlayers,
      startingChips: tournament.startingChips,
      blindStructure: tournament.blindStructure,
      currentBlindLevel: tournament.currentBlindLevel,
      currentBlinds: tournament.blindStructure[tournament.currentBlindLevel || 0],
      nextBlindIn,
      tables: tournamentTables,
      winners: tournament.winners,
      startedAt: tournament.startedAt,
      endedAt: tournament.endedAt,
      createdAt: tournament.createdAt,
      userStatus
    };

    return res.status(200).json({
      success: true,
      tournament: response
    });

  } catch (error) {
    console.error('Tournament details error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
