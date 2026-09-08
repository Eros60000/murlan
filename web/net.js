/*
 * Connexion pair-a-pair (WebRTC via PeerJS) pour la V2 : inviter un ami
 * avec un code. Aucun compte, aucun serveur a moi : PeerJS est charge a la
 * demande depuis un CDN, uniquement quand un mode multijoueur est choisi
 * (le mode solo reste 100% hors-ligne, sans ce fichier qui pese quoi que
 * ce soit sur le chargement initial de la page).
 */
(function (global) {
  'use strict';

  var PEERJS_CDN = 'https://unpkg.com/peerjs/dist/peerjs.min.js';
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L, ambigus a l'oral/a l'ecrit
  var CODE_LEN = 5;
  var ID_PREFIX = 'murlan-';

  var peer = null;
  var conn = null;
  var messageHandler = null;
  var loadStarted = false;
  var loadCallbacks = [];

  function loadPeerJs(cb) {
    if (global.Peer) { cb(null); return; }
    loadCallbacks.push(cb);
    if (loadStarted) return;
    loadStarted = true;
    var s = document.createElement('script');
    s.src = PEERJS_CDN;
    s.onload = function () {
      var ok = !!global.Peer;
      loadCallbacks.forEach(function (fn) { fn(ok ? null : new Error('peerjs-not-defined')); });
      loadCallbacks = [];
    };
    s.onerror = function () {
      loadCallbacks.forEach(function (fn) { fn(new Error('peerjs-load-failed')); });
      loadCallbacks = [];
    };
    document.head.appendChild(s);
  }

  function randomCode() {
    var out = '';
    for (var i = 0; i < CODE_LEN; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return out;
  }

  function wireData(c, callbacks) {
    c.on('data', function (msg) {
      if (messageHandler) messageHandler(msg);
    });
    c.on('close', function () {
      callbacks.onDisconnected && callbacks.onDisconnected();
    });
  }

  function host(callbacks) {
    loadPeerJs(function (err) {
      if (err) { callbacks.onError && callbacks.onError('load-failed'); return; }
      tryHost(callbacks, 0);
    });
  }

  function tryHost(callbacks, attempt) {
    var code = randomCode();
    var p;
    try {
      p = new global.Peer(ID_PREFIX + code, { debug: 0 });
    } catch (e) {
      callbacks.onError && callbacks.onError('peer-init-failed');
      return;
    }
    var opened = false;
    p.on('open', function () {
      opened = true;
      peer = p;
      callbacks.onCode && callbacks.onCode(code);
    });
    p.on('connection', function (c) {
      conn = c;
      c.on('open', function () {
        wireData(c, callbacks);
        callbacks.onConnected && callbacks.onConnected();
      });
    });
    p.on('error', function (e) {
      var type = (e && e.type) || 'peer-error';
      if (!opened && type === 'unavailable-id' && attempt < 5) {
        p.destroy();
        tryHost(callbacks, attempt + 1);
        return;
      }
      callbacks.onError && callbacks.onError(type);
    });
  }

  function join(code, callbacks) {
    loadPeerJs(function (err) {
      if (err) { callbacks.onError && callbacks.onError('load-failed'); return; }
      var p;
      try {
        p = new global.Peer({ debug: 0 });
      } catch (e) {
        callbacks.onError && callbacks.onError('peer-init-failed');
        return;
      }
      var settled = false;
      var timeoutId = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        callbacks.onError && callbacks.onError('timeout');
      }, 15000);

      p.on('open', function () {
        peer = p;
        var c;
        try {
          c = p.connect(ID_PREFIX + String(code).toUpperCase().trim(), { reliable: true });
        } catch (e) {
          if (settled) return;
          settled = true;
          global.clearTimeout(timeoutId);
          callbacks.onError && callbacks.onError('connect-failed');
          return;
        }
        conn = c;
        c.on('open', function () {
          if (settled) return;
          settled = true;
          global.clearTimeout(timeoutId);
          wireData(c, callbacks);
          callbacks.onConnected && callbacks.onConnected();
        });
        c.on('error', function () {
          if (settled) return;
          settled = true;
          global.clearTimeout(timeoutId);
          callbacks.onError && callbacks.onError('connect-failed');
        });
      });
      p.on('error', function (e) {
        if (settled) return;
        settled = true;
        global.clearTimeout(timeoutId);
        callbacks.onError && callbacks.onError((e && e.type) || 'peer-error');
      });
    });
  }

  function send(msg) {
    if (conn && conn.open) conn.send(msg);
  }

  function onMessage(handler) {
    messageHandler = handler;
  }

  function isConnected() {
    return !!(conn && conn.open);
  }

  function disconnect() {
    if (conn) { try { conn.close(); } catch (e) {} }
    if (peer) { try { peer.destroy(); } catch (e) {} }
    conn = null;
    peer = null;
    messageHandler = null;
  }

  global.Murlan = global.Murlan || {};
  global.Murlan.Net = {
    host: host,
    join: join,
    send: send,
    onMessage: onMessage,
    isConnected: isConnected,
    disconnect: disconnect
  };
})(window);
