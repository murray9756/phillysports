// Vercel Serverless Function - Fetch Philly Sports Schedule
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const schedule = [];
        const now = new Date();

        // Fetch NFL (Eagles) schedule
        try {
            const nflRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule');
            const nflData = await nflRes.json();
            const upcomingEagles = nflData.events?.filter(e => {
                const gameDate = new Date(e.date);
                return gameDate > now && !e.competitions?.[0]?.status?.type?.completed;
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

        // Fetch NBA (76ers) schedule
        try {
            const nbaRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/schedule');
            const nbaData = await nbaRes.json();
            const upcomingSixers = nbaData.events?.filter(e => {
                const gameDate = new Date(e.date);
                return gameDate > now && !e.competitions?.[0]?.status?.type?.completed;
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

        // Fetch NHL (Flyers) schedule
        try {
            const nhlRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/schedule');
            const nhlData = await nhlRes.json();
            const upcomingFlyers = nhlData.events?.filter(e => {
                const gameDate = new Date(e.date);
                return gameDate > now && !e.competitions?.[0]?.status?.type?.completed;
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

        // Fetch MLB (Phillies) schedule
        try {
            const mlbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/schedule');
            const mlbData = await mlbRes.json();
            const upcomingPhillies = mlbData.events?.filter(e => {
                const gameDate = new Date(e.date);
                return gameDate > now && !e.competitions?.[0]?.status?.type?.completed;
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

        // Fetch MLS (Union) schedule
        try {
            const mlsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/schedule');
            const mlsData = await mlsRes.json();
            const upcomingUnion = mlsData.events?.filter(e => {
                const gameDate = new Date(e.date);
                return gameDate > now && !e.competitions?.[0]?.status?.type?.completed;
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

        // Sort by date
        schedule.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({ schedule: schedule.slice(0, 8), updated: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch schedule', message: error.message });
    }
}
