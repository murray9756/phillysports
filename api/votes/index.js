// Votes API - Upvote/Downvote for content
import { getCollection } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { authenticate } from '../lib/auth.js';
import { CONTENT_COLLECTIONS } from '../lib/mentions.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const user = await authenticate(req);

    if (req.method === 'GET') {
        return handleGetVotes(req, res, user);
    }

    if (req.method === 'POST') {
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        return handleVote(req, res, user);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetVotes(req, res, user) {
    try {
        const { contentType, contentIds } = req.query;

        if (!contentType || !contentIds) {
            return res.status(400).json({ error: 'contentType and contentIds required' });
        }

        if (!CONTENT_COLLECTIONS[contentType]) {
            return res.status(400).json({ error: 'Invalid content type' });
        }

        const ids = contentIds.split(',').map(id => {
            try {
                return new ObjectId(id.trim());
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        if (ids.length === 0) {
            return res.status(400).json({ error: 'No valid content IDs' });
        }

        const votesCollection = await getCollection('content_votes');
        const contentCollection = await getCollection(CONTENT_COLLECTIONS[contentType]);

        // Get content with vote counts
        const content = await contentCollection.find(
            { _id: { $in: ids } },
            { projection: { upvotes: 1, downvotes: 1, score: 1 } }
        ).toArray();

        // Get user's votes if authenticated
        let userVotes = {};
        if (user) {
            const votes = await votesCollection.find({
                contentType,
                contentId: { $in: ids },
                userId: user._id
            }).toArray();

            votes.forEach(v => {
                userVotes[v.contentId.toString()] = v.vote;
            });
        }

        // Build response
        const result = {};
        content.forEach(c => {
            result[c._id.toString()] = {
                upvotes: c.upvotes || 0,
                downvotes: c.downvotes || 0,
                score: c.score || 0,
                userVote: userVotes[c._id.toString()] || 0
            };
        });

        // Include zeros for IDs not found
        ids.forEach(id => {
            const idStr = id.toString();
            if (!result[idStr]) {
                result[idStr] = {
                    upvotes: 0,
                    downvotes: 0,
                    score: 0,
                    userVote: userVotes[idStr] || 0
                };
            }
        });

        return res.status(200).json({
            success: true,
            votes: result
        });
    } catch (error) {
        console.error('Get votes error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleVote(req, res, user) {
    try {
        const { contentType, contentId, vote } = req.body;

        if (!contentType || !contentId) {
            return res.status(400).json({ error: 'contentType and contentId required' });
        }

        if (!CONTENT_COLLECTIONS[contentType]) {
            return res.status(400).json({ error: 'Invalid content type' });
        }

        if (vote !== 1 && vote !== -1 && vote !== 0) {
            return res.status(400).json({ error: 'Vote must be 1, -1, or 0' });
        }

        let contentIdObj;
        try {
            contentIdObj = new ObjectId(contentId);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid content ID' });
        }

        const votesCollection = await getCollection('content_votes');
        const contentCollection = await getCollection(CONTENT_COLLECTIONS[contentType]);

        // Check if content exists
        const content = await contentCollection.findOne({ _id: contentIdObj });
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Get existing vote
        const existingVote = await votesCollection.findOne({
            contentType,
            contentId: contentIdObj,
            userId: user._id
        });

        const oldVote = existingVote?.vote || 0;
        const newVote = vote;

        // Calculate vote changes
        let upvoteChange = 0;
        let downvoteChange = 0;

        // Remove old vote effect
        if (oldVote === 1) upvoteChange--;
        if (oldVote === -1) downvoteChange--;

        // Add new vote effect
        if (newVote === 1) upvoteChange++;
        if (newVote === -1) downvoteChange++;

        // Update or remove vote record
        if (newVote === 0) {
            // Remove vote
            if (existingVote) {
                await votesCollection.deleteOne({
                    contentType,
                    contentId: contentIdObj,
                    userId: user._id
                });
            }
        } else {
            // Upsert vote
            await votesCollection.updateOne(
                {
                    contentType,
                    contentId: contentIdObj,
                    userId: user._id
                },
                {
                    $set: {
                        vote: newVote,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
        }

        // Update content vote counts
        const updateResult = await contentCollection.findOneAndUpdate(
            { _id: contentIdObj },
            {
                $inc: {
                    upvotes: upvoteChange,
                    downvotes: downvoteChange,
                    score: upvoteChange - downvoteChange
                }
            },
            { returnDocument: 'after' }
        );

        const updated = updateResult;

        return res.status(200).json({
            success: true,
            upvotes: updated?.upvotes || 0,
            downvotes: updated?.downvotes || 0,
            score: updated?.score || 0,
            userVote: newVote
        });
    } catch (error) {
        console.error('Vote error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
