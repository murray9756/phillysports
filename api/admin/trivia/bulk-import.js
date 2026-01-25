// Bulk import trivia questions
// POST: Import array of questions
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { questions } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Questions array required' });
        }

        const questionsCollection = await getCollection('trivia_questions');
        const validCategories = ['Eagles', 'Phillies', '76ers', 'Flyers', 'College', 'General', 'Union'];
        const validDifficulties = ['easy', 'medium', 'hard'];

        const now = new Date();
        const toInsert = [];
        const errors = [];

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];

            // Validation
            if (!q.question || !q.options || !q.answer || !q.category || !q.difficulty) {
                errors.push({ index: i, error: 'Missing required fields' });
                continue;
            }

            if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
                errors.push({ index: i, error: 'Options must be 2-6 choices' });
                continue;
            }

            if (!q.options.includes(q.answer)) {
                errors.push({ index: i, error: 'Answer must be one of the options' });
                continue;
            }

            if (!validCategories.includes(q.category)) {
                errors.push({ index: i, error: `Invalid category: ${q.category}` });
                continue;
            }

            if (!validDifficulties.includes(q.difficulty)) {
                errors.push({ index: i, error: `Invalid difficulty: ${q.difficulty}` });
                continue;
            }

            toInsert.push({
                question: q.question.trim(),
                options: q.options.map(o => o.trim()),
                answer: q.answer.trim(),
                category: q.category,
                difficulty: q.difficulty,
                tags: q.tags || [],
                status: 'active',
                usedCount: 0,
                correctCount: 0,
                incorrectCount: 0,
                lastUsedAt: null,
                createdBy: user._id,
                createdAt: now,
                updatedAt: now
            });
        }

        let insertedCount = 0;
        if (toInsert.length > 0) {
            const result = await questionsCollection.insertMany(toInsert);
            insertedCount = result.insertedCount;
        }

        return res.status(200).json({
            success: true,
            inserted: insertedCount,
            errors: errors.length > 0 ? errors : undefined,
            errorCount: errors.length
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        return res.status(500).json({ error: 'Bulk import failed', details: error.message });
    }
}
