// Seed trivia_questions collection from trivia-data JSON files
// POST /api/admin/trivia/seed
// Reads JSON files from trivia-data/ directory and inserts new questions (skips duplicates)

import { readFileSync } from 'fs';
import { join } from 'path';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

const CATEGORY_FILES = {
    'Eagles': 'eagles-questions.json',
    'Phillies': 'phillies-questions.json',
    '76ers': 'sixers-questions.json',
    'Flyers': 'flyers-questions.json',
    'College': 'college-questions.json',
    'General': 'general-questions.json'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const questionsCollection = await getCollection('trivia_questions');
        const now = new Date();
        let totalInserted = 0;
        let totalSkipped = 0;
        const results = {};

        for (const [category, filename] of Object.entries(CATEGORY_FILES)) {
            try {
                const filePath = join(process.cwd(), 'trivia-data', filename);
                const raw = readFileSync(filePath, 'utf-8');
                const questions = JSON.parse(raw);

                // Get existing question texts for this category to skip duplicates
                const existing = await questionsCollection.find(
                    { category },
                    { projection: { question: 1 } }
                ).toArray();
                const existingTexts = new Set(existing.map(q => q.question.trim().toLowerCase()));

                const toInsert = [];
                let skipped = 0;

                for (const q of questions) {
                    if (existingTexts.has(q.question.trim().toLowerCase())) {
                        skipped++;
                        continue;
                    }

                    // Map category name (JSON files use "College" for college, "General" for general, etc.)
                    let mappedCategory = q.category || category;
                    // Normalize: some JSON files may say "76ers" or "Sixers"
                    if (mappedCategory === 'Sixers') mappedCategory = '76ers';

                    toInsert.push({
                        question: q.question.trim(),
                        options: q.options.map(o => String(o).trim()),
                        answer: String(q.answer).trim(),
                        category: mappedCategory,
                        difficulty: q.difficulty || 'medium',
                        tags: q.tags || [],
                        status: 'active',
                        usedCount: 0,
                        correctCount: 0,
                        incorrectCount: 0,
                        lastUsedAt: null,
                        createdBy: 'seed',
                        createdAt: now,
                        updatedAt: now
                    });
                }

                if (toInsert.length > 0) {
                    const result = await questionsCollection.insertMany(toInsert);
                    totalInserted += result.insertedCount;
                }
                totalSkipped += skipped;

                results[category] = {
                    fileQuestions: questions.length,
                    inserted: toInsert.length,
                    skipped
                };
            } catch (fileError) {
                results[category] = { error: fileError.message };
            }
        }

        return res.status(200).json({
            success: true,
            totalInserted,
            totalSkipped,
            categories: results
        });
    } catch (error) {
        console.error('Seed error:', error);
        return res.status(500).json({ error: 'Seed failed', details: error.message });
    }
}
