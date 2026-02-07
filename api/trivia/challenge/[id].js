// Get specific challenge state
// GET /api/trivia/challenge/[id]

import { authenticate } from '../../lib/auth.js';
import { getChallengeState, handleTimeout, spinWheel, submitAnswer } from '../../lib/trivia/challengeEngine.js';
import { getCollection } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

// Bot auto-play: triggered when polling detects it's a bot's turn
const BOT_ACCURACY = 0.65;

function pickBotAnswer(options, correctAnswer) {
    if (Math.random() < BOT_ACCURACY) return correctAnswer;
    const wrong = options.filter(o => o.toLowerCase() !== correctAnswer.toLowerCase());
    return wrong.length > 0 ? wrong[Math.floor(Math.random() * wrong.length)] : options[0];
}

async function autoBotPlay(challengeId, botId) {
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
}

export default async function handler(req, res) {
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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;

        // Check for timeout first
        await handleTimeout(id);

        // If it's a bot's turn, auto-play before returning state
        const challenges = await getCollection('trivia_challenges');
        const challenge = await challenges.findOne({ _id: new ObjectId(id) });
        if (challenge && challenge.status === 'active' && challenge.currentTurn) {
            const users = await getCollection('users');
            const turnUser = await users.findOne({ _id: challenge.currentTurn });
            if (turnUser && turnUser.isBot) {
                await autoBotPlay(id, turnUser._id.toString());
            }
        }

        // Get challenge state
        const state = await getChallengeState(id, decoded.userId);

        res.status(200).json(state);
    } catch (error) {
        console.error('Get challenge error:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            error: error.message
        });
    }
}
