import { ObjectId } from 'mongodb';
import { getCollection } from './mongodb.js';
import { addCoins, spendCoins } from './coins.js';

// Default configuration
export const DEFAULT_TICKET_PRICE = 10;
export const DRAW_TIME = '20:00'; // 8 PM ET

/**
 * Select a winner for a raffle
 */
export async function selectWinner(raffleId) {
    const raffles = await getCollection('raffles');
    const tickets = await getCollection('raffle_tickets');

    const raffleIdObj = typeof raffleId === 'string' ? new ObjectId(raffleId) : raffleId;

    // Get the raffle
    const raffle = await raffles.findOne({ _id: raffleIdObj });
    if (!raffle) throw new Error('Raffle not found');
    if (raffle.status === 'completed') throw new Error('Raffle already completed');
    if (raffle.status === 'cancelled') throw new Error('Raffle was cancelled');

    // Get all tickets for this raffle
    const allTickets = await tickets.find({ raffleId: raffleIdObj }).toArray();

    if (allTickets.length === 0) {
        // No tickets sold - cancel raffle
        await raffles.updateOne(
            { _id: raffleIdObj },
            {
                $set: {
                    status: 'cancelled',
                    completedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );
        return { success: false, reason: 'no_tickets', raffle };
    }

    // Random selection (each ticket = 1 chance)
    const winningIndex = Math.floor(Math.random() * allTickets.length);
    const winningTicket = allTickets[winningIndex];

    // Update raffle with winner
    await raffles.updateOne(
        { _id: raffleIdObj },
        {
            $set: {
                status: 'completed',
                winnerId: winningTicket.userId,
                winnerUsername: winningTicket.username,
                winnerTicketId: winningTicket._id,
                completedAt: new Date(),
                updatedAt: new Date()
            }
        }
    );

    // Mark winning ticket
    await tickets.updateOne(
        { _id: winningTicket._id },
        { $set: { isWinner: true } }
    );

    return {
        success: true,
        winner: {
            ticketId: winningTicket._id.toString(),
            userId: winningTicket.userId.toString(),
            username: winningTicket.username,
            ticketNumber: winningTicket.ticketNumber
        },
        raffle: {
            ...raffle,
            _id: raffle._id.toString()
        },
        totalTickets: allTickets.length
    };
}

/**
 * Refund all tickets for a cancelled raffle
 */
export async function refundTickets(raffleId) {
    const raffles = await getCollection('raffles');
    const tickets = await getCollection('raffle_tickets');

    const raffleIdObj = typeof raffleId === 'string' ? new ObjectId(raffleId) : raffleId;

    // Get the raffle
    const raffle = await raffles.findOne({ _id: raffleIdObj });
    if (!raffle) throw new Error('Raffle not found');

    // Get all tickets
    const allTickets = await tickets.find({ raffleId: raffleIdObj }).toArray();

    if (allTickets.length === 0) {
        return { refunded: 0, totalAmount: 0 };
    }

    // Group tickets by user for bulk refund
    const userRefunds = {};
    for (const ticket of allTickets) {
        const userIdStr = ticket.userId.toString();
        if (!userRefunds[userIdStr]) {
            userRefunds[userIdStr] = {
                userId: ticket.userId,
                username: ticket.username,
                amount: 0,
                ticketCount: 0
            };
        }
        userRefunds[userIdStr].amount += ticket.diehardDollarsSpent;
        userRefunds[userIdStr].ticketCount += 1;
    }

    // Process refunds
    let totalRefunded = 0;
    let totalAmount = 0;

    for (const userIdStr of Object.keys(userRefunds)) {
        const refund = userRefunds[userIdStr];
        try {
            await addCoins(
                refund.userId,
                refund.amount,
                'raffle_refund',
                `Raffle cancelled: ${raffle.title} (${refund.ticketCount} tickets)`,
                { raffleId: raffleIdObj, ticketCount: refund.ticketCount }
            );
            totalRefunded++;
            totalAmount += refund.amount;
        } catch (err) {
            console.error(`Failed to refund user ${userIdStr}:`, err);
        }
    }

    // Update raffle status
    await raffles.updateOne(
        { _id: raffleIdObj },
        {
            $set: {
                status: 'cancelled',
                completedAt: new Date(),
                updatedAt: new Date()
            }
        }
    );

    return {
        refunded: totalRefunded,
        totalAmount,
        ticketCount: allTickets.length
    };
}

/**
 * Purchase raffle tickets
 */
export async function purchaseTickets(userId, raffleId, quantity) {
    const raffles = await getCollection('raffles');
    const tickets = await getCollection('raffle_tickets');
    const users = await getCollection('users');

    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const raffleIdObj = typeof raffleId === 'string' ? new ObjectId(raffleId) : raffleId;

    // Get raffle
    const raffle = await raffles.findOne({ _id: raffleIdObj });
    if (!raffle) throw new Error('Raffle not found');
    if (raffle.status !== 'active') throw new Error('Raffle is not active');

    // Check if draw date has passed
    const now = new Date();
    if (raffle.drawDate && new Date(raffle.drawDate) <= now) {
        throw new Error('Raffle drawing has already occurred');
    }

    // Get user
    const user = await users.findOne({ _id: userIdObj });
    if (!user) throw new Error('User not found');

    // Check max tickets per user
    if (raffle.maxTicketsPerUser) {
        const existingCount = await tickets.countDocuments({
            raffleId: raffleIdObj,
            userId: userIdObj
        });
        if (existingCount + quantity > raffle.maxTicketsPerUser) {
            throw new Error(`Maximum ${raffle.maxTicketsPerUser} tickets per user. You have ${existingCount}.`);
        }
    }

    // Calculate cost
    const ticketPrice = raffle.ticketPrice || DEFAULT_TICKET_PRICE;
    const totalCost = ticketPrice * quantity;

    // Deduct coins
    await spendCoins(
        userIdObj,
        totalCost,
        'raffle_purchase',
        `${quantity} ticket(s) for: ${raffle.title}`,
        { raffleId: raffleIdObj, quantity, pricePerTicket: ticketPrice }
    );

    // Get current highest ticket number
    const lastTicket = await tickets.findOne(
        { raffleId: raffleIdObj },
        { sort: { ticketNumber: -1 } }
    );
    let nextTicketNumber = (lastTicket?.ticketNumber || 0) + 1;

    // Create tickets
    const newTickets = [];
    for (let i = 0; i < quantity; i++) {
        newTickets.push({
            raffleId: raffleIdObj,
            userId: userIdObj,
            username: user.username,
            ticketNumber: nextTicketNumber + i,
            purchasedAt: new Date(),
            diehardDollarsSpent: ticketPrice,
            isWinner: false
        });
    }

    await tickets.insertMany(newTickets);

    // Update raffle ticket count
    await raffles.updateOne(
        { _id: raffleIdObj },
        {
            $inc: { totalTicketsSold: quantity },
            $set: { updatedAt: new Date() }
        }
    );

    return {
        tickets: newTickets.map(t => ({
            ticketNumber: t.ticketNumber,
            purchasedAt: t.purchasedAt
        })),
        totalCost,
        newBalance: user.coinBalance - totalCost
    };
}

/**
 * Get user's tickets for a specific raffle or all raffles
 */
export async function getUserTickets(userId, raffleId = null) {
    const tickets = await getCollection('raffle_tickets');
    const raffles = await getCollection('raffles');

    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const query = { userId: userIdObj };
    if (raffleId) {
        query.raffleId = typeof raffleId === 'string' ? new ObjectId(raffleId) : raffleId;
    }

    const userTickets = await tickets.find(query).sort({ purchasedAt: -1 }).toArray();

    // Get raffle details for each ticket
    const raffleIds = [...new Set(userTickets.map(t => t.raffleId.toString()))];
    const raffleList = await raffles.find({
        _id: { $in: raffleIds.map(id => new ObjectId(id)) }
    }).toArray();

    const raffleMap = {};
    raffleList.forEach(r => {
        raffleMap[r._id.toString()] = r;
    });

    return userTickets.map(t => ({
        _id: t._id.toString(),
        raffleId: t.raffleId.toString(),
        ticketNumber: t.ticketNumber,
        purchasedAt: t.purchasedAt,
        isWinner: t.isWinner,
        raffle: raffleMap[t.raffleId.toString()] ? {
            title: raffleMap[t.raffleId.toString()].title,
            status: raffleMap[t.raffleId.toString()].status,
            drawDate: raffleMap[t.raffleId.toString()].drawDate,
            images: raffleMap[t.raffleId.toString()].images
        } : null
    }));
}

/**
 * Get raffles ready for drawing (past draw date, still active)
 */
export async function getRafflesReadyForDraw() {
    const raffles = await getCollection('raffles');

    const now = new Date();
    return raffles.find({
        status: 'active',
        drawDate: { $lte: now }
    }).toArray();
}
