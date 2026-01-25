// GET /api/schedules/philly - Fetch upcoming home games for Philly sports teams
// Uses ESPN API (free, reliable) for all sports data

// ESPN Team Schedule URLs
const ESPN_SCHEDULE_URLS = {
    eagles: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule',
    sixers: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/schedule',
    phillies: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/schedule',
    flyers: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/schedule'
};

// Philly team configurations
const TEAM_CONFIG = {
    eagles: {
        name: 'Eagles',
        sport: 'NFL',
        venue: 'Lincoln Financial Field',
        city: 'Philadelphia',
        color: '#004C54'
    },
    phillies: {
        name: 'Phillies',
        sport: 'MLB',
        venue: 'Citizens Bank Park',
        city: 'Philadelphia',
        color: '#E81828'
    },
    sixers: {
        name: '76ers',
        sport: 'NBA',
        venue: 'Wells Fargo Center',
        city: 'Philadelphia',
        color: '#006BB6'
    },
    flyers: {
        name: 'Flyers',
        sport: 'NHL',
        venue: 'Wells Fargo Center',
        city: 'Philadelphia',
        color: '#F74902'
    }
};

/**
 * Fetch schedule from ESPN API
 */
async function fetchESPNTeamSchedule(teamKey, config) {
    const url = ESPN_SCHEDULE_URLS[teamKey];
    if (!url) return [];

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`ESPN fetch failed for ${teamKey}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const events = data.events || [];
        const games = [];

        for (const event of events) {
            const competition = event.competitions?.[0];
            if (!competition) continue;

            // Find home/away teams
            const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');

            // Determine if Philly team is home
            const phillyNames = ['Philadelphia', config.name];
            const isHome = phillyNames.some(name =>
                homeTeam?.team?.displayName?.includes(name) ||
                homeTeam?.team?.shortDisplayName?.includes(name)
            );

            const opponent = isHome
                ? (awayTeam?.team?.shortDisplayName || awayTeam?.team?.abbreviation || 'TBD')
                : (homeTeam?.team?.shortDisplayName || homeTeam?.team?.abbreviation || 'TBD');

            const eventTitle = isHome
                ? `${config.name} vs ${opponent}`
                : `${config.name} @ ${opponent}`;

            const statusType = competition.status?.type || {};

            games.push({
                id: event.id,
                team: teamKey,
                teamName: config.name,
                eventTitle,
                opponent,
                date: event.date,
                venue: isHome ? config.venue : (competition.venue?.fullName || 'Away'),
                city: isHome ? config.city : '',
                isHome,
                week: event.week?.number || null,
                seasonType: event.seasonType?.name || 'Regular Season',
                status: statusType.completed ? 'Final' : (statusType.state || 'scheduled'),
                gameId: event.id,
                espnId: event.id,
                broadcast: competition.broadcasts?.[0]?.names?.[0] || ''
            });
        }

        return games;
    } catch (error) {
        console.error(`Error fetching ${teamKey} schedule:`, error.message);
        return [];
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { team, days = 60 } = req.query;

        // Determine which teams to fetch
        const teamsToFetch = team ? { [team]: TEAM_CONFIG[team] } : TEAM_CONFIG;

        if (team && !TEAM_CONFIG[team]) {
            return res.status(400).json({ error: 'Invalid team. Must be one of: eagles, phillies, sixers, flyers' });
        }

        const allGames = [];
        const errors = [];

        // Fetch schedules for each team in parallel
        await Promise.all(
            Object.entries(teamsToFetch).map(async ([teamKey, config]) => {
                if (!config) return;

                try {
                    const games = await fetchESPNTeamSchedule(teamKey, config);
                    allGames.push(...games);
                } catch (error) {
                    console.error(`Error fetching ${teamKey} schedule:`, error.message);
                    errors.push({ team: teamKey, error: error.message });
                }
            })
        );

        // Filter to only home games in the future
        const now = new Date();
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + parseInt(days));

        const upcomingHomeGames = allGames
            .filter(game => {
                const gameDate = new Date(game.date);
                const isCompleted = game.status === 'Final' || game.status === 'F/OT';
                return game.isHome && gameDate > now && gameDate <= maxDate && !isCompleted;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            success: true,
            games: upcomingHomeGames,
            count: upcomingHomeGames.length,
            source: 'espn',
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Philly schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
}
