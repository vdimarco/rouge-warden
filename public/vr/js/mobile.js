// Two-thumb flat-screen play. A tap on the left half of the city throws the left plunger, a tap on the right half the right one;
// each finger is its own tap, so two thumbs throw both at once. A rope lets go by itself past the bottom of the arc.
// Drag or phone motion aims; a tap fires immediately. The panel also draws the lock-on ring that marks the target.
// (This file keeps single quotes: qa/vr/mobile.test.mjs rewrites the import of three by its exact text.)
import * as THREE from 'three';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RING = 28; // half of the 56 px lock-on ring
const GAP = 8; // clear space between the marker and any HUD box
const READ = 100; // ms between two reads of the HUD boxes (a resize reads at once)
const POP = 120; // ms of the catch pop
const BUZZ_GAP = 40; // ms between two vibrations
// the hint line at the bottom. Each line fits on one line of the 328 px panel of a 360 px phone (the spoken line above it
// leaves room for exactly one line, and its tail would poke into a second one): keep them to about 42 letters. The wall line shows
// while the spoken lines are hidden (portrait) or far above (landscape), so it may run to two lines.
const SAY = {
  tap: 'Tap left or right to throw a plunger.',
  motion: 'Point the phone. Tap left or right.',
  center: 'Aim centered. Tap when the ring is yellow.',
  swing: 'Swinging. Tap the other side to swing on.',
  both: 'Two plungers! Tap again to swing on.',
  fly: 'Flying. Tap the next building.',
  wall: 'On the wall. Hold the arrows to climb. Tap a building to swing off.',
  kept: 'Keeping this rope. Tap a closer building.',
  none: 'Nothing in reach. Face the tall buildings.',
};
export function createMobile(canvas, active) {
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  // fires, aims and holds: one slot per plunger (0 the left, 1 the right)
  const state = { turn: 0, pitch: 0, moveX: 0, moveY: 0, reel: 0, yank: 0, jump: false, menu: false, view: false, fires: [false, false], aims: [null, null] };
  // no touch point: a stub with every method, so main.js calls them with no guard
  if (!touch) { state.holds = [false, false]; return { get enabled() { return false; }, sample: () => state, reset() {}, start() {}, tap() {}, miss() {}, target() {}, released() {}, idle: () => Infinity, rush() {}, climbing() {}, marker() {}, pop() {}, buzz() {}, use() {}, safe: () => null }; }
  let on = true, sensors = false, wasActive = false;
  const latched = [false, false], drags = new Map(); // a plunger out on each side; the fingers down, by pointer id
  let lastYaw = null, lastPitch = null, targetYaw = 0, targetPitch = 0, smoothYaw = 0, smoothPitch = 0;
  let pull = 0, cooldown = 0, lookAt = -1e9;
  const q = new THREE.Quaternion(), correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const screenQ = new THREE.Quaternion(), euler = new THREE.Euler(), zAxis = new THREE.Vector3(0, 0, 1);
  const panel = document.createElement('div'); panel.id = 'phoneControls'; panel.hidden = true;
  // The star is the ring of a clog or a pipe (sludge green, with points). The arrow shows when the target is off the window.
  const STAR = '0,-26 5.3,-16.2 15.3,-21 13.8,-10 24.7,-8 17,0 24.7,8 13.8,10 15.3,21 5.3,16.2 0,26 -5.3,16.2 -15.3,21 -13.8,10 -24.7,8 -17,0 -24.7,-8 -13.8,-10 -15.3,-21 -5.3,-16.2';
  const INK = '#140a18';
  panel.innerHTML = `<div class="phone-rush" aria-hidden="true"></div><div class="phone-safe" aria-hidden="true"></div><div class="phone-top"><button data-action="motion" aria-label="Motion aim" aria-pressed="false">Motion</button><button data-action="center" aria-label="Center the aim" hidden>Center</button><button class="phone-view" data-action="view" aria-label="Switch between the view behind you and your own eyes">View</button><button data-action="menu" aria-label="Pause game">Pause</button></div><div class="phone-crosshair" aria-hidden="true"></div><div class="phone-target" data-kind="swing" hidden aria-hidden="true"><svg class="pt-body" viewBox="-28 -28 56 56"><g class="pt-ring"><circle r="19" fill="none" stroke="${INK}" stroke-width="10"/><circle r="19" fill="none" stroke="currentColor" stroke-width="5"/><path d="M0-26V-13M0 26V13M-26 0H-13M26 0H13" fill="none" stroke="${INK}" stroke-width="7"/><path d="M0-24V-15M0 24V15M-24 0H-15M24 0H15" fill="none" stroke="currentColor" stroke-width="3"/></g><g class="pt-star"><polygon points="${STAR}" fill="none" stroke="${INK}" stroke-width="8" stroke-linejoin="miter"/><polygon points="${STAR}" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="miter"/></g></svg><svg class="pt-arrow" viewBox="-28 -28 56 56"><polygon points="0,-24 19,3 7,3 7,23 -7,23 -7,3 -19,3" fill="currentColor" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></svg></div><div class="phone-climb" hidden role="group" aria-label="Climb"><button data-climb="up" aria-label="Climb up">▲</button><button data-climb="left" aria-label="Climb left">◀</button><button data-action="hop" aria-label="Jump off the wall">JUMP</button><button data-climb="right" aria-label="Climb right">▶</button><button data-climb="down" aria-label="Climb down">▼</button></div><div class="phone-side" data-side="0" aria-hidden="true">L</div><div class="phone-side" data-side="1" aria-hidden="true">R</div><div class="phone-bottom"><p class="phone-hint" role="status">${SAY.tap}</p></div>`;
  document.body.append(panel);
  const button = name => panel.querySelector(`[data-action="${name}"]`), hint = panel.querySelector('.phone-hint'), rushEl = panel.querySelector('.phone-rush');
  const ring = panel.querySelector('.phone-target'), arrowEl = panel.querySelector('.pt-arrow'), safeEl = panel.querySelector('.phone-safe');
  const sides = [0, 1].map(i => panel.querySelector(`.phone-side[data-side="${i}"]`));
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
  // the side badges light while their plunger holds
  function label() { for (let i = 0; i < 2; i++) sides[i]?.classList?.toggle('held', latched[i]); }
  function center() { lastYaw = lastPitch = null; targetYaw = targetPitch = smoothYaw = smoothPitch = 0; }
  function reset() {
    latched[0] = latched[1] = false; drags.clear(); pull = 0; center(); padClear();
    Object.assign(state, { turn:0, pitch:0, moveX:0, moveY:0, reel:0, yank:0, jump:false, menu:false, view:false });
    state.fires[0] = state.fires[1] = false; state.aims[0] = state.aims[1] = null;
    label();
  }
  // the hint line when no rope is out and nothing else has spoken: it depends on motion aim
  const rest = () => (sensors ? SAY.motion : SAY.tap);
  // A line that does not come from the wall (a Motion or Center press, a tap that finds nothing) must not hide the wall line:
  // it stays while the hero holds the wall, and climbing(false) puts the resting line back.
  const say = line => { hint.textContent = onWall ? SAY.wall : line; };
  // Center does something only while motion aim is on, so it shows only then.
  function motionUi() {
    const b = button('motion');
    b.setAttribute('aria-pressed', String(sensors)); b.classList.toggle('on', sensors);
    button('center').hidden = !sensors;
    say(rest());
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
  button('center').onclick = () => { center(); say(SAY.center); };
  button('view').onclick = () => { if (active()) state.view = true; };
  button('menu').onclick = () => { state.menu = true; };
  // A tap throws the plunger of its side. With that plunger out it moves to the tapped building, so taps chain swings with no gap.
  // aim: the tap's screen point (NDC, y up), or null for the marked target.
  function cast(side, aim = null) {
    side = side === 0 ? 0 : 1;
    latched[side] = true; state.fires[side] = true; state.aims[side] = aim; label();
    hint.textContent = latched[0] && latched[1] ? SAY.both : SAY.swing;
  }
  canvas.addEventListener('pointerdown', ev => {
    if (!on || !active() || drags.has(ev.pointerId)) return;
    ev.preventDefault();
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* a pointer that is already gone: the tap still counts */ }
    drags.set(ev.pointerId, { x:ev.clientX, y:ev.clientY, distance:0 });
  });
  canvas.addEventListener('pointermove', ev => {
    const d = drags.get(ev.pointerId);
    if (!d || !active()) return;
    const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
    d.distance += Math.hypot(dx,dy);
    // Allow a small amount of finger movement without turning a tap into a look gesture.
    if (d.distance > 8) { state.turn -= dx * .004; state.pitch -= dy * .004; lookAt = performance.now(); }
    d.x = ev.clientX; d.y = ev.clientY;
  });
  canvas.addEventListener('pointerup', ev => {
    const d = drags.get(ev.pointerId);
    if (!d) return;
    drags.delete(ev.pointerId);
    if (on && active() && d.distance <= 8) {
      const rect = canvas.getBoundingClientRect(), x = (ev.clientX-rect.left)/rect.width;
      cast(x < .5 ? 0 : 1, { x:clamp(x*2-1,-1,1), y:clamp(1-(ev.clientY-rect.top)/rect.height*2,-1,1) });
    }
  });
  for (const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type, ev => { drags.delete(ev.pointerId); });
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
    if(!sensors || !active() || !(latched[0] || latched[1])) return;
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
  // (the top buttons, the score pills, the spoken line with its tail, the toast, the hint panel, the climb pad, the plunger badges). Each box
  // takes the cut that keeps the most area. The boxes are read 10 times a second at most, and on a resize. The objects below
  // are reused, so a frame allocates none.
  const win = { l: 0, t: 0, r: 0, b: 0 }, scr = { l: 0, t: 0, w: 1, h: 1 };
  const topEl = panel.querySelector('.phone-top'), bottomEl = panel.querySelector('.phone-bottom');
  let boxAt = -1e9, fsTop = null, fsSub = null, fsToast = null; // the HUD boxes outside the panel exist once ui.js has built them
  let shown = false, ready = false, kind = '', arrowed = false, lx = NaN, ly = NaN, la = NaN, popUntil = 0, buzzAt = -1e9;
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
    take(topEl, 4, false); take(fsTop, 4, false); take(fsSub, 27, true); take(fsToast, 4, true); take(pad, 0, false); take(bottomEl, 0, false); take(sides[0], 3, false); take(sides[1], 3, false);
    if (win.b < win.t) win.t = win.b = (win.t + win.b) / 2;
    if (win.r < win.l) win.l = win.r = (win.l + win.r) / 2;
  }
  function hideMarker() {
    if (shown) { ring.hidden = true; shown = false; lx = ly = la = NaN; }
    if (ready) { panel.classList.toggle('target-ready', false); ready = false; }
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
    // On a wall: show the climb pad (and clear it when you leave, so no arrow stays held). When you leave, the wall line goes too
    // (JUMP, over the top, down to the street). A tap that swung you off has set the swing line already: that one stays.
    climbing(wall) {
      wall = !!wall;
      if (wall === onWall || !pad) return;
      onWall = wall; pad.hidden = !wall; panel.classList.toggle('on-wall', wall); // the climb pad takes the left badge's place
      if (wall) { latched[0] = latched[1] = false; label(); hint.textContent = SAY.wall; }
      else { padClear(); if (!latched[0] && !latched[1]) hint.textContent = rest(); }
    },
    // A tap on a side, from code (the tests, a keyboard on a touch screen): side 0 the left plunger, 1 the right; aim as cast.
    tap(side = 1, aim = null) { if (on && active()) cast(side, aim); },
    // A rope let go by itself (side, or both when no side is given): its badge goes dark.
    released(side) {
      for (let i = 0; i < 2; i++) if (side === undefined || side === i) { latched[i] = false; state.fires[i] = false; state.aims[i] = null; }
      label(); hint.textContent = latched[0] || latched[1] ? SAY.swing : SAY.fly;
    },
    // Seconds since the player last dragged or tilted to look. The camera follow waits for this.
    idle() { return (performance.now()-lookAt)/1000; },
    miss(side = 1, keepRope = false) { side = side === 0 ? 0 : 1; latched[side]=keepRope; state.fires[side]=false; label(); say(keepRope ? SAY.kept : SAY.none); },
    // Only the dead-latch safety: the ring belongs to marker().
    target(valid, attached) {
      // A broken rope must never leave the button showing a rope that is not there.
      if((latched[0] || latched[1]) && !attached && !state.fires[0] && !state.fires[1] && window.G?.P?.dead) reset();
    },
    // m: null, or { x, y, kind, dist, behind } with x and y in NDC (y up). null hides the ring.
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
      if(!live) { if(wasActive) reset(); wasActive=false; return {...state,fires:[false,false],aims:[null,null],holds:[false,false]}; }
      wasActive=true;
      const blend=1-Math.exp(-20*Math.min(dt,.05)), sy=smoothYaw, sp=smoothPitch;
      smoothYaw+=(targetYaw-smoothYaw)*blend; smoothPitch+=(targetPitch-smoothPitch)*blend;
      const out={...state,turn:state.turn+smoothYaw-sy,pitch:state.pitch+smoothPitch-sp,fires:[...state.fires],aims:[...state.aims],holds:[...latched],reel:pull>.12?pull:0};
      pull*=Math.exp(-6*dt); state.turn=state.pitch=state.yank=0;state.jump=state.menu=state.view=false;
      state.fires[0]=state.fires[1]=false; state.aims[0]=state.aims[1]=null;
      return out;
    },
  };
}
