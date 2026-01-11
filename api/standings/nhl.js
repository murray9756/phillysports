import { createResponse, createOptionsResponse } from '../lib/utils.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return createOptionsResponse();
    }

    if (req.method !== 'GET') {
        return createResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings');
        const data = await response.json();

        // Find Metropolitan division
        let metro = null;
        for (const group of data.children || []) {
            for (const division of group.children || []) {
                if (division.name === 'Metropolitan') {
                    metro = division.standings?.entries || [];
                    break;
                }
            }
            if (metro) break;
        }

        if (metro && metro.length > 0) {
            const standings = metro.map(entry => {
                const team = entry.team;
                const stats = entry.stats || [];
                const wins = stats.find(s => s.name === 'wins')?.value || 0;
                const losses = stats.find(s => s.name === 'losses')?.value || 0;
                const otLosses = stats.find(s => s.name === 'otLosses')?.value || 0;
                const points = stats.find(s => s.name === 'points')?.value || 0;
                return {
                    abbreviation: team.abbreviation,
                    name: team.displayName,
                    wins,
                    losses,
                    otLosses,
                    points
                };
            });
            return createResponse({ standings, division: 'Metropolitan' });
        }

        return createResponse({ error: 'No standings data available' }, 404);
    } catch (error) {
        console.error('NHL standings error:', error);
        return createResponse({ error: 'Failed to fetch standings' }, 500);
    }
}
