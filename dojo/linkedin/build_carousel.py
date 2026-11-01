"""Carrousel LinkedIn (PDF document) – Shidokan Challenge 974.

8 slides 1080x1350, exportées en PNG et assemblées en un PDF à publier
comme « document » sur LinkedIn.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
UP = "/root/.claude/uploads/83aa149a-6326-504e-9f14-df0139aaabca/"
FONTS = os.path.join(HERE, "..", "video", "fonts")
ANTON = os.path.join(FONTS, "Anton-Regular.ttf")
BEBAS = os.path.join(FONTS, "BebasNeue-Regular.ttf")
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SANSB = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SANSI = "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"
OUT = os.path.join(HERE, "slides"); os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1350
NAVY = (14, 21, 38); NAVY2 = (6, 9, 18)
GOLD = (243, 196, 72); WHITE = (255, 255, 255); GREY = (200, 205, 218); RED = (214, 40, 48)
N = 8

def font(path, size): return ImageFont.truetype(path, size)

def photo(name):
    ext = ".png" if name == "4b3874de" else ".jpg"
    return ImageOps.exif_transpose(Image.open(UP + name + "-image" + ext)).convert("RGB")

def base():
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(NAVY[i] * (1 - t) + NAVY2[i] * t) for i in range(3)))
    return img.convert("RGBA")

def cover_into(img, im, box, fx=0.5, fy=0.5, fade_bottom=True):
    x0, y0, x1, y1 = box; w, h = x1 - x0, y1 - y0; r = w / h
    if im.width / im.height > r: ch = im.height; cw = ch * r
    else: cw = im.width; ch = cw / r
    cx = min(max(fx * im.width, cw / 2), im.width - cw / 2)
    cy = min(max(fy * im.height, ch / 2), im.height - ch / 2)
    ph = im.resize((w, h), Image.LANCZOS, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))
    ph = ImageEnhance.Contrast(ph).enhance(1.06).convert("RGBA")
    if fade_bottom:
        m = Image.new("L", (w, h), 255); md = ImageDraw.Draw(m)
        for yy in range(h):
            t = yy / h
            md.line([(0, yy), (w, yy)], fill=int(255 * (1 - max(0, (t - 0.55) / 0.45) ** 1.2)))
        ph.putalpha(m)
    img.alpha_composite(ph, (x0, y0))

def box(img, rect, fill, outline=None, width=2, radius=20):
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rounded_rectangle(rect, radius, fill=fill, outline=outline, width=width)
    img.alpha_composite(ov)

def text(d, xy, s, f, fill=WHITE, anchor="la"):
    d.text(xy, s, font=f, fill=fill, anchor=anchor)

def wrap(d, s, f, maxw):
    words, lines, cur = s.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def para(d, xy, s, f, fill=WHITE, maxw=920, lh=1.35, anchor="la"):
    x, y = xy
    for ln in wrap(d, s, f, maxw):
        d.text((x, y), ln, font=f, fill=fill, anchor=anchor)
        y += int(f.size * lh)
    return y

def chrome(img, i):
    d = ImageDraw.Draw(img)
    text(d, (60, 52), "SHIDOKAN CHALLENGE 974  ·  LE TAMPON", font(BEBAS, 34), GOLD)
    text(d, (W - 60, 52), f"{i}/{N}", font(BEBAS, 34), GREY, "ra")
    d.line([(60, H - 92), (W - 60, H - 92)], fill=(255, 255, 255, 60), width=2)
    text(d, (60, H - 70), "JULES  ·  Conseiller immobilier & Sempai, Fighter Academy Karate", font(SANS, 24), GREY)
    if i < N: text(d, (W - 60, H - 72), "SWIPE  >", font(BEBAS, 32), GOLD, "ra")

def lesson(i, num, title_lines, body, office, ph, fx=0.5, fy=0.5):
    img = base()
    cover_into(img, photo(ph), (0, 100, W, 600), fx, fy)
    d = ImageDraw.Draw(img)
    text(d, (60, 560), f"LEÇON {num}", font(BEBAS, 54), GOLD)
    y = 625
    for ln in title_lines:
        text(d, (60, y), ln, font(ANTON, 76)); y += 90
    d.rectangle((60, y + 30, 200, y + 36), fill=RED)
    y = para(d, (60, y + 65), body, font(SANS, 36), WHITE, 960)
    box_top = y + 25
    lines = wrap(d, office, font(SANSI, 32), 880)
    box_h = 70 + len(lines) * 44
    box(img, (60, box_top, W - 60, box_top + box_h), (255, 255, 255, 18), GOLD, 2, 18); d = ImageDraw.Draw(img)
    text(d, (90, box_top + 20), "AU BUREAU", font(BEBAS, 32), GOLD)
    yy = box_top + 58
    for ln in lines:
        text(d, (90, yy), ln, font(SANSI, 32), GREY); yy += 44
    chrome(img, i)
    return img

slides = []

# 1 — couverture
img = base()
cover_into(img, photo("d9b6c08c"), (0, 100, W, 760), 0.5, 0.45)
d = ImageDraw.Draw(img)
y = 690
for ln in ["J'AI ORGANISÉ UN", "ÉVÉNEMENT DE", "40 COMBATTANTS."]:
    text(d, (60, y), ln, font(ANTON, 96)); y += 112
d.rectangle((60, y + 32, 220, y + 40), fill=RED)
y = para(d, (60, y + 70), "Voici 3 leçons que le tatami m'a (encore) apprises.", font(SANSB, 44), GOLD, 960)
chrome(img, 1); slides.append(img)

# 2 — le défi en chiffres
img = base(); d = ImageDraw.Draw(img)
text(d, (60, 150), "LE DÉFI", font(BEBAS, 60), GOLD)
text(d, (60, 215), "DIMANCHE 25 OCTOBRE", font(ANTON, 80))
text(d, (60, 315), "Gymnase du 12ème km, Le Tampon", font(SANSI, 36), GREY)
tiles = [("40", "combattants\nde 5 ans aux vétérans"), ("3", "disciplines\nde combat"), ("2", "aires de\ncombat"),
         ("16", "arbitres"), ("20", "bénévoles"), ("1H30", "pour monter\ntoute la salle")]
tw, th = 465, 250
for k, (n, lab) in enumerate(tiles):
    cx = 60 + (k % 2) * (tw + 30); cy = 400 + (k // 2) * (th + 25)
    box(img, (cx, cy, cx + tw, cy + th), (255, 255, 255, 14), (255, 255, 255, 60), 2, 20); d = ImageDraw.Draw(img)
    text(d, (cx + 35, cy + 25), n, font(ANTON, 110), GOLD)
    yy = cy + 160
    for ln in lab.split("\n"):
        text(d, (cx + 38, yy - 10), ln, font(SANS, 32), WHITE); yy += 38
chrome(img, 2); slides.append(img)

# 3-5 — les leçons
slides.append(lesson(3, 1, ["LA PRÉPARATION", "FAIT LA DIFFÉRENCE"],
    "Le jour J, on n'improvise pas : on exécute. Rôles attribués, plan de salle dessiné à l'avance, chaque minute prévue. Accès à 7h30, coup d'envoi à 9h00 pile.",
    "Une vente ou un dossier de financement se gagne avant le rendez-vous, jamais pendant.", "f1ded2d0", 0.47, 0.45))
slides.append(lesson(4, 2, ["UNE ÉQUIPE ENGAGÉE", "VAUT PLUS QU'UN BUDGET"],
    "20 bénévoles, 16 arbitres, des parents pâtissiers. Personne n'était payé. Tout le monde était là, du montage au dernier tatami rangé.",
    "On ne manage pas des tâches : on embarque des personnes autour d'un objectif commun.", "3f818896", 0.5, 0.35))
slides.append(lesson(5, 3, ["LA CONFIANCE SE", "CONSTRUIT SUR LE TERRAIN"],
    "La Ville, la Ligue, nos sponsors : ils nous ont suivis parce qu'on a tenu parole. Et l'élu aux sports s'est déplacé pour nous.",
    "La confiance ne se décrète pas. Elle se prouve, engagement après engagement.", "7262a192", 0.56, 0.4))

# 6 — fierté : les élèves
img = base()
cover_into(img, photo("ceeeefcd"), (0, 100, W, 760), 0.52, 0.45)
d = ImageDraw.Draw(img)
text(d, (60, 700), "MA PLUS GRANDE FIERTÉ", font(BEBAS, 56), GOLD)
y = 765
for ln in ["CE N'EST PAS L'ORGA.", "CE SONT MES ÉLÈVES."]:
    text(d, (60, y), ln, font(ANTON, 82)); y += 98
d.rectangle((60, y + 30, 200, y + 36), fill=RED)
para(d, (60, y + 65), "De 5 ans aux vétérans, ils sont montés sur le tatami avec le trac et en sont redescendus grandis. Médaille ou non, chacun a gagné la confiance en soi.",
     font(SANS, 36), WHITE, 960)
chrome(img, 6); slides.append(img)

# 7 — merci
img = base(); d = ImageDraw.Draw(img)
text(d, (W // 2, 170), "MERCI", font(ANTON, 150), GOLD, "ma")
poster = photo("4b3874de")
cx, cy, r = 1122, 103, 79
lig = poster.crop((cx - r, cy - r, cx + r, cy + r)).resize((300, 300), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 120, 2)).convert("RGBA")
m = Image.new("L", (1200, 1200), 0); ImageDraw.Draw(m).ellipse((6, 6, 1194, 1194), fill=255)
lig.putalpha(m.resize((300, 300), Image.LANCZOS))
tp = poster.crop((1040, 222, 1206, 362)).resize((356, 300), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 100, 2)).convert("RGBA")
tm = Image.new("L", tp.size, 0); ImageDraw.Draw(tm).rounded_rectangle((0, 0, tp.width, tp.height), 24, fill=255); tp.putalpha(tm)
img.alpha_composite(lig, (170, 390)); img.alpha_composite(tp, (W - 170 - 356, 390))
d = ImageDraw.Draw(img)
text(d, (320, 715), "Ligue Réunion de Karaté", font(SANSB, 30), WHITE, "ma")
text(d, (W - 348, 715), "Ville du Tampon", font(SANSB, 30), WHITE, "ma")
y = 810
for ln, col, f in [("M. Dominique Lebot, élu aux sports", WHITE, font(SANS, 36)),
                   ("Nos sponsors L'Assiette Fleurie & DTTP Réunion", WHITE, font(SANS, 36)),
                   ("Les clubs invités, nos frères d'armes", WHITE, font(SANS, 36)),
                   ("Les 16 arbitres et les 20 bénévoles", WHITE, font(SANS, 36)),
                   ("Sensei Fabrice Levis, pour sa confiance", GOLD, font(SANSB, 36))]:
    text(d, (W // 2, y), ln, f, col, "ma"); y += 62
chrome(img, 7); slides.append(img)

# 8 — conclusion / appel à commenter
img = base(); d = ImageDraw.Draw(img)
y = 260
for ln, col in [("DISCIPLINE.", WHITE), ("RESPECT.", WHITE), ("ENGAGEMENT.", GOLD)]:
    text(d, (60, y), ln, font(ANTON, 120), col); y += 140
d.rectangle((60, y + 32, 220, y + 40), fill=RED)
y = para(d, (60, y + 70), "Au dojo comme dans mon métier, je n'ai jamais trouvé de meilleure méthode.", font(SANSB, 42), WHITE, 960)
box(img, (60, y + 40, W - 60, y + 210), (243, 196, 72, 30), GOLD, 3, 22); d = ImageDraw.Draw(img)
para(d, (100, y + 72), "Et vous, quelle passion nourrit votre façon de travailler ? Dites-le moi en commentaire.", font(SANSI, 38), GOLD, 880)
yy = H - 215
for ln in ["Conseiller immobilier & manager – Immo Réseau", "Mandataire en courtage – 2L Courtage",
           "Sempai – Fighter Academy Karate, Le Tampon"]:
    text(d, (60, yy), ln, font(SANS, 28), GREY); yy += 38
chrome(img, 8); slides.append(img)

rgb = [s.convert("RGB") for s in slides]
for k, s in enumerate(rgb, 1):
    s.save(os.path.join(OUT, f"{k:02d}.jpg"), quality=92)
rgb[0].save(os.path.join(HERE, "Carrousel_LinkedIn_Shidokan_Challenge_974.pdf"), save_all=True, append_images=rgb[1:], resolution=144)
sheet = Image.new("RGB", (216 * 4, 270 * 2))
for k, s in enumerate(rgb):
    sheet.paste(s.resize((216, 270)), ((k % 4) * 216, (k // 4) * 270))
sheet.save(os.path.join(HERE, "apercu.jpg"))
print("ok")
