// Pusher Channel Authentication
// POST: Authenticate user for private/presence channels

import { authenticate } from '../lib/auth.js';
import { getPusher } from '../lib/pusher.js';

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
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const pusher = getPusher();
    if (!pusher) {
      return res.status(503).json({ error: 'Real-time service not configured' });
    }

    const { socket_id, channel_name } = req.body;

    if (!socket_id || !channel_name) {
      return res.status(400).json({ error: 'Missing socket_id or channel_name' });
    }

    // Validate channel access
    if (channel_name.startsWith('private-user-')) {
      // Private user channel - only allow access to own channel
      const channelUserId = channel_name.replace('private-user-', '');
      if (channelUserId !== user.userId) {
        return res.status(403).json({ error: 'Access denied to this channel' });
      }

      const auth = pusher.authorizeChannel(socket_id, channel_name);
      return res.status(200).json(auth);
    }

    if (channel_name.startsWith('presence-table-')) {
      // Presence channel for table - include user data
      const presenceData = {
        user_id: user.userId,
        user_info: {
          username: user.username
        }
      };

      const auth = pusher.authorizeChannel(socket_id, channel_name, presenceData);
      return res.status(200).json(auth);
    }

    if (channel_name.startsWith('table-')) {
      // Public table channel - no special auth needed, just validate format
      const auth = pusher.authorizeChannel(socket_id, channel_name);
      return res.status(200).json(auth);
    }

    return res.status(403).json({ error: 'Invalid channel' });

  } catch (error) {
    console.error('Pusher auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
