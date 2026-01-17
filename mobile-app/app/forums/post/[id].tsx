import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface Comment {
  _id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
}

interface Post {
  _id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  category: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  commentCount: number;
  isPinned?: boolean;
}

export default function ForumPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    try {
      const response = await api.get(`/forums/posts/${id}`);
      setPost(response.data.post);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (type: 'post' | 'comment', itemId: string) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to like posts');
      return;
    }

    try {
      if (type === 'post') {
        await api.post(`/forums/posts/${itemId}/like`);
        setPost((prev) =>
          prev
            ? { ...prev, likes: prev.isLiked ? prev.likes - 1 : prev.likes + 1, isLiked: !prev.isLiked }
            : null
        );
      } else {
        await api.post(`/comments/${itemId}/like`);
        setComments((prev) =>
          prev.map((c) =>
            c._id === itemId
              ? { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !isAuthenticated) return;

    setSubmitting(true);
    try {
      const response = await api.post(`/forums/posts/${id}/comments`, { content: commentText.trim() });
      setComments((prev) => [...prev, response.data.comment]);
      setCommentText('');
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : null));
    } catch (error) {
      console.error('Failed to submit comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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

  if (!post) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Post not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: post.category }} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView>
          {/* Post Content */}
          <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {post.isPinned && (
              <View style={styles.pinnedBadge}>
                <Ionicons name="pin" size={12} color={colors.primary} />
                <Text style={[styles.pinnedText, { color: colors.primary }]}>Pinned</Text>
              </View>
            )}

            <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>

            <View style={styles.postMeta}>
              <Text style={[styles.author, { color: colors.primary }]}>{post.author}</Text>
              <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(post.createdAt)}</Text>
            </View>

            <Text style={[styles.postContent, { color: colors.text }]}>{post.content}</Text>

            <View style={[styles.postActions, { borderColor: colors.border }]}>
              <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike('post', post._id)}>
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={post.isLiked ? '#E53935' : colors.textMuted}
                />
                <Text style={[styles.actionText, { color: colors.textMuted }]}>{post.likes}</Text>
              </TouchableOpacity>
              <View style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.actionText, { color: colors.textMuted }]}>{post.commentCount}</Text>
              </View>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={[styles.commentsTitle, { color: colors.text }]}>
              Comments ({comments.length})
            </Text>

            {comments.length === 0 ? (
              <Text style={[styles.noComments, { color: colors.textMuted }]}>
                No comments yet. Be the first!
              </Text>
            ) : (
              comments.map((comment) => (
                <View
                  key={comment._id}
                  style={[styles.commentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.commentHeader}>
                    <Text style={[styles.commentAuthor, { color: colors.primary }]}>{comment.author}</Text>
                    <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                      {timeAgo(comment.createdAt)}
                    </Text>
                  </View>
                  <Text style={[styles.commentContent, { color: colors.text }]}>{comment.content}</Text>
                  <TouchableOpacity
                    style={styles.likeButton}
                    onPress={() => toggleLike('comment', comment._id)}
                  >
                    <Ionicons
                      name={comment.isLiked ? 'heart' : 'heart-outline'}
                      size={16}
                      color={comment.isLiked ? '#E53935' : colors.textMuted}
                    />
                    {comment.likes > 0 && (
                      <Text style={[styles.likeCount, { color: colors.textMuted }]}>{comment.likes}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Comment Input */}
        {isAuthenticated ? (
          <View style={[styles.inputBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
              placeholder="Write a comment..."
              placeholderTextColor={colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: commentText.trim() ? colors.primary : colors.textMuted },
              ]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.loginPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.loginPromptText, { color: colors.textMuted }]}>
              Sign in to comment
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
  errorText: {
    fontSize: 18,
    marginTop: 12,
  },
  postCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  pinnedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: 13,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  postActions: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
  },
  commentsSection: {
    padding: 16,
    paddingTop: 0,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  noComments: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  commentCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
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
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    maxHeight: 80,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 15,
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
