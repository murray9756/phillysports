// Block Pools API - List and Create Pools
// Uses SportsDataIO for game data

import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { fetchGamesByDate, getCurrentSeason } from '../lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// Default payout structures by sport
const DEFAULT_PAYOUTS = {
    NFL: { q1: 20, q2: 20, q3: 20, q4: 20, final: 20 },
    NBA: { q1: 20, q2: 20, q3: 20, q4: 20, final: 20 },
    NHL: { p1: 25, p2: 25, p3: 25, final: 25 },
    MLB: { i3: 15, i6: 15, i9: 35, final: 35 }
};

// Philly teams config
const PHILLY_TEAMS = {
    NFL: ['PHI'],
    NBA: ['PHI'],
    MLB: ['PHI'],
    NHL: ['PHI']
};

function isPhillyTeam(teamAbbr, sport) {
    if (!teamAbbr) return false;
    const patterns = PHILLY_TEAMS[sport] || [];
    return patterns.includes(teamAbbr.toUpperCase());
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const poolsCollection = await getCollection('block_pools');

    // GET - List pools
    if (req.method === 'GET') {
        try {
            const { sport, status, limit = 20 } = req.query;

            const query = {};
            if (sport) query.sport = sport;
            if (status) {
                query.status = status;
            } else {
                query.status = { $in: ['open', 'locked', 'live'] };
            }

            const pools = await poolsCollection
                .find(query)
                .sort({ gameTime: 1, createdAt: -1 })
                .limit(parseInt(limit))
                .toArray();

            // Get user's squares if logged in
            let userSquares = {};
            const user = await authenticate(req);
            if (user) {
                pools.forEach(pool => {
                    const userPoolSquares = (pool.squares || []).filter(
                        s => s.userId && s.userId.toString() === user._id.toString()
                    );
                    if (userPoolSquares.length > 0) {
                        userSquares[pool._id.toString()] = userPoolSquares.length;
                    }
                });
            }

            return res.status(200).json({
                success: true,
                pools: pools.map(p => ({
                    _id: p._id,
                    title: p.title,
                    sport: p.sport,
                    homeTeam: p.homeTeam,
                    awayTeam: p.awayTeam,
                    gameTime: p.gameTime,
                    squarePrice: p.squarePrice,
                    squaresSold: p.squaresSold || 0,
                    prizePool: p.prizePool || 0,
                    status: p.status,
                    numbersAssigned: p.numbersAssigned,
                    userSquares: userSquares[p._id.toString()] || 0
                }))
            });
        } catch (error) {
            console.error('List pools error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST - Create pool
    if (req.method === 'POST') {
        try {
            const user = await authenticate(req);
            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const {
                gameId,
                sport,
                homeTeam,
                awayTeam,
                gameTime,
                title,
                squarePrice = 10,
                maxPerUser = 10,
                payouts
            } = req.body;

            // Validate required fields
            if (!sport || !['NFL', 'NBA', 'MLB', 'NHL'].includes(sport)) {
                return res.status(400).json({ error: 'Invalid sport' });
            }

            // If gameId provided, fetch game details from SportsDataIO
            let gameDetails = { homeTeam, awayTeam, gameTime };
            if (gameId && SPORTSDATA_API_KEY) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const games = await fetchGamesByDate(sport, today);
                    const game = games.find(g => (g.GameID || g.ScoreID)?.toString() === gameId);

                    if (game) {
                        gameDetails = {
                            homeTeam: game.HomeTeam || homeTeam,
                            awayTeam: game.AwayTeam || awayTeam,
                            gameTime: new Date(game.DateTime || game.Day)
                        };
                    }
                } catch (e) {
                    console.error('Error fetching game:', e);
                }
            }

            if (!gameDetails.homeTeam || !gameDetails.awayTeam) {
                return res.status(400).json({ error: 'Home team and away team required' });
            }

            const poolTitle = title || `${gameDetails.homeTeam} vs ${gameDetails.awayTeam} Squares`;

            const pool = {
                gameId: gameId || null,
                sport,
                homeTeam: gameDetails.homeTeam,
                awayTeam: gameDetails.awayTeam,
                gameTime: gameDetails.gameTime ? new Date(gameDetails.gameTime) : null,
                title: poolTitle,
                squarePrice: parseInt(squarePrice),
                maxPerUser: parseInt(maxPerUser),
                creatorId: user._id,
                creatorName: user.displayName || user.username,
                isAutoGenerated: false,
                rowNumbers: null,
                colNumbers: null,
                numbersAssigned: false,
                squares: [],
                squaresSold: 0,
                payouts: payouts || DEFAULT_PAYOUTS[sport],
                winners: [],
                status: 'open',
                prizePool: 0,
                currentScore: { home: 0, away: 0 },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await poolsCollection.insertOne(pool);

            return res.status(201).json({
                success: true,
                pool: {
                    _id: result.insertedId,
                    ...pool
                }
            });
        } catch (error) {
            console.error('Create pool error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
