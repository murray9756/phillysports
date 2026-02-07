// DraftKings public API wrapper for fantasy player salaries
// No authentication required - uses undocumented public endpoints

import { normalizeTeam } from './player-matching.js';

const DK_SPORT_CODES = {
    NFL: 'NFL',
    NBA: 'NBA',
    MLB: 'MLB',
    NHL: 'NHL'
};

/**
 * Fetch draft groups (slates) for a sport from DraftKings lobby
 */
export async function fetchDraftGroups(sport) {
    const code = DK_SPORT_CODES[sport];
    if (!code) return [];

    try {
        const url = `https://www.draftkings.com/lobby/getcontests?sport=${code}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`DraftKings lobby fetch failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return (data.DraftGroups || []).map(dg => ({
            draftGroupId: dg.DraftGroupId,
            gameCount: dg.GameCount || 0,
            startDate: dg.StartDate || '',
            sport: dg.Sport || code,
            contestTypeId: dg.ContestTypeId
        }));
    } catch (error) {
        console.error('DraftKings fetchDraftGroups error:', error.message);
        return [];
    }
}

/**
 * Fetch draftable players with salaries for a specific draft group
 */
export async function fetchDraftablePlayers(draftGroupId) {
    try {
        const url = `https://api.draftkings.com/draftgroups/v1/draftgroups/${draftGroupId}/draftables`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`DraftKings draftables fetch failed: ${response.status}`);
            return { players: [], games: [] };
        }

        const data = await response.json();
        const draftables = data.draftables || [];

        // Deduplicate players (DK may list same player multiple times for different roster slots)
        const seen = new Set();
        const players = [];
        const gamesMap = {};

        for (const d of draftables) {
            const dkId = d.playerDkId?.toString();
            if (!dkId || seen.has(dkId)) continue;
            seen.add(dkId);

            const comp = d.competition || {};
            const teamAbbr = d.teamAbbreviation || '';

            // Build opponent from competition name (e.g., "DEN @ CHI")
            const compName = comp.name || '';
            let opponent = 'TBD';
            if (compName.includes('@')) {
                const parts = compName.split(/\s*@\s*/);
                opponent = parts[0].trim() === teamAbbr ? parts[1].trim() : parts[0].trim();
            } else if (compName.includes('vs')) {
                const parts = compName.split(/\s*vs\.?\s*/);
                opponent = parts[0].trim() === teamAbbr ? parts[1].trim() : parts[0].trim();
            }

            players.push({
                id: dkId,
                name: d.displayName || '',
                position: d.position || '',
                team: teamAbbr,
                teamAbbreviation: teamAbbr,
                salary: d.salary || 0,
                opponent,
                projectedPoints: 0,
                imageUrl: d.playerImage160 || d.playerImage50 || null,
                gameTime: comp.startTime || null,
                gameId: comp.competitionId?.toString() || null,
                status: d.status || 'None',
                isDisabled: d.isDisabled || false
            });

            // Track unique games
            if (comp.competitionId && !gamesMap[comp.competitionId]) {
                const nameDisplay = comp.nameDisplay || [];
                let homeTeam = '', awayTeam = '';
                if (compName.includes('@')) {
                    const parts = compName.split(/\s*@\s*/);
                    awayTeam = parts[0].trim();
                    homeTeam = parts[1].trim();
                }
                gamesMap[comp.competitionId] = {
                    id: comp.competitionId.toString(),
                    homeTeam,
                    awayTeam,
                    gameTime: comp.startTime || null,
                    status: 'Scheduled'
                };
            }
        }

        // Sort by salary descending
        players.sort((a, b) => b.salary - a.salary);

        return { players, games: Object.values(gamesMap) };
    } catch (error) {
        console.error('DraftKings fetchDraftablePlayers error:', error.message);
        return { players: [], games: [] };
    }
}

/**
 * High-level: Get players with DraftKings salaries for a sport on a date.
 * Finds the best matching "classic" slate and returns players + games.
 *
 * @param {string} sport - 'NFL', 'NBA', 'MLB', 'NHL'
 * @param {string} targetDate - 'YYYY-MM-DD'
 * @returns {Promise<{players: Array, games: Array}>}
 */
export async function fetchPlayersForDate(sport, targetDate) {
    const draftGroups = await fetchDraftGroups(sport);

    if (draftGroups.length === 0) {
        console.log(`No DraftKings draft groups found for ${sport}`);
        return { players: [], games: [] };
    }

    // Find the best slate for the target date
    // Prefer slates that start on the target date with the most games (main slate)
    const targetDateObj = new Date(targetDate + 'T00:00:00-05:00');
    const targetEnd = new Date(targetDate + 'T23:59:59-05:00');

    let bestSlate = null;
    let bestScore = -1;

    for (const dg of draftGroups) {
        const startDate = new Date(dg.startDate);
        const matchesDate = startDate >= targetDateObj && startDate <= targetEnd;

        // Score: date match is most important, then game count
        let score = 0;
        if (matchesDate) score += 10000;
        score += (dg.gameCount || 0);

        if (score > bestScore) {
            bestScore = score;
            bestSlate = dg;
        }
    }

    if (!bestSlate) {
        // Fallback: use the draft group with the most games
        bestSlate = draftGroups.reduce((best, dg) =>
            (dg.gameCount || 0) > (best.gameCount || 0) ? dg : best,
            draftGroups[0]
        );
    }

    console.log(`Using DraftKings slate ${bestSlate.draftGroupId} (${bestSlate.gameCount} games, starts ${bestSlate.startDate})`);
    return await fetchDraftablePlayers(bestSlate.draftGroupId);
}
