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
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { sportsService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

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

      {/* Live Scores Section */}
      {scores.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            <Ionicons name="trophy" size={18} color={colors.primary} /> Recent Scores
          </Text>
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="newspaper" size={18} color={colors.primary} /> Latest News
        </Text>

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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="flash" size={18} color={colors.primary} /> Quick Actions
        </Text>
        <View style={styles.quickActions}>
          <Link href="/(tabs)/gaming" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.eagles }]}>
              <Ionicons name="help-circle" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Trivia</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/gaming" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.phillies }]}>
              <Ionicons name="analytics" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Predictions</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/community" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.sixers }]}>
              <Ionicons name="chatbubbles" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Game Threads</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/gaming" asChild>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: TeamColors.flyers }]}>
              <Ionicons name="diamond" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Poker</Text>
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
  welcomeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
  },
  welcomeText: {
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  scoresScroll: {
    flexDirection: 'row',
  },
  scoreCard: {
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 140,
  },
  scoreTeams: {
    marginBottom: 8,
  },
  scoreTeam: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  scoreNumbers: {
    marginBottom: 4,
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  scoreStatus: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  articleCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  articleImage: {
    width: 100,
    height: 80,
  },
  articleContent: {
    flex: 1,
    padding: 12,
  },
  articleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  articleTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  articleMeta: {
    fontSize: 12,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
