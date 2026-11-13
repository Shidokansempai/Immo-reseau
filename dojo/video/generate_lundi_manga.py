"""Vidéo « vrai manga » — Kickboxing du LUNDI, ados & adultes.

Planches manga N&B (illustrations générées avec Canva, dossier manga/),
animées façon anime-comic : zooms, découpes de cases en diagonale,
tremblements d'impact, onomatopées, cartouches, page finale multi-cases.

Usage :  python3 generate_lundi_manga.py [t1 t2 ...]   (temps = aperçus PNG)
"""
import math
import os
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageOps

from generate_lundi_kickboxing import (F_ANTON, F_BEBAS, INK, WHITE, burst, clamp,
                                       ease_back, ease_io, ease_out, fit, font,
                                       prog, speed_lines, text, _alpha)

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
DURATION = 22.0
RED = (214, 18, 38)
PAPER = (246, 243, 234)
OUT = os.path.join(HERE, "lundi-kickboxing-manga-ados-adultes.mp4")

IMG = {k: Image.open(os.path.join(HERE, "manga", k + ".png")).convert("RGBA")
       for k in ("regard", "direct", "highkick", "groupe")}

# scènes : (début, fin)
SC = {"regard": (0.0, 3.6), "direct": (3.6, 7.8), "highkick": (7.8, 12.4),
      "groupe": (12.4, 16.6), "page": (16.6, DURATION)}
HITS = [4.35, 5.25, 9.0, 13.0, 17.2]   # impacts (tremblement + son)


def cam(img, z, cx=0.5, cy=0.5):
    """Recadrage caméra : zoom z (>=1), centre (cx, cy) en fraction."""
    w, h = W / z, H / z
    x0 = min(max(cx * W - w / 2, 0), W - w)
    y0 = min(max(cy * H - h / 2, 0), H - h)
    return img.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + w, y0 + h))


def bubble(img, lines, cx, cy, p, size=78, dark=False, tail=None):
    """Bulle / cartouche manga : rectangle papier, trait encré épais."""
    if p <= 0:
        return
    fs = [fit(F_ANTON, size, ln, 880) for ln in lines]
    lh = max(f.size for f in fs) * 1.18
    bw = max(f.getlength(ln) for f, ln in zip(fs, lines)) + 80
    bh = lh * len(lines) + 46
    s = ease_back(clamp(p * 2.2))
    w2, h2 = bw * s / 2, bh * s / 2
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    bg, fg = (INK, WHITE) if dark else (PAPER, INK)
    if tail:
        d.polygon([(cx - 40, cy + h2 - 4), (cx + 30, cy + h2 - 4), tail], fill=INK + (255,))
        d.polygon([(cx - 28, cy + h2 - 10), (cx + 18, cy + h2 - 10),
                   (tail[0] + (cx - tail[0]) * 0.12, tail[1] - 16)], fill=bg + (255,))
    d.rectangle((cx - w2, cy - h2, cx + w2, cy + h2), fill=bg + (255,), outline=INK + (255,), width=8)
    img.alpha_composite(lay)
    if s > 0.6:
        for i, (ln, f) in enumerate(zip(lines, fs)):
            text(img, ln, f, cx, cy - lh * len(lines) / 2 + lh * (i + 0.5), fg, clamp((s - 0.6) * 3))


def sfx(img, s, cx, cy, t0, t, size=230, angle=-8, fill=WHITE, hold=1.0, maxw=900):
    """Onomatopée manga : grosse, inclinée, contour noir épais, qui « claque »."""
    al = clamp((t - t0) / 0.04) * (1 - clamp((t - t0 - hold) / 0.25))
    if al <= 0:
        return
    f = fit(F_ANTON, size, s, maxw)
    sc = 1 + 0.8 * (1 - ease_back(prog(t, t0, 0.3)))
    jit = math.sin(t * 90) * 4 * (1 - prog(t, t0, 0.4))
    text(img, s, f, cx + jit, cy, fill, al, scale=sc, angle=angle, stroke=14)


def cut_mask(p, angle_deg=-14, from_right=False):
    """Masque de découpe en diagonale (révélation d'une nouvelle case)."""
    m = Image.new("L", (W, H), 0)
    if p <= 0:
        return m, None
    d = ImageDraw.Draw(m)
    slope = math.tan(math.radians(angle_deg)) * W
    y = H + abs(slope) - (H + 2 * abs(slope)) * ease_io(p)  # ligne qui monte
    poly = [(0, y), (W, y + slope), (W, H), (0, H)]
    d.polygon(poly, fill=255)
    return m, ((0, y), (W, y + slope))


def compose_transition(prev, nxt, p):
    m, line = cut_mask(p)
    out = prev.copy()
    out.paste(nxt, (0, 0), m)
    if line and 0 < p < 1:
        d = ImageDraw.Draw(out)
        d.line(line, fill=PAPER + (255,), width=26)  # gouttière blanche
        d.line(((line[0][0], line[0][1] - 13), (line[1][0], line[1][1] - 13)), fill=INK + (255,), width=6)
        d.line(((line[0][0], line[0][1] + 13), (line[1][0], line[1][1] + 13)), fill=INK + (255,), width=6)
    return out


# ------------------------------------------------------------------ scènes
def s_regard(t):
    a, _ = SC["regard"]
    z = 1.0 + 0.22 * ease_out(prog(t, 0, 3.6))
    img = cam(IMG["regard"], z, 0.5, 0.42)
    # lignes de concentration qui pulsent
    speed_lines(img, W / 2, 820, int(t * 10), 0.35 + 0.2 * math.sin(t * 8), n=60, r0=560)
    bubble(img, ["LUNDI SOIR..."], W / 2, 250, prog(t, 0.5, 0.5), 92)
    bubble(img, ["TU VAS TOUT DONNER."], W / 2, 1650, prog(t, 1.6, 0.5), 84, dark=True)
    return img


def s_direct(t):
    a, b = SC["direct"]
    h1, h2 = HITS[0], HITS[1]
    z = 1.0 + 0.08 * ease_out(prog(t, a, 0.7))
    z += 0.18 * ease_out(prog(t, h1, 0.12)) * (1 - 0.5 * prog(t, h1 + 0.12, 0.5))
    z += 0.14 * ease_out(prog(t, h2, 0.12))
    img = cam(IMG["direct"], z, 0.42, 0.62)
    sfx(img, "DOM !", 760, 330, h1, t, 250, angle=10, hold=0.8)
    sfx(img, "BAKOOM !", W / 2, 1250, h2, t, 230, angle=-7, fill=RED, hold=1.6)
    bubble(img, ["JAB · CROSS"], W / 2, 1700, prog(t, a + 0.3, 0.5), 96)
    return img


def s_highkick(t):
    a, b = SC["highkick"]
    h = HITS[2]
    # travelling : du pied d'appui vers l'impact sur le sac
    k = ease_io(prog(t, a, 1.1))
    z = 1.35 - 0.1 * k
    cy = 0.78 - 0.5 * k
    cx = 0.45 + 0.3 * k
    if t > h:
        z += 0.12 * ease_out(prog(t, h, 0.1)) * (1 - 0.6 * prog(t, h + 0.1, 0.6))
    img = cam(IMG["highkick"], z, cx, cy)
    if t > h - 0.05:
        speed_lines(img, 820, 420, int(t * 15), 0.8 * (1 - prog(t, h + 0.6, 0.6)), n=90, r0=260, color=INK)
    sfx(img, "BAAAM !", W / 2, 1380, h, t, 240, angle=-10, hold=2.6, maxw=900)
    bubble(img, ["HIGH KICK"], 300, 1730, prog(t, a + 0.3, 0.5), 92, dark=True)
    if 0 <= t - h < 0.1:   # flash négatif
        img = ImageOps.invert(img.convert("RGB")).convert("RGBA")
    return img


def s_groupe(t):
    a, b = SC["groupe"]
    z = 1.25 - 0.25 * ease_out(prog(t, a, 3.0))
    img = cam(IMG["groupe"], z, 0.5, 0.5)
    img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, int(70 * prog(t, a + 0.4, 0.6)))))
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    p = ease_out(prog(t, a + 0.4, 0.35))
    d.polygon([(0, 150), (W * p, 110), (W * p, 470), (0, 510)], fill=PAPER + (255,))
    d.line([(0, 150), (W * p, 110)], fill=INK + (255,), width=10)
    d.line([(0, 510), (W * p, 470)], fill=INK + (255,), width=10)
    img.alpha_composite(lay)
    text(img, "KICKBOXING", fit(F_ANTON, 200, "KICKBOXING", 980), W / 2, 300, INK,
         clamp(p * 2 - 1), angle=2, scale=1 + 0.3 * (1 - ease_back(prog(t, a + 0.6, 0.4))))
    bubble(img, ["ADOS & ADULTES"], W / 2, 600, prog(t, a + 0.9, 0.5), 96, dark=True)
    for i, w in enumerate(["CARDIO", "TECHNIQUE", "MENTAL D'ACIER"]):
        st = a + 1.6 + i * 0.45
        sfx(img, w, W / 2, 1310 + i * 185, st, t, 120, angle=-4 + 4 * i,
            fill=RED if i == 2 else WHITE, hold=99, maxw=900)
    return img


PAGE_PANELS = [  # (image, polygone de case, centre recadrage) — page finale
    ("regard", [(40, 40), (1040, 40), (1040, 470), (40, 560)], (0.5, 0.5)),
    ("direct", [(40, 600), (560, 512), (560, 1010), (40, 1060)], (0.4, 0.5)),
    ("highkick", [(600, 505), (1040, 430), (1040, 980), (600, 1010)], (0.5, 0.45)),
]


def s_page(t):
    a, b = SC["page"]
    img = Image.new("RGBA", (W, H), PAPER + (255,))
    for k, (name, poly, (cx, cy)) in enumerate(PAGE_PANELS):
        p = ease_out(prog(t, a + 0.1 + k * 0.18, 0.35))
        if p <= 0:
            continue
        xs, ys = [q[0] for q in poly], [q[1] for q in poly]
        bw, bh = max(xs) - min(xs), max(ys) - min(ys)
        src = IMG[name]
        z = max(W / bw, H / bh) ** -1
        crop_w, crop_h = bw / (bw / W * 1.0), bh / (bw / W)
        # recadre la planche pour remplir la case
        scale = max(bw / W, bh / H) * 1.12
        tw, th = int(W * scale), int(H * scale)
        big = src.resize((tw, th), Image.BICUBIC)
        ox = int(min(max(cx * tw - bw / 2, 0), tw - bw))
        oy = int(min(max(cy * th - bh / 2, 0), th - bh))
        tile = big.crop((ox, oy, ox + bw, oy + bh))
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).polygon(poly, fill=int(255 * p))
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        layer.paste(tile, (min(xs), min(ys)))
        img.paste(layer, (0, 0), m)
        ImageDraw.Draw(img).line(poly + [poly[0]], fill=INK + (int(255 * p),), width=8)
    # grande case du bas : texte
    p = ease_out(prog(t, a + 0.6, 0.3))
    lower = [(40, 1100), (1040, 1020), (1040, 1880), (40, 1880)]
    if p > 0:
        ImageDraw.Draw(img).polygon(lower, fill=INK + (255,))
        speed_lines(img, W / 2, 1420, int(t * 10), 0.5, n=70, r0=300, color=(90, 90, 96))
        ImageDraw.Draw(img).line(lower + [lower[0]], fill=INK + (255,), width=8)
    burst(img, W / 2, 1330, 260, prog(t, HITS[4], 0.4), 9, RED, 1.0)
    sfx(img, "LUNDI", W / 2, 1320, HITS[4], t, 260, angle=-5, hold=99, maxw=900)
    p2 = ease_back(prog(t, a + 1.4, 0.45))
    if p2 > 0:
        lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        bw = 470 * clamp(p2)
        d.rectangle((W / 2 - bw, 1500, W / 2 + bw, 1630), fill=RED + (255,), outline=WHITE + (255,), width=6)
        img.alpha_composite(lay)
        text(img, "RÉSERVE TON COURS D'ESSAI", fit(F_ANTON, 74, "RÉSERVE TON COURS D'ESSAI", 860),
             W / 2, 1565, WHITE, clamp(p2))
    text(img, "Infos & inscriptions en message privé", font(F_BEBAS, 62), W / 2, 1700, WHITE,
         ease_out(prog(t, a + 2.0, 0.4)), tracking=2)
    text(img, "FIGHTER ACADEMY KARATÉ · LE TAMPON", fit(F_BEBAS, 64, "FIGHTER ACADEMY KARATÉ · LE TAMPON", 900),
         W / 2, 1800, (255, 206, 32), ease_out(prog(t, a + 2.3, 0.4)), tracking=5)
    sfx(img, "OSU !", 880, 1120, a + 2.8, t, 96, angle=10, hold=99, maxw=400)
    return img


ORDER = ["regard", "direct", "highkick", "groupe", "page"]
FN = {"regard": s_regard, "direct": s_direct, "highkick": s_highkick, "groupe": s_groupe, "page": s_page}
TR = 0.32  # durée de la découpe de case


def frame(t):
    cur = next(k for k in ORDER if SC[k][0] <= t < SC[k][1] or k == "page")
    img = FN[cur](t)
    i = ORDER.index(cur)
    if i > 0 and t - SC[cur][0] < TR:      # découpe diagonale depuis la case précédente
        prev = FN[ORDER[i - 1]](SC[cur][0] - 0.001)
        img = compose_transition(prev, img, (t - SC[cur][0]) / TR)
    # tremblement d'impact
    amp = max([(1 - (t - h) / 0.3) * 30 for h in HITS if 0 <= t - h < 0.3] + [0])
    if amp > 1:
        out = Image.new("RGBA", img.size, INK + (255,))
        out.paste(img, (int(math.sin(t * 157) * amp), int(math.cos(t * 131) * amp)))
        img = out
    for h in HITS[:2]:
        if 0 <= t - h < 0.06:
            img.alpha_composite(Image.new("RGBA", img.size, (255, 255, 255, 140)))
    # cadre de page
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W - 1, H - 1), outline=PAPER + (255,), width=18)
    d.rectangle((18, 18, W - 19, H - 19), outline=INK + (255,), width=6)
    if t < 0.25:
        img.alpha_composite(Image.new("RGBA", img.size, (255, 255, 255, int(255 * (1 - t / 0.25)))))
    if t > DURATION - 0.6:
        img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, int(255 * clamp((t - DURATION + 0.6) / 0.6)))))
    return img.convert("RGB")


# ------------------------------------------------------------------ audio
def make_audio(path, sr=44100):
    n = int(DURATION * sr)
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(11)

    def tt(d):
        return np.arange(int(d * sr)) / sr

    def add(sig, start, g=1.0):
        a = int(start * sr)
        b = min(n, a + len(sig))
        if 0 <= a < n:
            out[a:b] += sig[: b - a] * g

    def kick(amp=1.0):
        x = tt(0.45)
        return amp * np.sin(2 * np.pi * np.cumsum(45 + 130 * np.exp(-x * 30)) / sr) * np.exp(-x * 7)

    def snare(amp=0.4):
        x = tt(0.22)
        return amp * rng.normal(0, 1, len(x)) * np.exp(-x * 20)

    def hat(amp=0.1):
        x = tt(0.05)
        return amp * rng.normal(0, 1, len(x)) * np.exp(-x * 90)

    def punch(amp=1.0, low=60):
        x = tt(0.7)
        body = np.sin(2 * np.pi * np.cumsum(low + 220 * np.exp(-x * 40)) / sr) * np.exp(-x * 8)
        return amp * (body + 0.8 * rng.normal(0, 1, len(x)) * np.exp(-x * 40))

    def whoosh(d=0.3, amp=0.5):
        x = tt(d)
        sm = np.convolve(rng.normal(0, 1, len(x)), np.ones(25) / 25, mode="same")
        return amp * 3 * sm * np.sin(np.pi * x / d) ** 2

    def stab(f, d=1.2, amp=0.25):   # accord « shamisen / anime » percussif
        x = tt(d)
        sig = sum(np.sign(np.sin(2 * np.pi * f * m * x)) * 0.3 / m for m in (1, 1.5, 2))
        return amp * sig * np.exp(-x * 4)

    x = tt(DURATION)
    env = np.minimum(1, x / 1.5) * np.minimum(1, (DURATION - x) / 1.2)
    out += (np.sin(2 * np.pi * 55 * x) + 0.5 * np.sin(2 * np.pi * 82.4 * x)).astype(np.float32) * env * 0.08
    beat = 60 / 128
    for k in range(int(DURATION / (beat / 2))):
        tb = k * beat / 2
        st = k % 8
        if 3.6 <= tb < DURATION - 1:
            if st in (0, 3, 4):
                add(kick(0.75), tb)
            if st in (2, 6):
                add(snare(0.35), tb)
            add(hat(0.07 if st % 2 else 0.11), tb)
        elif tb < 3.6 and st == 0:
            add(kick(0.55), tb)
    for i, s in enumerate((0.05, 3.6, 7.8, 12.4, 16.6)):
        add(stab([110, 98, 123, 110, 82.4][i]), s)
        if s > 0:
            add(whoosh(0.3, 0.4), s - 0.25)
    for h in HITS:
        add(whoosh(0.2, 0.35), h - 0.2)
        add(punch(1.5 if h in (HITS[2], HITS[4]) else 1.1), h)
    out = out / (np.max(np.abs(out)) + 1e-6) * 0.9
    f = int(0.8 * sr)
    out[-f:] *= np.linspace(1, 0, f)
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())


def main():
    if len(sys.argv) > 1:
        for s in map(float, sys.argv[1:]):
            frame(s).save(os.path.join(HERE, f"_preview_manga_{s:05.2f}.png"))
        return
    wav = OUT + ".wav"
    make_audio(wav)
    proc = subprocess.Popen(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", OUT],
        stdin=subprocess.PIPE)
    total = int(DURATION * FPS)
    for i in range(total):
        proc.stdin.write(frame(i / FPS).tobytes())
        if i % 150 == 0:
            print(f"{i}/{total}", flush=True)
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
