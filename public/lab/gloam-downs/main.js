// Gloam Downs: the page. It loads a baked place, draws it with Ink Studio's own WebGL renderer, and walks the lamplighter through it.
// Everything here is the frame loop, the HUD and the dialogs; the inputs are in input.js and cards.js, the rules of movement in
// play.js, and a run's rules and moves in run.js and moves.js. With ?run the page plays the combat run (behind a flag while it is
// built); without it, it is the explorer.
/* global PixelLook */
import { createRenderer } from './ink/webgl/renderer.mjs';
import { makeCamera as viewCamera } from './ink/webgl/view.mjs';
import { loadPlace } from './world.js';
import { makeWalk, makeBody, makeCamera, camLayout, pose, touches, atBeacon, PARAMS } from './play.js';
import { makeCombat, makeMoveLock, asFoes } from './cameras.js';
import { ORDER, load, store, wispCount, fresh } from './save.js';
import * as RS from './run-save.js';
import { STEP, stepCount, startRun, reload, goTo, chooseWick, maxOf, flasksOf, makeRunner, newSeed, WICKS } from './run.js';
import { nearest, faceYaw, makePost, HITS } from './moves.js';
import { makeInput, navStep, readPads, heldNav } from './input.js';
import * as cards from './cards.js';
import { makePool } from './pool.js';
import { figures, poolFor, lineup, LINEUP } from './figures.js';
import { findVeils, makeVeils } from './veil.js';
import { makeFight, SPARKS } from './fight.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), loading = $('loading'), loadLine = $('loadLine'), barFill = $('barFill'), bar = $('bar');
const q = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NUMERAL = ['I', 'II', 'III', 'IV', 'V'];
const TARGET = { low: 30000, mid: 64000, high: 110000 };
// the combat run is behind ?run until it is finished; ?run&test&lineup gives a pool of one of each figure, to look at them
const RUN = q.has('run'), LOOK = RUN && q.has('lineup');
if (RUN) {
  document.body.classList.add('run');
  // in a run the Map tool is the pause
  document.getElementById('bMap').textContent = 'Pause';
  document.getElementById('bMap').title = 'Pause the run (P)';
  document.getElementById('bLook').title = 'Face the nearest foe (R)';
}

/* ---------------- state ---------------- */
// with site data blocked, even reading localStorage throws; then the saves live in this page only (load and store take null)
const disk = (() => { try { return window.localStorage; } catch { return null; } })();
let save = q.has('fresh') ? fresh() : load(disk);
// the run's own save, under its own key: the explorer's save is never written in a run
const rs = RUN ? (q.has('fresh') ? RS.fresh() : RS.load(disk)) : null;
let renderer = null, place = null, walk = null, body = null, cam = null, world = null, meta = null, runner = null, combat = null, held = null;
let mode = 'loading', paused = false, lost = false, last = 0, time = 0, frames = 0, acc = 0, steps = 0;
let artTarget = TARGET[q.get('q')] || (coarse ? 46000 : TARGET.mid), adapt = !q.has('q');
let art = { w: 320, h: 200, s: 1 };
let pendingRows = new Set(), fogNear = 10, beaconLit = false, arriveTimer = 0, toastTimer = 0, slowFor = 0, pool = null, slots = null, veils = null;
const intervals = [];
// the run: the sound cues logged across places, the effects' flags (each can be turned off with __gloam.fx), what the effects give
// this frame, training posts (?test), the fight in this place (fight.js) and the foes' targets
const cues = [];
const fx = { stop: true, flash: true, kick: true, zoom: true, grade: true, shake: true };
const fxNow = { kick: [0, 0, 0], zoom: 1, bars: 0 };
const posts = [];
let foeTargets = () => [], fight = null;
let sinceStore = 0, endAt = 0;
// ?run&lineup without ?test: one of each foe and the Barrow Reeve stand in a row and play each of their moves in turn, to look at
let gallery = null;
function startGallery() {
  const spots = lineup(pool, walk, { x: body.s.x, z: body.s.z, yaw: body.s.yaw }).filter(p => p.clip);
  gallery = { t: 0, spots: spots.map(p => ({ at: p, slot: pool.slots.find(s => s.i === p.i) })).filter(g => g.slot) };
}
function stepGallery() {
  gallery.t += STEP;
  for (const { at, slot } of gallery.spots) {
    const names = Object.keys(slot.type.clips), k = Math.floor(gallery.t / 1.8) % names.length, clip = slot.type.clips[names[k]];
    pool.pose(slot, at, names[k], Math.min(gallery.t % 1.8, clip.dur || 1.8));
  }
}
const targets = () => [...posts.filter(p => p.alive), ...foeTargets()];
// what the cameras need from a fight: the awake foes (home: standing at home; homing: walking home; rising) and the blade's target
const fightView = () => (fight ? { foes: fight.foes.awake(), target: fight.foes.target() } : { foes: [], target: null });
/* what the combat camera turns toward: the training posts (?test), and the awake foes of the fight (or, with no fight, the targets that
   a test hands the page with setTargets). A foe at home, walking home or sinking is never its foe */
const awake = () => [
  ...asFoes(posts.filter(p => p.alive)),
  ...(fight ? fightView().foes.map(f => ({ id: f.id, x: f.x, y: f.y, z: f.z, home: f.home || f.homing || f.state === 'sink' })) : asFoes(foeTargets()))
];

/* ---------------- the art size: a small picture scaled up by a whole number ---------------- */
function sizeArt() {
  const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  const s = Math.max(1, Math.round(Math.sqrt((W * H * dpr * dpr) / artTarget)));
  art = { w: Math.max(64, Math.ceil((W * dpr) / s)), h: Math.max(64, Math.ceil((H * dpr) / s)), s };
  canvas.style.width = `${(art.w * s) / dpr}px`;
  canvas.style.height = `${(art.h * s) / dpr}px`;
}
// the camera's framing for this window (play.js camLayout): a tall screen keeps its width of view, so it still sees 4 m to each side
const layoutNow = () => camLayout(innerWidth, innerHeight);
addEventListener('resize', () => { sizeArt(); if (cam) cam.layout(layoutNow()); });

/* ---------------- input ---------------- */
const jumpBtn = $('bJump'), stickEl = $('stick'), actBtns = [$('bAttack'), $('bRoll'), $('bHeal')];
const inp = makeInput({ canvas, stick: stickEl, jump: jumpBtn, attack: $('bAttack'), roll: $('bRoll'), heal: $('bHeal') }, { run: () => RUN, play: () => mode === 'play' });
const input = inp.input;
const typing = e => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
addEventListener('keydown', e => {
  if (typing(e) || window.GameSwitch?.isOpen) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (mode === 'play') { if (RUN) openPause(); } else back(); return; }
  if (k === 'm' || (RUN && k === 'p')) {
    if (mode === 'play') { RUN ? openPause() : openMap(); e.preventDefault(); }
    else if (RUN ? mode === 'pause' && !asking : mode === 'map') RUN ? resume() : closePanels();
    return;
  }
  if (mode === 'play' && k === 'r') face();
});

/* the pads, read on every frame in every mode: in a card or on the loading screen the d-pad and the left stick move the focus, A
   presses, B goes back, and Start and Back do what the card allows. A pad that first shows up changes the cards' controls, and that
   press presses nothing */
const nav = { dir: 0, t: 0 };
let padWas = { a: false, b: false, start: false, back: false, face: false, pause: false }, padSeen = false;
// a card or the loading screen takes over: a way the d-pad or the stick already holds moves nothing until it comes back to centre
const holdNav = () => heldNav(nav, readPads(navigator.getGamepads?.() || [], RUN).nav);
function showCard(card) { holdNav(); return cards.show(card); }
function padCheck() {
  const any = [...(navigator.getGamepads?.() || [])].some(p => p && p.connected);
  if (any && !padSeen) { padSeen = true; showControls(); return true; }
  return false;
}
function pollPad(dt) {
  const p = inp.readPad(), n = p.nav;
  const was = padWas;
  padWas = { a: n.a, b: n.b, start: n.start, back: n.back, face: p.face, pause: p.pause };
  if (p.any && !padSeen) { padSeen = true; showControls(); return; }
  const edge = k => n[k] && !was[k];
  if (cards.current() || mode === 'loading') {
    const d = navStep(nav, n, dt);
    if (d) cards.move(d);
    if (edge('a')) { if (cards.press()) inp.swallowAll(); }
    else if (edge('b')) back();
    else if (edge('start')) startButton();
    else if (edge('back') && RUN && mode === 'pause' && !asking) resume();
  } else {
    // out of the cards the way held is kept, so the first poll in a card that opens takes no move from it
    heldNav(nav, n);
    if (mode !== 'play') return;
    if (p.face && !was.face) face();
    if (p.pause && !was.pause) RUN ? openPause() : openMap();
  }
}
// B on a pad, or Escape: in a run, the back action of the card where it has one (Resume, No; stage 2 and 3 add Back to the beacon and
// Step back); in Wander, close the help, the Map or the end card
function back() {
  if (RUN) { const c = cards.current(); if (c?.back) c.back(); return; }
  closePanels();
}
// Start in a card: in a run it closes only the pause panel, and not while End the run asks again; in Wander it closes any card
function startButton() {
  if (RUN) { if (mode === 'pause' && !asking) resume(); return; }
  closePanels();
}
// R, the Look tool and RB: face the nearest awake foe (or a training post) within 10 m, or look ahead when there is none
function face() {
  if (!cam || !body) return;
  const t = RUN ? nearest(targets(), body.s) : null;
  if (t) { cam.c.yaw = faceYaw(body.s, t); cam.c.idle = 0; } else lookAhead();
}
function lookAhead() { if (cam && body) { cam.c.yaw = body.s.yaw + Math.PI; cam.c.pitch = cam.c.base; cam.c.idle = 0; } }

/* ---------------- the HUD and the cards ---------------- */
const hud = $('hud'), tools = $('tools');
function showHud(on) {
  hud.hidden = tools.hidden = !on;
  jumpBtn.hidden = !(on && coarse);
  for (const b of actBtns) b.hidden = !(on && coarse && RUN);
}
function updateHud() {
  if (RUN) return updateRunHud();
  const got = save.wisps[meta.id]?.length || 0;
  $('where').textContent = meta.name;
  $('count').innerHTML = `<b>◆ ${got}/5</b> wisps · <i>${beaconLit ? 'beacon lit' : 'beacon dark'}</i>`;
  const others = meta.id === ORDER.at(-1) && ORDER.some(id => !save.lit[id]); // the last place lit before the rest
  $('hint').textContent = !beaconLit ? meta.hint || 'Light the beacon on the summit.' : others ? 'Other beacons are still dark. Use the map.' : 'The way is open. Use the map, or walk on.';
}
// the run's HUD line, until stage 2's health bar: health, flasks, wisps and glim carried
function updateRunHud() {
  const run = rs.run;
  $('where').textContent = meta.name;
  if (!run) { $('count').textContent = ''; return; }
  $('count').innerHTML = `<i>♥ ${run.hp}/${maxOf(rs)}</i> · ⚗ ${run.flasks}/${flasksOf(rs)} · <b>◆ ${runner?.wisps.size || 0}/5</b> · ● ${run.carried} glim`;
  $('hint').textContent = beaconLit ? 'The beacon burns.' : 'Put out the keepers, then light the beacon.';
  $('healN').textContent = String(Math.min(5, run.flasks));
}
function toast(html, ms = 1800) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}
function arrive() {
  const i = ORDER.indexOf(meta.id);
  $('arriveN').textContent = `${NUMERAL[i]} · ${['The first place', 'The second place', 'The third place', 'The fourth place', 'The last place'][i]}`;
  $('arriveName').textContent = meta.name;
  $('arriveSub').textContent = meta.sub || '';
  const a = $('arrive');
  a.classList.remove('off');
  clearTimeout(arriveTimer);
  arriveTimer = setTimeout(() => a.classList.add('off'), still ? 2400 : 3200);
}
// the controls for the input in use: the pad once the page has seen one, else touch on a touch screen, else the keys and the mouse
const CONTROLS = {
  keys: ['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrows move. <kbd>Shift</kbd> walks. <kbd>Space</kbd> jumps.',
    '<kbd>J</kbd> or <kbd>Z</kbd>, or a left click, attacks. Press again, or hold, for the string of three.',
    '<kbd>K</kbd> or <kbd>X</kbd> rolls. <kbd>L</kbd> or <kbd>C</kbd> drinks a flask.',
    'Drag the view, or <kbd>Q</kbd> <kbd>E</kbd>, to look. <kbd>R</kbd> faces the nearest foe.',
    '<kbd>M</kbd>, <kbd>P</kbd> or <kbd>Esc</kbd> pauses.'],
  touch: ['Drag on the left half to move, and on the right half to look.', 'ATTACK swings: tap it, or hold it for the string of three.',
    'ROLL rolls, HEAL drinks a flask and JUMP jumps.', 'Look faces the nearest foe. Pause stops the run.'],
  pad: ['Left stick: move. A light tilt walks. Right stick: look.', '<kbd>A</kbd> jump · <kbd>X</kbd> attack · <kbd>B</kbd> roll · <kbd>Y</kbd> heal',
    '<kbd>RB</kbd> face the foe · <kbd>Start</kbd> pause']
};
const controlsKind = () => (padSeen ? 'pad' : coarse ? 'touch' : 'keys');
function showControls() {
  if (!RUN) return;
  const html = CONTROLS[controlsKind()].map(l => `<li>${l}</li>`).join('');
  for (const id of ['runControls', 'pauseControls']) $(id).innerHTML = html;
}

/* ---------------- the explorer's dialogs ---------------- */
const panels = ['help', 'map', 'end'];
function closePanels() {
  // closing the help any way (Walk, Escape, a gamepad's Start) means it has been read
  if (!$('help').hidden) { save.seen = true; store(disk, save); }
  let was = false;
  for (const p of panels) if (!$(p).hidden) { $(p).hidden = true; was = true; cards.shut($(p)); }
  if (was && mode !== 'loading') { mode = 'play'; inp.swallowAll(); canvas.focus?.(); }
}
function openMap() {
  const box = $('places');
  box.textContent = '';
  ORDER.forEach((id, i) => {
    const open = save.reached.includes(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = !open;
    if (meta && id === meta.id) b.setAttribute('aria-current', 'true');
    const name = NAMES[id];
    b.innerHTML = `<span class="n">${NUMERAL[i]}</span><b></b><em></em><small></small>`;
    b.querySelector('b').textContent = open ? name : 'Locked';
    b.querySelector('small').textContent = open ? (save.lit[id] ? 'Beacon lit' : 'Beacon dark') : 'Light the beacon before it';
    b.querySelector('em').textContent = open ? `◆ ${save.wisps[id]?.length || 0}/5` : '';
    b.addEventListener('click', () => { closePanels(); if (id !== meta.id) go(id); });
    box.appendChild(b);
  });
  $('mapLine').textContent = `Wisps found: ${wispCount(save)} of 25.`;
  $('map').hidden = false;
  mode = 'map';
  showCard({ el: $('map'), main: () => box.querySelector('[aria-current="true"]') });
}
const NAMES = { gaol: 'The Sunken Gaol', ramparts: 'The Crow Wall', fen: 'Lantern Fen', bells: 'The Bell Knoll', barrows: 'Barrow Crown' };
$('bMap').addEventListener('click', () => {
  if (RUN) { if (mode === 'play') openPause(); else if (mode === 'pause' && !asking) resume(); return; }
  mode === 'map' ? closePanels() : openMap();
});
$('bMapClose').addEventListener('click', closePanels);
$('bLook').addEventListener('click', face);
$('bStart').addEventListener('click', closePanels);
$('bEndStay').addEventListener('click', closePanels);
$('bAgain').addEventListener('click', () => { closePanels(); save.lit = {}; save.time = 0; save.at = 'gaol'; store(disk, save); go('gaol'); });
for (const p of panels) $(p).addEventListener('pointerdown', e => { if (e.target === $(p) && p !== 'help') closePanels(); });
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/* ---------------- the run's cards ----------------
   Until stage 2 builds the Lamp-room, the HUD and the full screens, these are the run's plain cards: the help with Begin the run, the
   pause panel with End the run, the beacon card's wick choice and Walk on, and the summary of an ended run. In a run, a press outside
   a card's box does nothing, but on the pause panel, where it resumes */
let asking = false, chosen = null;
const storeRun = () => { sinceStore = 0; return RS.store(disk, rs); };
function openCard(id, m, main, backFn = null) {
  $(id).hidden = false;
  mode = m;
  padCheck();
  showControls();
  showCard({ el: $(id), main, back: backFn });
}
function closeCard(id) {
  $(id).hidden = true;
  cards.shut($(id));
  mode = 'play';
  inp.swallowAll();
  canvas.focus?.();
}
function openRunHelp() { openCard('runHelp', 'help', () => $('bBegin')); }
$('bBegin').addEventListener('click', () => {
  rs.seen = true;
  if (!rs.run) { startRun(rs, seed()); if (meta.id !== rs.run.place) { storeRun(); closeCard('runHelp'); go(rs.run.place); return; } newRunner(); }
  storeRun();
  closeCard('runHelp');
  updateHud();
});
const seed = () => (q.has('seed') ? Number(q.get('seed')) >>> 0 || 1 : newSeed(rs.runs));
function openPause() {
  if (!rs.run) return;
  asking = false;
  $('route').innerHTML = ORDER.map((id, i) => {
    const at = ORDER.indexOf(rs.run.place), state = i < at ? 'passed' : i === at ? 'here' : 'ahead';
    return `<li class="${state}"><span>${NUMERAL[i]}</span> ${NAMES[id]}<em>${state === 'here' ? 'now' : state}</em></li>`;
  }).join('');
  $('pauseLine').textContent = `Run time ${fmt(rs.run.time)}`;
  $('pauseRow').hidden = false;
  $('askRow').hidden = true;
  openCard('pause', 'pause', () => (asking ? $('bNo') : $('bResume')), () => (asking ? no() : resume()));
}
function resume() { asking = false; closeCard('pause'); }
function no() { asking = false; $('askRow').hidden = true; $('pauseRow').hidden = false; cards.focusMain(); }
$('bResume').addEventListener('click', resume);
$('bEnd').addEventListener('click', () => { asking = true; $('pauseRow').hidden = true; $('askRow').hidden = false; cards.focusMain(); });
$('bNo').addEventListener('click', no);
$('bYes').addEventListener('click', () => {
  asking = false;
  $('pause').hidden = true;
  cards.shut($('pause'));
  // End the run ends it as a death does
  mode = 'play';
  for (const e of runner.kill([])) runEvent(e);
});
$('pause').addEventListener('pointerdown', e => { if (e.target === $('pause') && !asking) resume(); });
function openBeacon(offer) {
  chosen = null;
  $('beaconLine').textContent = 'Choose a wick. It burns for the rest of the run.';
  const box = $('wicks');
  box.textContent = '';
  for (const id of offer) {
    const w = WICKS.find(x => x.id === id), b = document.createElement('button');
    b.type = 'button';
    b.className = 'wick';
    b.dataset.wick = id;
    b.textContent = `${w.name} · ${w.text}`;
    b.addEventListener('click', () => {
      if (chosen || !chooseWick(rs, id)) return;
      chosen = id;
      storeRun();
      for (const x of box.children) x.hidden = true;
      $('beaconLine').textContent = `${w.name} burns in the lamp.`;
      $('bWalkOn').hidden = false;
      cards.focusMain();
      updateHud();
    });
    box.appendChild(b);
  }
  $('bWalkOn').hidden = true;
  // before the wick is chosen only a wick button closes the card: it has no back action
  openCard('beaconCard', 'beacon', () => (chosen ? $('bWalkOn') : box.querySelector('button')));
}
// Walk on loads the next place; after a reload at the card, the card already shows over it
$('bWalkOn').addEventListener('click', () => { if (meta.id === rs.run.place) return closeCard('beaconCard'); $('beaconCard').hidden = true; cards.shut($('beaconCard')); go(rs.run.place); });
function openSummary() {
  const e = rs.ended;
  $('sumT').textContent = e.won ? 'The downs are lit' : 'The lamp goes out';
  $('sumPlace').textContent = `${NUMERAL[ORDER.indexOf(e.place)]} · ${NAMES[e.place]}`;
  $('sumTime').textContent = fmt(e.time);
  $('sumFoes').textContent = String(e.foes);
  $('sumLost').textContent = `${e.lost} glim`;
  $('sumBanked').textContent = `${e.banked} glim`;
  openCard('summary', 'ended', () => $('bNewRun'));
}
$('bNewRun').addEventListener('click', () => {
  rs.ended = null;
  startRun(rs, seed());
  storeRun();
  $('summary').hidden = true;
  cards.shut($('summary'));
  go(rs.run.place);
});

/* ---------------- wisps and the beacon ---------------- */
// put splats out (density 0) or back; the renderer then uploads only the changed 512-splat rows
const saved = new Map();
function setLit(ranges, on) {
  for (const [a, b] of ranges)
    for (let i = a; i < b; i++) {
      const o = i * 16 + 3;
      if (!saved.has(i)) saved.set(i, world.data[o]);
      world.data[o] = on ? saved.get(i) : 0;
      pendingRows.add(i >> 9);
    }
}
function takeWisp(i) {
  const list = (save.wisps[meta.id] ||= []);
  if (list.includes(i)) return;
  list.push(i);
  list.sort();
  setLit([meta.wisps[i].ids], false);
  store(disk, save);
  updateHud();
  toast(`<b>◆</b> Wisp ${list.length} of 5`);
}
let beaconTimer = 0;
function lightBeacon() {
  if (beaconLit) return;
  beaconLit = true;
  setLit(meta.beacon.fire, true);
  const id = meta.id, next = ORDER[ORDER.indexOf(id) + 1];
  save.lit[id] = true;
  if (next && !save.reached.includes(next)) save.reached.push(next);
  // the walk ends when all five burn, whatever the order: after Walk again the map still opens every place reached
  const dark = ORDER.filter(p => !save.lit[p]).length;
  if (!dark) {
    save.done += 1;
    if (!save.best || save.time < save.best) save.best = save.time;
  }
  store(disk, save);
  updateHud();
  clearTimeout(beaconTimer);
  if (!dark) {
    toast('The last beacon burns', 2400);
    beaconTimer = setTimeout(() => {
      if (meta.id !== id || mode === 'loading') return;
      closePanels();
      $('endTime').textContent = fmt(save.time);
      $('endWisps').textContent = `${wispCount(save)}/25`;
      $('endBest').textContent = save.best ? fmt(save.best) : '–';
      $('end').hidden = false;
      mode = 'end';
      showCard({ el: $('end'), main: () => $('bAgain') });
    }, 1800);
  } else if (next) {
    toast(`The way opens to <b>${NAMES[next]}</b>`, 2600);
    beaconTimer = setTimeout(() => { if (meta.id === id && mode === 'play') go(next); }, 2800);
  } else toast(`${dark} ${dark === 1 ? 'beacon is' : 'beacons are'} still dark`, 2600);
}

/* ---------------- a run in a place ---------------- */
function newRunner() {
  // the foes of this place, with the place: every foe back, and the foes put out kept for this place only
  fight = pool && !LOOK && rs.run ? makeFight({ walk, meta, world, pool, rs, max: () => maxOf(rs), still, fx, project, doc: document }) : null;
  foeTargets = fight ? () => fight.foes.targets() : () => [];
  runner = makeRunner({
    walk, meta, body, rs, targets, still, log: cues, fx,
    ...(fight ? { lightable: fight.foes.lightable, drop: fight.foes.drop, think: fight.think, onLight: fight.foes.bank } : {})
  });
  fight?.bind(runner);
  return runner;
}
// what the runner's step did, on the page
function runEvent(e) {
  fight?.event(e);
  switch (e.type) {
    case 'wisp':
      setLit([meta.wisps[e.i].ids], false);
      toast(`<b>◆</b> Wisp ${e.n} of 5 · +4 glim${e.n === 5 ? ' · a flask fills' : ''}`);
      break;
    case 'beacon':
      beaconLit = true;
      setLit(meta.beacon.fire, true);
      toast('The beacon burns. Its glim is banked, and the flasks are full.', 2400);
      endAt = steps + 90;
      mode = 'lit';
      break;
    case 'win':
      beaconLit = true;
      setLit(meta.beacon.fire, true);
      toast('The last beacon burns', 2400);
      endAt = steps + 108;
      mode = 'won';
      break;
    case 'dark': toast(e.why || 'The beacon will not catch yet', 2600); break;
    case 'toast': toast(e.what === 'full' ? 'Health is full' : 'No flask left. A lit beacon fills the flasks.', 2200); break;
    case 'fall': cam.snap(body.s, body.s.yaw + Math.PI); toast('A fall · −10 health'); break;
    // stage 2 draws the fade to ink over 72 steps before the summary
    case 'dead': endAt = steps + 72; mode = 'dying'; break;
    case 'store': storeRun(); break;
  }
  if (['wisp', 'drink', 'hurt', 'fall', 'beacon', 'win', 'store', 'glim', 'foeOut'].includes(e.type)) updateHud();
}

/* ---------------- loading a place ---------------- */
function progress(f) {
  barFill.style.width = `${Math.round(f * 100)}%`;
  bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
}
const nodraw = q.has('nodraw');
async function go(id) {
  clearTimeout(beaconTimer);
  mode = 'loading';
  holdNav();
  showHud(false);
  $('veil').classList.add('on');
  await new Promise(r => setTimeout(r, still ? 0 : 450));
  loading.classList.remove('done');
  loadLine.textContent = `Walking to ${NAMES[id]}…`;
  $('bRetry').hidden = true;
  progress(0);
  try {
    place = await loadPlace('./worlds/', id, progress);
  } catch (err) {
    loadLine.textContent = `Could not load ${NAMES[id]} (${err.message}).`;
    const r = $('bRetry');
    r.hidden = false;
    r.onclick = () => go(id);
    // so Space, Enter or A on a pad tries again without a Tab
    showCard({ el: loading, main: () => r });
    padCheck();
    return;
  }
  // in a run, the foe files load with the first place (and stay), and each place gets its pool of foes
  if (RUN) {
    try {
      const foes = await figures('./worlds/', 'foes'), boss = LOOK ? await figures('./worlds/', 'boss') : null;
      slots = poolFor(id, foes, boss, LOOK ? LINEUP : undefined);
    } catch (err) {
      loadLine.textContent = `The foes did not load (${err.message}).`;
      const r = $('bRetry');
      r.hidden = false;
      r.onclick = () => go(id);
      showCard({ el: loading, main: () => r });
      padCheck();
      return;
    }
  }
  cards.shut(loading);
  ({ meta, world } = place);
  walk = makeWalk(meta.walk, place.walk);
  // a run's moves drive the body through its own copy of PARAMS
  body = makeBody(walk, meta.spawn, meta.bounds, RUN ? { ...PARAMS } : PARAMS);
  cam = makeCamera(walk, { yaw: meta.spawn.yaw + Math.PI, auto: !still, ...layoutNow() });
  cam.snap(body.s, meta.spawn.yaw + Math.PI);
  // in a run, the combat camera turns the view toward the foes (cameras.js); reduced motion keeps it still
  combat = RUN ? makeCombat({ foes: awake, still }) : null;
  held = RUN ? makeMoveLock() : null;
  // the fog: the bake set it for a camera 9 back; keep it at the same depths whatever the distance
  fogNear = meta.fog.start * 2 * (meta.fogFar - 9) + 2 * 9 - meta.fogFar;
  // the lamplighter's splats ride bones that the page writes every frame
  const n = meta.bones.names.length;
  world.anim = { bones: new Float32Array(12 * n), boned: Int32Array.from({ length: meta.bones.end - meta.bones.first }, (_, i) => meta.bones.first + i) };
  const placeCount = world.count;
  // its slots parked (at density 0 and off the bones), and the spark pool's splats after them
  pool = RUN ? makePool(world, meta, slots, { extra: LOOK ? 0 : SPARKS }) : null;
  // in a run, the mist and haze sheets that lie in front of an awake figure fade out (veil.js); the beacon and the wisps are left alone
  const pack = c => ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536;
  veils = RUN ? makeVeils(world, findVeils(world, { count: placeCount, skip: [...meta.beacon.fire, ...meta.wisps.map(w => w.ids)], shared: meta.pal.slice(32).map(pack) })) : null;
  saved.clear();
  pendingRows = new Set();
  if (RUN) {
    // in a run the place starts again: every wisp is back and the beacon is dark
    beaconLit = false;
    setLit(meta.beacon.fire, false);
    posts.length = 0;
    newRunner();
    gallery = null;
    if (LOOK && !manual) startGallery();
    rs.furthest = Math.max(rs.furthest, ORDER.indexOf(id));
  } else {
    for (const i of save.wisps[id] || []) setLit([meta.wisps[i].ids], false);
    beaconLit = !!save.lit[id];
    if (!beaconLit) setLit(meta.beacon.fire, false);
    save.at = id;
    if (!save.reached.includes(id)) save.reached.push(id);
    store(disk, save);
  }
  pendingRows = new Set(); // the whole world is uploaded on its first frame anyway
  updateHud();
  progress(1);
  loading.classList.add('done');
  $('veil').classList.remove('on');
  mode = 'play';
  view = null;
  acc = 0;
  showHud(true);
  arrive();
  if (manual && !nodraw) draw();
  if (RUN) {
    if (rs.ended) openSummary();
    else if (!rs.run) openRunHelp();
    else if (rs.run.offer) openBeacon(rs.run.offer);
    storeRun();
  } else if (!save.seen) {
    $('helpKeys').hidden = coarse;
    $('helpTouch').hidden = !coarse;
    $('help').hidden = false;
    mode = 'help';
    showCard({ el: $('help'), main: () => $('bStart') });
  }
}

/* ---------------- the frame ---------------- */
// ?test: the loop does not run by itself; a test steps the game with __gloam.tick() and draws with __gloam.draw(). Software WebGL
// draws a frame in about a second, so a test cannot wait on the real loop.
const manual = q.has('test');
// one fixed step of 1/60 s
function update() {
  steps++;
  time += STEP;
  if (RUN) {
    if (runner && ['play', 'dying', 'won', 'lit'].includes(mode)) {
      const play = mode === 'play';
      // while a camera turns by itself, a held move keeps its world direction
      const yaw = play && held ? held.yaw(input, cam.c) : cam.c.yaw;
      for (const e of runner.step(play ? input : {}, yaw)) runEvent(e);
      if (rs.run && ++sinceStore >= 120) storeRun();
    }
    if (gallery) stepGallery();
    if (endAt && steps >= endAt && ['dying', 'won', 'lit'].includes(mode)) {
      const was = mode;
      endAt = 0;
      mode = 'play';
      if (was === 'lit') openBeacon(rs.run.offer);
      else openSummary();
    }
  } else if (mode === 'play') {
    save.time += STEP;
    body.step(STEP, input, cam.c.yaw);
    const s = body.s;
    meta.wisps.forEach((w, i) => { if (!(save.wisps[meta.id] || []).includes(i) && touches(s, w.p)) takeWisp(i); });
    if (!beaconLit && atBeacon(s, meta.beacon)) lightBeacon();
    if (s.y < -25) { body.place(meta.spawn.p, meta.spawn.yaw); cam.snap(body.s, meta.spawn.yaw + Math.PI); toast('Back to the start'); }
  }
  view = cam.follow(body.s, STEP, input, combat && mode === 'play' ? combat.turn : null);
  input.dyaw = input.dpitch = 0;
  if (veils) unveil();
}
// the veils over the awake figures fade out, seen from where the eye is now: nine points on each figure, at its feet, middle and head,
// in the middle and at its two sides as the eye sees them
function unveil() {
  const c = viewCamera(world, { camera: view }, art.w, art.h), figs = [], rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
  for (const s of pool.slots) {
    if (!s.awake || !s.at || !s.nbones) continue;
    const h = s.type.height || 1.5, r = s.type.radius || 0.4;
    for (const k of [0.15, 0.55, 0.95]) for (const side of [-r, 0, r]) figs.push([s.at.x + rx * side, s.at.y + h * k, s.at.z + rz * side]);
  }
  for (const r of veils.step(c.view, art.h / 2 / c.tangent, figs)) pendingRows.add(r);
}
let view = null;
// o.time draws at that game time (the clips and the flicker); o.pool false parks every foe for this one draw (?test)
function draw(o = {}) {
  if (!view) view = cam.follow(body.s, 0, input);
  const t = Number.isFinite(o.time) ? o.time : time;
  pose(world.anim.bones, meta.bones, body.s, t, still);
  if (fight) {
    fight.draw(view, { time: Number.isFinite(o.time) ? o.time : undefined, pool: o.pool });
    fxNow.kick = fight.kick; fxNow.zoom = fight.zoom;
    fight.showNotches(view, mode === 'play');
  } else if (RUN) { fxNow.kick = [0, 0, 0]; fxNow.zoom = 1; world.anim.grade = null; }
  if (RUN) { world.anim.kick = fxNow.kick; world.anim.zoom = fxNow.zoom; world.anim.bars = fxNow.bars; }
  // the fog stays at fogNear..fogFar whatever the camera's distance (the renderer spreads it over dist ± radius)
  world.radius = Math.max(6, meta.fogFar - view.dist);
  world.fog.start = Math.max(0, Math.min(0.97, (fogNear - 2 * view.dist + meta.fogFar) / (2 * world.radius)));
  try {
    renderer.render(world, { width: art.w, height: art.h, time: t, camera: view, changedRows: pool ? [...pendingRows, ...pool.rows] : [...pendingRows], colored: true });
    pendingRows.clear();
    pool?.rows.clear();
  } catch (err) {
    // a lost context can throw before its webglcontextlost event arrives: wait for webglcontextrestored, do not stop
    if (lost || canvas.getContext('webgl2')?.isContextLost()) { lost = true; return; }
    console.warn(err); paused = true; loadLine.textContent = `The picture stopped: ${err.message}`; loading.classList.remove('done');
  }
  frames++;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dtRaw = last ? (now - last) / 1000 : 0;
  last = now;
  if (manual || paused || lost || document.hidden || window.GameSwitch?.isOpen) return;
  // the pads are read on the loading screen and in the cards too
  pollPad(dtRaw);
  if (!place || mode === 'loading') return;
  inp.read();
  // fixed steps of 1/60 s, as many as the frame took (up to 15), so a slow phone does not play in slow motion
  const c = stepCount(acc, dtRaw);
  acc = c.acc;
  for (let i = 0; i < c.n; i++) update();
  if (c.n) inp.consumed();
  draw();
  if (!RUN && frames % 120 === 0) store(disk, save);
  // slow machine: if frames come slower than 45 ms for two seconds, draw a smaller picture
  if (adapt && dtRaw > 0) {
    intervals.push(dtRaw);
    if (intervals.length > 40) intervals.shift();
    const med = [...intervals].sort((a, b) => a - b)[intervals.length >> 1];
    slowFor = med > 0.045 ? slowFor + dtRaw : 0;
    if (slowFor > 2 && artTarget > 24000) { artTarget = Math.round(artTarget * 0.72); sizeArt(); slowFor = 0; intervals.length = 0; }
  }
}

/* ---------------- start ---------------- */
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
canvas.addEventListener('webglcontextrestored', () => { lost = false; });
const keep = () => { if (!place) return; if (RUN) storeRun(); else store(disk, save); };
document.addEventListener('visibilitychange', () => { last = 0; if (document.hidden) keep(); });
addEventListener('pagehide', keep);

// where a world point lands on the screen, in CSS px (null behind the eye)
function project([x, y, z]) {
  if (!view) view = cam.follow(body.s, 0, input);
  const c = viewCamera(world, { camera: view }, art.w, art.h), V = c.view, Pm = c.projection;
  const mv = i => V[i] * x + V[4 + i] * y + V[8 + i] * z + V[12 + i], e = [mv(0), mv(1), mv(2), mv(3)];
  const cl = i => Pm[i] * e[0] + Pm[4 + i] * e[1] + Pm[8 + i] * e[2] + Pm[12 + i] * e[3], w = cl(3);
  if (w <= 1e-6) return null;
  const r = canvas.getBoundingClientRect();
  return [r.left + (cl(0) / w * 0.5 + 0.5) * r.width, r.top + (0.5 - cl(1) / w * 0.5) * r.height];
}
const runState = () => {
  const run = rs?.run, f = runner?.fighter.f, k = runner?.clock;
  return {
    mode, place: run?.place ?? meta?.id, hp: run?.hp ?? 0, max: run ? maxOf(rs) : 0, flasks: run?.flasks ?? 0, flasksMax: run ? flasksOf(rs) : 0,
    carried: run?.carried ?? 0, bank: rs?.bank ?? 0, wisps: runner?.wisps.size ?? 0, wicks: run?.wicks.slice() ?? [], offer: run?.offer?.slice() ?? null,
    foes: run?.foes ?? 0, banked: run?.banked ?? 0, bossDown: !!run?.bossDown, time: run?.time ?? 0, entry: run ? { ...run.entry } : null,
    step: k?.step ?? 0, playStep: k?.play ?? 0, stop: k?.stop ?? 0, ended: rs?.ended ? { ...rs.ended } : null,
    move: f?.move ?? null, hit: f?.move === 'hit' ? HITS[f.hit].id : null, t: f ? f.t / 60 : 0, safe: runner?.fighter.safe() ?? null, combo: runner?.fighter.nextHit() ?? 0,
    fx: {
      kick: fxNow.kick.slice(), zoom: fxNow.zoom, bars: fxNow.bars, grade: (fight?.cols || meta?.pal || []).slice(), blink: !!body?.s.hide,
      low: !!fight?.feel.low, beats: fight?.feel.beats ?? 0
    }
  };
};
let lookWas = false;
window.__gloam = {
  state: () => ({
    mode, place: meta?.id, x: body?.s.x, y: body?.s.y, z: body?.s.z, ground: body?.s.ground, yaw: body?.s.yaw,
    wisps: meta ? (RUN ? runner?.wisps.size ?? 0 : save.wisps[meta.id]?.length || 0) : 0, lit: beaconLit, frames, art: { ...art }, target: artTarget, count: world?.count,
    reached: save.reached.slice(),
    // pitch is the player's; view is what is drawn (with the rise over walls), want the layout's distance, foe the combat camera's
    cam: cam ? { yaw: cam.c.yaw, dist: cam.c.dist, pitch: cam.c.pitch, want: cam.c.want, fov: cam.c.fov, aim: cam.c.aim, lift: cam.c.lift, view: view ? view.pitch : null, foe: combat?.foe?.id ?? null, turning: cam.c.turning } : null
  }),
  // in a run, go(id) moves the run to the start of a place as Walk on does: the entry snapshot is taken from the values now
  go: id => { if (RUN && rs.run) { goTo(rs, id); storeRun(); } return go(id); },
  // y, when given, puts the feet at that height (under the map, a test can drop the lamplighter into a fall)
  teleport: (x, z, yaw, y) => { body.place([x, y ?? walk.top(x, z) + 0.5, z], yaw); cam.snap(body.s, (yaw ?? body.s.yaw) + Math.PI); },
  wisp: i => { if (!RUN) return takeWisp(i); const ev = []; runner.take(i, ev); ev.forEach(runEvent); },
  // in a run, light() acts as a touch on the beacon, so it obeys the run's rules
  light: () => (RUN ? runner.light([]).forEach(runEvent) : lightBeacon()),
  points: () => (meta ? { spawn: meta.spawn, beacon: meta.beacon.p, wisps: meta.wisps.map(w => w.p) } : null),
  close: () => closePanels(),
  /* ?test only: step the game by `seconds` at 60 steps a second with these held (mx, mz, jump, slow, ox, attack, roll, heal, look),
     then draw once if asked. With held 'live' it reads the real keys, pointer, touch and gamepad on every step, in every mode */
  tick: (seconds, held = {}, drawAfter = false) => {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) {
      if (held === 'live') { pollPad(STEP); if (mode !== 'loading') inp.read(); }
      else {
        Object.assign(input, { mx: 0, mz: 0, jump: false, slow: false, ox: 0, oy: 0, attack: false, roll: false, heal: false }, held);
        if (held.look && !lookWas && mode === 'play') face();
        lookWas = !!held.look;
      }
      if (place && mode !== 'loading') { update(); inp.consumed(); }
    }
    if (drawAfter) draw();
    return window.__gloam.state();
  },
  // draw({ time, pool }): at game time `time` (the same picture each time), with every foe parked for this draw when pool is false
  draw: (o = {}) => { draw(o || {}); return frames; },
  // ?test: frame the camera as a window of w x h would (camLayout), or with { fov, dist, pitch, aim } given; null puts this window's back
  layout: (o = null) => {
    cam.layout(o ? (o.w ? camLayout(o.w, o.h) : o) : layoutNow());
    cam.snap(body.s, cam.c.yaw);
    view = null;
    return window.__gloam.state().cam;
  },
  // draw, then read the picture back before the browser shows it: mean luminance (0..1), the share over 0.55, and how many colours
  stats: () => {
    draw();
    const gl = canvas.getContext('webgl2'), w = canvas.width, h = canvas.height, px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, bright = 0;
    const colours = new Set();
    for (let i = 0; i < w * h; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sum += y;
      if (y > 0.55) bright++;
      if (colours.size < 200) colours.add((r << 16) | (g << 8) | b);
    }
    return { w, h, mean: sum / (w * h), bright: bright / (w * h), colours: colours.size };
  },
  ready: () => mode !== 'loading' && !!place,
  /* the run's hooks (?run): run() reads the run, set() changes the values now and never the entry snapshot, fx() turns effects
     on and off, sounds() is the log of cues with their game and play steps, post() stands a training post (clearPosts() takes them
     all away), project() maps a world point to the screen */
  run: () => (RUN ? runState() : null),
  set: (o = {}) => {
    if (!RUN) return null;
    if (Number.isFinite(o.bank)) rs.bank = Math.max(0, Math.round(o.bank));
    if (o.up) for (const k of Object.keys(rs.up)) if (Number.isInteger(o.up[k])) rs.up[k] = Math.max(0, o.up[k]);
    const run = rs.run;
    if (run) {
      if (Array.isArray(o.wicks)) run.wicks = [...new Set(o.wicks.filter(w => WICKS.some(x => x.id === w)))];
      if (Number.isFinite(o.hp)) run.hp = Math.max(1, Math.min(maxOf(rs), Math.round(o.hp)));
      if (Number.isFinite(o.flasks)) run.flasks = Math.max(0, Math.min(flasksOf(rs), Math.round(o.flasks)));
      if (Number.isFinite(o.carried)) run.carried = Math.max(0, Math.round(o.carried));
    }
    // o.bossHp is stage 3's (the boss fight)
    updateHud();
    storeRun();
    return runState();
  },
  fx: (flags = {}) => { for (const k of ['stop', 'flash', 'kick', 'zoom', 'grade', 'shake']) if (k in flags) fx[k] = !!flags[k]; return { ...fx }; },
  sounds: () => cues.map(c => ({ ...c })),
  // the post stands on the floor met from the lamplighter's height (under an arch or a roof that is the floor under it, not its top)
  post: (x, z, o = {}) => { const p = makePost(walk, x, z, { id: `post${posts.length + 1}`, y: body.s.y, ...o }); posts.push(p); return p.id; },
  posts: () => posts.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, r: p.r, alive: p.alive, taken: p.taken, hits: p.hits.map(h => ({ dmg: h.dmg, kind: h.kind })) })),
  // the place's 48 colours, as 0xRRGGBB
  palette: () => (meta ? meta.pal.slice() : null),
  // take every training post away (a test that needs one post alone)
  clearPosts: () => { const n = posts.length; posts.length = 0; return n; },
  // a hit on the lamplighter, as a foe's would land (stage 2's foes call runner.hurt the same way)
  hurt: (dmg, from, o = {}) => {
    const ev = [], r = runner.hurt(dmg, from ?? [body.s.x + Math.sin(body.s.yaw), body.s.z + Math.cos(body.s.yaw)], o, ev);
    ev.forEach(runEvent);
    return r;
  },
  project,
  // stage 2 hands the page its foes as targets
  setTargets: fn => { foeTargets = fn; },
  /* the foes (?run): foes() lists each awake foe (id, type, zone, x, y, z, hp, move, t, flash, shake); wake(zone) wakes a zone in free
     slots; spawn(type, x, z, yaw) wakes one foe at once in a free slot; hold(foe, move, t) keeps a foe at t s of a move, and
     hold(foe, null) lets it go; out(foe | zone) puts foes out as a death does; notches() lists the ember notches on screen;
     combat() is what the cameras read: the awake foes and the blade's target */
  foes: () => (fight ? fight.list() : []),
  wake: id => (fight ? fight.hooks.wake(id) : { ok: false, why: 'no fight' }),
  spawn: (type, x, z, yaw = 0) => (fight ? fight.hooks.spawn(type, x, z, yaw) : { ok: false, why: 'no fight' }),
  hold: (foe, move, t = 0) => fight?.hooks.hold(foe, move, t) ?? null,
  out: q => { if (!fight) return { ok: false }; const r = fight.hooks.out(q); updateHud(); return r; },
  notches: () => (fight ? fight.showNotches(view || cam.follow(body.s, 0, input), mode === 'play').map(n => ({ kind: n.kind, foe: n.foe, edge: n.edge, x: n.x, y: n.y, fill: n.fill, bearing: n.bearing, rect: { ...n.rect } })) : []),
  combat: fightView,
  // ?run: the pool's slots, and (with ?test&lineup) one of each figure stood in a row in front of the lamplighter
  pool: () => pool && { count: world.count, boned: world.anim.boned.length, extra: pool.extra.end - pool.extra.first, slots: pool.slots.map(s => ({ i: s.i, code: s.code, awake: s.awake, first: s.first, end: s.end, base: s.base, at: s.at })) },
  lineup: (o = {}) => { const r = lineup(pool, walk, { x: body.s.x, z: body.s.z, yaw: body.s.yaw }, o); if (o.draw) draw(); return r; },
  // one slot: { clip, t } poses it where it stands, { flash: true | false } and { park: true } as the run will
  slot: (i, o = {}) => {
    const s = pool.slots[i];
    if (o.park) pool.park(s);
    else {
      if (o.clip) pool.pose(s, s.at, o.clip, o.t || 0);
      if (o.flash !== undefined) pool.flash(s, o.flash);
    }
    if (o.draw) draw();
    return { i, awake: s.awake, flash: s.flash };
  }
};

(async () => {
  sizeArt();
  try {
    renderer = createRenderer(canvas, { toolkit: { PixelLook } });
  } catch (err) {
    loadLine.textContent = 'Gloam Downs needs WebGL 2, and this browser does not have it. Try a recent Chrome, Firefox or Safari.';
    return;
  }
  // the places are gzipped, and world.js unzips them with DecompressionStream
  if (typeof DecompressionStream !== 'function') {
    loadLine.textContent = 'Gloam Downs needs a newer browser to unpack its places. Try Safari 16.4, Firefox 113, Chrome 80 or later.';
    return;
  }
  requestAnimationFrame(frame);
  if (RUN) {
    // a reload in a run restarts its place: health and flasks no higher than they were, the glim carried and the foes as they entered
    if (rs.run) reload(rs.run);
    return go(rs.run?.place || ORDER[0]);
  }
  const start = q.get('place');
  await go(ORDER.includes(start) && save.reached.includes(start) ? start : save.at || 'gaol');
})();
