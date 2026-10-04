// In Full Swing: Input from a mouse, a keyboard and a game pad, for play on a flat screen (spec §7).
// The camera is the head at standing height; the mouse turns the rig (main adds input.turn to rigYaw) and tilts the head.
// The look wants the pointer lock (raw mouse where the browser has it). Without it the free cursor still turns the view, and
// resting it near an edge keeps turning, so a lost or refused lock never leaves the mouse stuck at the edge of the screen.
// Both ropes aim along the centre of the screen and leave from two muzzles low in the view.
import * as THREE from "three";
import { createMobile } from "./mobile.js";
import { COMFORT } from "./config.js";
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
const PAD_LOOK = Math.PI; // 180°/s at full right stick
const PITCH_MAX = (85 * Math.PI) / 180;
const DEAD = 0.15;
const WHEEL_REEL = 0.15; // one wheel notch reels for this long
const YANK_F = 3.5; // m/s of synthetic pull for F (and the pad's X)
// muzzles sit at camera-local (∓0.22, −0.2, −0.35); a launcher's muzzle is 0.1 m ahead of its grip
const GRIP_OFF = [new THREE.Vector3(-0.22, -0.2, -0.25), new THREE.Vector3(0.22, -0.2, -0.25)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// -1…1: how deep v sits in the band of width z at either end of 0…size (negative at the 0 end)
const band = (t) => EDGE_IN + (1 - EDGE_IN) * clamp(t, 0, 1);
const edge = (v, size, z) => (v < z ? -band(1 - v / z) : v > size - 1 - z ? band((v - (size - 1 - z)) / z) : 0);
const padAxis = (gp, i) => { const v = gp.axes[i] || 0; return Math.abs(v) < DEAD ? 0 : v; };
const padButton = (gp, i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
// a stick out of its dead zone or a pressed button: the player is using the pad now
function padBusy(gp) {
  for (let i = 0; i < 4; i++) if (padAxis(gp, i)) return true;
  for (let i = 0; i < gp.buttons.length; i++) if (padButton(gp, i)) return true;
  return false;
}

export function createDesktop(canvas, camera, settings) {
  const inp = createInput("desktop", "mouse");
  for (const h of inp.hands) h.connected = true;
  inp.head.local.pos.set(0, COMFORT.standingHead, 0);
  const keys = new Set(), mouse = [false, false], pressed = [false, false], gripOn = [false, false], trig = [false, false];
  const Q = { jump: false, menu: false, map: false, yank: false, mute: false };
  const pad = { a: false, x: false, start: false };
  const E = new THREE.Euler(0, 0, 0, "YXZ");
  // armed: Chromium's made-up jump may still come, until SKIP_MS after lockAt (the request, then the lock itself)
  let dx = 0, dy = 0, pitch = 0, wheel = 0, armed = false, lockAt = 0, usingPad = false;
  // the lock: raw movement until the system says it has none; the request in flight; refused click requests in a row; our
  // own let-go after a change to full screen; when the lock was last lost by the user (Esc, alt-tab)
  let raw = true, reqId = 0, pendingAt = 0, clickReq = false, events = false, fails = 0, relockAt = 0, lostAt = -1e9, retryT = 0;
  // the free cursor (no lock): where it is, and whether it is over the page
  let cx = 0, cy = 0, inside = false;
  const unlockFns = [];
  // the lock holds the cursor: Chromium sets pointerLockElement at once but sends pointerlockchange with the next frame, which
  // can be long in coming while the opening compiles its shaders, so the look goes by either
  const held = () => D.locked || document.pointerLockElement === canvas;
  const free = () => !held();
  const asking = () => pendingAt > 0 && performance.now() - pendingAt < PENDING_MS;
  const looking = () => D.active && !mobile.enabled && (window.G?.state === "play" || window.G?.state === "intro");

  const D = {
    input: inp, locked: false, active: false,
    // Ask for the pointer lock. click: the request comes from a click, so a refusal counts (see the mousedown).
    lock(click = false) {
      if (mobile.enabled || !canvas.requestPointerLock || document.pointerLockElement === canvas || asking()) return; // one request at a time
      request(click);
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
    unlock() { if (document.pointerLockElement === canvas) document.exitPointerLock(); },
    onUnlock: (fn) => unlockFns.push(fn),
    // no lock, and none on the way: the page says how to get the mouse look back
    get free() { return free() && !asking(); },
    // For tests and resets: look straight ahead.
    level(angle = 0) { pitch = clamp(angle, -PITCH_MAX, PITCH_MAX); mobile.reset(); },
    // The flat view owns the pitch (main passes it in every frame), so the head, the muzzles and the limits follow the view.
    setPitch(p) { pitch = clamp(p, -PITCH_MAX, PITCH_MAX); },
    // The phone camera follow tilts the view a little toward where the next buildings are.
    nudgePitch(dp) { pitch = clamp(pitch + dp, -PITCH_MAX, PITCH_MAX); },
  };

  const mobile = D.mobile = createMobile(canvas, () => D.active && window.G?.state !== "paused");

  /* ---------------- the pointer lock ---------------- */
  // Raw mouse (no system acceleration) where the browser has it; a system without it says NotSupportedError, and then a
  // plain lock. An older browser returns no promise and answers with the events only.
  function request(click) {
    const id = ++reqId;
    pendingAt = lockAt = performance.now(); clickReq = click; armed = true;
    inside = false; // the free cursor's place is learnt again from the next move with no lock on the way
    let p = null;
    try { p = canvas.requestPointerLock(raw ? RAW : undefined); }
    catch (e) { if (raw) { raw = false; request(click); } else refused(); return; }
    if (!p || !p.then) { events = true; return; }
    p.then(
      () => { if (armed) lockAt = performance.now(); }, // taken: the jump comes now, if it has not come yet
      (e) => {
        if (id !== reqId) return; // a newer request owns the answer
        if (raw && e && e.name === "NotSupportedError") { raw = false; request(click); } else refused();
      });
  }
  function refused() {
    pendingAt = 0;
    if (clickReq) fails++;
    // refused just after the user's own Esc (Chrome waits about a second): ask once more when that is over
    const wait = lostAt + RETRY_MS - performance.now();
    if (wait > 0 && !retryT) retryT = setTimeout(() => { retryT = 0; if (looking() && free()) D.lock(); }, wait + 30);
  }
  document.addEventListener("pointerlockerror", () => { if (events) refused(); });
  document.addEventListener("pointerlockchange", () => {
    const now = document.pointerLockElement === canvas, was = D.locked, t = performance.now();
    D.locked = now;
    pendingAt = 0;
    // an older browser tells of the lock only here, so its made-up jump (see the mousemove) is timed from now
    if (now && !was) { fails = 0; inside = false; if (events && armed) lockAt = t; }
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
    e.preventDefault();
    // a free cursor: this click takes the lock back and fires no rope (once this browser has refused two clicks, it fires)
    if (free() && fails < 2) { D.lock(true); return; }
    if (e.button === 0) mouse[0] = true;
    else if (e.button === 2) mouse[1] = true;
  });
  addEventListener("mouseup", (e) => { if (e.button === 0) mouse[0] = false; else if (e.button === 2) mouse[1] = false; });
  addEventListener("mousemove", (e) => {
    if (!D.active) return;
    const mx = e.movementX || 0, my = e.movementY || 0;
    // Chromium's made-up jump: one big move made (by its own time stamp, so a busy page that hands it over late still knows
    // it) within SKIP_MS of the lock; it can come before the lock is told of. A small move is the player's.
    if (armed && e.timeStamp - lockAt < SKIP_MS && Math.abs(mx) + Math.abs(my) > SKIP_MIN) { armed = false; return; }
    if (!held() || (!mx && !my)) return; // the free cursor turns the view in the pointermove
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
  canvas.addEventListener("wheel", (e) => { if (!D.active) return; wheel = WHEEL_REEL; e.preventDefault(); }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!D.active) return;
    usingPad = false;
    const k = e.code;
    if (k === "Tab") { e.preventDefault(); if (!e.repeat) Q.map = true; }
    if (k === "Space") { e.preventDefault(); if (!e.repeat) Q.jump = true; }
    if (k === "KeyF" && !e.repeat) Q.yank = true;
    // M (the sound) by the letter on the key (AZERTY puts M where QWERTY has ;), or by its place when the key has no Latin
    // letter; a punctuation key in that place (AZERTY's comma under KeyM) is not M
    const key = e.key || "", byPlace = key.length !== 1 || /\p{L}/u.test(key);
    if (!e.repeat && (/^m$/i.test(key) || (byPlace && k === "KeyM"))) Q.mute = true;
    if (k === "Escape" && !e.repeat && performance.now() - lostAt > ESC_GAP) Q.menu = true;
    if (k.startsWith("Arrow")) e.preventDefault(); // the arrows move you, never the page
    keys.add(k);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => { keys.clear(); mouse[0] = mouse[1] = false; inside = false; });

  /* ---------------- per frame ---------------- */
  D.update = (dt) => {
    clearEdges(inp);
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
      turn -= edge(cx, w, z) * EDGE_YAW * dt;
      dp -= edge(cy, h, z) * EDGE_PITCH * dt;
    }
    // WASD or the arrow keys: walk, steer in the air, and climb on a wall
    const k = (a, b) => keys.has(a) || keys.has(b);
    let mx = (k("KeyD", "ArrowRight") ? 1 : 0) - (k("KeyA", "ArrowLeft") ? 1 : 0), my = (k("KeyW", "ArrowUp") ? 1 : 0) - (k("KeyS", "ArrowDown") ? 1 : 0);
    mx += phone.moveX; my += phone.moveY;
    trig[0] = mouse[0]; trig[1] = mouse[1] || phone.hold;
    let grip = keys.has("ShiftLeft") || keys.has("ShiftRight") || wheel > 0 || phone.reel, yank = Q.yank;
    let jump = Q.jump || phone.jump, menu = Q.menu || phone.menu, map = Q.map;
    if (gp) {
      if (padBusy(gp)) usingPad = true;
      turn -= padAxis(gp, 2) * PAD_LOOK * dt; dp -= padAxis(gp, 3) * PAD_LOOK * dt;
      if (!mx && !my) { mx = padAxis(gp, 0); my = -padAxis(gp, 1); }
      trig[0] = trig[0] || padButton(gp, 6); trig[1] = trig[1] || padButton(gp, 7);
      grip = grip || padButton(gp, 4) || padButton(gp, 5);
      const a = padButton(gp, 0), x = padButton(gp, 2), st = padButton(gp, 9);
      if (a && !pad.a) jump = true;
      if (x && !pad.x) yank = true;
      if (st && !pad.start) menu = true;
      pad.a = a; pad.x = x; pad.start = st;
    }
    inp.muteDown = Q.mute;
    Q.jump = Q.menu = Q.map = Q.yank = Q.mute = false;
    wheel = Math.max(0, wheel - dt);
    pitch = clamp(pitch + dp, -PITCH_MAX, PITCH_MAX);
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    inp.move.x = mx; inp.move.y = my;
    inp.turn = turn; inp.pitch = pitch;
    inp.jumpDown = jump; inp.menuDown = menu; inp.mapDown = map;
    inp.visible = true;
    // which device the player holds, for the tutorial words: a phone, the pad (once it moves), else the mouse
    const kind = inp.kind = mobile.enabled ? "touch" : usingPad ? "pad" : "mouse";

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
      const on = trig[i];
      h.trigger = on ? 1 : 0;
      if ((on && !pressed[i]) || (i === 1 && phone.fire)) h.triggerDown = true;
      if (!on && pressed[i]) h.triggerUp = true;
      pressed[i] = on;
      h.holding = on;
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

  return D;
}
