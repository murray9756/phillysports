// POST /api/poker/private/[id]/start - Start a private poker game (host only)
import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';

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
        // Require authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid game ID' });
        }

        const userId = user._id || user.userId;
        const userIdStr = userId.toString();

        const privateGames = await getCollection('private_poker_games');
        const game = await privateGames.findOne({ _id: new ObjectId(id) });

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Check if user is the host
        const hostPlayer = game.players.find(p => p.isHost);
        if (!hostPlayer || hostPlayer.odIdStr !== userIdStr) {
            return res.status(403).json({ error: 'Only the host can start the game' });
        }

        // Check if game is already in progress
        if (game.status !== 'waiting') {
            return res.status(400).json({ error: 'Game has already started' });
        }

        // Need at least 2 players to start
        if (game.playerCount < 2) {
            return res.status(400).json({ error: 'Need at least 2 players to start' });
        }

        // Initialize player chips and seats
        const playersWithChips = game.players.map((player, index) => ({
            ...player,
            seatPosition: index,
            chips: game.settings.startingChips,
            status: 'active',
            betAmount: 0
        }));

        // Initialize game state
        const initialGameState = {
            phase: 'preflop',
            pot: 0,
            communityCards: [],
            currentPlayerIndex: 2 % playersWithChips.length, // After blinds
            dealerIndex: 0,
            smallBlindIndex: 0,
            bigBlindIndex: 1 % playersWithChips.length,
            handNumber: 0,
            minBet: game.settings.bigBlind,
            lastRaise: game.settings.bigBlind
        };

        // Update the game
        await privateGames.updateOne(
            { _id: game._id },
            {
                $set: {
                    status: 'in_progress',
                    players: playersWithChips,
                    gameState: initialGameState,
                    startedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Game started!',
            gameId: game._id.toString()
        });

    } catch (error) {
        console.error('Start private game error:', error);
        return res.status(500).json({ error: 'Failed to start game' });
    }
}
