/*
 * IA des 3 adversaires (V1) : heuristique simple, pas d'apprentissage.
 * A son tour, choisit soit un coup a jouer (combo), soit de passer.
 */
(function (global) {
  'use strict';

  var G = global.Murlan.Game;
  var TYPE_ORDER = { STRAIGHT: 0, TRIPLE: 1, PAIR: 2, SINGLE: 3, QUAD: 4 };

  function isJokerCard(card) {
    return card.rank === 'JB' || card.rank === 'JR';
  }

  function containsJokerOrQuad(combo) {
    return combo.type === 'QUAD' || combo.cards.some(isJokerCard);
  }

  function chooseMove(match, playerIndex) {
    var round = match.round;
    var hand = round.hands[playerIndex];
    var legal = G.legalCombosFor(match, playerIndex);

    if (round.trick.requirement) {
      if (legal.length === 0) return { action: 'pass' };

      var nonBomb = legal.filter(function (c) { return c.type !== 'QUAD'; });
      var candidates = nonBomb.length > 0 ? nonBomb : legal;

      if (nonBomb.length === 0) {
        // seule option : bombarder. On garde la bombe si la main est encore
        // grande et que ca ne permet pas de gagner tout de suite.
        var wouldEmptyHand = legal.some(function (c) { return c.cards.length === hand.length; });
        if (!wouldEmptyHand && hand.length > 5) return { action: 'pass' };
      }

      candidates = candidates.slice().sort(function (a, b) { return a.rankValue - b.rankValue; });
      return { action: 'play', combo: candidates[0] };
    }

    // Ouverture libre : ecouler les cartes basses en priorite, garder
    // jokers/carres pour plus tard sauf si rien d'autre n'est possible.
    var safe = legal.filter(function (c) { return !containsJokerOrQuad(c); });
    var pool = safe.length > 0 ? safe : legal;

    pool = pool.slice().sort(function (a, b) {
      if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
      return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    });

    return { action: 'play', combo: pool[0] };
  }

  function chooseExchangeReturn(hand) {
    var lo = G.rankValue('3');
    var hi = G.rankValue('10');
    var candidates = hand.filter(function (c) {
      var rv = G.rankValue(c.rank);
      return rv >= lo && rv <= hi;
    }).sort(function (a, b) { return G.rankValue(a.rank) - G.rankValue(b.rank); });
    return candidates.length ? candidates[0] : hand[0];
  }

  global.Murlan.AI = { chooseMove: chooseMove, chooseExchangeReturn: chooseExchangeReturn };
})(window);
