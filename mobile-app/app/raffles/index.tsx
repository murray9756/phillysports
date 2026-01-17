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
} from 'react-native';
import { Stack, Link } from 'expo-router';
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
  const { user, isAuthenticated } = useAuth();

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

              return (
                <Link
                  key={raffle._id}
                  href={{
                    pathname: '/raffles/[id]',
                    params: { id: raffle._id },
                  }}
                  asChild
                >
                  <TouchableOpacity
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

                        <View style={[styles.priceTag, { backgroundColor: '#9C27B0' }]}>
                          <Text style={styles.priceText}>{raffle.ticketPrice} 🪙</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Link>
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
    height: 160,
    resizeMode: 'cover',
  },
  raffleImagePlaceholder: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  raffleInfo: {
    padding: 14,
  },
  raffleName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  prizeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  prizeValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: '500',
  },
  priceTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  priceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
