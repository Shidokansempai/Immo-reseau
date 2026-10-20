"""Stories Instagram / Facebook — Exclusivité La Rivière Saint-Louis.

Génère 5 visuels 1080x1920 (PNG) dans le dossier stories/.
Les zones laissées libres sont prévues pour les stickers interactifs
à ajouter dans l'appli (quiz, sondage, lien, curseur emoji).

Usage :  python3 generate_stories.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

import generate_video as g
from generate_video import DARK, F_SANS, F_SCRIPT, GREEN, H, SOFT, W, WHITE, bar, text

OUT = os.path.join(g.HERE, "stories")


def cover(src, w, h, px=0.5, py=0.5, zoom=1.0):
    """Recadre `src` pour remplir w x h."""
    sw, sh = src.size
    if sw / sh > w / h:
        ch = sh / zoom
        cw = ch * w / h
    else:
        cw = sw / zoom
        ch = cw * h / w
    x0, y0 = (sw - cw) * px, (sh - ch) * py
    return src.resize((w, h), Image.LANCZOS, box=(x0, y0, x0 + cw, y0 + ch)).convert("RGBA")


def shade(img, y0, y1, a0, a1):
    """Dégradé vert sombre vertical de y0 (alpha a0) à y1 (alpha a1)."""
    layer = Image.new("RGBA", (W, y1 - y0))
    d = ImageDraw.Draw(layer)
    for y in range(y1 - y0):
        a = a0 + (a1 - a0) * y / max(1, y1 - y0 - 1)
        d.line([(0, y), (W, y)], fill=DARK + (int(a),))
    img.alpha_composite(layer, (0, y0))


def pill(img, label, cy, fg=DARK, bg=GREEN, size=40, padx=50, h=78):
    f = g.font(F_SANS, size, "Black")
    w = int(f.getlength(label) + size * 0.2 * len(label) / 2 + 2 * padx)
    p = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(p).rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=bg + (255,))
    img.alpha_composite(p, (W // 2 - w // 2, cy - h // 2))
    text(img, label, F_SANS, size, W / 2, cy, fg, tracking=size * 0.2, weight="Black", shadow=False)


def framed(img, photo, box, radius=28, border=6):
    """Colle une photo arrondie avec un liseré vert."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    ph = cover(photo, w, h)
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius, fill=255)
    ph.putalpha(m)
    sh = Image.new("RGBA", (w + 80, h + 80), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((40, 50, w + 39, h + 49), radius, fill=(0, 0, 0, 150))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)), (x0 - 40, y0 - 40))
    fr = Image.new("RGBA", (w + 2 * border, h + 2 * border), (0, 0, 0, 0))
    ImageDraw.Draw(fr).rounded_rectangle((0, 0, w + 2 * border - 1, h + 2 * border - 1),
                                         radius + border, fill=GREEN + (255,))
    img.alpha_composite(fr, (x0 - border, y0 - border))
    img.alpha_composite(ph, (x0, y0))


def counter(img, i):
    text(img, f"{i}/5", F_SANS, 26, W - 90, 250, SOFT, weight="SemiBold")


# ---------------------------------------------------------------- slides
def s1(P):
    img = cover(P["facade"], W, H, 0.5, 0.4)
    shade(img, 0, 300, 140, 0)
    shade(img, 850, 1180, 0, 235)
    shade(img, 1180, H, 235, 250)
    pill(img, "EXCLUSIVITÉ", 1230)
    text(img, "Elle vient d'arriver.", F_SANS, 72, W / 2, 1360, WHITE, weight="ExtraBold")
    text(img, "Elle ne restera pas.", F_SCRIPT, 80, W / 2, 1460, GREEN, weight="Italic")
    text(img, "LA RIVIÈRE SAINT-LOUIS  ·  LA RÉUNION", F_SANS, 30, W / 2, 1570, SOFT,
         tracking=4, weight="SemiBold")
    counter(img, 1)
    return img


def s2(P):
    img = cover(P["02-sejour"], W, H, 0.35, 0.5)
    shade(img, 0, 560, 245, 235)
    shade(img, 560, 820, 235, 40)
    shade(img, 1500, H, 0, 200)
    text(img, "DEVINE LE PRIX", F_SANS, 46, W / 2, 330, GREEN, tracking=10, weight="Black")
    text(img, "Combien pour cette maison", F_SANS, 64, W / 2, 440, WHITE, weight="ExtraBold")
    text(img, "dans le Sud ?", F_SANS, 64, W / 2, 520, WHITE, weight="ExtraBold")
    text(img, "Réponse dans 2 stories", F_SCRIPT, 50, W / 2, 620, GREEN, weight="Italic")
    counter(img, 2)
    return img


def s3(P):
    img = Image.new("RGBA", (W, H), DARK + (255,))
    bg = cover(P["04-suite-parentale"], W, H).filter(ImageFilter.GaussianBlur(20))
    img.alpha_composite(bg)
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (200,)))
    text(img, "À L'ÉTAGE", F_SANS, 44, W / 2, 300, GREEN, tracking=12, weight="SemiBold")
    text(img, "5", F_SANS, 300, W / 2, 470, WHITE, weight="Black")
    text(img, "CHAMBRES", F_SANS, 84, W / 2, 650, WHITE, tracking=8, weight="ExtraBold")
    framed(img, P["04-suite-parentale"], (80, 760, 1000, 1180))
    framed(img, P["05-chambre-fleurie"], (80, 1220, 530, 1560))
    framed(img, P["03-chambre-bureau"], (550, 1220, 1000, 1560))
    counter(img, 3)
    return img


def s4(P):
    img = cover(P["08-douche-italienne"], W, H, 0.5, 0.5)
    shade(img, 0, H, 215, 215)
    text(img, "LA RÉPONSE", F_SANS, 44, W / 2, 330, GREEN, tracking=12, weight="SemiBold")
    text(img, "435 000 €", F_SANS, 160, W / 2, 480, WHITE, weight="Black")
    text(img, "HAI", F_SANS, 44, W / 2, 600, SOFT, tracking=10, weight="SemiBold")
    bar(img, W / 2, 660, 300, 6, GREEN)
    feats = ["5 chambres à l'étage", "Séjour lumineux, escalier suspendu", "Cuisine équipée",
             "Salles d'eau en pierre naturelle", "Jardin arboré, bassin, parking"]
    for k, s in enumerate(feats):
        y = 750 + k * 78
        f = g.font(F_SANS, 40, "SemiBold")
        bar(img, 200, y + 2, 14, 14, GREEN)
        text(img, s, F_SANS, 40, 235 + f.getlength(s) / 2, y, WHITE, weight="SemiBold")
    text(img, "Tu visites ?", F_SCRIPT, 70, W / 2, 1250, GREEN, weight="Italic")
    counter(img, 4)
    return img


def s5(P):
    img = Image.new("RGBA", (W, H), DARK + (255,))
    bg = cover(P["facade"], W, H).filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(bg)
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (185,)))
    logo = P["logo"]
    lw = 820
    lh = int(lw * logo.height / logo.width)
    lg = logo.resize((lw, lh), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (lw, lh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, lw - 1, lh - 1), 36, fill=255)
    lg.putalpha(m)
    img.alpha_composite(lg, (W // 2 - lw // 2, 340))
    text(img, "VISITE PRIVÉE", F_SANS, 72, W / 2, 860, WHITE, tracking=6, weight="ExtraBold")
    text(img, "sur rendez-vous uniquement", F_SANS, 42, W / 2, 945, SOFT, weight="Medium")
    pill(img, "RÉPONDS « VISITE »", 1080, size=42, h=100)
    text(img, "L'immobilier qui nous relie.", F_SCRIPT, 58, W / 2, 1530, GREEN, weight="Italic")
    text(img, "Honoraires et DPE : nous consulter", F_SANS, 28, W / 2, 1600, (160, 172, 166),
         weight="Regular")
    counter(img, 5)
    return img


def main():
    g.setup()
    P = dict(g.PHOTOS)
    P["facade"] = g.FACADE
    os.makedirs(OUT, exist_ok=True)
    names = ["1-teaser", "2-quiz-prix", "3-cinq-chambres", "4-reponse-prix", "5-contact"]
    for name, fn in zip(names, [s1, s2, s3, s4, s5]):
        path = os.path.join(OUT, f"story-{name}.png")
        fn(P).convert("RGB").save(path, optimize=True)
        print("OK ->", path)


if __name__ == "__main__":
    main()
