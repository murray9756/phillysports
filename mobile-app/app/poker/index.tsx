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
import { Stack, Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { pokerService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Tournament {
  _id: string;
  name: string;
  buyIn: number;
  startTime: string;
  registeredPlayers: number;
  maxPlayers: number;
  prizePool: number;
  status: 'registering' | 'running' | 'completed';
}

interface CashGame {
  _id: string;
  name: string;
  stakes: string;
  players: number;
  maxPlayers: number;
  minBuyIn: number;
  maxBuyIn: number;
}

export default function PokerLobbyScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [cashGames, setCashGames] = useState<CashGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'tournaments' | 'cash'>('tournaments');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tournamentsRes, cashGamesRes] = await Promise.all([
        pokerService.getTournaments(),
        pokerService.getCashGames(),
      ]);

      if (tournamentsRes.tournaments) setTournaments(tournamentsRes.tournaments);
      if (cashGamesRes.tables) setCashGames(cashGamesRes.tables);
    } catch (error) {
      console.error('Failed to load poker data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registering':
        return '#4CAF50';
      case 'running':
        return TeamColors.flyers;
      case 'completed':
        return colors.textMuted;
      default:
        return colors.primary;
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: 'Poker' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="diamond" size={64} color={TeamColors.flyers} />
          <Text style={[styles.authTitle, { color: colors.text }]}>Sign In to Play</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Log in to join poker tournaments and cash games using your Diehard Dollars!
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={[styles.authButton, { backgroundColor: TeamColors.flyers }]}>
              <Text style={styles.authButtonText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Poker' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={TeamColors.flyers} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Poker' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: TeamColors.flyers }]}>
          <View>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceEmoji}>🪙</Text>
              <Text style={styles.balanceValue}>
                {Math.round(user?.coinBalance || 0).toLocaleString()}
              </Text>
            </View>
          </View>
          <Link href="/shop" asChild>
            <TouchableOpacity style={styles.buyButton}>
              <Text style={styles.buyButtonText}>Get More</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'tournaments' && { borderBottomColor: TeamColors.flyers, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab('tournaments')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'tournaments' ? TeamColors.flyers : colors.textMuted },
              ]}
            >
              Tournaments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'cash' && { borderBottomColor: TeamColors.flyers, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab('cash')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'cash' ? TeamColors.flyers : colors.textMuted },
              ]}
            >
              Cash Games
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TeamColors.flyers} />
          }
        >
          {activeTab === 'tournaments' && (
            <View style={styles.content}>
              {tournaments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No tournaments available right now
                </Text>
              ) : (
                tournaments.map((tournament) => (
                  <Link
                    key={tournament._id}
                    href={{
                      pathname: '/poker/tournament/[id]',
                      params: { id: tournament._id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={[styles.tournamentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={styles.tournamentHeader}>
                        <Text style={[styles.tournamentName, { color: colors.text }]}>{tournament.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tournament.status) }]}>
                          <Text style={styles.statusText}>{tournament.status}</Text>
                        </View>
                      </View>

                      <View style={styles.tournamentDetails}>
                        <View style={styles.detailItem}>
                          <Ionicons name="ticket" size={16} color={colors.textMuted} />
                          <Text style={[styles.detailText, { color: colors.text }]}>
                            {tournament.buyIn.toLocaleString()} 🪙
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Ionicons name="trophy" size={16} color={colors.textMuted} />
                          <Text style={[styles.detailText, { color: colors.text }]}>
                            {tournament.prizePool.toLocaleString()} 🪙
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Ionicons name="people" size={16} color={colors.textMuted} />
                          <Text style={[styles.detailText, { color: colors.text }]}>
                            {tournament.registeredPlayers}/{tournament.maxPlayers}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tournamentFooter}>
                        <Text style={[styles.startTime, { color: colors.textSecondary }]}>
                          {formatDate(tournament.startTime)} at {formatTime(tournament.startTime)}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </View>
          )}

          {activeTab === 'cash' && (
            <View style={styles.content}>
              {cashGames.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No cash games running right now
                </Text>
              ) : (
                cashGames.map((game) => (
                  <Link
                    key={game._id}
                    href={{
                      pathname: '/poker/table/[id]',
                      params: { id: game._id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={[styles.cashGameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={styles.cashGameHeader}>
                        <Text style={[styles.cashGameName, { color: colors.text }]}>{game.name}</Text>
                        <Text style={[styles.stakes, { color: TeamColors.flyers }]}>{game.stakes}</Text>
                      </View>

                      <View style={styles.cashGameDetails}>
                        <View style={styles.detailItem}>
                          <Ionicons name="people" size={16} color={colors.textMuted} />
                          <Text style={[styles.detailText, { color: colors.text }]}>
                            {game.players}/{game.maxPlayers} players
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Ionicons name="wallet" size={16} color={colors.textMuted} />
                          <Text style={[styles.detailText, { color: colors.text }]}>
                            {game.minBuyIn.toLocaleString()}-{game.maxBuyIn.toLocaleString()} 🪙
                          </Text>
                        </View>
                      </View>

                      <View style={styles.joinButton}>
                        <Text style={styles.joinButtonText}>Join Table</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
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
  authButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    margin: 16,
    borderRadius: 16,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceEmoji: {
    fontSize: 24,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  buyButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 32,
  },
  tournamentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tournamentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  startTime: {
    fontSize: 13,
  },
  cashGameCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cashGameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cashGameName: {
    fontSize: 16,
    fontWeight: '700',
  },
  stakes: {
    fontSize: 14,
    fontWeight: '700',
  },
  cashGameDetails: {
    gap: 8,
    marginBottom: 14,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TeamColors.flyers,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
