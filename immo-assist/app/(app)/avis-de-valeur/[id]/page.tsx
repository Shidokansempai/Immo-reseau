import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth, currentOrg } from "@/lib/tenant";
import { db } from "@/lib/db";
import { eur, num, dateFR, PROPERTY_TYPE } from "@/lib/format";
import type { ValuationOutput } from "@/lib/valuation";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { id: string } }) {
  const s = await requireAuth();
  const v = await db.valuation.findFirst({ where: { id: params.id, organizationId: s.organizationId } });
  if (!v) notFound();
  const org = await currentOrg(s);

  let analysis: ValuationOutput | null = null;
  try { analysis = v.analysis ? JSON.parse(v.analysis) : null; } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href="/avis-de-valeur" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"><ArrowLeft size={15} /> Avis de valeur</Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-card print:shadow-none print:rounded-none overflow-hidden">
        {/* En-tête branding */}
        <div className="px-8 py-6" style={{ background: org?.brandColor ?? "#c9a24b", color: "#0d1017" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Avis de valeur</div>
              <h1 className="text-2xl font-black mt-1">{v.address || v.city}</h1>
              <p className="text-sm opacity-90">{PROPERTY_TYPE[v.propertyType]} · {v.city}</p>
            </div>
            <div className="text-right">
              <div className="h-12 w-12 rounded-xl bg-ink grid place-items-center text-white font-black ml-auto">IA</div>
              <div className="mt-2 text-xs font-semibold">{org?.name}</div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Fourchette de prix */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Estimation</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-gray-50 py-4">
                <div className="text-xs text-gray-400">Prix bas</div>
                <div className="text-lg font-bold text-gray-600">{eur(v.priceLow)}</div>
              </div>
              <div className="rounded-xl py-4 ring-2 ring-gold" style={{ background: "#faf6ea" }}>
                <div className="text-xs text-gold-dark font-semibold">Prix recommandé</div>
                <div className="text-2xl font-black text-ink">{eur(v.priceMid)}</div>
              </div>
              <div className="rounded-xl bg-gray-50 py-4">
                <div className="text-xs text-gray-400">Prix haut</div>
                <div className="text-lg font-bold text-gray-600">{eur(v.priceHigh)}</div>
              </div>
            </div>
            <p className="mt-2 text-center text-sm text-gray-500">Soit environ <strong>{eur(v.pricePerSqm)}/m²</strong></p>
            {analysis?.source && (
              <p className="mt-2 text-center">
                <span className={`chip ${analysis.source === "dvf_live" ? "bg-emerald-50 text-emerald-700" : analysis.source === "dvf_sample" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                  {analysis.source === "dvf_live"
                    ? `Source : DVF — ${analysis.marketCount} transactions réelles`
                    : analysis.source === "dvf_sample"
                    ? `Source : DVF — échantillon de démonstration (${analysis.marketCount} transactions)`
                    : "Source : grille marché locale"}
                </span>
              </p>
            )}
          </section>

          {/* Caractéristiques */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Caractéristiques du bien</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 text-sm">
              <Spec label="Surface" value={v.livingArea ? `${num(v.livingArea)} m²` : "—"} />
              <Spec label="Terrain" value={v.landArea ? `${num(v.landArea)} m²` : "—"} />
              <Spec label="Pièces" value={v.rooms ?? "—"} />
              <Spec label="Chambres" value={v.bedrooms ?? "—"} />
              <Spec label="État" value={v.condition ?? "—"} />
              <Spec label="DPE" value={v.dpe ?? "—"} />
            </div>
          </section>

          {analysis && (
            <>
              {/* Ajustements */}
              {analysis.adjustments?.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Facteurs de valorisation</h2>
                  <div className="space-y-1.5">
                    {analysis.adjustments.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{a.label}</span>
                        <span className={`font-semibold ${a.pct >= 0 ? "text-emerald-600" : "text-red-600"}`}>{a.pct > 0 ? "+" : ""}{a.pct}%</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Comparables */}
              {analysis.comparables?.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Biens comparables</h2>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-400 text-xs"><th className="py-1">Bien</th><th>Surface</th><th>Prix</th><th>€/m²</th><th>Vendu</th></tr></thead>
                    <tbody>
                      {analysis.comparables.map((c, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-1.5">{c.label}</td>
                          <td>{c.area} m²</td>
                          <td className="font-medium">{eur(c.price)}</td>
                          <td>{eur(c.pricePerSqm)}</td>
                          <td className="text-gray-400">{c.soldAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* Analyse secteur */}
              {analysis.areaAnalysis && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Analyse du secteur</h2>
                  <p className="text-sm text-gray-600">{analysis.areaAnalysis}</p>
                </section>
              )}

              {/* Arguments */}
              {analysis.arguments?.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Arguments justifiant l'estimation</h2>
                  <ul className="space-y-1.5 text-sm text-gray-600">
                    {analysis.arguments.map((a, i) => <li key={i} className="flex gap-2"><span className="text-gold-dark">•</span> {a}</li>)}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* Pied de page / mentions */}
          <section className="border-t border-gray-100 pt-5 text-xs text-gray-400">
            <p className="font-semibold text-gray-600">{org?.name}</p>
            <p>{org?.phone} · {org?.email}</p>
            {org?.legalInfo && <p className="mt-1">{org.legalInfo}</p>}
            <p className="mt-2">Avis de valeur établi le {dateFR(v.createdAt)}. Document non contractuel, fourni à titre indicatif.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}
