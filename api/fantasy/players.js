// Fantasy Players API
// GET: Returns real players with DFS salaries from SportsDataIO
// Fallback to ESPN if no API key configured

// SportsDataIO API key - set in environment variable
const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;

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

    const { sport, date } = req.query;

    if (!sport) {
        return res.status(400).json({ error: 'Sport is required' });
    }

    try {
        let players;
        let source = 'espn';

        // Try SportsDataIO first if API key is configured
        if (SPORTSDATA_API_KEY) {
            try {
                players = await fetchPlayersFromSportsDataIO(sport.toUpperCase(), date);
                source = 'sportsdata';
            } catch (e) {
                console.error('SportsDataIO error, falling back to ESPN:', e.message);
                players = await fetchPlayersFromESPN(sport.toUpperCase());
            }
        } else {
            // Fallback to ESPN (no salaries)
            players = await fetchPlayersFromESPN(sport.toUpperCase());
        }

        return res.status(200).json({
            success: true,
            players,
            sport: sport.toUpperCase(),
            date: date || new Date().toISOString().split('T')[0],
            source
        });
    } catch (error) {
        console.error('Fantasy players error:', error);
        return res.status(500).json({ error: 'Failed to fetch players' });
    }
}

// Fetch players with DFS salaries from SportsDataIO
async function fetchPlayersFromSportsDataIO(sport, date) {
    const sportConfig = {
        NFL: { endpoint: 'nfl', season: '2024REG' },
        NBA: { endpoint: 'nba', season: '2025' },
        MLB: { endpoint: 'mlb', season: '2025' },
        NHL: { endpoint: 'nhl', season: '2025' }
    };

    const config = sportConfig[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    // Get the date for DFS projections (today if not specified)
    const targetDate = date || new Date().toISOString().split('T')[0];

    // SportsDataIO DFS Projections endpoint
    const url = `https://api.sportsdata.io/v3/${config.endpoint}/projections/json/DfsSlatesByDate/${targetDate}?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO API error: ${response.status}`);
    }

    const slates = await response.json();

    if (!slates || slates.length === 0) {
        // No slates for this date, try to get player list instead
        return await fetchPlayerListFromSportsDataIO(sport, config);
    }

    // Get the first slate's players (usually main slate)
    const mainSlate = slates.find(s => s.Operator === 'DraftKings') || slates[0];

    if (!mainSlate || !mainSlate.DfsSlateGames) {
        return await fetchPlayerListFromSportsDataIO(sport, config);
    }

    // Fetch player projections for this slate
    const playersUrl = `https://api.sportsdata.io/v3/${config.endpoint}/projections/json/DfsSlatePlayersBySlateID/${mainSlate.SlateID}?key=${SPORTSDATA_API_KEY}`;
    const playersResponse = await fetch(playersUrl);

    if (!playersResponse.ok) {
        throw new Error(`SportsDataIO players API error: ${playersResponse.status}`);
    }

    const slatePlayers = await playersResponse.json();

    return slatePlayers.map(player => ({
        id: player.PlayerID?.toString() || player.OperatorPlayerID,
        name: player.OperatorPlayerName || player.Name,
        position: player.OperatorPosition || player.Position,
        team: player.Team,
        teamAbbreviation: player.Team,
        salary: player.OperatorSalary || 5000,
        opponent: player.Opponent || 'TBD',
        projectedPoints: player.FantasyPoints || player.OperatorFantasyPoints || 0,
        imageUrl: null,
        gameTime: player.GameTime,
        slateId: mainSlate.SlateID
    }));
}

// Fetch general player list when no DFS slate is available
async function fetchPlayerListFromSportsDataIO(sport, config) {
    const url = `https://api.sportsdata.io/v3/${config.endpoint}/scores/json/Players?key=${SPORTSDATA_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`SportsDataIO players list error: ${response.status}`);
    }

    const players = await response.json();

    return players
        .filter(p => p.Status === 'Active')
        .slice(0, 500) // Limit to prevent too large response
        .map(player => ({
            id: player.PlayerID?.toString(),
            name: `${player.FirstName} ${player.LastName}`,
            position: player.Position,
            team: player.Team,
            teamAbbreviation: player.Team,
            salary: calculateSalaryFromPosition(sport, player.Position),
            opponent: 'TBD',
            projectedPoints: 0,
            imageUrl: player.PhotoUrl || null
        }));
}

function calculateSalaryFromPosition(sport, position) {
    const positionValues = {
        NFL: { QB: 7500, RB: 6500, WR: 6000, TE: 5000, K: 4500, DEF: 4000, default: 5000 },
        NBA: { PG: 7000, SG: 6500, SF: 6500, PF: 6000, C: 7000, default: 6000 },
        MLB: { SP: 9000, RP: 5000, C: 4500, '1B': 5000, '2B': 4500, '3B': 5000, SS: 5500, OF: 5000, default: 5000 },
        NHL: { C: 6000, LW: 5500, RW: 5500, D: 5000, G: 7000, default: 5500 }
    };

    const sportPos = positionValues[sport] || positionValues.NFL;
    return sportPos[position] || sportPos.default;
}

// Fetch real players from ESPN API
async function fetchPlayersFromESPN(sport) {
    const sportConfig = {
        NFL: { league: 'nfl', limit: 300 },
        NBA: { league: 'nba', limit: 200 },
        MLB: { league: 'mlb', limit: 300 },
        NHL: { league: 'nhl', limit: 200 }
    };

    const config = sportConfig[sport];
    if (!config) {
        throw new Error(`Unsupported sport: ${sport}`);
    }

    // ESPN Athletes API
    const url = `https://site.api.espn.com/apis/site/v2/sports/${getESPNSportPath(sport)}/athletes?limit=${config.limit}`;

    const response = await fetch(url);
    if (!response.ok) {
        // Fallback to team rosters approach
        return await fetchPlayersFromTeamRosters(sport);
    }

    const data = await response.json();

    if (!data.athletes || data.athletes.length === 0) {
        return await fetchPlayersFromTeamRosters(sport);
    }

    return data.athletes.map((athlete, index) => ({
        id: athlete.id,
        name: athlete.fullName || athlete.displayName,
        position: athlete.position?.abbreviation || 'UTIL',
        team: athlete.team?.displayName || 'Free Agent',
        teamAbbreviation: athlete.team?.abbreviation || 'FA',
        salary: calculateSalary(sport, athlete, index),
        opponent: 'TBD',
        projectedPoints: 0,
        imageUrl: athlete.headshot?.href || null
    }));
}

// Fetch players by getting team rosters
async function fetchPlayersFromTeamRosters(sport) {
    const teams = getTeamsForSport(sport);
    const allPlayers = [];

    for (const team of teams) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${getESPNSportPath(sport)}/teams/${team.id}/roster`;
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                const athletes = data.athletes || [];

                // Handle different roster structures
                let playerList = [];
                if (Array.isArray(athletes)) {
                    // Some sports return grouped by position
                    athletes.forEach(group => {
                        if (group.items) {
                            playerList = playerList.concat(group.items);
                        } else if (group.id) {
                            playerList.push(group);
                        }
                    });
                }

                playerList.forEach((athlete, index) => {
                    allPlayers.push({
                        id: athlete.id,
                        name: athlete.fullName || athlete.displayName,
                        position: athlete.position?.abbreviation || 'UTIL',
                        team: team.name,
                        teamAbbreviation: team.abbreviation,
                        salary: calculateSalary(sport, athlete, allPlayers.length),
                        opponent: 'TBD',
                        projectedPoints: 0,
                        imageUrl: athlete.headshot?.href || null
                    });
                });
            }
        } catch (e) {
            console.error(`Error fetching roster for ${team.name}:`, e);
        }
    }

    return allPlayers;
}

function getESPNSportPath(sport) {
    const paths = {
        NFL: 'football/nfl',
        NBA: 'basketball/nba',
        MLB: 'baseball/mlb',
        NHL: 'hockey/nhl'
    };
    return paths[sport] || 'football/nfl';
}

function getTeamsForSport(sport) {
    // All teams for each league
    const teams = {
        NFL: [
            { id: '21', name: 'Philadelphia Eagles', abbreviation: 'PHI' },
            { id: '6', name: 'Dallas Cowboys', abbreviation: 'DAL' },
            { id: '19', name: 'New York Giants', abbreviation: 'NYG' },
            { id: '28', name: 'Washington Commanders', abbreviation: 'WAS' },
            { id: '1', name: 'Arizona Cardinals', abbreviation: 'ARI' },
            { id: '2', name: 'Atlanta Falcons', abbreviation: 'ATL' },
            { id: '3', name: 'Baltimore Ravens', abbreviation: 'BAL' },
            { id: '4', name: 'Buffalo Bills', abbreviation: 'BUF' },
            { id: '5', name: 'Carolina Panthers', abbreviation: 'CAR' },
            { id: '7', name: 'Chicago Bears', abbreviation: 'CHI' },
            { id: '8', name: 'Cincinnati Bengals', abbreviation: 'CIN' },
            { id: '9', name: 'Cleveland Browns', abbreviation: 'CLE' },
            { id: '10', name: 'Denver Broncos', abbreviation: 'DEN' },
            { id: '11', name: 'Detroit Lions', abbreviation: 'DET' },
            { id: '12', name: 'Green Bay Packers', abbreviation: 'GB' },
            { id: '13', name: 'Houston Texans', abbreviation: 'HOU' },
            { id: '14', name: 'Indianapolis Colts', abbreviation: 'IND' },
            { id: '15', name: 'Jacksonville Jaguars', abbreviation: 'JAX' },
            { id: '16', name: 'Kansas City Chiefs', abbreviation: 'KC' },
            { id: '17', name: 'Las Vegas Raiders', abbreviation: 'LV' },
            { id: '18', name: 'Los Angeles Chargers', abbreviation: 'LAC' },
            { id: '20', name: 'New England Patriots', abbreviation: 'NE' },
            { id: '22', name: 'Los Angeles Rams', abbreviation: 'LAR' },
            { id: '23', name: 'New Orleans Saints', abbreviation: 'NO' },
            { id: '24', name: 'New York Jets', abbreviation: 'NYJ' },
            { id: '25', name: 'Pittsburgh Steelers', abbreviation: 'PIT' },
            { id: '26', name: 'San Francisco 49ers', abbreviation: 'SF' },
            { id: '27', name: 'Seattle Seahawks', abbreviation: 'SEA' },
            { id: '29', name: 'Tampa Bay Buccaneers', abbreviation: 'TB' },
            { id: '30', name: 'Tennessee Titans', abbreviation: 'TEN' },
            { id: '33', name: 'Miami Dolphins', abbreviation: 'MIA' },
            { id: '34', name: 'Minnesota Vikings', abbreviation: 'MIN' }
        ],
        NBA: [
            { id: '20', name: 'Philadelphia 76ers', abbreviation: 'PHI' },
            { id: '2', name: 'Boston Celtics', abbreviation: 'BOS' },
            { id: '17', name: 'Brooklyn Nets', abbreviation: 'BKN' },
            { id: '18', name: 'New York Knicks', abbreviation: 'NYK' },
            { id: '1', name: 'Atlanta Hawks', abbreviation: 'ATL' },
            { id: '4', name: 'Chicago Bulls', abbreviation: 'CHI' },
            { id: '5', name: 'Cleveland Cavaliers', abbreviation: 'CLE' },
            { id: '8', name: 'Detroit Pistons', abbreviation: 'DET' },
            { id: '11', name: 'Indiana Pacers', abbreviation: 'IND' },
            { id: '15', name: 'Miami Heat', abbreviation: 'MIA' },
            { id: '16', name: 'Milwaukee Bucks', abbreviation: 'MIL' },
            { id: '19', name: 'Orlando Magic', abbreviation: 'ORL' },
            { id: '27', name: 'Toronto Raptors', abbreviation: 'TOR' },
            { id: '30', name: 'Washington Wizards', abbreviation: 'WAS' },
            { id: '6', name: 'Dallas Mavericks', abbreviation: 'DAL' },
            { id: '7', name: 'Denver Nuggets', abbreviation: 'DEN' },
            { id: '9', name: 'Golden State Warriors', abbreviation: 'GSW' },
            { id: '10', name: 'Houston Rockets', abbreviation: 'HOU' },
            { id: '12', name: 'Los Angeles Clippers', abbreviation: 'LAC' },
            { id: '13', name: 'Los Angeles Lakers', abbreviation: 'LAL' },
            { id: '14', name: 'Memphis Grizzlies', abbreviation: 'MEM' },
            { id: '21', name: 'Phoenix Suns', abbreviation: 'PHX' },
            { id: '22', name: 'Portland Trail Blazers', abbreviation: 'POR' },
            { id: '23', name: 'Sacramento Kings', abbreviation: 'SAC' },
            { id: '24', name: 'San Antonio Spurs', abbreviation: 'SAS' },
            { id: '25', name: 'Oklahoma City Thunder', abbreviation: 'OKC' },
            { id: '26', name: 'Utah Jazz', abbreviation: 'UTA' },
            { id: '3', name: 'Charlotte Hornets', abbreviation: 'CHA' },
            { id: '28', name: 'New Orleans Pelicans', abbreviation: 'NOP' },
            { id: '29', name: 'Minnesota Timberwolves', abbreviation: 'MIN' }
        ],
        MLB: [
            { id: '22', name: 'Philadelphia Phillies', abbreviation: 'PHI' },
            { id: '21', name: 'New York Mets', abbreviation: 'NYM' },
            { id: '15', name: 'Atlanta Braves', abbreviation: 'ATL' },
            { id: '28', name: 'Miami Marlins', abbreviation: 'MIA' },
            { id: '20', name: 'Washington Nationals', abbreviation: 'WSH' },
            { id: '10', name: 'New York Yankees', abbreviation: 'NYY' },
            { id: '1', name: 'Baltimore Orioles', abbreviation: 'BAL' },
            { id: '2', name: 'Boston Red Sox', abbreviation: 'BOS' },
            { id: '30', name: 'Tampa Bay Rays', abbreviation: 'TB' },
            { id: '14', name: 'Toronto Blue Jays', abbreviation: 'TOR' },
            { id: '5', name: 'Chicago White Sox', abbreviation: 'CWS' },
            { id: '6', name: 'Cleveland Guardians', abbreviation: 'CLE' },
            { id: '7', name: 'Detroit Tigers', abbreviation: 'DET' },
            { id: '9', name: 'Kansas City Royals', abbreviation: 'KC' },
            { id: '8', name: 'Minnesota Twins', abbreviation: 'MIN' },
            { id: '18', name: 'Houston Astros', abbreviation: 'HOU' },
            { id: '3', name: 'Los Angeles Angels', abbreviation: 'LAA' },
            { id: '11', name: 'Oakland Athletics', abbreviation: 'OAK' },
            { id: '12', name: 'Seattle Mariners', abbreviation: 'SEA' },
            { id: '13', name: 'Texas Rangers', abbreviation: 'TEX' },
            { id: '4', name: 'Chicago Cubs', abbreviation: 'CHC' },
            { id: '17', name: 'Cincinnati Reds', abbreviation: 'CIN' },
            { id: '23', name: 'Pittsburgh Pirates', abbreviation: 'PIT' },
            { id: '24', name: 'St. Louis Cardinals', abbreviation: 'STL' },
            { id: '16', name: 'Milwaukee Brewers', abbreviation: 'MIL' },
            { id: '29', name: 'Arizona Diamondbacks', abbreviation: 'ARI' },
            { id: '27', name: 'Colorado Rockies', abbreviation: 'COL' },
            { id: '19', name: 'Los Angeles Dodgers', abbreviation: 'LAD' },
            { id: '25', name: 'San Diego Padres', abbreviation: 'SD' },
            { id: '26', name: 'San Francisco Giants', abbreviation: 'SF' }
        ],
        NHL: [
            { id: '15', name: 'Philadelphia Flyers', abbreviation: 'PHI' },
            { id: '5', name: 'Pittsburgh Penguins', abbreviation: 'PIT' },
            { id: '4', name: 'New York Rangers', abbreviation: 'NYR' },
            { id: '1', name: 'New Jersey Devils', abbreviation: 'NJD' },
            { id: '2', name: 'New York Islanders', abbreviation: 'NYI' },
            { id: '7', name: 'Boston Bruins', abbreviation: 'BOS' },
            { id: '8', name: 'Buffalo Sabres', abbreviation: 'BUF' },
            { id: '9', name: 'Detroit Red Wings', abbreviation: 'DET' },
            { id: '10', name: 'Florida Panthers', abbreviation: 'FLA' },
            { id: '11', name: 'Montreal Canadiens', abbreviation: 'MTL' },
            { id: '12', name: 'Ottawa Senators', abbreviation: 'OTT' },
            { id: '14', name: 'Tampa Bay Lightning', abbreviation: 'TBL' },
            { id: '13', name: 'Toronto Maple Leafs', abbreviation: 'TOR' },
            { id: '6', name: 'Carolina Hurricanes', abbreviation: 'CAR' },
            { id: '3', name: 'Washington Capitals', abbreviation: 'WSH' },
            { id: '29', name: 'Columbus Blue Jackets', abbreviation: 'CBJ' },
            { id: '16', name: 'Chicago Blackhawks', abbreviation: 'CHI' },
            { id: '17', name: 'Colorado Avalanche', abbreviation: 'COL' },
            { id: '18', name: 'Dallas Stars', abbreviation: 'DAL' },
            { id: '19', name: 'Minnesota Wild', abbreviation: 'MIN' },
            { id: '20', name: 'Nashville Predators', abbreviation: 'NSH' },
            { id: '21', name: 'St. Louis Blues', abbreviation: 'STL' },
            { id: '22', name: 'Winnipeg Jets', abbreviation: 'WPG' },
            { id: '23', name: 'Anaheim Ducks', abbreviation: 'ANA' },
            { id: '24', name: 'Arizona Coyotes', abbreviation: 'ARI' },
            { id: '25', name: 'Calgary Flames', abbreviation: 'CGY' },
            { id: '26', name: 'Edmonton Oilers', abbreviation: 'EDM' },
            { id: '27', name: 'Los Angeles Kings', abbreviation: 'LAK' },
            { id: '28', name: 'San Jose Sharks', abbreviation: 'SJS' },
            { id: '30', name: 'Seattle Kraken', abbreviation: 'SEA' },
            { id: '54', name: 'Vegas Golden Knights', abbreviation: 'VGK' },
            { id: '55', name: 'Vancouver Canucks', abbreviation: 'VAN' }
        ]
    };

    return teams[sport] || teams.NFL;
}

// Calculate salary based on position importance and some variance
function calculateSalary(sport, athlete, index) {
    const positionValues = {
        NFL: { QB: 8000, RB: 6500, WR: 6000, TE: 5000, K: 4500, DEF: 4000, default: 5000 },
        NBA: { PG: 7000, SG: 6500, SF: 6500, PF: 6000, C: 7000, G: 6500, F: 6000, default: 6000 },
        MLB: { SP: 9000, RP: 5000, C: 4500, '1B': 5000, '2B': 4500, '3B': 5000, SS: 5500, OF: 5000, DH: 5000, default: 5000 },
        NHL: { C: 6000, LW: 5500, RW: 5500, W: 5500, D: 5000, G: 7000, default: 5500 }
    };

    const sportPos = positionValues[sport] || positionValues.NFL;
    const pos = athlete.position?.abbreviation || 'default';
    const baseValue = sportPos[pos] || sportPos.default;

    // Add variance based on index (simulates player ranking)
    const variance = Math.floor(Math.random() * 3000) - 1000;
    const salary = Math.max(3000, Math.min(12000, baseValue + variance));

    // Round to nearest 100
    return Math.round(salary / 100) * 100;
}
