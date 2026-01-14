// Pusher Config API
// GET: Returns public Pusher key for frontend

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Return public Pusher key (safe to expose)
    return res.status(200).json({
        key: process.env.PUSHER_KEY || null,
        cluster: process.env.PUSHER_CLUSTER || 'us2'
    });
}
