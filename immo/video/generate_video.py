"""Vidéo Reel / TikTok — Exclusivité Immo Réseau, La Rivière Saint-Louis.

Génère une vidéo verticale 1080x1920 (Reels / TikTok / Shorts / Stories)
à partir des photos du bien : mouvements de caméra, textes animés,
scène « 5 chambres à l'étage » et bande-son lounge synthétisée (libre de droits).

Usage :  python3 generate_video.py
Dépendances : pip install pillow numpy  (+ ffmpeg installé sur la machine)
"""
import math
import os
import shutil
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PH = os.path.join(HERE, "photos")
W, H, FPS = 1080, 1920, 30
XF = 0.45  # durée des fondus entre scènes (s)
OUT = os.path.join(HERE, "exclusivite-riviere-saint-louis.mp4")

GREEN = (141, 198, 63)
DARK = (11, 36, 31)
WHITE = (250, 250, 247)
SOFT = (205, 214, 208)

F_SANS = os.path.join(HERE, "fonts", "Montserrat.ttf")
F_SCRIPT = os.path.join(HERE, "fonts", "PlayfairDisplay-Italic.ttf")
_fonts = {}


def font(path, size, weight="Bold"):
    key = (path, size, weight)
    if key not in _fonts:
        f = ImageFont.truetype(path, size)
        try:
            f.set_variation_by_name(weight)
        except Exception:
            pass
        _fonts[key] = f
    return _fonts[key]


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    return 1 - (1 - clamp(x)) ** 3


def ease_io(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def prog(t, start, dur):
    return clamp((t - start) / dur)


# ---------------------------------------------------------------- dessin
def text(img, s, path, size, cx, cy, fill, alpha=1.0, dy=0, tracking=0,
         weight="Bold", max_w=W - 160, shadow=True):
    """Texte centré en (cx, cy), réduit si trop large, avec ombre douce."""
    if alpha <= 0.01:
        return
    while True:
        f = font(path, size, weight)
        widths = [f.getlength(c) for c in s]
        total = sum(widths) + tracking * (len(s) - 1)
        if total <= max_w or size <= 12:
            break
        size -= 2
    asc, desc = f.getmetrics()
    pad = 30
    layer = Image.new("RGBA", (int(total) + 2 * pad, asc + desc + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = pad
    for c, w in zip(s, widths):
        d.text((x, pad), c, font=f, fill=fill + (255,))
        x += w + tracking
    if shadow:
        sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        sh.putalpha(layer.getchannel("A").point(lambda v: v * 0.55))
        sh = sh.filter(ImageFilter.GaussianBlur(10))
        layer = Image.alpha_composite(sh, layer)
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    img.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2 + dy)))


def bar(img, cx, cy, w, h, color, alpha=1.0):
    if w <= 1 or alpha <= 0:
        return
    layer = Image.new("RGBA", (int(w), int(h)), color + (int(255 * alpha),))
    img.alpha_composite(layer, (int(cx - w / 2), int(cy - h / 2)))


# ---------------------------------------------------------------- photos
def load(name, box=None):
    im = Image.open(os.path.join(PH, name)).convert("RGB")
    return im.crop(box) if box else im


PHOTO_H = 1320  # zone photo en haut de l'écran


def kenburns(src, t, dur, z0=1.0, z1=1.1, px0=0.0, px1=1.0, py=0.5, area_h=PHOTO_H):
    """Recadre `src` sur une zone W x area_h avec zoom et panoramique progressifs."""
    p = ease_io(t / dur)
    z = z0 + (z1 - z0) * p
    sw, sh = src.size
    target = W / area_h
    if sw / sh > target:
        ch = sh / z
        cw = ch * target
    else:
        cw = sw / z
        ch = cw / target
    px = px0 + (px1 - px0) * p
    x0 = (sw - cw) * px
    y0 = (sh - ch) * py
    return src.resize((W, area_h), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))


def make_gradient():
    """Fond vert sombre + fondu de la photo vers le bas."""
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    a = np.zeros((H, W), dtype=np.uint8)
    start, end = PHOTO_H - 420, PHOTO_H
    for y in range(H):
        if y >= end:
            v = 255
        elif y > start:
            v = int(255 * ease_io((y - start) / (end - start)))
        elif y < 260:
            v = int(110 * (1 - y / 260))  # léger voile en haut (lisibilité UI)
        else:
            v = 0
        a[y, :] = v
    rgb = np.zeros((H, W, 4), dtype=np.uint8)
    rgb[..., 0], rgb[..., 1], rgb[..., 2] = DARK
    rgb[..., 3] = a
    return Image.fromarray(rgb, "RGBA")


GRAD = None
FACADE = None
PHOTOS = {}


def setup():
    global GRAD, FACADE
    GRAD = make_gradient()
    FACADE = load("01-visuel-exclusivite.png", (690, 240, 1254, 925))
    for k in ["02-sejour", "03-chambre-bureau", "04-suite-parentale", "05-chambre-fleurie",
              "06-cuisine", "07-salle-eau", "08-douche-italienne"]:
        # on retire le bandeau du haut : il porte le filigrane, coupé par les panoramiques
        PHOTOS[k] = load(k + ".png", (0, 230, 1536, 1152))
    PHOTOS["logo"] = load("00-banniere.png", (575, 10, 1300, 375))


def base_frame(photo):
    img = Image.new("RGBA", (W, H), DARK + (255,))
    img.paste(photo, (0, 0))
    img.alpha_composite(GRAD)
    return img


TY = 1385  # ligne de base du bloc texte


def caption(img, t, tag, title, sub, script=None):
    """Bloc texte standard sous la photo."""
    a0 = ease_out(prog(t, 0.15, 0.5))
    text(img, tag, F_SANS, 30, W / 2, TY, GREEN, a0, dy=(1 - a0) * 20, tracking=7, weight="SemiBold")
    bar(img, W / 2, TY + 45, 120 * ease_out(prog(t, 0.3, 0.6)), 5, GREEN)
    a1 = ease_out(prog(t, 0.3, 0.6))
    text(img, title, F_SANS, 76, W / 2, TY + 130, WHITE, a1, dy=(1 - a1) * 40, weight="ExtraBold")
    a2 = ease_out(prog(t, 0.6, 0.6))
    text(img, sub, F_SANS, 40, W / 2, TY + 220, SOFT, a2, dy=(1 - a2) * 25, weight="Medium")
    if script:
        a3 = ease_out(prog(t, 1.0, 0.7))
        text(img, script, F_SCRIPT, 54, W / 2, TY + 310, GREEN, a3, dy=(1 - a3) * 20, weight="Italic")


# ---------------------------------------------------------------- scènes
def sc_intro(t, d):
    img = base_frame(kenburns(FACADE, t, d, 1.18, 1.0, 0.5, 0.5, 0.35))
    a = ease_out(prog(t, 0.2, 0.6))
    # étiquette EXCLUSIVITÉ
    w = 520 * a
    bar(img, W / 2, TY - 30, w, 84, GREEN, a)
    text(img, "EXCLUSIVITÉ", F_SANS, 48, W / 2, TY - 30, DARK, a, tracking=8, weight="Black",
         shadow=False)
    a1 = ease_out(prog(t, 0.7, 0.6))
    text(img, "Certaines maisons se visitent.", F_SANS, 56, W / 2, TY + 90, WHITE, a1,
         dy=(1 - a1) * 30, weight="Bold")
    a2 = ease_out(prog(t, 1.7, 0.7))
    text(img, "D'autres ne s'oublient pas.", F_SCRIPT, 72, W / 2, TY + 190, GREEN, a2,
         dy=(1 - a2) * 30, weight="Italic")
    a3 = ease_out(prog(t, 2.4, 0.6))
    text(img, "LA RIVIÈRE SAINT-LOUIS  ·  LA RÉUNION", F_SANS, 30, W / 2, TY + 300, SOFT, a3,
         tracking=4, weight="SemiBold")
    return img


def photo_scene(key, tag, title, sub, script=None, z0=1.0, z1=1.08, px0=0.0, px1=1.0, py=0.5):
    def f(t, d):
        img = base_frame(kenburns(PHOTOS[key], t, d, z0, z1, px0, px1, py))
        caption(img, t, tag, title, sub, script)
        return img
    return f


def sc_etage(t, d):
    # fond : suite parentale floutée et assombrie
    bg = PHOTOS["04-suite-parentale"].resize((W, int(W * 1152 / 1536)))
    bg = kenburns(bg, t, d, 1.0, 1.15, 0.5, 0.5, 0.5, area_h=H).filter(ImageFilter.GaussianBlur(14))
    img = bg.convert("RGBA")
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (190,)))
    a0 = ease_out(prog(t, 0.1, 0.5))
    text(img, "À L'ÉTAGE", F_SANS, 52, W / 2, 640, GREEN, a0, dy=(1 - a0) * 30, tracking=14,
         weight="SemiBold")
    # compteur 1 → 5
    n = 1 + int(4 * ease_out(prog(t, 0.35, 1.0)) + 1e-6)
    a1 = ease_out(prog(t, 0.3, 0.4))
    pop = 1 + 0.12 * math.sin(math.pi * prog(t, 1.3, 0.35))
    text(img, str(n), F_SANS, int(460 * pop), W / 2, 950, WHITE, a1, weight="Black")
    a2 = ease_out(prog(t, 1.3, 0.5))
    text(img, "CHAMBRES", F_SANS, 110, W / 2, 1230, WHITE, a2, dy=(1 - a2) * 30, tracking=10,
         weight="ExtraBold")
    bar(img, W / 2, 1320, 300 * ease_out(prog(t, 1.5, 0.6)), 6, GREEN)
    a3 = ease_out(prog(t, 1.8, 0.6))
    text(img, "Un espace pour chacun.", F_SCRIPT, 64, W / 2, 1420, GREEN, a3, weight="Italic")
    return img


def sc_prix(t, d):
    bg = kenburns(FACADE, t, d, 1.05, 1.2, 0.5, 0.5, 0.4, area_h=H).filter(ImageFilter.GaussianBlur(6))
    img = bg.convert("RGBA")
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (175,)))
    a0 = ease_out(prog(t, 0.1, 0.5))
    text(img, "EXCLUSIVITÉ IMMO RÉSEAU", F_SANS, 34, W / 2, 620, GREEN, a0, tracking=7,
         weight="SemiBold")
    a1 = ease_out(prog(t, 0.35, 0.6))
    s = 0.85 + 0.15 * a1
    text(img, "435 000 €", F_SANS, int(170 * s), W / 2, 820, WHITE, a1, weight="Black")
    text(img, "HAI", F_SANS, 48, W / 2, 960, SOFT, a1, tracking=10, weight="SemiBold")
    bar(img, W / 2, 1030, 360 * ease_out(prog(t, 0.7, 0.6)), 6, GREEN)
    a2 = ease_out(prog(t, 0.9, 0.6))
    text(img, "5 chambres  ·  jardin arboré  ·  bassin", F_SANS, 40, W / 2, 1110, WHITE, a2,
         weight="Medium")
    a3 = ease_out(prog(t, 1.6, 0.7))
    text(img, "Elle ne restera pas longtemps.", F_SCRIPT, 66, W / 2, 1250, GREEN, a3,
         dy=(1 - a3) * 25, weight="Italic")
    return img


def sc_outro(t, d):
    img = Image.new("RGBA", (W, H), DARK + (255,))
    # carte logo
    a0 = ease_out(prog(t, 0.1, 0.7))
    logo = PHOTOS["logo"]
    lw = int(860 * (0.92 + 0.08 * a0))
    lh = int(lw * logo.height / logo.width)
    lg = logo.resize((lw, lh), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (lw, lh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, lw - 1, lh - 1), 36, fill=int(255 * a0))
    lg.putalpha(mask)
    img.alpha_composite(lg, (int(W / 2 - lw / 2), int(640 - lh / 2)))
    a1 = ease_out(prog(t, 0.6, 0.6))
    text(img, "VISITE PRIVÉE", F_SANS, 64, W / 2, 1000, WHITE, a1, dy=(1 - a1) * 30, tracking=6,
         weight="ExtraBold")
    text(img, "sur rendez-vous uniquement", F_SANS, 40, W / 2, 1075, SOFT, a1, weight="Medium")
    # bouton CTA
    a2 = ease_out(prog(t, 1.1, 0.6))
    pulse = 1 + 0.03 * math.sin(2 * math.pi * max(0, t - 1.7) / 1.0)
    bw, bh = 760 * pulse, 120 * pulse
    btn = Image.new("RGBA", (int(bw), int(bh)), (0, 0, 0, 0))
    ImageDraw.Draw(btn).rounded_rectangle((0, 0, int(bw) - 1, int(bh) - 1), int(bh / 2),
                                          fill=GREEN + (int(255 * a2),))
    img.alpha_composite(btn, (int(W / 2 - bw / 2), int(1240 - bh / 2)))
    text(img, "Écrivez « VISITE » en DM", F_SANS, 46, W / 2, 1240, DARK, a2, weight="ExtraBold",
         shadow=False)
    a3 = ease_out(prog(t, 1.6, 0.6))
    text(img, "L'immobilier qui nous relie.", F_SCRIPT, 60, W / 2, 1400, GREEN, a3, weight="Italic")
    text(img, "Honoraires et DPE : nous consulter", F_SANS, 28, W / 2, 1530, (150, 165, 158), a3,
         weight="Regular")
    return img


SCENES = [
    (sc_intro, 4.2),
    (photo_scene("02-sejour", "LE SÉJOUR", "Baigné de lumière", "Escalier suspendu · Grands volumes",
                 z0=1.0, z1=1.06, px0=0.0, px1=0.75), 3.4),
    (photo_scene("06-cuisine", "LA CUISINE", "Pensée pour recevoir", "Équipée · Ouverte sur le jardin",
                 z0=1.06, z1=1.0, px0=0.15, px1=0.85), 3.2),
    (sc_etage, 2.9),
    (photo_scene("04-suite-parentale", "CHAMBRE 1 · SUITE PARENTALE", "Réveil face aux montagnes",
                 "Douche ouverte · Grande baie vitrée", z0=1.0, z1=1.08, px0=0.1, px1=0.45), 3.4),
    (photo_scene("05-chambre-fleurie", "À L'ÉTAGE", "Des chambres lumineuses",
                 "Climatisées · Ouvertes sur la verdure", z0=1.08, z1=1.0, px0=0.2, px1=0.6), 3.0),
    (photo_scene("03-chambre-bureau", "5 CHAMBRES À L'ÉTAGE", "Une chambre pour chacun",
                 "Rangements · Climatisation", z0=1.0, z1=1.07, px0=0.55, px1=0.2), 3.0),
    (photo_scene("07-salle-eau", "SALLE D'EAU", "Pierre naturelle", "Double vasque · Lumière naturelle",
                 z0=1.0, z1=1.08, px0=0.3, px1=0.7), 3.0),
    (photo_scene("08-douche-italienne", "DOUCHE À L'ITALIENNE", "Esprit spa",
                 "Double pommeau · Vue sur les mornes", z0=1.08, z1=1.0, px0=0.5, px1=0.5), 3.0),
    (photo_scene("__facade", "L'EXTÉRIEUR", "Jardin arboré & bassin",
                 "Terrasse · Stationnement privatif", script="Plus qu'un bien, un art de vivre.",
                 z0=1.0, z1=1.12, px0=0.5, px1=0.5, py=0.75), 3.6),
    (sc_prix, 3.8),
    (sc_outro, 4.5),
]


def timeline():
    starts, t = [], 0.0
    for i, (_, d) in enumerate(SCENES):
        starts.append(t)
        t += d - XF
    return starts, t + XF


def frame(t, starts):
    imgs = []
    for (fn, d), s in zip(SCENES, starts):
        if s <= t < s + d:
            local = t - s
            im = fn(local, d)
            fade = clamp(local / XF) if s > 0 else 1.0
            imgs.append((im, fade))
    if not imgs:
        imgs = [(SCENES[-1][0](SCENES[-1][1], SCENES[-1][1]), 1.0)]
    out = imgs[0][0]
    for im, fade in imgs[1:]:
        out = Image.blend(out, im, ease_io(fade))
    return out.convert("RGB")


# ---------------------------------------------------------------- audio
def make_audio(path, dur, sr=44100):
    """Lounge doux : nappe d'accords maj7, basse, kick feutré et shaker (98 BPM)."""
    n = int(dur * sr)
    out = np.zeros(n)
    tt = np.arange(n) / sr
    beat = 60 / 98
    bar_len = 4 * beat
    # Fmaj7 - Em7 - Dm7 - Cmaj7 (un accord par mesure)
    chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
    roots = [41, 40, 38, 36]

    def hz(m):
        return 440 * 2 ** ((m - 69) / 12)

    def add(sig, start):
        i = int(start * sr)
        if i >= n:
            return
        j = min(n, i + len(sig))
        out[i:j] += sig[: j - i]

    nbars = int(dur / bar_len) + 1
    for b in range(nbars):
        ch, rt = chords[b % 4], roots[b % 4]
        L = int(bar_len * sr * 1.15)
        x = np.arange(L) / sr
        env = np.minimum(1, x / 0.6) * np.exp(-x * 0.35)
        pad = np.zeros(L)
        for m in ch:
            f = hz(m + 12)
            pad += (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * 2 * f * x + 0.5)
                    + 0.12 * np.sin(2 * np.pi * 3.01 * f * x)) * (1 + 0.004 * np.sin(2 * np.pi * 4.5 * x))
        add(pad * env * 0.045, b * bar_len)
        # basse : 1 et 3
        for k in (0, 2.5):
            Lb = int(beat * 1.4 * sr)
            xb = np.arange(Lb) / sr
            add(np.sin(2 * np.pi * hz(rt) * xb) * np.exp(-xb * 3) * np.minimum(1, xb / 0.01) * 0.22,
                b * bar_len + k * beat)
        # arpège piano léger
        for k, m in enumerate(ch + [ch[2] + 12, ch[1] + 12]):
            Lp = int(0.9 * sr)
            xp = np.arange(Lp) / sr
            f = hz(m + 24)
            note = (np.sin(2 * np.pi * f * xp) + 0.25 * np.sin(4 * np.pi * f * xp)) * np.exp(-xp * 5)
            add(note * 0.03, b * bar_len + (k * 0.5 + 0.25) * beat)
    # rythmique (entre après l'intro)
    nb = int(dur / beat) + 1
    rng = np.random.default_rng(7)
    for k in range(nb):
        st = k * beat
        if st < 2 * beat or st > dur - 1.5:
            continue
        if k % 2 == 0:
            Lk = int(0.35 * sr)
            xk = np.arange(Lk) / sr
            f = 50 + 70 * np.exp(-xk * 30)
            add(np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-xk * 9) * 0.35, st)
        for h in (0, 0.5):
            Ls = int(0.06 * sr)
            xs = np.arange(Ls) / sr
            noise = rng.standard_normal(Ls)
            noise = np.diff(noise, prepend=0)
            add(noise * np.exp(-xs * 60) * (0.035 if h else 0.02), st + h * beat)
    # fondu entrée/sortie + normalisation
    fade = np.minimum(1, tt / 1.2) * np.minimum(1, (dur - tt) / 2.0)
    out *= np.clip(fade, 0, 1)
    out = np.tanh(out * 1.3)
    out *= 0.7 / max(1e-9, np.abs(out).max())
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg  # repli si ffmpeg n'est pas installé
    return imageio_ffmpeg.get_ffmpeg_exe()


def main():
    setup()
    PHOTOS["__facade"] = FACADE
    starts, total = timeline()
    wav = os.path.join(HERE, "_audio.wav")
    make_audio(wav, total)
    proc = subprocess.Popen(
        [ffmpeg_exe(), "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT],
        stdin=subprocess.PIPE)
    nframes = int(total * FPS)
    for i in range(nframes):
        proc.stdin.write(frame(i / FPS, starts).tobytes())
        if i % 150 == 0:
            print(f"{i}/{nframes}")
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", OUT, f"({total:.1f} s)")


if __name__ == "__main__":
    main()
