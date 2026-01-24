// POST /api/poker/private/[id]/settlement/clear - Mark a debt as paid (creditor only)
import { ObjectId } from 'mongodb';
import { getCollection } from '../../../../lib/mongodb.js';
import { authenticate } from '../../../../lib/auth.js';
import { getUserBenefits } from '../../../../lib/subscriptions.js';

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
        const { debtorId } = req.body;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid game ID' });
        }

        if (!debtorId) {
            return res.status(400).json({ error: 'Debtor ID is required' });
        }

        const userId = user._id || user.userId;
        const userIdStr = userId.toString();

        // Check premium status - only premium members can manage settlements
        const benefits = await getUserBenefits(userId);
        if (!benefits.canCreatePrivatePoker) {
            return res.status(403).json({
                error: 'Managing settlements requires Diehard Premium',
                upgradeCta: true
            });
        }

        const privateGames = await getCollection('private_poker_games');
        const game = await privateGames.findOne({ _id: new ObjectId(id) });

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Check if user is a player
        const player = game.players.find(p => p.odIdStr === userIdStr);
        if (!player) {
            return res.status(403).json({ error: 'You are not a player in this game' });
        }

        // Calculate current net positions to verify the debt exists
        const startingChips = game.settings.startingChips;
        const userNet = (player.chips || 0) - startingChips;

        // User must be a creditor (positive net) to clear debts
        if (userNet <= 0) {
            return res.status(403).json({ error: 'Only players who are owed money can clear settlements' });
        }

        // Check that the debtor exists and actually owes money
        const debtor = game.players.find(p => p.odIdStr === debtorId);
        if (!debtor) {
            return res.status(400).json({ error: 'Debtor not found in this game' });
        }

        const debtorNet = (debtor.chips || 0) - startingChips;
        if (debtorNet >= 0) {
            return res.status(400).json({ error: 'This player does not owe any money' });
        }

        // Check if already cleared
        const existingClear = (game.clearedSettlements || []).find(
            s => s.debtorId === debtorId && s.creditorId === userIdStr
        );

        if (existingClear) {
            return res.status(400).json({ error: 'This settlement has already been cleared' });
        }

        // Add to cleared settlements
        const clearEntry = {
            debtorId,
            debtorUsername: debtor.username,
            creditorId: userIdStr,
            creditorUsername: player.username,
            clearedAt: new Date()
        };

        await privateGames.updateOne(
            { _id: game._id },
            {
                $push: { clearedSettlements: clearEntry },
                $set: { updatedAt: new Date() }
            }
        );

        return res.status(200).json({
            success: true,
            message: `Settlement with ${debtor.username} marked as paid`,
            cleared: clearEntry
        });

    } catch (error) {
        console.error('Clear settlement error:', error);
        return res.status(500).json({ error: 'Failed to clear settlement' });
    }
}
