// Watch Parties API
// GET /api/watch-parties - List watch parties
// POST /api/watch-parties - Create new watch party

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';
import { getUserInfo } from '../lib/community.js';
import {
    validateEventData,
    formatWatchParty,
    awardEventHostCoins,
    TEAMS,
    LOCATION_TYPES
} from '../lib/social.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return handleGetParties(req, res);
    }

    if (req.method === 'POST') {
        return handleCreateParty(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetParties(req, res) {
    try {
        const {
            team,
            locationType,
            status = 'upcoming',
            clubId,
            hostId,
            page = 1,
            limit = 20,
            sort = 'date'
        } = req.query;

        const parties = await getCollection('watch_parties');

        // Build query
        const query = {};
        if (team && TEAMS.includes(team)) query.team = team;
        if (locationType && LOCATION_TYPES.includes(locationType)) query.locationType = locationType;
        if (clubId) query.clubId = new ObjectId(clubId);
        if (hostId) query.hostId = new ObjectId(hostId);

        // Status filter
        const now = new Date();
        if (status === 'upcoming') {
            query.gameTime = { $gte: now };
            query.status = { $ne: 'cancelled' };
        } else if (status === 'past') {
            query.gameTime = { $lt: now };
        } else if (status === 'cancelled') {
            query.status = 'cancelled';
        }

        // Sort order
        let sortOrder = {};
        if (sort === 'date') {
            sortOrder = { gameTime: 1 };
        } else if (sort === 'popular') {
            sortOrder = { attendeeCount: -1, gameTime: 1 };
        } else if (sort === 'recent') {
            sortOrder = { createdAt: -1 };
        }

        // Pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const total = await parties.countDocuments(query);

        const results = await parties.aggregate([
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

        const formatted = results.map(party => ({
            ...formatWatchParty(party, party.hostInfo ? {
                userId: party.hostInfo._id.toString(),
                username: party.hostInfo.username,
                displayName: party.hostInfo.displayName,
                profilePhoto: party.hostInfo.profilePhoto
            } : null),
            club: party.clubInfo ? {
                id: party.clubInfo._id.toString(),
                name: party.clubInfo.name,
                slug: party.clubInfo.slug
            } : null
        }));

        return res.status(200).json({
            success: true,
            parties: formatted,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get watch parties error:', error);
        return res.status(500).json({ error: 'Failed to fetch watch parties' });
    }
}

async function handleCreateParty(req, res) {
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
            gameTime,
            locationType,
            location,
            virtualLink,
            visibility,
            capacity,
            costPerPerson,
            costType,
            amenities,
            clubId
        } = req.body;

        // Validate input
        const errors = validateEventData({ title, description, team, locationType }, 'watch-party');
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        if (!gameTime) {
            return res.status(400).json({ error: 'Game time is required' });
        }

        if (!locationType || !LOCATION_TYPES.includes(locationType)) {
            return res.status(400).json({ error: 'Valid location type is required' });
        }

        if (locationType !== 'virtual' && (!location || !location.name)) {
            return res.status(400).json({ error: 'Location name is required for physical parties' });
        }

        if (locationType === 'virtual' && !virtualLink) {
            return res.status(400).json({ error: 'Virtual link is required for virtual parties' });
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
                return res.status(403).json({ error: 'You must be a member of this club to host a party for it' });
            }
        }

        const parties = await getCollection('watch_parties');

        // Rate limit: max 3 parties per day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const recentCount = await parties.countDocuments({
            hostId: new ObjectId(auth.userId),
            createdAt: { $gte: today }
        });

        if (recentCount >= 3) {
            return res.status(429).json({ error: 'You can only create 3 watch parties per day' });
        }

        const userInfo = await getUserInfo(auth.userId);
        const now = new Date();

        const newParty = {
            title: title.trim(),
            description: description?.trim().substring(0, 2000) || '',
            hostId: new ObjectId(auth.userId),
            hostUsername: userInfo.username,
            hostDisplayName: userInfo.displayName,
            hostProfilePhoto: userInfo.profilePhoto,
            clubId: clubId ? new ObjectId(clubId) : null,
            team: team || null,
            gameId: gameId || null,
            gameTime: new Date(gameTime),
            locationType,
            location: locationType !== 'virtual' ? {
                name: location.name?.trim(),
                address: location.address?.trim() || '',
                city: location.city?.trim() || '',
                state: location.state?.trim() || '',
                zip: location.zip?.trim() || '',
                coordinates: location.coordinates || null,
                googlePlaceId: location.googlePlaceId || null
            } : null,
            virtualLink: locationType === 'virtual' ? virtualLink : null,
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
            amenities: Array.isArray(amenities) ? amenities.slice(0, 10) : [],
            status: 'upcoming',
            chatEnabled: true,
            pusherChannel: `watch-party-${new ObjectId().toString()}`,
            images: [],
            createdAt: now,
            updatedAt: now
        };

        const result = await parties.insertOne(newParty);

        // Update club stats if club-hosted
        if (clubId) {
            const clubs = await getCollection('fan_clubs');
            await clubs.updateOne(
                { _id: new ObjectId(clubId) },
                { $inc: { 'stats.watchPartiesHosted': 1 } }
            );
        }

        // Award coins
        const reward = await awardEventHostCoins(auth.userId, 'watch party');

        return res.status(201).json({
            success: true,
            message: 'Watch party created successfully',
            party: formatWatchParty({ ...newParty, _id: result.insertedId }, {
                userId: auth.userId,
                username: userInfo.username,
                displayName: userInfo.displayName,
                profilePhoto: userInfo.profilePhoto
            }),
            coinsAwarded: reward.amount
        });

    } catch (error) {
        console.error('Create watch party error:', error);
        return res.status(500).json({ error: 'Failed to create watch party' });
    }
}
