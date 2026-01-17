import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { predictionsService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Game {
  _id: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  spread?: number;
  overUnder?: number;
  status: 'open' | 'locked' | 'completed';
  userPrediction?: {
    winner: string;
    type: 'spread' | 'moneyline' | 'overunder';
    value?: number;
  };
  result?: {
    homeScore: number;
    awayScore: number;
  };
}

export default function PredictionsScreen() {
  const { team } = useLocalSearchParams<{ team?: string }>();
  const { colors } = useTheme();
  const { isAuthenticated, refreshUser } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    loadGames();
  }, [team]);

  const loadGames = async () => {
    try {
      const data = await predictionsService.getGames(team);
      setGames(data.games || []);
    } catch (error) {
      console.error('Failed to load predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  const submitPrediction = async (gameId: string, winner: string) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to make predictions');
      return;
    }

    setSubmitting(gameId);
    try {
      await predictionsService.submitPrediction(gameId, { winner, type: 'moneyline' });
      await loadGames();
      await refreshUser();
      Alert.alert('Prediction Submitted!', 'Good luck! You\'ll earn 25 coins if correct.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit prediction');
    } finally {
      setSubmitting(null);
    }
  };

  const getTeamColor = (teamName: string) => {
    const teamKey = teamName.toLowerCase().split(' ').pop() as keyof typeof TeamColors;
    return TeamColors[teamKey] || colors.primary;
  };

  const formatGameTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayStr = '';
    if (date.toDateString() === today.toDateString()) {
      dayStr = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayStr = 'Tomorrow';
    } else {
      dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dayStr} at ${timeStr}`;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Predictions' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: team ? `${team} Predictions` : 'Predictions' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Pick the winner of each game. Earn <Text style={{ color: colors.primary, fontWeight: '700' }}>25 coins</Text> for correct predictions!
          </Text>
        </View>

        {/* Games List */}
        <View style={styles.content}>
          {games.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No games available for predictions
              </Text>
            </View>
          ) : (
            games.map((game) => {
              const homeColor = getTeamColor(game.homeTeam);
              const awayColor = getTeamColor(game.awayTeam);
              const isLocked = game.status !== 'open';
              const hasPredicted = !!game.userPrediction;
              const isSubmitting = submitting === game._id;

              return (
                <View
                  key={game._id}
                  style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {/* Game Header */}
                  <View style={styles.gameHeader}>
                    <Text style={[styles.gameTime, { color: colors.textMuted }]}>
                      {formatGameTime(game.gameTime)}
                    </Text>
                    {isLocked && (
                      <View style={[styles.statusBadge, { backgroundColor: game.status === 'completed' ? '#4CAF50' : colors.textMuted }]}>
                        <Text style={styles.statusText}>
                          {game.status === 'completed' ? 'FINAL' : 'LOCKED'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Result if completed */}
                  {game.result && (
                    <View style={styles.resultBanner}>
                      <Text style={[styles.resultText, { color: colors.text }]}>
                        Final: {game.homeTeam} {game.result.homeScore} - {game.result.awayScore} {game.awayTeam}
                      </Text>
                    </View>
                  )}

                  {/* Team Selection */}
                  <View style={styles.teamsContainer}>
                    {/* Away Team */}
                    <TouchableOpacity
                      style={[
                        styles.teamButton,
                        { borderColor: awayColor },
                        game.userPrediction?.winner === game.awayTeam && styles.selectedTeam,
                        game.userPrediction?.winner === game.awayTeam && { backgroundColor: awayColor },
                      ]}
                      onPress={() => !isLocked && !hasPredicted && submitPrediction(game._id, game.awayTeam)}
                      disabled={isLocked || hasPredicted || isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color={awayColor} />
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.teamName,
                              { color: game.userPrediction?.winner === game.awayTeam ? '#fff' : colors.text },
                            ]}
                          >
                            {game.awayTeam}
                          </Text>
                          {game.spread && (
                            <Text
                              style={[
                                styles.spread,
                                { color: game.userPrediction?.winner === game.awayTeam ? 'rgba(255,255,255,0.8)' : colors.textMuted },
                              ]}
                            >
                              {game.spread > 0 ? `+${game.spread}` : game.spread}
                            </Text>
                          )}
                        </>
                      )}
                    </TouchableOpacity>

                    <Text style={[styles.atSymbol, { color: colors.textMuted }]}>@</Text>

                    {/* Home Team */}
                    <TouchableOpacity
                      style={[
                        styles.teamButton,
                        { borderColor: homeColor },
                        game.userPrediction?.winner === game.homeTeam && styles.selectedTeam,
                        game.userPrediction?.winner === game.homeTeam && { backgroundColor: homeColor },
                      ]}
                      onPress={() => !isLocked && !hasPredicted && submitPrediction(game._id, game.homeTeam)}
                      disabled={isLocked || hasPredicted || isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color={homeColor} />
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.teamName,
                              { color: game.userPrediction?.winner === game.homeTeam ? '#fff' : colors.text },
                            ]}
                          >
                            {game.homeTeam}
                          </Text>
                          {game.spread && (
                            <Text
                              style={[
                                styles.spread,
                                { color: game.userPrediction?.winner === game.homeTeam ? 'rgba(255,255,255,0.8)' : colors.textMuted },
                              ]}
                            >
                              {-game.spread > 0 ? `+${-game.spread}` : -game.spread}
                            </Text>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Prediction Status */}
                  {hasPredicted && (
                    <View style={styles.predictionStatus}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={[styles.predictionText, { color: colors.textSecondary }]}>
                        You picked: <Text style={{ fontWeight: '700' }}>{game.userPrediction?.winner}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  gameCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gameTime: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  resultBanner: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  selectedTeam: {
    borderWidth: 2,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  spread: {
    fontSize: 12,
    fontWeight: '600',
  },
  atSymbol: {
    fontSize: 16,
    fontWeight: '600',
  },
  predictionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  predictionText: {
    fontSize: 13,
  },
});
