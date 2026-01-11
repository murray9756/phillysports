import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { sanitizeString } from '../lib/validate.js';

export default async function handler(req, res) {
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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { url, title } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'Article URL is required' });
        }

        const users = await getCollection('users');
        const userId = new ObjectId(decoded.userId);

        const user = await users.findOne({ _id: userId });
        const isSaved = user.savedArticles?.some(article => article.url === url);

        if (isSaved) {
            await users.updateOne(
                { _id: userId },
                {
                    $pull: { savedArticles: { url } },
                    $set: { updatedAt: new Date() }
                }
            );

            res.status(200).json({
                message: 'Article removed from saved',
                saved: false
            });
        } else {
            await users.updateOne(
                { _id: userId },
                {
                    $push: {
                        savedArticles: {
                            url,
                            title: sanitizeString(title || 'Untitled', 200),
                            savedAt: new Date()
                        }
                    },
                    $set: { updatedAt: new Date() }
                }
            );

            res.status(200).json({
                message: 'Article saved',
                saved: true
            });
        }
    } catch (error) {
        console.error('Save article error:', error);
        res.status(500).json({ error: 'Failed to save article' });
    }
}
