// GET /api/schedules/philly - Fetch upcoming home games for Philly sports teams from ESPN API

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

        // Philly team configurations (major 4 sports)
        const teams = {
            eagles: {
                name: 'Eagles',
                sport: 'football',
                league: 'nfl',
                teamId: '21',
                venue: 'Lincoln Financial Field',
                city: 'Philadelphia'
            },
            phillies: {
                name: 'Phillies',
                sport: 'baseball',
                league: 'mlb',
                teamId: '22',
                venue: 'Citizens Bank Park',
                city: 'Philadelphia'
            },
            sixers: {
                name: '76ers',
                sport: 'basketball',
                league: 'nba',
                teamId: '20',
                venue: 'Wells Fargo Center',
                city: 'Philadelphia'
            },
            flyers: {
                name: 'Flyers',
                sport: 'hockey',
                league: 'nhl',
                teamId: '15',
                venue: 'Wells Fargo Center',
                city: 'Philadelphia'
            }
        };

        // Determine which teams to fetch
        const teamsToFetch = team ? { [team]: teams[team] } : teams;

        if (team && !teams[team]) {
            return res.status(400).json({ error: 'Invalid team. Must be one of: eagles, phillies, sixers, flyers, union' });
        }

        const allGames = [];
        const errors = [];

        // Fetch schedules for each team
        await Promise.all(
            Object.entries(teamsToFetch).map(async ([teamKey, config]) => {
                try {
                    const games = await fetchTeamSchedule(teamKey, config);
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
                return game.isHome && gameDate > now && gameDate <= maxDate;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            success: true,
            games: upcomingHomeGames,
            count: upcomingHomeGames.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Philly schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
}

async function fetchTeamSchedule(teamKey, config) {
    const { sport, league, teamId, venue, city, name } = config;

    // ESPN API endpoint for team schedule
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PhillySports/1.0)'
        }
    });

    if (!response.ok) {
        throw new Error(`ESPN API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.events || !Array.isArray(data.events)) {
        return [];
    }

    // Transform ESPN events to our format
    return data.events.map(event => {
        // Determine if home game
        const competition = event.competitions?.[0];
        const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');
        const isHome = homeTeam?.team?.id === teamId;

        // Get opponent name
        const opponent = isHome ? awayTeam?.team : homeTeam?.team;
        const opponentName = opponent?.displayName || opponent?.name || 'TBD';

        // Build event title
        const eventTitle = isHome
            ? `${name} vs ${opponentName}`
            : `${name} @ ${opponentName}`;

        // Get venue info (use competition venue or default)
        const gameVenue = competition?.venue?.fullName || (isHome ? venue : 'Away');
        const gameCity = competition?.venue?.address?.city || (isHome ? city : '');

        return {
            id: event.id,
            team: teamKey,
            teamName: name,
            eventTitle,
            opponent: opponentName,
            date: event.date,
            venue: gameVenue,
            city: gameCity,
            isHome,
            week: event.week?.number || null,
            seasonType: event.seasonType?.name || 'Regular Season',
            status: competition?.status?.type?.name || 'scheduled',
            // Additional metadata
            espnId: event.id,
            espnLink: event.links?.find(l => l.rel?.includes('gamecast'))?.href
        };
    });
}
