// Poker Game Engine
// Manages the state machine for a single poker hand

import { ObjectId } from 'mongodb';
import { getCollection } from '../mongodb.js';
import { createDeck, shuffleDeck, dealHoleCards, dealFlop, dealTurn, dealRiver } from './deck.js';
import { evaluateHand, compareHands, findWinners } from './evaluator.js';
import { HAND_STATUS, ACTIONS, DEFAULTS } from './constants.js';
import { broadcastTableUpdate, sendPrivateCards, PUSHER_EVENTS } from '../pusher.js';
import { eliminatePlayer, checkTournamentComplete } from './tournamentManager.js';

/**
 * Initialize a new hand at a table
 */
export async function startNewHand(tableId, blinds = { small: 10, big: 20, ante: 0 }) {
  const tables = await getCollection('poker_tables');
  const hands = await getCollection('poker_hands');

  const table = await tables.findOne({ _id: new ObjectId(tableId) });
  if (!table) throw new Error('Table not found');

  // Get active players (those with chips)
  const activePlayers = table.seats.filter(s => s.playerId && s.chipStack > 0);
  if (activePlayers.length < 2) {
    throw new Error('Not enough players to start hand');
  }

  // Create and shuffle deck
  const deck = shuffleDeck(createDeck());

  // Deal hole cards
  const { hands: holeCards, remaining: deckAfterDeal } = dealHoleCards(deck, activePlayers.length);

  // Advance dealer button
  const dealerPosition = (table.dealerPosition + 1) % table.maxSeats;
  const activePositions = activePlayers.map(p => p.position).sort((a, b) => a - b);

  // Find small blind and big blind positions
  const dealerIdx = activePositions.indexOf(dealerPosition) !== -1
    ? activePositions.indexOf(dealerPosition)
    : 0;
  const sbIdx = (dealerIdx + 1) % activePositions.length;
  const bbIdx = (dealerIdx + 2) % activePositions.length;
  const sbPosition = activePositions[sbIdx];
  const bbPosition = activePositions[bbIdx];

  // Build players array for hand
  const handPlayers = activePlayers.map((seat, idx) => ({
    playerId: seat.playerId,
    position: seat.position,
    holeCards: holeCards[idx],
    chipStackStart: seat.chipStack,
    chipStackCurrent: seat.chipStack,
    totalBet: 0,
    currentRoundBet: 0,
    isAllIn: false,
    isFolded: false,
    hasActed: false
  }));

  // Post blinds and antes
  let pot = 0;
  const actions = [];

  // Collect antes
  if (blinds.ante > 0) {
    for (const player of handPlayers) {
      const anteAmount = Math.min(blinds.ante, player.chipStackCurrent);
      player.chipStackCurrent -= anteAmount;
      player.totalBet += anteAmount;
      pot += anteAmount;
      if (anteAmount > 0) {
        actions.push({
          playerId: player.playerId,
          action: 'ante',
          amount: anteAmount,
          timestamp: new Date(),
          street: HAND_STATUS.PREFLOP
        });
      }
    }
  }

  // Post small blind
  const sbPlayer = handPlayers.find(p => p.position === sbPosition);
  const sbAmount = Math.min(blinds.small, sbPlayer.chipStackCurrent);
  sbPlayer.chipStackCurrent -= sbAmount;
  sbPlayer.totalBet += sbAmount;
  sbPlayer.currentRoundBet = sbAmount;
  pot += sbAmount;
  if (sbPlayer.chipStackCurrent === 0) sbPlayer.isAllIn = true;
  actions.push({
    playerId: sbPlayer.playerId,
    action: 'small_blind',
    amount: sbAmount,
    timestamp: new Date(),
    street: HAND_STATUS.PREFLOP
  });

  // Post big blind
  const bbPlayer = handPlayers.find(p => p.position === bbPosition);
  const bbAmount = Math.min(blinds.big, bbPlayer.chipStackCurrent);
  bbPlayer.chipStackCurrent -= bbAmount;
  bbPlayer.totalBet += bbAmount;
  bbPlayer.currentRoundBet = bbAmount;
  pot += bbAmount;
  if (bbPlayer.chipStackCurrent === 0) bbPlayer.isAllIn = true;
  actions.push({
    playerId: bbPlayer.playerId,
    action: 'big_blind',
    amount: bbAmount,
    timestamp: new Date(),
    street: HAND_STATUS.PREFLOP
  });

  // First to act is after big blind
  const uttgIdx = (bbIdx + 1) % activePositions.length;
  const actingPosition = activePositions[uttgIdx];

  // Create hand document
  const hand = {
    tableId: new ObjectId(tableId),
    tournamentId: table.tournamentId,
    handNumber: (table.handsPlayed || 0) + 1,
    status: HAND_STATUS.PREFLOP,
    deck: deckAfterDeal, // Remaining deck for community cards
    communityCards: [],
    pot,
    sidePots: [],
    currentBet: blinds.big,
    minRaise: blinds.big,
    lastRaise: blinds.big,
    actingPosition,
    dealerPosition,
    sbPosition,
    bbPosition,
    players: handPlayers,
    actions,
    winners: [],
    startedAt: new Date(),
    endedAt: null
  };

  const result = await hands.insertOne(hand);
  const handId = result.insertedId;

  // Update table
  await tables.updateOne(
    { _id: new ObjectId(tableId) },
    {
      $set: {
        currentHandId: handId,
        dealerPosition,
        'seats.$[].currentBet': 0,
        updatedAt: new Date()
      },
      $inc: { handsPlayed: 1 }
    }
  );

  // Update seat chip stacks and cards
  for (const player of handPlayers) {
    await tables.updateOne(
      { _id: new ObjectId(tableId), 'seats.playerId': player.playerId },
      {
        $set: {
          'seats.$.chipStack': player.chipStackCurrent,
          'seats.$.cards': player.holeCards,
          'seats.$.currentBet': player.currentRoundBet,
          'seats.$.isActive': true
        }
      }
    );
  }

  // Broadcast new hand started (without revealing cards)
  broadcastTableUpdate(tableId, PUSHER_EVENTS.NEW_HAND, {
    handId: handId.toString(),
    handNumber: hand.handNumber,
    dealerPosition,
    smallBlindPosition: sbPosition,
    bigBlindPosition: bbPosition,
    actingPosition: hand.actingPosition,
    pot: hand.pot,
    currentBet: hand.currentBet,
    players: handPlayers.map(p => ({
      playerId: p.playerId.toString(),
      position: p.position,
      chipStack: p.chipStackCurrent,
      currentBet: p.currentRoundBet,
      isAllIn: p.isAllIn
    }))
  });

  // Send private hole cards to each player
  for (const player of handPlayers) {
    sendPrivateCards(player.playerId.toString(), tableId, player.holeCards);
  }

  return { handId, hand };
}

/**
 * Process a player action
 */
export async function processAction(handId, playerId, action, amount = 0) {
  const hands = await getCollection('poker_hands');
  const tables = await getCollection('poker_tables');

  const hand = await hands.findOne({ _id: new ObjectId(handId) });
  if (!hand) throw new Error('Hand not found');

  if (hand.status === HAND_STATUS.COMPLETE) {
    throw new Error('Hand is already complete');
  }

  const playerIdObj = new ObjectId(playerId);
  const player = hand.players.find(p => p.playerId.toString() === playerId);
  if (!player) throw new Error('Player not in hand');

  if (player.isFolded) throw new Error('Player has folded');
  if (player.isAllIn) throw new Error('Player is all-in');

  // Validate it's this player's turn
  if (player.position !== hand.actingPosition) {
    throw new Error('Not your turn');
  }

  // Validate and process the action
  const validActions = getValidActions(hand, player);
  if (!validActions.includes(action)) {
    throw new Error(`Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`);
  }

  const actionResult = executeAction(hand, player, action, amount);

  // Record action
  hand.actions.push({
    playerId: playerIdObj,
    action,
    amount: actionResult.amount,
    timestamp: new Date(),
    street: hand.status
  });

  // Update player state
  Object.assign(player, actionResult.playerUpdate);
  player.hasActed = true;

  // Update pot
  hand.pot += actionResult.potContribution;
  if (actionResult.newCurrentBet) {
    hand.currentBet = actionResult.newCurrentBet;
    hand.minRaise = actionResult.minRaise || hand.minRaise;
    hand.lastRaise = actionResult.lastRaise || hand.lastRaise;
  }

  // Check if betting round is complete
  const roundComplete = isBettingRoundComplete(hand);

  if (roundComplete) {
    // Check if only one player remains
    const activePlayers = hand.players.filter(p => !p.isFolded);
    if (activePlayers.length === 1) {
      // Award pot to last player standing
      await awardPot(hand, [activePlayers[0]]);
      hand.status = HAND_STATUS.COMPLETE;
      hand.endedAt = new Date();
    } else {
      // Advance to next street
      await advanceStreet(hand);
    }
  } else {
    // Move to next player
    hand.actingPosition = getNextActingPosition(hand);
  }

  // Save hand with last action time
  hand.lastActionAt = new Date();
  await hands.updateOne(
    { _id: new ObjectId(handId) },
    { $set: hand }
  );

  // Update table seats
  const table = await tables.findOne({ _id: hand.tableId });
  for (const p of hand.players) {
    await tables.updateOne(
      { _id: hand.tableId, 'seats.playerId': p.playerId },
      {
        $set: {
          'seats.$.chipStack': p.chipStackCurrent,
          'seats.$.currentBet': p.currentRoundBet,
          'seats.$.isActive': !p.isFolded && !p.isAllIn,
          'seats.$.lastAction': action
        }
      }
    );
  }

  // Broadcast player action
  const tableIdStr = hand.tableId.toString();
  broadcastTableUpdate(tableIdStr, PUSHER_EVENTS.PLAYER_ACTION, {
    playerId: playerId.toString(),
    position: player.position,
    action,
    amount: actionResult.amount,
    pot: hand.pot,
    currentBet: hand.currentBet,
    actingPosition: hand.actingPosition,
    status: hand.status
  });

  // Broadcast community cards if new street was dealt
  if (hand.communityCards.length > 0) {
    broadcastTableUpdate(tableIdStr, PUSHER_EVENTS.COMMUNITY_CARDS, {
      communityCards: hand.communityCards,
      status: hand.status
    });
  }

  // Broadcast hand complete if applicable
  if (hand.status === HAND_STATUS.COMPLETE) {
    broadcastTableUpdate(tableIdStr, PUSHER_EVENTS.HAND_COMPLETE, {
      winners: hand.winners,
      players: hand.players.map(p => ({
        playerId: p.playerId.toString(),
        position: p.position,
        holeCards: p.holeCards,
        chipStack: p.chipStackCurrent,
        isFolded: p.isFolded
      })),
      pot: hand.pot,
      communityCards: hand.communityCards
    });

    // Check for eliminated players (0 chips) in tournament play
    if (hand.tournamentId) {
      const eliminatedPlayers = hand.players.filter(p => p.chipStackCurrent <= 0);
      for (const eliminated of eliminatedPlayers) {
        try {
          await eliminatePlayer(hand.tournamentId.toString(), eliminated.playerId.toString());
          console.log(`Player ${eliminated.playerId} eliminated from tournament`);
        } catch (e) {
          console.error('Elimination error:', e);
        }
      }

      // Check if tournament is complete
      await checkTournamentComplete(hand.tournamentId.toString());
    }
  }

  return {
    success: true,
    hand: sanitizeHandForPlayer(hand, playerId),
    action,
    amount: actionResult.amount,
    isHandComplete: hand.status === HAND_STATUS.COMPLETE
  };
}

/**
 * Get valid actions for a player
 */
export function getValidActions(hand, player) {
  const actions = [];
  const toCall = hand.currentBet - player.currentRoundBet;

  // Can always fold (unless no bet to call)
  if (toCall > 0) {
    actions.push(ACTIONS.FOLD);
  }

  // Check if can check
  if (toCall === 0) {
    actions.push(ACTIONS.CHECK);
  }

  // Call
  if (toCall > 0 && toCall < player.chipStackCurrent) {
    actions.push(ACTIONS.CALL);
  }

  // All-in (can always go all-in if have chips)
  if (player.chipStackCurrent > 0) {
    actions.push(ACTIONS.ALL_IN);
  }

  // Bet (only if no current bet)
  if (hand.currentBet === 0 && player.chipStackCurrent > 0) {
    actions.push(ACTIONS.BET);
  }

  // Raise (if there's a bet and we have enough chips)
  if (hand.currentBet > 0 && player.chipStackCurrent > toCall) {
    actions.push(ACTIONS.RAISE);
  }

  return actions;
}

/**
 * Execute a player action and return updates
 */
function executeAction(hand, player, action, amount) {
  const toCall = hand.currentBet - player.currentRoundBet;
  let potContribution = 0;
  let newCurrentBet = null;
  let minRaise = null;
  let lastRaise = null;
  const playerUpdate = {};

  switch (action) {
    case ACTIONS.FOLD:
      playerUpdate.isFolded = true;
      break;

    case ACTIONS.CHECK:
      // No chips moved
      break;

    case ACTIONS.CALL:
      const callAmount = Math.min(toCall, player.chipStackCurrent);
      playerUpdate.chipStackCurrent = player.chipStackCurrent - callAmount;
      playerUpdate.currentRoundBet = player.currentRoundBet + callAmount;
      playerUpdate.totalBet = player.totalBet + callAmount;
      potContribution = callAmount;
      if (playerUpdate.chipStackCurrent === 0) {
        playerUpdate.isAllIn = true;
      }
      amount = callAmount;
      break;

    case ACTIONS.BET:
      // Minimum bet is big blind (minRaise)
      const betAmount = Math.max(amount, hand.minRaise);
      const actualBet = Math.min(betAmount, player.chipStackCurrent);
      playerUpdate.chipStackCurrent = player.chipStackCurrent - actualBet;
      playerUpdate.currentRoundBet = player.currentRoundBet + actualBet;
      playerUpdate.totalBet = player.totalBet + actualBet;
      potContribution = actualBet;
      newCurrentBet = playerUpdate.currentRoundBet;
      minRaise = actualBet;
      lastRaise = actualBet;
      if (playerUpdate.chipStackCurrent === 0) {
        playerUpdate.isAllIn = true;
      }
      amount = actualBet;
      break;

    case ACTIONS.RAISE:
      // Minimum raise is last raise amount
      const minRaiseAmount = hand.lastRaise;
      const raiseToAmount = Math.max(amount, hand.currentBet + minRaiseAmount);
      const totalNeeded = raiseToAmount - player.currentRoundBet;
      const actualRaise = Math.min(totalNeeded, player.chipStackCurrent);

      playerUpdate.chipStackCurrent = player.chipStackCurrent - actualRaise;
      playerUpdate.currentRoundBet = player.currentRoundBet + actualRaise;
      playerUpdate.totalBet = player.totalBet + actualRaise;
      potContribution = actualRaise;
      newCurrentBet = playerUpdate.currentRoundBet;

      const raiseAmount = newCurrentBet - hand.currentBet;
      minRaise = Math.max(raiseAmount, hand.minRaise);
      lastRaise = raiseAmount;

      if (playerUpdate.chipStackCurrent === 0) {
        playerUpdate.isAllIn = true;
      }
      amount = actualRaise;
      break;

    case ACTIONS.ALL_IN:
      const allInAmount = player.chipStackCurrent;
      playerUpdate.chipStackCurrent = 0;
      playerUpdate.currentRoundBet = player.currentRoundBet + allInAmount;
      playerUpdate.totalBet = player.totalBet + allInAmount;
      playerUpdate.isAllIn = true;
      potContribution = allInAmount;

      if (playerUpdate.currentRoundBet > hand.currentBet) {
        newCurrentBet = playerUpdate.currentRoundBet;
        const allInRaise = newCurrentBet - hand.currentBet;
        if (allInRaise >= hand.minRaise) {
          minRaise = allInRaise;
          lastRaise = allInRaise;
        }
      }
      amount = allInAmount;
      break;
  }

  return {
    amount,
    potContribution,
    newCurrentBet,
    minRaise,
    lastRaise,
    playerUpdate
  };
}

/**
 * Check if betting round is complete
 */
function isBettingRoundComplete(hand) {
  const activePlayers = hand.players.filter(p => !p.isFolded && !p.isAllIn);

  // If only one active player, round is complete
  if (activePlayers.length <= 1) {
    return true;
  }

  // Check if all active players have acted and matched the current bet
  for (const player of activePlayers) {
    if (!player.hasActed) return false;
    if (player.currentRoundBet < hand.currentBet) return false;
  }

  return true;
}

/**
 * Get next player to act
 */
function getNextActingPosition(hand) {
  const activePlayers = hand.players.filter(p => !p.isFolded && !p.isAllIn);
  const positions = activePlayers.map(p => p.position).sort((a, b) => a - b);

  const currentIdx = positions.indexOf(hand.actingPosition);
  let nextIdx = (currentIdx + 1) % positions.length;

  // Find next player who hasn't matched the bet
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[(currentIdx + 1 + i) % positions.length];
    const player = hand.players.find(p => p.position === pos);
    if (!player.isFolded && !player.isAllIn) {
      if (!player.hasActed || player.currentRoundBet < hand.currentBet) {
        return pos;
      }
    }
  }

  return positions[nextIdx];
}

/**
 * Advance to next street
 */
async function advanceStreet(hand) {
  // Reset for new betting round
  for (const player of hand.players) {
    player.currentRoundBet = 0;
    player.hasActed = false;
  }
  hand.currentBet = 0;

  // Find first active player after dealer
  const activePlayers = hand.players.filter(p => !p.isFolded && !p.isAllIn);
  const positions = activePlayers.map(p => p.position).sort((a, b) => a - b);

  // First to act is first position after dealer
  let firstToAct = null;
  for (const pos of positions) {
    if (pos > hand.dealerPosition) {
      firstToAct = pos;
      break;
    }
  }
  if (!firstToAct) firstToAct = positions[0];

  hand.actingPosition = firstToAct;

  switch (hand.status) {
    case HAND_STATUS.PREFLOP:
      // Deal flop
      const { flop, remaining: deckAfterFlop } = dealFlop(hand.deck);
      hand.communityCards = flop;
      hand.deck = deckAfterFlop;
      hand.status = HAND_STATUS.FLOP;
      break;

    case HAND_STATUS.FLOP:
      // Deal turn
      const { turn, remaining: deckAfterTurn } = dealTurn(hand.deck);
      hand.communityCards.push(turn);
      hand.deck = deckAfterTurn;
      hand.status = HAND_STATUS.TURN;
      break;

    case HAND_STATUS.TURN:
      // Deal river
      const { river, remaining: deckAfterRiver } = dealRiver(hand.deck);
      hand.communityCards.push(river);
      hand.deck = deckAfterRiver;
      hand.status = HAND_STATUS.RIVER;
      break;

    case HAND_STATUS.RIVER:
      // Go to showdown
      hand.status = HAND_STATUS.SHOWDOWN;
      await resolveShowdown(hand);
      break;
  }

  // Check if all remaining players are all-in (skip to showdown)
  if (activePlayers.length === 0 && hand.status !== HAND_STATUS.SHOWDOWN) {
    // Deal remaining community cards
    while (hand.communityCards.length < 5) {
      if (hand.communityCards.length === 0) {
        const { flop, remaining } = dealFlop(hand.deck);
        hand.communityCards = flop;
        hand.deck = remaining;
      } else if (hand.communityCards.length === 3) {
        const { turn, remaining } = dealTurn(hand.deck);
        hand.communityCards.push(turn);
        hand.deck = remaining;
      } else if (hand.communityCards.length === 4) {
        const { river, remaining } = dealRiver(hand.deck);
        hand.communityCards.push(river);
        hand.deck = remaining;
      }
    }
    hand.status = HAND_STATUS.SHOWDOWN;
    await resolveShowdown(hand);
  }
}

/**
 * Resolve showdown - determine winners
 */
async function resolveShowdown(hand) {
  const eligiblePlayers = hand.players.filter(p => !p.isFolded);

  if (eligiblePlayers.length === 1) {
    // Only one player left
    await awardPot(hand, eligiblePlayers);
  } else {
    // Calculate side pots if needed
    const pots = calculateSidePots(hand);

    // Evaluate each player's hand
    const evaluatedPlayers = eligiblePlayers.map(p => ({
      ...p,
      handEval: evaluateHand([...p.holeCards, ...hand.communityCards])
    }));

    // Award each pot
    const allWinners = [];
    for (const pot of pots) {
      const potPlayers = evaluatedPlayers.filter(p =>
        pot.eligiblePlayers.some(ep => ep.toString() === p.playerId.toString())
      );

      // Find winners for this pot
      const winners = findWinners(
        potPlayers.map(p => ({ playerId: p.playerId.toString(), cards: p.holeCards })),
        hand.communityCards
      );

      const winShare = Math.floor(pot.amount / winners.length);
      for (const winner of winners) {
        const player = hand.players.find(p => p.playerId.toString() === winner.playerId);
        player.chipStackCurrent += winShare;
        allWinners.push({
          playerId: player.playerId,
          amount: winShare,
          handDescription: winner.hand.description,
          pot: pot.name || 'Main Pot'
        });
      }
    }

    hand.winners = allWinners;
  }

  hand.status = HAND_STATUS.COMPLETE;
  hand.endedAt = new Date();
}

/**
 * Calculate side pots
 */
function calculateSidePots(hand) {
  const eligiblePlayers = hand.players.filter(p => !p.isFolded);

  // Get unique bet amounts (sorted)
  const betAmounts = [...new Set(eligiblePlayers.map(p => p.totalBet))].sort((a, b) => a - b);

  if (betAmounts.length === 1) {
    // No side pots needed
    return [{
      amount: hand.pot,
      eligiblePlayers: eligiblePlayers.map(p => p.playerId),
      name: 'Main Pot'
    }];
  }

  const pots = [];
  let previousBet = 0;

  for (let i = 0; i < betAmounts.length; i++) {
    const currentBet = betAmounts[i];
    const betDiff = currentBet - previousBet;

    // Players eligible for this pot level
    const eligible = eligiblePlayers.filter(p => p.totalBet >= currentBet);

    // Calculate pot amount for this level
    const playersAtThisLevel = hand.players.filter(p => p.totalBet >= currentBet).length;
    const potAmount = betDiff * playersAtThisLevel;

    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayers: eligible.map(p => p.playerId),
        name: i === 0 ? 'Main Pot' : `Side Pot ${i}`
      });
    }

    previousBet = currentBet;
  }

  return pots;
}

/**
 * Award pot to winner(s)
 */
async function awardPot(hand, winners) {
  const winShare = Math.floor(hand.pot / winners.length);

  hand.winners = winners.map(w => {
    const player = hand.players.find(p => p.playerId.toString() === w.playerId.toString());
    player.chipStackCurrent += winShare;
    return {
      playerId: player.playerId,
      amount: winShare,
      handDescription: 'Last player standing'
    };
  });
}

/**
 * Sanitize hand data for a specific player (hide other players' cards)
 */
export function sanitizeHandForPlayer(hand, playerId) {
  return {
    _id: hand._id,
    tableId: hand.tableId,
    tournamentId: hand.tournamentId,
    handNumber: hand.handNumber,
    status: hand.status,
    communityCards: hand.communityCards,
    pot: hand.pot,
    sidePots: hand.sidePots,
    currentBet: hand.currentBet,
    minRaise: hand.minRaise,
    actingPosition: hand.actingPosition,
    dealerPosition: hand.dealerPosition,
    sbPosition: hand.sbPosition,
    bbPosition: hand.bbPosition,
    players: hand.players.map(p => ({
      playerId: p.playerId,
      position: p.position,
      chipStackCurrent: p.chipStackCurrent,
      totalBet: p.totalBet,
      currentRoundBet: p.currentRoundBet,
      isAllIn: p.isAllIn,
      isFolded: p.isFolded,
      hasActed: p.hasActed,
      // Only show hole cards if it's this player OR showdown
      holeCards: (p.playerId.toString() === playerId || hand.status === HAND_STATUS.SHOWDOWN)
        ? p.holeCards
        : null
    })),
    actions: hand.actions,
    winners: hand.winners,
    startedAt: hand.startedAt,
    endedAt: hand.endedAt
  };
}

/**
 * Get current hand state for a table
 */
export async function getCurrentHand(tableId) {
  const tables = await getCollection('poker_tables');
  const hands = await getCollection('poker_hands');

  const table = await tables.findOne({ _id: new ObjectId(tableId) });
  if (!table) return null;

  if (!table.currentHandId) return null;

  const hand = await hands.findOne({ _id: table.currentHandId });
  return hand;
}
