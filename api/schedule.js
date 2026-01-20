// Vercel Serverless Function - Fetch Philly Sports Schedule
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Get team filter and days limit from query params
    const { team, days } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;
    const daysLimit = parseInt(days) || 10; // Default to 10 days

    try {
        const schedule = [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const maxDate = new Date(now.getTime() + daysLimit * 24 * 60 * 60 * 1000);

        // Helper to validate game date is actually in the future and reasonable year
        const isValidFutureGame = (dateStr, statusCompleted) => {
            const gameDate = new Date(dateStr);
            const gameYear = gameDate.getFullYear();
            // Must be future, not completed, and within current or next year
            return gameDate > now &&
                   gameDate < maxDate &&
                   !statusCompleted &&
                   (gameYear === currentYear || gameYear === currentYear + 1);
        };

        // Fetch NFL (Eagles) schedule - only during season (Sept-Feb)
        const currentMonth = now.getMonth() + 1; // 1-12
        const isNflSeason = currentMonth >= 9 || currentMonth <= 2;
        if (isNflSeason) {
            try {
                const nflRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule');
                const nflData = await nflRes.json();
                const upcomingEagles = nflData.events?.filter(e => {
                    return isValidFutureGame(e.date, e.competitions?.[0]?.status?.type?.completed);
                }).slice(0, 2) || [];

                upcomingEagles.forEach(game => {
                    const comp = game.competitions[0];
                    const opponent = comp.competitors.find(c => c.team?.abbreviation !== 'PHI');
                    const isHome = comp.competitors.find(c => c.team?.abbreviation === 'PHI')?.homeAway === 'home';
                    schedule.push({
                        sport: 'NFL',
                        team: 'Eagles',
                        teamColor: '#004C54',
                        opponent: opponent?.team?.shortDisplayName || 'TBD',
                        isHome,
                        date: game.date,
                        venue: comp.venue?.fullName || '',
                        broadcast: comp.broadcasts?.[0]?.names?.[0] || ''
                    });
                });
            } catch (e) { console.error('NFL schedule error:', e); }
        }

        // Fetch NBA (76ers) schedule - season runs Oct-June
        const isNbaSeason = currentMonth >= 10 || currentMonth <= 6;
        if (isNbaSeason) {
            try {
                const nbaRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/schedule');
                const nbaData = await nbaRes.json();
                const upcomingSixers = nbaData.events?.filter(e => {
                    return isValidFutureGame(e.date, e.competitions?.[0]?.status?.type?.completed);
                }).slice(0, 2) || [];

                upcomingSixers.forEach(game => {
                    const comp = game.competitions[0];
                    const opponent = comp.competitors.find(c => c.team?.abbreviation !== 'PHI');
                    const isHome = comp.competitors.find(c => c.team?.abbreviation === 'PHI')?.homeAway === 'home';
                    schedule.push({
                        sport: 'NBA',
                        team: '76ers',
                        teamColor: '#006BB6',
                        opponent: opponent?.team?.shortDisplayName || 'TBD',
                        isHome,
                        date: game.date,
                        venue: comp.venue?.fullName || '',
                        broadcast: comp.broadcasts?.[0]?.names?.[0] || ''
                    });
                });
            } catch (e) { console.error('NBA schedule error:', e); }
        }

        // Fetch NHL (Flyers) schedule - season runs Oct-June
        const isNhlSeason = currentMonth >= 10 || currentMonth <= 6;
        if (isNhlSeason) {
            try {
                const nhlRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/schedule');
                const nhlData = await nhlRes.json();
                const upcomingFlyers = nhlData.events?.filter(e => {
                    return isValidFutureGame(e.date, e.competitions?.[0]?.status?.type?.completed);
                }).slice(0, 2) || [];

                upcomingFlyers.forEach(game => {
                    const comp = game.competitions[0];
                    const opponent = comp.competitors.find(c => c.team?.abbreviation !== 'PHI');
                    const isHome = comp.competitors.find(c => c.team?.abbreviation === 'PHI')?.homeAway === 'home';
                    schedule.push({
                        sport: 'NHL',
                        team: 'Flyers',
                        teamColor: '#F74902',
                        opponent: opponent?.team?.shortDisplayName || 'TBD',
                        isHome,
                        date: game.date,
                        venue: comp.venue?.fullName || '',
                        broadcast: comp.broadcasts?.[0]?.names?.[0] || ''
                    });
                });
            } catch (e) { console.error('NHL schedule error:', e); }
        }

        // Fetch MLB (Phillies) schedule - season runs March-October
        const isMlbSeason = currentMonth >= 3 && currentMonth <= 10;
        if (isMlbSeason) {
            try {
                const mlbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/schedule');
                const mlbData = await mlbRes.json();
                const upcomingPhillies = mlbData.events?.filter(e => {
                    return isValidFutureGame(e.date, e.competitions?.[0]?.status?.type?.completed);
                }).slice(0, 2) || [];

                upcomingPhillies.forEach(game => {
                    const comp = game.competitions[0];
                    const opponent = comp.competitors.find(c => c.team?.abbreviation !== 'PHI');
                    const isHome = comp.competitors.find(c => c.team?.abbreviation === 'PHI')?.homeAway === 'home';
                    schedule.push({
                        sport: 'MLB',
                        team: 'Phillies',
                        teamColor: '#E81828',
                        opponent: opponent?.team?.shortDisplayName || 'TBD',
                        isHome,
                        date: game.date,
                        venue: comp.venue?.fullName || '',
                        broadcast: comp.broadcasts?.[0]?.names?.[0] || ''
                    });
                });
            } catch (e) { console.error('MLB schedule error:', e); }
        }

        // Fetch MLS (Union) schedule - season runs Feb-Dec
        const isMlsSeason = currentMonth >= 2 && currentMonth <= 12;
        if (isMlsSeason) {
            try {
                const mlsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/schedule');
                const mlsData = await mlsRes.json();
                const upcomingUnion = mlsData.events?.filter(e => {
                    return isValidFutureGame(e.date, e.competitions?.[0]?.status?.type?.completed);
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

        // College Basketball team configs
        const collegeTeams = {
            'villanova': { id: '2678', name: 'Villanova', color: '#003366', abbr: 'VILL' },
            'penn': { id: '219', name: 'Penn', color: '#011F5B', abbr: 'PENN' },
            'lasalle': { id: '2325', name: 'La Salle', color: '#00833E', abbr: 'LAS' },
            'drexel': { id: '2182', name: 'Drexel', color: '#07294D', abbr: 'DREX' },
            'stjosephs': { id: '2603', name: 'St. Josephs', color: '#9E1B32', abbr: 'SJU' },
            'temple': { id: '218', name: 'Temple', color: '#9D2235', abbr: 'TEM' }
        };

        // Fetch college basketball schedule if requested
        if (teamFilter && collegeTeams[teamFilter]) {
            const college = collegeTeams[teamFilter];
            try {
                const cbRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${college.id}/schedule`);
                const cbData = await cbRes.json();
                const upcomingGames = cbData.events?.filter(e => {
                    const gameDate = new Date(e.date);
                    return gameDate > now && gameDate < maxDate && !e.competitions?.[0]?.status?.type?.completed;
                }).slice(0, 5) || [];

                upcomingGames.forEach(game => {
                    const comp = game.competitions[0];
                    const opponent = comp.competitors.find(c => c.team?.id !== college.id);
                    const isHome = comp.competitors.find(c => c.team?.id === college.id)?.homeAway === 'home';
                    schedule.push({
                        sport: 'NCAAB',
                        team: college.name,
                        teamColor: college.color,
                        opponent: opponent?.team?.shortDisplayName || 'TBD',
                        isHome,
                        date: game.date,
                        venue: comp.venue?.fullName || '',
                        broadcast: comp.broadcasts?.[0]?.names?.[0] || ''
                    });
                });
            } catch (e) { console.error('College basketball schedule error:', e); }
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
                // College teams
                'villanova': 'Villanova',
                'penn': 'Penn',
                'lasalle': 'La Salle',
                'drexel': 'Drexel',
                'stjosephs': 'St. Josephs',
                'temple': 'Temple'
            };
            const targetTeam = teamMap[teamFilter];
            if (targetTeam) {
                filteredSchedule = schedule.filter(s => s.team === targetTeam);
            }
        }

        res.status(200).json({ schedule: filteredSchedule.slice(0, 8), updated: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch schedule', message: error.message });
    }
}
