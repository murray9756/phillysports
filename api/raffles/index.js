// GET /api/raffles - List active raffles
import { getCollection } from '../lib/mongodb.js';

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
        const raffles = await getCollection('raffles');

        // Get active raffles, sorted by draw date
        const activeRaffles = await raffles.find({
            status: 'active'
        }).sort({ drawDate: 1 }).toArray();

        return res.status(200).json({
            raffles: activeRaffles.map(r => ({
                _id: r._id.toString(),
                title: r.title,
                description: r.description,
                images: r.images || [],
                team: r.team,
                estimatedValue: r.estimatedValue,
                ticketPrice: r.ticketPrice,
                maxTicketsPerUser: r.maxTicketsPerUser,
                totalTicketsSold: r.totalTicketsSold || 0,
                drawDate: r.drawDate,
                status: r.status
            })),
            count: activeRaffles.length
        });
    } catch (error) {
        console.error('Raffles list error:', error);
        return res.status(500).json({ error: 'Failed to load raffles' });
    }
}
