// Game Thread Details API
import { getCollection } from '../lib/mongodb.js';
import { fetchScoreboard } from '../lib/espn.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    // CORS headers
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
            return res.status(400).json({ error: 'Invalid thread ID' });
        }

        const threadsCollection = await getCollection('game_threads');
        const commentsCollection = await getCollection('game_thread_comments');

        // Get thread
        const thread = await threadsCollection.findOne({ _id: new ObjectId(id) });

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Fetch live score if game is active
        if (thread.status === 'live' || thread.status === 'pre-game') {
            try {
                const games = await fetchScoreboard(thread.sport);
                const game = games.find(g =>
                    g.homeTeam === thread.homeTeam || g.awayTeam === thread.awayTeam ||
                    g.homeTeamShort?.includes(thread.homeTeam?.split(' ').pop()) ||
                    g.awayTeamShort?.includes(thread.awayTeam?.split(' ').pop())
                );

                if (game) {
                    thread.currentScore = {
                        home: game.homeScore,
                        away: game.awayScore,
                        period: game.statusDescription,
                        isFinal: game.isFinal,
                        isInProgress: game.isInProgress
                    };

                    // Update status if changed
                    let newStatus = thread.status;
                    if (game.isFinal) {
                        newStatus = 'post-game';
                    } else if (game.isInProgress) {
                        newStatus = 'live';
                    }

                    if (newStatus !== thread.status) {
                        await threadsCollection.updateOne(
                            { _id: new ObjectId(id) },
                            {
                                $set: {
                                    status: newStatus,
                                    currentScore: thread.currentScore,
                                    updatedAt: new Date()
                                }
                            }
                        );
                        thread.status = newStatus;
                    }
                }
            } catch (e) {
                console.error('Error fetching live score:', e);
            }
        }

        // Get recent comments (last 50)
        const { offset = 0, limit = 50 } = req.query;
        const comments = await commentsCollection
            .find({ threadId: new ObjectId(id) })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .toArray();

        // Reverse to show oldest first in UI
        comments.reverse();

        // Get total comment count
        const totalComments = await commentsCollection.countDocuments({ threadId: new ObjectId(id) });

        return res.status(200).json({
            success: true,
            thread,
            comments,
            pagination: {
                total: totalComments,
                offset: parseInt(offset),
                limit: parseInt(limit),
                hasMore: totalComments > parseInt(offset) + parseInt(limit)
            },
            pusherKey: process.env.PUSHER_KEY,
            pusherCluster: process.env.PUSHER_CLUSTER
        });
    } catch (error) {
        console.error('Get thread error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
