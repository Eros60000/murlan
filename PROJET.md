# Murlan

Recréer, en mieux, le jeu de cartes albanais **Murlan** (jeu d'escalade façon
Président, joué par 4 joueurs qui cherchent à vider leur main les premiers).
Eros connaît et joue déjà à une app existante, **Murlan Pro** (iPhone), et veut
sa propre version, plus aboutie.

## Feuille de route fixée par Eros

1. **V1** : jouable seul contre 3 IA, dans le navigateur, gratuit.
2. **V2** : inviter un ami via un code, pour jouer à deux vraies personnes en ligne.
3. **V3** : version complète façon Murlan Pro (contacts, liste d'amis...), mais
   nettement plus soignée visuellement.

## État d'avancement

- **26/08/2026** : dossier créé, recherche des règles terminée et consignée dans
  [REGLES-MURLAN.md](./REGLES-MURLAN.md) (6 sources croisées).
- **08/09/2026** : feuille de route V1/V2/V3 fixée avec Eros (gratuit, web
  d'abord). V1 construite sous `web/` : site statique HTML/CSS/JS sans
  dépendance ni build, moteur de jeu (`game.js`) séparé de l'affichage
  (`ui.js`) pour pouvoir être réutilisé en V2. IA simple à 3 bots (`ai.js`).
  Vérifiée réellement au clavier/souris via un navigateur piloté
  (Playwright) : partie complète jouée sur 2 manches, distribution,
  combinaisons, carré qui bat tout, passes, fin de manche, classement,
  points cumulés et règle d'échange de cartes entre manches tous confirmés
  fonctionnels, aucune erreur console. Deux bugs réels trouvés et corrigés
  pendant cette vérification (pas juste supposée) : la fenêtre de fin de
  manche restait cliquable par-dessus la table même quand "cachée" (CSS), et
  la pile de cartes des adversaires poussait parfois la main du joueur hors
  de l'écran sur une fenêtre courte (corrigé en plafonnant l'affichage
  décoratif à 6 dos de carte, le nombre réel reste affiché à côté du nom).
  **Note honnête** : le chemin où c'est le joueur humain qui doit choisir la
  carte à rendre lors de l'échange (quand il termine 1er) n'a pas été
  déclenché par le hasard des parties de test, seulement relu dans le code ;
  à surveiller à l'usage. L'IA reste volontairement simple (V1), Eros a déjà
  identifié "IA plus maligne" comme piste d'amélioration possible plus tard.
  Note/10 pour cette V1 : 8/10 (fonctionnel de bout en bout, testé
  réellement, un seul chemin non exercé en pratique).

- **08/09/2026** : polish demandé par Eros après son premier essai réel
  ("pas trop mal, rajoute des indicateurs quand la personne joue, et rends-le
  plus esthétique"). Direction esthétique choisie par Eros parmi 4
  propositions : "Balkan (identité albanaise)", fond rouge profond dégradé
  vers le noir, cadre noir mat à listel doré fin, cartes blanc cassé, accents
  or, aigle bicéphale discret en filigrane sur le tapis (SVG inline, aucune
  image externe). Indicateurs de tour ajoutés : halo doré pulsant sur le
  joueur actif (`seat-0` à `seat-3`), message "X réfléchit..." avec point
  animé pendant le délai de l'IA avant de jouer, animation d'entrée pour les
  cartes posées dans le pli. Un bug réel trouvé et corrigé pendant la
  vérification : le filigrane restait invisible car `.table` ne créait pas
  son propre contexte d'empilement CSS, le `z-index: -1` du filigrane le
  faisait passer derrière le fond de la table elle-même au lieu de juste
  derrière les cartes (fixé avec `z-index: 0` sur `.table`). Revérifié par
  navigateur piloté (Playwright/Edge) : manche complète rejouée, halo actif
  confirmé sur le bon joueur à chaque tour, aucune erreur console, modale de
  fin de manche toujours fonctionnelle par-dessus le nouveau thème.

- **08/09/2026 (V2 livrée)** : inviter un ami via un code. Base technique
  choisie avec Eros : pair-à-pair (WebRTC via PeerJS, chargé à la demande
  depuis un CDN uniquement quand un mode multijoueur est choisi), aucun
  compte à créer, aucun serveur ni coût de mon côté. Modèle "hôte
  autoritaire" : le navigateur de celui qui crée la partie fait tourner
  `game.js` comme en V1 (les coups de l'ami remplacent un des 3 bots,
  toujours siège 2), l'ami ne calcule aucune règle, il envoie ses
  intentions de coup et reçoit l'état à jour. Nouveau fichier `net.js`
  (enveloppe PeerJS), gros refactor de `ui.js` pour que l'affichage des 4
  sièges se réoriente selon qui regarde l'écran (chacun se voit "Vous" en
  bas). `game.js`/`ai.js` non modifiés pour la logique de règles.
  **Deux bugs réels trouvés et corrigés pendant la vérification** (pas
  supposés) : (1) un mot "Vous" codé en dur dans les données du siège 0
  fuitait tel quel vers l'écran de l'ami (deux chips "Vous" affichés),
  corrigé en ne générant "Vous" qu'à l'affichage, jamais dans les données ;
  (2) bug latent depuis la V1, pas lié à la V2 : si le 3 de pique tombe
  dans les 2 cartes du talon mort (environ 3,7% de chance à chaque donne),
  personne ne le détient, le meneur de la partie devenait introuvable et la
  partie plantait dès le premier coup de l'IA. Corrigé dans `game.js`
  (l'obligation du 3 de pique est levée quand personne ne l'a). Un 3e bug
  visuel trouvé en repassant les captures : le panneau du code restait
  affiché en même temps que les 3 boutons de mode (même piège CSS que le
  bug de la modale en V1, une classe `display:flex` gagnait sur l'attribut
  `hidden`), corrigé une fois pour toutes avec une règle CSS globale au
  lieu d'un correctif au cas par cas. Vérifié avec deux vrais navigateurs
  pilotés en parallèle (hôte + ami), connexion réelle établie via le
  serveur de signalisation public de PeerJS, manche complète jouée en
  synchronisation des deux côtés, code invalide testé (message d'erreur
  propre, pas de plantage), zéro erreur console des deux côtés. Trois
  scripts de non-régression sauvegardés dans `Murlan/_qa/`.
  **Réserve honnête** : si un onglet se ferme en cours de partie, cette
  partie est perdue (pas de sauvegarde), accepté avec Eros dès le choix de
  la base technique. Hypothèse posée (pas encore confirmée avec Eros) :
  un seul ami rejoint la partie à la fois, les 2 autres sièges restent des
  IA.

## Prochaine étape

Faire jouer Eros et un ami en conditions réelles pour validation finale
(notamment le cas "je termine 1er, je dois choisir la carte à rendre",
toujours pas exercé en pratique par un humain). Confirmer avec Eros
l'hypothèse "un seul ami à la fois". Puis passer à la V3 (contacts, liste
d'amis, version "beaucoup plus belle" façon Murlan Pro).
