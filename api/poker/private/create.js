// POST /api/poker/private/create - Create a private poker game (Premium only)
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserBenefits } from '../../lib/subscriptions.js';
import { rateLimit } from '../../lib/rateLimit.js';

// Generate a random 6-character invite code
function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded I, O, 0, 1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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
    const allowed = await rateLimit(req, res, 'sensitive');
    if (!allowed) return;

    try {
        // Require authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check premium status
        const benefits = await getUserBenefits(user._id || user.userId);
        if (!benefits.canCreatePrivatePoker) {
            return res.status(403).json({
                error: 'Creating private games requires Diehard Premium',
                upgradeCta: true
            });
        }

        const { name, maxPlayers, buyIn, smallBlind, bigBlind } = req.body;

        // Validate inputs
        if (!name || name.trim().length < 3) {
            return res.status(400).json({ error: 'Game name must be at least 3 characters' });
        }

        const validMaxPlayers = Math.min(Math.max(parseInt(maxPlayers) || 6, 2), 8);
        const validBuyIn = Math.max(parseInt(buyIn) || 0, 0);
        const validSmallBlind = Math.max(parseInt(smallBlind) || 5, 1);
        const validBigBlind = Math.max(parseInt(bigBlind) || 10, validSmallBlind * 2);

        // Generate unique invite code
        const privateGames = await getCollection('private_poker_games');
        let inviteCode;
        let attempts = 0;

        do {
            inviteCode = generateInviteCode();
            const existing = await privateGames.findOne({ inviteCode, status: { $ne: 'completed' } });
            if (!existing) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            return res.status(500).json({ error: 'Failed to generate invite code. Please try again.' });
        }

        // Create the game
        const game = {
            name: name.trim(),
            createdBy: user._id,
            createdByUsername: user.username,
            inviteCode,
            status: 'waiting', // waiting, in_progress, completed
            settings: {
                maxPlayers: validMaxPlayers,
                buyIn: validBuyIn,
                smallBlind: validSmallBlind,
                bigBlind: validBigBlind,
                startingChips: validBuyIn > 0 ? validBuyIn * 10 : 1000, // 10x buy-in or 1000 for free
                variant: 'texas_holdem'
            },
            players: [{
                odId: user._id,
                odIdStr: user._id.toString(),
                username: user.username,
                joinedAt: new Date(),
                isHost: true
            }],
            playerCount: 1,
            settlements: {
                enabled: true,
                ledger: [],
                playerSummary: {}
            },
            gameState: null, // Will be set when game starts
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await privateGames.insertOne(game);

        return res.status(201).json({
            success: true,
            gameId: result.insertedId.toString(),
            inviteCode,
            message: `Game "${name}" created! Share the invite code with friends.`
        });

    } catch (error) {
        console.error('Create private game error:', error);
        return res.status(500).json({ error: 'Failed to create game' });
    }
}
