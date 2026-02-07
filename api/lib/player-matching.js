// Player matching utilities for bridging DraftKings player IDs with ESPN stats
// Uses normalized name+team keys for cross-source matching

// Canonical team abbreviation map - normalizes DraftKings/ESPN differences
const TEAM_ALIASES = {
    // NBA
    'GS': 'GSW', 'SA': 'SAS', 'NY': 'NYK', 'NO': 'NOP', 'PHX': 'PHO',
    // NFL
    'JAX': 'JAC', 'WSH': 'WAS',
    // MLB
    'CHW': 'CWS', 'KC': 'KCR', 'SD': 'SDP', 'SF': 'SFG', 'TB': 'TBR',
    // NHL
    'NJ': 'NJD', 'SJ': 'SJS', 'LA': 'LAK', 'VGK': 'VGS',
    // Common variations
    'PHO': 'PHX', 'BRK': 'BKN', 'BKN': 'BKN', 'WASH': 'WAS'
};

/**
 * Normalize a team abbreviation to canonical form
 */
export function normalizeTeam(abbr) {
    if (!abbr) return '';
    const upper = abbr.toUpperCase().trim();
    return TEAM_ALIASES[upper] || upper;
}

/**
 * Normalize a player name for matching
 * Strips suffixes, periods, lowercases
 */
function normalizeName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Build a lookup key from player name and team
 * @returns {string} "normalized name::normalized team"
 */
export function buildPlayerKey(name, team) {
    return `${normalizeName(name)}::${normalizeTeam(team)}`;
}

/**
 * Match lineup players to ESPN stats map by name+team
 * Falls back to name-only matching if team is missing
 *
 * @param {Array} lineupPlayers - [{playerName, team, playerId}]
 * @param {Object} espnStatsMap - Map from buildPlayerKey() -> stats object
 * @returns {Object} playerId -> stats object
 */
export function matchPlayersToStats(lineupPlayers, espnStatsMap) {
    const result = {};

    // Build a name-only index for fallback matching
    const nameOnlyIndex = {};
    for (const [key, stats] of Object.entries(espnStatsMap)) {
        const name = key.split('::')[0];
        if (!nameOnlyIndex[name]) {
            nameOnlyIndex[name] = stats;
        }
    }

    for (const player of lineupPlayers) {
        const playerId = player.playerId?.toString();
        if (!playerId) continue;

        // Try exact name+team match first
        if (player.team || player.teamAbbreviation) {
            const key = buildPlayerKey(player.playerName, player.team || player.teamAbbreviation);
            if (espnStatsMap[key]) {
                result[playerId] = espnStatsMap[key];
                continue;
            }
        }

        // Fallback: name-only match
        const nameKey = normalizeName(player.playerName);
        if (nameOnlyIndex[nameKey]) {
            result[playerId] = nameOnlyIndex[nameKey];
        }
    }

    return result;
}
