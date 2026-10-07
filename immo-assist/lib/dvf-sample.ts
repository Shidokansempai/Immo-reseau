// Échantillon DVF de DÉMONSTRATION (hors ligne).
// ─────────────────────────────────────────────────────────────────────────────
// Transactions au FORMAT DVF mais FICTIVES, utilisées uniquement comme repli
// lorsque l'API DVF réelle n'est pas joignable (ex. environnement sans accès
// réseau). Elles ne proviennent PAS d'Etalab / data.gouv.fr et ne doivent pas
// être présentées comme des ventes réelles — l'UI les étiquette explicitement
// « échantillon de démonstration ».
//
// Dès qu'un accès réseau est disponible et DVF_API_URL configuré, c'est la
// source réelle qui est utilisée (voir lib/dvf.ts).

export type RawDvf = {
  date_mutation: string;
  valeur_fonciere: number;
  surface_reelle_bati: number;
  nombre_pieces_principales: number | null;
  type_local: string; // "Maison" | "Appartement" | "Terrain"
  adresse_nom_voie: string;
  nom_commune: string;
};

// clé = code INSEE
export const DVF_SAMPLE: Record<string, RawDvf[]> = {
  // Le Tampon (base marché ~2650 €/m²)
  "97422": [
    { date_mutation: "2025-11-12", valeur_fonciere: 312000, surface_reelle_bati: 118, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Chemin Bras de Pontho", nom_commune: "Le Tampon" },
    { date_mutation: "2025-09-03", valeur_fonciere: 268000, surface_reelle_bati: 96, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Rue des Mimosas", nom_commune: "Le Tampon" },
    { date_mutation: "2025-07-21", valeur_fonciere: 395000, surface_reelle_bati: 142, nombre_pieces_principales: 5, type_local: "Maison", adresse_nom_voie: "Rue Hubert Delisle", nom_commune: "Le Tampon" },
    { date_mutation: "2025-06-08", valeur_fonciere: 189000, surface_reelle_bati: 72, nombre_pieces_principales: 3, type_local: "Appartement", adresse_nom_voie: "Rue Marius et Ary Leblond", nom_commune: "Le Tampon" },
    { date_mutation: "2025-04-30", valeur_fonciere: 245000, surface_reelle_bati: 89, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Chemin Trois-Mares", nom_commune: "Le Tampon" },
    { date_mutation: "2025-03-14", valeur_fonciere: 158000, surface_reelle_bati: 61, nombre_pieces_principales: 3, type_local: "Appartement", adresse_nom_voie: "Rue du Général de Gaulle", nom_commune: "Le Tampon" },
    { date_mutation: "2025-02-02", valeur_fonciere: 358000, surface_reelle_bati: 128, nombre_pieces_principales: 5, type_local: "Maison", adresse_nom_voie: "Chemin Pierrefonds", nom_commune: "Le Tampon" },
  ],
  // Saint-Pierre (~3250 €/m²)
  "97416": [
    { date_mutation: "2025-11-19", valeur_fonciere: 239000, surface_reelle_bati: 68, nombre_pieces_principales: 3, type_local: "Appartement", adresse_nom_voie: "Boulevard Hubert Delisle", nom_commune: "Saint-Pierre" },
    { date_mutation: "2025-10-05", valeur_fonciere: 445000, surface_reelle_bati: 132, nombre_pieces_principales: 5, type_local: "Maison", adresse_nom_voie: "Rue Terre Sainte", nom_commune: "Saint-Pierre" },
    { date_mutation: "2025-08-17", valeur_fonciere: 198000, surface_reelle_bati: 58, nombre_pieces_principales: 2, type_local: "Appartement", adresse_nom_voie: "Rue Auguste Babet", nom_commune: "Saint-Pierre" },
    { date_mutation: "2025-07-02", valeur_fonciere: 312000, surface_reelle_bati: 92, nombre_pieces_principales: 4, type_local: "Appartement", adresse_nom_voie: "Rue François de Mahy", nom_commune: "Saint-Pierre" },
    { date_mutation: "2025-05-11", valeur_fonciere: 520000, surface_reelle_bati: 148, nombre_pieces_principales: 5, type_local: "Maison", adresse_nom_voie: "Rue de la Cayenne", nom_commune: "Saint-Pierre" },
    { date_mutation: "2025-03-28", valeur_fonciere: 165000, surface_reelle_bati: 48, nombre_pieces_principales: 2, type_local: "Appartement", adresse_nom_voie: "Rue Victor le Vigoureux", nom_commune: "Saint-Pierre" },
  ],
  // Petite-Île (~2950 €/m²)
  "97405": [
    { date_mutation: "2025-10-22", valeur_fonciere: 298000, surface_reelle_bati: 98, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Chemin Piton", nom_commune: "Petite-Île" },
    { date_mutation: "2025-08-09", valeur_fonciere: 345000, surface_reelle_bati: 112, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Rue de la Mairie", nom_commune: "Petite-Île" },
    { date_mutation: "2025-06-15", valeur_fonciere: 262000, surface_reelle_bati: 84, nombre_pieces_principales: 3, type_local: "Maison", adresse_nom_voie: "Chemin Dassy", nom_commune: "Petite-Île" },
    { date_mutation: "2025-04-04", valeur_fonciere: 410000, surface_reelle_bati: 135, nombre_pieces_principales: 5, type_local: "Maison", adresse_nom_voie: "Rue des Goyaviers", nom_commune: "Petite-Île" },
  ],
  // Saint-Joseph (~2300 €/m²)
  "97412": [
    { date_mutation: "2025-11-01", valeur_fonciere: 228000, surface_reelle_bati: 96, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Rue de Vincendo", nom_commune: "Saint-Joseph" },
    { date_mutation: "2025-09-18", valeur_fonciere: 189000, surface_reelle_bati: 82, nombre_pieces_principales: 3, type_local: "Maison", adresse_nom_voie: "Chemin Langevin", nom_commune: "Saint-Joseph" },
    { date_mutation: "2025-07-07", valeur_fonciere: 275000, surface_reelle_bati: 118, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Rue Raphaël Babet", nom_commune: "Saint-Joseph" },
    { date_mutation: "2025-05-23", valeur_fonciere: 152000, surface_reelle_bati: 68, nombre_pieces_principales: 3, type_local: "Maison", adresse_nom_voie: "Chemin Jean Petit", nom_commune: "Saint-Joseph" },
  ],
  // Saint-Louis (~2550 €/m²)
  "97414": [
    { date_mutation: "2025-10-14", valeur_fonciere: 255000, surface_reelle_bati: 102, nombre_pieces_principales: 4, type_local: "Maison", adresse_nom_voie: "Rue du Père Lafosse", nom_commune: "Saint-Louis" },
    { date_mutation: "2025-08-02", valeur_fonciere: 198000, surface_reelle_bati: 79, nombre_pieces_principales: 3, type_local: "Appartement", adresse_nom_voie: "Avenue Gaston Monnerville", nom_commune: "Saint-Louis" },
    { date_mutation: "2025-06-20", valeur_fonciere: 312000, surface_reelle_bati: 124, nombre_pieces_principales: 5, type_local: "Maison", adresse_nom_voie: "Chemin de la Rivière", nom_commune: "Saint-Louis" },
  ],
};
