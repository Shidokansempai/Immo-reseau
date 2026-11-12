import subprocess, math, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

BASE = os.path.dirname(os.path.abspath(__file__))
PH = os.environ.get("PHOTOS", os.path.join(BASE, "dl", "photos"))
FD = os.path.join(BASE, "fonts")
OUT = sys.argv[1]
W, H, FPS = 1080, 1920, 30
XF = 0.6  # crossfade seconds

def font(pkg, name, size):
    return ImageFont.truetype(os.path.join(FD, f"x_fontsource-{pkg}-5.3.0.tgz", "package", "files", name), size)

M = lambda w, s: font("montserrat", f"montserrat-latin-{w}-normal.woff", s)
P = lambda w, s: font("playfair-display", f"playfair-display-latin-{w}-normal.woff", s)
PI = lambda s: font("playfair-display", "playfair-display-latin-400-italic.woff", s)

GOLD = (212, 175, 106)
WHITE = (255, 255, 255)
NAVY = (12, 18, 30)

imgs = {}
def img(n):
    if n not in imgs:
        im = Image.open(os.path.join(PH, f"p{n:02d}.jpg")).convert("RGB")
        im = ImageEnhance.Contrast(im).enhance(1.04)
        imgs[n] = im
    return imgs[n]

def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)

# scene: photo, dur, (cx0, cy0, z0) -> (cx1, cy1, z1), kicker, title, sub
S = [
    (2, 5.0, (0.30, 0.5, 1.0), (0.62, 0.5, 1.10), "EXCLUSIVITÉ · LA RIVIÈRE", "Ceci n'est pas\nune maison standard.", "Villa T6 d'architecte · Saint-Louis"),
    (0, 4.6, (0.70, 0.5, 1.08), (0.35, 0.5, 1.0), "SÉJOUR CATHÉDRALE", "Un parti pris\nd'architecte.", "Charpente métallique apparente,\nescalier acier."),
    (8, 4.0, (0.25, 0.5, 1.0), (0.55, 0.5, 1.08), "CUISINE OUVERTE", "La lumière,\npartout.", "Ouverte sur la salle à manger"),
    (9, 3.4, (0.5, 0.45, 1.0), (0.5, 0.55, 1.12), "SALLE À MANGER", "Pensée pour\nrecevoir.", "Larges baies vers le jardin tropical"),
    (6, 4.4, (0.35, 0.5, 1.0), (0.62, 0.5, 1.08), "SUITE PARENTALE", "Vue dégagée\nsur les hauts.", ""),
    (5, 3.6, (0.62, 0.5, 1.08), (0.38, 0.5, 1.0), "ESPACE NUIT", "Le calme,\nen standard.", "125 m² habitables"),
    (7, 3.4, (0.40, 0.5, 1.0), (0.62, 0.5, 1.06), "CHAMBRES", "Chacune son\ncaractère.", ""),
    (4, 3.0, (0.55, 0.5, 1.06), (0.40, 0.5, 1.0), "", "", ""),
    (1, 4.0, (0.30, 0.5, 1.0), (0.60, 0.5, 1.08), "SALLES D'EAU", "Pierre naturelle,\ndu sol au plafond.", ""),
    (3, 3.6, (0.50, 0.5, 1.12), (0.50, 0.5, 1.0), "ESPRIT SPA", "On ne prend plus\nune douche.", "Douche à l'italienne · double vasque"),
    (2, 4.2, (0.60, 0.72, 2.0), (0.58, 0.68, 1.55), "EXTÉRIEUR", "Jacuzzi encastré,\nà l'abri des regards.", "Terrasse sous voiles d'ombrage"),
    (10, 4.0, (0.35, 0.5, 1.0), (0.60, 0.5, 1.08), "444 m² CLOS", "Votre jardin\ntropical.", "Abri voitures · buanderie"),
    ("END", 7.0, None, None, "", "", ""),
]

starts, t = [], 0.0
for s in S:
    starts.append(t)
    t += s[1] - XF
TOTAL = t + XF

grad = Image.new("L", (1, H))
for y in range(H):
    a = 0
    if y > H * 0.36:
        a = int(min(1, (y - H * 0.36) / (H * 0.30)) ** 1.1 * 225)
    if y < 300:
        a = max(a, int(150 * (1 - y / 300) ** 2))
    grad.putpixel((0, y), min(255, a))
grad = grad.resize((W, H))
shade = Image.new("RGB", (W, H), (5, 8, 14))

logo = Image.open(os.path.join(BASE, "dl", "logo.png")).convert("RGBA").resize((96, 96), Image.LANCZOS)

def photo_frame(n, p, a, b):
    im = img(n)
    iw, ih = im.size
    bw0 = min(iw, ih * W / H)
    cx = a[0] + (b[0] - a[0]) * p
    cy = a[1] + (b[1] - a[1]) * p
    z = a[2] + (b[2] - a[2]) * p
    bw = bw0 / z
    bh = bw * H / W
    x0 = min(max(cx * iw - bw / 2, 0), iw - bw)
    y0 = min(max(cy * ih - bh / 2, 0), ih - bh)
    return im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + bw, y0 + bh))

def text_in(lt, delay, d=0.7):
    return ease((lt - delay) / d)

def draw_txt(base, xy, txt, f, fill, alpha, spacing=8, shadow=True, anchor="la", tracking=0):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if tracking:
        x, y = xy
        if anchor == "ma":
            tw = sum(d.textlength(c, font=f) + tracking for c in txt) - tracking
            x -= tw / 2
        for c in txt:
            d.text((x, y), c, font=f, fill=fill + (int(255 * alpha),))
            x += d.textlength(c, font=f) + tracking
    else:
        d.multiline_text(xy, txt, font=f, fill=fill + (int(255 * alpha),), spacing=spacing, anchor=anchor, align="center" if anchor == "ma" else "left")
    if shadow:
        sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
        sh.putalpha(layer.getchannel("A").filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.7)))
        base.alpha_composite(sh)
    base.alpha_composite(layer)

def scene_frame(i, lt):
    n, dur, a, b, kick, title, sub = S[i]
    if n == "END":
        return end_frame(lt)
    p = lt / dur
    fr = photo_frame(n, p, a, b)
    fr = Image.composite(shade, fr, grad).convert("RGBA")
    x = 80
    y = 1180
    if kick:
        al = text_in(lt, 0.25)
        dy = (1 - al) * 30
        d = ImageDraw.Draw(fr)
        d.rectangle((x, y + dy + 12, x + int(60 * al), y + dy + 15), fill=GOLD + (int(255 * al),))
        draw_txt(fr, (x + 80, y + dy), kick, M(600, 30), GOLD, al, shadow=True, tracking=5)
    if title:
        al = text_in(lt, 0.45)
        draw_txt(fr, (x, y + 60 + (1 - al) * 40), title, P(700, 84), WHITE, al, spacing=10)
    if sub:
        al = text_in(lt, 0.75)
        draw_txt(fr, (x, y + 290 + (1 - al) * 30), sub, M(400, 36), (230, 230, 230), al, spacing=10)
    # top brand bar
    fr.alpha_composite(logo, (80, 110))
    draw_txt(fr, (196, 122), "IMMO RÉSEAU", M(700, 30), WHITE, 1, shadow=True, tracking=4)
    draw_txt(fr, (196, 162), "Jules Fraynal · La Réunion", M(400, 26), (225, 225, 225), 1)
    return fr.convert("RGB")

end_bg = None
def end_frame(lt):
    global end_bg
    if end_bg is None:
        bg = img(2).resize((W, int(W * 1086 / 1448)))
        bg = bg.resize((int(H * 1448 / 1086), H)).crop((600, 0, 600 + W, H)).filter(ImageFilter.GaussianBlur(28))
        end_bg = Image.blend(bg, Image.new("RGB", (W, H), NAVY), 0.78)
    fr = end_bg.copy().convert("RGBA")
    cx = W // 2
    al = text_in(lt, 0.2)
    big_logo = logo.resize((150, 150), Image.LANCZOS)
    big_logo.putalpha(big_logo.getchannel("A").point(lambda v: int(v * al)))
    fr.alpha_composite(big_logo, (cx - 75, 300))
    draw_txt(fr, (cx, 480), "VILLA T6 D'ARCHITECTE", M(600, 32), GOLD, al, shadow=False, anchor="ma", tracking=6)
    draw_txt(fr, (cx, 530), "La Rivière · Saint-Louis", PI(46), WHITE, al, shadow=False, anchor="ma")
    al2 = text_in(lt, 0.6)
    draw_txt(fr, (cx, 640 + (1 - al2) * 30), "435 000 €", P(700, 150), WHITE, al2, shadow=False, anchor="ma")
    draw_txt(fr, (cx, 840), "125 m²  ·  4 chambres  ·  Terrain 444 m²", M(500, 36), (225, 225, 225), al2, shadow=False, anchor="ma")
    d = ImageDraw.Draw(fr)
    lw = int(220 * text_in(lt, 1.0))
    d.rectangle((cx - lw // 2, 930, cx + lw // 2, 932), fill=GOLD + (255,))
    al3 = text_in(lt, 1.3, 1.0)
    draw_txt(fr, (cx, 990), "« Les biens d'exception\nne restent jamais longtemps\nen vitrine. »", PI(52), WHITE, al3, spacing=14, shadow=False, anchor="ma")
    al4 = text_in(lt, 2.3)
    draw_txt(fr, (cx, 1260), "VISITES SUR RENDEZ-VOUS", M(600, 30), GOLD, al4, shadow=False, anchor="ma", tracking=5)
    draw_txt(fr, (cx, 1320), "Jules FRAYNAL", P(700, 64), WHITE, al4, shadow=False, anchor="ma")
    draw_txt(fr, (cx, 1410), "06 93 92 66 87", M(700, 58), WHITE, al4, shadow=False, anchor="ma")
    draw_txt(fr, (cx, 1500), "j.fraynal@immo-reseau.com", M(400, 34), (215, 215, 215), al4, shadow=False, anchor="ma")
    draw_txt(fr, (cx, 1600), "Exclusivité Immo Réseau · Réf. 40351\nHonoraires charge vendeur", M(400, 24), (170, 170, 170), al4, spacing=8, shadow=False, anchor="ma")
    return fr.convert("RGB")

nframes = int(TOTAL * FPS)
ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                       "-i", os.path.join(BASE, "pad.wav"), "-map", "0:v", "-map", "1:a", "-shortest",
                       "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
                       "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
for f in range(nframes):
    t = f / FPS
    act = [i for i in range(len(S)) if starts[i] <= t < starts[i] + S[i][1]]
    i = act[-1]
    fr = scene_frame(i, t - starts[i])
    if len(act) > 1:
        j = act[0]
        prev = scene_frame(j, t - starts[j])
        k = ease((t - starts[i]) / XF)
        fr = Image.blend(prev, fr, k)
    if t < 0.5:
        fr = Image.blend(Image.new("RGB", (W, H)), fr, ease(t / 0.5))
    ff.stdin.write(fr.tobytes())
    if f % 150 == 0:
        print(f, "/", nframes, flush=True)
ff.stdin.close()
ff.wait()
print("done", TOTAL)
