import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useBiometrics } from '@/hooks/useBiometrics';

export default function SecuritySettingsScreen() {
  const { colors } = useTheme();
  const { user, enableBiometricLogin } = useAuth();
  const {
    isAvailable,
    isEnabled,
    biometricName,
    biometricType,
    storedEmail,
    loading: biometricLoading,
    enable,
    disable,
    refresh,
  } = useBiometrics();

  const [toggling, setToggling] = useState(false);

  const handleToggleBiometric = async (value: boolean) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to change this setting');
      return;
    }

    setToggling(true);
    try {
      if (value) {
        const success = await enableBiometricLogin();
        if (success) {
          await refresh();
          Alert.alert(
            `${biometricName} Enabled`,
            `You can now use ${biometricName} to log in quickly and securely.`
          );
        } else {
          Alert.alert('Failed', `Could not enable ${biometricName}. Please try again.`);
        }
      } else {
        await disable();
        await refresh();
        Alert.alert(
          `${biometricName} Disabled`,
          'You will need to enter your password to log in.'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update biometric settings');
    } finally {
      setToggling(false);
    }
  };

  const getBiometricIcon = (): keyof typeof Ionicons.glyphMap => {
    if (biometricType === 'facial') return 'scan';
    if (biometricType === 'fingerprint') return 'finger-print';
    return 'shield-checkmark';
  };

  if (biometricLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Security' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Security' }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Biometric Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Biometric Login</Text>

          {isAvailable ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.settingRow}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name={getBiometricIcon()} size={24} color={colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Use {biometricName}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                    Sign in quickly using {biometricName}
                  </Text>
                </View>
                {toggling ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={isEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                )}
              </View>

              {isEnabled && storedEmail && (
                <View style={[styles.enabledInfo, { borderTopColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={[styles.enabledText, { color: colors.textMuted }]}>
                    Enabled for {storedEmail}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.unavailableContainer}>
                <Ionicons name="alert-circle" size={32} color={colors.textMuted} />
                <Text style={[styles.unavailableTitle, { color: colors.text }]}>
                  Biometric Login Unavailable
                </Text>
                <Text style={[styles.unavailableText, { color: colors.textMuted }]}>
                  Your device doesn't support biometric authentication, or it hasn't been set up in your device settings.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>About Biometric Login</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Your biometric data never leaves your device
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="lock-closed" size={20} color="#4CAF50" />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Credentials are stored securely in the device keychain
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="refresh" size={20} color="#4CAF50" />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                You can disable this feature at any time
              </Text>
            </View>
          </View>
        </View>

        {/* Password Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Password</Text>
          <TouchableOpacity
            style={[styles.card, styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="key" size={22} color={colors.primary} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Change Password</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

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
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  enabledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  enabledText: {
    fontSize: 13,
  },
  unavailableContainer: {
    alignItems: 'center',
    padding: 24,
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  unavailableText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});
