// Cron: Auto-create Game Threads & Update Status
// Call this endpoint every 15 minutes via Vercel Cron or external service
import { getCollection } from '../lib/mongodb.js';
import { fetchScoreboard } from '../lib/espn.js';
import { getPusher } from '../lib/pusher.js';

// Philly teams config
const PHILLY_TEAMS = {
    NFL: { name: 'Philadelphia Eagles', patterns: ['eagles', 'philadelphia eagles'], key: 'eagles' },
    NBA: { name: 'Philadelphia 76ers', patterns: ['76ers', 'sixers', 'philadelphia 76ers'], key: 'sixers' },
    MLB: { name: 'Philadelphia Phillies', patterns: ['phillies', 'philadelphia phillies'], key: 'phillies' },
    NHL: { name: 'Philadelphia Flyers', patterns: ['flyers', 'philadelphia flyers'], key: 'flyers' }
};

function isPhillyTeam(teamName, sport) {
    const normalized = teamName.toLowerCase();
    const team = PHILLY_TEAMS[sport];
    if (!team) return false;
    return team.patterns.some(p => normalized.includes(p));
}

function getPhillyTeamKey(teamName) {
    const normalized = teamName.toLowerCase();
    if (normalized.includes('eagles')) return 'eagles';
    if (normalized.includes('76ers') || normalized.includes('sixers')) return 'sixers';
    if (normalized.includes('phillies')) return 'phillies';
    if (normalized.includes('flyers')) return 'flyers';
    return null;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Allow GET for cron jobs
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const threadsCollection = await getCollection('game_threads');
        const results = {
            created: [],
            updated: [],
            errors: []
        };

        // Fetch scoreboards for all sports
        const sports = ['NFL', 'NBA', 'MLB', 'NHL'];

        for (const sport of sports) {
            try {
                const games = await fetchScoreboard(sport);

                for (const game of games) {
                    // Check if this is a Philly game
                    const homeIsPhilly = isPhillyTeam(game.homeTeam, sport);
                    const awayIsPhilly = isPhillyTeam(game.awayTeam, sport);

                    if (!homeIsPhilly && !awayIsPhilly) continue;

                    const phillyTeam = getPhillyTeamKey(game.homeTeam) || getPhillyTeamKey(game.awayTeam);
                    const isHome = homeIsPhilly;

                    // Check if thread exists
                    const existingThread = await threadsCollection.findOne({
                        gameId: game.espnId
                    });

                    const gameTime = new Date(game.gameDate);
                    const now = new Date();
                    const minutesUntilGame = (gameTime - now) / 1000 / 60;

                    if (!existingThread) {
                        // Create thread if game starts within 30 minutes or is in progress
                        if (minutesUntilGame <= 30 || game.isInProgress) {
                            const teamEmoji = {
                                eagles: '🦅',
                                sixers: '🏀',
                                phillies: '⚾',
                                flyers: '🏒'
                            };

                            const phillyName = PHILLY_TEAMS[sport]?.name || (isHome ? game.homeTeam : game.awayTeam);
                            const opponent = isHome ? game.awayTeam : game.homeTeam;

                            const title = isHome
                                ? `${teamEmoji[phillyTeam]} ${phillyName} vs ${opponent} - Game Thread`
                                : `${teamEmoji[phillyTeam]} ${phillyName} @ ${opponent} - Game Thread`;

                            const thread = {
                                gameId: game.espnId,
                                sport,
                                team: phillyTeam,
                                homeTeam: game.homeTeam,
                                awayTeam: game.awayTeam,
                                isHome,
                                gameTime,
                                broadcast: null,
                                status: game.isInProgress ? 'live' : 'pre-game',
                                currentScore: {
                                    home: game.homeScore || 0,
                                    away: game.awayScore || 0,
                                    period: game.statusDescription || 'Pre-game',
                                    isFinal: game.isFinal,
                                    isInProgress: game.isInProgress
                                },
                                title,
                                commentCount: 0,
                                reactions: {
                                    fire: 0,
                                    celebrate: 0,
                                    angry: 0,
                                    skull: 0
                                },
                                pusherChannel: `game-thread-${game.espnId}`,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };

                            await threadsCollection.insertOne(thread);
                            results.created.push({
                                sport,
                                title,
                                gameId: game.espnId
                            });
                        }
                    } else {
                        // Update existing thread
                        let newStatus = existingThread.status;
                        if (game.isFinal && existingThread.status !== 'post-game') {
                            newStatus = 'post-game';
                        } else if (game.isInProgress && existingThread.status === 'pre-game') {
                            newStatus = 'live';
                        }

                        const scoreChanged =
                            existingThread.currentScore?.home !== game.homeScore ||
                            existingThread.currentScore?.away !== game.awayScore;

                        if (newStatus !== existingThread.status || scoreChanged) {
                            await threadsCollection.updateOne(
                                { _id: existingThread._id },
                                {
                                    $set: {
                                        status: newStatus,
                                        currentScore: {
                                            home: game.homeScore || 0,
                                            away: game.awayScore || 0,
                                            period: game.statusDescription,
                                            isFinal: game.isFinal,
                                            isInProgress: game.isInProgress
                                        },
                                        updatedAt: new Date()
                                    }
                                }
                            );

                            // Broadcast score update via Pusher
                            if (scoreChanged) {
                                const pusher = getPusher();
                                if (pusher) {
                                    try {
                                        await pusher.trigger(existingThread.pusherChannel, 'score-update', {
                                            home: game.homeScore,
                                            away: game.awayScore,
                                            period: game.statusDescription,
                                            isFinal: game.isFinal
                                        });
                                    } catch (e) {
                                        console.error('Pusher error:', e);
                                    }
                                }
                            }

                            // Broadcast status change
                            if (newStatus !== existingThread.status) {
                                const pusher = getPusher();
                                if (pusher) {
                                    try {
                                        await pusher.trigger(existingThread.pusherChannel, 'status-change', {
                                            status: newStatus
                                        });
                                    } catch (e) {
                                        console.error('Pusher error:', e);
                                    }
                                }
                            }

                            results.updated.push({
                                gameId: game.espnId,
                                status: newStatus,
                                score: `${game.homeScore}-${game.awayScore}`
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing ${sport}:`, error);
                results.errors.push({ sport, error: error.message });
            }
        }

        return res.status(200).json({
            success: true,
            ...results,
            checkedAt: new Date()
        });
    } catch (error) {
        console.error('Check game threads error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
