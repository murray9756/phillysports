// Vercel Serverless Function - Fetch College Basketball Conference Standings
// Uses SportsDataIO for college basketball data

import { getCurrentSeason, COLLEGE_TEAMS } from '../lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// Conference mapping for each team
const TEAM_CONFERENCES = {
    'villanova': { conference: 'Big East', confAbbr: 'BIG-EAST' },
    'penn': { conference: 'Ivy League', confAbbr: 'IVY' },
    'lasalle': { conference: 'Atlantic 10', confAbbr: 'A-10' },
    'drexel': { conference: 'CAA', confAbbr: 'CAA' },
    'stjosephs': { conference: 'Atlantic 10', confAbbr: 'A-10' },
    'temple': { conference: 'AAC', confAbbr: 'AAC' }
};

// Team colors for display
const TEAM_COLORS = {
    'villanova': '#003366',
    'penn': '#011F5B',
    'lasalle': '#00833E',
    'drexel': '#07294D',
    'stjosephs': '#9E1B32',
    'temple': '#9D2235'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { team } = req.query;

    if (!team) {
        return res.status(400).json({ error: 'Team parameter required' });
    }

    const teamKey = team.toLowerCase();
    const confInfo = TEAM_CONFERENCES[teamKey];

    if (!confInfo) {
        return res.status(400).json({
            error: 'Invalid team. Valid options: villanova, penn, lasalle, drexel, stjosephs, temple'
        });
    }

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const season = getCurrentSeason('NCAAB');
        const teamAbbr = COLLEGE_TEAMS[teamKey]?.id || teamKey.toUpperCase();

        // Fetch standings from SportsDataIO
        const url = `https://api.sportsdata.io/v3/cbb/scores/json/Standings/${season}?key=${SPORTSDATA_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`SportsDataIO API error: ${response.status}`);
        }

        const allStandings = await response.json();

        // Filter to teams in the same conference
        const conferenceStandings = allStandings.filter(
            team => team.Conference === confInfo.conference ||
                   team.ConferenceAbbreviation === confInfo.confAbbr
        );

        const standings = conferenceStandings.map(team => ({
            rank: team.ConferenceRank || 0,
            teamId: team.TeamID?.toString(),
            teamName: team.School || team.Name,
            teamAbbr: team.Key,
            teamLogo: null, // SportsDataIO doesn't include logos, could use ESPN CDN
            wins: team.Wins || 0,
            losses: team.Losses || 0,
            confWins: team.ConferenceWins || 0,
            confLosses: team.ConferenceLosses || 0,
            winPct: team.Percentage ? (team.Percentage * 100).toFixed(1) + '%' : '0%',
            streak: formatStreak(team),
            isHighlighted: team.Key === teamAbbr
        }));

        // Sort by conference wins (descending), then overall wins
        standings.sort((a, b) => {
            if (a.confWins !== b.confWins) return b.confWins - a.confWins;
            if (a.confLosses !== b.confLosses) return a.confLosses - b.confLosses;
            return b.wins - a.wins;
        });

        // Update rank after sorting
        standings.forEach((team, index) => {
            team.rank = index + 1;
        });

        res.status(200).json({
            conference: confInfo.conference,
            team: teamKey,
            teamColor: TEAM_COLORS[teamKey],
            standings: standings,
            updated: new Date().toISOString(),
            source: 'sportsdata'
        });
    } catch (error) {
        console.error('Standings fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch standings', message: error.message });
    }
}

function formatStreak(team) {
    if (!team.Streak) return '-';
    const wins = team.Streak > 0;
    return `${wins ? 'W' : 'L'}${Math.abs(team.Streak)}`;
}
