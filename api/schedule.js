// Vercel Serverless Function - Fetch Philly Sports Schedule
// Uses SportsDataIO for all sports data

import {
    fetchTeamSchedule,
    getCurrentSeason,
    COLLEGE_TEAMS
} from './lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// Team configurations
const TEAM_CONFIG = {
    eagles: { sport: 'NFL', abbr: 'PHI', name: 'Eagles', color: '#004C54' },
    sixers: { sport: 'NBA', abbr: 'PHI', name: '76ers', color: '#006BB6' },
    '76ers': { sport: 'NBA', abbr: 'PHI', name: '76ers', color: '#006BB6' },
    phillies: { sport: 'MLB', abbr: 'PHI', name: 'Phillies', color: '#E81828' },
    flyers: { sport: 'NHL', abbr: 'PHI', name: 'Flyers', color: '#F74902' },
    union: { sport: 'MLS', abbr: 'PHI', name: 'Union', color: '#B49759' }
};

// College team configurations
const COLLEGE_CONFIG = {
    villanova: { name: 'Villanova', color: '#003366', sport: 'NCAAB' },
    penn: { name: 'Penn', color: '#011F5B', sport: 'NCAAB' },
    lasalle: { name: 'La Salle', color: '#00833E', sport: 'NCAAB' },
    drexel: { name: 'Drexel', color: '#07294D', sport: 'NCAAB' },
    stjosephs: { name: 'St. Josephs', color: '#9E1B32', sport: 'NCAAB' },
    temple: { name: 'Temple', color: '#9D2235', sport: 'NCAAB' }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team, days } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;
    const daysLimit = parseInt(days) || 10;

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const schedule = [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const maxDate = new Date(now.getTime() + daysLimit * 24 * 60 * 60 * 1000);

        // Helper to validate game date
        const isValidFutureGame = (dateStr, status) => {
            const gameDate = new Date(dateStr);
            const gameYear = gameDate.getFullYear();
            const isCompleted = status === 'Final' || status === 'F/OT';
            return gameDate > now &&
                   gameDate < maxDate &&
                   !isCompleted &&
                   (gameYear === currentYear || gameYear === currentYear + 1);
        };

        // Fetch schedules for each major sport
        const sportsToFetch = [
            { sport: 'NFL', config: TEAM_CONFIG.eagles, season: () => isNflSeason() },
            { sport: 'NBA', config: TEAM_CONFIG.sixers, season: () => isNbaSeason() },
            { sport: 'NHL', config: TEAM_CONFIG.flyers, season: () => isNhlSeason() },
            { sport: 'MLB', config: TEAM_CONFIG.phillies, season: () => isMlbSeason() }
        ];

        // Check if in season
        const currentMonth = now.getMonth() + 1;
        function isNflSeason() { return currentMonth >= 9 || currentMonth <= 2; }
        function isNbaSeason() { return currentMonth >= 10 || currentMonth <= 6; }
        function isNhlSeason() { return currentMonth >= 10 || currentMonth <= 6; }
        function isMlbSeason() { return currentMonth >= 3 && currentMonth <= 10; }

        await Promise.all(sportsToFetch.map(async ({ sport, config, season }) => {
            if (!season()) return;

            try {
                const seasonYear = getCurrentSeason(sport);
                const games = await fetchTeamSchedule(sport, 'PHI', seasonYear);

                const upcomingGames = games
                    .filter(g => isValidFutureGame(g.DateTime || g.Day, g.Status))
                    .slice(0, 2);

                upcomingGames.forEach(game => {
                    const isHome = game.HomeTeam === 'PHI';
                    const opponent = isHome ? game.AwayTeam : game.HomeTeam;

                    schedule.push({
                        sport,
                        team: config.name,
                        teamColor: config.color,
                        opponent,
                        isHome,
                        date: game.DateTime || game.Day,
                        venue: game.StadiumDetails?.Name || game.Stadium || '',
                        broadcast: game.Channel || '',
                        gameId: (game.GameID || game.ScoreID)?.toString()
                    });
                });
            } catch (e) {
                console.error(`${sport} schedule error:`, e.message);
            }
        }));

        // Fetch MLS (Union) - keep ESPN fallback for MLS
        const isMlsSeason = currentMonth >= 2 && currentMonth <= 12;
        if (isMlsSeason) {
            try {
                const mlsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/schedule');
                const mlsData = await mlsRes.json();
                const upcomingUnion = mlsData.events?.filter(e => {
                    const gameDate = new Date(e.date);
                    return gameDate > now && gameDate < maxDate && !e.competitions?.[0]?.status?.type?.completed;
                }).slice(0, 2) || [];

                upcomingUnion.forEach(game => {
                    const comp = game.competitions[0];
                    const opponent = comp.competitors.find(c => !c.team?.displayName?.includes('Philadelphia'));
                    const isHome = comp.competitors.find(c => c.team?.displayName?.includes('Philadelphia'))?.homeAway === 'home';
                    schedule.push({
                        sport: 'MLS',
                        team: 'Union',
                        teamColor: '#B49759',
                        opponent: opponent?.team?.shortDisplayName || 'TBD',
                        isHome,
                        date: game.date,
                        venue: comp.venue?.fullName || '',
                        broadcast: comp.broadcasts?.[0]?.names?.[0] || ''
                    });
                });
            } catch (e) { console.error('MLS schedule error:', e); }
        }

        // Sort by date
        schedule.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Fetch college basketball schedule if requested
        if (teamFilter && COLLEGE_CONFIG[teamFilter]) {
            const college = COLLEGE_CONFIG[teamFilter];
            try {
                const season = getCurrentSeason('NCAAB');
                const teamId = COLLEGE_TEAMS[teamFilter]?.id || teamFilter.toUpperCase();
                const url = `https://api.sportsdata.io/v3/cbb/scores/json/TeamSchedule/${season}/${teamId}?key=${SPORTSDATA_API_KEY}`;
                const response = await fetch(url);

                if (response.ok) {
                    const games = await response.json();
                    const upcomingGames = games
                        .filter(g => isValidFutureGame(g.DateTime || g.Day, g.Status))
                        .slice(0, 5);

                    upcomingGames.forEach(game => {
                        const isHome = game.HomeTeam === teamId;
                        const opponent = isHome ? game.AwayTeam : game.HomeTeam;

                        schedule.push({
                            sport: 'NCAAB',
                            team: college.name,
                            teamColor: college.color,
                            opponent,
                            isHome,
                            date: game.DateTime || game.Day,
                            venue: game.Stadium || '',
                            broadcast: game.Channel || '',
                            gameId: game.GameID?.toString()
                        });
                    });
                }
            } catch (e) {
                console.error('College basketball schedule error:', e);
            }
        }

        // Filter by team if specified
        let filteredSchedule = schedule;
        if (teamFilter) {
            const teamMap = {
                'eagles': 'Eagles',
                'phillies': 'Phillies',
                'sixers': '76ers',
                '76ers': '76ers',
                'flyers': 'Flyers',
                'union': 'Union',
                ...Object.fromEntries(
                    Object.entries(COLLEGE_CONFIG).map(([key, val]) => [key, val.name])
                )
            };
            const targetTeam = teamMap[teamFilter];
            if (targetTeam) {
                filteredSchedule = schedule.filter(s => s.team === targetTeam);
            }
        }

        res.status(200).json({
            schedule: filteredSchedule.slice(0, 8),
            updated: new Date().toISOString(),
            source: 'sportsdata'
        });
    } catch (error) {
        console.error('Schedule fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch schedule', message: error.message });
    }
}
