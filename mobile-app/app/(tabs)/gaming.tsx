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
import { TeamColors } from '@/constants/Colors';

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
    title: 'Predictions',
    description: 'Predict game outcomes',
    icon: 'analytics',
    color: TeamColors.phillies,
    href: '/predictions',
    coinReward: '25 🪙 for correct predictions',
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="game-controller" size={18} color={colors.primary} /> Games
        </Text>

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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="cart" size={18} color={colors.primary} /> Shop & Rewards
        </Text>

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
    margin: 16,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceContent: {},
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
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
    fontSize: 32,
    fontWeight: '800',
  },
  loginButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  gameIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameInfo: {
    flex: 1,
    marginLeft: 14,
  },
  gameTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  gameDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  gameReward: {
    fontSize: 12,
    fontWeight: '600',
  },
});
