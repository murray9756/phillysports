// GET /api/schedules/philly - Fetch upcoming home games for Philly sports teams
// Uses SportsDataIO for all sports data

import { fetchTeamSchedule, getCurrentSeason } from '../lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

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

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const { team, days = 60 } = req.query;

        // Philly team configurations
        const teams = {
            eagles: {
                name: 'Eagles',
                sport: 'NFL',
                abbr: 'PHI',
                venue: 'Lincoln Financial Field',
                city: 'Philadelphia'
            },
            phillies: {
                name: 'Phillies',
                sport: 'MLB',
                abbr: 'PHI',
                venue: 'Citizens Bank Park',
                city: 'Philadelphia'
            },
            sixers: {
                name: '76ers',
                sport: 'NBA',
                abbr: 'PHI',
                venue: 'Wells Fargo Center',
                city: 'Philadelphia'
            },
            flyers: {
                name: 'Flyers',
                sport: 'NHL',
                abbr: 'PHI',
                venue: 'Wells Fargo Center',
                city: 'Philadelphia'
            }
        };

        // Determine which teams to fetch
        const teamsToFetch = team ? { [team]: teams[team] } : teams;

        if (team && !teams[team]) {
            return res.status(400).json({ error: 'Invalid team. Must be one of: eagles, phillies, sixers, flyers' });
        }

        const allGames = [];
        const errors = [];

        // Fetch schedules for each team
        await Promise.all(
            Object.entries(teamsToFetch).map(async ([teamKey, config]) => {
                if (!config) return;

                try {
                    const season = getCurrentSeason(config.sport);
                    const games = await fetchTeamSchedule(config.sport, config.abbr, season);

                    games.forEach(game => {
                        const isHome = game.HomeTeam === config.abbr;
                        const opponent = isHome ? game.AwayTeam : game.HomeTeam;
                        const eventTitle = isHome
                            ? `${config.name} vs ${opponent}`
                            : `${config.name} @ ${opponent}`;

                        allGames.push({
                            id: (game.GameID || game.ScoreID)?.toString(),
                            team: teamKey,
                            teamName: config.name,
                            eventTitle,
                            opponent,
                            date: game.DateTime || game.Day,
                            venue: isHome ? config.venue : (game.StadiumDetails?.Name || game.Stadium || 'Away'),
                            city: isHome ? config.city : '',
                            isHome,
                            week: game.Week || null,
                            seasonType: game.SeasonType === 1 ? 'Preseason' :
                                       game.SeasonType === 2 ? 'Regular Season' :
                                       game.SeasonType === 3 ? 'Postseason' : 'Regular Season',
                            status: game.Status || 'scheduled',
                            gameId: (game.GameID || game.ScoreID)?.toString()
                        });
                    });
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
            source: 'sportsdata',
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Philly schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
}
