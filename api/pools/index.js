// Block Pools API - List and Create Pools
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

// Default payout structures by sport
const DEFAULT_PAYOUTS = {
    NFL: { q1: 20, q2: 20, q3: 20, q4: 20, final: 20 },
    NBA: { q1: 20, q2: 20, q3: 20, q4: 20, final: 20 },
    NHL: { p1: 25, p2: 25, p3: 25, final: 25 },
    MLB: { i3: 15, i6: 15, i9: 35, final: 35 }
};

const SCOREBOARD_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Philly teams config
const PHILLY_TEAMS = {
    NFL: ['eagles', 'philadelphia eagles'],
    NBA: ['76ers', 'sixers', 'philadelphia 76ers'],
    MLB: ['phillies', 'philadelphia phillies'],
    NHL: ['flyers', 'philadelphia flyers']
};

function isPhillyTeam(teamName, sport) {
    const normalized = teamName.toLowerCase();
    const patterns = PHILLY_TEAMS[sport] || [];
    return patterns.some(p => normalized.includes(p));
}

function formatDateForESPN(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
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

            // If gameId provided, fetch game details from ESPN
            let gameDetails = { homeTeam, awayTeam, gameTime };
            if (gameId) {
                try {
                    const url = `${SCOREBOARD_URLS[sport]}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    const event = (data.events || []).find(e => e.id === gameId);
                    if (event) {
                        const competition = event.competitions?.[0];
                        const home = competition?.competitors?.find(c => c.homeAway === 'home');
                        const away = competition?.competitors?.find(c => c.homeAway === 'away');
                        gameDetails = {
                            homeTeam: home?.team?.displayName || homeTeam,
                            awayTeam: away?.team?.displayName || awayTeam,
                            gameTime: new Date(event.date)
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
