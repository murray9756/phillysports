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

interface Tailgate {
  _id: string;
  title: string;
  game: string;
  team: string;
  lot: string;
  date: string;
  startTime: string;
  host: string;
  attendees: number;
  maxAttendees?: number;
  isAttending?: boolean;
  amenities?: string[];
}

export default function TailgatesScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();

  const [tailgates, setTailgates] = useState<Tailgate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    loadTailgates();
  }, []);

  const loadTailgates = async () => {
    try {
      const data = await communityService.getTailgates();
      setTailgates(data.tailgates || []);
    } catch (error) {
      console.error('Failed to load tailgates:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTailgates();
    setRefreshing(false);
  };

  const rsvp = async (tailgateId: string) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to RSVP');
      return;
    }

    setJoining(tailgateId);
    try {
      await api.post(`/tailgates/${tailgateId}/rsvp`);
      await loadTailgates();
      Alert.alert('RSVP Confirmed!', 'See you at the lot!');
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

  const getAmenityIcon = (amenity: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      'food': 'restaurant',
      'drinks': 'beer',
      'grill': 'flame',
      'games': 'game-controller',
      'tv': 'tv',
      'tent': 'umbrella',
    };
    return icons[amenity.toLowerCase()] || 'checkmark';
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Tailgates' }} />
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
          title: 'Tailgates',
          headerRight: () => (
            <Link href="/tailgates/create" asChild>
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
          {tailgates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="beer-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No tailgates scheduled</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Host a pregame and bring fans together!
              </Text>
            </View>
          ) : (
            tailgates.map((tailgate) => {
              const teamColor = getTeamColor(tailgate.team);
              const isFull = tailgate.maxAttendees && tailgate.attendees >= tailgate.maxAttendees;

              return (
                <View
                  key={tailgate._id}
                  style={[styles.tailgateCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.cardHeader, { backgroundColor: teamColor }]}>
                    <Text style={styles.gameText}>{tailgate.game}</Text>
                    <Text style={styles.dateText}>{formatDate(tailgate.date)}</Text>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.tailgateTitle, { color: colors.text }]}>{tailgate.title}</Text>
                      {tailgate.isAttending && (
                        <View style={[styles.attendingBadge, { backgroundColor: '#4CAF50' }]}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </View>

                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Ionicons name="location" size={16} color={teamColor} />
                        <Text style={[styles.detailText, { color: colors.text }]}>{tailgate.lot}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="time" size={16} color={teamColor} />
                        <Text style={[styles.detailText, { color: colors.text }]}>{tailgate.startTime}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="person" size={16} color={teamColor} />
                        <Text style={[styles.detailText, { color: colors.text }]}>{tailgate.host}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="people" size={16} color={teamColor} />
                        <Text style={[styles.detailText, { color: colors.text }]}>
                          {tailgate.attendees}{tailgate.maxAttendees && `/${tailgate.maxAttendees}`}
                        </Text>
                      </View>
                    </View>

                    {tailgate.amenities && tailgate.amenities.length > 0 && (
                      <View style={styles.amenities}>
                        {tailgate.amenities.map((amenity, index) => (
                          <View key={index} style={[styles.amenityBadge, { backgroundColor: colors.border }]}>
                            <Ionicons name={getAmenityIcon(amenity)} size={12} color={colors.textSecondary} />
                            <Text style={[styles.amenityText, { color: colors.textSecondary }]}>{amenity}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {!tailgate.isAttending && (
                      <TouchableOpacity
                        style={[styles.rsvpButton, { backgroundColor: isFull ? colors.textMuted : teamColor }]}
                        onPress={() => rsvp(tailgate._id)}
                        disabled={joining === tailgate._id || isFull}
                      >
                        {joining === tailgate._id ? (
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
  tailgateCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  gameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
  },
  cardBody: {
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tailgateTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  attendingBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '45%',
  },
  detailText: {
    fontSize: 13,
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  amenityText: {
    fontSize: 11,
  },
  rsvpButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
