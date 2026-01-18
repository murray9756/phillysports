// oEmbed Utility for TikTok and YouTube
// Fetches embed HTML for video URLs

/**
 * Detect the platform from a URL
 */
export function detectPlatform(url) {
    if (!url) return null;

    const urlLower = url.toLowerCase();

    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('instagram.com')) return 'instagram';

    return null;
}

/**
 * Fetch oEmbed data for TikTok
 */
async function fetchTikTokEmbed(url) {
    try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);

        if (!response.ok) {
            throw new Error(`TikTok oEmbed failed: ${response.status}`);
        }

        const data = await response.json();

        return {
            platform: 'tiktok',
            embedHtml: data.html,
            title: data.title,
            authorName: data.author_name,
            authorUrl: data.author_url,
            thumbnailUrl: data.thumbnail_url,
            thumbnailWidth: data.thumbnail_width,
            thumbnailHeight: data.thumbnail_height,
            width: data.width,
            height: data.height
        };
    } catch (error) {
        console.error('TikTok oEmbed error:', error);
        return null;
    }
}

/**
 * Fetch oEmbed data for YouTube
 */
async function fetchYouTubeEmbed(url) {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oembedUrl);

        if (!response.ok) {
            throw new Error(`YouTube oEmbed failed: ${response.status}`);
        }

        const data = await response.json();

        return {
            platform: 'youtube',
            embedHtml: data.html,
            title: data.title,
            authorName: data.author_name,
            authorUrl: data.author_url,
            thumbnailUrl: data.thumbnail_url,
            width: data.width,
            height: data.height
        };
    } catch (error) {
        console.error('YouTube oEmbed error:', error);
        return null;
    }
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url) {
    if (!url) return null;

    // Match youtube.com/watch?v=ID
    let match = url.match(/[?&]v=([^&]+)/);
    if (match) return match[1];

    // Match youtu.be/ID
    match = url.match(/youtu\.be\/([^?&]+)/);
    if (match) return match[1];

    // Match youtube.com/embed/ID
    match = url.match(/youtube\.com\/embed\/([^?&]+)/);
    if (match) return match[1];

    // Match youtube.com/shorts/ID
    match = url.match(/youtube\.com\/shorts\/([^?&]+)/);
    if (match) return match[1];

    return null;
}

/**
 * Extract TikTok video ID from URL
 */
export function extractTikTokId(url) {
    if (!url) return null;

    // Match tiktok.com/@user/video/ID
    const match = url.match(/video\/(\d+)/);
    if (match) return match[1];

    return null;
}

/**
 * Generate a responsive YouTube embed HTML
 */
export function generateYouTubeEmbed(videoId, options = {}) {
    const { width = '100%', height = 315, autoplay = false } = options;
    const autoplayParam = autoplay ? '?autoplay=1' : '';

    return `<div class="video-embed youtube-embed">
        <iframe
            width="${width}"
            height="${height}"
            src="https://www.youtube.com/embed/${videoId}${autoplayParam}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
    </div>`;
}

/**
 * Fetch oEmbed data for any supported platform
 */
export async function fetchOEmbed(url) {
    const platform = detectPlatform(url);

    if (!platform) {
        return { error: 'Unsupported platform' };
    }

    switch (platform) {
        case 'tiktok':
            return await fetchTikTokEmbed(url);
        case 'youtube':
            return await fetchYouTubeEmbed(url);
        default:
            return { error: 'Platform not implemented' };
    }
}

/**
 * Get thumbnail URL for a video
 */
export function getVideoThumbnail(url) {
    const platform = detectPlatform(url);

    if (platform === 'youtube') {
        const videoId = extractYouTubeId(url);
        if (videoId) {
            // YouTube provides predictable thumbnail URLs
            return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    }

    // For TikTok, we need to fetch via oEmbed (no predictable URL)
    return null;
}
