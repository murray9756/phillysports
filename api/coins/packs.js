// Diehard Dollar Packs API
// GET: List available coin packs for purchase

export const COIN_PACKS = [
    {
        id: 'pack_100',
        name: 'Starter Pack',
        coins: 100,
        priceUSD: 99, // cents
        priceDisplay: '$0.99',
        bonus: 0,
        popular: false
    },
    {
        id: 'pack_600',
        name: 'Fan Pack',
        coins: 600,
        priceUSD: 499, // cents
        priceDisplay: '$4.99',
        bonus: 100, // 500 base + 100 bonus
        popular: true
    },
    {
        id: 'pack_1500',
        name: 'Diehard Pack',
        coins: 1500,
        priceUSD: 999, // cents
        priceDisplay: '$9.99',
        bonus: 500, // 1000 base + 500 bonus
        popular: false
    },
    {
        id: 'pack_5000',
        name: 'Ultimate Pack',
        coins: 5000,
        priceUSD: 2499, // cents
        priceDisplay: '$24.99',
        bonus: 2500, // 2500 base + 2500 bonus (100% bonus!)
        popular: false
    }
];

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

    res.status(200).json({
        packs: COIN_PACKS.map(pack => ({
            ...pack,
            valuePerDollar: Math.round(pack.coins / (pack.priceUSD / 100))
        }))
    });
}
