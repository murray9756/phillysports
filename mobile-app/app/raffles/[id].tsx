import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface Raffle {
  _id: string;
  name: string;
  description: string;
  image?: string;
  ticketPrice: number;
  totalTickets: number;
  ticketsSold: number;
  endsAt: string;
  prize: string;
  prizeValue: string;
  rules?: string[];
  userTickets?: number;
  recentWinners?: { username: string; prize: string; date: string }[];
}

export default function RaffleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();

  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(1);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadRaffle();
  }, [id]);

  const loadRaffle = async () => {
    try {
      const response = await api.get(`/raffles/${id}`);
      setRaffle(response.data.raffle);
    } catch (error) {
      console.error('Failed to load raffle:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseTickets = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to purchase raffle tickets');
      return;
    }

    if (!raffle) return;

    const totalCost = raffle.ticketPrice * ticketCount;
    if ((user?.coinBalance || 0) < totalCost) {
      Alert.alert('Insufficient Balance', 'You don\'t have enough Diehard Dollars for this purchase');
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Buy ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} for ${totalCost.toLocaleString()} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            setPurchasing(true);
            try {
              await api.post(`/raffles/${id}/purchase`, { quantity: ticketCount });
              await loadRaffle();
              await refreshUser();
              Alert.alert('Success!', `You purchased ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}. Good luck!`);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to purchase tickets');
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  const getTimeRemaining = (endsAt: string) => {
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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

  if (!raffle) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Raffle not found</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const soldPercentage = (raffle.ticketsSold / raffle.totalTickets) * 100;
  const timeRemaining = getTimeRemaining(raffle.endsAt);
  const isEnded = timeRemaining === 'Ended';
  const totalCost = raffle.ticketPrice * ticketCount;
  const canAfford = (user?.coinBalance || 0) >= totalCost;
  const ticketsRemaining = raffle.totalTickets - raffle.ticketsSold;

  return (
    <>
      <Stack.Screen options={{ title: raffle.name }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView>
          {/* Prize Image */}
          {raffle.image ? (
            <Image source={{ uri: raffle.image }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: '#9C27B0' }]}>
              <Ionicons name="gift" size={80} color="#fff" />
            </View>
          )}

          {/* Prize Info */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{raffle.name}</Text>

            <View style={styles.valueRow}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
              <Text style={[styles.valueText, { color: colors.text }]}>Prize Value: {raffle.prizeValue}</Text>
            </View>

            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {raffle.description}
            </Text>

            {/* Stats Row */}
            <View style={[styles.statsRow, { borderColor: colors.border }]}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{raffle.ticketPrice}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>🪙 per ticket</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{ticketsRemaining}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>tickets left</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: isEnded ? '#E53935' : colors.text }]}>
                  {timeRemaining}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>remaining</Text>
              </View>
            </View>

            {/* Progress */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.text }]}>Tickets Sold</Text>
                <Text style={[styles.progressCount, { color: colors.textMuted }]}>
                  {raffle.ticketsSold} / {raffle.totalTickets}
                </Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View
                  style={[styles.progressFill, { width: `${soldPercentage}%`, backgroundColor: '#9C27B0' }]}
                />
              </View>
            </View>

            {/* User's Tickets */}
            {raffle.userTickets && raffle.userTickets > 0 && (
              <View style={[styles.userTicketsCard, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <View style={styles.userTicketsInfo}>
                  <Text style={[styles.userTicketsTitle, { color: colors.text }]}>Your Tickets</Text>
                  <Text style={[styles.userTicketsCount, { color: '#4CAF50' }]}>
                    {raffle.userTickets} ticket{raffle.userTickets > 1 ? 's' : ''} entered
                  </Text>
                </View>
              </View>
            )}

            {/* Rules */}
            {raffle.rules && raffle.rules.length > 0 && (
              <View style={styles.rulesSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Raffle Rules</Text>
                {raffle.rules.map((rule, index) => (
                  <View key={index} style={styles.ruleRow}>
                    <Text style={[styles.ruleNumber, { color: '#9C27B0' }]}>{index + 1}.</Text>
                    <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{rule}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Winners */}
            {raffle.recentWinners && raffle.recentWinners.length > 0 && (
              <View style={styles.winnersSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Winners</Text>
                {raffle.recentWinners.map((winner, index) => (
                  <View
                    key={index}
                    style={[styles.winnerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Ionicons name="trophy" size={20} color="#FFD700" />
                    <View style={styles.winnerInfo}>
                      <Text style={[styles.winnerName, { color: colors.text }]}>{winner.username}</Text>
                      <Text style={[styles.winnerPrize, { color: colors.textMuted }]}>{winner.prize}</Text>
                    </View>
                    <Text style={[styles.winnerDate, { color: colors.textMuted }]}>{winner.date}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Purchase Bar */}
        {!isEnded && ticketsRemaining > 0 && (
          <View style={[styles.purchaseBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Quantity Selector */}
            <View style={styles.quantitySection}>
              <TouchableOpacity
                style={[styles.quantityBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setTicketCount(Math.max(1, ticketCount - 1))}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.quantityText, { color: colors.text }]}>{ticketCount}</Text>
              <TouchableOpacity
                style={[styles.quantityBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setTicketCount(Math.min(ticketsRemaining, ticketCount + 1))}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Purchase Button */}
            <TouchableOpacity
              style={[
                styles.purchaseButton,
                { backgroundColor: canAfford ? '#9C27B0' : colors.textMuted },
              ]}
              onPress={purchaseTickets}
              disabled={!canAfford || purchasing}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.purchaseButtonText}>
                    Buy for {totalCost.toLocaleString()} 🪙
                  </Text>
                  {!canAfford && (
                    <Text style={styles.insufficientText}>Insufficient balance</Text>
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  errorText: {
    fontSize: 18,
    marginTop: 12,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  heroImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    width: '100%',
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  valueText: {
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: 14,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  userTicketsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  userTicketsInfo: {},
  userTicketsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  userTicketsCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  rulesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  ruleRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  ruleNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  ruleText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  winnersSection: {
    marginBottom: 20,
  },
  winnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  winnerInfo: {
    flex: 1,
  },
  winnerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  winnerPrize: {
    fontSize: 12,
  },
  winnerDate: {
    fontSize: 11,
  },
  purchaseBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    gap: 16,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  purchaseButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  insufficientText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
});
