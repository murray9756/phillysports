// Eagles Stats Refresh API
// POST: Admin-only endpoint to refresh stats from Pro Football Reference

import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';
import { scrapeAllCategories } from '../../lib/stats/scraper.js';

// Cache duration: 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require admin authentication
    const user = await authenticate(req);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Scrape fresh data from Pro Football Reference
    console.log('Starting PFR scrape for Eagles stats...');
    const freshData = await scrapeAllCategories();

    // Validate we got data
    const categories = ['passing', 'rushing', 'receiving', 'scoring', 'defense', 'returns', 'kicking', 'punting'];
    let totalPlayers = 0;
    for (const cat of categories) {
      totalPlayers += (freshData[cat]?.length || 0);
    }

    if (totalPlayers === 0) {
      return res.status(500).json({
        error: 'Scrape returned no data - PFR may be blocking requests',
        suggestion: 'Try again later or update static data manually'
      });
    }

    // Store in cache
    const cache = await getCollection('team_stats_cache');
    await cache.updateOne(
      { team: 'eagles' },
      {
        $set: {
          team: 'eagles',
          ...freshData,
          expiresAt: new Date(Date.now() + CACHE_DURATION_MS),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Eagles stats refreshed from Pro Football Reference',
      playersScraped: totalPlayers,
      categories: categories.map(cat => ({
        name: cat,
        count: freshData[cat]?.length || 0
      })),
      lastUpdated: freshData.lastUpdated,
      expiresAt: new Date(Date.now() + CACHE_DURATION_MS).toISOString()
    });

  } catch (error) {
    console.error('Eagles stats refresh error:', error);
    return res.status(500).json({
      error: 'Failed to refresh stats',
      message: error.message
    });
  }
}
