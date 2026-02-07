// Accept a challenge
// POST /api/trivia/challenge/[id]/accept

import { authenticate } from '../../../lib/auth.js';
import { acceptChallenge, getChallengeState, spinWheel, submitAnswer } from '../../../lib/trivia/challengeEngine.js';
import { sendTriviaNotification, PUSHER_EVENTS } from '../../../lib/pusher.js';
import { getCollection } from '../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

// Bot auto-play settings
const BOT_ACCURACY = 0.65;

function pickBotAnswer(options, correctAnswer) {
    if (Math.random() < BOT_ACCURACY) return correctAnswer;
    const wrong = options.filter(o => o.toLowerCase() !== correctAnswer.toLowerCase());
    return wrong.length > 0 ? wrong[Math.floor(Math.random() * wrong.length)] : options[0];
}

async function autoBotPlay(challengeId, botId) {
    try {
        const challenges = await getCollection('trivia_challenges');
        const questionsCollection = await getCollection('trivia_questions');
        let keepPlaying = true;
        while (keepPlaying) {
            const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
            if (!challenge || challenge.status !== 'active') break;
            if (challenge.currentTurn.toString() !== botId) break;
            if (!challenge.currentQuestion) {
                await spinWheel(challengeId, botId);
            }
            const updated = await challenges.findOne({ _id: new ObjectId(challengeId) });
            if (!updated || !updated.currentQuestion) break;
            let correctAnswer = null;
            const qId = updated.currentQuestion._id;
            if (ObjectId.isValid(qId)) {
                const fullQ = await questionsCollection.findOne({ _id: new ObjectId(qId) });
                if (fullQ) correctAnswer = fullQ.answer;
            }
            const botAnswer = correctAnswer
                ? pickBotAnswer(updated.currentQuestion.options, correctAnswer)
                : updated.currentQuestion.options[Math.floor(Math.random() * updated.currentQuestion.options.length)];
            const result = await submitAnswer(challengeId, botId, botAnswer);
            if (!result.correct || result.gameOver) keepPlaying = false;
        }
    } catch (err) {
        console.error('Bot auto-play error (accept):', err);
    }
}

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

        // If the challenger is a bot, auto-play their first turn after a delay
        if (state.currentTurn) {
            const currentTurnUser = await users.findOne({ _id: new ObjectId(state.currentTurn) });
            if (currentTurnUser && currentTurnUser.isBot) {
                setTimeout(() => {
                    autoBotPlay(id, currentTurnUser._id.toString());
                }, 3000);
            }
        }

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
