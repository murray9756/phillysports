// POST /api/raffles/[id]/purchase - Buy raffle tickets
import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { purchaseTickets } from '../../lib/raffle.js';
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

    // Rate limit: 20 purchases per hour
    const allowed = await rateLimit(req, res, 'sensitive');
    if (!allowed) return;

    try {
        // Require authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;
        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid raffle ID' });
        }

        const { quantity } = req.body;
        const qty = parseInt(quantity);

        if (!qty || qty < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }

        if (qty > 100) {
            return res.status(400).json({ error: 'Maximum 100 tickets per purchase' });
        }

        const result = await purchaseTickets(user._id, id, qty);

        return res.status(200).json({
            success: true,
            tickets: result.tickets,
            totalCost: result.totalCost,
            newBalance: result.newBalance,
            message: `Successfully purchased ${qty} ticket(s)!`
        });
    } catch (error) {
        console.error('Purchase tickets error:', error);

        if (error.message === 'Insufficient balance') {
            return res.status(400).json({ error: 'Insufficient Diehard Dollars balance' });
        }
        if (error.message === 'Raffle not found') {
            return res.status(404).json({ error: 'Raffle not found' });
        }
        if (error.message === 'Raffle is not active') {
            return res.status(400).json({ error: 'This raffle is no longer accepting tickets' });
        }
        if (error.message.includes('Maximum')) {
            return res.status(400).json({ error: error.message });
        }

        return res.status(500).json({ error: 'Failed to purchase tickets' });
    }
}
