// Stub UI (frozen; the ui package replaces ui/ui.js and story.css, not this file).
// A minimal DOM inside #story: objective line, prompt pill, subtitles, dialogue box, card overlay,
// loading text and the pause menu (RESUME, SAVE & QUIT). Keyboard and pad input; handles with done flags.
import { CREW_IDS, GLYPHS } from '../types.js';

// key -> actions
const KEYS = {
  KeyW: ['up'], ArrowUp: ['up'], KeyS: ['down'], ArrowDown: ['down'], KeyA: ['left'], ArrowLeft: ['left'], KeyD: ['right'], ArrowRight: ['right'],
  KeyE: ['use', 'exit'], Enter: ['use', 'skip'], Space: ['dodge', 'handbrake', 'skip'], Escape: ['pause'], KeyP: ['pause'],
  KeyJ: ['light'], KeyK: ['heavy'], KeyQ: ['heavy'], ShiftLeft: ['parry'], ShiftRight: ['parry'], KeyF: ['parry'], KeyR: ['canteen'],
  Tab: ['lock'], KeyX: ['crouch'], KeyV: ['camera', 'shutter'], KeyG: ['bearcall'], KeyM: ['map'], KeyN: ['music'], KeyH: ['horn'], KeyC: ['lookback'],
};
// pad button -> actions (standard mapping)
const PAD = { 0: ['use', 'skip'], 1: ['dodge', 'handbrake'], 2: ['canteen'], 3: ['use', 'exit'], 4: ['parry'], 5: ['light'], 6: ['brake'], 7: ['gas', 'heavy'], 8: ['map'], 9: ['pause'], 10: ['crouch'], 11: ['lock'], 12: ['bearcall', 'up'], 13: ['camera', 'down'], 14: ['left'], 15: ['right'] };
const CSS = `
#story { position: absolute; inset: 0; pointer-events: none; z-index: 3; color: var(--ink); font-family: var(--serif); }
#story .hidden { display: none !important; }
#story .sObj { position: absolute; left: max(16px, env(safe-area-inset-left)); top: max(14px, env(safe-area-inset-top)); margin: 0; font: 800 13px var(--serif); letter-spacing: 0.14em; text-shadow: 0 2px 6px #000; }
#story .sToast { position: absolute; left: 50%; top: 22vh; transform: translateX(-50%); margin: 0; font: 800 12px var(--serif); letter-spacing: 0.3em; text-shadow: 0 2px 6px #000; }
#story .sSubs { position: absolute; left: 50%; bottom: 18vh; transform: translateX(-50%); width: min(90vw, 640px); margin: 0; text-align: center; font-size: 15px; line-height: 1.5; text-shadow: 0 2px 6px #000, 0 0 2px #000; }
#story .sPrompt { position: absolute; left: 50%; bottom: 11vh; transform: translateX(-50%); margin: 0; padding: 6px 14px; border: 1px solid rgba(233,230,223,0.4); border-radius: 16px; background: rgba(0,0,0,0.55); font: 800 12px var(--serif); letter-spacing: 0.2em; }
#story .sSay { position: absolute; left: 50%; bottom: 6vh; transform: translateX(-50%); width: min(92vw, 640px); padding: 14px 18px; background: rgba(0,0,0,0.8); border: 1px solid rgba(233,230,223,0.25); z-index: 6; }
#story .sSay b { display: block; margin-bottom: 6px; font-size: 11px; letter-spacing: 0.3em; color: var(--muted); }
#story .sSay p { margin: 0; font-size: 16px; line-height: 1.5; }
#story .sCard { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; background: rgba(0,0,0,0.5); z-index: 5; }
#story .sCard .k { font: 400 clamp(56px, 10vw, 120px) / 1 var(--grass); }
#story .sCard h2 { margin: 10px 0 0; font: 800 clamp(20px, 3.4vw, 40px) var(--serif); letter-spacing: 0.3em; }
#story .sCard p { margin: 12px 0 0; font-family: var(--brush); font-size: clamp(14px, 1.8vw, 20px); letter-spacing: 0.3em; color: var(--muted); }
#story .ch, #story .sMenu .btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 22px; }
#story .ch button, #story .sMenu button, #story .sMenu a { pointer-events: auto; padding: 11px 18px; border: 1px solid rgba(233,230,223,0.3); border-radius: 3px; background: rgba(0,0,0,0.5); color: var(--ink); font: 800 12px var(--serif); letter-spacing: 0.22em; text-decoration: none; cursor: pointer; }
#story .ch button:first-child, #story .sMenu .main { border-color: #d2263f; color: #fff; }
#story .sLoad { position: absolute; left: 50%; bottom: 8vh; transform: translateX(-50%); margin: 0; font-size: 12px; letter-spacing: 0.4em; z-index: 5; }
#story .sMenu { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; background: rgba(0,0,0,0.88); pointer-events: auto; z-index: 7; }
#story .sMenu h2 { margin: 0; letter-spacing: 0.5em; font-weight: 800; }
#story .sMenu p { margin-top: 20px; font-size: 11px; letter-spacing: 0.3em; color: var(--muted); }
#story .sFade { position: absolute; inset: 0; background: #000; opacity: 0; z-index: 4; }
`;

export function init(S) {
  const root = document.getElementById('story');
  if (!document.getElementById('storyStubCss')) { const st = document.createElement('style'); st.id = 'storyStubCss'; st.textContent = CSS; document.head.appendChild(st); }
  root.innerHTML = `<div class="sFade"></div><p class="sObj"></p><p class="sToast"></p><p class="sSubs"></p><p class="sPrompt hidden"></p>
    <div class="sSay hidden"><b></b><p></p></div>
    <div class="sCard hidden"><div><div class="k"></div><h2></h2><p></p><div class="ch"></div></div></div>
    <p class="sLoad hidden">LOADING SEDONA <span></span></p>
    <div class="sMenu hidden"><div><h2>PAUSED</h2><div class="btns"><button type="button" class="main" id="sResume">▶ RESUME</button><button type="button" id="sQuit">SAVE &amp; QUIT</button><button type="button" data-switch>SWITCH GAME</button><a href="/">◀ ARCADE</a></div><p>ESC RESUMES</p></div></div>`;
  const q = (sel) => root.querySelector(sel);
  const el = { fade: q('.sFade'), obj: q('.sObj'), toast: q('.sToast'), subs: q('.sSubs'), prompt: q('.sPrompt'), say: q('.sSay'), card: q('.sCard'), load: q('.sLoad'), menu: q('.sMenu') };
  if (window.GameSwitch) window.GameSwitch.wire();
  for (const ev of ['pointerdown', 'click']) root.addEventListener(ev, (e) => { if (e.target.closest('button, a')) e.stopPropagation(); });

  /* ---------------- input ---------------- */
  const keyHeld = new Set(), hits = new Set(), padHeld = new Set();
  let prev = new Set(), now = new Set(), pressedNow = new Set(), qa = null, padAxes = [0, 0, 0, 0], padPrev = [];
  const union = () => {
    const u = new Set([...keyHeld, ...padHeld]);
    if (qa) for (const [k, v] of Object.entries(qa)) if (v === true) u.add(k);
    if (u.has('up')) u.add('gas');
    if (u.has('down')) u.add('brake');
    return u;
  };
  const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
  const I = S.input = {
    context: 'foot', device: 'key',
    setContext(c) { I.context = c; },
    pressed: (a) => pressedNow.has(a),
    held: (a) => now.has(a),
    consume(a) { pressedNow.delete(a); },
    // a key the UI used is used up, with every action it carries (E is both use and exit)
    consumeKeyActions() { for (const a of ['use', 'skip', 'exit', 'dodge', 'handbrake']) pressedNow.delete(a); },
    axis(name) {
      if (qa && qa[name] && typeof qa[name] === 'object') return { x: qa[name].x || 0, y: qa[name].y || 0 };
      const kx = (now.has('right') ? 1 : 0) - (now.has('left') ? 1 : 0), ky = (now.has('up') ? 1 : 0) - (now.has('down') ? 1 : 0);
      if (name === 'move') return { x: kx || dz(padAxes[0]), y: ky || -dz(padAxes[1]) };
      if (name === 'steer') return { x: kx || dz(padAxes[0]), y: 0 };
      if (name === 'look') return { x: dz(padAxes[2]), y: dz(padAxes[3]) };
      return { x: 0, y: 0 };
    },
    key(e, down) {
      const acts = KEYS[e.code]; if (!acts) return;
      I.device = 'key';
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault && e.preventDefault();
      for (const a of acts) { if (down) { keyHeld.add(a); hits.add(a); } else keyHeld.delete(a); }
    },
    pad(p) {
      const b = p.buttons.map((x) => x.pressed);
      padHeld.clear();
      b.forEach((on, i) => { if (on && PAD[i]) for (const a of PAD[i]) { padHeld.add(a); if (!padPrev[i]) hits.add(a); } });
      if (b.some((x) => x) || p.axes.some((a) => Math.abs(a) > 0.4)) I.device = 'pad';
      padAxes = [p.axes[0] || 0, p.axes[1] || 0, p.axes[2] || 0, p.axes[3] || 0]; padPrev = b;
    },
    set(actions) { qa = { ...(qa || {}), ...actions }; },
    clear() { qa = null; keyHeld.clear(); padHeld.clear(); hits.clear(); },
    update() { now = union(); pressedNow = new Set(hits); for (const a of now) if (!prev.has(a)) pressedNow.add(a); prev = now; hits.clear(); },
  };

  /* ---------------- modal handles ---------------- */
  const modals = [];
  const pushModal = (kind) => { modals.push(kind); S.modal = kind; if (modals.length === 1) S.freeze = true; };
  const popModal = (kind) => { const i = modals.lastIndexOf(kind); if (i >= 0) modals.splice(i, 1); S.modal = modals[modals.length - 1] || null; if (!modals.length) S.freeze = false; };
  let cardH = null, sayH = null;
  const lineOf = (x) => {
    if (typeof x === 'object' && x) return { who: x.who || '', text: x.text || '' };
    const L = S.content && S.content.LINES && S.content.LINES[x];
    if (L && typeof L === 'object') return { who: L.who || '', text: S.content.line(x) };
    return { who: '', text: S.content && S.content.line ? S.content.line(x) : String(x) };
  };
  const whoName = (who) => { const i = CREW_IDS.indexOf(who); return i >= 0 ? S.ctx.CREW[i].name.toUpperCase() : String(who || '').toUpperCase(); };

  function finishCard(h, choice) {
    if (!h || h.done) return;
    h.done = true; h.choice = choice; h.index = choice;
    if (h.modal) popModal('card');
    if (cardH === h) { cardH = null; el.card.classList.add('hidden'); }
  }
  function card(kind, data = {}) {
    if (cardH) finishCard(cardH, -1);
    const choices = data.choices || null;
    const h = { done: false, choice: -1, index: -1, kind, choices, until: S.timers.now + (data.dur ?? 1.5), shownAt: S.timers.now, modal: !!choices };
    cardH = h;
    el.card.querySelector('.k').textContent = data.kanji || '';
    el.card.querySelector('h2').textContent = data.title || '';
    el.card.querySelector('p').textContent = data.sub || '';
    const ch = el.card.querySelector('.ch'); ch.innerHTML = '';
    if (choices) {
      choices.forEach((label, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', (e) => { e.stopPropagation(); finishCard(h, i); }); ch.appendChild(b); });
      pushModal('card');
    }
    el.card.classList.remove('hidden');
    return h;
  }
  function showLine() { const l = lineOf(sayH.lines[sayH.i]); el.say.querySelector('b').textContent = whoName(l.who); el.say.querySelector('p').textContent = l.text; sayH.until = S.timers.now + 1.2 + l.text.length * 0.05; sayH.shownAt = S.timers.now; }
  function nextLine() {
    if (!sayH) return;
    sayH.i++;
    if (sayH.i >= sayH.lines.length) { const h = sayH; sayH = null; h.done = true; el.say.classList.add('hidden'); popModal('dialog'); }
    else showLine();
  }
  function say(lines) {
    if (sayH) { const h = sayH; sayH = null; h.done = true; popModal('dialog'); }
    const h = { done: false, lines: [].concat(lines || []), i: 0 };
    if (!h.lines.length) { h.done = true; return h; }
    sayH = h; pushModal('dialog'); el.say.classList.remove('hidden'); showLine();
    return h;
  }

  /* ---------------- the menu ---------------- */
  let menuPrev = 'play';
  const menu = {
    isOpen: false,
    open() { if (menu.isOpen) return; menuPrev = S.mode; S.mode = 'menu'; menu.isOpen = true; el.menu.classList.remove('hidden'); },
    close() { if (!menu.isOpen) return; menu.isOpen = false; S.mode = menuPrev === 'menu' ? 'play' : menuPrev; el.menu.classList.add('hidden'); },
  };
  root.querySelector('#sResume').addEventListener('click', (e) => { e.stopPropagation(); menu.close(); });
  root.querySelector('#sQuit').addEventListener('click', (e) => { e.stopPropagation(); menu.close(); S.exit(); });

  let fadeH = null, toastUntil = 0, subsUntil = 0;
  S.ui = {
    objective(text) { el.obj.textContent = text || ''; },
    timer() {}, meter() {}, clearMeter() {},
    prompt(label, key = 'E') { if (label) { el.prompt.textContent = `${key} · ${label}`; el.prompt.classList.remove('hidden'); } else el.prompt.classList.add('hidden'); },
    marker() {}, unmark() {},
    subs(who, text, dur) { el.subs.textContent = who ? `${whoName(who)}: ${text}` : text; subsUntil = S.timers.now + (dur ?? 3.5 + String(text).length * 0.06); },
    say, choose(title, options) { return card('text', { title, choices: options }); }, card,
    boss() {}, stamp() {}, clockTag() {}, evidence() {}, seats() {}, speed() {}, damage() {},
    loading(p) { if (p == null) el.load.classList.add('hidden'); else { el.load.classList.remove('hidden'); el.load.querySelector('span').textContent = `${Math.round(p * 100)}%`; } },
    fade(to, dur = 0.5) { const h = { done: false, from: +el.fade.style.opacity || 0, to, t0: S.timers.now, dur: Math.max(0.001, dur) }; if (fadeH) fadeH.done = true; fadeH = h; return h; },
    toast(text) { el.toast.textContent = text; toastUntil = S.timers.now + 2.5; },
    hint() {}, photoFrame() {}, touchSet() {},
    menu,
    map: { open() { S.ui.toast('The map is not here yet.'); }, close() {} },
    board: { open() { S.ui.toast('The evidence board is not here yet.'); }, close() {} },
    advanceAll() { while (sayH) nextLine(); if (cardH) finishCard(cardH, cardH.choices ? 0 : -1); },
  };

  // input that the UI answers: pause, music, skipping dialogue and cards
  S.register('input', () => {
    if (I.pressed('pause') && S.mode !== 'credits') { if (menu.isOpen) menu.close(); else if (S.mode === 'play' && !cardH?.modal) menu.open(); I.consume('pause'); return; }
    if (menu.isOpen) { if (I.pressed('use')) { menu.close(); I.consumeKeyActions(); } return; }
    if (I.pressed('music') && S.ctx.Music && S.ctx.Music.enabled) S.ctx.Music.toggle();
    if (I.pressed('map')) S.ui.map.open();
    const adv = I.pressed('use') || I.pressed('skip');
    if (adv && sayH && S.timers.now - sayH.shownAt > 0.2) { nextLine(); I.consumeKeyActions(); }
    else if (adv && cardH && S.timers.now - cardH.shownAt > 0.25) { finishCard(cardH, cardH.choices ? 0 : -1); I.consumeKeyActions(); }
    if (adv && S.cine.active) S.cine.skip();
    if (adv && S.film.active) S.film.skip();
  }, -50);
  S.register('hud', () => {
    const t = S.timers.now;
    if (sayH && t >= sayH.until) nextLine();
    if (cardH && !cardH.choices && t >= cardH.until) finishCard(cardH, -1);
    if (fadeH) { const k = Math.min(1, (t - fadeH.t0) / fadeH.dur); el.fade.style.opacity = String(fadeH.from + (fadeH.to - fadeH.from) * k); if (k >= 1) { fadeH.done = true; fadeH = null; } }
    if (toastUntil && t >= toastUntil) { el.toast.textContent = ''; toastUntil = 0; }
    if (subsUntil && t >= subsUntil) { el.subs.textContent = ''; subsUntil = 0; }
    const cur = S.interact.current, H = S.hero;
    if (H && H.mode === 'foot' && cur && S.mode === 'play' && !S.freeze) S.ui.prompt(cur.label, 'E');
    else if (H && H.mode === 'drive' && S.drive.riding && Math.abs(S.drive.riding.speed) < 4 && S.mode === 'play') S.ui.prompt('GET OUT', 'E');
    else S.ui.prompt(null);
  });

  const reset = () => {
    if (sayH) { sayH.done = true; sayH = null; } if (cardH) { cardH.done = true; cardH = null; }
    modals.length = 0; S.modal = null; menu.isOpen = false;
    for (const k of ['say', 'card', 'load', 'menu', 'prompt']) el[k].classList.add('hidden');
    el.obj.textContent = ''; el.toast.textContent = ''; el.subs.textContent = ''; el.fade.style.opacity = '0'; fadeH = null;
    I.clear();
  };
  S.bus.on('start', () => { reset(); root.classList.remove('hidden'); });
  S.bus.on('exit', () => { reset(); root.classList.add('hidden'); });

  S.test.ui = {
    input: I,
    visible(id) { const e = document.getElementById(id) || root.querySelector(`.${id}`); return !!e && !e.classList.contains('hidden') && e.getClientRects().length > 0 && !root.classList.contains('hidden'); },
    overlaps: () => [],
    get card() { return cardH ? el.card.querySelector('h2').textContent : null; },
    get objective() { return el.obj.textContent; },
    glyph: (id) => GLYPHS[id] || '',
  };
}
