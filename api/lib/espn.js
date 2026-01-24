// ESPN API integration for live scoreboards with period scores
// Used by block pools for quarter-by-quarter scoring

const SCOREBOARD_URLS = {
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    NCAAF: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
    NCAAB: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
};

/**
 * Fetch scoreboard from ESPN for a specific sport
 * Returns games with period-by-period scores (linescores)
 */
export async function fetchScoreboard(sport) {
    const url = SCOREBOARD_URLS[sport];
    if (!url) {
        console.error(`Unknown sport: ${sport}`);
        return [];
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN fetch failed: ${response.status}`);
        }

        const data = await response.json();
        const events = data.events || [];

        return events.map(event => {
            const competition = event.competitions?.[0];
            if (!competition) return null;

            const homeTeamData = competition.competitors?.find(c => c.homeAway === 'home');
            const awayTeamData = competition.competitors?.find(c => c.homeAway === 'away');

            const status = competition.status || {};
            const statusType = status.type || {};

            // Extract period/quarter scores from linescores
            const homeLinescores = homeTeamData?.linescores || [];
            const awayLinescores = awayTeamData?.linescores || [];

            // Build cumulative scores at end of each period
            let homeCumulative = 0;
            let awayCumulative = 0;
            const periodScores = {};

            if (sport === 'NFL' || sport === 'NBA' || sport === 'NCAAF' || sport === 'NCAAB') {
                // Quarters: Q1, Q2, Q3, Q4
                const periods = ['Q1', 'Q2', 'Q3', 'Q4'];
                for (let i = 0; i < periods.length; i++) {
                    const homeQtr = homeLinescores[i]?.value || 0;
                    const awayQtr = awayLinescores[i]?.value || 0;
                    homeCumulative += homeQtr;
                    awayCumulative += awayQtr;
                    periodScores[periods[i]] = { home: homeCumulative, away: awayCumulative };
                }
            } else if (sport === 'NHL') {
                // Periods: P1, P2, P3
                const periods = ['P1', 'P2', 'P3'];
                for (let i = 0; i < periods.length; i++) {
                    const homePeriod = homeLinescores[i]?.value || 0;
                    const awayPeriod = awayLinescores[i]?.value || 0;
                    homeCumulative += homePeriod;
                    awayCumulative += awayPeriod;
                    periodScores[periods[i]] = { home: homeCumulative, away: awayCumulative };
                }
            } else if (sport === 'MLB') {
                // Innings - we need cumulative at 3rd, 6th, 9th
                for (let i = 0; i < Math.min(homeLinescores.length, 9); i++) {
                    const homeInning = homeLinescores[i]?.value || 0;
                    const awayInning = awayLinescores[i]?.value || 0;
                    homeCumulative += homeInning;
                    awayCumulative += awayInning;

                    if (i === 2) periodScores['3rd'] = { home: homeCumulative, away: awayCumulative };
                    if (i === 5) periodScores['6th'] = { home: homeCumulative, away: awayCumulative };
                    if (i === 8) periodScores['9th'] = { home: homeCumulative, away: awayCumulative };
                }
            }

            // Final score
            periodScores['Final'] = {
                home: parseInt(homeTeamData?.score) || 0,
                away: parseInt(awayTeamData?.score) || 0
            };

            return {
                espnId: event.id,
                homeTeam: homeTeamData?.team?.displayName || homeTeamData?.team?.name || 'Home',
                awayTeam: awayTeamData?.team?.displayName || awayTeamData?.team?.name || 'Away',
                homeScore: parseInt(homeTeamData?.score) || 0,
                awayScore: parseInt(awayTeamData?.score) || 0,
                periodScores,  // Cumulative scores at end of each period
                gameDate: event.date,
                statusDescription: status.type?.shortDetail || status.type?.detail || '',
                period: status.period || 0,
                isInProgress: statusType.state === 'in',
                isFinal: statusType.completed === true,
                isScheduled: statusType.state === 'pre'
            };
        }).filter(Boolean);
    } catch (error) {
        console.error(`ESPN ${sport} fetch error:`, error);
        return [];
    }
}

/**
 * Fetch scoreboards for all major sports
 */
export async function fetchAllScoreboards() {
    const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
    const results = {};

    await Promise.all(sports.map(async (sport) => {
        results[sport] = await fetchScoreboard(sport);
    }));

    return results;
}

export { SCOREBOARD_URLS };
