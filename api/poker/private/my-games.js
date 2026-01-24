// GET /api/poker/private/my-games - List user's private poker games
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
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
        // Require authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = user._id || user.userId;
        const userIdStr = userId.toString();

        const privateGames = await getCollection('private_poker_games');

        // Find games where user is a player
        const games = await privateGames.find({
            'players.odIdStr': userIdStr,
            status: { $in: ['waiting', 'in_progress'] }
        }).sort({ updatedAt: -1 }).toArray();

        // Format response
        const formattedGames = games.map(game => {
            const player = game.players.find(p => p.odIdStr === userIdStr);
            return {
                _id: game._id.toString(),
                name: game.name,
                inviteCode: player?.isHost ? game.inviteCode : null, // Only host can see invite code
                status: game.status,
                isHost: player?.isHost || false,
                playerCount: game.playerCount,
                maxPlayers: game.settings.maxPlayers,
                buyIn: game.settings.buyIn,
                smallBlind: game.settings.smallBlind,
                bigBlind: game.settings.bigBlind,
                createdByUsername: game.createdByUsername,
                createdAt: game.createdAt,
                updatedAt: game.updatedAt,
                players: game.players.map(p => ({
                    username: p.username,
                    isHost: p.isHost
                }))
            };
        });

        return res.status(200).json({
            games: formattedGames,
            count: formattedGames.length
        });

    } catch (error) {
        console.error('My games error:', error);
        return res.status(500).json({ error: 'Failed to load games' });
    }
}
