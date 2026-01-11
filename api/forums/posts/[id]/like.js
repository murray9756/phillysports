// Post Like API
// POST /api/forums/posts/[id]/like - Toggle like on post

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
            return res.status(400).json({ error: 'Invalid post ID' });
        }

        const posts = await getCollection('forum_posts');
        const post = await posts.findOne({ _id: new ObjectId(id), status: 'active' });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Cannot like own post
        if (post.authorId.toString() === auth.userId) {
            return res.status(400).json({ error: 'Cannot like your own post' });
        }

        const userIdObj = new ObjectId(auth.userId);
        const likes = post.likes || [];
        const alreadyLiked = likes.some(id => id.toString() === auth.userId);

        let coinsAwarded = 0;

        if (alreadyLiked) {
            // Remove like
            await posts.updateOne(
                { _id: new ObjectId(id) },
                {
                    $pull: { likes: userIdObj },
                    $inc: { likeCount: -1 }
                }
            );
        } else {
            // Add like
            await posts.updateOne(
                { _id: new ObjectId(id) },
                {
                    $addToSet: { likes: userIdObj },
                    $inc: { likeCount: 1 }
                }
            );

            // Award coins to post author
            const reward = await awardLikeCoins(post.authorId.toString());
            if (reward.awarded) {
                coinsAwarded = reward.amount;
            }
        }

        return res.status(200).json({
            liked: !alreadyLiked,
            likeCount: post.likeCount + (alreadyLiked ? -1 : 1),
            coinsAwarded
        });

    } catch (error) {
        console.error('Like post error:', error);
        return res.status(500).json({ error: 'Failed to toggle like' });
    }
}
