// POST /api/poker/private/join - Join a private poker game via invite code
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { spendCoins, getBalance } from '../../lib/coins.js';
import { rateLimit } from '../../lib/rateLimit.js';

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

    // Rate limit
    const allowed = await rateLimit(req, res, 'standard');
    if (!allowed) return;

    try {
        // Require authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { inviteCode } = req.body;

        if (!inviteCode || inviteCode.trim().length !== 6) {
            return res.status(400).json({ error: 'Invalid invite code' });
        }

        const code = inviteCode.trim().toUpperCase();
        const privateGames = await getCollection('private_poker_games');

        // Find the game
        const game = await privateGames.findOne({
            inviteCode: code,
            status: { $in: ['waiting', 'in_progress'] }
        });

        if (!game) {
            return res.status(404).json({ error: 'Game not found. Check the invite code and try again.' });
        }

        // Check if game is full
        if (game.playerCount >= game.settings.maxPlayers) {
            return res.status(400).json({ error: 'This game is full' });
        }

        // Check if user is already in the game
        const userId = user._id || user.userId;
        const userIdStr = userId.toString();
        const alreadyJoined = game.players.some(p => p.odIdStr === userIdStr);

        if (alreadyJoined) {
            return res.status(400).json({
                error: 'You are already in this game',
                gameId: game._id.toString(),
                alreadyJoined: true
            });
        }

        // Check if game has already started
        if (game.status === 'in_progress') {
            return res.status(400).json({ error: 'This game has already started' });
        }

        // Handle buy-in if required
        if (game.settings.buyIn > 0) {
            const balance = await getBalance(userId);
            if (balance < game.settings.buyIn) {
                return res.status(400).json({
                    error: `Insufficient Diehard Dollars. This game requires ${game.settings.buyIn} DD to join.`,
                    required: game.settings.buyIn,
                    current: balance
                });
            }

            // Deduct buy-in
            await spendCoins(
                userId,
                game.settings.buyIn,
                'poker_buyin',
                `Buy-in for private game: ${game.name}`,
                { gameId: game._id.toString() }
            );
        }

        // Add player to the game
        const newPlayer = {
            odId: new ObjectId(userId),
            odIdStr: userIdStr,
            username: user.username,
            joinedAt: new Date(),
            isHost: false
        };

        await privateGames.updateOne(
            { _id: game._id },
            {
                $push: { players: newPlayer },
                $inc: { playerCount: 1 },
                $set: { updatedAt: new Date() }
            }
        );

        return res.status(200).json({
            success: true,
            gameId: game._id.toString(),
            gameName: game.name,
            playerCount: game.playerCount + 1,
            maxPlayers: game.settings.maxPlayers,
            buyIn: game.settings.buyIn,
            message: `You've joined "${game.name}"!`
        });

    } catch (error) {
        console.error('Join private game error:', error);
        return res.status(500).json({ error: 'Failed to join game' });
    }
}
