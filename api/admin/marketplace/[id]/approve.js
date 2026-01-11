// Admin Marketplace Approve Listing API
// POST: Approve a pending listing

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';

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
        // Authenticate and verify admin
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.query;
        const { notes } = req.body;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid listing ID' });
        }

        const listings = await getCollection('marketplace_listings');

        // Find the listing
        const listing = await listings.findOne({ _id: new ObjectId(id) });

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (listing.moderationStatus === 'approved') {
            return res.status(400).json({ error: 'Listing is already approved' });
        }

        // Update listing to approved
        const result = await listings.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $set: {
                    moderationStatus: 'approved',
                    moderationNotes: notes || null,
                    moderatedBy: new ObjectId(decoded.userId),
                    moderatedAt: new Date(),
                    publishedAt: new Date(),
                    status: 'active',
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        // TODO: Send notification to seller that listing is approved
        // This would integrate with a notification system

        res.status(200).json({
            success: true,
            message: 'Listing approved and now live',
            listing: {
                _id: result._id.toString(),
                title: result.title,
                moderationStatus: result.moderationStatus,
                publishedAt: result.publishedAt
            }
        });
    } catch (error) {
        console.error('Approve listing error:', error);
        res.status(500).json({ error: 'Failed to approve listing' });
    }
}
