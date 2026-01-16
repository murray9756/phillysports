// Assign Random Numbers to Pool Grid
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
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid pool ID' });
        }

        const poolsCollection = await getCollection('block_pools');
        const pool = await poolsCollection.findOne({ _id: new ObjectId(id) });

        if (!pool) {
            return res.status(404).json({ error: 'Pool not found' });
        }

        // Only creator can manually assign numbers
        if (pool.creatorId && pool.creatorId.toString() !== user._id.toString()) {
            return res.status(403).json({ error: 'Only pool creator can assign numbers' });
        }

        if (pool.numbersAssigned) {
            return res.status(400).json({ error: 'Numbers already assigned' });
        }

        // Shuffle function
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
                    status: pool.status === 'open' ? 'locked' : pool.status,
                    updatedAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            rowNumbers,
            colNumbers,
            message: 'Numbers assigned successfully'
        });
    } catch (error) {
        console.error('Assign numbers error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
