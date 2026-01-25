#!/usr/bin/env node
/**
 * Import trivia questions from JSON files to MongoDB
 * Run with: node scripts/import-trivia.js
 */

import { MongoClient } from 'mongodb';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRIVIA_DATA_DIR = join(__dirname, '..', 'trivia-data');

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable is required');
    console.error('Run with: MONGODB_URI="your-connection-string" node scripts/import-trivia.js');
    process.exit(1);
}

async function importQuestions() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db('phillysports');
        const questionsCollection = db.collection('trivia_questions');

        // Get current count
        const existingCount = await questionsCollection.countDocuments();
        console.log(`Existing questions in database: ${existingCount}`);

        // Read all JSON files from trivia-data directory
        const files = readdirSync(TRIVIA_DATA_DIR).filter(f => f.endsWith('.json'));
        console.log(`Found ${files.length} question files to import`);

        let totalImported = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        const now = new Date();

        for (const file of files) {
            const filePath = join(TRIVIA_DATA_DIR, file);
            console.log(`\nProcessing ${file}...`);

            try {
                const content = readFileSync(filePath, 'utf8');
                const questions = JSON.parse(content);

                if (!Array.isArray(questions)) {
                    console.error(`  ERROR: ${file} does not contain an array`);
                    continue;
                }

                console.log(`  Found ${questions.length} questions`);

                // Prepare questions for insertion
                const toInsert = [];
                const skipped = [];

                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];

                    // Validate required fields
                    if (!q.question || !q.options || !q.answer || !q.category || !q.difficulty) {
                        skipped.push({ index: i, reason: 'Missing required fields' });
                        continue;
                    }

                    // Validate options array
                    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
                        skipped.push({ index: i, reason: 'Invalid options array' });
                        continue;
                    }

                    // Validate answer is in options
                    if (!q.options.includes(q.answer)) {
                        skipped.push({ index: i, reason: 'Answer not in options' });
                        continue;
                    }

                    // Check for duplicate question text
                    const exists = await questionsCollection.findOne({
                        question: q.question.trim()
                    });

                    if (exists) {
                        skipped.push({ index: i, reason: 'Duplicate question' });
                        continue;
                    }

                    toInsert.push({
                        question: q.question.trim(),
                        options: q.options.map(o => String(o).trim()),
                        answer: q.answer.trim(),
                        category: q.category,
                        difficulty: q.difficulty,
                        tags: q.tags || [],
                        status: 'active',
                        usedCount: 0,
                        correctCount: 0,
                        incorrectCount: 0,
                        lastUsedAt: null,
                        sourceFile: file,
                        createdAt: now,
                        updatedAt: now
                    });
                }

                // Insert in batches
                if (toInsert.length > 0) {
                    const result = await questionsCollection.insertMany(toInsert, { ordered: false });
                    console.log(`  Inserted: ${result.insertedCount} questions`);
                    totalImported += result.insertedCount;
                }

                if (skipped.length > 0) {
                    console.log(`  Skipped: ${skipped.length} questions`);
                    totalSkipped += skipped.length;

                    // Show first few skip reasons
                    const reasons = {};
                    skipped.forEach(s => {
                        reasons[s.reason] = (reasons[s.reason] || 0) + 1;
                    });
                    for (const [reason, count] of Object.entries(reasons)) {
                        console.log(`    - ${reason}: ${count}`);
                    }
                }

            } catch (err) {
                console.error(`  ERROR processing ${file}:`, err.message);
                totalErrors++;
            }
        }

        // Final count
        const finalCount = await questionsCollection.countDocuments();

        console.log('\n========================================');
        console.log('IMPORT COMPLETE');
        console.log('========================================');
        console.log(`Total imported: ${totalImported}`);
        console.log(`Total skipped: ${totalSkipped}`);
        console.log(`Total errors: ${totalErrors}`);
        console.log(`Questions before: ${existingCount}`);
        console.log(`Questions after: ${finalCount}`);
        console.log(`Net added: ${finalCount - existingCount}`);

        // Show category breakdown
        console.log('\nQuestions by category:');
        const categories = await questionsCollection.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        for (const cat of categories) {
            console.log(`  ${cat._id}: ${cat.count}`);
        }

    } catch (error) {
        console.error('Import failed:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

importQuestions();
