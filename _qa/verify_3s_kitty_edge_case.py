import sys
import os
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from playwright.sync_api import sync_playwright

# Test de non-regression pour un bug reel trouve le 08/09/2026 pendant la
# QA de la V2 : si le 3 de pique tombe dans le talon mort (les 2 cartes non
# distribuees sur 54), personne ne le detient. Avant le correctif,
# dealNewRound() mettait alors match.round.currentPlayer = -1 (leader
# introuvable) ET playCards() continuait a exiger un 3 de pique que
# personne n'a jamais pu jouer : la partie devenait injouable des le debut
# (plantage JS "Cannot read properties of undefined (reading 'forEach')"
# des que l'IA essayait de jouer). Environ 3.7% de chance par donne
# (2 cartes sur 54), assez rare pour ne pas etre vu lors des premiers tests
# V1 mais reel. Corrige dans game.js (round.requireThreeSpadesOpen).
#
# Comme dealNewRound() genere une vraie donne aleatoire a chaque appel
# (fonction shuffle() interne au module, pas patchable de l'exterieur), ce
# test boucle des donnes reelles jusqu'a tomber sur le cas rare plutot que
# de le simuler artificiellement, pour verifier le vrai chemin de code.

HERE = os.path.dirname(os.path.abspath(__file__))
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FILE_URL = "file:///" + os.path.abspath(os.path.join(HERE, "..", "web", "index.html")).replace("\\", "/")


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EDGE_PATH, headless=True)
        page = b.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(FILE_URL)
        page.wait_for_timeout(300)

        result = page.evaluate("""
            () => {
                const G = window.Murlan.Game;
                for (var attempt = 0; attempt < 5000; attempt++) {
                    var match = G.createMatch(['A', 'B', 'C', 'D']);
                    G.dealNewRound(match);
                    var kittyHas3S = match.round.kitty.some(c => c.rank === '3' && c.suit === 'S');
                    if (!kittyHas3S) continue;

                    var cp = match.round.currentPlayer;
                    var leaderValid = cp !== null && cp >= 0 && cp <= 3;
                    var requireFlag = match.round.requireThreeSpadesOpen;
                    var leaderHand = leaderValid ? match.round.hands[cp] : null;
                    var playResult = null;
                    if (leaderHand && leaderHand.length) {
                        playResult = G.playCards(match, cp, [G.cardKey(leaderHand[0])]);
                    }
                    return {
                        found: true,
                        attempts: attempt + 1,
                        currentPlayer: cp,
                        leaderValid: leaderValid,
                        requireThreeSpadesOpen: requireFlag,
                        playOk: playResult ? playResult.ok : null,
                        playReason: playResult ? playResult.reason : null
                    };
                }
                return { found: false, attempts: 5000 };
            }
        """)

        print("RESULT:", result)
        print("PAGE ERRORS:", errors)

        violations = []
        if not result.get("found"):
            violations.append("le cas 3S-dans-le-talon ne s'est jamais produit en 5000 donnes (improbable, ~3.7%/donne attendu)")
        else:
            if not result["leaderValid"]:
                violations.append(f"currentPlayer invalide : {result['currentPlayer']}")
            if result["requireThreeSpadesOpen"] is not False:
                violations.append("requireThreeSpadesOpen aurait du etre False (personne n'a le 3 de pique)")
            if result["playOk"] is not True:
                violations.append(f"le premier coup a ete rejete a tort : {result['playReason']}")
        if errors:
            violations.append(f"erreurs page : {errors}")

        print(f"VIOLATIONS ({len(violations)}):")
        for v in violations:
            print(" -", v)
        ok = not violations
        print("RESULT:", "PASS" if ok else "FAIL")
        b.close()
        return ok


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
