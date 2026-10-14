// Light Years Home v3: the ship log (final.md 13.6, tech §6.4), a first version. The core pauses while it is open.
// MAP: the zone, north up, in the video's style (thin rings, small labels, the orange home chevron, the exit gate,
// your ship); tap a thing for its card and SET WAYPOINT; visited zones with JUMP BACK. JOBS: the objective, open
// jobs with their givers, done ones with medals. LOG: the zone card, scans as fact cards with their sources, rumours
// as grey cards, postcards, an orange dot on what is new. RECORDS: events you have seen with medal pips, best times,
// stars, Pilot marks and ghost links; jump medals; Vela's tally. Unseen events show only as a count. DOM, scrolls
// inside itself, fits 390 px with 16 px gutters.
import { MEDAL_NAME, MEDAL_ORDER, fmtTime, fmtLy, betaText } from './hud.js';
import { STUNT_TYPES as STUNTS } from '../core/world/schema.js';
import { factById } from '../core/world/facts.js';
import { milestoneById } from '../core/milestones.js';
import { earthDateText } from '../core/timeline.js';

export const TABS = Object.freeze(['map', 'jobs', 'log', 'records']);
const TAB_TEXT = { map: 'MAP', jobs: 'JOBS', log: 'LOG', records: 'RECORDS' };
const ORANGE = '#f08a2c';
const TAU = Math.PI * 2;
const upper = (s) => String(s ?? '').toUpperCase();
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const STUNT_TYPES = new Set(STUNTS);

function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

// How many of a zone's sparks a save holds: a base64 bitfield against the zone's total.
export function sparkShare(bits64, total) {
  if (!(total > 0) || !bits64) return 0;
  let n = 0;
  try {
    const raw = atob(bits64);
    for (let i = 0; i < raw.length; i++) { let b = raw.charCodeAt(i); while (b) { n += b & 1; b >>= 1; } }
  } catch { return 0; }
  return Math.min(1, n / total);
}

export function sparkTotal(zone) {
  let n = 0;
  for (const s of zone?.sparks || []) n += fin(s.n, s.pts?.length || 0);
  return n;
}

// Where a scan target sits on the map, if the data says.
function scanPos(zone, s) {
  const tg = s.target || {};
  if (s.pos) return s.pos;
  const at = tg.at || s.at;
  if (Array.isArray(at)) return Array.isArray(at[0]) ? at[0] : at;
  const b = (zone.bodies || []).find((x) => x.id === (tg.body || s.body || s.id));
  return b?.pos || null;
}

// Medal pips: four circles, filled up to the medal held.
function pips(parent, medal) {
  const box = h('span', 'l-pips', parent);
  const k = medal ? MEDAL_ORDER.indexOf(medal) + 1 : 0;
  for (let i = 0; i < 4; i++) h('i', i < k ? 'on' : '', box);
  box.setAttribute('aria-label', medal ? MEDAL_NAME[medal] : 'No medal');
  return box;
}

/**
 * createLog(root, { onJumpBack(zoneId), onWaypoint({ id, pos, label }), onClose(), onGhostLink(eventId), onTab(tab) })
 * → { el, open(tab), close(), render(save, zoneData, extra), isOpen, tab }.
 * save is the v3 save object (final.md 15). extra = { game (live position, seen, waypoint), facts ({ id: { text,
 * number, source, title } }), missions (mission data list), zones ({ id: zone data or { name } }), objective
 * ({ text }), unread (ids with an orange dot), homeDir ([x, y] map direction to Earth), aheadLy, canJumpBack,
 * photos ({ zoneId: url }) }.
 */
export function createLog(root, handlers = {}) {
  const H = handlers;
  const call = (name, ...a) => (typeof H[name] === 'function' ? H[name](...a) : undefined);
  const el = h('section', 'lyh-log', root);
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Ship log');
  const head = h('header', 'l-head', el);
  const tabs = h('nav', 'l-tabs', head);
  tabs.setAttribute('role', 'tablist');
  const tabB = {};
  for (const t of TABS) {
    const b = h('button', '', tabs, TAB_TEXT[t]);
    b.type = 'button';
    b.dataset.tab = t;
    b.setAttribute('role', 'tab');
    tabB[t] = b;
  }
  const close = h('button', 'l-close', head, '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the log');
  const body = h('div', 'l-body', el);
  const panes = {};
  for (const t of TABS) { panes[t] = h('div', `l-pane l-${t}`, body); panes[t].setAttribute('role', 'tabpanel'); }

  let tab = 'map', isOpen = false, last = { save: null, zone: null, extra: {} };
  let mapItems = [], mapView = null, picked = null;

  // ---------- MAP
  const mapWrap = h('div', 'l-mapwrap', panes.map);
  const canvas = h('canvas', 'l-map', mapWrap);
  canvas.setAttribute('aria-label', 'Map of this place');
  const pick = h('div', 'l-pick', panes.map);
  pick.hidden = true;
  const visited = h('div', 'l-visited', panes.map);

  function drawMap() {
    const { zone, extra, save } = last;
    const g = extra.game;
    if (!zone) return;
    const wide = (el.clientWidth || innerWidth) - 32, tall = Math.max(220, (el.clientHeight || innerHeight) - 210);
    const avail = Math.min(520, wide, tall);
    const S = Math.max(200, Math.floor(avail));
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    canvas.width = S * dpr; canvas.height = S * dpr;
    canvas.style.width = canvas.style.height = `${S}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const R = fin(zone.R, 450), k = (S / 2 - 18) / R, c = S / 2;
    const X = (p) => c + p[0] * k, Y = (p) => c - p[1] * k;
    mapView = { S, k, c };
    mapItems = [];
    const font = (px, w = 600) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

    ctx.beginPath(); ctx.arc(c, c, R * k, 0, TAU);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2;
    for (const road of zone.roads || []) {
      ctx.beginPath();
      if (road.kind === 'orbit' && road.centre) {
        const rr = Array.isArray(road.r) ? (road.r[0] + road.r[1]) / 2 : fin(road.r);
        ctx.arc(X(road.centre), Y(road.centre), rr * k, 0, TAU);
      } else {
        (road.pts || []).forEach((p, i) => (i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))));
      }
      ctx.stroke();
    }
    // A label with the video's diagonal leader: up-right first, then up-left, down-right, down-left; skipped when
    // every spot covers a label already drawn.
    const placed = [];
    const label = (text, x, y, colour = 'rgba(255,255,255,0.9)') => {
      ctx.font = font(10);
      const w = ctx.measureText(text).width;
      for (const [sx, sy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
        const ty = y + sy * 12, tx = x + sx * 21;
        const box = [sx > 0 ? tx : tx - w, ty - 7, w, 14];
        if (box[0] < 2 || box[0] + w > S - 2 || box[1] < 2 || box[1] + 14 > S - 2) continue;
        const hit = (r) => box[0] < r[0] + r[2] && r[0] < box[0] + box[2] && box[1] < r[1] + r[3]
          && r[1] < box[1] + box[3];
        if (placed.some(hit)) continue;
        placed.push(box);
        ctx.beginPath(); ctx.moveTo(x + sx * 5, y + sy * 5); ctx.lineTo(x + sx * 12, ty); ctx.lineTo(x + sx * 18, ty);
        ctx.strokeStyle = colour; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = colour; ctx.textBaseline = 'middle'; ctx.textAlign = sx > 0 ? 'left' : 'right';
        ctx.fillText(text, tx, ty);
        return;
      }
    };
    const ringAt = (x, y, r, colour, dash) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.setLineDash(dash || []);
      ctx.strokeStyle = colour; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    };
    const zr = g?.zone || {};
    const scanned = new Set([...(save?.scans || []), ...Object.keys(zr.scanned || {})]);
    for (const s of zone.scans || []) {
      const p = scanPos(zone, s);
      if (!p) continue;
      const done = scanned.has(s.id);
      if (!done && !zr.seen?.[s.id]) continue;
      const x = X(p), y = Y(p);
      ringAt(x, y, 6, done ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)', done ? null : [2, 3]);
      const fact = last.extra.facts?.[s.card || s.id] || factById(s.card || s.id);
      if (done) label(upper(s.label || fact?.title || s.id), x, y);
      mapItems.push({ id: s.id, card: s.card, x, y, pos: p, label: upper(s.label || fact?.title || s.id), kind: 'scan',
        done });
    }
    for (const e of zone.events || []) {
      const p = e.start?.pos;
      const seen = save?.events?.[e.id] || zr.seen?.[e.id];
      if (!p || !seen) continue;
      const x = X(p), y = Y(p);
      ringAt(x, y, 4.5, 'rgba(255,255,255,0.9)');
      label(upper(e.title || e.id), x, y);
      mapItems.push({ id: e.id, x, y, pos: p, label: upper(e.title || e.id), kind: 'event' });
    }
    for (const r of zone.rings || []) {
      if (!r.pos) continue;
      const x = X(r.pos), y = Y(r.pos);
      ringAt(x, y, 5, 'rgba(255,255,255,0.75)');
      label(upper(r.label || r.id), x, y);
      mapItems.push({ id: r.id, x, y, pos: r.pos, label: upper(r.label || r.id), kind: 'ring' });
    }
    const exitOpen = zr.exitOpen || save?.zones?.[zone.id]?.exitOpen;
    if (zone.exit?.pos && exitOpen) {
      const x = X(zone.exit.pos), y = Y(zone.exit.pos);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.strokeRect(x - 5, y - 5, 10, 10);
      label(upper(zone.exit.label || zone.exit.to), x, y);
      mapItems.push({ id: 'exit', x, y, pos: zone.exit.pos, label: upper(zone.exit.label || 'EXIT'), kind: 'exit' });
    }
    // The waypoint, orange.
    const wp = zr.waypoint;
    const wpPos = wp?.pos || mapItems.find((m) => m.id === (wp?.id ?? wp))?.pos;
    if (wpPos) {
      ringAt(X(wpPos), Y(wpPos), 9, ORANGE);
    }
    // Home: an orange chevron on the rim toward Earth.
    const hd = extra.homeDir;
    if (hd && Math.hypot(hd[0], hd[1]) > 1e-6) {
      const a = Math.atan2(-hd[1], hd[0]), rr = R * k + 8;
      const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath();
      ctx.fillStyle = ORANGE; ctx.fill(); ctx.restore();
      ctx.font = font(10, 700); ctx.fillStyle = ORANGE;
      ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      const tx = x - Math.cos(a) * 16, ty = y - Math.sin(a) * 14;
      ctx.fillText(Number.isFinite(extra.aheadLy) ? `HOME · ${fmtLy(extra.aheadLy)}` : 'HOME', tx, ty);
    }
    // You.
    const ship = g?.ship;
    if (ship?.pos) {
      const x = X(ship.pos), y = Y(ship.pos), a = fin(ship.yaw);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(2.2, -3); ctx.lineTo(-2.2, -3); ctx.closePath();
      ctx.fillStyle = ORANGE; ctx.fill(); ctx.restore();
    }
    ctx.font = font(11, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(upper(zone.name || zone.id), 6, 6);
    if (zone.scaleCard) {
      ctx.font = font(9, 500); ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(upper(zone.scaleCard).split(' · ').pop(), 6, 21);
    }
  }

  canvas.addEventListener('click', (e) => {
    if (!mapView) return;
    const b = canvas.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null, bd = 22;
    for (const m of mapItems) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bd) { bd = d; best = m; }
    }
    picked = best;
    showPick();
  });

  function showPick() {
    pick.textContent = '';
    pick.hidden = !picked;
    if (!picked) return;
    const fact = last.extra.facts?.[picked.card || picked.id] || factById(picked.card || picked.id);
    h('b', '', pick, picked.label);
    if (picked.done && fact?.text) h('p', '', pick, fact.text);
    const b = h('button', 'primary', pick, 'SET WAYPOINT');
    b.type = 'button';
    b.addEventListener('click', () => call('onWaypoint', { id: picked.id, pos: picked.pos, label: picked.label }));
  }

  function renderVisited() {
    const { save, zone, extra } = last;
    visited.textContent = '';
    const ids = Object.keys(save?.zones || {}).filter((id) => save.zones[id]?.visited);
    if (!ids.length) return;
    h('h3', '', visited, 'VISITED');
    for (const id of ids) {
      const row = h('div', 'l-row', visited);
      const z = extra.zones?.[id];
      h('span', '', row, upper(z?.name || id));
      const total = sparkTotal(z);
      if (total) h('small', '', row, `SPARKS ${Math.round(100 * sparkShare(save.zones[id].sparks, total))}%`);
      if (extra.canJumpBack && id !== zone?.id) {
        const b = h('button', '', row, 'JUMP BACK');
        b.type = 'button';
        b.addEventListener('click', () => call('onJumpBack', id));
      }
    }
  }

  // ---------- JOBS
  function renderJobs() {
    const { save, zone, extra } = last;
    const p = panes.jobs;
    p.textContent = '';
    const now = h('div', 'l-card l-now', p);
    h('small', '', now, 'NOW');
    h('b', '', now, upper(extra.objective?.text || (zone ? `EXPLORE ${upper(zone.name)}` : 'DRIVE')));
    const list = extra.missions || [];
    const done = (id) => !!save?.missions?.[id]?.done;
    const here = (m) => !zone || m.zone === zone.id || (zone.missions || []).includes(m.id);
    const open = list.filter((m) => !done(m.id) && here(m));
    if (open.length) h('h3', '', p, 'OPEN');
    for (const m of open) {
      const c = h('div', 'l-card', p);
      h('b', '', c, upper(m.title || m.id));
      const giver = m.giver ? upper(m.giver) : '';
      h('small', '', c, [giver, m.story ? 'STORY' : 'SIDE JOB'].filter(Boolean).join(' · '));
    }
    const finished = list.filter((m) => done(m.id));
    if (finished.length) h('h3', '', p, 'DONE');
    for (const m of finished) {
      const c = h('div', 'l-card l-done', p);
      const row = h('div', 'l-line', c);
      h('b', '', row, upper(m.title || m.id));
      pips(row, save.missions[m.id].medal);
    }
    if (!open.length && !finished.length) h('p', 'l-empty', p, 'No jobs yet. Someone will call.');
  }

  // ---------- LOG
  function factCard(parent, id, kind = '') {
    const { extra } = last;
    const f = extra.facts?.[id] || factById(id) || {};
    const c = h('article', `l-card ${kind}`, parent);
    if (extra.unread?.includes?.(id) || extra.unread?.has?.(id)) h('i', 'l-dot', c).setAttribute('aria-label', 'New');
    h('b', '', c, upper(f.title || id.replace(/-/g, ' ')));
    if (f.number) h('em', 'l-number', c, upper(f.number));
    if (f.text) h('p', '', c, f.text);
    if (f.source) {
      const a = h('a', 'l-source', c, 'SOURCE');
      a.href = f.source; a.target = '_blank'; a.rel = 'noopener noreferrer';
    }
    return c;
  }

  function renderLog() {
    const { save, zone, extra } = last;
    const p = panes.log;
    p.textContent = '';
    if (zone) {
      const c = h('article', 'l-card l-zone', p);
      const photo = extra.photos?.[zone.id];
      if (photo) {
        const img = h('img', '', h('div', 'l-photo', c));
        img.src = photo;
        img.alt = upper(zone.name);
      }
      h('b', '', c, upper(zone.name || zone.id));
      const f = extra.facts?.[zone.zoneCard || zone.id] || factById(zone.zoneCard || zone.id);
      if (f?.text) h('p', '', c, f.text);
      if (zone.scaleCard) h('small', 'l-scale', c, upper(zone.scaleCard));
    }
    const scans = save?.scans || [];
    const zoneScans = new Set((zone?.scans || []).map((s) => s.id));
    const order = [...scans.filter((id) => zoneScans.has(id)), ...scans.filter((id) => !zoneScans.has(id))];
    if (order.length) h('h3', '', p, `SCANS ${scans.filter((id) => zoneScans.has(id)).length}/${zoneScans.size}`);
    for (const id of order) factCard(p, id);
    const rumours = save?.rumours || [];
    if (rumours.length) h('h3', '', p, 'RUMOURS');
    for (const id of rumours) {
      const r = (zone?.rumours || []).find((x) => x.id === id);
      const c = h('article', 'l-card l-rumour', p);
      h('p', '', c, r?.text || upper(id));
      if (r?.from) h('small', '', c, `HEARD FROM ${upper(String(r.from).split(':').pop()).replace(/-/g, ' ')}`);
    }
    // Postcards: Earth as it looked in the light that reaches each place (milestones.js, EARLIER included).
    const posts = save?.postcards || [];
    if (posts.length) h('h3', '', p, 'POSTCARDS');
    for (const id of posts) {
      const m = milestoneById(id);
      const c = h('article', 'l-card l-post', p);
      h('b', '', c, m && Number.isFinite(m.yearsAgo) ? `EARTH · ${earthDateText(m.yearsAgo)}` : 'EARTH');
      if (m?.text) h('p', '', c, m.text);
      if (m?.source) {
        const a = h('a', 'l-source', c, 'SOURCE');
        a.href = m.source; a.target = '_blank'; a.rel = 'noopener noreferrer';
      }
    }
    const secrets = save?.secrets || [];
    if (secrets.length) h('h3', '', p, 'SECRETS');
    for (const id of secrets) {
      const s = (zone?.secrets || []).find((x) => x.id === id);
      factCard(p, s?.reward?.card || id, 'l-secret');
    }
    if (!zone && !order.length) h('p', 'l-empty', p, 'Nothing logged yet.');
  }

  // ---------- RECORDS
  function renderRecords() {
    const { save, zone, extra } = last;
    const p = panes.records;
    p.textContent = '';
    const evs = zone?.events || [];
    const seenIds = (e) => save?.events?.[e.id] || extra.game?.zone?.seen?.[e.id];
    const seen = evs.filter(seenIds);
    if (seen.length) h('h3', '', p, upper(zone.name || 'EVENTS'));
    for (const e of seen) {
      const rec = save?.events?.[e.id] || {};
      const c = h('div', 'l-card l-rec', p);
      const row = h('div', 'l-line', c);
      h('b', '', row, upper(e.title || e.id));
      const stunt = STUNT_TYPES.has(e.type) || e.stars;
      if (stunt) h('span', 'l-stars', row, '★'.repeat(fin(rec.stars)) + '☆'.repeat(3 - fin(rec.stars)));
      else pips(row, rec.medal);
      const sub = h('small', '', c);
      const bits = [];
      if (!stunt && Number.isFinite(rec.best)) bits.push(`BEST ${fmtTime(rec.best)}`);
      if (stunt && Number.isFinite(rec.best)) bits.push(`BEST ${fin(rec.best).toFixed(1)}`);
      if (!stunt && Number.isFinite(e.gold)) bits.push(`GOLD ${fin(e.gold).toFixed(1)}`);
      sub.textContent = bits.join(' · ') || 'NOT RUN YET';
      if (rec.pilot) h('span', 'l-pilot', row, 'P').setAttribute('aria-label', 'Pilot');
      if (H.onGhostLink && Number.isFinite(rec.best) && !stunt) {
        const b = h('button', 'l-ghost', c, 'SHARE GHOST');
        b.type = 'button';
        b.addEventListener('click', () => call('onGhostLink', e.id));
      }
    }
    const more = evs.length - seen.length;
    if (more > 0) h('p', 'l-more', p, `${more} MORE ${more === 1 ? 'SIGNAL' : 'SIGNALS'}`);
    const jumps = Object.entries(save?.jumps || {});
    if (jumps.length) h('h3', '', p, 'JUMPS');
    for (const [id, j] of jumps) {
      const c = h('div', 'l-card l-rec', p);
      const row = h('div', 'l-line', c);
      h('b', '', row, upper(id));
      pips(row, j.medal);
      if (Number.isFinite(j.peakEta)) h('small', '', c, `PEAK ${betaText(j.peakEta).text}`);
    }
    const f = save?.flags || {};
    if (Number.isFinite(f.velaWins) || Number.isFinite(f.velaLosses)) {
      h('h3', '', p, 'VELA');
      h('p', 'l-line', p, `YOU ${fin(f.velaWins)} · HER ${fin(f.velaLosses)}`);
    }
    if (!seen.length && !jumps.length && !more) h('p', 'l-empty', p, 'No records yet.');
  }

  function renderTab() {
    for (const t of TABS) {
      panes[t].hidden = t !== tab;
      tabB[t].setAttribute('aria-selected', t === tab ? 'true' : 'false');
      tabB[t].tabIndex = t === tab ? 0 : -1;
    }
    if (tab === 'map') { drawMap(); renderVisited(); showPick(); }
    else if (tab === 'jobs') renderJobs();
    else if (tab === 'log') renderLog();
    else renderRecords();
    const dot = (last.extra.unread?.length || last.extra.unread?.size || 0) > 0;
    tabB.log.classList.toggle('dot', dot);
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    picked = null;
    renderTab();
    call('onTab', tab);
  });
  close.addEventListener('click', () => call('onClose'));
  const onKey = (e) => {
    if (!isOpen) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
      tab = TABS[(i + TABS.length) % TABS.length];
      renderTab();
      tabB[tab].focus({ preventScroll: true });
      e.preventDefault();
    }
  };
  el.addEventListener('keydown', onKey);
  const onResize = () => { if (isOpen && tab === 'map') drawMap(); };
  addEventListener('resize', onResize);

  return {
    el,
    open(t = 'map') {
      tab = TABS.includes(t) ? t : 'map';
      isOpen = true;
      el.hidden = false;
      picked = null;
      renderTab();
      if (!matchMedia?.('(pointer: coarse)')?.matches) tabB[tab].focus({ preventScroll: true });
    },
    close() {
      isOpen = false;
      el.hidden = true;
      if (el.contains(document.activeElement)) document.activeElement.blur();
    },
    render(save, zoneData, extra = {}) {
      last = { save: save || {}, zone: zoneData || null, extra: extra || {} };
      if (isOpen) renderTab();
    },
    get isOpen() { return isOpen; },
    get tab() { return tab; },
    destroy() { removeEventListener('resize', onResize); el.remove(); },
  };
}
