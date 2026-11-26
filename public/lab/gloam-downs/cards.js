// Gloam Downs: the focus in the cards (the help card, the Map, the end card, the run's cards and the loading screen). The focus stays
// on the open card's own buttons: Tab, the d-pad and the left stick move it, and it wraps at the ends, so it never reaches ◀ Lab or
// Games behind the card (the dialog pattern of WAI-ARIA). A on a pad, and Space or Enter on keys, press the focused button. When a
// card opens, its main button takes the focus. A button that is off but still shown (aria-disabled) keeps the focus. The growth rows
// of the Lamp-room and the beacon card, and the HUD's growth marks, are here too (the end of the file).
import { takeSpark, chooseStartAbility, kindle, setPane, dropPattern, sparksOf, maxOf, paneSlots, kindledOf } from './run.js';
import { colourRow, colourLine, patternsMark, patternRows, paneRows, SPARK_PICKS, abilityLine, growthName, growthText, patternHue } from './screens.js';
import { COLOUR_IDS, PATTERN_IDS, ABILITY_IDS, PANE_IDS, STARTERS } from './growth.js';
export const wrapIndex = (i, n, d) => (((i + d) % n) + n) % n;
// the buttons of a card that can take the focus, in their order on the page
export const buttonsOf = box => [...box.querySelectorAll('button')].filter(b => !b.disabled && !b.hidden && !b.classList.contains('ghost') && b.getClientRects().length > 0);

// the open card: { el, main() -> its main button, back() -> true when it went back, or null }
let open = null;
export const current = () => (open && !open.el.hidden && !open.el.classList.contains('done') ? open : null);
export function show(card) {
  open = card;
  focusMain();
  return card;
}
export function shut(el) { if (open && (!el || open.el === el)) open = null; }
export function focusMain() {
  const c = current();
  if (!c) return;
  const b = c.main?.() || buttonsOf(c.el)[0];
  b?.focus({ preventScroll: true });
}
export function move(d) {
  const c = current();
  if (!c) return;
  const list = buttonsOf(c.el);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const b = list[i < 0 ? (d > 0 ? 0 : list.length - 1) : wrapIndex(i, list.length, d)];
  b.focus({ preventScroll: true });
  // a long card (the Lamp-room with its unlocks) scrolls inside itself, so the focused button is in view with keys or a pad alone
  b.scrollIntoView?.({ block: 'nearest' });
}
/* the grid move (gloam-downs-screens-life "Inputs and layouts"): on rows of lamp cards and the title's lamps, left and right move along a
   row and up and down between rows. From the focused button's centre, the nearest button whose centre lies that way (within 60
   degrees of it), by the distance along the way plus twice the distance across it. rects: [{ x, y, w, h }]; -> an index, or -1 */
export function gridPick(rects, i, dx, dy) {
  const c = r => [r.x + r.w / 2, r.y + r.h / 2], [x0, y0] = c(rects[i]);
  let best = -1, score = Infinity;
  rects.forEach((r, j) => {
    if (j === i) return;
    const [x, y] = c(r), along = (x - x0) * dx + (y - y0) * dy, across = Math.abs((x - x0) * dy - (y - y0) * dx);
    if (along <= 1 || across > along * Math.tan(Math.PI / 3)) return;
    const k = along + 2 * across;
    if (k < score) { score = k; best = j; }
  });
  return best;
}
// a move by a way (the arrow keys, the d-pad): the grid move, or the next button in the order when nothing lies that way
export function moveDir(dx, dy) {
  const c = current();
  if (!c) return;
  const list = buttonsOf(c.el), i = list.indexOf(document.activeElement);
  if (i < 0) return move(dx + dy > 0 ? 1 : -1);
  const j = gridPick(list.map(b => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }), i, dx, dy);
  if (j < 0) return move(dx + dy > 0 ? 1 : -1);
  list[j].focus({ preventScroll: true });
  list[j].scrollIntoView?.({ block: 'nearest' });
}
const ARROWS = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
addEventListener('keydown', e => {
  const d = ARROWS[e.key.toLowerCase()];
  if (!d || !current() || e.altKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  moveDir(d[0], d[1]);
}, true);
// touch has no hover: the focus style shows on the press itself
// (pressFocus() is true while that focus lands, so the page plays no hover for it: touch has no hover)
let pressing = false;
export const pressFocus = () => pressing;
addEventListener('pointerdown', e => {
  const c = current(), b = e.target instanceof Element ? e.target.closest('button') : null;
  if (c && b && c.el.contains(b) && e.pointerType !== 'mouse') { pressing = true; try { b.focus({ preventScroll: true }); } finally { pressing = false; } }
}, true);
// press the focused button, or the main button when the focus is outside the card -> the button pressed
export function press() {
  const c = current();
  if (!c) return null;
  const list = buttonsOf(c.el);
  const b = list.includes(document.activeElement) ? document.activeElement : c.main?.() || list[0];
  if (!b || b.getAttribute('aria-disabled') === 'true') return null;
  b.click();
  return b;
}
// Tab and Shift+Tab move only between the open card's buttons
addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !current()) return;
  e.preventDefault();
  move(e.shiftKey ? -1 : 1);
}, true);

/* ---------------- growth on the page (gloam-downs-growth, builder G) ----------------
   The HUD's colour row and pattern count, the Lamp-room's colours, patterns and pane rows, the beacon card's spark and ability buttons,
   the pattern toasts, and the test hooks' growth fields. main.js binds the page once (bindGrowth) with getters for its state */
let G = null;
const byId = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function bindGrowth(page) { G = page; return page; }
// the HUD: "▲ 2 ◆ 1 ● 3" once a colour has a level, "◇ 1" while a pattern is carried; and the toasts the runner left
export function updateGrowth() {
  if (!G) return;
  const rs = G.rs(), run = rs?.run, row = byId('colourRow');
  if (row) {
    const cols = run ? colourRow(run) : [];
    row.hidden = !cols.some(c => c.n > 0);
    const html = cols.map(c => `<i style="color:${c.hue}" title="${c.name} ${c.n}">${c.text}</i>`).join('');
    if (row.innerHTML !== html) row.innerHTML = html;
    row.setAttribute('aria-label', cols.map(c => `${c.name} ${c.n}`).join(', '));
  }
  // the count line is written again after this (main.js updateRunHud), so its pattern mark is set once that is done, as its last child
  queueMicrotask(() => {
    const count = byId('count');
    if (!count) return;
    let pat = byId('patternsN');
    if (!pat || pat.parentNode !== count) { pat?.remove(); pat = document.createElement('i'); pat.id = 'patternsN'; count.appendChild(pat); }
    const run2 = G.rs()?.run, t = patternsMark(run2);
    pat.hidden = !t;
    pat.textContent = t ? ` · ${t}` : '';
    pat.title = t ? `Patterns carried: ${(run2.carriedPatterns || []).map(growthName).join(', ')}` : '';
  });
  const R = G.runner();
  while (R?.notes?.length) G.toast(R.notes.shift(), 2600);
  // a cache's spark: its small card opens at once (keys.js gives the pick with takeSparkPick)
  if (run?.sparkNow && run.sparkPicks > 0 && G.mode() === 'play') G.openBeacon();
}
/* the Lamp-room: the run's colours on the top line, the found patterns with Kindle, and a row for each open pane slot. Kindle and the
   pane buttons store at once */
export function fillGrowthLamp() {
  if (!G) return;
  const rs = G.rs(), run = rs.run, col = byId('colours');
  if (col) { col.hidden = !run; col.textContent = run ? `The run's colours: ${colourLine(run)}` : ''; }
  /* a pattern is an unlit lamp in its colour's hue, with its name, gift, cost and Kindle; a pattern kindled in this visit stays on the
     shelf as a lit lamp with no button (lit), until the Lamp-room opens again */
  const list = byId('patterns'), rows = patternRows(rs), lit = [...kindledNow].filter(id => !rows.some(r => r.id === id));
  byId('patternsT').hidden = list.hidden = !rows.length && !lit.length;
  for (const li of [...list.children]) if (!rows.some(r => r.id === li.dataset.pattern) && !lit.includes(li.dataset.pattern)) li.remove();
  for (const row of rows) {
    const li = patternTile(list, row.id);
    li.dataset.label = row.label;
    li.querySelector('.nm').textContent = growthName(row.id);
    li.querySelector('.gift').textContent = growthText(row.id);
    li.querySelector('.cost').textContent = `${row.cost} glim`;
    const btn = li.querySelector('button');
    btn.hidden = false;
    btn.textContent = row.buy;
    btn.setAttribute('aria-disabled', String(!!row.need));
    btn.setAttribute('aria-label', row.need ? `${row.label}: ${row.need} more glim needed` : `Kindle ${row.label}`);
  }
  for (const id of lit) {
    const li = patternTile(list, id);
    li.classList.add('kindled');
    li.querySelector('.nm').textContent = growthName(id);
    li.querySelector('.gift').textContent = growthText(id);
    li.querySelector('.cost').textContent = 'Kindled';
    li.querySelector('button').hidden = true;
  }
  const box = byId('paneRow'), panes = paneRows(rs), had = document.activeElement?.closest?.('#paneRow') ? { ...document.activeElement.dataset } : null;
  byId('panesT').hidden = box.hidden = !panes.some(p => p.panes.length);
  box.textContent = '';
  for (const p of panes) {
    const r = document.createElement('div');
    r.className = 'paneSlot';
    r.setAttribute('role', 'group');
    r.setAttribute('aria-label', `Pane slot ${p.slot + 1}`);
    const lab = document.createElement('b');
    lab.textContent = `Slot ${p.slot + 1}`;
    r.appendChild(lab);
    for (const x of p.panes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.slot = String(p.slot);
      b.dataset.pane = x.id;
      b.setAttribute('aria-pressed', String(x.on));
      b.title = x.text;
      b.innerHTML = `<b>${esc(x.name)}</b> ${esc(x.text)}`;
      b.addEventListener('click', () => paneButton(p.slot, x.id));
      r.appendChild(b);
    }
    box.appendChild(r);
  }
  if (had) box.querySelector(`button[data-slot="${had.slot}"][data-pane="${had.pane}"]`)?.focus({ preventScroll: true });
}
// the patterns kindled since the Lamp-room opened (main.js clears it on each open)
const kindledNow = new Set();
export const freshLamp = () => kindledNow.clear();
function patternTile(list, id) {
  let li = list.querySelector(`li[data-pattern="${id}"]`);
  if (!li) {
    li = document.createElement('li');
    li.className = 'tile';
    li.dataset.pattern = id;
    li.style.setProperty('--hue', patternHue(id));
    li.innerHTML = '<i class="glass" aria-hidden="true"><i class="flame"></i></i><b class="nm"></b><span class="gift"></span><span class="cost"></span><button type="button"></button>';
    li.querySelector('.glass').style.setProperty('--hue', patternHue(id));
    li.querySelector('button').addEventListener('click', () => kindleRow(id));
    list.appendChild(li);
  }
  return li;
}
function kindleRow(id) {
  const rs = G.rs(), list = byId('patterns'), btn = list.querySelector(`li[data-pattern="${id}"] button`), had = document.activeElement === btn;
  // the Kindle buttons after this one, then those before it, as they stand before the row leaves
  const rows = [...list.querySelectorAll('li[data-pattern]')].filter(li => !li.classList.contains('kindled')).map(li => li.dataset.pattern), at = rows.indexOf(id), order = [...rows.slice(at + 1), ...rows.slice(0, at).reverse()];
  if (!kindle(rs, id)) { G.audio()?.cue('refuse'); return; }
  kindledNow.add(id);
  // the page plays kindle and lights the tile (main.js)
  G.kindled?.(id);
  G.storeRun();
  G.fillLamp();
  G.updateHud();
  /* the row leaves the list, and the focus stays where it was: on a pane just kindled, its button in the first pane slot (to set it
     now); else the next Kindle button of the patterns (then the one before); else the first pane button; else the main button */
  if (had) {
    const pane = byId('paneRow').querySelector(`button[data-pane="${id}"]`);
    const next = pane || order.map(p => list.querySelector(`li[data-pattern="${p}"] button:not([hidden])`)).find(Boolean) || byId('paneRow').querySelector('button');
    next && !next.closest('[hidden]') ? next.focus({ preventScroll: true }) : focusMain();
  }
}
function paneButton(slot, id) {
  const rs = G.rs(), on = (rs.panes || [])[slot] === id;
  if (!setPane(rs, slot, on ? null : id)) { G.audio()?.cue('refuse'); return; }
  G.audio()?.cue('choice');
  G.storeRun();
  G.fillLamp();
  G.updateHud();
}
/* ---------------- lamp cards (gloam-downs-screens-life) ----------------
   A choice is a card: a glass in its colour (a gold rim when bright), the name in the title font and the gift. Its text reads as the
   old button's did ("Flame +1 · damage"); the words for a screen reader say its colour and whether it is bright */
export function lampCard(b, o) {
  b.classList.add('lcard');
  b.classList.toggle('bright', !!o.bright);
  b.style.setProperty('--hue', o.hue);
  b.innerHTML = `<i class="glow" aria-hidden="true"></i><i class="glass" aria-hidden="true"><i class="flame"></i></i><b>${esc(o.name)}</b><span class="sep"> · </span><span class="gift">${esc(o.text)}</span>`;
  if (o.label) b.setAttribute('aria-label', o.label);
  return b;
}
/* a set of choices deals in: each card fades in and rises 12 px over 220 ms, 70 ms after the one before; with reduced motion a fade of
   150 ms. -> the animations */
export function dealIn(list, still = false) {
  return [...list].map((b, i) => b.animate?.(still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: still ? 150 : 220, delay: still ? 0 : i * 70, easing: 'ease-out', fill: 'backwards' }));
}
// a pick: the chosen card flares (its glow to 140% and back over 240 ms) and the others fade to 30% over 160 ms; with reduced motion none
/* the pick is made on the press, and the card's set is built again at once (main.js), so the flare plays on a copy of the card laid
   where it stood, which then goes */
export function flare(b, others = [], still = false) {
  if (still || !b.isConnected) return;
  for (const o of others) if (o !== b) o.classList.add('faded');
  const r = b.getBoundingClientRect(), g = b.cloneNode(true), host = b.closest('.panel') || document.body;
  g.removeAttribute('id');
  g.setAttribute('aria-hidden', 'true');
  g.tabIndex = -1;
  g.classList.add('ghost');
  const h = host.getBoundingClientRect();
  Object.assign(g.style, { position: 'absolute', left: `${r.left - h.left}px`, top: `${r.top - h.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', pointerEvents: 'none', zIndex: '2' });
  host.appendChild(g);
  g.querySelector('.glow')?.animate?.([{ opacity: 1, filter: 'brightness(1)' }, { opacity: 1, filter: 'brightness(1.4)', offset: 0.4 }, { opacity: 1, filter: 'brightness(1)' }], { duration: 240, easing: 'ease-out' });
  g.animate?.([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 340, easing: 'ease-out' }).finished.then(() => g.remove(), () => g.remove());
}
const pickHook = (kind, id, b) => G?.picked?.(kind, id, b);
// the beacon card's spark buttons, in #sparks: "Flame +1", "Ward +1", "Gloam +1". done() runs once one is taken
export function sparkButtons(box, done) {
  box.textContent = '';
  for (const s of SPARK_PICKS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `wick spark ${s.id}`;
    b.dataset.spark = s.id;
    lampCard(b, { name: s.label, text: s.text, hue: s.hue, label: `${s.label}, ${s.text}, in its colour` });
    b.addEventListener('click', () => {
      const rs = G.rs();
      if (!rs.run || !takeSpark(rs, s.id)) return;
      pickHook('spark', s.id, b);
      G.storeRun();
      G.updateHud();
      done();
    });
    box.appendChild(b);
  }
}
// Belt's start offer: two ability buttons in the wick box
export function abilityButtons(box, offer, done) {
  const bright = ((G.rs()?.up?.belt) | 0) >= 3;
  for (const id of offer) {
    const b = document.createElement('button'), name = growthName(id);
    b.type = 'button';
    b.className = 'wick ability';
    b.dataset.ability = id;
    lampCard(b, { name, text: abilityLine(id).slice(name.length + 3), hue: patternHue(id), bright, label: `${name}, ${growthText(id)}${bright ? ', bright' : ''}` });
    b.addEventListener('click', () => {
      const rs = G.rs();
      if (!rs.run || !chooseStartAbility(rs, id)) return;
      pickHook('ability', id, b);
      G.storeRun();
      G.updateHud();
      done();
    });
    box.appendChild(b);
  }
}
// ?test: the growth fields of __gloam.run()
export function growthView() {
  const rs = G?.rs(), run = rs?.run, R = G?.runner();
  return {
    sparks: run ? sparksOf(run) : { flame: 0, ward: 0, gloam: 0 }, sparkPicks: run?.sparkPicks ?? 0, patterns: (rs?.patterns || []).slice(), carriedPatterns: (run?.carriedPatterns || []).slice(),
    kindledAll: rs ? kindledOf(rs) : STARTERS.slice(), panes: (rs?.panes || []).slice(), paneSlots: rs ? paneSlots(rs) : 1, up: rs ? { ...rs.up } : {},
    slots: run?.abilities ? run.abilities.map(a => (a ? { ...a } : null)) : [null, null], abilityOffer: run?.abilityOffer?.slice() ?? null,
    groundPatterns: (run?.groundPatterns || []).map(g => ({ ...g })), kept: (run?.kept || []).slice(), notes: R?.notes?.length ?? 0
  };
}
/* ?test: __gloam.set's growth fields. sparks sets the levels now (the health stays under the new maximum); dropPattern lays a pattern
   lamp at the lamplighter's feet (an id, or { id, at: [x, y, z] }) */
export function setGrowth(o = {}) {
  const rs = G?.rs();
  if (!rs) return;
  if (Array.isArray(o.kindled)) rs.kindled = [...new Set([...STARTERS, ...o.kindled.filter(id => [...ABILITY_IDS, ...PANE_IDS].includes(id))])];
  if (Array.isArray(o.patterns)) rs.patterns = [...new Set(o.patterns.filter(id => PATTERN_IDS.includes(id) && !kindledOf(rs).includes(id)))];
  if (Array.isArray(o.panes)) { rs.panes = []; o.panes.forEach((id, i) => setPane(rs, i, id ?? null)); }
  const run = rs.run;
  if (!run) return;
  if (o.sparks && typeof o.sparks === 'object') {
    run.sparks = { ...sparksOf(run), ...Object.fromEntries(COLOUR_IDS.filter(c => Number.isInteger(o.sparks[c])).map(c => [c, Math.max(0, Math.min(40, o.sparks[c]))])) };
    run.hp = Math.min(run.hp, maxOf(rs));
  }
  if (Number.isInteger(o.sparkPicks)) run.sparkPicks = Math.max(0, Math.min(9, o.sparkPicks));
  if (Array.isArray(o.carriedPatterns)) run.carriedPatterns = [...new Set(o.carriedPatterns.filter(id => PATTERN_IDS.includes(id)))];
  if (o.dropPattern) {
    const d = typeof o.dropPattern === 'string' ? { id: o.dropPattern } : o.dropPattern, R = G.runner();
    if (R) dropPattern(R, d.at || null, d.id || null);
  }
}
