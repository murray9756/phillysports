// Temporary endpoint to set user balance
// DELETE THIS AFTER USE

import { getCollection } from '../../lib/mongodb.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, balance } = req.body;

    if (!username || balance === undefined) {
        return res.status(400).json({ error: 'Username and balance required' });
    }

    try {
        const users = await getCollection('users');

        const result = await users.findOneAndUpdate(
            { username },
            { $set: { coinBalance: parseInt(balance), updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            username: result.username,
            newBalance: result.coinBalance
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
