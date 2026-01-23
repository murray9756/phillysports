// Live Ticker API - Get live Philly games with play-by-play
// GET /api/live-ticker
// Uses SportsDataIO for all live scores

import {
    fetchScoresByDate,
    fetchPlayByPlay,
    getCurrentSeason,
    getTeamLogo,
    formatGameStatus,
    getOrdinal
} from './lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// Philly teams identification
const PHILLY_TEAMS = {
    NFL: ['PHI'],
    NBA: ['PHI'],
    MLB: ['PHI'],
    NHL: ['PHI']
};

function isPhillyTeam(teamAbbr, sport) {
    if (!teamAbbr) return false;
    return PHILLY_TEAMS[sport]?.includes(teamAbbr.toUpperCase());
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const liveGames = [];
        const today = new Date().toISOString().split('T')[0];
        const sports = ['NFL', 'NBA', 'NHL', 'MLB'];

        // Fetch all sports in parallel
        const results = await Promise.all(
            sports.map(async (sport) => {
                try {
                    const games = await fetchScoresByDate(sport, today);
                    return { sport, games: games || [] };
                } catch (e) {
                    console.error(`SportsDataIO ${sport} error:`, e.message);
                    return { sport, games: [] };
                }
            })
        );

        // Process each sport's games
        for (const { sport, games } of results) {
            for (const game of games) {
                // Check if Philly team is playing
                const homeIsPhilly = isPhillyTeam(game.HomeTeam, sport);
                const awayIsPhilly = isPhillyTeam(game.AwayTeam, sport);
                if (!homeIsPhilly && !awayIsPhilly) continue;

                const isInProgress = game.Status === 'InProgress';
                const isFinal = game.Status === 'Final' || game.Status === 'F/OT';

                // Only include live or recently finished games
                if (!isInProgress && !isFinal) continue;
                if (isFinal) {
                    const gameDate = new Date(game.DateTime);
                    const now = new Date();
                    const hoursSinceStart = (now - gameDate) / (1000 * 60 * 60);
                    if (hoursSinceStart > 3) continue;
                }

                const gameData = {
                    id: (game.GameID || game.ScoreID)?.toString(),
                    sport,
                    homeTeam: {
                        name: game.HomeTeam,
                        shortName: game.HomeTeam,
                        score: game.HomeScore || game.HomeTeamScore || 0,
                        logo: getTeamLogo(sport, game.HomeTeam),
                        isPhilly: homeIsPhilly
                    },
                    awayTeam: {
                        name: game.AwayTeam,
                        shortName: game.AwayTeam,
                        score: game.AwayScore || game.AwayTeamScore || 0,
                        logo: getTeamLogo(sport, game.AwayTeam),
                        isPhilly: awayIsPhilly
                    },
                    status: {
                        state: isInProgress ? 'in' : (isFinal ? 'post' : 'pre'),
                        description: formatGameStatus(game, sport),
                        detail: game.Status,
                        period: game.Period || game.Inning || game.Quarter,
                        clock: game.TimeRemainingMinutes ?
                            `${game.TimeRemainingMinutes}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}` : null,
                        isInProgress,
                        isFinal
                    },
                    gameTime: game.DateTime,
                    venue: game.StadiumDetails?.Name || game.Stadium,
                    broadcast: game.Channel,
                    recentPlays: [],
                    situation: getSituation(game, sport)
                };

                // Get play-by-play if available and game is in progress
                if (isInProgress && game.GameID) {
                    try {
                        const pbpData = await fetchPlayByPlay(sport, game.GameID);
                        if (pbpData) {
                            const plays = pbpData.Plays || pbpData.PlayByPlays || [];
                            gameData.recentPlays = plays.slice(-3).map(play => ({
                                text: play.Description || play.PlayDescription || play.Text,
                                clock: play.TimeRemaining,
                                type: play.PlayType
                            })).filter(p => p.text);
                        }
                    } catch (e) {
                        // Play-by-play not available, continue without it
                    }
                }

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
            source: 'sportsdata'
        });

    } catch (error) {
        console.error('Live ticker error:', error);
        return res.status(500).json({ error: 'Failed to fetch live games' });
    }
}

function getSituation(game, sport) {
    const situation = {};

    if (sport === 'NFL' && game.Status === 'InProgress') {
        if (game.Down && game.Distance) {
            situation.down = game.Down;
            situation.distance = game.Distance;
            situation.yardLine = game.YardLine;
            situation.possession = game.Possession;
            situation.display = `${game.Down}${getOrdinal(game.Down)} & ${game.Distance}`;
        }
    } else if (sport === 'MLB' && game.Status === 'InProgress') {
        if (game.Balls !== undefined) {
            situation.balls = game.Balls;
            situation.strikes = game.Strikes;
            situation.outs = game.Outs;
            situation.display = `${game.Balls}-${game.Strikes}, ${game.Outs} out${game.Outs !== 1 ? 's' : ''}`;
        }
    }

    return situation;
}
