// Admin Trivia Question Management - Single Question
// GET: View question details
// PUT: Update question
// DELETE: Soft delete (set status to 'archived')
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid question ID' });
    }

    try {
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const questionsCollection = await getCollection('trivia_questions');
        const question = await questionsCollection.findOne({ _id: new ObjectId(id) });

        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }

        // GET - View question details with stats
        if (req.method === 'GET') {
            // Get answer stats from trivia_answers collection
            const answersCollection = await getCollection('trivia_answers');

            const stats = await answersCollection.aggregate([
                { $match: { questionId: id } },
                {
                    $group: {
                        _id: null,
                        totalAnswered: { $sum: 1 },
                        correctCount: { $sum: { $cond: ['$correct', 1, 0] } }
                    }
                }
            ]).toArray();

            const answerStats = stats[0] || { totalAnswered: 0, correctCount: 0 };
            const accuracy = answerStats.totalAnswered > 0
                ? Math.round((answerStats.correctCount / answerStats.totalAnswered) * 100)
                : 0;

            return res.status(200).json({
                success: true,
                question: {
                    ...question,
                    _id: question._id.toString(),
                    stats: {
                        totalAnswered: answerStats.totalAnswered,
                        correctCount: answerStats.correctCount,
                        incorrectCount: answerStats.totalAnswered - answerStats.correctCount,
                        accuracy
                    }
                }
            });
        }

        // PUT - Update question
        if (req.method === 'PUT') {
            const { question: questionText, options, answer, category, difficulty, tags, status } = req.body;

            const updates = { updatedAt: new Date() };

            if (questionText !== undefined) {
                updates.question = questionText.trim();
            }
            if (options !== undefined) {
                if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
                    return res.status(400).json({ error: 'Options must be an array of 2-6 choices' });
                }
                updates.options = options.map(o => o.trim());
            }
            if (answer !== undefined) {
                updates.answer = answer.trim();
            }
            if (category !== undefined) {
                const validCategories = ['Eagles', 'Phillies', '76ers', 'Flyers', 'College', 'General', 'Union'];
                if (!validCategories.includes(category)) {
                    return res.status(400).json({ error: `Category must be one of: ${validCategories.join(', ')}` });
                }
                updates.category = category;
            }
            if (difficulty !== undefined) {
                const validDifficulties = ['easy', 'medium', 'hard'];
                if (!validDifficulties.includes(difficulty)) {
                    return res.status(400).json({ error: 'Difficulty must be: easy, medium, or hard' });
                }
                updates.difficulty = difficulty;
            }
            if (tags !== undefined) {
                updates.tags = tags;
            }
            if (status !== undefined) {
                const validStatuses = ['active', 'archived', 'draft'];
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({ error: 'Status must be: active, archived, or draft' });
                }
                updates.status = status;
            }

            // Validate answer is in options if both are being updated
            const finalOptions = updates.options || question.options;
            const finalAnswer = updates.answer || question.answer;
            if (!finalOptions.includes(finalAnswer)) {
                return res.status(400).json({ error: 'Answer must be one of the options' });
            }

            await questionsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            const updated = await questionsCollection.findOne({ _id: new ObjectId(id) });

            return res.status(200).json({
                success: true,
                question: {
                    ...updated,
                    _id: updated._id.toString()
                }
            });
        }

        // DELETE - Soft delete (archive)
        if (req.method === 'DELETE') {
            await questionsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: 'archived',
                        archivedAt: new Date(),
                        archivedBy: user._id
                    }
                }
            );

            return res.status(200).json({
                success: true,
                message: 'Question archived successfully'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin trivia question error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
