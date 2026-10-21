"""Reel Instagram / TikTok — Terrain vue mer à Petite-Île (1 896 m²).

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


def sc_vue(t, d):
    img = dark_bg(P["vue"], t, d, blur=18, alpha=150)
    cw = W - 80
    ch = int(cw * P["vue"].height / P["vue"].width)
    z = 1.12 - 0.1 * g.ease_io(t / d)
    src = P["vue"]
    bw, bh = src.width / z, src.height / z
    x0, y0 = (src.width - bw) * 0.6, (src.height - bh) * 0.3
    card = src.resize((cw, ch), Image.BICUBIC, box=(x0, y0, x0 + bw, y0 + bh)).convert("RGBA")
    m = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, cw - 1, ch - 1), 30, fill=255)
    card.putalpha(m)
    a = ease_out(prog(t, 0, 0.3))
    yy = int(330 + (1 - a) * 80)
    img.alpha_composite(card, (40, yy))
    sc, al = k.pop_in(t, BEAT)
    k.tk_text(img, "L'OCÉAN", 110, yy + ch + 110, WHITE, al, sc, cx=W / 2)
    sc, al = k.pop_in(t, BEAT * 1.8)
    k.tk_text(img, "EN TOILE DE FOND", 64, yy + ch + 240, DARK, al, sc, box=GREEN, cx=W / 2)
    k.flash(img, t)
    return img


def sc_cadastre(t, d):
    img = dark_bg(P["terrain"], t, d)
    sc, al = k.pop_in(t, 0.0)
    k.tk_text(img, "LA PARCELLE", 84, 330, WHITE, al, sc, cx=W / 2)
    # carte « plan »
    a = ease_out(prog(t, 0.1, 0.35))
    cx0, cy0, cw, chh = 90, 470, 900, 640
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(lay)
    dr.rounded_rectangle((cx0, cy0 + (1 - a) * 60, cx0 + cw, cy0 + chh + (1 - a) * 60), 28,
                         fill=(250, 250, 247, int(255 * a)))
    img.alpha_composite(lay)
    if a < 0.99:
        return img

    def P2(x, y):  # coordonnées du croquis (320x225) → carte
        return (cx0 + 30 + x / 320 * (cw - 60), cy0 + 30 + y / 225 * (chh - 60))

    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(lay)
    grey = (150, 150, 150, 255)
    for line in [[(60, 0), (60, 225)], [(0, 66), (60, 68)], [(0, 122), (55, 125)],
                 [(0, 178), (55, 178)], [(140, 165), (140, 225)], [(255, 0), (265, 160), (300, 225)],
                 [(285, 0), (290, 120), (320, 200)]]:
        dr.line([P2(*p) for p in line], fill=grey, width=3)
    f = g.font(F_SANS, 34, "Bold")
    for lab, (x, y) in [("8", (20, 35)), ("6", (20, 95)), ("4", (20, 150))]:
        dr.text(P2(x, y), lab, font=f, fill=(60, 60, 60, 255), anchor="mm")
    # flèche nord
    nx, ny = P2(300, 30)
    dr.polygon([(nx, ny - 30), (nx - 14, ny + 10), (nx, ny), (nx + 14, ny + 10)], fill=(30, 30, 30, 255))
    dr.text((nx, ny - 50), "N", font=g.font(F_SANS, 26, "Bold"), fill=(30, 30, 30, 255), anchor="mm")
    poly = [P2(62, 60), P2(245, 72), P2(245, 128), P2(262, 172), P2(55, 160)]
    pf = ease_out(prog(t, 0.45, 0.6))
    if pf >= 1:
        fa = 0.25 + 0.12 * math.sin(2 * math.pi * (t - 1.05) / (BEAT * 2))
        dr.polygon(poly, fill=GREEN + (int(255 * fa),))
    partial_path(dr, poly, pf, GREEN + (255,), 9)
    img.alpha_composite(lay)
    a2 = ease_out(prog(t, 1.0, 0.3))
    pcx = sum(p[0] for p in poly) / 5
    pcy = sum(p[1] for p in poly) / 5
    g.text(img, "1207", F_SANS, 46, pcx, pcy - 30, (25, 60, 20), alpha=a2, weight="ExtraBold",
           shadow=False)
    g.text(img, SURFACE, F_SANS, 40, pcx, pcy + 25, (25, 60, 20), alpha=a2, weight="SemiBold",
           shadow=False)
    sc, al = k.pop_in(t, 1.3)
    k.tk_text(img, "Plan indicatif · extrait cadastral", 34, cy0 + chh + 80, SOFT, al, sc, stroke=0,
              weight="Medium", cx=W / 2)
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
    items = [("Vue mer", "Environnement exceptionnel"),
             ("Zone UC", "Constructible selon le PLU en vigueur"),
             ("Quartier résidentiel", "Calme, cadre naturel"),
             ("Fort potentiel", "Projet de vie ou investissement")]
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
    k.tk_text(img, "EXCLU IMMO RÉSEAU", 52, TY - 230, DARK, al, sc, box=GREEN)
    sc, al = k.pop_in(t, BEAT, 0.18)
    k.tk_text(img, PRIX, 165, TY - 50, WHITE, al, sc, stroke=12)
    sc, al = k.pop_in(t, BEAT * 1.6)
    k.tk_text(img, "HAI · honoraires d'agence inclus", 42, TY + 90, WHITE, al, sc, stroke=6,
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
    k.tk_text(img, "Visite sur rendez-vous · Écrivez « TERRAIN »", 40, y + 390, WHITE, al, sc, stroke=5,
              weight="ExtraBold")
    sc, al = k.pop_in(t, BEAT * 3.2)
    k.tk_text(img, "L'immobilier qui nous relie.", 54, y + 500, GREEN, al, sc, stroke=0,
              path=F_SCRIPT, weight="Italic")
    k.tk_text(img, "Constructibilité selon PLU en vigueur · DPE non requis (terrain)", 24, H - 330,
              (170, 180, 175), al, 1.0, stroke=0, weight="Regular")
    k.flash(img, t, strength=0.6)
    return img


SCENES = [
    (sc_hook, 6),
    (sc_surface, 6),
    (sc_vue, 5),
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
