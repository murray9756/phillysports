/**
 * Admin Photo Management API - Single Photo
 * GET /api/admin/photos/[id] - Get photo details
 * PUT /api/admin/photos/[id] - Update photo
 * DELETE /api/admin/photos/[id] - Delete photo
 */

import { MongoClient, ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Valid photo ID required' });
    }

    // Authenticate admin
    const decoded = await authenticate(req);
    if (!decoded) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const usersCollection = db.collection('users');
        const photosCollection = db.collection('photos');

        // Verify admin status
        const user = await usersCollection.findOne({ _id: new ObjectId(decoded.userId) });
        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const photoId = new ObjectId(id);

        if (req.method === 'GET') {
            const photo = await photosCollection.findOne({ _id: photoId });
            if (!photo) {
                return res.status(404).json({ error: 'Photo not found' });
            }

            return res.status(200).json({
                success: true,
                photo: {
                    ...photo,
                    _id: photo._id.toString()
                }
            });
        }

        if (req.method === 'PUT') {
            const { url, title, description, keywords, teams, priority, status } = req.body;

            const updateFields = { updatedAt: new Date() };

            if (url !== undefined) {
                try {
                    new URL(url);
                    updateFields.url = url;
                } catch {
                    return res.status(400).json({ error: 'Invalid URL format' });
                }
            }

            if (title !== undefined) updateFields.title = title;
            if (description !== undefined) updateFields.description = description;
            if (priority !== undefined) updateFields.priority = parseInt(priority) || 0;
            if (status !== undefined) updateFields.status = status;

            // Process keywords
            if (keywords !== undefined) {
                if (typeof keywords === 'string') {
                    updateFields.keywords = keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                } else if (Array.isArray(keywords)) {
                    updateFields.keywords = keywords.map(k => k.trim().toLowerCase()).filter(k => k);
                }
            }

            // Process teams
            if (teams !== undefined) {
                if (typeof teams === 'string') {
                    updateFields.teams = teams.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                } else if (Array.isArray(teams)) {
                    updateFields.teams = teams.map(t => t.trim().toLowerCase()).filter(t => t);
                }
            }

            const result = await photosCollection.updateOne(
                { _id: photoId },
                { $set: updateFields }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Photo not found' });
            }

            const updatedPhoto = await photosCollection.findOne({ _id: photoId });

            return res.status(200).json({
                success: true,
                photo: {
                    ...updatedPhoto,
                    _id: updatedPhoto._id.toString()
                }
            });
        }

        if (req.method === 'DELETE') {
            const result = await photosCollection.deleteOne({ _id: photoId });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Photo not found' });
            }

            return res.status(200).json({
                success: true,
                message: 'Photo deleted'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Admin photo error:', error);
        return res.status(500).json({ error: 'Server error' });
    } finally {
        await client.close();
    }
}
