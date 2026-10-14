// Light Years Home v3: the chase camera (design-handling.md 6, final.md 6.8). It sits behind and above the ship on a
// critically damped spring, aims at a look-ahead point so the ship lands at its screen height, follows a mix of the
// velocity and the nose (more velocity in a drift, so you see the slide), turns toward the inside of a drift, keeps
// the horizon level (up is the zone plane's U, never the ship's bank), widens with speed and kicks on boost.
// Sources: Lowe, "Critically Damped Ease-In/Ease-Out Smoothing", Game Programming Gems 4 (the spring); Hargreaves
// on MotoGP via the research (FOV kicks tied to acceleration); Everspace 2's auto-roll (level horizon).
import * as THREE from 'three';
import { TUNE } from '../core/tune.js';
import { basisFrom } from '../core/vec.js';

const DEG = Math.PI / 180;
// Framing (deg): a well's core comes EDGE_MARGIN onto the screen; the ship never goes nearer the side than
// SHIP_MARGIN; the camera swings at most SWING_MAX round the ship to fit both.
const EDGE_MARGIN = 11, SHIP_MARGIN = 9, SWING_MAX = 70;
const LOOK_RATE = 4;
const PULL_MAX = 1.8;             // × CAM DIST: the furthest a close pass round a core pulls the camera back              // rad/s: the fastest the drift look-in turns to keep a well's core on screen
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (dt, tc) => (tc > 0 ? 1 - Math.exp(-dt / tc) : 1);
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;

/**
 * shipPose(ship, alpha, out) → the ship's pose between its last two steps: { pos, yaw, pitch, bank, hop, vel, speed,
 * up, drift, db, boosting, slip, flickerT, stunT }. Pass it to chase.update and tern.update (with alpha 1).
 */
export function shipPose(ship, alpha = 1, out = {}) {
  const a = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);
  const p = ship.pos, prev = ship.prev || null;
  out.pos = out.pos || [0, 0, 0];
  if (prev && prev.pos) {
    for (let i = 0; i < 3; i++) out.pos[i] = prev.pos[i] + (p[i] - prev.pos[i]) * a;
    out.yaw = lerpAngle(prev.yaw ?? ship.yaw, ship.yaw, a);
    out.pitch = (prev.pitch ?? ship.pitch) + (ship.pitch - (prev.pitch ?? ship.pitch)) * a;
    out.bank = Number.isFinite(prev.bank) ? prev.bank + ((ship.bank || 0) - prev.bank) * a : ship.bank || 0;
  } else {
    out.pos[0] = p[0]; out.pos[1] = p[1]; out.pos[2] = p[2];
    out.yaw = ship.yaw || 0; out.pitch = ship.pitch || 0; out.bank = ship.bank || 0;
  }
  out.prev = null;
  out.hop = ship.hop || 0;
  out.vel = ship.vel || [0, 0, 0];
  out.speed = ship.speed ?? Math.hypot(out.vel[0], out.vel[1], out.vel[2]);
  out.up = ship.up || [0, 0, 1];
  out.drift = ship.drift || null;
  out.db = ship.db || null;
  out.boosting = !!ship.boosting;
  out.slip = ship.slip || 0;
  out.flickerT = ship.flickerT || 0;
  out.stunT = ship.stunT || 0;
  out.tow = ship.tow || null;
  return out;
}

// Each event in a list or in core/events.js's buffer ({ list, n }).
function eachEvent(events, fn) {
  if (!events) return;
  if (Array.isArray(events)) { for (const e of events) if (e) fn(e); return; }
  if (Array.isArray(events.list)) for (let i = 0; i < events.n; i++) if (events.list[i]) fn(events.list[i]);
}

// Critically damped smoothing of a vector toward a target (Lowe, GPG4), in place. v is the velocity it keeps.
function smoothDamp(cur, target, v, smoothT, dt) {
  const omega = 2 / Math.max(1e-4, smoothT), x = omega * dt;
  const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (let i = 0; i < 3; i++) {
    const change = cur[i] - target[i];
    const temp = (v[i] + omega * change) * dt;
    v[i] = (v[i] - omega * temp) * k;
    cur[i] = target[i] + (change + temp) * k;
  }
}

/**
 * createChase(camTune = TUNE.CAM, layoutKind = 'desktop', opts) → chase.
 * opts: { ship: TUNE.SHIP, fx: TUNE.FX, reduced: false }.
 * update(cam, ship, frameU, dt, events, interest) → { pos, quat, fov, fovSet, up, fwd }. cam is the zone's
 * THREE.PerspectiveCamera (written when given; its aspect sets the vertical FOV); ship is game.ship or shipPose();
 * frameU the plane's up; dt real seconds; events this frame's core events; interest null or { pos } (or [x, y, z]),
 * the objective the aim leans toward. setKind(kind) on a turn of the phone; reset(ship) snaps (teleports, arrivals);
 * setBodies([{ pos, r }]) lets the camera move in when a body would block the view; setWells([{ pos, cut }]) frames a
 * well's core while you drift inside its sling ring.
 */
export function createChase(camTune = TUNE.CAM, layoutKind = 'desktop', opts = {}) {
  const C = camTune || TUNE.CAM;
  const SHIP = opts.ship || TUNE.SHIP, FX = opts.fx || TUNE.FX;
  let reduced = !!opts.reduced;
  let kind = C[layoutKind] ? layoutKind : 'desktop';
  let K = C[kind];
  const st = {
    init: false, heading: 0, rel: [0, -6, 1.6], relV: [0, 0, 0], last: [0, 0, 0], fov: K.FOV, boost: 0, dbKick: 0,
    dbHold: 0, punch: 0, lookIn: 0, lean: 0, lookBack: 0, block: 1, bodies: [], wells: [], aspect: 16 / 9, swing: 0,
    look: [0, 0, 0], pull: 1,
  };
  const N = [0, 1, 0], E = [1, 0, 0], F = [0, 1, 0], R = [1, 0, 0];
  const out = { pos: [0, 0, 0], quat: [0, 0, 0, 1], fov: 60, fovSet: K.FOV, up: [0, 0, 1], fwd: [0, 1, 0] };
  const vD = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3(), vUp = new THREE.Vector3();
  const vS = new THREE.Vector3(), vI = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const desired = [0, 0, 0];
  // The nearest well whose sling ring holds p: { pos, cut }.
  function wellNear(p) {
    let best = null, bd = Infinity;
    for (const w of st.wells) {
      const dd = Math.hypot(w.pos[0] - p[0], w.pos[1] - p[1], (w.pos[2] || 0) - p[2]);
      if (dd < w.cut && dd < bd) { bd = dd; best = w; }
    }
    return best;
  }

  const headingOfVec = (v) => Math.atan2(v[0] * E[0] + v[1] * E[1] + v[2] * E[2],
    v[0] * N[0] + v[1] * N[1] + v[2] * N[2]);

  // The view's vertical FOV for a designed FOV on this layout's axis.
  function vertical(fovSet) {
    if (kind === 'portrait') return fovSet;
    return 2 * Math.atan(Math.tan(fovSet * DEG / 2) / Math.max(0.2, st.aspect)) / DEG;
  }

  function targetHeading(ship) {
    const v = ship.vel || [0, 0, 0];
    const sp = Math.hypot(v[0], v[1], v[2]);
    const nose = ship.yaw || 0;
    if (sp < 2) return nose;
    const drifting = ship.drift && ship.drift.on;
    const mixV = drifting ? C.HEADING_VEL_DRIFT : C.HEADING_VEL;
    const hv = headingOfVec(v);
    return nose + wrap(hv - nose) * mixV;
  }

  function reset(ship) {
    st.init = false;
    if (ship) st.heading = targetHeading(ship);
  }

  function update(cam, ship, frameU = null, dt = 1 / 60, events = null, interest = null) {
    if (!ship || !ship.pos) return out;
    const U = frameU || ship.up || [0, 0, 1];
    if (cam && cam.isPerspectiveCamera) st.aspect = cam.aspect || st.aspect;
    basisFrom(U, 0, N, E);
    const d = clamp(dt, 0, 0.1);
    const p = ship.pos, v = ship.vel || [0, 0, 0];
    const speed = ship.speed ?? Math.hypot(v[0], v[1], v[2]);
    const jumped = Math.hypot(p[0] - st.last[0], p[1] - st.last[1], p[2] - st.last[2]) > 40;
    const snap = !st.init || jumped;
    if (snap) {
      st.init = true;
      st.heading = targetHeading(ship);
      st.relV[0] = st.relV[1] = st.relV[2] = 0;
      st.boost = ship.boosting ? 1 : 0;
      st.fov = K.FOV;
      st.lookIn = 0;
      st.lean = 0;
      st.pull = 1;
    }
    st.last[0] = p[0]; st.last[1] = p[1]; st.last[2] = p[2];

    // Events: drift-boost and punch kicks.
    eachEvent(events, (e) => {
      if (e.type === 'driftBoost') {
        const tier = clamp((e.tier || ship.db?.tier || 1) | 0, 1, 3);
        st.dbKick = Math.max(st.dbKick, C.DB_KICK[tier - 1]);
        st.dbHold = Math.max(st.dbHold, TUNE.DRIFT.DB_DUR[tier - 1]);
      } else if (e.type === 'punch') st.punch = 1;
    });

    // Heading: smoothed, at most YAW_MAX.
    const ht = targetHeading(ship);
    const dh = clamp(wrap(ht - st.heading) * ease(d, C.ROT_TC), -C.YAW_MAX * d, C.YAW_MAX * d);
    st.heading = wrap(st.heading + dh);
    st.boost += ((ship.boosting ? 1 : 0) - st.boost) * ease(d, ship.boosting ? C.KICK_IN : C.KICK_OUT);
    const lbT = ship.lookBack ? 1 : 0;
    st.lookBack += (lbT - st.lookBack) * ease(d, C.LOOK_BACK_T / 2);
    // A drift inside a well's sling ring swings the camera toward the outside of the turn, just far enough that the
    // well's core and the ship fit on the screen together (a portrait view is only about 50° across).
    const drift = ship.drift && ship.drift.on ? ship.drift.dir || 0 : 0;
    const hHalf = Math.atan(Math.tan(vertical(st.fov) * DEG / 2) * st.aspect);
    const well = drift ? wellNear(p) : null;
    let swingT = 0, pullT = 1;
    if (well) {
      basisFrom(U, st.heading, F, R);
      const rx = well.pos[0] - p[0], ry = well.pos[1] - p[1], rz = (well.pos[2] || 0) - p[2];
      const fwd = rx * F[0] + ry * F[1] + rz * F[2], lat = (rx * R[0] + ry * R[1] + rz * R[2]) * drift;
      if (lat > 0 && fwd > -1.5 * K.DIST) {               // not once the well is well behind you
        const D = K.DIST, usable = 2 * hHalf - (2 * EDGE_MARGIN + SHIP_MARGIN) * DEG;
        const sep = (b, dd = D) => Math.atan2(lat + dd * Math.sin(b), fwd + dd * Math.cos(b)) - b;
        if (sep(0) > usable) {
          let lo = 0, hi = SWING_MAX * DEG;
          for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (sep(m) > usable) lo = m; else hi = m; }
          swingT = hi;
          // Still too wide at the full swing (a pass close to the core): pull the camera back until both fit.
          const b = SWING_MAX * DEG;
          if (sep(b) > usable) {
            let a = 1, z = PULL_MAX;
            for (let i = 0; i < 12; i++) { const m = (a + z) / 2; if (sep(b, D * m) > usable) a = m; else z = m; }
            pullT = z;
          }
        }
      }
    }
    st.swing += (swingT - st.swing) * ease(d, C.DRIFT_LOOK_T * (swingT > st.swing ? 0.6 : 1.5));
    st.pull += (pullT - st.pull) * ease(d, C.DRIFT_LOOK_T * (pullT > st.pull ? 0.6 : 2));
    if (st.swingDir === undefined || drift) st.swingDir = drift || st.swingDir || 1;
    const h = st.heading + Math.PI * st.lookBack + st.swingDir * st.swing;
    basisFrom(U, h, F, R);

    // Position: an offset behind and above, sprung in the ship's frame so speed adds no lag.
    const dist = K.DIST * (1 + (C.BOOST_DIST_X - 1) * st.boost) * st.block * st.pull;
    desired[0] = -F[0] * dist + U[0] * K.HEIGHT;
    desired[1] = -F[1] * dist + U[1] * K.HEIGHT;
    desired[2] = -F[2] * dist + U[2] * K.HEIGHT;
    if (snap) {
      st.rel[0] = desired[0]; st.rel[1] = desired[1]; st.rel[2] = desired[2];
    } else if (d > 0) {
      smoothDamp(st.rel, desired, st.relV, C.SPRING + (C.SPRING_BOOST - C.SPRING) * st.boost, d);
    }
    // A body between the ship and the camera: move in and up.
    let blocked = false;
    for (const b of st.bodies) {
      const cx = p[0] + st.rel[0] * 0.5 - b.pos[0], cy = p[1] + st.rel[1] * 0.5 - b.pos[1],
        cz = p[2] + st.rel[2] * 0.5 - b.pos[2];
      if (cx * cx + cy * cy + cz * cz < (b.r + dist * 0.5) ** 2) {
        // The segment's closest point to the body centre.
        const L2 = st.rel[0] ** 2 + st.rel[1] ** 2 + st.rel[2] ** 2 || 1;
        const t = clamp(((b.pos[0] - p[0]) * st.rel[0] + (b.pos[1] - p[1]) * st.rel[1] + (b.pos[2] - p[2]) * st.rel[2])
          / L2, 0, 1);
        const qx = p[0] + st.rel[0] * t - b.pos[0], qy = p[1] + st.rel[1] * t - b.pos[1],
          qz = p[2] + st.rel[2] * t - b.pos[2];
        if (qx * qx + qy * qy + qz * qz < b.r * b.r) { blocked = true; break; }
      }
    }
    st.block += ((blocked ? C.OBSTACLE_IN : 1) - st.block) * ease(d, 0.25);
    const cp = out.pos;
    cp[0] = p[0] + st.rel[0]; cp[1] = p[1] + st.rel[1]; cp[2] = p[2] + st.rel[2];

    // Aim: the look-ahead point, then the drift look-in, the interest lean and half the ship's pitch.
    // The look-ahead lies in the plane (a bounce off a surface must not tip the view) and turns smoothly.
    const vu = v[0] * U[0] + v[1] * U[1] + v[2] * U[2];
    let lx = (v[0] - U[0] * vu) * C.LOOK_AHEAD, ly = (v[1] - U[1] * vu) * C.LOOK_AHEAD,
      lz = (v[2] - U[2] * vu) * C.LOOK_AHEAD;
    const ll = Math.hypot(lx, ly, lz);
    if (ll > C.LOOK_MAX) { const s = C.LOOK_MAX / ll; lx *= s; ly *= s; lz *= s; }
    if (snap) { st.look[0] = lx; st.look[1] = ly; st.look[2] = lz; }
    const kl = ease(d, C.ROT_TC);
    st.look[0] += (lx - st.look[0]) * kl; st.look[1] += (ly - st.look[1]) * kl; st.look[2] += (lz - st.look[2]) * kl;
    lx = st.look[0]; ly = st.look[1]; lz = st.look[2];
    if (st.lookBack > 0.01) {
      const L = Math.max(ll, 4);
      lx = lx * (1 - st.lookBack) + F[0] * L * st.lookBack;
      ly = ly * (1 - st.lookBack) + F[1] * L * st.lookBack;
      lz = lz * (1 - st.lookBack) + F[2] * L * st.lookBack;
    }
    vD.set(p[0] + lx - cp[0], p[1] + ly - cp[1], p[2] + lz - cp[2]).normalize();
    vU.set(U[0], U[1], U[2]);
    // Drift look-in: toward the inside of the drift; inside a well's sling ring, toward the well, far enough that
    // its core comes onto the screen while the ship stays on it (final.md 6.8, CAM.DRIFT_LOOK_IN).
    let look = drift * K.DRIFT_LOOK_IN * DEG, floor = 0;
    if (drift) {
      const w = well;
      if (w) {
        // The well's angle from the view, clockwise positive (the same sense as the drift's dir).
        vI.set(w.pos[0] - cp[0], w.pos[1] - cp[1], (w.pos[2] || 0) - cp[2]);
        vR.crossVectors(vD, vU).normalize();
        const ang = Math.atan2(vI.dot(vR), vI.dot(vD));
        if (Math.sign(ang) === Math.sign(drift)) {
          // Angles toward the inside of the turn: the well must come within EDGE_MARGIN of that side, and the ship
          // (where the aim leaves it) must stay SHIP_MARGIN inside the other side.
          vS.set(p[0] - cp[0], p[1] - cp[1], p[2] - cp[2]);
          const shipIn = Math.atan2(vS.dot(vR), vS.dot(vD)) * drift;
          const need = Math.abs(ang) - (hHalf - EDGE_MARGIN * DEG);
          const most = Math.max(shipIn, 0) + hHalf - SHIP_MARGIN * DEG;
          look = drift * clamp(Math.max(K.DRIFT_LOOK_IN * DEG, need), 0, Math.max(0, most));
          floor = clamp(need, 0, Math.max(0, most));
        }
      }
    }
    st.lookIn += (look - st.lookIn) * ease(d, C.DRIFT_LOOK_T);
    // A close pass swings the core across the view faster than the ease follows: never let it leave the screen,
    // turning at most LOOK_RATE to catch it (a hard floor would whip on the first frame of a drift).
    if (floor > 0 && st.lookIn * drift < floor) {
      st.lookIn = drift * Math.min(floor, Math.abs(st.lookIn) + LOOK_RATE * d);
    }
    if (Math.abs(st.lookIn) > 1e-5) vD.applyAxisAngle(vU, -st.lookIn);
    let leanT = 0;
    const ip = interest ? (Array.isArray(interest) ? interest : interest.pos) : null;
    if (ip) {
      vI.set(ip[0] - cp[0], ip[1] - cp[1], ip[2] - cp[2]);
      const di = vI.length();
      if (di > 1 && di < C.INTEREST_RANGE && vI.normalize().dot(vD) > Math.cos(C.INTEREST_CONE * DEG)) leanT = 1;
    }
    st.lean += (leanT - st.lean) * ease(d, 0.5);
    if (st.lean > 1e-3 && ip) vD.lerp(vI, C.INTEREST_LEAN * st.lean).normalize();
    vR.crossVectors(vD, vU);
    if (vR.lengthSq() < 1e-8) vR.set(R[0], R[1], R[2]);
    vR.normalize();
    vD.applyAxisAngle(vR, (ship.pitch || 0) * C.PITCH_FOLLOW);

    // FOV: the base, a little more with speed, and the kicks (boost, drift-boost, punch); rate limited.
    const fTop = clamp((speed - SHIP.S_CRUISE) / Math.max(1, SHIP.S_TOP - SHIP.S_CRUISE), 0, 1);
    const db = ship.db && ship.db.t > 0 ? C.DB_KICK[clamp((ship.db.tier || 1) - 1, 0, 2)] : 0;
    st.dbHold = Math.max(0, st.dbHold - d);
    const dbT = Math.max(db, st.dbHold > 0 ? st.dbKick : 0);
    if (dbT < st.dbKick) st.dbKick = Math.max(dbT, st.dbKick - d * st.dbKick / C.KICK_OUT);
    else st.dbKick = dbT;
    st.punch = Math.max(0, st.punch - d / 0.35);
    let kick = K.FOV_KICK * st.boost + st.dbKick + TUNE.JUMP.PUNCH_FOV * Math.min(1, st.punch * 1.6);
    if (reduced) kick = Math.min(kick, FX.REDUCED_KICK);
    const target = Math.min(K.FOV_MAX, K.FOV + K.FOV_TOP * fTop + kick);
    const step = C.FOV_RATE * d * (st.punch > 0 ? 4 : 1);
    st.fov += clamp(target - st.fov, -step, step);
    const vf = vertical(st.fov);

    // Put the ship at its screen height (pitch about the view's right axis), and however fast the turn, keep it
    // SHIP_MARGIN inside the screen's sides (yaw about U). Twice, as each nudges the other a little.
    const want = Math.atan((1 - 2 * K.SHIP_Y) * Math.tan(vf * DEG / 2));
    const keepX = Math.tan(hHalf - SHIP_MARGIN * DEG) / Math.tan(hHalf);
    vS.set(p[0] - cp[0], p[1] - cp[1], p[2] - cp[2]);
    for (let k = 0; k < 2; k++) {
      vUp.crossVectors(vR, vD).normalize();
      const e = Math.atan2(vS.dot(vUp), vS.dot(vD));
      vD.applyAxisAngle(vR, e - want);
      vUp.crossVectors(vR, vD).normalize();
      // The ship's place across the screen, −1 to 1.
      const ax = Math.atan2(vS.dot(vR), vS.dot(vD));          // the ship's angle across, behind the camera too
      const keepA = Math.atan(keepX * Math.tan(hHalf));
      if (Math.abs(ax) <= keepA) break;
      const turn = ax - Math.sign(ax) * keepA;
      vD.applyAxisAngle(vU, -turn);
      vR.crossVectors(vD, vU).normalize();
    }
    vUp.crossVectors(vR, vD).normalize();

    m4.makeBasis(vR, vUp, vS.copy(vD).negate());
    q.setFromRotationMatrix(m4);
    out.quat[0] = q.x; out.quat[1] = q.y; out.quat[2] = q.z; out.quat[3] = q.w;
    out.fov = vf;
    out.fovSet = st.fov;
    out.up[0] = vUp.x; out.up[1] = vUp.y; out.up[2] = vUp.z;
    out.fwd[0] = vD.x; out.fwd[1] = vD.y; out.fwd[2] = vD.z;
    out.boost = st.boost;
    if (cam && cam.isPerspectiveCamera) {
      cam.position.set(cp[0], cp[1], cp[2]);
      cam.quaternion.copy(q);
      if (Math.abs(cam.fov - vf) > 1e-4) { cam.fov = vf; cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld();
    }
    return out;
  }

  return {
    update, reset,
    setKind(k) { if (C[k]) { kind = k; K = C[k]; } },
    setBodies(list) { st.bodies = Array.isArray(list) ? list : []; },
    // Wells ([{ pos, cut }], cut = the sling ring's radius): a drift inside one frames its core.
    setWells(list) { st.wells = Array.isArray(list) ? list : []; },
    setReduced(v) { reduced = !!v; },
    get kind() { return kind; },
    get state() {
      return { heading: st.heading, fov: st.fov, boost: st.boost, lookIn: st.lookIn, lean: st.lean, swing: st.swing };
    },
  };
}
