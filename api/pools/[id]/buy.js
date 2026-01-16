// Purchase Squares in Block Pool
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

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
        // Authenticate user
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;
        const { squares } = req.body; // Array of { row, col }

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid pool ID' });
        }

        if (!squares || !Array.isArray(squares) || squares.length === 0) {
            return res.status(400).json({ error: 'Squares array required' });
        }

        // Validate square coordinates
        for (const sq of squares) {
            if (sq.row < 0 || sq.row > 9 || sq.col < 0 || sq.col > 9) {
                return res.status(400).json({ error: 'Invalid square coordinates' });
            }
        }

        const poolsCollection = await getCollection('block_pools');
        const pool = await poolsCollection.findOne({ _id: new ObjectId(id) });

        if (!pool) {
            return res.status(404).json({ error: 'Pool not found' });
        }

        if (pool.status !== 'open') {
            return res.status(400).json({ error: 'Pool is no longer open for purchases' });
        }

        // Check how many squares user already owns
        const existingSquares = (pool.squares || []).filter(
            s => s.userId && s.userId.toString() === user._id.toString()
        );

        if (existingSquares.length + squares.length > pool.maxPerUser) {
            return res.status(400).json({
                error: `Maximum ${pool.maxPerUser} squares per user. You have ${existingSquares.length}.`
            });
        }

        // Check if squares are available
        const takenSquares = new Set(
            (pool.squares || []).map(s => `${s.row}-${s.col}`)
        );

        for (const sq of squares) {
            if (takenSquares.has(`${sq.row}-${sq.col}`)) {
                return res.status(400).json({
                    error: `Square at row ${sq.row}, col ${sq.col} is already taken`
                });
            }
        }

        // Calculate total cost
        const totalCost = squares.length * pool.squarePrice;

        // Check user balance
        const usersCollection = await getCollection('users');
        if ((user.coinBalance || 0) < totalCost) {
            return res.status(400).json({
                error: `Insufficient Diehard Dollars. Need ${totalCost}, have ${user.coinBalance || 0}`
            });
        }

        // Deduct balance
        await usersCollection.updateOne(
            { _id: user._id },
            { $inc: { coinBalance: -totalCost } }
        );

        // Add squares to pool
        const newSquares = squares.map(sq => ({
            row: sq.row,
            col: sq.col,
            userId: user._id,
            username: user.displayName || user.username,
            isHouse: false,
            purchasedAt: new Date()
        }));

        await poolsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $push: { squares: { $each: newSquares } },
                $inc: {
                    squaresSold: squares.length,
                    prizePool: totalCost
                },
                $set: { updatedAt: new Date() }
            }
        );

        // Check if grid is now full - auto-assign numbers
        const updatedPool = await poolsCollection.findOne({ _id: new ObjectId(id) });
        if (updatedPool.squaresSold >= 100 && !updatedPool.numbersAssigned) {
            // Shuffle and assign numbers
            const shuffleArray = arr => {
                const shuffled = [...arr];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            };

            const rowNumbers = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            const colNumbers = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

            await poolsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        rowNumbers,
                        colNumbers,
                        numbersAssigned: true,
                        status: 'locked'
                    }
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: `Purchased ${squares.length} square(s) for ${totalCost} DD`,
            squaresPurchased: squares,
            totalCost,
            newBalance: (user.coinBalance || 0) - totalCost
        });
    } catch (error) {
        console.error('Buy squares error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
