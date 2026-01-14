// Cash Games API
// GET: List available cash tables
// POST: Create new table (auto-seed)

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

const CASH_TABLE_CONFIG = {
    blinds: { small: 10, big: 20 },
    buyIn: 1000,
    maxSeats: 6
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            return await listCashTables(req, res);
        } else if (req.method === 'POST') {
            return await createCashTable(req, res);
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Cash games API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function listCashTables(req, res) {
    const user = await authenticate(req);
    const cashTables = await getCollection('cash_tables');

    // Ensure we have at least 3 tables
    await seedTablesIfNeeded(cashTables);

    // Get all tables
    const tables = await cashTables.find({}).sort({ createdAt: 1 }).toArray();

    const response = tables.map(table => {
        const players = table.seats.filter(s => s.playerId);
        const isSeated = user && players.some(p => p.playerId.toString() === user.userId);

        return {
            _id: table._id,
            name: table.name,
            status: table.status,
            blinds: table.blinds,
            buyIn: table.buyIn,
            maxSeats: table.maxSeats,
            playerCount: players.length,
            players: players.map(p => ({
                odId: p.playerId.toString(),
                username: p.username,
                chipStack: p.chipStack
            })),
            isSeated,
            handsPlayed: table.handsPlayed || 0
        };
    });

    return res.status(200).json({
        success: true,
        tables: response,
        config: CASH_TABLE_CONFIG
    });
}

async function createCashTable(req, res) {
    const user = await authenticate(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const cashTables = await getCollection('cash_tables');

    // Check if user is admin (optional - could allow anyone)
    const users = await getCollection('users');
    const userDoc = await users.findOne({ _id: new ObjectId(user.userId) });

    if (!userDoc?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required to create tables' });
    }

    const { name } = req.body;

    const table = createEmptyTable(name || `Ring Game #${Date.now()}`);
    const result = await cashTables.insertOne(table);

    return res.status(201).json({
        success: true,
        table: { ...table, _id: result.insertedId }
    });
}

function createEmptyTable(name) {
    const seats = [];
    for (let i = 0; i < CASH_TABLE_CONFIG.maxSeats; i++) {
        seats.push({
            position: i,
            playerId: null,
            username: null,
            chipStack: 0,
            isActive: false,
            isSittingOut: false,
            cards: [],
            currentBet: 0,
            joinedAt: null
        });
    }

    return {
        name,
        status: 'waiting', // waiting, playing, paused
        blinds: CASH_TABLE_CONFIG.blinds,
        buyIn: CASH_TABLE_CONFIG.buyIn,
        maxSeats: CASH_TABLE_CONFIG.maxSeats,
        dealerPosition: 0,
        currentHandId: null,
        handsPlayed: 0,
        seats,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

async function seedTablesIfNeeded(cashTables) {
    const count = await cashTables.countDocuments();

    if (count < 3) {
        const existingNames = (await cashTables.find({}).toArray()).map(t => t.name);

        const tableNames = ['The Linc', 'South Philly', 'Broad Street'];
        for (const name of tableNames) {
            if (!existingNames.includes(name)) {
                await cashTables.insertOne(createEmptyTable(name));
            }
        }
    }
}

export { CASH_TABLE_CONFIG };
