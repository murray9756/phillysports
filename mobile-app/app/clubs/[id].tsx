import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface Member {
  _id: string;
  username: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface Club {
  _id: string;
  name: string;
  description: string;
  image?: string;
  coverImage?: string;
  memberCount: number;
  createdAt: string;
  isPrivate: boolean;
  isMember?: boolean;
  isAdmin?: boolean;
  isOwner?: boolean;
  team?: string;
  rules?: string[];
}

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'members'>('about');
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    loadClub();
  }, [id]);

  const loadClub = async () => {
    try {
      const response = await api.get(`/clubs/${id}`);
      setClub(response.data.club);
      setMembers(response.data.members || []);
    } catch (error) {
      console.error('Failed to load club:', error);
    } finally {
      setLoading(false);
    }
  };

  const leaveClub = async () => {
    if (!club) return;

    Alert.alert(
      'Leave Club',
      `Are you sure you want to leave ${club.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await api.post(`/clubs/${id}/leave`);
              Alert.alert('Left Club', 'You have left the club');
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to leave club');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return '#FFD700';
      case 'admin': return colors.primary;
      default: return colors.textMuted;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

  if (!club) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Club not found</Text>
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

  return (
    <>
      <Stack.Screen options={{ title: club.name }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView>
          {/* Cover/Header */}
          <View style={styles.header}>
            {club.coverImage ? (
              <Image source={{ uri: club.coverImage }} style={styles.coverImage} />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: colors.primary }]} />
            )}

            <View style={styles.clubImageContainer}>
              {club.image ? (
                <Image source={{ uri: club.image }} style={styles.clubImage} />
              ) : (
                <View style={[styles.clubImagePlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="shield" size={40} color={colors.primary} />
                </View>
              )}
            </View>
          </View>

          {/* Club Info */}
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={[styles.clubName, { color: colors.text }]}>{club.name}</Text>
              {club.isPrivate && (
                <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{club.memberCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Members</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatDate(club.createdAt)}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Created</Text>
              </View>
            </View>

            {club.isMember && !club.isOwner && (
              <TouchableOpacity
                style={[styles.leaveButton, { borderColor: '#E53935' }]}
                onPress={leaveClub}
                disabled={leaving}
              >
                {leaving ? (
                  <ActivityIndicator size="small" color="#E53935" />
                ) : (
                  <>
                    <Ionicons name="exit-outline" size={18} color="#E53935" />
                    <Text style={styles.leaveButtonText}>Leave Club</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Tab Bar */}
          <View style={[styles.tabBar, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'about' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab('about')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'about' ? colors.primary : colors.textMuted }]}>
                About
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'members' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab('members')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'members' ? colors.primary : colors.textMuted }]}>
                Members
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'about' && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {club.description}
                </Text>

                {club.rules && club.rules.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Rules</Text>
                    {club.rules.map((rule, index) => (
                      <View key={index} style={styles.ruleRow}>
                        <Text style={[styles.ruleNumber, { color: colors.primary }]}>{index + 1}.</Text>
                        <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{rule}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}

            {activeTab === 'members' && (
              <>
                {members.map((member) => (
                  <View
                    key={member._id}
                    style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    {member.avatar ? (
                      <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                        <Text style={styles.memberAvatarText}>
                          {member.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.text }]}>{member.username}</Text>
                      <Text style={[styles.memberJoined, { color: colors.textMuted }]}>
                        Joined {formatDate(member.joinedAt)}
                      </Text>
                    </View>
                    {member.role !== 'member' && (
                      <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) }]}>
                        <Text style={styles.roleText}>{member.role}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
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
    position: 'relative',
    marginBottom: 50,
  },
  coverImage: {
    width: '100%',
    height: 150,
  },
  coverPlaceholder: {
    width: '100%',
    height: 150,
  },
  clubImageContainer: {
    position: 'absolute',
    bottom: -40,
    left: 16,
  },
  clubImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
  },
  clubImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  clubName: {
    fontSize: 24,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 16,
  },
  stat: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  leaveButtonText: {
    color: '#E53935',
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
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
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
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberJoined: {
    fontSize: 12,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
