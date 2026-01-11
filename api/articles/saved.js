const { ObjectId } = require('mongodb');
const { getCollection } = require('../lib/mongodb');
const { authenticate } = require('../lib/auth');

module.exports = async function handler(req, res) {
    // Set CORS headers
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
        // Authenticate user
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const userId = new ObjectId(decoded.userId);

        const user = await users.findOne(
            { _id: userId },
            { projection: { savedArticles: 1 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Sort by savedAt descending (most recent first)
        const savedArticles = (user.savedArticles || [])
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

        res.status(200).json({
            articles: savedArticles
        });
    } catch (error) {
        console.error('Get saved articles error:', error);
        res.status(500).json({ error: 'Failed to get saved articles' });
    }
};
