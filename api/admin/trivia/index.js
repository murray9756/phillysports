// Admin Trivia Question Bank Management
// GET: List questions with filters
// POST: Create new question
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const questionsCollection = await getCollection('trivia_questions');

        // GET - List questions
        if (req.method === 'GET') {
            const {
                category,
                difficulty,
                status = 'active',
                search,
                limit = 50,
                offset = 0
            } = req.query;

            const query = {};

            if (category && category !== 'all') {
                query.category = category;
            }
            if (difficulty && difficulty !== 'all') {
                query.difficulty = difficulty;
            }
            if (status && status !== 'all') {
                query.status = status;
            }
            if (search) {
                query.$or = [
                    { question: { $regex: search, $options: 'i' } },
                    { answer: { $regex: search, $options: 'i' } }
                ];
            }

            const [questions, total] = await Promise.all([
                questionsCollection
                    .find(query)
                    .sort({ category: 1, createdAt: -1 })
                    .skip(parseInt(offset))
                    .limit(parseInt(limit))
                    .toArray(),
                questionsCollection.countDocuments(query)
            ]);

            // Get category counts
            const categoryCounts = await questionsCollection.aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]).toArray();

            const countsByCategory = {};
            categoryCounts.forEach(c => {
                countsByCategory[c._id] = c.count;
            });

            return res.status(200).json({
                success: true,
                questions: questions.map(q => ({
                    ...q,
                    _id: q._id.toString()
                })),
                total,
                countsByCategory,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        }

        // POST - Create new question
        if (req.method === 'POST') {
            const { question, options, answer, category, difficulty, tags } = req.body;

            // Validation
            if (!question || !options || !answer || !category || !difficulty) {
                return res.status(400).json({
                    error: 'Missing required fields: question, options, answer, category, difficulty'
                });
            }

            if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
                return res.status(400).json({ error: 'Options must be an array of 2-6 choices' });
            }

            if (!options.includes(answer)) {
                return res.status(400).json({ error: 'Answer must be one of the options' });
            }

            const validCategories = ['Eagles', 'Phillies', '76ers', 'Flyers', 'College', 'General', 'Union'];
            if (!validCategories.includes(category)) {
                return res.status(400).json({ error: `Category must be one of: ${validCategories.join(', ')}` });
            }

            const validDifficulties = ['easy', 'medium', 'hard'];
            if (!validDifficulties.includes(difficulty)) {
                return res.status(400).json({ error: 'Difficulty must be: easy, medium, or hard' });
            }

            // Check for duplicate question
            const existing = await questionsCollection.findOne({
                question: { $regex: `^${question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
            });

            if (existing) {
                return res.status(400).json({ error: 'This question already exists' });
            }

            const newQuestion = {
                question: question.trim(),
                options: options.map(o => o.trim()),
                answer: answer.trim(),
                category,
                difficulty,
                tags: tags || [],
                status: 'active',
                usedCount: 0,
                correctCount: 0,
                incorrectCount: 0,
                lastUsedAt: null,
                createdBy: user._id,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await questionsCollection.insertOne(newQuestion);

            return res.status(201).json({
                success: true,
                question: {
                    ...newQuestion,
                    _id: result.insertedId.toString()
                }
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin trivia error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
