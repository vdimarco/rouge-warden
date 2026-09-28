// js/story/ui/ui.js : the story UI package (design 4.4). init(S) builds every piece inside #story and fills
// S.ui and S.input. The pieces live in their own files; this one wires them and owns what they share:
// the modal stack (dialog, choice, card, map, evidence), the body classes (foot, drive, photo, memory,
// night, smenu, stouch), per-device key labels, line and name lookups, and the QA handles S.test.ui.
// Flow runs on story time: handles carry a `done` flag and every timer is S.timers or the hud phase.
import { CREW_IDS, GLYPHS, PORTRAITS, PHASE_ORDER } from '../types.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createMapScreen } from './mapscreen.js';
import { createDialogue } from './dialogue.js';
import { createCards } from './cards.js';
import { createTouch } from './touch.js';
import { createMenu } from './menu.js';
import { createPhoneFrame } from './phoneframe.js';
import { createBoard } from './board.js';

// what each action is called on each device (prompts, hints, the controls page)
export const KEY_LABELS = {
  key: { use: 'E', exit: 'E', light: 'J', heavy: 'K', parry: 'Shift', dodge: 'Space', canteen: 'R', lock: 'Tab', crouch: 'X', camera: 'V', bearcall: 'G', map: 'M', pause: 'Esc', music: 'N',
    horn: 'H', handbrake: 'Space', lookback: 'C', gas: 'W', brake: 'S', steer: 'A D', move: 'WASD', look: 'Mouse', shutter: 'Space', zoom: 'Q E', skip: 'Space', back: 'Esc' },
  pad: { use: 'Y', exit: 'Y', light: 'RB', heavy: 'RT', parry: 'LB', dodge: 'A', canteen: 'X', lock: 'R3', crouch: 'L3', camera: '▼', bearcall: '▲', map: 'Back', pause: 'Start', music: '', horn: 'L3',
    handbrake: 'A', lookback: 'R3', gas: 'RT', brake: 'LT', steer: 'LS', move: 'LS', look: 'RS', shutter: 'A', zoom: 'LB RB', skip: 'A', back: 'B' },
  touch: { use: 'USE', exit: 'EXIT', light: 'CUT', heavy: 'HEAVY', parry: 'GUARD', dodge: 'DODGE', canteen: 'GOURD', lock: 'LOCK', crouch: 'CROUCH', camera: '写', bearcall: '熊', map: 'MAP', pause: '止', music: '',
    horn: 'HORN', handbrake: 'DRIFT', lookback: '', gas: 'GAS', brake: 'BRAKE', steer: 'SLIDE', move: 'LEFT THUMB', look: 'DRAG', shutter: 'SHOOT', zoom: 'PINCH', skip: 'HOLD', back: '✕', tilt: 'TILT' },
};
const NAMES = { gabe: 'GABE', vance: 'AGENT VANCE', voss: 'HARLAN VOSS', rattler: 'RATTLER', boone: 'BOONE', dana: 'DANA', christian: 'CHRISTIAN', ryu: 'RYU', radio: 'RADIO', guide: 'GUIDE', clerk: 'CLERK', gang: 'DRIVER', voice: 'VOICE', all: 'ALL', crew: 'ALL' };

export function init(S) {
  const root = document.getElementById('story');
  root.innerHTML = '';
  root.classList.add('hidden');
  const make = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  // the stub's style tag (a ?stub=ui session earlier on this page) would fight this package's story.css
  const old = document.getElementById('storyStubCss'); if (old) old.remove();

  /* ---------------- shared helpers ---------------- */
  const modals = []; // {kind, freeze}
  let froze = false;
  const U = {
    S, root, make, KEY_LABELS,
    get device() { return S.input ? S.input.device : 'key'; },
    get touch() { return document.body.classList.contains('touch') || (S.input && S.input.device === 'touch'); },
    key(action) { const d = U.touch ? 'touch' : U.device; return (KEY_LABELS[d] || KEY_LABELS.key)[action] ?? action.toUpperCase(); },
    // "{use} to talk" -> "E to talk" (keyboard), "Y to talk" (pad), "USE to talk" (touch); {Press} is the
    // verb for the device: "Tap" on touch, "Press" otherwise
    keys(text) { return String(text).replace(/\{(\w+)\}/g, (m, a) => (a === 'Press' ? (U.touch ? 'Tap' : 'Press') : U.key(a) || a.toUpperCase())); },
    pushModal(kind, freeze = true) {
      modals.push({ kind, freeze });
      S.modal = kind;
      if (freeze && !S.freeze) { S.freeze = true; froze = true; }
    },
    popModal(kind) {
      const i = modals.map((m) => m.kind).lastIndexOf(kind);
      if (i >= 0) modals.splice(i, 1);
      S.modal = modals.length ? modals[modals.length - 1].kind : null;
      if (!modals.some((m) => m.freeze) && froze) { S.freeze = false; froze = false; }
    },
    modalKinds: () => modals.map((m) => m.kind),
    lineOf(x) {
      if (x && typeof x === 'object') {
        if (x.line && S.content && S.content.line) { const L = S.content.LINES && S.content.LINES[x.line]; return { who: x.who || (L && L.who) || '', text: S.content.line(x.line, x.vars) }; }
        return { who: x.who || '', text: String(x.text ?? '') };
      }
      const L = S.content && S.content.LINES && S.content.LINES[x];
      if (L && typeof L === 'object') return { who: L.who || '', text: S.content.line(x) };
      if (L != null) return { who: '', text: S.content.line(x) };
      return { who: '', text: S.content && S.content.line ? S.content.line(x) : String(x) };
    },
    whoName(who) {
      if (!who) return '';
      const i = CREW_IDS.indexOf(who);
      if (i >= 0) return (S.ctx.CREW[i] ? S.ctx.CREW[i].name : who).toUpperCase();
      if (who === 'pick' || who === 'hero') { const c = S.ctx.CREW[S.ctx.crewPick]; return c ? c.name.toUpperCase() : ''; }
      return NAMES[who] || String(who).toUpperCase();
    },
    // who -> a crew or cast id with a portrait or glyph ('pick' is the player's friend)
    whoId(who) { if (who === 'pick' || who === 'hero') return CREW_IDS[S.ctx.crewPick] || 'shades'; return who; },
    portrait(who) { const id = U.whoId(who); return id in PORTRAITS ? PORTRAITS[id] : undefined; },
    glyph(who) { return GLYPHS[U.whoId(who)] || ''; },
    isCrew: (who) => CREW_IDS.includes(U.whoId(who)) || who === 'gabe',
    // a short UI sound through the arena's synth, when sound is on
    blip(kind = 'move') {
      const A = S.ctx.Audio; if (!A || !A.ctx || !A.tone) return;
      try {
        const t = A.ctx.currentTime;
        if (kind === 'move') A.tone(t, 'triangle', 1320, 1180, 0.035, 0.05);
        else if (kind === 'pick') { A.tone(t, 'triangle', 880, 880, 0.05, 0.09); A.tone(t + 0.05, 'triangle', 1320, 1320, 0.04, 0.12); }
        else if (kind === 'type') A.tone(t, 'sine', 900 + Math.random() * 200, 700, 0.012, 0.03);
        else if (kind === 'back') A.tone(t, 'triangle', 700, 520, 0.04, 0.08);
        else if (kind === 'card') A.tone(t, 'sine', 110, 70, 0.18, 0.5);
      } catch (e) { /* no sound */ }
    },
    // a node's box, or null when it is hidden
    box(e) { if (!e || e.classList.contains('hidden') || !e.isConnected) return null; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || cs.display === 'none') return null; return r; },
  };

  /* ---------------- the pieces ---------------- */
  const I = S.input = createInput(S);
  U.input = I;
  const cards = createCards(U);
  const dlg = createDialogue(U);
  const hud = createHud(U);
  const mini = createMinimap(U, hud);
  const map = createMapScreen(U);
  const board = createBoard(U);
  const phone = createPhoneFrame(U);
  const menu = createMenu(U, { map, board });
  const touch = createTouch(U, { hud, mini, dlg, cards });
  U.pieces = { cards, dlg, hud, mini, map, board, phone, menu, touch };

  // S.ui: the contract (types.js Ui), plus a few extras marked below
  S.ui = {
    objective: (t) => hud.objective(t), timer: (s) => hud.timer(s), meter: (id, v, o) => hud.meter(id, v, o), clearMeter: (id) => hud.clearMeter(id),
    prompt: (label, key, hold) => hud.prompt(label, key, hold), marker: (id, o) => hud.marker(id, o), unmark: (id) => hud.unmark(id),
    subs: (who, text, dur, speaker) => dlg.subs(who, text, dur, speaker), say: (lines, o) => dlg.say(lines, o), choose: (title, opts) => dlg.choose(title, opts),
    card: (kind, data) => cards.card(kind, data), boss: (f) => hud.boss(f), stamp: (t) => hud.stamp(t), clockTag: (t) => hud.clockTag(t),
    evidence: (st) => hud.evidence(st), seats: (list) => hud.seats(list), speed: (mps) => hud.speed(mps), damage: (k) => hud.damage(k),
    loading: (p) => cards.loading(p), fade: (to, dur) => cards.fade(to, dur), toast: (t, hot) => hud.toast(t, hot), hint: (t) => hud.hint(t),
    photoFrame: (on, o) => phone.frame(on, o), touchSet: (name) => touch.set(name),
    menu: menu.api, map: map.api, board: board.api,
    advanceAll() { dlg.advanceAll(); cards.advanceAll(); },
    // extras: is a blocking UI up (the input context reads it); the photo frame's live state
    modalOpen: () => modals.some((m) => m.kind !== 'card') || !!(cards.cur && cards.cur.choices),
    get photo() { return phone.state; },
    // extra: the lines being spoken now {who, text, t0, cut, until}, for the talking mouths (cast/talk.js)
    get voices() { return dlg.voices; },
  };

  /* ---------------- per tick ---------------- */
  // input: pause and the menu first, then whatever UI is open (PHASE_ORDER.input.ui)
  S.register('input', (cdt, rdt, raw) => {
    if (menu.input(I)) return;
    if (map.input(I, raw)) return;
    if (board.input(I)) return;
    if (I.pressed('pause') && S.mode === 'play' && !(cards.cur && cards.cur.choices)) { I.consume('pause', 'back'); menu.api.open(); return; }
    if (I.pressed('music') && S.ctx.Music && S.ctx.Music.enabled) { I.consume('music'); S.ctx.Music.toggle(); }
    if (cards.input(I)) return;
    if (dlg.input(I)) return;
    if (I.pressed('map') && S.mode === 'play' && S.world && S.world.visible && !S.cine?.active) { I.consume('map'); map.api.open(); return; }
    touch.cineInput(I, raw);
  }, PHASE_ORDER.input.ui);
  // hud: everything that draws follows the game here
  S.register('hud', (cdt, rdt, raw) => {
    bodyClasses();
    cards.tick(raw); dlg.tick(raw); hud.tick(raw); mini.tick(raw); phone.tick(raw); touch.tick(raw); map.tick(raw); board.tick(raw); menu.tick(raw);
  });

  let lastCls = '';
  function bodyClasses() {
    const B = document.body, H = S.hero, m = H ? H.mode : 'foot';
    const look = S.look ? S.look.name : '';
    const on = {
      foot: m === 'foot', drive: m === 'drive' || m === 'passenger', photo: m === 'photo' || !!(S.photo && S.photo.active) || phone.on,
      memory: look === 'MEMORY' || look === 'MEMORY_NIGHT', night: look === 'NIGHT' || look === 'MEMORY_NIGHT' || look === 'DEEP_INK' || look === 'VORTEX' || (!!S.day && S.day.night && look !== 'ARENA'),
      smenu: menu.api.isOpen, stouch: U.touch, sworld: !!(S.world && S.world.visible),
    };
    const key = Object.entries(on).map(([k, v]) => (v ? k : '')).join(',');
    if (key === lastCls) return;
    lastCls = key;
    for (const [k, v] of Object.entries(on)) B.classList.toggle(k, v);
  }
  const allCls = ['foot', 'drive', 'photo', 'memory', 'night', 'smenu', 'stouch', 'sworld'];

  /* ---------------- the session ---------------- */
  function reset() {
    dlg.reset(); cards.reset(); hud.reset(); mini.reset(); map.reset(); board.reset(); phone.reset(); menu.reset(); touch.reset();
    modals.length = 0; S.modal = null; if (froze) { S.freeze = false; froze = false; }
    I.clear(); I.setContext(null);
  }
  S.bus.on('start', () => { reset(); root.classList.remove('hidden'); lastCls = ''; });
  S.bus.on('exit', () => { reset(); root.classList.add('hidden'); I.unlock(); for (const c of allCls) document.body.classList.remove(c); lastCls = ''; });

  /* ---------------- QA ---------------- */
  S.test.ui = {
    input: I,
    // is this element (an id, or a class inside #story) on screen
    visible(id) {
      const e = document.getElementById(id) || root.querySelector(`.${id}`);
      return !root.classList.contains('hidden') && !!U.box(e);
    },
    // every pair of on-screen HUD pieces and touch buttons whose boxes overlap: [[a, b], ...]
    overlaps() {
      const list = [...hud.boxes(), ...mini.boxes(), ...dlg.boxes(), ...phone.boxes(), ...touch.boxes()];
      const out = [], hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const [na, ra] = list[i], [nb, rb] = list[j];
        if (na.startsWith('btn:') && nb.startsWith('btn:')) continue; // the buttons sit close by design; they never cover each other's middle
        if (hit(ra, rb)) out.push([na, nb]);
      }
      return out;
    },
    get card() { return cards.cur ? cards.cur.title : dlg.choiceOpen ? dlg.choiceTitle : null; },
    get objective() { return hud.objectiveText; },
    // answer the open card or choice with option i, as a click would
    choose(i = 0) { if (cards.cur && cards.cur.choices) { cards.finish(cards.cur, i); return true; } if (dlg.choiceOpen) { dlg.pick(i); return true; } return false; },
    // what the menu's SAVE & QUIT button does
    quit() { menu.api.close(); S.exit(); },
    glyph: (id) => GLYPHS[id] || '',
    get touchSet() { return touch.current; }, get touchButtons() { return touch.visibleButtons(); },
    get context() { return I.context; }, get say() { return dlg.state; }, get markers() { return hud.markerState(); },
    get menuPage() { return menu.page; }, get focus() { return menu.api.isOpen ? menu.focusLabel() : cards.cur && cards.cur.choices ? cards.focusLabel() : dlg.choiceOpen ? dlg.focusLabel() : map.api.isOpen ? 'map' : null; },
    pieces: U.pieces,
  };
}
