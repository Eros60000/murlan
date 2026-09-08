import sys
import os
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from playwright.sync_api import sync_playwright

# Test de non-regression pour le theme Balkan + les indicateurs de tour
# (ajoutes le 08/09/2026). Verifie, sur des parties jouees automatiquement :
#   - jamais 2 sieges "actifs" en meme temps, jamais 0 pendant une manche
#     en cours (bug reel trouve une fois : z-index sans contexte
#     d'empilement sur .table masquait le filigrane derriere le fond).
#   - le siege humain (seat-0) n'est jamais marque "reflechit".
#   - zero erreur console/page sur une manche complete rejouee.
# A relancer si style.css ou ui.js (logique seat--active/seat--thinking)
# changent. Necessite `pip install playwright` (pas besoin de
# `playwright install`, on pilote l'Edge deja present sur la machine).

HERE = os.path.dirname(os.path.abspath(__file__))
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FILE_URL = "file:///" + os.path.abspath(os.path.join(HERE, "..", "web", "index.html")).replace("\\", "/")

errors = []
violations = []


def safe_click(page, selector, corner=False):
    try:
        if corner:
            page.click(selector, timeout=1500, position={"x": 8, "y": 10})
        else:
            page.click(selector, timeout=1500)
        return True
    except Exception:
        return False


def run(rounds_to_play=2, max_iters=900):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EDGE_PATH, headless=True)
        page = b.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        page.goto(FILE_URL)
        page.wait_for_timeout(300)
        safe_click(page, "#btn-mode-solo")  # ecran de choix de mode ajoute en V2, avant : jeu direct

        rounds_completed = 0
        samples = 0
        for i in range(max_iters):
            page.wait_for_timeout(120)
            modal_hidden = page.eval_on_selector("#round-over-modal", "el => el.hidden")

            active = page.eval_on_selector_all(".seat--active", "els => els.map(e => e.id)")
            samples += 1
            if not modal_hidden:
                if len(active) != 0:
                    violations.append(f"iter {i}: round over but seat--active={active} (expected none)")
            else:
                if len(active) > 1:
                    violations.append(f"iter {i}: MULTIPLE active seats simultaneously: {active}")
                elif len(active) == 0:
                    violations.append(f"iter {i}: round in play but NO active seat highlighted")

            thinking = page.eval_on_selector_all(".seat--thinking", "els => els.map(e => e.id)")
            if "seat-0" in thinking:
                violations.append(f"iter {i}: seat-0 (human) incorrectly marked as thinking")
            if len(thinking) > 1:
                violations.append(f"iter {i}: MULTIPLE thinking seats simultaneously: {thinking}")

            if not modal_hidden:
                rounds_completed += 1
                if rounds_completed >= rounds_to_play:
                    break
                safe_click(page, "#btn-next-round")
                page.wait_for_timeout(300)
                continue

            give_hidden = page.eval_on_selector("#btn-give-card", "el => el.hidden")
            if not give_hidden:
                safe_click(page, "#hand-0 .card:first-child", corner=True)
                safe_click(page, "#btn-give-card")
                continue

            # Cible le 3 de pique si present (obligatoire pour ouvrir le tout
            # premier pli de la partie, sinon aucune carte ne pourra jamais
            # etre jouee et le test boucle indefiniment), sinon la plus haute.
            target = page.eval_on_selector(
                '#hand-0',
                """el => {
                    var s3 = el.querySelector('.card[data-key="3S"]');
                    if (s3) return '3S';
                    var cards = el.querySelectorAll('.card');
                    return cards.length ? cards[cards.length - 1].dataset.key : null;
                }"""
            )
            if target:
                already = page.eval_on_selector(f'#hand-0 .card[data-key="{target}"]', "el => el.classList.contains('card--selected')")
                if not already:
                    safe_click(page, f'#hand-0 .card[data-key="{target}"]', corner=True)
            play_disabled = page.eval_on_selector("#btn-play", "el => el.disabled")
            if not play_disabled:
                safe_click(page, "#btn-play")
                page.wait_for_timeout(100)
                err = page.inner_text("#message")
                if any(k in err for k in ["invalide", "ne bat pas", "3 de pique", "Sélectionnez"]):
                    pass_disabled = page.eval_on_selector("#btn-pass", "el => el.disabled")
                    if not pass_disabled:
                        safe_click(page, "#btn-pass")

        b.close()

    print(f"samples checked: {samples}, rounds_completed: {rounds_completed}")
    print(f"VIOLATIONS ({len(violations)}):")
    for v in violations:
        print(" -", v)
    print("CONSOLE/PAGE ERRORS:", errors)

    ok = not violations and not errors and rounds_completed >= rounds_to_play
    print("RESULT:", "PASS" if ok else "FAIL")
    return ok


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
