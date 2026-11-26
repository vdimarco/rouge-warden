// Gloam Downs: the page. It loads a baked place, draws it with Ink Studio's own WebGL renderer, and walks the lamplighter through it.
// Everything here is the frame loop, the HUD and the dialogs; the inputs are in input.js and cards.js, the rules of movement in
// play.js, and a run's rules and moves in run.js and moves.js. The page plays the combat run by default (also with ?run or #run);
// with ?explore (or ?wander) it is the explorer, with no foes.
/* global PixelLook */
import { createRenderer } from './ink/webgl/renderer.mjs';
import { makeCamera as viewCamera } from './ink/webgl/view.mjs';
import { loadPlace } from './world.js';
import { makeWalk, makeBody, makeCamera, makeBlend, camLayout, pose, touches, atBeacon, autoTurn, PARAMS, makeFade, fadeOf, eyeOf } from './play.js';
import { makeCombat, makeMoveLock, asFoes, makeBossCam, yawDiff, easeTurn, BOSS } from './cameras.js';
import { ORDER, LATTICE, load, store, wispCount, fresh } from './save.js';
import { placeName, nextOf, mapGroups, mapLine, arriveLine, hintOf, startPlace } from './places.js';
import * as RS from './run-save.js';
import { STEP, stepCount, startRun, reload, goTo, chooseWick, buy, maxOf, flasksOf, makeRunner, newSeed, WICKS } from './run.js';
import { nearest, faceYaw, makePost, HITS, hitOf, clearLine } from './moves.js';
import { NUMERAL, NAMES, fmt, stepsOf, INK, inkAt, TIMED, hudOf, wickLine, wickName, upgradeRows, lampButtons, summaryOf, winOf, routeOf, ASKS, cardOnLoad, isRun, modeHref } from './screens.js';
import { makeInput, navStep, readPads, heldNav } from './input.js';
import { makeAbilities, groundAbilities, abilityOf } from './abilities.js';
import { makeKeys, groundSpots, keysLine } from './keys.js';
import { groundPatterns } from './run.js';
import * as cards from './cards.js';
// the builds (relics, unlocks, Ember): builder BC's hooks
import { relicEvent, RELIC_IDS, groundRelics } from './relics.js';
import { dressOf, eliteClip } from './elites.js';
import { UNLOCK_IDS, buyUnlock, setEmber, routeOfRun, emberOf } from './run.js';
import { unlockRows, emberRow, relicMarks, kindleLine, moveLines } from './screens.js';
import { glimLine, keptLine } from './screens.js';
import { startPicks } from './run.js';
import { makePool } from './pool.js';
import { figures, poolFor, lineup, LINEUP } from './figures.js';
import { findVeils, makeVeils, findOccluders, makeOccluders, VEIL } from './veil.js';
import { makeCut, CUT } from './cut.js';
import { makeFight, SPARKS } from './fight.js';
import { makeLife } from './life.js';
import { parseSeed, seedCode, smallSeed } from './mix.js';
import { REEVE, REEVE_TEXT } from './boss.js';
import { makeRunSound } from './run-sound.js';
import { emit, on } from './bus.js';
// the selection screens (gloam-downs-screens-life): the title, the lamp cards, the Lamp-room's tiles and the recap
import { titleView } from './menu-scene.js';
import { titleLamps, titleLine, seedLine, emberStep, wareTiles, recapOf, pickColour } from './screens.js';
import { PAD } from './input.js';
// growth (gloam-downs-growth): the page parts in cards.js, bound to the page's state with getters
const { bindGrowth, updateGrowth, fillGrowthLamp, sparkButtons, abilityButtons, growthView, setGrowth } = cards;
bindGrowth({ rs: () => rs, runner: () => runner, mode: () => mode, audio: () => audio, toast: (h, ms) => toast(h, ms), storeRun: () => storeRun(), fillLamp: () => fillLamp(), updateHud: () => updateHud(), openBeacon: () => openBeacon(),
  picked: (kind, id, b) => picked(kind, id, b), kindled: id => kindledTile(id) });

const $ = id => document.getElementById(id);
const canvas = $('view'), loading = $('loading'), loadLine = $('loadLine'), barFill = $('barFill'), bar = $('bar');
const q = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TARGET = { low: 30000, mid: 64000, high: 110000 };
// the combat run is the default (screens.js isRun): ?explore or ?wander opens the explorer. ?run and #run still mean the run, so a
// share link or a redirect that keeps the hash but drops the query opens it. ?run&test&lineup gives a pool of one of each figure
const RUN = isRun(location.search, location.hash), LOOK = RUN && q.has('lineup');
// the address of the other mode keeps the rest of the query (a share key such as _vercel_share)
const toMode = mode => location.assign(modeHref(location.pathname, location.search, mode));
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
// the Shake switch (the pause panel): the save's shake, or until the player presses it, off under reduced motion and on otherwise
const shakeOn = () => (rs?.shake === true || rs?.shake === false ? rs.shake : !still);
fx.kick = shakeOn(); fx.combo = true; fx.lamp = true;
// the seed and the best combo of the run in this place, kept for the summary after the run ends
let lastRun = { seed: 1, combo: 0 };
const posts = [];
let foeTargets = () => [], fight = null;
let life = null;
/* the run's sound (run-sound.js): no AudioContext until the first key, click or tap in a run, and none in the explorer or Wander.
   A Lamp-room opened from Wander's Map makes no sound until Begin the run or Go on with the run */
let lampFromWander = false, bossCard = false;
const audio = RUN ? makeRunSound({
  log: cues, rs, phone: coarse, step: () => runner?.clock.step ?? 0, seed: q.has('seed') ? Number(q.get('seed')) >>> 0 || 1 : 1,
  ear: () => (body && cam ? { x: body.s.x, z: body.s.z, yaw: cam.c.yaw } : null),
  foe: id => {
    const B = fight?.boss;
    if (B && id === B.id) return { pos: [B.x, B.z], type: 'B' };
    const f = fight?.foes.find(id);
    return f ? { pos: [f.x, f.z], type: f.type } : null;
  }
}) : null;
/* the first press that the browser counts as a user activation makes the context: a key but Escape, a mouse button, a touch's
   pointerup or touchend, or a click (a button's own handler calls this with no event). A touch's pointerdown is no activation (the
   HTML spec; WebKit counts only touchend), so a context made there would start suspended and stay so. Every later press resumes a
   context that is not running, as First Breath's ensureAudio does */
const activates = e => !e || (e.type === 'keydown' ? e.key !== 'Escape' : e.type === 'pointerdown' ? e.pointerType === 'mouse' : true);
const soundPress = e => {
  if (!audio || (mode === 'lamp' && lampFromWander)) return;
  if (!audio.ctx) {
    if (!activates(e)) return;
    audio.start();
    audio.ctx?.addEventListener?.('statechange', soundLabel);
    soundLabel();
  } else audio.wake()?.then?.(soundLabel);
};
if (audio) for (const k of ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click']) addEventListener(k, soundPress, true);
// after a card that played the Lamp-room theme (or silence), the place's own sounds come back: under the arrival card, or the theme
function sceneOfPlace() {
  if (!audio || !meta || fight?.boss?.fighting()) return;
  if (arriveLeft > 0 && !bossCard) audio.setScene('arrive', { id: meta.id });
  else audio.setScene(meta.id === 'barrows' && rs?.run?.bossDown ? 'light' : 'place', { id: meta.id });
}
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
// as for the run's cameras it never turns while the mouse is taken or a move across the view is held (play.js autoTurn); it eases in and
// out as the boss camera's turn does (cameras.js easeTurn)
let introRate = 0;
const introTurn = (c, s, dt, looked) => {
  const B = fight?.boss;
  if (still || looked || !B || !autoTurn({ ...c, auto: true }, 0)) { introRate = 0; return true; }
  const d = yawDiff(c.yaw, s, B), stop = 10 * Math.PI / 180;
  if (Math.abs(d) > stop) { introRate = easeTurn(introRate, 1.5, BOSS.acc, Math.abs(d) - stop, dt); c.yaw += Math.sign(d) * Math.min(introRate * dt, Math.abs(d) - stop); c.turning = true; } else introRate = 0;
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
const jumpBtn = $('bJump'), stickEl = $('stick'), actBtns = [$('bAttack'), $('bRoll'), $('bHeal')], abBtns = [$('bAb1'), $('bAb2')];
/* the mouse: taken by a click on the view (input.js). Freed in play in a run, by Escape or by the browser, it opens the pause panel. A
   card that opens frees it, so its buttons can be clicked, and a button that goes back to play takes it again (the click is the
   gesture the browser asks for) */
const inp = makeInput({ canvas, stick: stickEl, jump: jumpBtn, attack: $('bAttack'), roll: $('bRoll'), heal: $('bHeal'), ab1: $('bAb1'), ab2: $('bAb2') }, {
  run: () => RUN, play: () => mode === 'play', hold: () => mode === 'play' || mode === 'loading',
  onLock: (taken, ours) => { if (!taken && !ours && RUN && mode === 'play' && rs.run) openPause(); mouseHint(); },
  onState: () => mouseHint(),
  /* a mouse found or lost (one plugged into a phone): the help, the controls and the hint follow it. Found by a move, at once; found or
     lost by a press (a finger on a phone that has seen a mouse), not under an open card (freshLines) */
  onMouse: press => { if (press) freshLines(); else setLines(); mouseHint(); }
});
// a button that goes back to play takes the mouse again, when the press is a gesture the browser counts (not a gamepad's A)
const retake = () => { if (navigator.userActivation ? navigator.userActivation.isActive : true) inp.take(); mouseHint(); };
/* "Click to look with the mouse": over the view in play while the mouse is not taken, where the page can take it. Once the browser has
   refused it (or not answered), the free mouse's way to look: "Hold the right button and drag to look" (a click still acts, and asks
   again once the wait is over) */
const hintEl = $('mouseHint');
function mouseHint() {
  const on = mode === 'play' && !!place && inp.canLock && !inp.locked;
  if (hintEl.hidden === on) hintEl.hidden = !on;
  const text = inp.waiting || inp.refused ? 'Hold the right button and drag to look' : 'Click to look with the mouse';
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
  if (mode === 'play') padOff();
});

/* the pads, read on every frame in every mode: in a card or on the loading screen the d-pad and the left stick move the focus, A
   presses, B goes back, and Start and Back do what the card allows. A pad that first shows up changes the cards' controls, and that
   press presses nothing */
const nav = { dir: 0, t: 0 };
/* padSeen: the pad is the input in use (its labels on the HUD and its lines on the cards); padFound: a pad has shown up once. A key
   or a mouse press in play gives the labels back to the keys and the mouse, and the next pad press takes them again */
let padWas = { a: false, b: false, start: false, back: false, face: false, pause: false }, padSeen = false, padFound = false;
function padOff() { if (!padSeen) return; padSeen = false; showControls(); updateAbilities(); }
addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && mode === 'play') padOff(); }, true);
// a card or the loading screen takes over: a way the d-pad or the stick already holds moves nothing until it comes back to centre
const holdNav = () => heldNav(nav, readPads(navigator.getGamepads?.() || [], RUN).nav);
function showCard(card) { holdNav(); inp.free(); mouseHint(); if (linesStale) setLines(); return cards.show(card); }
function padCheck() {
  const any = [...(navigator.getGamepads?.() || [])].some(p => p && p.connected);
  if (any && !padFound) { padFound = padSeen = true; showControls(); return true; }
  return false;
}
function pollPad(dt) {
  const p = inp.readPad(), n = p.nav;
  const was = padWas;
  padWas = { a: n.a, b: n.b, start: n.start, back: n.back, face: p.face, pause: p.pause };
  // a pad that first shows up takes the labels, and that press presses nothing; after a key or a mouse press, a pad's next press or
  // stick takes them back
  if (p.any && !padFound) { padFound = padSeen = true; showControls(); updateAbilities(); return; }
  if (!padSeen && (p.down?.size || p.mx || p.mz || p.ox || p.oy)) { padSeen = true; showControls(); updateAbilities(); }
  const edge = k => n[k] && !was[k];
  if (cards.current() || mode === 'loading') {
    const d = navStep(nav, n, dt);
    // on lamp cards and the title's lamps the d-pad and the stick move by the grid (cards.js moveDir); elsewhere in the card's order
    if (d) {
      const dn = p.down || new Set(), dx = dn.has(PAD.RIGHT) || p.mx > 0.5 ? 1 : dn.has(PAD.LEFT) || p.mx < -0.5 ? -1 : 0, dy = dn.has(PAD.DOWN) || p.mz < -0.5 ? 1 : dn.has(PAD.UP) || p.mz > 0.5 ? -1 : 0;
      if ((dx || dy) && document.activeElement?.closest?.('.lcard, .lamp')) cards.moveDir(dx, dy);
      else cards.move(d);
    }
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
  // the boss music builds with the share of health left, while the bar shows
  if (B && !$('bossBar').hidden) emit('boss-health', { share: B.hp / B.max, phase: B.phase });
}
function bossBar(on) {
  if (!RUN) return;
  $('bossBar').hidden = !on;
  // in the boss fight the hint hides, so the HUD fits the rects the boss camera keeps clear
  hud.classList.toggle('boss', on);
  // the ticks at the phases' ends: 61.5% and 26.9%, or 40% for phase 3 at Ember 5 (boss.js bossLines)
  const B = fight?.boss;
  if (B?.lines) $('bossBar').querySelectorAll('.tick').forEach((t, i) => { t.style.left = `${((B.lines[i] / B.max) * 100).toFixed(1)}%`; });
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
  bossScreen.rects = [hud, tools, jumpBtn, ...actBtns, ...abBtns, $('abilities')].filter(el => !el.hidden).map(el => el.getBoundingClientRect()).filter(r => r.width > 0).map(r => [r.left, r.top, r.width, r.height]);
}
function showHud(on) {
  hud.hidden = tools.hidden = !on;
  jumpBtn.hidden = !(on && coarse);
  for (const b of actBtns) b.hidden = !(on && coarse && RUN);
  updateAbilities();
}
function updateHud() {
  if (RUN) return updateRunHud();
  const got = save.wisps[meta.id]?.length || 0;
  $('where').textContent = meta.name;
  $('count').innerHTML = `<b>◆ ${got}/5</b> wisps · <i>${beaconLit ? 'beacon lit' : 'beacon dark'}</i>`;
  $('hint').textContent = hintOf(save, meta.id, meta.hint, beaconLit);
}
// the run's HUD: the health bar with its number and a pip for each flask, then the wisps of this place and the glim carried
function updateRunHud() {
  updateGrowth();
  updateRelics();
  const h = hudOf(rs, runner?.wisps.size || 0);
  $('where').textContent = meta.name;
  $('life').hidden = !h;
  hud.classList.toggle('low', !!h?.low);
  $('count').hidden = !h;
  $('hint').hidden = !h;
  $('hint').textContent = beaconLit ? 'The beacon burns.' : 'Put out the keepers, then light the beacon.';
  updateCombo();
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
  updateAbilities();
}
/* ---------------- the abilities on the page (gloam-downs-growth) ----------------
   The HUD's row of the two slots ("1 Lantern bomb", or the seconds left while it cools) with a mouse, keys or a pad; on a touch screen
   the two round buttons over Attack and Heal, with the cooldown as a dark sweep. A slot with nothing in it shows nothing */
const AB_SHORT = { bomb: 'BOMB', step: 'STEP', snare: 'SNARE', moth: 'MOTH', crook: 'CROOK', rime: 'RIME', flare: 'FLARE', pitch: 'PITCH', guard: 'GUARD' };
const abKeys = () => (padSeen ? ['LB', 'LT'] : ['F', 'G']);
// glows: the steady dabs of the last draw by kind (fight.js glows: pattern, ability, cache, stone, snare, ...), for ?test
const abilityView = () => ({ glows: fight ? fight.halo.reduce((m, g) => ((m[g.kind] = (m[g.kind] || 0) + 1), m), {}) : {}, abilities: runner?.abilities ? runner.abilities.view() : (rs?.run?.abilities || [null, null]).map(a => (a ? { ...a, left: 0, share: 0 } : null)), ...(runner?.keys ? runner.keys.view() : { keys: (rs?.keys || []).slice(), caches: (rs?.run?.caches || []).slice() }) });
function updateAbilities() {
  const el = $('abilities');
  if (!el) return;
  const v = RUN && rs?.run && !hud.hidden ? abilityView().abilities : [null, null], keys = abKeys(), touch = coarse && !inp.mouse;
  const html = v.map((a, i) => (a ? `<span class="${a.left > 0 ? 'cool' : ''}${a.bright ? ' bright' : ''}"><kbd>${keys[i]}</kbd>${a.name}${a.left > 0 ? ` ${Math.ceil(a.left)}\u00a0s` : ''}</span>` : '')).join('');
  el.hidden = touch || !v.some(Boolean);
  if (el.innerHTML !== html) el.innerHTML = html;
  el.setAttribute('aria-label', v.filter(Boolean).map((a, i) => `${a.name}${a.left > 0 ? `, ready in ${Math.ceil(a.left)} seconds` : ', ready'}`).join('; ') || 'No abilities');
  abBtns.forEach((b, i) => {
    const a = v[i];
    b.hidden = !(a && touch && mode !== 'loading');
    if (!a) return;
    // a cooling button is dimmed, its sweep is a pale arc, and its label gives the seconds left
    const cls = `act ab ab${i + 1} ${a.colour || ''}${a.bright ? ' bright' : ''}${a.left > 0 ? ' cool' : ''}`;
    if (b.className.replace(' on', '') !== cls) b.className = cls + (b.classList.contains('on') ? ' on' : '');
    b.style.setProperty('--cd', a.share.toFixed(3));
    const t = a.left > 0 ? `${Math.ceil(a.left)}` : AB_SHORT[a.id] || a.name;
    if (b.lastChild.textContent !== t) b.lastChild.textContent = t;
    b.setAttribute('aria-label', `${a.name}${a.left > 0 ? `, ready in ${Math.ceil(a.left)} s` : ''}`);
  });
}
/* ---------------- the builds on the page (builder BC) ----------------
   The HUD's relic marks: a short mark for each relic held, ember when it kindles with a wick, and "Kindled" after them once one does */
function updateRelics() {
  const el = $('relics');
  if (!el) return;
  const marks = RUN && rs.run ? relicMarks(rs.run) : [];
  el.hidden = !marks.length;
  const html = marks.map(m => `<i class="rl${m.kindled ? ' k' : ''}" title="${m.name}${m.kindled ? ' · Kindled' : ''}">${m.mark}</i>`).join('') + (marks.some(m => m.kindled) ? '<em>Kindled</em>' : '');
  if (el.innerHTML !== html) el.innerHTML = html;
  el.setAttribute('aria-label', marks.length ? `Relics: ${marks.map(m => m.name + (m.kindled ? ', kindled' : '')).join('; ')}` : 'No relics');
}
// what the builds' events show on the page (relics.js relicEvent)
const buildPage = { toast: (html, ms) => toast(html, ms), hud: () => updateHud() };
// the Lamp-room's Unlocks list and Ember row (fillLamp)
function fillBuilds() {
  const list = $('unlocks');
  for (const row of unlockRows(rs)) {
    let li = list.querySelector(`li[data-unlock="${row.id}"]`);
    if (!li) {
      li = document.createElement('li');
      li.dataset.unlock = row.id;
      li.innerHTML = '<span></span><button type="button"></button>';
      li.querySelector('button').addEventListener('click', () => buyUnlockRow(row.id));
      list.appendChild(li);
    }
    li.classList.toggle('top', row.got);
    li.querySelector('span').textContent = row.label;
    const btn = li.querySelector('button');
    btn.hidden = row.got;
    btn.textContent = row.buy || '';
    btn.setAttribute('aria-disabled', String(!!row.need));
    btn.setAttribute('aria-label', row.need ? `${row.label}: ${row.need} more glim needed` : `Buy ${row.label}`);
  }
  const box = $('emberRow'), levels = emberRow(rs);
  box.hidden = !levels.length || !!rs.run;
  const want = levels.map(l => l.n).join();
  if (box.dataset.levels !== want) {
    box.dataset.levels = want;
    box.innerHTML = '';
    for (const l of levels) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.ember = String(l.n);
      b.textContent = l.label;
      b.title = l.text;
      b.addEventListener('click', () => { if (setEmber(rs, l.n)) { audio?.cue('choice'); storeRun(); fillLamp(); } });
      box.appendChild(b);
    }
  }
  for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(Number(b.dataset.ember) === (rs.ember | 0)));
  $('emberLine').hidden = box.hidden;
  $('emberLine').textContent = levels.length ? `Ember ${rs.ember | 0}: ${levels[rs.ember | 0].text}.` : '';
}
function buyUnlockRow(id) {
  const btn = $('unlocks').querySelector(`li[data-unlock="${id}"] button`), had = document.activeElement === btn;
  if (!buyUnlock(rs, id)) { audio?.cue('refuse'); return; }
  audio?.cue('buy');
  storeRun();
  fillLamp();
  flashTile($('unlocks').querySelector(`li[data-unlock="${id}"]`));
  showControls();
  // a bought row has no Buy button: the focus goes on to the next Buy button, or to the main button
  if (had && btn.hidden) {
    const all = [...$('lamp').querySelectorAll('.ups li button')], at = all.indexOf(btn);
    const next = [...all.slice(at + 1), ...all.slice(0, at)].find(b => !b.hidden);
    next ? next.focus({ preventScroll: true }) : cards.focusMain();
  }
}
// ?test: what the builds are now, for __gloam.run()
function buildsView() {
  const run = rs?.run, E = fight?.foes.elite?.();
  return {
    relics: run?.relics?.slice() ?? [], unlocks: (rs?.unlocks || []).slice(), ember: run ? emberOf(run) : rs?.ember ?? 0, emberTop: rs?.emberTop ?? 0, route: run ? routeOfRun(run).slice() : null,
    kindled: run ? relicMarks(run).filter(m => m.kindled).map(m => m.id) : [], ground: runner?.relics ? runner.relics.view().ground : [],
    elite: E ? { id: E.id, name: E.elite.name, zone: E.zone.id, c: E.zone.c.slice(), hp: E.hp, max: E.T.hp, size: E.size, state: E.state, out: E.out, special: E.special ? E.special.def.kind : null } : null
  };
}
// ?test: __gloam.set's build fields
function setBuilds(o) {
  if (Array.isArray(o.unlocks)) rs.unlocks = [...new Set(o.unlocks.filter(u => UNLOCK_IDS.includes(u)))];
  if (Number.isInteger(o.emberTop)) rs.emberTop = Math.max(0, Math.min(5, o.emberTop));
  if (Number.isInteger(o.ember)) { rs.emberTop = Math.max(rs.emberTop | 0, o.ember); setEmber(rs, Math.max(0, Math.min(5, o.ember))); if (rs.run) rs.run.ember = rs.ember; }
  if (Array.isArray(o.relics) && rs.run) rs.run.relics = [...new Set(o.relics.filter(r => RELIC_IDS.includes(r)))].slice(0, 5);
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
  $('arriveN').textContent = arriveLine(meta.id);
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
  bossCard = true;
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
// the two ability slots and the keys held, in the words of the input in use (gloam-downs-growth)
const ABILITY_LINES = {
  keys: '<kbd>F</kbd> <kbd>G</kbd> abilities',
  drag: '<kbd>F</kbd> <kbd>G</kbd> abilities',
  touch: 'The two round buttons over ATTACK use your abilities. Stand on an ability lamp and press one to swap.',
  pad: '<kbd>LB</kbd> ability 1 · <kbd>LT</kbd> ability 2 · on an ability lamp, a swap'
};
const MOUSE_LINE = 'Mouse buttons 4 and 5 use the abilities too. On an ability lamp, an ability\'s key swaps it.';
const keyLines = rs => [...(rs.keys || []).includes('leap') ? ['Jump again in the air: Crow step.'] : [], ...(rs.keys || []).includes('drop') ? ['Plunge onto a sealed stone from 2 m up: Bell drop.'] : []];
// a phone with a mouse plugged in shows the mouse's lines
const controlsKind = () => (padSeen ? 'pad' : coarse && !inp.mouse ? 'touch' : inp.canLock ? 'keys' : 'drag');
// the explorer's help card: the keys and the mouse on a desktop or a phone with a mouse, the touch lines on a touch screen
function helpLines() {
  $('helpKeys').hidden = coarse && !inp.mouse;
  $('helpMouse').hidden = !inp.canLock;
  $('helpDrag').hidden = inp.canLock;
  $('helpTouch').hidden = !coarse;
}
function showControls() {
  if (!RUN) return;
  // the moves that unlocks add use the Attack input of every device: one line each once bought
  // with keys the abilities' line joins the last line (Pause), so the pause panel keeps its height at 800 by 600
  const kind = controlsKind(), base = CONTROLS[kind].slice();
  if (kind === 'keys' || kind === 'drag') base[base.length - 1] += ` ${ABILITY_LINES[kind]}.`;
  else base.push(ABILITY_LINES[kind]);
  const lines = [...base, ...moveLines(rs), ...keyLines(rs)], li = l => `<li>${l}</li>`;
  // the run's help card also names the mouse's side buttons and the swap on a lamp; the pause panel keeps its height at 800 by 600
  const more = kind === 'keys' || kind === 'drag' ? [MOUSE_LINE] : [];
  $('runControls').innerHTML = [...lines, ...more].map(li).join('');
  $('pauseControls').innerHTML = lines.map(li).join('');
}
/* a mouse found or lost changes the mouse lines, and so the height of the card they are on. Under an open card a change in the press
   that switched the input (a finger's pointerdown on a phone that has seen a mouse, or a mouse's first press with no move before it)
   would move the buttons under it, and Chrome would send the click to what is there now. So that change waits while a card is open,
   and is laid when the next card opens or play comes back. A mouse found by a move changes the lines at once, before any press */
let linesStale = false;
function setLines() { linesStale = false; helpLines(); showControls(); }
function freshLines() { if (cards.current()) linesStale = true; else setLines(); }

/* ---------------- the explorer's dialogs ---------------- */
const panels = ['help', 'map', 'end'];
function closePanels() {
  // closing the help any way (Walk, Escape, a gamepad's Start) means it has been read
  if (!$('help').hidden) { save.seen = true; store(disk, save); }
  let was = false;
  for (const p of panels) if (!$(p).hidden) { $(p).hidden = true; was = true; cards.shut($(p)); }
  if (linesStale) setLines();
  if (was && mode !== 'loading') { mode = 'play'; inp.swallowAll(); canvas.focus?.(); retake(); }
}
function openMap() {
  // two groups (places.js mapGroups): the downs in #places, then the Gilt Lattice in #lattice, each under its heading; the focus order
  // follows the page
  for (const g of mapGroups(save, meta?.id)) {
    const list = $(g.set === 'downs' ? 'places' : 'lattice');
    list.textContent = '';
    $(g.set === 'downs' ? 'downsT' : 'latticeT').textContent = g.title;
    for (const r of g.rows) {
      const b = document.createElement('button');
      b.type = 'button';
      b.disabled = !r.open;
      b.dataset.place = r.id;
      if (r.current) b.setAttribute('aria-current', 'true');
      b.innerHTML = `<span class="n">${r.n}</span><b></b><em></em><small></small>`;
      b.querySelector('b').textContent = r.name;
      b.querySelector('small').textContent = r.note;
      b.querySelector('em').textContent = r.wisps;
      b.addEventListener('click', () => { closePanels(); if (r.id !== meta.id) go(r.id); });
      list.appendChild(b);
    }
  }
  $('mapLine').textContent = mapLine(save);
  $('map').hidden = false;
  mode = 'map';
  showCard({ el: $('map'), main: () => $('map').querySelector('[aria-current="true"]') });
}
$('bMap').addEventListener('click', () => {
  if (RUN) { if (mode === 'play') openPause(); else if (mode === 'pause' && !asking) resume(); return; }
  mode === 'map' ? closePanels() : openMap();
});
$('bMapClose').addEventListener('click', closePanels);
$('bLook').addEventListener('click', face);
$('bStart').addEventListener('click', closePanels);
/* Fight: the explorer's way back to the combat run, on the help card and the map. The address drops ?explore and keeps the rest */
for (const id of ['bFight', 'bMapFight']) $(id).addEventListener('click', () => toMode('run'));
$('bEndStay').addEventListener('click', closePanels);
// Walk again puts out the five beacons of the downs only: the Lattice keeps its beacons
$('bAgain').addEventListener('click', () => { closePanels(); for (const id of ORDER) delete save.lit[id]; save.time = 0; save.at = 'gaol'; store(disk, save); go('gaol'); });
for (const p of panels) $(p).addEventListener('pointerdown', e => { if (e.target === $(p) && p !== 'help') closePanels(); });
/* the help says to click the view, which shows round its box: a mouse click there walks, as Walk does (a click, so it is a gesture).
   A tap there does not: a stray finger outside the box on a phone leaves the first-visit help open */
const mouseClick = e => !e.pointerType || e.pointerType === 'mouse';
$('help').addEventListener('click', e => { if (e.target === $('help') && mouseClick(e)) closePanels(); });

/* ---------------- the run's cards ----------------
   The help card, the beacon card (the wick choice, then Spend glim and Walk on), the Lamp-room, the pause panel and the run summary;
   screens.js gives what each shows. In a run a press outside a card's box does nothing, but on the pause panel, where it resumes, and
   on the help card, where a click begins the run (the help says to click the view). B
   and Escape go back where a card has a back action: Resume, No, Back to the beacon and Back to Wander. Before a wick is chosen, only
   a wick button closes the beacon card */
let asking = null, placeFresh = true, deadAt = -1;
const storeRun = () => { sinceStore = 0; return RS.store(disk, rs); };
let quietFocus = false;
function openCard(id, m, main, backFn = null) {
  $(id).hidden = false;
  mode = m;
  padCheck();
  showControls();
  quietFocus = true;
  showCard({ el: $(id), main, back: backFn });
  quietFocus = false;
  audio?.cue('card');
}
document.addEventListener('focusin', e => {
  if (quietFocus || !(e.target instanceof HTMLButtonElement) || !cards.current()?.el.contains(e.target)) return;
  // a lamp card or a title lamp plays hover (and tells the world, for the beacon's glow); other buttons keep focus
  if (e.target.closest('.lcard, .lamp')) return hovered(e.target);
  audio?.cue('focus');
});
function hideCard(id) { $(id).hidden = true; cards.shut($(id)); if (linesStale && !cards.current()) setLines(); }
function closeCard(id) {
  hideCard(id);
  const was = mode;
  mode = 'play';
  if (was === 'pause') audio?.pause(false);
  else if (audio && ['lamp', 'silent'].includes(audio.scene.kind)) sceneOfPlace();
  inp.swallowAll();
  canvas.focus?.();
  retake();
}
function openRunHelp() { openCard('runHelp', 'help', () => $('bBegin')); }

/* ---------------- the selection screens (gloam-downs-screens-life) ----------------
   The title screen over the live place: the title, the place line, the places as lamps, the seed and Ember line, Begin the run (the
   explorer: Walk, Fight, How to play). The place drifts behind it (menu-scene.js titleView, in draw). With ?test the old first cards
   open unless &title is in the address, so the older checks keep their flow */
const TITLED = !q.has('test') || q.has('title');
let titleAt = 0, titleSeed = null;
const screenLog = [];
// the bus's screen events, kept for ?test (__gloam.screens)
for (const k of ['screen-hover', 'screen-pick']) on(k, d => { if (screenLog.length < 200) screenLog.push({ name: k, ...d }); });
let hoverAt = -1e9, hoverBusAt = -1e9;
// hover and focus on a lamp card or a title lamp: hover at most once each 60 ms, screen-hover at most once each 150 ms
function hovered(b) {
  const now = performance.now();
  if (now - hoverAt >= 60) { hoverAt = now; audio?.cue('hover'); }
  const kind = b.dataset.wick ? 'wick' : b.dataset.spark ? 'spark' : b.dataset.ability ? 'ability' : null;
  if (kind && now - hoverBusAt >= 150) { hoverBusAt = now; emit('screen-hover', { kind, colour: pickColour(kind, b.dataset[kind]) }); }
  if (b.classList.contains('lamp')) lampLine(b);
}
document.addEventListener('pointerover', e => {
  const b = e.target instanceof Element ? e.target.closest('.lcard, .lamp') : null;
  if (!b || b.disabled || !cards.current()?.el.contains(b) || (e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) return;
  hovered(b);
});
// a pick: on the press itself; then the card flares, pick plays, and the bus hears screen-pick (Builder E's life lights the beacon)
function picked(kind, id, b) {
  audio?.cue('pick');
  emit('screen-pick', { kind, colour: pickColour(kind, id) });
  cards.flare(b, [...(b.parentNode?.children || [])], still);
  if (!still) pendingDeal = 200;
}
// the next set of cards deals in 200 ms after a pick (the pick itself is never delayed)
let pendingDeal = 0;
function deal(box) {
  const list = [...box.querySelectorAll('button.lcard')];
  if (!list.length) return;
  audio?.cue('reveal');
  const a = cards.dealIn(list, still);
  if (pendingDeal) for (const x of a) if (x) x.effect.updateTiming({ delay: (x.effect.getTiming().delay || 0) + pendingDeal });
}
// the title's lamps: in a run the route of five, lit for each place reached in any run; in the explorer the places to go to
function titleSet(el, rows, group) {
  el.textContent = '';
  if (group) { const g = document.createElement('p'); g.className = 'gname'; g.textContent = group; el.appendChild(g); }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'path'); svg.setAttribute('viewBox', '0 0 100 20'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M0 12 C 15 4, 30 18, 50 10 S 85 4, 100 11"/>';
  el.appendChild(svg);
  for (const r of rows) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lamp${r.lit ? ' lit' : ''}`;
    b.dataset.place = r.id;
    b.dataset.line = r.line;
    b.disabled = !!r.locked;
    b.setAttribute('aria-label', `${r.line}${r.lit ? ', reached' : ''}`);
    b.innerHTML = '<i class="glass" aria-hidden="true"><i class="flame"></i></i><span class="n"></span>';
    b.querySelector('.n').textContent = r.n;
    b.addEventListener('click', () => (RUN ? lampLine(b) : titleGo(r.id)));
    el.appendChild(b);
  }
}
// the line under the lamps names the lamp under the pointer or the focus, and that lamp lights fully
function lampLine(b) {
  for (const x of $('title').querySelectorAll('.lamp.on')) if (x !== b) x.classList.remove('on');
  b.classList.add('on');
  const [head, ...rest] = b.dataset.line.split('. ');
  $('titleLine').innerHTML = '';
  const hb = document.createElement('b');
  hb.textContent = head;
  $('titleLine').append(hb, rest.length ? `. ${rest.join('. ')}` : '');
}
const TITLE_REST = { run: 'Five dark places on the downs. Light the beacon in each.', explore: 'Choose a place to walk, with no foes.' };
function fillTitle() {
  const here = meta?.id, explorer = !RUN;
  $('titlePlace').textContent = here ? (ORDER.includes(here) ? titleLine(here) : `${placeName(here)}. ${meta.sub || ''}`) : '';
  if (RUN) {
    titleSet($('titleLamps'), titleLamps(rs));
    $('titleLattice').hidden = true;
    titleSeed ??= seed();
    $('titleSeed').textContent = seedLine(seedCode(titleSeed), rs.ember | 0);
    $('bEmberDown').hidden = $('bEmberUp').hidden = (rs.emberTop | 0) < 1;
    $('bEmberDown').setAttribute('aria-disabled', String(emberStep(rs, -1) === null));
    $('bEmberUp').setAttribute('aria-disabled', String(emberStep(rs, 1) === null));
  } else {
    const [downs, lattice] = mapGroups(save, here);
    const rowsOf = g => g.rows.map(r => ({ id: r.id, n: r.n, line: r.open ? (ORDER.includes(r.id) ? titleLine(r.id) : `${r.n} · ${r.name}`) : `${r.n} · Locked. Light the beacon before it`, lit: r.open, locked: !r.open }));
    titleSet($('titleLamps'), rowsOf(downs), 'The downs');
    titleSet($('titleLattice'), rowsOf(lattice), 'The Gilt Lattice');
    $('titleLattice').hidden = false;
  }
  $('seedRow').hidden = explorer;
  $('titleRun').hidden = $('titleMore').hidden = explorer;
  $('titleWalkRow').hidden = $('titleWalkMore').hidden = !explorer;
  $('titleLine').textContent = TITLE_REST[explorer ? 'explore' : 'run'];
}
function openTitle() {
  fillTitle();
  titleAt = time;
  emit('lamp-room', { wait: 0 });
  openCard('title', 'title', () => $(RUN ? 'bTitleBegin' : 'bTitleWalk'));
}
// Begin the run: on a first visit the help card first (its own Begin starts the run); after that at once
$('bTitleBegin').addEventListener('click', () => {
  if (!rs) return;
  if (!rs.seen) { hideCard('title'); soundPress(); audio?.cue('choice'); return openRunHelp(); }
  beginRun('title');
});
$('bTitleLamp').addEventListener('click', () => { audio?.cue('choice'); hideCard('title'); openLamp(); });
$('bTitleHelp').addEventListener('click', () => { audio?.cue('choice'); hideCard('title'); openRunHelp(); });
$('bTitleExplore').addEventListener('click', () => toMode('explore'));
for (const [id, d] of [['bEmberDown', -1], ['bEmberUp', 1]]) $(id).addEventListener('click', () => {
  const n = emberStep(rs, d);
  if (n === null || !setEmber(rs, n)) { audio?.cue('refuse'); return; }
  audio?.cue('choice');
  storeRun();
  fillTitle();
});
// the explorer's title: Walk closes it, Fight opens the run, How to play the help card, and a lamp goes to its place
function titleClose() { save.seen = true; store(disk, save); hideCard('title'); mode = 'play'; inp.swallowAll(); canvas.focus?.(); retake(); }
function titleGo(id) { titleClose(); if (id !== meta.id) go(id); }
$('bTitleWalk').addEventListener('click', titleClose);
$('bTitleFight').addEventListener('click', () => toMode('run'));
$('bTitleHelp2').addEventListener('click', () => { hideCard('title'); helpLines(); $('help').hidden = false; mode = 'help'; showCard({ el: $('help'), main: () => $('bStart') }); });
// a new run starts in the Gaol: on the place as it loaded, or on the Gaol loaded again once this place has been played
function beginRun(card) {
  lampFromWander = false;
  soundPress();
  audio?.cue('choice');
  rs.seen = true;
  // at the Ember level chosen in the Lamp-room, in its route; with Wick shelf the beacon card first offers two starting wicks
  startRun(rs, titleSeed ?? seed(), rs.ember | 0);
  titleSeed = null;
  storeRun();
  closeCard(card);
  if (meta.id !== rs.run.place || !placeFresh) return go(rs.run.place);
  newRunner();
  updateHud();
  // the start picks: the shelf's wick, First spark's sparks and Belt's ability, on the beacon card's buttons
  if (startPicks(rs.run)) openBeacon();
}
$('bBegin').addEventListener('click', () => beginRun('runHelp'));
// Explore: the run's first card also opens the explorer, the places with no foes
$('bExplore').addEventListener('click', () => toMode('explore'));
// the run's help says to click the view: a click round its box begins the run, as Begin the run does
$('runHelp').addEventListener('click', e => { if (e.target === $('runHelp') && mode === 'help' && mouseClick(e)) beginRun('runHelp'); });
// ?seed= takes a seed's code or its number (mix.js parseSeed); a new run draws a seed small enough for a code of six letters
const seed = () => (q.has('seed') && parseSeed(q.get('seed'))) || smallSeed(newSeed(rs.runs));

// the pause panel: the run's places, its time, Resume, the sound switch (stage 3 makes the sound), Back to the start and End the run
function openPause() {
  if (!rs.run) return;
  asking = null;
  $('route').innerHTML = routeOf(rs.run.place, routeOfRun(rs.run)).map(p => `<li class="${p.state}"><span>${p.n}</span> ${p.name}<em>${p.state === 'here' ? 'now' : p.state}</em></li>`).join('');
  $('pauseLine').textContent = `Run time ${fmt(rs.run.time)}`;
  $('seedLine').textContent = `Seed ${seedCode(rs.run.seed)}`;
  // the keys held, on the seed's line's own row only once there is one (the panel keeps its height on a phone)
  $('keysLine').hidden = !(rs.keys || []).length;
  $('keysLine').textContent = keysLine(rs);
  soundLabel();
  $('pauseRow').hidden = false;
  $('askRow').hidden = true;
  audio?.pause(true);
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
/* the Sound and Music switches, each stored at once. Until the context exists (a gamepad press is no gesture to the browser) the
   Sound line says when it starts */
function soundLabel() {
  if (!RUN) return;
  const waits = rs.sound && audio && (!audio.ctx || (audio.ctx.state === 'suspended' && !document.hidden));
  $('bSound').textContent = rs.sound ? (waits ? 'Sound on (starts on a key or tap)' : 'Sound on') : 'Sound off';
  $('bSound').setAttribute('aria-pressed', String(rs.sound));
  $('bMusic').textContent = rs.music ? 'Music on' : 'Music off';
  $('bMusic').setAttribute('aria-pressed', String(rs.music));
  $('bShake').textContent = fx.kick ? 'Shake on' : 'Shake off';
  $('bShake').setAttribute('aria-pressed', String(!!fx.kick));
}
$('bResume').addEventListener('click', resume);
$('bSound').addEventListener('click', () => { rs.sound = !rs.sound; storeRun(); audio?.switches(); soundLabel(); });
$('bMusic').addEventListener('click', () => { rs.music = !rs.music; storeRun(); audio?.switches(); soundLabel(); });
$('bShake').addEventListener('click', () => { rs.shake = !fx.kick; fx.kick = rs.shake; storeRun(); soundLabel(); });
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
/* growth: after the wick, the spark picks (#sparks), then the patterns kept (#beaconKept), then Lamp-room and Walk on. The start card
   asks for the shelf's wick, First spark's sparks and Belt's ability; a cache's spark opens the card for its one pick */
function openBeacon() {
  const run = rs.run, offer = run.offer, box = $('wicks'), shelf = !!run.shelf, cache = !shelf && !!run.sparkNow && !offer;
  const sparks = !offer && (run.sparkPicks | 0) > 0, ability = !offer && !sparks && !!run.abilityOffer, waiting = !!offer || sparks || ability;
  // a pick taken: the start card and a cache's card close once nothing more is asked; the beacon card shows its next part
  const next = () => {
    if (!rs.run) return;
    if ((shelf || cache) && !startPicks(rs.run)) { rs.run.shelf = false; rs.run.sparkNow = false; storeRun(); return closeCard('beaconCard'); }
    openBeacon();
  };
  box.textContent = '';
  $('sparks').hidden = !sparks;
  if (sparks) sparkButtons($('sparks'), next);
  if (ability) abilityButtons(box, run.abilityOffer, next);
  $('beaconKept').textContent = keptLine(run.kept);
  $('beaconKept').hidden = shelf || cache || waiting || !run.kept?.length;
  $('bSpend').textContent = 'Lamp-room';
  if (cache) {
    $('beaconT').textContent = 'A spark';
    $('beaconLine').textContent = 'Choose a spark. It raises one colour for the rest of the run.';
    $('beaconBank').hidden = $('beaconRow').hidden = true;
    $('sparks').classList.add('cards');
    openCard('beaconCard', 'beacon', () => $('sparks').querySelector('button'));
    deal($('beaconCard'));
    pendingDeal = 0;
    return;
  }
  for (const id of offer || []) {
    const b = document.createElement('button'), name = document.createElement('b');
    b.type = 'button';
    b.className = 'wick';
    b.dataset.wick = id;
    name.textContent = wickName(id);
    // a lamp card in the wick's amber (gloam-downs-screens-life "Lamp cards")
    cards.lampCard(b, { name: name.textContent, text: wickLine(id).slice(name.textContent.length + 3), hue: '#ff9a32', label: wickLine(id) });
    // a wick that kindles a relic the run holds says so
    const k = kindleLine(run, id);
    if (k) { const em = document.createElement('em'); em.className = 'kindle'; em.textContent = k; b.append(em); }
    b.addEventListener('click', () => {
      if (!rs.run?.offer || !chooseWick(rs, id)) return;
      picked('wick', id, b);
      storeRun();
      updateHud();
      // Wick shelf's starting wick: the card closes and the run starts in the Gaol, unless First spark or Belt still ask
      next();
    });
    box.appendChild(b);
  }
  $('beaconT').textContent = shelf ? (offer ? 'The Wick shelf' : 'The run begins') : 'The beacon burns';
  const lit = run.wicks.at(-1), kl = lit ? kindleLine(run, lit) : '';
  $('beaconLine').textContent = offer ? (shelf ? 'Choose a wick to start the run with. It burns for the whole run.' : 'Choose a wick. It burns for the rest of the run.')
    : sparks ? `Choose a spark. It raises one colour for the rest of the run.${run.sparkPicks > 1 ? ` ${run.sparkPicks} picks left.` : ''}`
    : ability ? 'Choose an ability for slot 1. It is yours for the whole run.'
    : lit ? `${wickName(lit)} burns in the lamp.${kl ? ` Kindled: ${kl.split(': ')[1]}.` : ''}` : 'The beacon burns.';
  $('beaconBank').innerHTML = glimLine(rs, 'beacon').replace(/(\d+ glim)/, '<b class="bank">$1</b>');
  $('beaconBank').hidden = $('beaconRow').hidden = waiting;
  // before the picks are made only a pick button closes the card: it has no back action. The Lamp-room theme follows the stinger
  emit('lamp-room', { wait: 0 });
  box.classList.toggle('cards', !!box.children.length);
  $('sparks').classList.add('cards');
  openCard('beaconCard', 'beacon', () => (rs.run?.offer || rs.run?.abilityOffer ? box.querySelector('button') : (rs.run?.sparkPicks | 0) > 0 ? $('sparks').querySelector('button') : $('bWalkOn')));
  deal($('beaconCard'));
  pendingDeal = 0;
}
// Walk on loads the next place; after a reload at the card, the card already shows over it
$('bWalkOn').addEventListener('click', () => { audio?.cue('choice'); if (meta.id === rs.run.place) return closeCard('beaconCard'); hideCard('beaconCard'); retake(); go(rs.run.place); });
$('bSpend').addEventListener('click', () => { hideCard('beaconCard'); openLamp('beacon'); });

/* the Lamp-room: the bank, the five lasting upgrades with Buy, and Begin the run. From a beacon card it shows Back to the beacon in
   place of Begin the run and Wander; with a run in progress, Go on with the run. A buy stores the run at once */
const LAMP = { back: 'bLampBack', begin: 'bLampBegin', goon: 'bLampGoOn', wander: 'bLampWander', toWander: 'bLampToWander', explore: 'bLampExplore' };
// Wander opens after the first win, or for a player whose explorer save shows a finished walk (Wander itself is built behind ?wander)
const wanderOpen = () => rs.wins > 0 || save.done >= 1;
const toWander = () => toMode('wander');
function openLamp(from = null) {
  lampFromWander = from === 'wander';
  if (!lampFromWander) emit('lamp-room', { wait: 0 });
  const b = lampButtons(rs, from, wanderOpen());
  for (const [k, id] of Object.entries(LAMP)) $(id).hidden = !b.list.includes(k);
  cards.freshLamp();
  fillLamp();
  openCard('lamp', 'lamp', () => $(LAMP[b.main]), b.back ? () => $(LAMP[b.back]).click() : null);
}
/* the Lamp-room's wares as lamp tiles (screens.js wareTile): a glass that fills by level / levels, "Mantle 2 of 8", the next gift, its
   cost and Buy. The glim line's numbers roll from the old count to the new over 400 ms with tally ticks (at most 12); with reduced
   motion they change at once */
function fillLamp() {
  const was = [...$('lampLine').querySelectorAll('b.bank')].map(b => parseInt(b.textContent, 10));
  $('lampLine').innerHTML = glimLine(rs, 'lamp').replace(/(\d+ glim)/g, '<b class="bank">$1</b>');
  rollGlim(was);
  fillGrowthLamp();
  const list = $('ups');
  for (const row of wareTiles(rs)) {
    let li = list.querySelector(`li[data-up="${row.id}"]`);
    if (!li) {
      li = document.createElement('li');
      li.className = 'tile';
      li.dataset.up = row.id;
      li.innerHTML = '<i class="glass" aria-hidden="true"><i class="fill"></i><i class="flame"></i></i><b class="nm"></b><span class="gift"></span><span class="cost"></span><button type="button"></button><i class="flash" aria-hidden="true"></i>';
      li.querySelector('button').addEventListener('click', () => buyUp(row.id));
      list.appendChild(li);
    }
    li.classList.toggle('top', row.top);
    li.dataset.label = row.label;
    li.dataset.fill = row.fill.toFixed(4);
    li.style.setProperty('--fill', row.fill.toFixed(4));
    // the name, then "2 of 8" on its own line (the tile's text still reads "Mantle 2 of 8")
    const of = row.level.slice(row.name.length + 1);
    li.querySelector('.nm').innerHTML = '';
    li.querySelector('.nm').append(row.name, ...(of ? [' ', Object.assign(document.createElement('span'), { className: 'of', textContent: of })] : []));
    li.querySelector('.gift').textContent = row.gift;
    li.querySelector('.cost').textContent = row.costText;
    li.querySelector('.cost').hidden = !row.costText;
    const btn = li.querySelector('button');
    btn.hidden = row.top;
    btn.textContent = row.buy || '';
    btn.setAttribute('aria-disabled', String(!!row.need));
    btn.setAttribute('aria-label', row.need ? `${row.label}: ${row.need} more glim needed` : `Buy ${row.label}`);
  }
  fillBuilds();
}
let rolls = [];
function rollGlim(was) {
  for (const r of rolls) cancelAnimationFrame(r);
  rolls = [];
  const els = [...$('lampLine').querySelectorAll('b.bank')];
  let ticks = 0;
  els.forEach((el, i) => {
    const to = parseInt(el.textContent, 10), from = was[i];
    if (!Number.isFinite(from) || from === to || still) return;
    // the text is the new count at once (for a reader and the checks); what shows is data-roll, drawn over it (index.html)
    const t0 = performance.now(), tail = el.textContent.replace(/^\d+/, ''), n = Math.min(12 - ticks, Math.abs(to - from), 12);
    let shown = 0;
    ticks += n;
    el.dataset.roll = `${from}${tail}`;
    const stepRoll = now => {
      const k = Math.min(1, (now - t0) / 400), v = Math.round(from + (to - from) * k);
      if (k < 1) el.dataset.roll = `${v}${tail}`; else delete el.dataset.roll;
      while (shown < Math.floor(k * n)) { shown++; audio?.cue('tally'); }
      if (k < 1) rolls.push(requestAnimationFrame(stepRoll));
    };
    rolls.push(requestAnimationFrame(stepRoll));
  });
}
// a buy's flash on its tile: a white-gold burst over 180 ms (a 150 ms fade with reduced motion)
function flashTile(li) {
  li?.querySelector('.flash')?.animate?.([{ opacity: 0 }, { opacity: 1, offset: still ? 0.5 : 0.25 }, { opacity: 0 }], { duration: still ? 150 : 180, easing: 'ease-out' });
}
// a kindle: kindle plays and the tile's lamp catches (index.html: its flame grows from nothing over 400 ms, at once with reduced motion)
function kindledTile(id) {
  audio?.cue('kindle');
  queueMicrotask(() => flashTile($('patterns').querySelector(`li[data-pattern="${id}"]`)));
}
function buyUp(id) {
  const btn = $('ups').querySelector(`li[data-up="${id}"] button`), had = document.activeElement === btn;
  if (!buy(rs, id)) { audio?.cue('refuse'); return; }
  audio?.cue('buy');
  storeRun();
  fillLamp();
  flashTile($('ups').querySelector(`li[data-up="${id}"]`));
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
$('bLampGoOn').addEventListener('click', () => { lampFromWander = false; soundPress(); audio?.cue('choice'); reload(rs.run); storeRun(); hideCard('lamp'); retake(); go(rs.run.place); });
$('bLampWander').addEventListener('click', toWander);
$('bLampToWander').addEventListener('click', toWander);
// before Wander opens, Explore leads to the explorer, with the rest of the query kept
$('bLampExplore').addEventListener('click', () => toMode('explore'));

// the run summary: the place reached, the time, the foes put out, the glim lost and banked. Closing it clears the ended run, and the
// Lamp-room follows over the Gaol, where the next run starts with every foe back
function openSummary() {
  // the run summary plays the Lamp-room theme after 2 s of silence
  emit('lamp-room', { wait: 2 });
  // the recap (screens.js recapOf): the path as lamps, then the rows; a save from before the recap shows summaryOf's rows
  const s = recapOf(rs.ended), dl = $('summary').querySelector('dl');
  $('sumT').textContent = s.title;
  fillPath($('sumPath'), s.path);
  $('sumBy').hidden = !s.by;
  $('sumBy').textContent = s.by || '';
  fillRows(dl, s.rows, s.sparks);
  $('sumSeed').textContent = seedLineOf(rs.ended);
  openCard('summary', 'ended', () => $('bSumLamp'));
  recapIn($('summary'));
}
// the recap's path: a lamp a place, lit, snuffed, bright or dark, with its time and foes under it
function fillPath(ol, path) {
  ol.hidden = !path.length;
  ol.textContent = '';
  for (const p of path) {
    const li = document.createElement('li');
    li.className = p.state;
    li.dataset.place = p.id;
    li.setAttribute('aria-label', `${p.n} · ${p.name}: ${p.state === 'snuffed' ? 'the lamp went out here' : p.state === 'bright' ? 'lit, the win' : p.state === 'lit' ? 'passed' : 'not reached'}${p.time ? `, ${p.time}, ${p.foes} foes` : ''}`);
    li.innerHTML = '<i class="glass" aria-hidden="true"><i class="flame"></i></i><span class="n"></span><span class="ft t"></span><span class="ft f"></span>';
    li.querySelector('.n').textContent = p.n;
    li.querySelector('.t').textContent = p.time;
    li.querySelector('.f').textContent = p.foes ? `${p.foes} foes` : '';
    ol.appendChild(li);
  }
}
function fillRows(dl, rows, sparks) {
  dl.textContent = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k;
    // the sparks in their hues
    if (k === 'Sparks' && sparks) sparks.forEach((c, i) => { const x = document.createElement('i'); x.style.cssText = `color:${c.hue};font-style:normal`; x.textContent = `${c.name} ${c.n}`; dd.append(...(i ? [' · '] : []), x); });
    else dd.textContent = v;
    dl.append(dt, dd);
  }
}
/* the recap comes in: the lamps light one after another, 180 ms apart, then the rows fade in and their numbers count up over 600 ms
   with tally. The main button works at once, and a press ends the motion. Reduced motion: all at once, one 150 ms fade */
let recapAnims = [];
function recapIn(panel) {
  for (const a of recapAnims) a?.finish?.();
  recapAnims = [];
  const box = panel.querySelector('.box');
  if (still) { recapAnims.push(box.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })); return; }
  const lamps = [...panel.querySelectorAll('.rpath li')], rows = [...panel.querySelectorAll('dl dt, dl dd, p.by')];
  lamps.forEach((li, i) => recapAnims.push(li.animate?.([{ opacity: 0.25, filter: 'brightness(0.4)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 260, delay: i * 180, fill: 'backwards', easing: 'ease-out' })));
  const after = lamps.length * 180;
  rows.forEach(el => recapAnims.push(el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: after, fill: 'backwards' })));
  // the numbers count up: each dd that is a plain number, over 600 ms after the rows show, with up to 12 tally ticks in all
  const nums = [...panel.querySelectorAll('dl dd')].filter(d => /^\d+$/.test(d.textContent));
  let ticks = 0;
  for (const dd of nums) {
    const to = +dd.textContent, n = Math.min(12 - ticks, to);
    ticks += n;
    if (!to) continue;
    let shown = 0;
    const t0 = performance.now() + after, done = () => { delete dd.dataset.roll; shown = n; };
    // the text is the count at once; data-roll is what shows while it counts up (index.html)
    dd.dataset.roll = '0';
    const stepN = now => {
      if (!panel.hidden && dd.isConnected) {
        const k = Math.max(0, Math.min(1, (now - t0) / 600));
        dd.dataset.roll = String(Math.round(to * k));
        while (shown < Math.floor(k * n)) { shown++; audio?.cue('tally'); }
        if (k < 1) { recapAnims.push({ finish: done, id: requestAnimationFrame(stepN) }); return; }
      }
      done();
    };
    recapAnims.push({ finish: done, id: requestAnimationFrame(stepN) });
  }
}
// a press during the motion ends it
const recapEnd = () => { for (const a of recapAnims) { if (a?.id) cancelAnimationFrame(a.id); a?.finish?.(); } recapAnims = []; };
for (const id of ['summary', 'winCard']) $(id).addEventListener('pointerdown', recapEnd, true);
addEventListener('keydown', () => { if (mode === 'ended') recapEnd(); }, true);
// To the Lamp-room keeps its word: over the Gaol the Lamp-room opens, not the title (afterEnd)
let afterEnd = null;
$('bSumLamp').addEventListener('click', () => {
  rs.ended = null;
  storeRun();
  hideCard('summary');
  afterEnd = 'lamp';
  go(ORDER[0]);
});
/* the win card: the time, the best winning time, the glim banked in this run, the runs and the deaths. It opens the Lamp-room, where
   Wander shows from the first win, or Wander. The win is stored already, so a reload before it closes shows it again */
function openWin() {
  emit('lamp-room', { wait: 0 });
  // the rows as winOf gives them: above Ember 0 the level first, and that level's best time; and the level a win opened
  const w = winOf(rs), dl = $('winCard').querySelector('dl'), r = recapOf(rs.ended || {});
  // the win's recap: the path with every place lit and the last bright, then winOf's rows and the recap's patterns, sparks and combo
  fillPath($('winPath'), r.path);
  fillRows(dl, [...w.rows, ...r.old ? [] : r.rows.filter(([k]) => ['Patterns kept', 'Sparks', 'Best combo'].includes(k))], r.sparks);
  $('winOpened').hidden = !w.opened;
  $('winOpened').textContent = w.opened;
  $('bWinWander').hidden = !wanderOpen();
  openCard('winCard', 'ended', () => $('bWinLamp'));
  recapIn($('winCard'));
}
$('bWinLamp').addEventListener('click', () => {
  rs.ended = null;
  storeRun();
  hideCard('winCard');
  afterEnd = 'lamp';
  go(ORDER[0]);
});
$('bWinWander').addEventListener('click', () => { rs.ended = null; storeRun(); toWander(); });
// the card that a load of the page opens over the place (screens.js cardOnLoad)
function openOnLoad() {
  const card = cardOnLoad(rs, { title: TITLED }), was = afterEnd;
  afterEnd = null;
  if (card === 'title' && was === 'lamp') openLamp();
  else if (card === 'title') openTitle();
  else if (card === 'win') openWin();
  else if (card === 'summary') openSummary();
  else if (card === 'help') openRunHelp();
  else if (card === 'lamp') openLamp();
  else if (card === 'beacon') openBeacon();
}
// one step of the game clock in a run: the toast and the arrival card count down, and a place that has been played is no longer fresh
function screensTick() {
  if (mode === 'play' && rs.run) placeFresh = false;
  if (toastLeft > 0 && --toastLeft === 0) $('toast').classList.remove('on');
  if (arriveLeft > 0 && --arriveLeft === 0) {
    $('arrive').classList.add('off');
    // the place's theme starts on the first bar line after the arrival card closes (not after the boss intro's card)
    if (!bossCard) sceneOfPlace();
  }
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
  const id = meta.id;
  // a Lattice beacon opens the next Lattice place, or tells that the Lattice is lit; the downs' end card, time and best do not change
  if (LATTICE.includes(id)) {
    save.lit[id] = true;
    store(disk, save);
    updateHud();
    clearTimeout(beaconTimer);
    const nx = nextOf(id);
    if (nx) {
      toast(`The way opens to <b>${placeName(nx)}</b>`, 2600);
      beaconTimer = setTimeout(() => { if (meta.id === id && mode === 'play') go(nx); }, 2800);
    } else toast('Every beacon of the Lattice burns', 2600);
    return;
  }
  const next = ORDER[ORDER.indexOf(id) + 1];
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
  // the foes of this place, with the place: every foe back, and the foes put out kept for this place only. The seed mixes them
  // (mix.js); with ?test they stand as baked (the checks of each place rely on them) unless &mix asks for the mix
  fight = pool && !LOOK && rs.run ? makeFight({ walk, meta, world, pool, rs, max: () => maxOf(rs), still, fx, project, doc: document, mix: q.has('test') && !q.has('mix') ? false : { ember: rs.run.ember ?? 0 },
    emit, dressOf, clipOf: eliteClip, groundRelics: () => groundRelics(runner),
    groundAbilities: () => groundAbilities(runner), groundPatterns: () => groundPatterns(runner), groundSpots: () => groundSpots(runner) }) : null;
  lastRun = { seed: rs.run?.seed ?? lastRun.seed, combo: rs.run?.combo ?? 0 };
  foeTargets = fight ? () => fight.targets() : () => [];
  runner = makeRunner({
    walk, meta, body, rs, targets, still, log: cues, fx, abilities: makeAbilities, keys: makeKeys,
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
  relicEvent(e, buildPage);
  switch (e.type) {
    case 'wisp':
      setLit([meta.wisps[e.i].ids], false);
      toast(`<b>◆</b> Wisp ${e.n} of 5 · +4 glim${e.n === 5 ? ' · a flask fills' : ''}`);
      break;
    case 'beacon':
      emit('beacon-lit', { place: meta.id });
      beaconLit = true;
      setLit(meta.beacon.fire, true);
      toast('The beacon burns, and the flasks are full. Spend the glim you carry, or carry it on.', 2400);
      endAt = steps + 90;
      mode = 'lit';
      break;
    case 'win':
      emit('run-win', { ember: rs.run?.ember ?? rs.ended?.ember ?? 0 });
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
    case 'dead': emit('run-death'); endAt = steps + INK; deadAt = steps; mode = 'dying'; arriveLeft = 0; $('arrive').classList.add('off'); break;
    case 'store': storeRun(); break;
  }
  // an ability's events too: the swap hint on a lamp shows as the feet touch it, and a take or a swap at once
  if (['wisp', 'drink', 'hurt', 'fall', 'beacon', 'win', 'store', 'glim', 'foeOut', 'ability', 'cache', 'key'].includes(e.type)) updateHud();
}
/* the boss on the page: the intro stops the game for 2.4 s with its card (the bars and the zoom are fight.js's); then the boss bar
   shows and the fight starts; at the fall the bar goes, and when the light comes to the lantern a toast says where to take it */
function bossEvent(e) {
  switch (e.what) {
    case 'intro': mode = 'intro'; arriveBoss(); emit('boss-intro'); break;
    case 'start': if (mode === 'intro') mode = 'play'; bossBar(true); emit('boss-phase', { phase: 1 }); break;
    case 'phase': emit('boss-phase', { phase: e.phase }); break;
    case 'fall': bossBar(false); emit('boss-fall'); break;
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
  loadLine.textContent = `Walking to ${placeName(id)}…`;
  $('bRetry').hidden = true;
  progress(0);
  try {
    place = await loadPlace('./worlds/', id, progress);
  } catch (err) {
    loadLine.textContent = `Could not load ${placeName(id)} (${err.message}).`;
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
  blend = makeBlend(cam);
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
  life = makeLife(world, meta, { walk, still, rows: pendingRows, on: !LOOK && !q.has('nolife') });
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
  pendingRows.clear(); // cleared in place: life.js (makeLife rows) holds this set
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
    if (ORDER.includes(id) && !save.reached.includes(id)) save.reached.push(id);
    store(disk, save);
  }
  pendingRows.clear(); // the whole world is uploaded on its first frame anyway
  updateHud();
  progress(1);
  loading.classList.add('done');
  $('veil').classList.remove('on');
  mode = 'play';
  view = null;
  acc = 0;
  showHud(true);
  bossCard = false;
  arrive();
  audio?.setScene('arrive', { id }); emit('place-enter', { id, index: ORDER.indexOf(id), ember: rs?.run?.ember ?? 0 });
  if (manual && !nodraw) draw();
  if (RUN) {
    if (!rs.run && rs.ended?.won && rs.ended.place === id) { beaconLit = true; setLit(meta.beacon.fire, true); }
    openOnLoad();
    storeRun();
    // the boss files come while The Bell Knoll plays, or once play starts in Barrow Crown; never after the boss's fall
    if (!LOOK && rs.run && routeOfRun(rs.run).indexOf(id) >= 3 && !rs.run.bossDown) fetchBoss();
  } else if (!save.seen && TITLED) {
    // the explorer's first visit opens the title, where the lamps choose the place
    helpLines();
    openTitle();
  } else if (!save.seen) {
    helpLines();
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
    // the walk's time counts on the downs only
    if (ORDER.includes(meta.id)) save.time += STEP;
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
  blend.step(view, body.s);
  // ?test steps and draws by hand: the near fade and the cutaway's cut follow the step's view (the loop sets them for each frame's)
  if (manual) seen(view, body.s, STEP);
  if (veils) unveil();
  if (occluders) clearMarker();
}
/* after the steps of a frame (or of a test's tick): the bus hears foes-alert when foes wake (and again when a guard zone wakes) and
   fight-calm when none is awake, low health takes the score down, and the frame's cues are laid on the context clock */
let alertWas = { awake: false, guard: false };
function soundTick() {
  const awakeNow = fight ? fight.foes.awake().length > 0 && mode !== 'dying' : false;
  const guardZ = awakeNow ? fight?.foes.zones?.find(Z => Z.awake && Z.guard) : null;
  // the elite's drone stays with any wake of its zone: foes-alert says so while a live elite is awake
  const E = awakeNow ? fight?.foes.elite?.() : null, eliteNow = !!(E && E.zone?.awake && !E.out && E.hp > 0);
  if (awakeNow && (!alertWas.awake || (guardZ && !alertWas.guard))) emit('foes-alert', { zone: guardZ?.id ?? fight.foes.zones?.find(Z => Z.awake)?.id ?? null, guard: !!guardZ, elite: eliteNow });
  else if (!awakeNow && alertWas.awake) emit('fight-calm');
  alertWas = { awake: awakeNow, guard: !!guardZ };
  audio.setLow(!!fight?.feel.low && !!rs.run);
  audio.flush();
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
let view = null, blend = null, drawn = null, drawnBody = null;
/* the near fade and the cutaway's cut, from the eye that is drawn: v the view and b the lamplighter as the frame draws them, dt the
   time since the last (design.md "Smooth camera": set from the step's eye, at 120 Hz a frame between steps could draw the eye up to
   0.46 m from the eye they were made for, the figure a band less faded, or a splat at the cone's edge uncut) */
/* The fade is cheap and is set every frame. The cut's cone query is not (about 1.9 ms in the Bells' low passage on SwiftShader): it
   runs about once a step, from the eye of the frame it runs on, and at once where the cutaway turns on or off or the drawn eye has
   moved more than CUT_MOVE since (a fast turn); between, the eased levels carry over and the time is kept for the next run. So at
   120 Hz it costs what it cost at the step, and the eye it was made for is no more than a frame or CUT_MOVE from the drawn one */
const seenCost = { ms: 0, n: 0, cuts: 0 }, CUT_MOVE = 0.25;
let cutOf = null, cutEye = null, cutDt = 0;
function seen(v, b, dt) {
  const t0 = performance.now(), e = eyeOf(v);
  for (const r of lampFade.set(fadeOf(e, b))) pendingRows.add(r);
  if (cutOf !== cut) { cutOf = cut; cutEye = null; cutDt = 0; }
  cutDt += dt;
  const flag = !!v.cut !== !!cutEye, moved = v.cut && cutEye && Math.hypot(e[0] - cutEye[0], e[1] - cutEye[1], e[2] - cutEye[2]) > CUT_MOVE;
  if (flag || moved || cutDt >= STEP * 0.9) {
    for (const r of cut.step(v.cut ? e : null, [b.x, b.y + CUT.mid, b.z], cutDt)) pendingRows.add(r);
    cutEye = v.cut ? e : null; cutDt = 0; seenCost.cuts++;
  }
  seenCost.ms += performance.now() - t0; seenCost.n++;
}
/* o.time draws at that game time (the clips and the flicker); o.pool false parks every foe for this one draw (?test); o.view and o.body
   are the frame's blend of the last two steps (play.js makeBlend: the loop's frames between steps) */
function draw(o = {}) {
  if (!view) { view = cam.follow(body.s, 0, input); blend.reset(); }
  const t = Number.isFinite(o.time) ? o.time : time, view0 = view;
  if (o.view) view = o.view;
  // behind the title the place drifts (menu-scene.js); the follow camera is not stepped by it
  if (mode === 'title') view = titleView(view, time - titleAt, still);
  drawn = view; { const db = o.body || body.s; drawnBody = { x: db.x, y: db.y, z: db.z }; }
  pose(world.anim.bones, meta.bones, o.body || body.s, t, still);
  if (fight) {
    fight.draw(view, { time: Number.isFinite(o.time) ? o.time : undefined, pool: o.pool, art: art.h });
    fxNow.kick = fight.kick; fxNow.zoom = fight.zoom; fxNow.bars = fight.bars;
    fight.showNotches(view, mode === 'play');
    // the abilities' cooldown sweeps and seconds, each frame (only what changed is written)
    if (RUN) updateAbilities();
  } else if (RUN) { fxNow.kick = [0, 0, 0]; fxNow.zoom = 1; fxNow.bars = 0; world.anim.grade = null; }
  if (RUN) { world.anim.kick = fxNow.kick; world.anim.zoom = fxNow.zoom; world.anim.bars = fxNow.bars; }
  // the fog stays at fogNear..fogFar whatever the camera's distance (the renderer spreads it over dist ± radius)
  world.radius = Math.max(6, meta.fogFar - view.dist);
  world.fog.start = Math.max(0, Math.min(0.97, (fogNear - 2 * view.dist + meta.fogFar) / (2 * world.radius)));
  life?.draw(view, t, o.body || body.s, fightView().foes);
  try {
    renderer.render(world, { width: art.w, height: art.h, time: t, camera: view, changedRows: pool ? [...pendingRows, ...pool.rows] : [...pendingRows], colored: true });
    pendingRows.clear();
    pool?.rows.clear();
  } catch (err) {
    // a lost context can throw before its webglcontextlost event arrives: wait for webglcontextrestored, do not stop
    if (lost || canvas.getContext('webgl2')?.isContextLost()) { lost = true; view = view0; return; }
    console.warn(err); paused = true; loadLine.textContent = `The picture stopped: ${err.message}`; loading.classList.remove('done');
  }
  if (RUN) $('ink').style.opacity = world.anim.grade ? '0' : String(inkNow());
  frames++;
  view = view0;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dtRaw = last ? (now - last) / 1000 : 0;
  last = now;
  // a cue logged outside the frame's steps (a test hook, a card) is laid now
  audio?.flush();
  if (manual || paused || lost || document.hidden || window.GameSwitch?.isOpen) return;
  // the pads are read on the loading screen and in the cards too
  pollPad(dtRaw);
  if (!place || mode === 'loading') return;
  inp.read();
  mouseHint();
  // fixed steps of 1/60 s, as many as the frame took (up to 15), so a slow phone does not play in slow motion
  const c = stepCount(acc, dtRaw);
  acc = c.acc;
  audio?.begin();
  for (let i = 0; i < c.n; i++) update();
  if (audio) soundTick();
  if (c.n) inp.consumed();
  // the frame between two steps: blended by the share of a step since the last one, with the mouse's turn not yet stepped on top
  const k = acc / STEP, v = blend.view(k, input.dyaw, input.dpitch) ?? view, b = blend.body(body.s, k);
  // the cut eases by the frame's own time (no more than a slow frame's 15 steps)
  if (v) seen(v, b, Math.min(dtRaw, 15 * STEP));
  draw({ view: v ?? undefined, body: b });
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
/* ---------------- the feel's HUD and hooks (builder D) ----------------
   The combo meter: "×N" from 2 hits, a pip for the tier and a bar for the 3 s left; it fades 0.4 s after the combo ends (fight.js
   showCombo does it each frame). The seed and the best combo of the run that ended, for the summary */
function updateCombo() {
  if (rs?.run) lastRun = { seed: rs.run.seed, combo: Math.max(rs.run.combo || 0, fight?.combo.best || 0) };
  fight ? fight.showCombo(mode === 'play') : ($('combo') && ($('combo').hidden = true));
}
function seedLineOf(ended) {
  const seed = ended?.seed ?? lastRun.seed, best = ended?.combo ?? lastRun.combo;
  return `Seed ${seedCode(seed)}${best >= 2 ? ` · Best combo ×${best}` : ''}`;
}
const feelView = () => {
  const c = fight?.combo, run = rs?.run;
  return {
    combo: c ? c.view() : { n: 0, tier: 0, left: 0 }, bestCombo: Math.max(run?.combo || 0, c?.best || 0), next: runner?.fighter.nextHit() ?? 0,
    seed: run?.seed ?? null, seedCode: run ? seedCode(run.seed) : null, shake: fx.kick, mix: fight ? fight.zones.filter(z => !z.boss).map(z => ({ id: z.id, foes: z.foes, baked: z.baked, elite: z.elite ?? null })) : null
  };
};
const runState = () => {
  const run = rs?.run, f = runner?.fighter.f, k = runner?.clock;
  return {
    mode, place: run?.place ?? meta?.id, hp: run?.hp ?? 0, max: run ? maxOf(rs) : 0, flasks: run?.flasks ?? 0, flasksMax: run ? flasksOf(rs) : 0,
    carried: run?.carried ?? 0, bank: rs?.bank ?? 0, wisps: runner?.wisps.size ?? 0, wicks: run?.wicks.slice() ?? [], offer: run?.offer?.slice() ?? null,
    foes: run?.foes ?? 0, banked: run?.banked ?? 0, bossDown: !!run?.bossDown, time: run?.time ?? 0, entry: run ? { ...run.entry } : null,
    step: k?.step ?? 0, playStep: k?.play ?? 0, stop: k?.stop ?? 0, ended: rs?.ended ? { ...rs.ended } : null,
    ...buildsView(),
    ...growthView(),
    ...abilityView(),
    move: f?.move ?? null, hit: f?.move === 'hit' ? hitOf(f.hit).id : null, t: f ? f.t / 60 : 0, safe: runner?.fighter.safe() ?? null, combo: runner?.fighter.nextHit() ?? 0,
    fx: {
      kick: fxNow.kick.slice(), zoom: fight ? fight.feel.zoom() : fxNow.zoom, bars: fight ? fight.feel.bars() : fxNow.bars, grade: (fight?.cols || meta?.pal || []).slice(), blink: !!body?.s.hide,
      low: !!fight?.feel.low, beats: fight?.feel.beats ?? 0, tell: fight?.grow ?? 1,
      shakes: fight ? fight.feel.shakes() : !!fx.kick, lamp: fight ? fight.lamp ?? 1 : 1, halo: fight ? fight.halo.filter(g => g.kind === 'halo').map(g => g.ci) : []
    },
    ...feelView()
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
    // drawn: the view the last frame drew (between steps, the blend of the last two with the mouse's turn since on top), and where it
    // drew the lamplighter
    cam: cam ? { drawn: drawn ? { yaw: drawn.yaw, pitch: drawn.pitch, dist: drawn.dist, target: drawn.target.slice(), cut: !!drawn.cut, body: drawnBody && { ...drawnBody } } : null, yaw: cam.c.yaw, dist: cam.c.dist, pitch: cam.c.pitch, want: cam.c.want, fov: cam.c.fov, aim: cam.c.aim, lift: cam.c.lift, view: view ? view.pitch : null, foe: combat?.foe?.id ?? null, turning: cam.c.turning, idle: cam.c.idle,
      boss: bossCam ? { on: bossCam.b.on, w: bossCam.b.w, dist: view?.dist ?? null, aim: view?.target ?? null, goal: bossCam.b.goal?.dist ?? null, cur: bossCam.b.cur?.dist ?? null, room: bossCam.b.dist, lift: bossCam.b.lift, clear: bossCam.b.goal?.clear ?? null } : null } : null,
    // the pieces of scenery faded in front of the boss's marker (veil.js makeOccluders), or null away from Barrow Crown's run
    occluded: occluders ? occluders.faded() : null,
    // the near fade's share now (play.js fadeOf: 0 to 1, or NEAR_FADE.all with the whole figure left out)
    fade: lampFade?.k ?? 0,
    // the time the near fade and the cut took over the frames so far (ms in all, how many frames, and how many of them ran the cut)
    seen: { ...seenCost },
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
    audio?.begin();
    for (let i = 0; i < n; i++) {
      if (held === 'live') { pollPad(STEP); if (mode !== 'loading') inp.read(); }
      else {
        Object.assign(input, { mx: 0, mz: 0, jump: false, slow: false, ox: 0, oy: 0, attack: false, roll: false, heal: false, ab1: false, ab2: false }, held);
        if (held.look && !lookWas && mode === 'play') face();
        lookWas = !!held.look;
      }
      if (place && mode !== 'loading') { update(); inp.consumed(); }
    }
    mouseHint();
    if (audio) soundTick();
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
      // the combo now, with the full 3 s left (fight.js combo)
      if (Number.isFinite(o.combo) && fight) { fight.combo.set(o.combo); run.combo = Math.max(run.combo || 0, fight.combo.best); }
    }
    // the boss's health: the phase of that health at once, with one hit stop of 9 steps and one stumble of 2 s
    if (Number.isFinite(o.bossHp) && fight?.boss) { fight.hooks.bossHp(o.bossHp); fillBossBar(); }
    setBuilds(o);
    setGrowth(o);
    // the abilities: slots ([{ id, bright } | null, same]), the seconds of cooldown left on each, and the keys held
    if (run && Array.isArray(o.abilities)) run.abilities = [0, 1].map(i => { const a = o.abilities[i]; return a && abilityOf(a.id) ? { id: a.id, bright: !!a.bright } : null; });
    if (Array.isArray(o.cool)) runner?.abilities?.setCool(o.cool);
    if (Array.isArray(o.keys)) rs.keys = [...new Set(o.keys.filter(k => k === 'leap' || k === 'drop'))];
    // the title's lamps: the furthest place reached and the runs played
    if (Number.isInteger(o.furthest)) rs.furthest = Math.max(0, Math.min(ORDER.length - 1, o.furthest));
    if (Number.isInteger(o.runs)) rs.runs = Math.max(0, o.runs);
    if (o.seen === true || o.seen === false) rs.seen = o.seen;
    if (mode === 'title') fillTitle();
    if (run && Array.isArray(o.abilityLamps)) run.abilityLamps = o.abilityLamps.filter(l => abilityOf(l.id)).map(l => ({ id: l.id, bright: !!l.bright, place: run.place, x: +l.x, y: +l.y, z: +l.z }));
    if (Array.isArray(o.abilities) || Array.isArray(o.keys)) showControls();
    updateHud();
    if (mode === 'lamp') fillLamp();
    storeRun();
    return runState();
  },
  fx: (flags = {}) => { for (const k of ['stop', 'flash', 'kick', 'zoom', 'grade', 'shake', 'trail', 'combo', 'lamp']) if (k in flags) fx[k] = !!flags[k]; return { ...fx }; },
  sounds: () => cues.map(c => ({ ...c })),
  // the score's state (run-sound.js view): state, place, theme, layers, phase, bpm, bar, the last 32 changes, the mix and the buses
  music: () => (audio ? audio.view() : null),
  // ?test: start the sound as a press would, and flush the cues logged since the last frame
  sound: (o = {}) => { if (!audio) return null; if (o.start) soundPress(); if (o.flush) audio.flush(); return audio.view(); },
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
  // the selection screens (?test): the bus's screen events, the title's lamps and its line, and the open card's motion
  screens: () => ({
    bus: screenLog.map(e => ({ ...e })), titleAt, line: $('titleLine').textContent, seed: $('titleSeed').textContent,
    lamps: [...$('titleLamps').querySelectorAll('.lamp')].map(b => ({ id: b.dataset.place, lit: b.classList.contains('lit'), on: b.classList.contains('on'), disabled: b.disabled })),
    anims: document.getAnimations().filter(a => a.playState === 'running').map(a => ({ id: a.effect?.target?.id || a.effect?.target?.className || '', ms: a.effect?.getComputedTiming().endTime ?? 0 }))
  }),
  pool: () => pool && { count: world.count, boned: world.anim.boned.length, extra: pool.extra.end - pool.extra.first, slots: pool.slots.map(s => ({ i: s.i, code: s.code, awake: s.awake, first: s.first, end: s.end, base: s.base, at: s.at })) },
  life: o => life?.test(o) ?? null,
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
    // no WebGL 2 at all, or a WebGL 2 that refused the renderer (a shader, a limit): say which, with the chip and the error
    let gl = null;
    try { gl = document.createElement('canvas').getContext('webgl2'); } catch {}
    if (!gl) {
      loadLine.textContent = 'Gloam Downs needs WebGL 2, and this browser does not have it. Try a recent Chrome, Firefox or Safari.';
    } else {
      let chip = '';
      try { const d = gl.getExtension('WEBGL_debug_renderer_info'); chip = String(gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch {}
      const fu = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
      const why = String(err?.message || err).split('\n').find(l => /error|fail|limit|exceed/i.test(l)) || String(err?.message || err).split('\n')[0];
      loadLine.textContent = `Gloam Downs could not start its renderer on this graphics chip. Chip: ${chip || 'unknown'} (fragment uniforms ${fu}). Error: ${why.slice(0, 200)}`;
    }
    console.error(err);
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
  await go(startPlace(q, save));
})();
