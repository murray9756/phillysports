// Vercel Serverless Function - Fetch Philly Sports Schedule
// Uses ESPN API (free, reliable) for all sports data
// SportsDataIO is only used for fantasy player salaries

// ESPN Team Schedule URLs
const ESPN_SCHEDULE_URLS = {
    eagles: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule',
    sixers: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/schedule',
    phillies: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/schedule',
    flyers: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/schedule',
    union: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/schedule'
};

// College ESPN URLs
const ESPN_COLLEGE_URLS = {
    villanova: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/222/schedule',
    temple: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/218/schedule',
    stjosephs: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/2603/schedule',
    penn: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/219/schedule',
    lasalle: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/2325/schedule',
    drexel: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/2182/schedule'
};

// Team configurations
const TEAM_CONFIG = {
    eagles: { sport: 'NFL', name: 'Eagles', color: '#004C54' },
    sixers: { sport: 'NBA', name: '76ers', color: '#006BB6' },
    '76ers': { sport: 'NBA', name: '76ers', color: '#006BB6' },
    phillies: { sport: 'MLB', name: 'Phillies', color: '#E81828' },
    flyers: { sport: 'NHL', name: 'Flyers', color: '#F74902' },
    union: { sport: 'MLS', name: 'Union', color: '#B49759' }
};

// College team configurations
const COLLEGE_CONFIG = {
    villanova: { name: 'Villanova', color: '#003366', sport: 'NCAAB' },
    penn: { name: 'Penn', color: '#011F5B', sport: 'NCAAB' },
    lasalle: { name: 'La Salle', color: '#00833E', sport: 'NCAAB' },
    drexel: { name: 'Drexel', color: '#07294D', sport: 'NCAAB' },
    stjosephs: { name: "St. Joseph's", color: '#9E1B32', sport: 'NCAAB' },
    temple: { name: 'Temple', color: '#9D2235', sport: 'NCAAB' }
};

/**
 * Fetch schedule from ESPN API for a team
 */
async function fetchESPNSchedule(url, teamName, teamColor, sport) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`ESPN fetch failed for ${teamName}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const events = data.events || [];
        const schedule = [];

        const now = new Date();

        for (const event of events) {
            const competition = event.competitions?.[0];
            if (!competition) continue;

            const gameDate = new Date(event.date);
            const statusType = competition.status?.type || {};

            // Skip completed games
            if (statusType.completed) continue;

            // Skip games in the past
            if (gameDate < now) continue;

            // Find home/away teams
            const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');

            // Determine if Philly team is home
            const phillyTeamNames = ['Philadelphia', 'Eagles', 'Phillies', '76ers', 'Flyers', 'Union', teamName];
            const isHome = phillyTeamNames.some(name =>
                homeTeam?.team?.displayName?.includes(name) ||
                homeTeam?.team?.shortDisplayName?.includes(name)
            );

            const opponent = isHome
                ? (awayTeam?.team?.shortDisplayName || awayTeam?.team?.displayName || 'TBD')
                : (homeTeam?.team?.shortDisplayName || homeTeam?.team?.displayName || 'TBD');

            schedule.push({
                sport,
                team: teamName,
                teamColor,
                opponent,
                isHome,
                date: event.date,
                venue: competition.venue?.fullName || '',
                broadcast: competition.broadcasts?.[0]?.names?.[0] || competition.geoBroadcasts?.[0]?.media?.shortName || '',
                gameId: event.id,
                espnId: event.id
            });
        }

        return schedule;
    } catch (error) {
        console.error(`ESPN schedule error for ${teamName}:`, error.message);
        return [];
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team, days } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;
    const daysLimit = parseInt(days) || 10;

    try {
        const schedule = [];
        const now = new Date();
        const maxDate = new Date(now.getTime() + daysLimit * 24 * 60 * 60 * 1000);
        const currentMonth = now.getMonth() + 1;

        // Determine which sports are in season
        const isNflSeason = currentMonth >= 8 || currentMonth <= 2;
        const isNbaSeason = currentMonth >= 10 || currentMonth <= 6;
        const isNhlSeason = currentMonth >= 10 || currentMonth <= 6;
        const isMlbSeason = currentMonth >= 2 && currentMonth <= 11;
        const isMlsSeason = currentMonth >= 2 && currentMonth <= 12;
        const isNcaabSeason = currentMonth >= 11 || currentMonth <= 3;

        // Fetch schedules in parallel
        const fetchPromises = [];

        if (isNflSeason && (!teamFilter || teamFilter === 'eagles')) {
            fetchPromises.push(
                fetchESPNSchedule(ESPN_SCHEDULE_URLS.eagles, 'Eagles', '#004C54', 'NFL')
            );
        }
        if (isNbaSeason && (!teamFilter || teamFilter === 'sixers' || teamFilter === '76ers')) {
            fetchPromises.push(
                fetchESPNSchedule(ESPN_SCHEDULE_URLS.sixers, '76ers', '#006BB6', 'NBA')
            );
        }
        if (isNhlSeason && (!teamFilter || teamFilter === 'flyers')) {
            fetchPromises.push(
                fetchESPNSchedule(ESPN_SCHEDULE_URLS.flyers, 'Flyers', '#F74902', 'NHL')
            );
        }
        if (isMlbSeason && (!teamFilter || teamFilter === 'phillies')) {
            fetchPromises.push(
                fetchESPNSchedule(ESPN_SCHEDULE_URLS.phillies, 'Phillies', '#E81828', 'MLB')
            );
        }
        if (isMlsSeason && (!teamFilter || teamFilter === 'union')) {
            fetchPromises.push(
                fetchESPNSchedule(ESPN_SCHEDULE_URLS.union, 'Union', '#B49759', 'MLS')
            );
        }

        // Fetch college if requested
        if (teamFilter && COLLEGE_CONFIG[teamFilter] && ESPN_COLLEGE_URLS[teamFilter]) {
            if (isNcaabSeason) {
                const college = COLLEGE_CONFIG[teamFilter];
                fetchPromises.push(
                    fetchESPNSchedule(ESPN_COLLEGE_URLS[teamFilter], college.name, college.color, 'NCAAB')
                );
            }
        }

        // Wait for all fetches
        const results = await Promise.all(fetchPromises);

        // Flatten and combine
        for (const teamSchedule of results) {
            schedule.push(...teamSchedule);
        }

        // Filter to only games within the date range
        const filteredSchedule = schedule.filter(game => {
            const gameDate = new Date(game.date);
            return gameDate >= now && gameDate <= maxDate;
        });

        // Sort by date
        filteredSchedule.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Limit results
        const limitedSchedule = filteredSchedule.slice(0, 10);

        res.status(200).json({
            schedule: limitedSchedule,
            updated: new Date().toISOString(),
            source: 'espn',
            count: limitedSchedule.length
        });
    } catch (error) {
        console.error('Schedule fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch schedule', message: error.message });
    }
}
