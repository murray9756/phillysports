import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { triviaService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface TriviaQuestion {
  _id: string;
  question: string;
  options: string[];
  team?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  coinReward: number;
}

export default function TriviaScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, refreshUser } = useAuth();

  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    loadQuestion();
  }, []);

  const loadQuestion = async () => {
    setLoading(true);
    setSelectedAnswer(null);
    setIsCorrect(null);

    try {
      const data = await triviaService.getQuestion();
      setQuestion(data.question);
    } catch (error) {
      console.error('Failed to load trivia question:', error);
      Alert.alert('Error', 'Failed to load question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!question || selectedAnswer === null || !isAuthenticated) return;

    setSubmitting(true);
    try {
      const result = await triviaService.submitAnswer(
        question._id,
        question.options[selectedAnswer]
      );

      setIsCorrect(result.correct);

      if (result.correct) {
        setStreak((s) => s + 1);
        setTotalEarned((t) => t + (result.coinsEarned || question.coinReward));
        await refreshUser();
      } else {
        setStreak(0);
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      Alert.alert('Error', 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'hard':
        return '#E53935';
      default:
        return colors.primary;
    }
  };

  const getTeamColor = (team?: string) => {
    if (!team) return colors.primary;
    return TeamColors[team.toLowerCase() as keyof typeof TeamColors] || colors.primary;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Trivia' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading question...</Text>
        </View>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: 'Trivia' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="help-circle" size={64} color={colors.textMuted} />
          <Text style={[styles.authTitle, { color: colors.text }]}>Sign In to Play</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Log in to earn Diehard Dollars by answering trivia questions correctly!
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Trivia' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Stats Bar */}
        <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={styles.statEmoji}>🪙</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{totalEarned}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Earned</Text>
          </View>
        </View>

        {question && (
          <>
            {/* Question Card */}
            <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.questionHeader}>
                {question.team && (
                  <View style={[styles.teamBadge, { backgroundColor: getTeamColor(question.team) }]}>
                    <Text style={styles.teamBadgeText}>{question.team}</Text>
                  </View>
                )}
                <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(question.difficulty) }]}>
                  <Text style={styles.difficultyText}>{question.difficulty}</Text>
                </View>
                <View style={styles.rewardBadge}>
                  <Text style={styles.rewardText}>🪙 {question.coinReward}</Text>
                </View>
              </View>
              <Text style={[styles.questionText, { color: colors.text }]}>{question.question}</Text>
            </View>

            {/* Answer Options */}
            <View style={styles.options}>
              {question.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const showResult = isCorrect !== null;
                let optionStyle = [styles.option, { backgroundColor: colors.card, borderColor: colors.border }];
                let textStyle = [styles.optionText, { color: colors.text }];

                if (showResult && isSelected) {
                  if (isCorrect) {
                    optionStyle = [
                      styles.option,
                      styles.optionCorrect,
                      { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
                    ];
                    textStyle = [styles.optionText, { color: '#fff' }];
                  } else {
                    optionStyle = [
                      styles.option,
                      styles.optionWrong,
                      { backgroundColor: '#E53935', borderColor: '#E53935' },
                    ];
                    textStyle = [styles.optionText, { color: '#fff' }];
                  }
                } else if (isSelected) {
                  optionStyle = [
                    styles.option,
                    { backgroundColor: colors.primary, borderColor: colors.primary },
                  ];
                  textStyle = [styles.optionText, { color: '#fff' }];
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={optionStyle}
                    onPress={() => !showResult && setSelectedAnswer(index)}
                    disabled={showResult}
                  >
                    <Text style={textStyle}>{option}</Text>
                    {showResult && isSelected && (
                      <Ionicons
                        name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                        size={24}
                        color="#fff"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Button */}
            {isCorrect === null ? (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: selectedAnswer !== null ? colors.primary : colors.textMuted },
                ]}
                onPress={handleSubmitAnswer}
                disabled={selectedAnswer === null || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Answer</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.resultContainer}>
                <Text style={[styles.resultText, { color: isCorrect ? '#4CAF50' : '#E53935' }]}>
                  {isCorrect ? `Correct! +${question.coinReward} 🪙` : 'Wrong answer!'}
                </Text>
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={loadQuestion}
                >
                  <Text style={styles.submitButtonText}>Next Question</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  authSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  statsBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 16,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  teamBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  teamBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rewardBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
  options: {
    gap: 12,
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionCorrect: {},
  optionWrong: {},
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resultContainer: {
    alignItems: 'center',
    gap: 16,
  },
  resultText: {
    fontSize: 20,
    fontWeight: '700',
  },
});
