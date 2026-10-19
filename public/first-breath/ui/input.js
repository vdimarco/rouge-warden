// First Breath: one pointer and the keys into one Intents object a fixed step (design.md 5.3, 16.2, 16.3).
//
// The pointer (only the first one counts; every other pointer is ignored until it lifts):
//
//   | From                | Event                        | To       | Emits                                   |
//   | idle                | down at t0, p0               | pressed  | press {t: t0}; stick origin = p0        |
//   | pressed             | moves > 12 px from p0        | dragging | dir = dominant screen axis of the move  |
//   | pressed             | 220 ms pass with < 12 px     | holding  |                                         |
//   | pressed             | up before 220 ms, < 12 px    | idle     | tap {t: t0}, release {t: t1}            |
//   | holding or dragging | up at t1                     | idle     | release {t: t1}                         |
//
// The floating stick: origin at touch-down, dead zone 8 px, full deflection at 56 px, m = clamp((d − 8) / 48, 0, 1);
// past 80 px the origin trails the finger. The stick is a screen vector; camera().stickToWorld turns it into world
// steer, so core never knows the screen's orientation. The mouse's left button is the pointer; the other buttons do
// nothing. A mouse over the page with no button down sets `aim` (its world point) once it has moved more than 4 px;
// any steer or turn key clears it until the mouse moves more than 4 px again. Touch and pen never set it.
//
// The "move" gesture (the action stages, contract.md): drag anywhere to move (the floating stick above is the move
// vector); the touch-down itself is no press. A dash is a press: a second finger's touch-down while the first one
// steers, a quick second tap (a touch-down within 0.3 s and 60 px of a tap's end), or Space, Enter or Z. WASD or the
// arrows move (keys "steer").
//
// Keys: arrows or WASD steer (8-way, smoothed over 0.12 s) and the left and right ones (A, D) also set `turn` (−1 is
// anticlockwise as seen, +1 clockwise). Space, Enter or Z presses on keydown and releases on keyup. In a `dragHold`
// moment an arrow or WASD keydown is a press with its dir and its keyup the release; Space alone is a plain hold
// (dir null). With keys "turn" (the stage 2 guard) the arrows and WASD set only `turn`: W, S and the up and down
// arrows do nothing, and keys never steer (only a pointer drag does). With keys "lanes" (stage 6's kicks) every arrow
// or WASD keydown is a press that carries its dir (left and right move a lane and kick; up and down kick in place),
// keys never steer, and intents.dir stays null (a drag's dir too: the stage reads the stick). Every pointer press
// carries its world point { x, y } (camera().toWorld), so stage 6 kicks in the lane you tap. Key repeats are ignored. One-button mode
// (settings.oneButton): every key but the menu keys is a press on keydown and a release on keyup, keys never steer
// or turn, and core/run.js sets steer and dir from the stage's botSteer while the button is held (16.4). In a hold or
// dragHold moment the keys and the pointer make one hold: the first one down is the press, a later one joins it (an
// arrow added to a held Space sets dir), and only the last one up is the release.
//
// A hold needs a fresh press (5.3): when the live gesture becomes hold or dragHold, a pointer or key that is already
// down cannot start the hold, and its release is dropped; the next touch-down or keydown is the press. "Already
// down" is judged at the core time of the change (setLive's `at`), not at the call: the page hears of a stage's new
// moment only after the step that made it, so a press made in between (at or after `at`, its t after the offset) is
// a fresh press in the new moment, as the stage judges it, and keeps its release.
//
// Times: every press, release and tap carries raw = coreTime(event.timeStamp) (core seconds, before the offset) and
// t = raw − settings.offsetMs / 1000. intents(tStepEnd) drains every queued event with t < tStepEnd, in time order,
// so each one lands in the step whose range holds its t and keeps its exact times.
//
// Contract choices (16.2 gives createInput(el, { coreTime, camera, settings }) → { setLive, intents, stick, inject,
// dispose }):
// - setLive(gesture, keys, at) takes an optional third argument, the core time (seconds, after the offset) the new
//   gesture began: main.js passes a prompt event's t. Without it the change counts from now (a screen change, Resume).
// - settings is an object read live (offsetMs, oneButton), or a function that returns one. camera is a function that
//   returns the current camera (render/camera.js); without one, the screen stick maps to world as portrait does.
// - el is the play area: pointer events count only there (the HUD, the screens and their buttons sit outside it).
//   Keys are read on window; Esc, P, M, C and Tab are menu keys (main.js), never a press. el may be null (node tests).
//   While the game switcher (window.GameSwitch) is open, no key reaches the game. A repeated Space or Enter on a
//   button does nothing, so a key held from play never clicks the button a new screen focuses; on the HUD's pause
//   button Space and Enter are presses, not clicks, while you play (no screen is up; Esc and P pause).
// - stick is one object updated in place: { on, ox, oy, x, y } with the origin and the finger in CSS px.
// - dir comes from the pointer while it drags (the dominant axis of the finger from the stick origin, once past
//   12 px), else from the last arrow or WASD key still held (never in keys "turn" or one-button mode).
// - touching: the pointer is down (a stale one included), or a key that counts in the current mode is held.
// - Extras: flush() drops every queued event (main.js calls it when play starts, so a menu key or tap never reaches a
//   stage), and a key or pointer whose press it drops loses its release too; flush({ resume: true }) (Resume) keeps
//   each release whose press a stage already took, so a hold let go while paused or hidden ends at the paused time;
//   pointer() gives the machine's state ("idle" | "pressed" | "dragging" | "holding");
//   live() gives { gesture, keys }; blur releases held keys (keyups that will never come).
// - inject(events) feeds test events: { type: "press" | "release" | "tap", t, raw? } go straight to the queue (t is
//   core seconds after the offset; raw defaults to t plus the offset); { type: "pointerdown" | "pointermove" |
//   "pointerup" | "pointercancel", id, kind, x, y, button, buttons, t } and { type: "keydown" | "keyup", code,
//   repeat, t } run through the same machine (their t is raw core seconds).
import { makeIntents } from "../core/intent.js";

export const PTR = Object.freeze({ tapS: 0.22, slopPx: 12, deadPx: 8, fullPx: 56, trailPx: 80, aimPx: 4, keySmoothS: 0.12,
  dashTapS: 0.3, dashTapPx: 60 });

const KEY_VEC = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const KEY_DIR = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};
const TURN_L = new Set(["ArrowLeft", "KeyA"]);
const TURN_R = new Set(["ArrowRight", "KeyD"]);
const ACTION = new Set(["Space", "Enter", "NumpadEnter", "KeyZ"]);
export const MENU_KEYS = new Set(["Escape", "KeyP", "KeyM", "KeyC", "Tab"]);
const MODIFIERS = new Set(["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight",
  "MetaLeft", "MetaRight", "CapsLock", "Fn"]);
const HOLDS = new Set(["hold", "dragHold"]);
const GESTURES = new Set(["drag", "tap", "hold", "dragHold", "move", "none"]);

const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const axisDir = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "down" : "up"));

export function createInput(el, { coreTime = (ms) => ms / 1000, camera = null, settings = {} } = {}) {
  const S = () => (typeof settings === "function" ? settings() : settings) || {};
  const cam = () => (typeof camera === "function" ? camera() : camera) || null;
  const offS = () => (fin(S().offsetMs) ? S().offsetMs / 1000 : 0);
  const oneButton = () => !!S().oneButton;

  let gesture = "none", keysMode = "steer";
  const q = [];                                  // { type, t, raw } sorted by t
  let ptr = null;                                // the one live pointer
  const held = new Map();                        // code → { order, stale, pressed }
  let order = 0;
  const kv = { x: 0, y: 0 };                     // the smoothed key stick (screen)
  let lastEnd = null;
  let mouse = null;                              // { x, y } of a mouse with no button down
  let aimRef = null, aimOn = false;
  const stick = { on: false, ox: 0, oy: 0, x: 0, y: 0 };
  let lastTap = null;                            // the last quick tap's end { t, x, y } (raw), for a "move" double tap
  const extra = new Set();                       // "move": other pointers down (each was a dash), ignored till they lift

  // A queued press is its own token: intents() marks it sent when a step takes it. A release names the press it ends
  // (`of`), so flush() can tell a release whose press a stage already has from one whose press never reached a stage.
  function queue(type, raw, at = raw, of = null, info = null) {
    const t = at - offS();
    let i = q.length;
    while (i > 0 && q[i - 1].t > t) i--;
    const e = { type, t, raw, of, sent: false, info };
    q.splice(i, 0, e);
    return e;
  }

  // In a hold or dragHold moment the keys and the pointer make one hold: the first one down is the press, a later one
  // joins it, and only the last one up is the release. The token of the hold that is on (a pointer or pressed key that
  // is not stale, other than `except`), or null.
  function holdOn(except = null) {
    if (ptr && ptr !== except && !ptr.stale && ptr.tok) return ptr.tok;
    for (const k of held.values()) if (k !== except && k.pressed && !k.stale && k.tok) return k.tok;
    return null;
  }
  // Does another key or the pointer still hold the press `x` joined? Then x going up is no release (only the last one
  // up is). Judged by the press itself, so a hold that began in a hold moment still ends once when the moment moves on.
  function sharedHold(x) {
    if (!x.tok) return false;
    if (ptr && ptr !== x && !ptr.stale && ptr.tok === x.tok) return true;
    for (const k of held.values()) if (k !== x && k.pressed && !k.stale && k.tok === x.tok) return true;
    return false;
  }

  // ---- the pointer
  function down(id, kind, button, x, y, raw) {
    if (ptr) {
      // "move": a second finger's touch-down is a dash (a press); it steers nothing and its lift is ignored
      if (gesture === "move" && id !== ptr.id && !extra.has(id)) { extra.add(id); queue("press", raw); }
      return;                                    // otherwise only the first pointer counts
    }
    if (kind === "mouse" && button !== 0) return;
    const on = HOLDS.has(gesture) ? holdOn() : null;
    ptr = { id, kind, x0: x, y0: y, ox: x, oy: y, x, y, t0: raw, t: raw - offS(), state: "pressed", stale: false, dir: null, tok: null };
    if (kind === "mouse") { aimOn = false; mouse = null; }
    stick.on = true; stick.ox = x; stick.oy = y; stick.x = x; stick.y = y;
    if (gesture === "move") {
      // "move": the touch-down is the stick, not a press; a quick second tap (down soon after a tap, near it) dashes
      const dbl = lastTap && raw - lastTap.t <= PTR.dashTapS && Math.hypot(x - lastTap.x, y - lastTap.y) <= PTR.dashTapPx;
      lastTap = null;
      ptr.tok = dbl ? queue("press", raw) : null;
      return;
    }
    // a key already holds: the finger joins its hold; a press carries its world point (stage 6 kicks in the lane tapped)
    const c = cam(), at = c && typeof c.toWorld === "function" ? c.toWorld(x, y) : null;
    ptr.tok = on || queue("press", raw, raw, null, at && Number.isFinite(at.x) && Number.isFinite(at.y) ? { x: at.x, y: at.y } : null);
  }

  function move(id, kind, buttons, x, y, raw) {
    if (ptr && id === ptr.id) {
      ptr.x = x; ptr.y = y;
      if (ptr.state === "pressed" && raw - ptr.t0 >= PTR.tapS) ptr.state = "holding";
      if (ptr.state !== "dragging" && Math.hypot(x - ptr.x0, y - ptr.y0) > PTR.slopPx) {
        ptr.state = "dragging";
        ptr.dir = axisDir(x - ptr.x0, y - ptr.y0);
      }
      // past 80 px the origin trails the finger
      const dx = x - ptr.ox, dy = y - ptr.oy, d = Math.hypot(dx, dy);
      if (d > PTR.trailPx) { const f = (d - PTR.trailPx) / d; ptr.ox += dx * f; ptr.oy += dy * f; }
      if (ptr.state === "dragging" && Math.hypot(x - ptr.ox, y - ptr.oy) > PTR.slopPx) ptr.dir = axisDir(x - ptr.ox, y - ptr.oy);
      stick.ox = ptr.ox; stick.oy = ptr.oy; stick.x = x; stick.y = y;
      return;
    }
    if (!ptr && kind === "mouse" && !buttons) {
      mouse = { x, y };
      if (!aimRef) aimRef = { x, y };
      else if (!aimOn && Math.hypot(x - aimRef.x, y - aimRef.y) > PTR.aimPx) aimOn = true;
    }
  }

  function up(id, x, y, raw) {
    if (extra.delete(id)) return;                // a "move" dash finger lifts
    if (!ptr || id !== ptr.id) return;
    const p = ptr;
    if (fin(x) && fin(y)) { p.x = x; p.y = y; }
    const quick = raw - p.t0 < PTR.tapS && Math.hypot(p.x - p.x0, p.y - p.y0) <= PTR.slopPx && p.state !== "dragging";
    if (quick) queue("tap", p.t0);
    lastTap = quick && !p.tok ? { t: raw, x: p.x, y: p.y } : null;
    if (gesture === "move" && !p.tok) { if (p.kind === "mouse") { aimRef = { x: p.x, y: p.y }; aimOn = false; mouse = { x: p.x, y: p.y }; } ptr = null; stick.on = false; return; }
    if (!p.stale && !sharedHold(p)) queue("release", raw, raw, p.tok);
    if (p.kind === "mouse") { aimRef = { x: p.x, y: p.y }; aimOn = false; mouse = { x: p.x, y: p.y }; }
    ptr = null;
    stick.on = false;
  }

  // ---- keys
  const counts = (code) => {
    if (oneButton()) return true;
    if (ACTION.has(code)) return true;
    if (keysMode === "turn") return TURN_L.has(code) || TURN_R.has(code);
    if (keysMode === "lanes") return code in KEY_VEC;
    return code in KEY_VEC;
  };

  function keyDown(code, repeat, raw) {
    if (!code || MENU_KEYS.has(code) || MODIFIERS.has(code)) return;
    if (repeat || held.has(code)) return;        // repeats are ignored
    const k = { order: ++order, stale: false, pressed: false, raw, t: raw - offS(), tok: null };
    held.set(code, k);
    // a steer or turn key clears the aim (in keys "turn" only the turn keys count: W and S do nothing there)
    const steerKey = keysMode === "turn" ? TURN_L.has(code) || TURN_R.has(code) : code in KEY_VEC;
    if (steerKey) { aimOn = false; if (mouse) aimRef = { ...mouse }; }
    let press = false;
    if (oneButton()) press = true;
    else if (ACTION.has(code)) press = true;
    else if (code in KEY_VEC && gesture === "dragHold" && keysMode === "steer") press = true;
    else if (code in KEY_VEC && keysMode === "lanes") press = true;     // stage 6: an arrow kicks, with its dir
    if (press) {
      k.pressed = true;
      const info = keysMode === "lanes" && !oneButton() && KEY_DIR[code] ? { dir: KEY_DIR[code] } : null;
      k.tok = (HOLDS.has(gesture) ? holdOn(k) : null) || queue("press", raw, raw, null, info);   // or it joins the hold that is on
    }
  }

  function keyUp(code, raw) {
    const k = held.get(code);
    if (!k) return;
    held.delete(code);
    if (k.pressed && !k.stale && !sharedHold(k)) queue("release", raw, raw, k.tok);
  }

  function releaseAll(raw) {
    for (const code of [...held.keys()]) keyUp(code, raw);
  }

  // The live gesture and key mode for the moment on screen. A change into hold or dragHold makes every press that
  // was already down when the new gesture began (its t before `at`; with no `at`, every one down now) stale: it
  // cannot start the hold, and its release is dropped.
  function setLive(g, keys = "steer", at = Infinity) {
    const next = GESTURES.has(g) ? g : "none";
    const from = fin(at) ? at : Infinity;
    if (HOLDS.has(next) && !HOLDS.has(gesture)) {
      if (ptr && ptr.t < from) ptr.stale = true;
      for (const k of held.values()) if (k.t < from) k.stale = true;
    }
    // an arrow or WASD key that went down at or after `at` is the press of a new dragHold moment, with its own time
    if (next === "dragHold" && gesture !== "dragHold" && keys !== "turn" && !oneButton()) {
      for (const [code, k] of held) {
        if (!k.pressed && k.t >= from && code in KEY_VEC) { k.pressed = true; k.tok = holdOn(k) || queue("press", k.raw); }
      }
    }
    gesture = next;
    keysMode = keys === "turn" ? "turn" : keys === "lanes" ? "lanes" : "steer";
  }

  // The world steer: the pointer's stick, else (keys "steer", not one-button) the smoothed key stick.
  function steerNow() {
    const c = cam();
    const toWorld = (vx, vy) => (c ? c.stickToWorld(vx, vy) : { x: vx, y: -vy });
    if (oneButton()) return { x: 0, y: 0 };
    if (ptr) {
      const dx = ptr.x - ptr.ox, dy = ptr.y - ptr.oy, d = Math.hypot(dx, dy);
      const m = clamp((d - PTR.deadPx) / (PTR.fullPx - PTR.deadPx), 0, 1);
      return m > 0 ? toWorld((dx / d) * m, (dy / d) * m) : { x: 0, y: 0 };
    }
    if (keysMode === "steer" && (kv.x || kv.y)) return toWorld(kv.x, kv.y);
    return { x: 0, y: 0 };
  }

  function smoothKeys(dt) {
    let tx = 0, ty = 0;
    if (!oneButton() && keysMode === "steer") {
      for (const code of held.keys()) { const v = KEY_VEC[code]; if (v) { tx += v[0]; ty += v[1]; } }
      tx = Math.sign(tx); ty = Math.sign(ty);
      const m = Math.hypot(tx, ty);
      if (m > 0) { tx /= m; ty /= m; }
    }
    const ex = tx - kv.x, ey = ty - kv.y, e = Math.hypot(ex, ey);
    const stepMax = dt / PTR.keySmoothS;
    if (e <= stepMax || e === 0) { kv.x = tx; kv.y = ty; }
    else { kv.x += (ex / e) * stepMax; kv.y += (ey / e) * stepMax; }
  }

  function keyDir() {
    if (oneButton() || keysMode === "turn" || keysMode === "lanes") return null;
    let best = null, bestOrder = -1;
    for (const [code, k] of held) if (KEY_DIR[code] && k.order > bestOrder) { best = KEY_DIR[code]; bestOrder = k.order; }
    return best;
  }

  function turnNow() {
    if (oneButton()) return 0;
    let l = false, r = false;
    for (const code of held.keys()) { if (TURN_L.has(code)) l = true; if (TURN_R.has(code)) r = true; }
    return (r ? 1 : 0) - (l ? 1 : 0);
  }

  // One step's intents: every queued event with t < tStepEnd, and the held state now.
  function intents(tStepEnd) {
    // the key stick eases over the step just run (at most two steps' worth, so a gap never jumps it)
    const dt = lastEnd === null || !fin(tStepEnd) ? 1 / 60 : clamp(tStepEnd - lastEnd, 0, 2 / 60);
    if (fin(tStepEnd)) lastEnd = tStepEnd;
    smoothKeys(dt);
    if (ptr && ptr.state === "pressed" && fin(tStepEnd) && tStepEnd + offS() - ptr.t0 >= PTR.tapS) ptr.state = "holding";
    const presses = [], releases = [], taps = [];
    while (q.length && q[0].t < tStepEnd) {
      const e = q.shift();
      if (e.type === "press") { e.sent = true; presses.push(e.info ? { t: e.t, raw: e.raw, ...e.info } : { t: e.t, raw: e.raw }); }
      else if (e.type === "release") releases.push({ t: e.t, raw: e.raw });
      else if (e.type === "tap") taps.push({ t: e.t });
    }
    let touching = !!ptr;
    for (const code of held.keys()) if (counts(code)) { touching = true; break; }
    const c = cam();
    const aim = !ptr && aimOn && mouse && c && typeof c.toWorld === "function" ? c.toWorld(mouse.x, mouse.y) : null;
    const dir = ptr && ptr.state === "dragging" && !oneButton() && keysMode !== "lanes" ? ptr.dir : keyDir();
    return makeIntents({ steer: steerNow(), touching, presses, releases, taps, dir, turn: turnNow(), aim });
  }

  // ---- test events
  function inject(events) {
    for (const e of Array.isArray(events) ? events : [events]) {
      if (!e || !e.type) continue;
      const t = fin(e.t) ? e.t : 0;
      switch (e.type) {
        case "press": case "release": case "tap": {
          const raw = fin(e.raw) ? e.raw : t + offS();
          const at = t + offS();
          queue(e.type, raw, at);
          break;
        }
        case "pointerdown": down(e.id ?? 1, e.kind || "touch", e.button ?? 0, e.x ?? 0, e.y ?? 0, t); break;
        case "pointermove": move(e.id ?? 1, e.kind || "touch", e.buttons ?? (ptr ? 1 : 0), e.x ?? 0, e.y ?? 0, t); break;
        case "pointerup": case "pointercancel": up(e.id ?? 1, e.x, e.y, t); break;
        case "keydown": keyDown(e.code, !!e.repeat, t); break;
        case "keyup": keyUp(e.code, t); break;
        default: break;
      }
    }
  }

  // ---- the DOM
  const raw = (e) => coreTime(e.timeStamp);
  const editable = (t) => !!(t && t.closest && t.closest("input, select, textarea"));
  const onDown = (e) => {
    if (ptr) {
      if (gesture === "move") { down(e.pointerId, e.pointerType || "mouse", e.button, e.clientX, e.clientY, raw(e)); if (e.cancelable) e.preventDefault(); }
      return;
    }
    down(e.pointerId, e.pointerType || "mouse", e.button, e.clientX, e.clientY, raw(e));
    if (ptr && ptr.id === e.pointerId && el && el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } }
    if (e.cancelable) e.preventDefault();
  };
  const onMove = (e) => move(e.pointerId, e.pointerType || "mouse", e.buttons, e.clientX, e.clientY, raw(e));
  const onUp = (e) => up(e.pointerId, e.clientX, e.clientY, raw(e));
  const switcherOpen = () => !!(typeof window !== "undefined" && window.GameSwitch && window.GameSwitch.isOpen);
  const onKeyDown = (e) => {
    if (editable(e.target)) return;
    if (switcherOpen()) return;                  // the game switcher is a dialog: its keys are its own
    const tg = e.target && e.target.closest ? e.target : null;
    // While you play (no screen is up) the HUD's pause button is no menu: game keys stay game keys there. Over the
    // overlay or the Almost card it is a button like theirs.
    const inHud = !!(tg && tg.closest("#hud")) && !document.querySelector("#screens:not([hidden])");
    const onButton = !!(tg && tg.closest("button, a[href], [role=button]")) && !inHud;
    const activates = e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter";
    // A key held from play never clicks the button a new screen focuses: its repeats do nothing on a button (Chromium
    // clicks on a repeated Enter, and on the keyup after a repeated Space). On the pause button in play Space and Enter
    // are presses (Esc and P pause).
    if (activates && (inHud || (onButton && e.repeat))) e.preventDefault();
    if (e.code in KEY_VEC && !onButton) e.preventDefault();
    if (e.code === "Space" && !onButton) e.preventDefault();
    keyDown(e.code, e.repeat, raw(e));
  };
  const onKeyUp = (e) => keyUp(e.code, raw(e));
  const onBlur = () => releaseAll(coreTime(performance.now()));
  const onMenu = (e) => e.preventDefault();

  if (el) {
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("contextmenu", onMenu);
  }
  if (typeof window !== "undefined" && el) {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
  }

  // Drop the queue. A press dropped here never reached a stage, so the key or pointer that made it is stale: its
  // release is dropped too (Enter on Resume clicks on keydown, and its keyup comes after). With { resume: true }
  // (main.js on Resume) a release whose press a stage already has is kept: a key or finger let go while paused or
  // hidden still ends that hold, at the paused core time.
  function flush({ resume = false } = {}) {
    const keep = resume ? q.filter((e) => e.type === "release" && e.of && e.of.sent) : [];
    q.length = 0;
    q.push(...keep);
    if (ptr && !(ptr.tok && ptr.tok.sent)) ptr.stale = true;
    for (const k of held.values()) if (k.pressed && !(k.tok && k.tok.sent)) k.stale = true;
  }

  function dispose() {
    if (el) {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("contextmenu", onMenu);
    }
    if (typeof window !== "undefined" && el) {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    }
    q.length = 0;
    held.clear();
    extra.clear();
    ptr = null;
    stick.on = false;
  }

  return {
    setLive,
    intents,
    stick,
    inject,
    dispose,
    flush,
    pointer() { return ptr ? ptr.state : "idle"; },
    live() { return { gesture, keys: keysMode }; },
  };
}
