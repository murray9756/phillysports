/**
 * Bulk Photo Import API
 * POST /api/admin/photos/bulk-import
 *
 * Import multiple photos at once from a JSON array
 */

import { MongoClient, ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
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

        const { photos } = req.body;

        if (!Array.isArray(photos) || photos.length === 0) {
            return res.status(400).json({ error: 'Photos array required' });
        }

        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        const now = new Date();
        const toInsert = [];

        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];

            // Validate URL
            if (!photo.url) {
                results.errors.push({ index: i, error: 'Missing URL' });
                results.skipped++;
                continue;
            }

            try {
                new URL(photo.url);
            } catch {
                results.errors.push({ index: i, error: 'Invalid URL' });
                results.skipped++;
                continue;
            }

            // Check for duplicate
            const existing = await photosCollection.findOne({ url: photo.url });
            if (existing) {
                results.errors.push({ index: i, error: 'Duplicate URL' });
                results.skipped++;
                continue;
            }

            // Process keywords
            let keywords = [];
            if (photo.keywords) {
                if (typeof photo.keywords === 'string') {
                    keywords = photo.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                } else if (Array.isArray(photo.keywords)) {
                    keywords = photo.keywords.map(k => k.trim().toLowerCase()).filter(k => k);
                }
            }

            // Process teams
            let teams = [];
            if (photo.teams) {
                if (typeof photo.teams === 'string') {
                    teams = photo.teams.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                } else if (Array.isArray(photo.teams)) {
                    teams = photo.teams.map(t => t.trim().toLowerCase()).filter(t => t);
                }
            }

            toInsert.push({
                url: photo.url,
                title: photo.title || '',
                description: photo.description || '',
                keywords,
                teams,
                priority: parseInt(photo.priority) || 0,
                status: 'active',
                usedCount: 0,
                addedBy: new ObjectId(decoded.userId),
                createdAt: now,
                updatedAt: now
            });
        }

        if (toInsert.length > 0) {
            const insertResult = await photosCollection.insertMany(toInsert);
            results.imported = insertResult.insertedCount;
        }

        return res.status(200).json({
            success: true,
            ...results
        });

    } catch (error) {
        console.error('Bulk import error:', error);
        return res.status(500).json({ error: 'Server error' });
    } finally {
        await client.close();
    }
}
