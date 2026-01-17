import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationData } from '@/services/notifications';
import { useAuth } from '@/context/AuthContext';

export function useNotifications() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

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
        // Default to home/notifications
        router.push('/');
    }
  }, [router]);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const setupNotifications = async () => {
      // Setup Android channels
      await notificationService.setupAndroidChannel();

      // Register for push notifications
      const token = await notificationService.initialize();
      if (isMounted && token) {
        setExpoPushToken(token);
      }
    };

    setupNotifications();

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (isMounted) {
          setNotification(notification);
        }
      }
    );

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      isMounted = false;
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [isAuthenticated, handleNotificationResponse]);

  // Schedule a local notification
  const scheduleNotification = useCallback(
    async (title: string, body: string, data?: NotificationData) => {
      return await notificationService.scheduleLocalNotification(title, body, data);
    },
    []
  );

  // Clear badge count
  const clearBadge = useCallback(async () => {
    await notificationService.setBadgeCount(0);
  }, []);

  // Check if notifications are enabled
  const checkPermissions = useCallback(async () => {
    return await notificationService.areNotificationsEnabled();
  }, []);

  return {
    expoPushToken,
    notification,
    scheduleNotification,
    clearBadge,
    checkPermissions,
  };
}

export default useNotifications;
