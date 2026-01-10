// Vercel Serverless Function - Fetch Philly Sports News
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Get team filter from query params
    const { team } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;

    // Philly team identifiers to filter news
    const phillyKeywords = ['philadelphia', 'eagles', 'phillies', '76ers', 'sixers', 'flyers', 'union', 'philly', 'jalen hurts', 'saquon', 'embiid', 'maxey'];

    // Parse RSS XML to extract items
    function parseRSS(xml) {
        const items = [];
        const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

        for (const itemXml of itemMatches) {
            const getTag = (tag) => {
                const match = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
                return match ? (match[1] || match[2] || '').trim() : '';
            };

            const categories = [];
            const catMatches = itemXml.match(/<category[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g) || [];
            catMatches.forEach(cat => {
                const val = cat.replace(/<\/?category[^>]*>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                if (val) categories.push(val.toLowerCase());
            });

            // Extract image from content:encoded or media:content
            let image = null;
            const imgMatch = itemXml.match(/<img[^>]+src=["']([^"']+)["']/);
            if (imgMatch) image = imgMatch[1];
            const mediaMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/);
            if (mediaMatch && !image) image = mediaMatch[1];

            items.push({
                title: getTag('title'),
                link: getTag('link'),
                description: getTag('description').replace(/<[^>]+>/g, '').substring(0, 200),
                pubDate: getTag('pubDate'),
                categories,
                image
            });
        }
        return items;
    }

    // Detect team from Crossing Broad categories or content
    function detectTeamFromRSS(item) {
        const text = `${item.title} ${item.categories.join(' ')}`.toLowerCase();
        if (text.includes('eagle') || text.includes('nfl') || text.includes('birds')) return { team: 'Eagles', color: '#004C54', tagClass: 'tag-eagles' };
        if (text.includes('phillie') || text.includes('mlb')) return { team: 'Phillies', color: '#E81828', tagClass: 'tag-phillies' };
        if (text.includes('sixer') || text.includes('76er') || text.includes('nba')) return { team: '76ers', color: '#006BB6', tagClass: 'tag-sixers' };
        if (text.includes('flyer') || text.includes('nhl')) return { team: 'Flyers', color: '#F74902', tagClass: 'tag-flyers' };
        if (text.includes('union') || text.includes('mls') || text.includes('soccer')) return { team: 'Union', color: '#B49759', tagClass: 'tag-union' };
        return { team: 'Philly', color: '#004C54', tagClass: 'tag-eagles' };
    }

    function isPhillyRelated(article) {
        const text = `${article.headline} ${article.description || ''} ${JSON.stringify(article.categories || [])}`.toLowerCase();
        return phillyKeywords.some(keyword => text.includes(keyword));
    }

    function processArticles(data, team, sport, teamColor, tagClass, limit = 5) {
        const results = [];
        const articleList = data.articles || [];

        for (const article of articleList) {
            if (results.length >= limit) break;

            // For NFL/NBA/etc we filter for Philly, for general we take all
            if (team === 'All' || isPhillyRelated(article)) {
                results.push({
                    team: team === 'All' ? detectTeam(article) : team,
                    sport,
                    teamColor: team === 'All' ? detectColor(article) : teamColor,
                    tagClass: team === 'All' ? detectTagClass(article) : tagClass,
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || article.links?.mobile?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published || new Date().toISOString()
                });
            }
        }
        return results;
    }

    function detectTeam(article) {
        const text = `${article.headline} ${article.description || ''}`.toLowerCase();
        if (text.includes('eagle') || text.includes('jalen hurts') || text.includes('saquon')) return 'Eagles';
        if (text.includes('phillie') || text.includes('harper')) return 'Phillies';
        if (text.includes('76er') || text.includes('sixer') || text.includes('embiid') || text.includes('maxey')) return '76ers';
        if (text.includes('flyer')) return 'Flyers';
        if (text.includes('union')) return 'Union';
        return 'NFL';
    }

    function detectColor(article) {
        const team = detectTeam(article);
        const colors = { Eagles: '#004C54', Phillies: '#E81828', '76ers': '#006BB6', Flyers: '#F74902', Union: '#B49759' };
        return colors[team] || '#666666';
    }

    function detectTagClass(article) {
        const team = detectTeam(article);
        const classes = { Eagles: 'tag-eagles', Phillies: 'tag-phillies', '76ers': 'tag-sixers', Flyers: 'tag-flyers', Union: 'tag-union' };
        return classes[team] || 'tag-eagles';
    }

    try {
        const articles = [];

        // Fetch NFL news (filter for Eagles)
        try {
            const nflRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50');
            const nflData = await nflRes.json();
            articles.push(...processArticles(nflData, 'Eagles', 'NFL', '#004C54', 'tag-eagles', 4));
        } catch (e) { console.error('NFL news error:', e); }

        // Fetch NBA news (filter for 76ers)
        try {
            const nbaRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50');
            const nbaData = await nbaRes.json();
            articles.push(...processArticles(nbaData, '76ers', 'NBA', '#006BB6', 'tag-sixers', 3));
        } catch (e) { console.error('NBA news error:', e); }

        // Fetch MLB news (filter for Phillies)
        try {
            const mlbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=50');
            const mlbData = await mlbRes.json();
            articles.push(...processArticles(mlbData, 'Phillies', 'MLB', '#E81828', 'tag-phillies', 3));
        } catch (e) { console.error('MLB news error:', e); }

        // Fetch NHL news (filter for Flyers)
        try {
            const nhlRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news?limit=50');
            const nhlData = await nhlRes.json();
            articles.push(...processArticles(nhlData, 'Flyers', 'NHL', '#F74902', 'tag-flyers', 3));
        } catch (e) { console.error('NHL news error:', e); }

        // Fetch MLS news (filter for Union)
        try {
            const mlsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/news?limit=30');
            const mlsData = await mlsRes.json();
            articles.push(...processArticles(mlsData, 'Union', 'MLS', '#B49759', 'tag-union', 2));
        } catch (e) { console.error('MLS news error:', e); }

        // Fetch Crossing Broad RSS feed
        try {
            const cbRes = await fetch('https://www.crossingbroad.com/feed');
            const cbXml = await cbRes.text();
            const cbItems = parseRSS(cbXml);

            cbItems.slice(0, 6).forEach(item => {
                const teamInfo = detectTeamFromRSS(item);
                articles.push({
                    team: teamInfo.team,
                    sport: 'Crossing Broad',
                    teamColor: teamInfo.color,
                    tagClass: teamInfo.tagClass,
                    headline: item.title,
                    description: item.description,
                    link: item.link,
                    image: item.image,
                    published: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    source: 'Crossing Broad'
                });
            });
        } catch (e) { console.error('Crossing Broad RSS error:', e); }

        // Sort by published date (newest first)
        articles.sort((a, b) => new Date(b.published) - new Date(a.published));

        // If we didn't find enough Philly-specific news, pad with general NFL news
        if (articles.length < 5) {
            try {
                const nflRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=10');
                const nflData = await nflRes.json();
                const generalNews = (nflData.articles || []).slice(0, 5 - articles.length).map(article => ({
                    team: 'NFL',
                    sport: 'NFL',
                    teamColor: '#013369',
                    tagClass: 'tag-eagles',
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published
                }));
                articles.push(...generalNews);
            } catch (e) { console.error('Fallback news error:', e); }
        }

        // Filter by team if specified
        let filteredArticles = articles;
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
                filteredArticles = articles.filter(a => a.team === targetTeam);
            }
        }

        res.status(200).json({
            articles: filteredArticles.slice(0, 12),
            featured: filteredArticles[0] || null,
            updated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news', message: error.message });
    }
}
