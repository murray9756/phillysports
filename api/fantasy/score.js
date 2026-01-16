// Fantasy Scoring Cron - Calculate player points and update entries
import { getCollection } from '../lib/mongodb.js';

// Scoring rules by sport
const SCORING = {
    NFL: {
        passingYards: 0.04,
        passingTD: 4,
        interception: -1,
        rushingYards: 0.1,
        rushingTD: 6,
        receivingYards: 0.1,
        receivingTD: 6,
        reception: 1, // PPR
        fumbleLost: -2,
        defensiveTD: 6,
        sack: 1,
        interceptionDef: 2,
        fumbleRecovery: 2
    },
    NBA: {
        points: 1,
        rebounds: 1.2,
        assists: 1.5,
        steals: 3,
        blocks: 3,
        turnovers: -1,
        threePointersMade: 0.5
    },
    MLB: {
        single: 3,
        double: 5,
        triple: 8,
        homeRun: 10,
        rbi: 2,
        run: 2,
        walk: 2,
        stolenBase: 5,
        hitByPitch: 2,
        strikeoutHitter: -0.5,
        win: 4,
        qualityStart: 3,
        earnedRun: -2,
        strikeoutPitcher: 2,
        inningPitched: 2.25
    },
    NHL: {
        goal: 8,
        assist: 5,
        shot: 1.5,
        blockedShot: 1.3,
        plusMinus: 1,
        win: 6,
        save: 0.7,
        goalAgainst: -3,
        shutout: 3
    }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const contestsCollection = await getCollection('fantasy_contests');
        const entriesCollection = await getCollection('fantasy_entries');
        const usersCollection = await getCollection('users');

        const results = {
            contestsUpdated: 0,
            entriesScored: 0,
            prizesAwarded: 0,
            errors: []
        };

        // Get active contests (live status)
        const activeContests = await contestsCollection.find({
            status: { $in: ['upcoming', 'live'] }
        }).toArray();

        const now = new Date();

        for (const contest of activeContests) {
            try {
                // Check if contest should transition to live
                if (contest.status === 'upcoming' && now >= new Date(contest.locksAt)) {
                    await contestsCollection.updateOne(
                        { _id: contest._id },
                        { $set: { status: 'live', updatedAt: now } }
                    );
                    contest.status = 'live';
                    results.contestsUpdated++;
                }

                // Check if contest should complete
                if (contest.status === 'live' && contest.endsAt) {
                    const endTime = new Date(contest.endsAt);
                    // Add 4 hours buffer for game completion
                    const completionTime = new Date(endTime.getTime() + 4 * 60 * 60 * 1000);

                    if (now >= completionTime) {
                        // Mark as completed and award prizes
                        await contestsCollection.updateOne(
                            { _id: contest._id },
                            { $set: { status: 'completed', completedAt: now, updatedAt: now } }
                        );

                        // Award prizes
                        const entries = await entriesCollection
                            .find({ contestId: contest._id })
                            .sort({ totalPoints: -1 })
                            .toArray();

                        for (let i = 0; i < entries.length; i++) {
                            const entry = entries[i];
                            const rank = i + 1;

                            // Find prize amount for this rank
                            let payout = 0;
                            for (const prize of contest.prizeStructure) {
                                if (prize.place === rank) {
                                    payout = prize.amount;
                                    break;
                                }
                            }

                            // Update entry with final rank and payout
                            await entriesCollection.updateOne(
                                { _id: entry._id },
                                {
                                    $set: {
                                        finalRank: rank,
                                        payout,
                                        updatedAt: now
                                    }
                                }
                            );

                            // Award payout to user
                            if (payout > 0) {
                                await usersCollection.updateOne(
                                    { _id: entry.userId },
                                    { $inc: { coinBalance: payout } }
                                );
                                results.prizesAwarded++;
                            }
                        }

                        results.contestsUpdated++;
                        continue; // Skip scoring for completed contests
                    }
                }

                // For live contests, we would normally fetch live stats
                // For now, generate sample scores (in production, integrate with live stats API)
                if (contest.status === 'live') {
                    const entries = await entriesCollection.find({ contestId: contest._id }).toArray();

                    for (const entry of entries) {
                        // Calculate points based on lineup
                        // In production, fetch real stats from ESPN boxscore API
                        // For now, use a deterministic formula based on player salary
                        let totalPoints = 0;
                        const playerPoints = [];

                        for (const player of entry.lineup) {
                            // Simulate points based on salary (higher salary = higher expected points)
                            // Add some variance based on player name for consistency
                            const basePoints = player.salary / 1000;
                            const hash = player.playerName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                            const variance = ((hash % 100) - 50) / 10;
                            const points = Math.max(0, basePoints + variance);

                            playerPoints.push({
                                playerId: player.playerId,
                                playerName: player.playerName,
                                points: Math.round(points * 10) / 10
                            });
                            totalPoints += points;
                        }

                        await entriesCollection.updateOne(
                            { _id: entry._id },
                            {
                                $set: {
                                    totalPoints: Math.round(totalPoints * 10) / 10,
                                    playerPoints,
                                    updatedAt: now
                                }
                            }
                        );
                        results.entriesScored++;
                    }
                }
            } catch (error) {
                console.error(`Error processing contest ${contest._id}:`, error);
                results.errors.push({
                    contestId: contest._id.toString(),
                    error: error.message
                });
            }
        }

        return res.status(200).json({
            success: true,
            ...results,
            scoredAt: now
        });
    } catch (error) {
        console.error('Fantasy scoring error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
