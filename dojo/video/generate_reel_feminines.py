"""Reel viral — « Nos féminines inspirent nos plus petites ».

Fighter Academy Karaté (Le Tampon, La Réunion).
Vidéo verticale 1080x1920, ~26 s, cuts calés sur le tempo, bande-son taiko
synthétisée. Pensée pour Instagram Reels et TikTok (texte hors des zones
masquées par l'interface : bas de l'écran et colonne de droite).

Usage :  python3 generate_reel_feminines.py
Dépendances : pip install pillow numpy  (+ ffmpeg dans le PATH)
"""
import os
import shutil
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
PH = os.path.join(HERE, "photos", "feminines")
OUT = os.path.join(HERE, "reel-feminines-inspirent.mp4")
W, H, FPS = 1080, 1920, 30

RED = (200, 16, 30)
GOLD = (212, 175, 90)
WHITE = (250, 248, 242)
BLACK = (0, 0, 0)

F_ANTON = os.path.join(HERE, "fonts", "Anton-Regular.ttf")
F_BEBAS = os.path.join(HERE, "fonts", "BebasNeue-Regular.ttf")
_fc = {}


def font(path, size):
    k = (path, int(size))
    if k not in _fc:
        _fc[k] = ImageFont.truetype(path, int(size))
    return _fc[k]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    return 1 - (1 - clamp(x)) ** 3


def ease_back(x):
    x = clamp(x)
    return 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2


def prog(t, start, dur):
    return clamp((t - start) / dur)


# ------------------------------------------------------------------ photos
def load(name):
    return ImageOps.exif_transpose(Image.open(os.path.join(PH, name))).convert("RGB")


def cover(im, zoom, fx, fy):
    """Recadre `im` en 9:16 plein écran, zoomé sur le point (fx, fy) relatif."""
    s = max(W / im.width, H / im.height) * zoom
    cw, ch = W / s, H / s
    cx = clamp(fx * im.width, cw / 2, im.width - cw / 2)
    cy = clamp(fy * im.height, ch / 2, im.height - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return im.resize((W, H), Image.BICUBIC, box=box)


def grade(img, dark=0.0):
    """Look « fight night » : contraste, vignette et dégradé bas pour le texte."""
    a = np.asarray(img).astype(np.float32)
    a = (a - 128) * 1.12 + 122
    a = a * VIGNETTE[..., None] * (1 - dark)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert("RGBA")


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
_r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
VIGNETTE = np.clip(1.15 - _r * 1.25, 0.35, 1.0) * np.clip(1.0 - np.clip((yy - H * 0.55) / (H * 0.45), 0, 1) * 0.55, 0, 1)

# ------------------------------------------------------------------ texte
def stext(img, s, fnt, cx, cy, fill=WHITE, alpha=1.0, scale=1.0, dx=0, stroke=7):
    """Texte centré, contour noir + ombre portée (lisible sur photo)."""
    if alpha <= 0.01:
        return
    f = font(fnt.path, fnt.size * scale)
    l, t, r, b = f.getbbox(s, stroke_width=stroke)
    pad = 40
    layer = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((pad - l + 8, pad - t + 10), s, font=f, fill=(0, 0, 0, 150), stroke_width=stroke, stroke_fill=(0, 0, 0, 150))
    layer = layer.filter(ImageFilter.GaussianBlur(6))
    d = ImageDraw.Draw(layer)
    d.text((pad - l, pad - t), s, font=f, fill=fill + (255,), stroke_width=stroke, stroke_fill=BLACK + (255,))
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    img.alpha_composite(layer, (int(cx - layer.width / 2 + dx), int(cy - layer.height / 2)))


def boxtext(img, s, fnt, cx, cy, p, fg=WHITE, bg=RED, alpha=1.0):
    """Texte dans un bandeau incliné (style affiche « UNE FAMILLE. »)."""
    if p <= 0 or alpha <= 0.01:
        return
    l, t, r, b = fnt.getbbox(s)
    tw, th = r - l, b - t
    bw, bh = tw + 80, th + 60
    layer = Image.new("RGBA", (bw + 60, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    wcur = (bw + 60) * ease_out(p)
    d.polygon([(30, 0), (min(wcur, bw + 60), 0), (min(wcur, bw + 60) - 30, bh), (0, bh)], fill=bg + (255,))
    tp = ease_out(prog(p, 0.35, 0.65))
    if tp > 0:
        d.text(((bw + 60 - tw) / 2 - l, (bh - th) / 2 - t), s, font=fnt, fill=fg + (int(255 * tp),))
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    img.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - bh / 2)))


# ------------------------------------------------------------------ montage
# Chaque plan : (début, fin, fichier, zoom départ, zoom fin, fx, fy)
SHOTS = [
    (2.40, 4.60, "04-adulte-high-kick.jpg", 1.30, 1.05, 0.55, 0.45),
    (4.60, 6.40, "01-ado-garde.jpg", 1.05, 1.22, 0.50, 0.40),
    (6.40, 8.20, "02-ado-frappe.jpg", 1.08, 1.25, 0.42, 0.42),
    (8.20, 10.0, "03-adulte-direct.jpg", 1.05, 1.22, 0.33, 0.42),
    (10.0, 11.8, "07-adulte-genou.jpg", 1.25, 1.05, 0.45, 0.45),
    (11.8, 13.6, "06-adulte-face.jpg", 1.05, 1.20, 0.45, 0.45),
    (13.6, 15.4, "05-adulte-garde.jpg", 1.05, 1.20, 0.48, 0.45),
    (15.4, 17.6, "08-salle.jpg", 1.00, 1.35, 0.52, 0.62),
]
GROUP = (17.6, 21.8)
CTA = (21.8, 26.5)
DURATION = CTA[1]
CUTS = [s[0] for s in SHOTS] + [GROUP[0], CTA[0]]

CAPTIONS = {
    "04-adulte-high-kick.jpg": "VOICI NOTRE RÉPONSE.",
    "01-ado-garde.jpg": "ADOS.",
    "02-ado-frappe.jpg": "ELLE NE RECULE PAS.",
    "03-adulte-direct.jpg": "ADULTES.",
    "07-adulte-genou.jpg": "PUISSANCE.",
    "06-adulte-face.jpg": "MÊME TATAMI.",
    "05-adulte-garde.jpg": "MÊME RESPECT.",
    "08-salle.jpg": "ET PENDANT CE TEMPS…",
}

PHOTOS = {s[2]: load(s[2]) for s in SHOTS}
HOOK_BG = grade(cover(load("08-salle.jpg"), 1.15, 0.52, 0.6).filter(ImageFilter.GaussianBlur(14)), dark=0.55)

# Bandeau photo de groupe extrait de l'affiche, zoom final sur la petite en kimono
_poster = load("00-affiche-groupe.png")
GROUP_BAND = _poster.crop((0, 850, 1080, 1340))  # 1080 x 490
GROUP_BG = grade(cover(GROUP_BAND, 1.0, 0.68, 0.6).filter(ImageFilter.GaussianBlur(22)), dark=0.45)
GIRL_FX, GIRL_FY = 740 / 1080, (1170 - 850) / 490


def scene_hook(img, t):
    img.alpha_composite(HOOK_BG)
    # Le texte est là dès la 1re image : c'est elle qui arrête le scroll.
    pulse = 1 + 0.03 * np.sin(t * 2 * np.pi * 1.6)
    stext(img, "« SEMPAI…", font(F_ANTON, 120), W / 2, 640, GOLD, scale=pulse)
    stext(img, "LE KARATÉ,", font(F_ANTON, 150), W / 2, 820, WHITE, scale=pulse)
    stext(img, "C'EST POUR", font(F_ANTON, 150), W / 2, 990, WHITE, scale=pulse)
    stext(img, "LES GARÇONS ? »", font(F_ANTON, 128), W / 2, 1160, RED, scale=pulse)
    stext(img, "regarde jusqu'au bout", font(F_BEBAS, 64), W / 2, 1360, WHITE,
          alpha=ease_out(prog(t, 0.9, 0.4)), stroke=4)


def scene_shot(img, t, shot):
    a, b, name, z0, z1, fx, fy = shot
    p = prog(t, a, b - a)
    # punch-in : zoom rapide au début du plan puis dérive lente
    z = z0 + (z1 - z0) * (0.35 * ease_out(prog(t, a, 0.25)) + 0.65 * p)
    shake = 10 * max(0, 1 - (t - a) / 0.18)
    frame = cover(PHOTOS[name], z, fx, fy)
    img.alpha_composite(grade(frame), (int(shake * np.sin(t * 90)), int(shake * np.cos(t * 70))))
    cap = CAPTIONS[name]
    k = ease_back(prog(t, a + 0.08, 0.35))
    if name == "04-adulte-high-kick.jpg":
        boxtext(img, cap, font(F_ANTON, 112), W / 2, 1300, prog(t, a + 0.1, 0.45))
    elif name == "08-salle.jpg":
        stext(img, cap, font(F_ANTON, 110), W / 2, 1300, GOLD, alpha=clamp(k), scale=1 + 0.3 * (1 - k))
    else:
        stext(img, cap, font(F_ANTON, 150 if len(cap) < 12 else 118), W / 2, 1300, WHITE,
              alpha=clamp(k), scale=1 + 0.35 * (1 - k))


def scene_group(img, t):
    a, b = GROUP
    img.alpha_composite(GROUP_BG)
    # bandeau qui grossit vers la petite en kimono ceinture orange
    z = 1.0 + 1.6 * ease_out(prog(t, a + 0.4, 3.2))
    bw, bh = int(W * min(z, 1.55)), int(W * min(z, 1.55) * 490 / 1080)
    src_w = 1080 / z
    src_h = src_w * bh / bw
    cx = clamp(0.5 + (GIRL_FX - 0.5) * ease_out(prog(t, a + 0.4, 3.0)), 0, 1) * 1080
    cy = clamp(0.5 + (GIRL_FY - 0.5) * ease_out(prog(t, a + 0.4, 3.0)), 0, 1) * 490
    cx = clamp(cx, src_w / 2, 1080 - src_w / 2)
    cy = clamp(cy, src_h / 2, 490 - src_h / 2)
    band = GROUP_BAND.resize((bw, bh), Image.BICUBIC,
                             box=(cx - src_w / 2, cy - src_h / 2, cx + src_w / 2, cy + src_h / 2))
    by = int(H * 0.47 - bh / 2)
    img.alpha_composite(band.convert("RGBA"), (int((W - bw) / 2), by))
    d = ImageDraw.Draw(img)
    d.rectangle(((W - bw) / 2, by, (W + bw) / 2, by + bh), outline=GOLD + (255,), width=5)
    k1 = ease_back(prog(t, a + 0.15, 0.4))
    stext(img, "LES PETITES", font(F_ANTON, 130), W / 2, by - 220, WHITE, alpha=clamp(k1), scale=1 + 0.3 * (1 - k1))
    stext(img, "REGARDENT.", font(F_ANTON, 130), W / 2, by - 80, WHITE, alpha=clamp(k1), scale=1 + 0.3 * (1 - k1))
    boxtext(img, "DEMAIN, C'EST ELLES.", font(F_ANTON, 104), W / 2, by + bh + 130, prog(t, a + 2.0, 0.5))


def scene_cta(img, t):
    a, b = CTA
    bg = Image.new("RGBA", (W, H), (10, 8, 9, 255))
    img.alpha_composite(bg)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((W / 2 - 520, 380, W / 2 + 520, 1400), fill=(120, 10, 18, 140))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    for i, s in enumerate(["FILLES", "MAMANS", "SŒURS"]):
        k = ease_back(prog(t, a + 0.1 + i * 0.27, 0.35))
        stext(img, s, font(F_ANTON, 140), W / 2, 420 + i * 170, WHITE if i != 1 else GOLD,
              alpha=clamp(k), scale=1 + 0.4 * (1 - k), stroke=0)
    k = ease_out(prog(t, a + 1.0, 0.4))
    stext(img, "LE TATAMI VOUS ATTEND.", font(F_BEBAS, 104), W / 2, 960, WHITE, alpha=k, stroke=0)
    boxtext(img, "COMMENTE « ESSAI »", font(F_ANTON, 96), W / 2, 1150, prog(t, a + 1.5, 0.5))
    k = ease_out(prog(t, a + 2.1, 0.5))
    stext(img, "FIGHTER ACADEMY KARATÉ · LE TAMPON", font(F_BEBAS, 60), W / 2, 1330, GOLD, alpha=k, stroke=0)
    stext(img, "@SHIDOKAN_REUNION", font(F_BEBAS, 60), W / 2, 1405, WHITE, alpha=k, stroke=0)
    stext(img, "OSU !", font(F_ANTON, 90), W / 2, 1560, RED, alpha=ease_out(prog(t, a + 2.6, 0.4)), stroke=0)


def frame(t):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    if t < SHOTS[0][0]:
        scene_hook(img, t)
    elif t < GROUP[0]:
        for s in SHOTS:
            if s[0] <= t < s[1]:
                scene_shot(img, t, s)
    elif t < CTA[0]:
        scene_group(img, t)
    else:
        scene_cta(img, t)
    # flash blanc à chaque cut
    for c in CUTS:
        if 0 <= t - c < 0.10:
            img.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(110 * (1 - (t - c) / 0.10)))))
    # bandes rouges haut / bas (charte de l'affiche)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 10), fill=RED + (255,))
    d.rectangle((0, H - 10, W, H), fill=RED + (255,))
    if t > DURATION - 0.5:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * prog(t, DURATION - 0.5, 0.5)))))
    return img.convert("RGB")


# ------------------------------------------------------------------ audio
def make_audio(path, sr=44100):
    n = int(DURATION * sr)
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(3)

    def add(sig, start):
        i = int(start * sr)
        j = min(n, i + len(sig))
        if 0 <= i < n:
            out[i:j] += sig[: j - i]

    def taiko(amp=1.0, f0=120, f1=45, dur=0.9):
        tt = np.arange(int(dur * sr)) / sr
        freq = f1 + (f0 - f1) * np.exp(-tt * 18)
        body = np.sin(2 * np.pi * np.cumsum(freq) / sr) * np.exp(-tt * 5)
        return amp * (body + rng.normal(0, 1, len(tt)) * np.exp(-tt * 90) * 0.35)

    def rim(amp=0.22):
        tt = np.arange(int(0.10 * sr)) / sr
        return amp * rng.normal(0, 1, len(tt)) * np.exp(-tt * 60) * np.sin(2 * np.pi * 1900 * tt)

    def riser(start, dur):
        tt = np.arange(int(dur * sr)) / sr
        env = (tt / dur) ** 2
        add((rng.normal(0, 1, len(tt)) * env * 0.35).astype(np.float32), start)

    # Hook : battements de cœur
    for k in range(3):
        add(taiko(0.55, 70, 40, 0.5), 0.15 + k * 0.75)
        add(taiko(0.40, 70, 40, 0.5), 0.40 + k * 0.75)
    riser(1.4, 1.0)
    # Drop puis groove taiko à 110 BPM
    beat = 60 / 110
    t = SHOTS[0][0]
    k = 0
    while t < CTA[1] - 1.0:
        pos = k % 8
        if pos in (0, 3, 4, 6):
            add(taiko(0.75 if pos == 0 else 0.5), t)
        if pos in (2, 5, 7):
            add(rim(), t)
        if k % 2 == 1:
            add(rim(0.12), t + beat / 2)
        t += beat
        k += 1
    for c in CUTS:
        add(taiko(1.25, 150, 40, 1.6), c)
    # drone
    tt = np.arange(n) / sr
    out += (np.sin(2 * np.pi * 55 * tt) + 0.5 * np.sin(2 * np.pi * 82.5 * tt)).astype(np.float32) * 0.07
    out = out / (np.max(np.abs(out)) + 1e-6) * 0.88
    fade = int(0.8 * sr)
    out[-fade:] *= np.linspace(1, 0, fade)
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())


def main():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    wav = os.path.join(HERE, "_audio_reel.wav")
    make_audio(wav)
    total = int(DURATION * FPS)
    proc = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "21",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", "-shortest", OUT],
        stdin=subprocess.PIPE)
    for i in range(total):
        proc.stdin.write(frame(i / FPS).tobytes())
        if i % 150 == 0:
            print(f"{i}/{total}")
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", OUT)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--preview":
        # Aperçu : quelques images clés en PNG
        pdir = os.path.join(HERE, "_preview")
        os.makedirs(pdir, exist_ok=True)
        for ts in [0.0, 1.5, 3.2, 5.2, 7.0, 9.0, 12.5, 16.5, 18.2, 21.0, 25.0]:
            frame(ts).save(os.path.join(pdir, f"f_{ts:05.1f}.png"))
        print("preview ->", pdir)
    else:
        main()
