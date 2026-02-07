// Timezone utilities - All Philly sports times in Eastern Time
// EST = UTC-5, EDT = UTC-4

/**
 * Get today's date string in Eastern Time (YYYY-MM-DD)
 */
export function getTodayET() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Get yesterday's date string in Eastern Time (YYYY-MM-DD)
 */
export function getYesterdayET() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Convert any date to YYYY-MM-DD string in Eastern Time
 */
export function toDateStringET(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Get start of today in Eastern Time as a UTC Date (for MongoDB queries)
 * Returns a Date object representing midnight ET today
 */
export function getStartOfDayET() {
    const todayStr = getTodayET();
    const tzAbbr = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short'
    });
    const offset = tzAbbr.includes('EDT') ? '-04:00' : '-05:00';
    return new Date(`${todayStr}T00:00:00${offset}`);
}

/**
 * Get start of a specific date in Eastern Time as a UTC Date
 */
export function getStartOfDateET(dateStr) {
    const tzAbbr = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short'
    });
    const offset = tzAbbr.includes('EDT') ? '-04:00' : '-05:00';
    return new Date(`${dateStr}T00:00:00${offset}`);
}

/**
 * Get current month string in Eastern Time (YYYY-MM)
 */
export function getMonthET() {
    return getTodayET().slice(0, 7);
}

/**
 * Format a date to Eastern Time display string
 */
export function formatEasternTime(date, options = {}) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        ...options
    });
}

/**
 * Format game time for display (e.g., "7:30 PM ET")
 */
export function formatGameTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }) + ' ET';
}

/**
 * Format date for display (e.g., "Jan 23")
 */
export function formatGameDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric'
    });
}


/**
 * Check if a game is today in Eastern Time
 */
export function isToday(dateString) {
    if (!dateString) return false;
    return toDateStringET(dateString) === getTodayET();
}

/**
 * Get hours since a date (for filtering old games)
 */
export function hoursSince(dateString) {
    if (!dateString) return Infinity;
    const gameDate = new Date(dateString);
    const now = new Date();
    return (now - gameDate) / (1000 * 60 * 60);
}
