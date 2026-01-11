// Pro Football Reference Scraper
// Fetches and parses Eagles career stats from PFR

import * as cheerio from 'cheerio';

const PFR_BASE_URL = 'https://www.pro-football-reference.com/teams/phi';

const CATEGORY_URLS = {
  passing: `${PFR_BASE_URL}/career-passing.htm`,
  rushing: `${PFR_BASE_URL}/career-rushing.htm`,
  receiving: `${PFR_BASE_URL}/career-receiving.htm`,
  scoring: `${PFR_BASE_URL}/career-scoring.htm`,
  defense: `${PFR_BASE_URL}/career-defense.htm`,
  returns: `${PFR_BASE_URL}/career-returns.htm`,
  kicking: `${PFR_BASE_URL}/career-kicking.htm`,
  punting: `${PFR_BASE_URL}/career-punting.htm`
};

/**
 * Fetch HTML from PFR with proper headers
 */
async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PhillySports.com Stats Bot/1.0 (https://phillysports.com; contact@phillysports.com)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

/**
 * Parse passing stats from PFR HTML
 */
function parsePassing($, limit = 10) {
  const players = [];
  const table = $('#passing');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();

    players.push({
      rank: i + 1,
      player,
      years: years.replace(/^\d{2}/, '').replace(/-\d{2}/, match => match), // Keep full years
      yards: parseInt($row.find('td[data-stat="pass_yds"]').text().replace(/,/g, '')) || 0,
      touchdowns: parseInt($row.find('td[data-stat="pass_td"]').text()) || 0,
      interceptions: parseInt($row.find('td[data-stat="pass_int"]').text()) || 0,
      rating: parseFloat($row.find('td[data-stat="pass_rating"]').text()) || 0
    });
  });

  return players;
}

/**
 * Parse rushing stats from PFR HTML
 */
function parseRushing($, limit = 10) {
  const players = [];
  const table = $('#rushing_and_receiving');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();

    players.push({
      rank: i + 1,
      player,
      years,
      attempts: parseInt($row.find('td[data-stat="rush_att"]').text().replace(/,/g, '')) || 0,
      yards: parseInt($row.find('td[data-stat="rush_yds"]').text().replace(/,/g, '')) || 0,
      touchdowns: parseInt($row.find('td[data-stat="rush_td"]').text()) || 0,
      average: parseFloat($row.find('td[data-stat="rush_yds_per_att"]').text()) || 0
    });
  });

  return players;
}

/**
 * Parse receiving stats from PFR HTML
 */
function parseReceiving($, limit = 10) {
  const players = [];
  const table = $('#receiving');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();

    players.push({
      rank: i + 1,
      player,
      years,
      receptions: parseInt($row.find('td[data-stat="rec"]').text().replace(/,/g, '')) || 0,
      yards: parseInt($row.find('td[data-stat="rec_yds"]').text().replace(/,/g, '')) || 0,
      touchdowns: parseInt($row.find('td[data-stat="rec_td"]').text()) || 0,
      average: parseFloat($row.find('td[data-stat="rec_yds_per_rec"]').text()) || 0
    });
  });

  return players;
}

/**
 * Parse scoring stats from PFR HTML
 */
function parseScoring($, limit = 10) {
  const players = [];
  const table = $('#scoring');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();

    players.push({
      rank: i + 1,
      player,
      years,
      points: parseInt($row.find('td[data-stat="pts"]').text().replace(/,/g, '')) || 0,
      touchdowns: parseInt($row.find('td[data-stat="all_td"]').text()) || 0,
      fieldGoals: parseInt($row.find('td[data-stat="fgm"]').text()) || 0,
      extraPoints: parseInt($row.find('td[data-stat="xpm"]').text()) || 0
    });
  });

  return players;
}

/**
 * Parse defense stats from PFR HTML
 */
function parseDefense($, limit = 10) {
  const players = [];
  const table = $('#defense');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();

    players.push({
      rank: i + 1,
      player,
      years,
      sacks: parseFloat($row.find('td[data-stat="sacks"]').text()) || 0,
      interceptions: parseInt($row.find('td[data-stat="def_int"]').text()) || 0,
      forcedFumbles: parseInt($row.find('td[data-stat="fumbles_forced"]').text()) || 0,
      tackles: parseInt($row.find('td[data-stat="tackles_combined"]').text()) || 0
    });
  });

  return players;
}

/**
 * Parse returns stats from PFR HTML
 */
function parseReturns($, limit = 10) {
  const players = [];
  const table = $('#returns');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();

    players.push({
      rank: i + 1,
      player,
      years,
      kickReturnYards: parseInt($row.find('td[data-stat="kick_ret_yds"]').text().replace(/,/g, '')) || 0,
      puntReturnYards: parseInt($row.find('td[data-stat="punt_ret_yds"]').text().replace(/,/g, '')) || 0,
      touchdowns: parseInt($row.find('td[data-stat="kick_ret_td"]').text()) + parseInt($row.find('td[data-stat="punt_ret_td"]').text()) || 0
    });
  });

  return players;
}

/**
 * Parse kicking stats from PFR HTML
 */
function parseKicking($, limit = 10) {
  const players = [];
  const table = $('#kicking');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();
    const fgm = parseInt($row.find('td[data-stat="fgm"]').text()) || 0;
    const fga = parseInt($row.find('td[data-stat="fga"]').text()) || 0;

    players.push({
      rank: i + 1,
      player,
      years,
      fieldGoalsMade: fgm,
      fieldGoalsAttempted: fga,
      percentage: fga > 0 ? parseFloat((fgm / fga * 100).toFixed(1)) : 0,
      points: parseInt($row.find('td[data-stat="pts"]').text().replace(/,/g, '')) || 0
    });
  });

  return players;
}

/**
 * Parse punting stats from PFR HTML
 */
function parsePunting($, limit = 10) {
  const players = [];
  const table = $('#punting');

  table.find('tbody tr').each((i, row) => {
    if (i >= limit) return false;
    if ($(row).hasClass('thead')) return;

    const $row = $(row);
    const player = $row.find('td[data-stat="player"] a').text().trim();
    if (!player) return;

    const years = $row.find('td[data-stat="year_min"]').text() + '-' + $row.find('td[data-stat="year_max"]').text();

    players.push({
      rank: i + 1,
      player,
      years,
      punts: parseInt($row.find('td[data-stat="punt"]').text().replace(/,/g, '')) || 0,
      yards: parseInt($row.find('td[data-stat="punt_yds"]').text().replace(/,/g, '')) || 0,
      average: parseFloat($row.find('td[data-stat="punt_yds_per_punt"]').text()) || 0
    });
  });

  return players;
}

/**
 * Scrape a single category from PFR
 */
export async function scrapeCategory(category) {
  const url = CATEGORY_URLS[category];
  if (!url) throw new Error(`Unknown category: ${category}`);

  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const parsers = {
    passing: parsePassing,
    rushing: parseRushing,
    receiving: parseReceiving,
    scoring: parseScoring,
    defense: parseDefense,
    returns: parseReturns,
    kicking: parseKicking,
    punting: parsePunting
  };

  return parsers[category]($);
}

/**
 * Scrape all categories from PFR
 */
export async function scrapeAllCategories() {
  const results = {};

  for (const category of Object.keys(CATEGORY_URLS)) {
    try {
      results[category] = await scrapeCategory(category);
      // Small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error scraping ${category}:`, error.message);
      results[category] = [];
    }
  }

  results.lastUpdated = new Date().toISOString();
  results.source = 'Pro-Football-Reference.com';

  return results;
}

export { CATEGORY_URLS };
