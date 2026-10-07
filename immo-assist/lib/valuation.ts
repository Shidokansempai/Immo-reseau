// Moteur d'avis de valeur (section 11).
// Sans API externe connectée, on utilise une grille de prix/m² de référence
// pour le marché réunionnais + une pondération selon l'état, le DPE et les
// prestations. L'architecture est prête à exploiter DVF / DPE / cadastre dès
// que les clés sont renseignées (voir lib/integrations.ts → getMarketData()).

export type ValuationInput = {
  city?: string | null;
  propertyType?: string;
  livingArea?: number | null;
  landArea?: number | null;
  bedrooms?: number | null;
  condition?: string | null;
  dpe?: string | null;
  features?: string | null;
};

export type ValuationOutput = {
  priceLow: number;
  priceMid: number;
  priceHigh: number;
  pricePerSqm: number;
  basePricePerSqm: number;
  adjustments: { label: string; pct: number }[];
  comparables: Comparable[];
  areaAnalysis: string;
  arguments: string[];
};

export type Comparable = {
  label: string;
  city: string;
  area: number;
  price: number;
  pricePerSqm: number;
  soldAt: string;
};

// Prix/m² indicatifs (habitable) — marché réunionnais, maisons/appartements.
// Valeurs de démonstration réalistes, à remplacer par DVF+ une fois connecté.
const BASE_PRICE_PER_SQM: Record<string, number> = {
  "le tampon": 2650,
  tampon: 2650,
  "saint-pierre": 3250,
  "saint pierre": 3250,
  "petite-ile": 2950,
  "petite île": 2950,
  "saint-joseph": 2300,
  "saint joseph": 2300,
  "saint-louis": 2550,
  "saint-denis": 3600,
  "saint-paul": 3400,
  "saint-gilles": 4200,
  "le port": 2500,
  "la possession": 3100,
  "saint-andre": 2400,
  "saint-benoit": 2200,
};

const DEFAULT_PRICE_PER_SQM = 2800;

function basePrice(city?: string | null): number {
  if (!city) return DEFAULT_PRICE_PER_SQM;
  const key = city.toLowerCase().trim();
  for (const [k, v] of Object.entries(BASE_PRICE_PER_SQM)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return DEFAULT_PRICE_PER_SQM;
}

export function estimateValue(input: ValuationInput): ValuationOutput {
  const base = basePrice(input.city);
  const adjustments: { label: string; pct: number }[] = [];

  // État du bien
  const condition = (input.condition ?? "").toLowerCase();
  if (condition.includes("neuf")) adjustments.push({ label: "État neuf", pct: 12 });
  else if (condition.includes("rénov") || condition.includes("renov")) adjustments.push({ label: "À rénover", pct: -15 });
  else if (condition.includes("rafraîch") || condition.includes("rafraich")) adjustments.push({ label: "À rafraîchir", pct: -6 });
  else if (condition.includes("bon")) adjustments.push({ label: "Bon état", pct: 3 });

  // DPE
  const dpe = (input.dpe ?? "").toUpperCase();
  if (["A", "B"].includes(dpe)) adjustments.push({ label: `DPE ${dpe} (performant)`, pct: 5 });
  else if (["F", "G"].includes(dpe)) adjustments.push({ label: `DPE ${dpe} (passoire)`, pct: -8 });

  // Terrain (maisons)
  if (input.propertyType === "HOUSE" && (input.landArea ?? 0) > 400) {
    adjustments.push({ label: "Grand terrain", pct: 6 });
  }

  // Prestations
  const feats = (input.features ?? "").toLowerCase();
  if (feats.includes("vue mer")) adjustments.push({ label: "Vue mer", pct: 10 });
  if (feats.includes("piscine")) adjustments.push({ label: "Piscine", pct: 5 });
  if (feats.includes("calme")) adjustments.push({ label: "Environnement calme", pct: 2 });

  const totalAdj = adjustments.reduce((s, a) => s + a.pct, 0);
  const pricePerSqm = Math.round(base * (1 + totalAdj / 100));
  const area = input.livingArea ?? 0;
  const priceMid = Math.round((pricePerSqm * area) / 1000) * 1000;
  const priceLow = Math.round((priceMid * 0.93) / 1000) * 1000;
  const priceHigh = Math.round((priceMid * 1.07) / 1000) * 1000;

  // Comparables synthétiques (remplacés par DVF réel une fois connecté)
  const city = input.city || "secteur";
  const comparables: Comparable[] = area
    ? [
        mkComparable(city, Math.round(area * 0.92), pricePerSqm * 0.97, "il y a 2 mois"),
        mkComparable(city, Math.round(area * 1.05), pricePerSqm * 1.03, "il y a 4 mois"),
        mkComparable(city, Math.round(area * 0.98), pricePerSqm * 0.99, "il y a 5 mois"),
      ]
    : [];

  const args: string[] = [];
  args.push(`Prix de marché observé à ${city} : ~${base.toLocaleString("fr-FR")} €/m² pour ce type de bien.`);
  if (totalAdj > 0) args.push(`Les atouts du bien justifient une valorisation supérieure (+${totalAdj}%).`);
  if (totalAdj < 0) args.push(`Certains points (${adjustments.filter(a => a.pct < 0).map(a => a.label).join(", ")}) pèsent sur la valeur (${totalAdj}%).`);
  args.push(`Fourchette resserrée autour de ${priceMid.toLocaleString("fr-FR")} € pour une mise en vente réaliste et une vente rapide.`);
  args.push(`Positionné au juste prix, ce bien se vend généralement en 60 à 90 jours sur ce secteur.`);

  return {
    priceLow,
    priceMid,
    priceHigh,
    pricePerSqm,
    basePricePerSqm: base,
    adjustments,
    comparables,
    areaAnalysis: areaAnalysis(city, base),
    arguments: args,
  };
}

function mkComparable(city: string, area: number, ppsqm: number, soldAt: string): Comparable {
  const price = Math.round((area * ppsqm) / 1000) * 1000;
  return {
    label: `Bien similaire ${area} m²`,
    city,
    area,
    price,
    pricePerSqm: Math.round(ppsqm),
    soldAt,
  };
}

function areaAnalysis(city: string, base: number): string {
  return (
    `Le secteur de ${city} affiche un prix moyen d'environ ${base.toLocaleString("fr-FR")} €/m². ` +
    `La demande reste soutenue, portée par des acquéreurs locaux et des investisseurs. ` +
    `Un bien correctement positionné et accompagné par un acquéreur déjà financé se démarque nettement.`
  );
}
