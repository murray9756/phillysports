import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationData } from '@/services/notifications';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  expoPushToken: string | null;
  isEnabled: boolean;
  requestPermissions: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  isEnabled: false,
  requestPermissions: async () => false,
  unsubscribe: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Handle notification tap - navigate to appropriate screen
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as NotificationData;

    if (!data?.type) return;

    switch (data.type) {
      case 'message':
        if (data.conversationId) {
          router.push({
            pathname: '/messages/[id]',
            params: { id: data.conversationId, username: data.senderName },
          });
        } else {
          router.push('/messages');
        }
        break;

      case 'game_start':
      case 'game_score':
        if (data.gameThreadId) {
          router.push({
            pathname: '/game-threads/[id]',
            params: { id: data.gameThreadId },
          });
        }
        break;

      case 'forum_reply':
        if (data.postId) {
          router.push({
            pathname: '/forums/post/[id]',
            params: { id: data.postId },
          });
        }
        break;

      case 'club_update':
        if (data.clubId) {
          router.push({
            pathname: '/clubs/[id]',
            params: { id: data.clubId },
          });
        }
        break;

      case 'watch_party':
        if (data.partyId) {
          router.push({
            pathname: '/watch-parties/[id]',
            params: { id: data.partyId },
          });
        }
        break;

      case 'tailgate':
        if (data.tailgateId) {
          router.push({
            pathname: '/tailgates/[id]',
            params: { id: data.tailgateId },
          });
        }
        break;

      case 'raffle_winner':
        if (data.raffleId) {
          router.push({
            pathname: '/raffles/[id]',
            params: { id: data.raffleId },
          });
        }
        break;

      case 'poker_turn':
        if (data.tableId) {
          router.push({
            pathname: '/poker/table/[id]',
            params: { id: data.tableId },
          });
        }
        break;

      case 'pool_update':
        if (data.poolId) {
          router.push({
            pathname: '/pools/[id]',
            params: { id: data.poolId },
          });
        }
        break;

      default:
        router.push('/');
    }
  }, [router]);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setExpoPushToken(null);
      setIsEnabled(false);
      return;
    }

    let isMounted = true;
    let notificationListener: Notifications.Subscription;
    let responseListener: Notifications.Subscription;

    const setupNotifications = async () => {
      // Setup Android channels
      await notificationService.setupAndroidChannel();

      // Check current permission status
      const enabled = await notificationService.areNotificationsEnabled();
      if (isMounted) setIsEnabled(enabled);

      if (enabled) {
        // Register for push notifications
        const token = await notificationService.initialize();
        if (isMounted && token) {
          setExpoPushToken(token);
        }
      }
    };

    setupNotifications();

    // Listen for notification taps
    responseListener = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      isMounted = false;
      if (responseListener) {
        Notifications.removeNotificationSubscription(responseListener);
      }
    };
  }, [isAuthenticated, handleNotificationResponse]);

  // Request notification permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const token = await notificationService.registerForPushNotifications();
    if (token) {
      await notificationService.registerTokenWithServer(token);
      setExpoPushToken(token);
      setIsEnabled(true);
      return true;
    }
    return false;
  }, []);

  // Unsubscribe from notifications
  const unsubscribe = useCallback(async () => {
    await notificationService.unregisterDevice();
    setExpoPushToken(null);
    setIsEnabled(false);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        isEnabled,
        requestPermissions,
        unsubscribe,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  return useContext(NotificationContext);
}

export default NotificationProvider;
