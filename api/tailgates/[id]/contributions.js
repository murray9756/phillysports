// Tailgate Contributions API
// POST /api/tailgates/[id]/contributions - Commit to bring an item
// PUT /api/tailgates/[id]/contributions - Update contribution status
// DELETE /api/tailgates/[id]/contributions - Cancel contribution

import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { awardContributionCoins } from '../../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid tailgate ID' });
    }

    if (req.method === 'POST') {
        return handleAddContribution(req, res, id);
    }

    if (req.method === 'PUT') {
        return handleUpdateContribution(req, res, id);
    }

    if (req.method === 'DELETE') {
        return handleRemoveContribution(req, res, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleAddContribution(req, res, tailgateId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { item, quantity = 1, neededItemIndex } = req.body;

        if (!item || item.trim().length < 2) {
            return res.status(400).json({ error: 'Item name is required (at least 2 characters)' });
        }

        const tailgates = await getCollection('tailgates');
        const tailgate = await tailgates.findOne({ _id: new ObjectId(tailgateId) });

        if (!tailgate) {
            return res.status(404).json({ error: 'Tailgate not found' });
        }

        if (tailgate.status === 'cancelled') {
            return res.status(400).json({ error: 'This tailgate has been cancelled' });
        }

        // Check if user has RSVPed
        const isAttending = tailgate.attendees?.some(a => a.userId.toString() === auth.userId);
        if (!isAttending) {
            return res.status(400).json({ error: 'You must RSVP before committing to bring items' });
        }

        // Check if tailgate is in the past
        if (new Date(tailgate.schedule.arrivalTime) < new Date()) {
            return res.status(400).json({ error: 'Cannot contribute to past tailgates' });
        }

        // Limit contributions per user
        const existingContributions = tailgate.contributions?.filter(c => c.userId.toString() === auth.userId) || [];
        if (existingContributions.length >= 5) {
            return res.status(400).json({ error: 'You can only contribute up to 5 items per tailgate' });
        }

        const now = new Date();

        // Add contribution
        await tailgates.updateOne(
            { _id: new ObjectId(tailgateId) },
            {
                $push: {
                    contributions: {
                        userId: new ObjectId(auth.userId),
                        item: item.trim(),
                        quantity: Math.max(1, parseInt(quantity) || 1),
                        status: 'committed',
                        claimedAt: now
                    }
                },
                $set: { updatedAt: now }
            }
        );

        // If claiming a needed item, mark it as claimed
        if (neededItemIndex !== undefined && tailgate.neededItems?.[neededItemIndex]) {
            await tailgates.updateOne(
                { _id: new ObjectId(tailgateId) },
                {
                    $set: {
                        [`neededItems.${neededItemIndex}.claimedBy`]: new ObjectId(auth.userId)
                    }
                }
            );
        }

        // Award coins for contribution
        const reward = await awardContributionCoins(auth.userId, item.trim());

        return res.status(201).json({
            success: true,
            message: `You committed to bring: ${item.trim()}`,
            contribution: {
                item: item.trim(),
                quantity: Math.max(1, parseInt(quantity) || 1),
                status: 'committed'
            },
            coinsAwarded: reward.amount
        });

    } catch (error) {
        console.error('Add contribution error:', error);
        return res.status(500).json({ error: 'Failed to add contribution' });
    }
}

async function handleUpdateContribution(req, res, tailgateId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { item, status } = req.body;

        if (!item) {
            return res.status(400).json({ error: 'Item name is required' });
        }

        if (!['committed', 'packed', 'delivered'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const tailgates = await getCollection('tailgates');
        const tailgate = await tailgates.findOne({ _id: new ObjectId(tailgateId) });

        if (!tailgate) {
            return res.status(404).json({ error: 'Tailgate not found' });
        }

        const contribution = tailgate.contributions?.find(
            c => c.userId.toString() === auth.userId && c.item === item
        );

        if (!contribution) {
            return res.status(404).json({ error: 'Contribution not found' });
        }

        await tailgates.updateOne(
            {
                _id: new ObjectId(tailgateId),
                'contributions.userId': new ObjectId(auth.userId),
                'contributions.item': item
            },
            {
                $set: {
                    'contributions.$.status': status,
                    updatedAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: `Contribution status updated to: ${status}`,
            contribution: {
                item,
                status
            }
        });

    } catch (error) {
        console.error('Update contribution error:', error);
        return res.status(500).json({ error: 'Failed to update contribution' });
    }
}

async function handleRemoveContribution(req, res, tailgateId) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { item } = req.body;

        if (!item) {
            return res.status(400).json({ error: 'Item name is required' });
        }

        const tailgates = await getCollection('tailgates');
        const tailgate = await tailgates.findOne({ _id: new ObjectId(tailgateId) });

        if (!tailgate) {
            return res.status(404).json({ error: 'Tailgate not found' });
        }

        const contribution = tailgate.contributions?.find(
            c => c.userId.toString() === auth.userId && c.item === item
        );

        if (!contribution) {
            return res.status(404).json({ error: 'Contribution not found' });
        }

        // Remove contribution
        await tailgates.updateOne(
            { _id: new ObjectId(tailgateId) },
            {
                $pull: {
                    contributions: {
                        userId: new ObjectId(auth.userId),
                        item: item
                    }
                },
                $set: { updatedAt: new Date() }
            }
        );

        // Unclaim any needed item that matches
        await tailgates.updateOne(
            {
                _id: new ObjectId(tailgateId),
                'neededItems.claimedBy': new ObjectId(auth.userId)
            },
            {
                $set: {
                    'neededItems.$[elem].claimedBy': null
                }
            },
            {
                arrayFilters: [{ 'elem.item': item }]
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Contribution removed'
        });

    } catch (error) {
        console.error('Remove contribution error:', error);
        return res.status(500).json({ error: 'Failed to remove contribution' });
    }
}
