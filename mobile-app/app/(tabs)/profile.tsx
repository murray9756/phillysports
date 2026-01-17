import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { TeamColors } from '@/constants/Colors';

interface MenuItem {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: string;
  action?: 'logout' | 'theme';
  color?: string;
}

const menuSections: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Account',
    items: [
      { title: 'Edit Profile', icon: 'person-circle', href: '/profile/edit' },
      { title: 'Notifications', icon: 'notifications', href: '/settings/notifications' },
      { title: 'Security', icon: 'shield-checkmark', href: '/settings/security' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { title: 'My Predictions', icon: 'analytics', href: '/profile/predictions' },
      { title: 'My Pools', icon: 'grid', href: '/profile/pools' },
      { title: 'Poker History', icon: 'diamond', href: '/profile/poker-history' },
      { title: 'Order History', icon: 'receipt', href: '/profile/orders' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { title: 'Favorite Teams', icon: 'heart', href: '/profile/favorite-teams' },
      { title: 'Appearance', icon: 'color-palette', action: 'theme' },
    ],
  },
  {
    title: 'Support',
    items: [
      { title: 'Help Center', icon: 'help-circle', href: '/help' },
      { title: 'Contact Us', icon: 'mail', href: '/contact' },
      { title: 'Terms of Service', icon: 'document-text', href: '/terms' },
      { title: 'Privacy Policy', icon: 'lock-closed', href: '/privacy' },
    ],
  },
];

export default function ProfileScreen() {
  const { colors, theme, setTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
  };

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Ionicons name="person-circle" size={80} color={colors.textMuted} />
        <Text style={[styles.guestTitle, { color: colors.text }]}>Welcome to PhillySports</Text>
        <Text style={[styles.guestSubtitle, { color: colors.textSecondary }]}>
          Sign in to access your profile, earn Diehard Dollars, and join the community.
        </Text>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={[styles.registerButton, { borderColor: colors.primary }]}>
            <Text style={[styles.registerButtonText, { color: colors.primary }]}>Create Account</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <Text style={[styles.username, { color: colors.text }]}>{user?.username}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🪙</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {Math.round(user?.coinBalance || 0).toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Diehard Dollars</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🏆</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {user?.badges?.length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Badges</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {user?.totalPredictions || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Predictions</Text>
          </View>
        </View>
      </View>

      {/* Menu Sections */}
      {menuSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
          <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {section.items.map((item, index) => {
              const isLast = index === section.items.length - 1;

              const content = (
                <View
                  style={[
                    styles.menuItem,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={item.color || colors.primary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{item.title}</Text>
                  {item.action === 'theme' ? (
                    <Text style={[styles.menuItemValue, { color: colors.textMuted }]}>
                      {getThemeLabel()}
                    </Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              );

              if (item.action === 'theme') {
                return (
                  <TouchableOpacity key={item.title} onPress={cycleTheme}>
                    {content}
                  </TouchableOpacity>
                );
              }

              if (item.href) {
                return (
                  <Link key={item.title} href={item.href as any} asChild>
                    <TouchableOpacity>{content}</TouchableOpacity>
                  </Link>
                );
              }

              return <View key={item.title}>{content}</View>;
            })}
          </View>
        </View>
      ))}

      {/* Logout Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={22} color="#E53935" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <Text style={[styles.version, { color: colors.textMuted }]}>
        PhillySports v1.0.0
      </Text>

      {/* Bottom Padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loginButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  registerButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
  },
  menuItemValue: {
    fontSize: 14,
    marginRight: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  logoutText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
});
