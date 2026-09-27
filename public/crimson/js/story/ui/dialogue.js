// js/story/ui/dialogue.js : talk, subtitles and choices (a port of Breath of the Lake's ui.say and
// ui.choose, as handles instead of promises).
// say(lines, {portraits, block}) -> {done}. A line is a LINES id, {who, text} or {who, line}. block (the
// default) is a modal box that freezes play: an ink portrait (types.js PORTRAITS; a missing file shows the
// speaker's glyph card instead, A3; Dana has none, by design), the name, and the words typing at 45
// characters a second. E, Space, Enter, pad A or a tap finishes the typing, then goes on. block:false plays
// the lines as subtitles one after another with no freeze (while driving); done when the last one ends.
// subs(who, text, dur): one subtitle, at most two lines, for dur or 3.5 s + 60 ms a character. Subtitles and
// the box sit above the cine letterbox bars.
// choose(title, options) -> {done, index}: choice cards, by the arrows, the d-pad or a tap.
import { esc } from './cards.js';

const CPS = 45;

export function createDialogue(U) {
  const { S, make, root } = U;
  const box = make('div', 'sSay hidden', root, `<div class="pf"><img alt=""><b class="gl"></b></div><div class="tx"><p class="nm"></p><p class="ln"></p><i class="nx"></i></div>`);
  box.id = 'sSay';
  const subsEl = make('p', 'sSubs hidden', root); subsEl.id = 'sSubs';
  const chEl = make('div', 'sChoice hidden', root, `<div><h3></h3><div class="opts"></div><p class="hintc"></p></div>`);
  chEl.id = 'sChoice';
  const img = box.querySelector('img'), gl = box.querySelector('.gl'), nm = box.querySelector('.nm'), ln = box.querySelector('.ln'), nx = box.querySelector('.nx'), pf = box.querySelector('.pf');
  const bad = new Set(); // portraits that failed to load
  img.addEventListener('error', () => { bad.add(img.dataset.src); showGlyph(img.dataset.who); });
  let sayH = null, typing = null, subsH = null, subsUntil = 0, choiceH = null, focusI = 0;

  /* ---------------- the modal box ---------------- */
  function showGlyph(who) { const g = U.glyph(who); pf.classList.toggle('glyph', !!g); pf.classList.toggle('none', !g); img.removeAttribute('src'); gl.textContent = g; }
  function showLine() {
    const l = U.lineOf(sayH.lines[sayH.i]);
    const who = l.who, src = sayH.portraits === false ? null : U.portrait(who);
    nm.textContent = U.whoName(who);
    box.classList.toggle('crew', U.isCrew(who));
    pf.classList.remove('glyph', 'none');
    if (src === null || !who) { pf.classList.add('none'); img.removeAttribute('src'); gl.textContent = ''; }
    else if (src === undefined || bad.has(src)) showGlyph(who);
    else { img.dataset.src = src; img.dataset.who = who; if (img.getAttribute('src') !== src) img.src = src; gl.textContent = ''; }
    typing = { text: l.text, t: 0, n: -1 };
    ln.textContent = '';
    nx.textContent = '';
    sayH.shownAt = S.timers.now;
  }
  function nextLine() {
    if (!sayH) return;
    sayH.i++;
    if (sayH.i >= sayH.lines.length) { const h = sayH; sayH = null; typing = null; h.done = true; box.classList.add('hidden'); root.classList.remove('sayOn'); U.popModal('dialog'); }
    else showLine();
  }
  function advance() {
    if (!sayH) return;
    if (typing && typing.n < typing.text.length) { typing.n = typing.text.length; ln.textContent = typing.text; typing = null; return; }
    U.blip('move');
    nextLine();
  }
  box.addEventListener('click', (e) => { e.stopPropagation(); if (sayH && S.timers.now - sayH.shownAt > 0.08) advance(); });
  box.addEventListener('pointerdown', (e) => e.stopPropagation());

  /* ---------------- subtitles ---------------- */
  function setSubs(who, text) {
    const name = U.whoName(who);
    subsEl.innerHTML = name ? `<b class="${U.isCrew(who) ? 'crew' : ''}">${esc(name)}</b> ${esc(text)}` : esc(text);
    subsEl.classList.remove('hidden');
  }
  const subsDur = (text) => 3.5 + String(text).length * 0.06;
  function showSubsLine() { const l = U.lineOf(subsH.lines[subsH.i]); setSubs(l.who, l.text); subsH.until = S.timers.now + subsDur(l.text); subsUntil = 0; }
  function nextSubs() { if (!subsH) return; subsH.i++; if (subsH.i >= subsH.lines.length) { subsH.done = true; subsH = null; subsEl.classList.add('hidden'); } else showSubsLine(); }

  function say(lines, o = {}) {
    const list = [].concat(lines || []);
    if (o && o.block === false) {
      if (subsH) subsH.done = true;
      const h = { done: false, lines: list, i: 0, until: 0 };
      if (!list.length) { h.done = true; return h; }
      subsH = h; showSubsLine();
      return h;
    }
    if (sayH) { const h = sayH; sayH = null; h.done = true; U.popModal('dialog'); }
    const h = { done: false, lines: list, i: 0, portraits: o && o.portraits, shownAt: 0 };
    if (!list.length) { h.done = true; return h; }
    sayH = h; U.pushModal('dialog'); box.classList.remove('hidden'); root.classList.add('sayOn'); showLine();
    return h;
  }
  function subs(who, text, dur) {
    if (subsH) { subsH.done = true; subsH = null; }
    if (!text) { subsEl.classList.add('hidden'); subsUntil = 0; return; }
    setSubs(who, text); subsUntil = S.timers.now + (dur ?? subsDur(text));
  }

  /* ---------------- choices ---------------- */
  chEl.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('button'); if (b && choiceH) pick(+b.dataset.i); });
  chEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  function choose(title, options) {
    if (choiceH) pick(-1);
    const opts = [].concat(options || []).map((o) => (typeof o === 'string' ? o : o.label || String(o)));
    const h = { done: false, index: -1, choice: -1, title: title || '', options: opts, shownAt: S.timers.now };
    if (!opts.length) { h.done = true; return h; }
    choiceH = h;
    chEl.querySelector('h3').textContent = title || '';
    const box2 = chEl.querySelector('.opts'); box2.innerHTML = '';
    opts.forEach((label, i) => { const b = make('button', 'opt', box2); b.type = 'button'; b.dataset.i = i; b.innerHTML = `<small>${i + 1}</small>${esc(label)}`; });
    chEl.querySelector('.hintc').textContent = U.touch ? 'TAP TO CHOOSE' : U.keys('ARROWS · {use} CHOOSES').replace('ARROWS', U.device === 'pad' ? 'D-PAD' : 'ARROWS');
    chEl.classList.remove('hidden');
    U.pushModal('choice');
    U.input.unlock();
    focusI = 0; showFocus();
    return h;
  }
  function pick(i) {
    const h = choiceH; if (!h) return;
    choiceH = null; h.done = true; h.index = i; h.choice = i;
    chEl.classList.add('hidden'); U.popModal('choice');
  }
  function showFocus() { [...chEl.querySelectorAll('.opt')].forEach((b, i) => b.classList.toggle('sel', i === focusI)); }

  return {
    say, subs, choose, pick,
    get choiceOpen() { return !!choiceH; }, get choiceTitle() { return choiceH ? choiceH.title : null; },
    focusLabel: () => (choiceH ? choiceH.options[focusI] : null),
    get state() { return sayH ? { who: U.lineOf(sayH.lines[sayH.i]).who, text: ln.textContent, i: sayH.i, n: sayH.lines.length, typing: !!typing } : null; },
    input(I) {
      if (choiceH) {
        const n = choiceH.options.length;
        if (I.pressed('up') || I.pressed('left')) { focusI = (focusI - 1 + n) % n; showFocus(); U.blip('move'); }
        if (I.pressed('down') || I.pressed('right')) { focusI = (focusI + 1) % n; showFocus(); U.blip('move'); }
        if (I.pressed('use') && S.timers.now - choiceH.shownAt > 0.25) { I.consumeKeyActions(); U.blip('pick'); pick(focusI); }
        I.consume('light', 'heavy', 'dodge', 'parry');
        return true;
      }
      if (sayH) {
        if ((I.pressed('use') || I.pressed('skip')) && S.timers.now - sayH.shownAt > 0.08) { I.consumeKeyActions(); advance(); }
        I.consume('light', 'heavy', 'dodge', 'parry', 'canteen', 'map');
        return true;
      }
      return false;
    },
    tick() {
      const t = S.timers.now;
      if (typing && sayH) {
        const n = Math.min(typing.text.length, Math.floor((t - sayH.shownAt) * CPS));
        if (n !== typing.n) { typing.n = n; ln.textContent = typing.text.slice(0, n); if (n % 4 === 1) U.blip('type'); }
        if (n >= typing.text.length) typing = null;
      }
      if (sayH && !typing) nx.textContent = sayH.i + 1 < sayH.lines.length ? '▼' : '■';
      if (subsH && t >= subsH.until) nextSubs();
      if (subsUntil && t >= subsUntil) { subsEl.classList.add('hidden'); subsUntil = 0; }
    },
    advanceAll() { while (sayH) nextLine(); while (subsH) nextSubs(); if (choiceH) pick(0); },
    // on-screen boxes for the overlap check
    boxes() { const out = []; for (const [n, e] of [['subs', subsEl]]) { const r = U.box(e); if (r) out.push([n, r]); } return out; },
    reset() {
      if (sayH) { sayH.done = true; sayH = null; } if (subsH) { subsH.done = true; subsH = null; } if (choiceH) { choiceH.done = true; choiceH = null; }
      typing = null; subsUntil = 0; root.classList.remove('sayOn');
      box.classList.add('hidden'); subsEl.classList.add('hidden'); chEl.classList.add('hidden');
    },
  };
}
