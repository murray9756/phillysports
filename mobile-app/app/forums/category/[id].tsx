import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { communityService } from '@/services/api';

interface ForumPost {
  _id: string;
  title: string;
  author: string;
  commentCount: number;
  likes: number;
  createdAt: string;
  isPinned?: boolean;
}

export default function ForumCategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { colors } = useTheme();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadPosts();
  }, [id]);

  const loadPosts = async (pageNum = 1) => {
    try {
      const data = await communityService.getForumPosts(id, pageNum);
      const newPosts = data.posts || [];

      if (pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(newPosts.length >= 20);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts(1);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      loadPosts(page + 1);
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

  const renderPost = ({ item }: { item: ForumPost }) => (
    <Link
      href={{
        pathname: '/forums/post/[id]',
        params: { id: item._id },
      }}
      asChild
    >
      <TouchableOpacity
        style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {item.isPinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="pin" size={12} color={colors.primary} />
            <Text style={[styles.pinnedText, { color: colors.primary }]}>Pinned</Text>
          </View>
        )}

        <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.postMeta}>
          <Text style={[styles.author, { color: colors.textSecondary }]}>by {item.author}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(item.createdAt)}</Text>
        </View>

        <View style={styles.postStats}>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textMuted }]}>{item.commentCount}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textMuted }]}>{item.likes}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );

  if (loading && posts.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: name || 'Category' }} />
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
          title: name || 'Category',
          headerRight: () => (
            <Link href="/forums/new-post" asChild>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </TouchableOpacity>
            </Link>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            hasMore && posts.length > 0 ? (
              <ActivityIndicator style={styles.loadMore} color={colors.primary} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts in this category</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Be the first to post!</Text>
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
  },
  headerButton: {
    marginRight: 8,
  },
  listContent: {
    padding: 16,
  },
  postCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  pinnedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  author: {
    fontSize: 13,
  },
  time: {
    fontSize: 12,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  loadMore: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
});
