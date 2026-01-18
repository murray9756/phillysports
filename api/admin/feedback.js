// Admin Feedback API
// GET: List all feedback submissions
// PATCH: Update feedback status

import { ObjectId } from 'mongodb';
import { authenticate } from '../lib/auth.js';
import { getCollection } from '../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const admin = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!admin?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const feedback = await getCollection('feedback');

        if (req.method === 'GET') {
            const { status, type, limit = 50, offset = 0 } = req.query;

            const filter = {};
            if (status) filter.status = status;
            if (type) filter.type = type;

            const items = await feedback
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(parseInt(offset))
                .limit(parseInt(limit))
                .toArray();

            const total = await feedback.countDocuments(filter);

            // Get counts by status
            const counts = await feedback.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]).toArray();

            const statusCounts = {
                new: 0,
                reviewing: 0,
                resolved: 0,
                wontfix: 0
            };
            counts.forEach(c => {
                if (c._id) statusCounts[c._id] = c.count;
            });

            res.status(200).json({
                feedback: items.map(f => ({
                    _id: f._id.toString(),
                    type: f.type,
                    description: f.description,
                    page: f.page,
                    username: f.username || 'Anonymous',
                    email: f.email || null,
                    status: f.status,
                    coinsAwarded: f.coinsAwarded || 0,
                    adminNotes: f.adminNotes || null,
                    createdAt: f.createdAt,
                    updatedAt: f.updatedAt || null
                })),
                total,
                statusCounts
            });
        } else if (req.method === 'PATCH') {
            const { feedbackId, status, adminNotes } = req.body;

            if (!feedbackId) {
                return res.status(400).json({ error: 'feedbackId required' });
            }

            if (status && !['new', 'reviewing', 'resolved', 'wontfix'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const update = { updatedAt: new Date() };
            if (status) update.status = status;
            if (adminNotes !== undefined) update.adminNotes = adminNotes;

            const result = await feedback.findOneAndUpdate(
                { _id: new ObjectId(feedbackId) },
                { $set: update },
                { returnDocument: 'after' }
            );

            if (!result) {
                return res.status(404).json({ error: 'Feedback not found' });
            }

            res.status(200).json({
                success: true,
                feedback: {
                    _id: result._id.toString(),
                    status: result.status,
                    adminNotes: result.adminNotes
                }
            });
        } else if (req.method === 'DELETE') {
            const { feedbackId } = req.body;

            if (!feedbackId) {
                return res.status(400).json({ error: 'feedbackId required' });
            }

            const result = await feedback.deleteOne({ _id: new ObjectId(feedbackId) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Feedback not found' });
            }

            res.status(200).json({ success: true });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Admin feedback error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
}
