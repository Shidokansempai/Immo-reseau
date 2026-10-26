// Hourly cleaning ratio: time really spent per cleaning vs planned, € per hour, labour cost.
import { html, str, api, on, $, money, fdate, ftime, qs, today, modal, attempt, toast } from '../ui.js';
import { topbar } from '../app.js';

export const dur = (min) => (min == null ? '—' : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`);
const gap = (d) => (d == null ? '' : html`<span class="tag ${d > 15 ? 'err' : d < -15 ? 'ok' : ''}">${d > 0 ? '+' : d < 0 ? '−' : ''}${dur(Math.abs(d))}</span>`);
const perHour = (n) => (n == null ? '—' : `${money(n)}/h`);

/** Result line shown once a cleaning is finished. */
export function cleaningResult(c) {
  if (!c || c.actual_min == null) return null;
  return `Ménage ${c.property_name} terminé en ${dur(c.actual_min)} (prévu ${dur(c.planned_min)}) · ${perHour(c.ratio)} · coût main-d'œuvre ${money(c.labour_cost)}`;
}

export default async function cleaningView(el) {
  const f = { from: `${today().slice(0, 8)}01`, to: today() };
  let ticker;

  function stopDialog(job, entryId, reload) {
    const now = new Date(Date.now() + 4 * 3600000).toISOString().slice(11, 16);
    modal({
      title: `Fin du ménage – ${job.property_name}`,
      body: html`<form onsubmit="return false" style="display:grid;gap:12px">
        <div>${job.agents.join(', ')} · arrivée à <b>${ftime(job.running_since)}</b> · durée prévue ${dur(job.planned_min)} · forfait ${money(job.amount)}</div>
        <label class="f">Heure de fin<input type="time" name="end" id="stop-end" value="${now}" required></label>
        <label class="check"><input type="checkbox" name="complete" id="stop-complete" checked> Marquer le ménage comme terminé</label>
        <label class="f">Compte rendu<textarea name="report" id="stop-report" rows="2" placeholder="RAS / casse / consommables à racheter…"></textarea></label></form>`,
      actions: [{ label: 'Annuler' }, { label: 'Calculer le ratio', cls: 'primary', onClick: async (m) => {
        const form = $('form', m);
        if (!form.reportValidity()) return false;
        const r = await attempt(() => api.post(`/time/${entryId}/stop`, {
          clock_out: `${today()}T${form.end.value}:00+04:00`, complete: form.complete.checked, report: form.report.value || null,
        }));
        const msg = cleaningResult(r.cleaning);
        if (msg) toast(msg);
        reload();
      } }],
    });
  }

  async function load() {
    const [d, entries] = await Promise.all([api.get(`/stats/cleaning${qs(f)}`), api.get(`/time${qs({ from: today(-2), to: today() })}`)]);
    const t = d.totals;
    const openEntry = (job) => entries.find((e) => e.intervention_id === job.id && !e.clock_out);
    clearInterval(ticker);

    $('#body', el).innerHTML = str(html`
      ${d.running.length ? html`<div class="card"><h2>En cours</h2>
        <p class="small muted" style="margin-top:-6px">Le ratio horaire est calculé à l'heure de fin du ménage.</p>
        <div class="grid g2">${d.running.map((j) => html`<div class="job card" style="margin:0;border-left-color:var(--sakura)">
          <div class="row between"><div class="bold">${j.property_name}</div><span class="tag brand">En cours</span></div>
          <div class="small">${j.agents.join(', ')} · arrivée à <b>${ftime(j.running_since)}</b> · prévu ${dur(j.planned_min)} · forfait ${money(j.amount)}</div>
          <div class="row between" style="margin-top:8px">
            <div><div class="small muted">Temps écoulé</div><div class="bold" style="font-size:22px;font-variant-numeric:tabular-nums" data-since="${j.running_since}">${dur(j.elapsed_min)}</div></div>
            <div style="text-align:right"><div class="small muted">Si fini maintenant</div><div class="bold" data-ratio="${j.amount}" data-since2="${j.running_since}">${perHour(j.elapsed_min ? j.amount / (j.elapsed_min / 60) : null)}</div></div>
          </div>
          ${openEntry(j) ? html`<div class="acts"><button class="primary" data-stop="${j.id}" data-entry="${openEntry(j).id}">Fin du ménage</button></div>` : ''}
        </div>`)}</div></div>` : ''}

      <div class="grid g4" style="margin-bottom:16px">
        <div class="kpi"><div class="l">Ménages terminés</div><div class="v">${t.count}</div><div class="small muted">du ${fdate(d.from)} au ${fdate(d.to)}</div></div>
        <div class="kpi"><div class="l">Ratio horaire moyen</div><div class="v">${perHour(t.ratio)}</div><div class="small muted">forfaits ménage ÷ heures pointées</div></div>
        <div class="kpi"><div class="l">Temps moyen par ménage</div><div class="v">${dur(t.avg_min)}</div><div class="small muted">prévu ${dur(t.avg_planned_min)}</div></div>
        <div class="kpi"><div class="l">Marge ménage</div><div class="v">${money(t.margin)}</div><div class="small muted">${money(t.amount)} facturés − ${money(t.labour_cost)} de main-d'œuvre</div></div>
      </div>

      <div class="grid g2">
        <div class="card table-wrap"><h2>Par logement</h2>${d.by_property.length ? html`<table class="t"><thead><tr><th>Logement</th><th class="r">Ménages</th><th class="r">Moyenne</th><th class="r">Prévu</th><th class="r">Ratio</th></tr></thead>
          ${d.by_property.map((g) => html`<tr><td class="bold">${g.name}</td><td class="r">${g.count}</td><td class="r">${dur(g.avg_min)}</td><td class="r muted">${dur(g.avg_planned_min)}</td><td class="r bold">${perHour(g.ratio)}</td></tr>`)}</table>` : html`<div class="empty">Aucun ménage terminé</div>`}</div>
        <div class="card table-wrap"><h2>Par intervenante</h2>${d.by_agent.length ? html`<table class="t"><thead><tr><th>Intervenant</th><th class="r">Ménages</th><th class="r">Moyenne</th><th class="r">Ratio</th><th class="r">Coût</th></tr></thead>
          ${d.by_agent.map((g) => html`<tr><td class="bold">${g.name}</td><td class="r">${g.count}</td><td class="r">${dur(g.avg_min)}</td><td class="r bold">${perHour(g.ratio)}</td><td class="r">${money(g.labour_cost)}</td></tr>`)}</table>` : html`<div class="empty">Aucun ménage terminé</div>`}</div>
      </div>

      <div class="card table-wrap" style="padding:0"><h2 style="padding:14px 16px 0">Détail des ménages</h2>${d.items.length ? html`<table class="t"><thead><tr><th>Date</th><th>Logement</th><th>Intervenant</th><th class="r">Prévu</th><th class="r">Réel</th><th class="r">Écart</th><th class="r">Forfait</th><th class="r">Ratio</th><th class="r">Marge</th></tr></thead><tbody>
        ${d.items.map((x) => html`<tr><td>${fdate(x.scheduled_date)}</td><td class="bold">${x.property_name}</td><td>${x.agents.join(', ')}</td><td class="r muted">${dur(x.planned_min)}</td>
          <td class="r bold">${dur(x.actual_min)}</td><td class="r">${gap(x.deviation_min)}</td><td class="r">${money(x.amount)}</td><td class="r bold">${perHour(x.ratio)}</td><td class="r">${money(x.margin)}</td></tr>`)}
      </tbody></table>` : html`<div class="empty">Aucun ménage terminé sur la période</div>`}</div>`);

    // Live elapsed time for running cleanings.
    const tick = () => {
      for (const s of el.querySelectorAll('[data-since]')) s.textContent = dur((Date.now() - new Date(s.dataset.since)) / 60000);
      for (const s of el.querySelectorAll('[data-since2]')) {
        const h = (Date.now() - new Date(s.dataset.since2)) / 3600000;
        s.textContent = perHour(h > 0 ? Number(s.dataset.ratio) / h : null);
      }
      if (!el.isConnected) clearInterval(ticker);
    };
    if (d.running.length) ticker = setInterval(tick, 30000);
    el._running = d.running;
  }

  el.innerHTML = str(html`${topbar('Ratio ménage')}
    <div class="filters">
      <label class="small muted">Du <input type="date" data-f="from" id="cl-from" value="${f.from}"></label>
      <label class="small muted">au <input type="date" data-f="to" id="cl-to" value="${f.to}"></label>
    </div>
    <div id="body"></div>`);
  on(el, 'change', '[data-f]', (e, i) => { f[i.dataset.f] = i.value; load(); });
  on(el, 'click', '[data-stop]', (e, b) => stopDialog(el._running.find((j) => j.id === Number(b.dataset.stop)), Number(b.dataset.entry), load));
  await load();
}
