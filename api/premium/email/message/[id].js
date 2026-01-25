// GET/DELETE /api/premium/email/message/[id] - Get or delete a message
import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { getUserBenefits } from '../../../lib/subscriptions.js';
import { getMessage, trashMessage, markMessageRead } from '../../../lib/zoho.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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
            return res.status(400).json({ error: 'No email account linked', needsSetup: true });
        }

        const accountId = currentUser.premiumEmail.zohoAccountId;
        const { id, folderId } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Message ID required' });
        }

        if (req.method === 'GET') {
            // Get message content (folderId required for Zoho API)
            if (!folderId) {
                return res.status(400).json({ error: 'Folder ID required' });
            }
            const result = await getMessage(accountId, id, folderId);

            if (!result.success) {
                return res.status(500).json({ error: result.error || 'Failed to load message' });
            }

            // Mark as read
            await markMessageRead(accountId, id, true);

            return res.status(200).json({
                success: true,
                message: result.message
            });
        }

        if (req.method === 'DELETE') {
            // Move to trash
            const result = await trashMessage(accountId, id);

            if (!result.success) {
                return res.status(500).json({ error: result.error || 'Failed to delete message' });
            }

            return res.status(200).json({
                success: true,
                message: 'Message moved to trash'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Message error:', error);
        return res.status(500).json({ error: 'Failed to process message' });
    }
}
