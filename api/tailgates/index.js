// Tailgates API
// GET /api/tailgates - List tailgates
// POST /api/tailgates - Create new tailgate

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { getUserInfo } from '../lib/community.js';
import {
    validateEventData,
    formatTailgate,
    awardEventHostCoins,
    TEAMS
} from '../lib/social.js';

// Parking lot presets for Philadelphia stadiums
const PARKING_PRESETS = {
    'lincoln-financial': {
        name: 'Lincoln Financial Field',
        address: '1 Lincoln Financial Field Way',
        city: 'Philadelphia',
        state: 'PA',
        zip: '19148',
        lots: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Jetro']
    },
    'citizens-bank': {
        name: 'Citizens Bank Park',
        address: '1 Citizens Bank Way',
        city: 'Philadelphia',
        state: 'PA',
        zip: '19148',
        lots: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Jetro']
    },
    'wells-fargo': {
        name: 'Wells Fargo Center',
        address: '3601 S Broad St',
        city: 'Philadelphia',
        state: 'PA',
        zip: '19148',
        lots: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    },
    'subaru-park': {
        name: 'Subaru Park',
        address: '1 Stadium Dr',
        city: 'Chester',
        state: 'PA',
        zip: '19013',
        lots: ['Main', 'North', 'South']
    }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        // Check if requesting parking presets
        if (req.query.presets === 'true') {
            return res.status(200).json({
                success: true,
                presets: PARKING_PRESETS
            });
        }
        return handleGetTailgates(req, res);
    }

    if (req.method === 'POST') {
        return handleCreateTailgate(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetTailgates(req, res) {
    try {
        const {
            team,
            venue,
            status = 'upcoming',
            clubId,
            hostId,
            page = 1,
            limit = 20,
            sort = 'date'
        } = req.query;

        const tailgates = await getCollection('tailgates');

        // Build query
        const query = {};
        if (team && TEAMS.includes(team)) query.team = team;
        if (venue && PARKING_PRESETS[venue]) query['location.venue'] = venue;
        if (clubId) query.clubId = new ObjectId(clubId);
        if (hostId) query.hostId = new ObjectId(hostId);

        // Status filter
        const now = new Date();
        if (status === 'upcoming') {
            query['schedule.arrivalTime'] = { $gte: now };
            query.status = { $ne: 'cancelled' };
        } else if (status === 'past') {
            query['schedule.arrivalTime'] = { $lt: now };
        } else if (status === 'cancelled') {
            query.status = 'cancelled';
        }

        // Sort order
        let sortOrder = {};
        if (sort === 'date') {
            sortOrder = { 'schedule.arrivalTime': 1 };
        } else if (sort === 'popular') {
            sortOrder = { attendeeCount: -1, 'schedule.arrivalTime': 1 };
        } else if (sort === 'recent') {
            sortOrder = { createdAt: -1 };
        }

        // Pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const total = await tailgates.countDocuments(query);

        const results = await tailgates.aggregate([
            { $match: query },
            { $sort: sortOrder },
            { $skip: skip },
            { $limit: limitNum },
            {
                $lookup: {
                    from: 'users',
                    localField: 'hostId',
                    foreignField: '_id',
                    as: 'hostInfo'
                }
            },
            { $unwind: { path: '$hostInfo', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'fan_clubs',
                    localField: 'clubId',
                    foreignField: '_id',
                    as: 'clubInfo'
                }
            },
            { $unwind: { path: '$clubInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();

        const formatted = results.map(tailgate => ({
            ...formatTailgate(tailgate, tailgate.hostInfo ? {
                userId: tailgate.hostInfo._id.toString(),
                username: tailgate.hostInfo.username,
                displayName: tailgate.hostInfo.displayName,
                profilePhoto: tailgate.hostInfo.profilePhoto
            } : null),
            club: tailgate.clubInfo ? {
                id: tailgate.clubInfo._id.toString(),
                name: tailgate.clubInfo.name,
                slug: tailgate.clubInfo.slug
            } : null
        }));

        return res.status(200).json({
            success: true,
            tailgates: formatted,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get tailgates error:', error);
        return res.status(500).json({ error: 'Failed to fetch tailgates' });
    }
}

async function handleCreateTailgate(req, res) {
    try {
        const auth = await authenticate(req);
        if (!auth) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const {
            title,
            description,
            team,
            gameId,
            venue,
            location,
            schedule,
            visibility,
            capacity,
            costPerPerson,
            costType,
            neededItems,
            amenities,
            rules,
            clubId
        } = req.body;

        // Validate input
        const errors = validateEventData({ title, description, team }, 'tailgate');
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        if (!schedule?.arrivalTime) {
            return res.status(400).json({ error: 'Arrival time is required' });
        }

        if (!location?.lot) {
            return res.status(400).json({ error: 'Parking lot is required' });
        }

        // If club-hosted, verify membership
        if (clubId) {
            const clubs = await getCollection('fan_clubs');
            const club = await clubs.findOne({
                _id: new ObjectId(clubId),
                'members.userId': new ObjectId(auth.userId),
                'members.status': 'active'
            });

            if (!club) {
                return res.status(403).json({ error: 'You must be a member of this club to host a tailgate for it' });
            }
        }

        const tailgatesColl = await getCollection('tailgates');

        // Rate limit: max 3 tailgates per day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const recentCount = await tailgatesColl.countDocuments({
            hostId: new ObjectId(auth.userId),
            createdAt: { $gte: today }
        });

        if (recentCount >= 3) {
            return res.status(429).json({ error: 'You can only create 3 tailgates per day' });
        }

        const userInfo = await getUserInfo(auth.userId);
        const now = new Date();

        // Get venue info from preset or custom
        const venueInfo = venue && PARKING_PRESETS[venue] ? PARKING_PRESETS[venue] : null;

        const newTailgate = {
            title: title.trim(),
            description: description?.trim().substring(0, 2000) || '',
            hostId: new ObjectId(auth.userId),
            hostUsername: userInfo.username,
            hostDisplayName: userInfo.displayName,
            hostProfilePhoto: userInfo.profilePhoto,
            clubId: clubId ? new ObjectId(clubId) : null,
            team: team || null,
            gameId: gameId || null,
            location: {
                venue: venue || 'custom',
                venueName: venueInfo?.name || location.venueName || 'Custom Location',
                address: venueInfo?.address || location.address || '',
                city: venueInfo?.city || location.city || '',
                state: venueInfo?.state || location.state || '',
                zip: venueInfo?.zip || location.zip || '',
                lot: location.lot?.trim(),
                spotNumber: location.spotNumber?.trim() || null,
                meetupPoint: location.meetupPoint?.trim() || '',
                coordinates: location.coordinates || null
            },
            schedule: {
                arrivalTime: new Date(schedule.arrivalTime),
                kickoffTime: schedule.kickoffTime ? new Date(schedule.kickoffTime) : null,
                endTime: schedule.endTime ? new Date(schedule.endTime) : null
            },
            visibility: visibility || 'public',
            capacity: capacity ? parseInt(capacity) : null,
            costPerPerson: costPerPerson ? parseFloat(costPerPerson) : 0,
            costType: costType || 'free',
            attendees: [{
                userId: new ObjectId(auth.userId),
                status: 'going',
                guestCount: 0,
                rsvpAt: now
            }],
            attendeeCount: 1,
            contributions: [],
            neededItems: Array.isArray(neededItems) ? neededItems.slice(0, 20).map(item => ({
                item: item.item?.trim() || item,
                quantity: item.quantity || 1,
                claimedBy: null
            })) : [],
            amenities: Array.isArray(amenities) ? amenities.slice(0, 15) : [],
            rules: Array.isArray(rules) ? rules.slice(0, 10).map(r => r.trim()) : [],
            status: 'upcoming',
            chatEnabled: true,
            pusherChannel: `tailgate-${new ObjectId().toString()}`,
            images: [],
            createdAt: now,
            updatedAt: now
        };

        const result = await tailgatesColl.insertOne(newTailgate);

        // Update club stats if club-hosted
        if (clubId) {
            const clubs = await getCollection('fan_clubs');
            await clubs.updateOne(
                { _id: new ObjectId(clubId) },
                { $inc: { 'stats.tailgatesHosted': 1 } }
            );
        }

        // Award coins
        const reward = await awardEventHostCoins(auth.userId, 'tailgate');

        return res.status(201).json({
            success: true,
            message: 'Tailgate created successfully',
            tailgate: formatTailgate({ ...newTailgate, _id: result.insertedId }, {
                userId: auth.userId,
                username: userInfo.username,
                displayName: userInfo.displayName,
                profilePhoto: userInfo.profilePhoto
            }),
            coinsAwarded: reward.amount
        });

    } catch (error) {
        console.error('Create tailgate error:', error);
        return res.status(500).json({ error: 'Failed to create tailgate' });
    }
}
