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

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const transactionsCollection = db.collection('transactions');

        const transactions = await transactionsCollection
            .find({ userId: new ObjectId(decoded.userId) })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        const total = await transactionsCollection.countDocuments({ userId: new ObjectId(decoded.userId) });

        res.status(200).json({
            success: true,
            transactions,
            total,
            hasMore: offset + transactions.length < total
        });
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch transaction history' });
    } finally {
        await client.close();
    }
}
