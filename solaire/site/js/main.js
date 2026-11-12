// Menu mobile + préremplissage du formulaire + année
(function () {
  const t = document.querySelector(".nav-toggle"), n = document.querySelector(".nav");
  if (t) t.addEventListener("click", () => {
    const open = n.classList.toggle("open");
    t.setAttribute("aria-expanded", open);
  });
  document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
  const C = window.KAZ_CONFIG;
  if (C) {
    document.querySelectorAll("[data-tel]").forEach((e) => { e.textContent = C.contact.telephone; e.href = "tel:" + C.contact.telephone.replace(/\s/g, ""); });
    document.querySelectorAll("[data-mail]").forEach((e) => { e.textContent = C.contact.email; e.href = "mailto:" + C.contact.email; });
    document.querySelectorAll("[data-wa]").forEach((e) => (e.href = "https://wa.me/" + C.contact.whatsapp));
    document.querySelectorAll("[data-periode]").forEach((e) => (e.textContent = C.periode));
  }
  const form = document.getElementById("contact-form");
  if (form) {
    const p = new URLSearchParams(location.search);
    if (p.get("facture")) form.facture.value = p.get("facture");
    if (p.get("kwc")) form.message.value = "Le simulateur me recommande une centrale de " + p.get("kwc") + " kWc. ";
    form.addEventListener("submit", (e) => {
      // Hébergé sur Netlify : envoi natif. Sinon, repli e-mail.
      if (location.hostname.endsWith("netlify.app") || form.dataset.native === "1") return;
      e.preventDefault();
      const d = new FormData(form), lines = [];
      for (const [k, v] of d.entries()) if (k !== "form-name" && k !== "bot-field") lines.push(k + " : " + v);
      location.href = "mailto:" + C.contact.email + "?subject=" + encodeURIComponent("Demande d'étude solaire – " + d.get("nom")) + "&body=" + encodeURIComponent(lines.join("\n"));
    });
  }
})();
