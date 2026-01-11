// PUT/DELETE /api/admin/raffles/[id] - Update or delete raffle
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
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

        const { id } = req.query;
        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid raffle ID' });
        }

        const raffles = await getCollection('raffles');
        const raffle = await raffles.findOne({ _id: new ObjectId(id) });

        if (!raffle) {
            return res.status(404).json({ error: 'Raffle not found' });
        }

        if (req.method === 'PUT') {
            // Update raffle
            const {
                title,
                description,
                images,
                team,
                estimatedValue,
                ticketPrice,
                maxTicketsPerUser,
                drawDate,
                status
            } = req.body;

            // Validate status transitions
            const validStatuses = ['draft', 'active', 'completed', 'cancelled'];
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            // Can't edit completed or cancelled raffles (except status for reactivation)
            if (raffle.status === 'completed') {
                return res.status(400).json({ error: 'Cannot edit completed raffle' });
            }

            // Build update object
            const update = { updatedAt: new Date() };

            if (title !== undefined) update.title = title.trim();
            if (description !== undefined) update.description = description.trim();
            if (images !== undefined) update.images = images;
            if (team !== undefined) update.team = team || null;
            if (estimatedValue !== undefined) update.estimatedValue = parseFloat(estimatedValue) || 0;
            if (ticketPrice !== undefined) update.ticketPrice = parseInt(ticketPrice) || 10;
            if (maxTicketsPerUser !== undefined) {
                update.maxTicketsPerUser = maxTicketsPerUser ? parseInt(maxTicketsPerUser) : null;
            }
            if (drawDate !== undefined) {
                const drawDateObj = new Date(drawDate);
                if (isNaN(drawDateObj.getTime())) {
                    return res.status(400).json({ error: 'Invalid draw date' });
                }
                update.drawDate = drawDateObj;
            }
            if (status !== undefined) update.status = status;

            await raffles.updateOne(
                { _id: new ObjectId(id) },
                { $set: update }
            );

            const updatedRaffle = await raffles.findOne({ _id: new ObjectId(id) });

            return res.status(200).json({
                success: true,
                raffle: {
                    ...updatedRaffle,
                    _id: updatedRaffle._id.toString(),
                    createdBy: updatedRaffle.createdBy?.toString()
                }
            });
        }

        if (req.method === 'DELETE') {
            // Can only delete if no tickets sold
            if (raffle.totalTicketsSold > 0) {
                return res.status(400).json({
                    error: 'Cannot delete raffle with tickets sold. Cancel it instead to refund buyers.'
                });
            }

            await raffles.deleteOne({ _id: new ObjectId(id) });

            return res.status(200).json({
                success: true,
                message: 'Raffle deleted'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin raffle update error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
