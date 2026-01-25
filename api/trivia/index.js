import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

import { addCoins, deductCoins, getDailyEarnings } from '../lib/coins.js';

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Difficulty-based rewards (correct answers)
const REWARDS_BY_DIFFICULTY = {
    easy: 5,
    medium: 10,
    hard: 20
};

// Difficulty-based penalties (incorrect answers - inverse)
const PENALTIES_BY_DIFFICULTY = {
    easy: 20,    // Easy questions should be easy - big penalty for wrong
    medium: 10,  // Balanced
    hard: 5      // Hard questions are tough - small penalty for trying
};

const DAILY_TRIVIA_LIMIT = 20; // Max correct answers per day

// Legacy hardcoded questions - kept for backward compatibility during migration
// These will be phased out once database is populated
const LEGACY_QUESTIONS = [
    { _id: 'e1', team: 'Eagles', question: 'In what year did the Eagles win Super Bowl LII?', options: ['2017', '2018', '2019', '2020'], answer: '2018', difficulty: 'easy' },
    { _id: 'e2', team: 'Eagles', question: 'Who caught the famous "Philly Special" touchdown pass in Super Bowl LII?', options: ['Nick Foles', 'Zach Ertz', 'Alshon Jeffery', 'Trey Burton'], answer: 'Nick Foles', difficulty: 'medium' },
    { _id: 'gen2', team: 'General', question: 'What Philadelphia sports radio station is known as "The Fanatic"?', options: ['94.1 WIP', '97.5 The Fanatic', '94.5 PST', '610 ESPN'], answer: '97.5 The Fanatic', difficulty: 'easy' }
];

// Export for backward compatibility with challenge engine
export const TRIVIA_QUESTIONS = LEGACY_QUESTIONS;

/**
 * Fetch questions from database
 * Falls back to legacy questions if database is empty
 */
async function getQuestionsFromDB(db, category = null) {
    const questionsCollection = db.collection('trivia_questions');

    const query = { status: 'active' };
    if (category && category !== 'all') {
        query.category = category;
    }

    const dbQuestions = await questionsCollection.find(query).toArray();

    if (dbQuestions.length === 0) {
        // Fall back to legacy questions if database is empty
        console.log('No questions in database, using legacy questions');
        let legacyQuestions = LEGACY_QUESTIONS;
        if (category && category !== 'all') {
            legacyQuestions = legacyQuestions.filter(q => q.team === category);
        }
        return legacyQuestions.map(q => ({
            ...q,
            _id: q._id, // Keep string ID for legacy
            category: q.team // Map team to category
        }));
    }

    // Transform database questions to match expected format
    return dbQuestions.map(q => ({
        _id: q._id.toString(),
        team: q.category, // Map category back to team for frontend compatibility
        category: q.category,
        question: q.question,
        options: q.options,
        answer: q.answer,
        difficulty: q.difficulty,
        // Question statistics
        usedCount: q.usedCount || 0,
        correctCount: q.correctCount || 0,
        incorrectCount: q.incorrectCount || 0
    }));
}

/**
 * Find a question by ID (checks database first, then legacy)
 */
async function findQuestionById(db, questionId) {
    const questionsCollection = db.collection('trivia_questions');

    // Try to find in database first
    let question = null;

    // Check if it's a valid ObjectId
    if (ObjectId.isValid(questionId)) {
        question = await questionsCollection.findOne({ _id: new ObjectId(questionId) });
    }

    // Also try by legacyId
    if (!question) {
        question = await questionsCollection.findOne({ legacyId: questionId });
    }

    if (question) {
        return {
            _id: question._id.toString(),
            team: question.category,
            category: question.category,
            question: question.question,
            options: question.options,
            answer: question.answer,
            difficulty: question.difficulty,
            usedCount: question.usedCount || 0,
            correctCount: question.correctCount || 0,
            incorrectCount: question.incorrectCount || 0
        };
    }

    // Fall back to legacy questions
    const legacyQuestion = LEGACY_QUESTIONS.find(q => q._id === questionId);
    if (legacyQuestion) {
        return {
            ...legacyQuestion,
            category: legacyQuestion.team
        };
    }

    return null;
}

export default async function handler(req, res) {
    const token = req.cookies?.auth_token;

    if (req.method === 'GET') {
        // Get a random question
        const team = req.query.team; // Optional filter by team/category

        const client = new MongoClient(uri);

        try {
            await client.connect();
            const db = client.db('phillysports');

            // Get questions from database (or legacy fallback)
            let questions = await getQuestionsFromDB(db, team);

            // If user is logged in, filter out questions they've answered today
            let answeredToday = [];
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const todayAnswers = await db.collection('trivia_answers')
                        .find({
                            userId: new ObjectId(decoded.userId),
                            answeredAt: { $gte: today }
                        })
                        .toArray();

                    answeredToday = todayAnswers.map(a => a.questionId);
                } catch (e) {
                    // Ignore auth errors for question fetching
                }
            }

            // Filter out already answered questions
            const availableQuestions = questions.filter(q => !answeredToday.includes(q._id));

            if (availableQuestions.length === 0) {
                return res.status(200).json({
                    success: true,
                    question: null,
                    message: team
                        ? `You've answered all ${team} questions for today! Try another team or come back tomorrow.`
                        : "You've answered all questions for today! Come back tomorrow for more."
                });
            }

            // Pick a random question
            const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

            // Don't send the answer to the client
            const { answer, ...questionWithoutAnswer } = randomQuestion;

            return res.status(200).json({
                success: true,
                question: questionWithoutAnswer,
                remainingToday: availableQuestions.length,
                totalQuestions: questions.length
            });
        } catch (error) {
            console.error('Trivia GET error:', error);
            return res.status(500).json({ error: 'Failed to fetch question' });
        } finally {
            await client.close();
        }
    }

    if (req.method === 'POST') {
        // Submit an answer
        if (!token) {
            return res.status(401).json({ error: 'Login required to earn Diehard Dollars' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { questionId, selectedAnswer } = req.body;

        if (!questionId || !selectedAnswer) {
            return res.status(400).json({ error: 'Question ID and answer required' });
        }

        const client = new MongoClient(uri);

        try {
            await client.connect();
            const db = client.db('phillysports');

            // Find the question (database or legacy)
            const question = await findQuestionById(db, questionId);
            if (!question) {
                return res.status(404).json({ error: 'Question not found' });
            }

            const answersCollection = db.collection('trivia_answers');

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Check if already answered this question today
            const existingAnswer = await answersCollection.findOne({
                userId: new ObjectId(decoded.userId),
                questionId: questionId,
                answeredAt: { $gte: today }
            });

            if (existingAnswer) {
                return res.status(400).json({ error: 'You already answered this question today' });
            }

            // Check daily limit
            const dailyCorrect = await answersCollection.countDocuments({
                userId: new ObjectId(decoded.userId),
                correct: true,
                answeredAt: { $gte: today }
            });

            // Normalize both answers for comparison (trim whitespace, case-insensitive)
            const normalizedSelected = selectedAnswer.trim().toLowerCase();
            const normalizedAnswer = question.answer.trim().toLowerCase();
            const isCorrect = normalizedSelected === normalizedAnswer;

            // Debug logging for answer mismatches
            if (!isCorrect) {
                console.log(`Trivia mismatch - Q: ${questionId}, Selected: "${selectedAnswer}" (normalized: "${normalizedSelected}"), Expected: "${question.answer}" (normalized: "${normalizedAnswer}")`);
            }

            const difficulty = question.difficulty || 'medium';
            let coinsEarned = 0;
            let coinsLost = 0;

            // Record the answer
            await answersCollection.insertOne({
                userId: new ObjectId(decoded.userId),
                questionId: questionId,
                selectedAnswer,
                correct: isCorrect,
                difficulty: difficulty,
                category: question.category || question.team,
                answeredAt: new Date()
            });

            // Update question stats in database
            if (ObjectId.isValid(questionId)) {
                const questionsCollection = db.collection('trivia_questions');
                await questionsCollection.updateOne(
                    { _id: new ObjectId(questionId) },
                    {
                        $inc: {
                            usedCount: 1,
                            correctCount: isCorrect ? 1 : 0,
                            incorrectCount: isCorrect ? 0 : 1
                        },
                        $set: { lastUsedAt: new Date() }
                    }
                );
            }

            if (isCorrect) {
                // Award coins based on difficulty (if under daily limit)
                if (dailyCorrect < DAILY_TRIVIA_LIMIT) {
                    const reward = REWARDS_BY_DIFFICULTY[difficulty] || 10;
                    await addCoins(
                        decoded.userId,
                        reward,
                        'trivia',
                        `Correct ${difficulty} trivia: ${question.team || question.category}`,
                        { questionId, team: question.team || question.category, difficulty }
                    );
                    coinsEarned = reward;
                }
            } else {
                // Deduct coins based on difficulty (inverse - easy wrong = big penalty)
                const penalty = PENALTIES_BY_DIFFICULTY[difficulty] || 10;
                const result = await deductCoins(
                    decoded.userId,
                    penalty,
                    'trivia_penalty',
                    `Incorrect ${difficulty} trivia: ${question.team || question.category}`,
                    { questionId, team: question.team || question.category, difficulty }
                );
                coinsLost = typeof result === 'object' ? result.deducted : 0;
            }

            // Get updated stats
            const totalCorrect = await answersCollection.countDocuments({
                userId: new ObjectId(decoded.userId),
                correct: true
            });

            const totalAnswered = await answersCollection.countDocuments({
                userId: new ObjectId(decoded.userId)
            });

            // Get updated balance
            const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });

            res.status(200).json({
                success: true,
                correct: isCorrect,
                correctAnswer: question.answer,
                difficulty: difficulty,
                coinsEarned,
                coinsLost,
                dailyCorrect: dailyCorrect + (isCorrect ? 1 : 0),
                dailyLimit: DAILY_TRIVIA_LIMIT,
                stats: {
                    totalCorrect,
                    totalAnswered,
                    accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
                },
                newBalance: user?.coinBalance || 0
            });
        } catch (error) {
            console.error('Trivia answer error:', error);
            res.status(500).json({ error: 'Failed to submit answer' });
        } finally {
            await client.close();
        }
        return;
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
