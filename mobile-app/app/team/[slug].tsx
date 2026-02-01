import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { sportsService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Article {
  _id: string;
  headline: string;
  link: string;
  image?: string;
  source?: string;
  published: string;
}

interface Score {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  date: string;
}

interface ScheduleGame {
  opponent: string;
  date: string;
  isHome: boolean;
  venue?: string;
  sport?: string;
  team?: string;
  broadcast?: string;
}

interface Player {
  _id: string;
  name: string;
  position: string;
  number?: string;
  image?: string;
}

interface TeamStats {
  label: string;
  value: string;
  rank?: string;
}

const teamInfo: Record<string, { name: string; sport: string; league: string; icon: string }> = {
  eagles: { name: 'Philadelphia Eagles', sport: 'Football', league: 'NFL', icon: '🦅' },
  phillies: { name: 'Philadelphia Phillies', sport: 'Baseball', league: 'MLB', icon: '⚾' },
  sixers: { name: 'Philadelphia 76ers', sport: 'Basketball', league: 'NBA', icon: '🏀' },
  flyers: { name: 'Philadelphia Flyers', sport: 'Hockey', league: 'NHL', icon: '🏒' },
  villanova: { name: 'Villanova Wildcats', sport: 'Basketball', league: 'Big East', icon: '🐱' },
  penn: { name: 'Penn Quakers', sport: 'Basketball', league: 'Ivy League', icon: '🏛️' },
  temple: { name: 'Temple Owls', sport: 'Basketball', league: 'AAC', icon: '🦉' },
  drexel: { name: 'Drexel Dragons', sport: 'Basketball', league: 'CAA', icon: '🐉' },
  lasalle: { name: 'La Salle Explorers', sport: 'Basketball', league: 'A-10', icon: '⚓' },
  stjosephs: { name: "St. Joseph's Hawks", sport: 'Basketball', league: 'A-10', icon: '🦅' },
  esports: { name: 'eSports', sport: 'Gaming', league: 'Various', icon: '🎮' },
  youth: { name: 'Youth Sports', sport: 'Various', league: 'Local', icon: '⚽' },
};

export default function TeamDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();

  const [news, setNews] = useState<Article[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [schedule, setSchedule] = useState<ScheduleGame[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [stats, setStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'news' | 'scores' | 'schedule' | 'roster' | 'stats'>('news');

  const team = teamInfo[slug || ''] || { name: slug, sport: '', league: '', icon: '🏆' };
  const teamColor = TeamColors[slug as keyof typeof TeamColors] || colors.primary;

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      const [newsRes, scoresRes, scheduleRes, rosterRes, statsRes] = await Promise.all([
        sportsService.getNews(slug),
        sportsService.getScores(slug),
        sportsService.getSchedule(slug, 14),
        sportsService.getRoster(slug).catch(() => ({ roster: [] })),
        sportsService.getStats(slug).catch(() => ({ stats: [] })),
      ]);

      if (newsRes.articles) setNews(newsRes.articles.slice(0, 15));
      if (scoresRes.scores) setScores(scoresRes.scores);
      if (scheduleRes.schedule) setSchedule(scheduleRes.schedule);
      if (rosterRes.roster) setRoster(rosterRes.roster);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (error) {
      console.error('Failed to load team data:', error);
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
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getEspnBoxscoreUrl = (gameId: string, league: string) => {
    if (!gameId) return null;
    const sportPath: Record<string, string> = {
      'NFL': 'nfl',
      'MLB': 'mlb',
      'NBA': 'nba',
      'NHL': 'nhl',
      'MLS': 'soccer/usa.1',
      'Big East': 'mens-college-basketball',
      'Ivy League': 'mens-college-basketball',
      'AAC': 'mens-college-basketball',
      'CAA': 'mens-college-basketball',
      'A-10': 'mens-college-basketball',
    };
    const path = sportPath[league] || 'nfl';
    return `https://www.espn.com/${path}/boxscore/_/gameId/${gameId}`;
  };

  const openEspnBoxscore = async (gameId: string) => {
    const url = getEspnBoxscoreUrl(gameId, team.league);
    if (url) {
      await Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={teamColor} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: team.name,
          headerStyle: { backgroundColor: teamColor },
          headerTintColor: '#fff',
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={teamColor} />
        }
      >
        {/* Team Header */}
        <View style={[styles.header, { backgroundColor: teamColor }]}>
          <Text style={styles.teamIcon}>{team.icon}</Text>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamMeta}>{team.league} • {team.sport}</Text>
        </View>

        {/* Tab Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}
          contentContainerStyle={styles.tabBarContent}
        >
          {(['news', 'scores', 'schedule', 'roster', 'stats'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { borderBottomColor: teamColor, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? teamColor : colors.textMuted },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab Content */}
        <View style={styles.content}>
          {activeTab === 'news' && (
            <>
              {news.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent news</Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    {['villanova', 'penn', 'lasalle', 'drexel', 'stjosephs', 'temple'].includes(slug || '')
                      ? 'College team news is more limited during off-season'
                      : 'Check back soon for updates'}
                  </Text>
                </View>
              ) : (
                news.map((article) => (
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
                      style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {article.image && (
                        <Image source={{ uri: article.image }} style={styles.newsImage} />
                      )}
                      <View style={styles.newsContent}>
                        <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={2}>
                          {article.headline}
                        </Text>
                        <Text style={[styles.newsMeta, { color: colors.textMuted }]}>
                          {timeAgo(article.published)}{article.source ? ` • ${article.source}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </>
          )}

          {activeTab === 'scores' && (
            <>
              {scores.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent scores</Text>
              ) : (
                scores.map((score: any, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => openEspnBoxscore(score.gameId || score.espnId)}
                  >
                    <View style={styles.scoreRow}>
                      <Text style={[styles.scoreTeam, { color: colors.text }]}>{score.homeTeam}</Text>
                      <Text style={[styles.scoreNum, { color: colors.text }]}>{score.homeScore}</Text>
                    </View>
                    <View style={styles.scoreRow}>
                      <Text style={[styles.scoreTeam, { color: colors.text }]}>{score.awayTeam}</Text>
                      <Text style={[styles.scoreNum, { color: colors.text }]}>{score.awayScore}</Text>
                    </View>
                    <View style={styles.scoreFooter}>
                      <Text style={[styles.scoreStatus, { color: colors.textMuted }]}>{score.status}</Text>
                      <View style={styles.boxscoreLink}>
                        <Text style={[styles.boxscoreLinkText, { color: teamColor }]}>ESPN Box Score</Text>
                        <Ionicons name="open-outline" size={14} color={teamColor} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          {activeTab === 'schedule' && (
            <>
              {schedule.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No upcoming games</Text>
              ) : (
                schedule.map((game, index) => (
                  <View
                    key={index}
                    style={[styles.scheduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.scheduleDate}>
                      <Text style={[styles.scheduleDateText, { color: teamColor }]}>
                        {formatDate(game.date)}
                      </Text>
                      <Text style={[styles.scheduleTime, { color: colors.textMuted }]}>{formatTime(game.date)}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={[styles.scheduleOpponent, { color: colors.text }]}>
                        {game.isHome ? 'vs' : '@'} {game.opponent}
                      </Text>
                      {game.venue && (
                        <Text style={[styles.scheduleVenue, { color: colors.textMuted }]}>{game.venue}</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'roster' && (
            <>
              {roster.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>Roster not available</Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    Check back during the season
                  </Text>
                </View>
              ) : (
                roster.map((player, index) => (
                  <View
                    key={player._id || index}
                    style={[styles.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.playerNumber, { backgroundColor: teamColor }]}>
                      <Text style={styles.playerNumberText}>{player.number || '-'}</Text>
                    </View>
                    <View style={styles.playerInfo}>
                      <Text style={[styles.playerName, { color: colors.text }]}>{player.name}</Text>
                      <Text style={[styles.playerPosition, { color: colors.textMuted }]}>{player.position}</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'stats' && (
            <>
              {stats.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="stats-chart-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>Stats not available</Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    Check back during the season
                  </Text>
                </View>
              ) : (
                <View style={styles.statsGrid}>
                  {stats.map((stat, index) => (
                    <View
                      key={index}
                      style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Text style={[styles.statValue, { color: teamColor }]}>{stat.value}</Text>
                      <Text style={[styles.statLabel, { color: colors.text }]}>{stat.label}</Text>
                      {stat.rank && (
                        <Text style={[styles.statRank, { color: colors.textMuted }]}>Rank: {stat.rank}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <Link href={`/game-threads?team=${slug}`} asChild>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: teamColor }]}>
              <Ionicons name="chatbubbles" size={20} color="#fff" />
              <Text style={styles.actionText}>Game Threads</Text>
            </TouchableOpacity>
          </Link>
          <Link href={`/betting?team=${slug}`} asChild>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Ionicons name="trending-up" size={20} color={teamColor} />
              <Text style={[styles.actionText, { color: teamColor }]}>Odds & Bets</Text>
            </TouchableOpacity>
          </Link>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  teamIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  teamName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  teamMeta: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  tabBar: {
    borderBottomWidth: 1,
    maxHeight: 50,
  },
  tabBarContent: {
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 32,
  },
  newsCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  newsImage: {
    width: 100,
    height: 80,
  },
  newsContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  newsMeta: {
    fontSize: 12,
  },
  scoreCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreTeam: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreNum: {
    fontSize: 20,
    fontWeight: '800',
  },
  scoreStatus: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  scoreFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  boxscoreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  boxscoreLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  scheduleDate: {
    width: 80,
    marginRight: 14,
  },
  scheduleDateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleTime: {
    fontSize: 12,
    marginTop: 2,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleOpponent: {
    fontSize: 15,
    fontWeight: '600',
  },
  scheduleVenue: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  playerNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  playerPosition: {
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  statRank: {
    fontSize: 11,
    marginTop: 4,
  },
});
