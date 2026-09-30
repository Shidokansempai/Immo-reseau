"""Vidéo de présentation — Fighter Academy Karaté (Le Tampon, La Réunion).

Génère une vidéo verticale 1080x1920 (Reels / TikTok / Shorts / Stories)
avec motion design et bande-son percussive synthétisée.

Usage :  python3 generate_video.py
Dépendances : pip install pillow numpy imageio imageio-ffmpeg
"""
import math
import os
import subprocess
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
BPM = 96
BEAT = 60.0 / BPM
OUT = os.path.join(HERE, "fighter-academy-presentation.mp4")

RED = (200, 16, 30)
GOLD = (212, 175, 90)
WHITE = (245, 242, 235)
GREY = (150, 150, 150)

F_ANTON = os.path.join(HERE, "fonts", "Anton-Regular.ttf")
F_BEBAS = os.path.join(HERE, "fonts", "BebasNeue-Regular.ttf")
_font_cache = {}


def font(path, size):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_back(x):
    x = clamp(x)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def prog(t, start, dur):
    return clamp((t - start) / dur)


# ---------------------------------------------------------------- drawing
def text(img, s, fnt, cx, cy, fill, alpha=1.0, dx=0, scale=1.0, tracking=0):
    """Texte centré en (cx, cy) avec alpha, décalage horizontal et échelle."""
    if alpha <= 0:
        return
    if scale != 1.0:
        fnt = font(fnt.path, max(4, int(fnt.size * scale)))
    chars = list(s)
    widths = [fnt.getlength(c) for c in chars]
    total = sum(widths) + tracking * (len(chars) - 1)
    asc, desc = fnt.getmetrics()
    layer = Image.new("RGBA", (int(total) + 40, asc + desc + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = 20
    for c, w in zip(chars, widths):
        d.text((x, 20), c, font=fnt, fill=fill + (int(255 * alpha),))
        x += w + tracking
    img.alpha_composite(layer, (int(cx - layer.width / 2 + dx), int(cy - layer.height / 2)))


def make_background():
    """Fond noir texturé avec halo rouge — calculé une seule fois."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt((xx - W / 2) ** 2 + ((yy - H * 0.42) / 1.25) ** 2) / (W * 0.95)
    glow = np.clip(1 - r, 0, 1) ** 2.2
    base = np.zeros((H, W, 3), np.float32) + 8
    base[..., 0] += glow * 70
    base[..., 1] += glow * 6
    base[..., 2] += glow * 10
    rng = np.random.default_rng(7)
    base += rng.normal(0, 5, (H, W, 1))
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")


GRAIN = [
    Image.fromarray(
        np.random.default_rng(i).integers(0, 22, (H // 4, W // 4), dtype=np.uint8)
    ).resize((W, H)).convert("L")
    for i in range(6)
]


def enso(img, cx, cy, radius, p, width=26, color=RED, alpha=1.0):
    """Cercle zen (ensō) qui se trace progressivement."""
    if p <= 0 or alpha <= 0:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    end = -80 + 330 * ease_out(p)
    box = (cx - radius, cy - radius, cx + radius, cy + radius)
    d.arc(box, -80, end, fill=color + (int(230 * alpha),), width=width)
    d.arc((box[0] + 14, box[1] + 10, box[2] - 8, box[3] - 14), -60, end - 20,
          fill=color + (int(120 * alpha),), width=width // 3)
    img.alpha_composite(layer)


def slash(img, t, start, y, color=RED, thick=14, dur=0.35, alpha=1.0):
    """Trait diagonal type « coup de sabre »."""
    p = ease_out(prog(t, start, dur))
    if p <= 0 or alpha <= 0:
        return
    d = ImageDraw.Draw(img)
    x0, x1 = -100, -100 + (W + 200) * p
    d.polygon([(x0, y + 40), (x1, y - 40), (x1, y - 40 + thick), (x0, y + 40 + thick)],
              fill=color + (int(255 * alpha),))


def bar(img, cx, cy, w, h, color, alpha):
    if alpha <= 0 or w <= 0:
        return
    d = ImageDraw.Draw(img)
    d.rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2),
                fill=color + (int(255 * alpha),))


def fade_io(t, a, b, fin=0.35, fout=0.35):
    if t < a or t > b:
        return 0.0
    return min(clamp((t - a) / fin), clamp((b - t) / fout))


# ---------------------------------------------------------------- scenes
# (début, fin) en secondes — calées sur le tempo
S = {
    "intro": (0.0, 5.0),
    "lieu": (5.0, 9.4),
    "shidokan": (9.4, 16.9),
    "disciplines": (16.9, 25.0),
    "profs": (25.0, 31.9),
    "valeurs": (31.9, 37.5),
    "public": (37.5, 42.5),
    "cta": (42.5, 50.0),
}
DURATION = 50.0


def scene_intro(img, t):
    a, b = S["intro"]
    al = fade_io(t, a, b, 0.2, 0.4)
    enso(img, W / 2, 870, 440, prog(t, 0.2, 1.6), alpha=al)
    text(img, "FIGHTER", font(F_ANTON, 190), W / 2, 700, WHITE,
         al * ease_out(prog(t, 1.2, 0.5)), dx=-300 * (1 - ease_out(prog(t, 1.2, 0.5))), tracking=6)
    text(img, "ACADEMY", font(F_ANTON, 190), W / 2, 900, WHITE,
         al * ease_out(prog(t, 1.5, 0.5)), dx=300 * (1 - ease_out(prog(t, 1.5, 0.5))), tracking=6)
    bar(img, W / 2, 1060, 520 * ease_out(prog(t, 2.0, 0.5)), 8, RED, al)
    text(img, "KARATÉ", font(F_BEBAS, 150), W / 2, 1170, RED,
         al * ease_out(prog(t, 2.3, 0.4)), scale=1 + 0.4 * (1 - ease_back(prog(t, 2.3, 0.5))), tracking=40)


def scene_lieu(img, t):
    a, b = S["lieu"]
    al = fade_io(t, a, b)
    slash(img, t, a, 560, alpha=al)
    text(img, "LE DOJO DU SUD", font(F_BEBAS, 90), W / 2, 760, GOLD,
         al * ease_out(prog(t, a + 0.3, 0.4)), tracking=14)
    text(img, "LE TAMPON", font(F_ANTON, 210), W / 2, 950, WHITE,
         al, scale=1 + 0.25 * (1 - ease_back(prog(t, a + 0.5, 0.5))))
    text(img, "ÎLE DE LA RÉUNION", font(F_BEBAS, 100), W / 2, 1140, WHITE,
         al * ease_out(prog(t, a + 1.0, 0.5)), tracking=10)
    slash(img, t, a + 1.3, 1300, color=GOLD, thick=6, alpha=al)


def scene_shidokan(img, t):
    a, b = S["shidokan"]
    al = fade_io(t, a, b)
    text(img, "KARATÉ", font(F_BEBAS, 110), W / 2, 460, RED, al * ease_out(prog(t, a, 0.4)), tracking=30)
    text(img, "SHIDOKAN", font(F_ANTON, 220), W / 2, 640, WHITE,
         al, scale=1 + 0.3 * (1 - ease_back(prog(t, a + 0.2, 0.5))))
    text(img, "créé par Maître Yoshiji Soeno", font(F_BEBAS, 72), W / 2, 820, GREY,
         al * ease_out(prog(t, a + 0.8, 0.5)), tracking=3)
    text(img, "LE « TRIATHLON » DES ARTS MARTIAUX", font(F_BEBAS, 70), W / 2, 980, GOLD,
         al * ease_out(prog(t, a + 1.6, 0.5)), tracking=4)
    items = ["KARATÉ KNOCKDOWN", "BOXE THAÏ", "LUTTE AU SOL"]
    for i, s in enumerate(items):
        st = a + 2.4 + i * BEAT * 2
        p = ease_out(prog(t, st, 0.4))
        y = 1140 + i * 150
        bar(img, W / 2, y, 760 * p, 118, (30, 8, 10), al * 0.9)
        bar(img, W / 2 - 380 * p, y, 14, 118 * p, RED, al)
        text(img, s, font(F_ANTON, 84), W / 2, y, WHITE, al * p, dx=-120 * (1 - p), tracking=4)


def scene_disciplines(img, t):
    a, b = S["disciplines"]
    al = fade_io(t, a, b)
    text(img, "4 DISCIPLINES · 1 ÉCOLE", font(F_BEBAS, 88), W / 2, 380, GOLD,
         al * ease_out(prog(t, a, 0.4)), tracking=6)
    items = [("KARATÉ", RED), ("KICK-BOXING", WHITE), ("MMA", RED), ("GRAPPLING", WHITE)]
    for i, (s, c) in enumerate(items):
        st = a + 0.6 + i * BEAT * 2
        p = ease_back(prog(t, st, 0.45))
        y = 620 + i * 280
        side = -1 if i % 2 == 0 else 1
        slash(img, t, st - 0.05, y + 95, color=c if c == RED else GOLD, thick=5, dur=0.3, alpha=al * 0.8)
        text(img, s, font(F_ANTON, 200), W / 2, y, c, al * clamp(p), dx=side * 700 * (1 - clamp(p)))


def scene_profs(img, t):
    a, b = S["profs"]
    al = fade_io(t, a, b)
    text(img, "VOS INSTRUCTEURS", font(F_BEBAS, 96), W / 2, 420, GOLD,
         al * ease_out(prog(t, a, 0.4)), tracking=12)
    bar(img, W / 2, 500, 420 * ease_out(prog(t, a + 0.2, 0.5)), 6, RED, al)
    for i, (role, name) in enumerate([("SENSEI", "FABRICE LEVIS"), ("SEMPAI", "JULES")]):
        st = a + 0.8 + i * 1.6
        p = ease_out(prog(t, st, 0.5))
        y = 780 + i * 420
        enso(img, W / 2, y + 10, 330, prog(t, st - 0.2, 1.0), width=8, alpha=al * 0.35)
        text(img, role, font(F_BEBAS, 90), W / 2, y - 60, RED, al * p, tracking=24)
        text(img, name, font(F_ANTON, 130), W / 2, y + 60, WHITE, al * p,
             scale=1 + 0.2 * (1 - ease_back(prog(t, st, 0.5))))


def scene_valeurs(img, t):
    a, b = S["valeurs"]
    al = fade_io(t, a, b)
    for i, s in enumerate(["RESPECT", "DISCIPLINE", "DÉPASSEMENT"]):
        st = a + i * BEAT * 2
        p = ease_out(prog(t, st, 0.35))
        y = 700 + i * 250
        text(img, s, font(F_ANTON, 170), W / 2, y, WHITE if i != 2 else RED, al * p,
             scale=1 + 0.5 * (1 - ease_back(prog(t, st, 0.45))), tracking=4)
    text(img, "DE SOI", font(F_BEBAS, 110), W / 2, 1350, RED,
         al * ease_out(prog(t, a + BEAT * 4 + 0.3, 0.4)), tracking=30)


def scene_public(img, t):
    a, b = S["public"]
    al = fade_io(t, a, b)
    for i, s in enumerate(["ENFANTS", "ADOS", "ADULTES"]):
        st = a + i * BEAT
        p = ease_out(prog(t, st, 0.35))
        text(img, s, font(F_ANTON, 160), W / 2, 640 + i * 210, WHITE, al * p, dx=(i - 1) * 200 * (1 - p))
    slash(img, t, a + 1.6, 1270, alpha=al)
    text(img, "TOUS NIVEAUX · DÉBUTANTS BIENVENUS", font(F_BEBAS, 72), W / 2, 1400, GOLD,
         al * ease_out(prog(t, a + 1.9, 0.5)), tracking=4)


def scene_cta(img, t):
    a, b = S["cta"]
    al = fade_io(t, a, b, 0.35, 0.8)
    enso(img, W / 2, 620, 250, prog(t, a, 1.4), alpha=al)
    text(img, "OSU !", font(F_ANTON, 190), W / 2, 620, WHITE, al,
         scale=1 + 0.5 * (1 - ease_back(prog(t, a + 0.3, 0.5))))
    text(img, "TON PREMIER PAS", font(F_BEBAS, 96), W / 2, 1000, WHITE,
         al * ease_out(prog(t, a + 1.0, 0.4)), tracking=6)
    text(img, "COMMENCE SUR LE TATAMI", font(F_BEBAS, 96), W / 2, 1110, RED,
         al * ease_out(prog(t, a + 1.4, 0.4)), tracking=6)
    p = ease_back(prog(t, a + 2.2, 0.5))
    bar(img, W / 2, 1320, 820 * clamp(p), 140, RED, al)
    text(img, "RÉSERVE TON COURS D'ESSAI", font(F_ANTON, 70), W / 2, 1320, WHITE, al * clamp(p))
    text(img, "Écris-nous en message privé", font(F_BEBAS, 70), W / 2, 1480, GREY,
         al * ease_out(prog(t, a + 2.8, 0.5)), tracking=3)
    text(img, "FIGHTER ACADEMY KARATÉ · LE TAMPON", font(F_BEBAS, 60), W / 2, 1720, GOLD,
         al * ease_out(prog(t, a + 3.2, 0.5)), tracking=6)


SCENES = [scene_intro, scene_lieu, scene_shidokan, scene_disciplines,
          scene_profs, scene_valeurs, scene_public, scene_cta]


def frame(bg, t, i):
    img = bg.copy()
    for fn in SCENES:
        a, b = S[fn.__name__.replace("scene_", "")]
        if a - 0.05 <= t <= b + 0.05:
            fn(img, t)
    # flash blanc bref à chaque changement de scène
    for a, _ in S.values():
        if a > 0 and 0 <= t - a < 0.12:
            img.alpha_composite(Image.new("RGBA", img.size, (255, 255, 255, int(70 * (1 - (t - a) / 0.12)))))
    # cadre fin + grain
    d = ImageDraw.Draw(img)
    d.rectangle((40, 40, W - 40, H - 40), outline=(90, 20, 24, 255), width=3)
    grain = GRAIN[i % len(GRAIN)]
    img = Image.composite(Image.new("RGBA", img.size, (255, 255, 255, 255)), img,
                          grain.point(lambda v: v // 2))
    # fondu au noir final
    if t > DURATION - 0.6:
        k = clamp((t - (DURATION - 0.6)) / 0.6)
        img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, int(255 * k))))
    return img.convert("RGB")


# ---------------------------------------------------------------- audio
def make_audio(path, sr=44100):
    n = int(DURATION * sr)
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(1)

    def add(sig, start):
        i = int(start * sr)
        j = min(n, i + len(sig))
        if i < n:
            out[i:j] += sig[: j - i]

    def taiko(amp=1.0, f0=110, f1=48, dur=0.9):
        tt = np.arange(int(dur * sr)) / sr
        freq = f1 + (f0 - f1) * np.exp(-tt * 18)
        phase = 2 * np.pi * np.cumsum(freq) / sr
        body = np.sin(phase) * np.exp(-tt * 5)
        click = rng.normal(0, 1, len(tt)) * np.exp(-tt * 90) * 0.35
        return amp * (body + click)

    def rim(amp=0.25):
        tt = np.arange(int(0.12 * sr)) / sr
        return amp * rng.normal(0, 1, len(tt)) * np.exp(-tt * 60) * np.sin(2 * np.pi * 1800 * tt)

    def drone(start, dur, f=55, amp=0.12):
        tt = np.arange(int(dur * sr)) / sr
        env = np.minimum(1, tt / 1.5) * np.minimum(1, (dur - tt) / 1.5)
        sig = (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 1.5 * tt)) * env * amp
        add(sig.astype(np.float32), start)

    drone(0, DURATION, 55, 0.10)
    beats = int(DURATION / BEAT)
    for k in range(beats):
        tb = k * BEAT
        if tb < 1.2:
            continue
        bar_pos = k % 8
        if bar_pos in (0, 3, 4, 6):
            add(taiko(0.8 if bar_pos == 0 else 0.55), tb)
        if bar_pos in (2, 5, 7):
            add(rim(), tb)
        if tb > S["disciplines"][0] and k % 2 == 1:
            add(rim(0.15), tb + BEAT / 2)
    # gros impacts sur chaque transition de scène + intro
    add(taiko(1.3, 140, 40, 2.0), 0.2)
    add(taiko(1.1, 130, 42, 1.6), 1.2)
    for a, _ in S.values():
        if a > 0:
            add(taiko(1.2, 150, 40, 1.8), a)
    out = out / (np.max(np.abs(out)) + 1e-6) * 0.85
    fade = int(1.0 * sr)
    out[-fade:] *= np.linspace(1, 0, fade)
    pcm = (out * 32767).astype(np.int16)
    stereo = np.stack([pcm, pcm], axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(stereo.tobytes())


# ---------------------------------------------------------------- render
def main():
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    wav = os.path.join(HERE, "_audio.wav")
    make_audio(wav)
    bg = make_background()
    total = int(DURATION * FPS)
    proc = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "24",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
         "-movflags", "+faststart", "-shortest", OUT],
        stdin=subprocess.PIPE)
    for i in range(total):
        proc.stdin.write(frame(bg, i / FPS, i).tobytes())
        if i % 150 == 0:
            print(f"{i}/{total}")
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
