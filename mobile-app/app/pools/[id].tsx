import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Entry {
  _id: string;
  username: string;
  picks?: string[];
  score?: number;
  rank?: number;
  isEliminated?: boolean;
}

interface Pool {
  _id: string;
  name: string;
  type: 'squares' | 'survivor' | 'pickem' | 'confidence';
  description?: string;
  game?: string;
  entryFee: number;
  prizePool: number;
  maxEntries: number;
  currentEntries: number;
  startsAt: string;
  endsAt?: string;
  status: 'open' | 'locked' | 'completed';
  userEntered?: boolean;
  userEntry?: Entry;
  rules?: string[];
  prizes?: { place: string; amount: number }[];
}

export default function PoolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();

  const [pool, setPool] = useState<Pool | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'leaderboard'>('details');

  useEffect(() => {
    loadPool();
  }, [id]);

  const loadPool = async () => {
    try {
      const response = await api.get(`/pools/${id}`);
      setPool(response.data.pool);
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Failed to load pool:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinPool = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to join pools');
      return;
    }

    if (!pool) return;

    if ((user?.coinBalance || 0) < pool.entryFee) {
      Alert.alert('Insufficient Balance', 'You need more Diehard Dollars to join this pool');
      return;
    }

    Alert.alert(
      'Join Pool',
      `Entry fee: ${pool.entryFee} coins. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join',
          onPress: async () => {
            setJoining(true);
            try {
              await api.post(`/pools/${id}/join`);
              await loadPool();
              await refreshUser();
              Alert.alert('Success!', 'You have joined the pool. Good luck!');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to join pool');
            } finally {
              setJoining(false);
            }
          },
        },
      ]
    );
  };

  const getPoolIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'squares': return 'grid';
      case 'survivor': return 'skull';
      case 'pickem': return 'checkmark-circle';
      case 'confidence': return 'trending-up';
      default: return 'trophy';
    }
  };

  const getPoolColor = (type: string) => {
    switch (type) {
      case 'squares': return TeamColors.eagles;
      case 'survivor': return TeamColors.flyers;
      case 'pickem': return TeamColors.phillies;
      case 'confidence': return TeamColors.sixers;
      default: return colors.primary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!pool) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Pool not found</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const poolColor = getPoolColor(pool.type);
  const spotsLeft = pool.maxEntries - pool.currentEntries;
  const canJoin = pool.status === 'open' && !pool.userEntered && spotsLeft > 0;
  const canAfford = (user?.coinBalance || 0) >= pool.entryFee;

  return (
    <>
      <Stack.Screen options={{ title: pool.name }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: poolColor }]}>
            <View style={styles.headerIcon}>
              <Ionicons name={getPoolIcon(pool.type)} size={40} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>{pool.name}</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{pool.type.toUpperCase()}</Text>
            </View>
            {pool.game && <Text style={styles.gameText}>{pool.game}</Text>}
          </View>

          {/* Stats Row */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{pool.entryFee}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>🪙 Entry</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{pool.prizePool.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>🪙 Prize Pool</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{pool.currentEntries}/{pool.maxEntries}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Entries</Text>
            </View>
          </View>

          {/* User Entry Status */}
          {pool.userEntered && (
            <View style={[styles.entryStatus, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: '#4CAF50' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <View style={styles.entryStatusInfo}>
                <Text style={[styles.entryStatusTitle, { color: colors.text }]}>You're In!</Text>
                {pool.userEntry?.rank && (
                  <Text style={[styles.entryStatusText, { color: colors.textMuted }]}>
                    Current Rank: #{pool.userEntry.rank}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Tab Bar */}
          <View style={[styles.tabBar, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'details' && { borderBottomColor: poolColor, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab('details')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'details' ? poolColor : colors.textMuted }]}>
                Details
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'leaderboard' && { borderBottomColor: poolColor, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab('leaderboard')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'leaderboard' ? poolColor : colors.textMuted }]}>
                Leaderboard
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'details' && (
              <>
                {/* Timing */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Schedule</Text>
                  <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar" size={18} color={colors.textMuted} />
                      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Starts</Text>
                      <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(pool.startsAt)}</Text>
                    </View>
                    {pool.endsAt && (
                      <View style={styles.infoRow}>
                        <Ionicons name="flag" size={18} color={colors.textMuted} />
                        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Ends</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(pool.endsAt)}</Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <Ionicons name="radio-button-on" size={18} color={pool.status === 'open' ? '#4CAF50' : colors.textMuted} />
                      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Status</Text>
                      <Text style={[styles.infoValue, { color: pool.status === 'open' ? '#4CAF50' : colors.text }]}>
                        {pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                {pool.description && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                      {pool.description}
                    </Text>
                  </View>
                )}

                {/* Prizes */}
                {pool.prizes && pool.prizes.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Prizes</Text>
                    {pool.prizes.map((prize, index) => (
                      <View
                        key={index}
                        style={[styles.prizeRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <View style={[styles.placeIcon, { backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32' }]}>
                          <Text style={styles.placeText}>{prize.place}</Text>
                        </View>
                        <Text style={[styles.prizeAmount, { color: colors.text }]}>
                          {prize.amount.toLocaleString()} 🪙
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Rules */}
                {pool.rules && pool.rules.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Rules</Text>
                    {pool.rules.map((rule, index) => (
                      <View key={index} style={styles.ruleRow}>
                        <Text style={[styles.ruleNumber, { color: poolColor }]}>{index + 1}.</Text>
                        <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{rule}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {activeTab === 'leaderboard' && (
              <>
                {entries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>No entries yet</Text>
                  </View>
                ) : (
                  entries.map((entry, index) => (
                    <View
                      key={entry._id}
                      style={[
                        styles.entryCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        entry.username === user?.username && { borderColor: poolColor, borderWidth: 2 },
                      ]}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: index < 3 ? poolColor : colors.textMuted }]}>
                        <Text style={styles.rankText}>#{entry.rank || index + 1}</Text>
                      </View>
                      <View style={styles.entryInfo}>
                        <Text style={[styles.entryName, { color: colors.text }]}>
                          {entry.username}
                          {entry.username === user?.username && ' (You)'}
                        </Text>
                        {entry.isEliminated && (
                          <Text style={[styles.eliminatedText, { color: '#E53935' }]}>Eliminated</Text>
                        )}
                      </View>
                      {entry.score !== undefined && (
                        <Text style={[styles.entryScore, { color: colors.text }]}>
                          {entry.score} pts
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Join Button */}
        {canJoin && (
          <View style={[styles.joinBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.joinInfo}>
              <Text style={[styles.spotsText, { color: colors.textMuted }]}>{spotsLeft} spots remaining</Text>
              {!canAfford && (
                <Text style={[styles.insufficientText, { color: '#E53935' }]}>Insufficient balance</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: canAfford ? poolColor : colors.textMuted }]}
              onPress={joinPool}
              disabled={!canAfford || joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Join for {pool.entryFee} 🪙</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  },
  errorText: {
    fontSize: 18,
    marginTop: 12,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerIcon: {
    marginBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  gameText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  entryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  entryStatusInfo: {},
  entryStatusTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  entryStatusText: {
    fontSize: 13,
    marginTop: 2,
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
  tabContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  placeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  prizeAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  ruleRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  ruleNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  ruleText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  eliminatedText: {
    fontSize: 12,
    marginTop: 2,
  },
  entryScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  joinBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  joinInfo: {},
  spotsText: {
    fontSize: 13,
  },
  insufficientText: {
    fontSize: 12,
    marginTop: 2,
  },
  joinButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
