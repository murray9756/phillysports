// ESPN box score stats for fantasy scoring
// Fetches player game stats from ESPN's free public API
// Maps ESPN stat labels to SportsDataIO-compatible field names
// so existing calculateFantasyPoints() works unchanged

import { normalizeTeam } from './player-matching.js';

const ESPN_SPORT_PATHS = {
    NFL: { sport: 'football', league: 'nfl' },
    NBA: { sport: 'basketball', league: 'nba' },
    MLB: { sport: 'baseball', league: 'mlb' },
    NHL: { sport: 'hockey', league: 'nhl' }
};

/**
 * Fetch games for a date from ESPN scoreboard
 * @param {string} sport - 'NFL', 'NBA', 'MLB', 'NHL'
 * @param {string} date - 'YYYY-MM-DD'
 * @returns {Array<{id, homeTeam, awayTeam, gameTime, status}>}
 */
export async function fetchGamesByDate(sport, date) {
    const paths = ESPN_SPORT_PATHS[sport];
    if (!paths) return [];

    const dateStr = date.replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/${paths.sport}/${paths.league}/scoreboard?dates=${dateStr}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const events = data.events || [];

        return events.map(event => {
            const comp = event.competitions?.[0];
            if (!comp) return null;

            const home = comp.competitors?.find(c => c.homeAway === 'home');
            const away = comp.competitors?.find(c => c.homeAway === 'away');
            const statusType = comp.status?.type || {};

            return {
                id: event.id,
                homeTeam: home?.team?.abbreviation || '',
                awayTeam: away?.team?.abbreviation || '',
                homeTeamName: home?.team?.displayName || '',
                awayTeamName: away?.team?.displayName || '',
                gameTime: event.date,
                status: statusType.completed ? 'Final' : statusType.state === 'in' ? 'InProgress' : 'Scheduled',
                homeScore: parseInt(home?.score) || 0,
                awayScore: parseInt(away?.score) || 0
            };
        }).filter(Boolean);
    } catch (error) {
        console.error(`ESPN fetchGamesByDate error (${sport}):`, error.message);
        return [];
    }
}

// --- ESPN stat label to SportsDataIO field name mapping ---

function parseStatValue(val) {
    if (!val || val === '--' || val === '-') return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
}

function parseMadePart(val) {
    // "5-7" -> 5 (made part of made-attempts)
    if (!val) return 0;
    const parts = val.split('-');
    return parseFloat(parts[0]) || 0;
}

function mapNBAStats(labels, stats) {
    const s = {};
    labels.forEach((label, i) => {
        const val = stats[i];
        switch (label) {
            case 'PTS': s.Points = parseStatValue(val); break;
            case 'REB': s.Rebounds = s.TotalRebounds = parseStatValue(val); break;
            case 'AST': s.Assists = parseStatValue(val); break;
            case 'STL': s.Steals = parseStatValue(val); break;
            case 'BLK': s.BlockedShots = parseStatValue(val); break;
            case 'TO': s.Turnovers = parseStatValue(val); break;
            case '3PT': s.ThreePointersMade = parseMadePart(val); break;
            case 'MIN': s.Minutes = parseStatValue(val); break;
        }
    });
    return s;
}

function mapNFLStats(categories) {
    // NFL stats are split across categories: passing, rushing, receiving, fumbles
    const s = {};
    for (const cat of categories) {
        const { name, labels, stats: statValues } = cat;
        if (!labels || !statValues) continue;

        labels.forEach((label, i) => {
            const val = statValues[i];
            switch (name) {
                case 'passing':
                    if (label === 'YDS') s.PassingYards = parseStatValue(val);
                    if (label === 'TD') s.PassingTouchdowns = parseStatValue(val);
                    if (label === 'INT') s.PassingInterceptions = parseStatValue(val);
                    if (label === 'C/ATT') s.Completions = parseMadePart(val);
                    break;
                case 'rushing':
                    if (label === 'YDS') s.RushingYards = parseStatValue(val);
                    if (label === 'TD') s.RushingTouchdowns = parseStatValue(val);
                    break;
                case 'receiving':
                    if (label === 'REC') s.Receptions = parseStatValue(val);
                    if (label === 'YDS') s.ReceivingYards = parseStatValue(val);
                    if (label === 'TD') s.ReceivingTouchdowns = parseStatValue(val);
                    break;
                case 'fumbles':
                    if (label === 'LOST') s.FumblesLost = parseStatValue(val);
                    break;
            }
        });
    }
    return s;
}

function mapMLBBattingStats(labels, stats) {
    const s = {};
    labels.forEach((label, i) => {
        const val = stats[i];
        switch (label) {
            case 'H': s.Hits = parseStatValue(val); break;
            case 'R': s.Runs = parseStatValue(val); break;
            case 'RBI': s.RunsBattedIn = parseStatValue(val); break;
            case 'HR': s.HomeRuns = parseStatValue(val); break;
            case 'BB': s.Walks = parseStatValue(val); break;
            case 'K': s.StrikeoutsHitting = parseStatValue(val); break;
            case 'AB': s.AtBats = parseStatValue(val); break;
        }
    });
    // Derive singles (ESPN doesn't provide 2B/3B separately in box score)
    s.Singles = Math.max(0, (s.Hits || 0) - (s.HomeRuns || 0));
    s.Doubles = 0;
    s.Triples = 0;
    return s;
}

function mapMLBPitchingStats(labels, stats) {
    const s = {};
    labels.forEach((label, i) => {
        const val = stats[i];
        switch (label) {
            case 'W': s.Wins = parseStatValue(val); break;
            case 'ER': s.EarnedRuns = parseStatValue(val); break;
            case 'K': s.PitcherStrikeouts = parseStatValue(val); break;
            case 'HBP': s.HitByPitch = parseStatValue(val); break;
            case 'QS': s.QualityStarts = parseStatValue(val); break;
            case 'IP': {
                // ESPN IP: "6.1" means 6 and 1/3 innings (baseball notation)
                const ipStr = String(val);
                const parts = ipStr.split('.');
                const full = parseInt(parts[0]) || 0;
                const partial = parseInt(parts[1]) || 0;
                s.InningsPitchedFull = full + (partial / 3);
                break;
            }
        }
    });
    return s;
}

function mapNHLSkaterStats(labels, stats) {
    const s = {};
    labels.forEach((label, i) => {
        const val = stats[i];
        switch (label) {
            case 'G': s.Goals = parseStatValue(val); break;
            case 'A': s.Assists = parseStatValue(val); break;
            case 'S': s.ShotsOnGoal = parseStatValue(val); break;
            case 'BS': s.BlockedShots = parseStatValue(val); break;
            case '+/-': s.PlusMinus = parseStatValue(val); break;
        }
    });
    return s;
}

function mapNHLGoalieStats(labels, stats, teamWon) {
    const s = {};
    labels.forEach((label, i) => {
        const val = stats[i];
        switch (label) {
            case 'GA': s.GoalsAgainst = parseStatValue(val); break;
            case 'SV': s.Saves = parseStatValue(val); break;
        }
    });
    // Derive wins and shutouts
    if (teamWon) s.Wins = 1;
    if ((s.GoalsAgainst || 0) === 0 && (s.Saves || 0) > 0) s.Shutouts = 1;
    return s;
}

/**
 * Fetch box score for a single ESPN event and return normalized player stats
 */
export async function fetchBoxScore(sport, eventId) {
    const paths = ESPN_SPORT_PATHS[sport];
    if (!paths) return [];

    const url = `https://site.api.espn.com/apis/site/v2/sports/${paths.sport}/${paths.league}/summary?event=${eventId}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const boxscore = data.boxscore || {};
        const teamPlayers = boxscore.players || [];
        const players = [];

        // Determine game winner (needed for NHL goalie wins)
        const header = data.header || {};
        const headerComp = header.competitions?.[0];
        let winningTeamAbbr = null;
        if (headerComp) {
            const competitors = headerComp.competitors || [];
            const winner = competitors.find(c => c.winner);
            if (winner) winningTeamAbbr = winner.team?.abbreviation;
        }

        for (const teamBlock of teamPlayers) {
            const teamAbbr = teamBlock.team?.abbreviation || '';
            const teamWon = normalizeTeam(teamAbbr) === normalizeTeam(winningTeamAbbr);
            const statCategories = teamBlock.statistics || [];

            if (sport === 'NBA') {
                // NBA: single category with all stats
                const cat = statCategories[0];
                if (!cat) continue;
                const labels = cat.labels || [];
                for (const athlete of (cat.athletes || [])) {
                    const name = athlete.athlete?.displayName || '';
                    const stats = mapNBAStats(labels, athlete.stats || []);
                    if (name) {
                        players.push({ name, team: teamAbbr, stats });
                    }
                }
            } else if (sport === 'NFL') {
                // NFL: multiple categories per team, same player can appear in multiple
                const playerMap = {}; // name -> accumulated stats
                for (const cat of statCategories) {
                    const catName = cat.name || '';
                    const labels = cat.labels || [];
                    for (const athlete of (cat.athletes || [])) {
                        const name = athlete.athlete?.displayName || '';
                        if (!name) continue;
                        if (!playerMap[name]) playerMap[name] = { name, team: teamAbbr, stats: {} };
                        const catStats = mapNFLStats([{ name: catName, labels, stats: athlete.stats || [] }]);
                        Object.assign(playerMap[name].stats, catStats);
                    }
                }
                players.push(...Object.values(playerMap));
            } else if (sport === 'MLB') {
                // MLB: batting and pitching categories
                for (const cat of statCategories) {
                    const catName = (cat.name || '').toLowerCase();
                    const labels = cat.labels || [];
                    for (const athlete of (cat.athletes || [])) {
                        const name = athlete.athlete?.displayName || '';
                        if (!name) continue;
                        let stats;
                        if (catName === 'pitching') {
                            stats = mapMLBPitchingStats(labels, athlete.stats || []);
                        } else if (catName === 'batting') {
                            stats = mapMLBBattingStats(labels, athlete.stats || []);
                        } else {
                            continue;
                        }
                        // MLB players can appear in both batting and pitching (DH rule, etc)
                        const existing = players.find(p => p.name === name && p.team === teamAbbr);
                        if (existing) {
                            Object.assign(existing.stats, stats);
                        } else {
                            players.push({ name, team: teamAbbr, stats });
                        }
                    }
                }
            } else if (sport === 'NHL') {
                // NHL: forwards, defenses, goalies
                for (const cat of statCategories) {
                    const catName = (cat.name || '').toLowerCase();
                    const labels = cat.labels || [];
                    for (const athlete of (cat.athletes || [])) {
                        const name = athlete.athlete?.displayName || '';
                        if (!name) continue;
                        let stats;
                        if (catName === 'goalies') {
                            stats = mapNHLGoalieStats(labels, athlete.stats || [], teamWon);
                        } else {
                            stats = mapNHLSkaterStats(labels, athlete.stats || []);
                        }
                        players.push({ name, team: teamAbbr, stats });
                    }
                }
            }
        }

        return players;
    } catch (error) {
        console.error(`ESPN fetchBoxScore error (${sport}, event ${eventId}):`, error.message);
        return [];
    }
}

/**
 * Fetch all player stats for a sport on a given date.
 * Aggregates box scores from all games into a single map
 * keyed by "normalized_name::normalized_team"
 *
 * @returns {Object} Map of playerKey -> normalized stats object
 */
export async function fetchAllPlayerStats(sport, date) {
    const games = await fetchGamesByDate(sport, date);
    const activeGames = games.filter(g => g.status === 'InProgress' || g.status === 'Final');

    if (activeGames.length === 0) {
        console.log(`No active/completed ${sport} games for ${date}`);
        return {};
    }

    console.log(`Fetching box scores for ${activeGames.length} ${sport} games`);

    const statsMap = {};

    // Fetch box scores in parallel (max 10 concurrent)
    const batchSize = 10;
    for (let i = 0; i < activeGames.length; i += batchSize) {
        const batch = activeGames.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(game => fetchBoxScore(sport, game.id))
        );

        for (const players of results) {
            for (const player of players) {
                const key = `${(player.name || '').toLowerCase().replace(/\./g, '').replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '').trim()}::${normalizeTeam(player.team)}`;
                statsMap[key] = player.stats;
            }
        }
    }

    console.log(`Got ${Object.keys(statsMap).length} player stats from ESPN`);
    return statsMap;
}
