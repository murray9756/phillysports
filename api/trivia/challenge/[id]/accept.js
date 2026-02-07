// Accept a challenge
// POST /api/trivia/challenge/[id]/accept

import { authenticate } from '../../../lib/auth.js';
import { acceptChallenge, getChallengeState } from '../../../lib/trivia/challengeEngine.js';
import { sendTriviaNotification, PUSHER_EVENTS } from '../../../lib/pusher.js';
import { getCollection } from '../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;
        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        await acceptChallenge(id, decoded.userId);

        const state = await getChallengeState(id, decoded.userId);

        // Notify the challenger that their challenge was accepted
        await sendTriviaNotification(state.challenger.userId, PUSHER_EVENTS.TRIVIA_YOUR_TURN, {
            challengeId: id,
            opponent: { username: user.username },
            message: `${user.username} accepted your challenge! It's your turn.`
        });

        res.status(200).json({
            success: true,
            message: 'Challenge accepted',
            challenge: state
        });
    } catch (error) {
        console.error('Accept challenge error:', error);
        res.status(400).json({ error: error.message });
    }
}
