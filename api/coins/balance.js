import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(decoded.userId) },
            { projection: { coinBalance: 1, lifetimeCoins: 1, dailyLoginStreak: 1, badges: 1 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            coinBalance: user.coinBalance || 0,
            lifetimeCoins: user.lifetimeCoins || 0,
            dailyLoginStreak: user.dailyLoginStreak || 0,
            badges: user.badges || []
        });
    } catch (error) {
        console.error('Balance fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    } finally {
        await client.close();
    }
}
