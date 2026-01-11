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
    const type = req.query.type; // 'sent', 'received', or undefined for both

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const transactionsCollection = db.collection('transactions');

        let filter = {
            userId: new ObjectId(decoded.userId),
            type: { $in: ['tip_sent', 'tip_received'] }
        };

        if (type === 'sent') {
            filter.type = 'tip_sent';
        } else if (type === 'received') {
            filter.type = 'tip_received';
        }

        const transactions = await transactionsCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        const total = await transactionsCollection.countDocuments(filter);

        // Get totals
        const stats = await transactionsCollection.aggregate([
            { $match: { userId: new ObjectId(decoded.userId), type: { $in: ['tip_sent', 'tip_received'] } } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: { $abs: '$amount' } },
                    count: { $sum: 1 }
                }
            }
        ]).toArray();

        const tipStats = {
            sent: { total: 0, count: 0 },
            received: { total: 0, count: 0 }
        };

        stats.forEach(s => {
            if (s._id === 'tip_sent') {
                tipStats.sent = { total: s.total, count: s.count };
            } else if (s._id === 'tip_received') {
                tipStats.received = { total: s.total, count: s.count };
            }
        });

        res.status(200).json({
            success: true,
            transactions,
            total,
            hasMore: offset + transactions.length < total,
            stats: tipStats
        });
    } catch (error) {
        console.error('Tip history error:', error);
        res.status(500).json({ error: 'Failed to fetch tip history' });
    } finally {
        await client.close();
    }
}
