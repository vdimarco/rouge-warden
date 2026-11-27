// Gloam Downs: the gear on the page (gloam-downs-hub design.md "The HUD by category" and "The cards by category"). The gear row in the
// HUD (Blade, Off-hand, Ability 1, Ability 2, a small tile for each open pane slot, and the wick count), the category mark that every
// card row and station row starts with (gearMark), the marks on the touch buttons, and the compare toast over a ground item. Each tile
// shows its category glyph, a colour edge with the colour's corner shape, and its tier mark (none, one pip, two pips), so it reads on a
// grey screen too. gear.css lays it out at the six layouts. The tiles are not buttons; the label names every slot for a screen reader.
import { BLADES, OFFHANDS, GEAR_GLYPHS, COLOUR_SHAPES, tierOf, traitsOf, traitOf, tierRow, traitNames, bladeOf, offhandOf, bladeHit } from './gear.js';
import { ABILITIES, PANES, COLOURS } from './growth.js';
import { WICKS, paneSlots } from './run.js';
import { HITS } from './moves.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// the category glyphs, drawn small in SVG (a 16 by 16 box, in the tile's text colour)
export const GLYPH_SVG = {
  blade: '<path d="M12.5 1.5 14.5 3.5 6 12 4 10Z"/><path d="M3 9.5 6.5 13 5.5 14 4.6 13.1 2.6 15.1 0.9 13.4 2.9 11.4 2 10.5Z"/>',
  shield: '<path d="M8 1.2 14 3.2V8c0 3.4-2.6 5.8-6 6.9C4.6 13.8 2 11.4 2 8V3.2Z"/>',
  flame: '<path d="M8 1c.6 2.4 4.6 4.4 4.6 8.4A4.6 4.6 0 0 1 3.4 9.4C3.4 7 5 5.7 5.6 4.1 6.3 5.4 6.6 6.4 7 7 7.6 5.2 8.4 3.4 8 1Z"/>',
  square: '<path d="M2 2h12v12H2Z M8 2v12 M2 8h12" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  wick: '<path d="M7 6h2v9H7Z"/><path d="M8 0.8c.5 1.4 2.2 2.4 2.2 4A2.2 2.2 0 0 1 5.8 4.8C5.8 3.6 7.4 2.6 8 0.8Z"/>'
};
// the colours' corner shapes (a Flame triangle, a Ward square, a Gloam diamond)
const CORNER_SVG = {
  triangle: '<path d="M0 0H8L0 8Z"/>',
  square: '<path d="M0 0H6V6H0Z"/>',
  diamond: '<path d="M4 0 8 4 4 8 0 4Z"/>'
};
export const CATEGORY_WORDS = { blade: 'Blade', offhand: 'Off-hand', ability: 'Ability', pane: 'Pane', wick: 'Wick', relic: 'Relic', spark: 'Spark', ware: 'Ware', unlock: 'Unlock', key: 'Key' };
const GLYPH_OF = { blade: 'blade', offhand: 'shield', ability: 'flame', pane: 'square', wick: 'wick', relic: 'flame', spark: 'flame', ware: 'flame', unlock: 'wick', key: 'square' };
const svg = (body, box = 16) => `<svg viewBox="0 0 ${box} ${box}" aria-hidden="true" focusable="false">${body}</svg>`;
export const colourOf = (kind, id) => (kind === 'blade' ? bladeOf(id) : kind === 'offhand' ? offhandOf(id) : kind === 'ability' ? ABILITIES.find(a => a.id === id) : kind === 'pane' ? PANES.find(p => p.id === id) : kind === 'wick' ? WICKS.find(w => w.id === id) : null)?.colour || null;
export const nameOf = (kind, id) => (kind === 'blade' ? bladeOf(id) : kind === 'offhand' ? offhandOf(id) : kind === 'ability' ? ABILITIES.find(a => a.id === id) : kind === 'pane' ? PANES.find(p => p.id === id) : kind === 'wick' ? WICKS.find(w => w.id === id) : null)?.name || id;
const TIERED = ['blade', 'offhand', 'ability'];

/* the mark a row or a tile starts with: its category glyph, the colour edge (a class for the rim, and the colour's shape in a corner),
   and the tier mark when its category has tiers. item: { kind, id, tier?, colour? }. o.word adds the category word after it. -> HTML */
export function gearMark(item, o = {}) {
  if (!item) return '';
  const kind = item.kind || 'ability', colour = item.colour ?? colourOf(kind, item.id), tier = TIERED.includes(kind) ? tierOf(item) : null;
  const pips = tier ? tierRow(tier).pips : 0, shape = colour ? COLOUR_SHAPES[colour] : null;
  const cls = ['gm', `k-${kind}`, colour ? `c-${colour}` : 'c-none', tier ? `t-${tier}` : ''].filter(Boolean).join(' ');
  return `<i class="${cls}" aria-hidden="true">${svg(GLYPH_SVG[GLYPH_OF[kind] || 'flame'])}${shape ? `<s class="cs">${svg(CORNER_SVG[shape], 8)}</s>` : ''}${pips ? `<u class="pips">${'<i></i>'.repeat(pips)}</u>` : ''}</i>${o.word ? `<span class="gm-word">${CATEGORY_WORDS[kind] || kind}</span>` : ''}`;
}
// one line a trait: "+ Smouldering: its hits burn 2 s"
export const traitLines = item => traitsOf(item).map(t => `+ ${traitOf(t).name}: ${traitOf(t).text}`);
// an item as it reads: "Hook blade, bright, Smouldering"
export const readName = (kind, x) => (x ? [nameOf(kind, x.id), ...(TIERED.includes(kind) ? [tierOf(x)] : []), ...traitNames(x)].join(', ') : 'empty');
// the main number of an item for the compare toast: a blade's first cut, an off-hand's or an ability's damage, else nothing
export function mainNumber(kind, x) {
  if (!x) return null;
  const p = tierRow(tierOf(x)).power;
  if (kind === 'blade') return Math.round((bladeHit(x, 0, i => HITS[i]) || HITS[0]).dmg);
  const row = kind === 'offhand' ? offhandOf(x.id) : ABILITIES.find(a => a.id === x.id);
  return row?.dmg ? Math.round(row.dmg * p) : null;
}

/* ---------------- the gear row ----------------
   gearRow(el, R): fills #gear from the runner (R.gear and R.abilities) or, with no runner, from rs.run. The tiles' order: Blade, Off-hand,
   Ability 1, Ability 2, then one small tile for each open pane slot, then the wick count. Only what changed is written, and the label
   at most once a second */
const last = new WeakMap();
export function gearView(R, rs = R?.rs) {
  const run = rs?.run;
  if (!run) return null;
  const g = R?.gear?.view?.(), ab = R?.abilities?.view?.() || (run.abilities || [null, null]).map(a => (a ? { ...a, left: 0, share: 0 } : null));
  const off = g?.offhand ?? (run.offhand ? { ...run.offhand, left: 0, share: 0 } : null);
  const panes = Array.from({ length: paneSlots(rs) }, (_, i) => rs.panes?.[i] || null);
  return {
    slots: [
      { kind: 'blade', label: 'Blade', x: run.blade || null },
      { kind: 'offhand', label: 'Off-hand', x: off, left: off?.left || 0, share: off?.share || 0 },
      { kind: 'ability', label: 'Ability 1', x: ab[0], left: ab[0]?.left || 0, share: ab[0]?.share || 0 },
      { kind: 'ability', label: 'Ability 2', x: ab[1], left: ab[1]?.left || 0, share: ab[1]?.share || 0 }
    ],
    panes, wicks: (run.wicks || []).length
  };
}
function tile(t, small = false) {
  const x = t.x, cool = t.left > 0;
  if (!x) return `<i class="gt empty k-${t.kind}${small ? ' small' : ''}">${svg(GLYPH_SVG[GLYPH_OF[t.kind]])}</i>`;
  const colour = colourOf(t.kind, x.id), tier = TIERED.includes(t.kind) ? tierOf(x) : null, pips = tier ? tierRow(tier).pips : 0;
  return `<i class="gt k-${t.kind} c-${colour || 'none'}${tier ? ` t-${tier}` : ''}${cool ? ' cool' : ''}${small ? ' small' : ''}" style="--cd:${(t.share || 0).toFixed(3)}">`
    + `${svg(GLYPH_SVG[GLYPH_OF[t.kind]])}${colour ? `<s class="cs">${svg(CORNER_SVG[COLOUR_SHAPES[colour]], 8)}</s>` : ''}${pips ? `<u class="pips">${'<i></i>'.repeat(pips)}</u>` : ''}`
    + `${cool ? `<b class="sec">${Math.ceil(t.left)}</b>` : ''}${t.key ? `<kbd>${t.key}</kbd>` : ''}</i>`;
}
export function gearLabel(v) {
  if (!v) return 'No gear';
  const parts = v.slots.map(t => `${t.label}: ${t.x ? readName(t.kind, t.x) + (t.left > 0 ? `, ready in ${Math.ceil(t.left)} seconds` : '') : 'empty'}`);
  const panes = v.panes.map(p => (p ? nameOf('pane', p) : 'empty'));
  return `${parts.join('. ')}. Panes: ${panes.join(', ') || 'none'}. Wicks: ${v.wicks}.`;
}
/* keys: the labels of the two ability inputs ('F', 'G'; 'LB', 'LT' on a pad), shown on the ability tiles; none on a touch screen,
   whose buttons carry the marks */
export function gearRow(el, R, rs = R?.rs, now = Date.now(), keys = null) {
  if (!el) return null;
  const v = gearView(R, rs);
  el.hidden = !v;
  if (!v) return null;
  if (keys) { v.slots[2].key = keys[0]; v.slots[3].key = keys[1]; }
  const html = v.slots.map(t => tile(t)).join('') + `<i class="gpanes">${v.panes.map(p => tile({ kind: 'pane', x: p ? { id: p } : null }, true)).join('')}</i>`
    + `<i class="gt wick small">${svg(GLYPH_SVG.wick)}<b>${v.wicks}</b></i>`;
  if (el.innerHTML !== html) el.innerHTML = html;
  const L = last.get(el) || { at: -1e9, text: '' }, text = gearLabel(v);
  // the label changes on a swap at once, and with the cooldowns at most once a second
  const changed = text.replace(/ready in \d+/g, 'ready in n') !== L.text.replace(/ready in \d+/g, 'ready in n');
  if (text !== L.text && (changed || now - L.at >= 1000)) { el.setAttribute('aria-label', text); last.set(el, { at: now, text }); }
  markButtons(v);
  return v;
}
// the touch buttons Off-hand, Ability 1 and Ability 2 show the same glyph, colour edge and tier mark (data attributes gear.css draws)
function markButtons(v) {
  if (typeof document === 'undefined') return;
  const map = [['bOff', v.slots[1]], ['bAb1', v.slots[2]], ['bAb2', v.slots[3]]];
  for (const [id, t] of map) {
    const b = document.getElementById(id);
    if (!b) continue;
    const colour = t.x ? colourOf(t.kind, t.x.id) : '', tier = t.x ? tierOf(t.x) : '';
    if (b.dataset.colour !== colour) b.dataset.colour = colour;
    if (b.dataset.tier !== tier) b.dataset.tier = tier;
    let m = b.querySelector(':scope > .bm');
    // first in the button: the page writes the button's label into its last child
    if (!m) { m = document.createElement('span'); m.className = 'bm'; m.setAttribute('aria-hidden', 'true'); b.insertBefore(m, b.firstChild); }
    const html = t.x ? `${svg(GLYPH_SVG[GLYPH_OF[t.kind]])}${colour ? `<s class="cs">${svg(CORNER_SVG[COLOUR_SHAPES[colour]], 8)}</s>` : ''}${tierRow(tier).pips ? `<u class="pips">${'<i></i>'.repeat(tierRow(tier).pips)}</u>` : ''}` : '';
    if (m.innerHTML !== html) m.innerHTML = html;
  }
}

/* ---------------- the compare toast ----------------
   On a ground blade, off-hand or ability lamp: the held item over the found one, each with its tier, traits and main number, and how to
   swap. In a narrow window (360 px or less) it is two lines with no numbers. gear.css keeps it clear of the touch buttons */
export function compareToast(el, R, narrow = typeof innerWidth === 'number' ? innerWidth <= 360 : false) {
  if (!el) return null;
  const c = R?.gear?.compare?.() || null;
  el.hidden = !c;
  if (!c) { if (el.innerHTML) el.innerHTML = ''; return null; }
  const word = CATEGORY_WORDS[c.kind], num = x => { const v = narrow ? null : mainNumber(c.kind, x); return v ? ` <em>${v}</em>` : ''; };
  // in a narrow window the held item is its name alone
  const held = c.held ? `${word}: ${esc(narrow ? nameOf(c.kind, c.held.id) : readName(c.kind, c.held))}` : `${word}: none`;
  const foundTraits = traitNames(c.found);
  const found = `${word}: ${esc([nameOf(c.kind, c.found.id), tierOf(c.found), ...foundTraits].join(', '))}`;
  // in a narrow window how to swap goes on the first line, so the toast stays two lines
  const how = `<span class="how">${c.how}</span>`;
  const html = `<p class="held">${gearMark({ kind: c.kind, ...(c.held || { id: c.found.id }) })}${held}${num(c.held)}${narrow ? ` ${how}` : ''}</p>`
    + `<p class="found">${gearMark({ kind: c.kind, ...c.found })}${found}${num(c.found)}${narrow ? '' : ` ${how}`}</p>`;
  if (el.innerHTML !== html) el.innerHTML = html;
  el.classList.toggle('narrow', !!narrow);
  return { ...c, text: el.textContent };
}
// for ?test and the hub's cards: every category word with its glyph
export const CATEGORY_GLYPHS = Object.fromEntries(Object.keys(CATEGORY_WORDS).map(k => [k, GLYPH_OF[k]]));
export const COLOUR_HUES = Object.fromEntries(COLOURS.map(c => [c.id, c.hue]));
export const GEAR_ITEMS = { blade: BLADES.map(b => b.id), offhand: OFFHANDS.map(o => o.id) };
