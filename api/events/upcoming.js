// Upcoming Events API
// GET /api/events/upcoming - Get upcoming events for widgets

import { getCollection } from '../lib/mongodb.js';
import { formatWatchParty, formatTailgate, TEAMS } from '../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { team, limit = 10 } = req.query;
        const now = new Date();
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 14); // Next 14 days

        const events = [];

        // Get upcoming watch parties
        const watchParties = await getCollection('watch_parties');
        const wpQuery = {
            status: { $ne: 'cancelled' },
            gameTime: { $gte: now, $lte: maxDate }
        };
        if (team && TEAMS.includes(team)) wpQuery.team = team;

        const wpResults = await watchParties.aggregate([
            { $match: wpQuery },
            { $sort: { gameTime: 1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'hostId',
                    foreignField: '_id',
                    as: 'hostInfo'
                }
            },
            { $unwind: { path: '$hostInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();

        wpResults.forEach(wp => {
            events.push({
                eventType: 'watch-party',
                eventDate: wp.gameTime,
                ...formatWatchParty(wp, wp.hostInfo ? {
                    userId: wp.hostInfo._id.toString(),
                    username: wp.hostInfo.username,
                    displayName: wp.hostInfo.displayName,
                    profilePhoto: wp.hostInfo.profilePhoto
                } : null)
            });
        });

        // Get upcoming tailgates
        const tailgates = await getCollection('tailgates');
        const tgQuery = {
            status: { $ne: 'cancelled' },
            'schedule.arrivalTime': { $gte: now, $lte: maxDate }
        };
        if (team && TEAMS.includes(team)) tgQuery.team = team;

        const tgResults = await tailgates.aggregate([
            { $match: tgQuery },
            { $sort: { 'schedule.arrivalTime': 1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'hostId',
                    foreignField: '_id',
                    as: 'hostInfo'
                }
            },
            { $unwind: { path: '$hostInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();

        tgResults.forEach(tg => {
            events.push({
                eventType: 'tailgate',
                eventDate: tg.schedule.arrivalTime,
                ...formatTailgate(tg, tg.hostInfo ? {
                    userId: tg.hostInfo._id.toString(),
                    username: tg.hostInfo.username,
                    displayName: tg.hostInfo.displayName,
                    profilePhoto: tg.hostInfo.profilePhoto
                } : null)
            });
        });

        // Sort by date and limit
        events.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
        const limitedEvents = events.slice(0, parseInt(limit));

        return res.status(200).json({
            success: true,
            events: limitedEvents,
            count: limitedEvents.length
        });

    } catch (error) {
        console.error('Get upcoming events error:', error);
        return res.status(500).json({ error: 'Failed to fetch upcoming events' });
    }
}
