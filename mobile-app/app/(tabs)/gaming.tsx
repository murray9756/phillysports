import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { TeamColors, VintageColors, Typography, BorderRadius, Spacing } from '@/constants/Colors';

interface GameOption {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: string;
  coinReward?: string;
}

const gameOptions: GameOption[] = [
  {
    title: 'Trivia',
    description: 'Test your Philly sports knowledge',
    icon: 'help-circle',
    color: TeamColors.eagles,
    href: '/trivia',
    coinReward: '5-20 🪙 per correct answer',
  },
  {
    title: 'Odds & Bets',
    description: 'Play money sports betting',
    icon: 'trending-up',
    color: TeamColors.phillies,
    href: '/betting',
    coinReward: 'Bet with Diehard Dollars',
  },
  {
    title: 'Poker',
    description: 'Texas Hold\'em tournaments & cash games',
    icon: 'diamond',
    color: TeamColors.flyers,
    href: '/poker',
    coinReward: 'Win big in tournaments',
  },
  {
    title: 'Pools',
    description: 'Join betting pools with friends',
    icon: 'grid',
    color: TeamColors.sixers,
    href: '/pools',
    coinReward: 'Pool payouts vary',
  },
];

export default function GamingScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Coin Balance Card */}
      <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
        <View style={styles.balanceContent}>
          <Text style={styles.balanceLabel}>Diehard Dollars</Text>
          <View style={styles.balanceAmount}>
            <Text style={styles.coinEmoji}>🪙</Text>
            <Text style={styles.balanceValue}>
              {isAuthenticated ? Math.round(user?.coinBalance || 0).toLocaleString() : '---'}
            </Text>
          </View>
        </View>
        {!isAuthenticated && (
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Login to Play</Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>

      {/* Game Options */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="game-controller" size={16} color={VintageColors.navy} />
          <Text style={styles.sectionHeaderText}>GAMES</Text>
        </View>

        {gameOptions.map((game) => (
          <Link key={game.title} href={game.href as any} asChild>
            <TouchableOpacity
              style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.gameIcon, { backgroundColor: game.color }]}>
                <Ionicons name={game.icon} size={28} color="#fff" />
              </View>
              <View style={styles.gameInfo}>
                <Text style={[styles.gameTitle, { color: colors.text }]}>{game.title}</Text>
                <Text style={[styles.gameDescription, { color: colors.textSecondary }]}>
                  {game.description}
                </Text>
                {game.coinReward && (
                  <Text style={[styles.gameReward, { color: colors.primary }]}>
                    {game.coinReward}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Link>
        ))}
      </View>

      {/* Shop & Raffles */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cart" size={16} color={VintageColors.navy} />
          <Text style={styles.sectionHeaderText}>SHOP & REWARDS</Text>
        </View>

        <Link href="/shop" asChild>
          <TouchableOpacity
            style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.gameIcon, { backgroundColor: '#FF9800' }]}>
              <Ionicons name="storefront" size={28} color="#fff" />
            </View>
            <View style={styles.gameInfo}>
              <Text style={[styles.gameTitle, { color: colors.text }]}>Shop</Text>
              <Text style={[styles.gameDescription, { color: colors.textSecondary }]}>
                Spend your Diehard Dollars
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Link>

        <Link href="/raffles" asChild>
          <TouchableOpacity
            style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.gameIcon, { backgroundColor: '#9C27B0' }]}>
              <Ionicons name="ticket" size={28} color="#fff" />
            </View>
            <View style={styles.gameInfo}>
              <Text style={[styles.gameTitle, { color: colors.text }]}>Raffles</Text>
              <Text style={[styles.gameDescription, { color: colors.textSecondary }]}>
                Win exclusive prizes
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Link>

        <Link href="/marketplace" asChild>
          <TouchableOpacity
            style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.gameIcon, { backgroundColor: '#607D8B' }]}>
              <Ionicons name="swap-horizontal" size={28} color="#fff" />
            </View>
            <View style={styles.gameInfo}>
              <Text style={[styles.gameTitle, { color: colors.text }]}>Marketplace</Text>
              <Text style={[styles.gameDescription, { color: colors.textSecondary }]}>
                Buy & sell with other fans
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Link>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balanceCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: VintageColors.navy,
  },
  balanceContent: {},
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.sm,
    marginBottom: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinEmoji: {
    fontSize: 28,
  },
  balanceValue: {
    color: '#fff',
    fontSize: Typography['3xl'],
    fontWeight: '800',
  },
  loginButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.sm,
  },
  section: {
    padding: Spacing.md,
    paddingTop: 0,
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
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  gameIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameInfo: {
    flex: 1,
    marginLeft: 14,
  },
  gameTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: 2,
  },
  gameDescription: {
    fontSize: Typography.sm,
    marginBottom: 4,
  },
  gameReward: {
    fontSize: Typography.xs,
    fontWeight: '700',
  },
});
