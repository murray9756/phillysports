import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { communityService } from '@/services/api';
import api from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface WatchParty {
  _id: string;
  title: string;
  game: string;
  team: string;
  location: string;
  address?: string;
  date: string;
  time: string;
  host: string;
  attendees: number;
  maxAttendees?: number;
  isAttending?: boolean;
  description?: string;
}

export default function WatchPartiesScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();

  const [parties, setParties] = useState<WatchParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    try {
      const data = await communityService.getWatchParties();
      setParties(data.watchParties || []);
    } catch (error) {
      console.error('Failed to load watch parties:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadParties();
    setRefreshing(false);
  };

  const rsvp = async (partyId: string) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to RSVP');
      return;
    }

    setJoining(partyId);
    try {
      await api.post(`/watch-parties/${partyId}/rsvp`);
      await loadParties();
      Alert.alert('RSVP Confirmed!', 'See you there!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to RSVP');
    } finally {
      setJoining(null);
    }
  };

  const getTeamColor = (team: string) => {
    return TeamColors[team.toLowerCase() as keyof typeof TeamColors] || colors.primary;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Watch Parties' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Watch Parties',
          headerRight: () => (
            <Link href="/watch-parties/create" asChild>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </TouchableOpacity>
            </Link>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.content}>
          {parties.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="tv-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No watch parties scheduled</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Create one and invite your friends!
              </Text>
            </View>
          ) : (
            parties.map((party) => {
              const teamColor = getTeamColor(party.team);
              const isFull = party.maxAttendees && party.attendees >= party.maxAttendees;

              return (
                <View
                  key={party._id}
                  style={[styles.partyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.teamStripe, { backgroundColor: teamColor }]} />

                  <View style={styles.partyContent}>
                    <View style={styles.partyHeader}>
                      <Text style={[styles.partyTitle, { color: colors.text }]}>{party.title}</Text>
                      {party.isAttending && (
                        <View style={[styles.attendingBadge, { backgroundColor: '#4CAF50' }]}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                          <Text style={styles.attendingText}>Going</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.gameText, { color: teamColor }]}>{party.game}</Text>

                    <View style={styles.partyDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar" size={14} color={colors.textMuted} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                          {formatDate(party.date)} at {party.time}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="location" size={14} color={colors.textMuted} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                          {party.location}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="person" size={14} color={colors.textMuted} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                          Hosted by {party.host}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.partyFooter}>
                      <View style={styles.attendeeCount}>
                        <Ionicons name="people" size={16} color={colors.textMuted} />
                        <Text style={[styles.attendeeText, { color: colors.text }]}>
                          {party.attendees}
                          {party.maxAttendees && ` / ${party.maxAttendees}`}
                        </Text>
                      </View>

                      {!party.isAttending && (
                        <TouchableOpacity
                          style={[
                            styles.rsvpButton,
                            { backgroundColor: isFull ? colors.textMuted : teamColor },
                          ]}
                          onPress={() => rsvp(party._id)}
                          disabled={joining === party._id || isFull}
                        >
                          {joining === party._id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.rsvpButtonText}>
                              {isFull ? 'Full' : 'RSVP'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
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
  headerButton: {
    marginRight: 8,
  },
  content: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  partyCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  teamStripe: {
    width: 5,
  },
  partyContent: {
    flex: 1,
    padding: 14,
  },
  partyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  partyTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  attendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  attendingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  gameText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  partyDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
  },
  partyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  attendeeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendeeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rsvpButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
