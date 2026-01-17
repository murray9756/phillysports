// Social Features Helper Library
// Shared utilities for clubs, watch parties, tailgates, and events

import { ObjectId } from 'mongodb';
import { getCollection } from './mongodb.js';
import { addCoins, getDailyEarnings } from './coins.js';

// Reward constants
export const CLUB_CREATE_REWARD = 50;
export const EVENT_HOST_REWARD = 25;
export const EVENT_ATTEND_REWARD = 10;
export const CONTRIBUTION_REWARD = 15;
export const FIRST_CLUB_BONUS = 100;

// Daily limits
export const DAILY_EVENT_ATTEND_LIMIT = 50; // Max 5 events/day rewarded

// Valid teams
export const TEAMS = ['eagles', 'phillies', 'sixers', 'flyers', 'union', 'villanova', 'penn', 'lasalle', 'drexel', 'stjosephs', 'temple'];

// Club types
export const CLUB_TYPES = ['public', 'private', 'invite-only'];

// Member roles
export const MEMBER_ROLES = ['owner', 'admin', 'moderator', 'member'];

// Event types
export const EVENT_TYPES = ['meetup', 'watch-party', 'tailgate', 'charity', 'other'];

// Location types
export const LOCATION_TYPES = ['bar', 'home', 'venue', 'virtual'];

/**
 * Generate URL-friendly slug from name
 */
export function generateSlug(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
}

/**
 * Check if user is member of a club
 */
export async function isClubMember(clubId, userId) {
    const clubs = await getCollection('fan_clubs');
    const club = await clubs.findOne({
        _id: new ObjectId(clubId),
        'members.userId': new ObjectId(userId),
        'members.status': 'active'
    });
    return !!club;
}

/**
 * Get user's role in a club
 */
export async function getClubRole(clubId, userId) {
    const clubs = await getCollection('fan_clubs');
    const club = await clubs.findOne({ _id: new ObjectId(clubId) });
    if (!club) return null;

    const member = club.members?.find(m => m.userId.toString() === userId.toString());
    return member?.status === 'active' ? member.role : null;
}

/**
 * Check if user can manage club (owner or admin)
 */
export async function canManageClub(clubId, userId) {
    const role = await getClubRole(clubId, userId);
    return role === 'owner' || role === 'admin';
}

/**
 * Check if user is club owner
 */
export async function isClubOwner(clubId, userId) {
    const role = await getClubRole(clubId, userId);
    return role === 'owner';
}

/**
 * Award coins for creating a club
 */
export async function awardClubCreateCoins(userId) {
    await addCoins(userId, CLUB_CREATE_REWARD, 'club_create', 'Created a fan club');
    return { awarded: true, amount: CLUB_CREATE_REWARD };
}

/**
 * Award first club bonus (one-time)
 */
export async function awardFirstClubBonus(userId) {
    const users = await getCollection('users');
    const user = await users.findOne({ _id: new ObjectId(userId) });

    if (user?.firstClubBonusAwarded) {
        return { awarded: false, reason: 'already_awarded', amount: 0 };
    }

    await users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { firstClubBonusAwarded: true } }
    );

    await addCoins(userId, FIRST_CLUB_BONUS, 'first_club', 'Joined your first fan club!');
    return { awarded: true, amount: FIRST_CLUB_BONUS };
}

/**
 * Award coins for hosting an event
 */
export async function awardEventHostCoins(userId, eventType) {
    await addCoins(userId, EVENT_HOST_REWARD, 'event_host', `Hosted a ${eventType}`);
    return { awarded: true, amount: EVENT_HOST_REWARD };
}

/**
 * Award coins for attending an event (with daily limit)
 */
export async function awardEventAttendCoins(userId) {
    const dailyEarnings = await getDailyEarnings(userId, 'event_attend');

    if (dailyEarnings.total >= DAILY_EVENT_ATTEND_LIMIT) {
        return { awarded: false, reason: 'daily_limit', amount: 0 };
    }

    await addCoins(userId, EVENT_ATTEND_REWARD, 'event_attend', 'Attended an event');
    return { awarded: true, amount: EVENT_ATTEND_REWARD };
}

/**
 * Award coins for tailgate contribution
 */
export async function awardContributionCoins(userId, item) {
    await addCoins(userId, CONTRIBUTION_REWARD, 'tailgate_contribution', `Contributed: ${item}`);
    return { awarded: true, amount: CONTRIBUTION_REWARD };
}

/**
 * Validate club data
 */
export function validateClubData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length < 3) {
        errors.push('Club name must be at least 3 characters');
    }
    if (data.name && data.name.length > 100) {
        errors.push('Club name cannot exceed 100 characters');
    }
    if (data.description && data.description.length > 500) {
        errors.push('Description cannot exceed 500 characters');
    }
    if (data.team && !TEAMS.includes(data.team) && data.team !== 'all') {
        errors.push('Invalid team selection');
    }
    if (data.type && !CLUB_TYPES.includes(data.type)) {
        errors.push('Invalid club type');
    }

    return errors;
}

/**
 * Validate event data (watch party, tailgate, meetup)
 */
export function validateEventData(data, type) {
    const errors = [];

    if (!data.title || data.title.trim().length < 5) {
        errors.push('Title must be at least 5 characters');
    }
    if (data.title && data.title.length > 200) {
        errors.push('Title cannot exceed 200 characters');
    }
    if (data.description && data.description.length > 2000) {
        errors.push('Description cannot exceed 2000 characters');
    }
    if (data.team && !TEAMS.includes(data.team)) {
        errors.push('Invalid team selection');
    }
    if (type === 'watch-party' && data.locationType && !LOCATION_TYPES.includes(data.locationType)) {
        errors.push('Invalid location type');
    }

    return errors;
}

/**
 * Format club for API response
 */
export function formatClub(club, includeMembers = false) {
    const formatted = {
        id: club._id.toString(),
        name: club.name,
        slug: club.slug,
        description: club.description || '',
        team: club.team,
        type: club.type,
        coverImage: club.coverImage || null,
        logoImage: club.logoImage || null,
        memberCount: club.memberCount || 0,
        tags: club.tags || [],
        socialLinks: club.socialLinks || {},
        stats: club.stats || { eventsHosted: 0, watchPartiesHosted: 0, tailgatesHosted: 0 },
        isVerified: club.isVerified || false,
        isFeatured: club.isFeatured || false,
        createdAt: club.createdAt,
        updatedAt: club.updatedAt
    };

    if (includeMembers && club.members) {
        formatted.members = club.members.map(m => ({
            userId: m.userId.toString(),
            role: m.role,
            joinedAt: m.joinedAt,
            status: m.status
        }));
    }

    return formatted;
}

/**
 * Format club member for API response
 */
export function formatMember(member, userInfo = null) {
    return {
        userId: member.userId.toString(),
        username: userInfo?.username || member.username || 'Unknown',
        displayName: userInfo?.displayName || member.displayName || 'Unknown User',
        profilePhoto: userInfo?.profilePhoto || member.profilePhoto || null,
        role: member.role,
        joinedAt: member.joinedAt,
        status: member.status
    };
}

/**
 * Format watch party for API response
 */
export function formatWatchParty(party, host = null) {
    return {
        id: party._id.toString(),
        title: party.title,
        description: party.description || '',
        hostId: party.hostId.toString(),
        clubId: party.clubId?.toString() || null,
        team: party.team,
        gameId: party.gameId || null,
        gameTime: party.gameTime,
        locationType: party.locationType,
        location: party.location,
        virtualLink: party.virtualLink || null,
        visibility: party.visibility,
        capacity: party.capacity,
        costPerPerson: party.costPerPerson || 0,
        costType: party.costType || 'free',
        attendeeCount: party.attendeeCount || 0,
        amenities: party.amenities || [],
        status: party.status,
        chatEnabled: party.chatEnabled !== false,
        images: party.images || [],
        createdAt: party.createdAt,
        updatedAt: party.updatedAt,
        host: host || {
            userId: party.hostId.toString(),
            username: party.hostUsername,
            displayName: party.hostDisplayName,
            profilePhoto: party.hostProfilePhoto
        }
    };
}

/**
 * Format tailgate for API response
 */
export function formatTailgate(tailgate, host = null) {
    return {
        id: tailgate._id.toString(),
        title: tailgate.title,
        description: tailgate.description || '',
        hostId: tailgate.hostId.toString(),
        clubId: tailgate.clubId?.toString() || null,
        team: tailgate.team,
        gameId: tailgate.gameId || null,
        location: tailgate.location,
        schedule: tailgate.schedule,
        visibility: tailgate.visibility,
        capacity: tailgate.capacity,
        costPerPerson: tailgate.costPerPerson || 0,
        costType: tailgate.costType || 'free',
        attendeeCount: tailgate.attendeeCount || 0,
        contributions: (tailgate.contributions || []).map(c => ({
            userId: c.userId.toString(),
            item: c.item,
            quantity: c.quantity,
            status: c.status
        })),
        neededItems: tailgate.neededItems || [],
        amenities: tailgate.amenities || [],
        rules: tailgate.rules || [],
        status: tailgate.status,
        chatEnabled: tailgate.chatEnabled !== false,
        images: tailgate.images || [],
        createdAt: tailgate.createdAt,
        updatedAt: tailgate.updatedAt,
        host: host || {
            userId: tailgate.hostId.toString(),
            username: tailgate.hostUsername,
            displayName: tailgate.hostDisplayName,
            profilePhoto: tailgate.hostProfilePhoto
        }
    };
}

/**
 * Format fan event for API response
 */
export function formatEvent(event, host = null) {
    return {
        id: event._id.toString(),
        title: event.title,
        description: event.description || '',
        eventType: event.eventType,
        linkedEventId: event.linkedEventId?.toString() || null,
        hostId: event.hostId.toString(),
        clubId: event.clubId?.toString() || null,
        team: event.team,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone || 'America/New_York',
        location: event.location,
        virtualLink: event.virtualLink || null,
        visibility: event.visibility,
        capacity: event.capacity,
        attendeeCount: event.attendeeCount || 0,
        costPerPerson: event.costPerPerson || 0,
        costType: event.costType || 'free',
        tags: event.tags || [],
        status: event.status,
        isFeatured: event.isFeatured || false,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        host: host || {
            userId: event.hostId.toString(),
            username: event.hostUsername,
            displayName: event.hostDisplayName,
            profilePhoto: event.hostProfilePhoto
        }
    };
}

/**
 * Create database indexes for social collections
 */
export async function createSocialIndexes() {
    const clubs = await getCollection('fan_clubs');
    const watchParties = await getCollection('watch_parties');
    const tailgates = await getCollection('tailgates');
    const events = await getCollection('fan_events');
    const eventMessages = await getCollection('event_messages');

    // Fan clubs indexes
    await clubs.createIndex({ slug: 1 }, { unique: true });
    await clubs.createIndex({ team: 1, memberCount: -1 });
    await clubs.createIndex({ 'members.userId': 1 });
    await clubs.createIndex({ ownerId: 1 });
    await clubs.createIndex({ isFeatured: -1, memberCount: -1 });
    await clubs.createIndex({ tags: 1 });
    await clubs.createIndex({ name: 'text', description: 'text' });

    // Watch parties indexes
    await watchParties.createIndex({ team: 1, gameTime: 1 });
    await watchParties.createIndex({ hostId: 1 });
    await watchParties.createIndex({ clubId: 1 });
    await watchParties.createIndex({ status: 1, gameTime: 1 });
    await watchParties.createIndex({ gameId: 1 });

    // Tailgates indexes
    await tailgates.createIndex({ team: 1, 'schedule.arrivalTime': 1 });
    await tailgates.createIndex({ hostId: 1 });
    await tailgates.createIndex({ gameId: 1 });
    await tailgates.createIndex({ status: 1 });

    // Fan events indexes
    await events.createIndex({ startTime: 1 });
    await events.createIndex({ team: 1, startTime: 1 });
    await events.createIndex({ eventType: 1 });
    await events.createIndex({ hostId: 1 });
    await events.createIndex({ clubId: 1 });
    await events.createIndex({ linkedEventId: 1 });
    await events.createIndex({ isFeatured: -1, startTime: 1 });

    // Event messages indexes
    await eventMessages.createIndex({ eventType: 1, eventId: 1, createdAt: -1 });
}
