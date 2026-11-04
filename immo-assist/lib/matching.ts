import type { Property, BuyerProfile, Contact } from "@prisma/client";
import { parseTags } from "./format";

export type MatchResult = {
  contact: Contact;
  profile: BuyerProfile;
  score: number; // 0-100
  reasons: string[];
};

/**
 * Moteur de matching bien ↔ acquéreurs (section 10).
 * Score pondéré : budget (40), secteur (25), type (15), surface (10),
 * chambres (10). Les critères durs non satisfaits (budget max, secteur)
 * pénalisent fortement sans exclure (le conseiller juge).
 */
export function matchBuyersToProperty(
  property: Property,
  buyers: (BuyerProfile & { contact: Contact })[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const b of buyers) {
    let score = 0;
    const reasons: string[] = [];

    // Budget (40)
    if (property.price != null) {
      const min = b.budgetMin ?? 0;
      const max = b.budgetMax ?? Infinity;
      if (property.price >= min && property.price <= max) {
        score += 40;
        reasons.push("Dans le budget");
      } else if (max !== Infinity && property.price <= max * 1.08) {
        score += 22;
        reasons.push("Légèrement au-dessus du budget (négociable)");
      } else {
        reasons.push("Hors budget");
      }
    } else {
      score += 20;
    }

    // Secteur (25)
    const areas = parseTags(b.areas).map((a) => a.toLowerCase());
    const city = (property.city ?? "").toLowerCase();
    if (areas.length === 0) {
      score += 12;
    } else if (city && areas.some((a) => city.includes(a) || a.includes(city))) {
      score += 25;
      reasons.push(`Secteur recherché (${property.city})`);
    } else {
      reasons.push("Hors secteur recherché");
    }

    // Type de bien (15)
    const types = parseTags(b.propertyTypes);
    if (types.length === 0 || types.includes(property.propertyType)) {
      score += 15;
      if (types.length) reasons.push("Type de bien correspondant");
    }

    // Surface (10)
    if (b.minArea == null || (property.livingArea ?? 0) >= b.minArea) {
      score += 10;
      if (b.minArea) reasons.push("Surface suffisante");
    }

    // Chambres (10)
    if (b.minBedrooms == null || (property.bedrooms ?? 0) >= b.minBedrooms) {
      score += 10;
    } else {
      reasons.push("Moins de chambres que souhaité");
    }

    // Critères spécifiques (bonus)
    if (b.needParking && property.hasParking) reasons.push("Parking ✓");
    if (b.needPool && property.hasPool) reasons.push("Piscine ✓");
    if (b.financingReady) reasons.push("Financement pré-qualifié (2L) ✓");

    if (score >= 45) {
      results.push({ contact: b.contact, profile: b, score: Math.min(100, score), reasons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
