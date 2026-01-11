// NHL Standings API - Metropolitan Division
import { getCollection } from '../lib/mongodb.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

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

  try {
    // Try to get cached data from MongoDB
    const cache = await getCollection('standings_cache');
    const cachedData = await cache.findOne({
      league: 'nhl',
      expiresAt: { $gt: new Date() }
    });

    if (cachedData) {
      return res.status(200).json({
        standings: cachedData.standings,
        division: cachedData.division,
        lastUpdated: cachedData.lastUpdated,
        cached: true
      });
    }

    // Fall back to static JSON file
    const staticDataPath = path.join(__dirname, '../../data/nhl-standings.json');

    if (fs.existsSync(staticDataPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));

      // Store in cache for future requests
      await cache.updateOne(
        { league: 'nhl' },
        {
          $set: {
            ...staticData,
            league: 'nhl',
            expiresAt: new Date(Date.now() + CACHE_DURATION_MS),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      return res.status(200).json({
        standings: staticData.standings,
        division: staticData.division,
        lastUpdated: staticData.lastUpdated,
        cached: false
      });
    }

    return res.status(404).json({ error: 'No standings data available' });

  } catch (error) {
    console.error('NHL standings error:', error);

    // Last resort: try to read static file without caching
    try {
      const staticDataPath = path.join(__dirname, '../../data/nhl-standings.json');
      const staticData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
      return res.status(200).json({
        standings: staticData.standings,
        division: staticData.division,
        lastUpdated: staticData.lastUpdated,
        cached: false,
        dbError: true
      });
    } catch (fallbackError) {
      return res.status(500).json({ error: 'Failed to load standings' });
    }
  }
}
