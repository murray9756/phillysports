// Notification Preferences API - Get and update notification preferences
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

const DEFAULT_PREFERENCES = {
    pushEnabled: false,
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const usersCollection = await getCollection('users');

        if (req.method === 'GET') {
            // Get current preferences
            const userData = await usersCollection.findOne(
                { _id: user._id },
                { projection: { notificationPreferences: 1, pushSubscriptions: 1 } }
            );

            const preferences = userData?.notificationPreferences || DEFAULT_PREFERENCES;
            const hasSubscriptions = (userData?.pushSubscriptions || []).length > 0;

            return res.status(200).json({
                success: true,
                preferences,
                hasSubscriptions,
                subscriptionCount: (userData?.pushSubscriptions || []).length
            });
        }

        if (req.method === 'PUT') {
            const { preferences } = req.body;

            if (!preferences) {
                return res.status(400).json({ error: 'Preferences required' });
            }

            // Validate and merge preferences
            const updatedPreferences = {
                pushEnabled: typeof preferences.pushEnabled === 'boolean'
                    ? preferences.pushEnabled
                    : DEFAULT_PREFERENCES.pushEnabled,
                gameAlerts: {
                    gameStart: preferences.gameAlerts?.gameStart ?? DEFAULT_PREFERENCES.gameAlerts.gameStart,
                    scoreUpdate: preferences.gameAlerts?.scoreUpdate ?? DEFAULT_PREFERENCES.gameAlerts.scoreUpdate,
                    finalScore: preferences.gameAlerts?.finalScore ?? DEFAULT_PREFERENCES.gameAlerts.finalScore,
                    closeGame: preferences.gameAlerts?.closeGame ?? DEFAULT_PREFERENCES.gameAlerts.closeGame
                },
                activityAlerts: {
                    badgeUnlocked: preferences.activityAlerts?.badgeUnlocked ?? DEFAULT_PREFERENCES.activityAlerts.badgeUnlocked,
                    contestResult: preferences.activityAlerts?.contestResult ?? DEFAULT_PREFERENCES.activityAlerts.contestResult,
                    betOutcome: preferences.activityAlerts?.betOutcome ?? DEFAULT_PREFERENCES.activityAlerts.betOutcome,
                    poolWinner: preferences.activityAlerts?.poolWinner ?? DEFAULT_PREFERENCES.activityAlerts.poolWinner,
                    ddEarned: preferences.activityAlerts?.ddEarned ?? DEFAULT_PREFERENCES.activityAlerts.ddEarned
                },
                socialAlerts: {
                    newFollower: preferences.socialAlerts?.newFollower ?? DEFAULT_PREFERENCES.socialAlerts.newFollower,
                    mention: preferences.socialAlerts?.mention ?? DEFAULT_PREFERENCES.socialAlerts.mention,
                    reply: preferences.socialAlerts?.reply ?? DEFAULT_PREFERENCES.socialAlerts.reply,
                    message: preferences.socialAlerts?.message ?? DEFAULT_PREFERENCES.socialAlerts.message
                }
            };

            await usersCollection.updateOne(
                { _id: user._id },
                {
                    $set: {
                        notificationPreferences: updatedPreferences,
                        updatedAt: new Date()
                    }
                }
            );

            return res.status(200).json({
                success: true,
                preferences: updatedPreferences
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Notification preferences error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
