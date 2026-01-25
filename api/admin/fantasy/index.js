// Admin Fantasy Contests List
// GET: List all contests with admin details
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

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
        // Require admin authentication
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { status, sport, limit = 50 } = req.query;

        const contestsCollection = await getCollection('fantasy_contests');
        const entriesCollection = await getCollection('fantasy_entries');

        // Build query
        const query = {};
        if (status) query.status = status;
        if (sport) query.sport = sport;

        const contests = await contestsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .toArray();

        // Get entry counts and check for issues
        const contestsWithDetails = await Promise.all(contests.map(async (contest) => {
            const entries = await entriesCollection
                .find({ contestId: contest._id })
                .toArray();

            const hasZeroScores = entries.length > 0 && entries.every(e => (e.totalPoints || 0) === 0);
            const hasPrizesAwarded = entries.some(e => (e.payout || 0) > 0);
            const basePot = 500;
            const prizePool = basePot + (contest.entryFee || 0) * (contest.entryCount || entries.length);

            return {
                _id: contest._id,
                title: contest.title,
                sport: contest.sport,
                status: contest.status,
                gameDate: contest.gameDate,
                gameDateString: contest.gameDateString,
                locksAt: contest.locksAt,
                endsAt: contest.endsAt,
                entryCount: contest.entryCount || entries.length,
                entryFee: contest.entryFee,
                prizePool,
                completedAt: contest.completedAt,
                createdAt: contest.createdAt,
                // Admin flags
                _hasZeroScores: hasZeroScores,
                _hasPrizesAwarded: hasPrizesAwarded,
                _needsAttention: (contest.status === 'completed' && !hasPrizesAwarded) ||
                                  (contest.status === 'live' && hasZeroScores && entries.length > 0)
            };
        }));

        // Highlight contests needing attention
        const needsAttention = contestsWithDetails.filter(c => c._needsAttention);

        return res.status(200).json({
            success: true,
            contests: contestsWithDetails,
            count: contestsWithDetails.length,
            needsAttention: needsAttention.length,
            summary: {
                upcoming: contestsWithDetails.filter(c => c.status === 'upcoming').length,
                live: contestsWithDetails.filter(c => c.status === 'live').length,
                completed: contestsWithDetails.filter(c => c.status === 'completed').length,
                cancelled: contestsWithDetails.filter(c => c.status === 'cancelled').length
            }
        });
    } catch (error) {
        console.error('Admin fantasy list error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
