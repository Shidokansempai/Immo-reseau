"""Story 15 s — « Les petits regardent » + annonce du Shidokan Challenge 974.

Version courte du reel « nos féminines inspirent nos plus petites »,
qui se termine sur l'affiche du Shidokan Challenge 974 (dimanche 25 octobre 2026).
Format 1080x1920. Texte placé hors des zones masquées par l'interface story
(~250 px en haut et en bas).

Usage :  python3 generate_story_15s.py            (vidéo)
         python3 generate_story_15s.py --preview  (images clés)
"""
import os
import shutil
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generate_reel_feminines as g
from generate_reel_feminines import (F_ANTON, F_BEBAS, GOLD, RED, WHITE, W, H, FPS,
                                     boxtext, clamp, cover, ease_back, ease_out,
                                     font, grade, prog, stext)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "story-15s-feminines-challenge.mp4")
CH = os.path.join(HERE, "photos", "challenge")

# (début, fin, photo, zoom départ, zoom fin, fx, fy, texte)
SHOTS = [
    (1.7, 3.1, "04-adulte-high-kick.jpg", 1.30, 1.08, 0.55, 0.45, "VOICI NOTRE RÉPONSE."),
    (3.1, 4.3, "01-ado-garde.jpg", 1.05, 1.20, 0.50, 0.40, "ADOS."),
    (4.3, 5.5, "03-adulte-direct.jpg", 1.05, 1.20, 0.33, 0.42, "ADULTES."),
    (5.5, 6.7, "06-adulte-face.jpg", 1.05, 1.18, 0.45, 0.45, "MÊME TATAMI."),
    (6.7, 7.8, "08-salle.jpg", 1.00, 1.30, 0.52, 0.62, "PENDANT CE TEMPS…"),
]
GROUP = (7.8, 10.2)
ANNONCE = (10.2, 11.9)
POSTER = (11.9, 15.0)
DURATION = POSTER[1]
CUTS = [s[0] for s in SHOTS] + [GROUP[0], ANNONCE[0], POSTER[0]]

AFFICHE = Image.open(os.path.join(CH, "affiche-challenge-story.png")).convert("RGB")
AFFICHE_BG = grade(cover(AFFICHE, 1.2, 0.5, 0.5).filter(ImageFilter.GaussianBlur(25)), dark=0.5)
LOGO = Image.open(os.path.join(CH, "logo-shidokan-reunion.png")).convert("RGBA")


def scene_hook(img, t):
    img.alpha_composite(g.HOOK_BG)
    pulse = 1 + 0.03 * np.sin(t * 2 * np.pi * 1.8)
    stext(img, "LE KARATÉ,", font(F_ANTON, 150), W / 2, 760, WHITE, scale=pulse)
    stext(img, "C'EST POUR", font(F_ANTON, 150), W / 2, 930, WHITE, scale=pulse)
    stext(img, "LES GARÇONS ?", font(F_ANTON, 140), W / 2, 1100, RED, scale=pulse)


def scene_shot(img, t, shot):
    a, b, name, z0, z1, fx, fy, cap = shot
    p = prog(t, a, b - a)
    z = z0 + (z1 - z0) * (0.35 * ease_out(prog(t, a, 0.2)) + 0.65 * p)
    shake = 10 * max(0, 1 - (t - a) / 0.15)
    img.alpha_composite(grade(cover(g.PHOTOS[name], z, fx, fy)),
                        (int(shake * np.sin(t * 90)), int(shake * np.cos(t * 70))))
    k = ease_back(prog(t, a + 0.05, 0.3))
    if cap.startswith("VOICI"):
        boxtext(img, cap, font(F_ANTON, 112), W / 2, 1250, prog(t, a + 0.05, 0.4))
    elif cap.startswith("PENDANT"):
        stext(img, cap, font(F_ANTON, 110), W / 2, 1250, GOLD, alpha=clamp(k), scale=1 + 0.3 * (1 - k))
    else:
        stext(img, cap, font(F_ANTON, 150 if len(cap) < 10 else 130), W / 2, 1250, WHITE,
              alpha=clamp(k), scale=1 + 0.35 * (1 - k))


def scene_group(img, t):
    a, _ = GROUP
    img.alpha_composite(g.GROUP_BG)
    z = 1.0 + 1.6 * ease_out(prog(t, a + 0.2, 1.8))
    zc = min(z, 1.55)
    bw, bh = int(W * zc), int(W * zc * 490 / 1080)
    src_w = 1080 / z
    src_h = src_w * bh / bw
    m = ease_out(prog(t, a + 0.2, 1.8))
    cx = clamp((0.5 + (g.GIRL_FX - 0.5) * m) * 1080, src_w / 2, 1080 - src_w / 2)
    cy = clamp((0.5 + (g.GIRL_FY - 0.5) * m) * 490, src_h / 2, 490 - src_h / 2)
    band = g.GROUP_BAND.resize((bw, bh), Image.BICUBIC,
                               box=(cx - src_w / 2, cy - src_h / 2, cx + src_w / 2, cy + src_h / 2))
    by = int(H * 0.47 - bh / 2)
    img.alpha_composite(band.convert("RGBA"), (int((W - bw) / 2), by))
    ImageDraw.Draw(img).rectangle(((W - bw) / 2, by, (W + bw) / 2, by + bh), outline=GOLD + (255,), width=5)
    k = ease_back(prog(t, a + 0.1, 0.35))
    stext(img, "LES PETITS", font(F_ANTON, 130), W / 2, by - 220, WHITE, alpha=clamp(k), scale=1 + 0.3 * (1 - k))
    stext(img, "REGARDENT.", font(F_ANTON, 130), W / 2, by - 80, WHITE, alpha=clamp(k), scale=1 + 0.3 * (1 - k))
    boxtext(img, "DEMAIN, C'EST EUX.", font(F_ANTON, 104), W / 2, by + bh + 130, prog(t, a + 1.2, 0.45))


def scene_annonce(img, t):
    a, _ = ANNONCE
    img.alpha_composite(AFFICHE_BG)
    # logo qui tombe et rebondit
    k = ease_back(prog(t, a, 0.45))
    size = int(380 * (0.4 + 0.6 * k))
    if size > 10:
        lg = LOGO.resize((size, size * LOGO.height // LOGO.width), Image.LANCZOS)
        img.alpha_composite(lg, (int(W / 2 - lg.width / 2), int(560 - lg.height / 2)))
    k2 = ease_back(prog(t, a + 0.35, 0.35))
    stext(img, "DIMANCHE", font(F_ANTON, 130), W / 2, 900, WHITE, alpha=clamp(k2), scale=1 + 0.4 * (1 - k2))
    boxtext(img, "25 OCTOBRE", font(F_ANTON, 120), W / 2, 1070, prog(t, a + 0.6, 0.4))
    k3 = ease_out(prog(t, a + 0.9, 0.35))
    stext(img, "VIENS VIVRE LE SHIDOKAN CHALLENGE 974", font(F_BEBAS, 72), W / 2, 1240, GOLD, alpha=k3, stroke=4)


def scene_poster(img, t):
    a, b = POSTER
    img.alpha_composite(AFFICHE_BG)
    # l'affiche arrive en grand puis se pose doucement (dézoom)
    z = 1.18 - 0.18 * ease_out(prog(t, a, b - a))
    pw = int(W * 0.86 * z)
    ph = int(pw * AFFICHE.height / AFFICHE.width)
    poster = AFFICHE.resize((pw, ph), Image.BICUBIC).convert("RGBA")
    img.alpha_composite(poster, (int(W / 2 - pw / 2), int(H / 2 - ph / 2)))


def frame(t):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    if t < SHOTS[0][0]:
        scene_hook(img, t)
    elif t < GROUP[0]:
        for s in SHOTS:
            if s[0] <= t < s[1]:
                scene_shot(img, t, s)
    elif t < ANNONCE[0]:
        scene_group(img, t)
    elif t < POSTER[0]:
        scene_annonce(img, t)
    else:
        scene_poster(img, t)
    for c in CUTS:
        if 0 <= t - c < 0.09:
            img.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(110 * (1 - (t - c) / 0.09)))))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 10), fill=RED + (255,))
    d.rectangle((0, H - 10, W, H), fill=RED + (255,))
    return img.convert("RGB")


def make_audio(path, sr=44100):
    n = int(DURATION * sr)
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(5)

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

    for k in range(2):
        add(taiko(0.55, 70, 40, 0.5), 0.1 + k * 0.7)
        add(taiko(0.40, 70, 40, 0.5), 0.35 + k * 0.7)
    tt = np.arange(int(0.8 * sr)) / sr
    add((rng.normal(0, 1, len(tt)) * (tt / 0.8) ** 2 * 0.35).astype(np.float32), SHOTS[0][0] - 0.8)
    beat = 60 / 120
    t, k = SHOTS[0][0], 0
    while t < DURATION - 0.8:
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
    tt = np.arange(n) / sr
    out += (np.sin(2 * np.pi * 55 * tt) + 0.5 * np.sin(2 * np.pi * 82.5 * tt)).astype(np.float32) * 0.07
    out = out / (np.max(np.abs(out)) + 1e-6) * 0.88
    fade = int(0.6 * sr)
    out[-fade:] *= np.linspace(1, 0, fade)
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())


def main():
    ffmpeg = shutil.which("ffmpeg")
    wav = os.path.join(HERE, "_audio_story.wav")
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
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("OK ->", OUT)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--preview":
        pdir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "_preview")
        os.makedirs(pdir, exist_ok=True)
        for ts in [0.5, 2.3, 3.6, 5.0, 6.0, 7.3, 9.8, 11.5, 14.5]:
            frame(ts).save(os.path.join(pdir, f"s_{ts:05.1f}.png"))
        print("preview ->", pdir)
    else:
        main()
