// Fantasy Contest Entry - Submit Lineup
import { getCollection } from '../../../lib/mongodb.js';
import { authenticate } from '../../../lib/auth.js';
import { ObjectId } from 'mongodb';

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
        // Authenticate user
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { id } = req.query;
        const { lineup } = req.body;

        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid contest ID' });
        }

        if (!lineup || !Array.isArray(lineup)) {
            return res.status(400).json({ error: 'Lineup is required' });
        }

        const contestsCollection = await getCollection('fantasy_contests');
        const contest = await contestsCollection.findOne({ _id: new ObjectId(id) });

        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }

        // Check if contest is locked
        const now = new Date();
        if (now >= new Date(contest.locksAt)) {
            return res.status(400).json({ error: 'Contest is locked. Lineups can no longer be submitted.' });
        }

        if (contest.status !== 'upcoming') {
            return res.status(400).json({ error: 'Contest is not open for entries' });
        }

        // Check entry count
        const entriesCollection = await getCollection('fantasy_entries');
        const userEntryCount = await entriesCollection.countDocuments({
            contestId: new ObjectId(id),
            userId: user._id
        });

        if (userEntryCount >= contest.maxEntries) {
            return res.status(400).json({ error: `Maximum ${contest.maxEntries} entries allowed per user` });
        }

        if (contest.entryCount >= contest.maxTotalEntries) {
            return res.status(400).json({ error: 'Contest is full' });
        }

        // Validate lineup positions
        const requiredPositions = {};
        for (const pos of contest.rosterPositions) {
            for (let i = 0; i < pos.count; i++) {
                const slotName = pos.count > 1 ? `${pos.position}${i + 1}` : pos.position;
                requiredPositions[slotName] = pos;
            }
        }

        const filledPositions = new Set();
        let totalSalary = 0;
        const processedLineup = [];

        for (const player of lineup) {
            if (!player.position || !player.playerId || !player.playerName || player.salary === undefined) {
                return res.status(400).json({ error: 'Invalid lineup entry format' });
            }

            // Check position is valid
            const slot = player.position;
            if (!requiredPositions[slot] && !Object.keys(requiredPositions).some(k => k.startsWith(slot))) {
                return res.status(400).json({ error: `Invalid position: ${slot}` });
            }

            if (filledPositions.has(slot)) {
                return res.status(400).json({ error: `Duplicate position: ${slot}` });
            }

            filledPositions.add(slot);
            totalSalary += player.salary;
            processedLineup.push({
                position: slot,
                playerId: player.playerId,
                playerName: player.playerName,
                salary: player.salary,
                playerPosition: player.playerPosition || player.position
            });
        }

        // Check all positions filled
        const expectedSlots = Object.keys(requiredPositions).length;
        if (processedLineup.length !== expectedSlots) {
            return res.status(400).json({
                error: `Lineup incomplete. Expected ${expectedSlots} players, got ${processedLineup.length}`
            });
        }

        // Check salary cap
        if (totalSalary > contest.salaryCap) {
            return res.status(400).json({
                error: `Salary cap exceeded. Total: $${totalSalary}, Cap: $${contest.salaryCap}`
            });
        }

        // Check entry fee
        const usersCollection = await getCollection('users');
        if (contest.entryFee > 0) {
            if ((user.coinBalance || 0) < contest.entryFee) {
                return res.status(400).json({
                    error: `Insufficient Diehard Dollars. Required: ${contest.entryFee}, Balance: ${user.coinBalance || 0}`
                });
            }

            // Deduct entry fee
            await usersCollection.updateOne(
                { _id: user._id },
                { $inc: { coinBalance: -contest.entryFee } }
            );
        }

        // Create entry
        const entry = {
            contestId: new ObjectId(id),
            userId: user._id,
            username: user.displayName || user.username,
            lineup: processedLineup,
            totalSalary,
            totalPoints: 0,
            playerPoints: [],
            finalRank: null,
            payout: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await entriesCollection.insertOne(entry);

        // Increment contest entry count
        await contestsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { entryCount: 1 } }
        );

        return res.status(201).json({
            success: true,
            entry: {
                _id: result.insertedId,
                ...entry
            },
            message: 'Lineup submitted successfully!'
        });
    } catch (error) {
        console.error('Enter contest error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
