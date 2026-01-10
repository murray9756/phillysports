// Vercel Serverless Function - Fetch Philly Sports Scores
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Helper to extract score value (ESPN API sometimes returns objects)
    const getScore = (score) => {
        if (typeof score === 'object' && score !== null) {
            return String(score.displayValue || score.value || '0');
        }
        return String(score || '0');
    };

    try {
        const scores = [];

        // Fetch NFL (Eagles) scores
        try {
            const nflRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/schedule');
            const nflData = await nflRes.json();
            const eaglesGames = nflData.events?.filter(e => e.competitions?.[0]?.status?.type?.completed) || [];
            const recentEaglesGame = eaglesGames[eaglesGames.length - 1];
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
                    date: recentEaglesGame.date
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
                    date: recentSixersGame.date
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
                    date: recentFlyersGame.date
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
                    date: recentPhilliesGame.date
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
                    date: recentUnionGame.date
                });
            }
        } catch (e) { console.error('MLS fetch error:', e); }

        res.status(200).json({ scores, updated: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch scores', message: error.message });
    }
}
