import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const COINS_FOR_CORRECT_PREDICTION = 25;

export default async function handler(req, res) {
    const token = req.cookies?.auth_token;

    if (req.method === 'GET') {
        // Get predictions - either user's predictions or upcoming games
        const client = new MongoClient(uri);

        try {
            await client.connect();
            const db = client.db('phillysports');
            const gamesCollection = db.collection('games');
            const predictionsCollection = db.collection('predictions');

            const type = req.query.type || 'upcoming'; // 'upcoming', 'user', 'results'

            if (type === 'upcoming') {
                // Get upcoming games for prediction
                const now = new Date();
                const games = await gamesCollection
                    .find({ gameDate: { $gte: now }, status: 'scheduled' })
                    .sort({ gameDate: 1 })
                    .limit(20)
                    .toArray();

                // If no games, seed some sample games
                if (games.length === 0) {
                    const sampleGames = generateSampleGames();
                    await gamesCollection.insertMany(sampleGames);
                    return res.status(200).json({ success: true, games: sampleGames });
                }

                return res.status(200).json({ success: true, games });
            }

            if (type === 'user') {
                // Get user's predictions
                if (!token) {
                    return res.status(401).json({ error: 'Not authenticated' });
                }

                let decoded;
                try {
                    decoded = jwt.verify(token, JWT_SECRET);
                } catch (error) {
                    return res.status(401).json({ error: 'Invalid token' });
                }

                const predictions = await predictionsCollection
                    .find({ userId: new ObjectId(decoded.userId) })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .toArray();

                // Get game details for each prediction
                const gameIds = predictions.map(p => p.gameId);
                const games = await gamesCollection
                    .find({ _id: { $in: gameIds } })
                    .toArray();

                const gamesMap = {};
                games.forEach(g => { gamesMap[g._id.toString()] = g; });

                const enrichedPredictions = predictions.map(p => ({
                    ...p,
                    game: gamesMap[p.gameId.toString()]
                }));

                return res.status(200).json({ success: true, predictions: enrichedPredictions });
            }

            if (type === 'results') {
                // Get recent game results
                const games = await gamesCollection
                    .find({ status: 'final' })
                    .sort({ gameDate: -1 })
                    .limit(20)
                    .toArray();

                return res.status(200).json({ success: true, games });
            }

            return res.status(400).json({ error: 'Invalid type parameter' });
        } catch (error) {
            console.error('Predictions fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch predictions' });
        } finally {
            await client.close();
        }
    }

    if (req.method === 'POST') {
        // Make a prediction
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { gameId, predictedWinner } = req.body;

        if (!gameId || !predictedWinner) {
            return res.status(400).json({ error: 'Game ID and predicted winner required' });
        }

        const client = new MongoClient(uri);

        try {
            await client.connect();
            const db = client.db('phillysports');
            const gamesCollection = db.collection('games');
            const predictionsCollection = db.collection('predictions');

            // Get the game
            const game = await gamesCollection.findOne({ _id: new ObjectId(gameId) });
            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }

            // Check if game hasn't started
            if (new Date() >= new Date(game.gameDate)) {
                return res.status(400).json({ error: 'Game has already started. Predictions are closed.' });
            }

            // Check if user already predicted this game
            const existingPrediction = await predictionsCollection.findOne({
                userId: new ObjectId(decoded.userId),
                gameId: new ObjectId(gameId)
            });

            if (existingPrediction) {
                return res.status(400).json({ error: 'You already made a prediction for this game' });
            }

            // Validate predicted winner is one of the teams
            if (predictedWinner !== game.homeTeam && predictedWinner !== game.awayTeam) {
                return res.status(400).json({ error: 'Invalid team selection' });
            }

            // Create prediction
            const prediction = {
                userId: new ObjectId(decoded.userId),
                gameId: new ObjectId(gameId),
                predictedWinner,
                status: 'pending',
                coinsWon: 0,
                createdAt: new Date()
            };

            await predictionsCollection.insertOne(prediction);

            // Update user's prediction stats
            await db.collection('users').updateOne(
                { _id: new ObjectId(decoded.userId) },
                { $inc: { 'predictionStats.totalPredictions': 1 } }
            );

            res.status(201).json({
                success: true,
                message: 'Prediction submitted!',
                prediction
            });
        } catch (error) {
            console.error('Prediction error:', error);
            res.status(500).json({ error: 'Failed to submit prediction' });
        } finally {
            await client.close();
        }
        return;
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

function generateSampleGames() {
    const now = new Date();
    const games = [];

    // Generate games for the next 7 days
    const teams = [
        { home: 'Eagles', away: 'Cowboys', league: 'NFL' },
        { home: 'Eagles', away: 'Giants', league: 'NFL' },
        { home: 'Phillies', away: 'Mets', league: 'MLB' },
        { home: 'Phillies', away: 'Braves', league: 'MLB' },
        { home: 'Sixers', away: 'Celtics', league: 'NBA' },
        { home: 'Sixers', away: 'Knicks', league: 'NBA' },
        { home: 'Flyers', away: 'Penguins', league: 'NHL' },
        { home: 'Flyers', away: 'Rangers', league: 'NHL' }
    ];

    for (let i = 0; i < teams.length; i++) {
        const gameDate = new Date(now);
        gameDate.setDate(gameDate.getDate() + Math.floor(i / 2) + 1);
        gameDate.setHours(19 + (i % 2), 0, 0, 0);

        games.push({
            homeTeam: teams[i].home,
            awayTeam: teams[i].away,
            league: teams[i].league,
            gameDate: gameDate,
            status: 'scheduled',
            venue: getVenue(teams[i].home),
            createdAt: new Date()
        });
    }

    return games;
}

function getVenue(team) {
    const venues = {
        'Eagles': 'Lincoln Financial Field',
        'Phillies': 'Citizens Bank Park',
        'Sixers': 'Wells Fargo Center',
        'Flyers': 'Wells Fargo Center'
    };
    return venues[team] || 'Home Stadium';
}
