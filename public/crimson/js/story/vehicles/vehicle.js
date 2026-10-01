// js/story/vehicles/vehicle.js : one vehicle's state and physics (design 4.1).
// - Fixed 1/120 s substeps driven by the story's rdt (never the combat dt): vehicles.js calls step(h).
// - A bicycle model: yaw rate = v * tan(steer) / wheelbase, capped by the front grip; the rear grip eats the
//   sideways speed, so over the limit (or on the handbrake, rear grip x0.35) the vehicle slides.
// - Four wheel probes on S.world.surface (bridge aware) give the ride height, the slope (gravity along it),
//   and pitch and roll; springs (k 30, d 6) add a little body motion for the eye. With all four wheels more
//   than 0.3 m under it the vehicle is airborne and falls at 18 m/s^2.
// - Collisions: the footprint box against S.world.colliders (boxes by SAT, segments as thin boxes, circles by
//   closest point), cliffs (steep terrain) and the world edge. Restitution 0.15, tangent friction 0.8,
//   damage += max(0, |v.n| - 3) * 2.2. Vehicle against vehicle (collidePair) trades mass impulses, spins
//   a car hit in the rear quarter (PIT) and applies the protected-vehicle rules.
import * as THREE from 'three';
import { specOf, PATROL_TUNE, G, AIR_G, DAMAGE, CONTACT, OFFROAD, steerMax } from './specs.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const tmpN = new THREE.Vector3();

export function createVehicle(S, id, kind, o, view) {
  const sp = o.patrol ? { ...specOf(kind), ...PATROL_TUNE } : specOf(kind), half = { w: sp.size.w / 2, l: sp.size.l / 2 };
  const own = new Map();
  const v = {
    id, kind, spec: sp, view, obj: view ? view.obj : null,
    pos: new THREE.Vector3(), yaw: 0, vel: new THREE.Vector3(), yawRate: 0, steerAngle: 0,
    damage: 0, wrecked: false, protect: !!o.protect, bumpLimit: o.bumpLimit ?? 3, maxSpeed: o.maxSpeed ?? CONTACT.maxSpeed,
    maxContact: o.maxContact ?? null, bumps: 0, gang: o.gang ?? sp.gang, tint: o.tint ?? null,
    controls: { throttle: 0, brake: 0, steer: 0, handbrake: false },
    seats: new Array(sp.seats).fill(null), lights: false, siren: false, look: { ...(o.look || {}) },
    hw: half.w, hd: half.l, h: sp.size.h, mass: sp.mass, inertia: sp.mass * (sp.size.w ** 2 + sp.size.l ** 2) / 12,
    airborne: false, grounded: true, surface: 'asphalt', slip: 0, water: 0, drowned: false,
    kinematic: false, traffic: !!o.traffic, mission: !o.traffic, controller: null, rolling: false, enterable: !!(o.player || o.enterable),
    wheelsY: [0, 0, 0, 0], wheelsRaw: [0, 0, 0, 0], hanging: 0, vy: 0, spin: 0, spinT: 0, contactT: 0,
    susp: { pitch: 0, roll: 0, lift: 0, vp: 0, vr: 0, vl: 0, slopeP: 0, slopeR: 0 },
    stage: 0, fxT: 0, hornT: 0, lastHit: new Map(), accel: 0, latAcc: 0,
    get speed() { return v.vel.x * Math.sin(v.yaw) + v.vel.z * Math.cos(v.yaw); },
    set speed(s) { v.vel.x = Math.sin(v.yaw) * s; v.vel.z = Math.cos(v.yaw) * s; },
    horn() {
      if (S.time - v.hornT < 0.35) return;
      v.hornT = S.time;
      if (S.audio) S.audio.sfx('horn', { at: v.pos });
      v.emit('horn', {});
    },
    // x, z, yaw; y: a height hint (a place under a deck passes its own y)
    setPose(x, z, yaw = v.yaw, y) {
      v.pos.x = x; v.pos.z = z; v.yaw = yaw;
      probe(Number.isFinite(y) ? y : null);
      v.pos.y = restY();
      v.vel.set(0, 0, 0); v.yawRate = 0; v.vy = 0; v.airborne = false; v.grounded = true; v.spinT = 0; v.steerAngle = 0; v.slip = 0;
      Object.assign(v.susp, { pitch: 0, roll: 0, lift: 0, vp: 0, vr: 0, vl: 0 });
      slope();
      if (v.onPose) v.onPose();
    },
    // where someone stands to use a door: 'driver' | 'passenger' | 'slide' | 'rear'
    doorPoint(side = 'driver') {
      const d = doorInfo(side), p = toWorld(d.at[0], d.at[1]);
      return new THREE.Vector3(p[0], S.world.surface(p[0], p[1], v.pos.y + 1.5), p[1]);
    },
    setLook(lk = {}) { Object.assign(v.look, lk); if (view) view.setLook(v.look); },
    on(evt, fn) { if (!own.has(evt)) own.set(evt, []); own.get(evt).push(fn); return () => { const a = own.get(evt), i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; },
    emit(evt, d = {}) { for (const f of (own.get(evt) || []).slice()) f(d); if (v.hooks) v.hooks(evt, { v, ...d }); },
    toWorld, toLocal, footprint,
  };
  const doorInfo = (side) => {
    const doors = view ? view.info.doors : null;
    const name = side === 'rear' ? 'rearL' : side;
    if (doors && doors[name]) return doors[name];
    const s = side === 'passenger' || side === 'slide' ? -1 : 1, z = side === 'rear' ? -half.l - 0.9 : side === 'slide' ? -0.4 : half.l * 0.3;
    return { at: [side === 'rear' ? 0 : s * (half.w + 0.8), z] };
  };
  // local (x left, z forward) to world and back
  function toWorld(lx, lz) { const c = Math.cos(v.yaw), s = Math.sin(v.yaw); return [v.pos.x + lx * c + lz * s, v.pos.z - lx * s + lz * c]; }
  function toLocal(x, z) { const c = Math.cos(v.yaw), s = Math.sin(v.yaw), dx = x - v.pos.x, dz = z - v.pos.z; return [dx * c - dz * s, dx * s + dz * c]; }
  function footprint(pad = 0) { return { x: v.pos.x, z: v.pos.z, hw: half.w + pad, hd: half.l + pad, c: Math.cos(v.yaw), s: Math.sin(v.yaw) }; }
  // the ground under the four wheels (bridge aware: a deck counts only at or below the ride height + 1.8)
  const WH = [[sp.track / 2, sp.wheelbase / 2], [-sp.track / 2, sp.wheelbase / 2], [sp.track / 2, -sp.wheelbase / 2], [-sp.track / 2, -sp.wheelbase / 2]];
  // A wheel more than 0.8 m below the highest one hangs over an edge: it carries nothing, and it counts at
  // 0.8 m down for the tilt (v.hanging lists them for the tipping rule).
  function probe(hint) {
    const yRef = hint != null ? hint : null, W = v.wheelsY, raw = v.wheelsRaw;
    for (let i = 0; i < 4; i++) {
      const [x, z] = toWorld(WH[i][0], WH[i][1]);
      raw[i] = yRef == null ? S.world.surface(x, z) : S.world.surface(x, z, yRef + 1.0);
    }
    // wheels 0 fl, 1 fr, 2 rl, 3 rr: a wheel hangs when it is 0.8 m under its axle partner (i ^ 1) or 1.6 m
    // under the wheel on its side (i ^ 2); a steady slope does neither
    v.hanging = 0;
    for (let i = 0; i < 4; i++) {
      const lim = Math.max(raw[i ^ 1] - 0.8, raw[i ^ 2] - 1.6);
      if (raw[i] < lim) { W[i] = lim; v.hanging |= 1 << i; } else W[i] = raw[i];
    }
    if (v.hanging === 15) { v.hanging = 0; for (let i = 0; i < 4; i++) W[i] = raw[i]; }
  }
  function slope() {
    const [fl, fr, rl, rr] = v.wheelsY;
    v.susp.slopeP = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, sp.wheelbase);
    v.susp.slopeR = Math.atan2((fl + rl) / 2 - (fr + rr) / 2, sp.track);
  }
  // the height the vehicle rests at: the mean of the wheels that touch
  function restY() { let s = 0, n = 0; for (let i = 0; i < 4; i++) if (!(v.hanging & (1 << i))) { s += v.wheelsRaw[i]; n++; } return n ? s / n : v.wheelsRaw[0]; }
  v.probe = probe; v.slope = slope; v.restY = restY;
  const at = o.place ? S.world.place(o.place) : o.pos || { x: 0, z: 0 };
  v.setPose(at.x, at.z, o.yaw ?? at.yaw ?? 0, at.y);
  if (view) view.setLook(v.look);
  return v;
}

/* ------------------------------------------------------------------ one substep */
export function stepVehicle(S, v, h) {
  const sp = v.spec, c = v.controls, W = S.world;
  const f = [Math.sin(v.yaw), Math.cos(v.yaw)], r = [-Math.cos(v.yaw), Math.sin(v.yaw)]; // forward, right
  let vf = v.vel.x * f[0] + v.vel.z * f[1], vl = v.vel.x * r[0] + v.vel.z * r[1];
  const dead = v.wrecked || v.drowned;
  const throttle = dead ? 0 : clamp(c.throttle || 0, 0, 1), brake = clamp(c.brake || 0, 0, 1), steer = dead ? 0 : clamp(c.steer || 0, -1, 1), hb = !!c.handbrake;
  const canReverse = c.reverse === true && !!v.driven && !hb && !dead;
  // the surface under the middle of the vehicle
  const st = W.surfaceType(v.pos.x, v.pos.z);
  v.surface = st;
  const wet = W.water(v.pos.x, v.pos.z), depth = wet ? Math.max(0, wet.y - v.pos.y) : 0;
  v.water = depth;
  let grip = sp.grip[st] ?? sp.grip.scrub;
  let top = OFFROAD[st] ? sp.offTop : st === 'dirt' ? sp.dirtTop : sp.top;
  if (v.damage >= DAMAGE.smoke) top *= 1 - DAMAGE.topLoss;
  if (depth > 0.35) { grip *= 0.6; top = Math.min(top, 6); }
  if (depth > 1.15 && !v.drowned) { v.drowned = true; v.emit('drowned', {}); }
  const onGround = !v.airborne;
  // steering: the wheels turn toward the input at steerRate; the widest angle narrows with speed
  const want = -steer * steerMax(sp, vf);
  const ds = want - v.steerAngle, rate = sp.steerRate * h;
  v.steerAngle += clamp(ds, -rate, rate);
  // along the vehicle
  let a = 0;
  if (onGround) {
    if (throttle > 0) {
      if (vf < -0.3) a += throttle * sp.brake * 0.8; // braking out of reverse
      else a += throttle * sp.accel * clamp((top - vf) / 4, 0, 1) * (depth > 0.6 ? 0.4 : 1); // drag sets the top speed; the engine fades out just under it
    }
    // the brake pedal: brakes; at a standstill it reverses, but only for a driver who asked (controls.reverse:
    // the player's brake, an AI backing out); otherwise it holds
    if (brake > 0) {
      if (vf > 0.3) a -= brake * sp.brake;
      else if (throttle === 0 && canReverse && vf > -sp.reverse) a -= brake * sp.accel * 0.8;
      else if (vf < -0.3 && !canReverse) a += brake * sp.brake;
    }
    if (hb && Math.abs(vf) > 0.3) a -= Math.sign(vf) * 5;
    a -= sp.drag * vf * Math.abs(vf) + Math.sign(vf) * (sp.roll + (OFFROAD[st] ? 0.25 : 0) + depth * 1.5);
    // slope: gravity along the ground
    a -= G * Math.sin(v.susp.slopeP);
    // off the top speed (off road, damage) the engine gives nothing and drag pulls down gently
    if (vf > top) a = Math.min(a, -(vf - top) * 0.8);
  } else a -= sp.drag * vf * Math.abs(vf);
  const before = vf;
  vf += a * h;
  // braking never reverses by itself
  if (brake > 0 && before > 0.3 && vf < 0) vf = 0;
  if (brake > 0 && before < -0.3 && vf > 0 && !canReverse) vf = 0;
  if (hb && Math.sign(vf) !== Math.sign(before) && Math.abs(before) > 0.3) vf = 0;
  if (throttle === 0 && Math.sign(before) !== Math.sign(vf) && Math.abs(before) > 0.02 && brake === 0) vf = 0; // coasting stops at 0
  // holding still: nobody on the gas and slower than walking pace, and not reversing (parked cars hold on
  // any slope; a van with no parking brake set rolls: v.rolling)
  const hold = onGround && throttle === 0 && Math.abs(vf) < 0.35 && !v.rolling && !(brake > 0 && canReverse);
  if (hold) { vf = 0; vl *= 0.5; }
  // yaw: the bicycle model, capped by the front grip (understeer); the handbrake lets the rear step out
  let rWant = onGround ? vf * Math.tan(v.steerAngle) / sp.wheelbase : v.yawRate;
  const cap = (grip * 1.08) / Math.max(1.5, Math.abs(vf));
  if (!hb) rWant = clamp(rWant, -cap, cap); else rWant *= 1.35;
  const sliding = Math.abs(vl) > 2.2;
  if (v.spinT > 0) v.spinT -= h;
  const kr = !onGround ? 0 : v.spinT > 0 ? 1.1 : sliding || hb ? 3 : 11;
  v.yawRate += (rWant - v.yawRate) * Math.min(1, kr * h);
  if (hold && !sliding) v.yawRate = 0;
  v.yaw += v.yawRate * h;
  // sideways: the rear grip removes the sideways speed; over the limit the vehicle slides
  if (onGround) {
    const gr = grip * (hb ? 0.35 : 1) * (v.spinT > 0 ? 0.45 : 1);
    const cut = Math.min(Math.abs(vl), gr * h);
    vl -= Math.sign(vl) * cut;
    // slope pulls sideways too (the grip mostly holds it)
    vl -= G * Math.sin(v.susp.slopeR) * h * (hold ? 0 : 1);
  }
  v.slip = Math.abs(vl);
  // back to world velocity with the new heading
  const nf = [Math.sin(v.yaw), Math.cos(v.yaw)], nr = [-Math.cos(v.yaw), Math.sin(v.yaw)];
  v.vel.x = nf[0] * vf + nr[0] * vl; v.vel.z = nf[1] * vf + nr[1] * vl;
  v.accel = a; v.latAcc = vf * v.yawRate;
  // move
  const px = v.pos.x, pz = v.pos.z, py = v.pos.y;
  v.pos.x += v.vel.x * h; v.pos.z += v.vel.z * h;
  // the ground
  v.probe(py);
  const wy = v.wheelsY;
  // cliffs: a wheel whose ground jumps up more than a curb is against a rock wall
  let cliff = null;
  for (let i = 0; i < 4; i++) {
    const rise = wy[i] - py;
    if (rise > 0.1 && (i < 2 ? vf > 0 : vf < 0)) {
      const [x, z] = v.toWorld(i % 2 === 0 ? sp.track / 2 : -sp.track / 2, i < 2 ? sp.wheelbase / 2 : -sp.wheelbase / 2);
      const n = W.normal(x, z, tmpN);
      // a step up of more than a curb, or ground steeper than about 52 degrees, is a wall
      if ((rise > 0.55 && n.y < 0.8) || n.y < 0.6) { const l = Math.hypot(n.x, n.z) || 1; cliff = { nx: n.x / l, nz: n.z / l, x, z }; break; }
    }
  }
  if (cliff) {
    v.pos.x = px; v.pos.z = pz; v.probe(py);
    impactWorld(S, v, cliff.nx, cliff.nz, cliff.x, cliff.z, null);
  }
  // the ride height rests on the wheels that touch; hanging wheels tip the vehicle off the edge
  const g2 = v.wheelsRaw, top2 = Math.max(g2[0], g2[1], g2[2], g2[3]);
  let sum = 0, n = 0, hx = 0, hz = 0;
  for (let i = 0; i < 4; i++) {
    if (v.hanging & (1 << i)) { hx += i % 2 === 0 ? 1 : -1; hz += i < 2 ? 1 : -1; } else { sum += g2[i]; n++; }
  }
  const mean = sum / n;
  if (v.hanging && !v.airborne) {
    const l = Math.hypot(hx, hz) || 1, [wx, wz] = [(hx / l) * Math.cos(v.yaw) + (hz / l) * Math.sin(v.yaw), -(hx / l) * Math.sin(v.yaw) + (hz / l) * Math.cos(v.yaw)];
    v.vel.x += wx * G * 0.6 * h; v.vel.z += wz * G * 0.6 * h;
  }
  // vertical: follow the ground; leave it when it falls away faster than gravity
  const free = py + v.vy * h - 0.5 * AIR_G * h * h;
  if (free <= mean || (!v.airborne && free - mean < 0.02)) {
    if (v.airborne && v.vy < -DAMAGE.landMs) { const k = (-v.vy - DAMAGE.landMs) * 1.5; addDamage(S, v, k); v.emit('land', { speed: -v.vy }); }
    else if (v.airborne) v.emit('land', { speed: -v.vy });
    v.vy = clamp((mean - py) / h, -8, 6);
    v.pos.y = mean; v.airborne = false;
  } else {
    v.vy -= AIR_G * h;
    v.pos.y = free;
    v.airborne = free > top2 + 0.3;
  }
  v.grounded = !v.airborne;
  v.slope();
  // the world edge
  const E = S.world.HALF - 4;
  if (Math.abs(v.pos.x) > E) impactWorld(S, v, -Math.sign(v.pos.x), 0, v.pos.x, v.pos.z, null, Math.abs(v.pos.x) - E);
  if (Math.abs(v.pos.z) > E) impactWorld(S, v, 0, -Math.sign(v.pos.z), v.pos.x, v.pos.z, null, Math.abs(v.pos.z) - E);
  collideWorld(S, v);
  // the wheels spin with the ground speed
  const vf2 = v.vel.x * Math.sin(v.yaw) + v.vel.z * Math.cos(v.yaw);
  v.spin += vf2 * h / sp.wheelR;
  if (!Number.isFinite(v.pos.x + v.pos.y + v.pos.z + v.vel.x + v.vel.z + v.yaw)) recover(S, v, px, py, pz);
}
function recover(S, v, x, y, z) {
  console.warn(`[vehicles] ${v.id} went non-finite; put back`);
  v.pos.set(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0, Number.isFinite(z) ? z : 0);
  v.vel.set(0, 0, 0); v.vy = 0; v.yawRate = 0; if (!Number.isFinite(v.yaw)) v.yaw = 0;
}

/* ------------------------------------------------------------------ the springs, for the eye */
export function stepSuspension(v, dt) {
  const s = v.susp, k = 30, d = 6;
  // body pitch from acceleration (the nose dips when braking and lifts on the gas; a positive x turn dips
  // it), roll from cornering (the body leans out of the turn: a left turn lifts the left side, +z), a
  // little lift in the air
  const wantP = clamp(-v.accel * 0.012, -0.06, 0.06), wantR = clamp(v.latAcc * 0.01, -0.07, 0.07), wantL = v.airborne ? 0.06 : 0;
  s.vp += (k * (wantP - s.pitch) - d * s.vp) * dt; s.pitch += s.vp * dt;
  s.vr += (k * (wantR - s.roll) - d * s.vr) * dt; s.roll += s.vr * dt;
  s.vl += (k * (wantL - s.lift) - d * s.vl) * dt; s.lift += s.vl * dt;
  s.pitch = clamp(s.pitch, -0.1, 0.1); s.roll = clamp(s.roll, -0.1, 0.1); s.lift = clamp(s.lift, -0.15, 0.15);
}

/* ------------------------------------------------------------------ damage */
export function addDamage(S, v, k) {
  if (v.wrecked || k <= 0) return;
  v.damage = Math.min(DAMAGE.wreck, v.damage + k);
  if (v.damage >= DAMAGE.wreck) { v.wrecked = true; v.controls.throttle = 0; v.emit('wrecked', {}); }
}

/* ------------------------------------------------------------------ collisions with the world */
// SAT between two boxes {x, z, hw, hd, c, s} (axes: local x = (c, -s), local z = (s, c)). Returns the
// overlap along the least axis with the normal pointing from B to A, or null.
function sat(A, B) {
  const ax = [[A.c, -A.s], [A.s, A.c], [B.c, -B.s], [B.s, B.c]], dx = A.x - B.x, dz = A.z - B.z;
  let best = Infinity, n = null;
  for (const a of ax) {
    const rA = A.hw * Math.abs(A.c * a[0] - A.s * a[1]) + A.hd * Math.abs(A.s * a[0] + A.c * a[1]);
    const rB = B.hw * Math.abs(B.c * a[0] - B.s * a[1]) + B.hd * Math.abs(B.s * a[0] + B.c * a[1]);
    const d = dx * a[0] + dz * a[1], ov = rA + rB - Math.abs(d);
    if (ov <= 0) return null;
    if (ov < best) { best = ov; n = d >= 0 ? [a[0], a[1]] : [-a[0], -a[1]]; }
  }
  return { nx: n[0], nz: n[1], depth: best };
}
const corners = (B) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => [B.x + u * B.hw * B.c + w * B.hd * B.s, B.z - u * B.hw * B.s + w * B.hd * B.c]);
const inside = (B, x, z, pad = 0.02) => { const dx = x - B.x, dz = z - B.z, lx = dx * B.c - dz * B.s, lz = dx * B.s + dz * B.c; return Math.abs(lx) <= B.hw + pad && Math.abs(lz) <= B.hd + pad; };
// the contact point of two overlapping boxes: the mean of the corners inside the other box
function contactPoint(A, B, n) {
  let x = 0, z = 0, k = 0;
  for (const [cx, cz] of corners(A)) if (inside(B, cx, cz)) { x += cx; z += cz; k++; }
  for (const [cx, cz] of corners(B)) if (inside(A, cx, cz)) { x += cx; z += cz; k++; }
  if (k) return [x / k, z / k];
  // edge against edge: the point of A furthest along -n
  let best = null, bd = Infinity;
  for (const [cx, cz] of corners(A)) { const d = cx * n.nx + cz * n.nz; if (d < bd) { bd = d; best = [cx, cz]; } }
  return best;
}
export { sat, contactPoint, corners };

function penetration(v, it, A) {
  const y0 = v.pos.y + 0.3, y1 = v.pos.y + v.h;
  if (!(y1 > it.y0 && y0 < it.y1)) return null;
  if (it.kind === 'box') {
    // a floor the vehicle drives onto: within 0.5 m of its top. A bridge deck within 1 m: the middle of the
    // vehicle is still down the approach grade when its nose reaches the deck (FR 9's bridge, westbound)
    if (it.walk && v.pos.y >= it.top - (it.tag && it.tag.startsWith('deck:') ? 1 : 0.5)) return null;
    const B = { x: it.x, z: it.z, hw: it.hw, hd: it.hd, c: it.c, s: it.s }, r = sat(A, B);
    if (!r) return null;
    const p = contactPoint(A, B, r); r.x = p[0]; r.z = p[1]; return r;
  }
  if (it.kind === 'segment') {
    const dx = it.bx - it.ax, dz = it.bz - it.az, L = Math.hypot(dx, dz) || 1e-6, ux = dx / L, uz = dz / L;
    // a thin box along the segment: its local z runs along the segment (s = ux, c = uz)
    const B = { x: (it.ax + it.bx) / 2, z: (it.az + it.bz) / 2, hw: it.r, hd: L / 2 + it.r, c: uz, s: ux }, r = sat(A, B);
    if (!r) return null;
    const p = contactPoint(A, B, r); r.x = p[0]; r.z = p[1]; return r;
  }
  if (it.kind === 'circle') {
    const dx = it.x - A.x, dz = it.z - A.z, lx = dx * A.c - dz * A.s, lz = dx * A.s + dz * A.c;
    const qx = clamp(lx, -A.hw, A.hw), qz = clamp(lz, -A.hd, A.hd), ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
    const wx = (x, z) => [A.x + x * A.c + z * A.s, A.z - x * A.s + z * A.c];
    if (d > 1e-6) {
      if (d >= it.r) return null;
      const nlx = -ex / d, nlz = -ez / d; // from the circle toward the box
      const p = wx(qx, qz);
      return { nx: nlx * A.c + nlz * A.s, nz: -nlx * A.s + nlz * A.c, depth: it.r - d, x: p[0], z: p[1] };
    }
    const px = A.hw - Math.abs(lx), pz = A.hd - Math.abs(lz);
    if (px < pz) { const sx = -Math.sign(lx) || 1; const p = wx(Math.sign(lx) * A.hw, lz); return { nx: sx * A.c, nz: -sx * A.s, depth: px + it.r, x: p[0], z: p[1] }; }
    const sz = -Math.sign(lz) || 1; const p = wx(lx, Math.sign(lz) * A.hd); return { nx: sz * A.s, nz: sz * A.c, depth: pz + it.r, x: p[0], z: p[1] };
  }
  return null;
}
export function collideWorld(S, v) {
  const C = S.world.colliders;
  for (let iter = 0; iter < 3; iter++) {
    const A = v.footprint(), R = Math.hypot(A.hw, A.hd) + 0.5;
    let best = null, bestIt = null;
    C.query(A.x, A.z, R, (it) => {
      if (it.kind === 'volume') return;
      const p = penetration(v, it, A);
      if (p && (!best || p.depth > best.depth)) { best = p; bestIt = it; }
    });
    if (!best) return;
    impactWorld(S, v, best.nx, best.nz, best.x, best.z, bestIt, best.depth);
  }
}
// push out along n by depth and bounce off an immovable thing at (x, z)
export function impactWorld(S, v, nx, nz, x, z, it, depth = 0) {
  if (depth > 0) { v.pos.x += nx * (depth + 0.002); v.pos.z += nz * (depth + 0.002); }
  const rx = x - v.pos.x, rz = z - v.pos.z;
  const vcx = v.vel.x + v.yawRate * rz, vcz = v.vel.z - v.yawRate * rx; // velocity of the contact point
  const vn = vcx * nx + vcz * nz;
  if (vn >= 0) return;
  const rn = rz * nx - rx * nz, invM = 1 / v.mass, invI = 1 / v.inertia;
  const j = -(1 + CONTACT.restitution) * vn / (invM + rn * rn * invI);
  v.vel.x += j * nx * invM; v.vel.z += j * nz * invM; v.yawRate += j * rn * invI * 0.6;
  // friction along the surface
  let tx = vcx - vn * nx, tz = vcz - vn * nz; const vt = Math.hypot(tx, tz);
  if (vt > 1e-4) {
    tx /= vt; tz /= vt;
    const rt = rz * tx - rx * tz, jt = Math.min(CONTACT.friction * j, vt / (invM + rt * rt * invI));
    v.vel.x -= jt * tx * invM; v.vel.z -= jt * tz * invM; v.yawRate -= jt * rt * invI * 0.6;
  }
  const speed = -vn;
  v.lastImpact = speed;
  if (speed > DAMAGE.freeMs) {
    addDamage(S, v, (speed - DAMAGE.freeMs) * DAMAGE.perMs);
    if (v.view) { const [lx, lz] = v.toLocal(x, z), c = Math.cos(v.yaw), s = Math.sin(v.yaw); v.view.dent(lx, 0.9, lz, -(nx * c - nz * s), -(nx * s + nz * c), (speed - DAMAGE.freeMs) * 0.012); }
  }
  if (speed > 0.8) v.emit('hit', { other: it ? { kind: it.kind, tag: it.tag || null } : null, speed, x, z, world: true });
  v.contactT = S.time;
}

/* ------------------------------------------------------------------ vehicle against vehicle */
export function collidePair(S, A, B) {
  const FA = A.footprint(), FB = B.footprint();
  if (Math.abs(A.pos.y - B.pos.y) > Math.max(A.h, B.h)) return false;
  const dx = FA.x - FB.x, dz = FA.z - FB.z, R = Math.hypot(FA.hw, FA.hd) + Math.hypot(FB.hw, FB.hd);
  if (dx * dx + dz * dz > R * R) return false;
  const n = sat(FA, FB); if (!n) return false;
  const [cx, cz] = contactPoint(FA, FB, n);
  const iA = A.kinematic ? 0 : 1 / A.mass, iB = B.kinematic ? 0 : 1 / B.mass;
  if (iA + iB === 0) return false;
  // separate by inverse mass
  const sA = iA / (iA + iB), sB = iB / (iA + iB);
  A.pos.x += n.nx * n.depth * sA; A.pos.z += n.nz * n.depth * sA; B.pos.x -= n.nx * n.depth * sB; B.pos.z -= n.nz * n.depth * sB;
  const rAx = cx - A.pos.x, rAz = cz - A.pos.z, rBx = cx - B.pos.x, rBz = cz - B.pos.z;
  const vAx = A.vel.x + A.yawRate * rAz, vAz = A.vel.z - A.yawRate * rAx, vBx = B.vel.x + B.yawRate * rBz, vBz = B.vel.z - B.yawRate * rBx;
  const rvx = vAx - vBx, rvz = vAz - vBz, vn = rvx * n.nx + rvz * n.nz;
  const speed = Math.max(0, -vn);
  if (vn < 0) {
    const IA = A.kinematic ? 0 : 1 / A.inertia, IB = B.kinematic ? 0 : 1 / B.inertia;
    const rnA = rAz * n.nx - rAx * n.nz, rnB = rBz * n.nx - rBx * n.nz;
    const j = -(1 + CONTACT.restitution) * vn / (iA + iB + rnA * rnA * IA + rnB * rnB * IB);
    A.vel.x += j * n.nx * iA; A.vel.z += j * n.nz * iA; A.yawRate += j * rnA * IA * 0.6;
    B.vel.x -= j * n.nx * iB; B.vel.z -= j * n.nz * iB; B.yawRate -= j * rnB * IB * 0.6;
    let tx = rvx - vn * n.nx, tz = rvz - vn * n.nz; const vt = Math.hypot(tx, tz);
    if (vt > 1e-4) {
      tx /= vt; tz /= vt;
      const jt = Math.min(CONTACT.friction * j * 0.5, vt / (iA + iB));
      A.vel.x -= jt * tx * iA; A.vel.z -= jt * tz * iA; B.vel.x += jt * tx * iB; B.vel.z += jt * tz * iB;
    }
    // PIT: a hit in the target's rear quarter at more than 25 degrees to its heading spins it
    pit(A, B, cx, cz, speed); pit(B, A, cx, cz, speed);
    if (speed > DAMAGE.freeMs) {
      const k = (speed - DAMAGE.freeMs) * DAMAGE.perMs;
      for (const [V, sgn] of [[A, 1], [B, -1]]) {
        addDamage(S, V, k * (V.protect ? 0 : 1));
        if (V.view) { const [lx, lz] = V.toLocal(cx, cz), c = Math.cos(V.yaw), s = Math.sin(V.yaw); V.view.dent(lx, 0.9, lz, -sgn * (n.nx * c - n.nz * s), -sgn * (n.nx * s + n.nz * c), (speed - DAMAGE.freeMs) * 0.012); }
      }
    }
  }
  contact(S, A, B, speed, cx, cz); contact(S, B, A, speed, cx, cz);
  return true;
}
function pit(hitter, target, cx, cz, speed) {
  if (target.kinematic || speed < 2) return;
  const [, lz] = target.toLocal(cx, cz);
  if (lz > -target.hd * 0.45) return;
  const hv = Math.hypot(hitter.vel.x, hitter.vel.z); if (hv < 3) return;
  const ang = Math.acos(clamp((hitter.vel.x * Math.sin(target.yaw) + hitter.vel.z * Math.cos(target.yaw)) / hv, -1, 1));
  if (ang < CONTACT.pitAngle || ang > Math.PI - CONTACT.pitAngle) return;
  const [lx] = target.toLocal(cx, cz);
  // pushed on the left rear (+x) the tail swings right: the nose turns left (yaw up)
  target.yawRate += Math.sign(lx || 1) * CONTACT.pitYaw * Math.min(1, speed / 8);
  target.spinT = 1.3;
  target.emit('pit', { by: hitter, speed });
}
// events and the protected-vehicle rules (bumpLimit, maxSpeed, maxContact)
function contact(S, v, other, speed, x, z) {
  const last = v.lastHit.get(other.id) ?? -1e9, fresh = S.time - last > CONTACT.bumpGap;
  v.lastHit.set(other.id, S.time);
  v.contactT = S.time; v.lastImpact = speed;
  if (!fresh) return;
  if (speed > 0.8) v.emit('hit', { other, speed, x, z });
  if (!v.protect || speed < CONTACT.bumpMin) return;
  if (v.maxContact != null && speed > v.maxContact) { v.emit('hitProtected', { by: other, speed, reason: 'contact' }); return; }
  if (speed >= v.maxSpeed) { v.emit('hitProtected', { by: other, speed, reason: 'hard' }); return; }
  v.bumps++;
  v.emit('bump', { by: other, speed, bumps: v.bumps });
  if (v.bumps > v.bumpLimit) v.emit('hitProtected', { by: other, speed, reason: 'bumps' });
}
