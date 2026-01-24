// Fantasy Scoring Cron - Calculate player points and update entries
import { getCollection } from '../lib/mongodb.js';

// Scoring rules by sport
const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

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

// Fetch player stats from SportsDataIO
async function fetchPlayerStats(sport, date) {
    if (!SPORTSDATA_API_KEY) {
        console.log('No SportsDataIO API key, using simulated stats');
        return {};
    }

    const sportEndpoints = {
        NFL: 'nfl',
        NBA: 'nba',
        MLB: 'mlb',
        NHL: 'nhl'
    };

    const endpoint = sportEndpoints[sport];
    if (!endpoint) return {};

    try {
        // Fetch box scores for the date
        const url = `https://api.sportsdata.io/v3/${endpoint}/stats/json/PlayerGameStatsByDate/${date}?key=${SPORTSDATA_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Failed to fetch ${sport} stats:`, response.status);
            return {};
        }

        const stats = await response.json();

        // Index by player ID
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

// Calculate fantasy points from player stats
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
        // Pitching stats
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
        // Goalie stats
        points += (stats.Wins || 0) * rules.win;
        points += (stats.Saves || 0) * rules.save;
        points += (stats.GoalsAgainst || 0) * rules.goalAgainst;
        points += (stats.Shutouts || 0) * rules.shutout;
    }

    return points;
}

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

                        // Award prizes - winner takes all
                        const entries = await entriesCollection
                            .find({ contestId: contest._id })
                            .sort({ totalPoints: -1 })
                            .toArray();

                        // Calculate total pot: $500 base + (entry fee × entries)
                        const basePot = 500;
                        const totalPot = basePot + (contest.entryFee || 0) * (contest.entryCount || entries.length);

                        for (let i = 0; i < entries.length; i++) {
                            const entry = entries[i];
                            const rank = i + 1;

                            // Winner takes all - only rank 1 gets the pot
                            const payout = rank === 1 ? totalPot : 0;

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

                            // Award payout to winner
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

                // For live contests, fetch real stats from SportsDataIO
                if (contest.status === 'live') {
                    const entries = await entriesCollection.find({ contestId: contest._id }).toArray();

                    // Fetch player stats from SportsDataIO
                    const gameDate = contest.gameDateString || new Date(contest.gameDate || contest.locksAt).toISOString().split('T')[0];
                    const playerStats = await fetchPlayerStats(contest.sport, gameDate);

                    for (const entry of entries) {
                        let totalPoints = 0;
                        const playerPoints = [];

                        for (const player of entry.lineup) {
                            // Find player stats from API response
                            const stats = playerStats[player.playerId] || null;
                            const points = calculateFantasyPoints(contest.sport, stats);

                            playerPoints.push({
                                playerId: player.playerId,
                                playerName: player.playerName,
                                points: Math.round(points * 10) / 10,
                                stats: stats // Store the raw stats for display
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
