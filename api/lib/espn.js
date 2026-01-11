// ESPN API integration for fetching game scores and results

import { normalizeTeamName, teamsMatch } from './betting.js';

// ESPN scoreboard URLs for each sport
const SCOREBOARD_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    NCAAF: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
    NCAAB: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
};

// Map sport keys from The Odds API to ESPN sport names
const SPORT_KEY_MAP = {
    'americanfootball_nfl': 'NFL',
    'basketball_nba': 'NBA',
    'baseball_mlb': 'MLB',
    'icehockey_nhl': 'NHL',
    'americanfootball_ncaaf': 'NCAAF',
    'basketball_ncaab': 'NCAAB'
};

/**
 * Format date for ESPN API (YYYYMMDD)
 */
function formatDateForESPN(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Get score value from ESPN response (handles different formats)
 */
function getScore(score) {
    if (typeof score === 'object' && score !== null) {
        return parseInt(score.displayValue || score.value || '0', 10);
    }
    return parseInt(score || '0', 10);
}

/**
 * Fetch scoreboard for a specific sport and date
 *
 * @param {string} sport - Sport name (NFL, NBA, etc.)
 * @param {string} date - Date string (optional, defaults to today)
 * @returns {Promise<Array>} Array of game results
 */
export async function fetchScoreboard(sport, date = null) {
    const url = SCOREBOARD_URLS[sport];
    if (!url) {
        throw new Error(`Unknown sport: ${sport}`);
    }

    let fetchUrl = url;
    if (date) {
        fetchUrl += `?dates=${formatDateForESPN(date)}`;
    }

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`ESPN API error: ${response.status}`);
        }

        const data = await response.json();
        const games = [];

        for (const event of (data.events || [])) {
            const competition = event.competitions?.[0];
            if (!competition) continue;

            const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');

            if (!homeTeam || !awayTeam) continue;

            const status = competition.status?.type;

            games.push({
                espnId: event.id,
                sport,
                homeTeam: homeTeam.team?.displayName || homeTeam.team?.name,
                homeTeamShort: homeTeam.team?.shortDisplayName || homeTeam.team?.abbreviation,
                awayTeam: awayTeam.team?.displayName || awayTeam.team?.name,
                awayTeamShort: awayTeam.team?.shortDisplayName || awayTeam.team?.abbreviation,
                homeScore: getScore(homeTeam.score),
                awayScore: getScore(awayTeam.score),
                totalScore: getScore(homeTeam.score) + getScore(awayTeam.score),
                status: status?.name,
                statusDescription: status?.description,
                isFinal: status?.completed === true,
                isInProgress: status?.name === 'STATUS_IN_PROGRESS',
                gameDate: event.date
            });
        }

        return games;
    } catch (error) {
        console.error(`Error fetching ${sport} scoreboard:`, error);
        return [];
    }
}

/**
 * Fetch scores for multiple sports
 *
 * @param {Array<string>} sports - Array of sport names
 * @param {string} date - Date string (optional)
 * @returns {Promise<Object>} Map of sport -> games
 */
export async function fetchAllScoreboards(sports = null, date = null) {
    const sportsToFetch = sports || Object.keys(SCOREBOARD_URLS);
    const results = {};

    await Promise.all(sportsToFetch.map(async (sport) => {
        results[sport] = await fetchScoreboard(sport, date);
    }));

    return results;
}

/**
 * Find a matching game result for a bet
 *
 * @param {Object} bet - Bet object with homeTeam, awayTeam, sport, commenceTime
 * @param {Object} scoreboards - Map of sport -> games from fetchAllScoreboards
 * @returns {Object|null} Matching game result or null
 */
export function findGameResult(bet, scoreboards) {
    // Get sport name from sportKey if needed
    const sport = bet.sport || SPORT_KEY_MAP[bet.sportKey];
    if (!sport) return null;

    const games = scoreboards[sport];
    if (!games || games.length === 0) return null;

    // Find matching game by team names
    const match = games.find(game => {
        const homeMatch = teamsMatch(bet.homeTeam, game.homeTeam) ||
            teamsMatch(bet.homeTeam, game.homeTeamShort);
        const awayMatch = teamsMatch(bet.awayTeam, game.awayTeam) ||
            teamsMatch(bet.awayTeam, game.awayTeamShort);
        return homeMatch && awayMatch;
    });

    return match || null;
}

/**
 * Get final result for a specific game
 *
 * @param {Object} bet - Bet object
 * @returns {Promise<Object|null>} Game result or null if not found/not final
 */
export async function getGameResult(bet) {
    const sport = bet.sport || SPORT_KEY_MAP[bet.sportKey];
    if (!sport) return null;

    // Fetch scoreboard for the game date
    const gameDate = new Date(bet.commenceTime);
    const games = await fetchScoreboard(sport, gameDate);

    // Find matching game
    const match = games.find(game => {
        const homeMatch = teamsMatch(bet.homeTeam, game.homeTeam) ||
            teamsMatch(bet.homeTeam, game.homeTeamShort);
        const awayMatch = teamsMatch(bet.awayTeam, game.awayTeam) ||
            teamsMatch(bet.awayTeam, game.awayTeamShort);
        return homeMatch && awayMatch;
    });

    if (!match || !match.isFinal) {
        return null;
    }

    return {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        totalScore: match.totalScore,
        isFinal: true,
        scoredAt: new Date()
    };
}

/**
 * Check if a game has started
 *
 * @param {Date|string} commenceTime - Game start time
 * @returns {boolean}
 */
export function hasGameStarted(commenceTime) {
    const gameTime = new Date(commenceTime);
    const now = new Date();
    return now >= gameTime;
}

export { SCOREBOARD_URLS, SPORT_KEY_MAP };
