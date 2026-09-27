// js/story/ui/tilt.js : tilt look for phones (story only). The TILT touch button turns it on and off; a double
// tap on it recentres. Off by default; the choice is kept in localStorage ('crimson.tilt').
// Only on touch hardware: never on a desktop (no touch points), and never outside the story (the arena,
// FIGHT GABE, never sees it; the listener is only attached while a story session runs and tilt is on).
// How it works: deviceorientation only stores the latest angles. Each tick (input phase, before input.js
// turns drags into rates) the pose becomes a view heading and pitch (the screen orientation, landscape
// left or right, is part of the pose), relative to a reference pose taken when tilt turns on, on a
// recentre, or when the screen turns. A small dead zone eats hand tremor, the pitch offset is clamped,
// and a short low-pass smooths it. Only the change since the last tick goes out, as radians in
// S.input.touch.tiltX (right) and tiltY (down); input.js adds them to the look axis like a touch drag, so
// the foot camera, the lock-on rules and the drive camera read it through axis('look') as they always did.
// Outside foot, drive and the phone camera (a menu, the map, a cine) nothing goes out.
import * as THREE from 'three';

const KEY = 'crimson.tilt';
const DZ = 0.012; // rad: the dead zone (backlash), about 0.7 degrees
const TAU = 0.05; // s: the low-pass
const PMAX = 0.6; // rad: the pitch offset from the reference pose never goes past this
const GAIN_YAW = 1.5, GAIN_PITCH = 1.0;
const DOUBLE = 0.32; // s between the taps of a double tap
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// can this device tilt at all: touch hardware and the event
export function tiltSupported() {
  if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') return false;
  const touchHw = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  return touchHw && document.body.classList.contains('touch');
}

export function createTilt(U) {
  const { S } = U;
  const I = U.input, T = I.touch;
  T.tiltX = 0; T.tiltY = 0;
  let on = false; try { on = localStorage.getItem(KEY) === 'on'; } catch (e) { /* storage blocked */ }
  let listening = false, needAsk = false, asking = false, granted = false;
  let raw = null; // { a, b, g } degrees
  let ref = null, angle0 = null;
  let tgtY = 0, tgtP = 0, smY = 0, smP = 0, emY = 0, emP = 0;
  let lastTap = -9, pendingOff = null;
  const q = new THREE.Quaternion(), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), q0 = new THREE.Quaternion();
  const e = new THREE.Euler(), Z = new THREE.Vector3(0, 0, 1), f = new THREE.Vector3(), u = new THREE.Vector3();

  const save = () => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (err) { /* storage blocked */ } };
  const onEvent = (ev) => {
    if (ev.beta == null && ev.gamma == null) return;
    raw = { a: +ev.alpha || 0, b: +ev.beta || 0, g: +ev.gamma || 0 };
  };
  const inStory = () => !!(S.api && S.api.active && S.game && S.game.state === 'story');
  function listen(want) {
    if (want === listening) return;
    listening = want;
    if (want) addEventListener('deviceorientation', onEvent);
    else { removeEventListener('deviceorientation', onEvent); raw = null; }
  }
  const screenAngle = () => {
    const o = screen.orientation;
    const a = o && typeof o.angle === 'number' ? o.angle : +window.orientation || 0;
    return ((a % 360) + 360) % 360;
  };
  // the view's heading (radians, up = counterclockwise seen from above) and pitch (up > 0) for a pose
  function pose(r, ang) {
    const d = Math.PI / 180;
    e.set(r.b * d, r.a * d, -r.g * d, 'YXZ');
    q.setFromEuler(e).multiply(q1).multiply(q0.setFromAxisAngle(Z, -ang * d));
    f.set(0, 0, -1).applyQuaternion(q); u.set(0, 1, 0).applyQuaternion(q);
    const p = Math.asin(Math.max(-1, Math.min(1, f.y)));
    // the horizontal part of the view: from the back of the phone, or from the top of the screen when
    // the phone lies flat (exact without roll, stable at any pitch)
    const vx = f.x * Math.cos(p) - u.x * Math.sin(p), vz = f.z * Math.cos(p) - u.z * Math.sin(p);
    return { h: Math.atan2(-vx, -vz), p };
  }
  function recentre() { ref = null; }
  function reset0() { ref = null; tgtY = tgtP = smY = smP = emY = emP = 0; T.tiltX = T.tiltY = 0; }

  function ask() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE || typeof DOE.requestPermission !== 'function' || granted) { needAsk = false; return; }
    if (asking) return;
    asking = true; needAsk = false;
    let p;
    try { p = DOE.requestPermission(); } catch (err) { p = Promise.reject(err); }
    Promise.resolve(p).then((r) => { asking = false; if (r === 'granted') granted = true; else deny(); }, () => { asking = false; deny(); });
  }
  function deny() {
    on = false; save(); listen(false); reset0();
    if (S.ui && S.ui.toast) S.ui.toast('TILT NEEDS MOTION ACCESS');
  }
  function setOn(v) {
    on = !!v; save(); reset0(); pendingOff = null;
    if (on) ask();
  }

  // input phase, before input.js makes the look rate (-200)
  S.register('input', (cdt, rdt, rawDt) => {
    const now = I.realTime;
    if (pendingOff != null && now - pendingOff >= DOUBLE) { pendingOff = null; setOn(false); }
    const live = on && tiltSupported() && inStory() && !needAsk;
    listen(live);
    if (!live || !raw) { T.tiltX = T.tiltY = 0; return; }
    const ang = screenAngle();
    if (angle0 !== ang) { angle0 = ang; ref = null; }
    const P = pose(raw, ang);
    if (!ref) { ref = P; tgtY = smY = emY; tgtP = smP = emP; ref.y0 = emY; ref.p0 = emP; }
    const relY = ref.y0 + wrap(P.h - ref.h), relP = ref.p0 + Math.max(-PMAX, Math.min(PMAX, P.p - ref.p));
    // the dead zone: the target only moves once the pose is more than DZ away from it
    const dy = wrap(relY - tgtY); if (Math.abs(dy) > DZ) tgtY += dy - Math.sign(dy) * DZ;
    const dp = relP - tgtP; if (Math.abs(dp) > DZ) tgtP += dp - Math.sign(dp) * DZ;
    const k = 1 - Math.exp(-Math.max(1 / 240, rawDt || 1 / 60) / TAU);
    smY += (tgtY - smY) * k; smP += (tgtP - smP) * k;
    const oy = smY - emY, op = smP - emP; emY = smY; emP = smP;
    const c = I.context;
    if (S.mode !== 'play' || !(c === 'foot' || c === 'drive' || c === 'photo')) { T.tiltX = T.tiltY = 0; return; }
    // heading up turns the view left (look x < 0); pitch up tilts the view up (look y < 0)
    T.tiltX += -oy * GAIN_YAW; T.tiltY += -op * GAIN_PITCH;
  }, -210);

  S.bus.on('exit', () => { listen(false); reset0(); pendingOff = null; });
  S.bus.on('start', () => { reset0(); pendingOff = null; if (on && tiltSupported()) { const DOE = window.DeviceOrientationEvent; needAsk = !!(DOE && typeof DOE.requestPermission === 'function' && !granted); } });

  return {
    get on() { return on; },
    get supported() { return tiltSupported(); },
    // a tap on TILT: off -> on; on -> off, unless a second tap comes within DOUBLE (then it recentres)
    tap() {
      const now = I.realTime;
      if (pendingOff != null && now - lastTap < DOUBLE) { pendingOff = null; lastTap = -9; recentre(); if (S.ui && S.ui.toast) S.ui.toast('TILT CENTRED'); return; }
      if (!on) { setOn(true); lastTap = now; return; }
      if (now - lastTap < DOUBLE) { lastTap = -9; recentre(); return; } // the second tap of the one that turned it on
      pendingOff = now; lastTap = now;
    },
    // any touch on the layer is a gesture: iOS asks for motion access only from one (a remembered ON)
    gesture() { if (needAsk && on) ask(); },
    recentre,
    // QA
    get state() { return { on, listening, needAsk, pendingOff: pendingOff != null, ref: ref ? { h: ref.h, p: ref.p } : null, yaw: emY, pitch: emP }; },
  };
}
