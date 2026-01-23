// Fantasy Contest Template Update API
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Authenticate - admin only
    const user = await authenticate(req);
    if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid template ID' });
    }

    const templatesCollection = await getCollection('fantasy_templates');

    // PUT - Update template
    if (req.method === 'PUT') {
        try {
            const { active, name, sport, entryFee, schedule } = req.body;

            const updateFields = {};

            if (typeof active === 'boolean') {
                updateFields.active = active;
            }
            if (name) {
                updateFields.name = name;
            }
            if (sport && ['NFL', 'NBA', 'MLB', 'NHL'].includes(sport)) {
                updateFields.sport = sport;
            }
            if (typeof entryFee === 'number') {
                updateFields.entryFee = entryFee;
            }
            if (schedule && ['daily', 'weekly'].includes(schedule)) {
                updateFields.schedule = schedule;
            }

            if (Object.keys(updateFields).length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }

            updateFields.updatedAt = new Date();

            await templatesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateFields }
            );

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Update template error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
