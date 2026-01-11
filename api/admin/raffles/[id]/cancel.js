// POST /api/admin/raffles/[id]/cancel - Cancel raffle and refund tickets
import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { refundTickets } from '../../../lib/raffle.js';

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

        const raffles = await getCollection('raffles');
        const raffle = await raffles.findOne({ _id: new ObjectId(id) });

        if (!raffle) {
            return res.status(404).json({ error: 'Raffle not found' });
        }

        if (raffle.status === 'completed') {
            return res.status(400).json({ error: 'Cannot cancel a completed raffle' });
        }

        if (raffle.status === 'cancelled') {
            return res.status(400).json({ error: 'Raffle is already cancelled' });
        }

        // Refund all tickets
        const result = await refundTickets(id);

        return res.status(200).json({
            success: true,
            message: `Raffle cancelled. Refunded ${result.totalAmount} Diehard Dollars to ${result.refunded} user(s).`,
            refunded: result.refunded,
            totalAmount: result.totalAmount,
            ticketCount: result.ticketCount
        });
    } catch (error) {
        console.error('Cancel raffle error:', error);
        return res.status(500).json({ error: 'Failed to cancel raffle' });
    }
}
