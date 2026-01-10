// Vercel Serverless Function - Fetch Philly Sports News
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const articles = [];

        // Fetch Eagles news
        try {
            const nflRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi/news');
            const nflData = await nflRes.json();
            (nflData.articles || []).slice(0, 3).forEach(article => {
                articles.push({
                    team: 'Eagles',
                    sport: 'NFL',
                    teamColor: '#004C54',
                    tagClass: 'tag-eagles',
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published
                });
            });
        } catch (e) { console.error('Eagles news error:', e); }

        // Fetch Phillies news
        try {
            const mlbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/phi/news');
            const mlbData = await mlbRes.json();
            (mlbData.articles || []).slice(0, 3).forEach(article => {
                articles.push({
                    team: 'Phillies',
                    sport: 'MLB',
                    teamColor: '#E81828',
                    tagClass: 'tag-phillies',
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published
                });
            });
        } catch (e) { console.error('Phillies news error:', e); }

        // Fetch 76ers news
        try {
            const nbaRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/phi/news');
            const nbaData = await nbaRes.json();
            (nbaData.articles || []).slice(0, 3).forEach(article => {
                articles.push({
                    team: '76ers',
                    sport: 'NBA',
                    teamColor: '#006BB6',
                    tagClass: 'tag-sixers',
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published
                });
            });
        } catch (e) { console.error('76ers news error:', e); }

        // Fetch Flyers news
        try {
            const nhlRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/phi/news');
            const nhlData = await nhlRes.json();
            (nhlData.articles || []).slice(0, 3).forEach(article => {
                articles.push({
                    team: 'Flyers',
                    sport: 'NHL',
                    teamColor: '#F74902',
                    tagClass: 'tag-flyers',
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published
                });
            });
        } catch (e) { console.error('Flyers news error:', e); }

        // Fetch Union news
        try {
            const mlsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/phi/news');
            const mlsData = await mlsRes.json();
            (mlsData.articles || []).slice(0, 2).forEach(article => {
                articles.push({
                    team: 'Union',
                    sport: 'MLS',
                    teamColor: '#B49759',
                    tagClass: 'tag-union',
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published
                });
            });
        } catch (e) { console.error('Union news error:', e); }

        // Sort by published date (newest first)
        articles.sort((a, b) => new Date(b.published) - new Date(a.published));

        res.status(200).json({
            articles: articles.slice(0, 10),
            featured: articles[0] || null,
            updated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news', message: error.message });
    }
}
