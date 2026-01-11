// Reply Like API
// POST /api/forums/replies/[id]/like - Toggle like on reply

import { ObjectId } from 'mongodb';
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { awardLikeCoins } from '../../../lib/community.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid reply ID' });
        }

        const replies = await getCollection('forum_replies');
        const reply = await replies.findOne({ _id: new ObjectId(id), status: 'active' });

        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Cannot like own reply
        if (reply.authorId.toString() === auth.userId) {
            return res.status(400).json({ error: 'Cannot like your own reply' });
        }

        const userIdObj = new ObjectId(auth.userId);
        const likes = reply.likes || [];
        const alreadyLiked = likes.some(id => id.toString() === auth.userId);

        let coinsAwarded = 0;

        if (alreadyLiked) {
            // Remove like
            await replies.updateOne(
                { _id: new ObjectId(id) },
                {
                    $pull: { likes: userIdObj },
                    $inc: { likeCount: -1 }
                }
            );
        } else {
            // Add like
            await replies.updateOne(
                { _id: new ObjectId(id) },
                {
                    $addToSet: { likes: userIdObj },
                    $inc: { likeCount: 1 }
                }
            );

            // Award coins to reply author
            const reward = await awardLikeCoins(reply.authorId.toString());
            if (reward.awarded) {
                coinsAwarded = reward.amount;
            }
        }

        return res.status(200).json({
            liked: !alreadyLiked,
            likeCount: reply.likeCount + (alreadyLiked ? -1 : 1),
            coinsAwarded
        });

    } catch (error) {
        console.error('Like reply error:', error);
        return res.status(500).json({ error: 'Failed to toggle like' });
    }
}
