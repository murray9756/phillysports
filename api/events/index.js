// Events Calendar API
// GET /api/events - List all events (watch parties, tailgates, meetups)
// GET /api/events?view=calendar - Calendar view with date range

import { ObjectId } from 'mongodb';
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
        const {
            view = 'list',
            team,
            type,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        // Build date range
        let dateFrom, dateTo;

        if (view === 'calendar') {
            // Calendar view: default to current month
            const now = new Date();
            if (startDate) {
                dateFrom = new Date(startDate);
            } else {
                dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            if (endDate) {
                dateTo = new Date(endDate);
            } else {
                dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            }
        } else {
            // List view: default to upcoming
            dateFrom = new Date();
            if (endDate) {
                dateTo = new Date(endDate);
            }
        }

        const events = [];

        // Get watch parties
        if (!type || type === 'watch-party' || type === 'all') {
            const watchParties = await getCollection('watch_parties');
            const wpQuery = {
                status: { $ne: 'cancelled' },
                gameTime: { $gte: dateFrom }
            };
            if (dateTo) wpQuery.gameTime.$lte = dateTo;
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
        }

        // Get tailgates
        if (!type || type === 'tailgate' || type === 'all') {
            const tailgates = await getCollection('tailgates');
            const tgQuery = {
                status: { $ne: 'cancelled' },
                'schedule.arrivalTime': { $gte: dateFrom }
            };
            if (dateTo) tgQuery['schedule.arrivalTime'].$lte = dateTo;
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
        }

        // Sort combined results by date
        events.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

        // For calendar view, group by date
        if (view === 'calendar') {
            const groupedByDate = {};
            events.forEach(event => {
                const dateKey = new Date(event.eventDate).toISOString().split('T')[0];
                if (!groupedByDate[dateKey]) {
                    groupedByDate[dateKey] = [];
                }
                groupedByDate[dateKey].push(event);
            });

            return res.status(200).json({
                success: true,
                view: 'calendar',
                dateRange: {
                    from: dateFrom.toISOString(),
                    to: dateTo.toISOString()
                },
                eventsByDate: groupedByDate,
                totalEvents: events.length
            });
        }

        // List view with pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const start = (pageNum - 1) * limitNum;
        const paginatedEvents = events.slice(start, start + limitNum);

        return res.status(200).json({
            success: true,
            view: 'list',
            events: paginatedEvents,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: events.length,
                totalPages: Math.ceil(events.length / limitNum)
            }
        });

    } catch (error) {
        console.error('Get events error:', error);
        return res.status(500).json({ error: 'Failed to fetch events' });
    }
}
