import sys
import os
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from playwright.sync_api import sync_playwright

# Test de non-regression pour la V2 (inviter un ami via un code, WebRTC/
# PeerJS). Ouvre DEUX pages independantes (hote + ami), verifie :
#   - un code se genere et la connexion pair-a-pair s'etablit reellement
#   - la rotation d'affichage des sieges (chacun se voit "Vous" en bas)
#   - une manche complete se joue en synchronisation sur les deux pages
#   - fin de manche affichee correctement des deux cotes, cote client avec
#     les boutons de suite masques (c'est a l'hote de faire avancer la partie)
# Necessite une connexion internet reelle (PeerJS charge depuis un CDN et
# passe par son serveur de signalisation public). A relancer si ui.js/
# net.js changent.

HERE = os.path.dirname(os.path.abspath(__file__))
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FILE_URL = "file:///" + os.path.abspath(os.path.join(HERE, "..", "web", "index.html")).replace("\\", "/")

host_errors = []
client_errors = []
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


def try_act(page):
    give_hidden = page.eval_on_selector("#btn-give-card", "el => el.hidden")
    if not give_hidden:
        safe_click(page, "#hand-0 .card:first-child", corner=True)
        safe_click(page, "#btn-give-card")
        return

    target = page.eval_on_selector(
        '#hand-0',
        """el => {
            var s3 = el.querySelector('.card[data-key="3S"]');
            if (s3) return '3S';
            var cards = el.querySelectorAll('.card');
            if (!cards.length) return null;
            return cards[cards.length - 1].dataset.key;
        }"""
    )
    if not target:
        return
    already_selected = page.eval_on_selector(f'#hand-0 .card[data-key="{target}"]', "el => el.classList.contains('card--selected')")
    if not already_selected:
        safe_click(page, f'#hand-0 .card[data-key="{target}"]', corner=True)

    if page.eval_on_selector("#btn-play", "el => el.disabled"):
        return
    safe_click(page, "#btn-play")
    page.wait_for_timeout(120)
    err = page.inner_text("#message")
    if any(k in err for k in ["invalide", "ne bat pas", "3 de pique", "Sélectionnez", "n'est pas votre tour"]):
        if not page.eval_on_selector("#btn-pass", "el => el.disabled"):
            safe_click(page, "#btn-pass")


def run(max_iters=250):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EDGE_PATH, headless=True)
        host = b.new_page(viewport={"width": 1100, "height": 750})
        client = b.new_page(viewport={"width": 1100, "height": 750})
        host.on("console", lambda m: host_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        host.on("pageerror", lambda e: host_errors.append(f"pageerror: {e}"))
        client.on("console", lambda m: client_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        client.on("pageerror", lambda e: client_errors.append(f"pageerror: {e}"))

        host.goto(FILE_URL)
        client.goto(FILE_URL)
        host.wait_for_timeout(300)
        client.wait_for_timeout(300)

        safe_click(host, "#btn-mode-host")
        code = None
        for i in range(60):
            host.wait_for_timeout(300)
            code = host.eval_on_selector("#room-code", "el => el.textContent")
            if code and code != "-----":
                break
        if not code:
            violations.append("aucun code genere par l'hote (PeerJS n'a peut-etre pas charge)")
            print("VIOLATIONS:", violations)
            b.close()
            return False
        print("code genere:", code)

        safe_click(client, "#btn-mode-join")
        client.fill("#join-code-input", code)
        safe_click(client, "#btn-confirm-join")
        connected = False
        for i in range(60):
            client.wait_for_timeout(300)
            if not host.eval_on_selector("#game-root", "el => el.hidden") and not client.eval_on_selector("#game-root", "el => el.hidden"):
                connected = True
                break
        if not connected:
            violations.append("connexion pair-a-pair jamais etablie des deux cotes")
            print("VIOLATIONS:", violations)
            b.close()
            return False
        print("connexion etablie")

        client_bottom = client.inner_text("#name-0")
        host_view_of_client = host.inner_text("#name-1")
        if "Vous" not in client_bottom:
            violations.append(f"le client ne se voit pas 'Vous' en bas : {client_bottom!r}")
        if "Vous" in host_view_of_client:
            violations.append(f"le mot 'Vous' de l'hote a fuite vers le siege de l'ami : {host_view_of_client!r}")

        round_over_host = False
        round_over_client = False
        for i in range(max_iters):
            host.wait_for_timeout(200)
            try_act(host)
            try_act(client)
            if not round_over_host and not host.eval_on_selector("#round-over-modal", "el => el.hidden"):
                round_over_host = True
            if not round_over_client and not client.eval_on_selector("#round-over-modal", "el => el.hidden"):
                round_over_client = True
            if round_over_host and round_over_client:
                break

        if not (round_over_host and round_over_client):
            violations.append(f"manche jamais terminee des deux cotes (host={round_over_host}, client={round_over_client})")
        else:
            client_next_hidden = client.eval_on_selector("#btn-next-round", "el => el.hidden")
            client_new_hidden = client.eval_on_selector("#btn-new-match", "el => el.hidden")
            if not client_next_hidden or not client_new_hidden:
                violations.append("le client voit un bouton pour faire avancer la partie (devrait etre reserve a l'hote)")

        print("round_over_host:", round_over_host, "round_over_client:", round_over_client)
        print(f"VIOLATIONS ({len(violations)}):")
        for v in violations:
            print(" -", v)
        print("HOST CONSOLE/PAGE ERRORS:", host_errors)
        print("CLIENT CONSOLE/PAGE ERRORS:", client_errors)

        ok = not violations and not host_errors and not client_errors
        print("RESULT:", "PASS" if ok else "FAIL")
        b.close()
        return ok


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
