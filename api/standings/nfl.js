import { createResponse, createOptionsResponse } from '../lib/utils.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return createOptionsResponse();
    }

    if (req.method !== 'GET') {
        return createResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/standings');
        const data = await response.json();

        // Find NFC East division
        let nfcEast = null;
        for (const group of data.children || []) {
            for (const division of group.children || []) {
                if (division.name === 'NFC East') {
                    nfcEast = division.standings?.entries || [];
                    break;
                }
            }
            if (nfcEast) break;
        }

        if (nfcEast && nfcEast.length > 0) {
            const standings = nfcEast.map(entry => {
                const team = entry.team;
                const stats = entry.stats || [];
                const wins = stats.find(s => s.name === 'wins')?.value || 0;
                const losses = stats.find(s => s.name === 'losses')?.value || 0;
                const pct = stats.find(s => s.name === 'winPercent')?.value || 0;
                return {
                    abbreviation: team.abbreviation,
                    name: team.displayName,
                    wins,
                    losses,
                    pct
                };
            });
            return createResponse({ standings, division: 'NFC East' });
        }

        return createResponse({ error: 'No standings data available' }, 404);
    } catch (error) {
        console.error('NFL standings error:', error);
        return createResponse({ error: 'Failed to fetch standings' }, 500);
    }
}
