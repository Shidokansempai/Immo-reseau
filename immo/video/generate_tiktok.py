"""Version TikTok « nerveuse » — Exclusivité La Rivière Saint-Louis.

~25 s, 1080x1920, plein écran, coupes calées sur le tempo (128 BPM),
zooms « punch », flashs, gros textes façon TikTok et bande-son house
synthétisée (libre de droits).

Usage :  python3 generate_tiktok.py
"""
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generate_video as g
from generate_video import DARK, F_SANS, GREEN, H, W, WHITE, clamp, ease_out, prog

FPS = 30
BPM = 128
BEAT = 60 / BPM
OUT = os.path.join(g.HERE, "exclusivite-riviere-saint-louis-tiktok.mp4")
BLACK = (10, 10, 10)
TEXT_Y = 760          # bloc texte : hors des icônes TikTok (droite) et de la légende (bas)
MAX_W = 860


# ---------------------------------------------------------------- texte TikTok
def tk_text(img, s, size, cy, fill=WHITE, alpha=1.0, pop=1.0, stroke=10, path=F_SANS,
            weight="Black", box=None, cx=W / 2 - 40):
    """Texte gras avec contour noir (ou bandeau coloré si `box`), animation « pop »."""
    if alpha <= 0.01:
        return
    size = int(size * pop)
    while True:
        f = g.font(path, size, weight)
        tw = f.getlength(s)
        if tw <= MAX_W * pop or size < 20:
            break
        size -= 2
    asc, desc = f.getmetrics()
    pad = 30 + stroke
    lw, lh = int(tw) + 2 * pad, asc + desc + 2 * pad
    layer = Image.new("RGBA", (lw, lh), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if box:
        d.rounded_rectangle((pad - 26, pad - 6, lw - pad + 26, lh - pad + 10), 18, fill=box + (255,))
        d.text((pad, pad), s, font=f, fill=fill + (255,))
    else:
        d.text((pad, pad), s, font=f, fill=fill + (255,), stroke_width=stroke,
               stroke_fill=BLACK + (255,))
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    img.alpha_composite(layer, (int(cx - lw / 2), int(cy - lh / 2)))


def pop_in(t, start=0.0, dur=0.14):
    """Échelle 1.35 → 1.0 très rapide (effet « pop »)."""
    p = ease_out(prog(t, start, dur))
    return (1.35 - 0.35 * p), (1.0 if t >= start else 0.0)


# ---------------------------------------------------------------- image
def full(src, t, d, px=0.5, py=0.5, drift=0.06, shake=True, base=1.0):
    """Plein écran : zoom « punch » à l'entrée puis lente dérive, petit tremblement."""
    punch = 0.16 * (1 - ease_out(prog(t, 0, 0.28)))
    z = base + punch + drift * clamp(t / d)
    sw, sh = src.size
    tgt = W / H
    if sw / sh > tgt:
        ch = sh / z
        cw = ch * tgt
    else:
        cw = sw / z
        ch = cw / tgt
    x0 = (sw - cw) * px
    y0 = (sh - ch) * py
    if shake and t < 0.18:
        k = (0.18 - t) / 0.18
        x0 += math.sin(t * 160) * 6 * k
        y0 += math.cos(t * 130) * 6 * k
    x0 = clamp(x0, 0, sw - cw)
    y0 = clamp(y0, 0, sh - ch)
    im = src.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    img = im.convert("RGBA")
    img.alpha_composite(VIGNETTE)
    return img


def flash(img, t, dur=0.12, strength=0.55):
    a = strength * (1 - clamp(t / dur))
    if a > 0.01:
        img.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(255 * a))))


def make_vignette():
    """Assombrit légèrement le haut et la zone texte pour la lisibilité."""
    a = np.zeros((H, W), dtype=np.float32)
    y = np.arange(H)[:, None]
    a += 120 * np.clip(1 - y / 300, 0, 1)
    a += 70 * np.exp(-((y - TEXT_Y) / 330) ** 2)
    a += 150 * np.clip((y - 1450) / 470, 0, 1)
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


VIGNETTE = None
P = {}


# ---------------------------------------------------------------- scènes
def photo(key, lines, px=0.5, py=0.5, small=None, zoom=1.0):
    """Scène photo + 1 ou 2 lignes de texte qui « poppent »."""
    def f(t, d):
        img = full(P[key], t, d, px, py, base=zoom)
        for k, (s, size, style) in enumerate(lines):
            sc, al = pop_in(t, 0.04 + 0.16 * k)
            y = TEXT_Y + k * (size + 30) - (len(lines) - 1) * 50
            if style == "box":
                tk_text(img, s, size, y, DARK, al, sc, box=GREEN)
            else:
                tk_text(img, s, size, y, WHITE if style == "w" else GREEN, al, sc)
        if small:
            tk_text(img, small, 40, TEXT_Y + 210, WHITE, ease_out(prog(t, 0.3, 0.2)), stroke=6,
                    weight="ExtraBold")
        flash(img, t)
        return img
    return f


def sc_hook(t, d):
    img = full(P["facade"], t, d, 0.55, 0.45, drift=0.1)
    sc, al = pop_in(t, 0.0)
    tk_text(img, "435 000 €", 150, TEXT_Y - 120, WHITE, al, sc, stroke=12)
    sc, al = pop_in(t, BEAT)
    tk_text(img, "À LA RÉUNION", 76, TEXT_Y + 40, DARK, al, sc, box=GREEN)
    sc, al = pop_in(t, 2 * BEAT)
    tk_text(img, "VOILÀ CE QUE T'AS", 66, TEXT_Y + 175, WHITE, al, sc, stroke=9)
    flash(img, t, strength=0.8)
    return img


def sc_cinq(t, d):
    img = Image.new("RGBA", (W, H), DARK + (255,))
    # mosaïque des chambres en fond, floutée
    bg = full(P["05-chambre-fleurie"], t, d, 0.5, 0.5, shake=False).filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(bg)
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (170,)))
    sc, al = pop_in(t, 0.0)
    tk_text(img, "5", 420, TEXT_Y - 40, GREEN, al, sc, stroke=14)
    sc, al = pop_in(t, BEAT * 0.75)
    tk_text(img, "CHAMBRES", 110, TEXT_Y + 210, WHITE, al, sc)
    sc, al = pop_in(t, BEAT * 1.5)
    tk_text(img, "À L'ÉTAGE", 70, TEXT_Y + 340, DARK, al, sc, box=GREEN)
    flash(img, t, strength=0.7)
    return img


def sc_suspense(t, d):
    """Carte de suspense avant le prix (pendant la montée musicale)."""
    img = full(P["facade"], t, d, 0.5, 0.3, drift=0.15, shake=False).filter(ImageFilter.GaussianBlur(12))
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (190,)))
    sc, al = pop_in(t, 0.0)
    tk_text(img, "ET LE PRIX ?", 120, TEXT_Y - 60, WHITE, al, sc)
    sc, al = pop_in(t, BEAT)
    tk_text(img, "DEVINE EN COMMENTAIRE", 62, TEXT_Y + 100, DARK, al, sc, box=GREEN)
    # compte à rebours 3-2-1 sur les derniers temps
    for k, s in enumerate(["3", "2", "1"]):
        st = d - (3 - k) * BEAT * 0.5
        if st <= t < st + BEAT * 0.5:
            sc, al = pop_in(t, st, 0.1)
            tk_text(img, s, 240, TEXT_Y + 360, GREEN, al, sc, stroke=12)
    flash(img, t, strength=0.6)
    return img


def sc_prix(t, d):
    img = full(P["facade"], t, d, 0.4, 0.6, drift=0.12, shake=False).filter(ImageFilter.GaussianBlur(5))
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (150,)))
    sc, al = pop_in(t, 0.0, 0.18)
    tk_text(img, "EXCLU IMMO RÉSEAU", 52, TEXT_Y - 190, DARK, al, sc, box=GREEN)
    sc, al = pop_in(t, BEAT, 0.18)
    tk_text(img, "435 000 €", 170, TEXT_Y, WHITE, al, sc, stroke=12)
    sc, al = pop_in(t, BEAT * 2)
    tk_text(img, "HAI · RIVIÈRE SAINT-LOUIS", 44, TEXT_Y + 150, WHITE, al, sc, stroke=6,
            weight="ExtraBold")
    flash(img, t, strength=0.9, dur=0.2)
    return img


def sc_outro(t, d):
    img = Image.new("RGBA", (W, H), DARK + (255,))
    bg = full(P["facade"], t, d, 0.5, 0.4, drift=0.05, shake=False).filter(ImageFilter.GaussianBlur(14))
    img.alpha_composite(bg)
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (200,)))
    sc, al = pop_in(t, 0.0)
    tk_text(img, "TU LA VEUX ?", 120, TEXT_Y - 220, WHITE, al, sc)
    sc, al = pop_in(t, BEAT)
    puls = 1 + 0.05 * math.sin(2 * math.pi * max(0, t - BEAT) / BEAT)
    tk_text(img, "Commente « CLÉS »", 70, TEXT_Y - 40, DARK, al, sc * puls, box=GREEN)
    sc, al = pop_in(t, BEAT * 2)
    tk_text(img, "Visite privée sur rendez-vous", 46, TEXT_Y + 100, WHITE, al, sc, stroke=6,
            weight="ExtraBold")
    # logo
    a = ease_out(prog(t, BEAT * 2.5, 0.3))
    if a > 0:
        logo = P["logo"]
        lw = 640
        lh = int(lw * logo.height / logo.width)
        lg = logo.resize((lw, lh), Image.LANCZOS).convert("RGBA")
        m = Image.new("L", (lw, lh), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, lw - 1, lh - 1), 30, fill=int(255 * a))
        lg.putalpha(m)
        img.alpha_composite(lg, (int(W / 2 - 40 - lw / 2), int(TEXT_Y + 230 + (1 - a) * 40)))
        tk_text(img, "Honoraires et DPE : nous consulter", 26, TEXT_Y + 270 + lh, (170, 180, 175),
                a, stroke=0, weight="Regular")
    flash(img, t, strength=0.6)
    return img


# (fonction, durée en temps)
SCENES = [
    (sc_hook, 4),
    (photo("02-sejour", [("CET ESCALIER ?!", 92, "w")], px=0.2), 4),
    (photo("02-sejour", [("SALON", 96, "w"), ("XXL", 110, "box")], px=0.95, zoom=1.05), 2),
    (photo("06-cuisine", [("CUISINE", 96, "w"), ("DE CHEF", 96, "box")], px=0.45), 3),
    (photo("06-cuisine", [("OUVERTE SUR", 84, "w"), ("LE JARDIN", 96, "box")], px=1.0, zoom=1.05), 2),
    (photo("04-suite-parentale", [("RÉVEIL", 92, "w"), ("VUE MONTAGNE", 84, "box")], px=0.3,
           small="chambre 1/5"), 3),
    (photo("04-suite-parentale", [("DOUCHE", 96, "w"), ("DANS LA SUITE", 84, "box")], px=1.0,
           zoom=1.05), 2),
    (photo("05-chambre-fleurie", [("CHAMBRE 2", 92, "w")], px=0.5), 2),
    (photo("03-chambre-bureau", [("CHAMBRE 3", 92, "w")], px=0.6), 2),
    (sc_cinq, 4),
    (photo("07-salle-eau", [("PIERRE", 96, "w"), ("NATURELLE", 96, "box")], px=0.55), 2),
    (photo("08-douche-italienne", [("DOUCHE", 96, "w"), ("DE SPA", 96, "box")], px=0.5), 3),
    (photo("facade", [("JACUZZI", 96, "w"), ("ENCASTRÉ", 96, "box")], px=0.5, py=0.8), 3),
    (photo("facade", [("SOUS LES", 90, "w"), ("PALMIERS", 96, "box")], px=0.5, py=0.15, zoom=1.08), 2),
    (sc_suspense, 4),
    (sc_prix, 4),
    (sc_outro, 8),
]


def timeline():
    starts, b = [], 0
    for _, beats in SCENES:
        starts.append(b * BEAT)
        b += beats
    return starts, b * BEAT


def frame(t, starts):
    for (fn, beats), s in zip(SCENES, starts):
        d = beats * BEAT
        if s <= t < s + d:
            return fn(t - s, d).convert("RGB")
    fn, beats = SCENES[-1]
    return fn(beats * BEAT - 1e-3, beats * BEAT).convert("RGB")


# ---------------------------------------------------------------- audio
def make_audio(path, starts, dur, sr=44100):
    """House 128 BPM : kick 4/4, clap, hats, basse, accords ; whoosh et impacts sur les coupes."""
    n = int(dur * sr)
    out = np.zeros(n)
    rng = np.random.default_rng(3)

    def hz(m):
        return 440 * 2 ** ((m - 69) / 12)

    def add(sig, start, gain=1.0):
        i = int(start * sr)
        if i >= n or i < 0:
            return
        j = min(n, i + len(sig))
        out[i:j] += sig[: j - i] * gain

    def env_t(sec):
        return np.arange(int(sec * sr)) / sr

    nb = int(dur / BEAT) + 1
    price_start = starts[-2]
    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]]  # Am7 F C G
    roots = [45, 41, 36, 43]
    for k in range(nb):
        st = k * BEAT
        bar_i = (k // 4) % 4
        drop = abs(st - price_start) < 1e-6 or (price_start - BEAT * 2 <= st < price_start)
        # kick (coupé 2 temps avant le prix pour l'effet « drop »)
        if not drop:
            x = env_t(0.3)
            f = 45 + 90 * np.exp(-x * 35)
            add(np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-x * 10), st, 0.55)
        # clap sur 2 et 4
        if k % 2 == 1 and not drop:
            x = env_t(0.18)
            add(rng.standard_normal(len(x)) * np.exp(-x * 25), st, 0.12)
        # hats en contretemps
        x = env_t(0.05)
        hat = np.diff(rng.standard_normal(len(x)), prepend=0) * np.exp(-x * 80)
        add(hat, st + BEAT / 2, 0.09)
        add(hat, st, 0.03)
        # basse en contretemps
        if not drop:
            x = env_t(BEAT * 0.45)
            b = np.sin(2 * np.pi * hz(roots[bar_i]) * x)
            b = np.tanh(b * 2.5) * np.exp(-x * 4) * np.minimum(1, x / 0.005)
            add(b, st + BEAT / 2, 0.2)
        # stabs d'accords
        if k % 4 in (0, 2):
            x = env_t(BEAT * 0.8)
            ch = sum(np.sign(np.sin(2 * np.pi * hz(m) * x)) * 0.5 + np.sin(2 * np.pi * hz(m) * x)
                     for m in chords[bar_i])
            add(ch * np.exp(-x * 6) * np.minimum(1, x / 0.004), st + (BEAT * 0.5 if k % 4 == 2 else 0),
                0.022)
    # whoosh + impact sur chaque coupe
    for s in starts[1:]:
        x = env_t(0.35)
        noise = rng.standard_normal(len(x))
        sweep = np.cumsum(noise) / 60
        w = (noise - sweep) * np.sin(np.pi * x / 0.35) ** 2
        add(w, s - 0.25, 0.05)
        x = env_t(0.4)
        add(np.sin(2 * np.pi * (40 + 40 * np.exp(-x * 20)) * x) * np.exp(-x * 7), s, 0.25)
    # montée avant le prix + gros impact
    x = env_t(BEAT * 2)
    riser = rng.standard_normal(len(x)) * (x / x[-1]) ** 2
    add(riser, price_start - BEAT * 2, 0.12)
    x = env_t(1.2)
    add(np.sin(2 * np.pi * (30 + 60 * np.exp(-x * 10)) * x) * np.exp(-x * 3), price_start, 0.7)
    # fondu de fin
    tt = np.arange(n) / sr
    out *= np.clip((dur - tt) / 1.0, 0, 1)
    out = np.tanh(out * 1.4)
    out *= 0.8 / max(1e-9, np.abs(out).max())
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((out * 32767).astype(np.int16).tobytes())


def main():
    global VIGNETTE
    g.setup()
    P.update(g.PHOTOS)
    P["facade"] = g.FACADE
    VIGNETTE = make_vignette()
    starts, total = timeline()
    wav = os.path.join(g.HERE, "_audio_tiktok.wav")
    make_audio(wav, starts, total)
    proc = subprocess.Popen(
        [g.ffmpeg_exe(), "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT],
        stdin=subprocess.PIPE)
    nframes = int(total * FPS)
    for i in range(nframes):
        proc.stdin.write(frame(i / FPS, starts).tobytes())
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", OUT, f"({total:.1f} s)")


if __name__ == "__main__":
    main()
