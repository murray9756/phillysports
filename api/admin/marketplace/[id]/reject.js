// Admin Marketplace Reject Listing API
// POST: Reject a pending listing

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { sendNotification } from '../../../notifications/send.js';

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
        const { reason } = req.body;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid listing ID' });
        }

        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ error: 'Please provide a rejection reason (at least 10 characters)' });
        }

        const listings = await getCollection('marketplace_listings');

        // Find the listing
        const listing = await listings.findOne({ _id: new ObjectId(id) });

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (listing.moderationStatus === 'rejected') {
            return res.status(400).json({ error: 'Listing is already rejected' });
        }

        // Update listing to rejected
        const result = await listings.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $set: {
                    moderationStatus: 'rejected',
                    moderationNotes: reason.trim(),
                    moderatedBy: new ObjectId(decoded.userId),
                    moderatedAt: new Date(),
                    status: 'rejected',
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        // Send notification to seller with rejection reason
        try {
            await sendNotification(
                listing.sellerId.toString(),
                'listing_rejected',
                'Listing Rejected',
                `Your listing "${listing.title}" was not approved. Reason: ${reason.trim()}`,
                `/marketplace/my-listings`,
                { listingId: result._id.toString(), title: listing.title, reason: reason.trim() }
            );
        } catch (notifyError) {
            console.error('Failed to send rejection notification:', notifyError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: 'Listing rejected',
            listing: {
                _id: result._id.toString(),
                title: result.title,
                moderationStatus: result.moderationStatus,
                moderationNotes: result.moderationNotes
            }
        });
    } catch (error) {
        console.error('Reject listing error:', error);
        res.status(500).json({ error: 'Failed to reject listing' });
    }
}
