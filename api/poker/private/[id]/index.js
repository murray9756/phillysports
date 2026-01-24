// GET /api/poker/private/[id] - Get private poker game details
import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';

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

        // Check if user is a player in the game
        const player = game.players.find(p => p.odIdStr === userIdStr);
        if (!player) {
            return res.status(403).json({ error: 'You are not a player in this game' });
        }

        // Format response
        const response = {
            _id: game._id.toString(),
            name: game.name,
            status: game.status,
            inviteCode: player.isHost ? game.inviteCode : null,
            isHost: player.isHost,
            settings: game.settings,
            playerCount: game.playerCount,
            players: game.players.map(p => ({
                odIdStr: p.odIdStr,
                username: p.username,
                isHost: p.isHost,
                seatPosition: p.seatPosition,
                chips: p.chips,
                status: p.status,
                isCurrentUser: p.odIdStr === userIdStr
            })),
            gameState: game.gameState,
            settlements: player.isHost ? game.settlements : {
                playerSummary: game.settlements?.playerSummary || {}
            },
            createdByUsername: game.createdByUsername,
            createdAt: game.createdAt,
            startedAt: game.startedAt,
            updatedAt: game.updatedAt
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Get private game error:', error);
        return res.status(500).json({ error: 'Failed to load game' });
    }
}
