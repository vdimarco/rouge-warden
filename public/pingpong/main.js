// Boots the table, the gate, motion, swipe, mouse and the test hooks.

import { desktopCourt, unlockCourt } from './gate.js';
import { aimFromCanvas, assistX, batFromTilt, createSwingDetector, depthWithBounce, driftNeutral, flickFromSamples, leanFromCanvas, mapAxes, POINTER, predictBounceZ, sideTarget, springStep, swipeToSwing, swingPush } from './motion.js';
import { RULES, planFrame, readOptions } from './rules.js';
import { createMatch } from './sim.js';
import { createSoundKit } from './audio.js';
import { createView } from './render.js';

const opts = readOptions(location.search);
const match = createMatch({ seed: opts.seed, input: opts.input });
const kit = createSoundKit();
const canvas = document.getElementById('table');
const view = createView(canvas);
const pose = { tiltX: 0, tiltY: 0, roll: 0, swingAt: 0, swingDir: 'forehand', push: 0, gyro: 0 };
let inputMode = opts.input === 'touch' || opts.input === 'swing' ? 'swipe' : 'motion';
let aimU = 0.5;
let aimV = 0.5;
let flickSamples = [];
let flickCool = -Infinity;
let sideSpring = { x: 0, v: 0 };
let leanSpring = { x: 0, v: 0 };
let neutral = { beta: 0, gamma: 0 };
let filtered = { tiltX: 0, tiltY: 0 };
let springX = { x: 0, v: 0 };
let springY = { x: 0, v: 0 };
let orientAt = 0;
let gyroAt = 0;
let pushAt = 0;
let poseHold = false;
let sensorsOn = false;
let fps = 0;
let fpsFrames = 0;
let fpsStamp = 0;
let lowFps = 0;
const gate = document.getElementById('gate');
const gateBtn = document.getElementById('gate-btn');

function gateOpen() {
  return !!(gate && !gate.hidden);
}

function armPointerCourt() {
  inputMode = 'pointer';
  if (gateBtn) gateBtn.textContent = 'Click to pick up your bat';
  const hint = document.getElementById('desk-hint');
  if (hint) hint.hidden = false;
  document.querySelectorAll('[data-phone]').forEach((el) => { el.hidden = true; });
  if (canvas) canvas.setAttribute('aria-label', 'Table tennis. The mouse aims the shot.');
}

if (opts.input === 'pointer' || (inputMode === 'motion' && desktopCourt(window))) armPointerCourt();

function play(snapshot) {
  const events = snapshot && snapshot.events ? snapshot.events : [];
  for (const event of events) {
    if (event.type === 'whoosh') kit.whoosh(event.peak, event.x);
    if (event.type === 'pock') {
      kit.pock(event.kind, event.speed, event.x);
      pose.swingAt = performance.now();
      buzz(event.kind === 'smash' ? RULES.vibrateSmash : RULES.vibrateHit);
    }
    if (event.type === 'tik') kit.tik(event.x);
    if (event.type === 'net' || event.type === 'tape') kit.net(event.x);
    if (event.type === 'floor') kit.floor(event.x);
    if (event.type === 'ooh') kit.ooh();
    if (event.type === 'clap') kit.clap(event.big);
    if (event.type === 'tick') kit.tick();
  }
  return snapshot;
}

function buzz(ms) {
  const android = /Android/i.test(navigator.userAgent || '');
  if (android && navigator.vibrate) navigator.vibrate(ms);
}

if (opts.skipGate && gate) gate.hidden = true;

let acc = 0;
let last = performance.now();
let frozen = false;

function screenAngle() {
  const o = window.screen && window.screen.orientation;
  if (o && Number.isFinite(o.angle)) return o.angle;
  const legacy = window.orientation;
  return Number.isFinite(legacy) ? legacy : 0;
}

function commitPose(assist) {
  pose.tiltX = filtered.tiltX;
  pose.tiltY = filtered.tiltY;
  pose.roll = Math.max(-50, Math.min(50, filtered.tiltX));
  const mapped = batFromTilt(filtered.tiltX, filtered.tiltY);
  const live = match.state();
  const pull = assist && live.phase === 'incoming';
  const x = pull ? assistX(mapped.x, live.ball.x, RULES.assist) : mapped.x;
  let depth = mapped.depth;
  if (pull) {
    const bounce = predictBounceZ(live.ball);
    if (bounce != null) depth = depthWithBounce(mapped.depth, bounce);
  }
  match.setBat({ x, depth, roll: pose.roll });
}

function followAngle(targetX, targetY, dt) {
  springX = springStep(springX, targetX, dt);
  springY = springStep(springY, targetY, dt);
  filtered.tiltX = springX.x;
  filtered.tiltY = springY.x;
}

function followPointer(dt) {
  const live = match.state();
  sideSpring = springStep(sideSpring, sideTarget(live.phase, live.ball.x), dt);
  leanSpring = springStep(leanSpring, leanFromCanvas(aimV), dt);
  const depth = batFromTilt(0, leanSpring.x).depth;
  pose.tiltX = aimFromCanvas(aimU);
  pose.tiltY = 0;
  pose.roll = 0;
  match.setBat({ x: sideSpring.x, depth, roll: 0 });
}

function followSwipe() {
  const live = match.state();
  const line = live.phase === 'incoming' ? live.ball.x : 0;
  const x = line * RULES.swipeFollow;
  match.setBat({ x, depth: RULES.hitZ, roll: 0 });
  pose.roll = 0;
  pose.tiltX = 0;
  pose.tiltY = 0;
}

function holdTilt(beta, gamma) {
  const mapped = mapAxes(beta, gamma, screenAngle());
  const targetX = mapped.gamma - neutral.gamma;
  const targetY = mapped.beta - neutral.beta;
  for (let i = 0; i < 30; i++) followAngle(targetX, targetY, 1 / 60);
  poseHold = true;
  commitPose(false);
}

function loop(now) {
  if (frozen) {
    requestAnimationFrame(loop);
    return;
  }
  if (inputMode === 'pointer' && !poseHold) {
    const pointerDt = pushAt ? Math.max(1 / 120, Math.min(0.05, (now - pushAt) / 1000)) : 1 / 60;
    followPointer(pointerDt);
  } else if (inputMode === 'swipe' && !poseHold) followSwipe();
  const planned = planFrame(acc, (now - last) / 1000, opts.fast);
  acc = planned.acc;
  last = now;
  for (let i = 0; i < planned.steps; i++) play(match.step());
  const dt = pushAt ? Math.max(1 / 120, Math.min(0.05, (now - pushAt) / 1000)) : 1 / 60;
  pushAt = now;
  const gyro = now - gyroAt > 90 ? 0 : pose.gyro;
  pose.push = swingPush(pose.push, gyro, dt);
  view.frame(match.state(), pose);
  paintScore();
  fpsFrames += 1;
  if (!fpsStamp) fpsStamp = now;
  if (now - fpsStamp >= 500) {
    fps = fpsFrames * 1000 / (now - fpsStamp);
    fpsFrames = 0;
    fpsStamp = now;
    if (fps > 0 && fps < 60) lowFps += 1;
    else lowFps = 0;
    if (lowFps >= 3) {
      view.setTrailCap(2);
      view.setDprCap(1.5);
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('resize', () => view.resize());

function unlockAudio() {
  const unlocked = unlockCourt({
    AudioContext: window.AudioContext || window.webkitAudioContext,
    audio: kit.context(),
  });
  kit.attach(unlocked.audio);
  kit.murmur();
  return unlocked;
}

function unlockFromTap() {
  const unlocked = unlockCourt({
    DeviceMotionEvent: typeof DeviceMotionEvent === 'function' ? DeviceMotionEvent : undefined,
    DeviceOrientationEvent: typeof DeviceOrientationEvent === 'function' ? DeviceOrientationEvent : undefined,
    AudioContext: window.AudioContext || window.webkitAudioContext,
    audio: kit.context(),
  });
  kit.attach(unlocked.audio);
  kit.murmur();
  return unlocked;
}

function beginPlay() {
  if (gate) gate.hidden = true;
  if (inputMode === 'pointer' && canvas) canvas.style.cursor = 'none';
  match.start();
  if (inputMode === 'motion') attachSensors();
}

function calibrateThenStart() {
  const samples = [];
  const onOrient = (e) => {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    samples.push(mapAxes(e.beta, e.gamma, screenAngle()));
  };
  window.addEventListener('deviceorientation', onOrient);
  window.setTimeout(() => {
    window.removeEventListener('deviceorientation', onOrient);
    if (samples.length) {
      neutral = {
        beta: samples.reduce((sum, v) => sum + (Number(v.beta) || 0), 0) / samples.length,
        gamma: samples.reduce((sum, v) => sum + (Number(v.gamma) || 0), 0) / samples.length,
      };
    }
    beginPlay();
  }, RULES.calibrate * 1000);
}

function onGateTap() {
  if (inputMode === 'pointer') {
    unlockAudio();
    beginPlay();
    return;
  }
  const unlocked = unlockFromTap();
  if (inputMode === 'swipe') {
    beginPlay();
    return;
  }
  void settleGate(unlocked);
}

async function settleGate(unlocked) {
  let motion = 'granted';
  let orient = 'granted';
  try {
    if (unlocked.asked.motion) motion = await unlocked.asked.motion;
    if (unlocked.asked.orient) orient = await unlocked.asked.orient;
  } catch (err) {
    motion = 'denied';
  }
  const note = document.getElementById('gate-note');
  if (motion === 'denied' || orient === 'denied') {
    inputMode = 'swipe';
    if (note) note.textContent = 'Motion is off. Swipe up to play. The iPhone silent switch mutes the game.';
    window.setTimeout(beginPlay, 700);
    return;
  }
  const heard = await waitSensor(700);
  if (!heard) {
    inputMode = 'swipe';
    if (note) note.textContent = 'No motion sensor here. Drag or swipe up to swing.';
    window.setTimeout(beginPlay, 500);
    return;
  }
  inputMode = 'motion';
  calibrateThenStart();
}

function waitSensor(ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      window.removeEventListener('devicemotion', onSample);
      resolve(ok);
    };
    const onSample = () => finish(true);
    window.addEventListener('devicemotion', onSample);
    window.setTimeout(() => finish(false), ms);
  });
}

function attachSensors() {
  if (sensorsOn) return;
  sensorsOn = true;
  window.addEventListener('deviceorientation', (e) => {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    const now = performance.now();
    const dt = orientAt ? Math.max(1 / 120, Math.min(0.08, (now - orientAt) / 1000)) : 1 / 60;
    orientAt = now;
    const axes = mapAxes(e.beta, e.gamma, screenAngle());
    const rate = now - gyroAt < 90 ? pose.gyro : 0;
    const held = match.state().bat;
    neutral = {
      beta: driftNeutral(neutral.beta, axes.beta, rate, held.x, dt),
      gamma: driftNeutral(neutral.gamma, axes.gamma, rate, held.x, dt),
    };
    followAngle(axes.gamma - neutral.gamma, axes.beta - neutral.beta, dt);
    poseHold = false;
    commitPose(true);
  });
  const detector = createSwingDetector();
  window.addEventListener('devicemotion', (e) => {
    const rate = e.rotationRate || {};
    const accel = e.accelerationIncludingGravity || {};
    const mag = Math.hypot(accel.x || 0, accel.y || 0, accel.z || 0);
    pose.gyro = Math.hypot(rate.alpha || 0, rate.beta || 0, rate.gamma || 0);
    gyroAt = performance.now();
    if (match.shock(mag)) return;
    const swing = detector.push({
      alpha: rate.alpha || 0,
      beta: rate.beta || 0,
      gamma: rate.gamma || 0,
      accel: mag,
    }, performance.now() / 1000);
    if (!swing) return;
    pose.swingDir = swing.dir;
    const cross = match.state().crossIn;
    const age = performance.now() / 1000 - swing.at;
    const offsetMs = cross == null ? 0 : -(cross + age) * 1000;
    play(match.swing({
      degPerSec: swing.degPerSec,
      dir: swing.dir,
      tiltX: pose.tiltX,
      tiltY: pose.tiltY,
      rollDegPerSec: swing.rollDegPerSec,
      offsetMs,
      accel: swing.accel,
    }));
  });
}

if (gateBtn) {
  gateBtn.addEventListener('click', (e) => {
    onGateTap();
    if (inputMode === 'pointer' && !gateOpen()) placeAim(e);
  });
}

const again = document.getElementById('again');
if (again) {
  again.addEventListener('click', () => {
    match.nextGame();
    again.hidden = true;
  });
}

const recenter = document.getElementById('recenter');
if (recenter) {
  recenter.addEventListener('click', () => {
    neutral = { beta: neutral.beta + filtered.tiltY, gamma: neutral.gamma + filtered.tiltX };
    filtered.tiltX = 0;
    filtered.tiltY = 0;
    springX = { x: 0, v: 0 };
    springY = { x: 0, v: 0 };
    pose.push = 0;
    commitPose(false);
  });
}

function onHud(e) {
  const target = e.target;
  return !!(target && target.closest && target.closest('button, a'));
}

function pointerSample(e) {
  const box = canvas.getBoundingClientRect();
  const width = box.width > 0 ? box.width : POINTER.baseline;
  const height = box.height;
  const stamp = Number(e.timeStamp);
  const t = Number.isFinite(stamp) && stamp > 0 ? stamp / 1000 : performance.now() / 1000;
  const u = (e.clientX - box.left) / width;
  const v = height > 0 ? (e.clientY - box.top) / height : 0.5;
  const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
  return {
    u: Math.max(0, Math.min(1, u)),
    v: Math.max(0, Math.min(1, v)),
    x: e.clientX,
    y: e.clientY,
    t,
    px: e.clientX - box.left,
    py: e.clientY - box.top,
    width,
    inside,
  };
}

function placeAim(e) {
  const point = pointerSample(e);
  aimU = point.u;
  aimV = point.v;
  pose.tiltX = aimFromCanvas(aimU);
  pose.dot = point.inside ? { x: point.px, y: point.py } : null;
}

function firePointerSwing(swing) {
  pose.swingDir = swing.dir || 'forehand';
  pose.gyro = swing.degPerSec;
  gyroAt = performance.now();
  const at = swing.at == null ? performance.now() / 1000 : swing.at;
  const cross = match.state().crossIn;
  const age = performance.now() / 1000 - at;
  const offsetMs = cross == null ? 0 : -(cross + age) * 1000;
  play(match.swing({
    degPerSec: swing.degPerSec,
    dir: pose.swingDir,
    tiltX: pose.tiltX,
    tiltY: pose.tiltY,
    rollDegPerSec: swing.rollDegPerSec || 0,
    offsetMs,
  }));
}

function coalescedEvents(e) {
  try {
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    if (list && list.length) return list;
  } catch (err) {
    // A synthetic event may not list coalesced samples.
  }
  return [e];
}

function notePointer(e) {
  if (gateOpen() || onHud(e)) return;
  const events = coalescedEvents(e);
  let last = null;
  for (let i = 0; i < events.length; i++) {
    const point = pointerSample(events[i]);
    last = point;
    flickSamples.push({ x: point.x, y: point.y, t: point.t });
  }
  if (!last) return;
  aimU = last.u;
  aimV = last.v;
  pose.tiltX = aimFromCanvas(aimU);
  pose.dot = last.inside ? { x: last.px, y: last.py } : null;
  const t = last.t;
  const keep = t - 0.09;
  while (flickSamples.length && flickSamples[0].t < keep) flickSamples.shift();
  if (t < flickCool) return;
  const flick = flickFromSamples(flickSamples, t, last.width);
  if (!flick) return;
  flickCool = t + RULES.cooldown;
  firePointerSwing(flick);
}

function realMouseMove(e) {
  if (!e || e.isTrusted === false) return false;
  if (e.pointerType && e.pointerType !== 'mouse') return false;
  const caps = e.sourceCapabilities;
  if (caps && caps.firesTouchEvents) return false;
  return true;
}

window.addEventListener('mousemove', (e) => {
  if (inputMode !== 'motion' || !gateOpen() || !realMouseMove(e)) return;
  armPointerCourt();
});
window.addEventListener('pointermove', (e) => {
  if (inputMode !== 'pointer') return;
  notePointer(e);
});

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (inputMode !== 'swipe') return;
  if (!kit.context()) unlockFromTap();
  const box = canvas.getBoundingClientRect();
  if (e.clientY - box.top < box.height * 0.4) return;
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (drag.samples.length > 14) drag.samples.shift();
});
function releaseDrag(e) {
  if (!drag) return;
  const dt = Math.max(1 / 60, (performance.now() - drag.t) / 1000);
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  const end = drag.samples[drag.samples.length - 1] || drag;
  const prev = drag.samples[Math.max(0, drag.samples.length - 3)] || drag;
  const endDt = Math.max(1 / 60, (end.t - prev.t) / 1000);
  const swing = swipeToSwing({ dx, dy, dt, endDy: end.y - prev.y, endDt });
  pose.swingDir = swing.dir;
  pose.tiltX = swing.tiltX;
  const cross = match.state().crossIn;
  const offsetMs = cross == null ? 0 : -cross * 1000;
  match.swing({ ...swing, offsetMs });
  play(match.state());
  drag = null;
}
canvas.addEventListener('pointerup', releaseDrag);
canvas.addEventListener('pointercancel', () => { drag = null; });

function batNow() {
  const b = match.state().bat;
  return { x: b.x, depth: b.depth, roll: b.roll };
}

window.__test = {
  swing(cmd) {
    if (cmd.dir) pose.swingDir = cmd.dir;
    if (cmd.tiltX != null) pose.tiltX = cmd.tiltX;
    if (cmd.tiltY != null) pose.tiltY = cmd.tiltY;
    match.swing(cmd);
    return play(match.state());
  },
  state() { return match.state(); },
  step(n = 1) {
    let lastSnap = null;
    for (let i = 0; i < n; i++) lastSnap = play(match.step());
    view.frame(match.state(), pose);
    paintScore();
    return lastSnap;
  },
  setTilt(tiltX, tiltY, roll) {
    filtered.tiltX = Number(tiltX) || 0;
    filtered.tiltY = Number(tiltY) || 0;
    springX = { x: filtered.tiltX, v: 0 };
    springY = { x: filtered.tiltY, v: 0 };
    poseHold = true;
    commitPose(false);
    if (roll != null) {
      pose.roll = Number(roll) || 0;
      const b = match.state().bat;
      match.setBat({ x: b.x, depth: b.depth, roll: pose.roll });
    }
    view.frame(match.state(), pose);
  },
  tilt(beta, gamma) {
    holdTilt(beta, gamma);
    view.frame(match.state(), pose);
    return batNow();
  },
  get bat() { return batNow(); },
  aim() {
    return {
      tiltX: pose.tiltX,
      tiltY: pose.tiltY,
      dot: pose.dot ? { x: pose.dot.x, y: pose.dot.y } : null,
    };
  },
  fps() { return { fps, ghosts: view.ghostCount(), dpr: view.pixelRatio() }; },
  trail(n) { view.setTrailCap(n); },
  freeze() {
    frozen = true;
    view.frame(match.state(), pose);
    paintScore();
    return match.state();
  },
  sounds() { return kit.heard(); },
  options: opts,
};

const scoreYou = document.getElementById('score-you');
const scoreThem = document.getElementById('score-them');

function paintScore() {
  const score = match.state().score;
  if (scoreYou) scoreYou.textContent = 'You ' + score.you;
  if (scoreThem) scoreThem.textContent = score.neighbour + ' Neighbour';
}

const scoreWatch = setInterval(() => {
  paintScore();
  if (again) again.hidden = !match.state().gameOver;
}, 300);
scoreWatch.unref?.();
