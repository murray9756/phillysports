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
            return res.status(401).json({ error: 'Not authenticated', user: null });
        }

        const users = await getCollection('users');

        // Get fresh user data from database
        const user = await users.findOne(
            { _id: new ObjectId(decoded.userId) },
            { projection: { password: 0 } } // Exclude password
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found', user: null });
        }

        res.status(200).json({
            user: {
                ...user,
                _id: user._id.toString()
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
};
