// Poker Constants

// Card ranks (2-14, where 14 = Ace)
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS = ['h', 'd', 'c', 's']; // hearts, diamonds, clubs, spades

// Hand rankings (higher = better)
export const HAND_RANKS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

export const HAND_NAMES = {
  1: 'High Card',
  2: 'Pair',
  3: 'Two Pair',
  4: 'Three of a Kind',
  5: 'Straight',
  6: 'Flush',
  7: 'Full House',
  8: 'Four of a Kind',
  9: 'Straight Flush',
  10: 'Royal Flush'
};

// Game states
export const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  FINISHED: 'finished'
};

export const HAND_STATUS = {
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  COMPLETE: 'complete'
};

export const TOURNAMENT_STATUS = {
  REGISTRATION: 'registration',
  RUNNING: 'running',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Player actions
export const ACTIONS = {
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  ALL_IN: 'all_in'
};

// Default blind structures
export const BLIND_STRUCTURES = {
  // Quick tournament (~30-45 min)
  quick: [
    { level: 1, smallBlind: 10, bigBlind: 20, ante: 0, duration: 300 },
    { level: 2, smallBlind: 15, bigBlind: 30, ante: 0, duration: 300 },
    { level: 3, smallBlind: 25, bigBlind: 50, ante: 5, duration: 300 },
    { level: 4, smallBlind: 50, bigBlind: 100, ante: 10, duration: 300 },
    { level: 5, smallBlind: 75, bigBlind: 150, ante: 15, duration: 300 },
    { level: 6, smallBlind: 100, bigBlind: 200, ante: 25, duration: 300 },
    { level: 7, smallBlind: 150, bigBlind: 300, ante: 30, duration: 300 },
    { level: 8, smallBlind: 200, bigBlind: 400, ante: 40, duration: 300 },
    { level: 9, smallBlind: 300, bigBlind: 600, ante: 60, duration: 300 },
    { level: 10, smallBlind: 400, bigBlind: 800, ante: 80, duration: 300 }
  ],
  // Standard tournament (~60-90 min)
  standard: [
    { level: 1, smallBlind: 10, bigBlind: 20, ante: 0, duration: 600 },
    { level: 2, smallBlind: 15, bigBlind: 30, ante: 0, duration: 600 },
    { level: 3, smallBlind: 20, bigBlind: 40, ante: 0, duration: 600 },
    { level: 4, smallBlind: 30, bigBlind: 60, ante: 5, duration: 600 },
    { level: 5, smallBlind: 50, bigBlind: 100, ante: 10, duration: 600 },
    { level: 6, smallBlind: 75, bigBlind: 150, ante: 15, duration: 600 },
    { level: 7, smallBlind: 100, bigBlind: 200, ante: 20, duration: 600 },
    { level: 8, smallBlind: 150, bigBlind: 300, ante: 30, duration: 600 },
    { level: 9, smallBlind: 200, bigBlind: 400, ante: 40, duration: 600 },
    { level: 10, smallBlind: 300, bigBlind: 600, ante: 60, duration: 600 }
  ]
};

// Default prize structures
export const PRIZE_STRUCTURES = {
  // 6 players
  6: [
    { place: 1, percentage: 65 },
    { place: 2, percentage: 35 }
  ],
  // 9 players
  9: [
    { place: 1, percentage: 50 },
    { place: 2, percentage: 30 },
    { place: 3, percentage: 20 }
  ]
};

// Game settings
export const DEFAULTS = {
  STARTING_CHIPS: 1500,
  MIN_PLAYERS: 2,
  MAX_PLAYERS_PER_TABLE: 9,
  ACTION_TIMEOUT: 30000, // 30 seconds to act
  DISCONNECT_TIMEOUT: 60000 // 60 seconds before auto-fold on disconnect
};

// Rank values for card comparison (2=2, ..., A=14)
export const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};
