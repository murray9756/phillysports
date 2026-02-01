import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { communityService } from '@/services/api';
import api from '@/services/api';

interface Club {
  _id: string;
  name: string;
  description: string;
  image?: string;
  memberCount: number;
  team?: string;
  isPrivate: boolean;
  isMember?: boolean;
}

export default function ClubsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      const data = await communityService.getClubs();
      setClubs(data.clubs || []);
    } catch (error) {
      console.error('Failed to load clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClubs();
    setRefreshing(false);
  };

  const joinClub = async (clubId: string) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to join clubs');
      return;
    }

    setJoining(clubId);
    try {
      await api.post(`/clubs/${clubId}/join`);
      await loadClubs();
      Alert.alert('Joined!', 'Welcome to the club!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to join club');
    } finally {
      setJoining(null);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Clubs' }} />
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
          title: 'Clubs',
          headerRight: () => (
            <Link href="/clubs/create" asChild>
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
          {clubs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No clubs available</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Be the first to create one!
              </Text>
            </View>
          ) : (
            clubs.map((club) => (
              <View
                key={club._id}
                style={[styles.clubCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {club.image ? (
                  <Image source={{ uri: club.image }} style={styles.clubImage} />
                ) : (
                  <View style={[styles.clubImagePlaceholder, { backgroundColor: colors.primary }]}>
                    <Ionicons name="shield" size={32} color="#fff" />
                  </View>
                )}

                <View style={styles.clubInfo}>
                  <View style={styles.clubHeader}>
                    <Text style={[styles.clubName, { color: colors.text }]}>{club.name}</Text>
                    {club.isPrivate && (
                      <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                    )}
                  </View>

                  <Text style={[styles.clubDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                    {club.description}
                  </Text>

                  <View style={styles.clubFooter}>
                    <View style={styles.memberCount}>
                      <Ionicons name="people" size={14} color={colors.textMuted} />
                      <Text style={[styles.memberText, { color: colors.textMuted }]}>
                        {club.memberCount} members
                      </Text>
                    </View>

                    {club.isMember ? (
                      <Link
                        href={{
                          pathname: '/clubs/[id]',
                          params: { id: club._id },
                        }}
                        asChild
                      >
                        <TouchableOpacity style={[styles.viewButton, { borderColor: colors.primary }]}>
                          <Text style={[styles.viewButtonText, { color: colors.primary }]}>View</Text>
                        </TouchableOpacity>
                      </Link>
                    ) : (
                      <TouchableOpacity
                        style={[styles.joinButton, { backgroundColor: colors.primary }]}
                        onPress={() => joinClub(club._id)}
                        disabled={joining === club._id}
                      >
                        {joining === club._id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.joinButtonText}>
                            {club.isPrivate ? 'Request' : 'Join'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
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
  clubCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  clubImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  clubImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '700',
  },
  clubDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  clubFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberText: {
    fontSize: 12,
  },
  joinButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
