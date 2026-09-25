// Crimson Rouge: a third-person boss fight in the ink-dark hills of Sedona.
// One of the cottage crew, as a ronin, against Gabe the mountain man, who turns into a grizzly.
// Black-and-white ink; the only color is Gabe's neon, and neon means danger.
import * as THREE from 'three';
import { scene, camera, post, draw } from './js/render.js';
import { buildWorld, ARENA, colliders, groundHeight, grassUniforms, followLights, FACE_DIR } from './js/world.js';
import { fx, updateFX, Trail, glowTex } from './js/fx.js';
import { Audio } from './js/audio.js';
import { loadActor, makeKatana } from './js/actors.js';

const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const GOD = new URLSearchParams(location.search).has('god');
const NEON3 = new THREE.Color(0.72, 1.0, 0.1);

/* ------------------------------------------------------------------ the crew */
const CREW = [
  { name: 'Tank Top', perk: 'Hits 20% harder', apply: (s) => { s.dmg *= 1.2; } },
  { name: 'Fifty-One', perk: '20% more life', apply: (s) => { s.maxHp = 120; } },
  { name: 'Shades', perk: 'Wider parry window', apply: (s) => { s.parryWin = 0.27; } },
  { name: 'New Balance', perk: 'Dodges cost less ki', apply: (s) => { s.dodgeCost *= 0.6; } },
  { name: 'Red Jersey', perk: 'Moves 12% faster', apply: (s) => { s.speed *= 1.12; } },
];
let crewPick = 2;
try { const saved = +localStorage.getItem('crimson.crew'); if (saved >= 0 && saved < CREW.length) crewPick = saved; } catch (e) { /* storage blocked */ }

/* ------------------------------------------------------------------ moves */
// Times are in seconds of the source clip. A cut is a slice of a clip; hits, lunges, and
// cancels use the same clock, so they line up with the motion.
const RONIN_CUTS = {
  l1: ['combo', 0.25, 1.12], l2: ['combo', 1.12, 1.9], l3: ['combo', 1.9, 3.0],
  hvy: ['heavy', 0.2, 2.05], db: ['thrust', 0.0, 1.9], guard: ['block', 1.0, 3.3], defl: ['parry', 0.2, 1.4],
  rollc: ['roll', 0.25, 1.6], down: ['knock', 0.0, 1.4], sip: ['drink', 2.8, 5.6],
};
const PATK = {
  l1: { cut: 'l1', from: 0.25, speed: 1.3, hit: [0.64, 0.86], dmg: 20, post: 5, reach: 2.4, arc: 1.25, cost: 12, next: 'l2', cancel: 0.98, lunge: [0.5, 0.8, 3.2], snd: 'slash' },
  l2: { cut: 'l2', from: 1.12, speed: 1.3, hit: [1.42, 1.62], dmg: 22, post: 5, reach: 2.4, arc: 1.25, cost: 12, next: 'l3', cancel: 1.72, lunge: [1.3, 1.55, 3.2], snd: 'slash' },
  l3: { cut: 'l3', from: 1.9, speed: 1.2, hit: [2.16, 2.38], dmg: 30, post: 8, reach: 2.5, arc: 1.0, cost: 14, next: 'l1', cancel: 2.7, lunge: [2.0, 2.3, 4.2], snd: 'heavy' },
  heavy: { cut: 'hvy', from: 0.2, speed: 1.15, hit: [1.08, 1.3], dmg: 55, post: 16, reach: 2.7, arc: 1.0, cost: 26, cancel: 1.75, lunge: [0.85, 1.25, 5], snd: 'heavy' },
  deathblow: { cut: 'db', from: 0.0, speed: 1.0, hit: [0.68, 0.86], dmg: 0, post: 0, reach: 4.2, arc: 1.7, cost: 0, cancel: 1.7, lunge: [0.4, 0.78, 7], snd: 'heavy' },
};
// Gabe's clips; the cut ranges and hit times come from measuring each clip's strike peaks
const GABE_CUTS = {
  jabs: ['punches', 0.2, 2.3], kick: ['kick', 0.9, 3.0], fly: ['flykick', 0.8, 4.2], counter: ['counter', 1.6, 5.9], grab: ['grab', 1.6, 4.7],
};
const BEAR_CUTS = {
  sweep: ['sweep', 1.2, 4.9], chop: ['chop', 2.6, 6.2], smash: ['smash', 0.0, 1.87], slam: ['slam', 0.0, 2.9],
};
// Boss moves. hits: [t0, t1, shape]; shape is { reach, arc } or { aoe: [forward, radius] }.
const GABE_ATK = {
  jabs: { cut: 'jabs', from: 0.2, speed: 1.05, tell: 0.35, track: 1.0, limb: 'LeftHand', limb2: 'RightHand', hits: [[0.58, 0.76, { reach: 2.3, arc: 0.7 }], [1.18, 1.38, { reach: 2.4, arc: 0.7 }]], dmg: 13, pp: 16, bc: 12, lunges: [[0.4, 0.7, 2.8], [1.0, 1.3, 2.8]], snd: 'punch' },
  kick: { cut: 'kick', from: 0.9, speed: 1.05, tell: 1.5, track: 1.9, limb: 'LeftFoot', hits: [[2.0, 2.3, { reach: 3.0, arc: 1.4 }]], dmg: 22, pp: 24, bc: 26, lunges: [[1.4, 2.1, 4]], snd: 'bossSwing' },
  fly: { cut: 'fly', from: 0.8, speed: 1.1, tell: 1.4, track: 1.6, limb: 'RightFoot', hits: [[2.8, 3.06, { reach: 2.6, arc: 0.9 }]], dmg: 24, pp: 26, bc: 26, leap: [1.5, 2.8], knock: true, snd: 'bossSwing' },
  counter: { cut: 'counter', from: 1.6, speed: 1.4, tell: 4.4, track: 4.9, limb: 'LeftHand', hits: [[5.0, 5.24, { reach: 2.6, arc: 0.8 }]], dmg: 20, pp: 24, bc: 20, dodge: [1.6, 3.4], lunges: [[4.7, 5.1, 4]], snd: 'punch' },
  grab: { cut: 'grab', from: 1.6, speed: 1.0, tell: 1.9, track: 2.6, limb: 'RightHand', unblock: true, hits: [[2.72, 3.05, { reach: 2.4, arc: 0.8 }]], throwAt: 3.55, dmg: 30, lunges: [[2.4, 2.95, 6]], snd: 'bossSwing' },
};
const BEAR_ATK = {
  sweep: { cut: 'sweep', from: 1.2, speed: 1.0, tell: 1.8, track: 2.35, limb: 'RightHand', hits: [[2.45, 2.75, { reach: 4.6, arc: 1.6 }], [3.2, 3.5, { reach: 4.6, arc: 1.6 }]], dmg: 22, pp: 20, bc: 28, lunges: [[2.3, 2.75, 3.5], [3.05, 3.5, 3]], snd: 'bossSwing' },
  chop: { cut: 'chop', from: 2.6, speed: 1.0, tell: 3.6, track: 4.15, limb: 'RightHand', hits: [[4.3, 4.55, { reach: 4.8, arc: 0.55 }]], dmg: 32, pp: 32, bc: 40, lunges: [[4.1, 4.5, 5]], impact: 4.45, snd: 'bossSwing' },
  smash: { cut: 'smash', from: 0, speed: 1.0, tell: 0.9, track: 1.3, limb: 'LeftHand', hits: [[1.45, 1.66, { aoe: [2.7, 2.5] }]], dmg: 30, pp: 28, bc: 45, knock: true, impact: 1.57, snd: 'bossSwing' },
  slam: { cut: 'slam', from: 0, speed: 1.0, tell: 0.9, track: 1.3, limb: 'RightHand', hits: [[1.58, 1.8, { aoe: [1.4, 4.3] }]], dmg: 34, pp: 30, bc: 55, knock: true, impact: 1.67, snd: 'bossSwing' },
  charge: { charge: true, unblock: true, limb: 'Head', hits: [[0, 0, null]], dmg: 30, knock: true, windup: 0.9, run: 1.5 },
};

/* ------------------------------------------------------------------ state */
const game = { state: 'loading', time: 0, phase2: false, hitstop: 0, slow: 1, slowT: 0, deaths: 0, parries: 0, fightStart: 0, flash: 0, hurt: 0, ready: false };
Audio.phase2 = () => game.phase2;
const input = { keys: {}, mouse: { l: false, r: false }, buf: { light: -9, heavy: -9, dodge: -9, heal: -9, parry: -9 }, move: new THREE.Vector2(), pad: null, padPrev: [], usingPad: false };
const cam = { yaw: 0, pitch: 0.2, dist: 4.4, punch: 0, shake: 0, lock: true, look: new THREE.Vector3(), pos: new THREE.Vector3() };
let player, boss, ronin, gabe, bear, katana;
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const SPAWN_P = FACE_DIR.clone().multiplyScalar(-8), SPAWN_B = FACE_DIR.clone().multiplyScalar(6);
const ground = (p) => groundHeight(p.x, p.z);

/* ------------------------------------------------------------------ load */
buildWorld();
const pressEl = document.querySelector('#title .press');
pressEl.textContent = 'LOADING THE HILLS…';
async function loadAll() {
  [ronin, gabe, bear] = await Promise.all([
    loadActor('models/ronin.glb', { outline: 0.012, cuts: RONIN_CUTS }),
    loadActor('models/gabe.glb', { outline: 0.016, glow: 0.35, scale: 1.2, cuts: GABE_CUTS }),
    loadActor('models/bear.glb', { outline: 0.022, glow: 0.5, scale: 1.15, cuts: BEAR_CUTS }),
  ]);
  katana = makeKatana();
  const hand = ronin.bone('RightHand');
  ronin.root.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); hand.getWorldScale(ws);
  katana.scale.setScalar(1 / ws.x);
  katana.position.set(0, 0.07 / ws.x, 0.02 / ws.x);
  katana.rotation.set(Math.PI / 2, 0, 0);
  hand.add(katana);
  bear.visible = false;
  // neon glows that ride on Gabe's striking limbs
  for (const a of [gabe, bear]) {
    a.limbGlow = {};
    a.root.updateMatrixWorld(true);
    for (const name of ['RightHand', 'LeftHand', 'RightFoot', 'LeftFoot', 'Head']) {
      const b = a.bone(name); if (!b) continue;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: NEON3, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }));
      const w = new THREE.Vector3(); b.getWorldScale(w);
      s.scale.setScalar((a === bear ? 1.6 : 0.9) / w.x);
      b.add(s); a.limbGlow[name] = s;
    }
  }
  makePlayer(); makeBoss();
  game.ready = true; game.state = 'title';
  pressEl.textContent = 'PRESS ANY KEY TO FIGHT';
}
loadAll().catch((e) => { console.error(e); pressEl.textContent = 'COULD NOT LOAD THE MODELS'; });

function makePlayer() {
  const f = CREW[crewPick];
  const stats = { maxHp: 100, dmg: 1, speed: 4.6, parryWin: 0.2, dodgeCost: 22 };
  f.apply(stats);
  player = {
    a: ronin, f, stats, pos: SPAWN_P.clone(), vel: new THREE.Vector3(), face: Math.atan2(FACE_DIR.x, FACE_DIR.z),
    hp: stats.maxHp, st: 100, stDelay: 0, gourds: 3, state: 'move', t: 0, atk: null, combo: null, comboT: -9,
    hitDone: false, parryT: -9, parryPresses: [], iframe: false, speedNow: 0, dodgeDir: new THREE.Vector3(), healed: false,
    trail: player?.trail || new Trail(22, new THREE.Color(2.2, 2.2, 2.2), true),
  };
  ronin.play('idle', { fade: 0 });
}
function makeBoss() {
  boss = {
    form: 'gabe', a: gabe, pos: SPAWN_B.clone(), face: Math.atan2(-FACE_DIR.x, -FACE_DIR.z), hp: 1000, maxHp: 1000, posture: 0, postureT: 0,
    state: 'wait', t: 0, atk: null, queue: [], cooldown: 1.2, last: '', lastLast: '', strafe: 1, strafeT: 0, speedNow: 0, flinch: 0,
    hitsDone: new Set(), leapFrom: new THREE.Vector3(), leapTo: new THREE.Vector3(), air: 0, rage: 0, glow: 0, told: false, impacted: false,
    trail: boss?.trail || new Trail(20, new THREE.Color(0.9, 1.4, 0.15), true), swapped: false, snd: new Set(),
  };
  gabe.visible = true; bear.visible = false;
  gabe.play('idle', { fade: 0 }); bear.play('idle', { fade: 0 });
  setBossName();
}
function radius() { return boss.form === 'bear' ? 1.15 : 0.55; }
function setBossName() {
  document.querySelector('#boss .name').innerHTML = boss.form === 'bear' ? 'GABE, THE GRIZZLY OF SEDONA<small>熊</small>' : 'GABE, THE MOUNTAIN MAN<small>山男</small>';
}

/* ------------------------------------------------------------------ input */
const KEYMAP = { KeyJ: 'light', KeyK: 'heavy', KeyQ: 'heavy', Space: 'dodge', KeyR: 'heal', KeyE: 'heal' };
const canvas = $('view');
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  input.usingPad = false;
  input.keys[e.code] = true;
  if (game.state === 'title') { titleKey(e); return; }
  if (game.state === 'intro') { endIntro(); return; }
  if (game.state === 'end') { if (performance.now() - endShownAt > 900) restart(); return; }
  if (game.state === 'paused') { if (e.code === 'Escape' || e.code === 'Enter') resume(); return; }
  if (game.state !== 'fight') return;
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (KEYMAP[e.code]) input.buf[KEYMAP[e.code]] = game.time;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') input.buf.parry = game.time;
  if (e.code === 'Tab') toggleLock();
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('contextmenu', (e) => { if (game.state === 'fight') e.preventDefault(); });
canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'fight') return;
  input.usingPad = false;
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (err) { /* not allowed */ } }
  if (e.button === 0) { input.mouse.l = true; input.buf.light = game.time; }
  if (e.button === 2) { input.mouse.r = true; input.buf.parry = game.time; }
  if (e.button === 1) { e.preventDefault(); toggleLock(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.mouse.l = false; if (e.button === 2) input.mouse.r = false; });
addEventListener('mousemove', (e) => {
  if (game.state !== 'fight' || document.pointerLockElement !== canvas) return;
  cam.yaw -= e.movementX * 0.0024;
  cam.pitch = clamp(cam.pitch + e.movementY * 0.002, -0.3, 0.85);
  if (cam.lock && Math.abs(e.movementX) > 60) cam.lock = false;
});
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) hadLock = true;
  else if (hadLock && game.state === 'fight') pause();
});
function toggleLock() { cam.lock = !cam.lock; if (cam.lock) cam.yaw = angleTo(player.pos, boss.pos); }
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null; for (const p of pads) if (p && p.connected) { pad = p; break; }
  input.pad = pad;
  if (!pad) return;
  const b = pad.buttons.map((x) => x.pressed), prev = input.padPrev, edge = (i) => b[i] && !prev[i];
  if (b.some((x) => x) || pad.axes.some((a) => Math.abs(a) > 0.4)) input.usingPad = true;
  if (game.state === 'title') { if (edge(14)) pickCrew(crewPick - 1); if (edge(15)) pickCrew(crewPick + 1); if (edge(0) || edge(9)) startGame(); }
  else if (game.state === 'intro') { if (b.some((x, i) => x && !prev[i])) endIntro(); }
  else if (game.state === 'end') { if ((edge(0) || edge(9)) && performance.now() - endShownAt > 900) restart(); }
  else if (game.state === 'paused') { if (edge(9) || edge(0)) resume(); }
  else if (game.state === 'fight') {
    if (edge(5)) input.buf.light = game.time;
    if (edge(3) || edge(7)) input.buf.heavy = game.time;
    if (edge(0) || edge(1)) input.buf.dodge = game.time;
    if (edge(2)) input.buf.heal = game.time;
    if (edge(4)) input.buf.parry = game.time;
    if (edge(11)) toggleLock();
    if (edge(9)) pause();
  }
  input.padPrev = b;
}

/* ------------------------------------------------------------------ HUD */
const hud = {
  el: $('hud'), bossFill: document.querySelector('#bossHp .fill'), bossGhost: document.querySelector('#bossHp .ghost'), posture: document.querySelector('#posture i'), postureBox: $('posture'),
  hpFill: document.querySelector('#hp .fill'), hpGhost: document.querySelector('#hp .ghost'), stFill: document.querySelector('#st .fill'), stBox: $('st'),
  gourds: [...document.querySelectorAll('#gourds b')], hint: $('hint'), reticle: $('reticle'), danger: $('danger'), pop: $('pop'), hurt: $('hurt'), card: $('card'),
};
function pop(text, hot) { hud.pop.textContent = text; hud.pop.className = ''; void hud.pop.offsetWidth; hud.pop.className = 'show' + (hot ? ' red' : ''); }
function danger() { hud.danger.className = ''; void hud.danger.offsetWidth; hud.danger.className = 'show'; }
let hintPad = null;
function updateHud() {
  const f = Math.max(0, boss.hp / boss.maxHp);
  hud.bossFill.style.transform = `scaleX(${f})`; hud.bossGhost.style.transform = `scaleX(${f})`;
  hud.posture.style.width = `${Math.min(100, boss.posture)}%`;
  hud.postureBox.classList.toggle('hot', boss.posture > 70 || boss.state === 'broken');
  const h = Math.max(0, player.hp / player.stats.maxHp);
  hud.hpFill.style.transform = `scaleX(${h})`; hud.hpGhost.style.transform = `scaleX(${h})`;
  hud.stFill.style.transform = `scaleX(${Math.max(0, player.st / 100)})`;
  hud.stBox.classList.toggle('empty', player.st < 15);
  hud.gourds.forEach((g, i) => g.classList.toggle('used', i >= player.gourds));
  const chestY = ground(boss.pos) + (boss.form === 'bear' ? 2.6 : 1.5) + boss.air - (boss.state === 'broken' ? 0.6 : 0);
  const chest = tmpA.set(boss.pos.x, chestY, boss.pos.z).project(camera);
  const on = (cam.lock || boss.state === 'broken') && chest.z < 1 && boss.state !== 'dead' && boss.state !== 'transform';
  hud.reticle.classList.toggle('on', on);
  hud.reticle.classList.toggle('broken', boss.state === 'broken');
  hud.reticle.style.left = `${(chest.x * 0.5 + 0.5) * innerWidth}px`;
  hud.reticle.style.top = `${(-chest.y * 0.5 + 0.5) * innerHeight}px`;
  const soon = boss.state === 'attack' && boss.nextHit != null && !boss.atk.spec.unblock && boss.nextHit - boss.clipT < 0.45 && boss.nextHit - boss.clipT > -0.1;
  hud.hint.classList.toggle('pulse', !!soon);
  if (hintPad !== input.usingPad) {
    hintPad = input.usingPad;
    hud.hint.innerHTML = hintPad ? 'Hold <kbd>LB</kbd> to parry<small>Tap it as the blow lands to deflect · keep holding to block</small>'
      : 'Hold <kbd>LB</kbd> to parry<small>Keyboard: hold <kbd>Shift</kbd> or right mouse · tap as the blow lands to deflect</small>';
  }
  hud.hurt.style.opacity = game.hurt.toFixed(2);
}

/* ------------------------------------------------------------------ player */
function camBasis() { return [new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)), new THREE.Vector3(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw))]; }
function spend(n) { player.st -= n; player.stDelay = 0.65; }
function startPlayerAttack(name) {
  const p = player, spec = PATK[name];
  p.state = 'attack'; p.t = 0; p.atk = { name, spec }; p.hitDone = false; p.sndDone = false;
  spend(spec.cost);
  ronin.play(spec.cut, { loop: false, speed: spec.speed, fade: 0.08, restart: true });
  if (cam.lock || boss.state === 'broken') p.face = angleTo(p.pos, boss.pos);
  else if (input.move.lengthSq() > 0.01) { const [f, r] = camBasis(); p.face = Math.atan2(f.x * input.move.y + r.x * input.move.x, f.z * input.move.y + r.z * input.move.x); }
}
const clipTime = (spec) => spec.from + ronin.t;
function tryAct() {
  const p = player, now = game.time, buf = input.buf, fresh = (k) => now - buf[k] < 0.32;
  const ct = p.state === 'attack' ? clipTime(p.atk.spec) : 0;
  const canCancel = p.state === 'move' || p.state === 'guard' || (p.state === 'attack' && ct >= p.atk.spec.cancel);
  if (fresh('dodge') && (canCancel || (p.state === 'attack' && ct > p.atk.spec.hit[1] + 0.05)) && p.st > 4) {
    buf.dodge = -9;
    const [f, r] = camBasis();
    const dir = new THREE.Vector3().addScaledVector(f, input.move.y).addScaledVector(r, input.move.x);
    if (dir.lengthSq() < 0.01) dir.set(-Math.sin(p.face), 0, -Math.cos(p.face));
    dir.normalize(); p.dodgeDir.copy(dir); p.face = Math.atan2(dir.x, dir.z);
    p.state = 'dodge'; p.t = 0; spend(p.stats.dodgeCost);
    ronin.play('rollc', { loop: false, speed: 1.75, fade: 0.06, restart: true });
    Audio.play('dodge'); fx.dust(p.pos, 4, 0.6);
    return;
  }
  if (fresh('parry') && (p.state === 'move' || p.state === 'guard' || (p.state === 'attack' && (ct < p.atk.spec.hit[0] || ct > p.atk.spec.hit[1])))) {
    buf.parry = -9;
    p.parryPresses = p.parryPresses.filter((t) => now - t < 1.0); p.parryPresses.push(now);
    p.parryT = now; p.state = 'guard'; p.t = 0;
    ronin.play('guard', { speed: 0.35, fade: 0.06 });
  }
  if (!canCancel) return;
  if (fresh('heal') && p.gourds > 0 && p.state !== 'attack') {
    buf.heal = -9; p.gourds--; p.state = 'heal'; p.t = 0; p.healed = false; Audio.play('drink');
    ronin.play('sip', { loop: false, speed: 2.0, fade: 0.15, restart: true });
    return;
  }
  const nearBroken = boss.state === 'broken' && flatDist(p.pos, boss.pos) < 5;
  if (fresh('light') && p.st > 0) {
    buf.light = -9;
    if (nearBroken) { startPlayerAttack('deathblow'); return; }
    let name = 'l1';
    if (p.state === 'attack' && p.atk.spec.next && p.atk.name !== 'heavy') name = p.atk.spec.next;
    else if (now - p.comboT < 0.45 && p.combo) name = PATK[p.combo].next || 'l1';
    p.combo = name; p.comboT = now;
    startPlayerAttack(name); return;
  }
  if (fresh('heavy') && p.st > 0) {
    buf.heavy = -9;
    if (nearBroken) { startPlayerAttack('deathblow'); return; }
    p.combo = null; startPlayerAttack('heavy');
  }
}
function updatePlayer(dt) {
  const p = player;
  const parryHeld = input.keys.ShiftLeft || input.keys.ShiftRight || input.keys.KeyF || input.mouse.r || (input.pad && input.pad.buttons[4]?.pressed);
  let mx = (input.keys.KeyD ? 1 : 0) - (input.keys.KeyA ? 1 : 0), my = (input.keys.KeyW ? 1 : 0) - (input.keys.KeyS ? 1 : 0);
  if (input.pad) {
    const ax = input.pad.axes;
    if (Math.hypot(ax[0], ax[1]) > 0.18) { mx = ax[0]; my = -ax[1]; }
    if (Math.hypot(ax[2], ax[3]) > 0.18) { cam.yaw -= ax[2] * 2.6 * dt; cam.pitch = clamp(cam.pitch + ax[3] * 1.6 * dt, -0.3, 0.85); if (cam.lock && Math.abs(ax[2]) > 0.95) cam.lock = false; }
  }
  input.move.set(mx, my); if (input.move.lengthSq() > 1) input.move.normalize();
  const [f, r] = camBasis();
  const want = new THREE.Vector3().addScaledVector(f, input.move.y).addScaledVector(r, input.move.x);
  const busy = ['dead', 'grabbed', 'down', 'hit', 'broken', 'heal', 'dodge', 'victory'].includes(p.state) || (p.state === 'deflect' && p.t < 0.12);
  if (!busy) tryAct();
  p.t += dt;
  let speed = 0;
  const toBoss = angleTo(p.pos, boss.pos);
  switch (p.state) {
    case 'move': {
      speed = want.length() * p.stats.speed;
      if (speed > 0.1) p.face += angDiff(p.face, Math.atan2(want.x, want.z)) * Math.min(1, dt * 12);
      else if (cam.lock && boss.state !== 'dead') p.face += angDiff(p.face, toBoss) * Math.min(1, dt * 6);
      if (p.speedNow > 0.5) ronin.play('run', { speed: clamp(p.speedNow / 5, 0.55, 1.1), fade: 0.18 });
      else ronin.play('idle', { fade: 0.22 });
      break;
    }
    case 'guard':
      speed = want.length() * p.stats.speed * 0.4;
      p.face += angDiff(p.face, toBoss) * Math.min(1, dt * 10);
      if (!parryHeld && p.t > 0.12) { p.state = 'move'; p.t = 0; }
      break;
    case 'deflect':
      if (p.t > 0.34) { p.state = parryHeld ? 'guard' : 'move'; p.t = 0.2; if (p.state === 'guard') ronin.play('guard', { speed: 0.35, fade: 0.1 }); }
      break;
    case 'attack': {
      const s = p.atk.spec, ct = clipTime(s);
      if (ct >= s.lunge[0] && ct <= s.lunge[1]) {
        const d = flatDist(p.pos, boss.pos) - radius();
        if (d > 1.2) { p.pos.x += Math.sin(p.face) * s.lunge[2] * dt; p.pos.z += Math.cos(p.face) * s.lunge[2] * dt; }
      }
      if (ct < s.hit[0] && (cam.lock || p.atk.name === 'deathblow')) p.face += angDiff(p.face, toBoss) * Math.min(1, dt * 10);
      if (!p.sndDone && ct >= s.hit[0] - 0.06) { p.sndDone = true; Audio.play(s.snd); }
      if (!p.hitDone && ct >= s.hit[0] && ct <= s.hit[1]) playerHitCheck();
      if (ronin.done) { p.state = 'move'; p.t = 0; p.comboT = game.time; }
      break;
    }
    case 'dodge':
      p.iframe = p.t > 0.03 && p.t < (p.f.name === 'New Balance' ? 0.44 : 0.38);
      p.pos.addScaledVector(p.dodgeDir, (p.t < 0.45 ? 7.2 : 2) * dt);
      if (p.t >= 0.62) { p.state = 'move'; p.t = 0; p.iframe = false; }
      break;
    case 'hit': if (p.t > 0.5) { p.state = 'move'; p.t = 0; } break;
    case 'broken': if (p.t > 1.1) { p.state = 'move'; p.t = 0; } break;
    case 'down': if (p.t > 1.1 && ronin.cur === 'down') ronin.play('idle', { fade: 0.5 }); if (p.t > 1.7) { p.state = 'move'; p.t = 0; } break;
    case 'heal':
      speed = want.length() * 1.2;
      if (!p.healed && p.t > 0.8) { p.healed = true; p.hp = Math.min(p.stats.maxHp, p.hp + 40); pop('+ LIFE'); }
      if (p.t > 1.3) { p.state = 'move'; p.t = 0; }
      break;
    case 'victory': ronin.play('idle', { speed: 0.6, fade: 0.6 }); break;
  }
  if (p.state === 'move' || p.state === 'guard' || p.state === 'heal') {
    const v = want.clone().multiplyScalar(speed);
    p.vel.x = damp(p.vel.x, v.x, 12, dt); p.vel.z = damp(p.vel.z, v.z, 12, dt);
    p.pos.addScaledVector(p.vel, dt);
    p.speedNow = Math.hypot(p.vel.x, p.vel.z);
  } else { p.vel.set(0, 0, 0); p.speedNow = 0; }
  p.stDelay -= dt;
  if (p.stDelay <= 0) p.st = Math.min(100, p.st + (p.state === 'guard' ? 12 : 34) * dt);
  collide(p.pos, 0.4);
  if (p.state !== 'grabbed' && p.state !== 'dead') {
    const d = flatDist(p.pos, boss.pos), min = radius() + 0.55;
    if (d < min && d > 0.001) { const k = (min - d) / d; p.pos.x += (p.pos.x - boss.pos.x) * k; p.pos.z += (p.pos.z - boss.pos.z) * k; }
  }
  const y = p.state === 'grabbed' ? ronin.root.position.y : ground(p.pos);
  ronin.root.position.set(p.pos.x, y, p.pos.z);
  ronin.root.rotation.y = p.face;
  ronin.update(dt);
  ronin.root.updateMatrixWorld(true);
  const ct = p.state === 'attack' ? clipTime(p.atk.spec) : 0;
  const swinging = p.state === 'attack' && ct > p.atk.spec.hit[0] - 0.12 && ct < p.atk.spec.hit[1] + 0.08;
  p.trail.push(katana.userData.base.getWorldPosition(tmpA), katana.userData.tip.getWorldPosition(tmpB), swinging ? 0.5 : 0);
  grassUniforms.uPush.value[0].set(p.pos.x, p.pos.z, 1.1, 1.1);
}
function collide(pos, r) {
  const d = Math.hypot(pos.x, pos.z);
  if (d > ARENA - r) { const k = (ARENA - r) / d; pos.x *= k; pos.z *= k; }
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z, dd = Math.hypot(dx, dz), m = c.r + r;
    if (dd < m && dd > 0.0001) { pos.x = c.x + dx / dd * m; pos.z = c.z + dz / dd * m; }
  }
}
function playerHitCheck() {
  const p = player, s = p.atk.spec;
  const d = flatDist(p.pos, boss.pos) - radius();
  if (d > s.reach || Math.abs(angDiff(p.face, angleTo(p.pos, boss.pos))) > s.arc) return;
  p.hitDone = true;
  const at = tmpA.copy(p.pos).lerp(boss.pos, 0.6); at.y = ground(boss.pos) + (boss.form === 'bear' ? 1.8 : 1.2) + rand(-0.2, 0.3);
  if (boss.state === 'transform' || boss.state === 'dead' || boss.dodging) { Audio.play('block'); fx.sparks(at, null, 10, 4, 3); if (boss.dodging) pop('SLIPPED'); return; }
  if (p.atk.name === 'deathblow') { deathblow(at); return; }
  const dmg = s.dmg * p.stats.dmg * (boss.state === 'recover' || boss.state === 'recoil' ? 1.25 : 1);
  boss.hp -= dmg;
  boss.posture = Math.min(100, boss.posture + s.post * (boss.state === 'recoil' ? 1.6 : 1));
  boss.postureT = 0; boss.flinch = 1;
  Audio.play('cut');
  game.hitstop = Math.max(game.hitstop, p.atk.name === 'heavy' ? 0.09 : 0.05);
  cam.shake = Math.max(cam.shake, p.atk.name === 'heavy' ? 0.5 : 0.25);
  if (boss.form === 'bear') fx.fur(at, 14, 1); else fx.neon(at, 8, 0.7);
  fx.ink(at, 6, 0.7, 0.6);
  if (boss.hp <= 0) { bossDies(); return; }
  if (boss.posture >= 100 && boss.state !== 'broken') breakPosture();
}
function deathblow(at) {
  boss.hp -= Math.round(boss.maxHp * 0.18); boss.posture = 0; boss.flinch = 1;
  Audio.play('deathblow');
  game.hitstop = 0.16; game.slow = 0.3; game.slowT = 0.7; game.flash = 0.55; cam.punch = 1.4; cam.shake = 1;
  fx.flash(at, 2.4, 0.28); fx.sparks(at, null, 40, 7, 6);
  fx.neon(at, 40, 1.4); fx.ink(at, 20, 1.2, 1); fx.splat(boss.pos, 3.4, ground(boss.pos)); fx.blast(boss.pos, 1.2); fx.dust(boss.pos, 12, 1.4);
  pop('DEATHBLOW', true);
  if (boss.hp <= 0) { bossDies(); return; }
  boss.state = 'recover'; boss.t = 0; boss.a.play('idle', { fade: 0.6 });
}
function breakPosture() {
  boss.state = 'broken'; boss.t = 0; boss.atk = null; boss.queue = [];
  boss.a.play('hit', { loop: false, speed: 0.5, fade: 0.1, restart: true });
  Audio.play('broken');
  game.hitstop = 0.14; game.flash = 0.25; cam.punch = 0.8;
  pop('POSTURE BROKEN · STRIKE', true);
}

/* ------------------------------------------------------------------ boss */
function chooseAttack() {
  const d = flatDist(boss.pos, player.pos) - radius();
  const isBear = boss.form === 'bear', opts = [];
  if (!isBear) {
    if (d > 7) opts.push(['fly', 3], ['kick', 0.6]);
    else if (d > 3.5) opts.push(['kick', 2.5], ['fly', 1], ['jabs', 1]);
    else opts.push(['jabs', 3], ['kick', 1.5], ['grab', 1.2], ['counter', 0.6]);
  } else {
    if (d > 8) opts.push(['charge', 3], ['slam', 0.6]);
    else if (d > 4) opts.push(['charge', 1.4], ['chop', 2], ['sweep', 1.5], ['slam', 1]);
    else opts.push(['sweep', 3], ['smash', 2.2], ['slam', 1.3], ['chop', 1.4]);
  }
  for (const o of opts) { if (o[0] === boss.last) o[1] *= 0.35; if (o[0] === boss.last && o[0] === boss.lastLast) o[1] = 0.01; }
  let r = Math.random() * opts.reduce((a, o) => a + o[1], 0), pick = opts[0][0];
  for (const o of opts) { r -= o[1]; if (r <= 0) { pick = o[0]; break; } }
  const q = [pick];
  if (isBear) { if (pick === 'sweep' && Math.random() < 0.4) q.push('smash'); if (pick === 'chop' && Math.random() < 0.35) q.push('slam'); }
  else if (pick === 'jabs' && Math.random() < 0.35) q.push('kick');
  boss.lastLast = boss.last; boss.last = pick;
  return q;
}
function specOf(name) { return (boss.form === 'bear' ? BEAR_ATK : GABE_ATK)[name]; }
function startBossAttack(name) {
  const spec = specOf(name), b = boss;
  b.state = 'attack'; b.t = 0; b.atk = { name, spec }; b.hitsDone = new Set(); b.snd = new Set(); b.told = false; b.impacted = false; b.charged = false;
  b.leapFrom.copy(b.pos);
  if (spec.unblock) { danger(); Audio.play('tell'); }
  if (spec.charge) { b.a.play('roar', { loop: false, speed: 1.6, fade: 0.15, at: 1.0, restart: true }); Audio.play('growl'); }
  else b.a.play(spec.cut, { loop: false, speed: spec.speed * (game.phase2 ? 1.08 : 1), fade: 0.12, restart: true });
}
function bossTurn(target, rate, dt) { boss.face += clamp(angDiff(boss.face, target), -rate * dt, rate * dt); }
function hitShapeHits(shape) {
  const b = boss, p = player;
  if (shape.aoe) {
    const cx = b.pos.x + Math.sin(b.face) * shape.aoe[0], cz = b.pos.z + Math.cos(b.face) * shape.aoe[0];
    return Math.hypot(p.pos.x - cx, p.pos.z - cz) <= shape.aoe[1] + 0.35;
  }
  return flatDist(b.pos, p.pos) <= shape.reach + radius() + 0.35 && Math.abs(angDiff(b.face, angleTo(b.pos, p.pos))) <= shape.arc;
}
function updateBoss(dt) {
  const b = boss, p = player;
  let A = b.a;
  const toP = angleTo(b.pos, p.pos), dist = flatDist(b.pos, p.pos) - radius();
  const turnRate = b.form === 'bear' ? 2.2 : 3.4;
  b.t += dt; b.clipT = 0; b.nextHit = null; b.dodging = false;
  b.postureT += dt;
  if (b.state !== 'broken' && b.postureT > 1.4) b.posture = Math.max(0, b.posture - dt * 11 * (0.35 + 0.65 * b.hp / b.maxHp));
  let move = 0, moveDir = b.face, glowWant = 0.25 + b.rage * 0.35, limbOn = null;
  switch (b.state) {
    case 'wait': bossTurn(toP, 2, dt); if (b.t > 0.8) { b.state = 'intro'; b.t = 0; A.play('taunt', { loop: false, fade: 0.2, restart: true }); Audio.play('growl'); } break;
    case 'intro': bossTurn(toP, 2, dt); if (b.t > 2.4) { b.state = 'idle'; b.t = 0; b.cooldown = 0.6; } break;
    case 'transform': {
      bossTurn(toP, 1.5, dt);
      glowWant = 1.5;
      if (b.t > 0.3 && b.t < 1.5) fx.ember(tmpA.set(b.pos.x + rand(-0.6, 0.6), ground(b.pos) + rand(0.3, 2.4), b.pos.z + rand(-0.6, 0.6)));
      if (b.t > 1.4 && !b.swapped) {
        b.swapped = true; b.form = 'bear';
        gabe.visible = false; bear.visible = true; b.a = A = bear;
        bear.play('roar', { loop: false, fade: 0, restart: true });
        setBossName();
        Audio.play('tear'); Audio.play('surge'); Audio.play('roar');
        const c = tmpA.set(b.pos.x, ground(b.pos) + 1.8, b.pos.z);
        game.flash = 0.7; game.hitstop = 0.12; cam.punch = 1.4; cam.shake = 1.4;
        fx.flash(c, 5, 0.4); fx.neon(c, 70, 2); fx.ink(c, 30, 2.2, 1); fx.blast(b.pos, 1.6); fx.ring({ x: b.pos.x, z: b.pos.z, groundY: ground(b.pos) }, 10, 0.9); fx.dust(b.pos, 20, 2);
        if (flatDist(b.pos, p.pos) < 6) p.pos.addScaledVector(tmpB.set(Math.sin(toP), 0, Math.cos(toP)), 2.2);
        pop('GABE LETS THE BEAR OUT', true);
      }
      if (b.t > 4.2) { b.state = 'idle'; b.t = 0; b.cooldown = 0.4; b.posture = 0; }
      break;
    }
    case 'idle': {
      if (p.state === 'dead') { A.play('idle'); break; }
      if (!game.phase2 && b.hp < b.maxHp * 0.55) { beginTransform(); break; }
      bossTurn(toP, turnRate, dt);
      b.cooldown -= dt;
      // Gabe reads your swing: sometimes he slips it and counters
      if (b.form === 'gabe' && p.state === 'attack' && dist < 3 && b.cooldown < 0.8 && Math.random() < dt * 1.6) { b.queue = []; startBossAttack('counter'); break; }
      if (dist > 3.4) move = b.form === 'bear' ? (game.phase2 ? 3.4 : 3) : 3.6;
      else if (dist < 1.4) move = -1.2;
      else { b.strafeT -= dt; if (b.strafeT <= 0) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeT = rand(1, 2.2); } move = 0.9; moveDir = b.face + b.strafe * Math.PI / 2; }
      if (Math.abs(move) > 1.5) A.play(b.form === 'bear' ? 'charge' : 'run', { speed: b.form === 'bear' ? 0.55 : 0.85, fade: 0.2 });
      else A.play('idle', { fade: 0.25 });
      if (b.cooldown <= 0) { b.queue = chooseAttack(); startBossAttack(b.queue.shift()); }
      break;
    }
    case 'attack': {
      const a = b.atk, s = a.spec;
      limbOn = s.limb;
      if (s.charge) { updateCharge(dt, toP); glowWant = 1.6; break; }
      const ct = s.from + A.t; b.clipT = ct;
      if (s.track && ct < s.track) bossTurn(toP, b.form === 'bear' ? 4 : 6, dt);
      if (s.tell != null && !b.told && ct >= s.tell) { b.told = true; Audio.play('glint'); }
      const lastHit = s.hits[s.hits.length - 1][1];
      if (ct >= (s.tell ?? 0) && ct <= lastHit + 0.1) glowWant = 2.2;
      for (let i = 0; i < s.hits.length; i++) if (!b.hitsDone.has(i) && ct < s.hits[i][1]) { b.nextHit = s.hits[i][0]; break; }
      if (s.dodge && ct >= s.dodge[0] && ct <= s.dodge[1]) b.dodging = true;
      if (s.lunges) for (const l of s.lunges) if (ct >= l[0] && ct <= l[1] && dist > 1.3) move = l[2];
      if (s.leap) {
        const [t0, t1] = s.leap;
        if (ct < t0) b.leapTo.copy(p.pos).addScaledVector(tmpA.set(Math.sin(toP), 0, Math.cos(toP)), -1.4);
        if (ct >= t0 && ct <= t1) { const k = (ct - t0) / (t1 - t0); b.pos.lerpVectors(b.leapFrom, b.leapTo, k * k * (3 - 2 * k)); b.air = Math.sin(k * Math.PI) * 1.6; }
        else b.air = 0;
      }
      if (s.impact && !b.impacted && ct >= s.impact) {
        b.impacted = true;
        const fwd = s.hits[0][2].aoe ? s.hits[0][2].aoe[0] : 3;
        const at = tmpA.copy(b.pos).addScaledVector(tmpB.set(Math.sin(b.face), 0, Math.cos(b.face)), fwd);
        const gy = ground(at);
        Audio.play('slam'); cam.shake = Math.max(cam.shake, 1.0);
        fx.blast(at, 1.4); fx.ring({ x: at.x, z: at.z, groundY: gy }, s.hits[0][2].aoe ? s.hits[0][2].aoe[1] * 1.6 : 4, 0.6); fx.dust(at, 18, 1.6); fx.ink(tmpC.set(at.x, gy + 0.3, at.z), 14, 1.6, 0.8); fx.splat(at, 2.6, gy);
      }
      s.hits.forEach(([t0, t1, shape], i) => {
        if (b.hitsDone.has(i)) return;
        if (ct >= t0 - 0.12 && !b.snd.has(i)) { b.snd.add(i); Audio.play(s.snd); }
        if (ct >= t0 && ct <= t1 && p.state !== 'dead' && p.state !== 'grabbed' && hitShapeHits(shape)) { b.hitsDone.add(i); receive(a, i); }
        else if (ct > t1) b.hitsDone.add(i);
      });
      if (b.state === 'attack' && A.done) endBossAttack();
      break;
    }
    case 'grabHold': {
      // Gabe hauls you up over his head, then throws you down
      const ct = GABE_ATK.grab.from + A.t;
      const paw = gabe.bone('RightHand').getWorldPosition(tmpA);
      if (ct < GABE_ATK.grab.throwAt) { p.pos.set(paw.x, 0, paw.z); ronin.root.position.y = Math.max(ground(p.pos), paw.y - 1.5); p.face = b.face + Math.PI; }
      else if (!b.thrown) {
        b.thrown = true; ronin.root.position.y = ground(p.pos);
        p.pos.addScaledVector(tmpB.set(Math.sin(b.face), 0, Math.cos(b.face)), 2.5);
        hurtPlayer(GABE_ATK.grab.dmg, true);
        fx.dust(p.pos, 14, 1.4); Audio.play('slam'); cam.shake = 1;
      }
      if (A.done) { b.state = 'idle'; b.t = 0; b.cooldown = rand(0.8, 1.4); }
      break;
    }
    case 'recoil': if (b.t > 0.75) { b.state = 'idle'; b.t = 0; b.cooldown = rand(0.3, 0.8); } break;
    case 'broken': if (b.t > 3.6) { b.state = 'recover'; b.t = 0; b.posture = 40; A.play('idle', { fade: 0.6 }); } break;
    case 'recover': if (b.t > 1.2) { b.state = 'idle'; b.t = 0; b.cooldown = 0.5; } break;
    case 'dead': glowWant = Math.max(0, 1 - b.t * 0.4); break;
  }
  if (move) { b.pos.x += Math.sin(moveDir) * move * dt; b.pos.z += Math.cos(moveDir) * move * dt; b.speedNow = Math.abs(move); } else b.speedNow = 0;
  collide(b.pos, radius());
  b.flinch = Math.max(0, b.flinch - dt * 5);
  b.glow = damp(b.glow, glowWant, 10, dt);
  for (const [name, s] of Object.entries(A.limbGlow || {})) {
    s.material.opacity = name === limbOn || (b.state === 'attack' && name === b.atk.spec.limb2) ? Math.min(1, b.glow * 0.6) : (name === 'Head' ? 0.12 + b.rage * 0.2 : 0);
  }
  A.setGlow((b.form === 'bear' ? 0.5 : 0.35) + b.rage * 0.4 + (b.state === 'attack' ? 0.3 : 0));
  A.root.position.set(b.pos.x, ground(b.pos) + b.air, b.pos.z);
  A.root.rotation.y = b.face;
  A.update(dt);
  A.root.updateMatrixWorld(true);
  const limb = limbOn && A.bone(limbOn);
  const striking = limb && b.nextHit != null && b.clipT > b.nextHit - 0.15;
  if (limb) { const lp = limb.getWorldPosition(tmpA).clone(); const el = limb.parent.getWorldPosition(tmpB); b.trail.push(el.lerp(lp, 0.5), lp, striking ? 0.9 : 0); }
  else b.trail.push(tmpA.copy(b.pos).setY(1), tmpA, 0);
  grassUniforms.uPush.value[1].set(b.pos.x, b.pos.z, b.form === 'bear' ? 2.6 : 1.4, b.air > 0.5 ? 0 : 1.4);
}
function updateCharge(dt, toP) {
  // the bear drops low, roars, then barrels at you: dodge it
  const b = boss, s = b.atk.spec, p = player;
  if (b.t < s.windup) { bossTurn(toP, 3, dt); return; }
  if (!b.charged) { b.charged = true; bear.play('charge', { speed: 1.3, fade: 0.1 }); Audio.play('roar'); }
  const k = b.t - s.windup;
  b.face += clamp(angDiff(b.face, toP), -0.9 * dt, 0.9 * dt);
  b.pos.x += Math.sin(b.face) * 11 * dt; b.pos.z += Math.cos(b.face) * 11 * dt;
  if (Math.random() < 0.6) fx.dust(b.pos, 1, 0.6);
  b.nextHit = 0; b.clipT = 0;
  if (!b.hitsDone.has(0) && flatDist(b.pos, p.pos) < radius() + 0.8 && p.state !== 'dead') { b.hitsDone.add(0); receive(b.atk, 0); }
  const hitWall = Math.hypot(b.pos.x, b.pos.z) > ARENA - radius() - 0.2;
  if (k > s.run || hitWall) {
    if (hitWall) { cam.shake = 0.8; Audio.play('slam'); fx.dust(b.pos, 16, 1.6); }
    endBossAttack(true);
  }
}
function endBossAttack(stagger) {
  const b = boss;
  if (b.queue.length && player.state !== 'dead') { startBossAttack(b.queue.shift()); return; }
  b.state = 'idle'; b.t = 0; b.atk = null; b.cooldown = (game.phase2 ? rand(0.45, 1.1) : rand(0.8, 1.6)) + (stagger ? 0.6 : 0);
}
function beginTransform() {
  const b = boss;
  game.phase2 = true; b.state = 'transform'; b.t = 0; b.rage = 1; b.queue = []; b.atk = null; b.swapped = false;
  gabe.play('taunt', { loop: false, fade: 0.2, restart: true });
  Audio.play('growl');
  pop('GABE CRACKS HIS KNUCKLES', true);
}
function receive(a, idx) {
  const p = player, s = a.spec, b = boss;
  const at = tmpA.copy(p.pos).lerp(b.pos, 0.3); at.y = ground(p.pos) + 1.4;
  if (p.iframe) { pop('EVADED'); fx.ink(tmpB.set(p.pos.x, ground(p.pos) + 0.8, p.pos.z), 5, 0.4, 0.3); return; }
  const facing = Math.abs(angDiff(p.face, angleTo(p.pos, b.pos))) < 1.9;
  if (s.unblock) {
    if (s.charge) { hurtPlayer(s.dmg, true); p.pos.addScaledVector(tmpB.set(Math.sin(b.face), 0, Math.cos(b.face)), 2.4); return; }
    p.state = 'grabbed'; p.t = 0; b.state = 'grabHold'; b.t = 0; b.thrown = false; b.queue = [];
    ronin.play('hit', { speed: 0.5, fade: 0.1, restart: true });
    Audio.play('hurt'); cam.shake = 0.6;
    return;
  }
  if (p.state === 'guard' && facing) {
    const since = game.time - p.parryT, mash = p.parryPresses.length > 2 ? 0.55 : 1;
    if (since <= p.stats.parryWin * mash) {
      game.parries++;
      p.state = 'deflect'; p.t = 0; p.st = Math.min(100, p.st + 6);
      ronin.play('defl', { loop: false, speed: 2.2, fade: 0.05, restart: true });
      b.posture = Math.min(100, b.posture + s.pp); b.postureT = 0;
      Audio.play('clang');
      game.hitstop = 0.12; game.flash = 0.25; cam.punch = 1; cam.shake = Math.max(cam.shake, 0.5);
      const dir = tmpB.set(Math.sin(b.face), 0.3, Math.cos(b.face));
      fx.sparks(at, dir, 60, 9, 8); fx.flash(at, 1.5, 0.16); fx.dust(p.pos, 6, 1.1);
      pop('DEFLECT');
      if (b.posture >= 100) { breakPosture(); return; }
      if (idx === s.hits.length - 1 && !b.queue.length) { b.state = 'recoil'; b.t = 0; b.atk = null; b.a.play('hit', { loop: false, speed: 1.2, fade: 0.08, restart: true }); }
      return;
    }
    Audio.play('block');
    p.st -= s.bc; p.stDelay = 0.8;
    fx.sparks(at, null, 12, 4, 3);
    p.pos.addScaledVector(tmpB.set(Math.sin(b.face), 0, Math.cos(b.face)), 0.45);
    b.posture = Math.min(100, b.posture + s.pp * 0.25);
    if (p.st <= 0) { p.st = 0; p.state = 'broken'; p.t = 0; ronin.play('hit', { loop: false, fade: 0.08, restart: true }); pop('GUARD BROKEN', true); hurtPlayer(s.dmg * 0.5, false, true); return; }
    hurtPlayer(s.dmg * 0.15, false, true);
    return;
  }
  hurtPlayer(s.dmg, !!s.knock);
}
function hurtPlayer(dmg, knock, chip) {
  const p = player;
  if (GOD) dmg = 0;
  p.hp -= dmg;
  if (!chip) {
    Audio.play('hurt');
    game.hurt = 0.85; game.hitstop = Math.max(game.hitstop, 0.07); cam.shake = Math.max(cam.shake, 0.7);
    const at = tmpA.set(p.pos.x, ground(p.pos) + 1.2, p.pos.z);
    fx.ink(at, 12, 1, 0.6); fx.dust(p.pos, 6, 1.2); fx.neon(at, 6, 0.8);
    p.state = knock ? 'down' : 'hit'; p.t = 0; p.iframe = false;
    ronin.play(knock ? 'down' : 'hit', { loop: false, speed: knock ? 1.1 : 1.5, fade: 0.06, restart: true });
  }
  if (p.hp <= 0) { p.hp = 0; playerDies(); }
}
function playerDies() {
  if (player.state === 'dead') return;
  player.state = 'dead'; player.t = 0; game.deaths++;
  ronin.play('dead', { loop: false, fade: 0.15, restart: true });
  Audio.play('death'); Audio.drumOn = false;
  game.slow = 0.35; game.slowT = 1.2; boss.queue = [];
  setTimeout(() => showEnd(false), 2600);
}
function bossDies() {
  const b = boss;
  b.hp = 0; b.state = 'dead'; b.t = 0; b.atk = null; b.queue = [];
  if (b.form === 'gabe') { b.form = 'bear'; gabe.visible = false; bear.visible = true; b.a = bear; }
  bear.play('dead', { loop: false, fade: 0.2, restart: true });
  player.state = 'victory'; player.t = 0;
  Audio.play('victory'); Audio.drumOn = false;
  game.slow = 0.25; game.slowT = 2.2; game.flash = 0.6; cam.punch = 1.2;
  const c = tmpA.set(b.pos.x, ground(b.pos) + 2.5, b.pos.z);
  fx.neon(c, 90, 2); fx.ink(c, 30, 2, 1); fx.blast(b.pos, 1.5); fx.splat(b.pos, 4, ground(b.pos));
  hud.hint.style.opacity = 0;
  setTimeout(() => showEnd(true), 4400);
}

/* ------------------------------------------------------------------ camera */
function updateCamera(rdt) {
  const p = player, b = boss, big = b.form === 'bear';
  const pivot = new THREE.Vector3(p.pos.x, ronin.root.position.y + 1.55, p.pos.z);
  if (cam.lock && b.state !== 'dead') {
    cam.yaw += angDiff(cam.yaw, angleTo(p.pos, b.pos)) * Math.min(1, rdt * 5);
    const d = flatDist(p.pos, b.pos);
    cam.pitch = damp(cam.pitch, d < 3.5 ? (big ? -0.02 : 0.05) : 0.16, 3, rdt);
  }
  cam.punch = Math.max(0, cam.punch - rdt * 2.6);
  cam.shake = Math.max(0, cam.shake - rdt * 2.4);
  const dist = (big ? 5.3 : cam.dist) * (1 - 0.3 * Math.min(1, cam.punch));
  const [f, r] = camBasis();
  const want = pivot.clone().addScaledVector(f, -dist * Math.cos(cam.pitch)).addScaledVector(r, 0.75).setY(pivot.y + dist * Math.sin(cam.pitch) + 0.3);
  want.y = Math.max(want.y, groundHeight(want.x, want.z) + 0.4);
  cam.pos.lerp(want, 1 - Math.exp(-rdt * 12));
  let look;
  if (cam.lock && b.state !== 'dead') look = pivot.clone().addScaledVector(r, 0.35).lerp(new THREE.Vector3(b.pos.x, ground(b.pos) + (big ? 2.6 : 1.5) + b.air, b.pos.z), 0.45);
  else look = pivot.clone().addScaledVector(f, 4).addScaledVector(r, 0.4).setY(pivot.y - Math.sin(cam.pitch) * 2.2 + 0.2);
  if (b.state === 'dead' || b.state === 'transform') look = new THREE.Vector3(b.pos.x, ground(b.pos) + (big ? 2 : 1.3), b.pos.z).lerp(pivot, 0.35);
  cam.look.lerp(look, 1 - Math.exp(-rdt * 10));
  camera.position.copy(cam.pos);
  if (cam.shake > 0) camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(cam.shake * 0.07));
  camera.lookAt(cam.look);
  camera.fov = damp(camera.fov, 52 - cam.punch * 9, 14, rdt);
  camera.updateProjectionMatrix();
  followLights(tmpC.copy(p.pos).lerp(b.pos, 0.5), cam.pos);
}

/* ------------------------------------------------------------------ flow */
const titleVid = $('titleVid'), introVid = $('introVid');
let endShownAt = 0;
function crewRow() {
  const copy = document.querySelector('#title .copy');
  const row = document.createElement('div'); row.id = 'crew';
  row.innerHTML = CREW.map((c, i) => `<button type="button" data-i="${i}"><b>${c.name}</b><span>${c.perk}</span></button>`).join('');
  copy.insertBefore(row, copy.querySelector('.pick'));
  row.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); pickCrew(+b.dataset.i); });
  pickCrew(crewPick);
}
function pickCrew(i) {
  crewPick = (i + CREW.length) % CREW.length;
  try { localStorage.setItem('crimson.crew', crewPick); } catch (e) { /* storage blocked */ }
  document.querySelectorAll('#crew button').forEach((b, k) => b.classList.toggle('on', k === crewPick));
}
function titleKey(e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { pickCrew(crewPick - 1); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { pickCrew(crewPick + 1); return; }
  if (/^Digit[1-5]$/.test(e.code)) { pickCrew(+e.code.slice(5) - 1); return; }
  startGame();
}
$('title').addEventListener('click', startGame);
$('intro').addEventListener('click', () => endIntro());
function startGame() {
  if (game.state !== 'title' || !game.ready) return;
  Audio.init(); Audio.play('start');
  $('title').classList.add('hidden'); titleVid.pause();
  if (introVid.src && introVid.readyState >= 2) {
    game.state = 'intro';
    $('intro').classList.remove('hidden');
    introVid.currentTime = 0; introVid.muted = false;
    introVid.play().catch(() => endIntro());
    introVid.onended = () => endIntro();
  } else endIntro(true);
}
function endIntro(force) {
  if (game.state !== 'intro' && !force) return;
  introVid.pause(); $('intro').classList.add('hidden');
  beginFight();
}
function beginFight() {
  makePlayer(); makeBoss();
  game.state = 'fight'; game.phase2 = false; game.fightStart = game.time; game.hurt = 0;
  cam.yaw = Math.atan2(FACE_DIR.x, FACE_DIR.z); cam.lock = true;
  cam.pos.copy(SPAWN_P).addScaledVector(FACE_DIR, -5).setY(3); cam.look.copy(SPAWN_B).setY(1.6);
  hud.el.classList.add('on'); hud.hint.style.opacity = 1;
  hud.card.className = ''; void hud.card.offsetWidth; hud.card.className = 'show';
  Audio.drumOn = true;
  if (canvas.requestPointerLock && !navigator.webdriver) { try { canvas.requestPointerLock(); } catch (e) { /* ignore */ } }
}
function showEnd(won) {
  game.state = 'end'; endShownAt = performance.now();
  if (document.pointerLockElement) document.exitPointerLock();
  const t = Math.round(game.time - game.fightStart);
  $('endKanji').textContent = won ? '勝' : '死';
  $('endTitle').textContent = won ? 'THE BEAR SLEEPS' : 'DEATH';
  $('endStats').textContent = won
    ? `${player.f.name} beat Gabe in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · ${game.parries} deflects · ${game.deaths} deaths`
    : `Gabe had ${Math.round(boss.hp / boss.maxHp * 100)}% life left${boss.form === 'bear' ? ', as a bear' : ''} · ${game.parries} deflects`;
  document.querySelector('#end p').textContent = won ? 'PRESS ANY KEY TO FIGHT AGAIN' : 'PRESS ANY KEY TO RISE AGAIN';
  if (won) {
    try {
      const best = JSON.parse(localStorage.getItem('crimson.best.v1') || 'null');
      if (!best || t < best.time) localStorage.setItem('crimson.best.v1', JSON.stringify({ time: t, name: player.f.name }));
    } catch (e) { /* storage blocked */ }
  }
  $('end').classList.add('show');
  hud.el.classList.remove('on');
}
$('end').addEventListener('click', () => { if (game.state === 'end' && performance.now() - endShownAt > 900) restart(); });
function restart() { $('end').classList.remove('show'); game.parries = 0; beginFight(); }
function pause() { if (game.state !== 'fight') return; game.state = 'paused'; $('pause').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); }
function resume() { game.state = 'fight'; $('pause').classList.add('hidden'); hadLock = false; if (canvas.requestPointerLock && !navigator.webdriver) { try { canvas.requestPointerLock(); } catch (e) { /* ignore */ } } }
$('pause').addEventListener('click', resume);
function loadClip(v, src, onReady) { v.src = src; v.addEventListener('loadeddata', onReady, { once: true }); v.addEventListener('error', () => v.removeAttribute('src'), { once: true }); v.load(); }
loadClip(titleVid, 'clips/title.mp4', () => { titleVid.classList.add('ready'); titleVid.play().catch(() => {}); });
loadClip(introVid, 'clips/intro.mp4', () => {});
crewRow();

/* ------------------------------------------------------------------ loop */
let ambientT = 0, last = performance.now(), manual = false;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  if (manual) return;
  pollPad(); tick(rdt); draw(now / 1000);
}
function tick(rdt) {
  let dt = rdt;
  if (game.hitstop > 0) { game.hitstop -= rdt; dt *= 0.04; }
  if (game.slowT > 0) { game.slowT -= rdt; dt *= game.slow; }
  if (game.state !== 'paused') {
    game.time += dt;
    grassUniforms.uTime.value += dt;
    if (game.ready && (game.state === 'fight' || game.state === 'end')) { updatePlayer(dt); updateBoss(dt); updateCamera(rdt); updateHud(); }
    else if (game.ready) {
      // behind the title: a slow orbit of the two of them
      const a = game.time * 0.05, c = SPAWN_P.clone().lerp(SPAWN_B, 0.5);
      camera.position.set(c.x + Math.sin(a) * 11, ground(c) + 2.4, c.z + Math.cos(a) * 11);
      camera.lookAt(c.x, ground(c) + 1.6, c.z);
      ronin.root.position.set(SPAWN_P.x, ground(SPAWN_P), SPAWN_P.z); ronin.root.rotation.y = Math.atan2(FACE_DIR.x, FACE_DIR.z); ronin.update(dt);
      gabe.root.position.set(SPAWN_B.x, ground(SPAWN_B), SPAWN_B.z); gabe.root.rotation.y = Math.atan2(-FACE_DIR.x, -FACE_DIR.z); gabe.update(dt);
      followLights(c, camera.position);
    }
    updateFX(dt);
    ambientT -= dt;
    if (ambientT <= 0) { ambientT = game.phase2 ? 0.08 : 0.22; fx.ambient(camera.position, game.phase2 && game.state === 'fight'); }
  }
  game.flash = Math.max(0, game.flash - rdt * 2.5);
  game.hurt = Math.max(0, game.hurt - rdt * 1.4);
  post.m.uniforms.uFlash.value = game.flash * 0.6;
  post.m.uniforms.uHurt.value = game.hurt * 0.5;
  post.m.uniforms.uGrey.value = player && player.state === 'dead' ? Math.min(1, player.t * 0.6) : 0;
  post.m.uniforms.uNeonBoost.value = 1 + (boss ? boss.rage * 0.25 : 0);
}
requestAnimationFrame(frame);

// a handle for automated play tests
window.__crimson = {
  step(sec, drawIt = true) { manual = true; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) tick(1 / 60); if (drawIt) draw(performance.now() / 1000); },
  live() { manual = false; },
  game, cam, input, startGame, beginFight, pickCrew,
  get player() { return player; }, get boss() { return boss; }, get actors() { return { ronin, gabe, bear, katana }; },
};
