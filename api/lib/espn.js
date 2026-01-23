// DEPRECATED: ESPN API integration
// This file is no longer used - all sports data now comes from SportsDataIO
// Kept for reference only - can be deleted

// For historical reference, ESPN scoreboard URLs were:
// NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
// NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
// MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'
// NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
// NCAAF: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
// NCAAB: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'

console.warn('api/lib/espn.js is deprecated. Use api/lib/sportsdata.js instead.');

export const SCOREBOARD_URLS = {};
export const SPORT_KEY_MAP = {};
export async function fetchScoreboard() { return []; }
export async function fetchAllScoreboards() { return {}; }
export function findGameResult() { return null; }
export async function getGameResult() { return null; }
export function hasGameStarted() { return false; }
