// Founders Club API
// GET: Get founders count and spots remaining

import { getFoundersCount } from '../lib/subscriptions.js';

export default async function handler(req, res) {
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
        const founders = await getFoundersCount();

        res.status(200).json({
            success: true,
            foundersClub: {
                current: founders.current,
                limit: founders.limit,
                spotsRemaining: founders.spotsRemaining,
                isFull: founders.spotsRemaining === 0
            }
        });
    } catch (error) {
        console.error('Founders count error:', error);
        res.status(500).json({ error: 'Failed to get founders count' });
    }
}
