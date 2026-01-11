// GET/POST /api/admin/raffles - List all raffles or create new
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { DEFAULT_TICKET_PRICE } from '../../lib/raffle.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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

        const raffles = await getCollection('raffles');

        if (req.method === 'GET') {
            // List all raffles
            const { status } = req.query;
            const query = status ? { status } : {};

            const allRaffles = await raffles.find(query)
                .sort({ createdAt: -1 })
                .toArray();

            return res.status(200).json({
                raffles: allRaffles.map(r => ({
                    _id: r._id.toString(),
                    title: r.title,
                    description: r.description,
                    images: r.images || [],
                    team: r.team,
                    estimatedValue: r.estimatedValue,
                    ticketPrice: r.ticketPrice,
                    maxTicketsPerUser: r.maxTicketsPerUser,
                    totalTicketsSold: r.totalTicketsSold || 0,
                    status: r.status,
                    drawDate: r.drawDate,
                    winnerId: r.winnerId?.toString() || null,
                    winnerUsername: r.winnerUsername || null,
                    createdAt: r.createdAt,
                    completedAt: r.completedAt
                })),
                count: allRaffles.length
            });
        }

        if (req.method === 'POST') {
            // Create new raffle
            const {
                title,
                description,
                images,
                team,
                estimatedValue,
                ticketPrice,
                maxTicketsPerUser,
                drawDate
            } = req.body;

            if (!title || title.trim().length === 0) {
                return res.status(400).json({ error: 'Title is required' });
            }

            if (!drawDate) {
                return res.status(400).json({ error: 'Draw date is required' });
            }

            const drawDateObj = new Date(drawDate);
            if (isNaN(drawDateObj.getTime())) {
                return res.status(400).json({ error: 'Invalid draw date' });
            }

            if (drawDateObj <= new Date()) {
                return res.status(400).json({ error: 'Draw date must be in the future' });
            }

            const newRaffle = {
                title: title.trim(),
                description: description?.trim() || '',
                images: images || [],
                team: team || null,
                estimatedValue: parseFloat(estimatedValue) || 0,
                ticketPrice: parseInt(ticketPrice) || DEFAULT_TICKET_PRICE,
                maxTicketsPerUser: maxTicketsPerUser ? parseInt(maxTicketsPerUser) : null,
                totalTicketsSold: 0,
                status: 'draft',
                drawDate: drawDateObj,
                winnerId: null,
                winnerUsername: null,
                winnerTicketId: null,
                createdBy: user._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                completedAt: null
            };

            const result = await raffles.insertOne(newRaffle);

            return res.status(201).json({
                success: true,
                raffle: {
                    ...newRaffle,
                    _id: result.insertedId.toString(),
                    createdBy: user._id.toString()
                }
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin raffles error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
