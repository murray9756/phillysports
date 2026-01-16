// Add Reaction to Game Thread
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { getPusher } from '../../lib/pusher.js';
import { ObjectId } from 'mongodb';

const VALID_REACTIONS = ['fire', 'celebrate', 'angry', 'skull'];

export default async function handler(req, res) {
    // CORS headers
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
        // Authenticate user (optional - allow anonymous reactions)
        const user = await authenticate(req);

        const { id } = req.query;
        const { reaction } = req.body;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid thread ID' });
        }

        if (!reaction || !VALID_REACTIONS.includes(reaction)) {
            return res.status(400).json({
                error: 'Invalid reaction',
                validReactions: VALID_REACTIONS
            });
        }

        const threadsCollection = await getCollection('game_threads');

        // Get thread
        const thread = await threadsCollection.findOne({ _id: new ObjectId(id) });
        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Increment reaction count
        const updateField = `reactions.${reaction}`;
        const result = await threadsCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $inc: { [updateField]: 1 },
                $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );

        const updatedReactions = result.reactions;

        // Broadcast to Pusher
        const pusher = getPusher();
        if (pusher) {
            try {
                await pusher.trigger(thread.pusherChannel, 'reaction', {
                    reaction,
                    reactions: updatedReactions
                });
            } catch (e) {
                console.error('Pusher error:', e);
            }
        }

        return res.status(200).json({
            success: true,
            reactions: updatedReactions
        });
    } catch (error) {
        console.error('React error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
