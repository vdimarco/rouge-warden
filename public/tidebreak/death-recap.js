// Death recap: who killed you, damage by source and type over the last seconds, which
// warned hits landed, and one tip from the main cause. buildRecap is pure (the sim calls
// it at the moment of death); RecapView draws it on the respawn screen.
import { RECAP_SECONDS } from './combat-tells.js';
const NEUTRAL = ['camp', 'boss', 'leviathan'], STRUCTURE = ['tower', 'core'];
export const RECAP_TYPES = { basic: 'Basic attacks', spell: 'Spells', tower: 'Towers', neutral: 'Neutrals', item: 'Items and effects' };
const typeOf = h => NEUTRAL.includes(h.sourceKind) ? 'neutral' : STRUCTURE.includes(h.sourceKind) ? 'tower' : h.type === 'attack' ? 'basic' : h.type === 'spell' ? 'spell' : 'item';
const round1 = n => Math.round(n * 10) / 10;

export function buildRecap(s, hero, killer) {
  const hits = (hero.damageLog || []).filter(h => s.time - h.time <= RECAP_SECONDS);
  const total = hits.reduce((n, h) => n + h.amount + h.absorbed, 0) || 1;
  const bySource = new Map(), types = {}, warned = new Map();
  for (const h of hits) {
    const dealt = h.amount + h.absorbed, type = typeOf(h);
    const src = bySource.get(h.source) || { id: h.source, name: h.name, kind: h.sourceKind, hero: h.hero, amount: 0, hits: 0, basic: 0 };
    src.amount += dealt; src.hits++; if (type === 'basic') src.basic += dealt; bySource.set(h.source, src);
    types[type] = (types[type] || 0) + dealt;
    if (h.telegraphed) { const key = `${h.source}:${h.label}`, w = warned.get(key) || { label: h.label, name: h.name, amount: 0, count: 0, dodgeable: h.dodgeable }; w.amount += dealt; w.count++; warned.set(key, w); }
  }
  const sources = [...bySource.values()].sort((a, b) => b.amount - a.amount || a.id - b.id).map(v => ({ ...v, amount: Math.round(v.amount), share: v.amount / total }));
  const controls = (hero.controlLog || []).filter(c => s.time - c.to <= RECAP_SECONDS), controlled = round1(controls.reduce((n, c) => n + (c.to - Math.max(c.from, s.time - RECAP_SECONDS)), 0));
  const warnedHits = [...warned.values()].sort((a, b) => b.amount - a.amount).map(w => ({ ...w, amount: Math.round(w.amount) }));
  const credit = killer?.kind === 'summon' ? s.units.find(u => u.id === killer.owner) || killer : killer;
  const recap = {
    time: s.time, window: hits.length ? round1(s.time - hits[0].time) : 0, total: Math.round(total),
    killer: credit ? { id: credit.id, name: credit.name || credit.kind, kind: credit.kind, hero: credit.hero } : null,
    sources, types: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, { amount: Math.round(v), share: v / total }])),
    warned: warnedHits, controlled, heroes: sources.filter(v => v.kind === 'hero').length,
  };
  Object.assign(recap, recapTip(recap));
  return recap;
}
// One short tip, chosen from the main cause of the death.
export function recapTip(r) {
  const share = k => r.types[k]?.share || 0, top = r.sources[0];
  const dodgeable = r.warned.filter(w => w.dodgeable), warnedShare = dodgeable.reduce((n, w) => n + w.amount, 0) / Math.max(1, r.total);
  if (share('tower') >= .35) return { cause: 'tower', tip: 'Tower fire grows with each shot. Leave its range when the red lock-on line appears.' };
  if (warnedShare >= .35) { const n = dodgeable.reduce((a, w) => a + w.count, 0); return { cause: 'warned', tip: `${n} warned ${n === 1 ? 'attack' : 'attacks'} hit you. Step out of the red shape before its ring fills.` }; }
  if (r.controlled >= 1.5) return { cause: 'control', tip: `You were stunned or feared for ${r.controlled.toFixed(1)} s. Stay out of stun range, or keep an escape ready.` };
  if (r.heroes >= 3) return { cause: 'outnumbered', tip: 'Three enemies hit you together. Fight near your team, or retreat when enemies are missing from the map.' };
  if (share('neutral') >= .5) return { cause: 'neutral', tip: 'The neutral beast did most of the damage. Dodge its warning, then hit it while it is EXPOSED.' };
  if (top && top.basic / Math.max(1, top.amount) >= .5 && top.share >= .4) return { cause: 'basic', tip: `${top.name} won with basic attacks. Keep your distance, and step away from the third strike.` };
  return { cause: 'burst', tip: 'Your health went down fast. Retreat earlier, before your health bar turns red.' };
}

// The view shows during respawn, never over the controls, and closes with its button.
export class RecapView {
  constructor(root) {
    this.el = document.createElement('section'); this.el.id = 'death-recap'; this.el.hidden = true;
    this.el.setAttribute('role', 'status'); this.el.setAttribute('aria-live', 'polite'); this.el.setAttribute('aria-label', 'Death recap');
    root.append(this.el); this.shown = null; this.closed = null;
  }
  update(p) {
    const r = p.hp <= 0 ? p.deathRecap : null, show = !!r && this.closed !== r;
    this.el.hidden = !show; if (!show) return;
    // The respawn countdown moves into the recap while it shows.
    if (this.shown === r) { const back = `Back in ${Math.max(1, Math.ceil(p.respawn))} s`; if (this.timer.textContent !== back) this.timer.textContent = back; return; }
    this.shown = r; this.el.replaceChildren();
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const head = el('div', 'recap-head'), title = el('b', '', r.killer ? `Banished by ${r.killer.name}` : 'The veil takes you');
    const close = el('button', 'recap-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Hide death recap');
    close.addEventListener('pointerdown', e => { e.stopPropagation(); }); close.addEventListener('click', () => { this.closed = r; this.el.hidden = true; });
    head.append(title, close); this.el.append(head);
    const sub = el('small', 'recap-sub', `${r.total} damage in the last ${Math.max(1, Math.round(r.window))} s · `); this.timer = el('strong', 'recap-timer', `Back in ${Math.max(1, Math.ceil(p.respawn))} s`); sub.append(this.timer); this.el.append(sub);
    const list = el('ol', 'recap-sources');
    for (const v of r.sources.slice(0, 3)) { const li = el('li'), bar = el('i'); bar.style.width = `${Math.round(v.share * 100)}%`; li.append(el('span', '', v.name), el('em', '', `${v.amount} · ${Math.round(v.share * 100)}%`), bar); list.append(li); }
    this.el.append(list);
    const types = Object.entries(r.types).sort((a, b) => b[1].amount - a[1].amount).map(([k, v]) => `${RECAP_TYPES[k]} ${Math.round(v.share * 100)}%`).join(' · ');
    this.el.append(el('p', 'recap-types', types));
    for (const w of r.warned.slice(0, 2)) this.el.append(el('p', 'recap-warned', `${w.dodgeable ? 'Dodgeable' : 'Warned'}: ${w.label}${w.count > 1 ? ` ×${w.count}` : ''} from ${w.name} · ${w.amount}`));
    if (r.controlled >= .3) this.el.append(el('p', 'recap-control', `Stunned or feared ${r.controlled.toFixed(1)} s`));
    this.el.append(el('p', 'recap-tip', r.tip));
  }
}
