// Get specific challenge state
// GET /api/trivia/challenge/[id]

import { readFileSync } from 'fs';
import { join } from 'path';
import { authenticate } from '../../lib/auth.js';
import { getChallengeState, handleTimeout, spinWheel, submitAnswer } from '../../lib/trivia/challengeEngine.js';
import { getCollection } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

const CATEGORY_JSON_FILES = {
    'Eagles': 'eagles-questions.json',
    'Phillies': 'phillies-questions.json',
    '76ers': 'sixers-questions.json',
    'Flyers': 'flyers-questions.json',
    'College': 'college-questions.json',
    'General': 'general-questions.json'
};
const jsonCache = {};

// Bot auto-play: triggered when polling detects it's a bot's turn
// 80% accuracy — competitive but beatable
const BOT_ACCURACY = 0.80;

function pickBotAnswer(options, correctAnswer) {
    if (Math.random() < BOT_ACCURACY) return correctAnswer;
    const wrong = options.filter(o => o.toLowerCase() !== correctAnswer.toLowerCase());
    return wrong.length > 0 ? wrong[Math.floor(Math.random() * wrong.length)] : options[0];
}

/**
 * Look up the correct answer for a question.
 * Checks trivia_questions DB first, then JSON files, then legacy questions.
 */
async function lookupAnswer(questionId, category) {
    // Try database first
    if (ObjectId.isValid(questionId)) {
        const questionsCollection = await getCollection('trivia_questions');
        const fullQ = await questionsCollection.findOne({ _id: new ObjectId(questionId) });
        if (fullQ) return fullQ.answer;
    }

    // Try JSON files (for questions where _id is the question text)
    if (category && CATEGORY_JSON_FILES[category]) {
        const jsonFile = CATEGORY_JSON_FILES[category];
        if (!jsonCache[category]) {
            try {
                const filePath = join(process.cwd(), 'trivia-data', jsonFile);
                jsonCache[category] = JSON.parse(readFileSync(filePath, 'utf-8'));
            } catch (e) {
                jsonCache[category] = [];
            }
        }
        const match = jsonCache[category].find(q => q.question === questionId);
        if (match) return String(match.answer);
    }

    // Fall back to legacy questions
    try {
        const trivia = await import('../../lib/trivia/questions.js').catch(() => null)
            || await import('../../trivia/index.js').catch(() => null);
        if (trivia) {
            const allQuestions = trivia.TRIVIA_QUESTIONS || trivia.default?.TRIVIA_QUESTIONS || [];
            const match = allQuestions.find(q => q._id === questionId || q._id?.toString() === questionId);
            if (match) return match.answer;
        }
    } catch (e) {
        // Legacy import failed, skip
    }

    return null;
}

/**
 * Bot plays exactly ONE question per poll cycle.
 * If the bot answers correctly (keeps its turn), the next poll (3s later)
 * will trigger the next question. This lets the human watch the game unfold.
 */
async function autoBotPlay(challengeId, botId) {
    const challenges = await getCollection('trivia_challenges');

    const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!challenge || challenge.status !== 'active') return;
    if (challenge.currentTurn.toString() !== botId) return;

    // Step 1: Spin if no question yet
    if (!challenge.currentQuestion) {
        await spinWheel(challengeId, botId);
    }

    // Step 2: Re-fetch and answer
    const updated = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!updated || !updated.currentQuestion) return;

    const correctAnswer = await lookupAnswer(updated.currentQuestion._id, updated.currentCategory);

    const botAnswer = correctAnswer
        ? pickBotAnswer(updated.currentQuestion.options, correctAnswer)
        : updated.currentQuestion.options[Math.floor(Math.random() * updated.currentQuestion.options.length)];

    await submitAnswer(challengeId, botId, botAnswer);
    // Stop here — next poll will trigger next turn if bot still has it
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
