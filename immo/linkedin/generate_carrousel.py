"""Carrousel LinkedIn — « Faites vous-même le plan de votre vie » (Robert Collier).

Génère 5 visuels 1080x1350 (PNG) + un PDF prêt à publier en « document » LinkedIn.

Usage :  python3 generate_carrousel.py
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "video"))
import generate_video as g  # noqa: E402  (polices, logo, helper texte)
from generate_video import DARK, F_SANS, F_SCRIPT, GREEN, SOFT, WHITE  # noqa: E402

W, H = 1080, 1350
PH = os.path.join(HERE, "photos")
OUT = os.path.join(HERE, "carrousel")


def photo(name):
    return ImageOps.exif_transpose(Image.open(os.path.join(PH, name))).convert("RGB")


def crop_frac(im, box, size):
    """Recadre selon des fractions (x0, y0, x1, y1) puis redimensionne."""
    w, h = im.size
    b = (int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h))
    return im.resize(size, Image.LANCZOS, box=b).convert("RGBA")


def grad(img, y0, y1, a0, a1, color=DARK):
    layer = Image.new("RGBA", (W, y1 - y0))
    d = ImageDraw.Draw(layer)
    for y in range(y1 - y0):
        a = a0 + (a1 - a0) * (y / max(1, y1 - y0 - 1))
        d.line([(0, y), (W, y)], fill=color + (int(a),))
    img.alpha_composite(layer, (0, y0))


def t(img, s, path, size, cy, fill=WHITE, weight="Bold", tracking=0, cx=W / 2, max_w=W - 150,
      shadow=True):
    g.text(img, s, path, size, cx, cy, fill, tracking=tracking, weight=weight, max_w=max_w,
           shadow=shadow)


def left(img, s, path, size, x, cy, fill=WHITE, weight="Bold"):
    f = g.font(path, size, weight)
    g.text(img, s, path, size, x + f.getlength(s) / 2, cy, fill, weight=weight, max_w=W)


def footer(img, i, n=5):
    """Pied de page : signature + pagination."""
    bar = Image.new("RGBA", (W, 90), DARK + (235,))
    img.alpha_composite(bar, (0, H - 90))
    ImageDraw.Draw(img).rectangle((0, H - 90, W, H - 86), fill=GREEN + (255,))
    left(img, "IMMO RÉSEAU  ·  LA RÉUNION", F_SANS, 24, 60, H - 44, SOFT, "SemiBold")
    f = g.font(F_SANS, 24, "SemiBold")
    s = f"{i}/{n}" + ("   →" if i < n else "")
    g.text(img, s, F_SANS, 24, W - 60 - f.getlength(s) / 2, H - 44, GREEN, weight="SemiBold")


# ---------------------------------------------------------------- slides
def s1():
    img = crop_frac(photo("livre-lagon.jpg"), (0, 0.075, 1, 0.778), (W, H))
    grad(img, 0, 330, 200, 150)
    grad(img, 330, 470, 150, 0)
    t(img, "CHAPITRE 31", F_SANS, 28, 80, GREEN, "SemiBold", tracking=8)
    t(img, "« Faites vous-même", F_SCRIPT, 80, 170, WHITE, "Italic")
    t(img, "le plan de votre vie. »", F_SCRIPT, 80, 265, WHITE, "Italic")
    t(img, "ROBERT COLLIER  ·  LE SECRET ÉTERNEL", F_SANS, 24, 355, WHITE, "SemiBold", tracking=4)
    footer(img, 1)
    return img


def s2():
    src = photo("chapitre-31.jpg")
    img = crop_frac(src, (0.3, 0, 0.7, 1), (W, H)).filter(ImageFilter.GaussianBlur(18))
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (170,)))
    box = (0.22, 0.28, 0.86, 1.0)
    cw = W - 80
    chh = int(cw * (box[3] - box[1]) * src.height / ((box[2] - box[0]) * src.width))
    card = crop_frac(src, box, (cw, chh))
    ch = card.height
    m = Image.new("L", card.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, card.width - 1, ch - 1), 28, fill=255)
    card.putalpha(m)
    img.alpha_composite(card, (40, 170))
    y = 170 + ch
    t(img, "Un livre jauni. Un dimanche au bord du lagon.", F_SANS, 34, y + 110, SOFT, "Medium")
    t(img, "Et une phrase qui vaut", F_SANS, 62, y + 200, WHITE, "ExtraBold")
    t(img, "tous les plans d'action.", F_SANS, 62, y + 280, GREEN, "ExtraBold")
    footer(img, 2)
    return img


def s3():
    bg = crop_frac(photo("livre-couverture.jpg"), (0, 0.2, 1, 0.9), (W, H)).filter(
        ImageFilter.GaussianBlur(16))
    img = bg
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (215,)))
    t(img, "CE QUE LE TATAMI M'A APPRIS", F_SANS, 30, 330, GREEN, "SemiBold", tracking=6)
    ImageDraw.Draw(img).rectangle((W / 2 - 60, 372, W / 2 + 60, 377), fill=GREEN + (255,))
    t(img, "On ne gagne pas le combat", F_SANS, 68, 500, WHITE, "ExtraBold")
    t(img, "le jour du combat.", F_SANS, 68, 590, WHITE, "ExtraBold")
    t(img, "On le gagne à l'entraînement,", F_SCRIPT, 66, 760, GREEN, "Italic")
    t(img, "quand personne ne regarde.", F_SCRIPT, 66, 845, GREEN, "Italic")
    footer(img, 3)
    return img


def s4():
    img = Image.new("RGBA", (W, H), DARK + (255,))
    bg = crop_frac(photo("livre-lagon.jpg"), (0, 0.1, 1, 0.45), (W, H)).filter(
        ImageFilter.GaussianBlur(10))
    img.alpha_composite(bg)
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (205,)))
    t(img, "L'immobilier,", F_SANS, 84, 300, WHITE, "ExtraBold")
    t(img, "c'est pareil.", F_SCRIPT, 92, 400, GREEN, "Italic")
    items = [("Un mandat se gagne", "avant le rendez-vous."),
             ("Une vente se prépare", "avant la première visite."),
             ("Une carrière se construit", "avant d'avoir des résultats.")]
    for k, (a, b) in enumerate(items):
        y = 560 + k * 190
        box = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(box)
        bd.rounded_rectangle((90, y - 20, 990, y + 140), 24, fill=(255, 255, 255, 22),
                             outline=GREEN + (140,), width=2)
        bd.rectangle((90, y - 20, 100, y + 140), fill=GREEN + (255,))
        img.alpha_composite(box)
        left(img, a, F_SANS, 44, 140, y + 25, WHITE, "ExtraBold")
        left(img, b, F_SANS, 40, 140, y + 90, SOFT, "Medium")
    footer(img, 4)
    return img


def s5():
    img = Image.new("RGBA", (W, H), DARK + (255,))
    bg = crop_frac(photo("livre-lagon.jpg"), (0, 0.12, 1, 0.62), (W, H)).filter(
        ImageFilter.GaussianBlur(6))
    img.alpha_composite(bg)
    img.alpha_composite(Image.new("RGBA", (W, H), DARK + (190,)))
    t(img, "La vraie question n'est pas", F_SANS, 42, 260, SOFT, "Medium")
    t(img, "« Est-ce le bon moment ? »", F_SCRIPT, 62, 345, SOFT, "Italic")
    t(img, "C'est :", F_SANS, 42, 470, WHITE, "Medium")
    t(img, "QUEL EST", F_SANS, 120, 590, WHITE, "Black", tracking=4)
    t(img, "VOTRE PLAN ?", F_SANS, 120, 720, GREEN, "Black", tracking=4)
    # logo
    logo = Image.open(os.path.join(HERE, "..", "video", "photos", "00-banniere.png")).convert("RGB")
    logo = logo.crop((575, 10, 1300, 375))
    lw = 560
    lh = int(lw * logo.height / logo.width)
    lg = logo.resize((lw, lh), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (lw, lh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, lw - 1, lh - 1), 28, fill=255)
    lg.putalpha(m)
    img.alpha_composite(lg, (W // 2 - lw // 2, 840))
    t(img, "Parlons-en en message privé", F_SANS, 38, 840 + lh + 70, WHITE, "SemiBold")
    footer(img, 5)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    pages = []
    for i, fn in enumerate([s1, s2, s3, s4, s5], 1):
        im = fn().convert("RGB")
        path = os.path.join(OUT, f"slide-{i}.png")
        im.save(path, optimize=True)
        pages.append(im)
        print("OK ->", path)
    pdf = os.path.join(OUT, "carrousel-linkedin-plan-de-vie.pdf")
    pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=150)
    print("OK ->", pdf)


if __name__ == "__main__":
    main()
