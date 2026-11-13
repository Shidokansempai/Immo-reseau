"""Mini-vidéos manga « justicier de la nuit » — Kickboxing du LUNDI.

Fighter Academy Karaté (Le Tampon). Deux versions verticales 1080x1920 :
  - lundi-kickboxing-enfants.mp4
  - lundi-kickboxing-ados-adultes.mp4

Ambiance comics / manga noir : ville de nuit, pleine lune, pluie, signal
lumineux dans le ciel, justicier masqué ORIGINAL (cape + bandeau), lignes de
vitesse, trames, onomatopées. Bande-son synthétisée.

Usage :  python3 generate_lundi_kickboxing.py [kids|adults]
"""
import math
import os
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
DURATION = 21.0

INK = (8, 8, 12)
WHITE = (246, 244, 236)
YELLOW = (255, 206, 32)
RED = (226, 24, 45)
GREY = (160, 160, 168)

F_ANTON = os.path.join(HERE, "fonts", "Anton-Regular.ttf")
F_BEBAS = os.path.join(HERE, "fonts", "BebasNeue-Regular.ttf")
_fc = {}


def font(path, size):
    key = (path, int(size))
    if key not in _fc:
        _fc[key] = ImageFont.truetype(path, int(size))
    return _fc[key]


# ------------------------------------------------------------------ versions
KIDS = dict(
    out="lundi-kickboxing-enfants.mp4", accent=YELLOW, chibi=1.3,
    s1=["LA NUIT TOMBE SUR", "TAMPON CITY..."],
    s2=["UN SIGNAL DANS LE CIEL !", "LES PETITS JUSTICIERS SONT APPELÉS"],
    hits=["POW !", "BAM !", "KA-BOOM !"],
    s3="ENTRAÎNEMENT DE HÉROS",
    aud="ENFANTS",
    words=["COURAGE", "RESPECT", "CONFIANCE"],
    cta=["ENFILE TA CAPE...", "ET TES GANTS !"],
)
ADULTS = dict(
    out="lundi-kickboxing-ados-adultes.mp4", accent=RED, chibi=1.0,
    s1=["LA VILLE DORT.", "PAS NOUS."],
    s2=["LE SIGNAL EST LANCÉ.", "TAMPON CITY A BESOIN DE COMBATTANTS"],
    hits=["SMACK !", "BOOM !", "KRAAAK !"],
    s3="JAB · CROSS · HIGH KICK",
    aud="ADOS & ADULTES",
    words=["CARDIO", "TECHNIQUE", "MENTAL D'ACIER"],
    cta=["DEVIENS LE JUSTICIER", "DE TA PROPRE HISTOIRE."],
)

# scènes (s)
S1, S2, S3, S4, S5 = (0.0, 3.6), (3.6, 7.2), (7.2, 12.6), (12.6, 16.6), (16.6, 21.0)
HIT_T = [8.6, 9.35, 10.25]          # jab, cross, high kick
SLAM_T = S4[0] + 0.55               # « LUNDI » qui s'écrase


# ------------------------------------------------------------------ easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease_back(x):
    x = clamp(x)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def prog(t, start, dur):
    return clamp((t - start) / dur)


def fade_io(t, a, b, fin=0.3, fout=0.3):
    if t < a or t > b:
        return 0.0
    return min(clamp((t - a) / fin), clamp((b - t) / fout))


# ------------------------------------------------------------------ text
def fit(path, size, s, maxw, tracking=0):
    while size > 20:
        f = font(path, size)
        if f.getlength(s) + tracking * (len(s) - 1) <= maxw:
            return f
        size -= 4
    return font(path, size)


def text(img, s, fnt, cx, cy, fill, alpha=1.0, scale=1.0, angle=0.0, stroke=0,
         stroke_fill=INK, dx=0, dy=0, tracking=0):
    """Texte centré, avec contour encré, rotation et échelle."""
    if alpha <= 0.01:
        return
    if scale != 1.0:
        fnt = font(fnt.path, max(6, fnt.size * scale))
        stroke = int(stroke * scale)
        tracking = tracking * scale
    widths = [fnt.getlength(c) for c in s]
    tw = sum(widths) + tracking * (len(s) - 1)
    asc, desc = fnt.getmetrics()
    pad = 30 + stroke
    layer = Image.new("RGBA", (int(tw) + 2 * pad, asc + desc + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = pad
    for c, w in zip(s, widths):
        d.text((x, pad), c, font=fnt, fill=fill + (255,), stroke_width=stroke,
               stroke_fill=stroke_fill + (255,))
        x += w + tracking
    if angle:
        layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        a = layer.getchannel("A").point(lambda v: int(v * alpha))
        layer.putalpha(a)
    img.alpha_composite(layer, (int(cx - layer.width / 2 + dx), int(cy - layer.height / 2 + dy)))


def caption_box(img, lines, cx, cy, p, alpha=1.0, size=78, accent=YELLOW):
    """Cartouche de narration façon comics (fond clair, bord encré)."""
    if alpha <= 0 or p <= 0:
        return
    full = [fit(F_BEBAS, size, ln, 900, 3) for ln in lines]
    lh = max(f.size for f in full) * 1.05
    bw = max(f.getlength(ln) + 3 * len(ln) for f, ln in zip(full, lines)) + 90
    bh = lh * len(lines) + 50
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sc = ease_back(clamp(p * 2.2))
    w2, h2 = bw * sc / 2, bh * sc / 2
    d.rectangle((cx - w2 + 14, cy - h2 + 14, cx + w2 + 14, cy + h2 + 14), fill=accent + (255,))
    d.rectangle((cx - w2, cy - h2, cx + w2, cy + h2), fill=(250, 246, 226, 255),
                outline=INK + (255,), width=7)
    img.alpha_composite(layer) if alpha >= 1 else img.alpha_composite(
        _alpha(layer, alpha))
    # texte « machine à écrire »
    total = sum(len(ln) for ln in lines)
    n = int(total * clamp((p - 0.25) / 0.75))
    for i, (ln, f) in enumerate(zip(lines, full)):
        shown = ln[:max(0, n)]
        n -= len(ln)
        if shown:
            fw = f.getlength(ln) + 3 * (len(ln) - 1)
            sw = f.getlength(shown) + 3 * (len(shown) - 1)
            text(img, shown, f, cx - fw / 2 + sw / 2, cy - lh * len(lines) / 2 + lh * (i + 0.5),
                 INK, alpha, tracking=3)


def _alpha(layer, a):
    layer = layer.copy()
    layer.putalpha(layer.getchannel("A").point(lambda v: int(v * a)))
    return layer


# ------------------------------------------------------------------ décors
def halftone(field, cell=14, rmax=7.5):
    """Trame manga : points dont le rayon suit l'intensité du champ (0..1)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = (np.floor(xx / cell) + 0.5) * cell
    cy = (np.floor(yy / cell) + 0.5) * cell
    fc = field[np.clip(cy.astype(int), 0, H - 1), np.clip(cx.astype(int), 0, W - 1)]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    return (dist < fc * rmax).astype(np.float32)


def city_layer(rng, base_y, color, lit, wmin=60, wmax=170, hmin=150, hmax=560):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = -20
    while x < W:
        bw = int(rng.integers(wmin, wmax))
        bh = int(rng.integers(hmin, hmax))
        top = base_y - bh
        d.rectangle((x, top, x + bw, H), fill=color + (255,))
        kind = rng.integers(0, 4)
        if kind == 0:   # antenne
            d.rectangle((x + bw // 2 - 3, top - 70, x + bw // 2 + 3, top), fill=color + (255,))
        elif kind == 1:  # toit en pointe
            d.polygon([(x, top), (x + bw / 2, top - 60), (x + bw, top)], fill=color + (255,))
        if lit:
            for wy in range(top + 24, base_y + 400, 34):
                for wx in range(x + 14, x + bw - 18, 26):
                    if rng.random() < 0.18:
                        d.rectangle((wx, wy, wx + 10, wy + 16), fill=(255, 214, 90, 220))
        x += bw + int(rng.integers(-10, 12))
    return layer


def make_backgrounds():
    rng = np.random.default_rng(42)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    def sky(moon_x, moon_y, moon_r):
        dist = np.sqrt((xx - moon_x) ** 2 + (yy - moon_y) ** 2)
        glow = np.clip(1 - (dist - moon_r) / 900, 0, 1) ** 2
        base = np.zeros((H, W, 3), np.float32)
        base[...] = (14, 16, 30)
        base += (yy / H)[..., None] * np.array([10, 4, 6], np.float32)
        dots = halftone(glow * 0.9, 16, 8.5)
        base += dots[..., None] * np.array([60, 62, 80], np.float32) * (0.35 + glow[..., None])
        img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")
        d = ImageDraw.Draw(img)
        # lune + cratères en trame
        d.ellipse((moon_x - moon_r, moon_y - moon_r, moon_x + moon_r, moon_y + moon_r),
                  fill=(244, 238, 210, 255))
        for cxr, cyr, rr in [(-0.35, -0.2, 0.18), (0.25, 0.3, 0.22), (0.4, -0.35, 0.1),
                             (-0.15, 0.45, 0.12), (0.05, -0.05, 0.08)]:
            r = rr * moon_r
            x0, y0 = moon_x + cxr * moon_r, moon_y + cyr * moon_r
            d.ellipse((x0 - r, y0 - r, x0 + r, y0 + r), fill=(214, 206, 178, 255))
        # Piton des Neiges en ombre chinoise
        pts = [(0, 1250)]
        for i in range(0, W + 60, 60):
            peak = 1050 - 260 * math.exp(-((i - 330) / 260) ** 2) - 140 * math.exp(-((i - 860) / 200) ** 2)
            pts.append((i, peak + rng.integers(-12, 12)))
        pts += [(W, H), (0, H)]
        d.polygon(pts, fill=(30, 30, 48, 255))
        return img

    city = sky(W * 0.66, 560, 250)
    city.alpha_composite(city_layer(rng, 1450, (22, 22, 34), False, 80, 200, 250, 650))
    city.alpha_composite(city_layer(rng, 1560, (12, 12, 20), True))
    moon = sky(W / 2, 760, 450)
    moon.alpha_composite(city_layer(rng, 1700, (16, 16, 26), True, 60, 140, 80, 300))
    # rebord de toit au premier plan (scène du héros)
    d = ImageDraw.Draw(moon)
    d.rectangle((0, 1440, W, H), fill=INK + (255,))
    d.rectangle((0, 1440, W, 1452), fill=(220, 220, 230, 255))
    d.polygon([(0, 1452), (W, 1452), (W, 1500), (0, 1530)], fill=(30, 30, 42, 255))
    return city, moon


RAIN = np.random.default_rng(3).random((260, 4))


def rain(img, t, alpha=0.5):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x0, y0, ln, sp in RAIN:
        y = (y0 * H + t * (1400 + sp * 900)) % (H + 200) - 100
        x = (x0 * (W + 400) - (y * 0.25)) % (W + 200) - 100
        L = 30 + ln * 60
        d.line((x, y, x - L * 0.25, y - L), fill=(200, 210, 235, int(110 * alpha)), width=2)
    img.alpha_composite(layer)


def speed_lines(img, cx, cy, seed, alpha=1.0, n=90, r0=380, color=WHITE):
    if alpha <= 0:
        return
    rng = np.random.default_rng(seed)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        a = rng.random() * 2 * math.pi
        ri = r0 + rng.random() * 300
        wdt = 0.004 + rng.random() * 0.012
        R = 1600
        d.polygon([(cx + ri * math.cos(a), cy + ri * math.sin(a)),
                   (cx + R * math.cos(a - wdt), cy + R * math.sin(a - wdt)),
                   (cx + R * math.cos(a + wdt), cy + R * math.sin(a + wdt))],
                  fill=color + (int(120 * alpha),))
    img.alpha_composite(layer)


def burst(img, cx, cy, r, p, seed, fill=WHITE, alpha=1.0):
    """Explosion étoilée d'impact."""
    if p <= 0 or alpha <= 0:
        return
    rng = np.random.default_rng(seed)
    k = 16
    pts_o, pts_i = [], []
    sc = ease_back(clamp(p * 2.5))
    for i in range(k * 2):
        a = i * math.pi / k + rng.random() * 0.1
        rr = r * sc * ((1.0 + rng.random() * 0.35) if i % 2 == 0 else 0.55)
        pts_o.append((cx + (rr + 18) * math.cos(a), cy + (rr + 18) * math.sin(a)))
        pts_i.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.polygon(pts_o, fill=INK + (255,))
    d.polygon(pts_i, fill=fill + (255,))
    img.alpha_composite(_alpha(layer, alpha) if alpha < 1 else layer)


# ------------------------------------------------------------------ héros
# Squelette vu de profil (face à droite), origine = hanches, pieds à y=250.
J = ["neck", "head", "fe", "fh", "be", "bh", "fk", "ff", "bk", "bf"]
POSES = {
    "guard": dict(neck=(12, -262), head=(26, -338), fe=(78, -195), fh=(108, -282),
                  be=(28, -188), bh=(66, -266), fk=(70, 118), ff=(92, 250),
                  bk=(-52, 120), bf=(-96, 250)),
    "jab": dict(neck=(26, -260), head=(44, -334), fe=(150, -262), fh=(248, -276),
                be=(30, -188), bh=(70, -270), fk=(78, 118), ff=(104, 250),
                bk=(-52, 120), bf=(-100, 250)),
    "cross": dict(neck=(48, -254), head=(70, -326), fe=(64, -190), fh=(96, -272),
                  be=(150, -250), bh=(262, -262), fk=(84, 116), ff=(110, 250),
                  bk=(-30, 122), bf=(-78, 250)),
    "kick": dict(neck=(-96, -226), head=(-118, -298), fe=(-18, -230), fh=(36, -302),
                 be=(-170, -168), bh=(-238, -110), fk=(-14, 126), ff=(-26, 250),
                 bk=(156, -112), bf=(312, -268)),
}
POSES = {k: {j: np.array(v, np.float32) for j, v in p.items()} for k, p in POSES.items()}
# (temps, pose) — la pose s'interpole entre deux clés
TIMELINE = [(0, "guard"), (8.35, "guard"), (8.6, "jab"), (8.95, "guard"), (9.1, "guard"),
            (9.35, "cross"), (9.7, "guard"), (9.95, "guard"), (10.25, "kick"),
            (11.1, "kick"), (11.6, "guard"), (99, "guard")]
HIP_X = [(0, 0), (8.35, 0), (8.6, 30), (9.35, 50), (10.25, 30), (11.6, 0), (99, 0)]


def interp(tl, t):
    for (t0, a), (t1, b) in zip(tl, tl[1:]):
        if t0 <= t <= t1:
            return a, b, ease_io((t - t0) / max(1e-6, t1 - t0))
    return tl[-1][1], tl[-1][1], 0.0


def pose_at(t):
    a, b, k = interp(TIMELINE, t)
    p = {j: POSES[a][j] * (1 - k) + POSES[b][j] * k for j in J}
    ha, hb, hk = interp(HIP_X, t)
    p["hip"] = np.array([ha * (1 - hk) + hb * hk, 0], np.float32)
    for j in J:
        p[j] = p[j] + p["hip"]
    return p


def draw_hero(img, t, cx, cy, s, accent, chibi=1.0, flare=0.0, breathe=True):
    p = pose_at(t)
    bob = math.sin(t * 6) * 4 if breathe else 0
    P = {j: (cx + v[0] * s, cy + (v[1] + (bob if j != "ff" and j != "bf" else 0)) * s)
         for j, v in p.items()}
    neck, hip, head = P["neck"], P["hip"], P["head"]
    O = 9  # épaisseur du contour encré

    def limb_parts(a, b, c, w):
        return [("line", a, b, w), ("line", b, c, w * 0.9),
                ("dot", b, w / 2), ("dot", c, w * 0.45)]

    # cape
    w1 = math.sin(t * 5.5) * 30 * s
    w2 = math.sin(t * 4.3 + 1) * 40 * s
    f = flare
    nx, ny = neck
    cape = [(nx + 18 * s, ny - 6 * s), (nx - 30 * s, ny + 4 * s),
            (nx - (110 + 120 * f) * s + w1, ny + (200 - 60 * f) * s),
            (nx - (230 + 260 * f) * s + w2, ny + (420 - 200 * f) * s),
            (nx - (150 + 190 * f) * s + w1, ny + (380 - 150 * f) * s),
            (nx - (110 + 120 * f) * s + w2, ny + (470 - 150 * f) * s),
            (nx - (40 + 60 * f) * s, ny + (390 - 90 * f) * s),
            (nx - 10 * s, ny + 330 * s - 80 * f * s), (nx + 20 * s, ny + 120 * s)]
    torso_w = 50 * s
    v = np.array(hip) - np.array(neck)
    v = v / (np.linalg.norm(v) + 1e-6)
    perp = np.array([-v[1], v[0]])
    torso = [tuple(np.array(neck) + perp * torso_w), tuple(np.array(neck) - perp * torso_w),
             tuple(np.array(hip) - perp * torso_w * 0.8), tuple(np.array(hip) + perp * torso_w * 0.8)]
    hr = 46 * s * chibi
    parts = [("poly", cape)]
    parts += limb_parts(neck, P["be"], P["bh"], 40 * s)
    parts += limb_parts(hip, P["bk"], P["bf"], 50 * s)
    parts += [("poly", torso), ("dot", hip, 40 * s)]
    parts += limb_parts(hip, P["fk"], P["ff"], 50 * s)
    parts += [("dot", head, hr)]
    parts += limb_parts(neck, P["fe"], P["fh"], 40 * s)

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for pass_ in (0, 1):
        col = (WHITE if pass_ == 0 else INK) + (255,)
        o = O * s * 1.4 if pass_ == 0 else 0
        for part in parts:
            if part[0] == "poly":
                pts = part[1]
                if pass_ == 0:
                    d.line(pts + [pts[0]], fill=col, width=int(2 * o), joint="curve")
                    for q in pts:
                        d.ellipse((q[0] - o, q[1] - o, q[0] + o, q[1] + o), fill=col)
                d.polygon(pts, fill=col)
            elif part[0] == "line":
                _, a, b, w = part
                d.line((a, b), fill=col, width=int(w + 2 * o))
            else:
                _, c, r = part
                r = r + o
                d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=col)
    # gants de boxe (couleur d'accent)
    for hand, elbow in (("bh", "be"), ("fh", "fe")):
        c = P[hand]
        r = 36 * s
        d.ellipse((c[0] - r - 5, c[1] - r - 5, c[0] + r + 5, c[1] + r + 5), fill=INK + (255,))
        d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=accent + (255,))
        d.ellipse((c[0] - r * 0.5, c[1] - r * 0.7, c[0] - r * 0.05, c[1] - r * 0.3),
                  fill=(255, 255, 255, 160))
    # bandeau + pans flottants
    hx, hy = head
    band_y = hy - hr * 0.25
    d.line((hx - hr * 0.95, band_y, hx + hr * 0.95, band_y - 6 * s), fill=accent + (255,), width=int(14 * s * chibi))
    tw1 = math.sin(t * 9) * 18 * s
    tw2 = math.sin(t * 7 + 2) * 22 * s
    d.line([(hx - hr * 0.9, band_y), (hx - hr - 60 * s, band_y - 10 * s + tw1),
            (hx - hr - 130 * s, band_y + 10 * s + tw2)], fill=accent + (255,), width=int(12 * s), joint="curve")
    d.line([(hx - hr * 0.9, band_y + 4), (hx - hr - 50 * s, band_y + 30 * s + tw2),
            (hx - hr - 110 * s, band_y + 50 * s + tw1)], fill=accent + (255,), width=int(10 * s), joint="curve")
    # yeux du masque (fentes blanches)
    ey = hy - hr * 0.02
    for ex in (hx + hr * 0.25, hx + hr * 0.68):
        d.polygon([(ex - 14 * s * chibi, ey - 2 * s), (ex + 12 * s * chibi, ey - 9 * s * chibi),
                   (ex + 8 * s * chibi, ey + 6 * s)], fill=(255, 255, 255, 255))
    img.alpha_composite(layer)


def emblem(img, cx, cy, r, alpha, accent):
    """Signal lumineux : gant de boxe dans un halo (création originale)."""
    if alpha <= 0:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((cx - r * 1.5, cy - r, cx + r * 1.5, cy + r), fill=(255, 226, 120, 235))
    d.ellipse((cx - r * 1.5, cy - r, cx + r * 1.5, cy + r), outline=(255, 245, 200, 255), width=10)
    g = r * 0.62
    d.rounded_rectangle((cx - g * 0.9, cy - g * 0.95, cx + g * 0.75, cy + g * 0.45), radius=int(g * 0.6), fill=INK + (255,))
    d.ellipse((cx - g * 1.25, cy - g * 0.35, cx - g * 0.35, cy + g * 0.45), fill=INK + (255,))
    d.rectangle((cx - g * 0.6, cy + g * 0.4, cx + g * 0.5, cy + g * 0.95), fill=INK + (255,))
    d.line((cx - g * 0.6, cy + g * 0.55, cx + g * 0.5, cy + g * 0.55), fill=(255, 226, 120, 255), width=8)
    img.alpha_composite(_alpha(layer, alpha))


# ------------------------------------------------------------------ scènes
def zoom(img, k, cx=W / 2, cy=H / 2):
    if k <= 1.0001:
        return img
    w, h = W / k, H / k
    cx = min(max(cx, w / 2), W - w / 2)
    cy = min(max(cy, h / 2), H - h / 2)
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    return img.resize((W, H), Image.BICUBIC, box=box)


def scene1(t, bgs, cfg):
    img = zoom(bgs[0], 1.12 - 0.12 * ease_out(prog(t, 0, 3.6)), W / 2, 900)
    rain(img, t, 0.8)
    al = fade_io(t, *S1, 0.01, 0.3)
    caption_box(img, cfg["s1"], W / 2, 330, prog(t, 0.4, 1.8), al, 92, cfg["accent"])
    return img


def scene2(t, bgs, cfg):
    a, b = S2
    img = bgs[0].copy()
    p = ease_out(prog(t, a + 0.1, 0.9))
    # faisceau depuis la ville
    if p > 0:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        sx, sy = 300, 1500
        tx, ty = sx + (W * 0.6 - sx) * p, sy + (520 - sy) * p
        d.polygon([(sx - 20, sy), (sx + 20, sy), (tx + 200 * p, ty), (tx - 200 * p, ty)],
                  fill=(255, 230, 140, 70))
        d.polygon([(sx - 8, sy), (sx + 8, sy), (tx + 110 * p, ty), (tx - 110 * p, ty)],
                  fill=(255, 240, 180, 60))
        img.alpha_composite(layer)
    flick = 0.85 + 0.15 * math.sin(t * 40) if t < a + 1.6 else 1
    emblem(img, W * 0.6, 520, 190 * ease_back(prog(t, a + 0.8, 0.6)),
           ease_out(prog(t, a + 0.8, 0.3)) * flick, cfg["accent"])
    # héros sur un toit, en silhouette
    hp = ease_out(prog(t, a + 2.0, 0.6))
    if hp > 0:
        draw_hero(img, 0.0 + t, 820, 1080 + 60 * (1 - hp), 0.42, cfg["accent"], cfg["chibi"], flare=0.3)
    rain(img, t, 0.6)
    al = fade_io(t, a, b, 0.01, 0.3)
    caption_box(img, cfg["s2"], W / 2, 1640, prog(t, a + 1.2, 1.8), al, 70, cfg["accent"])
    return img


def scene3(t, bgs, cfg, i):
    a, b = S3
    img = bgs[1].copy()
    acc = cfg["accent"]
    # lignes de vitesse pendant les frappes
    strike = max([1 - clamp(abs(t - h) / 0.35) for h in HIT_T] + [0])
    if t > HIT_T[2] and t < 11.1:
        strike = max(strike, 0.6)
    speed_lines(img, W / 2, 760, i // 2, strike, n=110, r0=420, color=(255, 255, 255))
    flare = 0.2 + 0.8 * clamp((t - (HIT_T[2] - 0.3)) / 0.3) * (1 - clamp((t - 11.1) / 0.5))
    # bursts derrière le héros aux impacts
    pos = [(860, 830), (880, 850), (900, 720)]
    for k, h in enumerate(HIT_T):
        bp = prog(t, h, 0.5)
        if 0 < bp < 1 or (k == 2 and h <= t < 11.4):
            al = 1 - clamp((t - (h + (0.9 if k == 2 else 0.45))) / 0.2)
            burst(img, pos[k][0], pos[k][1], 150 + 60 * k, prog(t, h, 0.4), 100 + k, YELLOW if k == 2 else WHITE, al)
    draw_hero(img, t, 470, 1180, 1.05, acc, cfg["chibi"], flare=flare)
    # onomatopées
    ang = [12, -10, 8]
    for k, h in enumerate(HIT_T):
        hold = 0.72 if k < 2 else 1.4
        al = fade_io(t, h, h + hold, 0.02, 0.2)
        if al > 0:
            sz = [190, 200, 210][k]
            txt = cfg["hits"][k]
            f = fit(F_ANTON, sz, txt, 820)
            text(img, txt, f, [W / 2 + 60, W / 2 + 40, W / 2][k], [470, 400, 300][k], YELLOW if k != 1 else WHITE,
                 al, scale=1 + 0.6 * (1 - ease_back(prog(t, h, 0.35))), angle=ang[k], stroke=12)
    # nom des techniques (bandeau bas)
    al = fade_io(t, a + 0.2, b, 0.3, 0.3)
    caption_box(img, [cfg["s3"]], W / 2, 1640, prog(t, a + 0.3, 1.2), al, 84, acc)
    # inversion « négatif manga » sur le high kick
    if 0 <= t - HIT_T[2] < 0.1:
        img = ImageOps.invert(img.convert("RGB")).convert("RGBA")
    return img


def scene4(t, bgs, cfg, i):
    a, b = S4
    img = bgs[0].copy()
    img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, 175)))
    acc = cfg["accent"]
    speed_lines(img, W / 2, 760, 500 + i // 3, 0.5 * ease_out(prog(t, SLAM_T, 0.2)), n=70, r0=520)
    al = fade_io(t, a, b, 0.2, 0.3)
    text(img, "RENDEZ-VOUS", font(F_BEBAS, 100), W / 2, 280, WHITE,
         al * ease_out(prog(t, a + 0.05, 0.3)), tracking=18)
    sp = prog(t, SLAM_T - 0.18, 0.18)
    burst(img, W / 2, 690, 320, prog(t, SLAM_T, 0.4), 77, acc, al)
    text(img, "LUNDI", font(F_ANTON, 300), W / 2, 660, WHITE, al * clamp(sp * 3),
         scale=1 + 1.4 * (1 - ease_out(sp)), angle=-4, stroke=16)
    p2 = ease_out(prog(t, SLAM_T + 0.5, 0.35))
    f = fit(F_ANTON, 170, "KICKBOXING", 960)
    text(img, "KICKBOXING", f, W / 2, 1000, acc, al * p2, dx=-500 * (1 - p2), stroke=10)
    p3 = ease_back(prog(t, SLAM_T + 0.85, 0.4))
    f = fit(F_ANTON, 120, cfg["aud"], 900)
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).rectangle((W / 2 - 470 * clamp(p3), 1110, W / 2 + 470 * clamp(p3), 1270), fill=WHITE + (255,))
    img.alpha_composite(_alpha(lay, al))
    text(img, cfg["aud"], f, W / 2, 1190, INK, al * clamp(p3))
    for k, w in enumerate(cfg["words"]):
        st = SLAM_T + 1.4 + k * 0.45
        pw = ease_out(prog(t, st, 0.3))
        text(img, w, fit(F_ANTON, 110, w, 900), W / 2, 1390 + k * 145, WHITE if k != 1 else acc,
             al * pw, scale=1 + 0.5 * (1 - ease_back(prog(t, st, 0.35))), stroke=6)
    return img


def scene5(t, bgs, cfg, i):
    a, b = S5
    img = bgs[1].copy()
    img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, 120)))
    acc = cfg["accent"]
    draw_hero(img, t, 300, 1180, 0.7, acc, cfg["chibi"], flare=0.15)
    rain(img, t, 0.5)
    al = fade_io(t, a, b + 1, 0.3, 0.3)
    text(img, cfg["cta"][0], fit(F_ANTON, 130, cfg["cta"][0], 960), W / 2, 260, WHITE,
         al * ease_out(prog(t, a + 0.2, 0.4)), stroke=8, angle=-2)
    text(img, cfg["cta"][1], fit(F_ANTON, 130, cfg["cta"][1], 960), W / 2, 420, acc,
         al * ease_out(prog(t, a + 0.7, 0.4)), stroke=8, angle=-2,
         scale=1 + 0.4 * (1 - ease_back(prog(t, a + 0.7, 0.45))))
    p = ease_back(prog(t, a + 1.4, 0.5))
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    bw = 480 * clamp(p)
    d.rectangle((W / 2 - bw + 14, 1500 + 14, W / 2 + bw + 14, 1650 + 14), fill=INK + (255,))
    d.rectangle((W / 2 - bw, 1500, W / 2 + bw, 1650), fill=acc + (255,), outline=INK + (255,), width=7)
    img.alpha_composite(_alpha(lay, al))
    btn_col = INK if acc == YELLOW else WHITE
    text(img, "RÉSERVE TON COURS D'ESSAI", fit(F_ANTON, 74, "RÉSERVE TON COURS D'ESSAI", 880),
         W / 2, 1575, btn_col, al * clamp(p))
    text(img, "Infos & inscriptions en message privé", font(F_BEBAS, 62), W / 2, 1720, WHITE,
         al * ease_out(prog(t, a + 2.0, 0.4)), tracking=2, stroke=4)
    text(img, "FIGHTER ACADEMY KARATÉ · LE TAMPON", fit(F_BEBAS, 64, "FIGHTER ACADEMY KARATÉ · LE TAMPON", 940),
         W / 2, 1810, YELLOW, al * ease_out(prog(t, a + 2.3, 0.4)), tracking=5, stroke=4)
    text(img, "OSU !", font(F_ANTON, 150), 790, 900, WHITE, al * ease_out(prog(t, a + 2.6, 0.3)),
         scale=1 + 0.6 * (1 - ease_back(prog(t, a + 2.6, 0.4))), angle=8, stroke=10)
    return img


# ------------------------------------------------------------------ montage
def shake(img, t):
    amp = 0
    for h in HIT_T + [SLAM_T]:
        if 0 <= t - h < 0.3:
            amp = max(amp, (1 - (t - h) / 0.3) * (34 if h in (HIT_T[2], SLAM_T) else 18))
    if amp < 1:
        return img
    dx = int(math.sin(t * 157) * amp)
    dy = int(math.cos(t * 131) * amp)
    out = Image.new("RGBA", img.size, INK + (255,))
    out.paste(img, (dx, dy))
    return out


def panel_frame(img):
    """Bord de case manga (marge blanche + trait noir)."""
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W - 1, H - 1), outline=(240, 238, 230, 255), width=22)
    d.rectangle((22, 22, W - 23, H - 23), outline=INK + (255,), width=6)


def frame(t, i, bgs, cfg):
    if t < S1[1]:
        img = scene1(t, bgs, cfg)
    elif t < S2[1]:
        img = scene2(t, bgs, cfg)
    elif t < S3[1]:
        img = scene3(t, bgs, cfg, i)
    elif t < S4[1]:
        img = scene4(t, bgs, cfg, i)
    else:
        img = scene5(t, bgs, cfg, i)
    img = shake(img, t)
    # coup de volet blanc entre scènes (« page tournée »)
    for a in (S2[0], S3[0], S4[0], S5[0]):
        if 0 <= t - a < 0.14:
            img.alpha_composite(Image.new("RGBA", img.size, (255, 255, 255, int(200 * (1 - (t - a) / 0.14)))))
    if 0 <= t - HIT_T[0] < 0.06 or 0 <= t - HIT_T[1] < 0.06:
        img.alpha_composite(Image.new("RGBA", img.size, (255, 255, 255, 90)))
    panel_frame(img)
    if t < 0.4:
        img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, int(255 * (1 - t / 0.4)))))
    if t > DURATION - 0.6:
        img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, int(255 * clamp((t - DURATION + 0.6) / 0.6)))))
    return img.convert("RGB")


# ------------------------------------------------------------------ audio
def make_audio(path, kids, sr=44100):
    n = int(DURATION * sr)
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(5)

    def add(sig, start, gain=1.0):
        a = int(start * sr)
        b = min(n, a + len(sig))
        if 0 <= a < n:
            out[a:b] += sig[: b - a] * gain

    def tt(d):
        return np.arange(int(d * sr)) / sr

    def kick(amp=1.0):
        x = tt(0.5)
        f = 45 + 120 * np.exp(-x * 30)
        return amp * np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-x * 7)

    def snare(amp=0.5):
        x = tt(0.25)
        return amp * (rng.normal(0, 1, len(x)) * np.exp(-x * 22) + 0.4 * np.sin(2 * np.pi * 190 * x) * np.exp(-x * 30))

    def hat(amp=0.12):
        x = tt(0.06)
        return amp * rng.normal(0, 1, len(x)) * np.exp(-x * 80)

    def punch(amp=1.0, low=70):
        x = tt(0.6)
        f = low + 200 * np.exp(-x * 40)
        body = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-x * 9)
        crack = rng.normal(0, 1, len(x)) * np.exp(-x * 45)
        return amp * (body + 0.7 * crack)

    def whoosh(d=0.35, amp=0.4):
        x = tt(d)
        env = np.sin(np.pi * x / d) ** 2
        noise = rng.normal(0, 1, len(x))
        sm = np.convolve(noise, np.ones(30) / 30, mode="same")
        return amp * sm * env * 3

    def riser(start, d, f0, f1, amp=0.15):
        x = tt(d)
        f = f0 + (f1 - f0) * (x / d) ** 2
        env = np.minimum(1, x / 0.2) * np.minimum(1, (d - x) / 0.1)
        add(amp * np.sign(np.sin(2 * np.pi * np.cumsum(f) / sr)) * env * 0.5, start)

    # nappe sombre (mineur)
    x = tt(DURATION)
    pad_f = [55, 65.4, 82.4] if not kids else [65.4, 82.4, 98]
    env = np.minimum(1, x / 2) * np.minimum(1, (DURATION - x) / 1.5)
    pad = sum(np.sin(2 * np.pi * f * x + k) for k, f in enumerate(pad_f)) * env * 0.07
    out += pad.astype(np.float32)
    # orage au début
    add(rng.normal(0, 1, int(2.5 * sr)) * np.exp(-tt(2.5) * 1.2) * 0.12, 0.3)
    beat = 0.5  # 120 BPM
    for k in range(int(DURATION / (beat / 2))):
        tb = k * beat / 2
        step = k % 8
        if tb >= S2[0] + 1.0 and tb < DURATION - 1:
            if step in (0, 3, 4):
                add(kick(0.8), tb)
            if step in (2, 6):
                add(snare(0.35), tb)
            add(hat(0.08 if step % 2 else 0.12), tb)
        elif tb < S2[0] + 1.0 and step == 0:
            add(kick(0.5), tb)
    riser(S2[0] + 0.1, 0.9, 200, 900, 0.1)
    for h in HIT_T[:2]:
        add(whoosh(0.2, 0.35), h - 0.2)
        add(punch(1.1), h)
    add(whoosh(0.35, 0.5), HIT_T[2] - 0.35)
    add(punch(1.6, 50), HIT_T[2])
    add(punch(1.5, 40), SLAM_T)
    for s in (S2[0], S3[0], S4[0], S5[0]):
        add(kick(0.9), s)
    out = out / (np.max(np.abs(out)) + 1e-6) * 0.9
    fade = int(0.8 * sr)
    out[-fade:] *= np.linspace(1, 0, fade)
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(np.stack([pcm, pcm], axis=1).tobytes())


def render(cfg, only=None):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    out = os.path.join(HERE, cfg["out"])
    wav = out + ".wav"
    make_audio(wav, cfg is KIDS)
    bgs = make_backgrounds()
    total = int(DURATION * FPS)
    if only is not None:   # aperçu d'images fixes
        for s in only:
            frame(s, int(s * FPS), bgs, cfg).save(os.path.join(HERE, f"_preview_{cfg['out'][:-4]}_{s:05.2f}.png"))
        os.remove(wav)
        return
    proc = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
         "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", out],
        stdin=subprocess.PIPE)
    for i in range(total):
        proc.stdin.write(frame(i / FPS, i, bgs, cfg).tobytes())
        if i % 150 == 0:
            print(cfg["out"], f"{i}/{total}", flush=True)
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", out)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    preview = [float(x) for x in sys.argv[2:]] or None
    for name, cfg in (("kids", KIDS), ("adults", ADULTS)):
        if which in (name, "all"):
            render(cfg, preview)
