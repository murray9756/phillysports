// Highlights API - fetches YouTube videos for game highlights
// Can be enhanced with YouTube Data API key for better results

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { q: query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Search query required' });
    }

    try {
        // Check if YouTube API key is configured
        const youtubeApiKey = process.env.YOUTUBE_API_KEY;

        if (youtubeApiKey) {
            // Use YouTube Data API to search for videos
            const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
            searchUrl.searchParams.set('key', youtubeApiKey);
            searchUrl.searchParams.set('q', query);
            searchUrl.searchParams.set('part', 'snippet');
            searchUrl.searchParams.set('type', 'video');
            searchUrl.searchParams.set('maxResults', '12');
            searchUrl.searchParams.set('order', 'relevance');
            searchUrl.searchParams.set('videoEmbeddable', 'true');

            const response = await fetch(searchUrl.toString());

            if (!response.ok) {
                throw new Error('YouTube API error');
            }

            const data = await response.json();

            const videos = data.items.map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
                channel: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt
            }));

            return res.status(200).json({
                videos,
                source: 'youtube_api',
                query
            });
        } else {
            // No API key - return empty to trigger frontend fallback
            return res.status(503).json({
                error: 'YouTube API not configured',
                message: 'Please use embedded YouTube search',
                videos: []
            });
        }
    } catch (error) {
        console.error('Highlights API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch highlights',
            message: error.message
        });
    }
}
