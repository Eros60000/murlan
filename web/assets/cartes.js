/*
 * Rendu visuel des cartes (DOM + texte/symboles, aucune image externe).
 */
(function (global) {
  'use strict';

  var SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var RED_SUITS = { H: true, D: true };

  function isRed(card) {
    if (card.rank === 'JR') return true;
    if (card.rank === 'JB') return false;
    return !!RED_SUITS[card.suit];
  }

  function rankLabel(rank) {
    if (rank === 'JB' || rank === 'JR') return '';
    return rank;
  }

  function createCardElement(card, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    var isJoker = card.rank === 'JB' || card.rank === 'JR';
    el.className = 'card ' + (isRed(card) ? 'card--red' : 'card--black') + (isJoker ? ' card--joker' : '');
    el.dataset.key = card.rank + (card.suit || '');

    if (isJoker) {
      el.innerHTML =
        '<div class="card__corner card__corner--tl">★</div>' +
        '<div class="card__center card__center--joker">JOKER</div>' +
        '<div class="card__corner card__corner--br">★</div>';
    } else {
      var symbol = SUIT_SYMBOLS[card.suit];
      var label = rankLabel(card.rank);
      el.innerHTML =
        '<div class="card__corner card__corner--tl"><span>' + label + '</span><span>' + symbol + '</span></div>' +
        '<div class="card__center">' + symbol + '</div>' +
        '<div class="card__corner card__corner--br"><span>' + label + '</span><span>' + symbol + '</span></div>';
    }

    if (opts.selected) el.classList.add('card--selected');
    if (opts.selectable) el.classList.add('card--selectable');
    return el;
  }

  function createCardBackElement() {
    var el = document.createElement('div');
    el.className = 'card card--back';
    return el;
  }

  global.Murlan = global.Murlan || {};
  global.Murlan.Cards = {
    createCardElement: createCardElement,
    createCardBackElement: createCardBackElement,
    isRed: isRed,
    rankLabel: rankLabel
  };
})(window);
