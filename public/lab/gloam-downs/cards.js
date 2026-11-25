// Gloam Downs: the focus in the cards (the help card, the Map, the end card, the run's cards and the loading screen). The focus stays
// on the open card's own buttons: Tab, the d-pad and the left stick move it, and it wraps at the ends, so it never reaches ◀ Lab or
// Games behind the card (the dialog pattern of WAI-ARIA). A on a pad, and Space or Enter on keys, press the focused button. When a
// card opens, its main button takes the focus. A button that is off but still shown (aria-disabled) keeps the focus. The growth rows
// of the Lamp-room and the beacon card, and the HUD's growth marks, are here too (the end of the file).
import { takeSpark, chooseStartAbility, kindle, setPane, dropPattern, sparksOf, maxOf, paneSlots, kindledOf } from './run.js';
import { colourRow, colourLine, patternsMark, patternRows, paneRows, SPARK_PICKS, abilityLine, growthName } from './screens.js';
import { COLOUR_IDS, PATTERN_IDS, ABILITY_IDS, PANE_IDS, STARTERS } from './growth.js';
export const wrapIndex = (i, n, d) => (((i + d) % n) + n) % n;
// the buttons of a card that can take the focus, in their order on the page
export const buttonsOf = box => [...box.querySelectorAll('button')].filter(b => !b.disabled && !b.hidden && b.getClientRects().length > 0);

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
  const list = byId('patterns'), rows = patternRows(rs);
  byId('patternsT').hidden = list.hidden = !rows.length;
  for (const li of [...list.children]) if (!rows.some(r => r.id === li.dataset.pattern)) li.remove();
  for (const row of rows) {
    let li = list.querySelector(`li[data-pattern="${row.id}"]`);
    if (!li) {
      li = document.createElement('li');
      li.dataset.pattern = row.id;
      li.innerHTML = '<span></span><button type="button"></button>';
      li.querySelector('button').addEventListener('click', () => kindleRow(row.id));
      list.appendChild(li);
    }
    li.querySelector('span').textContent = row.label;
    const btn = li.querySelector('button');
    btn.textContent = row.buy;
    btn.setAttribute('aria-disabled', String(!!row.need));
    btn.setAttribute('aria-label', row.need ? `${row.label}: ${row.need} more glim needed` : `Kindle ${row.label}`);
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
function kindleRow(id) {
  const rs = G.rs(), list = byId('patterns'), btn = list.querySelector(`li[data-pattern="${id}"] button`), had = document.activeElement === btn;
  // the Kindle buttons after this one, then those before it, as they stand before the row leaves
  const rows = [...list.querySelectorAll('li[data-pattern]')].map(li => li.dataset.pattern), at = rows.indexOf(id), order = [...rows.slice(at + 1), ...rows.slice(0, at).reverse()];
  if (!kindle(rs, id)) { G.audio()?.cue('refuse'); return; }
  G.audio()?.cue('buy');
  G.storeRun();
  G.fillLamp();
  G.updateHud();
  /* the row leaves the list, and the focus stays where it was: on a pane just kindled, its button in the first pane slot (to set it
     now); else the next Kindle button of the patterns (then the one before); else the first pane button; else the main button */
  if (had) {
    const pane = byId('paneRow').querySelector(`button[data-pane="${id}"]`);
    const next = pane || order.map(p => list.querySelector(`li[data-pattern="${p}"] button`)).find(Boolean) || byId('paneRow').querySelector('button');
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
// the beacon card's spark buttons, in #sparks: "Flame +1", "Ward +1", "Gloam +1". done() runs once one is taken
export function sparkButtons(box, done) {
  box.textContent = '';
  for (const s of SPARK_PICKS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `wick spark ${s.id}`;
    b.dataset.spark = s.id;
    b.style.setProperty('--hue', s.hue);
    b.innerHTML = `<b>${esc(s.label)}</b> · ${esc(s.text)}`;
    b.addEventListener('click', () => {
      const rs = G.rs();
      if (!rs.run || !takeSpark(rs, s.id)) return;
      G.audio()?.cue('choice');
      G.storeRun();
      G.updateHud();
      done();
    });
    box.appendChild(b);
  }
}
// Belt's start offer: two ability buttons in the wick box
export function abilityButtons(box, offer, done) {
  for (const id of offer) {
    const b = document.createElement('button'), name = growthName(id);
    b.type = 'button';
    b.className = 'wick ability';
    b.dataset.ability = id;
    b.innerHTML = `<b>${esc(name)}</b>${esc(abilityLine(id).slice(name.length))}`;
    b.addEventListener('click', () => {
      const rs = G.rs();
      if (!rs.run || !chooseStartAbility(rs, id)) return;
      G.audio()?.cue('choice');
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
