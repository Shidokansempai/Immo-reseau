"""Génère le budget prévisionnel (format Cerfa 12156) de la Fighter Academy Karate.

Deux scénarios : subvention Ville du Tampon de 5 000 € et de 10 000 €.
Les cellules jaunes de l'onglet « Hypothèses » sont des exemples à remplacer
par les vrais chiffres du club ; tout le budget se recalcule.
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

OUT = sys.argv[1] if len(sys.argv) > 1 else "Budget_previsionnel_2026-2027_brut.xlsx"

NAVY = "1F2A44"; GOLD = "F3C448"; RED = "C62828"
YELLOW = PatternFill("solid", fgColor="FFF4C2")
HEAD = PatternFill("solid", fgColor=NAVY)
SECTION = PatternFill("solid", fgColor="E8EAF1")
TOTAL = PatternFill("solid", fgColor="F3C448")
thin = Side(style="thin", color="C8CCD8")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
EUR = '#,##0 "€";[Red]-#,##0 "€"'

wb = Workbook()

# ---------------------------------------------------------------- Hypothèses
h = wb.active
h.title = "Hypothèses"
h["A1"] = "HYPOTHÈSES – à remplacer par les vrais chiffres du club (cellules jaunes)"
h["A1"].font = Font(bold=True, size=13, color=NAVY)
h["A2"] = "Les montants ci-dessous sont des EXEMPLES. Modifiez-les : le budget prévisionnel se recalcule automatiquement."
h["A2"].font = Font(italic=True, color="666666")

hyp = [
    ("Adhérents", None, None),
    ("Nombre d'adhérents babies", 10, "nb"),
    ("Cotisation annuelle baby", 239, "eur"),
    ("Nombre d'adhérents enfants", 30, "nb"),
    ("Cotisation annuelle enfant", 259, "eur"),
    ("Nombre d'adhérents ados / adultes / vétérans", 23, "nb"),
    ("Cotisation annuelle ado / adulte", 339, "eur"),
    ("Fonctionnement courant", None, None),
    ("Prix de la licence fédérale par adhérent", 39, "eur"),
    ("Affiliation Shidokan par adhérent", 21, "eur"),
    ("Assurance de l'association", 400, "eur"),
    ("Déplacements en compétition (transport, engagements)", 0, "eur"),
    ("Matériel courant et pharmacie", 1200, "eur"),
    ("Défraiements des encadrants (kilomètres, frais)", 0, "eur"),
    ("Frais bancaires, téléphone, site internet", 300, "eur"),
    ("Événement et partenaires", None, None),
    ("Recettes buvette (Shidokan Challenge)", 900, "eur"),
    ("Achats buvette", 300, "eur"),
    ("Sponsors / mécénat (L'Assiette Fleurie, DTTP Réunion…)", 500, "eur"),
    ("Contributions en nature (valorisation)", None, None),
    ("Heures d'utilisation de la salle municipale par an", 216, "nb"),
    ("Valeur horaire de la mise à disposition de la salle", 20, "eur"),
    ("Heures de bénévolat par an (encadrement + événements)", 650, "nb"),
    ("Valeur horaire du bénévolat (base SMIC – à vérifier)", 12, "eur"),
]
REF = {}
r = 4
for label, val, kind in hyp:
    if val is None:
        h.cell(r, 1, label).font = Font(bold=True, color="FFFFFF")
        h.cell(r, 1).fill = HEAD
        h.cell(r, 2).fill = HEAD
    else:
        h.cell(r, 1, label).border = BOX
        c = h.cell(r, 2, val)
        c.fill = YELLOW; c.border = BOX
        c.number_format = EUR if kind == "eur" else "#,##0"
        REF[label] = f"Hypothèses!$B${r}"
    r += 1
h.column_dimensions["A"].width = 62
h.column_dimensions["B"].width = 16

def R(label):
    return REF[label]

# ---------------------------------------------------------------- Budget
b = wb.create_sheet("Budget prévisionnel", 0)
b["A1"] = "FIGHTER ACADEMY KARATE – SHIDOKAN RÉUNION"
b["A1"].font = Font(bold=True, size=14, color=NAVY)
b["A2"] = "Budget prévisionnel – Saison 2026-2027 (format Cerfa n°12156)"
b["A2"].font = Font(bold=True, size=12)
b["A3"] = "Demande de subvention de fonctionnement à la Ville du Tampon"
b["A3"].font = Font(italic=True, color="555555")

hdr = ["Compte", "Libellé", "Scénario 5 000 €", "Scénario 10 000 €"]
for j, t in enumerate(hdr, 1):
    c = b.cell(5, j, t)
    c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD; c.border = BOX
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

row = 6
def section(title):
    global row
    for j in range(1, 5):
        b.cell(row, j).fill = SECTION; b.cell(row, j).border = BOX
    b.cell(row, 1, title).font = Font(bold=True, color=NAVY)
    row += 1

def line(code, label, v5, v10, project=False):
    global row
    b.cell(row, 1, code).border = BOX
    lc = b.cell(row, 2, label); lc.border = BOX
    if project:
        lc.font = Font(color=RED)
    for j, v in ((3, v5), (4, v10)):
        c = b.cell(row, j, v)
        c.number_format = EUR; c.border = BOX
    row += 1
    return row - 1

def total(label, first, last, fill=TOTAL):
    global row
    b.cell(row, 2, label).font = Font(bold=True)
    for j, col in ((3, "C"), (4, "D")):
        c = b.cell(row, j, f"=SUM({col}{first}:{col}{last})")
        c.number_format = EUR; c.font = Font(bold=True)
    for j in range(1, 5):
        b.cell(row, j).fill = fill; b.cell(row, j).border = BOX
    row += 1
    return row - 1

# CHARGES
b.cell(row, 1, "CHARGES").font = Font(bold=True, size=12, color=RED); row += 1
first_ch = row
section("60 – Achats")
line("6064", "Matériel pédagogique et protections de prêt (casques, plastrons, gants, protège-tibias)", 1500, 2000, True)
line("6063", "Tatamis complémentaires (sécurisation des aires de combat)", 1000, 2500, True)
line("6068", "Médailles, diplômes et coupes – Shidokan Challenge 974", 600, 1100, True)
line("6063", "Matériel section féminine et self-défense", 0, 1000, True)
line("6068", "Matériel courant et pharmacie", f"={R('Matériel courant et pharmacie')}", f"={R('Matériel courant et pharmacie')}")
line("607", "Achats buvette (revendus)", f"={R('Achats buvette')}", f"={R('Achats buvette')}")
section("61 – Services extérieurs")
ASSU = "=" + R("Assurance de l'association")
line("616", "Assurance de l'association", ASSU, ASSU)
line("613", "Location de salle (mise à disposition gratuite par la Ville – valorisée en 86)", 0, 0)
section("62 – Autres services extérieurs")
line("6228", "Formation des encadrants et arbitres (diplômes fédéraux, arbitrage, PSC1)", 1000, 1500, True)
line("623", "Communication, impression, sonorisation – Shidokan Challenge 974", 400, 900, True)
line("625", "Déplacements en compétition", f"={R('Déplacements en compétition (transport, engagements)')}", f"={R('Déplacements en compétition (transport, engagements)')}")
line("625", "Défraiements des encadrants", f"={R('Défraiements des encadrants (kilomètres, frais)')}", f"={R('Défraiements des encadrants (kilomètres, frais)')}")
line("626", "Frais bancaires, téléphone, site internet", f"={R('Frais bancaires, téléphone, site internet')}", f"={R('Frais bancaires, téléphone, site internet')}")
section("65 – Autres charges de gestion courante")
nb_adh = f"({R("Nombre d'adhérents babies")}+{R("Nombre d'adhérents enfants")}+{R(chr(78) + 'ombre d' + chr(39) + 'adhérents ados / adultes / vétérans')})"
lic = f"={nb_adh}*{R('Prix de la licence fédérale par adhérent')}"
line("6511", "Licences fédérales", lic, lic)
AFF = f"={nb_adh}*{R('Affiliation Shidokan par adhérent')}"
line("6511", "Affiliation Shidokan (par adhérent)", AFF, AFF)
line("6588", "Licences solidaires et stages gratuits pendant les vacances scolaires", 500, 1000, True)
last_ch = row - 1
tot_ch = total("TOTAL DES CHARGES", first_ch, last_ch)
row += 1

# PRODUITS
b.cell(row, 1, "PRODUITS").font = Font(bold=True, size=12, color="2E7D32"); row += 1
first_pr = row
section("70 – Ventes de produits et prestations")
line("707", "Recettes buvette (Shidokan Challenge 974)", f"={R('Recettes buvette (Shidokan Challenge)')}", f"={R('Recettes buvette (Shidokan Challenge)')}")
section("74 – Subventions d'exploitation")
line("74", "Ville du Tampon (subvention sollicitée)", 5000, 10000, True)
line("74", "Département de La Réunion (à solliciter)", 0, 0)
line("74", "Région Réunion (à solliciter)", 0, 0)
line("74", "Agence nationale du Sport – PSF via la Ligue (à solliciter)", 0, 0)
section("75 – Autres produits de gestion courante")
cot = (f"={R("Nombre d'adhérents babies")}*{R('Cotisation annuelle baby')}"
       f"+{R("Nombre d'adhérents enfants")}*{R('Cotisation annuelle enfant')}"
       f"+{R(chr(78) + 'ombre d' + chr(39) + 'adhérents ados / adultes / vétérans')}*{R('Cotisation annuelle ado / adulte')}")
line("756", "Cotisations des adhérents (licences incluses)", cot, cot)
line("7541", "Sponsors et mécénat (L'Assiette Fleurie, DTTP Réunion…)", f"={R('Sponsors / mécénat (L' + chr(39) + 'Assiette Fleurie, DTTP Réunion…)')}", f"={R('Sponsors / mécénat (L' + chr(39) + 'Assiette Fleurie, DTTP Réunion…)')}")
fp = line("", "Fonds propres mobilisés (+) / excédent prévisionnel (−) – équilibre", 0, 0)
last_pr = row - 1
# fonds propres = charges - autres produits
for col in ("C", "D"):
    b[f"{col}{fp}"] = f"={col}{tot_ch}-SUM({col}{first_pr}:{col}{fp - 1})"
    b[f"{col}{fp}"].font = Font(italic=True)
tot_pr = total("TOTAL DES PRODUITS", first_pr, last_pr)
row += 1

# CONTRIBUTIONS VOLONTAIRES
b.cell(row, 1, "CONTRIBUTIONS VOLONTAIRES EN NATURE").font = Font(bold=True, size=12, color=NAVY); row += 1
salle = f"={R(chr(72) + 'eures d' + chr(39) + 'utilisation de la salle municipale par an')}*{R('Valeur horaire de la mise à disposition de la salle')}"
benev = f"={R('Heures de bénévolat par an (encadrement + événements)')}*{R('Valeur horaire du bénévolat (base SMIC – à vérifier)')}"
section("86 – Emplois des contributions volontaires")
f86 = line("862", "Mise à disposition gratuite de la salle par la Ville", salle, salle)
line("864", "Personnel bénévole (encadrement, arbitrage, événements)", benev, benev)
t86 = total("Total 86", f86, row - 1, SECTION)
section("87 – Contributions volontaires en nature")
f87 = line("871", "Prestations en nature (salle municipale)", salle, salle)
line("875", "Bénévolat", benev, benev)
t87 = total("Total 87", f87, row - 1, SECTION)
row += 1

# Contrôles
b.cell(row, 2, "Contrôle : produits − charges (doit être 0)").font = Font(bold=True)
for col in ("C", "D"):
    c = b[f"{col}{row}"]; c.value = f"={col}{tot_pr}-{col}{tot_ch}"; c.number_format = EUR
row += 1
b.cell(row, 2, "Part de la subvention Ville dans les produits").font = Font(bold=True)
sub_row = first_pr + 3  # ligne « Ville du Tampon »
for col in ("C", "D"):
    c = b[f"{col}{row}"]; c.value = f"={col}{sub_row}/{col}{tot_pr}"; c.number_format = "0%"
row += 2
b.cell(row, 2, "En rouge : lignes du projet financé par la subvention (5 000 € / 10 000 €).").font = Font(italic=True, color=RED)
row += 1
b.cell(row, 2, "Fonds propres négatifs = excédent : ajuster les hypothèses ou le montant demandé avant dépôt.").font = Font(italic=True, color="555555")

b.column_dimensions["A"].width = 9
b.column_dimensions["B"].width = 78
b.column_dimensions["C"].width = 19
b.column_dimensions["D"].width = 19
b.freeze_panes = "C6"
for ws in (b, h):
    ws.sheet_view.zoomScale = 90
    ws.page_setup.orientation = "portrait"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True

wb.save(OUT)
print("saved", OUT)
