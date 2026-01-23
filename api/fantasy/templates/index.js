// Fantasy Contest Templates API - Recurring Contests
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Authenticate - admin only
    const user = await authenticate(req);
    if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const templatesCollection = await getCollection('fantasy_templates');

    // GET - List templates
    if (req.method === 'GET') {
        try {
            const templates = await templatesCollection
                .find({})
                .sort({ createdAt: -1 })
                .toArray();

            return res.status(200).json({
                success: true,
                templates
            });
        } catch (error) {
            console.error('List templates error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST - Create template
    if (req.method === 'POST') {
        try {
            const { name, sport, entryFee = 0, schedule = 'daily', active = true } = req.body;

            if (!name || !sport) {
                return res.status(400).json({ error: 'Name and sport are required' });
            }

            if (!['NFL', 'NBA', 'MLB', 'NHL'].includes(sport)) {
                return res.status(400).json({ error: 'Invalid sport' });
            }

            if (!['daily', 'weekly'].includes(schedule)) {
                return res.status(400).json({ error: 'Schedule must be daily or weekly' });
            }

            const template = {
                name,
                sport,
                entryFee: parseInt(entryFee) || 0,
                schedule,
                active,
                lastCreated: null,
                createdAt: new Date(),
                createdBy: user._id
            };

            const result = await templatesCollection.insertOne(template);

            return res.status(201).json({
                success: true,
                template: { _id: result.insertedId, ...template }
            });
        } catch (error) {
            console.error('Create template error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // DELETE - Remove template
    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;

            if (!id || !ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid template ID' });
            }

            await templatesCollection.deleteOne({ _id: new ObjectId(id) });

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Delete template error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
