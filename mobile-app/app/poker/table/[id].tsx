import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { pokerService } from '@/services/api';
import { pusherService } from '@/services/pusher';
import { TeamColors } from '@/constants/Colors';

interface Player {
  id: string;
  username: string;
  chips: number;
  position: number;
  cards?: string[];
  isActive: boolean;
  isFolded: boolean;
  currentBet: number;
}

interface GameState {
  tableId: string;
  players: Player[];
  pot: number;
  currentBet: number;
  communityCards: string[];
  currentPlayer: string;
  stage: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  dealerPosition: number;
  myCards?: string[];
}

const CARD_SUITS: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const CARD_COLORS: Record<string, string> = {
  h: '#E53935',
  d: '#E53935',
  c: '#000',
  s: '#000',
};

export default function PokerTableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState('');
  const [showRaiseInput, setShowRaiseInput] = useState(false);

  useEffect(() => {
    loadTableState();

    // Subscribe to real-time updates
    const channel = pusherService.subscribeToPokerTable(
      id!,
      handleGameUpdate,
      handleHoleCards
    );

    return () => {
      pusherService.unsubscribeFromPokerTable(id!);
    };
  }, [id]);

  const loadTableState = async () => {
    try {
      const data = await pokerService.getTableState(id!);
      setGameState(data.gameState);
    } catch (error) {
      console.error('Failed to load table state:', error);
      Alert.alert('Error', 'Failed to join table');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleGameUpdate = useCallback((data: any) => {
    setGameState((prev) => ({
      ...prev,
      ...data,
    }));
  }, []);

  const handleHoleCards = useCallback((data: { cards: string[] }) => {
    setGameState((prev) => prev ? { ...prev, myCards: data.cards } : null);
  }, []);

  const sendAction = async (action: string, amount?: number) => {
    setActionLoading(true);
    try {
      await pokerService.sendAction(id!, action, amount);
      setShowRaiseInput(false);
      setRaiseAmount('');
      await refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFold = () => sendAction('fold');
  const handleCheck = () => sendAction('check');
  const handleCall = () => sendAction('call');
  const handleRaise = () => {
    const amount = parseInt(raiseAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid raise amount');
      return;
    }
    sendAction('raise', amount);
  };

  const formatCard = (card: string) => {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    return { rank, suit: CARD_SUITS[suit], color: CARD_COLORS[suit] };
  };

  const isMyTurn = gameState?.currentPlayer === user?._id;
  const myPlayer = gameState?.players.find((p) => p.id === user?._id);
  const canCheck = gameState?.currentBet === (myPlayer?.currentBet || 0);
  const callAmount = (gameState?.currentBet || 0) - (myPlayer?.currentBet || 0);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Poker Table' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: '#1B5E20' }]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Joining table...</Text>
        </View>
      </>
    );
  }

  if (!gameState) {
    return (
      <>
        <Stack.Screen options={{ title: 'Poker Table' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.text }]}>Unable to load table</Text>
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

  return (
    <>
      <Stack.Screen
        options={{
          title: `Table ${id?.slice(-4)}`,
          headerStyle: { backgroundColor: '#1B5E20' },
          headerTintColor: '#fff',
        }}
      />
      <View style={[styles.container, { backgroundColor: '#1B5E20' }]}>
        {/* Table Surface */}
        <View style={styles.table}>
          {/* Pot Display */}
          <View style={styles.potContainer}>
            <Text style={styles.potLabel}>Pot</Text>
            <Text style={styles.potAmount}>{gameState.pot.toLocaleString()} 🪙</Text>
          </View>

          {/* Community Cards */}
          <View style={styles.communityCards}>
            {gameState.communityCards.map((card, index) => {
              const { rank, suit, color } = formatCard(card);
              return (
                <View key={index} style={styles.card}>
                  <Text style={[styles.cardText, { color }]}>
                    {rank}{suit}
                  </Text>
                </View>
              );
            })}
            {/* Empty card placeholders */}
            {[...Array(5 - gameState.communityCards.length)].map((_, i) => (
              <View key={`empty-${i}`} style={[styles.card, styles.emptyCard]} />
            ))}
          </View>

          {/* Stage Indicator */}
          <View style={styles.stageContainer}>
            <Text style={styles.stageText}>{gameState.stage.toUpperCase()}</Text>
          </View>
        </View>

        {/* Players Around Table */}
        <View style={styles.playersContainer}>
          {gameState.players.map((player, index) => {
            const isMe = player.id === user?._id;
            const isCurrent = player.id === gameState.currentPlayer;

            return (
              <View
                key={player.id}
                style={[
                  styles.playerSlot,
                  { left: `${(index * 30) % 100}%`, top: `${Math.floor(index / 3) * 30}%` },
                ]}
              >
                <View
                  style={[
                    styles.playerBubble,
                    isCurrent && styles.currentPlayer,
                    player.isFolded && styles.foldedPlayer,
                    isMe && styles.myPlayer,
                  ]}
                >
                  <Text style={styles.playerName} numberOfLines={1}>
                    {isMe ? 'You' : player.username}
                  </Text>
                  <Text style={styles.playerChips}>{player.chips.toLocaleString()}</Text>
                  {player.currentBet > 0 && (
                    <Text style={styles.playerBet}>Bet: {player.currentBet}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* My Hand */}
        {gameState.myCards && (
          <View style={styles.myHand}>
            <Text style={styles.myHandLabel}>Your Cards</Text>
            <View style={styles.myCards}>
              {gameState.myCards.map((card, index) => {
                const { rank, suit, color } = formatCard(card);
                return (
                  <View key={index} style={styles.myCard}>
                    <Text style={[styles.myCardText, { color }]}>
                      {rank}{suit}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {isMyTurn && !myPlayer?.isFolded && (
          <View style={styles.actionBar}>
            {showRaiseInput ? (
              <View style={styles.raiseInputContainer}>
                <TextInput
                  style={styles.raiseInput}
                  placeholder="Amount"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={raiseAmount}
                  onChangeText={setRaiseAmount}
                />
                <TouchableOpacity
                  style={[styles.actionButton, styles.raiseButton]}
                  onPress={handleRaise}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionButtonText}>Raise</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => setShowRaiseInput(false)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.foldButton]}
                  onPress={handleFold}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionButtonText}>Fold</Text>
                </TouchableOpacity>

                {canCheck ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkButton]}
                    onPress={handleCheck}
                    disabled={actionLoading}
                  >
                    <Text style={styles.actionButtonText}>Check</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.callButton]}
                    onPress={handleCall}
                    disabled={actionLoading}
                  >
                    <Text style={styles.actionButtonText}>Call {callAmount}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.raiseButton]}
                  onPress={() => setShowRaiseInput(true)}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionButtonText}>Raise</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Waiting for turn */}
        {!isMyTurn && !myPlayer?.isFolded && gameState.stage !== 'waiting' && (
          <View style={styles.waitingBar}>
            <Text style={styles.waitingText}>Waiting for other players...</Text>
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
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 16,
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
  table: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  potContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  potLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  potAmount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  communityCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  card: {
    width: 50,
    height: 70,
    backgroundColor: '#fff',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '700',
  },
  stageContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playersContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    bottom: 200,
  },
  playerSlot: {
    position: 'absolute',
  },
  playerBubble: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  currentPlayer: {
    backgroundColor: TeamColors.flyers,
  },
  foldedPlayer: {
    opacity: 0.5,
  },
  myPlayer: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  playerName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playerChips: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  playerBet: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
  },
  myHand: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  myHandLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 8,
  },
  myCards: {
    flexDirection: 'row',
    gap: 8,
  },
  myCard: {
    width: 60,
    height: 84,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  myCardText: {
    fontSize: 24,
    fontWeight: '800',
  },
  actionBar: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foldButton: {
    backgroundColor: '#E53935',
  },
  checkButton: {
    backgroundColor: '#4CAF50',
  },
  callButton: {
    backgroundColor: '#2196F3',
  },
  raiseButton: {
    backgroundColor: TeamColors.flyers,
  },
  cancelButton: {
    backgroundColor: '#666',
    flex: 0,
    width: 48,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  raiseInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  raiseInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  waitingBar: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  waitingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
});
