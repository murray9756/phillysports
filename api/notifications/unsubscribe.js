// Push Notification Unsubscribe API - Remove push subscriptions
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { endpoint, all } = req.body;

        const usersCollection = await getCollection('users');

        if (all) {
            // Remove all subscriptions for this user
            await usersCollection.updateOne(
                { _id: user._id },
                {
                    $set: {
                        pushSubscriptions: [],
                        'notificationPreferences.pushEnabled': false,
                        updatedAt: new Date()
                    }
                }
            );

            return res.status(200).json({
                success: true,
                message: 'All push subscriptions removed'
            });
        }

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint required' });
        }

        // Remove specific subscription
        await usersCollection.updateOne(
            { _id: user._id },
            {
                $pull: { pushSubscriptions: { endpoint: endpoint } },
                $set: { updatedAt: new Date() }
            }
        );

        // Check if user has any remaining subscriptions
        const updatedUser = await usersCollection.findOne({ _id: user._id });
        if (!updatedUser.pushSubscriptions || updatedUser.pushSubscriptions.length === 0) {
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { 'notificationPreferences.pushEnabled': false } }
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Push subscription removed'
        });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
