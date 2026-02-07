// Trivia Bot - Auto-play ONE bot turn
// POST /api/trivia/bot/play
// Admin-only endpoint that plays a single bot turn in active challenges

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import { spinWheel, submitAnswer } from '../../lib/trivia/challengeEngine.js';

const BOT_USERNAME = 'TriviaBot';
const BOT_ACCURACY = 0.80;

function pickBotAnswer(options, correctAnswer) {
    if (Math.random() < BOT_ACCURACY) return correctAnswer;
    const wrong = options.filter(o => o.toLowerCase() !== correctAnswer.toLowerCase());
    return wrong.length > 0 ? wrong[Math.floor(Math.random() * wrong.length)] : options[0];
}

async function lookupAnswer(questionId) {
    if (ObjectId.isValid(questionId)) {
        const questionsCollection = await getCollection('trivia_questions');
        const fullQ = await questionsCollection.findOne({ _id: new ObjectId(questionId) });
        if (fullQ) return fullQ.answer;
    }
    try {
        const trivia = await import('../../lib/trivia/questions.js').catch(() => null)
            || await import('../../trivia/index.js').catch(() => null);
        if (trivia) {
            const allQuestions = trivia.TRIVIA_QUESTIONS || trivia.default?.TRIVIA_QUESTIONS || [];
            const match = allQuestions.find(q => q._id === questionId || q._id?.toString() === questionId);
            if (match) return match.answer;
        }
    } catch (e) {}
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const decoded = await authenticate(req);
        if (!decoded || !decoded.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { challengeId } = req.body || {};
        const users = await getCollection('users');
        const bot = await users.findOne({ username: BOT_USERNAME });
        if (!bot) return res.status(404).json({ error: 'TriviaBot not found.' });

        const botId = bot._id.toString();
        const challenges = await getCollection('trivia_challenges');

        const query = { status: 'active', currentTurn: bot._id };
        if (challengeId) query._id = new ObjectId(challengeId);

        const activeChallenges = await challenges.find(query).toArray();
        if (activeChallenges.length === 0) {
            return res.status(200).json({ success: true, message: 'No bot turns to play', played: 0 });
        }

        const results = [];
        for (const challenge of activeChallenges) {
            const cId = challenge._id.toString();
            try {
                // Spin if needed
                if (!challenge.currentQuestion) {
                    await spinWheel(cId, botId);
                }
                const updated = await challenges.findOne({ _id: challenge._id });
                if (!updated || !updated.currentQuestion) {
                    results.push({ challengeId: cId, action: 'error', error: 'No question after spin' });
                    continue;
                }

                const correctAnswer = await lookupAnswer(updated.currentQuestion._id);
                const botAnswer = correctAnswer
                    ? pickBotAnswer(updated.currentQuestion.options, correctAnswer)
                    : updated.currentQuestion.options[Math.floor(Math.random() * updated.currentQuestion.options.length)];

                const turnResult = await submitAnswer(cId, botId, botAnswer);
                results.push({
                    challengeId: cId,
                    action: 'answer',
                    question: updated.currentQuestion.question,
                    botAnswer,
                    correct: turnResult.correct,
                    correctAnswer: turnResult.correctAnswer,
                    pieceWon: turnResult.pieceWon,
                    gameOver: turnResult.gameOver
                });
            } catch (err) {
                results.push({ challengeId: cId, action: 'error', error: err.message });
            }
        }

        res.status(200).json({ success: true, played: results.length, results });
    } catch (error) {
        console.error('Bot play error:', error);
        res.status(500).json({ error: error.message });
    }
}
