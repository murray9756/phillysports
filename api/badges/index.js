// Badges API - List all badges with user progress
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

// Badge definitions
export const BADGES = [
    // Activity Badges (First-Time)
    {
        id: 'welcome',
        icon: '🎉',
        name: 'Welcome',
        description: 'Created an account',
        category: 'activity',
        requirement: { type: 'account_created', threshold: 1 },
        ddReward: 50,
        rarity: 'common'
    },
    {
        id: 'first_comment',
        icon: '💬',
        name: 'First Word',
        description: 'Posted first comment',
        category: 'activity',
        requirement: { type: 'comment_count', threshold: 1 },
        ddReward: 10,
        rarity: 'common'
    },
    {
        id: 'first_bet',
        icon: '🎯',
        name: 'Predictor',
        description: 'Placed first bet',
        category: 'activity',
        requirement: { type: 'bet_count', threshold: 1 },
        ddReward: 10,
        rarity: 'common'
    },
    {
        id: 'first_trivia',
        icon: '🧠',
        name: 'Quizmaster',
        description: 'Played first trivia game',
        category: 'activity',
        requirement: { type: 'trivia_played', threshold: 1 },
        ddReward: 10,
        rarity: 'common'
    },
    {
        id: 'first_poker',
        icon: '🃏',
        name: 'Card Shark',
        description: 'Joined first poker game',
        category: 'activity',
        requirement: { type: 'poker_games', threshold: 1 },
        ddReward: 10,
        rarity: 'common'
    },
    {
        id: 'first_fantasy',
        icon: '🏈',
        name: 'Fantasy Rookie',
        description: 'Entered first fantasy contest',
        category: 'activity',
        requirement: { type: 'fantasy_contests', threshold: 1 },
        ddReward: 10,
        rarity: 'common'
    },
    {
        id: 'first_pool',
        icon: '🎱',
        name: 'Pool Player',
        description: 'Bought first pool square',
        category: 'activity',
        requirement: { type: 'pool_squares', threshold: 1 },
        ddReward: 10,
        rarity: 'common'
    },
    {
        id: 'first_gamethread',
        icon: '🔴',
        name: 'Game Day',
        description: 'Joined first live game thread',
        category: 'activity',
        requirement: { type: 'game_threads', threshold: 1 },
        ddReward: 10,
        rarity: 'common'
    },

    // Milestone Badges - Comments
    {
        id: 'comments_100',
        icon: '🗣️',
        name: 'Chatterbox',
        description: 'Posted 100 comments',
        category: 'milestone',
        requirement: { type: 'comment_count', threshold: 100 },
        ddReward: 100,
        rarity: 'rare'
    },
    {
        id: 'comments_500',
        icon: '📢',
        name: 'Megaphone',
        description: 'Posted 500 comments',
        category: 'milestone',
        requirement: { type: 'comment_count', threshold: 500 },
        ddReward: 250,
        rarity: 'epic'
    },
    {
        id: 'comments_1000',
        icon: '🎤',
        name: 'Influencer',
        description: 'Posted 1000 comments',
        category: 'milestone',
        requirement: { type: 'comment_count', threshold: 1000 },
        ddReward: 500,
        rarity: 'legendary'
    },

    // Milestone Badges - Bet Wins
    {
        id: 'wins_10',
        icon: '🏆',
        name: 'Winner',
        description: 'Won 10 bets',
        category: 'milestone',
        requirement: { type: 'bet_wins', threshold: 10 },
        ddReward: 100,
        rarity: 'rare'
    },
    {
        id: 'wins_50',
        icon: '👑',
        name: 'Champion',
        description: 'Won 50 bets',
        category: 'milestone',
        requirement: { type: 'bet_wins', threshold: 50 },
        ddReward: 500,
        rarity: 'legendary'
    },

    // Milestone Badges - Login Streaks
    {
        id: 'streak_7',
        icon: '🔥',
        name: 'Hot Streak',
        description: '7-day login streak',
        category: 'milestone',
        requirement: { type: 'login_streak', threshold: 7 },
        ddReward: 50,
        rarity: 'rare'
    },
    {
        id: 'streak_30',
        icon: '⚡',
        name: 'On Fire',
        description: '30-day login streak',
        category: 'milestone',
        requirement: { type: 'login_streak', threshold: 30 },
        ddReward: 200,
        rarity: 'epic'
    },
    {
        id: 'streak_100',
        icon: '💪',
        name: 'Die Hard',
        description: '100-day login streak',
        category: 'milestone',
        requirement: { type: 'login_streak', threshold: 100 },
        ddReward: 1000,
        rarity: 'legendary'
    },

    // Milestone Badges - DD Earned
    {
        id: 'dd_10000',
        icon: '💰',
        name: 'High Roller',
        description: 'Earned 10,000 DD total',
        category: 'milestone',
        requirement: { type: 'total_dd_earned', threshold: 10000 },
        ddReward: 0,
        rarity: 'epic'
    },
    {
        id: 'dd_100000',
        icon: '💎',
        name: 'Diamond',
        description: 'Earned 100,000 DD total',
        category: 'milestone',
        requirement: { type: 'total_dd_earned', threshold: 100000 },
        ddReward: 0,
        rarity: 'legendary'
    },

    // Team Badges
    {
        id: 'eagles_fan',
        icon: '🦅',
        name: 'Eagles Fan',
        description: '50 comments on Eagles content',
        category: 'team',
        requirement: { type: 'team_comments', threshold: 50, team: 'eagles' },
        ddReward: 50,
        rarity: 'rare'
    },
    {
        id: 'phillies_fan',
        icon: '⚾',
        name: 'Phillies Fan',
        description: '50 comments on Phillies content',
        category: 'team',
        requirement: { type: 'team_comments', threshold: 50, team: 'phillies' },
        ddReward: 50,
        rarity: 'rare'
    },
    {
        id: 'sixers_fan',
        icon: '🏀',
        name: 'Sixers Fan',
        description: '50 comments on Sixers content',
        category: 'team',
        requirement: { type: 'team_comments', threshold: 50, team: 'sixers' },
        ddReward: 50,
        rarity: 'rare'
    },
    {
        id: 'flyers_fan',
        icon: '🏒',
        name: 'Flyers Fan',
        description: '50 comments on Flyers content',
        category: 'team',
        requirement: { type: 'team_comments', threshold: 50, team: 'flyers' },
        ddReward: 50,
        rarity: 'rare'
    }
];

// Get user's stat value for a requirement type
function getUserStat(user, reqType, team = null) {
    const stats = user.stats || {};
    switch (reqType) {
        case 'account_created':
            return 1; // Always 1 if user exists
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const { category } = req.query;

        // Get user if logged in
        const user = await authenticate(req);
        let userBadges = new Set();
        let userStats = {};

        if (user) {
            const userBadgesCollection = await getCollection('user_badges');
            const badges = await userBadgesCollection.find({ userId: user._id }).toArray();
            userBadges = new Set(badges.map(b => b.badgeId));

            // Get user stats
            const usersCollection = await getCollection('users');
            const fullUser = await usersCollection.findOne({ _id: user._id });
            userStats = fullUser?.stats || {};
        }

        // Filter by category if specified
        let filteredBadges = BADGES;
        if (category) {
            filteredBadges = BADGES.filter(b => b.category === category);
        }

        // Add user progress to each badge
        const badgesWithProgress = filteredBadges.map(badge => {
            const currentValue = user ? getUserStat(user, badge.requirement.type, badge.requirement.team) : 0;
            const isUnlocked = userBadges.has(badge.id);
            const progress = Math.min(100, Math.round((currentValue / badge.requirement.threshold) * 100));

            return {
                ...badge,
                isUnlocked,
                progress,
                currentValue,
                targetValue: badge.requirement.threshold
            };
        });

        return res.status(200).json({
            success: true,
            badges: badgesWithProgress,
            totalBadges: BADGES.length,
            unlockedCount: userBadges.size
        });
    } catch (error) {
        console.error('Badges list error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
