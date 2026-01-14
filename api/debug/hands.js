// Debug endpoint to check hands
import { getCollection } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const hands = await getCollection('poker_hands');
        const tableId = req.query.tableId;

        const query = tableId ? { tableId: new ObjectId(tableId) } : {};
        const recentHands = await hands.find(query)
            .sort({ startedAt: -1 })
            .limit(5)
            .toArray();

        return res.status(200).json({
            count: recentHands.length,
            hands: recentHands.map(h => ({
                _id: h._id.toString(),
                tableId: h.tableId?.toString(),
                status: h.status,
                pot: h.pot,
                actingPosition: h.actingPosition,
                players: h.players?.map(p => ({
                    pos: p.position,
                    chips: p.chipStackCurrent,
                    folded: p.isFolded,
                    allIn: p.isAllIn
                })),
                actions: h.actions?.length,
                winners: h.winners,
                startedAt: h.startedAt,
                endedAt: h.endedAt
            }))
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
