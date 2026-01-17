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
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Pool {
  _id: string;
  name: string;
  type: 'squares' | 'survivor' | 'pickem' | 'confidence';
  game?: string;
  entryFee: number;
  prizePool: number;
  maxEntries: number;
  currentEntries: number;
  startsAt: string;
  status: 'open' | 'locked' | 'completed';
  userEntered?: boolean;
}

export default function PoolsScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPools();
  }, []);

  const loadPools = async () => {
    try {
      const response = await api.get('/pools');
      setPools(response.data.pools || []);
    } catch (error) {
      console.error('Failed to load pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPools();
    setRefreshing(false);
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
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Pools' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Pools' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Balance Card */}
        {isAuthenticated && (
          <View style={[styles.balanceCard, { backgroundColor: TeamColors.sixers }]}>
            <View>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <Text style={styles.balanceValue}>
                {Math.round(user?.coinBalance || 0).toLocaleString()} 🪙
              </Text>
            </View>
          </View>
        )}

        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Join pools with friends and compete for prizes. Entry fees go to the prize pool!
          </Text>
        </View>

        {/* Pools List */}
        <View style={styles.content}>
          {pools.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="grid-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No pools available right now
              </Text>
            </View>
          ) : (
            pools.map((pool) => {
              const poolColor = getPoolColor(pool.type);
              const spotsLeft = pool.maxEntries - pool.currentEntries;

              return (
                <Link
                  key={pool._id}
                  href={{
                    pathname: '/pools/[id]',
                    params: { id: pool._id },
                  }}
                  asChild
                >
                  <TouchableOpacity
                    style={[styles.poolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.poolIcon, { backgroundColor: poolColor }]}>
                      <Ionicons name={getPoolIcon(pool.type)} size={24} color="#fff" />
                    </View>

                    <View style={styles.poolInfo}>
                      <View style={styles.poolHeader}>
                        <Text style={[styles.poolName, { color: colors.text }]}>{pool.name}</Text>
                        <View style={[styles.typeBadge, { backgroundColor: poolColor }]}>
                          <Text style={styles.typeText}>{pool.type.toUpperCase()}</Text>
                        </View>
                      </View>

                      {pool.game && (
                        <Text style={[styles.poolGame, { color: colors.textSecondary }]}>{pool.game}</Text>
                      )}

                      <View style={styles.poolStats}>
                        <View style={styles.stat}>
                          <Ionicons name="ticket" size={14} color={colors.textMuted} />
                          <Text style={[styles.statText, { color: colors.text }]}>
                            {pool.entryFee} 🪙
                          </Text>
                        </View>
                        <View style={styles.stat}>
                          <Ionicons name="trophy" size={14} color={colors.textMuted} />
                          <Text style={[styles.statText, { color: colors.text }]}>
                            {pool.prizePool.toLocaleString()} 🪙
                          </Text>
                        </View>
                        <View style={styles.stat}>
                          <Ionicons name="people" size={14} color={colors.textMuted} />
                          <Text style={[styles.statText, { color: colors.text }]}>
                            {pool.currentEntries}/{pool.maxEntries}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.poolFooter}>
                        <Text style={[styles.startDate, { color: colors.textMuted }]}>
                          Starts {formatDate(pool.startsAt)}
                        </Text>

                        {pool.userEntered && (
                          <View style={[styles.enteredBadge, { backgroundColor: '#4CAF50' }]}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                            <Text style={styles.enteredText}>Entered</Text>
                          </View>
                        )}

                        {!pool.userEntered && pool.status === 'open' && (
                          <View style={[styles.spotsTag, { backgroundColor: colors.background }]}>
                            <Text style={[styles.spotsText, { color: colors.textMuted }]}>
                              {spotsLeft} spots left
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Link>
              );
            })
          )}
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
  balanceCard: {
    padding: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 2,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  poolCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  poolIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  poolInfo: {
    flex: 1,
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  poolName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  poolGame: {
    fontSize: 13,
    marginBottom: 8,
  },
  poolStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
  },
  poolFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  startDate: {
    fontSize: 12,
  },
  enteredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  enteredText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  spotsTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  spotsText: {
    fontSize: 11,
  },
});
