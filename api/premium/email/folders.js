// GET /api/premium/email/folders - Get mail folders
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getUserBenefits } from '../../lib/subscriptions.js';
import { getMailFolders } from '../../lib/zoho.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = user._id || user.userId;
        const benefits = await getUserBenefits(userId);

        if (!benefits.customEmail) {
            return res.status(403).json({ error: 'Premium membership required', upgradeCta: true });
        }

        const users = await getCollection('users');
        const currentUser = await users.findOne({ _id: new ObjectId(userId) });

        if (!currentUser?.premiumEmail?.zohoAccountId) {
            return res.status(400).json({
                error: 'No email account linked',
                needsSetup: true
            });
        }

        const result = await getMailFolders(currentUser.premiumEmail.zohoAccountId);

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to load folders' });
        }

        return res.status(200).json({
            success: true,
            folders: result.folders,
            email: currentUser.premiumEmail.email
        });

    } catch (error) {
        console.error('Folders error:', error);
        return res.status(500).json({ error: 'Failed to load folders' });
    }
}
