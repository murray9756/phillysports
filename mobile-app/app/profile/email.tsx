import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { TeamColors, VintageColors, Typography, BorderRadius, Spacing } from '@/constants/Colors';

export default function EmailScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const isPremium = user?.isPremium;
  const emailAddress = user?.premiumEmail || (user?.username ? `${user.username}@phillysports.com` : null);

  const openWebmail = () => {
    Linking.openURL('https://phillysports.com/webmail');
  };

  const openEmailSettings = () => {
    Linking.openURL('https://phillysports.com/email-settings');
  };

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: 'Premium Email' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="mail" size={64} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.text }]}>Sign In Required</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Please sign in to access your premium email.
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={[styles.button, { backgroundColor: TeamColors.eagles }]}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </>
    );
  }

  if (!isPremium) {
    return (
      <>
        <Stack.Screen options={{ title: 'Premium Email' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <View style={[styles.emailIcon, { backgroundColor: TeamColors.eagles }]}>
            <Ionicons name="mail" size={48} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Get Your @phillysports.com Email</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Premium members get their own @phillysports.com email address!
          </Text>

          <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.benefitsTitle, { color: colors.text }]}>Premium Email Benefits</Text>

            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={TeamColors.eagles} />
              <Text style={[styles.benefitText, { color: colors.text }]}>
                Your own @phillysports.com address
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={TeamColors.eagles} />
              <Text style={[styles.benefitText, { color: colors.text }]}>
                Webmail access from any device
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={TeamColors.eagles} />
              <Text style={[styles.benefitText, { color: colors.text }]}>
                Works with any email app
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={TeamColors.eagles} />
              <Text style={[styles.benefitText, { color: colors.text }]}>
                Show off your Philly fan pride!
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: TeamColors.eagles }]}
            onPress={() => Linking.openURL('https://phillysports.com/membership')}
          >
            <Ionicons name="star" size={20} color="#fff" />
            <Text style={styles.buttonText}>Become a Premium Member</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'My Email' }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Email Address Card */}
        <View style={[styles.emailCard, { backgroundColor: TeamColors.eagles }]}>
          <View style={styles.emailCardHeader}>
            <View style={styles.emailIconSmall}>
              <Ionicons name="mail" size={28} color={TeamColors.eagles} />
            </View>
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
          </View>
          <Text style={styles.emailLabel}>Your Email Address</Text>
          <Text style={styles.emailAddress}>{emailAddress}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={16} color={VintageColors.navy} />
            <Text style={styles.sectionHeaderText}>QUICK ACTIONS</Text>
          </View>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openWebmail}
          >
            <View style={[styles.actionIcon, { backgroundColor: TeamColors.phillies }]}>
              <Ionicons name="globe" size={24} color="#fff" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Open Webmail</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Access your inbox in browser
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openEmailSettings}
          >
            <View style={[styles.actionIcon, { backgroundColor: TeamColors.sixers }]}>
              <Ionicons name="settings" size={24} color="#fff" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Email Settings</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Forwarding, password, and more
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Setup Instructions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="phone-portrait" size={16} color={VintageColors.navy} />
            <Text style={styles.sectionHeaderText}>ADD TO YOUR PHONE</Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>iPhone Mail Setup</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Settings → Mail → Accounts → Add Account → Other{'\n'}
              Email: {emailAddress}{'\n'}
              Server: mail.phillysports.com
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Gmail App Setup</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Gmail → Settings → Add Account → Other{'\n'}
              Use your @phillysports.com credentials
            </Text>
          </View>
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
    padding: Spacing.xl,
  },
  emailIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: VintageColors.navy,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: 8,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  buttonText: {
    color: '#fff',
    fontSize: Typography.base,
    fontWeight: '700',
  },
  benefitsCard: {
    width: '100%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.lg,
  },
  benefitsTitle: {
    fontSize: Typography.base,
    fontWeight: '800',
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  benefitText: {
    fontSize: Typography.sm,
    flex: 1,
  },
  emailCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: VintageColors.navy,
  },
  emailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emailIconSmall: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  premiumBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emailLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.sm,
    marginBottom: 4,
  },
  emailAddress: {
    color: '#fff',
    fontSize: Typography.xl,
    fontWeight: '800',
  },
  section: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VintageColors.gold,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: VintageColors.navy,
    borderRadius: BorderRadius.sm,
    gap: 8,
  },
  sectionHeaderText: {
    color: VintageColors.navy,
    fontSize: Typography.sm,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    marginLeft: 14,
  },
  actionTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: Typography.sm,
  },
  infoCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    fontSize: Typography.sm,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: Typography.sm,
    lineHeight: 20,
  },
});
