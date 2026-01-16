// Vercel Serverless Function - Fetch Philly Sports News
import { getCollection } from './lib/mongodb.js';
import crypto from 'crypto';

// Generate a stable article ID from its link
function generateArticleId(link) {
    return crypto.createHash('md5').update(link || '').digest('hex').substring(0, 12);
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Get team filter from query params
    const { team } = req.query;
    const teamFilter = team ? team.toLowerCase() : null;

    // Philly team identifiers to filter news
    const phillyKeywords = ['philadelphia', 'eagles', 'phillies', '76ers', 'sixers', 'flyers', 'union', 'philly', 'jalen hurts', 'saquon', 'embiid', 'maxey', 'fusion'];

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
        // eSports detection
        if (text.includes('philadelphia fusion') || text.includes('philly fusion')) return { team: 'Fusion', color: '#FFA000', tagClass: 'tag-fusion' };
        if (text.includes('esport') || text.includes('e-sport') || text.includes('league of legends') || text.includes('valorant') || text.includes('overwatch') || text.includes('counter-strike') || text.includes('cs2') || text.includes('dota')) return { team: 'eSports', color: '#9146FF', tagClass: 'tag-esports' };
        // Youth Sports detection
        if (text.includes('youth') || text.includes('sandlot') || text.includes('little league') || text.includes('high school') || text.includes('middle school') || text.includes('pee wee') || text.includes('rec league')) return { team: 'Youth Sports', color: '#00A4E8', tagClass: 'tag-youth' };
        // College Basketball detection (Philly Big 5 + Drexel)
        if (text.includes('villanova') || (text.includes('wildcats') && text.includes('basketball'))) return { team: 'Villanova', color: '#003366', tagClass: 'tag-villanova' };
        if ((text.includes('penn ') || text.includes('upenn') || text.includes('quakers')) && !text.includes('penn state')) return { team: 'Penn', color: '#011F5B', tagClass: 'tag-penn' };
        if (text.includes('la salle') || text.includes('lasalle') || text.includes('explorers')) return { team: 'La Salle', color: '#00833E', tagClass: 'tag-lasalle' };
        if (text.includes('drexel') || (text.includes('dragons') && text.includes('basketball'))) return { team: 'Drexel', color: '#07294D', tagClass: 'tag-drexel' };
        if (text.includes('st. joseph') || text.includes('saint joseph') || text.includes('st joseph') || (text.includes('hawks') && text.includes('basketball'))) return { team: 'St. Josephs', color: '#9E1B32', tagClass: 'tag-stjosephs' };
        if (text.includes('temple') || (text.includes('owls') && text.includes('basketball'))) return { team: 'Temple', color: '#9D2235', tagClass: 'tag-temple' };
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
        if (text.includes('philadelphia fusion') || text.includes('philly fusion')) return 'Fusion';
        if (text.includes('esport') || text.includes('league of legends') || text.includes('valorant') || text.includes('overwatch')) return 'eSports';
        return 'NFL';
    }

    function detectColor(article) {
        const team = detectTeam(article);
        const colors = { Eagles: '#004C54', Phillies: '#E81828', '76ers': '#006BB6', Flyers: '#F74902', Union: '#B49759', eSports: '#9146FF', Fusion: '#FFA000' };
        return colors[team] || '#666666';
    }

    function detectTagClass(article) {
        const team = detectTeam(article);
        const classes = { Eagles: 'tag-eagles', Phillies: 'tag-phillies', '76ers': 'tag-sixers', Flyers: 'tag-flyers', Union: 'tag-union', eSports: 'tag-esports', Fusion: 'tag-fusion' };
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

        // Fetch eSports news (only when esports filter is active)
        if (teamFilter === 'esports') {
            // ESPN Esports API
            try {
                const esportsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/esports/news?limit=30');
                const esportsData = await esportsRes.json();
                const esportsArticles = (esportsData.articles || []).slice(0, 5).map(article => {
                    const text = `${article.headline} ${article.description || ''}`.toLowerCase();
                    const isFusion = text.includes('fusion') || text.includes('philadelphia');
                    return {
                        team: isFusion ? 'Fusion' : 'eSports',
                        sport: 'eSports',
                        teamColor: isFusion ? '#FFA000' : '#9146FF',
                        tagClass: isFusion ? 'tag-fusion' : 'tag-esports',
                        headline: article.headline,
                        description: article.description || '',
                        link: article.links?.web?.href || article.links?.mobile?.href || '#',
                        image: article.images?.[0]?.url || null,
                        published: article.published || new Date().toISOString(),
                        source: 'ESPN Esports'
                    };
                });
                articles.push(...esportsArticles);
            } catch (e) { console.error('ESPN Esports news error:', e); }

            // Dot Esports RSS Feed
            try {
                const dotRes = await fetch('https://dotesports.com/feed');
                const dotXml = await dotRes.text();
                const dotItems = parseRSS(dotXml);

                dotItems.slice(0, 6).forEach(item => {
                    const text = `${item.title}`.toLowerCase();
                    const isFusion = text.includes('fusion') || text.includes('philadelphia');
                    articles.push({
                        team: isFusion ? 'Fusion' : 'eSports',
                        sport: 'eSports',
                        teamColor: isFusion ? '#FFA000' : '#9146FF',
                        tagClass: isFusion ? 'tag-fusion' : 'tag-esports',
                        headline: item.title,
                        description: item.description,
                        link: item.link,
                        image: item.image,
                        published: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                        source: 'Dot Esports'
                    });
                });
            } catch (e) { console.error('Dot Esports RSS error:', e); }

            // The Score Esports RSS Feed
            try {
                const scoreRes = await fetch('https://www.thescoreesports.com/feed/esports.rss');
                const scoreXml = await scoreRes.text();
                const scoreItems = parseRSS(scoreXml);

                scoreItems.slice(0, 5).forEach(item => {
                    const text = `${item.title}`.toLowerCase();
                    const isFusion = text.includes('fusion') || text.includes('philadelphia');
                    articles.push({
                        team: isFusion ? 'Fusion' : 'eSports',
                        sport: 'eSports',
                        teamColor: isFusion ? '#FFA000' : '#9146FF',
                        tagClass: isFusion ? 'tag-fusion' : 'tag-esports',
                        headline: item.title,
                        description: item.description,
                        link: item.link,
                        image: item.image,
                        published: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                        source: 'The Score Esports'
                    });
                });
            } catch (e) { console.error('The Score Esports RSS error:', e); }
        }

        // Fetch Youth Sports news (only when youth filter is active)
        if (teamFilter === 'youth') {
            // Buying Sandlot - Scrape from sitemap and post pages (beehiiv newsletter)
            try {
                // Fetch sitemap to get post URLs and dates
                const sitemapRes = await fetch('https://www.buyingsandlot.com/sitemap.xml');
                const sitemapXml = await sitemapRes.text();

                // Parse sitemap for post URLs and lastmod dates
                const postMatches = sitemapXml.matchAll(/<loc>(https:\/\/www\.buyingsandlot\.com\/p\/[^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g);
                const posts = [];
                for (const match of postMatches) {
                    posts.push({ url: match[1], date: match[2] });
                }

                // Sort by date (most recent first) and take top 15
                posts.sort((a, b) => new Date(b.date) - new Date(a.date));
                const recentPosts = posts.slice(0, 15);

                // Fetch metadata from each post page (in parallel, max 5 at a time)
                const fetchPostMeta = async (post) => {
                    try {
                        const postRes = await fetch(post.url);
                        const postHtml = await postRes.text();

                        // Extract meta tags
                        const titleMatch = postHtml.match(/<meta property="og:title" content="([^"]+)"/);
                        const descMatch = postHtml.match(/<meta property="og:description" content="([^"]+)"/);
                        const imageMatch = postHtml.match(/<meta property="og:image" content="([^"]+)"/);

                        if (titleMatch) {
                            return {
                                team: 'Youth Sports',
                                sport: 'Youth Sports',
                                teamColor: '#00A4E8',
                                tagClass: 'tag-youth',
                                headline: titleMatch[1],
                                description: descMatch ? descMatch[1] : '',
                                link: post.url,
                                image: imageMatch ? imageMatch[1] : null,
                                published: new Date(post.date).toISOString(),
                                source: 'Buying Sandlot'
                            };
                        }
                    } catch (e) { console.error('Post fetch error:', e); }
                    return null;
                };

                // Fetch posts in batches of 5
                for (let i = 0; i < recentPosts.length; i += 5) {
                    const batch = recentPosts.slice(i, i + 5);
                    const results = await Promise.all(batch.map(fetchPostMeta));
                    results.filter(r => r !== null).forEach(article => articles.push(article));
                }
            } catch (e) { console.error('Youth Sports scrape error:', e); }
        }

        // Fetch College Basketball news (Philly Big 5 + Drexel)
        const collegeTeams = ['villanova', 'penn', 'lasalle', 'drexel', 'stjosephs', 'temple'];
        if (collegeTeams.includes(teamFilter)) {
            const collegeTeamConfig = {
                'villanova': { name: 'Villanova', id: 2678, color: '#003366', mascot: 'wildcats' },
                'penn': { name: 'Penn', id: 219, color: '#011F5B', mascot: 'quakers' },
                'lasalle': { name: 'La Salle', id: 2325, color: '#00833E', mascot: 'explorers' },
                'drexel': { name: 'Drexel', id: 2182, color: '#07294D', mascot: 'dragons' },
                'stjosephs': { name: 'St. Josephs', id: 2603, color: '#9E1B32', mascot: 'hawks' },
                'temple': { name: 'Temple', id: 218, color: '#9D2235', mascot: 'owls' }
            };
            const config = collegeTeamConfig[teamFilter];

            // Fetch ESPN college basketball news
            try {
                const cbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/news?limit=50');
                const cbData = await cbRes.json();
                const cbArticles = (cbData.articles || []).filter(article => {
                    const text = `${article.headline} ${article.description || ''}`.toLowerCase();
                    return text.includes(teamFilter) || text.includes(config.name.toLowerCase()) || text.includes(config.mascot);
                }).slice(0, 8).map(article => ({
                    team: config.name,
                    sport: 'College Basketball',
                    teamColor: config.color,
                    tagClass: `tag-${teamFilter}`,
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || article.links?.mobile?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published || new Date().toISOString(),
                    source: 'ESPN College Basketball'
                }));
                articles.push(...cbArticles);
            } catch (e) { console.error('ESPN College Basketball news error:', e); }

            // Fetch team-specific ESPN news
            try {
                const teamRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${config.id}/news?limit=20`);
                const teamData = await teamRes.json();
                const teamArticles = (teamData.articles || []).slice(0, 10).map(article => ({
                    team: config.name,
                    sport: 'College Basketball',
                    teamColor: config.color,
                    tagClass: `tag-${teamFilter}`,
                    headline: article.headline,
                    description: article.description || '',
                    link: article.links?.web?.href || article.links?.mobile?.href || '#',
                    image: article.images?.[0]?.url || null,
                    published: article.published || new Date().toISOString(),
                    source: 'ESPN'
                }));
                articles.push(...teamArticles);
            } catch (e) { console.error(`ESPN ${config.name} news error:`, e); }
        }

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

        // Fetch PhillyVoice Sports RSS feed
        try {
            const pvRes = await fetch('https://www.phillyvoice.com/feed/section/sports/');
            const pvXml = await pvRes.text();
            const pvItems = parseRSS(pvXml);

            pvItems.slice(0, 5).forEach(item => {
                const teamInfo = detectTeamFromRSS(item);
                articles.push({
                    team: teamInfo.team,
                    sport: 'PhillyVoice',
                    teamColor: teamInfo.color,
                    tagClass: teamInfo.tagClass,
                    headline: item.title,
                    description: item.description,
                    link: item.link,
                    image: item.image,
                    published: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    source: 'PhillyVoice'
                });
            });
        } catch (e) { console.error('PhillyVoice RSS error:', e); }

        // Fetch On Pattison articles (scrape homepage)
        try {
            const opRes = await fetch('https://onpattison.com/');
            const opHtml = await opRes.text();

            // Extract article links and headlines from homepage
            const opArticles = [];
            const linkMatches = opHtml.matchAll(/<a href="(\/news\/[^"]+)"[^>]*class="black-link"[^>]*><h1[^>]*>([^<]+)<\/h1><\/a>/g);

            for (const match of linkMatches) {
                const link = 'https://onpattison.com' + match[1];
                const headline = match[2].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

                // Detect team from headline
                const teamInfo = detectTeamFromRSS({ title: headline, categories: [] });

                opArticles.push({
                    team: teamInfo.team,
                    sport: 'On Pattison',
                    teamColor: teamInfo.color,
                    tagClass: teamInfo.tagClass,
                    headline: headline,
                    description: '',
                    link: link,
                    image: null,
                    published: new Date().toISOString(),
                    source: 'On Pattison'
                });
            }

            // Add up to 5 unique articles
            const seenHeadlines = new Set();
            opArticles.slice(0, 8).forEach(article => {
                if (!seenHeadlines.has(article.headline)) {
                    seenHeadlines.add(article.headline);
                    articles.push(article);
                }
            });
        } catch (e) { console.error('On Pattison scrape error:', e); }

        // Fetch original posts from MongoDB
        try {
            const posts = await getCollection('posts');
            const publishedPosts = await posts.find({ status: 'published' })
                .sort({ publishedAt: -1 })
                .limit(10)
                .toArray();

            publishedPosts.forEach(post => {
                const teamColors = {
                    'Eagles': '#004C54',
                    'Phillies': '#E81828',
                    '76ers': '#006BB6',
                    'Flyers': '#F74902',
                    'Union': '#B49759'
                };
                const teamClasses = {
                    'Eagles': 'tag-eagles',
                    'Phillies': 'tag-phillies',
                    '76ers': 'tag-sixers',
                    'Flyers': 'tag-flyers',
                    'Union': 'tag-union'
                };

                articles.push({
                    team: post.team || 'Philly',
                    sport: 'Original',
                    teamColor: teamColors[post.team] || '#8b0000',
                    tagClass: teamClasses[post.team] || 'tag-eagles',
                    headline: post.title,
                    description: post.excerpt || '',
                    link: `/post.html?id=${post._id}`,
                    image: post.image,
                    published: post.publishedAt?.toISOString() || post.createdAt?.toISOString(),
                    source: 'PhillySports.com'
                });
            });
        } catch (e) { console.error('Posts fetch error:', e); }

        // Add article IDs to each article
        articles.forEach(article => {
            article.id = generateArticleId(article.link);
        });

        // Fetch vote counts from database
        const votes = await getCollection('news_votes');
        const articleIds = articles.map(a => a.id);

        // Get vote counts for all articles
        const votePipeline = [
            { $match: { articleId: { $in: articleIds } } },
            { $group: {
                _id: '$articleId',
                upvotes: { $sum: { $cond: [{ $eq: ['$vote', 1] }, 1, 0] } },
                downvotes: { $sum: { $cond: [{ $eq: ['$vote', -1] }, 1, 0] } }
            }}
        ];
        const voteResults = await votes.aggregate(votePipeline).toArray();
        const voteMap = {};
        voteResults.forEach(v => {
            voteMap[v._id] = { upvotes: v.upvotes, downvotes: v.downvotes, score: v.upvotes - v.downvotes };
        });

        // Add vote data to articles
        articles.forEach(article => {
            const voteData = voteMap[article.id] || { upvotes: 0, downvotes: 0, score: 0 };
            article.upvotes = voteData.upvotes;
            article.downvotes = voteData.downvotes;
            article.score = voteData.score;
        });

        // Sort by score (highest first), then by published date (newest first)
        articles.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return new Date(b.published) - new Date(a.published);
        });

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
                'union': 'Union',
                'esports': 'eSports',
                'fusion': 'Fusion',
                'youth': 'Youth Sports',
                'villanova': 'Villanova',
                'penn': 'Penn',
                'lasalle': 'La Salle',
                'drexel': 'Drexel',
                'stjosephs': 'St. Josephs',
                'temple': 'Temple'
            };
            const targetTeam = teamMap[teamFilter];
            if (targetTeam) {
                // For esports, include both eSports and Fusion articles
                if (teamFilter === 'esports') {
                    filteredArticles = articles.filter(a => a.team === 'eSports' || a.team === 'Fusion');
                } else if (teamFilter === 'youth') {
                    filteredArticles = articles.filter(a => a.team === 'Youth Sports');
                } else {
                    filteredArticles = articles.filter(a => a.team === targetTeam);
                }
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
