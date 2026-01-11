// Tournament Manager
// Handles tournament lifecycle: starting, seating, eliminations, prizes

import { ObjectId } from 'mongodb';
import { getCollection } from '../mongodb.js';
import { addCoins } from '../coins.js';
import { startNewHand } from './gameEngine.js';
import { TOURNAMENT_STATUS, GAME_STATUS, DEFAULTS } from './constants.js';
import { broadcastTableUpdate, PUSHER_EVENTS } from '../pusher.js';
import { fillTournamentWithBots } from './botManager.js';

/**
 * Start a tournament (create tables and seat players)
 */
export async function startTournament(tournamentId, options = {}) {
  const { fillWithBots = true } = options;
  const tournaments = await getCollection('tournaments');
  const tables = await getCollection('poker_tables');
  const users = await getCollection('users');

  let tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament) throw new Error('Tournament not found');

  if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
    throw new Error('Tournament is not in registration phase');
  }

  // Fill empty seats with bots to ensure tournament can always start
  if (fillWithBots) {
    const currentPlayerCount = tournament.registeredPlayers?.length || 0;
    if (currentPlayerCount < tournament.maxPlayers) {
      try {
        await fillTournamentWithBots(tournamentId, tournament.maxPlayers);
        // Refresh tournament data after adding bots
        tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
      } catch (e) {
        console.error('Error filling tournament with bots:', e);
      }
    }
  }

  if (tournament.registeredPlayers.length < tournament.minPlayers) {
    throw new Error(`Need at least ${tournament.minPlayers} players to start`);
  }

  // Get registered players with usernames
  const playerDocs = await users.find({
    _id: { $in: tournament.registeredPlayers }
  }).toArray();

  const players = playerDocs.map(p => ({
    playerId: p._id,
    username: p.username,
    chipStack: tournament.startingChips
  }));

  // Shuffle players randomly for seating
  shuffleArray(players);

  // Create table(s) and seat players
  const playersPerTable = Math.min(tournament.maxPlayers, 9);
  const numTables = Math.ceil(players.length / playersPerTable);

  const tableIds = [];
  let playerIndex = 0;

  for (let t = 0; t < numTables; t++) {
    const tablePlayers = [];
    const playersForThisTable = Math.min(
      playersPerTable,
      players.length - playerIndex
    );

    // Create seats array
    const seats = [];
    for (let i = 0; i < playersPerTable; i++) {
      if (playerIndex < players.length && tablePlayers.length < playersForThisTable) {
        const player = players[playerIndex];
        seats.push({
          position: i,
          playerId: player.playerId,
          username: player.username,
          chipStack: player.chipStack,
          isActive: true,
          isSittingOut: false,
          lastAction: null,
          cards: [],
          currentBet: 0
        });
        tablePlayers.push(player);
        playerIndex++;
      } else {
        seats.push({
          position: i,
          playerId: null,
          username: null,
          chipStack: 0,
          isActive: false,
          isSittingOut: false,
          lastAction: null,
          cards: [],
          currentBet: 0
        });
      }
    }

    // Create table
    const table = {
      tournamentId: tournament._id,
      status: GAME_STATUS.ACTIVE,
      maxSeats: playersPerTable,
      seats,
      dealerPosition: Math.floor(Math.random() * tablePlayers.length),
      currentHandId: null,
      handsPlayed: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await tables.insertOne(table);
    tableIds.push(result.insertedId);
  }

  // Update tournament
  await tournaments.updateOne(
    { _id: tournament._id },
    {
      $set: {
        status: TOURNAMENT_STATUS.RUNNING,
        tableIds,
        startedAt: new Date(),
        currentBlindLevel: 0,
        nextBlindIncrease: new Date(Date.now() + (tournament.blindStructure[0]?.duration || 300) * 1000),
        updatedAt: new Date()
      }
    }
  );

  // Update registrations
  const registrations = await getCollection('tournament_registrations');
  await registrations.updateMany(
    { tournamentId: tournament._id, status: 'registered' },
    { $set: { status: 'playing' } }
  );

  // Start first hand at each table
  for (const tableId of tableIds) {
    try {
      const blinds = tournament.blindStructure[0];
      await startNewHand(tableId.toString(), {
        small: blinds.smallBlind,
        big: blinds.bigBlind,
        ante: blinds.ante || 0
      });
    } catch (e) {
      console.error('Error starting first hand:', e);
    }
  }

  return {
    tournamentId: tournament._id,
    tableIds,
    playerCount: players.length,
    tableCount: tableIds.length
  };
}

/**
 * Eliminate a player from tournament
 */
export async function eliminatePlayer(tournamentId, playerId) {
  const tournaments = await getCollection('tournaments');
  const tables = await getCollection('poker_tables');
  const registrations = await getCollection('tournament_registrations');

  const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament) throw new Error('Tournament not found');

  // Find remaining players
  const remainingPlayers = await getTournamentPlayerCount(tournamentId);

  // Update registration
  await registrations.updateOne(
    { tournamentId: new ObjectId(tournamentId), userId: new ObjectId(playerId) },
    {
      $set: {
        status: 'eliminated',
        finalPosition: remainingPlayers,
        eliminatedAt: new Date()
      }
    }
  );

  // Find the table and get player info before removing
  const playerTable = await tables.findOne({
    tournamentId: new ObjectId(tournamentId),
    'seats.playerId': new ObjectId(playerId)
  });
  const playerSeat = playerTable?.seats.find(s => s.playerId?.toString() === playerId);
  const playerUsername = playerSeat?.username;

  // Remove from table
  await tables.updateOne(
    {
      tournamentId: new ObjectId(tournamentId),
      'seats.playerId': new ObjectId(playerId)
    },
    {
      $set: {
        'seats.$.playerId': null,
        'seats.$.username': null,
        'seats.$.chipStack': 0,
        'seats.$.isActive': false
      }
    }
  );

  // Broadcast elimination to all tournament tables
  if (tournament.tableIds) {
    for (const tableId of tournament.tableIds) {
      broadcastTableUpdate(tableId.toString(), PUSHER_EVENTS.PLAYER_ELIMINATED, {
        playerId,
        username: playerUsername,
        position: remainingPlayers,
        remainingPlayers: remainingPlayers - 1
      });
    }
  }

  // Check if tournament is complete
  if (remainingPlayers <= tournament.prizeStructure.length) {
    await checkTournamentComplete(tournamentId);
  }

  return { eliminated: true, position: remainingPlayers };
}

/**
 * Get count of remaining players in tournament
 */
export async function getTournamentPlayerCount(tournamentId) {
  const tables = await getCollection('poker_tables');

  const result = await tables.aggregate([
    { $match: { tournamentId: new ObjectId(tournamentId) } },
    { $unwind: '$seats' },
    { $match: { 'seats.playerId': { $ne: null }, 'seats.chipStack': { $gt: 0 } } },
    { $count: 'playerCount' }
  ]).toArray();

  return result[0]?.playerCount || 0;
}

/**
 * Check if tournament is complete and distribute prizes
 */
export async function checkTournamentComplete(tournamentId) {
  const tournaments = await getCollection('tournaments');
  const tables = await getCollection('poker_tables');

  const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament || tournament.status === TOURNAMENT_STATUS.COMPLETED) {
    return false;
  }

  const remainingPlayers = await getTournamentPlayerCount(tournamentId);

  if (remainingPlayers <= 1) {
    // Tournament is complete - distribute prizes
    await distributePrizes(tournamentId);
    return true;
  }

  return false;
}

/**
 * Distribute prizes to winners
 */
export async function distributePrizes(tournamentId) {
  const tournaments = await getCollection('tournaments');
  const registrations = await getCollection('tournament_registrations');
  const tables = await getCollection('poker_tables');

  const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament) throw new Error('Tournament not found');

  // Get final standings (remaining player is 1st)
  const activeTables = await tables.find({ tournamentId: tournament._id }).toArray();
  const winners = [];

  // Find the last remaining player (1st place)
  for (const table of activeTables) {
    for (const seat of table.seats) {
      if (seat.playerId && seat.chipStack > 0) {
        winners.push({
          odPlayerId: seat.playerId,
          username: seat.username,
          place: 1,
          chipCount: seat.chipStack
        });
      }
    }
  }

  // Get eliminated players in order of elimination (most recent = highest place)
  const eliminatedPlayers = await registrations.find({
    tournamentId: tournament._id,
    status: 'eliminated'
  }).sort({ eliminatedAt: -1 }).toArray();

  let place = 2;
  for (const player of eliminatedPlayers) {
    winners.push({
      playerId: player.userId,
      place,
      chipCount: 0
    });
    place++;
  }

  // Sort by place
  winners.sort((a, b) => a.place - b.place);

  // Calculate and distribute prizes
  const prizeWinners = [];
  for (const structure of tournament.prizeStructure) {
    const winner = winners.find(w => w.place === structure.place);
    if (winner) {
      const prize = Math.floor(tournament.prizePool * (structure.percentage / 100));
      if (prize > 0) {
        // Award coins
        await addCoins(
          winner.playerId.toString(),
          prize,
          'poker_prize',
          `Tournament prize: ${tournament.name} - ${getOrdinal(structure.place)} place`,
          { tournamentId: tournament._id, place: structure.place }
        );

        prizeWinners.push({
          place: structure.place,
          userId: winner.playerId,
          prize
        });

        // Update registration
        await registrations.updateOne(
          { tournamentId: tournament._id, userId: winner.playerId },
          {
            $set: {
              status: 'finished',
              finalPosition: structure.place,
              prizeWon: prize
            }
          }
        );
      }
    }
  }

  // Update tournament
  await tournaments.updateOne(
    { _id: tournament._id },
    {
      $set: {
        status: TOURNAMENT_STATUS.COMPLETED,
        winners: prizeWinners,
        endedAt: new Date(),
        updatedAt: new Date()
      }
    }
  );

  // Mark tables as finished
  await tables.updateMany(
    { tournamentId: tournament._id },
    { $set: { status: GAME_STATUS.FINISHED } }
  );

  // Broadcast tournament complete to all tables
  if (tournament.tableIds) {
    for (const tableId of tournament.tableIds) {
      broadcastTableUpdate(tableId.toString(), PUSHER_EVENTS.TOURNAMENT_COMPLETE, {
        tournamentId: tournament._id.toString(),
        tournamentName: tournament.name,
        winners: prizeWinners,
        prizePool: tournament.prizePool
      });
    }
  }

  return prizeWinners;
}

/**
 * Advance blind level for a tournament
 */
export async function advanceBlindLevel(tournamentId) {
  const tournaments = await getCollection('tournaments');

  const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament) throw new Error('Tournament not found');

  const nextLevel = tournament.currentBlindLevel + 1;
  if (nextLevel >= tournament.blindStructure.length) {
    // Already at max level
    return tournament.blindStructure[tournament.currentBlindLevel];
  }

  const nextBlinds = tournament.blindStructure[nextLevel];
  const nextIncrease = new Date(Date.now() + (nextBlinds.duration || 300) * 1000);

  await tournaments.updateOne(
    { _id: tournament._id },
    {
      $set: {
        currentBlindLevel: nextLevel,
        nextBlindIncrease: nextIncrease,
        updatedAt: new Date()
      }
    }
  );

  return nextBlinds;
}

/**
 * Get current blinds for a tournament
 */
export async function getCurrentBlinds(tournamentId) {
  const tournaments = await getCollection('tournaments');

  const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament) return null;

  return tournament.blindStructure[tournament.currentBlindLevel] || tournament.blindStructure[0];
}

/**
 * Balance tables (move players between tables if needed)
 */
export async function balanceTables(tournamentId) {
  const tables = await getCollection('poker_tables');

  const tournamentTables = await tables.find({
    tournamentId: new ObjectId(tournamentId),
    status: GAME_STATUS.ACTIVE
  }).toArray();

  if (tournamentTables.length <= 1) return;

  // Count players at each table
  const tableCounts = tournamentTables.map(t => ({
    tableId: t._id,
    players: t.seats.filter(s => s.playerId && s.chipStack > 0).length
  }));

  // Sort by player count
  tableCounts.sort((a, b) => a.players - b.players);

  const minPlayers = tableCounts[0].players;
  const maxPlayers = tableCounts[tableCounts.length - 1].players;

  // If difference is more than 1, balance
  if (maxPlayers - minPlayers > 1) {
    // Move player from largest to smallest table
    // This is simplified - real implementation would be more sophisticated
    console.log('Tables need balancing:', { minPlayers, maxPlayers });
  }
}

// Helper functions
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
