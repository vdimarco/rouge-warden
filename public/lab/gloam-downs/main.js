// Gloam Downs: the page. It loads a baked place, draws it with Ink Studio's own WebGL renderer, and walks the lamplighter through it.
// Everything here is the frame loop, the HUD and the dialogs; the inputs are in input.js and cards.js, the rules of movement in
// play.js, and a run's rules and moves in run.js and moves.js. With ?run the page plays the combat run (behind a flag while it is
// built); without it, it is the explorer.
/* global PixelLook */
import { createRenderer } from './ink/webgl/renderer.mjs';
import { makeCamera as viewCamera } from './ink/webgl/view.mjs';
import { loadPlace } from './world.js';
import { makeWalk, makeBody, makeCamera, camLayout, pose, touches, atBeacon, autoTurn, PARAMS, makeFade, fadeOf, eyeOf } from './play.js';
import { makeCombat, makeMoveLock, asFoes, makeBossCam, yawDiff } from './cameras.js';
import { ORDER, load, store, wispCount, fresh } from './save.js';
import * as RS from './run-save.js';
import { STEP, stepCount, startRun, reload, goTo, chooseWick, buy, maxOf, flasksOf, makeRunner, newSeed, WICKS } from './run.js';
import { nearest, faceYaw, makePost, HITS, clearLine } from './moves.js';
import { NUMERAL, NAMES, fmt, stepsOf, INK, inkAt, TIMED, hudOf, wickLine, wickName, upgradeRows, lampButtons, summaryOf, winOf, routeOf, ASKS, cardOnLoad } from './screens.js';
import { makeInput, navStep, readPads, heldNav } from './input.js';
import * as cards from './cards.js';
import { makePool } from './pool.js';
import { figures, poolFor, lineup, LINEUP } from './figures.js';
import { findVeils, makeVeils, findOccluders, makeOccluders, VEIL } from './veil.js';
import { makeCut, CUT } from './cut.js';
import { makeFight, SPARKS } from './fight.js';
import { REEVE, REEVE_TEXT } from './boss.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), loading = $('loading'), loadLine = $('loadLine'), barFill = $('barFill'), bar = $('bar');
const q = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
let cut = null, lampFade = null, pendingRows = new Set(), fogNear = 10, beaconLit = false, arriveTimer = 0, toastTimer = 0, slowFor = 0, pool = null, slots = null, veils = null, occluders = null;
const intervals = [];
// the run: the sound cues logged across places, the effects' flags (each can be turned off with __gloam.fx), what the effects give
// this frame, training posts (?test), the fight in this place (fight.js) and the foes' targets
const cues = [];
const fx = { stop: true, flash: true, kick: true, zoom: true, grade: true, shake: true, trail: true };
const fxNow = { kick: [0, 0, 0], zoom: 1, bars: 0 };
const posts = [];
let foeTargets = () => [], fight = null;
let sinceStore = 0, endAt = 0;
/* the boss files: they load during The Bell Knoll, or after play starts in Barrow Crown, and stay. bossFile once they are in, bossLoad
   while they come, bossFail when they did not; bossWaiting while the game waits for them at 11 m from the arena. lastFar is the last
   point of the lamplighter's path 13 m or more from the arena's centre, where Step back puts it */
let bossFile = null, bossLoad = null, bossFail = null, bossWaiting = false, bossCam = null, lastFar = null;
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
const fightView = () => (fight ? { foes: fight.foes.awake(), target: fight.foes.target(), boss: fight.boss?.fighting() ? fight.boss.camView() : null } : { foes: [], target: null });
/* what the combat camera turns toward: the training posts (?test), and the awake foes of the fight (or, with no fight, the targets that
   a test hands the page with setTargets). A foe at home, walking home or sinking is never its foe. Outside the arena, within 16 m
   of its centre, the boss is its foe at any distance while the fight has started and the boss is up */
const awake = () => [
  ...asFoes(posts.filter(p => p.alive)),
  ...(fight ? fightView().foes.map(f => ({ id: f.id, x: f.x, y: f.y, z: f.z, home: f.home || f.homing || f.state === 'sink' })) : asFoes(foeTargets())),
  ...(fight && body ? fight.bossFoe(body.s) : [])
];
// in a run, the camera's turn hook: in the boss fight the boss camera's turn goes before the combat camera's
const runTurn = (c, s, dt, looked) => (bossCam ? bossCam.turn(c, s, dt, looked) : false) || (combat ? combat.turn(c, s, dt, looked) : false);
// in the boss intro the view turns toward the boss (no faster than the boss camera, and not with reduced motion); look input wins, and
// as for the run's cameras it never turns while the mouse is taken or a move across the view is held (play.js autoTurn)
const introTurn = (c, s, dt, looked) => {
  const B = fight?.boss;
  if (still || looked || !B || !autoTurn({ ...c, auto: true }, 0)) return true;
  const d = yawDiff(c.yaw, s, B), stop = 10 * Math.PI / 180;
  if (Math.abs(d) > stop) { c.yaw += Math.sign(d) * Math.min(1.5 * dt, Math.abs(d) - stop); c.turning = true; }
  return true;
};

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
addEventListener('resize', () => { sizeArt(); if (cam) cam.layout(layoutNow()); placeBossBar(); measureScreen(); });

/* ---------------- input ---------------- */
const jumpBtn = $('bJump'), stickEl = $('stick'), actBtns = [$('bAttack'), $('bRoll'), $('bHeal')];
/* the mouse: taken by a click on the view (input.js). Freed in play in a run, by Escape or by the browser, it opens the pause panel. A
   card that opens frees it, so its buttons can be clicked, and a button that goes back to play takes it again (the click is the
   gesture the browser asks for) */
const inp = makeInput({ canvas, stick: stickEl, jump: jumpBtn, attack: $('bAttack'), roll: $('bRoll'), heal: $('bHeal') }, {
  run: () => RUN, play: () => mode === 'play', fine: !coarse,
  onLock: (taken, ours) => { if (!taken && !ours && RUN && mode === 'play' && rs.run) openPause(); mouseHint(); }
});
// a button that goes back to play takes the mouse again, when the press is a gesture the browser counts (not a gamepad's A)
const retake = () => { if (navigator.userActivation ? navigator.userActivation.isActive : true) inp.take(); mouseHint(); };
/* "Click to look with the mouse": over the view in play while the mouse is not taken, on a desktop that can take it. Just after the
   browser refused it (a click on Resume too soon after Escape), "Click again to look with the mouse" */
const hintEl = $('mouseHint');
function mouseHint() {
  const on = mode === 'play' && !!place && inp.canLock && !inp.locked;
  if (hintEl.hidden === on) hintEl.hidden = !on;
  const text = inp.waiting ? 'Click again to look with the mouse' : 'Click to look with the mouse';
  if (on && hintEl.textContent !== text) hintEl.textContent = text;
}
const input = inp.input;
const typing = e => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
addEventListener('keydown', e => {
  if (typing(e) || window.GameSwitch?.isOpen) return;
  const k = e.key.toLowerCase();
  // the Escape that frees the mouse has opened the pause panel already: it does not also close it
  if (k === 'escape') { if (performance.now() - inp.lostAt < 400) return; if (mode === 'play') { if (RUN) openPause(); else inp.free(); } else back(); return; }
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
function showCard(card) { holdNav(); inp.free(); mouseHint(); return cards.show(card); }
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
/* the boss bar: in the Lab bar row, between ◀ Lab and Games. On a touch screen it runs from 8 px right of ◀ Lab to 8 px left of Games,
   at most 360 px wide; with a fine pointer it is centred between them, at most 520 px. It hides while a card shows (index.html) */
function placeBossBar() {
  const el = $('bossBar');
  if (!RUN || el.hidden) return;
  const a = document.querySelector('.labbar .back').getBoundingClientRect(), g = $('menu').getBoundingClientRect();
  const left = a.right + 8, room = g.left - 8 - left, w = Math.max(0, Math.min(coarse ? 360 : 520, room));
  el.style.width = `${w}px`;
  el.style.left = `${coarse ? left : left + (room - w) / 2}px`;
}
function fillBossBar() {
  const B = fight?.boss;
  if (B) $('bossFill').style.width = `${((B.hp / B.max) * 100).toFixed(1)}%`;
}
function bossBar(on) {
  if (!RUN) return;
  $('bossBar').hidden = !on;
  // in the boss fight the hint hides, so the HUD fits the rects the boss camera keeps clear
  hud.classList.toggle('boss', on);
  placeBossBar();
  fillBossBar();
  measureScreen();
}
/* what the boss camera keeps clear: the screen, the Lab bar row's bottom, and the rects of the HUD, the tools and the touch buttons as
   the page lays them out (in each of the five layouts they lie inside the spec's rects of "The HUD in the boss fight") */
const bossScreen = { w: 1280, h: 720, bar: 52, rects: [] };
function measureScreen() {
  bossScreen.w = innerWidth;
  bossScreen.h = innerHeight;
  bossScreen.bar = $('menu').getBoundingClientRect().bottom || 52;
  bossScreen.rects = [hud, tools, jumpBtn, ...actBtns].filter(el => !el.hidden).map(el => el.getBoundingClientRect()).filter(r => r.width > 0).map(r => [r.left, r.top, r.width, r.height]);
}
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
// the run's HUD: the health bar with its number and a pip for each flask, then the wisps of this place and the glim carried
function updateRunHud() {
  const h = hudOf(rs, runner?.wisps.size || 0);
  $('where').textContent = meta.name;
  $('life').hidden = !h;
  hud.classList.toggle('low', !!h?.low);
  $('count').hidden = !h;
  $('hint').hidden = !h;
  $('hint').textContent = beaconLit ? 'The beacon burns.' : 'Put out the keepers, then light the beacon.';
  if (!h) return;
  $('hpN').textContent = h.text;
  $('hpFill').style.width = `${(h.share * 100).toFixed(1)}%`;
  const pips = $('pips');
  while (pips.children.length < h.pips.length) pips.appendChild(document.createElement('i'));
  while (pips.children.length > h.pips.length) pips.lastChild.remove();
  h.pips.forEach((on, i) => pips.children[i].classList.toggle('on', on));
  $('life').setAttribute('aria-label', `Health ${h.text}, ${h.pips.filter(Boolean).length} of ${h.pips.length} flasks`);
  $('count').innerHTML = `<b>◆ ${h.wisps}/5</b> wisps · <em>● ${h.glim}</em> glim`;
  $('healN').textContent = String(Math.min(5, rs.run.flasks));
}
// in a run the toast sits 8 px under the HUD's measured bottom, at every width, and again whenever the HUD changes size
function placeToast() {
  if (!RUN || hud.hidden) return;
  const r = hud.getBoundingClientRect();
  if (r.height > 0) document.body.style.setProperty('--toastTop', `${Math.ceil(r.bottom + 8)}px`);
}
if (RUN) { if ('ResizeObserver' in window) new ResizeObserver(placeToast).observe(hud); addEventListener('resize', placeToast); }
// in a run a toast and the arrival card last whole steps of the game clock (screensTick), so they wait while a card shows
let toastLeft = 0, arriveLeft = 0;
function toast(html, ms = 1800) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.add('on');
  clearTimeout(toastTimer);
  if (RUN) { placeToast(); toastLeft = stepsOf(ms); } else toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}
function arrive() {
  const i = ORDER.indexOf(meta.id);
  $('arriveN').textContent = `${NUMERAL[i]} · ${['The first place', 'The second place', 'The third place', 'The fourth place', 'The last place'][i]}`;
  $('arriveName').textContent = meta.name;
  $('arriveSub').textContent = meta.sub || '';
  const a = $('arrive');
  a.classList.remove('off');
  clearTimeout(arriveTimer);
  if (RUN) arriveLeft = stepsOf(still ? 2400 : 3200);
  else arriveTimer = setTimeout(() => a.classList.add('off'), still ? 2400 : 3200);
}
// the boss intro's card: three lines, for the 2.4 s of the intro
function arriveBoss() {
  const [n, name, sub] = REEVE_TEXT.card;
  $('arriveN').textContent = n;
  $('arriveName').textContent = name;
  $('arriveSub').textContent = sub;
  toastLeft = 0;
  $('toast').classList.remove('on');
  $('arrive').classList.remove('off');
  arriveLeft = REEVE.intro;
}
// the controls for the input in use: the pad once the page has seen one, else touch on a touch screen, else the keys and the mouse
const CONTROLS = {
  keys: ['Click the view to take the mouse. Move the mouse to look. Left click attacks, right click rolls. <kbd>Esc</kbd> frees the mouse.',
    '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrows move. <kbd>Shift</kbd> walks. <kbd>Space</kbd> jumps.',
    '<kbd>J</kbd> or <kbd>Z</kbd> also attacks. Press again, or hold, for the string of three.',
    '<kbd>K</kbd> or <kbd>X</kbd> rolls. <kbd>L</kbd> or <kbd>C</kbd> drinks a flask.',
    '<kbd>Q</kbd> <kbd>E</kbd> also turn the view. <kbd>R</kbd> faces the nearest foe.',
    '<kbd>M</kbd>, <kbd>P</kbd> or <kbd>Esc</kbd> pauses.'],
  // a browser that cannot take the mouse
  drag: ['Hold the right button and drag the view to look. Left click attacks.',
    '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrows move. <kbd>Shift</kbd> walks. <kbd>Space</kbd> jumps.',
    '<kbd>J</kbd> or <kbd>Z</kbd> also attacks. Press again, or hold, for the string of three.',
    '<kbd>K</kbd> or <kbd>X</kbd> rolls. <kbd>L</kbd> or <kbd>C</kbd> drinks a flask.',
    '<kbd>Q</kbd> <kbd>E</kbd> also turn the view. <kbd>R</kbd> faces the nearest foe.',
    '<kbd>M</kbd>, <kbd>P</kbd> or <kbd>Esc</kbd> pauses.'],
  touch: ['Drag on the left half to move, and on the right half to look.', 'ATTACK swings: tap it, or hold it for the string of three.',
    'ROLL rolls, HEAL drinks a flask and JUMP jumps.', 'Look faces the nearest foe. Pause stops the run.'],
  pad: ['Left stick: move. A light tilt walks. Right stick: look.', '<kbd>A</kbd> jump · <kbd>X</kbd> attack · <kbd>B</kbd> roll · <kbd>Y</kbd> heal',
    '<kbd>RB</kbd> face the foe · <kbd>Start</kbd> pause']
};
const controlsKind = () => (padSeen ? 'pad' : coarse ? 'touch' : inp.canLock ? 'keys' : 'drag');
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
  if (was && mode !== 'loading') { mode = 'play'; inp.swallowAll(); canvas.focus?.(); retake(); }
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

/* ---------------- the run's cards ----------------
   The help card, the beacon card (the wick choice, then Spend glim and Walk on), the Lamp-room, the pause panel and the run summary;
   screens.js gives what each shows. In a run a press outside a card's box does nothing, but on the pause panel, where it resumes. B
   and Escape go back where a card has a back action: Resume, No, Back to the beacon and Back to Wander. Before a wick is chosen, only
   a wick button closes the beacon card */
let asking = null, placeFresh = true, deadAt = -1;
const storeRun = () => { sinceStore = 0; return RS.store(disk, rs); };
function openCard(id, m, main, backFn = null) {
  $(id).hidden = false;
  mode = m;
  padCheck();
  showControls();
  showCard({ el: $(id), main, back: backFn });
}
function hideCard(id) { $(id).hidden = true; cards.shut($(id)); }
function closeCard(id) {
  hideCard(id);
  mode = 'play';
  inp.swallowAll();
  canvas.focus?.();
  retake();
}
function openRunHelp() { openCard('runHelp', 'help', () => $('bBegin')); }
// a new run starts in the Gaol: on the place as it loaded, or on the Gaol loaded again once this place has been played
function beginRun(card) {
  rs.seen = true;
  startRun(rs, seed());
  storeRun();
  closeCard(card);
  if (meta.id !== rs.run.place || !placeFresh) return go(rs.run.place);
  newRunner();
  updateHud();
}
$('bBegin').addEventListener('click', () => beginRun('runHelp'));
const seed = () => (q.has('seed') ? Number(q.get('seed')) >>> 0 || 1 : newSeed(rs.runs));

// the pause panel: the run's places, its time, Resume, the sound switch (stage 3 makes the sound), Back to the start and End the run
function openPause() {
  if (!rs.run) return;
  asking = null;
  $('route').innerHTML = routeOf(rs.run.place).map(p => `<li class="${p.state}"><span>${p.n}</span> ${p.name}<em>${p.state === 'here' ? 'now' : p.state}</em></li>`).join('');
  $('pauseLine').textContent = `Run time ${fmt(rs.run.time)}`;
  soundLabel();
  $('pauseRow').hidden = false;
  $('askRow').hidden = true;
  openCard('pause', 'pause', () => (asking ? $('bNo') : $('bResume')), () => (asking ? no() : resume()));
}
function resume() { asking = null; closeCard('pause'); }
function no() { asking = null; $('askRow').hidden = true; $('pauseRow').hidden = false; cards.focusMain(); }
// End the run and Back to the start ask again first; while they ask, Escape and B choose No
function ask(kind) {
  asking = kind;
  $('askLine').textContent = ASKS[kind].line(rs.run.place);
  $('bYes').textContent = ASKS[kind].yes;
  $('pauseRow').hidden = true;
  $('askRow').hidden = false;
  cards.focusMain();
}
function soundLabel() { $('bSound').textContent = rs.sound ? 'Sound on' : 'Sound off'; $('bSound').setAttribute('aria-pressed', String(rs.sound)); }
$('bResume').addEventListener('click', resume);
$('bSound').addEventListener('click', () => { rs.sound = !rs.sound; storeRun(); soundLabel(); });
$('bEnd').addEventListener('click', () => ask('end'));
$('bRestart').addEventListener('click', () => ask('restart'));
$('bNo').addEventListener('click', no);
$('bYes').addEventListener('click', () => {
  const kind = asking;
  asking = null;
  hideCard('pause');
  // Back to the start restarts the place as a reload does: health and flasks no higher than at its start, its glim and foes back
  if (kind === 'restart') { reload(rs.run); storeRun(); retake(); go(rs.run.place); return; }
  // End the run ends it as a death does
  mode = 'play';
  for (const e of runner.kill([])) runEvent(e);
});
$('pause').addEventListener('pointerdown', e => { if (e.target === $('pause') && !asking) resume(); });

// the beacon card: two wicks to choose from, then Spend glim (the Lamp-room) and Walk on. Its offer is in the save, so a reload before
// the choice shows the same two wicks over the next place
function openBeacon() {
  const run = rs.run, offer = run.offer, box = $('wicks');
  box.textContent = '';
  for (const id of offer || []) {
    const b = document.createElement('button'), name = document.createElement('b');
    b.type = 'button';
    b.className = 'wick';
    b.dataset.wick = id;
    name.textContent = wickName(id);
    b.append(name, wickLine(id).slice(name.textContent.length));
    b.addEventListener('click', () => {
      if (!rs.run?.offer || !chooseWick(rs, id)) return;
      storeRun();
      updateHud();
      openBeacon();
    });
    box.appendChild(b);
  }
  $('beaconLine').textContent = offer ? 'Choose a wick. It burns for the rest of the run.' : `${wickName(run.wicks.at(-1))} burns in the lamp.`;
  $('beaconBank').innerHTML = `Banked: <b class="bank">${rs.bank} glim</b>. Spend it in the Lamp-room, or walk on.`;
  $('beaconBank').hidden = $('beaconRow').hidden = !!offer;
  // before the wick is chosen only a wick button closes the card: it has no back action
  openCard('beaconCard', 'beacon', () => (rs.run?.offer ? box.querySelector('button') : $('bWalkOn')));
}
// Walk on loads the next place; after a reload at the card, the card already shows over it
$('bWalkOn').addEventListener('click', () => { if (meta.id === rs.run.place) return closeCard('beaconCard'); hideCard('beaconCard'); retake(); go(rs.run.place); });
$('bSpend').addEventListener('click', () => { hideCard('beaconCard'); openLamp('beacon'); });

/* the Lamp-room: the bank, the five lasting upgrades with Buy, and Begin the run. From a beacon card it shows Back to the beacon in
   place of Begin the run and Wander; with a run in progress, Go on with the run. A buy stores the run at once */
const LAMP = { back: 'bLampBack', begin: 'bLampBegin', goon: 'bLampGoOn', wander: 'bLampWander', toWander: 'bLampToWander' };
// Wander opens after the first win, or for a player whose explorer save shows a finished walk (Wander itself is built behind ?wander)
const wanderOpen = () => rs.wins > 0 || save.done >= 1;
const toWander = () => location.assign('./?wander');
function openLamp(from = null) {
  const b = lampButtons(rs, from, wanderOpen());
  for (const [k, id] of Object.entries(LAMP)) $(id).hidden = !b.list.includes(k);
  fillLamp();
  openCard('lamp', 'lamp', () => $(LAMP[b.main]), b.back ? () => $(LAMP[b.back]).click() : null);
}
function fillLamp() {
  $('lampLine').innerHTML = `Banked: <b class="bank">${rs.bank} glim</b>. What you buy here lasts for every run.`;
  const list = $('ups');
  for (const row of upgradeRows(rs)) {
    let li = list.querySelector(`li[data-up="${row.id}"]`);
    if (!li) {
      li = document.createElement('li');
      li.dataset.up = row.id;
      li.innerHTML = '<span></span><b class="lv"></b><button type="button"></button>';
      li.querySelector('button').addEventListener('click', () => buyUp(row.id));
      list.appendChild(li);
    }
    li.classList.toggle('top', row.top);
    li.querySelector('span').textContent = row.label;
    const lv = li.querySelector('.lv');
    lv.innerHTML = Array.from({ length: row.max }, (_, i) => `<i${i < row.lvl ? ' class="on"' : ''}></i>`).join('');
    lv.setAttribute('aria-label', `level ${row.lvl} of ${row.max}`);
    const btn = li.querySelector('button');
    btn.hidden = row.top;
    btn.textContent = row.buy || '';
    btn.setAttribute('aria-disabled', String(!!row.need));
    btn.setAttribute('aria-label', row.need ? `${row.label}: ${row.need} more glim needed` : `Buy ${row.label}`);
  }
}
function buyUp(id) {
  const btn = $('ups').querySelector(`li[data-up="${id}"] button`), had = document.activeElement === btn;
  if (!buy(rs, id)) return;
  storeRun();
  fillLamp();
  updateHud();
  // at its top level a row has no Buy button: the focus goes on to the next Buy button, or to the main button
  if (had && btn.hidden) {
    const all = [...$('ups').querySelectorAll('li')].map(li => li.querySelector('button')), at = all.indexOf(btn);
    const next = [...all.slice(at + 1), ...all.slice(0, at)].find(b => !b.hidden);
    next ? next.focus({ preventScroll: true }) : cards.focusMain();
  }
}
$('bLampBack').addEventListener('click', () => { hideCard('lamp'); openBeacon(); });
$('bLampBegin').addEventListener('click', () => beginRun('lamp'));
// Go on with the run goes on as a reload does, at the start of the run's place
$('bLampGoOn').addEventListener('click', () => { reload(rs.run); storeRun(); hideCard('lamp'); retake(); go(rs.run.place); });
$('bLampWander').addEventListener('click', toWander);
$('bLampToWander').addEventListener('click', toWander);

// the run summary: the place reached, the time, the foes put out, the glim lost and banked. Closing it clears the ended run, and the
// Lamp-room follows over the Gaol, where the next run starts with every foe back
function openSummary() {
  const s = summaryOf(rs.ended), dds = $('summary').querySelectorAll('dd');
  $('sumT').textContent = s.title;
  s.rows.forEach(([, v], i) => { dds[i].textContent = v; });
  openCard('summary', 'ended', () => $('bSumLamp'));
}
$('bSumLamp').addEventListener('click', () => {
  rs.ended = null;
  storeRun();
  hideCard('summary');
  go(ORDER[0]);
});
/* the win card: the time, the best winning time, the glim banked in this run, the runs and the deaths. It opens the Lamp-room, where
   Wander shows from the first win, or Wander. The win is stored already, so a reload before it closes shows it again */
function openWin() {
  const w = winOf(rs), dds = $('winCard').querySelectorAll('dd');
  w.rows.forEach(([, v], i) => { dds[i].textContent = v; });
  $('bWinWander').hidden = !wanderOpen();
  openCard('winCard', 'ended', () => $('bWinLamp'));
}
$('bWinLamp').addEventListener('click', () => {
  rs.ended = null;
  storeRun();
  hideCard('winCard');
  go(ORDER[0]);
});
$('bWinWander').addEventListener('click', () => { rs.ended = null; storeRun(); toWander(); });
// the card that a load of the page opens over the place (screens.js cardOnLoad)
function openOnLoad() {
  const card = cardOnLoad(rs);
  if (card === 'win') openWin();
  else if (card === 'summary') openSummary();
  else if (card === 'help') openRunHelp();
  else if (card === 'lamp') openLamp();
  else if (card === 'beacon') openBeacon();
}
// one step of the game clock in a run: the toast and the arrival card count down, and a place that has been played is no longer fresh
function screensTick() {
  if (mode === 'play' && rs.run) placeFresh = false;
  if (toastLeft > 0 && --toastLeft === 0) $('toast').classList.remove('on');
  if (arriveLeft > 0 && --arriveLeft === 0) $('arrive').classList.add('off');
}
// the fade to ink at death: the grade does it when the foes' feel is on (world.anim.grade), the overlay otherwise
const inkNow = () => inkAt(deadAt < 0 ? -1 : steps - deadAt);
const hex = c => `#${(c >>> 0).toString(16).padStart(6, '0')}`;

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
  foeTargets = fight ? () => fight.targets() : () => [];
  runner = makeRunner({
    walk, meta, body, rs, targets, still, log: cues, fx,
    ...(fight ? { lightable: fight.lightable, drop: fight.foes.drop, think: fight.think, onLight: fight.foes.bank } : {})
  });
  fight?.bind(runner);
  /* the boss camera (cameras.js), at Barrow Crown: on within 7.0 m of the arena's centre while the fight has started and the boss is
     up, framing the two with the page's own controls kept clear; its step goes after the follow camera's */
  const f = fight;
  bossCam = f?.boss ? makeBossCam(cam, { screen: bossScreen, boss: () => f.boss.camView(), centre: f.boss.c, still, ground: (x, z) => walk.support(x, z, body.s.y + 1) ?? walk.top(x, z),
    sees: (a, b) => clearLine(walk, a[0], a[1], a[2], b[0], b[1], b[2]) }) : null;
  if (bossCam) measureScreen();
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
      // the run clock stops, the win is stored at once (run.js win and the store that follows), and the win card shows 1.8 s later
      beaconLit = true;
      setLit(meta.beacon.fire, true);
      toast('The last beacon burns', 2400);
      endAt = steps + 108;
      mode = 'won';
      break;
    case 'boss': bossEvent(e); break;
    case 'dark': toast(e.why || 'The beacon will not catch yet', 2600); break;
    case 'toast': toast(e.what === 'full' ? 'Health is full' : 'No flask left. A lit beacon fills the flasks.', 2200); break;
    case 'fall': cam.snap(body.s, body.s.yaw + Math.PI); toast('A fall · −10 health'); break;
    // the fade to ink over 72 steps, then the summary; the ended run is already stored
    case 'dead': endAt = steps + INK; deadAt = steps; mode = 'dying'; arriveLeft = 0; $('arrive').classList.add('off'); break;
    case 'store': storeRun(); break;
  }
  if (['wisp', 'drink', 'hurt', 'fall', 'beacon', 'win', 'store', 'glim', 'foeOut'].includes(e.type)) updateHud();
}
/* the boss on the page: the intro stops the game for 2.4 s with its card (the bars and the zoom are fight.js's); then the boss bar
   shows and the fight starts; at the fall the bar goes, and when the light comes to the lantern a toast says where to take it */
function bossEvent(e) {
  switch (e.what) {
    case 'intro': mode = 'intro'; arriveBoss(); break;
    case 'start': if (mode === 'intro') mode = 'play'; bossBar(true); break;
    case 'fall': bossBar(false); break;
    case 'light': toast(REEVE_TEXT.carry, 2600); break;
    case 'hp': fillBossBar(); break;
  }
}

/* ---------------- the boss files ----------------
   They load during The Bell Knoll, or after play starts in Barrow Crown, and the arena sleeps until they are in. At 11 m from the arena
   without them the game waits on the loading screen, with their progress; when they failed, with Try again and Step back. After the
   boss's fall the page never waits for them: the light at the lantern is in the foe files. The Lab bar stays above the loading screen
   in a run (index.html), so ◀ Lab and Games can still be reached */
function fetchBoss() {
  if (bossFile || bossLoad) return;
  bossFail = null;
  bossLoad = figures('./worlds/', 'boss', f => { if (bossWaiting) progress(f); }).then(f => {
    bossFile = f; bossLoad = null;
    if (meta?.id === 'barrows' && fight?.boss) fight.fill(f);
    if (bossWaiting) bossResume();
  }, err => {
    bossLoad = null; bossFail = err;
    if (bossWaiting) bossFailed(err);
  });
}
// each play step at Barrow Crown: the path's last point far from the arena, and the wait at 11 m while the boss files are not in
function bossWatch() {
  const B = fight.boss, s = body.s, d = Math.hypot(s.x - B.c[0], s.z - B.c[2]);
  if (d >= REEVE.arena.back && s.ground) lastFar = { p: [s.x, s.y + 0.3, s.z], yaw: s.yaw };
  if (!B.ready && B.state === 'wait' && !rs.run?.bossDown && d <= REEVE.arena.intro) bossWait();
}
function bossWait() {
  bossWaiting = true;
  mode = 'loading';
  // a pause like any card: the mouse is freed, and taken back when play goes on
  holdNav();
  inp.free();
  mouseHint();
  // the arrival card and a toast count game steps, which wait with the game: they go, so they do not stand over the loading screen
  arriveLeft = toastLeft = 0;
  $('arrive').classList.add('off');
  $('toast').classList.remove('on');
  loading.classList.remove('done');
  $('bRetry').hidden = $('bBack').hidden = true;
  if (bossFail) return bossFailed(bossFail);
  loadLine.textContent = 'The Barrow Reeve is coming…';
  progress(0);
  cards.shut(loading);
  fetchBoss();
}
function bossFailed(err) {
  loadLine.textContent = `The Barrow Reeve did not load (${err.message}).`;
  const r = $('bRetry'), b = $('bBack');
  r.hidden = b.hidden = false;
  r.onclick = () => { bossFail = null; bossWait(); };
  b.onclick = stepBack;
  // Try again takes the focus; B on a pad and Escape are Step back
  showCard({ el: loading, main: () => r, back: stepBack });
  padCheck();
}
function bossResume() {
  bossWaiting = false;
  cards.shut(loading);
  $('bRetry').hidden = $('bBack').hidden = true;
  progress(1);
  loading.classList.add('done');
  mode = 'play';
  inp.swallowAll();
  canvas.focus?.();
  retake();
}
// Step back: to the last point of the path 13 m or more from the arena's centre (or the place's start when there is none); the arena
// stays asleep, and the next time within 11 m the loading screen shows again
function stepBack() {
  const to = lastFar || { p: meta.spawn.p, yaw: meta.spawn.yaw };
  body.place(to.p, to.yaw);
  cam.snap(body.s, to.yaw + Math.PI);
  bossResume();
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
      const foes = await figures('./worlds/', 'foes'), boss = LOOK ? await figures('./worlds/', 'boss') : bossFile;
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
  // a place left with the lamplighter thinned out gets its densities back (a place is loaded once and kept)
  lampFade?.set(0);
  cut?.reset();
  ({ meta, world } = place);
  walk = makeWalk(meta.walk, place.walk);
  // a run's moves drive the body through its own copy of PARAMS
  body = makeBody(walk, meta.spawn, meta.bounds, RUN ? { ...PARAMS } : PARAMS);
  cam = makeCamera(walk, { yaw: meta.spawn.yaw + Math.PI, auto: !still, ...layoutNow() });
  // a run that goes on after the boss's fall starts at the arena, facing the beacon, with the light at the lantern
  const arena = RUN && rs.run?.bossDown ? meta.zones?.find(z => z.boss) : null;
  if (arena) {
    const [x, y0, z] = arena.c, yaw = Math.atan2(meta.beacon.p[0] - x, meta.beacon.p[2] - z);
    body.place([x, (walk.support(x, z, y0 + 2) ?? walk.top(x, z)) + 0.3, z], yaw);
  }
  cam.snap(body.s, body.s.yaw + Math.PI);
  // in a run, the combat camera turns the view toward the foes (cameras.js); reduced motion keeps it still
  combat = RUN ? makeCombat({ foes: awake, still }) : null;
  // a held move keeps its world direction while a camera turns by itself: a run's cameras, and the framed shot's lean (play.js)
  held = makeMoveLock();
  // the fog: the bake set it for a camera 9 back; keep it at the same depths whatever the distance
  fogNear = meta.fog.start * 2 * (meta.fogFar - 9) + 2 * 9 - meta.fogFar;
  // the lamplighter's splats ride bones that the page writes every frame
  const n = meta.bones.names.length;
  world.anim = { bones: new Float32Array(12 * n), boned: Int32Array.from({ length: meta.bones.end - meta.bones.first }, (_, i) => meta.bones.first + i) };
  const placeCount = world.count;
  // its slots parked (at density 0 and off the bones), and the spark pool's splats after them
  pool = RUN ? makePool(world, meta, slots, { extra: LOOK ? 0 : SPARKS }) : null;
  // where the walls bring the eye close, the lamplighter thins out (play.js fadeOf), its blade kept; after the pool, which may give
  // the world a new data array
  lampFade = makeFade(world.data, meta.bones);
  // in a run, the mist and haze sheets that lie in front of an awake figure fade out (veil.js); the beacon and the wisps are left alone
  const pack = c => ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536;
  veils = RUN ? makeVeils(world, findVeils(world, { count: placeCount, skip: [...meta.beacon.fire, ...meta.wisps.map(w => w.ids)], shared: meta.pal.slice(32).map(pack) })) : null;
  // at Barrow Crown in a run, the pieces of scenery round the arena that fade while they hide the boss's marker (veil.js)
  const arenaZone = RUN && !LOOK ? (meta.zones || []).find(z => z.boss) : null;
  occluders = arenaZone ? makeOccluders(world, findOccluders(world, walk, { count: placeCount, skip: [...meta.beacon.fire, ...meta.wisps.map(w => w.ids)],
    shared: meta.pal.slice(32).map(pack), centre: arenaZone.c, r: 20 })) : null;
  // in a nook under a roof the camera stands behind the wall and the splats between are left out (cut.js); the veils, the arena's
  // occluders, the lamplighter, the wisps and the beacon's fire are never cut (veil.js fades those itself)
  const faded = new Set([...(veils?.list || []), ...(occluders?.list || [])].flatMap(v => v.ids ?? [v.i]));
  cut = makeCut(world.data, { count: placeCount, skip: [[meta.bones.first, meta.bones.end], ...meta.beacon.fire, ...meta.wisps.map(w => w.ids)], except: faded.size ? faded : null });
  saved.clear();
  pendingRows = new Set();
  if (RUN) {
    // in a run the place starts again: every wisp is back and the beacon is dark
    beaconLit = false;
    setLit(meta.beacon.fire, false);
    posts.length = 0;
    // the screens start again with the place: no ink, no toast left over, and a place not yet played
    deadAt = -1;
    placeFresh = true;
    toastLeft = 0;
    lastFar = null;
    bossWaiting = false;
    bossBar(false);
    $('toast').classList.remove('on');
    $('ink').style.background = hex(meta.pal?.[0] ?? 0x05060c);
    $('ink').style.opacity = '0';
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
    if (!rs.run && rs.ended?.won && rs.ended.place === id) { beaconLit = true; setLit(meta.beacon.fire, true); }
    openOnLoad();
    storeRun();
    // the boss files come while The Bell Knoll plays, or once play starts in Barrow Crown; never after the boss's fall
    if (!LOOK && rs.run && (id === 'bells' || id === 'barrows') && !rs.run.bossDown) fetchBoss();
  } else if (!save.seen) {
    $('helpKeys').hidden = coarse;
    $('helpMouse').hidden = !inp.canLock;
    $('helpDrag').hidden = inp.canLock;
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
    if (runner && ['play', 'dying', 'won', 'lit', 'intro'].includes(mode)) {
      const play = mode === 'play';
      // while a camera turns by itself, a held move keeps its world direction
      const yaw = play && held ? held.yaw(input, cam.c) : cam.c.yaw;
      for (const e of runner.step(play ? input : {}, yaw)) runEvent(e);
      if (rs.run && ++sinceStore >= 120) storeRun();
      if (mode === 'play' && fight?.boss) bossWatch();
    }
    if (gallery) stepGallery();
    if (runner && TIMED.includes(mode)) screensTick();
    if (endAt && steps >= endAt && ['dying', 'won', 'lit'].includes(mode)) {
      const was = mode;
      endAt = 0;
      mode = 'play';
      if (was === 'lit') openBeacon();
      else if (rs.ended?.won) openWin();
      else openSummary();
    }
  } else if (mode === 'play') {
    save.time += STEP;
    body.step(STEP, input, held.yaw(input, cam.c));
    const s = body.s;
    meta.wisps.forEach((w, i) => { if (!(save.wisps[meta.id] || []).includes(i) && touches(s, w.p)) takeWisp(i); });
    if (!beaconLit && atBeacon(s, meta.beacon)) lightBeacon();
    if (s.y < -25) { body.place(meta.spawn.p, meta.spawn.yaw); cam.snap(body.s, meta.spawn.yaw + Math.PI); toast('Back to the start'); }
  }
  view = cam.follow(body.s, STEP, input, RUN && mode === 'play' ? runTurn : RUN && mode === 'intro' ? introTurn : null);
  if (bossCam) {
    view = bossCam.step(body.s, STEP, view);
    if (bossCam.b.on && steps % 30 === 0) measureScreen();
  }
  input.dyaw = input.dpitch = 0;
  for (const r of lampFade.set(fadeOf(eyeOf(view), body.s))) pendingRows.add(r);
  for (const r of cut.step(view.cut ? eyeOf(view) : null, [body.s.x, body.s.y + CUT.mid, body.s.z], STEP)) pendingRows.add(r);
  if (veils) unveil();
  if (occluders) clearMarker();
}
// the scenery in front of the boss's marker fades out while the marker is laid, seen from where the eye is now
function clearMarker() {
  const B = fight?.boss, pts = B?.fighting() ? B.markPoints() : [];
  if (!pts.length && !occluders.list.some(o => o.k < VEIL.FADE)) return;
  const c = viewCamera(world, { camera: view }, art.w, art.h);
  for (const r of occluders.step(c.view, art.h / 2 / c.tangent, pts)) pendingRows.add(r);
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
    fight.draw(view, { time: Number.isFinite(o.time) ? o.time : undefined, pool: o.pool, art: art.h });
    fxNow.kick = fight.kick; fxNow.zoom = fight.zoom; fxNow.bars = fight.bars;
    fight.showNotches(view, mode === 'play');
  } else if (RUN) { fxNow.kick = [0, 0, 0]; fxNow.zoom = 1; fxNow.bars = 0; world.anim.grade = null; }
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
  if (RUN) $('ink').style.opacity = world.anim.grade ? '0' : String(inkNow());
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
  mouseHint();
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
      kick: fxNow.kick.slice(), zoom: fight ? fight.feel.zoom() : fxNow.zoom, bars: fight ? fight.feel.bars() : fxNow.bars, grade: (fight?.cols || meta?.pal || []).slice(), blink: !!body?.s.hide,
      low: !!fight?.feel.low, beats: fight?.feel.beats ?? 0, tell: fight?.grow ?? 1
    }
  };
};
let lookWas = false;
window.__gloam = {
  state: () => ({
    mode, place: meta?.id, x: body?.s.x, y: body?.s.y, z: body?.s.z, ground: body?.s.ground, yaw: body?.s.yaw,
    // the move the pose shows (moves.js): its id, phase, share of the phase and steps since it began, or null; trails: swing steps
    // that laid a trail (fight.js)
    act: body?.s.act ? { move: body.s.act.move, ph: body.s.act.ph, k: body.s.act.k, t: body.s.act.t } : null, trails: fight?.trails ?? 0,
    wisps: meta ? (RUN ? runner?.wisps.size ?? 0 : save.wisps[meta.id]?.length || 0) : 0, lit: beaconLit, frames, art: { ...art }, target: artTarget, count: world?.count,
    reached: save.reached.slice(),
    // pitch is the player's; view is what is drawn (with the rise over walls), want the layout's distance, foe the combat camera's
    cam: cam ? { yaw: cam.c.yaw, dist: cam.c.dist, pitch: cam.c.pitch, want: cam.c.want, fov: cam.c.fov, aim: cam.c.aim, lift: cam.c.lift, view: view ? view.pitch : null, foe: combat?.foe?.id ?? null, turning: cam.c.turning, idle: cam.c.idle,
      boss: bossCam ? { on: bossCam.b.on, w: bossCam.b.w, dist: view?.dist ?? null, aim: view?.target ?? null } : null } : null,
    // the pieces of scenery faded in front of the boss's marker (veil.js makeOccluders), or null away from Barrow Crown's run
    occluded: occluders ? occluders.faded() : null,
    // the near fade's share now (play.js fadeOf: 0 to 1, or NEAR_FADE.all with the whole figure left out)
    fade: lampFade?.k ?? 0,
    // the cutaway: on (the view stands behind the wall), how many of the place's splats are left out or easing back now, and the
    // view's own distance and pitch (cam.dist is the follow camera's under it)
    cut: { on: !!view?.cut, splats: cut?.size ?? 0, dist: view?.dist ?? null, pitch: view?.pitch ?? null },
    // the mouse: taken now, the page can take it now, the browser refused it a moment ago, the hint shows, and its words
    mouse: { locked: inp.locked, lockable: inp.lockable, waiting: inp.waiting, hint: !hintEl.hidden, text: hintEl.textContent }
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
  // ?test: free the mouse as a card does (no pause panel), so a test can click the tools with the cursor
  release: () => { inp.free(); return inp.locked; },
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
    mouseHint();
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
    // the boss's health: the phase of that health at once, with one hit stop of 9 steps and one stumble of 2 s
    if (Number.isFinite(o.bossHp) && fight?.boss) { fight.hooks.bossHp(o.bossHp); fillBossBar(); }
    updateHud();
    if (mode === 'lamp') fillLamp();
    storeRun();
    return runState();
  },
  fx: (flags = {}) => { for (const k of ['stop', 'flash', 'kick', 'zoom', 'grade', 'shake', 'trail']) if (k in flags) fx[k] = !!flags[k]; return { ...fx }; },
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
  /* the run's screens (?run&test): kill() ends the run as a death does (a test kill); toast(text, ms) shows a toast and gives its
     rect; lamp(from) opens the Lamp-room as from a beacon card ('beacon'), from Wander's Map ('wander') or on its own */
  kill: () => { if (RUN && runner) runner.kill([]).forEach(runEvent); return RUN ? runState() : null; },
  toast: (text, ms = 1800) => { toast(String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]), ms); return $('toast').getBoundingClientRect().toJSON(); },
  lamp: (from = null) => { if (RUN) openLamp(from); return mode; },
  project,
  // stage 2 hands the page its foes as targets
  setTargets: fn => { foeTargets = fn; },
  /* the foes (?run): foes() lists each awake foe (id, type, zone, x, y, z, hp, move, t, flash, shake); wake(zone) wakes a zone in free
     slots; spawn(type, x, z, yaw) wakes one foe at once in a free slot; hold(foe, move, t) keeps a foe at t s of a move, and
     hold(foe, null) lets it go; out(foe | zone) puts foes out as a death does; notches() lists the ember notches on screen;
     combat() is what the cameras read: the awake foes and the blade's target */
  foes: () => (fight ? fight.list() : []),
  /* the boss (?run): its state, phase, health, move and segment, its marker and its light; the boss files (in, loading, failed); the
     boss camera, and the boss bar's rect */
  boss: () => {
    const B = fight?.boss;
    if (!B) return null;
    const bar = $('bossBar');
    return {
      ...B.view(), files: bossFile ? 'in' : bossLoad ? 'loading' : bossFail ? 'failed' : 'none', waiting: bossWaiting,
      cam: bossCam ? { on: bossCam.b.on, w: bossCam.b.w } : null, bar: bar.hidden ? null : bar.getBoundingClientRect().toJSON(),
      lastFar: lastFar ? lastFar.p.slice() : null
    };
  },
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
    // a reload on the win card shows it over the place that was won, with its beacon burning
    return go(rs.run?.place || (rs.ended?.won && ORDER.includes(rs.ended.place) ? rs.ended.place : ORDER[0]));
  }
  const start = q.get('place');
  await go(ORDER.includes(start) && save.reached.includes(start) ? start : save.at || 'gaol');
})();
