// GET /api/raffles/my-tickets - User's tickets for all raffles
import { authenticate } from '../lib/auth.js';
import { getUserTickets } from '../lib/raffle.js';

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

        const tickets = await getUserTickets(user._id);

        // Group by raffle
        const byRaffle = {};
        for (const ticket of tickets) {
            if (!byRaffle[ticket.raffleId]) {
                byRaffle[ticket.raffleId] = {
                    raffleId: ticket.raffleId,
                    raffle: ticket.raffle,
                    tickets: [],
                    totalSpent: 0,
                    hasWinner: false
                };
            }
            byRaffle[ticket.raffleId].tickets.push(ticket);
            byRaffle[ticket.raffleId].totalSpent += ticket.diehardDollarsSpent || 0;
            if (ticket.isWinner) {
                byRaffle[ticket.raffleId].hasWinner = true;
            }
        }

        return res.status(200).json({
            tickets,
            byRaffle: Object.values(byRaffle),
            totalTickets: tickets.length,
            totalWins: tickets.filter(t => t.isWinner).length
        });
    } catch (error) {
        console.error('My tickets error:', error);
        return res.status(500).json({ error: 'Failed to load tickets' });
    }
}
