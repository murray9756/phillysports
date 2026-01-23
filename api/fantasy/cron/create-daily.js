// Cron Job - Create Daily Fantasy Contests from Templates
// Called by Vercel Cron or external scheduler
import { getCollection } from '../../lib/mongodb.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const SPORTSDATA_ENDPOINTS = {
    NFL: 'nfl',
    NBA: 'nba',
    MLB: 'mlb',
    NHL: 'nhl'
};

const ROSTER_POSITIONS = {
    NFL: [
        { position: 'QB', count: 1 },
        { position: 'RB', count: 2 },
        { position: 'WR', count: 3 },
        { position: 'TE', count: 1 },
        { position: 'FLEX', count: 1, eligible: ['RB', 'WR', 'TE'] },
        { position: 'DEF', count: 1, eligible: ['DEF', 'LB', 'DB', 'DL'] }
    ],
    NBA: [
        { position: 'PG', count: 1 },
        { position: 'SG', count: 1 },
        { position: 'SF', count: 1 },
        { position: 'PF', count: 1 },
        { position: 'C', count: 1 },
        { position: 'UTIL', count: 1, eligible: ['PG', 'SG', 'SF', 'PF', 'C'] }
    ],
    MLB: [
        { position: 'P', count: 2, eligible: ['SP', 'RP'] },
        { position: 'C', count: 1 },
        { position: '1B', count: 1 },
        { position: '2B', count: 1 },
        { position: '3B', count: 1 },
        { position: 'SS', count: 1 },
        { position: 'OF', count: 3 }
    ],
    NHL: [
        { position: 'C', count: 2 },
        { position: 'W', count: 3, eligible: ['LW', 'RW'] },
        { position: 'D', count: 2 },
        { position: 'G', count: 1 },
        { position: 'UTIL', count: 1, eligible: ['C', 'LW', 'RW', 'D'] }
    ]
};

export default async function handler(req, res) {
    // Verify cron secret for security
    const authHeader = req.headers.authorization;
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!SPORTSDATA_API_KEY) {
        return res.status(500).json({ error: 'SportsDataIO API key not configured' });
    }

    try {
        const templatesCollection = await getCollection('fantasy_templates');
        const contestsCollection = await getCollection('fantasy_contests');

        // Get today's date in Eastern Time
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        // Get active daily templates
        const templates = await templatesCollection.find({
            active: true,
            schedule: 'daily'
        }).toArray();

        const results = [];

        for (const template of templates) {
            // Check if already created today
            if (template.lastCreated === today) {
                results.push({ template: template.name, status: 'skipped', reason: 'Already created today' });
                continue;
            }

            // Check if there are games for this sport today
            const endpoint = SPORTSDATA_ENDPOINTS[template.sport];
            const gamesUrl = `https://api.sportsdata.io/v3/${endpoint}/scores/json/GamesByDate/${today}?key=${SPORTSDATA_API_KEY}`;

            try {
                const gamesResponse = await fetch(gamesUrl);
                if (!gamesResponse.ok) {
                    results.push({ template: template.name, status: 'error', reason: 'Failed to fetch games' });
                    continue;
                }

                const gamesData = await gamesResponse.json();

                if (!gamesData || gamesData.length === 0) {
                    results.push({ template: template.name, status: 'skipped', reason: 'No games today' });
                    continue;
                }

                // Get game IDs and times
                const gameIds = gamesData.map(g => (g.GameID || g.ScoreID)?.toString());
                const gameTimes = gamesData
                    .map(g => {
                        const dt = g.DateTime || g.Day;
                        if (!dt) return null;
                        if (!dt.includes('Z') && !dt.includes('+') && !dt.includes('-', 10)) {
                            return new Date(dt + '-05:00');
                        }
                        return new Date(dt);
                    })
                    .filter(d => d && !isNaN(d.getTime()))
                    .sort((a, b) => a - b);

                const earliestGame = gameTimes[0] || new Date(today + 'T18:00:00-05:00');
                const latestGame = gameTimes[gameTimes.length - 1] || earliestGame;

                // Create contest
                const contest = {
                    sport: template.sport,
                    title: `${template.name} - ${today}`,
                    gameDate: new Date(today + 'T12:00:00-05:00'),
                    gameDateString: today,
                    gameIds,
                    salaryCap: 45000,
                    rosterPositions: ROSTER_POSITIONS[template.sport],
                    entryFee: template.entryFee,
                    maxEntries: 3,
                    maxTotalEntries: 1000,
                    status: 'upcoming',
                    entryCount: 0,
                    createdAt: new Date(),
                    locksAt: earliestGame,
                    endsAt: latestGame,
                    isAutoGenerated: true,
                    templateId: template._id
                };

                await contestsCollection.insertOne(contest);

                // Update template lastCreated
                await templatesCollection.updateOne(
                    { _id: template._id },
                    { $set: { lastCreated: today } }
                );

                results.push({ template: template.name, status: 'created', contestTitle: contest.title });
            } catch (e) {
                results.push({ template: template.name, status: 'error', reason: e.message });
            }
        }

        return res.status(200).json({
            success: true,
            date: today,
            results
        });
    } catch (error) {
        console.error('Cron create-daily error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
