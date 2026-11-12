/* SP Energy – simulateur d'économies (aucune donnée envoyée) */
(function () {
  const C = window.KAZ_CONFIG;
  const form = document.getElementById("simu-form");
  if (!form) return;
  const out = document.getElementById("simu-result");
  const eur = (n) => Math.round(n).toLocaleString("fr-FR") + " €";
  const kwh = (n) => Math.round(n).toLocaleString("fr-FR") + " kWh";

  const zoneSel = form.querySelector("#zone");
  C.zones.forEach((z) => zoneSel.add(new Option(z.label, z.id)));
  zoneSel.value = "sud";

  function primeZni(kwc) {
    const t = C.primeZni.find((b) => kwc <= b.maxKwc);
    return t ? t.euroParWc * kwc * 1000 : 0;
  }
  function aideKap(kwc, batterie) {
    const b = batterie ? C.kap.avecStockage : C.kap.sansStockage;
    const ratio = (Math.min(kwc, C.kap.maxKwc) - 1) / (C.kap.maxKwc - 1);
    return b.min + Math.max(0, ratio) * (b.max - b.min);
  }
  function cumul(gainAn1) {
    let s = 0;
    for (let i = 0; i < C.dureeAns; i++) s += gainAn1 * Math.pow(1 - C.degradation, i);
    return s;
  }

  function calc() {
    const facture = Number(form.facture.value) || 0;
    const zone = C.zones.find((z) => z.id === zoneSel.value);
    const presence = form.presence.value;
    const conso = Math.max(0, (facture - C.abonnementMensuel) * 12 / C.prixKwh);
    let kwc = Math.round((conso * 0.85 / zone.productible) * 2) / 2;
    kwc = Math.min(9, Math.max(2, kwc));
    const prod = kwc * zone.productible;
    const prixInstall = C.prix.fixe + C.prix.parKwc * kwc;

    // Scénario A : autoconsommation + vente du surplus + prime ZNI
    const tA = C.tauxAutoconso[presence];
    const autoA = Math.min(prod * tA, conso);
    const gainA = autoA * C.prixKwh + (prod - autoA) * C.tarifSurplus;
    const aideA = primeZni(kwc);
    const netA = prixInstall - aideA;

    // Scénario B : autoconsommation totale + batterie + KAP Région
    const autoB = Math.min(prod * 0.9, conso * 0.85);
    const gainB = autoB * C.prixKwh;
    const aideB = aideKap(kwc, true);
    const netB = prixInstall + C.prix.batterie - aideB;

    const roi = (net, g) => (g > 0 ? (net / g).toFixed(1).replace(".", ",") + " ans" : "—");
    const best = cumul(gainA) - netA >= cumul(gainB) - netB ? "A" : "B";

    out.innerHTML = `
      <p class="simu-reco">Centrale recommandée : <strong>${String(kwc).replace(".", ",")} kWc</strong>
        · production ≈ <strong>${kwh(prod)}/an</strong> · votre consommation ≈ ${kwh(conso)}/an</p>
      <div class="simu-cards">
        <article class="simu-card ${best === "A" ? "is-best" : ""}">
          ${best === "A" ? '<span class="badge">Meilleur gain</span>' : ""}
          <h3>Kaz Confort</h3><p class="simu-sub">Autoconsommation + revente du surplus · prime ZNI</p>
          <dl>
            <dt>Gain annuel</dt><dd class="big">${eur(gainA)}</dd>
            <dt>Prix indicatif TTC</dt><dd>${eur(prixInstall)}</dd>
            <dt>Prime ZNI</dt><dd class="plus">– ${eur(aideA)}</dd>
            <dt>Reste à charge</dt><dd>${eur(netA)}</dd>
            <dt>Retour sur investissement</dt><dd>${roi(netA, gainA)}</dd>
            <dt>Gain net sur ${C.dureeAns} ans</dt><dd class="big">${eur(cumul(gainA) - netA)}</dd>
          </dl>
        </article>
        <article class="simu-card ${best === "B" ? "is-best" : ""}">
          ${best === "B" ? '<span class="badge">Meilleur gain</span>' : ""}
          <h3>Kaz Autonome</h3><p class="simu-sub">Batterie secours anti-coupure · aide KAP Région</p>
          <dl>
            <dt>Gain annuel</dt><dd class="big">${eur(gainB)}</dd>
            <dt>Prix indicatif TTC (avec batterie)</dt><dd>${eur(prixInstall + C.prix.batterie)}</dd>
            <dt>Aide KAP Région (estimée)</dt><dd class="plus">– ${eur(aideB)}</dd>
            <dt>Reste à charge</dt><dd>${eur(netB)}</dd>
            <dt>Retour sur investissement</dt><dd>${roi(netB, gainB)}</dd>
            <dt>Gain net sur ${C.dureeAns} ans</dt><dd class="big">${eur(cumul(gainB) - netB)}</dd>
          </dl>
          <p class="simu-note">+ électricité pendant les coupures (cyclones, délestages)</p>
        </article>
      </div>
      <p class="simu-disclaimer">Estimation indicative, sans hausse du prix de l'électricité, barèmes
        ${C.periode}. Prime ZNI et aide KAP non cumulables. Seule une visite technique (toiture,
        ombrage, tableau électrique) permet un chiffrage engageant.</p>
      <a class="btn btn-sun" href="contact.html?kwc=${kwc}&facture=${facture}">Recevoir mon étude gratuite</a>`;
  }
  form.addEventListener("input", calc);
  form.addEventListener("submit", (e) => { e.preventDefault(); calc(); });
  const f = form.querySelector("#facture"), o = document.getElementById("facture-out");
  const sync = () => (o.textContent = f.value + " €/mois");
  f.addEventListener("input", sync); sync();
  calc();
})();
