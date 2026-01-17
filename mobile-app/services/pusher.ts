import Pusher from 'pusher-js';
import { getToken } from './api';

// Pusher configuration
const PUSHER_KEY = process.env.EXPO_PUBLIC_PUSHER_KEY || 'YOUR_PUSHER_KEY';
const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER || 'us2';
const API_URL = 'https://phillysports.com/api';

let pusherClient: Pusher | null = null;

// Initialize Pusher client
export const initPusher = async (): Promise<Pusher> => {
  if (pusherClient) {
    return pusherClient;
  }

  const token = await getToken();

  pusherClient = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    authEndpoint: `${API_URL}/pusher/auth`,
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    },
  });

  // Log connection state changes
  pusherClient.connection.bind('state_change', (states: { current: string; previous: string }) => {
    console.log('Pusher state:', states.previous, '->', states.current);
  });

  pusherClient.connection.bind('error', (err: any) => {
    console.error('Pusher error:', err);
  });

  return pusherClient;
};

// Get existing client or initialize
export const getPusher = async (): Promise<Pusher> => {
  if (pusherClient && pusherClient.connection.state === 'connected') {
    return pusherClient;
  }
  return initPusher();
};

// Disconnect and cleanup
export const disconnectPusher = () => {
  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }
};

// Subscribe to a public channel
export const subscribeToChannel = async (channelName: string) => {
  const pusher = await getPusher();
  return pusher.subscribe(channelName);
};

// Subscribe to a private channel (requires auth)
export const subscribeToPrivateChannel = async (channelName: string) => {
  const pusher = await getPusher();
  return pusher.subscribe(`private-${channelName}`);
};

// Subscribe to presence channel (for poker tables, etc.)
export const subscribeToPresenceChannel = async (channelName: string) => {
  const pusher = await getPusher();
  return pusher.subscribe(`presence-${channelName}`);
};

// Unsubscribe from a channel
export const unsubscribeFromChannel = async (channelName: string) => {
  const pusher = await getPusher();
  pusher.unsubscribe(channelName);
};

// ============ POKER-SPECIFIC SUBSCRIPTIONS ============

interface PokerTableCallbacks {
  onGameState?: (data: any) => void;
  onPlayerAction?: (data: any) => void;
  onCommunityCards?: (data: any) => void;
  onHoleCards?: (data: any) => void;
  onPlayerJoined?: (data: any) => void;
  onPlayerLeft?: (data: any) => void;
  onYourTurn?: (data: any) => void;
  onHandComplete?: (data: any) => void;
}

export const subscribeToPokerTable = async (
  tableId: string,
  userId: string,
  callbacks: PokerTableCallbacks
) => {
  const pusher = await getPusher();

  // Public table channel for game state
  const tableChannel = pusher.subscribe(`table-${tableId}`);

  if (callbacks.onGameState) {
    tableChannel.bind('game-state', callbacks.onGameState);
  }
  if (callbacks.onPlayerAction) {
    tableChannel.bind('player-action', callbacks.onPlayerAction);
  }
  if (callbacks.onCommunityCards) {
    tableChannel.bind('community-cards', callbacks.onCommunityCards);
  }
  if (callbacks.onPlayerJoined) {
    tableChannel.bind('player-joined', callbacks.onPlayerJoined);
  }
  if (callbacks.onPlayerLeft) {
    tableChannel.bind('player-left', callbacks.onPlayerLeft);
  }
  if (callbacks.onHandComplete) {
    tableChannel.bind('hand-complete', callbacks.onHandComplete);
  }

  // Private user channel for hole cards and turn notifications
  const userChannel = pusher.subscribe(`private-user-${userId}`);

  if (callbacks.onHoleCards) {
    userChannel.bind('hole-cards', callbacks.onHoleCards);
  }
  if (callbacks.onYourTurn) {
    userChannel.bind('your-turn', callbacks.onYourTurn);
  }

  return {
    tableChannel,
    userChannel,
    unsubscribe: () => {
      pusher.unsubscribe(`table-${tableId}`);
      pusher.unsubscribe(`private-user-${userId}`);
    },
  };
};

// ============ GAME THREAD / CHAT SUBSCRIPTIONS ============

interface ChatCallbacks {
  onMessage?: (data: any) => void;
  onReaction?: (data: any) => void;
  onUserJoined?: (data: any) => void;
  onUserLeft?: (data: any) => void;
}

export const subscribeToGameThread = async (
  threadId: string,
  callbacks: ChatCallbacks
) => {
  const pusher = await getPusher();
  const channel = pusher.subscribe(`thread-${threadId}`);

  if (callbacks.onMessage) {
    channel.bind('new-message', callbacks.onMessage);
  }
  if (callbacks.onReaction) {
    channel.bind('reaction', callbacks.onReaction);
  }
  if (callbacks.onUserJoined) {
    channel.bind('user-joined', callbacks.onUserJoined);
  }
  if (callbacks.onUserLeft) {
    channel.bind('user-left', callbacks.onUserLeft);
  }

  return {
    channel,
    unsubscribe: () => {
      pusher.unsubscribe(`thread-${threadId}`);
    },
  };
};

// ============ NOTIFICATION SUBSCRIPTIONS ============

export const subscribeToUserNotifications = async (
  userId: string,
  onNotification: (data: any) => void
) => {
  const pusher = await getPusher();
  const channel = pusher.subscribe(`private-user-${userId}`);

  channel.bind('notification', onNotification);

  return {
    channel,
    unsubscribe: () => {
      pusher.unsubscribe(`private-user-${userId}`);
    },
  };
};

export default {
  initPusher,
  getPusher,
  disconnectPusher,
  subscribeToChannel,
  subscribeToPrivateChannel,
  subscribeToPresenceChannel,
  unsubscribeFromChannel,
  subscribeToPokerTable,
  subscribeToGameThread,
  subscribeToUserNotifications,
};
