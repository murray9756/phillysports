// GET /api/raffles/history - Past completed raffles with winners
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
        const { limit = '20', offset = '0' } = req.query;
        const limitNum = Math.min(parseInt(limit) || 20, 50);
        const offsetNum = parseInt(offset) || 0;

        const raffles = await getCollection('raffles');

        // Get completed raffles, sorted by completion date (newest first)
        const completedRaffles = await raffles.find({
            status: { $in: ['completed', 'cancelled'] }
        })
            .sort({ completedAt: -1 })
            .skip(offsetNum)
            .limit(limitNum)
            .toArray();

        const total = await raffles.countDocuments({
            status: { $in: ['completed', 'cancelled'] }
        });

        return res.status(200).json({
            raffles: completedRaffles.map(r => ({
                _id: r._id.toString(),
                title: r.title,
                description: r.description,
                images: r.images || [],
                team: r.team,
                estimatedValue: r.estimatedValue,
                totalTicketsSold: r.totalTicketsSold || 0,
                status: r.status,
                drawDate: r.drawDate,
                completedAt: r.completedAt,
                winnerId: r.winnerId?.toString() || null,
                winnerUsername: r.winnerUsername || null
            })),
            total,
            hasMore: offsetNum + completedRaffles.length < total
        });
    } catch (error) {
        console.error('Raffles history error:', error);
        return res.status(500).json({ error: 'Failed to load raffle history' });
    }
}
