import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMMO ASSIST — Assistant commercial immobilier",
  description:
    "CRM et assistant commercial pour conseillers immobiliers indépendants. Centralisez vos contacts, mandats, biens, estimations et pilotez votre activité depuis une seule interface.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans">{children}</body>
    </html>
  );
}
