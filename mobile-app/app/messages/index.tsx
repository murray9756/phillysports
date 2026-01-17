import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Stack, Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { messagingService } from '@/services/api';

interface Conversation {
  _id: string;
  participant: {
    _id: string;
    username: string;
    avatar?: string;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    isFromMe: boolean;
  };
  unreadCount: number;
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadConversations = async () => {
    try {
      const data = await messagingService.getConversations();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: 'Messages' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="mail-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.authTitle, { color: colors.text }]}>Sign In Required</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Log in to view your messages
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={[styles.authButton, { backgroundColor: colors.primary }]}>
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
        <Stack.Screen options={{ title: 'Messages' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  const renderConversation = ({ item }: { item: Conversation }) => (
    <Link
      href={{
        pathname: '/messages/[id]',
        params: { id: item._id, username: item.participant.username },
      }}
      asChild
    >
      <TouchableOpacity
        style={[
          styles.conversationCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          item.unreadCount > 0 && { backgroundColor: `${colors.primary}10` },
        ]}
      >
        {item.participant.avatar ? (
          <Image source={{ uri: item.participant.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {item.participant.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.username, { color: colors.text }]}>
              {item.participant.username}
            </Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {timeAgo(item.lastMessage.createdAt)}
            </Text>
          </View>
          <Text
            style={[
              styles.lastMessage,
              { color: item.unreadCount > 0 ? colors.text : colors.textSecondary },
              item.unreadCount > 0 && { fontWeight: '600' },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage.isFromMe && 'You: '}
            {item.lastMessage.content}
          </Text>
        </View>

        {item.unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Link>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Messages',
          headerRight: () => (
            <Link href="/messages/new" asChild>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="create-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            </Link>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No messages yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Start a conversation with other fans
              </Text>
            </View>
          }
        />
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
    marginTop: 8,
    marginBottom: 24,
  },
  authButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerButton: {
    marginRight: 8,
  },
  listContent: {
    padding: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 14,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
});
