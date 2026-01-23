// SportsDataIO API integration
// Unified helper for fetching sports data across NFL, NBA, MLB, NHL, NCAAF, NCAAB

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

// Sport configurations
const SPORT_CONFIG = {
    NFL: { endpoint: 'nfl', teamAbbr: 'PHI' },
    NBA: { endpoint: 'nba', teamAbbr: 'PHI' },
    MLB: { endpoint: 'mlb', teamAbbr: 'PHI' },
    NHL: { endpoint: 'nhl', teamAbbr: 'PHI' },
    NCAAF: { endpoint: 'cfb', teamAbbr: null },
    NCAAB: { endpoint: 'cbb', teamAbbr: null }
};

// Philly teams abbreviations
const PHILLY_TEAMS = {
    NFL: ['PHI'],
    NBA: ['PHI'],
    MLB: ['PHI'],
    NHL: ['PHI']
};

// Get current season for each sport based on date
export function getCurrentSeason(sport, date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    switch (sport) {
        case 'NFL':
            // NFL season runs Sept-Feb, use the starting year
            return month >= 3 && month <= 8 ? year : (month >= 9 ? year : year - 1);
        case 'NBA':
        case 'NHL':
            // NBA/NHL seasons span two years - use the ending year
            return month >= 10 ? year + 1 : year;
        case 'MLB':
            // MLB is calendar year
            return year;
        case 'NCAAF':
            // College football runs Aug-Jan
            return month >= 8 ? year : year - 1;
        case 'NCAAB':
            // College basketball runs Nov-Apr
            return month >= 11 ? year + 1 : (month <= 4 ? year : year);
        default:
            return year;
    }
}

// Check if a team is a Philly team
export function isPhillyTeam(teamAbbr, sport) {
    if (!teamAbbr) return false;
    const phillyAbbrs = PHILLY_TEAMS[sport] || [];
    return phillyAbbrs.includes(teamAbbr.toUpperCase());
}

// Fetch games for a specific date
export async function fetchGamesByDate(sport, date) {
    if (!SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY not configured');
    }

    const config = SPORT_CONFIG[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    const targetDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const url = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/GamesByDate/${targetDate}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    return await response.json();
}

// Fetch live scores for today
export async function fetchScoresByDate(sport, date) {
    if (!SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY not configured');
    }

    const config = SPORT_CONFIG[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    const targetDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const url = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/ScoresByDate/${targetDate}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    return await response.json();
}

// Fetch team schedule
export async function fetchTeamSchedule(sport, teamAbbr, season = null) {
    if (!SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY not configured');
    }

    const config = SPORT_CONFIG[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    const targetSeason = season || getCurrentSeason(sport);
    const url = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/Games/${targetSeason}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    const games = await response.json();

    // Filter to games involving the specified team
    return games.filter(game =>
        game.HomeTeam === teamAbbr || game.AwayTeam === teamAbbr
    );
}

// Fetch all players for a sport
export async function fetchPlayers(sport) {
    if (!SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY not configured');
    }

    const config = SPORT_CONFIG[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    const url = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/Players?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    return await response.json();
}

// Fetch team roster
export async function fetchTeamRoster(sport, teamAbbr) {
    if (!SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY not configured');
    }

    const config = SPORT_CONFIG[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    const url = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/Players/${teamAbbr}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    return await response.json();
}

// Fetch standings
export async function fetchStandings(sport, season = null) {
    if (!SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY not configured');
    }

    const config = SPORT_CONFIG[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    const targetSeason = season || getCurrentSeason(sport);
    const url = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/Standings/${targetSeason}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    return await response.json();
}

// Fetch play-by-play for a game
export async function fetchPlayByPlay(sport, gameId) {
    if (!SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY not configured');
    }

    const config = SPORT_CONFIG[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    const url = `https://api.sportsdata.io/v3/${config.endpoint}/pbp/json/PlayByPlay/${gameId}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        return null; // Play-by-play may not be available
    }

    return await response.json();
}

// Transform SportsDataIO game to unified format
export function transformGame(game, sport) {
    return {
        id: (game.GameID || game.ScoreID)?.toString(),
        sport,
        homeTeam: game.HomeTeam,
        awayTeam: game.AwayTeam,
        homeTeamName: game.HomeTeamName || game.HomeTeam,
        awayTeamName: game.AwayTeamName || game.AwayTeam,
        homeScore: game.HomeScore || game.HomeTeamScore || 0,
        awayScore: game.AwayScore || game.AwayTeamScore || 0,
        gameTime: game.DateTime || game.Day,
        status: game.Status,
        isFinal: game.Status === 'Final' || game.Status === 'F/OT',
        isInProgress: game.Status === 'InProgress',
        venue: game.StadiumDetails?.Name || game.Stadium,
        channel: game.Channel,
        week: game.Week,
        quarter: game.Quarter,
        period: game.Period,
        inning: game.Inning,
        timeRemaining: game.TimeRemainingMinutes ?
            `${game.TimeRemainingMinutes}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}` : null
    };
}

// Get ordinal suffix for numbers
export function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// Format game status for display
export function formatGameStatus(game, sport) {
    if (game.Status === 'Final' || game.Status === 'F/OT') {
        return game.Status === 'F/OT' ? 'Final/OT' : 'Final';
    }
    if (game.Status === 'InProgress') {
        if (sport === 'NFL' || sport === 'NBA') {
            return `Q${game.Quarter || 1} ${game.TimeRemainingMinutes || 0}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}`;
        } else if (sport === 'NHL') {
            return `P${game.Period || 1} ${game.TimeRemainingMinutes || 0}:${String(game.TimeRemainingSeconds || 0).padStart(2, '0')}`;
        } else if (sport === 'MLB') {
            const half = game.InningHalf === 'T' ? 'Top' : 'Bot';
            return `${half} ${game.Inning || 1}`;
        }
    }
    if (game.Status === 'Scheduled') {
        return new Date(game.DateTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/New_York'
        });
    }
    return game.Status;
}

// Team logo URL helper (uses ESPN CDN)
export function getTeamLogo(sport, teamAbbr) {
    const sportPath = {
        NFL: 'nfl',
        NBA: 'nba',
        MLB: 'mlb',
        NHL: 'nhl'
    };
    return `https://a.espncdn.com/i/teamlogos/${sportPath[sport]}/500/${teamAbbr?.toLowerCase()}.png`;
}

// College team mappings for SportsDataIO
export const COLLEGE_TEAMS = {
    'villanova': { id: 'VILL', name: 'Villanova', conference: 'Big East' },
    'penn': { id: 'PENN', name: 'Penn', conference: 'Ivy League' },
    'lasalle': { id: 'LAS', name: 'La Salle', conference: 'A-10' },
    'drexel': { id: 'DREX', name: 'Drexel', conference: 'CAA' },
    'stjosephs': { id: 'SJU', name: "St. Joseph's", conference: 'A-10' },
    'temple': { id: 'TEM', name: 'Temple', conference: 'AAC' }
};

export { SPORT_CONFIG, PHILLY_TEAMS };
