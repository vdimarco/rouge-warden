// js/story/ui/cards.js : full-screen cards, the loading card and the fade (design 4.3, 4.4).
// card(kind, data) -> handle {done, choice, index}. Kinds: chapter (kanji, CHAPTER n, title, time and place),
// time (a quiet time and place line), title (kanji and title), text, pass (MISSION PASSED 完 with stats),
// fail (MISSION FAILED 失, RETRY first, QUIT), error, loading. A card with choices is modal: it freezes
// play until answered; the arrows, the d-pad or a tap move the focus and E, Enter or pad A picks. A card
// without choices goes after data.dur story seconds, or sooner on E, Space, Enter, pad A or a tap.
// loading(p): LOADING SEDONA with a brush stroke that fills (null hides it). fade(to, dur) -> {done}.
const DUR = { chapter: 3.4, time: 2.8, title: 2.6, text: 2.6, pass: 4, fail: 0, error: 0, loading: 0 };
const BRUSH = `<svg class="brush" viewBox="0 0 320 18" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="sBrushF" x="-5%" y="-40%" width="110%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.06 0.9" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter></defs><rect class="bk" x="4" y="6" width="312" height="6" rx="3"/><rect class="fg" x="4" y="4" width="0" height="10" rx="4" filter="url(#sBrushF)"/></svg>`;

export function createCards(U) {
  const { S, make, root } = U;
  const el = make('div', 'sCard hidden', root, `<div class="cIn"><div class="cK"></div><p class="cN"></p><h2></h2><div class="cRule"></div><p class="cSub"></p><div class="cStats"></div><div class="cCh"></div><p class="cHint"></p></div>`);
  el.id = 'sCard';
  const q = (s) => el.querySelector(s);
  const load = make('div', 'sLoad hidden', root, `<div><p class="lT">LOADING SEDONA</p>${BRUSH}<p class="lP"></p></div>`);
  load.id = 'sLoad';
  const fadeEl = make('div', 'sFade', root); fadeEl.id = 'sFade';
  let cur = null, focusI = 0, fadeH = null, fadeV = 0;
  // a tap on the card: a choice button picks it; anywhere else skips a card without choices
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (b && cur && cur.choices) { finish(cur, +b.dataset.i); return; }
    if (cur && !cur.choices && S.timers.now - cur.shownAt > 0.3) finish(cur, -1);
  });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  function statsHtml(st) {
    if (!st) return '';
    const rows = Array.isArray(st) ? st.map((x) => (typeof x === 'string' ? ['', x] : [x.label || '', x.value ?? ''])) : Object.entries(st);
    return rows.map(([k, v]) => `<span><small>${esc(k)}</small><b>${esc(v)}</b></span>`).join('');
  }
  function card(kind, data = {}) {
    if (cur) finish(cur, -1);
    kind = kind || 'title';
    const choices = data.choices && data.choices.length ? data.choices.slice() : kind === 'fail' ? ['RETRY', 'QUIT'] : null;
    const title = data.title ?? (kind === 'pass' ? 'MISSION PASSED' : kind === 'fail' ? 'MISSION FAILED' : '');
    const kanji = data.kanji ?? (kind === 'pass' ? '完' : kind === 'fail' ? '失' : '');
    const dur = data.dur ?? (DUR[kind] ?? 2.6);
    const h = { done: false, choice: -1, index: -1, kind, title, choices, shownAt: S.timers.now, until: S.timers.now + (dur || 3), modal: !!choices };
    cur = h;
    el.className = `sCard k-${kind}`;
    q('.cK').textContent = kanji;
    q('.cN').textContent = kind === 'chapter' && data.n != null ? `CHAPTER ${data.n}` : data.over || '';
    q('h2').textContent = title;
    q('.cSub').textContent = data.sub || data.reason || '';
    q('.cStats').innerHTML = statsHtml(data.stats);
    const ch = q('.cCh'); ch.innerHTML = '';
    if (choices) {
      choices.forEach((label, i) => { const b = make('button', i === 0 ? 'main' : '', ch); b.type = 'button'; b.dataset.i = i; b.textContent = label; });
      U.pushModal('card');
      focusI = 0; showFocus();
      U.input.unlock();
    }
    q('.cHint').textContent = choices ? '' : kind === 'chapter' || kind === 'pass' ? (U.touch ? 'TAP TO GO ON' : U.keys('{skip} TO GO ON').toUpperCase()) : '';
    if (kind === 'chapter' || kind === 'pass' || kind === 'fail') U.blip('card');
    return h;
  }
  function finish(h, choice) {
    if (!h || h.done) return;
    h.done = true; h.choice = choice; h.index = choice;
    if (h.modal) U.popModal('card');
    if (cur === h) { cur = null; el.className = 'sCard hidden'; }
  }
  function showFocus() { [...el.querySelectorAll('.cCh button')].forEach((b, i) => b.classList.toggle('sel', i === focusI)); }
  function moveFocus(d) { const n = cur && cur.choices ? cur.choices.length : 0; if (!n) return; focusI = (focusI + d + n) % n; showFocus(); U.blip('move'); }

  function loading(p) {
    if (p == null) { load.classList.add('hidden'); return; }
    load.classList.remove('hidden');
    const k = Math.max(0, Math.min(1, +p || 0));
    load.querySelector('.fg').setAttribute('width', String(Math.round(312 * Math.max(0.02, k))));
    load.querySelector('.lP').textContent = `${Math.round(k * 100)}%`;
  }
  function fade(to, dur = 0.5) {
    if (fadeH) fadeH.done = true;
    const h = { done: false, from: fadeV, to: Math.max(0, Math.min(1, +to || 0)), t0: S.timers.now, dur: Math.max(0.001, +dur || 0) };
    fadeH = h;
    if (dur <= 0) { fadeV = h.to; fadeEl.style.opacity = String(fadeV); h.done = true; fadeH = null; }
    return h;
  }
  return {
    card, finish, loading, fade,
    get cur() { return cur; },
    focusLabel: () => (cur && cur.choices ? cur.choices[focusI] : null),
    // keys and pad on a card; returns true when it used the input
    input(I) {
      if (!cur) return false;
      if (cur.choices) {
        if (I.pressed('up') || I.pressed('left')) moveFocus(-1);
        if (I.pressed('down') || I.pressed('right')) moveFocus(1);
        if (I.pressed('use') && S.timers.now - cur.shownAt > 0.25) { I.consumeKeyActions(); U.blip('pick'); finish(cur, focusI); }
        I.consume('light', 'heavy', 'dodge', 'parry');
        return true;
      }
      if ((I.pressed('use') || I.pressed('skip')) && S.timers.now - cur.shownAt > 0.3) { I.consumeKeyActions(); finish(cur, -1); return false; }
      return false;
    },
    tick() {
      const t = S.timers.now;
      if (cur && !cur.choices && t >= cur.until) finish(cur, -1);
      if (fadeH) {
        const k = Math.min(1, (t - fadeH.t0) / fadeH.dur);
        fadeV = fadeH.from + (fadeH.to - fadeH.from) * k;
        fadeEl.style.opacity = String(fadeV);
        if (k >= 1) { fadeH.done = true; fadeH = null; }
      }
    },
    advanceAll() { if (cur) finish(cur, cur.choices ? 0 : -1); },
    reset() { if (cur) { const h = cur; cur = null; h.done = true; el.className = 'sCard hidden'; } if (fadeH) fadeH.done = true; fadeH = null; fadeV = 0; fadeEl.style.opacity = '0'; load.classList.add('hidden'); },
  };
}
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
