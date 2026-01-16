// Game Threads API - List and Create
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { fetchScoreboard } from '../lib/espn.js';

// Philly teams config
const PHILLY_TEAMS = {
    NFL: { name: 'Philadelphia Eagles', short: 'Eagles', key: 'eagles' },
    NBA: { name: 'Philadelphia 76ers', short: '76ers', key: 'sixers' },
    MLB: { name: 'Philadelphia Phillies', short: 'Phillies', key: 'phillies' },
    NHL: { name: 'Philadelphia Flyers', short: 'Flyers', key: 'flyers' }
};

function isPhillyTeam(teamName) {
    const normalized = teamName.toLowerCase();
    return normalized.includes('eagles') ||
        normalized.includes('76ers') || normalized.includes('sixers') ||
        normalized.includes('phillies') ||
        normalized.includes('flyers');
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            return await listThreads(req, res);
        } else if (req.method === 'POST') {
            return await createThread(req, res);
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Game threads error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function listThreads(req, res) {
    const threadsCollection = await getCollection('game_threads');

    const { status, team, limit = 10 } = req.query;

    // Build query
    const query = {};
    if (status) {
        query.status = status;
    }
    if (team) {
        query.team = team;
    }

    // Get threads sorted by game time
    const threads = await threadsCollection
        .find(query)
        .sort({ gameTime: -1 })
        .limit(parseInt(limit))
        .toArray();

    // Get live scores for active threads
    const activeThreads = threads.filter(t => t.status === 'live' || t.status === 'pre-game');
    if (activeThreads.length > 0) {
        // Fetch current scores
        const sports = [...new Set(activeThreads.map(t => t.sport))];
        for (const sport of sports) {
            try {
                const games = await fetchScoreboard(sport);
                for (const thread of activeThreads) {
                    if (thread.sport !== sport) continue;
                    const game = games.find(g =>
                        g.homeTeam === thread.homeTeam || g.awayTeam === thread.awayTeam ||
                        g.homeTeamShort === thread.homeTeam || g.awayTeamShort === thread.awayTeam
                    );
                    if (game) {
                        thread.currentScore = {
                            home: game.homeScore,
                            away: game.awayScore,
                            period: game.statusDescription,
                            isFinal: game.isFinal,
                            isInProgress: game.isInProgress
                        };
                        // Update status based on game state
                        if (game.isFinal && thread.status !== 'post-game') {
                            thread.status = 'post-game';
                        } else if (game.isInProgress && thread.status !== 'live') {
                            thread.status = 'live';
                        }
                    }
                }
            } catch (e) {
                console.error(`Error fetching ${sport} scores:`, e);
            }
        }
    }

    return res.status(200).json({
        success: true,
        threads,
        count: threads.length
    });
}

async function createThread(req, res) {
    // Authenticate (admin or system)
    const user = await authenticate(req);

    const { gameId, sport, homeTeam, awayTeam, gameTime, broadcast } = req.body;

    if (!sport || !homeTeam || !awayTeam || !gameTime) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine which Philly team
    const phillyTeam = getPhillyTeamKey(homeTeam) || getPhillyTeamKey(awayTeam);
    if (!phillyTeam) {
        return res.status(400).json({ error: 'No Philly team in this game' });
    }

    const isHome = isPhillyTeam(homeTeam);
    const opponent = isHome ? awayTeam : homeTeam;

    const threadsCollection = await getCollection('game_threads');

    // Check if thread already exists for this game
    const existingThread = await threadsCollection.findOne({
        sport,
        homeTeam,
        awayTeam,
        gameTime: new Date(gameTime)
    });

    if (existingThread) {
        return res.status(200).json({
            success: true,
            thread: existingThread,
            message: 'Thread already exists'
        });
    }

    // Create title
    const teamEmoji = {
        eagles: '🦅',
        sixers: '🏀',
        phillies: '⚾',
        flyers: '🏒'
    };

    const title = isHome
        ? `${teamEmoji[phillyTeam]} ${PHILLY_TEAMS[sport]?.short || homeTeam} vs ${opponent} - Game Thread`
        : `${teamEmoji[phillyTeam]} ${PHILLY_TEAMS[sport]?.short || awayTeam} @ ${opponent} - Game Thread`;

    const thread = {
        gameId: gameId || `${sport}-${Date.now()}`,
        sport,
        team: phillyTeam,
        homeTeam,
        awayTeam,
        isHome,
        gameTime: new Date(gameTime),
        broadcast: broadcast || null,
        status: 'pre-game',
        currentScore: {
            home: 0,
            away: 0,
            period: 'Pre-game',
            timeRemaining: null
        },
        title,
        commentCount: 0,
        reactions: {
            fire: 0,
            celebrate: 0,
            angry: 0,
            skull: 0
        },
        pusherChannel: `game-thread-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await threadsCollection.insertOne(thread);
    thread._id = result.insertedId;

    return res.status(201).json({
        success: true,
        thread
    });
}
