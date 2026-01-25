// Admin Fantasy Contest Management
// GET: View contest details and debug info
// POST: Actions - rescore, complete, award_prizes
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { addCoins } from '../../lib/coins.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

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
        reception: 1,
        fumbleLost: -2
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

// Fetch player stats from SportsDataIO
async function fetchPlayerStats(sport, date) {
    if (!SPORTSDATA_API_KEY) {
        console.log('No SportsDataIO API key');
        return {};
    }

    const sportEndpoints = { NFL: 'nfl', NBA: 'nba', MLB: 'mlb', NHL: 'nhl' };
    const endpoint = sportEndpoints[sport];
    if (!endpoint) return {};

    try {
        const url = `https://api.sportsdata.io/v3/${endpoint}/stats/json/PlayerGameStatsByDate/${date}?key=${SPORTSDATA_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Failed to fetch ${sport} stats:`, response.status);
            return {};
        }

        const stats = await response.json();
        const playerStats = {};
        for (const player of stats) {
            const playerId = player.PlayerID?.toString();
            if (playerId) {
                playerStats[playerId] = player;
            }
        }
        return playerStats;
    } catch (error) {
        console.error(`Error fetching ${sport} stats:`, error.message);
        return {};
    }
}

// Calculate fantasy points
function calculateFantasyPoints(sport, stats) {
    if (!stats) return 0;
    const rules = SCORING[sport];
    if (!rules) return 0;

    let points = 0;
    if (sport === 'NBA') {
        points += (stats.Points || 0) * rules.points;
        points += (stats.Rebounds || stats.TotalRebounds || 0) * rules.rebounds;
        points += (stats.Assists || 0) * rules.assists;
        points += (stats.Steals || 0) * rules.steals;
        points += (stats.BlockedShots || 0) * rules.blocks;
        points += (stats.Turnovers || 0) * rules.turnovers;
        points += (stats.ThreePointersMade || 0) * rules.threePointersMade;
    } else if (sport === 'NFL') {
        points += (stats.PassingYards || 0) * rules.passingYards;
        points += (stats.PassingTouchdowns || 0) * rules.passingTD;
        points += (stats.PassingInterceptions || 0) * rules.interception;
        points += (stats.RushingYards || 0) * rules.rushingYards;
        points += (stats.RushingTouchdowns || 0) * rules.rushingTD;
        points += (stats.ReceivingYards || 0) * rules.receivingYards;
        points += (stats.ReceivingTouchdowns || 0) * rules.receivingTD;
        points += (stats.Receptions || 0) * rules.reception;
        points += (stats.FumblesLost || 0) * rules.fumbleLost;
    } else if (sport === 'MLB') {
        points += (stats.Singles || 0) * rules.single;
        points += (stats.Doubles || 0) * rules.double;
        points += (stats.Triples || 0) * rules.triple;
        points += (stats.HomeRuns || 0) * rules.homeRun;
        points += (stats.RunsBattedIn || 0) * rules.rbi;
        points += (stats.Runs || 0) * rules.run;
        points += (stats.Walks || 0) * rules.walk;
        points += (stats.StolenBases || 0) * rules.stolenBase;
        points += (stats.HitByPitch || 0) * rules.hitByPitch;
        points += (stats.Wins || 0) * rules.win;
        points += (stats.EarnedRuns || 0) * rules.earnedRun;
        points += (stats.PitcherStrikeouts || 0) * rules.strikeoutPitcher;
        points += (stats.InningsPitchedFull || 0) * rules.inningPitched;
    } else if (sport === 'NHL') {
        points += (stats.Goals || 0) * rules.goal;
        points += (stats.Assists || 0) * rules.assist;
        points += (stats.ShotsOnGoal || 0) * rules.shot;
        points += (stats.BlockedShots || 0) * rules.blockedShot;
        points += (stats.PlusMinus || 0) * rules.plusMinus;
        points += (stats.Wins || 0) * rules.win;
        points += (stats.Saves || 0) * rules.save;
        points += (stats.GoalsAgainst || 0) * rules.goalAgainst;
        points += (stats.Shutouts || 0) * rules.shutout;
    }
    return points;
}

// Extract display stats
function extractDisplayStats(sport, stats) {
    if (!stats) return null;
    if (sport === 'NBA') {
        return {
            Points: stats.Points || 0,
            Rebounds: stats.Rebounds || stats.TotalRebounds || 0,
            Assists: stats.Assists || 0,
            Steals: stats.Steals || 0,
            BlockedShots: stats.BlockedShots || 0,
            ThreePointersMade: stats.ThreePointersMade || 0,
            Turnovers: stats.Turnovers || 0,
            Minutes: stats.Minutes || 0
        };
    }
    return stats;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Require admin authentication
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.query;
        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid contest ID' });
        }

        const contestsCollection = await getCollection('fantasy_contests');
        const entriesCollection = await getCollection('fantasy_entries');
        const usersCollection = await getCollection('users');

        const contest = await contestsCollection.findOne({ _id: new ObjectId(id) });
        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }

        // GET - View contest debug info
        if (req.method === 'GET') {
            const entries = await entriesCollection
                .find({ contestId: new ObjectId(id) })
                .sort({ totalPoints: -1 })
                .toArray();

            return res.status(200).json({
                success: true,
                contest: {
                    _id: contest._id,
                    title: contest.title,
                    sport: contest.sport,
                    status: contest.status,
                    gameDate: contest.gameDate,
                    gameDateString: contest.gameDateString,
                    locksAt: contest.locksAt,
                    endsAt: contest.endsAt,
                    entryCount: contest.entryCount,
                    entryFee: contest.entryFee,
                    completedAt: contest.completedAt
                },
                entries: entries.map(e => ({
                    _id: e._id,
                    username: e.username,
                    totalPoints: e.totalPoints,
                    finalRank: e.finalRank,
                    payout: e.payout,
                    lineup: e.lineup,
                    playerPoints: e.playerPoints,
                    createdAt: e.createdAt,
                    updatedAt: e.updatedAt
                })),
                prizePool: 500 + (contest.entryFee || 0) * (contest.entryCount || entries.length)
            });
        }

        // POST - Admin actions
        if (req.method === 'POST') {
            const { action, gameDate } = req.body;

            if (action === 'rescore') {
                // Force rescore the contest
                const scoringDate = gameDate || contest.gameDateString ||
                    new Date(contest.gameDate || contest.locksAt).toISOString().split('T')[0];

                console.log(`Admin rescore: Fetching ${contest.sport} stats for ${scoringDate}`);
                const playerStats = await fetchPlayerStats(contest.sport, scoringDate);
                const playerCount = Object.keys(playerStats).length;

                if (playerCount === 0) {
                    return res.status(400).json({
                        error: 'No stats available from API',
                        sport: contest.sport,
                        date: scoringDate,
                        message: 'Stats may not be available for this date. Try specifying a different gameDate.'
                    });
                }

                const entries = await entriesCollection.find({ contestId: new ObjectId(id) }).toArray();
                const results = [];

                for (const entry of entries) {
                    let totalPoints = 0;
                    const playerPoints = [];

                    for (const player of entry.lineup) {
                        const playerId = player.playerId?.toString();
                        const stats = playerStats[playerId] || playerStats[parseInt(playerId)] || null;
                        const points = calculateFantasyPoints(contest.sport, stats);
                        const displayStats = stats ? extractDisplayStats(contest.sport, stats) : null;

                        playerPoints.push({
                            playerId,
                            playerName: player.playerName,
                            points: Math.round(points * 10) / 10,
                            stats: displayStats
                        });
                        totalPoints += points;
                    }

                    await entriesCollection.updateOne(
                        { _id: entry._id },
                        {
                            $set: {
                                totalPoints: Math.round(totalPoints * 10) / 10,
                                playerPoints,
                                updatedAt: new Date()
                            }
                        }
                    );

                    results.push({
                        username: entry.username,
                        oldPoints: entry.totalPoints,
                        newPoints: Math.round(totalPoints * 10) / 10
                    });
                }

                return res.status(200).json({
                    success: true,
                    action: 'rescore',
                    playerStatsCount: playerCount,
                    entriesUpdated: results.length,
                    results
                });
            }

            if (action === 'complete') {
                // Force complete the contest and award prizes
                if (contest.status === 'completed') {
                    return res.status(400).json({ error: 'Contest already completed' });
                }

                const entries = await entriesCollection
                    .find({ contestId: new ObjectId(id) })
                    .sort({ totalPoints: -1, createdAt: 1 })
                    .toArray();

                if (entries.length === 0) {
                    // No entries - cancel contest
                    await contestsCollection.updateOne(
                        { _id: new ObjectId(id) },
                        { $set: { status: 'cancelled', completedAt: new Date(), updatedAt: new Date() } }
                    );
                    return res.status(200).json({ success: true, action: 'cancelled', reason: 'no_entries' });
                }

                // Calculate prize pool
                const basePot = 500;
                const totalPot = basePot + (contest.entryFee || 0) * (contest.entryCount || entries.length);

                const prizeResults = [];

                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i];
                    const rank = i + 1;
                    const payout = rank === 1 ? totalPot : 0;

                    await entriesCollection.updateOne(
                        { _id: entry._id },
                        { $set: { finalRank: rank, payout, updatedAt: new Date() } }
                    );

                    if (payout > 0) {
                        await addCoins(
                            entry.userId,
                            payout,
                            'fantasy_win',
                            `Won ${contest.title}`,
                            { contestId: contest._id, rank },
                            { skipMultiplier: true }
                        );
                    }

                    prizeResults.push({
                        rank,
                        username: entry.username,
                        totalPoints: entry.totalPoints,
                        payout
                    });
                }

                await contestsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'completed', completedAt: new Date(), updatedAt: new Date() } }
                );

                return res.status(200).json({
                    success: true,
                    action: 'complete',
                    prizePool: totalPot,
                    results: prizeResults
                });
            }

            if (action === 'award_only') {
                // Just award prizes without changing status (for fixing stuck contests)
                const entries = await entriesCollection
                    .find({ contestId: new ObjectId(id) })
                    .sort({ totalPoints: -1, createdAt: 1 })
                    .toArray();

                if (entries.length === 0) {
                    return res.status(400).json({ error: 'No entries to award' });
                }

                const basePot = 500;
                const totalPot = basePot + (contest.entryFee || 0) * (contest.entryCount || entries.length);

                // Check if already awarded
                const alreadyAwarded = entries.some(e => e.payout > 0);
                if (alreadyAwarded) {
                    return res.status(400).json({ error: 'Prizes already awarded for this contest' });
                }

                const winner = entries[0];

                await entriesCollection.updateOne(
                    { _id: winner._id },
                    { $set: { finalRank: 1, payout: totalPot, updatedAt: new Date() } }
                );

                await addCoins(
                    winner.userId,
                    totalPot,
                    'fantasy_win',
                    `Won ${contest.title}`,
                    { contestId: contest._id, rank: 1 },
                    { skipMultiplier: true }
                );

                // Update other entries with rank
                for (let i = 1; i < entries.length; i++) {
                    await entriesCollection.updateOne(
                        { _id: entries[i]._id },
                        { $set: { finalRank: i + 1, payout: 0, updatedAt: new Date() } }
                    );
                }

                return res.status(200).json({
                    success: true,
                    action: 'award_only',
                    winner: winner.username,
                    winnerPoints: winner.totalPoints,
                    prizeAwarded: totalPot
                });
            }

            return res.status(400).json({ error: 'Invalid action. Use: rescore, complete, or award_only' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin fantasy error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
