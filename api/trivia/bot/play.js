// Trivia Bot - Auto-play bot turns
// POST /api/trivia/bot/play
// Admin-only endpoint that plays the bot's turn in active challenges
//
// Body: { challengeId: "optional - plays specific match, or all bot matches" }

import { ObjectId } from 'mongodb';
import { authenticate } from '../../lib/auth.js';
import { getCollection } from '../../lib/mongodb.js';
import { spinWheel, submitAnswer } from '../../lib/trivia/challengeEngine.js';

const BOT_USERNAME = 'TriviaBot';

// Bot difficulty: probability of answering correctly (0.0 - 1.0)
// Set to ~65% to make games competitive but beatable
const BOT_ACCURACY = 0.65;

// Delay range in ms before bot "answers" (for realism when polling)
const BOT_MIN_DELAY = 2000;
const BOT_MAX_DELAY = 5000;

/**
 * Pick the bot's answer.
 * Has BOT_ACCURACY chance of picking the correct answer,
 * otherwise picks a random wrong answer.
 */
function pickBotAnswer(options, correctAnswer) {
    if (Math.random() < BOT_ACCURACY) {
        return correctAnswer;
    }
    // Pick a random wrong answer
    const wrongOptions = options.filter(o => o.toLowerCase() !== correctAnswer.toLowerCase());
    if (wrongOptions.length === 0) return options[0];
    return wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
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
        // Admin-only
        const decoded = await authenticate(req);
        if (!decoded || !decoded.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { challengeId } = req.body || {};

        const users = await getCollection('users');
        const bot = await users.findOne({ username: BOT_USERNAME });
        if (!bot) {
            return res.status(404).json({ error: 'TriviaBot not found. Create a challenge first.' });
        }

        const botId = bot._id.toString();
        const challenges = await getCollection('trivia_challenges');

        // Find challenges where it's the bot's turn
        const query = {
            status: 'active',
            currentTurn: bot._id
        };
        if (challengeId) {
            query._id = new ObjectId(challengeId);
        }

        const activeChallenges = await challenges.find(query).toArray();

        if (activeChallenges.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No active challenges where it is the bot\'s turn',
                played: 0
            });
        }

        const results = [];

        for (const challenge of activeChallenges) {
            const cId = challenge._id.toString();
            try {
                let turnResult;

                if (!challenge.currentQuestion) {
                    // Step 1: Spin the wheel
                    const spinResult = await spinWheel(cId, botId);

                    // Step 2: Get the full question (with answer) from DB to decide
                    const questionsCollection = await getCollection('trivia_questions');
                    let correctAnswer = null;

                    if (ObjectId.isValid(spinResult.question._id)) {
                        const fullQ = await questionsCollection.findOne({
                            _id: new ObjectId(spinResult.question._id)
                        });
                        if (fullQ) correctAnswer = fullQ.answer;
                    }

                    // Fallback: if we can't find the answer, pick randomly
                    const botAnswer = correctAnswer
                        ? pickBotAnswer(spinResult.question.options, correctAnswer)
                        : spinResult.question.options[Math.floor(Math.random() * spinResult.question.options.length)];

                    // Step 3: Submit the answer
                    turnResult = await submitAnswer(cId, botId, botAnswer);

                    results.push({
                        challengeId: cId,
                        action: 'spin_and_answer',
                        category: spinResult.category,
                        question: spinResult.question.question,
                        botAnswer,
                        correct: turnResult.correct,
                        correctAnswer: turnResult.correctAnswer,
                        pieceWon: turnResult.pieceWon,
                        gameOver: turnResult.gameOver
                    });

                    // If correct and game not over, bot gets another turn - play it too
                    if (turnResult.correct && !turnResult.gameOver && turnResult.continuesTurn) {
                        // Recursively play consecutive turns (bot keeps going if correct)
                        let keepPlaying = true;
                        while (keepPlaying) {
                            const nextSpin = await spinWheel(cId, botId);
                            let nextCorrectAnswer = null;

                            if (ObjectId.isValid(nextSpin.question._id)) {
                                const fullQ = await questionsCollection.findOne({
                                    _id: new ObjectId(nextSpin.question._id)
                                });
                                if (fullQ) nextCorrectAnswer = fullQ.answer;
                            }

                            const nextBotAnswer = nextCorrectAnswer
                                ? pickBotAnswer(nextSpin.question.options, nextCorrectAnswer)
                                : nextSpin.question.options[Math.floor(Math.random() * nextSpin.question.options.length)];

                            const nextResult = await submitAnswer(cId, botId, nextBotAnswer);

                            results.push({
                                challengeId: cId,
                                action: 'consecutive_turn',
                                category: nextSpin.category,
                                question: nextSpin.question.question,
                                botAnswer: nextBotAnswer,
                                correct: nextResult.correct,
                                correctAnswer: nextResult.correctAnswer,
                                pieceWon: nextResult.pieceWon,
                                gameOver: nextResult.gameOver
                            });

                            keepPlaying = nextResult.correct && !nextResult.gameOver && nextResult.continuesTurn;
                        }
                    }
                } else {
                    // Question already spun, just answer it
                    const questionsCollection = await getCollection('trivia_questions');
                    let correctAnswer = null;
                    const questionId = challenge.currentQuestion._id;

                    if (ObjectId.isValid(questionId)) {
                        const fullQ = await questionsCollection.findOne({
                            _id: new ObjectId(questionId)
                        });
                        if (fullQ) correctAnswer = fullQ.answer;
                    }

                    const botAnswer = correctAnswer
                        ? pickBotAnswer(challenge.currentQuestion.options, correctAnswer)
                        : challenge.currentQuestion.options[Math.floor(Math.random() * challenge.currentQuestion.options.length)];

                    turnResult = await submitAnswer(cId, botId, botAnswer);

                    results.push({
                        challengeId: cId,
                        action: 'answer_only',
                        question: challenge.currentQuestion.question,
                        botAnswer,
                        correct: turnResult.correct,
                        correctAnswer: turnResult.correctAnswer,
                        pieceWon: turnResult.pieceWon,
                        gameOver: turnResult.gameOver
                    });
                }
            } catch (err) {
                results.push({
                    challengeId: cId,
                    action: 'error',
                    error: err.message
                });
            }
        }

        res.status(200).json({
            success: true,
            played: results.length,
            results
        });

    } catch (error) {
        console.error('Bot play error:', error);
        res.status(500).json({ error: error.message });
    }
}
