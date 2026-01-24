// Timezone utilities - All Philly sports times in Eastern Time
// EST = UTC-5, EDT = UTC-4

/**
 * Get current date/time in Eastern Time
 */
export function getEasternTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Get today's date string in Eastern Time (YYYY-MM-DD)
 */
export function getTodayET() {
    const et = getEasternTime();
    return et.toISOString().split('T')[0];
}

/**
 * Get yesterday's date string in Eastern Time (YYYY-MM-DD)
 */
export function getYesterdayET() {
    const et = getEasternTime();
    et.setDate(et.getDate() - 1);
    return et.toISOString().split('T')[0];
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
    const gameDate = formatGameDate(dateString);
    const today = formatGameDate(new Date().toISOString());
    return gameDate === today;
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
