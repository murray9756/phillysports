import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { sportsService } from '@/services/api';
import { TeamColors, VintageColors, Typography, BorderRadius, Spacing } from '@/constants/Colors';

const mascotImage = require('@/assets/images/mascot.png');

interface Article {
  _id: string;
  headline: string;
  link: string;
  image?: string;
  source?: string;
  team?: string;
  published: string;
}

interface Score {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  isHome: boolean;
  teamColor?: string;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [news, setNews] = useState<Article[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [newsResponse, scoresResponse] = await Promise.all([
        sportsService.getNews(),
        sportsService.getScores(),
      ]);

      if (newsResponse.articles) {
        setNews(newsResponse.articles.slice(0, 10));
      }
      if (scoresResponse.scores) {
        setScores(scoresResponse.scores);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
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
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getTeamColor = (team?: string) => {
    if (!team) return colors.primary;
    const teamKey = team.toLowerCase() as keyof typeof TeamColors;
    return TeamColors[teamKey] || colors.primary;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Branded Header */}
      <View style={[styles.brandHeader, { backgroundColor: TeamColors.eagles }]}>
        <Image source={mascotImage} style={styles.mascotImage} resizeMode="contain" />
        <View style={styles.brandContent}>
          <Text style={styles.brandTitle}>PhillySports</Text>
          <Text style={styles.brandSubtitle}>The Ultimate Philly Fan Community</Text>
        </View>
      </View>

      {/* Welcome Banner */}
      {isAuthenticated && (
        <View style={[styles.welcomeBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.welcomeText, { color: colors.text }]}>
            Welcome back, {user?.username}!
          </Text>
          <View style={styles.coinDisplay}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={[styles.coinBalance, { color: colors.primary }]}>
              {Math.round(user?.coinBalance || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      {/* Premium Membership Banner */}
      {(!isAuthenticated || !user?.isPremium) && (
        <TouchableOpacity
          style={[styles.premiumBanner, { backgroundColor: '#1a1a2e' }]}
          onPress={() => Linking.openURL('https://phillysports.com/membership')}
        >
          <View style={styles.premiumContent}>
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
            <Text style={styles.premiumTitle}>Join Premium Membership</Text>
            <Text style={styles.premiumSubtitle}>
              @phillysports.com email • Exclusive raffles • Restaurant discounts • Ad-free experience
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FFD700" />
        </TouchableOpacity>
      )}

      {/* Live Scores Section */}
      {scores.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={16} color={VintageColors.navy} />
            <Text style={styles.sectionHeaderText}>RECENT SCORES</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scoresScroll}>
            {scores.map((score, index) => (
              <View
                key={index}
                style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.scoreTeams}>
                  <Text style={[styles.scoreTeam, { color: colors.text }]}>{score.homeTeam}</Text>
                  <Text style={[styles.scoreTeam, { color: colors.text }]}>{score.awayTeam}</Text>
                </View>
                <View style={styles.scoreNumbers}>
                  <Text style={[styles.scoreNumber, { color: colors.text }]}>{score.homeScore}</Text>
                  <Text style={[styles.scoreNumber, { color: colors.text }]}>{score.awayScore}</Text>
                </View>
                <Text style={[styles.scoreStatus, { color: colors.textMuted }]}>{score.status}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* News Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="newspaper" size={16} color={VintageColors.navy} />
          <Text style={styles.sectionHeaderText}>LATEST NEWS</Text>
        </View>

        {news.map((article) => (
          <Link
            key={article._id || article.link}
            href={{
              pathname: '/article',
              params: {
                url: article.link,
                title: article.headline,
                image: article.image || '',
                source: article.source || '',
              },
            }}
            asChild
          >
            <TouchableOpacity
              style={[styles.articleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {article.image && (
                <Image source={{ uri: article.image }} style={styles.articleImage} />
              )}
              <View style={styles.articleContent}>
                <View style={[styles.articleTag, { backgroundColor: getTeamColor(article.team) }]}>
                  <Text style={styles.articleTagText}>{article.team || 'Philly Sports'}</Text>
                </View>
                <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>
                  {article.headline}
                </Text>
                <Text style={[styles.articleMeta, { color: colors.textMuted }]}>
                  {timeAgo(article.published)}{article.source ? ` · ${article.source}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </Link>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color={VintageColors.navy} />
          <Text style={styles.sectionHeaderText}>QUICK ACTIONS</Text>
        </View>
        <View style={styles.quickActions}>
          <Link href="/trivia" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.eagles }]}>
              <Ionicons name="help-circle" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Trivia</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/poker" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.phillies }]}>
              <Ionicons name="diamond" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Poker</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/game-threads" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.sixers }]}>
              <Ionicons name="chatbubbles" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Game Threads</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/forums" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.flyers }]}>
              <Ionicons name="people" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Forums</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingVertical: 20,
    borderBottomWidth: 2,
    borderBottomColor: VintageColors.navy,
  },
  mascotImage: {
    width: 60,
    height: 60,
    marginRight: 12,
  },
  brandContent: {
    flex: 1,
  },
  brandTitle: {
    color: '#fff',
    fontSize: Typography['2xl'],
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.sm,
    marginTop: 2,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    marginBottom: 0,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: VintageColors.gold,
  },
  premiumContent: {
    flex: 1,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: 8,
    gap: 4,
  },
  premiumBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  premiumTitle: {
    color: '#fff',
    fontSize: Typography.base,
    fontWeight: '700',
    marginBottom: 4,
  },
  premiumSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.xs,
    lineHeight: 18,
  },
  welcomeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    margin: Spacing.md,
    marginBottom: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  welcomeText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  coinDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinIcon: {
    fontSize: 18,
  },
  coinBalance: {
    fontSize: Typography.base,
    fontWeight: '700',
  },
  section: {
    padding: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VintageColors.gold,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: VintageColors.navy,
    borderRadius: BorderRadius.sm,
    gap: 8,
  },
  sectionHeaderText: {
    color: VintageColors.navy,
    fontSize: Typography.sm,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoresScroll: {
    flexDirection: 'row',
  },
  scoreCard: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    minWidth: 140,
  },
  scoreTeams: {
    marginBottom: Spacing.sm,
  },
  scoreTeam: {
    fontSize: Typography.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  scoreNumbers: {
    marginBottom: 4,
  },
  scoreNumber: {
    fontSize: Typography.lg,
    fontWeight: '800',
  },
  scoreStatus: {
    fontSize: Typography.xs,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  articleCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  articleImage: {
    width: 100,
    height: 80,
  },
  articleContent: {
    flex: 1,
    padding: Spacing.sm,
  },
  articleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
  },
  articleTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  articleTitle: {
    fontSize: Typography.sm,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  articleMeta: {
    fontSize: Typography.xs,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickAction: {
    width: '47%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  quickActionText: {
    color: '#fff',
    fontSize: Typography.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
