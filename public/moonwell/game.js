// Moonwell: the page. Input (keys, touch halves, gamepad), the fixed-tick loop, the camera, the head-up display,
// the title with a bot playing behind it, the charm, pause and end dialogs, sound, and the best run in this browser.
import { createRun, tick, choose, TICK, MAX_PEARLS } from './run.js';
import { station, REGION } from './world.js';
import { createBot, botInput } from './bot.js';
import { draw, updateFx, burst, ring, pop, art } from './render.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d');
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const SAVE = 'moonwell.best.v1', SEEN = 'moonwell.seen.v1', MUTE = 'moonwell.muted.v1';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off: the game still plays */ } },
};
const readBest = () => {
  const b = store.get(SAVE, null);
  return b && Number.isFinite(b.score) && Number.isFinite(b.island) ? { score: Math.max(0, b.score), island: Math.max(0, b.island) } : { score: 0, island: 0 };
};

let best = readBest();
let mode = 'title';            // title | play | paused | charm | over
let run = null, bot = createBot({ skill: 0.8, seed: 3 }), audio = null, attract = true;
let muted = !!store.get(MUTE, false);
const fx = { parts: [], pops: [], trail: [], spin: 0 };
const view = { w: 0, h: 0, dpr: 1, base: 1, cam: { x: 0, y: 0, bottom: 0, scale: 1, zoom: 1 }, shake: 0 };
const keys = { left: false, right: false };
const pointers = new Map();
const pad = { left: false, right: false, prev: [] };
let dropPress = false, pulsePress = false;
let acc = 0, last = 0, freeze = 0, frames = 0, charmSel = 0, combo = { n: 0, t: 0 }, autoplay = false, autoPick = true, maxShake = 0;
const hints = { seen: !!store.get(SEEN, false), shown: '', until: 0, tried: false };

/* ---------------- layout ---------------- */
function layout() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3.4e6 / (w * h)));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  // about 900 world units tall, and at least 760 wide, so a phone in portrait still shows a whole bowl
  Object.assign(view, { w, h, dpr, base: Math.min(h / 900, w / 760) });
}
addEventListener('resize', layout);
layout();

/* ---------------- runs ---------------- */
function newAttract() {
  run = createRun({ seed: (Math.random() * 2 ** 32) >>> 0, best: best.island });
  bot = createBot({ skill: 0.8, seed: (Math.random() * 1e9) | 0 });
  attract = true;
  snapCamera();
}

function begin(seed) {
  audio ??= createAudio();
  if (audio) { audio.muted = muted; audio.resume(); audio.music(true); audio.duck(false); }
  run = createRun({ seed: seed ?? (Math.random() * 2 ** 32) >>> 0, best: best.island });
  attract = false;
  mode = 'play';
  fx.parts = []; fx.pops = []; fx.trail = [];
  combo = { n: 0, t: 0 };
  hints.tried = false;
  body.classList.remove('title-on');
  $('title').hidden = true;
  $('dialog').hidden = true;
  $('pause').textContent = 'Pause';
  snapCamera();
  hud(true);
  banner('Island 1', 'Willow Meadow');
}

function save() {
  const island = run.at + 1;
  const next = { score: Math.max(best.score, run.score), island: Math.max(best.island, island) };
  if (next.score !== best.score || next.island !== best.island) { best = next; store.set(SAVE, best); }
}

/* ---------------- input ---------------- */
const held = () => ({ left: keys.left || pad.left || [...pointers.values()].includes('left'), right: keys.right || pad.right || [...pointers.values()].includes('right') });
function showHeld() {
  const h = held();
  $('pad-left').classList.toggle('held', h.left);
  $('pad-right').classList.toggle('held', h.right);
}
function flipSound(was, now) {
  if (!audio || mode !== 'play') return;
  if (now.left && !was.left) audio.play('flip');
  if (now.right && !was.right) audio.play('flip');
}

const KEYMAP = { KeyZ: 'left', KeyA: 'left', ArrowLeft: 'left', ShiftLeft: 'left', KeyX: 'right', KeyD: 'right', ArrowRight: 'right', ShiftRight: 'right', Slash: 'right' };
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  const side = KEYMAP[e.code];
  if (side || ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (mode === 'charm') { charmKey(e); return; }
  if (side) {
    const was = held();
    keys[side] = true;
    flipSound(was, held());
    showHeld();
  }
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    if (mode === 'title' || mode === 'over') { if (!(e.code === 'Enter' && document.activeElement?.closest('button'))) begin(); }
    else if (mode === 'play') dropPress = true;
    else if (mode === 'paused' && e.code === 'Space') togglePause();
  }
  if (['KeyC', 'ArrowUp', 'KeyW'].includes(e.code) && mode === 'play') pulsePress = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => {
  const side = KEYMAP[e.code];
  if (side) { keys[side] = false; showHeld(); }
});

// touch and mouse on the canvas: the left half holds the left flipper and the right half the right one
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') body.classList.add('touch');
  if (mode !== 'play') return;
  e.preventDefault();
  canvas.setPointerCapture?.(e.pointerId);
  const was = held();
  pointers.set(e.pointerId, e.clientX < view.w / 2 ? 'left' : 'right');
  flipSound(was, held());
  showHeld();
});
const lift = (e) => { if (pointers.delete(e.pointerId)) showHeld(); };
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('lostpointercapture', lift);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
if (matchMedia('(pointer: coarse)').matches) body.classList.add('touch');

function pollPad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp) { pad.left = pad.right = false; return; }
  const b = (i) => !!gp.buttons[i]?.pressed;
  const was = held();
  pad.left = b(4) || b(6);
  pad.right = b(5) || b(7);
  const press = (i) => b(i) && !pad.prev[i];
  if (mode === 'charm') {
    if (press(14) || press(4)) moveCharm(-1);
    if (press(15) || press(5)) moveCharm(1);
    if (press(0)) pickCharm(charmSel);
  } else {
    if (press(0)) { if (mode === 'title' || mode === 'over') begin(); else if (mode === 'play') dropPress = true; else if (mode === 'paused') togglePause(); }
    if (press(1) || press(3)) pulsePress = true;
    if (press(9)) togglePause();
    flipSound(was, held());
  }
  pad.prev = gp.buttons.map((x) => x.pressed);
  showHeld();
}

$('launch').addEventListener('click', () => begin());
$('pulse').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (mode === 'play') pulsePress = true; });
$('pulse').addEventListener('click', (e) => e.preventDefault());
$('pause').addEventListener('click', () => togglePause());
$('sound').addEventListener('click', () => toggleMute());
addEventListener('blur', () => { if (mode === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

function release() {
  keys.left = keys.right = false;
  pointers.clear();
  showHeld();
}

function toggleMute() {
  muted = !muted;
  store.set(MUTE, muted);
  if (audio) audio.muted = muted;
  soundLabel();
}
function soundLabel() {
  $('sound').textContent = muted ? 'Sound off' : 'Sound on';
  $('sound').setAttribute('aria-label', muted ? 'Sound on' : 'Sound off');
}
soundLabel();

/* ---------------- dialogs ---------------- */
function dialog({ eyebrow = '', title, copy = '', stats = [], actions = [] }) {
  $('dialog-eyebrow').textContent = eyebrow;
  $('dialog-title').textContent = title;
  $('dialog-copy').textContent = copy;
  $('stats').replaceChildren(...stats.map(([label, value, isNew]) => {
    const d = document.createElement('div');
    const s = document.createElement('span'); s.textContent = label;
    const b = document.createElement('b'); b.textContent = value; if (isNew) b.className = 'new';
    d.append(s, b);
    return d;
  }));
  $('choices').replaceChildren();
  $('dialog-actions').replaceChildren(...actions.map((a) => {
    const el = document.createElement(a.href ? 'a' : 'button');
    el.textContent = a.label;
    if (a.primary) el.className = 'primary';
    if (a.href) { el.href = a.href; el.className = 'link-button'; }
    else { el.type = 'button'; if (a.switch) el.dataset.switch = ''; el.addEventListener('click', a.fn || (() => window.GameSwitch?.open())); }
    return el;
  }));
  $('dialog').hidden = false;
  const first = $('dialog-actions').querySelector('button');
  first?.focus({ preventScroll: true });
}

function togglePause() {
  if (mode === 'play') {
    mode = 'paused';
    release();
    audio?.duck(true);
    $('pause').textContent = 'Resume';
    dialog({
      eyebrow: `ISLAND ${run.at + 1}`, title: 'Moonlight waits', copy: 'The pearl is paused.',
      actions: [
        { label: 'Resume', primary: true, fn: () => togglePause() },
        { label: 'Restart', fn: () => begin() },
        { label: 'Switch game', switch: true },
      ],
    });
  } else if (mode === 'paused') {
    mode = 'play';
    $('dialog').hidden = true;
    $('pause').textContent = 'Pause';
    audio?.duck(false);
    last = performance.now();
  }
}

function openCharms() {
  mode = 'charm';
  release();
  charmSel = 0;
  audio?.duck(true);
  dialog({ eyebrow: `SHRINE · ISLAND ${run.at + 1}`, title: 'The moonwell opens', copy: 'Choose a charm for the next region.' });
  $('choices').replaceChildren(...run.offer.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const k = document.createElement('kbd'); k.textContent = i + 1;
    const n = document.createElement('b'); n.textContent = c.name;
    const d = document.createElement('small'); d.textContent = c.desc;
    b.append(k, n, d);
    b.addEventListener('click', () => pickCharm(i));
    b.addEventListener('pointerenter', () => { charmSel = i; markCharm(); });
    return b;
  }));
  markCharm();
}
function markCharm() { [...$('choices').children].forEach((b, i) => b.classList.toggle('sel', i === charmSel)); $('choices').children[charmSel]?.focus({ preventScroll: true }); }
function moveCharm(d) { charmSel = (charmSel + d + run.offer.length) % run.offer.length; markCharm(); audio?.play('click'); }
function pickCharm(i) {
  if (mode !== 'charm' || !choose(run, i)) return;
  $('dialog').hidden = true;
  mode = 'play';
  audio?.duck(false);
  drainEvents();
  last = performance.now();
}
function charmKey(e) {
  if (e.repeat) return;
  const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
  if (n >= 0) pickCharm(n);
  else if (KEYMAP[e.code] === 'left' || e.code === 'ArrowUp') moveCharm(-1);
  else if (KEYMAP[e.code] === 'right' || e.code === 'ArrowDown') moveCharm(1);
  else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); pickCharm(charmSel); }
}

function gameOver() {
  mode = 'over';
  release();
  const before = { ...best };
  save();
  audio?.duck(true);
  const island = run.at + 1;
  const newScore = run.score > before.score, newIsland = island > before.island;
  dialog({
    eyebrow: newScore || newIsland ? 'NEW BEST' : 'THE RUN ENDS',
    title: 'The moon rests',
    copy: newIsland && before.island ? `You passed your best flag at island ${before.island}.` : '',
    stats: [
      ['SCORE', run.score.toLocaleString(), newScore],
      ['ISLAND', island, newIsland],
      ['BEST STREAK', run.bestStreak],
      ['STARS', run.stats.stars],
      ['LONG SHOTS', run.stats.long],
      ['RAILS AND PORTALS', run.stats.rails + run.stats.portals],
    ],
    actions: [
      { label: 'Play again', primary: true, fn: () => begin() },
      { label: 'Switch game', switch: true },
      { label: 'Arcade', href: '/' },
    ],
  });
}

/* ---------------- feedback ---------------- */
let bannerTimer = 0, bannerRank = 0, bannerHide = 0;
function banner(text, small = '', { rank = 1, big = false, time = 1600 } = {}) {
  const now = performance.now();
  if (now < bannerTimer && rank < bannerRank) return;
  const el = $('banner');
  el.replaceChildren(text);
  if (small) { const s = document.createElement('small'); s.textContent = small; el.append(s); }
  el.classList.toggle('big', big);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  bannerTimer = now + time;
  bannerRank = rank;
  clearTimeout(bannerHide);
  bannerHide = setTimeout(() => el.classList.remove('show'), time);
}
function shake(n) { if (!reduced.matches && !attract) { view.shake = Math.max(view.shake, n); maxShake = Math.max(maxShake, n); } }
function stop(t) { freeze = Math.max(freeze, t); }
function buzz(ms) { if (navigator.vibrate && body.classList.contains('touch') && !attract) try { navigator.vibrate(ms); } catch (e) { /* not allowed */ } }

const POP = { star: '#ffe7a0', bumper: '#ffd38a', lantern: '#ffc070', lanterns: '#ffb04a', ridge: '#ffffff', swift: '#9fe3ff', long: '#ffd0ff', rail: '#ffe08a', portal: '#b9d2ff', clutch: '#9fe3b0', pearl: '#ffffff', shrine: '#ffe7a0' };
const LABEL = { swift: 'SWIFT', long: 'LONG SHOT', rail: 'GOLD RAIL', portal: 'MOON PORTAL', clutch: 'CLUTCH', lanterns: 'LANTERNS LIT', pearl: 'PEARL' };

function handle(e) {
  const a = (name, opt) => !attract && audio?.play(name, opt);
  switch (e.type) {
    case 'score': {
      const big = e.value >= 1000;
      pop(fx, e.x, e.y, (LABEL[e.kind] ? LABEL[e.kind] + ' ' : '') + '+' + e.value.toLocaleString(), POP[e.kind] || '#ffe5a3', big ? 22 : 16, big ? 1.2 : 0.8);
      if (!attract) { $('score').classList.add('bump'); setTimeout(() => $('score').classList.remove('bump'), 120); }
      if (e.kind === 'long') {
        a('long'); shake(6); stop(0.07); burst(fx, e.x, e.y + 40, { n: 26, color: '#ffd0ff', speed: 360 });
        // the banner teaches the first long shot of a run, then only marks the rare ones
        if (!attract && (run.stats.long === 1 || run.flight >= 3)) banner(run.flight >= 3 ? 'SOARING SHOT' : 'LONG SHOT', `${run.flight} islands in one flight`, { rank: 3 });
      }
      if (e.kind === 'swift') a('swift');
      if (e.kind === 'lanterns') { a('lanterns'); if (!attract) banner('LANTERNS LIT', '', { rank: 2 }); }
      if (e.kind === 'clutch') { a('clutch'); stop(0.05); }
      break;
    }
    case 'shot': a('shot', { v: e.v }); burst(fx, e.x, e.y, { n: 6, color: '#fff1c9', speed: 160, life: 0.3 }); if (e.side < 0) hints.tried = true; break;
    case 'bumper':
      combo = performance.now() - combo.t < 900 ? { n: combo.n + 1, t: performance.now() } : { n: 0, t: performance.now() };
      a('bumper', { n: combo.n }); shake(2.5); burst(fx, e.x, e.y, { n: 10, color: '#ffd98a', speed: 280 }); ring(fx, e.x, e.y, '#ffe2a0', 30, 40, 0.35);
      break;
    case 'star': a('star', { chain: e.chain }); burst(fx, e.x, e.y, { n: 12, color: '#ffe7a0', speed: 220 }); ring(fx, e.x, e.y, '#ffe7a0', 14, 36, 0.4); break;
    case 'lantern': a('lantern'); burst(fx, e.x, e.y, { n: 8, color: '#ffc070', speed: 140 }); break;
    case 'ridge':
      a('ridge', { streak: e.streak }); ring(fx, e.x, e.y - 30, '#cfe3ff', 20, 90, 0.6);
      if (!attract && e.mult > 1 && e.streak % 2 === 0) banner(`×${e.mult}`, `${e.streak} ridges in a row`, { rank: 1, time: 1000 });
      if (!attract && run.at + 1 >= 4 && !hints.seen) { hints.seen = true; store.set(SEEN, true); }
      break;
    case 'region': a('region'); if (!attract) banner(e.name.toUpperCase(), `Island ${e.island}`, { rank: 4, big: true, time: 2400 }); break;
    case 'best': a('best'); if (!attract) banner('NEW BEST', `Past island ${e.island - 1}`, { rank: 5, time: 2000 }); burst(fx, e.x, e.y - 40, { n: 40, color: '#9fe3b0', speed: 420 }); break;
    case 'rail': a('rail'); stop(0.05); shake(3); if (!attract) banner('GOLD RAIL', '', { rank: 2, time: 1000 }); break;
    case 'railEnd': a('railEnd'); burst(fx, e.x, e.y, { n: 16, color: '#ffe08a', speed: 260 }); break;
    case 'portal': a('portal'); burst(fx, e.x, e.y, { n: 24, color: '#b9d2ff', speed: 300 }); ring(fx, e.x, e.y, '#b9d2ff', 30, 90, 0.6); break;
    case 'warpEnd': a('warpEnd'); burst(fx, e.x, e.y, { n: 20, color: '#b9d2ff', speed: 260 }); ring(fx, e.x, e.y, '#b9d2ff', 20, 70, 0.5); break;
    case 'drain':
      a('drain'); shake(8); buzz(80);
      burst(fx, e.x, e.y, { n: 26, color: '#9fdcff', speed: 300, g: 900, life: 0.9, size: 5 });
      if (!attract) banner(e.lives > 0 ? 'Pearl lost' : 'Last pearl lost', e.lives > 0 ? `${e.lives} left · tap or press Space` : '', { rank: 3 });
      break;
    case 'saved': {
      a('saved'); burst(fx, e.x, e.y, { n: 20, color: '#bfe2ff', speed: 300 });
      const by = { bridge: 'The moon bridge caught it', moonrise: 'Moonrise caught it', shield: 'The moon shield caught it' }[e.by];
      if (!attract) banner('Saved', by, { rank: 3, time: 1200 });
      break;
    }
    case 'moonrise': a('moonrise'); stop(0.1); shake(4); if (!attract) banner('MOONRISE', 'Double points · stronger flippers · no drains', { rank: 4, big: true, time: 2200 }); break;
    case 'moonset': a('moonset'); break;
    case 'pearl': a('pearl'); if (!attract) banner('+1 PEARL', `${run.lives} of ${MAX_PEARLS}`, { rank: 4 }); burst(fx, e.x, e.y, { n: 30, color: '#ffffff', speed: 320 }); break;
    case 'pulse': a('pulse'); ring(fx, e.x, e.y, '#a9c8ff', 18, 70, 0.45); burst(fx, e.x, e.y + 10, { n: 10, color: '#a9c8ff', speed: 200 }); buzz(20); break;
    case 'pulseReady': a('pulseReady'); break;
    case 'drop': a('drop'); break;
    case 'thud': if (e.v > 500) a('thud', { v: e.v }); if (e.v > 700) burst(fx, e.x, e.y + 12, { n: 5, color: '#c8bca4', speed: 90, life: 0.4, size: 3 }); break;
    case 'gate': a('gate'); ring(fx, e.x, e.y, '#cfe3ff', 10, 30, 0.3); break;
    case 'mill': a('mill'); break;
    case 'nudge': a('nudge'); break;
    case 'shrine': a('shrine'); burst(fx, e.x, e.y, { n: 30, color: '#cfe3ff', speed: 300 }); if (attract) choose(run, 0); else { openCharms(); if (autoplay && autoPick) setTimeout(() => pickCharm(0), 400); } break;
    case 'charm': a('charm'); if (!attract) banner(e.charm.name, e.charm.desc, { rank: 4, time: 2000 }); break;
    case 'over': a('over'); if (attract) { const ended = run; setTimeout(() => { if (attract && run === ended) newAttract(); }, 1500); } else gameOver(); break;
  }
}
function drainEvents() { const list = run.events; run.events = []; for (const e of list) handle(e); }

/* ---------------- hints for the first islands ---------------- */
function hint() {
  if (attract || mode !== 'play' || hints.seen || run.at > 2) return show('');
  const touch = body.classList.contains('touch');
  const s = station(run.world, run.at), b = run.ball;
  if (run.phase === 'ready') return show(touch ? 'Tap either side to drop the pearl' : 'Press Space to drop the pearl');
  if (run.at === 0) {
    if (b.y > s.fy - 40 && b.x < s.cx && !hints.tried) return show(touch ? 'Hold the LEFT half now to flip' : 'Flip with Z or ← now');
    if (b.x > s.cx - 10 && b.y > s.fy - 60) return show(touch ? 'Right half: the right flipper passes it back' : 'X or → is the right flipper: it passes back');
    return show('Flip near the tip to clear the ridge →');
  }
  return show(`Ridges in a row raise your multiplier · ×${run.mult}`);
}
function show(text) {
  const el = $('hint');
  if (hints.shown === text) return;
  hints.shown = text;
  el.textContent = text;
  el.classList.toggle('show', !!text);
}

/* ---------------- head-up display ---------------- */
const shown = {};
function set(id, value, fn) { if (shown[id] !== value) { shown[id] = value; fn(value); } }
function hud(force) {
  if (force) for (const k in shown) delete shown[k];
  if (!run) return;
  const s = station(run.world, run.at);
  set('score', run.score, (v) => { $('score').textContent = v.toLocaleString(); });
  set('island', run.at + 1, (v) => { $('island').textContent = 'ISLAND ' + v; });
  set('region', s.biome.name, (v) => { $('region').textContent = v; });
  set('lives', run.lives, (v) => { $('lives').replaceChildren(...Array.from({ length: v }, () => document.createElement('i'))); $('lives').setAttribute('aria-label', v + ' pearls'); });
  set('mult', run.mult + (run.moonrise > 0 ? 'm' : ''), () => {
    $('mult').textContent = '×' + run.mult * (run.moonrise > 0 ? 2 : 1);
    $('mult').className = run.moonrise > 0 ? 'moon' : run.mult >= 4 ? 'hot' : '';
  });
  // two pips: the multiplier goes up every second ridge in a row
  set('streak', run.mult >= 8 ? 'max' : run.streak % 2, (v) => {
    $('streak').replaceChildren(...(v === 'max' ? [] : [0, 1].map((i) => { const b = document.createElement('b'); if (i < v) b.className = 'on'; return b; })));
  });
  const p = run.pulse;
  set('pulse', p.charges + '/' + p.max, () => {
    $('pulse-pips').replaceChildren(...Array.from({ length: p.max }, (_, i) => { const d = document.createElement('i'); if (i >= p.charges) d.className = 'off'; return d; }));
    $('pulse').disabled = p.charges <= 0;
  });
}

/* ---------------- camera ---------------- */
function target() {
  const s = station(run.world, run.at), b = run.ball;
  const W = view.w / view.base, H = view.h / view.base;
  // the flippers sit 30% up from the bottom edge: a phone in portrait shows more water below them
  const bottom = s.fy + Math.max(240, Math.min(0.3 * H, 520));
  const travel = b.mode === 'rail' || b.mode === 'warp';
  // a pearl going up fast makes room above it before it gets there
  const want = b.mode === 'gone' || b.mode === 'held' ? bottom - H : Math.min(bottom - H, b.y - 120 - Math.max(0, -b.vy) * 0.3);
  const zoom = Math.max(travel ? 0.62 : 0.6, Math.min(1, H / (bottom - want)));
  const Wz = W / zoom;
  const span = s.x1 + 60 - (s.x0 - 40);
  let x = span <= Wz ? s.x0 - 40 + Wz / 2 : (s.cx - s.P - 150 + s.x1 + 60) / 2;
  if (b.mode !== 'gone') {
    const lead = travel ? Wz * 0.2 : Math.max(0, Math.min(Wz * 0.15, b.vx * 0.2));
    x = Math.max(x, b.x + lead - Wz * 0.3);
    x = Math.min(x, b.x + Wz * 0.38);
  }
  return { x, bottom, zoom };
}
// the bottom edge eases on its own, and the centre follows the zoom, so the flippers stay put while the view zooms
function snapCamera() { const t = target(); Object.assign(view.cam, t, { scale: view.base * t.zoom, y: t.bottom - view.h / view.base / t.zoom / 2 }); }
function camera(dt) {
  const t = target(), c = view.cam;
  const k = 1 - Math.exp(-dt * 5), kz = 1 - Math.exp(-dt * (t.zoom < c.zoom ? 9 : 2));
  c.x += (t.x - c.x) * k;
  c.bottom += (t.bottom - c.bottom) * k;
  c.zoom += (t.zoom - c.zoom) * kz;
  c.scale = view.base * c.zoom;
  c.y = c.bottom - view.h / c.scale / 2;
  // the pearl never leaves the screen sideways, however fast it goes
  const b = run.ball, half = view.w / 2 / c.scale;
  if (b.mode !== 'gone') {
    if (b.x > c.x + half - 60 / c.scale * 1.5) c.x = b.x - half + 90 / c.scale;
    if (b.x < c.x - half + 40) c.x = b.x + half - 40;
  }
}

/* ---------------- the loop ---------------- */
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  frames++;
  pollPad();
  if (!run) newAttract();
  const live = mode === 'play' || (attract && mode === 'title');
  if (live) {
    if (freeze > 0) freeze -= dt;
    else {
      acc += dt;
      let n = 0;
      while (acc >= TICK && n++ < 8) {
        const inp = attract || autoplay ? botInput(run, bot) : { ...held(), drop: dropPress, pulse: pulsePress };
        dropPress = pulsePress = false;
        tick(run, inp);
        if (run.events.length) drainEvents();
        acc -= TICK;
        if (mode !== 'play' && !attract) break;
      }
      if (n >= 8) acc = 0;
    }
  }
  // the trail and the spin of the pearl
  const b = run.ball;
  if (b.mode === 'free' || b.mode === 'rail') { fx.trail.push([b.x, b.y]); if (fx.trail.length > 14) fx.trail.shift(); }
  else fx.trail.length = 0;
  fx.spin += (b.vx / 15) * dt * (live ? 1 : 0);
  updateFx(fx, mode === 'paused' || mode === 'charm' ? 0 : dt);
  camera(dt);
  view.shake *= Math.exp(-dt * 12);
  const sh = view.shake > 0.3 ? view.shake : 0;
  const cam = { ...view.cam, x: view.cam.x + (Math.random() - 0.5) * sh / view.cam.scale, y: view.cam.y + (Math.random() - 0.5) * sh / view.cam.scale };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw(ctx, { ...view, cam }, run, fx, now);
  if (!attract) {
    hud();
    hint();
    audio?.mood({ intensity: Math.min(1, (run.mult - 1) / 5), moonrise: run.moonrise > 0, key: audio.keyOf(Math.floor(run.at / REGION)) });
  }
}

/* ---------------- start ---------------- */
function bestLine() {
  $('best-line').textContent = best.score > 0 ? `BEST ${best.score.toLocaleString()} · ISLAND ${best.island}` : 'No best run yet';
}
bestLine();
body.classList.add('title-on');
$('launch').focus({ preventScroll: true });
requestAnimationFrame((t) => { last = t; frame(t); });

// For the checks in qa/moonwell/: what the game is doing, and a way to start a seeded run
window.moonwell = {
  get snapshot() {
    const b = run.ball;
    return {
      mode, attract, phase: run.phase, island: run.at + 1, score: run.score, lives: run.lives, mult: run.mult, streak: run.streak,
      meter: run.meter, moonrise: run.moonrise, ball: { x: b.x, y: b.y, vx: b.vx, vy: b.vy, mode: b.mode }, cam: { ...view.cam },
      view: { w: view.w, h: view.h }, frames, best: { ...best }, muted, artReady: art.sheet.naturalWidth > 0 && art.far.naturalWidth > 0,
      offer: run.offer ? run.offer.map((c) => c.id) : null, saver: run.saver, maxShake, charms: { ...run.charms },
    };
  },
  get run() { return run; },
  start(seed) { begin(seed); },
  // the QA bot plays the real game, and (unless told not to) picks the first charm at a shrine
  autoplay(on = true, skill = 0.9, pick = true) { autoplay = on; autoPick = pick; bot = createBot({ skill, seed: 5 }); },
  pick(i) { pickCharm(i); },
};
