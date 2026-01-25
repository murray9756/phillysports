// POST /api/admin/link-email - Link premium email to user (admin only, temporary)
import { ObjectId } from 'mongodb';
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
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { username, email, zohoAccountId } = req.body;

        if (!username || !email || !zohoAccountId) {
            return res.status(400).json({ error: 'username, email, and zohoAccountId required' });
        }

        const users = await getCollection('users');

        const result = await users.updateOne(
            { username: username },
            {
                $set: {
                    premiumEmail: {
                        prefix: email.split('@')[0],
                        email: email,
                        zohoAccountId: zohoAccountId,
                        createdAt: new Date(),
                        status: 'active'
                    },
                    isSubscribed: true,
                    subscriptionTier: 'premium',
                    subscriptionStatus: 'active',
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            message: `Linked ${email} to user ${username}`
        });

    } catch (error) {
        console.error('Link email error:', error);
        return res.status(500).json({ error: 'Failed to link email' });
    }
}
