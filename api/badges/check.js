// Badge Check API - Check and award badges after user actions
import { getCollection } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { authenticate } from '../lib/auth.js';
import { BADGES } from './index.js';

// Get user's stat value for a requirement type
function getUserStat(user, reqType, team = null) {
    const stats = user.stats || {};
    switch (reqType) {
        case 'account_created':
            return 1;
        case 'comment_count':
            return stats.totalComments || 0;
        case 'bet_count':
            return stats.totalBets || 0;
        case 'bet_wins':
            return stats.totalBetWins || 0;
        case 'trivia_played':
            return stats.triviaPlayed || 0;
        case 'poker_games':
            return stats.pokerGames || 0;
        case 'fantasy_contests':
            return stats.fantasyContests || 0;
        case 'pool_squares':
            return stats.poolSquares || 0;
        case 'game_threads':
            return stats.gameThreads || 0;
        case 'login_streak':
            return user.loginStreak || 0;
        case 'total_dd_earned':
            return stats.totalDDEarned || 0;
        case 'team_comments':
            const teamStats = stats.teamComments || {};
            return teamStats[team] || 0;
        default:
            return 0;
    }
}

// Map action types to stat fields
const ACTION_TO_STAT = {
    'comment': 'totalComments',
    'bet': 'totalBets',
    'bet_win': 'totalBetWins',
    'trivia': 'triviaPlayed',
    'poker': 'pokerGames',
    'fantasy': 'fantasyContests',
    'pool': 'poolSquares',
    'game_thread': 'gameThreads',
    'dd_earned': 'totalDDEarned'
};

// Map action types to requirement types for badge checking
const ACTION_TO_REQ_TYPE = {
    'comment': 'comment_count',
    'bet': 'bet_count',
    'bet_win': 'bet_wins',
    'trivia': 'trivia_played',
    'poker': 'poker_games',
    'fantasy': 'fantasy_contests',
    'pool': 'pool_squares',
    'game_thread': 'game_threads',
    'dd_earned': 'total_dd_earned',
    'login': 'login_streak',
    'team_comment': 'team_comments'
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

    try {
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { action, team, amount = 1 } = req.body;

        if (!action) {
            return res.status(400).json({ error: 'Action type required' });
        }

        const usersCollection = await getCollection('users');
        const userBadgesCollection = await getCollection('user_badges');

        // Update user stats based on action
        const statField = ACTION_TO_STAT[action];
        const updateOps = {};

        if (statField) {
            updateOps.$inc = { [`stats.${statField}`]: amount };
        }

        // Handle team comments separately
        if (action === 'team_comment' && team) {
            updateOps.$inc = {
                ...updateOps.$inc,
                [`stats.teamComments.${team}`]: amount
            };
        }

        // Handle login streak
        if (action === 'login') {
            const today = new Date().toISOString().split('T')[0];
            const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate).toISOString().split('T')[0] : null;

            if (lastLogin !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                if (lastLogin === yesterdayStr) {
                    // Continue streak
                    updateOps.$inc = { ...updateOps.$inc, loginStreak: 1 };
                } else {
                    // Reset streak
                    updateOps.$set = { ...updateOps.$set, loginStreak: 1 };
                }
                updateOps.$set = { ...updateOps.$set, lastLoginDate: new Date() };
            }
        }

        // Apply stat updates
        if (Object.keys(updateOps).length > 0) {
            await usersCollection.updateOne({ _id: user._id }, updateOps);
        }

        // Get updated user data
        const updatedUser = await usersCollection.findOne({ _id: user._id });

        // Get user's existing badges
        const existingBadges = await userBadgesCollection.find({ userId: user._id }).toArray();
        const existingBadgeIds = new Set(existingBadges.map(b => b.badgeId));

        // Check which badges can be awarded
        const newlyUnlocked = [];
        let totalDDAwarded = 0;

        // Filter badges relevant to this action
        const reqType = ACTION_TO_REQ_TYPE[action];
        const relevantBadges = BADGES.filter(badge => {
            if (existingBadgeIds.has(badge.id)) return false;

            // Check welcome badge on any action
            if (badge.requirement.type === 'account_created') return true;

            // Check relevant badges
            if (badge.requirement.type === reqType) {
                if (reqType === 'team_comments') {
                    return badge.requirement.team === team;
                }
                return true;
            }
            return false;
        });

        for (const badge of relevantBadges) {
            const currentValue = getUserStat(updatedUser, badge.requirement.type, badge.requirement.team);

            if (currentValue >= badge.requirement.threshold) {
                // Award badge
                await userBadgesCollection.insertOne({
                    userId: user._id,
                    badgeId: badge.id,
                    unlockedAt: new Date(),
                    ddAwarded: badge.ddReward
                });

                // Award DD
                if (badge.ddReward > 0) {
                    await usersCollection.updateOne(
                        { _id: user._id },
                        {
                            $inc: {
                                coinBalance: badge.ddReward,
                                'stats.totalDDEarned': badge.ddReward
                            }
                        }
                    );
                    totalDDAwarded += badge.ddReward;
                }

                // Update badge count
                await usersCollection.updateOne(
                    { _id: user._id },
                    { $inc: { badgeCount: 1 } }
                );

                // Set as top badge if user has none
                if (!updatedUser.topBadge) {
                    await usersCollection.updateOne(
                        { _id: user._id },
                        { $set: { topBadge: badge.id } }
                    );
                }

                newlyUnlocked.push({
                    id: badge.id,
                    icon: badge.icon,
                    name: badge.name,
                    description: badge.description,
                    ddReward: badge.ddReward,
                    rarity: badge.rarity
                });

                existingBadgeIds.add(badge.id);
            }
        }

        return res.status(200).json({
            success: true,
            newBadges: newlyUnlocked,
            ddAwarded: totalDDAwarded,
            totalBadges: existingBadgeIds.size
        });
    } catch (error) {
        console.error('Badge check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
