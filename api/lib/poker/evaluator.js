// Hand Evaluation Module
// Evaluates poker hands and determines winners

import { HAND_RANKS, HAND_NAMES, RANK_VALUES } from './constants.js';
import { parseCard } from './deck.js';

/**
 * Get numeric value of a rank
 * @param {string} rank - Rank character
 * @returns {number} Rank value (2-14)
 */
function getRankValue(rank) {
  return RANK_VALUES[rank];
}

/**
 * Sort cards by rank value (descending)
 * @param {string[]} cards - Array of card strings
 * @returns {string[]} Sorted cards
 */
function sortByRank(cards) {
  return [...cards].sort((a, b) => {
    return getRankValue(b[0]) - getRankValue(a[0]);
  });
}

/**
 * Group cards by rank
 * @param {string[]} cards - Array of card strings
 * @returns {Map<string, string[]>} Map of rank to cards
 */
function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    const rank = card[0];
    if (!groups.has(rank)) {
      groups.set(rank, []);
    }
    groups.get(rank).push(card);
  }
  return groups;
}

/**
 * Group cards by suit
 * @param {string[]} cards - Array of card strings
 * @returns {Map<string, string[]>} Map of suit to cards
 */
function groupBySuit(cards) {
  const groups = new Map();
  for (const card of cards) {
    const suit = card[1];
    if (!groups.has(suit)) {
      groups.set(suit, []);
    }
    groups.get(suit).push(card);
  }
  return groups;
}

/**
 * Check for flush (5+ cards of same suit)
 * @param {string[]} cards - Array of card strings
 * @returns {{ isFlush: boolean, flushCards: string[] }}
 */
function checkFlush(cards) {
  const bySuit = groupBySuit(cards);
  for (const [suit, suitCards] of bySuit) {
    if (suitCards.length >= 5) {
      return { isFlush: true, flushCards: sortByRank(suitCards).slice(0, 5) };
    }
  }
  return { isFlush: false, flushCards: [] };
}

/**
 * Check for straight (5 consecutive ranks)
 * @param {string[]} cards - Array of card strings
 * @returns {{ isStraight: boolean, straightCards: string[], highCard: number }}
 */
function checkStraight(cards) {
  // Get unique rank values
  const rankValues = [...new Set(cards.map(c => getRankValue(c[0])))].sort((a, b) => b - a);

  // Check for A-2-3-4-5 (wheel) - Ace can be low
  if (rankValues.includes(14) && rankValues.includes(2) && rankValues.includes(3) &&
      rankValues.includes(4) && rankValues.includes(5)) {
    const straightCards = [];
    for (const card of cards) {
      const val = getRankValue(card[0]);
      if ([14, 2, 3, 4, 5].includes(val) && straightCards.length < 5) {
        if (!straightCards.some(c => getRankValue(c[0]) === val)) {
          straightCards.push(card);
        }
      }
    }
    return { isStraight: true, straightCards, highCard: 5 }; // 5-high straight
  }

  // Check for regular straights
  for (let high = rankValues[0]; high >= 6; high--) {
    let found = true;
    for (let i = 0; i < 5; i++) {
      if (!rankValues.includes(high - i)) {
        found = false;
        break;
      }
    }
    if (found) {
      const straightCards = [];
      const neededRanks = [high, high - 1, high - 2, high - 3, high - 4];
      for (const rank of neededRanks) {
        const card = cards.find(c => getRankValue(c[0]) === rank && !straightCards.includes(c));
        if (card) straightCards.push(card);
      }
      return { isStraight: true, straightCards, highCard: high };
    }
  }

  return { isStraight: false, straightCards: [], highCard: 0 };
}

/**
 * Check for straight flush
 * @param {string[]} cards - Array of card strings
 * @returns {{ isStraightFlush: boolean, cards: string[], highCard: number }}
 */
function checkStraightFlush(cards) {
  const bySuit = groupBySuit(cards);
  for (const [suit, suitCards] of bySuit) {
    if (suitCards.length >= 5) {
      const { isStraight, straightCards, highCard } = checkStraight(suitCards);
      if (isStraight) {
        return { isStraightFlush: true, cards: straightCards, highCard };
      }
    }
  }
  return { isStraightFlush: false, cards: [], highCard: 0 };
}

/**
 * Evaluate a poker hand (5-7 cards)
 * @param {string[]} cards - Array of 5-7 card strings
 * @returns {{ rank: number, value: number[], description: string, bestCards: string[] }}
 */
export function evaluateHand(cards) {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('Hand must contain 5-7 cards');
  }

  const sorted = sortByRank(cards);
  const byRank = groupByRank(cards);

  // Get counts of each group size
  const groupSizes = Array.from(byRank.values()).map(g => g.length).sort((a, b) => b - a);

  // Check for straight flush / royal flush
  const sfResult = checkStraightFlush(cards);
  if (sfResult.isStraightFlush) {
    const isRoyal = sfResult.highCard === 14;
    return {
      rank: isRoyal ? HAND_RANKS.ROYAL_FLUSH : HAND_RANKS.STRAIGHT_FLUSH,
      value: [sfResult.highCard],
      description: isRoyal ? 'Royal Flush' : `Straight Flush, ${rankName(sfResult.highCard)} high`,
      bestCards: sfResult.cards
    };
  }

  // Check for four of a kind
  if (groupSizes[0] === 4) {
    const quadRank = [...byRank.entries()].find(([r, c]) => c.length === 4)[0];
    const quadValue = getRankValue(quadRank);
    const quadCards = byRank.get(quadRank);
    const kicker = sorted.find(c => c[0] !== quadRank);
    return {
      rank: HAND_RANKS.FOUR_OF_A_KIND,
      value: [quadValue, getRankValue(kicker[0])],
      description: `Four of a Kind, ${rankName(quadValue)}s`,
      bestCards: [...quadCards, kicker]
    };
  }

  // Check for full house
  if (groupSizes[0] === 3 && groupSizes[1] >= 2) {
    const trips = [...byRank.entries()].filter(([r, c]) => c.length === 3)
      .sort((a, b) => getRankValue(b[0]) - getRankValue(a[0]))[0];
    const pairs = [...byRank.entries()].filter(([r, c]) => c.length >= 2 && r !== trips[0])
      .sort((a, b) => getRankValue(b[0]) - getRankValue(a[0]))[0];
    return {
      rank: HAND_RANKS.FULL_HOUSE,
      value: [getRankValue(trips[0]), getRankValue(pairs[0])],
      description: `Full House, ${rankName(getRankValue(trips[0]))}s full of ${rankName(getRankValue(pairs[0]))}s`,
      bestCards: [...trips[1], ...pairs[1].slice(0, 2)]
    };
  }

  // Check for flush
  const flushResult = checkFlush(cards);
  if (flushResult.isFlush) {
    const flushValues = flushResult.flushCards.map(c => getRankValue(c[0]));
    return {
      rank: HAND_RANKS.FLUSH,
      value: flushValues,
      description: `Flush, ${rankName(flushValues[0])} high`,
      bestCards: flushResult.flushCards
    };
  }

  // Check for straight
  const straightResult = checkStraight(cards);
  if (straightResult.isStraight) {
    return {
      rank: HAND_RANKS.STRAIGHT,
      value: [straightResult.highCard],
      description: `Straight, ${rankName(straightResult.highCard)} high`,
      bestCards: straightResult.straightCards
    };
  }

  // Check for three of a kind
  if (groupSizes[0] === 3) {
    const trips = [...byRank.entries()].find(([r, c]) => c.length === 3);
    const tripsValue = getRankValue(trips[0]);
    const kickers = sorted.filter(c => c[0] !== trips[0]).slice(0, 2);
    return {
      rank: HAND_RANKS.THREE_OF_A_KIND,
      value: [tripsValue, ...kickers.map(c => getRankValue(c[0]))],
      description: `Three of a Kind, ${rankName(tripsValue)}s`,
      bestCards: [...trips[1], ...kickers]
    };
  }

  // Check for two pair
  if (groupSizes[0] === 2 && groupSizes[1] === 2) {
    const pairs = [...byRank.entries()].filter(([r, c]) => c.length === 2)
      .sort((a, b) => getRankValue(b[0]) - getRankValue(a[0]));
    const highPair = pairs[0];
    const lowPair = pairs[1];
    const kicker = sorted.find(c => c[0] !== highPair[0] && c[0] !== lowPair[0]);
    return {
      rank: HAND_RANKS.TWO_PAIR,
      value: [getRankValue(highPair[0]), getRankValue(lowPair[0]), getRankValue(kicker[0])],
      description: `Two Pair, ${rankName(getRankValue(highPair[0]))}s and ${rankName(getRankValue(lowPair[0]))}s`,
      bestCards: [...highPair[1], ...lowPair[1], kicker]
    };
  }

  // Check for one pair
  if (groupSizes[0] === 2) {
    const pair = [...byRank.entries()].find(([r, c]) => c.length === 2);
    const pairValue = getRankValue(pair[0]);
    const kickers = sorted.filter(c => c[0] !== pair[0]).slice(0, 3);
    return {
      rank: HAND_RANKS.PAIR,
      value: [pairValue, ...kickers.map(c => getRankValue(c[0]))],
      description: `Pair of ${rankName(pairValue)}s`,
      bestCards: [...pair[1], ...kickers]
    };
  }

  // High card
  const highCards = sorted.slice(0, 5);
  return {
    rank: HAND_RANKS.HIGH_CARD,
    value: highCards.map(c => getRankValue(c[0])),
    description: `High Card, ${rankName(getRankValue(highCards[0][0]))}`,
    bestCards: highCards
  };
}

/**
 * Get rank name from value
 */
function rankName(value) {
  const names = {
    2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six',
    7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
    11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace'
  };
  return names[value] || value;
}

/**
 * Compare two evaluated hands
 * @param {object} hand1 - Evaluated hand 1
 * @param {object} hand2 - Evaluated hand 2
 * @returns {number} 1 if hand1 wins, -1 if hand2 wins, 0 if tie
 */
export function compareHands(hand1, hand2) {
  // Compare hand ranks first
  if (hand1.rank !== hand2.rank) {
    return hand1.rank > hand2.rank ? 1 : -1;
  }

  // Same rank - compare values
  for (let i = 0; i < Math.max(hand1.value.length, hand2.value.length); i++) {
    const v1 = hand1.value[i] || 0;
    const v2 = hand2.value[i] || 0;
    if (v1 !== v2) {
      return v1 > v2 ? 1 : -1;
    }
  }

  // Tie
  return 0;
}

/**
 * Find winner(s) among multiple players
 * @param {Array<{ playerId: string, cards: string[] }>} players - Players with their cards
 * @param {string[]} communityCards - Community cards
 * @returns {Array<{ playerId: string, hand: object }>} Array of winner(s)
 */
export function findWinners(players, communityCards) {
  // Evaluate each player's hand
  const evaluatedPlayers = players.map(player => {
    const allCards = [...player.cards, ...communityCards];
    const hand = evaluateHand(allCards);
    return {
      playerId: player.playerId,
      hand
    };
  });

  // Sort by hand strength (best first)
  evaluatedPlayers.sort((a, b) => compareHands(b.hand, a.hand));

  // Find all players with the best hand (handles ties)
  const winners = [evaluatedPlayers[0]];
  for (let i = 1; i < evaluatedPlayers.length; i++) {
    if (compareHands(evaluatedPlayers[i].hand, evaluatedPlayers[0].hand) === 0) {
      winners.push(evaluatedPlayers[i]);
    } else {
      break;
    }
  }

  return winners;
}

/**
 * Evaluate a player's best 5-card hand from hole cards + community cards
 * @param {string[]} holeCards - Player's 2 hole cards
 * @param {string[]} communityCards - 5 community cards
 * @returns {object} Evaluated hand
 */
export function evaluatePlayerHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  return evaluateHand(allCards);
}
