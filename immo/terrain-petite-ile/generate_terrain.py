"""Reel Instagram / TikTok — Terrain vue mer à Petite-Île (1 896 m², parcelle AK 1207).

~25 s, 1080x1920, coupes calées sur le tempo (128 BPM), plan cadastral animé,
esquisse de maison dessinée sur le terrain, bande-son house synthétisée.

Usage :  python3 generate_video.py
"""
import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "video"))
import generate_tiktok as k  # noqa: E402  (moteur TikTok : textes, zooms, audio)
import generate_video as g  # noqa: E402
from generate_video import DARK, F_SANS, F_SCRIPT, GREEN, H, SOFT, W, WHITE  # noqa: E402

PH = os.path.join(HERE, "photos")
OUT = os.path.join(HERE, "terrain-petite-ile.mp4")
BEAT = k.BEAT
FPS = 30
TY = k.TEXT_Y
ease_out, prog, clamp = g.ease_out, g.prog, g.clamp

SURFACE = "1 896 m²"
PRIX = "276 200 €"
PRIX_M2 = round(276200 / 1896)

P = {}


def load():
    P["terrain"] = Image.open(os.path.join(PH, "terrain.png")).convert("RGB")
    fl = Image.open(os.path.join(PH, "flyer.png")).convert("RGB")
    P["vue"] = fl.crop((360, 585, 941, 1045))
    # photo « accès et voirie » sans les bandeaux du visuel d'origine
    P["acces"] = Image.open(os.path.join(PH, "acces-voirie.jpg")).convert("RGB").crop((0, 200, 1229, 1390))
    # plan cadastral réel, contour vert effacé (il est redessiné en animation)
    import numpy as np
    pl = np.array(Image.open(os.path.join(PH, "plan-cadastral.jpg")).convert("RGB")
                  .crop((44, 473, 1185, 1213))).astype(int)
    green = (pl[..., 1] > pl[..., 0] + 40) & (pl[..., 1] > pl[..., 2] + 40)
    pl[green] = 255
    P["plan"] = Image.fromarray(pl.astype("uint8"))
    P["logo"] = Image.open(os.path.join(PH, "banniere.png")).convert("RGB").crop((575, 10, 1300, 375))


# ---------------------------------------------------------------- outils
def pan(src, t, d, z0, z1, py0, py1, px=0.5):
    """Plein écran avec zoom et panoramique vertical progressifs."""
    p = g.ease_io(t / d)
    z = z0 + (z1 - z0) * p
    sw, sh = src.size
    tgt = W / H
    if sw / sh > tgt:
        ch, cw = sh / z, sh / z * tgt
    else:
        cw, ch = sw / z, sw / z / tgt
    py = py0 + (py1 - py0) * p
    x0, y0 = (sw - cw) * px, (sh - ch) * py
    im = src.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))
    img = im.filter(ImageFilter.UnsharpMask(2, 50, 2)).convert("RGBA")
    img.alpha_composite(k.VIGNETTE)
    return img


def dark_bg(src, t, d, blur=14, alpha=195):
    img = pan(src, t, d, 1.05, 1.15, 0.4, 0.5).filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (alpha,)))
    return img


def partial_path(draw, pts, p, fill, width, closed=True):
    """Trace le chemin `pts` jusqu'à la fraction p de sa longueur."""
    path = pts + [pts[0]] if closed else pts
    segs = list(zip(path[:-1], path[1:]))
    lens = [math.dist(a, b) for a, b in segs]
    target = sum(lens) * clamp(p)
    for (a, b), L in zip(segs, lens):
        if target <= 0:
            break
        f = min(1, target / L)
        draw.line([a, (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)], fill=fill, width=width,
                  joint="curve")
        target -= L


def check_icon(img, cx, cy, r, a):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN + (int(255 * a),))
    d.line([(cx - r * 0.45, cy), (cx - r * 0.1, cy + r * 0.35), (cx + r * 0.5, cy - r * 0.35)],
           fill=WHITE + (int(255 * a),), width=max(3, int(r * 0.22)), joint="curve")
    img.alpha_composite(lay)


# ---------------------------------------------------------------- scènes
def sc_hook(t, d):
    # dézoom depuis la mer vers le terrain
    img = pan(P["terrain"], t, d, 1.9, 1.05, 0.22, 0.3)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "VUE MER", 150, TY - 110, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, BEAT)
    k.tk_text(img, "TERRAIN À VENDRE", 70, TY + 50, DARK, al, sc, box=GREEN)
    sc, al = k.pop_in(t, BEAT * 2)
    k.tk_text(img, "PETITE-ÎLE · LA RÉUNION", 52, TY + 175, WHITE, al, sc, stroke=8)
    k.flash(img, t, strength=0.8)
    return img


def sc_surface(t, d):
    # panoramique de la mer vers le terrain + compteur de surface
    img = pan(P["terrain"], t, d, 1.55, 1.45, 0.05, 0.6)
    n = int(1896 * ease_out(prog(t, 0.1, 1.4)))
    s = f"{n:,}".replace(",", " ") + " m²"
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, s, 170, TY - 40, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, 1.5)
    k.tk_text(img, "DE TERRAIN", 76, TY + 120, DARK, al, sc, box=GREEN)
    k.flash(img, t)
    return img


def sc_constructible(t, d):
    img = pan(P["terrain"], t, d, 1.7, 1.6, 0.6, 0.5, px=0.15)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "DONT 948 m²", 130, TY - 60, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, BEAT)
    k.tk_text(img, "CONSTRUCTIBLES", 84, TY + 90, DARK, al, sc, box=GREEN)
    sc, al = k.pop_in(t, BEAT * 2)
    k.tk_text(img, "10 m au faîtage · zone UC", 52, TY + 215, WHITE, al, sc, stroke=8)
    k.flash(img, t)
    return img


def sc_ocean(t, d):
    img = pan(P["acces"], t, d, 1.3, 1.42, 0.0, 0.04, px=0.4)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "VUE DÉGAGÉE", 110, TY + 380, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, BEAT)
    k.tk_text(img, "SUR L'OCÉAN INDIEN", 66, TY + 520, DARK, al, sc, box=GREEN)
    k.flash(img, t)
    return img


def sc_acces(t, d):
    img = pan(P["acces"], t, d, 1.5, 1.6, 0.55, 0.6, px=1.0)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "ACCÈS DIRECT", 110, TY - 40, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, BEAT)
    k.tk_text(img, "PAR LA VOIRIE", 76, TY + 100, DARK, al, sc, box=GREEN)
    k.flash(img, t)
    return img


def sc_cadastre(t, d):
    img = dark_bg(P["terrain"], t, d)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "PARCELLE AK 1207", 76, 330, WHITE, al, sc, cx=W / 2)
    a = ease_out(prog(t, 0.1, 0.35))
    plan = P["plan"]
    cw = 940
    ch = int(cw * plan.height / plan.width)
    cx0, cy0 = 70, int(480 + (1 - a) * 60)
    card = plan.resize((cw, ch), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, cw - 1, ch - 1), 28, fill=int(255 * a))
    card.putalpha(m)
    img.alpha_composite(card, (cx0, cy0))
    if a < 0.99:
        return img
    sx = cw / plan.width
    pts = [(193, 147), (916, 191), (916, 382), (919, 429), (949, 535), (969, 580), (964, 605),
           (174, 551)]
    poly = [(cx0 + x * sx, cy0 + y * sx) for x, y in pts]
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(lay)
    pf = ease_out(prog(t, 0.45, 0.7))
    if pf >= 1:
        fa = 0.22 + 0.1 * math.sin(2 * math.pi * (t - 1.15) / (BEAT * 2))
        dr.polygon(poly, fill=GREEN + (int(255 * fa),))
    partial_path(dr, poly, pf, (30, 160, 40, 255), 8)
    img.alpha_composite(lay)
    a2 = ease_out(prog(t, 1.15, 0.3))
    pcx = sum(p[0] for p in poly) / len(poly)
    pcy = sum(p[1] for p in poly) / len(poly)
    g.text(img, SURFACE, F_SANS, 54, pcx, pcy + 45, (25, 70, 20), alpha=a2, weight="ExtraBold",
           shadow=False)
    sc, al = k.pop_in(t, 1.4)
    k.tk_text(img, "Petite-Île · zone UC (PLU du 09/06/2023)", 36, cy0 + ch + 80, SOFT, al, sc,
              stroke=0, weight="Medium", cx=W / 2)
    k.flash(img, t, strength=0.5)
    return img


def sc_imagine(t, d):
    img = pan(P["terrain"], t, d, 1.35, 1.45, 0.75, 0.7)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "IMAGINEZ", 130, 380, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, BEAT)
    k.tk_text(img, "VOTRE MAISON ICI", 66, 520, DARK, al, sc, box=GREEN)
    # esquisse de villa dessinée progressivement
    # case créole avec varangue
    lines = [
        [(90, 1360), (990, 1360)],                                   # sol
        [(230, 1360), (230, 1010), (850, 1010), (850, 1360)],        # murs
        [(170, 1010), (330, 800), (750, 800), (910, 1010), (170, 1010)],  # toit
        [(400, 800), (380, 880), (470, 880), (460, 800)],            # chien-assis
        [(170, 1180), (910, 1180)],                                  # auvent de la varangue
        [(260, 1180), (260, 1360)], [(400, 1180), (400, 1360)],      # poteaux
        [(680, 1180), (680, 1360)], [(820, 1180), (820, 1360)],
        [(495, 1360), (495, 1220), (585, 1220), (585, 1360)],        # porte
        [(290, 1050), (390, 1050), (390, 1130), (290, 1130), (290, 1050)],  # fenêtres
        [(690, 1050), (790, 1050), (790, 1130), (690, 1130), (690, 1050)],
        [(140, 1440), (520, 1440), (520, 1500), (140, 1500), (140, 1440)],  # piscine
    ]
    p = clamp((t - BEAT * 1.5) / (d - BEAT * 2.2))
    total = sum(sum(math.dist(a, b) for a, b in zip(L[:-1], L[1:])) for L in lines)
    budget = total * p
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    for L in lines:
        ln = sum(math.dist(a, b) for a, b in zip(L[:-1], L[1:]))
        if budget <= 0:
            break
        frac = min(1, budget / ln)
        partial_path(gd, L, frac, GREEN + (255,), 18, closed=False)
        partial_path(ld, L, frac, WHITE + (255,), 6, closed=False)
        budget -= ln
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))
    img.alpha_composite(lay)
    if p >= 1:
        sc, al = k.pop_in(t, BEAT * 1.5 + (d - BEAT * 2.2))
        k.tk_text(img, "Le terrain est prêt. Et vous ?", 52, 1600, WHITE, al, sc, stroke=6,
                  weight="ExtraBold")
    k.flash(img, t)
    return img


def sc_atouts(t, d):
    img = dark_bg(P["terrain"], t, d, alpha=205)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "LES ATOUTS", 90, 380, WHITE, al, sc, cx=W / 2)
    items = [("Vue mer dégagée", "Sur l'océan Indien"),
             ("948 m² constructibles", "Zone UC · PLU du 09/06/2023"),
             ("10 m au faîtage", "Hauteur maximale autorisée"),
             ("Quartier résidentiel", "Accès direct par la voirie")]
    for i, (a, b) in enumerate(items):
        st = BEAT * (0.7 + i * 0.75)
        p = ease_out(prog(t, st, 0.3))
        if p <= 0:
            continue
        y = 560 + i * 190
        x = 70 - (1 - p) * 300
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(lay).rounded_rectangle((x, y - 75, x + 860, y + 75), 75,
                                              fill=(255, 255, 255, int(235 * p)))
        img.alpha_composite(lay)
        check_icon(img, x + 75, y, 50, p)
        fa = g.font(F_SANS, 48, "ExtraBold")
        fb = g.font(F_SANS, 32, "Medium")
        g.text(img, a, F_SANS, 48, x + 150 + fa.getlength(a) / 2, y - 22, DARK, alpha=p,
               weight="ExtraBold", shadow=False)
        g.text(img, b, F_SANS, 32, x + 150 + min(fb.getlength(b), 680) / 2, y + 28, (70, 90, 80),
               alpha=p, weight="Medium", shadow=False, max_w=680)
    k.flash(img, t, strength=0.5)
    return img


def sc_prix(t, d):
    img = dark_bg(P["terrain"], t, d, blur=6, alpha=160)
    sc, al = k.pop_in(t, 0.0, 0.18)
    k.tk_text(img, "TERRAIN À VENDRE", 52, TY - 230, DARK, al, sc, box=GREEN)
    sc, al = k.pop_in(t, BEAT, 0.18)
    k.tk_text(img, PRIX, 165, TY - 50, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, BEAT * 1.6)
    k.tk_text(img, "Honoraires à la charge du vendeur", 42, TY + 90, WHITE, al, sc, stroke=6,
              weight="ExtraBold")
    sc, al = k.pop_in(t, BEAT * 2.6)
    k.tk_text(img, f"soit ≈ {PRIX_M2} €/m² avec vue mer", 54, TY + 220, DARK, al, sc, box=GREEN)
    k.flash(img, t, strength=0.9, dur=0.2)
    return img


def sc_outro(t, d):
    img = dark_bg(P["terrain"], t, d, alpha=210)
    a = ease_out(prog(t, 0.0, 0.35))
    logo = P["logo"]
    lw = 700
    lh = int(lw * logo.height / logo.width)
    lg = logo.resize((lw, lh), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (lw, lh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, lw - 1, lh - 1), 30, fill=int(255 * a))
    lg.putalpha(m)
    img.alpha_composite(lg, (int(W / 2 - 40 - lw / 2), int(330 + (1 - a) * 40)))
    y = 330 + lh
    sc, al = k.pop_in(t, BEAT)
    k.tk_text(img, "TERRAIN VUE MER · PETITE-ÎLE", 50, y + 110, WHITE, al, sc, stroke=6)
    sc, al = k.pop_in(t, BEAT * 1.6)
    puls = 1 + 0.04 * math.sin(2 * math.pi * max(0, t - BEAT * 2) / BEAT)
    k.tk_text(img, "CONTACTEZ-MOI", 80, y + 260, DARK, al, sc * puls, box=GREEN)
    sc, al = k.pop_in(t, BEAT * 2.4)
    k.tk_text(img, "Jules Fraynal · 06 93 92 66 87", 46, y + 390, WHITE, al, sc, stroke=6,
              weight="ExtraBold")
    sc, al = k.pop_in(t, BEAT * 3.2)
    k.tk_text(img, "L'immobilier qui nous relie.", 54, y + 500, GREEN, al, sc, stroke=0,
              path=F_SCRIPT, weight="Italic")
    k.tk_text(img, "Visite sur rendez-vous · ou écrivez « TERRAIN » en DM", 30, H - 330,
              (170, 180, 175), al, 1.0, stroke=0, weight="Regular")
    k.flash(img, t, strength=0.6)
    return img


SCENES = [
    (sc_hook, 6),
    (sc_surface, 6),
    (sc_constructible, 5),
    (sc_ocean, 5),
    (sc_acces, 4),
    (sc_cadastre, 7),
    (sc_imagine, 9),
    (sc_atouts, 7),
    (sc_prix, 6),
    (sc_outro, 9),
]


def main():
    load()
    k.VIGNETTE = k.make_vignette()
    k.SCENES[:] = SCENES       # réutilise la timeline et l'audio du moteur TikTok
    starts, total = k.timeline()
    wav = os.path.join(HERE, "_audio.wav")
    k.make_audio(wav, starts, total)
    proc = subprocess.Popen(
        [g.ffmpeg_exe(), "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT],
        stdin=subprocess.PIPE)
    for i in range(int(total * FPS)):
        proc.stdin.write(k.frame(i / FPS, starts).tobytes())
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", OUT, f"({total:.1f} s)")


if __name__ == "__main__":
    main()
