// Fix historical block pool scores - one-time correction
// Fetches actual period scores from ESPN and updates winner records

import { getCollection } from '../lib/mongodb.js';

// ESPN box score URLs for detailed game data
const BOX_SCORE_URLS = {
    NBA: (gameId) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`,
    NHL: (gameId) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`,
    NFL: (gameId) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`,
    MLB: (gameId) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`
};

async function fetchPeriodScores(sport, gameId) {
    const urlBuilder = BOX_SCORE_URLS[sport];
    if (!urlBuilder) return null;

    try {
        const response = await fetch(urlBuilder(gameId));
        if (!response.ok) throw new Error(`ESPN fetch failed: ${response.status}`);

        const data = await response.json();
        const boxscore = data.boxscore;

        if (!boxscore) return null;

        // Get team data
        const teams = boxscore.teams || [];
        const homeTeam = teams.find(t => t.homeAway === 'home');
        const awayTeam = teams.find(t => t.homeAway === 'away');

        if (!homeTeam || !awayTeam) return null;

        // Get linescores (period-by-period scores)
        const homeLinescores = homeTeam.statistics?.find(s => s.name === 'scoring')?.splits ||
                              data.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.linescores || [];
        const awayLinescores = awayTeam.statistics?.find(s => s.name === 'scoring')?.splits ||
                              data.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.linescores || [];

        // Also try to get from header
        const header = data.header?.competitions?.[0];
        const homeCompetitor = header?.competitors?.find(c => c.homeAway === 'home');
        const awayCompetitor = header?.competitors?.find(c => c.homeAway === 'away');

        const homeLines = homeCompetitor?.linescores || homeLinescores;
        const awayLines = awayCompetitor?.linescores || awayLinescores;

        // Build cumulative scores
        let homeCumulative = 0;
        let awayCumulative = 0;
        const periodScores = {};

        if (sport === 'NBA' || sport === 'NFL') {
            const periods = ['Q1', 'Q2', 'Q3', 'Q4'];
            for (let i = 0; i < periods.length && i < homeLines.length; i++) {
                const homeVal = homeLines[i]?.value || homeLines[i]?.displayValue || 0;
                const awayVal = awayLines[i]?.value || awayLines[i]?.displayValue || 0;
                homeCumulative += parseInt(homeVal) || 0;
                awayCumulative += parseInt(awayVal) || 0;
                periodScores[periods[i]] = { home: homeCumulative, away: awayCumulative };
            }
        } else if (sport === 'NHL') {
            const periods = ['P1', 'P2', 'P3'];
            for (let i = 0; i < periods.length && i < homeLines.length; i++) {
                const homeVal = homeLines[i]?.value || homeLines[i]?.displayValue || 0;
                const awayVal = awayLines[i]?.value || awayLines[i]?.displayValue || 0;
                homeCumulative += parseInt(homeVal) || 0;
                awayCumulative += parseInt(awayVal) || 0;
                periodScores[periods[i]] = { home: homeCumulative, away: awayCumulative };
            }
        } else if (sport === 'MLB') {
            for (let i = 0; i < Math.min(homeLines.length, 9); i++) {
                const homeVal = homeLines[i]?.value || homeLines[i]?.displayValue || 0;
                const awayVal = awayLines[i]?.value || awayLines[i]?.displayValue || 0;
                homeCumulative += parseInt(homeVal) || 0;
                awayCumulative += parseInt(awayVal) || 0;
                if (i === 2) periodScores['3rd'] = { home: homeCumulative, away: awayCumulative };
                if (i === 5) periodScores['6th'] = { home: homeCumulative, away: awayCumulative };
                if (i === 8) periodScores['9th'] = { home: homeCumulative, away: awayCumulative };
            }
        }

        // Final score from header
        periodScores['Final'] = {
            home: parseInt(homeCompetitor?.score) || homeCumulative,
            away: parseInt(awayCompetitor?.score) || awayCumulative
        };

        return periodScores;
    } catch (error) {
        console.error(`Error fetching period scores for ${sport} game ${gameId}:`, error);
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Simple auth check
    const { adminKey } = req.body || {};
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'phillysports-admin-2024') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const poolsCollection = await getCollection('block_pools');

        // Find recently completed pools (last 48 hours)
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const pools = await poolsCollection.find({
            status: 'completed',
            completedAt: { $gte: cutoff }
        }).toArray();

        const results = {
            poolsChecked: 0,
            poolsFixed: 0,
            winnersUpdated: 0,
            details: []
        };

        for (const pool of pools) {
            results.poolsChecked++;

            if (!pool.gameId || !pool.sport) {
                results.details.push({ pool: pool.title, error: 'Missing gameId or sport' });
                continue;
            }

            // Fetch actual period scores from ESPN
            const periodScores = await fetchPeriodScores(pool.sport, pool.gameId);

            if (!periodScores) {
                results.details.push({ pool: pool.title, error: 'Could not fetch period scores' });
                continue;
            }

            // Check if winners need fixing
            const winners = pool.winners || [];
            let needsFix = false;
            const updatedWinners = [];

            for (const winner of winners) {
                const correctScore = periodScores[winner.period];

                if (!correctScore) {
                    updatedWinners.push(winner);
                    continue;
                }

                // Check if scores are wrong (all showing final score)
                if (winner.homeScore !== correctScore.home || winner.awayScore !== correctScore.away) {
                    needsFix = true;

                    // Recalculate winning digits and square
                    const homeDigit = correctScore.home % 10;
                    const awayDigit = correctScore.away % 10;

                    // Find the correct winning square
                    const rowIndex = pool.rowNumbers?.indexOf(homeDigit);
                    const colIndex = pool.colNumbers?.indexOf(awayDigit);

                    const winningSquare = (pool.squares || []).find(
                        s => s.row === rowIndex && s.col === colIndex
                    );

                    updatedWinners.push({
                        ...winner,
                        homeScore: correctScore.home,
                        awayScore: correctScore.away,
                        winningDigits: { home: homeDigit, away: awayDigit },
                        winningRow: rowIndex,
                        winningCol: colIndex,
                        userId: winningSquare?.userId || winner.userId,
                        username: winningSquare?.username || winner.username,
                        isHouse: winningSquare?.isHouse || winner.isHouse,
                        correctedAt: new Date()
                    });

                    results.winnersUpdated++;
                } else {
                    updatedWinners.push(winner);
                }
            }

            if (needsFix) {
                await poolsCollection.updateOne(
                    { _id: pool._id },
                    {
                        $set: {
                            winners: updatedWinners,
                            periodScoresFixed: true,
                            fixedAt: new Date()
                        }
                    }
                );
                results.poolsFixed++;
                results.details.push({
                    pool: pool.title,
                    sport: pool.sport,
                    gameId: pool.gameId,
                    periodScores,
                    winnersFixed: updatedWinners.length
                });
            }
        }

        return res.status(200).json({
            success: true,
            ...results
        });
    } catch (error) {
        console.error('Fix scores error:', error);
        return res.status(500).json({ error: 'Failed to fix scores', message: error.message });
    }
}
// Deploy Fri Jan 23 19:47:40 EST 2026
