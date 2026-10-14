// Light Years Home v3: touch, keys, mouse, gamepad and tilt into one InputRecord a frame (final.md 5.2, 13.2, 13.3).
// Phones: a floating stick where the thumb lands in the steer area (X steers, Y climbs), GAS, BRAKE / DRIFT and BOOST
// under the right thumb (rolling: whichever pedal is under it is pressed), a flick up on the stick boosts, and the
// ship cruises with nothing pressed. One thumb (a setting): the stick finger holds the gas, a second finger brakes or
// drifts. Buttons are hit-tested against core/layout.js, so the picture and the touch areas never disagree. Desktop:
// WASD or arrows, R / F climb, Space drift, Shift boost, E or Enter action, Q look back, Tab or M log, Esc or P pause;
// mouse steer is a setting; a pad uses the standard mapping. One scheme at a time: a stray mouse move or a drifting
// pad stick never takes over. Nothing reaches the game while the arcade's game switcher is open.
// The pure parts (stick maths, the flick, the action hold, the scheme switch, pad, mouse and tilt shaping) are
// exported for qa/light-years-home/v3/input.test.mjs.
import { TUNE } from '../core/tune.js';
import { makeInput } from '../core/game.js';
import { kindFor } from '../core/layout.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => (typeof v === 'number' && v === v ? v : 0);
const nz = (v) => (v === 0 ? 0 : v);                 // no −0 in records

// ---------------------------------------------------------------- pure shaping

// sign(x) · |x|^e, for sticks and touch (TUNE.SHIP.EXPO).
export function expo(x, e = TUNE.SHIP.EXPO) {
  const a = Math.min(1, Math.abs(num(x)));
  return nz(Math.sign(x) * a ** e);
}

// A signed offset to −1..1: 0 inside the dead zone, 1 at full, linear between.
export function deadScale(v, dead, full) {
  const a = Math.abs(num(v));
  if (a <= dead) return 0;
  return nz(Math.sign(v) * Math.min(1, (a - dead) / Math.max(1e-6, full - dead)));
}

// The floating stick: thumb offset from the anchor in CSS px (y down) → { steer, climb }. X steers with a 6 px dead
// zone, full at 56 px, expo 1.5; Y climbs, scaled 0.8, dead zone 24 px, full at 96 px, so a steering thumb that
// wanders up or down does not pitch the ship. Thumb up climbs; invert flips it.
export function stickAxes(dx, dy, tune = TUNE, invert = false, out = { steer: 0, climb: 0 }) {
  const I = tune.INPUT;
  out.steer = expo(deadScale(dx, I.STICK_DEAD, I.STICK_FULL), tune.SHIP.EXPO);
  const c = -deadScale(dy, I.CLIMB_DEAD, I.CLIMB_FULL) * I.CLIMB_X;
  out.climb = nz(invert ? -c : c);
  return out;
}

// In the light-speed corridor (punch and tunnel) Y steers up and down as X steers across (decisions.md 2): the same
// dead zone, reach and expo on both axes, no climb scale, and no pitch delay.
export function corridorAxes(dx, dy, tune = TUNE, invert = false, out = { steer: 0, climb: 0 }) {
  const I = tune.INPUT;
  out.steer = expo(deadScale(dx, I.STICK_DEAD, I.STICK_FULL), tune.SHIP.EXPO);
  const c = -expo(deadScale(dy, I.STICK_DEAD, I.STICK_FULL), tune.SHIP.EXPO);
  out.climb = nz(invert ? -c : c);
  return out;
}
export const CORRIDOR = Object.freeze(['punch', 'tunnel']);

// How far the anchor follows a thumb that runs past the stick, so turning back is quick: past FOLLOW × full the
// anchor is dragged along. Returns the new anchor coordinate.
export const FOLLOW = 1.25;
export function follow(anchor, at, full) {
  const reach = full * FOLLOW, d = at - anchor;
  if (d > reach) return at - reach;
  if (d < -reach) return at + reach;
  return anchor;
}

/**
 * The flick up for boost (final.md 13.2): 48 px up within 150 ms at 700 px/s or more. move(t, y) returns true once
 * per flick (times in ms, y in CSS px, down positive). One swipe is one burst: after a flick nothing fires until the
 * thumb slows or turns back (armed). possible(t) is true while a flick could still be starting (the thumb moved up in
 * the last FLICK_MS): the stick's climb reads PITCH_DELAY late meanwhile.
 */
export function createFlick(tune = TUNE) {
  const I = tune.INPUT;
  const CAP = 64;
  const ts = new Float64Array(CAP), ys = new Float64Array(CAP);
  let head = 0, n = 0, lastY = NaN, lastT = 0, lastUpT = -1e12, armed = true;
  const push = (t, y) => { ts[head] = t; ys[head] = y; head = (head + 1) % CAP; n = Math.min(CAP, n + 1); };
  return {
    reset(t, y) { n = 0; head = 0; lastY = y; lastT = t; lastUpT = -1e12; armed = true; push(t, y); },
    move(t, y) {
      const v = ((lastY - y) / Math.max(1, t - lastT)) * 1000;     // px/s up, this sample
      if (y < lastY - 1) lastUpT = t;
      lastY = y; lastT = t;
      if (!armed) {
        if (!(v >= I.FLICK_SPEED * 0.5)) { armed = true; n = 0; head = 0; push(t, y); }
        return false;
      }
      push(t, y);
      let yMax = -Infinity, tMax = t;
      for (let k = 0; k < n; k++) {
        const i = (head - 1 - k + CAP) % CAP;
        if (t - ts[i] > I.FLICK_MS) break;
        if (ys[i] > yMax) { yMax = ys[i]; tMax = ts[i]; }
      }
      const travel = yMax - y;
      if (travel < I.FLICK_PX) return false;
      const speed = (travel / Math.max(1, t - tMax)) * 1000;
      if (speed < I.FLICK_SPEED) return false;
      armed = false;
      return true;
    },
    possible(t) { return armed && t - lastUpT < I.FLICK_MS; },
    get armed() { return armed; },
  };
}

/**
 * The action control (the chip, E, Enter, Backspace, pad X). A tap fires `action` on release when the press was
 * shorter than RACE.RESTART_HOLD, so a hold to restart (0.35 s) or to let go of a tow (1 s) never also taps.
 * held(t) is how long it has been held, in seconds. take(t) is the actionHeld a read reports: held(t), except just
 * after jolt() (Delete, a restart at once), when it jumps past the hold for one read.
 */
export function createAction(tune = TUNE) {
  let down = false, t0 = 0, jolt = false;
  return {
    press(t) { if (!down) { down = true; t0 = t; } },
    release(t) {
      if (!down) return false;
      down = false;
      return (t - t0) / 1000 < tune.RACE.RESTART_HOLD;
    },
    cancel() { down = false; },
    jolt() { jolt = true; },
    held(t) { return down ? Math.max(0, (t - t0) / 1000) : 0; },
    take(t) {
      if (jolt) { jolt = false; return tune.RACE.RESTART_HOLD + 0.01; }
      return down ? Math.max(0, (t - t0) / 1000) : 0;
    },
    get down() { return down; },
  };
}

// One scheme at a time. kind: 'touch', 'key', 'mouseButton', 'mouseMove', 'padButton', 'padAxis'. A touch, a key
// or a pad button switches; a mouse button switches only when mouse steer is on; a mouse move or a pad stick never
// does. Returns the source now in use.
export function nextSource(cur, kind, settings = null) {
  switch (kind) {
    case 'touch': return 'touch';
    case 'key': return 'keys';
    case 'padButton': return 'pad';
    case 'mouseButton':
      if (settings?.mouseSteer) return 'mouse';
      return cur == null || cur === 'touch' ? 'keys' : cur;
    default:
      return cur;
  }
}

// The layout kind for a source: touch lays out pedals for the screen's shape; keys, mouse and pads use the desktop
// layout when the window is big enough for it.
export function kindForSource(source, w, h) {
  if (source === 'touch') return h > w ? 'portrait' : 'landscape';
  return w >= 700 && h >= 500 ? 'desktop' : kindFor(w, h);
}

// Keys held (KeyboardEvent.code) → axes and buttons.
export const KEYS = Object.freeze({
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], gas: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'],
  up: ['KeyR'], down: ['KeyF'], drift: ['Space'], boost: ['ShiftLeft', 'ShiftRight'], lookBack: ['KeyQ'],
  action: ['KeyE', 'Enter', 'NumpadEnter', 'Backspace'], restart: ['Delete'], map: ['Tab', 'KeyM'],
  pause: ['Escape', 'KeyP'],
});
const GAME_KEYS = new Set(Object.values(KEYS).flat());
const any = (held, list) => list.some((c) => held.has(c));

export function keyAxes(held, out = {}) {
  out.steer = (any(held, KEYS.right) ? 1 : 0) - (any(held, KEYS.left) ? 1 : 0);
  out.climb = (any(held, KEYS.up) ? 1 : 0) - (any(held, KEYS.down) ? 1 : 0);
  out.gas = any(held, KEYS.gas) ? 1 : 0;
  out.brake = any(held, KEYS.brake) ? 1 : 0;
  out.drift = any(held, KEYS.drift);
  out.boost = any(held, KEYS.boost);
  out.lookBack = any(held, KEYS.lookBack);
  return out;
}

// Mouse steer: offset from the screen centre in CSS px. Dead zone 3% and full at 25% of the width, on both axes so
// a pixel means the same either way; expo on steer.
export function mouseAxes(dx, dy, w, tune = TUNE, invert = false, out = { steer: 0, climb: 0 }) {
  const I = tune.INPUT, W = Math.max(1, w);
  out.steer = expo(deadScale(dx / W, I.MOUSE_DEAD, I.MOUSE_FULL), tune.SHIP.EXPO);
  const c = -deadScale(dy / W, I.MOUSE_DEAD, I.MOUSE_FULL);
  out.climb = nz(invert ? -c : c);
  return out;
}

// A standard-mapping gamepad → a partial record. Left stick with a radial dead zone and expo; RT gas and LT brake
// are analog; A or RB boost, B drift, X action, Y or View map, LB look back, Start pause, D-pad left and right
// change the radio tape.
export const PAD = Object.freeze({ A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, LEFT: 14,
  RIGHT: 15 });
const btn = (pad, i) => {
  const b = pad?.buttons?.[i];
  return b ? (typeof b === 'object' ? num(b.value) || (b.pressed ? 1 : 0) : num(b)) : 0;
};
export function padAxes(pad, tune = TUNE, invert = false, out = {}) {
  const x = clamp(num(pad?.axes?.[0]), -1, 1), y = clamp(num(pad?.axes?.[1]), -1, 1);
  const m = Math.hypot(x, y), dead = tune.INPUT.PAD_DEAD;
  if (m <= dead) { out.steer = 0; out.climb = 0; } else {
    const k = expo(Math.min(1, (m - dead) / (1 - dead)), tune.SHIP.EXPO) / m;
    out.steer = nz(clamp(x * k, -1, 1));
    const c = clamp(-y * k, -1, 1);
    out.climb = nz(invert ? -c : c);
  }
  out.gas = clamp(btn(pad, PAD.RT), 0, 1);
  out.brake = clamp(btn(pad, PAD.LT), 0, 1);
  out.boost = btn(pad, PAD.A) > 0.5 || btn(pad, PAD.RB) > 0.5;
  out.drift = btn(pad, PAD.B) > 0.5;
  out.action = btn(pad, PAD.X) > 0.5;
  out.map = btn(pad, PAD.Y) > 0.5 || btn(pad, PAD.VIEW) > 0.5;
  out.lookBack = btn(pad, PAD.LB) > 0.5;
  out.pause = btn(pad, PAD.START) > 0.5;
  out.tapeLeft = btn(pad, PAD.LEFT) > 0.5;
  out.tapeRight = btn(pad, PAD.RIGHT) > 0.5;
  return out;
}

// Is any button down (not the sticks)? Only a button press lets a pad take over.
export function padPressed(pad) {
  const b = pad?.buttons || [];
  for (let i = 0; i < b.length; i++) if (btn(pad, i) > (i === PAD.LT || i === PAD.RT ? 0.3 : 0.5)) return true;
  return false;
}

// Tilt: the phone's roll in degrees from the level set when tilt was turned on. ±25° is full steer, 2° dead zone.
export function tiltSteer(roll, level, tune = TUNE) {
  let d = num(roll) - num(level);
  d = ((d + 540) % 360) - 180;
  return deadScale(d, tune.INPUT.TILT_DEAD, tune.INPUT.TILT_FULL);
}

// The roll of a phone held sideways, from a deviceorientation event and the screen angle.
export function rollOf(beta, gamma, angle) {
  const a = ((num(angle) % 360) + 360) % 360;
  if (a === 90) return num(beta);
  if (a === 270) return -num(beta);
  return num(gamma);
}

// Which pedal is under the right thumb: GAS, BRAKE or BOOST. Rolling: off every pedal, the last one stays pressed
// while the thumb is within SLOP px of it, so sliding across the gap between pedals never drops the gas.
export const PEDALS = Object.freeze(['boost', 'gas', 'brake']);
export const SLOP = 28;
const inRect = (r, x, y, m = 0) => !!r && x >= r[0] - m && x < r[0] + r[2] + m && y >= r[1] - m && y < r[1] + r[3] + m;
export function pedalAt(layout, x, y, last = null) {
  const r = layout?.rects || {};
  for (const p of PEDALS) if (inRect(r[p], x, y)) return p;
  return last && inRect(r[last], x, y, SLOP) ? last : null;
}

// The touch target under a point, skipping hidden ones (the chip shows only when an action applies), then whether
// the point can start the stick: inside the steer area and on no showing target.
export function hitTarget(layout, x, y, hidden = null) {
  for (const name of layout?.targets || []) {
    if (hidden && hidden.has(name)) continue;
    if (inRect(layout.rects[name], x, y)) return name;
  }
  return null;
}
export function canSteer(layout, x, y, hidden = null) {
  return inRect(layout?.steerArea, x, y) && hitTarget(layout, x, y, hidden) === null;
}

// Haptics for the events that matter: pad rumble (final.md 13.3) and phone vibration on Android (handling 7.5).
export const HAPTICS = Object.freeze({
  near: { strong: 0, weak: 0.2, ms: 60, vibe: 12 },
  hairline: { strong: 0.1, weak: 0.3, ms: 70, vibe: 20 },
  driftTier: { strong: 0, weak: 0.3, ms: 40, vibe: 8 },
  driftBoost: { strong: 0.5, weak: 0.3, ms: 150, vibe: 30 },
  boostStart: { strong: 0.5, weak: 0.3, ms: 150, vibe: 30 },
  pad: { strong: 0.2, weak: 0.2, ms: 50, vibe: 10 },
  scrape: { strong: 0.6, weak: 0.3, ms: 120, vibe: 40 },
  crash: { strong: 1, weak: 0.6, ms: 250, vibe: 80 },
  bigCrash: { strong: 1, weak: 1, ms: 300, vibe: 100 },
  takedown: { strong: 0.8, weak: 0.4, ms: 160, vibe: 50 },
  punch: { strong: 1, weak: 0.5, ms: 200, vibe: 60 },
});

// ---------------------------------------------------------------- the live input

const switcherOpen = () => !!globalThis.GameSwitch?.isOpen;
const isField = (t) => !!t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '');
const isButton = (t) => !!t && (t.tagName === 'BUTTON' || t.tagName === 'A');
const DRIVE_MODES = new Set(['drive', 'zoom', 'runup', 'punch', 'tunnel', 'dropout', 'ended']);
const HELD_MODES = new Set(['paused', 'log']);

/**
 * createInput({ el, layout, settings, tune, source, onSource }) → {
 *   read(nowMs) → InputRecord (one reused object; step() clears its edges),
 *   context(mode, activity), setLayout(layout), setSettings(settings), source (getter), state (for the HUD: stick,
 *   pedals, actionHeld, chipDown), feedback(events), enableTilt() → Promise<boolean>, clear(), destroy() }.
 * el is the full-screen element under the HUD (the game canvas); it gets touch-action: none. layout comes from
 * core/layout.js layoutFor and must be replaced (setLayout) on resize or a scheme change. settings: game.settings
 * plus the UI-only mouseSteer and tilt. onSource(source) runs when the scheme switches (main.js re-lays out).
 */
export function createInput({ el, layout = null, settings = {}, tune = TUNE, source = null, onSource = null } = {}) {
  const T = tune;
  let L = layout, S = { ...settings }, src = source, mode = 'title', activity = null, alive = true;
  const rec = makeInput();
  const pointers = new Map();   // pointerId → { id, x, y, x0, y0, t0, role, pedal, kind }
  let stickId = null;
  const stick = { on: false, ax: 0, ay: 0, x: 0, y: 0, steer: 0, climb: 0 };
  const flick = createFlick(T);
  const action = createAction(T);
  const keys = new Set();
  const pending = { boostBurst: false, action: false, map: false, pause: false };
  let brakeDrift = false;         // BRAKE or a second finger turned into a drift; held until let go
  const climbHist = { t: new Float64Array(16), v: new Float64Array(16), head: 0, n: 0 };
  const mouse = { x: 0, y: 0, left: false, right: false, locked: false, seen: false };
  let padPrev = null, padIndex = -1, tapeEdge = 0;
  const tilt = { on: false, level: null, roll: 0, listening: false };
  let lastVibe = 0, lastT = 0;
  const axes = { steer: 0, climb: 0 }, kAx = {}, pAx = {};
  const hidden = new Set(['chip']);   // targets not on screen: their area steers (main.js calls show())

  if (el && el.style) el.style.touchAction = 'none';

  const now = () => (globalThis.performance ? performance.now() : Date.now());
  const setSource = (kind) => {
    const next = nextSource(src, kind, S);
    if (next !== src) {
      src = next;
      if (onSource) onSource(src);
    }
  };
  const blocked = () => !alive || switcherOpen();

  // ---------- touch and mouse pointers

  function down(e) {
    if (blocked()) return;
    const x = e.clientX, y = e.clientY, t = e.timeStamp || now();
    const mouseKind = e.pointerType === 'mouse';
    setSource(mouseKind ? 'mouseButton' : 'touch');
    if (!L) return;
    const hit = hitTarget(L, x, y, hidden);
    const p = { id: e.pointerId, x, y, x0: x, y0: y, t0: t, role: 'none', pedal: null, kind: e.pointerType };
    if (mouseKind) {
      if (hit === 'pause' || hit === 'radar' || hit === 'chip') {
        p.role = hit;
        if (hit === 'chip') action.press(t);
      } else if (S.mouseSteer && DRIVE_MODES.has(mode)) {
        p.role = 'mouse';
        if (e.button === 2) mouse.right = true; else mouse.left = true;
        if (!mouse.locked && el?.requestPointerLock) {
          try { const r = el.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* not allowed */ }
        }
      } else {
        return;
      }
    } else if (hit === 'gas' || hit === 'brake' || hit === 'boost') {
      p.role = 'pedal';
      p.pedal = hit;
    } else if (hit === 'chip') {
      p.role = 'chip';
      action.press(t);
    } else if (hit === 'pause' || hit === 'radar') {
      p.role = hit;              // a tap; a drag from the radar steers as usual
    } else if (S.scheme === 'one-thumb' && stickId !== null && pointers.has(stickId)) {
      p.role = 'second';         // one thumb: a second finger anywhere brakes, or drifts with a steer
    } else if (canSteer(L, x, y, hidden)) {
      startStick(p, t);
    } else {
      return;
    }
    e.preventDefault?.();
    try { el?.setPointerCapture?.(e.pointerId); } catch { /* the pointer may be gone */ }
    pointers.set(e.pointerId, p);
  }

  function startStick(p, t) {
    p.role = 'stick';
    stickId = p.id;
    stick.on = true;
    stick.ax = p.x; stick.ay = p.y; stick.x = p.x; stick.y = p.y;
    flick.reset(t, p.y);
    climbHist.n = 0;
  }

  function move(e) {
    const p = pointers.get(e.pointerId);
    if (e.pointerType === 'mouse' && mouse.locked) {
      mouse.x = clamp(mouse.x + num(e.movementX), -innerWidth / 2, innerWidth / 2);
      mouse.y = clamp(mouse.y + num(e.movementY), -innerHeight / 2, innerHeight / 2);
    } else if (e.pointerType === 'mouse') {
      mouse.x = e.clientX - (L?.w || innerWidth) / 2;
      mouse.y = e.clientY - (L?.h || innerHeight) / 2;
      mouse.seen = true;
    }
    if (!p) return;
    const x = e.clientX, y = e.clientY, t = e.timeStamp || now();
    p.x = x; p.y = y;
    if (p.role === 'radar' && Math.hypot(x - p.x0, y - p.y0) > T.INPUT.TAP_PX) {
      startStick(p, t);          // a drag that starts on the radar steers
      stick.ax = p.x0; stick.ay = p.y0;
    }
    if (p.role === 'stick' && p.id === stickId) {
      const corridor = CORRIDOR.includes(mode);
      stick.x = x; stick.y = y;
      stick.ax = follow(stick.ax, x, T.INPUT.STICK_FULL);
      stick.ay = follow(stick.ay, y, corridor ? T.INPUT.STICK_FULL : T.INPUT.CLIMB_FULL);
      // In the corridor a quick push up is a dodge, not a boost: no flick there (BOOST still boosts).
      if (!corridor && flick.move(t, y)) {
        pending.boostBurst = true;
        climbHist.n = 0;
      }
      if (!corridor && !flick.armed) stick.ay = y;   // the flick re-centres the stick, so the swipe never pitches
    } else if (p.role === 'pedal') {
      p.pedal = pedalAt(L, x, y, p.pedal);
    }
  }

  function up(e) {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') { if (e.button === 2) mouse.right = false; else mouse.left = false; }
      return;
    }
    const t = e.timeStamp || now();
    const tap = Math.hypot(e.clientX - p.x0, e.clientY - p.y0) <= T.INPUT.TAP_PX && t - p.t0 <= T.INPUT.TAP_MS;
    if (p.role === 'chip') {
      if (action.release(t) && hitTarget(L, e.clientX, e.clientY, hidden) === 'chip') pending.action = true;
    } else if (p.role === 'pause' && tap) {
      pending.pause = true;
    } else if (p.role === 'radar' && tap) {
      pending.map = true;
    } else if (p.role === 'mouse') {
      if (e.button === 2) mouse.right = false; else mouse.left = false;
    }
    end(p);
  }

  function cancel(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.role === 'chip') action.cancel();
    if (p.role === 'mouse') { mouse.left = false; mouse.right = false; }
    end(p);
  }

  function end(p) {
    pointers.delete(p.id);
    try { if (el?.hasPointerCapture?.(p.id)) el.releasePointerCapture(p.id); } catch { /* gone */ }
    if (p.id === stickId) {
      stickId = null;
      stick.on = false;
      climbHist.n = 0;
    }
  }

  // ---------- keys

  function keydown(e) {
    if (blocked() || isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (!GAME_KEYS.has(code)) return;
    const driving = DRIVE_MODES.has(mode);
    if (HELD_MODES.has(mode)) {
      // Menus own their keys; Esc and P resume from pause, Esc, Tab and M close the log.
      if (e.repeat) return;
      if (mode === 'log' && (KEYS.map.includes(code) || code === 'Escape')) { pending.map = true; e.preventDefault(); }
      else if (mode === 'paused' && KEYS.pause.includes(code)) { pending.pause = true; e.preventDefault(); }
      return;
    }
    if (!driving) return;
    if (isButton(e.target)) {
      if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') e.preventDefault();
      e.target.blur?.();
    }
    if (code === 'Tab' || code === 'Space' || code.startsWith('Arrow') || code === 'Backspace') e.preventDefault();
    setSource('key');
    if (e.repeat) return;
    keys.add(code);
    const t = e.timeStamp || now();
    if (KEYS.action.includes(code)) action.press(t);
    else if (KEYS.restart.includes(code)) action.jolt();
    else if (KEYS.map.includes(code)) { pending.map = true; e.preventDefault(); }
    else if (KEYS.pause.includes(code)) { pending.pause = true; e.preventDefault(); }
  }

  function keyup(e) {
    if (!keys.has(e.code)) return;
    keys.delete(e.code);
    if (KEYS.action.includes(e.code) && !any(keys, KEYS.action)) {
      if (action.release(e.timeStamp || now())) pending.action = true;
    }
  }

  // ---------- focus, pointer lock, tilt

  function clear() {
    for (const p of [...pointers.values()]) end(p);
    pointers.clear();
    stickId = null;
    stick.on = false;
    keys.clear();
    action.cancel();
    mouse.left = false; mouse.right = false;
    brakeDrift = false;
    pending.boostBurst = false; pending.action = false;
  }
  const onBlur = () => clear();
  const onVis = () => { if (document.hidden) clear(); };
  const onLock = () => {
    mouse.locked = typeof document !== 'undefined' && document.pointerLockElement === el;
    if (mouse.locked) { mouse.x = 0; mouse.y = 0; }
  };
  const onTilt = (e) => {
    const angle = globalThis.screen?.orientation?.angle ?? globalThis.orientation ?? 0;
    tilt.roll = rollOf(e.beta, e.gamma, angle);
    if (tilt.level === null) tilt.level = tilt.roll;
  };

  const ctxMenu = (e) => e.preventDefault();
  if (el) {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
    el.addEventListener('contextmenu', ctxMenu);
  }
  if (typeof addEventListener === 'function') {
    addEventListener('keydown', keydown);
    addEventListener('keyup', keyup);
    addEventListener('blur', onBlur);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('pointerlockchange', onLock);
  }

  // Tilt needs a tap on iOS (DeviceOrientationEvent.requestPermission). Call from the settings toggle's click.
  async function enableTilt() {
    const D = globalThis.DeviceOrientationEvent;
    if (!D) return false;
    try {
      if (typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') return false;
    } catch { return false; }
    tilt.on = true;
    tilt.level = null;                     // set level from the next reading
    if (!tilt.listening) { addEventListener('deviceorientation', onTilt); tilt.listening = true; }
    return true;
  }
  function disableTilt() {
    tilt.on = false;
    if (tilt.listening) { removeEventListener('deviceorientation', onTilt); tilt.listening = false; }
  }

  // ---------- the pad, polled each read

  function readPad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return null;
    let pad = padIndex >= 0 ? pads[padIndex] : null;
    if (!pad || !pad.connected) {
      pad = null;
      for (const p of pads) if (p && p.connected && padPressed(p)) { pad = p; break; }
      padIndex = pad ? pad.index : -1;
    }
    if (!pad) return null;
    if (padPressed(pad)) setSource('padButton');
    return pad;
  }

  // The climb the ship sees: while a flick could still be starting, the value from PITCH_DELAY ago.
  function delayedClimb(t, c) {
    const h = climbHist, CAP = h.t.length;
    h.t[h.head] = t; h.v[h.head] = c; h.head = (h.head + 1) % CAP; h.n = Math.min(CAP, h.n + 1);
    if (!flick.possible(t)) return c;
    const want = t - T.INPUT.PITCH_DELAY;
    for (let k = 0; k < h.n; k++) {
      const i = (h.head - 1 - k + CAP) % CAP;
      if (h.t[i] <= want) return Math.abs(h.v[i]) < Math.abs(c) ? h.v[i] : c;   // never more than the live value
    }
    return 0;
  }

  // ---------- one record a frame

  function read(nowMs) {
    const t = Number.isFinite(nowMs) ? nowMs : now();
    lastT = t;
    const r = rec;
    r.steer = 0; r.climb = 0; r.gas = 0; r.brake = 0; r.drift = false; r.boost = false;
    r.boostBurst = false; r.action = false; r.actionHeld = 0; r.lookBack = false; r.map = false; r.pause = false;
    r.autoDrift = false;
    const pad = readPad();
    r.source = src || 'keys';
    if (blocked()) { clearEdges(); return r; }
    if (HELD_MODES.has(mode) || mode === 'title') {
      r.map = pending.map; r.pause = pending.pause;
      clearEdges();
      return r;
    }
    const inv = !!S.invertClimb;
    if (src === 'touch') {
      readTouch(r, t, inv);
    } else if (src === 'pad' && pad) {
      padAxes(pad, T, inv, pAx);
      r.steer = pAx.steer; r.climb = pAx.climb; r.gas = pAx.gas; r.brake = pAx.brake; r.boost = pAx.boost;
      r.drift = pAx.drift; r.lookBack = pAx.lookBack;
      const prev = padPrev || {};
      if (pAx.action && !prev.action) action.press(t);
      if (!pAx.action && prev.action && action.release(t)) pending.action = true;
      if (pAx.map && !prev.map) pending.map = true;
      if (pAx.pause && !prev.pause) pending.pause = true;
      if (pAx.tapeLeft && !prev.tapeLeft) tapeEdge = -1;
      if (pAx.tapeRight && !prev.tapeRight) tapeEdge = 1;
      padPrev = { ...pAx };
    } else {
      keyAxes(keys, kAx);
      r.steer = kAx.steer; r.climb = kAx.climb; r.gas = kAx.gas; r.brake = kAx.brake; r.drift = kAx.drift;
      r.boost = kAx.boost; r.lookBack = kAx.lookBack;
      if (src === 'mouse' && S.mouseSteer) {
        mouseAxes(mouse.x, mouse.y, L?.w || innerWidth, T, inv, axes);
        r.steer = clamp(r.steer + axes.steer, -1, 1);
        r.climb = clamp(r.climb + axes.climb, -1, 1);
        if (mouse.left) r.gas = 1;
        if (mouse.right) r.drift = true;
      }
    }
    if (tilt.on && tilt.level !== null && src === 'touch' && L?.kind === 'landscape') {
      r.steer = clamp(r.steer + tiltSteer(tilt.roll, tilt.level, T), -1, 1);
    }
    r.autoDrift = src === 'touch' && S.autoDrift !== false;
    r.boostBurst = pending.boostBurst;
    r.action = pending.action;
    r.actionHeld = action.take(t);
    r.map = pending.map;
    r.pause = pending.pause;
    clearEdges();
    return r;
  }

  function clearEdges() {
    pending.boostBurst = false; pending.action = false; pending.map = false; pending.pause = false;
  }

  function readTouch(r, t, inv) {
    if (stick.on && CORRIDOR.includes(mode)) {
      corridorAxes(stick.x - stick.ax, stick.y - stick.ay, T, inv, axes);
      stick.steer = axes.steer;
      stick.climb = axes.climb;
      r.steer = stick.steer;
      r.climb = stick.climb;
    } else if (stick.on) {
      stickAxes(stick.x - stick.ax, stick.y - stick.ay, T, inv, axes);
      stick.steer = axes.steer;
      stick.climb = delayedClimb(t, axes.climb);
      r.steer = stick.steer;
      r.climb = stick.climb;
    } else {
      stick.steer = 0; stick.climb = 0;
    }
    let gas = 0, brake = 0, boost = false, second = false;
    for (const p of pointers.values()) {
      if (p.role === 'pedal') {
        if (p.pedal === 'gas') gas = 1;
        else if (p.pedal === 'brake') brake = 1;
        else if (p.pedal === 'boost') boost = true;
      } else if (p.role === 'second') {
        second = true;
      }
    }
    if (S.scheme === 'one-thumb' && stick.on) gas = 1;    // one thumb: touch held is gas
    const braking = brake > 0 || second;
    if (!braking) brakeDrift = false;
    else if (Math.abs(r.steer) >= T.DRIFT.MIN_STEER) brakeDrift = true;
    r.gas = gas;
    r.boost = boost;
    if (brakeDrift) { r.drift = true; r.brake = 0; } else { r.brake = braking ? 1 : 0; }
  }

  // ---------- haptics

  function feedback(events) {
    if (!events || !events.length || blocked()) return;
    let best = null;
    for (const e of events) {
      const h = HAPTICS[e?.type];
      if (h && (!best || h.ms > best.ms)) best = h;
    }
    if (!best) return;
    const t = now();
    if (src === 'pad') {
      const pads = navigator.getGamepads?.() || [];
      const act = pads[padIndex]?.vibrationActuator;
      try {
        act?.playEffect?.('dual-rumble', { duration: best.ms, strongMagnitude: best.strong, weakMagnitude: best.weak })
          ?.catch?.(() => {});
      } catch { /* no rumble */ }
    } else if (src === 'touch' && typeof navigator !== 'undefined' && navigator.vibrate && t - lastVibe > 60) {
      lastVibe = t;
      try { navigator.vibrate(best.vibe); } catch { /* not allowed */ }
    }
  }

  return {
    read,
    context(m, act = null) {
      if (m !== mode && (HELD_MODES.has(m) || m === 'title')) clear();
      if (m !== mode && mouse.locked && !DRIVE_MODES.has(m)) {
        try { document.exitPointerLock?.(); } catch { /* fine */ }
      }
      mode = m;
      activity = act;
    },
    setLayout(l) { L = l; },
    // Which optional targets are on screen, e.g. show({ chip: !!hudModel.chip, radar: hudModel.radar }).
    show(on) {
      for (const [name, v] of Object.entries(on || {})) if (v) hidden.delete(name); else hidden.add(name);
    },
    setSettings(s) {
      S = { ...S, ...s };
      if (!S.tilt && tilt.on) disableTilt();
    },
    enableTilt,
    disableTilt,
    feedback,
    clear,
    // The radio tape asked for on the pad's D-pad since the last call: −1, 0 or 1.
    tape() { const v = tapeEdge; tapeEdge = 0; return v; },
    get source() { return src || 'keys'; },
    get mode() { return mode; },
    get activity() { return activity; },
    get layout() { return L; },
    // What the HUD draws: the stick, the pedals under the thumb, the chip's hold.
    get state() {
      let gas = false, brake = false, boost = false;
      for (const p of pointers.values()) {
        if (p.role !== 'pedal') continue;
        gas ||= p.pedal === 'gas'; brake ||= p.pedal === 'brake'; boost ||= p.pedal === 'boost';
      }
      if (src === 'keys' || src === 'mouse') {
        gas ||= any(keys, KEYS.gas); brake ||= any(keys, KEYS.brake) || any(keys, KEYS.drift);
        boost ||= any(keys, KEYS.boost);
      }
      return {
        stick: stick.on ? { ax: stick.ax, ay: stick.ay, x: stick.x, y: stick.y, steer: stick.steer, climb: stick.climb }
          : null,
        gas, brake, boost, drift: brakeDrift, chipDown: action.down, actionHeld: action.held(lastT),
        pointers: pointers.size,
      };
    },
    destroy() {
      alive = false;
      clear();
      disableTilt();
      if (el) {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', cancel);
        el.removeEventListener('lostpointercapture', cancel);
        el.removeEventListener('contextmenu', ctxMenu);
      }
      if (typeof removeEventListener === 'function') {
        removeEventListener('keydown', keydown);
        removeEventListener('keyup', keyup);
        removeEventListener('blur', onBlur);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('pointerlockchange', onLock);
      }
    },
  };
}
