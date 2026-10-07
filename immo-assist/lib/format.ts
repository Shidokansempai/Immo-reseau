// Formatage FR + libellés métier (centralisés pour cohérence UI).

export function eur(n: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (opts.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function num(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function dateFR(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTimeFR(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeFR(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 864e5);
}

export function relativeFR(d: Date | string | null | undefined) {
  if (!d) return "—";
  const diff = daysUntil(d);
  if (diff === null) return "—";
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  if (diff > 0) return `dans ${diff} j`;
  return `il y a ${Math.abs(diff)} j`;
}

export function initials(first?: string | null, last?: string | null) {
  return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?";
}

export function parseTags(csv?: string | null): string[] {
  return (csv ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

// ─── Libellés ────────────────────────────────────────────────────────────────

export const CONTACT_TYPE: Record<string, string> = {
  PROSPECT_SELLER: "Prospect vendeur",
  SELLER: "Vendeur",
  PROSPECT_BUYER: "Prospect acquéreur",
  BUYER: "Acquéreur",
  INVESTOR: "Investisseur",
  CLIENT: "Client",
  REFERRER: "Apporteur d'affaires",
  PARTNER: "Partenaire",
  NOTARY: "Notaire",
  BROKER: "Courtier",
  OTHER: "Autre",
};

export const CONTACT_STATUS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  ACTIVE: "Actif",
  WON: "Gagné",
  LOST: "Perdu",
  INACTIVE: "Inactif",
};

export const PROPERTY_TYPE: Record<string, string> = {
  APARTMENT: "Appartement",
  HOUSE: "Maison",
  LAND: "Terrain",
  COMMERCIAL: "Local commercial",
  BUILDING: "Immeuble",
  OTHER: "Autre",
};

export const PROPERTY_STATUS: Record<string, string> = {
  PROSPECT: "Prospect",
  ESTIMATION: "Estimation",
  MANDATE_TO_SIGN: "Mandat à signer",
  MANDATE_ACTIVE: "Mandat actif",
  UNDER_OFFER: "Sous offre",
  COMPROMISE: "Compromis",
  SOLD: "Vendu",
  ARCHIVED: "Archivé",
};

export const MANDATE_TYPE: Record<string, string> = {
  SIMPLE: "Simple",
  EXCLUSIVE: "Exclusif",
  SEMI_EXCLUSIVE: "Semi-exclusif",
};

export const MANDATE_STATUS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  EXPIRED: "Expiré",
  SOLD: "Vendu",
  CANCELED: "Annulé",
};

export const TASK_KIND: Record<string, string> = {
  CALL: "Appel",
  FOLLOWUP: "Relance",
  VISIT: "Visite",
  ESTIMATION: "Estimation",
  DOCUMENT: "Document",
  ADMIN: "Administratif",
  OTHER: "Autre",
};

export const EVENT_KIND: Record<string, string> = {
  VISIT: "Visite",
  ESTIMATION: "Estimation",
  SELLER_MEETING: "RDV vendeur",
  BUYER_MEETING: "RDV acquéreur",
  SIGNATURE: "Signature",
  CALL: "Appel",
  FOLLOWUP: "Relance",
  COMPROMISE: "Compromis",
  OTHER: "Autre",
};

export const INTERACTION_TYPE: Record<string, string> = {
  CALL: "Appel",
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  VISIT: "Visite",
  MEETING: "Rendez-vous",
  NOTE: "Note",
  ESTIMATION: "Estimation",
  OFFER: "Offre",
};

export const PLAN_LABEL: Record<string, string> = {
  SOLO: "Solo",
  PRO: "Pro",
  PRO_IA: "Pro IA",
  AGENCE: "Agence",
};

export const ROLE_LABEL: Record<string, string> = {
  PLATFORM_ADMIN: "Admin plateforme",
  AGENCY_ADMIN: "Admin agence",
  ADVISOR: "Conseiller",
};
