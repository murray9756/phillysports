/**
 * Admin Photo Management API
 * GET /api/admin/photos - List all photos
 * POST /api/admin/photos - Add a new photo
 */

import { MongoClient, ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
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

        if (req.method === 'GET') {
            // List photos with pagination and filtering
            const { page = 1, limit = 50, team, status = 'all', search } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const query = {};
            if (team && team !== 'all') {
                query.teams = team.toLowerCase();
            }
            if (status !== 'all') {
                query.status = status;
            }
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { keywords: { $in: [new RegExp(search, 'i')] } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const [photos, total] = await Promise.all([
                photosCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray(),
                photosCollection.countDocuments(query)
            ]);

            return res.status(200).json({
                success: true,
                photos: photos.map(p => ({
                    ...p,
                    _id: p._id.toString()
                })),
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            });
        }

        if (req.method === 'POST') {
            // Add new photo
            const { url, title, description, keywords, teams, priority } = req.body;

            if (!url) {
                return res.status(400).json({ error: 'Photo URL is required' });
            }

            // Validate URL format
            try {
                new URL(url);
            } catch {
                return res.status(400).json({ error: 'Invalid URL format' });
            }

            // Check for duplicate URL
            const existing = await photosCollection.findOne({ url });
            if (existing) {
                return res.status(400).json({ error: 'Photo with this URL already exists' });
            }

            // Process keywords - split by comma if string, filter empty
            let processedKeywords = [];
            if (keywords) {
                if (typeof keywords === 'string') {
                    processedKeywords = keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                } else if (Array.isArray(keywords)) {
                    processedKeywords = keywords.map(k => k.trim().toLowerCase()).filter(k => k);
                }
            }

            // Process teams
            let processedTeams = [];
            if (teams) {
                if (typeof teams === 'string') {
                    processedTeams = teams.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                } else if (Array.isArray(teams)) {
                    processedTeams = teams.map(t => t.trim().toLowerCase()).filter(t => t);
                }
            }

            const photo = {
                url,
                title: title || '',
                description: description || '',
                keywords: processedKeywords,
                teams: processedTeams,
                priority: parseInt(priority) || 0,
                status: 'active',
                usedCount: 0,
                addedBy: new ObjectId(decoded.userId),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await photosCollection.insertOne(photo);

            return res.status(201).json({
                success: true,
                photo: {
                    ...photo,
                    _id: result.insertedId.toString()
                }
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Admin photos error:', error);
        return res.status(500).json({ error: 'Server error' });
    } finally {
        await client.close();
    }
}
