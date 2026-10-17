// Ahead of the Light: touch, mouse, keys and the gamepad into one intent a step (final.md 5, 15.1, 15.2).
// A sideways drag steers (lab A's gain curve; the newest moving pointer steers; a re-grip keeps the target). A flick
// up burns, mid-drag too, and its sideways part never steers (v3's createFlick, copied). A new press is the action:
// it grabs in a well's window, is held to whip and lifted to fling; a drag of CANCEL_PX within LATCH_S of the press
// lifts it at once (a re-grip, so the core cancels the latch at no cost). Keys: ← → or A D turn (replayed onto the
// 120 Hz steps by timestamp), Space grabs and holds, ↑ W or Shift burns. The mouse steers only with its left button
// held (a click is a press) and burns with the right. The pad: left stick X or the d-pad, A, RB or RT. The steering
// device locks to the first deliberate steering input and changes only on a deliberate input of another. On pause
// the state freezes; a whip still live when play goes on waits for a fresh press (HOLD TO GO ON).
// createInput is pure (times in ms, CSS px, y down) so node tests can drive it; bindInput and pollPad touch the DOM.
import { TUNE } from '../core/tune.js';
import { windowOpen } from '../core/handle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// Drag gain (°/px) at thumb speed v (px/s): GAIN at GAIN_V0 or slower, rising smoothly to GAIN_FAST at GAIN_V1.
export function gainAt(v, tune = TUNE) {
  const k = clamp((v - tune.GAIN_V0) / Math.max(1, tune.GAIN_V1 - tune.GAIN_V0), 0, 1);
  return tune.GAIN + (tune.GAIN_FAST - tune.GAIN) * k * k * (3 - 2 * k);
}

/**
 * The flick up for a burn: FLICK_PX up within FLICK_MS at FLICK_SPEED or more. move(t, y) returns true once per
 * flick (times in ms, y in CSS px, down positive). One swipe is one burst: after a flick nothing fires until the
 * thumb slows or turns back (armed). possible(t) is true while a flick could still be starting.
 * Copied from light-years-home/ui/input.js (createFlick), reading this game's flat FLICK_* keys.
 */
export function createFlick(tune = TUNE) {
  const I = tune;
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

const STEER_L = new Set(['ArrowLeft', 'KeyA']), STEER_R = new Set(['ArrowRight', 'KeyD']);
const BURN_KEYS = new Set(['ArrowUp', 'KeyW', 'ShiftLeft', 'ShiftRight']);
const ACTION_KEYS = new Set(['Space']);
export const GAME_KEYS = new Set([...STEER_L, ...STEER_R, ...BURN_KEYS, ...ACTION_KEYS]);
const PAD_DEAD = 0.15, PAD_EXP = 1.6, PAD_TAKE = 0.5, MOUSE_TAKE = 20;

/**
 * The gesture machine. opts: { tune, burnTap (?burn=tap), halves (?scheme=halves), width (for halves) }.
 * Feed it pointerDown/Move/Up/Cancel, keyDown/Up and pad snapshots with their timestamps (ms), then call
 * take(race, ship, t) once a step with the step's time: it returns the step's intent (one object, reused).
 */
export function createInput({ tune = TUNE, burnTap = false, halves = false, width = 390 } = {}) {
  const T = tune;
  const ptrs = new Map();                 // id → pointer
  const pool = [];                        // flick detectors to reuse
  const edges = [];                       // { t, type: 'down' | 'up' | 'burn' } in time order
  const keyQ = [];                        // { t, l, r } key state changes
  let keyNow = { l: false, r: false }, keys = { l: false, r: false };
  let dAim = 0, active = null, hold = null, scheme = null, frozen = false, waiting = false, inWindow = false;
  let padTurn = 0, padHold = false, padBurn = false;
  let w = width;
  const intent = { target: null, turn: 0, action: null, burn: false };
  // what the hands did, for the test hook; aim is the degrees of drag turned into the aim so far
  const counts = { presses: 0, flicks: 0, taps: 0, cancels: 0, drags: 0, aim: 0 };

  const lock = (kind) => { scheme = kind; };
  const steerOk = (kind) => scheme === null || scheme === kind;
  const queue = (t, type) => {
    if (frozen) return;
    let i = edges.length;
    while (i > 0 && edges[i - 1].t > t) i--;
    edges.splice(i, 0, { t, type });
  };
  // A new press: the action, unless the game waits for a fresh press to carry on a whip (HOLD TO GO ON).
  const press = (t, who) => {
    if (waiting) { waiting = false; hold = who; return; }
    hold = who;
    counts.presses++;
    queue(t, 'down');
  };
  const lift = (t, who) => {
    if (hold !== who) return;
    hold = null;
    queue(t, 'up');
  };

  function pointerDown(id, x, y, t, { kind = 'touch', button = 0, actionOnly = false } = {}) {
    if (kind === 'mouse' && button === 2) { queue(t, 'burn'); return; }      // the right button burns
    if (kind === 'mouse' && button !== 0) return;
    const f = pool.pop() || createFlick(T);
    f.reset(t, y);
    const p = { id, kind, x, y, x0: x, y0: y, t0: t, t, v: 0, n: 0, travel: 0, dragging: false, pend: 0, pendT: 0,
      flick: f, actionOnly, win: inWindow, side: 0, lat: 0 };
    ptrs.set(id, p);
    if (halves && kind !== 'mouse' && !actionOnly) {
      const others = [...ptrs.values()].filter((q) => q !== p && q.side !== 0);
      if (!others.length) {
        p.side = x < w / 2 ? -1 : 1;
        lock('touch');
        return;
      }
    }
    press(t, id);
  }

  function pointerMove(id, x, y, t) {
    const p = ptrs.get(id);
    if (!p) return;
    const dx = x - p.x, dy = y - p.y;
    const dt = Math.max(0.004, (t - p.t) / 1000 || 0.016);
    const inst = Math.hypot(dx, dy) / dt;
    p.v = p.n++ ? p.v + (inst - p.v) * 0.5 : inst;     // thumb speed, px/s
    p.travel = Math.hypot(x - p.x0, y - p.y0);
    p.lat += Math.abs(dx);
    p.x = x; p.y = y; p.t = t;
    if (frozen) return;
    // a flick up burns, from any pointer; the sideways part of the swipe is dropped
    if (p.flick.move(t, y)) { queue(t, 'burn'); counts.flicks++; p.pend = 0; }
    // a drag inside the latch is a re-grip: lift the press at once (the core cancels the grab at no cost)
    if (hold === id && t - p.t0 <= T.LATCH_S * 1000 && p.travel >= T.CANCEL_PX) {
      hold = null;
      counts.cancels++;
      queue(t, 'up');
    }
    if (p.actionOnly || p.side !== 0) return;
    const up = dy < 0 && Math.abs(dy) > Math.abs(dx);
    if (up && !p.flick.armed) { p.pend = 0; return; }          // the rest of a flick's swipe never steers
    const deliberate = p.kind === 'mouse' ? MOUSE_TAKE : T.DRAG_PX;
    if (!p.dragging) {
      if (p.travel < T.DRAG_PX) { if (!p.pend) p.pendT = t; p.pend += dx * gainAt(p.v, T); return; }
      // the newest moving pointer steers; if another was steering a moment ago, this one's first pixels are dropped
      // so two thumbs never double the gain
      p.dragging = true;
      counts.drags++;
      const q = active !== null ? ptrs.get(active) : null;
      if (q && q !== p && t - q.t < 100) p.pend = 0;
      active = id;
    }
    if (active !== id) return;
    const kind = p.kind === 'mouse' ? 'mouse' : 'touch';
    if (!steerOk(kind)) {
      if (p.lat >= deliberate) lock(kind); else return;
    } else if (scheme === null) lock(kind);
    const g = dx * gainAt(p.v, T);
    // an upward-dominant sample might be the start of a flick: hold its sideways part for FLICK_MS
    if (up) { if (!p.pend) p.pendT = t; p.pend += g; return; }
    dAim += p.pend + g;
    p.pend = 0;
  }

  function pointerUp(id, x, y, t) {
    const p = ptrs.get(id);
    if (!p) return;
    if (finite(x) && finite(y)) pointerMove(id, x, y, t);
    ptrs.delete(id);
    pool.push(p.flick);
    if (active === id) {
      active = null;
      for (const q of ptrs.values()) if (q.dragging && !q.actionOnly) active = q.id;
    }
    // ?burn=tap: a press and lift within TAP_MS and TAP_PX, outside a window, burns
    if (burnTap && !p.win && hold === id && t - p.t0 <= T.TAP_MS && p.travel <= T.TAP_PX) {
      counts.taps++;
      queue(t, 'burn');
    }
    lift(t, id);
  }

  function pointerCancel(id, t) {
    const p = ptrs.get(id);
    if (!p) return;
    ptrs.delete(id);
    pool.push(p.flick);
    if (active === id) active = null;
    lift(t, id);
  }

  function keyDown(code, t) {
    if (STEER_L.has(code) || STEER_R.has(code)) {
      if (STEER_L.has(code)) keys.l = true; else keys.r = true;
      lock('keys');
      if (!frozen) keyQ.push({ t, l: keys.l, r: keys.r });
      return true;
    }
    if (BURN_KEYS.has(code)) { queue(t, 'burn'); return true; }
    if (ACTION_KEYS.has(code)) {
      if (hold !== 'key') press(t, 'key');
      return true;
    }
    return false;
  }

  function keyUp(code, t) {
    if (STEER_L.has(code) || STEER_R.has(code)) {
      if (STEER_L.has(code)) keys.l = false; else keys.r = false;
      if (!frozen) keyQ.push({ t, l: keys.l, r: keys.r });
      return true;
    }
    if (ACTION_KEYS.has(code)) { lift(t, 'key'); return true; }
    return BURN_KEYS.has(code);
  }

  // A pad snapshot: { x: left stick X, left, right (d-pad), a, burn (RB or RT) }. Edges come from changes.
  function pad({ x = 0, left = false, right = false, a = false, burn = false } = {}, t = 0) {
    const ax = Math.abs(x);
    let turn = ax <= PAD_DEAD ? 0 : Math.sign(x) * ((ax - PAD_DEAD) / (1 - PAD_DEAD)) ** PAD_EXP;
    if (left !== right) turn = left ? -1 : 1;
    if (ax >= PAD_TAKE || left !== right) lock('pad');
    padTurn = steerOk('pad') ? turn : 0;
    if (a && !padHold) { padHold = true; press(t, 'pad'); }
    if (!a && padHold) { padHold = false; lift(t, 'pad'); }
    if (burn && !padBurn) queue(t, 'burn');
    padBurn = burn;
  }

  function keyTurn(t) {
    while (keyQ.length && keyQ[0].t <= t) keyNow = keyQ.shift();
    return (keyNow.r ? 1 : 0) - (keyNow.l ? 1 : 0);
  }

  // The intent for the step at time t (ms). Reads the race only to know whether a grab window is open (for
  // ?burn=tap). Gives at most one action and one burn a step; the rest wait for the next step.
  function take(race, ship, t) {
    intent.target = null;
    intent.turn = 0;
    intent.action = null;
    intent.burn = false;
    inWindow = race && ship ? windowOpen(race, ship) : false;
    if (frozen || waiting) return intent;
    for (const p of ptrs.values()) {
      if (p.pend && p.id === active && t - p.pendT > T.FLICK_MS && p.dragging && !p.flick.possible(t)) {
        dAim += p.pend;
        p.pend = 0;
      }
    }
    // keys first, then halves, then the pad; a turn drops any drag waiting to apply
    let turn = steerOk('keys') ? keyTurn(t) : (keyTurn(t), 0);
    if (!turn && halves && steerOk('touch')) {
      let l = false, r = false;
      for (const p of ptrs.values()) { if (p.side < 0) l = true; else if (p.side > 0) r = true; }
      turn = (r ? 1 : 0) - (l ? 1 : 0);
    }
    if (!turn && padTurn) turn = padTurn;
    if (turn) { intent.turn = turn; dAim = 0; }
    else if (dAim !== 0 && ship) { intent.target = ship.target + dAim; counts.aim += dAim; dAim = 0; }
    let gotAction = false, gotBurn = false;
    for (let i = 0; i < edges.length;) {
      const e = edges[i];
      if (e.t > t) break;
      if (e.type === 'burn') {
        if (gotBurn) { i++; continue; }
        gotBurn = true;
        intent.burn = true;
      } else {
        if (gotAction) break;                 // a down and its up land on separate steps
        gotAction = true;
        intent.action = e.type;
      }
      edges.splice(i, 1);
    }
    return intent;
  }

  return {
    pointerDown, pointerMove, pointerUp, pointerCancel, keyDown, keyUp, pad, take,
    // Pause: the state freezes. trust (the pause button or key): lifts are still seen, so a thumb still down keeps
    // holding. Otherwise (a blur or a hidden page) lifts can be missed, so the pointers and keys are forgotten.
    pause(trust = true) {
      frozen = true;
      edges.length = 0;
      dAim = 0;
      if (!trust) {
        for (const p of ptrs.values()) pool.push(p.flick);
        ptrs.clear();
        active = null;
        hold = null;
        keys = { l: false, r: false };
        keyNow = { l: false, r: false };
        keyQ.length = 0;
        padHold = false;
      }
    },
    // Back to play. With a whip still live and nothing holding, the next press carries it on with no new action:
    // → 'regrip' (show HOLD TO GO ON until `waiting` is false), else 'play'.
    resume(whipLive = false) {
      frozen = false;
      if (whipLive && hold === null) { waiting = true; return 'regrip'; }
      return 'play';
    },
    // A new run: drop every edge and the drag, keep the lock's device as the start (the last run's scheme).
    reset() { edges.length = 0; dAim = 0; keyQ.length = 0; waiting = false; },
    unlock() { scheme = null; },
    resize(width2) { w = width2; },
    get holding() { return hold !== null; },
    get waiting() { return waiting; },
    get frozen() { return frozen; },
    get scheme() { return scheme; },
    get pointers() { return ptrs.size; },
    get pending() { return edges.length; },
    counts,
  };
}

// ---------------------------------------------------------------- the DOM

/**
 * Wire the page to an input machine. opts: { el (the play surface), now() (ms, the events' clock), topDead (px at
 * the top that never count as play), button (?button=1: a function returning the action button's rect),
 * blocked() (true while a menu or the arcade switcher owns input), onKey(code, e) (keys the game does not use) }.
 * Returns a function that unbinds everything.
 */
export function bindInput(input, { el = window, tune = TUNE, topDead = tune.TOP_DEAD, button = null,
  blocked = () => false, onKey = null } = {}) {
  const isControl = (t) => Boolean(t && t.closest && t.closest('button, a, input, select, [data-ui]'));
  const inButton = (x, y) => {
    const r = button && button();
    return Boolean(r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  };
  const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); return () => target.removeEventListener(type, fn, o); };
  // An event's time on the page clock (performance.now()). Most browsers stamp events on that clock; some synthetic
  // and platform events do not, so a stamp more than a second off is moved by the same offset as its event.
  const clock = (e) => {
    const now = performance.now(), ts = e.timeStamp;
    return Number.isFinite(ts) && Math.abs(ts - now) < 1000 ? 0 : now - (Number.isFinite(ts) ? ts : now);
  };
  const offs = [];
  offs.push(on(el, 'pointerdown', (e) => {
    if (blocked() || isControl(e.target)) return;
    if (e.pointerType !== 'mouse' && e.clientY < topDead) return;
    input.pointerDown(e.pointerId, e.clientX, e.clientY, e.timeStamp + clock(e), { kind: e.pointerType || 'touch',
      button: e.button, actionOnly: inButton(e.clientX, e.clientY) });
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    if (e.cancelable) e.preventDefault();
  }, { passive: false }));
  offs.push(on(el, 'pointermove', (e) => {
    const off = clock(e);
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    if (list.length) for (const q of list) input.pointerMove(e.pointerId, q.clientX, q.clientY, q.timeStamp + off);
    else input.pointerMove(e.pointerId, e.clientX, e.clientY, e.timeStamp + off);
  }));
  offs.push(on(el, 'pointerup', (e) => input.pointerUp(e.pointerId, e.clientX, e.clientY, e.timeStamp + clock(e))));
  offs.push(on(el, 'pointercancel', (e) => input.pointerCancel(e.pointerId, e.timeStamp + clock(e))));
  offs.push(on(el, 'contextmenu', (e) => e.preventDefault()));
  offs.push(on(window, 'keydown', (e) => {
    if (blocked() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (GAME_KEYS.has(e.code)) {
      if (e.target && isControl(e.target) && e.code === 'Space') return;
      e.preventDefault();
      if (!e.repeat) input.keyDown(e.code, e.timeStamp + clock(e));
      return;
    }
    if (onKey) onKey(e.code, e);
  }));
  offs.push(on(window, 'keyup', (e) => { if (GAME_KEYS.has(e.code)) input.keyUp(e.code, e.timeStamp + clock(e)); }));
  return () => { for (const off of offs) off(); };
}

// Read the first connected pad (standard mapping) into the machine: left stick X, the d-pad, A, RB or RT; Start
// comes back so the page can pause. → { start } or null.
export function pollPad(input, t) {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads || []) {
    if (!g || !g.connected) continue;
    const b = (i) => Boolean(g.buttons[i] && g.buttons[i].pressed);
    input.pad({ x: g.axes[0] || 0, left: b(14), right: b(15), a: b(0), burn: b(5) || b(7) }, t);
    return { start: b(9), y: b(3) };
  }
  return null;
}
