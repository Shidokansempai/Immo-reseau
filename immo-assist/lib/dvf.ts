import "server-only";
import { DVF_SAMPLE, type RawDvf } from "./dvf-sample";

/**
 * Intégration DVF (Demandes de Valeurs Foncières) — section 11.
 * ───────────────────────────────────────────────────────────────────────────
 * Module remplaçable, multi-fournisseurs. Il consomme une API DVF réelle quand
 * elle est configurée et joignable, et calcule à partir des VRAIES transactions
 * le prix/m² médian du secteur + des comparables. À défaut (pas de réseau / pas
 * de configuration), il bascule sur un échantillon de démonstration clairement
 * étiqueté, puis le moteur de valuation retombe sur sa grille marché locale.
 *
 * Fournisseurs (variable DVF_PROVIDER) :
 *   - "data_economie" (OFFICIEL, défaut recommandé) : portail data.economie.gouv.fr
 *     du Ministère de l'Économie (données DGFiP), API Opendatasoft Explore v2.
 *     Interrogeable par code commune, sans clé. Dataset configurable via
 *     DVF_ODS_DATASET.
 *   - "cquest" : API communautaire https://api.cquest.org/dvf
 *   - "generic" : activé dès que DVF_API_URL est défini ({insee} injecté),
 *     pour brancher n'importe quel backend (Cerema, interne…), clé optionnelle.
 *
 * La réponse est parsée de façon tolérante (plusieurs formats et orthographes).
 * Aucune clé n'est jamais exposée au frontend : tout est serveur.
 */

export type DvfTransaction = {
  date: string;
  price: number;
  area: number;
  rooms: number | null;
  type: string; // "Maison" | "Appartement" | "Terrain"
  address: string | null;
  pricePerSqm: number;
};

export type DvfMarket = {
  source: "dvf_live" | "dvf_sample";
  insee: string;
  commune: string;
  count: number;
  pricePerSqmMedian: number;
  pricePerSqmQ1: number;
  pricePerSqmQ3: number;
  comparables: DvfTransaction[];
};

// ─── Codes INSEE des communes de La Réunion (974) ────────────────────────────
export const REUNION_INSEE: Record<string, string> = {
  "les avirons": "97401", "bras-panon": "97402", "entre-deux": "97403",
  "l'etang-sale": "97404", "etang-sale": "97404", "l'étang-salé": "97404",
  "petite-ile": "97405", "petite-île": "97405",
  "la plaine-des-palmistes": "97406", "le port": "97407", "la possession": "97408",
  "saint-andre": "97409", "saint-andré": "97409", "saint-benoit": "97410", "saint-benoît": "97410",
  "saint-denis": "97411", "saint-joseph": "97412", "saint-leu": "97413",
  "saint-louis": "97414", "saint-paul": "97415", "saint-pierre": "97416",
  "saint-philippe": "97417", "sainte-marie": "97418", "sainte-rose": "97419",
  "sainte-suzanne": "97420", "salazie": "97421", "le tampon": "97422", "tampon": "97422",
  "les trois-bassins": "97423", "trois-bassins": "97423", "cilaos": "97424",
};

function normalizeKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Résout un code INSEE à partir d'un nom de commune (La Réunion en priorité). */
export function resolveInsee(city?: string | null): string | null {
  if (!city) return null;
  const k = normalizeKey(city);
  if (REUNION_INSEE[k]) return REUNION_INSEE[k];
  // recherche partielle tolérante
  for (const [name, code] of Object.entries(REUNION_INSEE)) {
    if (k.includes(name) || name.includes(k)) return code;
  }
  return null;
}

const TYPE_TO_DVF: Record<string, string> = {
  HOUSE: "Maison",
  APARTMENT: "Appartement",
  LAND: "Terrain",
  BUILDING: "Maison",
  COMMERCIAL: "",
  OTHER: "",
};

// ─── Parsing tolérant d'une transaction DVF brute ───────────────────────────
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseRaw(r: any): DvfTransaction | null {
  const price = num(r.valeur_fonciere ?? r.valeurFonciere ?? r.valeur);
  const area = num(r.surface_reelle_bati ?? r.surface_relle_bati ?? r.surfaceReelleBati ?? r.surface_bati);
  const type = String(r.type_local ?? r.typeLocal ?? r.type ?? "").trim();
  if (!price || !area || area <= 0) return null;
  const pricePerSqm = Math.round(price / area);
  // bornes anti-aberrations (dépendances, lots agrégés, erreurs de saisie)
  if (pricePerSqm < 300 || pricePerSqm > 12000) return null;
  const voie = r.adresse_nom_voie ?? r.adresseNomVoie ?? r.voie ?? null;
  const numero = r.adresse_numero ?? r.numero ?? "";
  return {
    date: String(r.date_mutation ?? r.dateMutation ?? r.date ?? "").slice(0, 10),
    price,
    area,
    rooms: num(r.nombre_pieces_principales ?? r.nombrePiecesPrincipales ?? r.pieces) ?? null,
    type: type || "Bien",
    address: voie ? `${numero ? numero + " " : ""}${voie}`.trim() : null,
    pricePerSqm,
  };
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  // formats courants : {resultats:[...]}, {results:[...]}, {features:[{properties}]}, {data:[...]}
  if (Array.isArray(payload?.resultats)) return payload.resultats;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.features)) return payload.features.map((f: any) => f.properties ?? f);
  return [];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? Math.round(sorted[base] + rest * (sorted[base + 1] - sorted[base]))
    : Math.round(sorted[base]);
}

/** Calcule les statistiques de marché à partir de transactions normalisées. */
function buildMarket(
  txs: DvfTransaction[],
  opts: { source: "dvf_live" | "dvf_sample"; insee: string; commune: string; type?: string; area?: number | null }
): DvfMarket | null {
  let filtered = txs;
  if (opts.type) filtered = filtered.filter((t) => t.type === opts.type);
  if (filtered.length < 3) filtered = txs; // pas assez de points : on élargit
  if (filtered.length === 0) return null;

  const ppsqm = filtered.map((t) => t.pricePerSqm).sort((a, b) => a - b);
  const median = quantile(ppsqm, 0.5);

  // comparables : les plus proches en surface du bien estimé, sinon récents
  const comparables = [...filtered]
    .sort((a, b) => {
      if (opts.area) return Math.abs(a.area - opts.area) - Math.abs(b.area - opts.area);
      return b.date.localeCompare(a.date);
    })
    .slice(0, 4);

  return {
    source: opts.source,
    insee: opts.insee,
    commune: opts.commune,
    count: filtered.length,
    pricePerSqmMedian: median,
    pricePerSqmQ1: quantile(ppsqm, 0.25),
    pricePerSqmQ3: quantile(ppsqm, 0.75),
    comparables,
  };
}

// ─── Sélection du fournisseur ────────────────────────────────────────────────
export type DvfProvider = "data_economie" | "cquest" | "generic" | "none";

export function dvfProvider(): DvfProvider {
  if (process.env.DVF_API_URL) return "generic";
  const p = (process.env.DVF_PROVIDER ?? "").toLowerCase();
  if (["data_economie", "data-economie", "economie", "etalab", "official", "officiel"].includes(p)) return "data_economie";
  if (p === "cquest") return "cquest";
  return "none";
}

/** URL de l'API officielle data.economie.gouv.fr (Opendatasoft Explore v2). */
function officialUrl(insee: string, dvfType?: string): string {
  const base = (process.env.DVF_ODS_BASE ?? "https://data.economie.gouv.fr").replace(/\/$/, "");
  const dataset = process.env.DVF_ODS_DATASET ?? "demandes-de-valeurs-foncieres";
  const where = [`code_commune="${insee}"`];
  if (dvfType) where.push(`type_local="${dvfType}"`);
  const params = new URLSearchParams({
    where: where.join(" and "),
    select:
      "date_mutation,valeur_fonciere,surface_reelle_bati,surface_terrain,nombre_pieces_principales,type_local,adresse_nom_voie,adresse_numero,nom_commune,code_commune",
    order_by: "date_mutation desc",
    limit: "100",
  });
  return `${base}/api/explore/v2.1/catalog/datasets/${dataset}/records?${params.toString()}`;
}

function buildUrl(provider: DvfProvider, insee: string, dvfType?: string): string | null {
  switch (provider) {
    case "data_economie":
      return officialUrl(insee, dvfType);
    case "cquest":
      return `https://api.cquest.org/dvf?code_commune=${insee}${dvfType ? `&type_local=${encodeURIComponent(dvfType)}` : ""}`;
    case "generic": {
      const tpl = process.env.DVF_API_URL!;
      return tpl.includes("{insee}")
        ? tpl.replace("{insee}", insee)
        : `${tpl}${tpl.includes("?") ? "&" : "?"}code_commune=${insee}`;
    }
    default:
      return null;
  }
}

/** Appel réseau vers l'API DVF du fournisseur courant (timeout + tolérant). */
async function fetchLive(insee: string, dvfType?: string): Promise<{ rows: any[]; url: string } | null> {
  const provider = dvfProvider();
  const url = buildUrl(provider, insee, dvfType);
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.DVF_API_KEY) headers["Authorization"] = `Bearer ${process.env.DVF_API_KEY}`;
    const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const payload = await res.json();
    return { rows: extractArray(payload), url };
  } catch {
    return null; // réseau indisponible / timeout / JSON invalide → repli
  } finally {
    clearTimeout(timer);
  }
}

// cache mémoire court (évite de refrapper l'API pour la même commune)
const cache = new Map<string, { at: number; market: DvfMarket | null }>();
const TTL = 1000 * 60 * 30;

/**
 * Point d'entrée principal : renvoie les données de marché DVF pour une commune
 * et un type de bien, ou `null` si aucune source n'est disponible (le moteur de
 * valuation bascule alors sur sa grille locale).
 */
export async function getDvfMarket(
  city: string | null | undefined,
  input: { propertyType?: string; livingArea?: number | null }
): Promise<DvfMarket | null> {
  const insee = resolveInsee(city);
  if (!insee) return null;
  const dvfType = TYPE_TO_DVF[input.propertyType ?? "HOUSE"] || undefined;
  const cacheKey = `${insee}:${dvfType ?? "all"}:${Math.round((input.livingArea ?? 0) / 20)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.market;

  const commune = city ?? insee;
  let market: DvfMarket | null = null;

  // 1) données réelles si un fournisseur est configuré & joignable
  const live = await fetchLive(insee, dvfType);
  if (live && live.rows.length) {
    const txs = live.rows.map(parseRaw).filter(Boolean) as DvfTransaction[];
    market = buildMarket(txs, { source: "dvf_live", insee, commune, type: dvfType, area: input.livingArea });
  }

  // 2) repli échantillon de démonstration
  if (!market && DVF_SAMPLE[insee]) {
    const txs = DVF_SAMPLE[insee].map((r: RawDvf) => parseRaw(r)).filter(Boolean) as DvfTransaction[];
    market = buildMarket(txs, { source: "dvf_sample", insee, commune, type: dvfType, area: input.livingArea });
  }

  cache.set(cacheKey, { at: Date.now(), market });
  return market;
}

// ─── Diagnostic / test de connexion (utilisé par Paramètres) ─────────────────
export type DvfProbe = {
  provider: DvfProvider;
  configured: boolean;
  insee: string | null;
  reachable: boolean;
  source: "dvf_live" | "dvf_sample" | null;
  count: number;
  median: number | null;
  message: string;
};

/**
 * Teste la source DVF pour une commune donnée et renvoie un diagnostic lisible.
 * Ne lève jamais : destiné au bouton « Tester la connexion DVF ».
 */
export async function probeDvf(city: string): Promise<DvfProbe> {
  const provider = dvfProvider();
  const insee = resolveInsee(city);
  const base: DvfProbe = {
    provider, configured: provider !== "none", insee,
    reachable: false, source: null, count: 0, median: null, message: "",
  };
  if (!insee) {
    return { ...base, message: `Commune « ${city} » non reconnue (code INSEE introuvable).` };
  }
  if (provider !== "none") {
    const live = await fetchLive(insee, "Maison");
    if (live && live.rows.length) {
      const txs = live.rows.map(parseRaw).filter(Boolean) as DvfTransaction[];
      const m = buildMarket(txs, { source: "dvf_live", insee, commune: city, type: "Maison" });
      if (m) {
        return { ...base, reachable: true, source: "dvf_live", count: m.count, median: m.pricePerSqmMedian,
          message: `API DVF officielle joignable : ${m.count} transactions à ${city}, médiane ${m.pricePerSqmMedian.toLocaleString("fr-FR")} €/m².` };
      }
    }
  }
  // repli échantillon
  if (DVF_SAMPLE[insee]) {
    const txs = DVF_SAMPLE[insee].map((r: RawDvf) => parseRaw(r)).filter(Boolean) as DvfTransaction[];
    const m = buildMarket(txs, { source: "dvf_sample", insee, commune: city, type: "Maison" });
    if (m) {
      const why = provider === "none" ? "Aucun fournisseur DVF configuré" : "API DVF injoignable depuis ce serveur";
      return { ...base, source: "dvf_sample", count: m.count, median: m.pricePerSqmMedian,
        message: `${why} → échantillon de démonstration (${m.count} transactions, médiane ${m.pricePerSqmMedian.toLocaleString("fr-FR")} €/m²).` };
    }
  }
  return { ...base, message: provider === "none" ? "Aucun fournisseur DVF configuré et pas d'échantillon pour cette commune." : "API DVF injoignable et pas d'échantillon pour cette commune." };
}
