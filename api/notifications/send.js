// Push Notification Send API - Send notifications to users
import { getCollection } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:support@phillysports.com',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

// Notification type to preference mapping
const NOTIFICATION_PREFERENCES = {
    // Game alerts
    'game_start': 'gameAlerts.gameStart',
    'score_update': 'gameAlerts.scoreUpdate',
    'final_score': 'gameAlerts.finalScore',
    'close_game': 'gameAlerts.closeGame',
    // Activity alerts
    'badge_unlocked': 'activityAlerts.badgeUnlocked',
    'contest_result': 'activityAlerts.contestResult',
    'bet_outcome': 'activityAlerts.betOutcome',
    'pool_winner': 'activityAlerts.poolWinner',
    'dd_earned': 'activityAlerts.ddEarned',
    // Social alerts
    'new_follower': 'socialAlerts.newFollower',
    'mention': 'socialAlerts.mention',
    'reply': 'socialAlerts.reply',
    'message': 'socialAlerts.message'
};

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

    // Check for API key or internal call
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.INTERNAL_API_KEY && !req.headers['x-internal-call']) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(500).json({ error: 'Push notifications not configured' });
    }

    try {
        const { userId, userIds, type, title, body, url, team, data } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body required' });
        }

        const usersCollection = await getCollection('users');
        const results = {
            sent: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        // Get users to notify
        let targetUserIds = [];
        if (userId) {
            targetUserIds = [new ObjectId(userId)];
        } else if (userIds && Array.isArray(userIds)) {
            targetUserIds = userIds.map(id => new ObjectId(id));
        } else {
            return res.status(400).json({ error: 'userId or userIds required' });
        }

        // Fetch users with push subscriptions
        const users = await usersCollection.find({
            _id: { $in: targetUserIds },
            'pushSubscriptions.0': { $exists: true },
            'notificationPreferences.pushEnabled': true
        }).toArray();

        // Prepare notification payload
        const payload = JSON.stringify({
            title,
            body,
            icon: '/logo.png',
            url: url || '/',
            type: type || 'general',
            team,
            tag: `phillysports-${type || 'general'}-${Date.now()}`,
            ...data
        });

        // Send to each user's subscriptions
        for (const user of users) {
            // Check user preferences for this notification type
            if (type && NOTIFICATION_PREFERENCES[type]) {
                const prefPath = NOTIFICATION_PREFERENCES[type];
                const prefs = user.notificationPreferences || {};
                const prefValue = getNestedValue(prefs, prefPath);

                if (prefValue === false) {
                    results.skipped++;
                    continue;
                }
            }

            const subscriptions = user.pushSubscriptions || [];
            const expiredSubscriptions = [];

            for (const subscription of subscriptions) {
                try {
                    await webpush.sendNotification({
                        endpoint: subscription.endpoint,
                        keys: subscription.keys
                    }, payload);
                    results.sent++;
                } catch (error) {
                    if (error.statusCode === 404 || error.statusCode === 410) {
                        // Subscription expired or invalid
                        expiredSubscriptions.push(subscription.endpoint);
                    } else {
                        results.failed++;
                        results.errors.push({
                            userId: user._id.toString(),
                            error: error.message
                        });
                    }
                }
            }

            // Clean up expired subscriptions
            if (expiredSubscriptions.length > 0) {
                await usersCollection.updateOne(
                    { _id: user._id },
                    {
                        $pull: {
                            pushSubscriptions: {
                                endpoint: { $in: expiredSubscriptions }
                            }
                        }
                    }
                );
            }
        }

        return res.status(200).json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Send notification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Helper to get nested object value
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

// Export helper function for use in other endpoints
export async function sendNotification(userId, type, title, body, url, options = {}) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.warn('Push notifications not configured');
        return { sent: 0, failed: 0, skipped: 0 };
    }

    const usersCollection = await getCollection('users');
    const results = { sent: 0, failed: 0, skipped: 0 };

    const user = await usersCollection.findOne({
        _id: new ObjectId(userId),
        'pushSubscriptions.0': { $exists: true },
        'notificationPreferences.pushEnabled': true
    });

    if (!user) {
        return results;
    }

    // Check preferences
    if (type && NOTIFICATION_PREFERENCES[type]) {
        const prefPath = NOTIFICATION_PREFERENCES[type];
        const prefs = user.notificationPreferences || {};
        const prefValue = getNestedValue(prefs, prefPath);

        if (prefValue === false) {
            results.skipped = 1;
            return results;
        }
    }

    const payload = JSON.stringify({
        title,
        body,
        icon: '/logo.png',
        url: url || '/',
        type: type || 'general',
        tag: `phillysports-${type || 'general'}-${Date.now()}`,
        ...options
    });

    const expiredSubscriptions = [];

    for (const subscription of user.pushSubscriptions || []) {
        try {
            await webpush.sendNotification({
                endpoint: subscription.endpoint,
                keys: subscription.keys
            }, payload);
            results.sent++;
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                expiredSubscriptions.push(subscription.endpoint);
            } else {
                results.failed++;
            }
        }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
        await usersCollection.updateOne(
            { _id: user._id },
            {
                $pull: {
                    pushSubscriptions: {
                        endpoint: { $in: expiredSubscriptions }
                    }
                }
            }
        );
    }

    return results;
}
