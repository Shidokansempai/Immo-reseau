/* =========================================================================
   SP Energy – paramètres du simulateur et des pages.
   ► À METTRE À JOUR CHAQUE TRIMESTRE (1er fév., 1er mai, 1er août, 1er nov.)
     Source : CRE – open data « arrêtés tarifaires photovoltaïques en ZNI »
   ========================================================================= */
window.KAZ_CONFIG = {
  periode: "novembre 2026 – janvier 2027",

  // Prix moyen du kWh payé à EDF Réunion (tarif Bleu, TTC, €/kWh)
  prixKwh: 0.195,
  // Abonnement mensuel moyen (retiré de la facture pour estimer la consommation)
  abonnementMensuel: 14,

  // Prime à l'investissement autoconsommation ZNI (€/Wc), appliquée à toute la puissance
  primeZni: [
    { maxKwc: 3, euroParWc: 1.54 },
    { maxKwc: 9, euroParWc: 0.92 }
  ],
  // Rachat du surplus (€/kWh, ≤ 9 kWc, garanti 20 ans)
  tarifSurplus: 0.177,

  // KAP Photovoltaïque (Région Réunion) – autoconsommation sans injection
  kap: { sansStockage: { min: 1000, max: 3000 }, avecStockage: { min: 2000, max: 6000 }, maxKwc: 9 },

  // Productible annuel moyen (kWh par kWc) par zone
  zones: [
    { id: "ouest",  label: "Ouest littoral (Saint-Paul, Saint-Leu, Le Port, La Possession)", productible: 1600 },
    { id: "sud",    label: "Sud littoral (Saint-Pierre, Saint-Louis, L'Étang-Salé, Petite-Île)", productible: 1550 },
    { id: "tampon", label: "Le Tampon, Entre-Deux, Saint-Joseph, Cilaos", productible: 1400 },
    { id: "nord",   label: "Nord (Saint-Denis, Sainte-Marie)", productible: 1400 },
    { id: "est",    label: "Est (Saint-André, Saint-Benoît, Sainte-Suzanne, Sainte-Rose)", productible: 1200 },
    { id: "hauts",  label: "Hauts (Plaine des Cafres, Plaine des Palmistes, Salazie)", productible: 1150 }
  ],

  // Part de la production consommée sur place, sans batterie, selon la présence au foyer
  tauxAutoconso: { absent: 0.45, partiel: 0.6, present: 0.75 },

  // Prix indicatifs posés TTC
  prix: { fixe: 2000, parKwc: 2100, batterie: 6500 },

  // Dégradation annuelle des panneaux et durée d'analyse
  degradation: 0.005,
  dureeAns: 25,

  contact: {
    telephone: "0693 92 66 87",
    whatsapp: "262693926687",
    email: "spenergy@gmail.com",
    zone: "Le Tampon · Sud & Ouest de La Réunion"
  }
};
