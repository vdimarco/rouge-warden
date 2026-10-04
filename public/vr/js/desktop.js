// In Full Swing: Input from a mouse, a keyboard and a game pad, for play on a flat screen (spec §7).
// The camera is the head at standing height; the mouse turns the rig (main adds input.turn to rigYaw) and tilts the head.
// Two logical swing inputs (swing 1: the left button, E, the right trigger; swing 2: the right button, Q, the left trigger) fire
// the free hand that main picks (D.chooseHand). It also draws the lock-on ring, the LET GO caption and the first-minute key strip.
// The look wants the pointer lock (raw mouse where the browser has it). Without it the free cursor still turns the view, and
// resting it near an edge keeps turning, so a lost or refused lock never leaves the mouse stuck at the edge of the screen.
import * as THREE from "three";
import { createMobile } from "./mobile.js";
import { COMFORT, PAD, DESKTOP } from "./config.js";
import { createInput, clearEdges } from "./xr.js";

const SENS = 0.0022; // radians of look per pixel of mouse travel
const MOVE_MAX = 200; // one event never turns more than this many pixels' worth (a stray jump would spin the view)
const SKIP_MS = 500, SKIP_MIN = 40; // Chromium's made-up jump: one big move made this soon after a lock is asked for or taken
const EDGE = 0.06, EDGE_MIN = 24, EDGE_IN = 0.35; // the edge band: part of the shorter side (at least px), speed at its inner side
const EDGE_YAW = 2.2, EDGE_PITCH = 1.2; // rad/s of turn with the free cursor at the very edge
const ESC_GAP = 250; // ms: an Esc that comes with the browser's own unlock is the same press
const RETRY_MS = 1300; // Chrome refuses a new lock for about a second after the user's own Esc
const PENDING_MS = 2000; // a lock request with no answer by then is over
const RELOCK_MS = 3000; // our own let-go (see relock) answers within this, even on a slow machine
const RAW = { unadjustedMovement: true };
const PITCH_MAX = (85 * Math.PI) / 180;
const YANK_F = 3.5; // m/s of synthetic pull for F (and the pad's X and right bumper)
// muzzles sit at camera-local (∓0.22, −0.2, −0.35); a launcher's muzzle is 0.1 m ahead of its grip
const GRIP_OFF = [new THREE.Vector3(-0.22, -0.2, -0.25), new THREE.Vector3(0.22, -0.2, -0.25)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// -1…1: how deep v sits in the band of width z at either end of 0…size (negative at the 0 end)
const band = (t) => EDGE_IN + (1 - EDGE_IN) * clamp(t, 0, 1);
const edgeOf = (v, size, z) => (v < z ? -band(1 - v / z) : v > size - 1 - z ? band((v - (size - 1 - z)) / z) : 0);
const padButton = (gp, i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
// a trigger goes down at 0.5 and up below 0.3, so a value near the threshold never flutters
const padTrigger = (gp, i, was) => {
  const b = gp.buttons[i];
  if (!b) return false;
  const v = b.value ? b.value : b.pressed ? 1 : 0;
  return was ? v >= PAD.trigger.off : v >= PAD.trigger.on;
};
// A stick has a radial dead zone: inside it the output is zero, outside it the size starts at zero and reaches one at full
// deflection, and the direction stays (a square zone would snap a diagonal to an axis). Result in STK.
const STK = { x: 0, y: 0, m: 0 };
function stick(gp, ia, ib, curve) {
  const x = gp.axes[ia] || 0, y = gp.axes[ib] || 0, m = Math.hypot(x, y);
  if (m < PAD.dead) { STK.x = STK.y = STK.m = 0; return STK; }
  const s = Math.min(1, (m - PAD.dead) / (1 - PAD.dead)), k = (curve ? Math.pow(s, PAD.curve) : s) / m;
  STK.x = x * k; STK.y = y * k; STK.m = s;
  return STK;
}
// a stick out of its dead zone or a pressed button: the player is using the pad now
function padBusy(gp) {
  for (let i = 0; i < 4; i += 2) if (Math.hypot(gp.axes[i] || 0, gp.axes[i + 1] || 0) >= PAD.dead) return true;
  for (let i = 0; i < gp.buttons.length; i++) if (padButton(gp, i)) return true;
  return false;
}

export function createDesktop(canvas, camera, settings) {
  const inp = createInput("desktop", "mouse");
  for (const h of inp.hands) h.connected = true;
  inp.head.local.pos.set(0, COMFORT.standingHead, 0);
  inp.viewDown = false;
  const keys = new Set(), mouse = [false, false], edge = [false, false], skip = [false, false], gripOn = [false, false], held = [false, false], gamepad = { lt: false, rt: false };
  // reused every frame, so D.update allocates nothing: the two swing inputs down, the hand each one fires, the hand each one keeps
  const DOWN = [false, false], FIRE = [false, false], HOLD = [false, false];
  const either = (a, b) => keys.has(a) || keys.has(b);
  // the two swing inputs: on this frame, on last frame, the hand each one holds (-1 none), the hand of its last press
  const SW = [{ on: false, hand: -1, last: -1 }, { on: false, hand: -1, last: -1 }], BUSY = [false, false];
  const Q = { jump: false, menu: false, map: false, yank: false, mute: false };
  const pad = { a: false, x: false, y: false, rb: false, start: false };
  const E = new THREE.Euler(0, 0, 0, "YXZ");
  // armed: Chromium's made-up jump may still come, until SKIP_MS after lockAt (the request, then the lock itself)
  let dx = 0, dy = 0, pitch = 0, wheel = 0, armed = false, lockAt = 0, usingPad = false, gt = 0, skipClick = 0;
  // the lock: raw movement until the system says it has none; the request in flight and whether a click made it; refused click
  // requests in a row (only those count); a browser that answers with events only; our own let-go after a change to full screen;
  // when the lock was last lost by the user (Esc, alt-tab)
  let raw = true, reqId = 0, pendingAt = 0, clickReq = false, events = false, lockFails = 0, relockAt = 0, lostAt = -1e9, retryT = 0;
  let granted = false; // the lock has been granted since the last request: the next move ends the watch for the made-up jump
  // the free cursor (no lock): where it is, and whether it is over the page
  let cx = 0, cy = 0, inside = false;
  const unlockFns = [];
  // the lock holds the cursor: Chromium sets pointerLockElement at once but sends pointerlockchange with the next frame, which
  // can be long in coming while the opening compiles its shaders, so the look goes by either
  const locked = () => D.locked || document.pointerLockElement === canvas;
  const free = () => !locked();
  const asking = () => pendingAt > 0 && performance.now() - pendingAt < PENDING_MS;
  const looking = () => D.active && !mobile.enabled && (window.G?.state === "play" || window.G?.state === "intro");
  const wlog = { t: new Float32Array(48), a: new Float32Array(48), n: 0 }; // the wheel's grants in the last DESKTOP.wheel.per s

  const D = {
    input: inp, locked: false, active: false,
    // main sets this in play: (which swing input, the hand it held last, [hand 0 busy, hand 1 busy]) -> a free hand (0 or 1), -1 for
    // none (the press is ignored), or undefined to use the old mapping (swing 1 is the left hand, swing 2 the right hand)
    chooseHand: null,
    // Ask for the pointer lock. A click that asks (fromClick) starts no swing: it re-locks. A browser that refuses the lock every
    // time (an iframe) loses two clicks at most, then clicks fire again. A request that no click made (a resume by Esc or Start) may be
    // refused too, and that never counts: it is no click.
    lock(fromClick) {
      if (mobile.enabled) return;
      // the pause menu lets go of the lock, but a slow release can leave it held at the click that resumes: that click swings nothing too
      if (document.pointerLockElement === canvas) { if (fromClick) skipClick = performance.now() + 200; return; }
      const api = !!canvas.requestPointerLock;
      // With no pointer lock API there is nothing to ask for (no grant and no error will come), so only the click that resumes a
      // pause is swallowed: swallowing every click would leave the buttons dead for ever. (G.state flips to play on the next tick.)
      if (fromClick && lockFails < 2 && (api || window.G?.state === "paused")) skipClick = performance.now() + 200;
      if (api && !asking()) request(!!fromClick); // one request at a time
    },
    // Full screen just came on. With no lock, ask for one. On a Mac a lock taken while the screen changed may not hold the
    // cursor (it runs to the edge), so let go and take it straight back (a lock the page let go of needs no click).
    relock() {
      if (mobile.enabled) return;
      if (document.pointerLockElement !== canvas) { D.lock(); return; }
      if (!/Mac/.test(navigator.platform || "")) return;
      relockAt = performance.now();
      try { document.exitPointerLock(); } catch (e) { relockAt = 0; }
    },
    // no lock, and none on the way: the page says how to get the mouse look back
    get free() { return free() && !asking(); },
    unlock() { if (document.pointerLockElement === canvas) document.exitPointerLock(); },
    onUnlock: (fn) => unlockFns.push(fn),
    // For tests and resets: look straight ahead.
    level(angle = 0) { pitch = clamp(angle, -PITCH_MAX, PITCH_MAX); mobile.reset(); },
    // The flat view owns the pitch (main passes it in every frame), so the head, the muzzles and the limits follow the view.
    setPitch(p) { pitch = clamp(p, -PITCH_MAX, PITCH_MAX); },
    // The phone camera follow tilts the view a little toward where the next buildings are.
    nudgePitch(dp) { pitch = clamp(pitch + dp, -PITCH_MAX, PITCH_MAX); },
    get padInUse() { return usingPad; },
  };

  const mobile = D.mobile = createMobile(canvas, () => D.active && window.G?.state !== "paused");

  /* ---------------- the pointer lock ---------------- */
  // Raw mouse (no system acceleration) where the browser has it; a system without it says NotSupportedError, and then a
  // plain lock. An older browser returns no promise and answers with the events only.
  function request(click) {
    const id = ++reqId;
    pendingAt = lockAt = performance.now(); clickReq = click; armed = true; granted = false;
    inside = false; // the free cursor's place is learnt again from the next move with no lock on the way
    let p = null;
    try { p = canvas.requestPointerLock(raw ? RAW : undefined); }
    catch (e) { if (raw) { raw = false; request(click); } else refused(); return; }
    if (!p || !p.then) { events = true; return; }
    // (a refusal comes as a pointerlockerror, below: the promise only says when raw movement is not to be had)
    p.then(
      () => { if (armed) lockAt = performance.now(); }, // taken: the jump comes now, if it has not come yet
      (e) => { if (id === reqId && raw && e && e.name === "NotSupportedError") { raw = false; request(click); } });
  }
  // a refused request: only a click's counts (a request no click made, a resume by Esc or Start, never does)
  function refused() {
    pendingAt = 0;
    if (clickReq) lockFails++;
    // refused just after the user's own Esc (Chrome waits about a second): ask once more when that is over
    const wait = lostAt + RETRY_MS - performance.now();
    if (wait > 0 && !retryT) retryT = setTimeout(() => { retryT = 0; if (looking() && free()) D.lock(); }, wait + 30);
  }
  // A refusal. A raw request the system cannot do is asked again plainly (a new request id) before this runs: that is no refusal.
  document.addEventListener("pointerlockerror", () => { const id = reqId; setTimeout(() => { if (id === reqId && pendingAt) refused(); }, 0); });
  document.addEventListener("pointerlockchange", () => {
    const now = document.pointerLockElement === canvas, was = D.locked, t = performance.now();
    D.locked = now;
    pendingAt = 0;
    if (now && !was) {
      lockFails = 0; inside = false; granted = true;
      // an older browser tells of the lock only here, so its made-up jump (see the mousemove) is timed from now
      if (events && armed) lockAt = t;
      // a button that is already down when the lock starts does nothing until it goes up
      for (let b = 0; b < 2; b++) if (mouse[b]) { mouse[b] = false; skip[b] = true; }
    }
    if (was && !now) {
      // our own let-go after the change to full screen: take the lock straight back, and play on
      if (relockAt && t - relockAt < RELOCK_MS) { relockAt = 0; D.lock(); return; }
      // lost by the user (the game's own pause lets go of it too): that Esc is not a second press of the menu key
      if (window.G?.state !== "paused") { lostAt = t; Q.menu = false; }
      // a lost lock (Esc, alt-tab) lets go of both mouse ropes and pauses
      mouse[0] = mouse[1] = false;
      for (const f of unlockFns) f();
    }
  });

  /* ---------------- events ---------------- */
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    if (!D.active || mobile.enabled) return;
    usingPad = false;
    const b = e.button === 0 ? 0 : e.button === 2 ? 1 : -1;
    if (b < 0) return;
    e.preventDefault();
    // the click that resumed the pause, or that asked for the lock, starts no swing
    if (skipClick && performance.now() < skipClick) { skipClick = 0; skip[b] = true; return; }
    skipClick = 0;
    skip[b] = false; mouse[b] = true; edge[b] = true;
  });
  // the end of the click also ends its skip: a click whose mousedown never reached the canvas (the pause card) must not eat the next press
  addEventListener("mouseup", (e) => { const b = e.button === 0 ? 0 : e.button === 2 ? 1 : -1; if (b >= 0) { mouse[b] = false; skip[b] = false; } skipClick = 0; });
  addEventListener("mousemove", (e) => {
    if (!D.active) return;
    const mx = e.movementX || 0, my = e.movementY || 0;
    // Chromium's made-up jump: one big move made (by its own time stamp, so a busy page that hands it over late still knows
    // it) within SKIP_MS of the lock; it can come before the lock is told of. A small move is the player's.
    // The first move after the grant ends the watch: a big one is the jump and is dropped, a small one is the player's.
    if (armed && e.timeStamp - lockAt < SKIP_MS) {
      if (Math.abs(mx) + Math.abs(my) > SKIP_MIN) { armed = false; return; }
      if (granted) armed = false;
    }
    if (!locked() || (!mx && !my)) return; // the free cursor turns the view in the pointermove
    usingPad = false;
    dx += clamp(mx, -MOVE_MAX, MOVE_MAX); dy += clamp(my, -MOVE_MAX, MOVE_MAX);
  });
  // The free cursor (a mouse, never a touch): its travel turns the view in play, and its place drives the edge turn. Not
  // while a lock is on the way: Chromium's made-up jump can come before the lock does, with the cursor at 0, 0.
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !D.active || mobile.enabled || !free() || asking()) return;
    const back = inside, mx = e.clientX - cx, my = e.clientY - cy;
    cx = e.clientX; cy = e.clientY; inside = true;
    if (!back || !looking()) return; // the first move over the page jumps from wherever the cursor was
    usingPad = false;
    dx += clamp(mx, -MOVE_MAX, MOVE_MAX); dy += clamp(my, -MOVE_MAX, MOVE_MAX);
  });
  addEventListener("mouseout", (e) => { if (!e.relatedTarget) inside = false; }); // the cursor left the window
  // The wheel reels. A pinch on a trackpad is a wheel event with Ctrl held, and scroll momentum is a long stream of events:
  // those never reel, and a stream reels at most DESKTOP.wheel.cap s in any DESKTOP.wheel.per s.
  canvas.addEventListener("wheel", (e) => {
    if (!D.active) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || mobile.enabled) return;
    const W = DESKTOP.wheel;
    // the grants of the last W.per s (older ones drop out)
    let used = 0, m = 0;
    for (let i = 0; i < wlog.n; i++) if (gt - wlog.t[i] < W.per) { wlog.t[m] = wlog.t[i]; wlog.a[m] = wlog.a[i]; used += wlog.a[i]; m++; }
    wlog.n = m;
    const grant = Math.min(W.reel, W.cap - used);
    if (!(grant > 1e-3) || wlog.n >= 48) return;
    wlog.t[wlog.n] = gt; wlog.a[wlog.n] = grant; wlog.n++;
    wheel = Math.min(wheel + grant, W.cap);
  }, { passive: false });
  // Tab, Space and the arrows keep their page meaning while the game is paused or a dialog has the focus
  const pageKeys = () => {
    if (window.G?.state === "paused") return true;
    const a = document.activeElement;
    return !!(a && a !== document.body && a.closest && a.closest("dialog"));
  };
  const mapOpen = () => { try { return !!(window.G?.ui?.info?.().map?.open); } catch (e) { return false; } };
  addEventListener("keydown", (e) => {
    if (!D.active) return;
    // a key pressed with Ctrl, Meta or Alt held is a browser shortcut (Ctrl+F, Cmd+W): it does nothing here
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    usingPad = false;
    const k = e.code, page = pageKeys();
    if (k === "Tab") {
      // Tab opens the map and closes it. In a pause that is no map, Tab moves the focus as on any page.
      if (!page) { e.preventDefault(); if (!e.repeat) Q.map = true; }
      else if (!e.repeat && mapOpen()) { e.preventDefault(); Q.map = true; D.lock(); } // this key press is the user activation
    }
    if (k === "Space" && !page) { e.preventDefault(); if (!e.repeat) Q.jump = true; }
    if (k === "KeyF" && !e.repeat) Q.yank = true;
    // (not in the touch scheme: D.update reads the edges only in the mouse scheme, so one left here would fire a rope after a switch)
    if (!e.repeat && !page && !mobile.enabled) { if (k === "KeyE") edge[0] = true; else if (k === "KeyQ") edge[1] = true; }
    // M (the sound) by the letter on the key (AZERTY puts M where QWERTY has ;), or by its place when the key has no Latin
    // letter; a punctuation key in that place (AZERTY's comma under KeyM) is not M
    const key = e.key || "", byPlace = key.length !== 1 || /\p{L}/u.test(key);
    if (!e.repeat && (/^m$/i.test(key) || (byPlace && k === "KeyM"))) Q.mute = true;
    if (k === "Escape" && !e.repeat && performance.now() - lostAt > ESC_GAP) Q.menu = true;
    if (k.startsWith("Arrow") && !page) e.preventDefault(); // the arrows move you, never the page
    keys.add(k);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => { keys.clear(); mouse[0] = mouse[1] = false; edge[0] = edge[1] = false; inside = false; });

  /* ---------------- per frame ---------------- */
  D.update = (dt) => {
    clearEdges(inp);
    inp.viewDown = false;
    for (const h of inp.hands) h.swingDown = false;
    gt += dt;
    const gp = mobile.enabled ? null : standardPad();
    const phone = mobile.sample(dt);
    inp.easySwing = mobile.enabled;
    inp.phoneFire = phone.fire;
    inp.phoneAim = phone.aim; // a tap's screen position (NDC x and y) for the frame it fires, else null: main aims through it
    // look: the mouse (locked, or the free cursor in play) and the pad's right stick
    let turn = -dx * SENS + phone.turn, dp = -dy * SENS + phone.pitch;
    dx = dy = 0;
    // the free cursor resting near an edge keeps turning that way (the top and the bottom tilt)
    if (inside && free() && !asking() && looking()) {
      const w = innerWidth, h = innerHeight, z = Math.max(EDGE_MIN, EDGE * Math.min(w, h));
      turn -= edgeOf(cx, w, z) * EDGE_YAW * dt;
      dp -= edgeOf(cy, h, z) * EDGE_PITCH * dt;
    }
    // WASD or the arrow keys: walk, steer in the air, and climb on a wall
    let mx = (either("KeyD", "ArrowRight") ? 1 : 0) - (either("KeyA", "ArrowLeft") ? 1 : 0), my = (either("KeyW", "ArrowUp") ? 1 : 0) - (either("KeyS", "ArrowDown") ? 1 : 0);
    mx += phone.moveX; my += phone.moveY;
    let grip = keys.has("ShiftLeft") || keys.has("ShiftRight") || wheel > 0 || phone.reel, yank = Q.yank;
    let jump = Q.jump || phone.jump, menu = Q.menu || phone.menu, map = Q.map, view = !!phone.view;
    // the two swing inputs: a mouse button, E or Q, a trigger
    let s0 = mouse[0] && !skip[0] || keys.has("KeyE"), s1 = mouse[1] && !skip[1] || keys.has("KeyQ");
    if (gp) {
      if (padBusy(gp)) usingPad = true;
      const lk = stick(gp, 2, 3, true);
      turn -= lk.x * PAD.lookRate * dt; dp -= lk.y * PAD.lookRate * dt;
      const mv = stick(gp, 0, 1, false);
      if (!mx && !my) { mx = mv.x; my = -mv.y; }
      gamepad.rt = padTrigger(gp, 7, gamepad.rt); gamepad.lt = padTrigger(gp, 6, gamepad.lt);
      s0 = s0 || gamepad.rt; s1 = s1 || gamepad.lt;
      grip = grip || padButton(gp, 4); // the left bumper reels; the right bumper yanks
      const a = padButton(gp, 0), x = padButton(gp, 2), yb = padButton(gp, 3), rb = padButton(gp, 5), st = padButton(gp, 9);
      if (a && !pad.a) jump = true;
      if ((x && !pad.x) || (rb && !pad.rb)) yank = true;
      if (yb && !pad.y) view = true;
      if (st && !pad.start) menu = true;
      pad.a = a; pad.x = x; pad.y = yb; pad.rb = rb; pad.start = st;
    } else gamepad.rt = gamepad.lt = false;
    inp.muteDown = Q.mute;
    Q.jump = Q.menu = Q.map = Q.yank = Q.mute = false;
    wheel = Math.max(0, wheel - dt);
    pitch = clamp(pitch + dp, -PITCH_MAX, PITCH_MAX);
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    inp.move.x = mx; inp.move.y = my;
    inp.turn = turn; inp.pitch = pitch;
    inp.jumpDown = jump; inp.menuDown = menu; inp.mapDown = map; inp.viewDown = view;
    inp.visible = true;
    // which device the player holds, for the tutorial words: a phone, the pad (once it moves), else the mouse
    const kind = inp.kind = mobile.enabled ? "touch" : usingPad ? "pad" : "mouse";

    // the swing inputs pick a free hand and hold it until they go up. A press that is over before this frame still holds for one.
    DOWN[0] = s0; DOWN[1] = s1;
    BUSY[0] = SW[0].on && SW[0].hand === 0 || SW[1].on && SW[1].hand === 0;
    BUSY[1] = SW[0].on && SW[0].hand === 1 || SW[1].on && SW[1].hand === 1;
    const fire = FIRE, hold = HOLD;
    fire[0] = fire[1] = hold[0] = hold[1] = false;
    if (!mobile.enabled) {
      for (let w = 0; w < 2; w++) {
        const sw = SW[w], on = DOWN[w] || edge[w];
        edge[w] = false;
        if (on && !sw.on) {
          let hand = D.chooseHand ? D.chooseHand(w, sw.last, BUSY) : undefined;
          if (hand === undefined || hand === null) hand = w;
          if (hand >= 0 && hand < 2 && !BUSY[hand]) { sw.hand = hand; sw.last = hand; BUSY[hand] = true; fire[hand] = true; } else sw.hand = -1;
        }
        if (!on && sw.on) sw.hand = -1;
        sw.on = on;
        if (on && sw.hand >= 0) hold[sw.hand] = true;
      }
    }

    // the head: standing height, pitch only (the rig carries the yaw)
    const head = inp.head.local;
    head.pos.set(0, COMFORT.standingHead, 0);
    E.set(pitch, 0, 0);
    head.quat.setFromEuler(E);
    for (let i = 0; i < 2; i++) {
      const h = inp.hands[i];
      h.connected = true; h.kind = kind;
      h.gripLocal.pos.copy(GRIP_OFF[i]).applyQuaternion(head.quat).add(head.pos);
      h.gripLocal.quat.copy(head.quat);
      h.aimLocal.pos.copy(head.pos);
      h.aimLocal.dir.set(0, 0, -1);
      if (i === 1 && phone.aim) {
        const f = Math.tan(camera.fov * Math.PI / 360);
        h.aimLocal.dir.set(phone.aim.x * f * camera.aspect, phone.aim.y * f, -1).normalize();
      }
      h.aimLocal.dir.applyQuaternion(head.quat);
      const was = held[i], on = mobile.enabled ? i === 1 && phone.hold : hold[i];
      h.trigger = on ? 1 : 0;
      if (mobile.enabled ? (on && !was) || (i === 1 && phone.fire) : fire[i]) h.triggerDown = true;
      if (fire[i]) h.swingDown = true;
      if (!on && was) h.triggerUp = true;
      held[i] = h.holding = on;
      h.grip = grip ? (phone.reel && !keys.has("ShiftLeft") && !keys.has("ShiftRight") && wheel <= 0 && !gp ? Math.max(.55, phone.reel) : 1) : 0;
      if (grip && !gripOn[i]) h.gripDown = true;
      if (!grip && gripOn[i]) h.gripUp = true;
      gripOn[i] = grip;
      h.velRel.set(0, 0, 0);
      // F yanks every attached rope; physics ignores it on an idle one
      h.yank = yank ? YANK_F : phone.yank;
    }
    // the camera is the head (in XR, three sets it from the viewer pose instead)
    camera.position.copy(head.pos);
    camera.quaternion.copy(head.quat);
    return inp;
  };

  function standardPad() {
    if (!navigator.getGamepads) return null;
    let list = null;
    try { list = navigator.getGamepads(); } catch (e) { return null; }
    if (!list) return null;
    for (const g of list) if (g && g.connected && g.mapping === "standard") return g;
    return null;
  }
  // a short rumble on the pad in use, where the browser has the effect
  D.rumble = (strong, ms) => {
    const gp = standardPad(), a = gp && gp.vibrationActuator;
    if (!a || !a.playEffect) return;
    try {
      const p = a.playEffect("dual-rumble", { startDelay: 0, duration: ms, weakMagnitude: strong, strongMagnitude: strong });
      if (p && p.catch) p.catch(() => { /* the pad went away */ });
    } catch (e) { /* no rumble: no harm */ }
  };

  /* ---------------- the lock-on ring, the LET GO caption and the key strip ---------------- */
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = document.createElement("style");
  css.id = "desktop-css";
  css.textContent = `
#lockRing,#lockArrow{position:fixed;left:0;top:0;z-index:11;pointer-events:none;will-change:transform}
#lockRing[hidden],#lockArrow[hidden],#lockCue[hidden],#keyHints[hidden]{display:none}
#lockRing{width:44px;height:44px;margin:-22px 0 0 -22px;--lock:#ffd84a}
#lockArrow{width:34px;height:34px;margin:-17px 0 0 -17px;--lock:#ffd84a}
#lockRing svg,#lockArrow svg{display:block;width:100%;height:100%;overflow:visible}
#lockRing .ink,#lockArrow .ink{fill:none;stroke:#140a18;stroke-linejoin:round}
#lockRing .col{fill:none;stroke:var(--lock);stroke-linejoin:round}
#lockRing .dot{fill:var(--lock);stroke:#140a18;stroke-width:2.5}
#lockRing .pts{display:none}
#lockRing.k-clog,#lockRing.k-pipe,#lockArrow.k-clog,#lockArrow.k-pipe{--lock:#9cff3a}
#lockRing.k-ring,#lockRing.k-crack,#lockArrow.k-ring,#lockArrow.k-crack{--lock:#f2c14e}
#lockRing.k-clog .pts,#lockRing.k-pipe .pts{display:inline}
#lockArrow .tip{fill:var(--lock);stroke:#140a18;stroke-width:4;stroke-linejoin:round}
#lockRing svg{transition:transform .08s}
#lockRing.pop svg{transform:scale(1.4)}
#lockRing.pop.still svg{transform:none;filter:brightness(1.45) saturate(1.3)}
#lockRing.go svg,#lockArrow.go svg{animation:lockpulse .32s ease-in-out infinite alternate}
@keyframes lockpulse{from{transform:scale(1)}to{transform:scale(1.25)}}
#lockCue{position:fixed;left:0;top:0;z-index:11;pointer-events:none;padding:4px 14px 1px;background:#ffd84a;border:3px solid #140a18;border-radius:3px;box-shadow:3px 3px 0 #140a18;font:400 22px/1.1 var(--comic,"Bangers",Impact,"Arial Black",sans-serif);letter-spacing:.08em;color:#140a18;white-space:nowrap}
#keyHints{position:fixed;left:50%;bottom:10px;z-index:12;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:0 12px;box-sizing:border-box;height:34px;max-width:96vw;padding:0 14px;overflow:hidden;white-space:nowrap;pointer-events:none;background:#fffdf5;border:3px solid #140a18;border-radius:3px;box-shadow:3px 3px 0 #140a18;font:400 clamp(11px,1.65vw,19px)/1 var(--comic,"Bangers",Impact,"Arial Black",system-ui,sans-serif);letter-spacing:.05em;color:#140a18;text-transform:uppercase}
#keyHints b{font-weight:400;color:#b32016}
body.keyhints .fs-sub,body.keyhints .fs-toast{margin-bottom:52px}
#lockProbe{position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
@media (prefers-reduced-motion:reduce){#lockRing svg{transition:none}#lockRing.go svg,#lockArrow.go svg{animation:none}}`;
  document.head.appendChild(css);
  const NS = "http://www.w3.org/2000/svg";
  const ringEl = document.createElement("div");
  ringEl.id = "lockRing"; ringEl.hidden = true; ringEl.setAttribute("aria-hidden", "true");
  let pts = "";
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pts += `<path d="M ${(Math.cos(a - 0.2) * 20).toFixed(1)} ${(Math.sin(a - 0.2) * 20).toFixed(1)} L ${(Math.cos(a) * 29).toFixed(1)} ${(Math.sin(a) * 29).toFixed(1)} L ${(Math.cos(a + 0.2) * 20).toFixed(1)} ${(Math.sin(a + 0.2) * 20).toFixed(1)} Z" class="col" fill="var(--lock)" stroke-width="2"/>`; }
  ringEl.innerHTML = `<svg viewBox="-30 -30 60 60"><g class="pts">${pts}</g><circle class="ink" r="19" stroke-width="10.5"/><circle class="col" r="19" stroke-width="5"/><path class="ink" d="M0 -9V-14M0 9V14M-9 0H-14M9 0H14" stroke-width="7"/><path class="col" d="M0 -9V-14M0 9V14M-9 0H-14M9 0H14" stroke-width="3"/><circle class="dot" r="3"/></svg>`;
  const arrowEl = document.createElement("div");
  arrowEl.id = "lockArrow"; arrowEl.hidden = true; arrowEl.setAttribute("aria-hidden", "true");
  arrowEl.innerHTML = `<svg viewBox="-20 -20 40 40"><path class="tip" d="M0 -17L14 11L0 4L-14 11Z"/></svg>`;
  const cueEl = document.createElement("div");
  cueEl.id = "lockCue"; cueEl.hidden = true; cueEl.textContent = "LET GO"; cueEl.setAttribute("role", "status");
  const hintEl = document.createElement("div");
  hintEl.id = "keyHints"; hintEl.hidden = true; hintEl.setAttribute("role", "note");
  const probe = document.createElement("div");
  probe.id = "lockProbe";
  document.body.append(ringEl, arrowEl, cueEl, hintEl, probe);
  const show = { ring: false, arrow: false, kind: "", go: false, cue: false, hints: "" };
  const WIN = { l: 0, t: 0, r: 0, b: 0, at: -1e9, w: 0, h: 0 };
  const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
  // The safe window: the ring and the arrow stay clear of the score pills and the spoken line (and the key strip), and 8 px inside
  // the edges and the safe-area insets. It is read from the page at most 10 times a second, and when the screen changes size.
  function safeWindow() {
    const now = performance.now(), W = innerWidth, H = innerHeight;
    if (now - WIN.at < 100 && WIN.w === W && WIN.h === H) return WIN;
    WIN.at = now; WIN.w = W; WIN.h = H;
    const cs = getComputedStyle(probe), pad = 8 + 24; // 24 px: half of the ring, and the arrow
    const top = rect(".fs-top"), sub = document.querySelector(".fs-sub.on") ? rect(".fs-sub") : null, strip = hintEl.hidden ? null : rect("#keyHints");
    WIN.l = (parseFloat(cs.paddingLeft) || 0) + pad; WIN.r = W - (parseFloat(cs.paddingRight) || 0) - pad;
    WIN.t = Math.max((parseFloat(cs.paddingTop) || 0) + pad, top ? top.bottom + pad : 0);
    WIN.b = H - (parseFloat(cs.paddingBottom) || 0) - pad;
    // a spoken line in the upper half sits under the score row (ui.js puts it there) and its tail hangs 27 px lower; one lower down
    // closes the window from below
    if (sub && sub.top < H / 2) WIN.t = Math.max(WIN.t, sub.bottom + 27 + pad);
    else if (sub) WIN.b = Math.min(WIN.b, sub.top - pad);
    if (strip) WIN.b = Math.min(WIN.b, strip.top - pad);
    if (WIN.b < WIN.t + 40) WIN.b = WIN.t + 40;
    return WIN;
  }
  const place = (el, x, y, rot) => { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${rot ? ` rotate(${rot.toFixed(1)}deg)` : ""}`; };
  const setClass = (el, name, on) => { if (el.classList.contains(name) !== on) el.classList.toggle(name, on); };
  let cueX = 0, cueY = 0, cueHalf = 52; // the caption is centred on cueX: its half width is measured each time it shows
  // m: null, or { x, y (NDC, y up; they may lie off the screen), kind, dist, behind, go }
  D.marker = (m) => {
    if (!m) {
      if (show.ring) { ringEl.hidden = true; show.ring = false; }
      if (show.arrow) { arrowEl.hidden = true; show.arrow = false; }
      show.go = false;
      cueX = innerWidth / 2; cueY = safeWindow().t - 24;
      return;
    }
    const w = safeWindow(), W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2;
    let px = (m.x * 0.5 + 0.5) * W, py = (0.5 - m.y * 0.5) * H;
    const inside = !m.behind && px >= w.l && px <= w.r && py >= w.t && py <= w.b;
    const kind = m.kind || "swing";
    // only the kind class changes: the catch pop, "go" and "still" stay on the element
    if (show.kind !== kind) { for (const el of [ringEl, arrowEl]) { el.classList.remove("k-" + show.kind); el.classList.add("k-" + kind); } show.kind = kind; }
    if (inside) {
      if (!show.ring) { ringEl.hidden = false; show.ring = true; }
      if (show.arrow) { arrowEl.hidden = true; show.arrow = false; }
      place(ringEl, px, py);
      cueX = px; cueY = py - 52;
    } else {
      // an arrow on the border of the window, where the line from the screen centre to the target crosses it
      let ax, ay, rot;
      if (m.behind) { ax = clamp(cx + m.x * (w.r - w.l) * 0.4, w.l, w.r); ay = w.b; rot = 180; }
      else {
        const ddx = px - cx, ddy = py - cy;
        const tx = ddx > 0 ? (w.r - cx) / ddx : ddx < 0 ? (w.l - cx) / ddx : Infinity, ty = ddy > 0 ? (w.b - cy) / ddy : ddy < 0 ? (w.t - cy) / ddy : Infinity;
        const t = Math.min(tx, ty);
        ax = cx + ddx * t; ay = cy + ddy * t; rot = (Math.atan2(ddx, -ddy) * 180) / Math.PI;
      }
      if (show.ring) { ringEl.hidden = true; show.ring = false; }
      if (!show.arrow) { arrowEl.hidden = false; show.arrow = true; }
      place(arrowEl, ax, ay, rot);
      cueX = ax; cueY = ay > cy ? ay - 50 : ay + 28;
    }
    const go = !!m.go;
    setClass(ringEl, "go", go); setClass(arrowEl, "go", go);
  };
  // the catch pop: the ring grows for 120 ms (or flips to its brighter colour when motion is reduced)
  let popT = 0;
  D.pop = () => {
    if (!show.ring) return;
    ringEl.classList.toggle("still", REDUCED);
    ringEl.classList.add("pop");
    clearTimeout(popT);
    popT = setTimeout(() => ringEl.classList.remove("pop"), 120);
  };
  // the LET GO caption: next to the ring, or at the top of the safe window when there is no ring
  D.cue = (on) => {
    on = !!on;
    if (on !== show.cue) { show.cue = on; cueEl.hidden = !on; if (on) cueHalf = cueEl.offsetWidth / 2 || cueHalf; }
    if (on) {
      const w = safeWindow();
      // place() sets the whole transform, so the box is centred here: its middle stays 8 px plus half its width inside the safe-area insets
      place(cueEl, clamp(cueX || innerWidth / 2, w.l - 24 + cueHalf, w.r + 24 - cueHalf) - cueHalf, clamp(cueY || w.t, w.t - 24, w.b - 20));
    }
  };
  // the first-minute strip at the bottom of the screen, for a mouse or a pad. It lifts the spoken line and the toast with it.
  const HINTS = {
    // the first swing from the start roof needs the hero to walk (W, or the stick) while the rope pulls, so the first item says both
    mouse: ["<b>HOLD W AND LEFT MOUSE (OR E)</b>: SWING.", "LET GO WHEN THE RING SAYS <b>GO</b>.", "<b>MOUSE</b>: LOOK."],
    pad: ["<b>HOLD LEFT STICK UP AND RIGHT TRIGGER</b>: SWING.", "LET GO WHEN THE RING SAYS <b>GO</b>.", "<b>RIGHT STICK</b>: LOOK."],
  };
  D.hints = (on) => {
    const kind = on ? (inp.kind === "pad" ? "pad" : inp.kind === "mouse" ? "mouse" : "") : "";
    if (kind === show.hints) return;
    show.hints = kind;
    hintEl.hidden = !kind;
    document.body.classList.toggle("keyhints", !!kind);
    if (kind) hintEl.innerHTML = HINTS[kind].map((s) => `<span>${s}</span>`).join("");
    WIN.at = -1e9;
  };
  addEventListener("resize", () => { WIN.at = -1e9; });

  return D;
}
