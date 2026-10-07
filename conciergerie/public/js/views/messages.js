import { html, str, raw, api, on, $, fdate, fdatetime, guestName, L, tag, qs, modal, attempt, toast } from '../ui.js';
import { topbar } from '../app.js';

/** Message composer for a booking: pick a template, edit, preview, send now or schedule. */
export async function openComposer(bookingId, onDone, preset = {}) {
  const [templates, booking] = await Promise.all([api.get('/templates'), api.get(`/bookings/${bookingId}`)]);
  const g = booking.guest || {};
  const m = modal({
    title: `Message à ${guestName(g)}`, wide: true,
    body: html`<form onsubmit="return false" style="display:grid;gap:12px">
      <div class="form-grid">
        <label class="f">Message type<select name="template_id"><option value="">— Message libre —</option>
          ${templates.filter((t) => t.active).map((t) => html`<option value="${t.id}">${t.name}${t.language !== 'fr' ? ` (${t.language})` : ''}</option>`)}</select></label>
        <label class="f">Canal<select name="channel">${Object.entries(L.channel).map(([k, v]) => html`<option value="${k}" ${k === (preset.channel || 'email') ? raw('selected') : ''}>${v}</option>`)}</select></label>
      </div>
      <label class="f">Objet<input name="subject" value="${preset.subject || ''}"></label>
      <label class="f">Message<textarea name="body" rows="11">${preset.body || ''}</textarea>
        <span class="small muted" style="font-weight:400">Variables : {{prenom}}, {{logement}}, {{date_arrivee}}, {{code_boite}}, {{wifi_nom}}, {{wifi_mdp}}… remplacées automatiquement.</span></label>
      <label class="f">Programmer l'envoi (optionnel)<input type="datetime-local" name="scheduled_at"></label>
      <div class="small muted">Destinataire : ${g.email || 'pas d\'e-mail'} · ${g.phone || 'pas de téléphone'}. SMS / WhatsApp : le message est préparé dans l'historique${g.phone ? raw(' – <a data-wa target="_blank" rel="noopener" href="#">ouvrir WhatsApp</a>') : ''}.</div>
      <div id="preview" class="card" style="background:#f9fafb;display:none"></div>
    </form>`,
    actions: [
      { label: '👁 Aperçu', keepOpen: true, onClick: async (el) => {
        const f = $('form', el);
        const p = await api.post('/templates/preview', { booking_id: bookingId, subject: f.subject.value, body: f.body.value });
        const box = $('#preview', el);
        box.style.display = 'block';
        box.innerHTML = str(html`<div class="bold">${p.subject}</div><pre class="body" style="margin-top:8px">${p.body}</pre>`);
      } },
      { label: 'Annuler' },
      { label: 'Envoyer', cls: 'primary', onClick: async (el) => {
        const f = $('form', el);
        if (!f.body.value.trim()) { toast('Message vide', true); return false; }
        const at = f.scheduled_at.value ? `${f.scheduled_at.value}:00+04:00` : null;
        const r = await attempt(() => api.post('/messages', {
          booking_id: bookingId, template_id: f.template_id.value ? Number(f.template_id.value) : null,
          channel: f.channel.value, subject: f.subject.value, body: f.body.value, scheduled_at: at,
        }));
        toast(r.status === 'scheduled' ? `Programmé pour le ${fdatetime(r.scheduled_at)}` : r.status === 'failed' ? `Échec : ${r.error}` : r.status === 'simulated' ? `Enregistré (${r.error})` : 'Message envoyé ✉️', r.status === 'failed');
        onDone?.(r);
      } },
    ],
  });
  const f = $('form', m.el);
  f.template_id.addEventListener('change', () => {
    const t = templates.find((x) => String(x.id) === f.template_id.value);
    if (t) { f.subject.value = t.subject || ''; f.body.value = t.body; f.channel.value = t.channel; }
  });
  $('[data-wa]', m.el)?.addEventListener('click', async (e) => {
    e.preventDefault();
    const p = await api.post('/templates/preview', { booking_id: bookingId, subject: '', body: f.body.value });
    const phone = g.phone.replace(/\D/g, '').replace(/^0/, '262');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(p.body)}`, '_blank', 'noopener');
  });
}

export default async function messagesView(el, { params, query, refreshBadges }) {
  let tab = query.status ? query.status : 'threads';
  let selected = params.id ? Number(params.id) : null;

  el.innerHTML = str(html`${topbar('Messagerie voyageurs', html`<a class="btn" href="#/modeles">✉️ Messages types</a>`)}
    <div class="tabs">${[['threads', '💬 Conversations'], ['scheduled', '⏰ Programmés'], ['sent', '✅ Envoyés'], ['failed', '⚠️ Échecs']].map(([k, l]) => html`<button data-tab="${k}">${l}</button>`)}</div>
    <div id="body"></div>`);

  async function renderThreads() {
    const threads = await api.get('/messages/threads');
    if (!selected && threads.length) selected = threads[0].booking_id;
    $('#body', el).innerHTML = str(html`<div class="card inbox">
      <div class="threads">${threads.length ? threads.map((t) => html`<div class="thread ${t.booking_id === selected ? 'on' : ''}" data-thread="${t.booking_id}">
        <div class="row between"><span class="bold">${guestName(t)}</span>${t.unread ? html`<span class="tag warn">${t.unread}</span>` : html`<span class="small muted">${t.last_at ? fdatetime(t.last_at) : ''}</span>`}</div>
        <div class="small">${t.property_name} · ${fdate(t.checkin_date, { day: 'numeric', month: 'short' })} → ${fdate(t.checkout_date, { day: 'numeric', month: 'short' })}</div>
        <div class="preview">${t.last_body || (t.scheduled ? `${t.scheduled} message(s) programmé(s)` : 'Aucun message')}</div></div>`) : html`<div class="empty">Aucune conversation</div>`}</div>
      <div class="conv" id="conv">${selected ? '' : html`<div class="empty">Sélectionnez une conversation</div>`}</div></div>`);
    if (selected) renderConversation();
  }

  async function renderConversation() {
    const b = await api.get(`/bookings/${selected}`);
    const conv = $('#conv', el);
    conv.innerHTML = str(html`
      <div class="conv-head row between"><div><a class="bold" href="#/reservations/${b.id}">${guestName(b)}</a>
        <div class="small muted">${b.property_name} · ${fdate(b.checkin_date)} → ${fdate(b.checkout_date)} · ${b.guest?.email || ''} ${b.guest?.phone || ''}</div></div>
        <div class="row"><button class="sm" data-inbound>📥 Saisir une réponse reçue</button><button class="sm primary" data-compose>✍️ Nouveau message</button></div></div>
      <div class="bubbles">${b.messages.length ? b.messages.map((msg) => html`<div class="bubble ${msg.direction === 'out' ? 'out' : ''} ${msg.status === 'scheduled' ? 'sched' : ''} ${msg.status === 'cancelled' ? 'cancelled' : ''}">
        ${msg.subject ? html`<div class="bold" style="margin-bottom:4px">${msg.subject}</div>` : ''}<pre class="body">${msg.body}</pre>
        <div class="meta">${L.channel[msg.channel]} · ${fdatetime(msg.sent_at || msg.scheduled_at || msg.created_at)} ${tag(L.msgStatus, msg.status)}
          ${msg.error ? html`<span title="${msg.error}">ⓘ ${msg.error.slice(0, 60)}</span>` : ''}
          ${['scheduled', 'failed'].includes(msg.status) ? html`<button class="sm" data-send="${msg.id}">Envoyer maintenant</button>` : ''}
          ${msg.status === 'scheduled' ? html`<button class="sm ghost" data-cancel="${msg.id}">Annuler</button>` : ''}</div></div>`) : html`<div class="empty">Aucun message</div>`}</div>
      <div class="composer"><textarea data-quick rows="2" placeholder="Réponse rapide (e-mail)… Entrée + Ctrl pour envoyer"></textarea>
        <div class="row between"><span class="small muted">Les messages automatiques sont générés à partir des messages types.</span><button class="primary sm" data-quick-send>Envoyer</button></div></div>`);
    const bubbles = $('.bubbles', conv);
    bubbles.scrollTop = bubbles.scrollHeight;
    if (b.messages.some((x) => x.direction === 'in' && !x.read)) { await api.post('/messages/mark-read', { booking_id: b.id }); refreshBadges?.(); }
  }

  async function renderList(status) {
    const rows = await api.get(`/messages${qs({ status })}`);
    $('#body', el).innerHTML = str(html`<div class="card table-wrap" style="padding:0">${rows.length ? html`<table class="t"><thead><tr><th>${status === 'scheduled' ? 'Prévu le' : 'Date'}</th><th>Voyageur</th><th>Message</th><th>Canal</th><th>Statut</th><th></th></tr></thead><tbody>
      ${rows.map((m) => html`<tr><td class="small">${fdatetime(m.sent_at || m.scheduled_at || m.created_at)}</td>
        <td><a href="#/messagerie/${m.booking_id}">${guestName(m)}</a><div class="small muted">${m.property_name || ''}</div></td>
        <td><div class="bold">${m.subject || m.template_name || '—'}</div><div class="small muted">${m.body.slice(0, 90)}…</div>${m.error ? html`<div class="small" style="color:var(--err)">${m.error}</div>` : ''}</td>
        <td class="small">${L.channel[m.channel]}<div class="muted">${m.recipient || ''}</div></td><td>${tag(L.msgStatus, m.status)}</td>
        <td class="r">${['scheduled', 'failed'].includes(m.status) ? html`<button class="sm" data-send="${m.id}">Envoyer</button>` : ''} ${m.status === 'scheduled' ? html`<button class="sm ghost" data-cancel="${m.id}">✕</button>` : ''}</td></tr>`)}
      </tbody></table>` : html`<div class="empty">Aucun message</div>`}</div>`);
  }

  async function render() {
    for (const b of el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    if (tab === 'threads') await renderThreads(); else await renderList(tab);
  }
  const refresh = () => (tab === 'threads' ? renderThreads() : renderList(tab));

  on(el, 'click', '[data-tab]', (e, b) => { tab = b.dataset.tab; render(); });
  on(el, 'click', '[data-thread]', (e, t) => {
    selected = Number(t.dataset.thread);
    for (const x of el.querySelectorAll('.thread')) x.classList.toggle('on', x === t);
    history.replaceState(null, '', `#/messagerie/${selected}`);
    renderConversation();
  });
  on(el, 'click', '[data-compose]', () => openComposer(selected, refresh));
  on(el, 'click', '[data-send]', async (e, b) => { await attempt(() => api.post(`/messages/${b.dataset.send}/send-now`), 'Traité'); refresh(); });
  on(el, 'click', '[data-cancel]', async (e, b) => { await attempt(() => api.post(`/messages/${b.dataset.cancel}/cancel`), 'Envoi annulé'); refresh(); });
  on(el, 'click', '[data-inbound]', () => modal({
    title: 'Enregistrer un message reçu', body: html`<form onsubmit="return false" style="display:grid;gap:10px">
      <label class="f">Canal<select name="channel">${Object.entries(L.channel).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></label>
      <label class="f">Message du voyageur<textarea name="body" rows="5" placeholder="Copiez ici le message reçu sur Airbnb, WhatsApp…"></textarea></label></form>`,
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', cls: 'primary', onClick: async (m) => {
      const f = $('form', m);
      await attempt(() => api.post('/messages/inbound', { booking_id: selected, channel: f.channel.value, body: f.body.value }), 'Message enregistré');
      api.post('/messages/mark-read', { booking_id: selected });
      renderConversation();
    } }],
  }));
  const quickSend = async () => {
    const ta = $('[data-quick]', el);
    if (!ta.value.trim()) return;
    const r = await attempt(() => api.post('/messages', { booking_id: selected, channel: 'email', subject: 'Re : votre séjour à {{logement}}', body: ta.value }));
    if (r.status === 'failed') toast(`Échec : ${r.error}`, true);
    ta.value = '';
    renderConversation();
  };
  on(el, 'click', '[data-quick-send]', quickSend);
  on(el, 'keydown', '[data-quick]', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) quickSend(); });
  await render();
}
