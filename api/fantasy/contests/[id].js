// Fantasy Contest Details API
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const { id } = req.query;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid contest ID' });
        }

        const contestsCollection = await getCollection('fantasy_contests');
        const contest = await contestsCollection.findOne({ _id: new ObjectId(id) });

        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }

        // Get user's entry if logged in
        let userEntry = null;
        let userEntryCount = 0;
        const user = await authenticate(req);
        if (user) {
            const entriesCollection = await getCollection('fantasy_entries');
            userEntry = await entriesCollection.findOne({
                contestId: new ObjectId(id),
                userId: user._id
            });
            userEntryCount = await entriesCollection.countDocuments({
                contestId: new ObjectId(id),
                userId: user._id
            });
        }

        // Get top entries for leaderboard preview (if contest has started)
        let topEntries = [];
        if (contest.status === 'live' || contest.status === 'completed') {
            const entriesCollection = await getCollection('fantasy_entries');
            topEntries = await entriesCollection
                .find({ contestId: new ObjectId(id) })
                .sort({ totalPoints: -1 })
                .limit(10)
                .toArray();
        }

        // Check if contest is locked
        const now = new Date();
        const isLocked = now >= new Date(contest.locksAt);

        return res.status(200).json({
            success: true,
            contest: {
                ...contest,
                isLocked,
                canEnter: !isLocked && contest.status === 'upcoming' && contest.entryCount < contest.maxTotalEntries
            },
            userEntry,
            userEntryCount,
            canEnterMore: userEntryCount < contest.maxEntries && !isLocked,
            topEntries: topEntries.map(e => ({
                username: e.username,
                totalPoints: e.totalPoints,
                rank: e.finalRank
            }))
        });
    } catch (error) {
        console.error('Contest details error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
