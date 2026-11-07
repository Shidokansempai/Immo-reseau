"""Fiche PDF : séance découverte Body Karaté féminin (60 min).

Adaptations : périnée (sans sauts ni crunchs) et calcification de l'épaule.
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = "/usr/share/fonts/truetype/liberation/"
pdfmetrics.registerFont(TTFont("Sans", LIB + "LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("SansB", LIB + "LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("SansI", LIB + "LiberationSans-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Anton", os.path.join(HERE, "..", "video", "fonts", "Anton-Regular.ttf")))

NAVY = colors.HexColor("#1F2A44"); PINK = colors.HexColor("#C2185B"); LPINK = colors.HexColor("#FCE4EC")
GOLD = colors.HexColor("#F3C448"); GREY = colors.HexColor("#F2F3F7"); GREEN = colors.HexColor("#E8F5E9")
ORANGE = colors.HexColor("#FFF3E0")

H1 = ParagraphStyle("h1", fontName="Anton", fontSize=24, leading=28, textColor=NAVY)
SUB = ParagraphStyle("sub", fontName="SansI", fontSize=10.5, leading=14, textColor=colors.HexColor("#555555"))
H2 = ParagraphStyle("h2", fontName="SansB", fontSize=13, leading=17, textColor=colors.white)
H3 = ParagraphStyle("h3", fontName="SansB", fontSize=10.5, leading=14, textColor=PINK, spaceBefore=4)
P = ParagraphStyle("p", fontName="Sans", fontSize=9.5, leading=13)
CELL = ParagraphStyle("cell", fontName="Sans", fontSize=8.8, leading=11.5)
CELLB = ParagraphStyle("cellb", fontName="SansB", fontSize=8.8, leading=11.5, textColor=colors.white)

import re
EMO = {"🟢 ": "", "🟡 ": "", "🩹 ": "", "🌸": "(périnée)", "⚠️ ": "", "📋 ": "", "🎵 ": "", "🚰 ": "", "🔥": "", "❌": "NON –", "⛔": "STOP –", "→": "&gt;"}
def clean(t):
    for k, v in EMO.items(): t = t.replace(k, v)
    return re.sub("[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F]", "", t)
def p(t, s=P): return Paragraph(clean(t), s)

def section(title, time=""):
    t = Table([[p(f"{title}", H2), p(f"<para alignment='right'>{time}</para>", H2)]], colWidths=[105 * mm, 75 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NAVY), ("LEFTPADDING", (0, 0), (-1, -1), 6),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    t.keepWithNext = True
    sp = Spacer(1, 4); sp.keepWithNext = True
    return [Spacer(1, 6), t, sp]

def table(head, rows, widths, shade=None):
    data = [[p(h, CELLB) for h in head]] + [[p(c, CELL) for c in r] for r in rows]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), PINK), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D0D3DC")),
          ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    for i in range(1, len(data)):
        if i % 2 == 0: st.append(("BACKGROUND", (0, i), (-1, i), GREY))
    if shade: st.append(("BACKGROUND", (-1, 1), (-1, -1), shade))
    t.setStyle(TableStyle(st))
    return t

def box(text, bg):
    t = Table([[p(text)]], colWidths=[180 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.6, PINK),
                           ("LEFTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return t

S = []
S += [p("SÉANCE DÉCOUVERTE – BODY KARATÉ FÉMININ", H1),
      p("Fighter Academy Karate · Shidokan Réunion · Le Tampon — 60 min · Sempai Jules", SUB), Spacer(1, 6)]
S.append(table(["Objectifs", "Matériel", "Légende"],
               [["Prendre confiance, se défouler, découvrir les techniques de karaté en musique, sans contact.",
                 "Enceinte + playlist, tenue de sport, eau, serviette, un mur libre.",
                 "Standard · Version ÉPAULE (2 mamans) · Périnée"]], [70, 60, 50]))
S.append(Spacer(1, 6))
S.append(box("<b>⚠️ 2 mamans – calcification de l'épaule :</b> feu vert du médecin/kiné · douleur vive = STOP (gêne max 3/10) · "
             "<b>jamais les bras au-dessus des épaules</b> · gestes lents, bras jamais verrouillés · <b>aucun appui sur les mains</b> · "
             "les jambes travaillent à 100 %. Les placer au 1er rang, sur le côté.<br/>"
             "<b>🌸 Toutes :</b> aucun saut, aucun crunch — gainage en expiration uniquement.", LPINK))

S += section("1. ACCUEIL", "0:00 → 0:05")
S.append(p("• Cercle, prénom + ce qu'elles viennent chercher · • Salut « <b>Osu !</b> » · "
           "• Cadre : « On se défoule, on prend confiance, on respecte son corps. Chacune à son rythme. » · "
           "• Règles : « Si ça fait mal, on arrête ou on fait plus petit · Je montre des versions douces · On boit quand on veut. »"))

S += section("2. ÉCHAUFFEMENT EN MUSIQUE", "0:05 → 0:15 · 115-120 BPM")
S.append(table(["Durée", "Exercice", "🟢 Standard", "🩹 Épaule"], [
    ["2 min", "Marche sur place → step-touch", "Bras qui balancent", "Mains sur les hanches"],
    ["1 min", "Cercles d'épaules", "8 arrière + 8 avant", "Petits haussements seulement"],
    ["1 min", "Mobilité du cou", "Oui / non doucement", "Idem"],
    ["1 min", "Poignets + chevilles", "8 rotations chaque", "Idem"],
    ["1 min", "Cercles de hanches", "8 dans chaque sens", "Idem"],
    ["1 min", "Pendule de l'épaule", "—", "Penchée, appui chaise, bras pendant, petits cercles détendus"],
    ["2 min", "Déplacements en garde (av / arr / côté)", "Garde haute", "Garde basse (poitrine)"],
    ["1 min", "Respiration 🌸", "Expirer en rentrant le ventre + remonter le périnée ×5", "Idem"],
], [15, 50, 55, 60], ORANGE))

S += section("3. APPRENTISSAGE DES TECHNIQUES", "0:15 → 0:25 · tempo lent")
S.append(p("On compte en japonais : <b>ichi, ni, san, shi, go, roku, shichi, hachi</b>."))
S.append(table(["Technique", "🟢 Standard", "🩹 Épaule"], [
    ["<b>Garde</b> – Kamae", "Pieds décalés, poings devant le visage, coudes serrés, menton rentré",
     "<b>Garde basse</b> : poings à hauteur de poitrine, coudes collés, épaules relâchées"],
    ["<b>Direct</b> – Choku / Gyaku-tsuki", "Part de la hanche, rotation au dernier moment, on expire",
     "Hauteur <b>ventre</b>, demi-vitesse, bras tendu aux 3/4, sans claquer. Si douleur : seul le bras sain frappe"],
    ["<b>Blocage haut</b> – Age-uke", "Avant-bras au-dessus du front",
     "<b>Remplacé par Uchi-uke</b> : blocage moyen à hauteur de poitrine, coude près du corps"],
    ["<b>Blocage bas</b> – Gedan-barai", "Balayage devant les cuisses", "Lent, petite amplitude, départ depuis la poitrine"],
    ["<b>Genou</b> – Hiza-geri", "Tirer la cible imaginaire, monter le genou, expirer 🌸", "Mains en garde basse, sans tirer avec les bras"],
    ["<b>Pied</b> – Mae-geri", "Genou → pied → genou → reposer", "Identique (genoux fragiles : coup de pied bas)"],
], [40, 70, 70], ORANGE))

S += section("4. CHORÉGRAPHIE BODY KARATÉ", "0:25 → 0:45 · 125-130 BPM")
S.append(table(["Bloc (8 temps)", "🟢 Standard", "🩹 Épaule"], [
    ["<b>A – Poings</b>", "1-4 : 4 directs alternés visage · 5-8 : 4 directs rapides", "4 directs lents hauteur ventre · puis garde + rebond jambes"],
    ["<b>B – Blocages</b>", "Age-uke G / D · Gedan-barai G / D", "<b>Uchi-uke</b> G / D · Gedan-barai lent G / D"],
    ["<b>C – Genou</b>", "2 hiza-geri D (bras qui tirent) · 2 G", "2 hiza-geri D · 2 G, mains en garde basse"],
    ["<b>D – Pied</b>", "Mae-geri D + garde · Mae-geri G + garde", "Identique, garde basse"],
], [35, 72.5, 72.5], ORANGE))
S.append(Spacer(1, 4))
S.append(table(["Temps", "Étape"], [
    ["0:25 → 0:29", "Apprendre A, le répéter 4 fois"],
    ["0:29 → 0:33", "Apprendre B → enchaîner A + B"],
    ["0:33 → 0:36", "Apprendre C → A + B + C"],
    ["0:36 → 0:39", "Apprendre D → chorégraphie complète A-B-C-D"],
    ["0:39 → 0:40", "🚰 Pause eau"],
    ["0:40 → 0:45", "Chorégraphie complète ×3 en musique, <b>« Kiai ! »</b> collectif à la fin de chaque tour 🔥"],
], [30, 150]))
S.append(Spacer(1, 4))
S.append(box("<b>3 niveaux annoncés à tout le groupe :</b> 🟢 Dynamique (vitesse normale) · 🟡 Doux (demi-vitesse, coups bas) · "
             "🩹 Épaule (bras sous les épaules ou garde seule, jambes à fond).<br/>"
             "<b>Coaching :</b> « On frappe avec le souffle, pas avec la force ! » · « Les bras, c'est vous qui décidez. Les jambes, on y va ! »", GREEN))

S += section("5. MINI SELF-DÉFENSE", "0:45 → 0:52")
S.append(table(["Exercice", "🟢 Standard", "🩹 Épaule"], [
    ["<b>Posture + voix</b> (2 min)", "Mains ouvertes, paumes en avant, « <b>STOP !</b> » ×3", "Mains à hauteur de poitrine, bras non tendus"],
    ["<b>Dégagement de poignet</b> (3 min, par deux, lent)", "Tourner vers le pouce de l'agresseur, reculer",
     "<b>Bras sain uniquement</b>, ou geste à vide. Aucune traction sur l'épaule"],
    ["<b>Réflexe essentiel</b> (2 min)", "Se protéger, créer la distance, partir, appeler à l'aide", "Idem"],
], [45, 67.5, 67.5], ORANGE))

S += section("6. RETOUR AU CALME", "0:52 → 0:58 · musique douce")
S.append(table(["Étirement", "🟢 Standard", "🩹 Épaule"], [
    ["Quadriceps", "Debout, cheville en main, 20 s / jambe", "Appui au mur avec le bras sain"],
    ["Ischios", "Jambe devant, buste penché, 20 s", "Idem"],
    ["Mollets", "Contre le mur, 20 s / jambe", "Mains au mur à hauteur de poitrine"],
    ["Pectoraux", "Mains jointes dans le dos", "<b>Remplacé</b> : roulements doux des épaules vers l'arrière"],
    ["Épaules", "Bras croisé devant la poitrine, 20 s", "<b>À éviter</b> côté atteint → pendule doux"],
    ["Gainage 🌸", "Dos au mur, expirer en rentrant le ventre ×5", "Idem"],
    ["Respiration", "Yeux fermés, inspirer 4 s / expirer 6 s, 1 min", "Idem"],
], [30, 75, 75], ORANGE))

S += section("7. CLÔTURE", "0:58 → 1:00")
S.append(p("• Cercle : « Un mot pour votre séance ? » · • Salut « <b>Osu !</b> » · "
           "• <b>En privé aux 2 mamans</b> : « Comment s'est sentie votre épaule ? » (noter pour la suite) · "
           "• À toutes : prochain cours, tenue, eau, <b>certificat médical</b> pour l'inscription."))

S.append(Spacer(1, 6))
S.append(KeepTogether([p("<b>📋 MÉMO RAPIDE</b>", H3), table(["Situation", "Réflexe"], [
    ["Bras au-dessus des épaules", "❌ Interdit pour les 2 mamans → Uchi-uke / garde basse"],
    ["Frappes de bras", "🩹 Hauteur ventre, lentes, sans verrouiller"],
    ["Appuis sur les mains", "❌ Pas de planche ni de 4 pattes → gainage au mur"],
    ["Sauts", "❌ Pour tout le monde (périnée)"],
    ["Abdos", "❌ Pas de crunch → gainage en expiration"],
    ["Douleur vive", "⛔ Arrêt immédiat du mouvement"],
], [60, 120])]))
S.append(Spacer(1, 6))
S.append(p("<b>🎵 Musique :</b> échauffement 115-120 BPM (pop, afro douce) · chorégraphie 125-130 BPM (pop énergique, dancehall, séga/maloya rythmé) · "
           "retour au calme 60-80 BPM (piano, lo-fi japonais). Recherche : « cardio boxing 128 BPM »."))
S.append(Spacer(1, 4))
S.append(p("<i>Adaptations = précautions générales. L'avis du médecin ou du kiné de chaque participante passe avant tout. "
           "En cas de crise douloureuse de l'épaule : pas de travail des bras.</i>", SUB))

def deco(c, d):
    c.saveState(); c.setFillColor(PINK); c.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    c.setFont("Sans", 8); c.setFillColor(colors.grey)
    c.drawString(15 * mm, 8 * mm, "Fighter Academy Karate · Shidokan Réunion · Cours féminin")
    c.drawRightString(A4[0] - 15 * mm, 8 * mm, f"Page {d.page}"); c.restoreState()

out = os.path.join(HERE, "Seance_decouverte_Body_Karate_feminin.pdf")
SimpleDocTemplate(out, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=15 * mm,
                  title="Séance découverte Body Karaté féminin").build(S, onFirstPage=deco, onLaterPages=deco)
print(out)
