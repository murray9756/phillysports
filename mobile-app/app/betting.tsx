import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { sportsService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Game {
  _id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  spread?: string;
  overUnder?: string;
  homeOdds?: string;
  awayOdds?: string;
  sport: string;
}

export default function BettingScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { team } = useLocalSearchParams<{ team?: string }>();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGames();
  }, [team]);

  const loadGames = async () => {
    try {
      const data = await sportsService.getSchedule(team, 7);
      // Transform schedule data to betting format
      const bettingGames = (data.schedule || []).map((game: any) => ({
        _id: game.gameId || game.espnId || Math.random().toString(),
        homeTeam: game.isHome ? game.team : game.opponent,
        awayTeam: game.isHome ? game.opponent : game.team,
        date: game.date,
        sport: game.sport,
        // Mock odds for demo - in production these would come from API
        spread: game.isHome ? '-3.5' : '+3.5',
        overUnder: '45.5',
        homeOdds: '-110',
        awayOdds: '-110',
      }));
      setGames(bettingGames);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Odds & Bets' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: 'Odds & Bets' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="trending-up" size={64} color={colors.textMuted} />
          <Text style={[styles.authTitle, { color: colors.text }]}>Sign In to Bet</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Place bets using Diehard Dollars on your favorite Philly teams!
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={[styles.signInButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Odds & Bets' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Balance Header */}
        <View style={[styles.balanceHeader, { backgroundColor: TeamColors.phillies }]}>
          <View>
            <Text style={styles.balanceLabel}>Available to Bet</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceEmoji}>🪙</Text>
              <Text style={styles.balanceValue}>
                {Math.round(user?.coinBalance || 0).toLocaleString()}
              </Text>
            </View>
          </View>
          <Link href="/profile/bets" asChild>
            <TouchableOpacity style={styles.historyButton}>
              <Ionicons name="time" size={18} color={TeamColors.phillies} />
              <Text style={[styles.historyButtonText, { color: TeamColors.phillies }]}>My Bets</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Play money betting for fun! Win or lose Diehard Dollars.
            </Text>
          </View>

          {/* Games List */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Upcoming Games
            </Text>

            {games.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No upcoming games with odds
                </Text>
              </View>
            ) : (
              games.map((game) => (
                <View
                  key={game._id}
                  style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.gameHeader}>
                    <Text style={[styles.gameSport, { color: colors.primary }]}>{game.sport}</Text>
                    <Text style={[styles.gameDate, { color: colors.textMuted }]}>
                      {formatDate(game.date)} • {formatTime(game.date)}
                    </Text>
                  </View>

                  <View style={styles.teamsRow}>
                    <View style={styles.teamCol}>
                      <Text style={[styles.teamName, { color: colors.text }]}>{game.awayTeam}</Text>
                      <Text style={[styles.odds, { color: colors.textSecondary }]}>{game.awayOdds}</Text>
                    </View>
                    <Text style={[styles.atSymbol, { color: colors.textMuted }]}>@</Text>
                    <View style={styles.teamCol}>
                      <Text style={[styles.teamName, { color: colors.text }]}>{game.homeTeam}</Text>
                      <Text style={[styles.odds, { color: colors.textSecondary }]}>{game.homeOdds}</Text>
                    </View>
                  </View>

                  <View style={styles.bettingOptions}>
                    <TouchableOpacity style={[styles.betButton, { backgroundColor: colors.border }]}>
                      <Text style={[styles.betLabel, { color: colors.textMuted }]}>Spread</Text>
                      <Text style={[styles.betValue, { color: colors.text }]}>{game.spread}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.betButton, { backgroundColor: colors.border }]}>
                      <Text style={[styles.betLabel, { color: colors.textMuted }]}>O/U</Text>
                      <Text style={[styles.betValue, { color: colors.text }]}>{game.overUnder}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.betButton, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.betLabel, { color: 'rgba(255,255,255,0.8)' }]}>Bet</Text>
                      <Text style={[styles.betValue, { color: '#fff' }]}>Place</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
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
    padding: 32,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  authSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 24,
  },
  signInButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceEmoji: {
    fontSize: 22,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  gameCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gameSport: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gameDate: {
    fontSize: 12,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  odds: {
    fontSize: 13,
  },
  atSymbol: {
    fontSize: 14,
    paddingHorizontal: 12,
  },
  bettingOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  betButton: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  betLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  betValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
