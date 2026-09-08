/*
 * Moteur du jeu Murlan. Aucune dependance au DOM : uniquement les regles.
 * Regles source : ../REGLES-MURLAN.md
 */
(function (global) {
  'use strict';

  var SUITS = ['S', 'H', 'D', 'C'];
  var STRAIGHT_RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var RANK_ORDER = STRAIGHT_RANKS.concat(['2', 'JB', 'JR']);

  function rankValue(rank) {
    return RANK_ORDER.indexOf(rank);
  }

  function cardKey(card) {
    return card.rank + (card.suit || '');
  }

  function buildDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < STRAIGHT_RANKS.length; r++) {
        deck.push({ rank: STRAIGHT_RANKS[r], suit: SUITS[s] });
      }
      deck.push({ rank: '2', suit: SUITS[s] });
    }
    deck.push({ rank: 'JB', suit: null });
    deck.push({ rank: 'JR', suit: null });
    return deck;
  }

  function shuffle(deck) {
    var arr = deck.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function sortHand(hand) {
    hand.sort(function (a, b) { return rankValue(a.rank) - rankValue(b.rank); });
    return hand;
  }

  // 54 cartes / 4 joueurs : 13 chacun, 2 cartes restantes forment un talon mort.
  function dealHands(deck, numPlayers) {
    var hands = [];
    for (var p = 0; p < numPlayers; p++) hands.push([]);
    var perPlayer = 13;
    var idx = 0;
    for (var i = 0; i < numPlayers * perPlayer; i++) {
      hands[i % numPlayers].push(deck[idx++]);
    }
    var kitty = deck.slice(idx);
    hands.forEach(sortHand);
    return { hands: hands, kitty: kitty };
  }

  function identifyCombo(cards) {
    if (!cards || cards.length === 0) return null;
    var n = cards.length;

    if (n === 1) {
      return { type: 'SINGLE', length: 1, rankValue: rankValue(cards[0].rank), cards: cards };
    }

    var ranks = cards.map(function (c) { return c.rank; });
    var uniqueRanks = {};
    ranks.forEach(function (r) { uniqueRanks[r] = true; });
    var uniqueCount = Object.keys(uniqueRanks).length;

    if (uniqueCount === 1) {
      var r0 = cards[0].rank;
      if (r0 === 'JB' || r0 === 'JR') return null; // jokers uniquement en carte simple
      if (n === 2) return { type: 'PAIR', length: 2, rankValue: rankValue(r0), cards: cards };
      if (n === 3) return { type: 'TRIPLE', length: 3, rankValue: rankValue(r0), cards: cards };
      if (n === 4) return { type: 'QUAD', length: 4, rankValue: rankValue(r0), cards: cards };
      return null;
    }

    if (n >= 5) {
      if (ranks.indexOf('2') !== -1 || ranks.indexOf('JB') !== -1 || ranks.indexOf('JR') !== -1) return null;
      if (uniqueCount !== n) return null; // pas de doublon de rang dans une suite
      var idxs = cards.map(function (c) { return STRAIGHT_RANKS.indexOf(c.rank); }).sort(function (a, b) { return a - b; });
      for (var i2 = 1; i2 < idxs.length; i2++) {
        if (idxs[i2] !== idxs[i2 - 1] + 1) return null;
      }
      return { type: 'STRAIGHT', length: n, rankValue: idxs[0], cards: cards };
    }

    return null;
  }

  // combo bat-il requirement ? requirement null = ouverture libre.
  function combatBeats(combo, requirement) {
    if (!requirement) return true;
    if (combo.type === 'QUAD' && requirement.type !== 'QUAD') return true;
    if (combo.type !== requirement.type) return false;
    if (combo.length !== requirement.length) return false;
    return combo.rankValue > requirement.rankValue;
  }

  function enumerateCombos(hand) {
    var byRank = {};
    hand.forEach(function (c) {
      if (!byRank[c.rank]) byRank[c.rank] = [];
      byRank[c.rank].push(c);
    });

    var combos = [];

    hand.forEach(function (c) {
      combos.push({ type: 'SINGLE', length: 1, rankValue: rankValue(c.rank), cards: [c] });
    });

    Object.keys(byRank).forEach(function (rank) {
      if (rank === 'JB' || rank === 'JR') return;
      var group = byRank[rank];
      if (group.length >= 2) combos.push({ type: 'PAIR', length: 2, rankValue: rankValue(rank), cards: group.slice(0, 2) });
      if (group.length >= 3) combos.push({ type: 'TRIPLE', length: 3, rankValue: rankValue(rank), cards: group.slice(0, 3) });
      if (group.length >= 4) combos.push({ type: 'QUAD', length: 4, rankValue: rankValue(rank), cards: group.slice(0, 4) });
    });

    var present = STRAIGHT_RANKS.map(function (r) { return !!(byRank[r] && byRank[r].length > 0); });
    var runStart = null;
    for (var i = 0; i <= STRAIGHT_RANKS.length; i++) {
      var has = i < STRAIGHT_RANKS.length && present[i];
      if (has) {
        if (runStart === null) runStart = i;
      } else if (runStart !== null) {
        var runEnd = i - 1;
        var runLen = runEnd - runStart + 1;
        if (runLen >= 5) {
          for (var len = 5; len <= runLen; len++) {
            for (var start = runStart; start + len - 1 <= runEnd; start++) {
              var cards = [];
              for (var k = start; k < start + len; k++) cards.push(byRank[STRAIGHT_RANKS[k]][0]);
              combos.push({ type: 'STRAIGHT', length: len, rankValue: start, cards: cards });
            }
          }
        }
        runStart = null;
      }
    }

    return combos;
  }

  function createMatch(playerNames) {
    return {
      numPlayers: 4,
      playerNames: playerNames,
      scores: [0, 0, 0, 0],
      matchOver: false,
      winner: null,
      roundNumber: 0,
      everFirstTrickPlayed: false,
      lastRoundOrder: null,
      lastRoundFirstPlace: null,
      round: null
    };
  }

  function nextActivePlayer(round, fromIndex) {
    var i = fromIndex;
    do {
      i = (i + 1) % 4;
    } while (round.active.indexOf(i) === -1);
    return i;
  }

  function dealNewRound(match) {
    match.roundNumber += 1;
    var deck = shuffle(buildDeck());
    var dealt = dealHands(deck, match.numPlayers);

    var round = {
      hands: dealt.hands,
      kitty: dealt.kitty,
      active: [0, 1, 2, 3],
      finishedOrder: [],
      trick: { requirement: null, leader: null, plays: [], passesInRow: 0 },
      currentPlayer: null,
      exchangeInfo: null,
      over: false
    };
    match.round = round;

    var leader;
    var requireThreeSpadesOpen = false;
    if (!match.everFirstTrickPlayed) {
      leader = round.hands.findIndex(function (h) {
        return h.some(function (c) { return c.rank === '3' && c.suit === 'S'; });
      });
      if (leader === -1) {
        // Le 3 de pique est tombe dans le talon mort (2 cartes non distribuees) :
        // personne ne peut l'avoir en main. On demarre quand meme, sans obliger
        // personne a jouer une carte que personne ne possede.
        leader = 0;
      } else {
        requireThreeSpadesOpen = true;
      }
    } else {
      leader = match.lastRoundFirstPlace != null ? match.lastRoundFirstPlace : 0;
    }
    round.trick.leader = leader;
    round.currentPlayer = leader;
    round.requireThreeSpadesOpen = requireThreeSpadesOpen;

    if (match.roundNumber > 1 && match.lastRoundOrder) {
      var firstP = match.lastRoundOrder[0];
      var lastP = match.lastRoundOrder[3];
      var lastHand = round.hands[lastP];
      var hasBothJokers = lastHand.some(function (c) { return c.rank === 'JB'; }) &&
        lastHand.some(function (c) { return c.rank === 'JR'; });

      if (hasBothJokers) {
        round.exchangeInfo = { skipped: true, lastP: lastP, firstP: firstP, pending: false };
      } else {
        var highestIdx = 0;
        for (var i = 1; i < lastHand.length; i++) {
          if (rankValue(lastHand[i].rank) > rankValue(lastHand[highestIdx].rank)) highestIdx = i;
        }
        var givenCard = lastHand.splice(highestIdx, 1)[0];
        round.hands[firstP].push(givenCard);
        sortHand(round.hands[firstP]);
        round.exchangeInfo = { skipped: false, lastP: lastP, firstP: firstP, givenCard: givenCard, pending: true };
      }
    }

    return round;
  }

  function resolveExchangeReturn(match, cardKeyToGive) {
    var round = match.round;
    var info = round.exchangeInfo;
    if (!info || info.skipped || !info.pending) return { ok: false, reason: 'no-exchange-pending' };

    var hand = round.hands[info.firstP];
    var idx = -1;
    for (var i = 0; i < hand.length; i++) {
      if (cardKey(hand[i]) === cardKeyToGive) { idx = i; break; }
    }
    if (idx === -1) return { ok: false, reason: 'card-not-in-hand' };

    var rv = rankValue(hand[idx].rank);
    if (rv < rankValue('3') || rv > rankValue('10')) return { ok: false, reason: 'card-must-be-3-to-10' };

    var card = hand.splice(idx, 1)[0];
    round.hands[info.lastP].push(card);
    sortHand(round.hands[info.lastP]);
    info.pending = false;
    return { ok: true };
  }

  function legalCombosFor(match, playerIndex) {
    var round = match.round;
    var hand = round.hands[playerIndex];
    var combos = enumerateCombos(hand);

    if (!match.everFirstTrickPlayed && round.requireThreeSpadesOpen) {
      combos = combos.filter(function (c) {
        return c.cards.some(function (card) { return card.rank === '3' && card.suit === 'S'; });
      });
    }

    if (round.trick.requirement) {
      combos = combos.filter(function (c) { return combatBeats(c, round.trick.requirement); });
    }

    return combos;
  }

  function completeRound(match) {
    var round = match.round;
    var points = [3, 2, 1, 0];
    round.finishedOrder.forEach(function (p, i) { match.scores[p] += points[i]; });
    match.lastRoundOrder = round.finishedOrder.slice();
    match.lastRoundFirstPlace = round.finishedOrder[0];
    round.over = true;

    var maxScore = Math.max.apply(null, match.scores);
    if (maxScore >= 21) {
      var leaders = [];
      match.scores.forEach(function (s, i) { if (s === maxScore) leaders.push(i); });
      if (leaders.length === 1) {
        match.matchOver = true;
        match.winner = leaders[0];
      }
    }
  }

  function finalizeRoundIfOver(match) {
    var round = match.round;
    if (round.active.length === 1) {
      round.finishedOrder.push(round.active[0]);
      round.active = [];
    }
    if (round.active.length === 0 && !round.over) {
      completeRound(match);
    }
  }

  function playCards(match, playerIndex, cardKeys) {
    var round = match.round;
    if (round.currentPlayer !== playerIndex) return { ok: false, reason: 'not-your-turn' };

    var hand = round.hands[playerIndex];
    var cards = cardKeys.map(function (k) {
      return hand.find(function (c) { return cardKey(c) === k; });
    }).filter(Boolean);
    if (cards.length !== cardKeys.length) return { ok: false, reason: 'cards-not-in-hand' };

    var combo = identifyCombo(cards);
    if (!combo) return { ok: false, reason: 'invalid-combo' };

    if (!match.everFirstTrickPlayed && round.requireThreeSpadesOpen) {
      var has3S = cards.some(function (c) { return c.rank === '3' && c.suit === 'S'; });
      if (!has3S) return { ok: false, reason: 'must-include-3-spades' };
    }

    if (round.trick.requirement && !combatBeats(combo, round.trick.requirement)) {
      return { ok: false, reason: 'does-not-beat' };
    }

    var keySet = {};
    cardKeys.forEach(function (k) { keySet[k] = true; });
    round.hands[playerIndex] = hand.filter(function (c) { return !keySet[cardKey(c)]; });

    round.trick.plays.push({ player: playerIndex, cards: cards, combo: combo });
    round.trick.requirement = combo;
    round.trick.passesInRow = 0;
    match.everFirstTrickPlayed = true;

    if (round.hands[playerIndex].length === 0) {
      round.finishedOrder.push(playerIndex);
      round.active = round.active.filter(function (p) { return p !== playerIndex; });
    }

    if (round.active.length <= 1) {
      finalizeRoundIfOver(match);
    } else {
      round.currentPlayer = nextActivePlayer(round, playerIndex);
    }

    return { ok: true, combo: combo };
  }

  function passTurn(match, playerIndex) {
    var round = match.round;
    if (round.currentPlayer !== playerIndex) return { ok: false, reason: 'not-your-turn' };
    if (!round.trick.requirement) return { ok: false, reason: 'cannot-pass-when-leading' };

    round.trick.passesInRow += 1;
    var lastPlayer = round.trick.plays[round.trick.plays.length - 1].player;
    var activeOthers = round.active.filter(function (p) { return p !== lastPlayer; }).length;

    if (round.trick.passesInRow >= activeOthers) {
      var newLeader = round.active.indexOf(lastPlayer) !== -1 ? lastPlayer : nextActivePlayer(round, lastPlayer);
      round.trick = { requirement: null, leader: newLeader, plays: [], passesInRow: 0 };
      round.currentPlayer = newLeader;
      if (round.active.length <= 1) finalizeRoundIfOver(match);
      return { ok: true, trickCollected: true };
    }

    round.currentPlayer = nextActivePlayer(round, playerIndex);
    return { ok: true };
  }

  global.Murlan = global.Murlan || {};
  global.Murlan.Game = {
    RANK_ORDER: RANK_ORDER,
    STRAIGHT_RANKS: STRAIGHT_RANKS,
    SUITS: SUITS,
    rankValue: rankValue,
    cardKey: cardKey,
    buildDeck: buildDeck,
    shuffle: shuffle,
    identifyCombo: identifyCombo,
    combatBeats: combatBeats,
    enumerateCombos: enumerateCombos,
    createMatch: createMatch,
    dealNewRound: dealNewRound,
    resolveExchangeReturn: resolveExchangeReturn,
    legalCombosFor: legalCombosFor,
    playCards: playCards,
    passTurn: passTurn
  };
})(window);
