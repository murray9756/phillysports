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
import { Stack, Link, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { communityService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface GameThread {
  _id: string;
  title: string;
  team: string;
  opponent: string;
  gameTime: string;
  status: 'pre' | 'live' | 'post';
  commentCount: number;
  score?: {
    home: number;
    away: number;
  };
}

export default function GameThreadsScreen() {
  const { team } = useLocalSearchParams<{ team?: string }>();
  const { colors } = useTheme();

  const [threads, setThreads] = useState<GameThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'live' | 'pre' | 'post'>('all');

  useEffect(() => {
    loadThreads();
  }, [team]);

  const loadThreads = async () => {
    try {
      const data = await communityService.getGameThreads(filter === 'all' ? undefined : filter);
      let filteredThreads = data.threads || [];

      if (team) {
        filteredThreads = filteredThreads.filter(
          (t: GameThread) => t.team.toLowerCase() === team.toLowerCase()
        );
      }

      setThreads(filteredThreads);
    } catch (error) {
      console.error('Failed to load game threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadThreads();
    setRefreshing(false);
  };

  const getTeamColor = (teamName: string) => {
    return TeamColors[teamName.toLowerCase() as keyof typeof TeamColors] || colors.primary;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return { text: 'LIVE', color: '#E53935' };
      case 'pre':
        return { text: 'UPCOMING', color: '#4CAF50' };
      case 'post':
        return { text: 'FINAL', color: colors.textMuted };
      default:
        return { text: status.toUpperCase(), color: colors.primary };
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game Threads' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: team ? `${team} Game Threads` : 'Game Threads' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.border }]}
          contentContainerStyle={styles.filterContent}
        >
          {(['all', 'live', 'pre', 'post'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterTab,
                filter === f && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                setFilter(f);
                loadThreads();
              }}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filter === f ? '#fff' : colors.text },
                ]}
              >
                {f === 'all' ? 'All' : f === 'live' ? 'Live' : f === 'pre' ? 'Upcoming' : 'Completed'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.content}>
            {threads.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No game threads found
                </Text>
              </View>
            ) : (
              threads.map((thread) => {
                const status = getStatusBadge(thread.status);
                const teamColor = getTeamColor(thread.team);

                return (
                  <Link
                    key={thread._id}
                    href={{
                      pathname: '/game-threads/[id]',
                      params: { id: thread._id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={[styles.threadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={[styles.teamStripe, { backgroundColor: teamColor }]} />
                      <View style={styles.threadContent}>
                        <View style={styles.threadHeader}>
                          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                            {thread.status === 'live' && <View style={styles.liveDot} />}
                            <Text style={styles.statusText}>{status.text}</Text>
                          </View>
                          <Text style={[styles.gameTime, { color: colors.textMuted }]}>
                            {formatTime(thread.gameTime)}
                          </Text>
                        </View>

                        <Text style={[styles.threadTitle, { color: colors.text }]}>{thread.title}</Text>

                        {thread.score && (
                          <Text style={[styles.scoreText, { color: colors.text }]}>
                            {thread.team} {thread.score.home} - {thread.score.away} {thread.opponent}
                          </Text>
                        )}

                        <View style={styles.threadFooter}>
                          <View style={styles.commentCount}>
                            <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                            <Text style={[styles.commentText, { color: colors.textMuted }]}>
                              {thread.commentCount} comments
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
  filterBar: {
    borderBottomWidth: 1,
    maxHeight: 56,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  threadCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  teamStripe: {
    width: 4,
  },
  threadContent: {
    flex: 1,
    padding: 14,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  gameTime: {
    fontSize: 12,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  threadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentText: {
    fontSize: 12,
  },
});
