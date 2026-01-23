// Trivia Challenge Game Engine
// Handles game logic for head-to-head trivia battles

import { ObjectId } from 'mongodb';
import { getCollection } from '../mongodb.js';
import { addCoins, deductCoins } from '../coins.js';

// Categories for pie pieces
export const CATEGORIES = ['Eagles', 'Phillies', '76ers', 'Flyers', 'College', 'General'];

// Wager tiers
export const WAGER_TIERS = [10, 25, 50, 100];

// Challenge expiration (24 hours)
export const CHALLENGE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Turn timeout (30 seconds)
export const TURN_TIMEOUT_MS = 30 * 1000;

/**
 * Create a new challenge
 */
export async function createChallenge(challengerId, challengedId, wagerAmount, matchmakingType = 'direct') {
    const challenges = await getCollection('trivia_challenges');
    const users = await getCollection('users');

    // Validate wager tier
    if (!WAGER_TIERS.includes(wagerAmount)) {
        throw new Error('Invalid wager amount');
    }

    // Get challenger info
    const challenger = await users.findOne({ _id: new ObjectId(challengerId) });
    if (!challenger) throw new Error('Challenger not found');
    if ((challenger.coinBalance || 0) < wagerAmount) {
        throw new Error('Insufficient coins for wager');
    }

    // For direct challenges, get challenged user info
    let challenged = null;
    if (challengedId && matchmakingType === 'direct') {
        challenged = await users.findOne({ _id: new ObjectId(challengedId) });
        if (!challenged) throw new Error('Challenged user not found');
    }

    // Lock wager from challenger
    await deductCoins(challengerId, wagerAmount, 'trivia_wager', 'Trivia challenge wager locked');

    const challenge = {
        status: matchmakingType === 'random' ? 'active' : 'pending',
        matchmakingType,

        challenger: {
            userId: new ObjectId(challengerId),
            username: challenger.username
        },
        challenged: challenged ? {
            userId: new ObjectId(challengedId),
            username: challenged.username
        } : null,

        wagerAmount,
        pot: matchmakingType === 'random' ? wagerAmount * 2 : wagerAmount,

        currentTurn: new ObjectId(challengerId), // Challenger goes first
        turnStartedAt: null,
        currentCategory: null,
        currentQuestion: null,

        player1Pieces: {
            Eagles: false,
            Phillies: false,
            '76ers': false,
            Flyers: false,
            College: false,
            General: false
        },
        player2Pieces: {
            Eagles: false,
            Phillies: false,
            '76ers': false,
            Flyers: false,
            College: false,
            General: false
        },

        usedQuestionIds: [],
        winner: null,
        turns: [],

        createdAt: new Date(),
        acceptedAt: matchmakingType === 'random' ? new Date() : null,
        completedAt: null,
        expiresAt: new Date(Date.now() + CHALLENGE_EXPIRY_MS)
    };

    const result = await challenges.insertOne(challenge);
    return { ...challenge, _id: result.insertedId };
}

/**
 * Accept a challenge
 */
export async function acceptChallenge(challengeId, userId) {
    const challenges = await getCollection('trivia_challenges');
    const users = await getCollection('users');

    const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status !== 'pending') throw new Error('Challenge is not pending');
    if (challenge.challenged?.userId.toString() !== userId) {
        throw new Error('You are not the challenged user');
    }

    // Verify user has enough coins
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if ((user.coinBalance || 0) < challenge.wagerAmount) {
        throw new Error('Insufficient coins for wager');
    }

    // Lock wager from challenged user
    await deductCoins(userId, challenge.wagerAmount, 'trivia_wager', 'Trivia challenge wager locked');

    // Update challenge
    await challenges.updateOne(
        { _id: new ObjectId(challengeId) },
        {
            $set: {
                status: 'active',
                pot: challenge.wagerAmount * 2,
                acceptedAt: new Date(),
                turnStartedAt: new Date()
            }
        }
    );

    return await challenges.findOne({ _id: new ObjectId(challengeId) });
}

/**
 * Decline a challenge
 */
export async function declineChallenge(challengeId, userId) {
    const challenges = await getCollection('trivia_challenges');

    const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status !== 'pending') throw new Error('Challenge is not pending');
    if (challenge.challenged?.userId.toString() !== userId) {
        throw new Error('You are not the challenged user');
    }

    // Refund challenger's wager
    await addCoins(
        challenge.challenger.userId,
        challenge.wagerAmount,
        'trivia_wager_refund',
        'Challenge declined - wager refunded'
    );

    // Update challenge status
    await challenges.updateOne(
        { _id: new ObjectId(challengeId) },
        { $set: { status: 'declined', completedAt: new Date() } }
    );

    return { success: true };
}

/**
 * Spin the category wheel
 */
export async function spinWheel(challengeId, userId) {
    const challenges = await getCollection('trivia_challenges');

    const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status !== 'active') throw new Error('Challenge is not active');
    if (challenge.currentTurn.toString() !== userId) {
        throw new Error('Not your turn');
    }
    if (challenge.currentQuestion) {
        throw new Error('Answer current question first');
    }

    // Random category
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

    // Get a random question from this category that hasn't been used
    const trivia = await import('../../trivia/index.js');
    const allQuestions = trivia.TRIVIA_QUESTIONS || [];

    const availableQuestions = allQuestions.filter(q =>
        q.team === category && !challenge.usedQuestionIds.includes(q._id)
    );

    if (availableQuestions.length === 0) {
        throw new Error('No more questions available for this category');
    }

    const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

    // Update challenge with current question (don't include answer!)
    await challenges.updateOne(
        { _id: new ObjectId(challengeId) },
        {
            $set: {
                currentCategory: category,
                currentQuestion: {
                    _id: question._id,
                    team: question.team,
                    question: question.question,
                    options: question.options,
                    difficulty: question.difficulty
                    // answer intentionally omitted
                },
                turnStartedAt: new Date()
            },
            $push: { usedQuestionIds: question._id }
        }
    );

    return {
        category,
        question: {
            _id: question._id,
            team: question.team,
            question: question.question,
            options: question.options,
            difficulty: question.difficulty
        }
    };
}

/**
 * Submit an answer
 */
export async function submitAnswer(challengeId, userId, answer) {
    const challenges = await getCollection('trivia_challenges');

    const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status !== 'active') throw new Error('Challenge is not active');
    if (challenge.currentTurn.toString() !== userId) {
        throw new Error('Not your turn');
    }
    if (!challenge.currentQuestion) {
        throw new Error('No active question - spin first');
    }

    // Get the full question with answer
    const trivia = await import('../../trivia/index.js');
    const allQuestions = trivia.TRIVIA_QUESTIONS || [];
    const fullQuestion = allQuestions.find(q => q._id === challenge.currentQuestion._id);

    if (!fullQuestion) throw new Error('Question not found');

    const isCorrect = answer === fullQuestion.answer;
    const category = challenge.currentCategory;
    const timeRemaining = Math.max(0, TURN_TIMEOUT_MS - (Date.now() - new Date(challenge.turnStartedAt).getTime())) / 1000;

    // Determine which player
    const isPlayer1 = challenge.challenger.userId.toString() === userId;
    const piecesField = isPlayer1 ? 'player1Pieces' : 'player2Pieces';

    // Record turn
    const turn = {
        turnNumber: challenge.turns.length + 1,
        playerId: new ObjectId(userId),
        category,
        questionId: challenge.currentQuestion._id,
        answer,
        correct: isCorrect,
        correctAnswer: fullQuestion.answer,
        timeRemaining: Math.round(timeRemaining),
        timestamp: new Date()
    };

    const updateObj = {
        $push: { turns: turn },
        $set: {
            currentQuestion: null,
            currentCategory: null
        }
    };

    let result = {
        correct: isCorrect,
        correctAnswer: fullQuestion.answer,
        category,
        pieceWon: false,
        continuesTurn: false,
        gameOver: false,
        winner: null
    };

    if (isCorrect) {
        // Award pie piece
        updateObj.$set[`${piecesField}.${category}`] = true;
        result.pieceWon = true;
        result.continuesTurn = true;

        // Check win condition
        const pieces = { ...challenge[piecesField], [category]: true };
        const hasAllPieces = CATEGORIES.every(cat => pieces[cat]);

        if (hasAllPieces) {
            // Winner!
            const winnerUserId = new ObjectId(userId);
            const winnerUsername = isPlayer1 ? challenge.challenger.username : challenge.challenged.username;

            updateObj.$set.status = 'complete';
            updateObj.$set.completedAt = new Date();
            updateObj.$set.winner = {
                userId: winnerUserId,
                username: winnerUsername,
                winnings: challenge.pot
            };

            // Award pot to winner
            await addCoins(userId, challenge.pot, 'trivia_win', `Won trivia challenge - ${challenge.pot} DD`);

            result.gameOver = true;
            result.winner = { userId: winnerUserId.toString(), username: winnerUsername, winnings: challenge.pot };
            result.continuesTurn = false;
        }
    } else {
        // Wrong answer - turn passes
        const nextTurn = isPlayer1 ? challenge.challenged.userId : challenge.challenger.userId;
        updateObj.$set.currentTurn = nextTurn;
        updateObj.$set.turnStartedAt = new Date();
        result.nextTurn = nextTurn.toString();
    }

    await challenges.updateOne({ _id: new ObjectId(challengeId) }, updateObj);

    return result;
}

/**
 * Handle turn timeout
 */
export async function handleTimeout(challengeId) {
    const challenges = await getCollection('trivia_challenges');

    const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status !== 'active') return null;

    const elapsed = Date.now() - new Date(challenge.turnStartedAt).getTime();
    if (elapsed < TURN_TIMEOUT_MS) return null; // Not timed out yet

    // Timeout - turn passes
    const isPlayer1 = challenge.currentTurn.toString() === challenge.challenger.userId.toString();
    const nextTurn = isPlayer1 ? challenge.challenged.userId : challenge.challenger.userId;

    // Record timeout turn
    const turn = {
        turnNumber: challenge.turns.length + 1,
        playerId: challenge.currentTurn,
        category: challenge.currentCategory,
        questionId: challenge.currentQuestion?._id,
        answer: null,
        correct: false,
        timedOut: true,
        timeRemaining: 0,
        timestamp: new Date()
    };

    await challenges.updateOne(
        { _id: new ObjectId(challengeId) },
        {
            $push: { turns: turn },
            $set: {
                currentTurn: nextTurn,
                currentQuestion: null,
                currentCategory: null,
                turnStartedAt: new Date()
            }
        }
    );

    return { timedOut: true, nextTurn: nextTurn.toString() };
}

/**
 * Get challenge state
 */
export async function getChallengeState(challengeId, userId) {
    const challenges = await getCollection('trivia_challenges');

    const challenge = await challenges.findOne({ _id: new ObjectId(challengeId) });
    if (!challenge) throw new Error('Challenge not found');

    // Verify user is a participant
    const isChallenger = challenge.challenger.userId.toString() === userId;
    const isChallenged = challenge.challenged?.userId.toString() === userId;
    if (!isChallenger && !isChallenged) {
        throw new Error('Not a participant in this challenge');
    }

    // Calculate time remaining if it's their turn
    let timeRemaining = null;
    if (challenge.status === 'active' && challenge.turnStartedAt && challenge.currentQuestion) {
        const elapsed = Date.now() - new Date(challenge.turnStartedAt).getTime();
        timeRemaining = Math.max(0, Math.round((TURN_TIMEOUT_MS - elapsed) / 1000));
    }

    return {
        _id: challenge._id.toString(),
        status: challenge.status,
        challenger: {
            ...challenge.challenger,
            userId: challenge.challenger.userId.toString()
        },
        challenged: challenge.challenged ? {
            ...challenge.challenged,
            userId: challenge.challenged.userId.toString()
        } : null,
        wagerAmount: challenge.wagerAmount,
        pot: challenge.pot,
        currentTurn: challenge.currentTurn?.toString(),
        isYourTurn: challenge.currentTurn?.toString() === userId,
        timeRemaining,
        currentCategory: challenge.currentCategory,
        currentQuestion: challenge.currentQuestion,
        player1Pieces: challenge.player1Pieces,
        player2Pieces: challenge.player2Pieces,
        winner: challenge.winner ? {
            ...challenge.winner,
            userId: challenge.winner.userId.toString()
        } : null,
        turns: challenge.turns.map(t => ({
            ...t,
            playerId: t.playerId.toString()
        })),
        createdAt: challenge.createdAt,
        acceptedAt: challenge.acceptedAt
    };
}

/**
 * Get user's pending challenges
 */
export async function getPendingChallenges(userId) {
    const challenges = await getCollection('trivia_challenges');

    const pending = await challenges.find({
        $or: [
            { 'challenged.userId': new ObjectId(userId), status: 'pending' }
        ],
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).toArray();

    return pending.map(c => ({
        _id: c._id.toString(),
        challenger: { ...c.challenger, userId: c.challenger.userId.toString() },
        wagerAmount: c.wagerAmount,
        createdAt: c.createdAt,
        expiresAt: c.expiresAt
    }));
}

/**
 * Get user's active challenges
 */
export async function getActiveChallenges(userId) {
    const challenges = await getCollection('trivia_challenges');

    const active = await challenges.find({
        $or: [
            { 'challenger.userId': new ObjectId(userId) },
            { 'challenged.userId': new ObjectId(userId) }
        ],
        status: 'active'
    }).sort({ acceptedAt: -1 }).toArray();

    return active.map(c => ({
        _id: c._id.toString(),
        challenger: { ...c.challenger, userId: c.challenger.userId.toString() },
        challenged: c.challenged ? { ...c.challenged, userId: c.challenged.userId.toString() } : null,
        wagerAmount: c.wagerAmount,
        currentTurn: c.currentTurn?.toString(),
        isYourTurn: c.currentTurn?.toString() === userId,
        player1Pieces: c.player1Pieces,
        player2Pieces: c.player2Pieces,
        acceptedAt: c.acceptedAt
    }));
}

/**
 * Get user's challenge history
 */
export async function getChallengeHistory(userId, limit = 20) {
    const challenges = await getCollection('trivia_challenges');

    const history = await challenges.find({
        $or: [
            { 'challenger.userId': new ObjectId(userId) },
            { 'challenged.userId': new ObjectId(userId) }
        ],
        status: { $in: ['complete', 'declined', 'expired'] }
    }).sort({ completedAt: -1 }).limit(limit).toArray();

    return history.map(c => ({
        _id: c._id.toString(),
        challenger: { ...c.challenger, userId: c.challenger.userId.toString() },
        challenged: c.challenged ? { ...c.challenged, userId: c.challenged.userId.toString() } : null,
        wagerAmount: c.wagerAmount,
        status: c.status,
        winner: c.winner ? { ...c.winner, userId: c.winner.userId.toString() } : null,
        completedAt: c.completedAt
    }));
}
