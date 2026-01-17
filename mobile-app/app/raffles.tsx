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
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { shopService } from '@/services/api';

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
  userTickets?: number;
}

export default function RafflesScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated, refreshUser } = useAuth();

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadRaffles();
  }, []);

  const loadRaffles = async () => {
    try {
      const data = await shopService.getRaffles();
      setRaffles(data.raffles || []);
    } catch (error) {
      console.error('Failed to load raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRaffles();
    setRefreshing(false);
  };

  const purchaseTicket = async (raffleId: string, ticketPrice: number) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to purchase raffle tickets');
      return;
    }

    if ((user?.coinBalance || 0) < ticketPrice) {
      Alert.alert('Insufficient Balance', 'You don\'t have enough Diehard Dollars for this ticket');
      return;
    }

    Alert.alert(
      'Purchase Ticket',
      `Buy 1 ticket for ${ticketPrice} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            setPurchasing(raffleId);
            try {
              await shopService.purchaseRaffleTickets(raffleId, 1);
              await loadRaffles();
              await refreshUser();
              Alert.alert('Success!', 'Your raffle ticket has been purchased. Good luck!');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to purchase ticket');
            } finally {
              setPurchasing(null);
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

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;

    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m left`;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Raffles' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Raffles' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Balance Banner */}
        {isAuthenticated && (
          <View style={[styles.balanceBanner, { backgroundColor: '#9C27B0' }]}>
            <Ionicons name="ticket" size={24} color="#fff" />
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <Text style={styles.balanceValue}>
                {Math.round(user?.coinBalance || 0).toLocaleString()} 🪙
              </Text>
            </View>
          </View>
        )}

        {/* Raffles List */}
        <View style={styles.content}>
          {raffles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="ticket-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No active raffles right now
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Check back soon for new prizes!
              </Text>
            </View>
          ) : (
            raffles.map((raffle) => {
              const soldPercentage = (raffle.ticketsSold / raffle.totalTickets) * 100;
              const timeRemaining = getTimeRemaining(raffle.endsAt);
              const isEnded = timeRemaining === 'Ended';
              const isPurchasing = purchasing === raffle._id;

              return (
                <View
                  key={raffle._id}
                  style={[styles.raffleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {/* Prize Image */}
                  {raffle.image ? (
                    <Image source={{ uri: raffle.image }} style={styles.raffleImage} />
                  ) : (
                    <View style={[styles.raffleImagePlaceholder, { backgroundColor: '#9C27B0' }]}>
                      <Ionicons name="gift" size={48} color="#fff" />
                    </View>
                  )}

                  {/* Prize Info */}
                  <View style={styles.raffleInfo}>
                    <Text style={[styles.raffleName, { color: colors.text }]}>{raffle.name}</Text>
                    <Text style={[styles.raffleDescription, { color: colors.textSecondary }]}>
                      {raffle.description}
                    </Text>

                    {/* Prize Value */}
                    <View style={styles.prizeValue}>
                      <Ionicons name="trophy" size={16} color="#FFD700" />
                      <Text style={[styles.prizeValueText, { color: colors.text }]}>
                        Value: {raffle.prizeValue}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${soldPercentage}%`, backgroundColor: '#9C27B0' },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressText, { color: colors.textMuted }]}>
                        {raffle.ticketsSold}/{raffle.totalTickets} tickets sold
                      </Text>
                    </View>

                    {/* User Tickets */}
                    {raffle.userTickets && raffle.userTickets > 0 && (
                      <View style={styles.userTickets}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={[styles.userTicketsText, { color: colors.text }]}>
                          You have {raffle.userTickets} ticket{raffle.userTickets > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}

                    {/* Footer */}
                    <View style={styles.raffleFooter}>
                      <View style={styles.timeLeft}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={isEnded ? '#E53935' : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.timeLeftText,
                            { color: isEnded ? '#E53935' : colors.textMuted },
                          ]}
                        >
                          {timeRemaining}
                        </Text>
                      </View>

                      {!isEnded && (
                        <TouchableOpacity
                          style={[styles.buyButton, { backgroundColor: '#9C27B0' }]}
                          onPress={() => purchaseTicket(raffle._id, raffle.ticketPrice)}
                          disabled={isPurchasing}
                        >
                          {isPurchasing ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Text style={styles.buyButtonText}>
                                {raffle.ticketPrice.toLocaleString()} 🪙
                              </Text>
                              <Text style={styles.buyButtonSubtext}>per ticket</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
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
  balanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  balanceInfo: {},
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  raffleCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  raffleImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  raffleImagePlaceholder: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  raffleInfo: {
    padding: 16,
  },
  raffleName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  raffleDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  prizeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  prizeValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
  userTickets: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  userTicketsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  raffleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeLeftText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 100,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  buyButtonSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
  },
});
