// Live Ticker API - Get live Philly games
// GET /api/live-ticker
// Uses ESPN for live scores

import { hoursSince } from './lib/timezone.js';

// ESPN API endpoints
const ESPN_ENDPOINTS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

// Philly team IDs in ESPN
const PHILLY_TEAM_IDS = {
    NFL: '21',  // Eagles
    NBA: '20',  // 76ers
    MLB: '22',  // Phillies
    NHL: '4'    // Flyers
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const liveGames = [];

        // Fetch all sports in parallel from ESPN
        const results = await Promise.all(
            Object.entries(ESPN_ENDPOINTS).map(async ([sport, url]) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) return { sport, games: [] };
                    const data = await response.json();
                    return { sport, games: data.events || [] };
                } catch (e) {
                    console.error(`ESPN ${sport} error:`, e.message);
                    return { sport, games: [] };
                }
            })
        );

        // Process each sport's games
        for (const { sport, games } of results) {
            const phillyTeamId = PHILLY_TEAM_IDS[sport];

            for (const game of games) {
                const competitors = game.competitions?.[0]?.competitors || [];
                const homeTeam = competitors.find(c => c.homeAway === 'home');
                const awayTeam = competitors.find(c => c.homeAway === 'away');

                if (!homeTeam || !awayTeam) continue;

                // Check if Philly team is playing
                const homeIsPhilly = homeTeam.team?.id === phillyTeamId;
                const awayIsPhilly = awayTeam.team?.id === phillyTeamId;
                if (!homeIsPhilly && !awayIsPhilly) continue;

                const status = game.status?.type;
                const isInProgress = status?.state === 'in';
                const isFinal = status?.state === 'post';
                const isScheduled = status?.state === 'pre';

                // Only include live or recently finished games
                if (!isInProgress && !isFinal) continue;
                if (isFinal && hoursSince(game.date) > 3) continue;

                const gameData = {
                    id: game.id,
                    sport,
                    homeTeam: {
                        name: homeTeam.team?.displayName || homeTeam.team?.name,
                        shortName: homeTeam.team?.abbreviation,
                        score: parseInt(homeTeam.score) || 0,
                        logo: homeTeam.team?.logo,
                        isPhilly: homeIsPhilly
                    },
                    awayTeam: {
                        name: awayTeam.team?.displayName || awayTeam.team?.name,
                        shortName: awayTeam.team?.abbreviation,
                        score: parseInt(awayTeam.score) || 0,
                        logo: awayTeam.team?.logo,
                        isPhilly: awayIsPhilly
                    },
                    status: {
                        state: status?.state,
                        description: status?.shortDetail || status?.detail,
                        detail: status?.description,
                        period: game.status?.period,
                        clock: game.status?.displayClock,
                        isInProgress,
                        isFinal
                    },
                    gameTime: game.date,
                    venue: game.competitions?.[0]?.venue?.fullName,
                    broadcast: game.competitions?.[0]?.broadcasts?.[0]?.names?.[0],
                    situation: getSituation(game, sport)
                };

                liveGames.push(gameData);
            }
        }

        // Sort: in-progress first, then by game time
        liveGames.sort((a, b) => {
            if (a.status.isInProgress && !b.status.isInProgress) return -1;
            if (!a.status.isInProgress && b.status.isInProgress) return 1;
            return new Date(a.gameTime) - new Date(b.gameTime);
        });

        return res.status(200).json({
            success: true,
            games: liveGames,
            count: liveGames.length,
            timestamp: new Date().toISOString(),
            source: 'espn'
        });

    } catch (error) {
        console.error('Live ticker error:', error);
        return res.status(500).json({ error: 'Failed to fetch live games' });
    }
}

function getSituation(game, sport) {
    const situation = {};
    const comp = game.competitions?.[0];

    if (sport === 'NFL' && comp?.situation) {
        const sit = comp.situation;
        if (sit.down) {
            situation.down = sit.down;
            situation.distance = sit.distance;
            situation.yardLine = sit.yardLine;
            situation.possession = sit.possession?.team?.abbreviation;
            situation.display = `${sit.down}${getOrdinal(sit.down)} & ${sit.distance}`;
        }
    } else if (sport === 'MLB' && comp?.situation) {
        const sit = comp.situation;
        situation.balls = sit.balls;
        situation.strikes = sit.strikes;
        situation.outs = sit.outs;
        situation.display = `${sit.balls}-${sit.strikes}, ${sit.outs} out${sit.outs !== 1 ? 's' : ''}`;
    }

    return situation;
}

function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}
