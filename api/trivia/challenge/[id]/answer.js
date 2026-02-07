// Submit an answer
// POST /api/trivia/challenge/[id]/answer

import { authenticate } from '../../../lib/auth.js';
import { submitAnswer, getChallengeState, spinWheel } from '../../../lib/trivia/challengeEngine.js';
import { sendTriviaNotification, PUSHER_EVENTS } from '../../../lib/pusher.js';
import { getCollection } from '../../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

// Bot auto-play: accuracy rate (65% correct)
const BOT_ACCURACY = 0.65;

function pickBotAnswer(options, correctAnswer) {
    if (Math.random() < BOT_ACCURACY) return correctAnswer;
    const wrong = options.filter(o => o.toLowerCase() !== correctAnswer.toLowerCase());
    return wrong.length > 0 ? wrong[Math.floor(Math.random() * wrong.length)] : options[0];
}

/**
 * Auto-play bot turns after a human answers and it becomes the bot's turn.
 * Runs asynchronously (fire-and-forget) so the human response isn't delayed.
 */
async function autoBotPlay(challengeId, botId) {
    try {
        const challenges = await getCollection('trivia_challenges');
        const questionsCollection = await getCollection('trivia_questions');

        let keepPlaying = true;
        while (keepPlaying) {
            // Re-fetch challenge state
            const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
            if (!challenge || challenge.status !== 'active') break;
            if (challenge.currentTurn.toString() !== botId) break;

            // Step 1: Spin if no question
            if (!challenge.currentQuestion) {
                await spinWheel(challengeId, botId);
            }

            // Re-fetch after spin
            const updated = await challenges.findOne({ _id: new ObjectId(challengeId) });
            if (!updated || !updated.currentQuestion) break;

            // Step 2: Look up correct answer
            let correctAnswer = null;
            const qId = updated.currentQuestion._id;
            if (ObjectId.isValid(qId)) {
                const fullQ = await questionsCollection.findOne({ _id: new ObjectId(qId) });
                if (fullQ) correctAnswer = fullQ.answer;
            }

            const botAnswer = correctAnswer
                ? pickBotAnswer(updated.currentQuestion.options, correctAnswer)
                : updated.currentQuestion.options[Math.floor(Math.random() * updated.currentQuestion.options.length)];

            // Step 3: Submit answer
            const result = await submitAnswer(challengeId, botId, botAnswer);

            // If bot got it wrong or game is over, stop
            if (!result.correct || result.gameOver) {
                keepPlaying = false;
            }
            // If correct + continues turn, loop again
        }
    } catch (err) {
        console.error('Bot auto-play error:', err);
    }
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
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;
        const { answer } = req.body;

        if (!answer) {
            return res.status(400).json({ error: 'Answer is required' });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

        const result = await submitAnswer(id, decoded.userId, answer);

        // Get updated state
        const state = await getChallengeState(id, decoded.userId);

        // Determine opponent
        const opponentId = state.challenger.userId === decoded.userId
            ? state.challenged.userId
            : state.challenger.userId;

        // Send notifications based on result
        if (state.status === 'complete') {
            // Game over - notify opponent
            await sendTriviaNotification(opponentId, PUSHER_EVENTS.TRIVIA_MATCH_COMPLETE, {
                challengeId: id,
                winner: state.winner,
                message: state.winner.userId === decoded.userId
                    ? `${user.username} won the trivia challenge!`
                    : `You won the trivia challenge!`
            });
        } else if (!result.correct) {
            // Wrong answer - turn changes, notify opponent it's their turn
            await sendTriviaNotification(opponentId, PUSHER_EVENTS.TRIVIA_YOUR_TURN, {
                challengeId: id,
                opponent: { username: user.username },
                message: `It's your turn in trivia vs ${user.username}!`
            });
        }

        // Check if the next turn belongs to a bot - auto-play if so
        if (state.status === 'active' && !result.correct && state.currentTurn) {
            const nextPlayer = await users.findOne({ _id: new ObjectId(state.currentTurn) });
            if (nextPlayer && nextPlayer.isBot) {
                // Fire-and-forget: bot plays after a short delay
                setTimeout(() => {
                    autoBotPlay(id, nextPlayer._id.toString());
                }, 3000);
            }
        }

        res.status(200).json({
            success: true,
            ...result,
            challenge: state
        });
    } catch (error) {
        console.error('Submit answer error:', error);
        res.status(400).json({ error: error.message });
    }
}
