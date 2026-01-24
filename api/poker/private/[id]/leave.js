// POST /api/poker/private/[id]/leave - Leave a private poker game
import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { addCoins } from '../../../lib/coins.js';

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

        // Check if user is a player
        const player = game.players.find(p => p.odIdStr === userIdStr);
        if (!player) {
            return res.status(400).json({ error: 'You are not in this game' });
        }

        // Can only leave if game hasn't started
        if (game.status === 'in_progress') {
            return res.status(400).json({ error: 'Cannot leave a game in progress' });
        }

        // If host leaves, cancel the game
        if (player.isHost) {
            // Refund buy-ins to all players
            if (game.settings.buyIn > 0) {
                for (const p of game.players) {
                    await addCoins(
                        new ObjectId(p.odIdStr),
                        game.settings.buyIn,
                        'poker_refund',
                        `Refund for cancelled game: ${game.name}`,
                        { gameId: game._id.toString() },
                        { skipMultiplier: true }
                    );
                }
            }

            // Mark game as cancelled
            await privateGames.updateOne(
                { _id: game._id },
                {
                    $set: {
                        status: 'cancelled',
                        cancelledAt: new Date(),
                        cancelReason: 'Host left the game',
                        updatedAt: new Date()
                    }
                }
            );

            return res.status(200).json({
                success: true,
                message: 'Game cancelled. All buy-ins have been refunded.',
                gameCancelled: true
            });
        }

        // Non-host player leaving
        // Refund their buy-in
        if (game.settings.buyIn > 0) {
            await addCoins(
                userId,
                game.settings.buyIn,
                'poker_refund',
                `Refund for leaving game: ${game.name}`,
                { gameId: game._id.toString() },
                { skipMultiplier: true }
            );
        }

        // Remove player from game
        await privateGames.updateOne(
            { _id: game._id },
            {
                $pull: { players: { odIdStr: userIdStr } },
                $inc: { playerCount: -1 },
                $set: { updatedAt: new Date() }
            }
        );

        return res.status(200).json({
            success: true,
            message: game.settings.buyIn > 0
                ? `You've left the game. ${game.settings.buyIn} DD has been refunded.`
                : "You've left the game."
        });

    } catch (error) {
        console.error('Leave private game error:', error);
        return res.status(500).json({ error: 'Failed to leave game' });
    }
}
