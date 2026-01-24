// GET /api/poker/private/[id]/settlement - Get settlement ledger for a private game
import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';

// Calculate simplified debt graph (minimize number of transactions)
function simplifyDebts(playerSummary, exchangeRate, clearedSettlements = [], currentUserId) {
    const players = Object.entries(playerSummary);

    // Separate into creditors (positive) and debtors (negative)
    const creditors = players.filter(([_, data]) => data.netDD > 0)
        .map(([id, data]) => ({ id, username: data.username, amount: data.netDD }))
        .sort((a, b) => b.amount - a.amount);

    const debtors = players.filter(([_, data]) => data.netDD < 0)
        .map(([id, data]) => ({ id, username: data.username, amount: Math.abs(data.netDD) }))
        .sort((a, b) => b.amount - a.amount);

    const settlements = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    // Match debtors with creditors
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const creditor = creditors[creditorIndex];
        const debtor = debtors[debtorIndex];

        const amount = Math.min(creditor.amount, debtor.amount);

        if (amount > 0) {
            const realMoney = (amount / exchangeRate).toFixed(2);

            // Check if this debt has been cleared
            const clearedEntry = clearedSettlements.find(
                c => c.debtorId === debtor.id && c.creditorId === creditor.id
            );

            settlements.push({
                from: { id: debtor.id, username: debtor.username },
                to: { id: creditor.id, username: creditor.username },
                amountDD: amount,
                amountUSD: parseFloat(realMoney),
                cleared: !!clearedEntry,
                clearedAt: clearedEntry?.clearedAt || null,
                // Can only clear if current user is the creditor and not already cleared
                canClear: creditor.id === currentUserId && !clearedEntry
            });
        }

        creditor.amount -= amount;
        debtor.amount -= amount;

        if (creditor.amount === 0) creditorIndex++;
        if (debtor.amount === 0) debtorIndex++;
    }

    return settlements;
}

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

        // Check if user is a player
        const player = game.players.find(p => p.odIdStr === userIdStr);
        if (!player) {
            return res.status(403).json({ error: 'You are not a player in this game' });
        }

        // Default exchange rate: 100 DD = $1 USD
        const exchangeRate = game.settings.exchangeRate || 100;

        // Calculate player summaries based on current chip counts vs starting chips
        const playerSummary = {};
        for (const p of game.players) {
            const startingChips = game.settings.startingChips;
            const currentChips = p.chips || 0;
            const netDD = currentChips - startingChips;

            playerSummary[p.odIdStr] = {
                username: p.username,
                startingChips,
                finalChips: currentChips,
                netDD,
                netUSD: (netDD / exchangeRate).toFixed(2)
            };
        }

        // Calculate who owes who (with cleared status)
        const clearedSettlements = game.clearedSettlements || [];
        const whoOwesWho = simplifyDebts(playerSummary, exchangeRate, clearedSettlements, userIdStr);

        // Game stats
        const gameStats = {
            name: game.name,
            status: game.status,
            playerCount: game.playerCount,
            totalHandsPlayed: game.gameState?.handNumber || 0,
            startedAt: game.startedAt,
            completedAt: game.completedAt,
            duration: game.startedAt && game.completedAt
                ? Math.round((new Date(game.completedAt) - new Date(game.startedAt)) / 60000)
                : null
        };

        // Calculate settlement summary
        const pendingSettlements = whoOwesWho.filter(s => !s.cleared);
        const clearedCount = whoOwesWho.filter(s => s.cleared).length;
        const allSettled = pendingSettlements.length === 0 && whoOwesWho.length > 0;

        return res.status(200).json({
            gameId: game._id.toString(),
            gameName: game.name,
            exchangeRate,
            exchangeRateDisplay: `${exchangeRate} DD = $1 USD`,
            playerSummary,
            whoOwesWho,
            settlementSummary: {
                total: whoOwesWho.length,
                cleared: clearedCount,
                pending: pendingSettlements.length,
                allSettled
            },
            gameStats,
            shareableText: generateShareableText(game.name, playerSummary, whoOwesWho, exchangeRate)
        });

    } catch (error) {
        console.error('Settlement error:', error);
        return res.status(500).json({ error: 'Failed to load settlement' });
    }
}

// Generate text that can be copied/shared
function generateShareableText(gameName, playerSummary, whoOwesWho, exchangeRate) {
    let text = `POKER SETTLEMENT - ${gameName}\n`;
    text += `${'='.repeat(40)}\n\n`;
    text += `Results (${exchangeRate} DD = $1):\n`;

    const sorted = Object.values(playerSummary)
        .sort((a, b) => b.netDD - a.netDD);

    for (const p of sorted) {
        const sign = p.netDD >= 0 ? '+' : '';
        text += `${p.username}: ${sign}${p.netDD} DD (${sign}$${p.netUSD})\n`;
    }

    const pending = whoOwesWho.filter(s => !s.cleared);
    const cleared = whoOwesWho.filter(s => s.cleared);

    if (pending.length > 0) {
        text += `\nPending Settlements:\n`;
        for (const s of pending) {
            text += `${s.from.username} owes ${s.to.username}: $${s.amountUSD.toFixed(2)}\n`;
        }
    }

    if (cleared.length > 0) {
        text += `\nCleared:\n`;
        for (const s of cleared) {
            text += `${s.from.username} -> ${s.to.username}: $${s.amountUSD.toFixed(2)} PAID\n`;
        }
    }

    if (pending.length === 0 && whoOwesWho.length > 0) {
        text += `\nALL SETTLED!\n`;
    }

    text += `\n- via PhillySports.com`;
    return text;
}
