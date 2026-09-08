# Règles du Murlan : synthèse de recherche

Jeu de cartes albanais, du type "jeu d'escalade" (comme le Président ou le Tiến Lên
vietnamien) : le but est de se débarrasser de toutes ses cartes le premier.

Sources croisées (6 sites indépendants concordants) : [pagat.com](https://www.pagat.com/national/albania.html),
[catsatcards.com](https://www.catsatcards.com/Games/Murlan.htm), [murlanarena.com](https://www.murlanarena.com/),
[visixplay.com](https://www.visixplay.com/murlan/rules.php), [Murlan Pro (App Store)](https://apps.apple.com/us/app/murlan-pro/id1518649663),
[oreateai.com](https://www.oreateai.com/blog/murlan-unpacking-the-rules-of-this-engaging-card-game/673cbb820cea9ee899bf312180a61be2).

## 1. Joueurs et matériel

- **4 joueurs**, sens horaire (variantes 2 joueurs existent sur certaines apps).
- **54 cartes** : jeu de 52 cartes classique + Joker noir + Joker rouge.
- Distribution : le donneur mélange et distribue une carte à la fois, face cachée,
  jusqu'à épuisement du paquet (13 ou 14 cartes/joueur selon le nombre de joueurs).

## 2. Hiérarchie des cartes (du plus faible au plus fort)

```
3 - 4 - 5 - 6 - 7 - 8 - 9 - 10 - Valet - Dame - Roi - As - 2 - Joker noir - Joker rouge/coloré
```

Le **3** est la carte la plus faible, le **2** est plus fort que l'As, et les **Jokers**
sont les cartes les plus fortes du jeu (Joker coloré > Joker noir/blanc selon les sources).

## 3. Combinaisons valides

| Combinaison | Composition | Règle pour battre |
|---|---|---|
| Simple | 1 carte | carte de rang supérieur |
| Paire | 2 cartes de même rang | paire de rang supérieur |
| Brelan | 3 cartes de même rang | brelan de rang supérieur |
| Carré / Bombe | 4 cartes de même rang | **bat n'importe quelle combinaison sur la table**, quel que soit son type ou son nombre de cartes ; ne peut être battu que par un carré de rang supérieur |
| Suite (scale) | 5 cartes consécutives ou plus, couleurs mélangées | suite de même longueur, rang de départ supérieur |
| Flush (variante) | 5 cartes consécutives ou plus, même couleur | plus forte qu'une suite simple (règle présente sur certaines apps, pas partout) |

- L'**As et le 2** ne peuvent servir de carte basse que dans une suite basse
  (ex. 1-2-3-4-5), pas ailleurs.
- Les **Jokers ne se combinent jamais entre eux ni avec d'autres cartes** : ils ne
  se jouent qu'en carte simple.
- Il n'y a **pas de "révolution"** : jouer un carré ne change jamais le sens de la
  hiérarchie (contrairement à d'autres jeux d'escalade comme le Tiến Lên).

## 4. Déroulement d'un tour

1. Le joueur qui a le **3 de pique** ouvre la toute première manche et **doit
   l'inclure** dans sa combinaison (simple, paire, brelan, carré ou suite).
2. Chaque joueur suivant doit soit :
   - jouer une combinaison du **même type et même nombre de cartes**, de rang
     strictement supérieur (sauf carré, qui peut tomber sur n'importe quoi) ;
   - soit **passer**.
3. Quand tous les autres joueurs ont passé après une carte jouée, le joueur qui a
   posé la dernière combinaison **ramasse le pli** et repart avec la combinaison
   de son choix pour ouvrir le tour suivant.

## 5. Fin de manche et score

- Un joueur qui vide sa main **sort de la manche** ; le jeu continue entre les
  joueurs restants jusqu'à ce qu'il n'en reste plus qu'un (ou qu'un seul).
- Points de la manche : **1er = 3 pts, 2e = 2 pts, 3e = 1 pt, 4e = 0 pt**.
- Victoire de partie : premier joueur à **21 points**. En cas d'égalité au
  premier passage à 21, le seuil grimpe à 31, puis 41, puis 51 (au-delà, partie
  déclarée nulle).
- Variante "mode équipe" (certaines apps) : 2 équipes de 2, victoire à 21 points
  cumulés par équipe ; le solo peut alors s'arrêter à 11 points.

## 6. Règle sociale d'échange de cartes (entre manches)

Avant la manche suivante, le **dernier classé** donne sa **carte la plus haute**
au **premier classé**, qui lui rend en échange une carte de son choix entre 3 et
10. Exception : si le dernier classé a les deux Jokers en main en fin de manche,
il les montre et ne donne rien (règle d'humiliation inversée, façon "Président").

## 7. Points flous : décisions prises pour notre version (V1)

Les sources divergeaient légèrement. Plutôt que deviner, voici les choix
retenus pour notre implémentation, tranchés le 08/09/2026 :

- **Distribution** : 13 cartes par joueur (4 x 13 = 52), les **2 cartes
  restantes forment un talon mort**, non distribué, non utilisé.
- **Carré (bombe)** : bat **absolument toute combinaison** sur la table, quels
  que soient son type et sa taille (une suite de 8 cartes incluse). Ne peut
  être battu que par un carré de rang supérieur.
- **Flush** (variante suite de même couleur) : **non inclus en V1**, on garde
  la version traditionnelle (suite simple, couleurs mélangées, minimum 5
  cartes). Pourra être ajouté plus tard si Eros le souhaite après avoir joué.
- **2 joueurs** : hors sujet, notre V1 est fixée à 4 joueurs (1 humain + 3 IA).
- **Obligation du 3♠** : ne s'applique qu'à la toute première manche de la
  partie (convention classique des jeux d'escalade type Président/Tiến Lên).
  À partir de la 2e manche, c'est le vainqueur de la manche précédente qui
  ouvre librement.
- **Escalade 21 → 31 → 41 → 51** : simplifiée. Si plusieurs joueurs sont
  à égalité en tête avec 21 points ou plus, la partie continue simplement
  jusqu'à ce que l'égalité soit rompue (pas de palier fixe codé en dur).
