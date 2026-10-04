// In Full Swing: Input from a mouse, a keyboard and a game pad, for play on a flat screen (spec §7).
// The camera is the head at standing height; the mouse turns the rig (main adds input.turn to rigYaw) and tilts the head.
// Two logical swing inputs (swing 1: the left button, E, the right trigger; swing 2: the right button, Q, the left trigger) fire
// the free hand that main picks (D.chooseHand). It also draws the lock-on ring, the LET GO caption and the first-minute key strip.
import * as THREE from "three";
import { createMobile } from "./mobile.js";
import { COMFORT, PAD, DESKTOP } from "./config.js";
import { createInput, clearEdges } from "./xr.js";

const SENS = 0.0022; // radians of look per pixel of mouse travel
const MOVE_MAX = 200;
const PITCH_MAX = (85 * Math.PI) / 180;
const YANK_F = 3.5; // m/s of synthetic pull for F (and the pad's X and right bumper)
// muzzles sit at camera-local (∓0.22, −0.2, −0.35); a launcher's muzzle is 0.1 m ahead of its grip
const GRIP_OFF = [new THREE.Vector3(-0.22, -0.2, -0.25), new THREE.Vector3(0.22, -0.2, -0.25)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
  // the two swing inputs: on this frame, on last frame, the hand each one holds (-1 none), the hand of its last press
  const SW = [{ on: false, hand: -1, last: -1 }, { on: false, hand: -1, last: -1 }], BUSY = [false, false];
  const Q = { jump: false, menu: false, map: false, yank: false, mute: false };
  const pad = { a: false, x: false, y: false, rb: false, start: false };
  const E = new THREE.Euler(0, 0, 0, "YXZ");
  let dx = 0, dy = 0, pitch = 0, wheel = 0, skipMove = false, usingPad = false, gt = 0, lockFails = 0, skipClick = 0;
  const unlockFns = [];
  const wlog = { t: new Float32Array(48), a: new Float32Array(48), n: 0 }; // the wheel's grants in the last DESKTOP.wheel.per s

  const D = {
    input: inp, locked: false, active: false,
    // main sets this in play: (which swing input, the hand it held last, [hand 0 busy, hand 1 busy]) -> a free hand (0 or 1), -1 for
    // none (the press is ignored), or undefined to use the old mapping (swing 1 is the left hand, swing 2 the right hand)
    chooseHand: null,
    // Ask for the pointer lock. A click that asks (fromClick) starts no swing: it re-locks. A browser that refuses the lock every
    // time (no pointer lock here, or an iframe) loses two clicks at most, then clicks fire again.
    lock(fromClick) {
      if (mobile.enabled || document.pointerLockElement === canvas) return;
      try {
        const p = canvas.requestPointerLock && canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { /* no pointer lock here (a test browser): the buttons still work */ });
        if (fromClick && lockFails < 2) skipClick = performance.now() + 200;
      } catch (e) { /* same */ }
    },
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

  /* ---------------- events ---------------- */
  document.addEventListener("pointerlockchange", () => {
    const now = document.pointerLockElement === canvas;
    const was = D.locked;
    D.locked = now;
    // Chromium sends one mousemove with a large made-up movement right after the lock starts: skip it
    if (now && !was) {
      skipMove = true; lockFails = 0;
      // a button that is already down when the lock starts does nothing until it goes up
      for (let b = 0; b < 2; b++) if (mouse[b]) { mouse[b] = false; skip[b] = true; }
    }
    if (was && !now) {
      // a lost lock (Esc, alt-tab) lets go of both mouse ropes and pauses
      mouse[0] = mouse[1] = false;
      for (const f of unlockFns) f();
    }
  });
  document.addEventListener("pointerlockerror", () => { lockFails++; });
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
  addEventListener("mouseup", (e) => { const b = e.button === 0 ? 0 : e.button === 2 ? 1 : -1; if (b >= 0) { mouse[b] = false; skip[b] = false; } });
  addEventListener("mousemove", (e) => {
    if (!D.active || !D.locked) return;
    if (skipMove) { skipMove = false; return; }
    usingPad = false;
    // one event never turns more than MOVE_MAX pixels' worth (a stray jump would spin the view)
    dx += clamp(e.movementX || 0, -MOVE_MAX, MOVE_MAX); dy += clamp(e.movementY || 0, -MOVE_MAX, MOVE_MAX);
  });
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
    if (!e.repeat && !page) { if (k === "KeyE") edge[0] = true; else if (k === "KeyQ") edge[1] = true; }
    // M (the sound) by the letter on the key (AZERTY puts M where QWERTY has ;), or by its place when the key has no Latin
    // letter; a punctuation key in that place (AZERTY's comma under KeyM) is not M
    const key = e.key || "", byPlace = key.length !== 1 || /\p{L}/u.test(key);
    if (!e.repeat && (/^m$/i.test(key) || (byPlace && k === "KeyM"))) Q.mute = true;
    if (k === "Escape" && !e.repeat) Q.menu = true;
    if (k.startsWith("Arrow") && !page) e.preventDefault(); // the arrows move you, never the page
    keys.add(k);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => { keys.clear(); mouse[0] = mouse[1] = false; edge[0] = edge[1] = false; });

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
    // look: the mouse (only while the pointer is locked) and the pad's right stick
    let turn = -dx * SENS + phone.turn, dp = -dy * SENS + phone.pitch;
    dx = dy = 0;
    // WASD or the arrow keys: walk, steer in the air, and climb on a wall
    const k = (a, b) => keys.has(a) || keys.has(b);
    let mx = (k("KeyD", "ArrowRight") ? 1 : 0) - (k("KeyA", "ArrowLeft") ? 1 : 0), my = (k("KeyW", "ArrowUp") ? 1 : 0) - (k("KeyS", "ArrowDown") ? 1 : 0);
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
    const down = [s0, s1];
    BUSY[0] = SW[0].on && SW[0].hand === 0 || SW[1].on && SW[1].hand === 0;
    BUSY[1] = SW[0].on && SW[0].hand === 1 || SW[1].on && SW[1].hand === 1;
    const fire = [false, false], hold = [false, false];
    if (!mobile.enabled) {
      for (let w = 0; w < 2; w++) {
        const sw = SW[w], on = down[w] || edge[w];
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
#lockCue{position:fixed;left:0;top:0;z-index:11;pointer-events:none;padding:4px 14px 1px;background:#ffd84a;border:3px solid #140a18;border-radius:3px;box-shadow:3px 3px 0 #140a18;font:400 22px/1.1 var(--comic,"Bangers",Impact,"Arial Black",sans-serif);letter-spacing:.08em;color:#140a18;white-space:nowrap;transform:translate(-50%,0)}
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
    if (sub) WIN.b = Math.min(WIN.b, sub.top - pad);
    if (strip) WIN.b = Math.min(WIN.b, strip.top - pad);
    if (WIN.b < WIN.t + 40) WIN.b = WIN.t + 40;
    return WIN;
  }
  const place = (el, x, y, rot) => { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${rot ? ` rotate(${rot.toFixed(1)}deg)` : ""}`; };
  const setClass = (el, name, on) => { if (el.classList.contains(name) !== on) el.classList.toggle(name, on); };
  let cueX = 0, cueY = 0;
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
    if (show.kind !== kind) { show.kind = kind; ringEl.className = arrowEl.className = "k-" + kind; }
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
    if (on !== show.cue) { show.cue = on; cueEl.hidden = !on; }
    if (on) {
      const w = safeWindow();
      place(cueEl, clamp(cueX || innerWidth / 2, w.l, w.r), clamp(cueY || w.t, w.t - 24, w.b - 20));
    }
  };
  // the first-minute strip at the bottom of the screen, for a mouse or a pad. It lifts the spoken line and the toast with it.
  const HINTS = {
    mouse: ["<b>HOLD LEFT MOUSE (OR E)</b>: SWING.", "LET GO WHEN THE RING SAYS <b>GO</b>.", "<b>MOUSE</b>: LOOK.", "<b>W</b>: STEER."],
    pad: ["<b>HOLD RIGHT TRIGGER</b>: SWING.", "LET GO WHEN THE RING SAYS <b>GO</b>.", "<b>RIGHT STICK</b>: LOOK.", "<b>LEFT STICK</b>: STEER."],
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
