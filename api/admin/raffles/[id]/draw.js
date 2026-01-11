// POST /api/admin/raffles/[id]/draw - Manually trigger drawing
import { ObjectId } from 'mongodb';
import { authenticate } from '../../../lib/auth.js';
import { selectWinner } from '../../../lib/raffle.js';

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
        // Require admin authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.query;
        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid raffle ID' });
        }

        const result = await selectWinner(id);

        if (!result.success) {
            if (result.reason === 'no_tickets') {
                return res.status(200).json({
                    success: false,
                    message: 'No tickets were sold. Raffle has been cancelled.',
                    cancelled: true
                });
            }
            return res.status(400).json({ error: 'Drawing failed', reason: result.reason });
        }

        return res.status(200).json({
            success: true,
            message: `Winner selected: ${result.winner.username} (Ticket #${result.winner.ticketNumber})`,
            winner: result.winner,
            totalTickets: result.totalTickets
        });
    } catch (error) {
        console.error('Manual draw error:', error);

        if (error.message === 'Raffle not found') {
            return res.status(404).json({ error: 'Raffle not found' });
        }
        if (error.message === 'Raffle already completed') {
            return res.status(400).json({ error: 'Raffle has already been drawn' });
        }
        if (error.message === 'Raffle was cancelled') {
            return res.status(400).json({ error: 'Raffle was cancelled' });
        }

        return res.status(500).json({ error: 'Failed to draw winner' });
    }
}
