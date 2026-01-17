import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { useTheme } from '@/context/ThemeContext';
import { useNotificationContext } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface NotificationPreferences {
  gameAlerts: boolean;
  scoreUpdates: boolean;
  messages: boolean;
  forumReplies: boolean;
  clubUpdates: boolean;
  eventReminders: boolean;
  pokerTurns: boolean;
  raffleUpdates: boolean;
  dailyDigest: boolean;
}

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const { isEnabled, requestPermissions, expoPushToken } = useNotificationContext();
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    gameAlerts: true,
    scoreUpdates: true,
    messages: true,
    forumReplies: true,
    clubUpdates: true,
    eventReminders: true,
    pokerTurns: true,
    raffleUpdates: true,
    dailyDigest: false,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/notifications/preferences');
      if (response.data.preferences) {
        setPreferences(response.data.preferences);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      await api.put('/notifications/preferences', { [key]: value });
    } catch (error) {
      console.error('Failed to save preference:', error);
      // Revert on error
      setPreferences(preferences);
      Alert.alert('Error', 'Failed to save preference');
    }
  };

  const enableNotifications = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive alerts.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const openSystemSettings = () => {
    Linking.openSettings();
  };

  const renderToggle = (
    key: keyof NotificationPreferences,
    label: string,
    description: string,
    icon: keyof typeof Ionicons.glyphMap
  ) => (
    <View style={[styles.settingRow, { borderColor: colors.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.settingDescription, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Switch
        value={preferences[key]}
        onValueChange={(value) => savePreference(key, value)}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
        disabled={!isEnabled}
      />
    </View>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Notifications' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Enable/Disable Banner */}
        {!isEnabled ? (
          <TouchableOpacity
            style={[styles.enableBanner, { backgroundColor: colors.primary }]}
            onPress={enableNotifications}
          >
            <Ionicons name="notifications-off" size={24} color="#fff" />
            <View style={styles.enableBannerText}>
              <Text style={styles.enableTitle}>Notifications Disabled</Text>
              <Text style={styles.enableSubtitle}>Tap to enable push notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.enabledBanner, { backgroundColor: '#4CAF50' }]}>
            <Ionicons name="notifications" size={24} color="#fff" />
            <Text style={styles.enabledText}>Push notifications are enabled</Text>
          </View>
        )}

        {/* Game Alerts Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Game Alerts</Text>
          {renderToggle(
            'gameAlerts',
            'Game Start Alerts',
            'Get notified when games are about to start',
            'american-football'
          )}
          {renderToggle(
            'scoreUpdates',
            'Live Score Updates',
            'Receive updates on scoring plays',
            'trophy'
          )}
        </View>

        {/* Social Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Social</Text>
          {renderToggle(
            'messages',
            'Direct Messages',
            'New messages from other users',
            'chatbubble'
          )}
          {renderToggle(
            'forumReplies',
            'Forum Replies',
            'Replies to your posts and comments',
            'chatbubbles'
          )}
          {renderToggle(
            'clubUpdates',
            'Club Updates',
            'News from clubs you\'ve joined',
            'shield'
          )}
        </View>

        {/* Events Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Events</Text>
          {renderToggle(
            'eventReminders',
            'Event Reminders',
            'Watch parties and tailgates you\'ve RSVP\'d to',
            'calendar'
          )}
        </View>

        {/* Gaming Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Gaming</Text>
          {renderToggle(
            'pokerTurns',
            'Poker Turn Alerts',
            'It\'s your turn at the poker table',
            'game-controller'
          )}
          {renderToggle(
            'raffleUpdates',
            'Raffle Updates',
            'Winner announcements and ending soon alerts',
            'ticket'
          )}
        </View>

        {/* Digest Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Digest</Text>
          {renderToggle(
            'dailyDigest',
            'Daily Digest',
            'Summary of the day\'s top news and scores',
            'newspaper'
          )}
        </View>

        {/* System Settings Link */}
        <TouchableOpacity
          style={[styles.systemSettingsButton, { borderColor: colors.border }]}
          onPress={openSystemSettings}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.systemSettingsText, { color: colors.textMuted }]}>
            Open System Notification Settings
          </Text>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Debug Info (dev only) */}
        {__DEV__ && expoPushToken && (
          <View style={[styles.debugSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.debugTitle, { color: colors.textMuted }]}>Push Token (Debug)</Text>
            <Text style={[styles.debugToken, { color: colors.text }]} selectable>
              {expoPushToken}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  enableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  enableBannerText: {
    flex: 1,
  },
  enableTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  enableSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  enabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    margin: 16,
    borderRadius: 12,
    gap: 10,
  },
  enabledText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 16,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  systemSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  systemSettingsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  debugSection: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  debugToken: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
