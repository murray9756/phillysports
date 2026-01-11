import { createResponse, createOptionsResponse } from '../lib/utils.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return createOptionsResponse();
    }

    if (req.method !== 'GET') {
        return createResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings');
        const data = await response.json();

        // Find NL East division
        let nlEast = null;
        for (const group of data.children || []) {
            for (const division of group.children || []) {
                if (division.name === 'National League East') {
                    nlEast = division.standings?.entries || [];
                    break;
                }
            }
            if (nlEast) break;
        }

        if (nlEast && nlEast.length > 0) {
            const standings = nlEast.map(entry => {
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
            return createResponse({ standings, division: 'NL East' });
        }

        return createResponse({ error: 'No standings data available' }, 404);
    } catch (error) {
        console.error('MLB standings error:', error);
        return createResponse({ error: 'Failed to fetch standings' }, 500);
    }
}
