import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { pusherService } from '@/services/pusher';
import api from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Comment {
  _id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
}

interface ThreadDetails {
  _id: string;
  title: string;
  team: string;
  opponent: string;
  status: 'pre' | 'live' | 'post';
  score?: { home: number; away: number };
}

export default function GameThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadThread();

    // Subscribe to real-time updates
    pusherService.subscribeToGameThread(id!, handleNewComment, handleScoreUpdate);

    return () => {
      pusherService.unsubscribeFromGameThread(id!);
    };
  }, [id]);

  const loadThread = async () => {
    try {
      const response = await api.get(`/game-threads/${id}`);
      setThread(response.data.thread);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Failed to load thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewComment = useCallback((comment: Comment) => {
    setComments((prev) => [...prev, comment]);
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleScoreUpdate = useCallback((data: { home: number; away: number }) => {
    setThread((prev) => (prev ? { ...prev, score: data } : null));
  }, []);

  const sendComment = async () => {
    if (!message.trim() || !isAuthenticated) return;

    setSending(true);
    try {
      await api.post(`/game-threads/${id}/comments`, { content: message.trim() });
      setMessage('');
    } catch (error) {
      console.error('Failed to send comment:', error);
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async (commentId: string) => {
    try {
      await api.post(`/comments/${commentId}/like`);
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const teamColor = thread
    ? TeamColors[thread.team.toLowerCase() as keyof typeof TeamColors] || colors.primary
    : colors.primary;

  const renderComment = ({ item }: { item: Comment }) => {
    const isMe = item.userId === user?._id;

    return (
      <View style={[styles.comment, { backgroundColor: colors.card }]}>
        <View style={styles.commentHeader}>
          <Text style={[styles.commentUser, { color: isMe ? teamColor : colors.text }]}>
            {isMe ? 'You' : item.username}
          </Text>
          <Text style={[styles.commentTime, { color: colors.textMuted }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        <Text style={[styles.commentContent, { color: colors.text }]}>{item.content}</Text>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => toggleLike(item._id)}
        >
          <Ionicons
            name={item.isLiked ? 'heart' : 'heart-outline'}
            size={16}
            color={item.isLiked ? '#E53935' : colors.textMuted}
          />
          {item.likes > 0 && (
            <Text style={[styles.likeCount, { color: colors.textMuted }]}>{item.likes}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game Thread' }} />
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
          title: thread?.title || 'Game Thread',
          headerStyle: { backgroundColor: teamColor },
          headerTintColor: '#fff',
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Score Header */}
        {thread?.score && (
          <View style={[styles.scoreHeader, { backgroundColor: teamColor }]}>
            <View style={styles.scoreTeam}>
              <Text style={styles.teamName}>{thread.team}</Text>
              <Text style={styles.scoreValue}>{thread.score.home}</Text>
            </View>
            <Text style={styles.scoreDivider}>-</Text>
            <View style={styles.scoreTeam}>
              <Text style={styles.scoreValue}>{thread.score.away}</Text>
              <Text style={styles.teamName}>{thread.opponent}</Text>
            </View>
            {thread.status === 'live' && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
        )}

        {/* Comments List */}
        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={renderComment}
          contentContainerStyle={styles.commentsList}
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Be the first to comment!
              </Text>
            </View>
          }
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />

        {/* Comment Input */}
        {isAuthenticated ? (
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: teamColor }]}
              onPress={sendComment}
              disabled={sending || !message.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.loginPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.loginPromptText, { color: colors.textMuted }]}>
              Sign in to join the conversation
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
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
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  scoreTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  scoreDivider: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 24,
    marginHorizontal: 16,
  },
  liveBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229,57,53,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  commentsList: {
    padding: 12,
    paddingBottom: 80,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  comment: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 11,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPrompt: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  loginPromptText: {
    fontSize: 14,
  },
});
