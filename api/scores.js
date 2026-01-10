// Vercel Serverless Function - Fetch Philly Sports Scores
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Get team filter from query params
    const { team } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;

    // Helper to extract score value (ESPN API sometimes returns objects)
    const getScore = (score) => {
        if (typeof score === 'object' && score !== null) {
            return String(score.displayValue || score.value || '0');
        }
        return String(score || '0');
    };

    // Helper to extract game link from event
    const getGameLink = (event) => {
        const summaryLink = event.links?.find(l => l.rel?.includes('summary') && l.rel?.includes('desktop'));
        return summaryLink?.href || null;
    };

    try {
        const scores = [];

        // Fetch NFL (Eagles) scores - check both regular season and playoffs
        try {
            // Try playoff schedule first, then regular season
            let recentEaglesGame = null;

            // Check playoff games (seasontype=3)
            const playoffRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule?seasontype=3');
            const playoffData = await playoffRes.json();
            const playoffGames = playoffData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
            if (playoffGames.length > 0) {
                recentEaglesGame = playoffGames[playoffGames.length - 1];
            }

            // If no playoff games, check regular season (seasontype=2)
            if (!recentEaglesGame) {
                const regRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule?seasontype=2');
                const regData = await regRes.json();
                const regGames = regData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
                if (regGames.length > 0) {
                    recentEaglesGame = regGames[regGames.length - 1];
                }
            }
            if (recentEaglesGame) {
                const comp = recentEaglesGame.competitions[0];
                const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
                const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
                scores.push({
                    sport: 'NFL',
                    team: 'Eagles',
                    teamColor: '#004C54',
                    homeTeam: homeTeam?.team?.shortDisplayName || 'Home',
                    homeScore: getScore(homeTeam?.score),
                    awayTeam: awayTeam?.team?.shortDisplayName || 'Away',
                    awayScore: getScore(awayTeam?.score),
                    isHome: homeTeam?.team?.abbreviation === 'PHI',
                    date: recentEaglesGame.date,
                    link: getGameLink(recentEaglesGame)
                });
            }
        } catch (e) { console.error('NFL fetch error:', e); }

        // Fetch NBA (76ers) scores
        try {
            const nbaRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/schedule');
            const nbaData = await nbaRes.json();
            const sixersGames = nbaData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
            const recentSixersGame = sixersGames[sixersGames.length - 1];
            if (recentSixersGame) {
                const comp = recentSixersGame.competitions[0];
                const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
                const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
                scores.push({
                    sport: 'NBA',
                    team: '76ers',
                    teamColor: '#006BB6',
                    homeTeam: homeTeam?.team?.shortDisplayName || 'Home',
                    homeScore: getScore(homeTeam?.score),
                    awayTeam: awayTeam?.team?.shortDisplayName || 'Away',
                    awayScore: getScore(awayTeam?.score),
                    isHome: homeTeam?.team?.abbreviation === 'PHI',
                    date: recentSixersGame.date,
                    link: getGameLink(recentSixersGame)
                });
            }
        } catch (e) { console.error('NBA fetch error:', e); }

        // Fetch NHL (Flyers) scores
        try {
            const nhlRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/schedule');
            const nhlData = await nhlRes.json();
            const flyersGames = nhlData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
            const recentFlyersGame = flyersGames[flyersGames.length - 1];
            if (recentFlyersGame) {
                const comp = recentFlyersGame.competitions[0];
                const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
                const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
                scores.push({
                    sport: 'NHL',
                    team: 'Flyers',
                    teamColor: '#F74902',
                    homeTeam: homeTeam?.team?.shortDisplayName || 'Home',
                    homeScore: getScore(homeTeam?.score),
                    awayTeam: awayTeam?.team?.shortDisplayName || 'Away',
                    awayScore: getScore(awayTeam?.score),
                    isHome: homeTeam?.team?.abbreviation === 'PHI',
                    date: recentFlyersGame.date,
                    link: getGameLink(recentFlyersGame)
                });
            }
        } catch (e) { console.error('NHL fetch error:', e); }

        // Fetch MLB (Phillies) scores
        try {
            const mlbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/schedule');
            const mlbData = await mlbRes.json();
            const philliesGames = mlbData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
            const recentPhilliesGame = philliesGames[philliesGames.length - 1];
            if (recentPhilliesGame) {
                const comp = recentPhilliesGame.competitions[0];
                const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
                const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
                scores.push({
                    sport: 'MLB',
                    team: 'Phillies',
                    teamColor: '#E81828',
                    homeTeam: homeTeam?.team?.shortDisplayName || 'Home',
                    homeScore: getScore(homeTeam?.score),
                    awayTeam: awayTeam?.team?.shortDisplayName || 'Away',
                    awayScore: getScore(awayTeam?.score),
                    isHome: homeTeam?.team?.abbreviation === 'PHI',
                    date: recentPhilliesGame.date,
                    link: getGameLink(recentPhilliesGame)
                });
            }
        } catch (e) { console.error('MLB fetch error:', e); }

        // Fetch MLS (Union) scores
        try {
            const mlsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/schedule');
            const mlsData = await mlsRes.json();
            const unionGames = mlsData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
            const recentUnionGame = unionGames[unionGames.length - 1];
            if (recentUnionGame) {
                const comp = recentUnionGame.competitions[0];
                const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
                const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
                scores.push({
                    sport: 'MLS',
                    team: 'Union',
                    teamColor: '#B49759',
                    homeTeam: homeTeam?.team?.shortDisplayName || 'Home',
                    homeScore: getScore(homeTeam?.score),
                    awayTeam: awayTeam?.team?.shortDisplayName || 'Away',
                    awayScore: getScore(awayTeam?.score),
                    isHome: homeTeam?.team?.displayName?.includes('Philadelphia'),
                    date: recentUnionGame.date,
                    link: getGameLink(recentUnionGame)
                });
            }
        } catch (e) { console.error('MLS fetch error:', e); }

        // Filter by team if specified
        let filteredScores = scores;
        if (teamFilter) {
            const teamMap = {
                'eagles': 'Eagles',
                'phillies': 'Phillies',
                'sixers': '76ers',
                '76ers': '76ers',
                'flyers': 'Flyers',
                'union': 'Union'
            };
            const targetTeam = teamMap[teamFilter];
            if (targetTeam) {
                filteredScores = scores.filter(s => s.team === targetTeam);
            }
        }

        res.status(200).json({ scores: filteredScores, updated: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch scores', message: error.message });
    }
}
