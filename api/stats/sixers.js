// Sixers Historical Stats API
// GET: Returns cached career leader statistics

import { getCollection } from '../lib/mongodb.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache duration: 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

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
    const cache = await getCollection('team_stats_cache');
    const cachedStats = await cache.findOne({
      team: 'sixers',
      expiresAt: { $gt: new Date() }
    });

    if (cachedStats) {
      return res.status(200).json({
        points: cachedStats.points,
        rebounds: cachedStats.rebounds,
        assists: cachedStats.assists,
        steals: cachedStats.steals,
        blocks: cachedStats.blocks,
        games: cachedStats.games,
        fieldGoals: cachedStats.fieldGoals,
        threePointers: cachedStats.threePointers,
        freeThrows: cachedStats.freeThrows,
        lastUpdated: cachedStats.lastUpdated,
        source: cachedStats.source,
        cached: true
      });
    }

    // Fall back to static JSON file
    const staticDataPath = path.join(__dirname, '../../data/sixers-stats.json');

    if (fs.existsSync(staticDataPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));

      // Store in cache for future requests
      await cache.updateOne(
        { team: 'sixers' },
        {
          $set: {
            ...staticData,
            team: 'sixers',
            lastUpdated: staticData.lastUpdated || new Date().toISOString(),
            expiresAt: new Date(Date.now() + CACHE_DURATION_MS),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      return res.status(200).json({
        ...staticData,
        cached: false,
        fallback: true
      });
    }

    return res.status(404).json({ error: 'No stats data available' });

  } catch (error) {
    console.error('Sixers stats error:', error);

    // Last resort: try to read static file without caching
    try {
      const staticDataPath = path.join(__dirname, '../../data/sixers-stats.json');
      const staticData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
      return res.status(200).json({
        ...staticData,
        cached: false,
        fallback: true,
        dbError: true
      });
    } catch (fallbackError) {
      return res.status(500).json({ error: 'Failed to load stats' });
    }
  }
}
