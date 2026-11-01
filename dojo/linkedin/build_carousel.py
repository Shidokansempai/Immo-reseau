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
N = 9

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
    text(d, (60, H - 70), "JULES FRAYNAL  ·  Co-directeur, Fighter Academy Karate – Shidokan Réunion", font(SANS, 24), GREY)
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
    text(d, (90, box_top + 20), "LEÇON DE LEADERSHIP", font(BEBAS, 32), GOLD)
    yy = box_top + 58
    for ln in lines:
        text(d, (90, yy), ln, font(SANSI, 32), GREY); yy += 44
    chrome(img, i)
    return img

slides = []

# 1 — couverture
img = base()
cover_into(img, photo("d9b6c08c"), (0, 100, W, 720), 0.5, 0.45)
d = ImageDraw.Draw(img)
y = 650
for ln, col in [("UN GYMNASE DE VOLLEY", WHITE), ("EST DEVENU UNE", WHITE), ("ARÈNE DE COMBAT.", GOLD)]:
    text(d, (60, y), ln, font(ANTON, 92), col); y += 108
d.rectangle((60, y + 32, 220, y + 40), fill=RED)
para(d, (60, y + 70), "Ce que l'organisation du Shidokan Challenge 974 m'a appris sur le leadership.", font(SANSB, 40), WHITE, 960)
chrome(img, 1); slides.append(img)

# 2 — le défi en chiffres
img = base(); d = ImageDraw.Draw(img)
text(d, (60, 150), "LE DÉFI", font(BEBAS, 60), GOLD)
text(d, (60, 215), "DIMANCHE 25 OCTOBRE", font(ANTON, 80))
text(d, (60, 315), "Gymnase du 12ème km, Le Tampon  ·  Entrée libre de 9h à 15h", font(SANSI, 32), GREY)
tiles = [("63", "carrés de tatami\nposés à la main"), ("40", "combattants\nde 5 ans aux vétérans"),
         ("5", "clubs de l'île\nréunis"), ("2", "aires de\ncombat"),
         ("16", "arbitres\nformés en amont"), ("20", "bénévoles\nmobilisés")]
tw, th = 465, 250
for k, (n, lab) in enumerate(tiles):
    cx = 60 + (k % 2) * (tw + 30); cy = 400 + (k // 2) * (th + 25)
    box(img, (cx, cy, cx + tw, cy + th), (255, 255, 255, 14), (255, 255, 255, 60), 2, 20); d = ImageDraw.Draw(img)
    text(d, (cx + 35, cy + 25), n, font(ANTON, 110), GOLD)
    yy = cy + 160
    for ln in lab.split("\n"):
        text(d, (cx + 38, yy - 10), ln, font(SANS, 32), WHITE); yy += 38
chrome(img, 2); slides.append(img)

# 3 — citation « ce que personne ne voit »
img = base()
cover_into(img, photo("f1ded2d0"), (0, 100, W, H - 100), 0.47, 0.5, fade_bottom=False)
ov = Image.new("RGBA", (W, H), (6, 9, 18, 200)); img.alpha_composite(ov)
d = ImageDraw.Draw(img)
y = 380
for ln in ["VU DES TRIBUNES,", "C'EST UNE JOURNÉE."]:
    text(d, (60, y), ln, font(ANTON, 96)); y += 112
y += 40
for ln in ["VU DE L'ORGANISATION,", "CE SONT DES MOIS", "DE TRAVAIL QUE", "PERSONNE NE VOIT."]:
    text(d, (60, y), ln, font(ANTON, 96), GOLD); y += 112
chrome(img, 3); slides.append(img)

# 4-6 — les leçons
slides.append(lesson(4, 1, ["ANTICIPER,", "TOUJOURS."],
    "Une salle municipale, du matériel, des arbitres, un encadrement médical : tout se réserve et se vérifie des mois à l'avance.",
    "Le jour J, on n'improvise pas. On exécute.", "f1ded2d0", 0.47, 0.45))
slides.append(lesson(5, 2, ["FORMER AVANT", "D'EXIGER."],
    "Nos arbitres ont été préparés en amont, avec des règles claires pour chaque discipline, y compris des règles adaptées aux plus jeunes.",
    "Un cadre précis, c'est ce qui permet à chacun de s'engager à fond, en sécurité.", "61ff0e1e", 0.42, 0.55))
slides.append(lesson(6, 3, ["FÉDÉRER PLUTÔT", "QUE DIRIGER."],
    "Des clubs différents, des bénévoles, une collectivité : personne n'est obligé de vous suivre.",
    "Ils viennent parce que le projet est clair et que la parole est tenue.", "3f818896", 0.5, 0.35))

# 7 — fierté : les élèves
img = base()
cover_into(img, photo("ceeeefcd"), (0, 100, W, 760), 0.52, 0.45)
d = ImageDraw.Draw(img)
text(d, (60, 700), "MA PLUS GRANDE FIERTÉ", font(BEBAS, 56), GOLD)
y = 765
for ln in ["CE N'EST PAS L'ORGA.", "CE SONT MES ÉLÈVES."]:
    text(d, (60, y), ln, font(ANTON, 82)); y += 98
d.rectangle((60, y + 30, 200, y + 36), fill=RED)
para(d, (60, y + 65), "Ils sont montés sur le tatami avec le trac et en sont redescendus grandis. Médaille ou non, chacun a gagné la confiance en soi.",
     font(SANS, 36), WHITE, 960)
chrome(img, 7); slides.append(img)

# 8 — merci
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
y = 800
for ln, col, f in [("Sensei Fabrice Levis", GOLD, font(SANSB, 38)),
                   ("Les 5 clubs participants", WHITE, font(SANS, 36)),
                   ("Les 16 arbitres et les 20 bénévoles", WHITE, font(SANS, 36)),
                   ("M. Dominique Lebot, élu aux sports", WHITE, font(SANS, 36)),
                   ("L'Assiette Fleurie & DTTP Réunion", WHITE, font(SANS, 36))]:
    text(d, (W // 2, y), ln, f, col, "ma"); y += 62
chrome(img, 8); slides.append(img)

# 9 — la phrase finale
img = base(); d = ImageDraw.Draw(img)
y = 230
for ln in ["ON NE GAGNE PAS", "LE COMBAT", "LE JOUR J."]:
    text(d, (60, y), ln, font(ANTON, 116)); y += 134
y += 30
for ln in ["ON LE GAGNE DANS TOUTES", "LES HEURES OÙ PERSONNE", "NE REGARDE."]:
    text(d, (60, y), ln, font(ANTON, 72), GOLD); y += 86
d.rectangle((60, y + 30, 220, y + 38), fill=RED)
text(d, (60, y + 70), "La suite se prépare déjà.  OSU.", font(SANSB, 42), WHITE)
yy = H - 215
for ln in ["Jules Fraynal", "Co-directeur – Fighter Academy Karate · Shidokan Réunion", "Le Tampon, La Réunion"]:
    text(d, (60, yy), ln, font(SANS, 28), GREY); yy += 38
chrome(img, 9); slides.append(img)

rgb = [s.convert("RGB") for s in slides]
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
for k, s in enumerate(rgb, 1):
    s.save(os.path.join(OUT, f"{k:02d}.jpg"), quality=92)
rgb[0].save(os.path.join(HERE, "Carrousel_LinkedIn_Shidokan_Challenge_974.pdf"), save_all=True, append_images=rgb[1:], resolution=144)
sheet = Image.new("RGB", (216 * 5, 270 * 2), NAVY2)
for k, s in enumerate(rgb):
    sheet.paste(s.resize((216, 270)), ((k % 5) * 216, (k // 5) * 270))
sheet.save(os.path.join(HERE, "apercu.jpg"))
print("ok")
