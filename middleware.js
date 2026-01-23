// Vercel Edge Middleware - Block bot traffic from specific regions
// Runs at the edge before requests reach your site

// Countries to block (ISO 3166-1 alpha-2 codes)
const BLOCKED_COUNTRIES = new Set([
    'CN', // China
    'RU', // Russia (common source of bot traffic)
]);

export default function middleware(request) {
    // Get country from Vercel's geo data
    const country = request.headers.get('x-vercel-ip-country');

    // Block traffic from specified countries
    if (country && BLOCKED_COUNTRIES.has(country)) {
        return new Response('Access denied', { status: 403 });
    }

    // Allow all other traffic
    return;
}

export const config = {
    // Apply to all routes
    matcher: '/(.*)',
};
