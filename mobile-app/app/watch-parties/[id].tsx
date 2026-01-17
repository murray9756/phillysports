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
  hostId: string;
  attendees: number;
  maxAttendees?: number;
  isAttending?: boolean;
  description?: string;
  amenities?: string[];
  attendeeList?: Attendee[];
}

export default function WatchPartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [party, setParty] = useState<WatchParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvping, setRsvping] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    loadParty();
  }, [id]);

  const loadParty = async () => {
    try {
      const response = await api.get(`/watch-parties/${id}`);
      setParty(response.data.watchParty);
    } catch (error) {
      console.error('Failed to load watch party:', error);
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
      await api.post(`/watch-parties/${id}/rsvp`);
      await loadParty();
      Alert.alert('RSVP Confirmed!', 'See you there!');
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
              await api.delete(`/watch-parties/${id}/rsvp`);
              await loadParty();
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
    if (!party?.address) return;
    const url = `https://maps.apple.com/?q=${encodeURIComponent(party.address)}`;
    Linking.openURL(url);
  };

  const getTeamColor = (team: string) => {
    return TeamColors[team.toLowerCase() as keyof typeof TeamColors] || colors.primary;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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

  if (!party) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Watch party not found</Text>
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

  const teamColor = getTeamColor(party.team);
  const isFull = party.maxAttendees && party.attendees >= party.maxAttendees;
  const isHost = party.hostId === user?._id;

  return (
    <>
      <Stack.Screen options={{ title: party.title }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: teamColor }]}>
            <Ionicons name="tv" size={40} color="#fff" />
            <Text style={styles.headerTitle}>{party.title}</Text>
            <Text style={styles.gameText}>{party.game}</Text>
          </View>

          {/* Status Badge */}
          {party.isAttending && (
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: '#4CAF50' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={[styles.statusText, { color: '#4CAF50' }]}>You're going!</Text>
            </View>
          )}

          {/* Details */}
          <View style={styles.content}>
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
                  <Ionicons name="calendar" size={18} color="#fff" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Date & Time</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatDate(party.date)} at {party.time}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
                  <Ionicons name="location" size={18} color="#fff" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Location</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{party.location}</Text>
                  {party.address && (
                    <TouchableOpacity onPress={openMaps}>
                      <Text style={[styles.addressLink, { color: teamColor }]}>
                        {party.address} →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
                  <Ionicons name="person" size={18} color="#fff" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Host</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {party.host} {isHost && '(You)'}
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
                    {party.attendees}
                    {party.maxAttendees && ` / ${party.maxAttendees}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Description */}
            {party.description && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {party.description}
                </Text>
              </View>
            )}

            {/* Amenities */}
            {party.amenities && party.amenities.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Amenities</Text>
                <View style={styles.amenitiesList}>
                  {party.amenities.map((amenity, index) => (
                    <View key={index} style={[styles.amenityBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name="checkmark-circle" size={14} color={teamColor} />
                      <Text style={[styles.amenityText, { color: colors.text }]}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Attendees List */}
            {party.attendeeList && party.attendeeList.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Who's Coming</Text>
                <View style={styles.attendeesList}>
                  {party.attendeeList.map((attendee) => (
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
            {party.isAttending ? (
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
                    {isFull ? 'Event is Full' : 'RSVP to this Party'}
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
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
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
    gap: 8,
  },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  amenityText: {
    fontSize: 13,
    fontWeight: '500',
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
