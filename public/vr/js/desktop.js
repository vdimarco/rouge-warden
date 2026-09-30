// In Full Swing: Input from a mouse, a keyboard and a game pad, for play on a flat screen (spec §7).
// The camera is the head at standing height; the mouse turns the rig (main adds input.turn to rigYaw) and tilts the head.
// Both ropes aim along the centre of the screen and leave from two muzzles low in the view.
import * as THREE from "three";
import { createMobile } from "./mobile.js";
import { COMFORT } from "./config.js";
import { createInput, clearEdges } from "./xr.js";

const SENS = 0.0022; // radians of look per pixel of mouse travel
const MOVE_MAX = 200;
const PAD_LOOK = Math.PI; // 180°/s at full right stick
const PITCH_MAX = (85 * Math.PI) / 180;
const DEAD = 0.15;
const WHEEL_REEL = 0.15; // one wheel notch reels for this long
const YANK_F = 3.5; // m/s of synthetic pull for F (and the pad's X)
// muzzles sit at camera-local (∓0.22, −0.2, −0.35); a launcher's muzzle is 0.1 m ahead of its grip
const GRIP_OFF = [new THREE.Vector3(-0.22, -0.2, -0.25), new THREE.Vector3(0.22, -0.2, -0.25)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const padAxis = (gp, i) => { const v = gp.axes[i] || 0; return Math.abs(v) < DEAD ? 0 : v; };
const padButton = (gp, i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);

export function createDesktop(canvas, camera, settings) {
  const inp = createInput("desktop", "mouse");
  for (const h of inp.hands) h.connected = true;
  inp.head.local.pos.set(0, COMFORT.standingHead, 0);
  const keys = new Set(), mouse = [false, false], pressed = [false, false], gripOn = [false, false], trig = [false, false];
  const Q = { jump: false, menu: false, map: false, yank: false };
  const pad = { a: false, x: false, start: false };
  const E = new THREE.Euler(0, 0, 0, "YXZ");
  let dx = 0, dy = 0, pitch = 0, wheel = 0, skipMove = false;
  const unlockFns = [];

  const D = {
    input: inp, locked: false, active: false,
    lock() {
      if (mobile.enabled || document.pointerLockElement === canvas) return;
      try {
        const p = canvas.requestPointerLock && canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { /* no pointer lock here (a test browser): the buttons still work */ });
      } catch (e) { /* same */ }
    },
    unlock() { if (document.pointerLockElement === canvas) document.exitPointerLock(); },
    onUnlock: (fn) => unlockFns.push(fn),
    // For tests and resets: look straight ahead.
    level(angle = 0) { pitch = clamp(angle, -PITCH_MAX, PITCH_MAX); mobile.reset(); },
  };

  const mobile = D.mobile = createMobile(canvas, () => D.active && window.G?.state !== "paused");

  /* ---------------- events ---------------- */
  document.addEventListener("pointerlockchange", () => {
    const now = document.pointerLockElement === canvas;
    const was = D.locked;
    D.locked = now;
    // Chromium sends one mousemove with a large made-up movement right after the lock starts: skip it
    if (now && !was) skipMove = true;
    if (was && !now) {
      // a lost lock (Esc, alt-tab) lets go of both mouse ropes and pauses
      mouse[0] = mouse[1] = false;
      for (const f of unlockFns) f();
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    if (!D.active || mobile.enabled) return;
    if (e.button === 0) mouse[0] = true;
    else if (e.button === 2) mouse[1] = true;
    e.preventDefault();
  });
  addEventListener("mouseup", (e) => { if (e.button === 0) mouse[0] = false; else if (e.button === 2) mouse[1] = false; });
  addEventListener("mousemove", (e) => {
    if (!D.active || !D.locked) return;
    if (skipMove) { skipMove = false; return; }
    // one event never turns more than MOVE_MAX pixels' worth (a stray jump would spin the view)
    dx += clamp(e.movementX || 0, -MOVE_MAX, MOVE_MAX); dy += clamp(e.movementY || 0, -MOVE_MAX, MOVE_MAX);
  });
  canvas.addEventListener("wheel", (e) => { if (!D.active) return; wheel = WHEEL_REEL; e.preventDefault(); }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!D.active) return;
    const k = e.code;
    if (k === "Tab") { e.preventDefault(); if (!e.repeat) Q.map = true; }
    if (k === "Space") { e.preventDefault(); if (!e.repeat) Q.jump = true; }
    if (k === "KeyF" && !e.repeat) Q.yank = true;
    if (k === "Escape" && !e.repeat) Q.menu = true;
    keys.add(k);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => { keys.clear(); mouse[0] = mouse[1] = false; });

  /* ---------------- per frame ---------------- */
  D.update = (dt) => {
    clearEdges(inp);
    const gp = mobile.enabled ? null : standardPad();
    const phone = mobile.sample(dt);
    inp.easySwing = mobile.enabled;
    inp.phoneFire = phone.fire;
    // look: the mouse (only while the pointer is locked) and the pad's right stick
    let turn = -dx * SENS + phone.turn, dp = -dy * SENS + phone.pitch;
    dx = dy = 0;
    let mx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), my = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    mx += phone.moveX; my += phone.moveY;
    trig[0] = mouse[0]; trig[1] = mouse[1] || phone.hold;
    let grip = keys.has("ShiftLeft") || keys.has("ShiftRight") || wheel > 0 || phone.reel, yank = Q.yank;
    let jump = Q.jump || phone.jump, menu = Q.menu || phone.menu, map = Q.map;
    if (gp) {
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
    Q.jump = Q.menu = Q.map = Q.yank = false;
    wheel = Math.max(0, wheel - dt);
    pitch = clamp(pitch + dp, -PITCH_MAX, PITCH_MAX);
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    inp.move.x = mx; inp.move.y = my;
    inp.turn = turn; inp.pitch = pitch;
    inp.jumpDown = jump; inp.menuDown = menu; inp.mapDown = map;
    inp.visible = true;

    // the head: standing height, pitch only (the rig carries the yaw)
    const head = inp.head.local;
    head.pos.set(0, COMFORT.standingHead, 0);
    E.set(pitch, 0, 0);
    head.quat.setFromEuler(E);
    for (let i = 0; i < 2; i++) {
      const h = inp.hands[i];
      h.connected = true; h.kind = "mouse";
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
