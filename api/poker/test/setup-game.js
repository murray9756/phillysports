// Test Setup API
// POST: Create bot players, register them for tournament, and start the game

import { getCollection } from '../../lib/mongodb.js';
import { addCoins } from '../../lib/coins.js';
import { startTournament } from '../../lib/poker/tournamentManager.js';
import { TOURNAMENT_STATUS } from '../../lib/poker/constants.js';
import { ObjectId } from 'mongodb';

const BOT_NAMES = [
  'PokerBot_Phil', 'CardShark_AI', 'BluffMaster3000', 'ChipStacker',
  'RiverRat_Bot', 'AllIn_Andy', 'FoldEmFrank', 'BettyBets',
  'CallStation_Cal', 'RaiseRicky', 'CheckChuck', 'LuckyLouie'
];

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
    // Note: Auth check removed for easier testing
    const { tournamentId, botCount = 2 } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID required' });
    }

    const users = await getCollection('users');
    const tournaments = await getCollection('tournaments');

    // Get tournament
    const tournament = await tournaments.findOne({ _id: new ObjectId(tournamentId) });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
      return res.status(400).json({ error: 'Tournament is not in registration phase' });
    }

    // Calculate how many bots we need
    const currentPlayers = tournament.registeredPlayers.length;
    const neededBots = Math.min(
      botCount,
      tournament.maxPlayers - currentPlayers
    );

    if (neededBots <= 0) {
      return res.status(400).json({ error: 'Tournament is already full' });
    }

    const createdBots = [];

    // Create bot players
    for (let i = 0; i < neededBots; i++) {
      const botName = BOT_NAMES[i % BOT_NAMES.length] + '_' + Date.now().toString(36).slice(-4);

      // Check if bot already exists
      let bot = await users.findOne({ username: botName });

      if (!bot) {
        // Create new bot user
        const botUser = {
          email: `${botName.toLowerCase()}@bot.phillysports.com`,
          username: botName,
          password: 'bot_password_not_used',
          isBot: true,
          coinBalance: 10000, // Give bots plenty of coins
          lifetimeCoins: 10000,
          badges: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await users.insertOne(botUser);
        bot = { ...botUser, _id: result.insertedId };
      } else {
        // Ensure bot has enough coins
        if ((bot.coinBalance || 0) < tournament.buyIn) {
          await users.updateOne(
            { _id: bot._id },
            { $set: { coinBalance: 10000 } }
          );
          bot.coinBalance = 10000;
        }
      }

      // Register bot for tournament
      if (tournament.buyIn > 0) {
        await users.updateOne(
          { _id: bot._id },
          { $inc: { coinBalance: -tournament.buyIn } }
        );
      }

      await tournaments.updateOne(
        { _id: tournament._id },
        {
          $push: { registeredPlayers: bot._id },
          $inc: { prizePool: tournament.buyIn }
        }
      );

      // Create registration record
      const registrations = await getCollection('tournament_registrations');
      await registrations.insertOne({
        tournamentId: tournament._id,
        odUserId: bot._id,
        registeredAt: new Date(),
        buyIn: tournament.buyIn,
        status: 'registered',
        chipCount: tournament.startingChips,
        isBot: true
      });

      createdBots.push({
        odUserId: bot._id,
        username: bot.username
      });
    }

    // Get updated tournament
    const updatedTournament = await tournaments.findOne({ _id: tournament._id });
    const totalPlayers = updatedTournament.registeredPlayers.length;

    // Auto-start if we have enough players
    let gameStarted = false;
    let tableId = null;

    if (totalPlayers >= tournament.minPlayers) {
      try {
        const startResult = await startTournament(tournamentId);
        gameStarted = true;
        tableId = startResult.tableIds?.[0];
      } catch (e) {
        console.error('Auto-start failed:', e);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Created ${createdBots.length} bot players`,
      bots: createdBots,
      totalPlayers,
      minPlayers: tournament.minPlayers,
      gameStarted,
      tableId: tableId?.toString()
    });

  } catch (error) {
    console.error('Setup game error:', error);
    return res.status(500).json({ error: error.message || 'Setup failed' });
  }
}
