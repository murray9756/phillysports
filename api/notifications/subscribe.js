// Push Notification Subscribe API - Save push subscriptions
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

        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Invalid subscription data' });
        }

        const usersCollection = await getCollection('users');

        // Check if this subscription already exists
        const existingUser = await usersCollection.findOne({
            _id: user._id,
            'pushSubscriptions.endpoint': subscription.endpoint
        });

        if (existingUser) {
            // Update existing subscription
            await usersCollection.updateOne(
                {
                    _id: user._id,
                    'pushSubscriptions.endpoint': subscription.endpoint
                },
                {
                    $set: {
                        'pushSubscriptions.$.keys': subscription.keys,
                        'pushSubscriptions.$.updatedAt': new Date()
                    }
                }
            );
        } else {
            // Add new subscription
            const subscriptionDoc = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                },
                createdAt: new Date(),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            await usersCollection.updateOne(
                { _id: user._id },
                {
                    $push: { pushSubscriptions: subscriptionDoc },
                    $set: {
                        'notificationPreferences.pushEnabled': true,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        notificationPreferences: getDefaultPreferences()
                    }
                }
            );
        }

        // Initialize default preferences if not set
        const updatedUser = await usersCollection.findOne({ _id: user._id });
        if (!updatedUser.notificationPreferences) {
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { notificationPreferences: getDefaultPreferences() } }
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Push subscription saved'
        });
    } catch (error) {
        console.error('Subscribe error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

function getDefaultPreferences() {
    return {
        pushEnabled: true,
        gameAlerts: {
            gameStart: true,
            scoreUpdate: true,
            finalScore: true,
            closeGame: true
        },
        activityAlerts: {
            badgeUnlocked: true,
            contestResult: true,
            betOutcome: true,
            poolWinner: true,
            ddEarned: false
        },
        socialAlerts: {
            newFollower: true,
            mention: true,
            reply: true,
            message: true
        }
    };
}
