// One-thumb flat-screen play. Tap a building to swing; the rope lets go by itself past the bottom of the arc.
// Drag or phone motion aims; a tap fires immediately. The panel also draws the lock-on ring that marks the target.
// (This file keeps single quotes: qa/vr/mobile.test.mjs rewrites the import of three by its exact text.)
import * as THREE from 'three';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RING = 28; // half of the 56 px lock-on ring
const GAP = 8; // clear space between the marker and any HUD box
const READ = 100; // ms between two reads of the HUD boxes (a resize reads at once)
const POP = 120; // ms of the catch pop
const BUZZ_GAP = 40; // ms between two vibrations
// the hint line over the SWING button. Each line fits on one line of the 328 px panel of a 360 px phone (the spoken line above it
// leaves room for exactly one line, and its tail would poke into a second one): keep them to about 42 letters. The wall line shows
// while the spoken lines are hidden (portrait) or far above (landscape), so it may run to two lines.
const SAY = {
  tap: 'Tap a building to swing. Keep tapping.',
  motion: 'Point the phone and tap to swing.',
  center: 'Aim centered. Tap when the ring is yellow.',
  swing: 'Swinging. Tap again to swing on.',
  fly: 'Flying. Tap the next building.',
  wall: 'On the wall. Hold the arrows to climb. Tap a building to swing off.',
  kept: 'Keeping this rope. Tap a closer building.',
  none: 'Nothing in reach. Face the tall buildings.',
};
export function createMobile(canvas, active) {
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const state = { turn: 0, pitch: 0, moveX: 0, moveY: 0, hold: false, reel: 0, yank: 0, jump: false, menu: false, fire: false, view: false, aim: null };
  // no touch point: a stub with every method, so main.js calls them with no guard
  if (!touch) return { get enabled() { return false; }, sample: () => state, reset() {}, start() {}, miss() {}, target() {}, released() {}, idle: () => Infinity, rush() {}, climbing() {}, marker() {}, pop() {}, buzz() {}, use() {}, safe: () => null };
  let on = true, sensors = false, latched = false, drag = null, wasActive = false;
  let lastYaw = null, lastPitch = null, targetYaw = 0, targetPitch = 0, smoothYaw = 0, smoothPitch = 0;
  let pull = 0, cooldown = 0, lookAt = -1e9;
  const q = new THREE.Quaternion(), correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const screenQ = new THREE.Quaternion(), euler = new THREE.Euler(), zAxis = new THREE.Vector3(0, 0, 1);
  const panel = document.createElement('div'); panel.id = 'phoneControls'; panel.hidden = true;
  // The star is the ring of a clog or a pipe (sludge green, with points). The arrow shows when the target is off the window.
  const STAR = '0,-26 5.3,-16.2 15.3,-21 13.8,-10 24.7,-8 17,0 24.7,8 13.8,10 15.3,21 5.3,16.2 0,26 -5.3,16.2 -15.3,21 -13.8,10 -24.7,8 -17,0 -24.7,-8 -13.8,-10 -15.3,-21 -5.3,-16.2';
  const INK = '#140a18';
  panel.innerHTML = `<div class="phone-rush" aria-hidden="true"></div><div class="phone-safe" aria-hidden="true"></div><div class="phone-top"><button data-action="motion" aria-label="Motion aim" aria-pressed="false">Motion</button><button data-action="center" aria-label="Center the aim" hidden>Center</button><button class="phone-view" data-action="view" aria-label="Switch between the view behind you and your own eyes">View</button><button data-action="menu" aria-label="Pause game">Pause</button></div><div class="phone-crosshair" aria-hidden="true"></div><div class="phone-target" data-kind="swing" hidden aria-hidden="true"><svg class="pt-body" viewBox="-28 -28 56 56"><g class="pt-ring"><circle r="19" fill="none" stroke="${INK}" stroke-width="10"/><circle r="19" fill="none" stroke="currentColor" stroke-width="5"/><path d="M0-26V-13M0 26V13M-26 0H-13M26 0H13" fill="none" stroke="${INK}" stroke-width="7"/><path d="M0-24V-15M0 24V15M-24 0H-15M24 0H15" fill="none" stroke="currentColor" stroke-width="3"/></g><g class="pt-star"><polygon points="${STAR}" fill="none" stroke="${INK}" stroke-width="8" stroke-linejoin="miter"/><polygon points="${STAR}" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="miter"/></g></svg><svg class="pt-arrow" viewBox="-28 -28 56 56"><polygon points="0,-24 19,3 7,3 7,23 -7,23 -7,3 -19,3" fill="currentColor" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></svg></div><div class="phone-climb" hidden role="group" aria-label="Climb"><button data-climb="up" aria-label="Climb up">▲</button><button data-climb="left" aria-label="Climb left">◀</button><button data-action="hop" aria-label="Jump off the wall">JUMP</button><button data-climb="right" aria-label="Climb right">▶</button><button data-climb="down" aria-label="Climb down">▼</button></div><div class="phone-bottom"><p class="phone-hint" role="status">${SAY.tap}</p><button data-action="throw" aria-label="Swing or release rope">SWING<span>Or tap anywhere on the city</span></button></div>`;
  document.body.append(panel);
  const button = name => panel.querySelector(`[data-action="${name}"]`), hint = panel.querySelector('.phone-hint'), rushEl = panel.querySelector('.phone-rush');
  const ring = panel.querySelector('.phone-target'), arrowEl = panel.querySelector('.pt-arrow'), safeEl = panel.querySelector('.phone-safe'), swingBtn = button('throw');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The climb pad shows only while you hold a wall. Each arrow moves you while it is held down.
  const pad = panel.querySelector('.phone-climb'), held = { up: false, down: false, left: false, right: false };
  let onWall = false;
  const padMove = () => { state.moveY = (held.up ? 1 : 0) - (held.down ? 1 : 0); state.moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0); };
  const padClear = () => { for (const k in held) held[k] = false; padMove(); };
  for (const b of pad ? pad.querySelectorAll('[data-climb]') : []) {
    const k = b.dataset.climb;
    const down = ev => { ev.preventDefault(); held[k] = true; padMove(); try { b.setPointerCapture(ev.pointerId); } catch { /* a pointer that is already gone: the arrow still works */ } };
    const off = () => { held[k] = false; padMove(); };
    b.addEventListener('pointerdown', down);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, off);
    b.addEventListener('contextmenu', ev => ev.preventDefault());
  }
  if (pad) pad.querySelector('[data-action="hop"]').onclick = () => { if (active()) state.jump = true; };
  let rushK = -1, rushT = 0;
  function label() {
    // one button for every swing: with a rope out, a press swings on to the next building (the rope lets go by itself)
    swingBtn.innerHTML = latched ? 'SWING<span>Again: the next building</span>' : 'SWING<span>Or tap anywhere on the city</span>';
    swingBtn.classList.toggle('held', latched);
    swingBtn.setAttribute('aria-pressed', String(latched));
  }
  function center() { lastYaw = lastPitch = null; targetYaw = targetPitch = smoothYaw = smoothPitch = 0; }
  function reset() {
    latched = false; drag = null; pull = 0; center(); padClear();
    Object.assign(state, { turn:0, pitch:0, moveX:0, moveY:0, hold:false, reel:0, yank:0, jump:false, menu:false, fire:false, view:false, aim:null });
    label();
  }
  // Center does something only while motion aim is on, so it shows only then.
  function motionUi() {
    const b = button('motion');
    b.setAttribute('aria-pressed', String(sensors)); b.classList.toggle('on', sensors);
    button('center').hidden = !sensors;
    hint.textContent = sensors ? SAY.motion : SAY.tap;
  }
  async function start() {
    if (!on) return;
    try {
      const requests = [window.DeviceOrientationEvent, window.DeviceMotionEvent].map(C => C?.requestPermission ? C.requestPermission().catch(() => 'denied') : Promise.resolve(C ? 'granted' : 'denied'));
      const result = await Promise.all(requests);
      sensors = result.some(x => x === 'granted'); center();
    } catch { sensors = false; }
    motionUi();
  }
  button('motion').onclick = () => { if (sensors) { sensors = false; center(); motionUi(); } else start(); };
  button('center').onclick = () => { center(); hint.textContent = SAY.center; };
  button('view').onclick = () => { if (active()) state.view = true; };
  button('menu').onclick = () => { state.menu = true; };
  function cast(aim = null) {
    latched = true; state.fire = true; state.aim = aim; label();
    hint.textContent = SAY.swing;
  }
  // SWING never lets go: with a rope out it moves the rope to the next building ahead, so taps chain swings with no gap
  button('throw').onclick = () => { if (active()) cast(); };
  canvas.addEventListener('pointerdown', ev => {
    if (!on || !active() || drag) return;
    ev.preventDefault(); canvas.setPointerCapture(ev.pointerId);
    drag = { id:ev.pointerId, x:ev.clientX, y:ev.clientY, x0:ev.clientX, y0:ev.clientY, distance:0 };
  });
  canvas.addEventListener('pointermove', ev => {
    if (drag?.id !== ev.pointerId || !active()) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.distance += Math.hypot(dx,dy);
    // Allow a small amount of finger movement without turning a tap into a look gesture.
    if (drag.distance > 8) { state.turn -= dx * .004; state.pitch -= dy * .004; lookAt = performance.now(); }
    drag.x = ev.clientX; drag.y = ev.clientY;
  });
  canvas.addEventListener('pointerup', ev => {
    if (drag?.id !== ev.pointerId) return;
    if (on && active() && drag.distance <= 8) {
      const rect = canvas.getBoundingClientRect();
      cast({ x:clamp((ev.clientX-rect.left)/rect.width*2-1,-1,1), y:clamp(1-(ev.clientY-rect.top)/rect.height*2,-1,1) });
    }
    drag = null;
  });
  for (const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type, ev => { if (drag?.id === ev.pointerId) drag = null; });
  addEventListener('deviceorientation', ev => {
    if (!sensors || !active() || !Number.isFinite(ev.beta) || !Number.isFinite(ev.gamma) || !Number.isFinite(ev.alpha)) return;
    const rad = Math.PI/180, angle = (screen.orientation?.angle || 0)*rad;
    euler.set(ev.beta*rad,ev.alpha*rad,-ev.gamma*rad,'YXZ');
    q.setFromEuler(euler).multiply(correction).multiply(screenQ.setFromAxisAngle(zAxis,-angle));
    euler.setFromQuaternion(q,'YXZ');
    const yaw=euler.y, pitch=euler.x;
    if(lastYaw !== null && Math.abs(yaw-lastYaw)+Math.abs(pitch-lastPitch) > .02) lookAt = performance.now();
    if(lastYaw !== null) { targetYaw += clamp(Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw)),-.18,.18); targetPitch += clamp(pitch-lastPitch,-.14,.14); }
    lastYaw=yaw; lastPitch=pitch;
  });
  addEventListener('devicemotion', ev => {
    if(!sensors || !active() || !latched) return;
    const z=ev.acceleration?.z, now=performance.now();
    if(!Number.isFinite(z) || z<1.6 || now<cooldown) return;
    pull=Math.max(pull,clamp(z/9,.2,1));
    if(z>4) { state.yank=clamp(z*.38,1.6,4.5); cooldown=now+450; }
  });
  addEventListener('blur',reset);
  document.addEventListener('visibilitychange',reset);
  screen.orientation?.addEventListener('change',reset);

  /* ---------------- the marker: a lock-on ring on the target, or an arrow at the edge of the safe window ---------------- */
  // The window is the frame (the .phone-safe box: the safe-area insets plus 8 px) cut so that it holds none of the HUD boxes
  // (the top buttons, the score pills, the spoken line with its tail, the toast, the SWING panel, the climb pad). Each box
  // takes the cut that keeps the most area. The boxes are read 10 times a second at most, and on a resize. The objects below
  // are reused, so a frame allocates none.
  const win = { l: 0, t: 0, r: 0, b: 0 }, scr = { l: 0, t: 0, w: 1, h: 1 };
  const topEl = panel.querySelector('.phone-top'), bottomEl = panel.querySelector('.phone-bottom');
  let boxAt = -1e9, fsTop = null, fsSub = null, fsToast = null; // the HUD boxes outside the panel exist once ui.js has built them
  let shown = false, ready = false, dimmed = false, kind = '', arrowed = false, lx = NaN, ly = NaN, la = NaN, popUntil = 0, buzzAt = -1e9;
  const find = sel => (typeof document.querySelector === 'function' ? document.querySelector(sel) : null);
  const setStyle = (el, key, value) => { const s = el?.style; if (s) s[key] = value; };
  function carve(l, t, r, b) {
    if (r <= win.l || l >= win.r || b <= win.t || t >= win.b) return; // it is clear of the window already
    const w = win.r - win.l, h = win.b - win.t;
    const below = Math.max(0, win.b - (b + GAP)) * w, above = Math.max(0, t - GAP - win.t) * w;
    const right = Math.max(0, win.r - (r + GAP)) * h, left = Math.max(0, l - GAP - win.l) * h, best = Math.max(below, above, right, left);
    if (best === below) win.t = b + GAP; else if (best === above) win.b = t - GAP; else if (best === right) win.l = r + GAP; else win.r = l - GAP;
  }
  // grow: how far the box reaches past its rectangle (a hard shadow, the tail of the speech bubble)
  function take(el, grow, needOn) {
    if (!el || (needOn && !el.classList?.contains?.('on'))) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) carve(r.left, r.top, r.right, r.bottom + grow);
  }
  function readBoxes(now) {
    boxAt = now;
    const c = canvas.getBoundingClientRect(), f = safeEl.getBoundingClientRect();
    scr.l = c.left; scr.t = c.top; scr.w = c.width || 1; scr.h = c.height || 1;
    win.l = f.left; win.t = f.top; win.r = f.right; win.b = f.bottom;
    fsTop = fsTop || find('.fs-top'); fsSub = fsSub || find('.fs-sub'); fsToast = fsToast || find('.fs-toast');
    take(topEl, 4, false); take(fsTop, 4, false); take(fsSub, 27, true); take(fsToast, 4, true); take(pad, 0, false); take(bottomEl, 0, false);
    if (win.b < win.t) win.t = win.b = (win.t + win.b) / 2;
    if (win.r < win.l) win.l = win.r = (win.l + win.r) / 2;
  }
  function hideMarker() {
    if (shown) { ring.hidden = true; shown = false; lx = ly = la = NaN; }
    if (ready) { panel.classList.toggle('target-ready', false); ready = false; }
    if (!dimmed) { swingBtn.classList.toggle('no-target', true); dimmed = true; }
  }
  addEventListener('resize', () => { boxAt = -1e9; });

  return { get enabled() { return on; }, reset, start,
    // The player chose the mouse and the keyboard on a touch screen: the touch scheme is off for the session.
    use(v) {
      on = !!v;
      if (!on) { sensors = false; reset(); motionUi(); hideMarker(); panel.hidden = true; }
    },
    // Comic speed lines at the screen edges, 0 (none) to 1 (full). They crackle (a small turn every 60 ms) unless motion is reduced.
    rush(k, dt = 0) {
      if (!rushEl) return;
      k = Math.round(clamp(k, 0, 1) * 50) / 50;
      if (k !== rushK) { rushK = k; rushEl.style.opacity = String(k); }
      if (k > 0 && !still && (rushT -= dt) <= 0) { rushT = .06; rushEl.style.transform = `rotate(${(Math.random() * 7).toFixed(1)}deg) scale(${(1.02 + .06 * k).toFixed(3)})`; }
    },
    // On a wall: show the climb pad (and clear it when you leave, so no arrow stays held).
    climbing(wall) {
      wall = !!wall;
      if (wall === onWall || !pad) return;
      onWall = wall; pad.hidden = !wall;
      if (wall) { latched = false; label(); hint.textContent = SAY.wall; }
      else padClear();
    },
    // The rope let go by itself: the button goes back to SWING.
    released() { latched=false; state.fire=false; state.aim=null; label(); hint.textContent=SAY.fly; },
    // Seconds since the player last dragged or tilted to look. The camera follow waits for this.
    idle() { return (performance.now()-lookAt)/1000; },
    miss(keepRope = false) { latched=keepRope; state.fire=false; label(); hint.textContent=keepRope ? SAY.kept : SAY.none; },
    // Only the dead-latch safety: the ring and the dimmed button belong to marker().
    target(valid, attached) {
      // A broken rope must never leave the button showing a rope that is not there.
      if(latched && !attached && !state.fire && window.G?.P?.dead) reset();
    },
    // m: null, or { x, y, kind, dist, behind } with x and y in NDC (y up). null hides the ring and dims SWING.
    marker(m) {
      if (!on || !ring || !m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) { hideMarker(); return; }
      const now = performance.now();
      if (now - boxAt >= READ) readBoxes(now);
      // the ring is 56 px across, so its centre stays 28 px inside the window
      let cl = win.l + RING, cr = win.r - RING, ct = win.t + RING, cb = win.b - RING;
      if (cr < cl) cl = cr = (cl + cr) / 2;
      if (cb < ct) ct = cb = (ct + cb) / 2;
      const wx = (cl + cr) / 2, wy = (ct + cb) / 2;
      let x = wx, y = wy, turn = 0, arrow = false;
      if (m.behind) {
        // behind the camera: the arrow sits on the bottom border, on the target's side, and points down
        arrow = true; x = clamp(wx + clamp(m.x, -1, 1) * (cr - cl) * .25, cl, cr); y = cb; turn = 180;
      } else {
        const px = scr.l + (m.x * .5 + .5) * scr.w, py = scr.t + (.5 - m.y * .5) * scr.h;
        if (px >= cl && px <= cr && py >= ct && py <= cb) { x = px; y = py; }
        else {
          // off the window: the arrow sits where the line from the window's middle to the target crosses its border
          arrow = true;
          const dx = px - wx, dy = py - wy;
          let s = 1;
          if (px > cr) s = Math.min(s, (cr - wx) / dx); else if (px < cl) s = Math.min(s, (cl - wx) / dx);
          if (py > cb) s = Math.min(s, (cb - wy) / dy); else if (py < ct) s = Math.min(s, (ct - wy) / dy);
          x = wx + dx * s; y = wy + dy * s; turn = Math.atan2(dx, -dy) * 180 / Math.PI;
        }
      }
      const k = m.kind || 'swing';
      if (k !== kind) { kind = k; ring.setAttribute('data-kind', k); }
      if (arrow !== arrowed) { arrowed = arrow; ring.classList.toggle('arrow', arrow); }
      const a = Math.round(turn);
      if (arrow && a !== la) { la = a; setStyle(arrowEl, 'transform', `rotate(${a}deg)`); }
      const rx = Math.round(x * 4) / 4, ry = Math.round(y * 4) / 4;
      if (rx !== lx || ry !== ly) { lx = rx; ly = ry; setStyle(ring, 'transform', `translate(${rx - RING}px,${ry - RING}px)`); }
      if (!shown) { ring.hidden = false; shown = true; }
      if (!ready) { panel.classList.toggle('target-ready', true); ready = true; }
      if (dimmed) { swingBtn.classList.toggle('no-target', false); dimmed = false; }
    },
    // The window the ring and the arrow stay in: { l, t, r, b } in CSS px, read now (tests ask for it). null on the stub.
    safe() { readBoxes(performance.now()); return win; },
    // The catch pop: the ring grows for POP ms on every attach, yank and pump. It works on a phone with no vibration.
    pop() { if (!on || !ring) return; popUntil = performance.now() + POP; ring.classList.add('pop'); },
    // A short buzz where the browser has one (Android; iPhone has none). At most one in 40 ms, none while the page is hidden.
    buzz(ms) {
      if (!on || !(ms > 0) || document.hidden) return;
      const now = performance.now();
      if (now - buzzAt < BUZZ_GAP) return;
      buzzAt = now;
      try { navigator.vibrate?.(ms); } catch { /* a browser that refuses: the pop still shows */ }
    },
    sample(dt) {
      const live=on && active(); panel.hidden=!live;
      if(popUntil && performance.now()>=popUntil) { popUntil=0; ring.classList.remove('pop'); }
      if(!live) { if(wasActive) reset(); wasActive=false; return {...state,hold:false}; }
      wasActive=true;
      const blend=1-Math.exp(-20*Math.min(dt,.05)), sy=smoothYaw, sp=smoothPitch;
      smoothYaw+=(targetYaw-smoothYaw)*blend; smoothPitch+=(targetPitch-smoothPitch)*blend;
      const out={...state,turn:state.turn+smoothYaw-sy,pitch:state.pitch+smoothPitch-sp,hold:latched,reel:pull>.12?pull:0};
      pull*=Math.exp(-6*dt); state.turn=state.pitch=state.yank=0;state.fire=state.jump=state.menu=state.view=false;state.aim=null;
      return out;
    },
  };
}
