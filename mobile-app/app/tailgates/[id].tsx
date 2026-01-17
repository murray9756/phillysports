import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Attendee {
  _id: string;
  username: string;
  avatar?: string;
}

interface Tailgate {
  _id: string;
  title: string;
  game: string;
  team: string;
  lot: string;
  lotDetails?: string;
  date: string;
  startTime: string;
  endTime?: string;
  host: string;
  hostId: string;
  attendees: number;
  maxAttendees?: number;
  isAttending?: boolean;
  description?: string;
  amenities?: string[];
  bringList?: string[];
  attendeeList?: Attendee[];
}

export default function TailgateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [tailgate, setTailgate] = useState<Tailgate | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvping, setRsvping] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    loadTailgate();
  }, [id]);

  const loadTailgate = async () => {
    try {
      const response = await api.get(`/tailgates/${id}`);
      setTailgate(response.data.tailgate);
    } catch (error) {
      console.error('Failed to load tailgate:', error);
    } finally {
      setLoading(false);
    }
  };

  const rsvp = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to RSVP');
      return;
    }

    setRsvping(true);
    try {
      await api.post(`/tailgates/${id}/rsvp`);
      await loadTailgate();
      Alert.alert('RSVP Confirmed!', 'See you at the lot!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to RSVP');
    } finally {
      setRsvping(false);
    }
  };

  const cancelRsvp = async () => {
    Alert.alert(
      'Cancel RSVP',
      'Are you sure you want to cancel your RSVP?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCanceling(true);
            try {
              await api.delete(`/tailgates/${id}/rsvp`);
              await loadTailgate();
              Alert.alert('RSVP Canceled', 'You have been removed from the guest list');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to cancel RSVP');
            } finally {
              setCanceling(false);
            }
          },
        },
      ]
    );
  };

  const openMaps = () => {
    if (!tailgate?.lotDetails) return;
    const url = `https://maps.apple.com/?q=${encodeURIComponent(tailgate.lotDetails)}`;
    Linking.openURL(url);
  };

  const getTeamColor = (team: string) => {
    return TeamColors[team.toLowerCase() as keyof typeof TeamColors] || colors.primary;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getAmenityIcon = (amenity: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      'food': 'restaurant',
      'drinks': 'beer',
      'grill': 'flame',
      'games': 'game-controller',
      'tv': 'tv',
      'tent': 'umbrella',
      'music': 'musical-notes',
      'chairs': 'person',
    };
    return icons[amenity.toLowerCase()] || 'checkmark';
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

  if (!tailgate) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Tailgate not found</Text>
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

  const teamColor = getTeamColor(tailgate.team);
  const isFull = tailgate.maxAttendees && tailgate.attendees >= tailgate.maxAttendees;
  const isHost = tailgate.hostId === user?._id;

  return (
    <>
      <Stack.Screen options={{ title: tailgate.title }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: teamColor }]}>
            <Ionicons name="beer" size={40} color="#fff" />
            <Text style={styles.headerTitle}>{tailgate.title}</Text>
            <Text style={styles.gameText}>{tailgate.game}</Text>
            <Text style={styles.dateText}>{formatDate(tailgate.date)}</Text>
          </View>

          {/* Status Badge */}
          {tailgate.isAttending && (
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: '#4CAF50' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={[styles.statusText, { color: '#4CAF50' }]}>You're on the list!</Text>
            </View>
          )}

          {/* Details */}
          <View style={styles.content}>
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
                  <Ionicons name="location" size={18} color="#fff" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Location</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{tailgate.lot}</Text>
                  {tailgate.lotDetails && (
                    <TouchableOpacity onPress={openMaps}>
                      <Text style={[styles.addressLink, { color: teamColor }]}>
                        Get directions →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
                  <Ionicons name="time" size={18} color="#fff" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Time</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {tailgate.startTime}
                    {tailgate.endTime && ` - ${tailgate.endTime}`}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
                  <Ionicons name="person" size={18} color="#fff" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Host</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {tailgate.host} {isHost && '(You)'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
                  <Ionicons name="people" size={18} color="#fff" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Attendees</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {tailgate.attendees}
                    {tailgate.maxAttendees && ` / ${tailgate.maxAttendees}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Description */}
            {tailgate.description && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>About This Tailgate</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {tailgate.description}
                </Text>
              </View>
            )}

            {/* Amenities */}
            {tailgate.amenities && tailgate.amenities.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>What We're Providing</Text>
                <View style={styles.amenitiesList}>
                  {tailgate.amenities.map((amenity, index) => (
                    <View key={index} style={[styles.amenityBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name={getAmenityIcon(amenity)} size={16} color={teamColor} />
                      <Text style={[styles.amenityText, { color: colors.text }]}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* What to Bring */}
            {tailgate.bringList && tailgate.bringList.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>What to Bring</Text>
                {tailgate.bringList.map((item, index) => (
                  <View key={index} style={styles.bringItem}>
                    <Ionicons name="arrow-forward" size={14} color={teamColor} />
                    <Text style={[styles.bringText, { color: colors.textSecondary }]}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Attendees List */}
            {tailgate.attendeeList && tailgate.attendeeList.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Who's Coming</Text>
                <View style={styles.attendeesList}>
                  {tailgate.attendeeList.map((attendee) => (
                    <View key={attendee._id} style={[styles.attendeeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.attendeeAvatar, { backgroundColor: teamColor }]}>
                        <Text style={styles.attendeeInitial}>
                          {attendee.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.attendeeName, { color: colors.text }]}>{attendee.username}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* RSVP Bar */}
        {!isHost && (
          <View style={[styles.rsvpBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {tailgate.isAttending ? (
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: '#E53935' }]}
                onPress={cancelRsvp}
                disabled={canceling}
              >
                {canceling ? (
                  <ActivityIndicator size="small" color="#E53935" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#E53935" />
                    <Text style={styles.cancelButtonText}>Cancel RSVP</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.rsvpButton,
                  { backgroundColor: isFull ? colors.textMuted : teamColor },
                ]}
                onPress={rsvp}
                disabled={isFull || rsvping}
              >
                {rsvping ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.rsvpButtonText}>
                    {isFull ? 'Tailgate is Full' : 'RSVP to this Tailgate'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
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
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  gameText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
  detailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressLink: {
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  amenityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bringItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  bringText: {
    fontSize: 14,
    lineHeight: 20,
  },
  attendeesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  attendeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  attendeeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendeeInitial: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  attendeeName: {
    fontSize: 13,
    fontWeight: '500',
  },
  rsvpBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  rsvpButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  cancelButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '600',
  },
});
