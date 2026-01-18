// Admin: Delete a user account
// POST: { email: "user@example.com" }

import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

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
        // Check admin auth
        const decoded = await authenticate(req);
        if (!decoded || decoded.email !== 'kevin@phillysports.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        // Prevent deleting admin account
        if (email.toLowerCase() === 'kevin@phillysports.com') {
            return res.status(400).json({ error: 'Cannot delete admin account' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete user
        await users.deleteOne({ _id: user._id });

        res.status(200).json({
            success: true,
            message: `User ${email} deleted`,
            deletedUserId: user._id.toString()
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: error.message });
    }
}
