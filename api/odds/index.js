// Odds API - Unified endpoint
// Pro sports (NFL, NBA, MLB, NHL) -> SportsDataIO
// College sports (NCAAF, NCAAB) -> TheOddsAPI

import { getCollection } from '../lib/mongodb.js';
import { fetchGamesByDate } from '../lib/sportsdata.js';

const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Get today's date in US Eastern time (YYYY-MM-DD format)
function getLocalDate() {
    const now = new Date();
    // Convert to US Eastern time
    const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = eastern.getFullYear();
    const month = String(eastern.getMonth() + 1).padStart(2, '0');
    const day = String(eastern.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Cache duration: 15 minutes
const CACHE_DURATION_MS = 15 * 60 * 1000;

// Pro sports use SportsDataIO
const PRO_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL'];

// College sports use TheOddsAPI
const COLLEGE_SPORTS = ['NCAAF', 'NCAAB'];

// TheOddsAPI sport keys for all sports (used as fallback for pro sports)
const ODDS_API_SPORT_KEYS = {
    'NFL': 'americanfootball_nfl',
    'NBA': 'basketball_nba',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAB': 'basketball_ncaab'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sport, team, date } = req.query;
    const sportUpper = sport?.toUpperCase();
    // Use provided date or today's date in US Eastern time
    const targetDate = date || getLocalDate();

    console.log(`Odds API called: sport=${sportUpper || 'all'}, date=${targetDate}, phillyOnly=${!sportUpper}`);

    // Validate sport parameter
    const validSports = [...PRO_SPORTS, ...COLLEGE_SPORTS];
    if (sportUpper && !validSports.includes(sportUpper)) {
        return res.status(400).json({
            error: 'Invalid sport',
            validSports
        });
    }

    try {
        let games = [];

        if (!sportUpper) {
            // Fetch all sports - filter to Philly teams only
            const [proGames, collegeGames] = await Promise.all([
                fetchProSportsOdds(team, targetDate, true),  // phillyOnly=true
                fetchCollegeSportsOdds()
            ]);
            games = [...proGames, ...collegeGames];
        } else if (PRO_SPORTS.includes(sportUpper)) {
            // Specific pro sport selected - show all games for that sport
            console.log(`Fetching ${sportUpper} with phillyOnly=false (all games)`);
            games = await fetchSportsDataOdds(sportUpper, team, targetDate, false);  // phillyOnly=false
            console.log(`Got ${games.length} games for ${sportUpper}`);
        } else if (COLLEGE_SPORTS.includes(sportUpper)) {
            // College sport - use TheOddsAPI
            games = await fetchTheOddsAPIData(sportUpper);
        }

        // Filter out games that have already started
        const now = new Date();
        console.log(`Current time (UTC): ${now.toISOString()}`);

        const upcomingGames = games.filter(game => {
            const gameTime = new Date(game.commenceTime);
            // Only filter out games that are actively in progress or completed
            const isCompleted = game.status === 'Final' || game.status === 'F' || game.status === 'F/OT';
            const isInProgress = game.status === 'InProgress';

            // Allow games that haven't started yet OR are scheduled
            // Even if game time has passed slightly, show it if status is still 'Scheduled'
            const isScheduled = game.status === 'Scheduled' || !game.status;
            const timeOk = gameTime > now || isScheduled;

            const shouldShow = !isCompleted && !isInProgress && timeOk;

            if (!shouldShow) {
                console.log(`Filtering out: ${game.homeTeam} vs ${game.awayTeam}, time=${game.commenceTime}, status=${game.status}, timeOk=${timeOk}`);
            }

            return shouldShow;
        });

        console.log(`Filtered to ${upcomingGames.length} upcoming games (removed ${games.length - upcomingGames.length} started/completed)`);

        // Sort by commence time
        upcomingGames.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

        return res.status(200).json({
            success: true,
            games: upcomingGames,
            sport: sportUpper || 'all',
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Odds API error:', error);
        return res.status(500).json({
            error: 'Failed to fetch odds',
            message: error.message
        });
    }
}

// Fetch all pro sports odds from SportsDataIO
async function fetchProSportsOdds(team, targetDate, phillyOnly = true) {
    const allGames = [];
    for (const sport of PRO_SPORTS) {
        try {
            const games = await fetchSportsDataOdds(sport, team, targetDate, phillyOnly);
            allGames.push(...games);
        } catch (e) {
            console.error(`Error fetching ${sport} odds:`, e.message);
        }
    }
    return allGames;
}

// Fetch all college sports odds from TheOddsAPI
async function fetchCollegeSportsOdds() {
    if (!ODDS_API_KEY) return [];

    const allGames = [];
    for (const sport of COLLEGE_SPORTS) {
        try {
            const games = await fetchTheOddsAPIData(sport);
            allGames.push(...games);
        } catch (e) {
            console.error(`Error fetching ${sport} odds:`, e.message);
        }
    }
    return allGames;
}

// Team name mapping for duplicate detection across different data sources
// Note: Short codes like PHI, DET, CHI may map differently depending on sport context
// The mapping normalizes to a common identifier to detect duplicates
const TEAM_NAME_MAPPING = {
    // NFL (short codes uppercase)
    'phi': 'phi-team', 'philadelphia eagles': 'phi-team', 'eagles': 'phi-team',
    'dal': 'dal-team', 'dallas cowboys': 'dal-team', 'cowboys': 'dal-team',
    'nyg': 'nyg-team', 'new york giants': 'nyg-team', 'giants': 'nyg-team',
    'was': 'was-team', 'washington commanders': 'was-team', 'commanders': 'was-team',
    'ne': 'ne-team', 'new england patriots': 'ne-team', 'patriots': 'ne-team',
    'nyj': 'nyj-team', 'new york jets': 'nyj-team',
    'mia': 'mia-team', 'miami dolphins': 'mia-team', 'dolphins': 'mia-team',
    'buf': 'buf-team', 'buffalo bills': 'buf-team', 'bills': 'buf-team',
    'bal': 'bal-team', 'baltimore ravens': 'bal-team', 'ravens': 'bal-team',
    'pit': 'pit-team', 'pittsburgh steelers': 'pit-team', 'steelers': 'pit-team',
    'cle': 'cle-team', 'cleveland browns': 'cle-team', 'browns': 'cle-team',
    'cin': 'cin-team', 'cincinnati bengals': 'cin-team', 'bengals': 'cin-team',
    'ten': 'ten-team', 'tennessee titans': 'ten-team', 'titans': 'ten-team',
    'ind': 'ind-team', 'indianapolis colts': 'ind-team', 'colts': 'ind-team',
    'hou': 'hou-team', 'houston texans': 'hou-team', 'texans': 'hou-team',
    'jax': 'jax-team', 'jacksonville jaguars': 'jax-team', 'jaguars': 'jax-team',
    'kc': 'kc-team', 'kansas city chiefs': 'kc-team', 'chiefs': 'kc-team',
    'lac': 'lac-team', 'los angeles chargers': 'lac-team', 'chargers': 'lac-team',
    'lv': 'lv-team', 'las vegas raiders': 'lv-team', 'raiders': 'lv-team',
    'den': 'den-team', 'denver broncos': 'den-team', 'broncos': 'den-team',
    'min': 'min-team', 'minnesota vikings': 'min-team', 'vikings': 'min-team',
    'gb': 'gb-team', 'green bay packers': 'gb-team', 'packers': 'gb-team',
    'chi': 'chi-team', 'chicago bears': 'chi-team', 'bears': 'chi-team',
    'det': 'det-team', 'detroit lions': 'det-team', 'lions': 'det-team',
    'tb': 'tb-team', 'tampa bay buccaneers': 'tb-team', 'buccaneers': 'tb-team', 'bucs': 'tb-team',
    'no': 'no-team', 'new orleans saints': 'no-team', 'saints': 'no-team',
    'car': 'car-team', 'carolina panthers': 'car-team', 'panthers': 'car-team',
    'atl': 'atl-team', 'atlanta falcons': 'atl-team', 'falcons': 'atl-team',
    'sf': 'sf-team', 'san francisco 49ers': 'sf-team', '49ers': 'sf-team',
    'sea': 'sea-team', 'seattle seahawks': 'sea-team', 'seahawks': 'sea-team',
    'lar': 'lar-team', 'los angeles rams': 'lar-team', 'rams': 'lar-team',
    'ari': 'ari-team', 'arizona cardinals': 'ari-team', 'cardinals': 'ari-team',

    // NBA
    'philadelphia 76ers': 'phi-team', '76ers': 'phi-team', 'sixers': 'phi-team',
    'boston celtics': 'bos-team', 'celtics': 'bos-team', 'bos': 'bos-team',
    'brooklyn nets': 'bkn-team', 'nets': 'bkn-team', 'bkn': 'bkn-team', 'bk': 'bkn-team',
    'new york knicks': 'nyk-team', 'knicks': 'nyk-team', 'nyk': 'nyk-team', 'ny': 'nyk-team',
    'toronto raptors': 'tor-team', 'raptors': 'tor-team', 'tor': 'tor-team',
    'chicago bulls': 'chi-team', 'bulls': 'chi-team',
    'cleveland cavaliers': 'cle-team', 'cavaliers': 'cle-team', 'cavs': 'cle-team',
    'detroit pistons': 'det-team', 'pistons': 'det-team',
    'indiana pacers': 'ind-team', 'pacers': 'ind-team',
    'milwaukee bucks': 'mil-team', 'bucks': 'mil-team', 'mil': 'mil-team',
    'atlanta hawks': 'atl-team', 'hawks': 'atl-team',
    'charlotte hornets': 'cha-team', 'hornets': 'cha-team', 'cha': 'cha-team',
    'miami heat': 'mia-team', 'heat': 'mia-team',
    'orlando magic': 'orl-team', 'magic': 'orl-team', 'orl': 'orl-team',
    'washington wizards': 'was-team', 'wizards': 'was-team',
    'denver nuggets': 'den-team', 'nuggets': 'den-team',
    'minnesota timberwolves': 'min-team', 'timberwolves': 'min-team', 'wolves': 'min-team',
    'oklahoma city thunder': 'okc-team', 'thunder': 'okc-team', 'okc': 'okc-team',
    'portland trail blazers': 'por-team', 'trail blazers': 'por-team', 'blazers': 'por-team', 'por': 'por-team',
    'utah jazz': 'uta-team', 'jazz': 'uta-team', 'uta': 'uta-team',
    'golden state warriors': 'gsw-team', 'warriors': 'gsw-team', 'gsw': 'gsw-team', 'gs': 'gsw-team',
    'los angeles clippers': 'lac-team', 'clippers': 'lac-team',
    'los angeles lakers': 'lal-team', 'lakers': 'lal-team', 'lal': 'lal-team',
    'phoenix suns': 'phx-team', 'suns': 'phx-team', 'phx': 'phx-team', 'pho': 'phx-team',
    'sacramento kings': 'sac-team', 'kings': 'sac-team', 'sac': 'sac-team',
    'dallas mavericks': 'dal-team', 'mavericks': 'dal-team', 'mavs': 'dal-team',
    'houston rockets': 'hou-team', 'rockets': 'hou-team',
    'memphis grizzlies': 'mem-team', 'grizzlies': 'mem-team', 'mem': 'mem-team',
    'new orleans pelicans': 'nop-team', 'pelicans': 'nop-team', 'nop': 'nop-team',
    'san antonio spurs': 'sas-team', 'spurs': 'sas-team', 'sas': 'sas-team', 'sa': 'sas-team',

    // MLB
    'philadelphia phillies': 'phi-team', 'phillies': 'phi-team',
    'new york yankees': 'nyy-team', 'yankees': 'nyy-team', 'nyy': 'nyy-team',
    'new york mets': 'nym-team', 'mets': 'nym-team', 'nym': 'nym-team',
    'boston red sox': 'bos-team', 'red sox': 'bos-team',
    'toronto blue jays': 'tor-team', 'blue jays': 'tor-team',
    'baltimore orioles': 'bal-team', 'orioles': 'bal-team',
    'tampa bay rays': 'tb-team', 'rays': 'tb-team',
    'chicago white sox': 'cws-team', 'white sox': 'cws-team', 'cws': 'cws-team',
    'chicago cubs': 'chc-team', 'cubs': 'chc-team', 'chc': 'chc-team',
    'cleveland guardians': 'cle-team', 'guardians': 'cle-team',
    'detroit tigers': 'det-team', 'tigers': 'det-team',
    'kansas city royals': 'kc-team', 'royals': 'kc-team',
    'minnesota twins': 'min-team', 'twins': 'min-team',
    'houston astros': 'hou-team', 'astros': 'hou-team',
    'los angeles angels': 'laa-team', 'angels': 'laa-team', 'la angels': 'laa-team', 'laa': 'laa-team',
    'oakland athletics': 'oak-team', 'athletics': 'oak-team', "a's": 'oak-team', 'oak': 'oak-team',
    'seattle mariners': 'sea-team', 'mariners': 'sea-team',
    'texas rangers': 'tex-team', 'rangers': 'tex-team', 'tex': 'tex-team',
    'atlanta braves': 'atl-team', 'braves': 'atl-team',
    'miami marlins': 'mia-team', 'marlins': 'mia-team',
    'washington nationals': 'was-team', 'nationals': 'was-team', 'nats': 'was-team',
    'arizona diamondbacks': 'ari-team', 'diamondbacks': 'ari-team', 'd-backs': 'ari-team',
    'colorado rockies': 'col-team', 'rockies': 'col-team', 'col': 'col-team',
    'los angeles dodgers': 'lad-team', 'dodgers': 'lad-team', 'lad': 'lad-team',
    'san diego padres': 'sd-team', 'padres': 'sd-team', 'sd': 'sd-team',
    'san francisco giants': 'sfg-team', 'sf giants': 'sfg-team', 'sfg': 'sfg-team',
    'cincinnati reds': 'cin-team', 'reds': 'cin-team',
    'milwaukee brewers': 'mil-team', 'brewers': 'mil-team',
    'pittsburgh pirates': 'pit-team', 'pirates': 'pit-team',
    'st. louis cardinals': 'stl-team', 'st louis cardinals': 'stl-team', 'stl': 'stl-team',

    // NHL
    'philadelphia flyers': 'phi-team', 'flyers': 'phi-team',
    'colorado avalanche': 'col-team', 'avalanche': 'col-team',
    'pittsburgh penguins': 'pit-team', 'penguins': 'pit-team',
    'new york rangers': 'nyr-team', 'rangers': 'nyr-team', 'nyr': 'nyr-team',
    'new jersey devils': 'njd-team', 'devils': 'njd-team', 'njd': 'njd-team', 'nj': 'njd-team',
    'boston bruins': 'bos-team', 'bruins': 'bos-team',
    'washington capitals': 'was-team', 'capitals': 'was-team', 'caps': 'was-team', 'wsh': 'was-team',
    'carolina hurricanes': 'car-team', 'hurricanes': 'car-team', 'canes': 'car-team',
    'florida panthers': 'fla-team', 'fla': 'fla-team',
    'tampa bay lightning': 'tb-team', 'lightning': 'tb-team', 'tbl': 'tb-team',
    'toronto maple leafs': 'tor-team', 'maple leafs': 'tor-team',
    'montreal canadiens': 'mtl-team', 'canadiens': 'mtl-team', 'mtl': 'mtl-team', 'habs': 'mtl-team',
    'ottawa senators': 'ott-team', 'senators': 'ott-team', 'ott': 'ott-team', 'sens': 'ott-team',
    'buffalo sabres': 'buf-team', 'sabres': 'buf-team',
    'detroit red wings': 'det-team', 'red wings': 'det-team',
    'chicago blackhawks': 'chi-team', 'blackhawks': 'chi-team',
    'st. louis blues': 'stl-team', 'st louis blues': 'stl-team', 'blues': 'stl-team',
    'nashville predators': 'nsh-team', 'predators': 'nsh-team', 'nsh': 'nsh-team', 'preds': 'nsh-team',
    'dallas stars': 'dal-team', 'stars': 'dal-team',
    'minnesota wild': 'min-team', 'wild': 'min-team',
    'winnipeg jets': 'wpg-team', 'jets': 'wpg-team', 'wpg': 'wpg-team',
    'vegas golden knights': 'vgk-team', 'golden knights': 'vgk-team', 'vgk': 'vgk-team', 'veg': 'vgk-team',
    'seattle kraken': 'sea-team', 'kraken': 'sea-team',
    'edmonton oilers': 'edm-team', 'oilers': 'edm-team', 'edm': 'edm-team',
    'calgary flames': 'cgy-team', 'flames': 'cgy-team', 'cgy': 'cgy-team',
    'vancouver canucks': 'van-team', 'canucks': 'van-team', 'van': 'van-team',
    'san jose sharks': 'sj-team', 'sharks': 'sj-team', 'sj': 'sj-team', 'sjs': 'sj-team',
    'los angeles kings': 'lak-team', 'la kings': 'lak-team', 'lak': 'lak-team',
    'anaheim ducks': 'ana-team', 'ducks': 'ana-team', 'ana': 'ana-team',
    'arizona coyotes': 'ari-team', 'coyotes': 'ari-team', 'utah hockey club': 'uta-team', 'utah': 'uta-team',
    'columbus blue jackets': 'cbj-team', 'blue jackets': 'cbj-team', 'cbj': 'cbj-team',
    'new york islanders': 'nyi-team', 'islanders': 'nyi-team', 'nyi': 'nyi-team'
};

function normalizeTeamName(teamName) {
    if (!teamName) return '';
    const lower = teamName.toLowerCase().trim();
    return TEAM_NAME_MAPPING[lower] || lower;
}

// Fetch odds for pro sports - merge data from SportsDataIO and TheOddsAPI
async function fetchSportsDataOdds(sport, team, targetDate, phillyOnly = true) {
    // Fetch from both sources in parallel
    const [sportsDataGames, oddsApiGames] = await Promise.all([
        fetchFromSportsDataIO(sport, team, targetDate, phillyOnly).catch(e => {
            console.error(`SportsDataIO ${sport} error:`, e.message);
            return [];
        }),
        ODDS_API_KEY ? fetchTheOddsAPIData(sport, phillyOnly).catch(e => {
            console.error(`TheOddsAPI ${sport} error:`, e.message);
            return [];
        }) : Promise.resolve([])
    ]);

    console.log(`${sport}: SportsDataIO=${sportsDataGames.length} games, TheOddsAPI=${oddsApiGames.length} games`);

    // Merge results, preferring SportsDataIO data but adding unique games from TheOddsAPI
    const gameIds = new Set(sportsDataGames.map(g => g.id?.toString()));
    const uniqueOddsApiGames = oddsApiGames.filter(g => !gameIds.has(g.id?.toString()));

    // Use normalized team names for duplicate detection (handles PHI vs Philadelphia Flyers)
    const normalizedMatchups = new Set(sportsDataGames.map(g => {
        const home = normalizeTeamName(g.homeTeam);
        const away = normalizeTeamName(g.awayTeam);
        return `${home}-${away}`;
    }));

    const filteredOddsApiGames = uniqueOddsApiGames.filter(g => {
        const home = normalizeTeamName(g.homeTeam);
        const away = normalizeTeamName(g.awayTeam);
        const matchup = `${home}-${away}`;
        const isDuplicate = normalizedMatchups.has(matchup);
        if (isDuplicate) {
            console.log(`Filtering duplicate from TheOddsAPI: ${g.awayTeam} @ ${g.homeTeam}`);
        }
        return !isDuplicate;
    });

    console.log(`${sport}: Adding ${filteredOddsApiGames.length} unique games from TheOddsAPI`);

    return [...sportsDataGames, ...filteredOddsApiGames];
}

// Fetch from SportsDataIO (primary source for pro sports)
async function fetchFromSportsDataIO(sport, team, targetDate, phillyOnly = true) {
    if (!SPORTSDATA_API_KEY) {
        console.warn('SPORTSDATA_API_KEY not configured');
        return [];
    }

    const endpoints = {
        NFL: 'nfl',
        NBA: 'nba',
        MLB: 'mlb',
        NHL: 'nhl'
    };

    const endpoint = endpoints[sport];
    if (!endpoint) return [];

    const dateToUse = targetDate || getLocalDate();
    console.log(`fetchFromSportsDataIO: sport=${sport}, dateToUse=${dateToUse}, targetDate passed=${targetDate}`);

    // First fetch games to get team names (odds endpoint may not have them)
    let gamesLookup = {};
    try {
        const gamesData = await fetchGamesByDate(sport, dateToUse);
        console.log(`Raw games data for ${sport} on ${dateToUse}: ${gamesData?.length || 0} games`);
        if (gamesData && gamesData.length > 0) {
            console.log(`First game fields: ${Object.keys(gamesData[0]).join(', ')}`);
            for (const g of gamesData) {
                // Store under multiple ID variations
                const ids = [g.GameID, g.GameId, g.ScoreID].filter(Boolean);
                const teamInfo = {
                    homeTeam: g.HomeTeam,
                    awayTeam: g.AwayTeam,
                    homeTeamName: g.HomeTeamName,
                    awayTeamName: g.AwayTeamName
                };
                for (const id of ids) {
                    gamesLookup[id] = teamInfo;
                }
            }
            console.log(`Loaded ${Object.keys(gamesLookup).length} entries in games lookup`);
        }
    } catch (e) {
        console.error('Failed to fetch games for team lookup:', e.message);
    }

    // Get current week for NFL, target date for others
    let url;
    if (sport === 'NFL') {
        // Get current NFL week
        try {
            const weekUrl = `https://api.sportsdata.io/v3/nfl/scores/json/CurrentWeek?key=${SPORTSDATA_API_KEY}`;
            const weekResponse = await fetch(weekUrl);
            if (weekResponse.ok) {
                const currentWeek = await weekResponse.json();
                url = `https://api.sportsdata.io/v3/nfl/odds/json/GameOddsByWeek/2025REG/${currentWeek}?key=${SPORTSDATA_API_KEY}`;
            }
        } catch (e) {
            console.error('Failed to get NFL week, using default');
        }
        if (!url) {
            url = `https://api.sportsdata.io/v3/nfl/odds/json/GameOddsByWeek/2025REG/1?key=${SPORTSDATA_API_KEY}`;
        }
    } else {
        url = `https://api.sportsdata.io/v3/${endpoint}/odds/json/GameOddsByDate/${dateToUse}?key=${SPORTSDATA_API_KEY}`;
    }

    console.log(`Fetching ${sport} odds from SportsDataIO: ${url.replace(SPORTSDATA_API_KEY, 'XXX')}`);

    const response = await fetch(url);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`SportsDataIO odds fetch failed for ${sport}: ${response.status} - ${errorText}`);
        return [];
    }

    let games = await response.json();
    console.log(`SportsDataIO ${sport} odds response: ${games.length} games found`);

    // Debug: log first game structure to see field names
    if (games.length > 0) {
        const firstGame = games[0];
        console.log(`SportsDataIO ${sport} first game fields:`, Object.keys(firstGame).join(', '));
        console.log(`SportsDataIO ${sport} HomeTeam value:`, firstGame.HomeTeam, '| AwayTeam:', firstGame.AwayTeam);
        console.log(`SportsDataIO ${sport} HomeTeamName value:`, firstGame.HomeTeamName, '| AwayTeamName:', firstGame.AwayTeamName);
    }

    // Filter by team if specified
    console.log(`Filtering ${sport} games: team=${team}, phillyOnly=${phillyOnly}, beforeFilter=${games.length}`);
    if (team) {
        const teamUpper = team.toUpperCase();
        games = games.filter(g =>
            g.HomeTeam?.toUpperCase() === teamUpper ||
            g.AwayTeam?.toUpperCase() === teamUpper
        );
        console.log(`After team filter: ${games.length} games`);
    } else if (phillyOnly) {
        // Filter to Philly teams when viewing "all sports"
        games = games.filter(g =>
            g.HomeTeam === 'PHI' || g.AwayTeam === 'PHI'
        );
        console.log(`After Philly filter: ${games.length} games`);
    } else {
        console.log(`No filter applied, returning all ${games.length} games`);
    }
    // If phillyOnly is false and no team specified, return all games

    // Transform to unified format, using games lookup for team names
    return games.map(game => transformSportsDataGame(game, sport, gamesLookup));
}

// Transform SportsDataIO game to unified format
function transformSportsDataGame(game, sport, gamesLookup = {}) {
    const gameId = game.GameId || game.GameID || game.ScoreID;
    // Try both capitalizations for lookup
    const gameLookup = gamesLookup[gameId] || gamesLookup[game.GameID] || gamesLookup[game.GameId] || {};

    const pregameOdds = game.PregameOdds || [];
    const consensus = pregameOdds.find(o => o.Sportsbook === 'Consensus') ||
                      pregameOdds.find(o => o.Sportsbook === 'DraftKings') ||
                      pregameOdds.find(o => o.Sportsbook === 'FanDuel') ||
                      pregameOdds[0] || {};

    const odds = {};

    // Spread
    if (consensus.HomePointSpread !== null && consensus.HomePointSpread !== undefined) {
        odds.spread = {
            home: { point: consensus.HomePointSpread, price: consensus.HomePointSpreadPayout || -110 },
            away: { point: consensus.AwayPointSpread, price: consensus.AwayPointSpreadPayout || -110 }
        };
    }

    // Moneyline
    if (consensus.HomeMoneyLine !== null && consensus.HomeMoneyLine !== undefined) {
        odds.moneyline = {
            home: consensus.HomeMoneyLine,
            away: consensus.AwayMoneyLine
        };
    }

    // Total
    if (consensus.OverUnder !== null && consensus.OverUnder !== undefined) {
        odds.total = {
            over: { point: consensus.OverUnder, price: consensus.OverPayout || -110 },
            under: { point: consensus.OverUnder, price: consensus.UnderPayout || -110 }
        };
    }

    return {
        id: gameId,
        sport,
        commenceTime: game.DateTime || game.Day,
        homeTeam: game.HomeTeam || gameLookup.homeTeam || gameLookup.homeTeamName || 'Home',
        awayTeam: game.AwayTeam || gameLookup.awayTeam || gameLookup.awayTeamName || 'Away',
        bookmaker: consensus.Sportsbook || 'Consensus',
        odds: Object.keys(odds).length > 0 ? odds : null,
        status: game.Status,
        lastUpdate: new Date().toISOString(),
        source: 'sportsdata'
    };
}

// Fetch odds from TheOddsAPI (all sports)
async function fetchTheOddsAPIData(sport, phillyOnly = false) {
    if (!ODDS_API_KEY) {
        console.warn('ODDS_API_KEY not configured');
        return [];
    }

    const sportKey = ODDS_API_SPORT_KEYS[sport];
    if (!sportKey) return [];

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,h2h,totals&oddsFormat=american`;

    console.log(`Fetching ${sport} odds from TheOddsAPI: ${sportKey}`);

    const response = await fetch(url);
    if (!response.ok) {
        console.error(`TheOddsAPI fetch failed for ${sport}:`, response.status);
        return [];
    }

    let data = await response.json();
    console.log(`TheOddsAPI ${sport} odds response: ${data.length} games found`);

    // Track remaining API requests
    const remaining = response.headers.get('x-requests-remaining');
    if (remaining) {
        console.log(`TheOddsAPI requests remaining: ${remaining}`);
        await trackAPIUsage(parseInt(remaining));
    }

    // Filter to Philly teams if requested (for pro sports)
    if (phillyOnly && PRO_SPORTS.includes(sport)) {
        const phillyTeams = {
            NFL: ['Philadelphia Eagles', 'Eagles'],
            NBA: ['Philadelphia 76ers', '76ers', 'Sixers'],
            MLB: ['Philadelphia Phillies', 'Phillies'],
            NHL: ['Philadelphia Flyers', 'Flyers']
        };
        const teamNames = phillyTeams[sport] || [];
        data = data.filter(game =>
            teamNames.some(name =>
                game.home_team?.includes(name) || game.away_team?.includes(name)
            )
        );
    }

    return data.map(game => transformTheOddsAPIGame(game, sport));
}

// Transform TheOddsAPI game to unified format
function transformTheOddsAPIGame(game, sport) {
    const bookmaker = findPreferredBookmaker(game.bookmakers);
    if (!bookmaker) {
        return {
            id: game.id,
            sport,
            commenceTime: game.commence_time,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            bookmaker: null,
            odds: null,
            lastUpdate: new Date().toISOString(),
            source: 'theoddsapi'
        };
    }

    const odds = {};

    // Spread
    const spreadMarket = bookmaker.markets?.find(m => m.key === 'spreads');
    if (spreadMarket?.outcomes) {
        const homeSpread = spreadMarket.outcomes.find(o => o.name === game.home_team);
        const awaySpread = spreadMarket.outcomes.find(o => o.name === game.away_team);
        if (homeSpread && awaySpread) {
            odds.spread = {
                home: { point: homeSpread.point, price: homeSpread.price },
                away: { point: awaySpread.point, price: awaySpread.price }
            };
        }
    }

    // Moneyline
    const moneylineMarket = bookmaker.markets?.find(m => m.key === 'h2h');
    if (moneylineMarket?.outcomes) {
        const homeMl = moneylineMarket.outcomes.find(o => o.name === game.home_team);
        const awayMl = moneylineMarket.outcomes.find(o => o.name === game.away_team);
        if (homeMl && awayMl) {
            odds.moneyline = {
                home: homeMl.price,
                away: awayMl.price
            };
        }
    }

    // Total
    const totalMarket = bookmaker.markets?.find(m => m.key === 'totals');
    if (totalMarket?.outcomes) {
        const over = totalMarket.outcomes.find(o => o.name === 'Over');
        const under = totalMarket.outcomes.find(o => o.name === 'Under');
        if (over && under) {
            odds.total = {
                over: { point: over.point, price: over.price },
                under: { point: under.point, price: under.price }
            };
        }
    }

    return {
        id: game.id,
        sport,
        commenceTime: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        bookmaker: formatBookmakerName(bookmaker.key),
        odds: Object.keys(odds).length > 0 ? odds : null,
        lastUpdate: bookmaker.last_update || new Date().toISOString(),
        source: 'theoddsapi'
    };
}

// Preferred bookmakers for TheOddsAPI
const PREFERRED_BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbetus'];

function findPreferredBookmaker(bookmakers) {
    if (!bookmakers || bookmakers.length === 0) return null;

    for (const preferred of PREFERRED_BOOKMAKERS) {
        const found = bookmakers.find(b => b.key === preferred);
        if (found) return found;
    }
    return bookmakers[0];
}

function formatBookmakerName(key) {
    const names = {
        'draftkings': 'DraftKings',
        'fanduel': 'FanDuel',
        'betmgm': 'BetMGM',
        'caesars': 'Caesars',
        'pointsbetus': 'PointsBet'
    };
    return names[key] || key;
}

async function trackAPIUsage(remaining) {
    try {
        const usage = await getCollection('api_usage');
        const month = new Date().toISOString().slice(0, 7);
        await usage.updateOne(
            { api: 'odds-api', month },
            {
                $inc: { requestCount: 1 },
                $set: { remainingRequests: remaining, lastRequest: new Date() }
            },
            { upsert: true }
        );
    } catch (e) {
        console.error('Usage tracking error:', e);
    }
}
