// Deck Management Module
// Card format: "Ah" = Ace of hearts, "2c" = 2 of clubs, "Td" = 10 of diamonds

import { RANKS, SUITS } from './constants.js';
import crypto from 'crypto';

/**
 * Create a standard 52-card deck
 * @returns {string[]} Array of 52 card strings
 */
export function createDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

/**
 * Shuffle deck using Fisher-Yates with cryptographically secure random numbers
 * @param {string[]} deck - Array of cards to shuffle
 * @returns {string[]} Shuffled copy of the deck
 */
export function shuffleDeck(deck) {
  const shuffled = [...deck];
  const n = shuffled.length;

  // Generate cryptographically secure random values
  const randomBytes = crypto.randomBytes(n * 4);

  // Fisher-Yates shuffle with crypto random
  for (let i = n - 1; i > 0; i--) {
    // Read 4 bytes as unsigned 32-bit integer
    const randomValue = randomBytes.readUInt32BE((n - 1 - i) * 4);
    // Map to range [0, i] without modulo bias
    const j = Math.floor((randomValue / 0x100000000) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Deal cards from the deck
 * @param {string[]} deck - Current deck
 * @param {number} count - Number of cards to deal
 * @returns {{ dealt: string[], remaining: string[] }}
 */
export function dealCards(deck, count) {
  if (count > deck.length) {
    throw new Error(`Cannot deal ${count} cards from deck with ${deck.length} cards`);
  }
  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count)
  };
}

/**
 * Deal hole cards to players
 * @param {string[]} deck - Current deck
 * @param {number} playerCount - Number of players
 * @returns {{ hands: string[][], remaining: string[] }}
 */
export function dealHoleCards(deck, playerCount) {
  const cardsNeeded = playerCount * 2;
  if (cardsNeeded > deck.length) {
    throw new Error(`Not enough cards to deal to ${playerCount} players`);
  }

  const hands = [];
  let currentDeck = [...deck];

  // Deal one card to each player, then second card (like real dealing)
  const firstCards = currentDeck.slice(0, playerCount);
  const secondCards = currentDeck.slice(playerCount, playerCount * 2);
  currentDeck = currentDeck.slice(playerCount * 2);

  for (let i = 0; i < playerCount; i++) {
    hands.push([firstCards[i], secondCards[i]]);
  }

  return {
    hands,
    remaining: currentDeck
  };
}

/**
 * Deal flop (3 cards) - burns one card first
 * @param {string[]} deck - Current deck
 * @returns {{ flop: string[], remaining: string[] }}
 */
export function dealFlop(deck) {
  if (deck.length < 4) {
    throw new Error('Not enough cards to deal flop');
  }
  // Burn one card, then deal 3
  return {
    flop: deck.slice(1, 4),
    remaining: deck.slice(4)
  };
}

/**
 * Deal turn (1 card) - burns one card first
 * @param {string[]} deck - Current deck
 * @returns {{ turn: string, remaining: string[] }}
 */
export function dealTurn(deck) {
  if (deck.length < 2) {
    throw new Error('Not enough cards to deal turn');
  }
  // Burn one card, then deal 1
  return {
    turn: deck[1],
    remaining: deck.slice(2)
  };
}

/**
 * Deal river (1 card) - burns one card first
 * @param {string[]} deck - Current deck
 * @returns {{ river: string, remaining: string[] }}
 */
export function dealRiver(deck) {
  if (deck.length < 2) {
    throw new Error('Not enough cards to deal river');
  }
  // Burn one card, then deal 1
  return {
    river: deck[1],
    remaining: deck.slice(2)
  };
}

/**
 * Parse a card string into rank and suit
 * @param {string} card - Card string like "Ah"
 * @returns {{ rank: string, suit: string }}
 */
export function parseCard(card) {
  return {
    rank: card[0],
    suit: card[1]
  };
}

/**
 * Get card display name
 * @param {string} card - Card string like "Ah"
 * @returns {string} Display name like "Ace of Hearts"
 */
export function getCardDisplayName(card) {
  const { rank, suit } = parseCard(card);

  const rankNames = {
    '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
    'T': 'Ten', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
  };

  const suitNames = {
    'h': 'Hearts', 'd': 'Diamonds', 'c': 'Clubs', 's': 'Spades'
  };

  return `${rankNames[rank]} of ${suitNames[suit]}`;
}
