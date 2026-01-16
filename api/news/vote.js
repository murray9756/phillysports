// News Vote API
// POST: Vote on a news article (upvote/downvote)
// GET: Get vote counts for articles

import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const votes = await getCollection('news_votes');

        if (req.method === 'GET') {
            // Get vote counts for multiple articles
            const { articleIds } = req.query;

            if (!articleIds) {
                return res.status(400).json({ error: 'articleIds required' });
            }

            const ids = articleIds.split(',');
            const voteCounts = {};

            for (const id of ids) {
                const upvotes = await votes.countDocuments({ articleId: id, vote: 1 });
                const downvotes = await votes.countDocuments({ articleId: id, vote: -1 });
                voteCounts[id] = { upvotes, downvotes, score: upvotes - downvotes };
            }

            // Check user's votes if authenticated
            const user = await authenticate(req);
            let userVotes = {};

            if (user) {
                const userVoteDocs = await votes.find({
                    visitorId: user.visitorId || user.userId,
                    articleId: { $in: ids }
                }).toArray();

                userVoteDocs.forEach(v => {
                    userVotes[v.articleId] = v.vote;
                });
            }

            return res.status(200).json({ voteCounts, userVotes });
        }

        if (req.method === 'POST') {
            const { articleId, vote } = req.body;

            if (!articleId) {
                return res.status(400).json({ error: 'articleId required' });
            }

            if (vote !== 1 && vote !== -1 && vote !== 0) {
                return res.status(400).json({ error: 'vote must be 1, -1, or 0 (remove)' });
            }

            // Get user ID or generate visitor ID from IP
            const user = await authenticate(req);
            let visitorId;

            if (user) {
                visitorId = user.userId;
            } else {
                // Use IP-based visitor ID for anonymous votes
                const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
                           req.headers['x-real-ip'] ||
                           'anonymous';
                visitorId = crypto.createHash('md5').update(ip).digest('hex');
            }

            // Check for existing vote
            const existingVote = await votes.findOne({
                articleId,
                visitorId
            });

            if (vote === 0) {
                // Remove vote
                if (existingVote) {
                    await votes.deleteOne({ _id: existingVote._id });
                }
            } else if (existingVote) {
                // Update existing vote
                await votes.updateOne(
                    { _id: existingVote._id },
                    { $set: { vote, updatedAt: new Date() } }
                );
            } else {
                // Create new vote
                await votes.insertOne({
                    articleId,
                    visitorId,
                    vote,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            // Get updated counts
            const upvotes = await votes.countDocuments({ articleId, vote: 1 });
            const downvotes = await votes.countDocuments({ articleId, vote: -1 });

            return res.status(200).json({
                success: true,
                articleId,
                userVote: vote,
                upvotes,
                downvotes,
                score: upvotes - downvotes
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Vote error:', error);
        return res.status(500).json({ error: 'Failed to process vote' });
    }
}
