/*
 * Orchestration et affichage : relie game.js / ai.js / net.js au DOM.
 *
 * Trois modes : 'solo' (V1, contre IA), 'host' (on cree une partie et un
 * ami la rejoint via un code), 'client' (on rejoint la partie d'un ami).
 * En mode host/solo, ce fichier fait tourner game.js normalement (comme en
 * V1) et diffuse l'etat a l'ami connecte apres chaque changement. En mode
 * client, aucune regle n'est calculee localement : on affiche l'etat recu
 * de l'hote et on lui envoie nos intentions de coup.
 */
(function (global) {
  'use strict';

  var G = global.Murlan.Game;
  var AI = global.Murlan.AI;
  var Cards = global.Murlan.Cards;
  var Net = global.Murlan.Net;

  // Nom neutre pour le siege 0 dans les DONNEES du match (jamais "Vous" en
  // dur : ce mot n'existe qu'a l'affichage via displayName(), sinon il fuit
  // tel quel vers un ami connecte qui n'est pas assis a ce siege-la).
  var PLAYER_NAMES = ['Hôte', 'Besnik', 'Elira', 'Driton'];
  var SEAT_IDS = ['hand-0', 'hand-1', 'hand-2', 'hand-3']; // ids = EMPLACEMENT visuel (0=bas,1=gauche,2=haut,3=droite), pas le joueur absolu
  var NAME_IDS = ['name-0', 'name-1', 'name-2', 'name-3'];
  var TYPE_LABELS = { SINGLE: 'carte simple', PAIR: 'paire', TRIPLE: 'brelan', QUAD: 'carré', STRAIGHT: 'suite' };
  var RANK_LABELS = { '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', J: 'valet', Q: 'dame', K: 'roi', A: 'as', '2': '2', JB: 'joker', JR: 'joker' };
  var CLIENT_SEAT = 1; // siege fixe attribue a l'ami invite en mode host/client

  var match = null;
  var selectedKeys = {};
  var exchangeMode = null; // { info } quand c'est a MOI de choisir une carte a rendre
  var thinkingPlayer = null; // index du bot qui "reflechit" pendant le delai avant de jouer

  var netMode = 'solo'; // 'solo' | 'host' | 'client'
  var mySeat = 0; // le siege affiche en bas, celui de la personne devant cet ecran
  var currentNames = PLAYER_NAMES.slice();

  var el = {};

  function cacheDom() {
    el.trickArea = document.getElementById('trick-area');
    el.message = document.getElementById('message');
    el.scoreboard = document.getElementById('scoreboard');
    el.btnPlay = document.getElementById('btn-play');
    el.btnPass = document.getElementById('btn-pass');
    el.btnGiveCard = document.getElementById('btn-give-card');
    el.modal = document.getElementById('round-over-modal');
    el.modalTitle = document.getElementById('round-over-title');
    el.modalList = document.getElementById('round-over-list');
    el.btnNextRound = document.getElementById('btn-next-round');
    el.btnNewMatch = document.getElementById('btn-new-match');

    el.gameRoot = document.getElementById('game-root');
    el.modeScreen = document.getElementById('mode-screen');
    el.modeButtons = document.getElementById('mode-buttons');
    el.btnModeSolo = document.getElementById('btn-mode-solo');
    el.btnModeHost = document.getElementById('btn-mode-host');
    el.btnModeJoin = document.getElementById('btn-mode-join');
    el.hostPanel = document.getElementById('host-panel');
    el.roomCode = document.getElementById('room-code');
    el.hostStatus = document.getElementById('host-status');
    el.btnCancelHost = document.getElementById('btn-cancel-host');
    el.joinPanel = document.getElementById('join-panel');
    el.joinCodeInput = document.getElementById('join-code-input');
    el.joinStatus = document.getElementById('join-status');
    el.btnConfirmJoin = document.getElementById('btn-confirm-join');
    el.btnCancelJoin = document.getElementById('btn-cancel-join');
  }

  function init() {
    cacheDom();
    bindEvents();
    bindModeEvents();
  }

  function bindEvents() {
    el.btnPlay.addEventListener('click', onPlayClicked);
    el.btnPass.addEventListener('click', onPassClicked);
    el.btnGiveCard.addEventListener('click', onGiveCardClicked);
    el.btnNextRound.addEventListener('click', function () {
      if (netMode === 'client') return; // c'est a l'hote de faire avancer la partie
      el.modal.hidden = true;
      startRound();
    });
    el.btnNewMatch.addEventListener('click', function () {
      if (netMode === 'client') return;
      el.modal.hidden = true;
      match = G.createMatch(currentNames);
      startRound();
    });
  }

  function netErrorText(reason) {
    var map = {
      'load-failed': 'Connexion réseau indisponible. Vérifiez votre connexion internet.',
      'peer-init-failed': "Impossible d'initialiser la connexion.",
      'unavailable-id': 'Réessayez, un code libre va être généré.',
      'peer-unavailable': 'Code introuvable. Vérifiez le code et réessayez.',
      'connect-failed': 'Connexion impossible. Vérifiez le code et réessayez.',
      'timeout': 'Délai dépassé, réessayez.',
      'network': 'Problème réseau, réessayez.'
    };
    return map[reason] || 'Erreur de connexion, réessayez.';
  }

  function toggleModeButtons(show) {
    el.modeButtons.hidden = !show;
  }

  function bindModeEvents() {
    el.btnModeSolo.addEventListener('click', startSolo);

    el.btnModeHost.addEventListener('click', function () {
      toggleModeButtons(false);
      el.hostPanel.hidden = false;
      el.roomCode.textContent = '-----';
      el.hostStatus.textContent = 'Génération du code...';
      Net.host({
        onCode: function (code) {
          el.roomCode.textContent = code;
          el.hostStatus.textContent = "Partagez ce code, en attente de votre ami...";
        },
        onConnected: function () {
          netMode = 'host';
          mySeat = 0;
          currentNames = PLAYER_NAMES.slice();
          currentNames[CLIENT_SEAT] = 'Ami';
          match = G.createMatch(currentNames);
          Net.onMessage(handleHostMessage);
          el.modeScreen.hidden = true;
          el.gameRoot.hidden = false;
          startRound();
        },
        onDisconnected: function () {
          showMessage("Votre ami s'est déconnecté. Vous pouvez continuer seul ou recharger la page pour recommencer.");
        },
        onError: function (reason) {
          el.hostStatus.textContent = netErrorText(reason);
        }
      });
    });

    el.btnCancelHost.addEventListener('click', function () {
      Net.disconnect();
      el.hostPanel.hidden = true;
      toggleModeButtons(true);
    });

    el.btnModeJoin.addEventListener('click', function () {
      toggleModeButtons(false);
      el.joinPanel.hidden = false;
      el.joinStatus.textContent = '';
      el.joinCodeInput.value = '';
      el.joinCodeInput.focus();
    });

    el.btnCancelJoin.addEventListener('click', function () {
      Net.disconnect();
      el.joinPanel.hidden = true;
      toggleModeButtons(true);
    });

    el.btnConfirmJoin.addEventListener('click', confirmJoin);
    el.joinCodeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') confirmJoin();
    });
  }

  function confirmJoin() {
    var code = (el.joinCodeInput.value || '').trim();
    if (!code) { el.joinStatus.textContent = 'Entrez le code reçu de votre ami.'; return; }
    el.joinStatus.textContent = 'Connexion...';
    Net.join(code, {
      onConnected: function () {
        netMode = 'client';
        mySeat = CLIENT_SEAT;
        match = null; // en attente du premier etat envoye par l'hote
        Net.onMessage(handleClientMessage);
        el.modeScreen.hidden = true;
        el.gameRoot.hidden = false;
        showMessage("Connecté ! En attente de l'hôte...");
      },
      onDisconnected: function () {
        showMessage("L'hôte s'est déconnecté. Rechargez la page pour rejoindre une nouvelle partie.");
      },
      onError: function (reason) {
        el.joinStatus.textContent = netErrorText(reason);
      }
    });
  }

  function startSolo() {
    netMode = 'solo';
    mySeat = 0;
    currentNames = PLAYER_NAMES.slice();
    match = G.createMatch(currentNames);
    el.modeScreen.hidden = true;
    el.gameRoot.hidden = false;
    startRound();
  }

  function displayName(absoluteIndex) {
    if (absoluteIndex === mySeat) return 'Vous';
    return match.playerNames[absoluteIndex];
  }

  function seatAt(visualSlot) { return (mySeat + visualSlot) % 4; }
  function visualSlotOf(absoluteSeat) { return (absoluteSeat - mySeat + 4) % 4; }

  function startRound() {
    selectedKeys = {};
    G.dealNewRound(match);
    renderAll();
    handleExchangeIfNeeded();
  }

  function handleExchangeIfNeeded() {
    var info = match.round.exchangeInfo;
    if (!info) { proceedToPlay(); return; }

    if (info.skipped) {
      showMessage(displayName(info.lastP) + ' montre ses deux jokers et ne donne rien.');
      renderAll();
      global.setTimeout(proceedToPlay, 1600);
      return;
    }

    showMessage(displayName(info.lastP) + ' donne sa carte la plus haute à ' + displayName(info.firstP) + '.');

    if (info.firstP === mySeat) {
      exchangeMode = { info: info };
      renderAll();
      showMessage('Choisissez une carte entre 3 et 10 à rendre, puis validez.');
    } else if (netMode === 'host' && info.firstP === CLIENT_SEAT) {
      renderAll(); // en attente de l'intent 'exchangeReturn' du client (handleHostMessage)
    } else {
      var card = AI.chooseExchangeReturn(match.round.hands[info.firstP]);
      G.resolveExchangeReturn(match, G.cardKey(card));
      renderAll();
      global.setTimeout(proceedToPlay, 1200);
    }
  }

  function onGiveCardClicked() {
    if (!exchangeMode) return;
    var keys = Object.keys(selectedKeys);
    if (keys.length !== 1) {
      showMessage('Sélectionnez exactement une carte (entre 3 et 10) à rendre.');
      return;
    }
    if (netMode === 'client') {
      Net.send({ type: 'intent', action: 'exchangeReturn', cardKey: keys[0] });
      exchangeMode = null;
      selectedKeys = {};
      renderControls();
      showMessage('Carte envoyée, en attente...');
      return;
    }
    var res = G.resolveExchangeReturn(match, keys[0]);
    if (!res.ok) {
      showMessage(errorText(res.reason));
      return;
    }
    exchangeMode = null;
    selectedKeys = {};
    proceedToPlay();
  }

  function proceedToPlay() {
    renderAll();
    scheduleNextTurn();
  }

  function scheduleNextTurn() {
    if (match.round.over) { onRoundOver(); return; }
    var cp = match.round.currentPlayer;
    if (cp === mySeat) {
      thinkingPlayer = null;
      renderAll();
    } else if (netMode === 'host' && cp === CLIENT_SEAT) {
      thinkingPlayer = null;
      showMessage(displayName(CLIENT_SEAT) + " : à son tour de jouer.");
      renderAll();
    } else {
      thinkingPlayer = cp;
      showMessage(displayName(cp) + ' réfléchit...');
      renderAll();
      global.setTimeout(function () { doAiTurn(cp); }, 700);
    }
  }

  function doAiTurn(playerIndex) {
    if (match.round.over || match.round.currentPlayer !== playerIndex) return;
    thinkingPlayer = null;
    var move = AI.chooseMove(match, playerIndex);
    if (move.action === 'pass') {
      G.passTurn(match, playerIndex);
      showMessage(displayName(playerIndex) + ' passe.');
    } else {
      var keys = move.combo.cards.map(G.cardKey);
      G.playCards(match, playerIndex, keys);
      showMessage(displayName(playerIndex) + ' joue ' + describeCombo(move.combo) + '.');
    }
    renderAll();
    scheduleNextTurn();
  }

  // ---- Hote : reception des intentions envoyees par l'ami connecte ----
  function handleHostMessage(msg) {
    if (!msg || msg.type !== 'intent' || !match || match.round.over) return;
    var info = match.round.exchangeInfo;

    if (msg.action === 'exchangeReturn') {
      if (!info || info.skipped || !info.pending || info.firstP !== CLIENT_SEAT) return;
      var resX = G.resolveExchangeReturn(match, msg.cardKey);
      if (!resX.ok) { Net.send({ type: 'error', reason: resX.reason }); return; }
      exchangeMode = null;
      proceedToPlay();
      return;
    }

    if (match.round.currentPlayer !== CLIENT_SEAT) {
      Net.send({ type: 'error', reason: 'not-your-turn' });
      return;
    }

    var res;
    if (msg.action === 'play') {
      res = G.playCards(match, CLIENT_SEAT, msg.cardKeys || []);
      if (res.ok) showMessage(displayName(CLIENT_SEAT) + ' joue ' + describeCombo(res.combo) + '.');
    } else if (msg.action === 'pass') {
      res = G.passTurn(match, CLIENT_SEAT);
      if (res.ok) showMessage(displayName(CLIENT_SEAT) + ' passe.');
    } else {
      return;
    }

    if (!res.ok) { Net.send({ type: 'error', reason: res.reason }); return; }
    renderAll();
    scheduleNextTurn();
  }

  // ---- Client : reception de l'etat envoye par l'hote ----
  function handleClientMessage(msg) {
    if (!msg) return;
    if (msg.type === 'state') {
      match = msg.match;
      selectedKeys = {};
      exchangeMode = (match.round.exchangeInfo && match.round.exchangeInfo.pending && match.round.exchangeInfo.firstP === mySeat)
        ? { info: match.round.exchangeInfo }
        : null;
      renderAll();
      if (msg.message) showMessage(msg.message);
      if (match.round.over) onRoundOver();
    } else if (msg.type === 'error') {
      showMessage(errorText(msg.reason));
    }
  }

  function broadcastState() {
    if (netMode !== 'host' || !Net.isConnected()) return;
    Net.send({ type: 'state', match: match, message: el.message.textContent });
  }

  function onPlayClicked() {
    var keys = Object.keys(selectedKeys);
    if (keys.length === 0) { showMessage('Sélectionnez au moins une carte.'); return; }
    if (netMode === 'client') {
      Net.send({ type: 'intent', action: 'play', cardKeys: keys });
      selectedKeys = {};
      renderHand();
      renderControls();
      return;
    }
    var res = G.playCards(match, mySeat, keys);
    if (!res.ok) { showMessage(errorText(res.reason)); return; }
    selectedKeys = {};
    renderAll();
    scheduleNextTurn();
  }

  function onPassClicked() {
    if (netMode === 'client') {
      Net.send({ type: 'intent', action: 'pass' });
      return;
    }
    var res = G.passTurn(match, mySeat);
    if (!res.ok) { showMessage(errorText(res.reason)); return; }
    selectedKeys = {};
    renderAll();
    scheduleNextTurn();
  }

  function onRoundOver() {
    var round = match.round;
    el.modalTitle.textContent = match.matchOver ? 'Partie terminée' : 'Manche terminée';
    el.modalList.innerHTML = '';
    var points = [3, 2, 1, 0];
    round.finishedOrder.forEach(function (p, i) {
      var li = document.createElement('li');
      li.textContent = displayName(p) + ' : ' + (i + 1) + (i === 0 ? 'er' : 'e') + ' place (+' + points[i] + ' pts, total ' + match.scores[p] + ')';
      el.modalList.appendChild(li);
    });
    if (match.matchOver) {
      var win = document.createElement('li');
      win.className = 'winner-line';
      win.textContent = '🏆 ' + displayName(match.winner) + ' remporte la partie !';
      el.modalList.appendChild(win);
    }

    if (netMode === 'client') {
      el.btnNextRound.hidden = true;
      el.btnNewMatch.hidden = true;
      var wait = document.createElement('li');
      wait.className = 'trick-hint';
      wait.textContent = "En attente de l'hôte pour continuer...";
      el.modalList.appendChild(wait);
    } else if (match.matchOver) {
      el.btnNextRound.hidden = true;
      el.btnNewMatch.hidden = false;
    } else {
      el.btnNextRound.hidden = false;
      el.btnNewMatch.hidden = true;
    }
    el.modal.hidden = false;
  }

  function describeCombo(combo) {
    var label = TYPE_LABELS[combo.type];
    var topRank = G.RANK_ORDER[combo.rankValue + (combo.type === 'STRAIGHT' ? combo.length - 1 : 0)];
    if (combo.type === 'STRAIGHT') {
      var startRank = G.RANK_ORDER[combo.rankValue];
      return label + ' du ' + RANK_LABELS[startRank] + ' au ' + RANK_LABELS[topRank];
    }
    return label + ' de ' + RANK_LABELS[topRank];
  }

  function errorText(reason) {
    var map = {
      'not-your-turn': "Ce n'est pas votre tour.",
      'cards-not-in-hand': 'Sélection invalide.',
      'invalid-combo': "Cette combinaison n'est pas valide.",
      'must-include-3-spades': 'Vous devez inclure le 3 de pique dans votre premier coup.',
      'does-not-beat': "Cette combinaison ne bat pas celle en jeu.",
      'cannot-pass-when-leading': "Vous ouvrez le pli, vous devez jouer une combinaison.",
      'card-must-be-3-to-10': 'La carte rendue doit être comprise entre 3 et 10.',
      'card-not-in-hand': 'Carte introuvable dans votre main.'
    };
    return map[reason] || 'Coup impossible.';
  }

  function showMessage(text) {
    el.message.textContent = text;
  }

  function toggleSelect(key) {
    if (selectedKeys[key]) delete selectedKeys[key];
    else selectedKeys[key] = true;
    renderHand();
    renderControls();
  }

  function renderAll() {
    if (!match.round.over) el.modal.hidden = true;
    renderScoreboard();
    renderSeats();
    renderTrick();
    renderControls();
    renderSeatIndicators();
    if (netMode === 'host') broadcastState();
  }

  function renderScoreboard() {
    el.scoreboard.innerHTML = '';
    match.playerNames.forEach(function (name, i) {
      var chip = document.createElement('div');
      chip.className = 'score-chip' + (match.round && match.round.currentPlayer === i && !match.round.over ? ' score-chip--active' : '');
      chip.textContent = displayName(i) + ' : ' + match.scores[i];
      el.scoreboard.appendChild(chip);
    });
  }

  var MAX_VISUAL_BACKS = 6;

  function renderSeats() {
    for (var v = 1; v < 4; v++) {
      var p = seatAt(v);
      var container = document.getElementById(SEAT_IDS[v]);
      container.innerHTML = '';
      var hand = match.round.hands[p];
      var count = hand.length;
      // Rendu decoratif plafonne : le nombre exact est deja dans le badge de
      // nom, pas besoin d'empiler jusqu'a 14 dos de carte (ca poussait la
      // main du joueur hors ecran).
      var visualCount = Math.min(count, MAX_VISUAL_BACKS);
      for (var i = 0; i < visualCount; i++) {
        container.appendChild(Cards.createCardBackElement());
      }
      var nameEl = document.getElementById(NAME_IDS[v]);
      if (nameEl) nameEl.textContent = displayName(p) + ' (' + count + ')';
    }
    renderHand();
  }

  function renderHand() {
    var container = document.getElementById(SEAT_IDS[0]);
    container.innerHTML = '';
    var hand = match.round.hands[mySeat];
    hand.forEach(function (card) {
      var key = G.cardKey(card);
      var elCard = Cards.createCardElement(card, { selected: !!selectedKeys[key], selectable: true });
      elCard.addEventListener('click', function () { toggleSelect(key); });
      container.appendChild(elCard);
    });
    var nameEl = document.getElementById(NAME_IDS[0]);
    if (nameEl) nameEl.textContent = displayName(mySeat) + ' (' + hand.length + ')';
  }

  function renderTrick() {
    el.trickArea.innerHTML = '';
    var plays = match.round.trick.plays;
    if (plays.length === 0) {
      var hint = document.createElement('div');
      hint.className = 'trick-hint';
      hint.textContent = match.round.currentPlayer === mySeat ? 'À vous d\'ouvrir : jouez ce que vous voulez.' : displayName(match.round.currentPlayer) + ' ouvre le pli...';
      el.trickArea.appendChild(hint);
      return;
    }
    var last = plays[plays.length - 1];
    var group = document.createElement('div');
    group.className = 'trick-group';
    var label = document.createElement('div');
    label.className = 'trick-group__label';
    label.textContent = displayName(last.player) + ' : ' + describeCombo(last.combo);
    group.appendChild(label);
    var cardsRow = document.createElement('div');
    cardsRow.className = 'trick-group__cards';
    last.cards.forEach(function (card) {
      var cardEl = Cards.createCardElement(card, {});
      cardEl.classList.add('card--enter');
      cardsRow.appendChild(cardEl);
    });
    group.appendChild(cardsRow);
    el.trickArea.appendChild(group);
  }

  function renderControls() {
    if (exchangeMode) {
      el.btnPlay.hidden = true;
      el.btnPass.hidden = true;
      el.btnGiveCard.hidden = false;
      return;
    }
    el.btnGiveCard.hidden = true;
    el.btnPlay.hidden = false;
    el.btnPass.hidden = false;

    var isMyTurn = !match.round.over && match.round.currentPlayer === mySeat;
    el.btnPlay.disabled = !isMyTurn || Object.keys(selectedKeys).length === 0;
    el.btnPass.disabled = !isMyTurn || !match.round.trick.requirement;
  }

  function renderSeatIndicators() {
    for (var v = 0; v < 4; v++) {
      var p = seatAt(v);
      var seatEl = document.getElementById('seat-' + v);
      if (!seatEl) continue;
      var isActive = !match.round.over && match.round.currentPlayer === p && !exchangeMode;
      seatEl.classList.toggle('seat--active', isActive);
      seatEl.classList.toggle('seat--thinking', thinkingPlayer === p);
    }
  }

  global.addEventListener('DOMContentLoaded', init);
})(window);
