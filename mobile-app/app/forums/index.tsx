import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { communityService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface ForumCategory {
  _id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  postCount: number;
  latestPost?: {
    title: string;
    author: string;
    createdAt: string;
  };
}

interface ForumPost {
  _id: string;
  title: string;
  author: string;
  category: string;
  commentCount: number;
  likes: number;
  createdAt: string;
  isPinned?: boolean;
}

export default function ForumsScreen() {
  const { colors } = useTheme();

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [recentPosts, setRecentPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'categories' | 'recent'>('categories');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesRes, postsRes] = await Promise.all([
        communityService.getForumCategories(),
        communityService.getForumPosts(),
      ]);
      setCategories(categoriesRes.categories || []);
      setRecentPosts(postsRes.posts || []);
    } catch (error) {
      console.error('Failed to load forums:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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
        <Stack.Screen options={{ title: 'Forums' }} />
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
          title: 'Forums',
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
        {/* View Toggle */}
        <View style={[styles.toggleBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.toggleButton, view === 'categories' && { backgroundColor: colors.primary }]}
            onPress={() => setView('categories')}
          >
            <Text style={[styles.toggleText, { color: view === 'categories' ? '#fff' : colors.text }]}>
              Categories
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, view === 'recent' && { backgroundColor: colors.primary }]}
            onPress={() => setView('recent')}
          >
            <Text style={[styles.toggleText, { color: view === 'recent' ? '#fff' : colors.text }]}>
              Recent Posts
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {view === 'categories' ? (
            <View style={styles.content}>
              {categories.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No forums available</Text>
                </View>
              ) : (
                categories.map((category) => (
                  <Link
                    key={category._id}
                    href={{
                      pathname: '/forums/category/[id]',
                      params: { id: category._id, name: category.name },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: category.color || colors.primary }]}>
                        <Ionicons name={(category.icon as any) || 'chatbubble'} size={24} color="#fff" />
                      </View>
                      <View style={styles.categoryInfo}>
                        <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                        <Text style={[styles.categoryDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                          {category.description}
                        </Text>
                        <Text style={[styles.categoryMeta, { color: colors.textMuted }]}>
                          {category.postCount} posts
                          {category.latestPost && ` · Latest: ${timeAgo(category.latestPost.createdAt)}`}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </View>
          ) : (
            <View style={styles.content}>
              {recentPosts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts yet</Text>
                </View>
              ) : (
                recentPosts.map((post) => (
                  <Link
                    key={post._id}
                    href={{
                      pathname: '/forums/post/[id]',
                      params: { id: post._id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {post.isPinned && (
                        <View style={styles.pinnedBadge}>
                          <Ionicons name="pin" size={12} color={colors.primary} />
                          <Text style={[styles.pinnedText, { color: colors.primary }]}>Pinned</Text>
                        </View>
                      )}
                      <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>
                        {post.title}
                      </Text>
                      <View style={styles.postMeta}>
                        <Text style={[styles.postAuthor, { color: colors.textSecondary }]}>
                          by {post.author}
                        </Text>
                        <Text style={[styles.postTime, { color: colors.textMuted }]}>
                          {timeAgo(post.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.postStats}>
                        <View style={styles.postStat}>
                          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                          <Text style={[styles.postStatText, { color: colors.textMuted }]}>
                            {post.commentCount}
                          </Text>
                        </View>
                        <View style={styles.postStat}>
                          <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                          <Text style={[styles.postStatText, { color: colors.textMuted }]}>
                            {post.likes}
                          </Text>
                        </View>
                        <View style={[styles.categoryTag, { backgroundColor: colors.border }]}>
                          <Text style={[styles.categoryTagText, { color: colors.textSecondary }]}>
                            {post.category}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </View>
          )}

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
  headerButton: {
    marginRight: 8,
  },
  toggleBar: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  categoryMeta: {
    fontSize: 12,
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
    marginBottom: 6,
  },
  pinnedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  postAuthor: {
    fontSize: 13,
  },
  postTime: {
    fontSize: 12,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    fontSize: 12,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  categoryTagText: {
    fontSize: 11,
  },
});
