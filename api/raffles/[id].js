// GET /api/raffles/[id] - Single raffle details
import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

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
        const { id } = req.query;
        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid raffle ID' });
        }

        const raffles = await getCollection('raffles');
        const tickets = await getCollection('raffle_tickets');

        const raffle = await raffles.findOne({ _id: new ObjectId(id) });
        if (!raffle) {
            return res.status(404).json({ error: 'Raffle not found' });
        }

        // Get user's tickets if authenticated
        let userTickets = [];
        let userTicketCount = 0;
        try {
            const user = await authenticate(req);
            if (user) {
                userTickets = await tickets.find({
                    raffleId: new ObjectId(id),
                    userId: user._id
                }).sort({ ticketNumber: 1 }).toArray();
                userTicketCount = userTickets.length;
            }
        } catch (e) {
            // Not authenticated, that's fine
        }

        return res.status(200).json({
            raffle: {
                _id: raffle._id.toString(),
                title: raffle.title,
                description: raffle.description,
                images: raffle.images || [],
                team: raffle.team,
                estimatedValue: raffle.estimatedValue,
                ticketPrice: raffle.ticketPrice,
                maxTicketsPerUser: raffle.maxTicketsPerUser,
                totalTicketsSold: raffle.totalTicketsSold || 0,
                drawDate: raffle.drawDate,
                status: raffle.status,
                winnerId: raffle.winnerId?.toString() || null,
                winnerUsername: raffle.winnerUsername || null
            },
            userTickets: userTickets.map(t => ({
                _id: t._id.toString(),
                ticketNumber: t.ticketNumber,
                purchasedAt: t.purchasedAt,
                isWinner: t.isWinner
            })),
            userTicketCount
        });
    } catch (error) {
        console.error('Raffle detail error:', error);
        return res.status(500).json({ error: 'Failed to load raffle' });
    }
}
