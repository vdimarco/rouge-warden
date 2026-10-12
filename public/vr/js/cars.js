// In Full Swing: cars you can drive. Parked cars wait at the kerbs round the player. The moving traffic is drawn in a shader
// (cityview.js CAR_VS); trafficAt mirrors that shader so a street car can be stolen: it becomes one of these cars, stopped, in
// its colour, and the shader hides its instance. The hero gets in (R, a pad's B, the phone's CAR button), drives (W/S or the
// stick, A/D to steer, Space for the handbrake) and gets out at the driver's side. A car stops on walls and the lake edge, and
// bounces a little. Pure: no three, no DOM; actionview.js draws them.
import { streetsOf } from "./street.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CAR = {
  max: 8, keep: 170, spawnMin: 20, spawnMax: 120, first: 10, // parked cars round the player
  enter: 3.4, // the hero gets in from this close to the car's middle
  steal: 3.5, stealUp: 3, stealBuffer: 0.35, // a street car's body this close (m), the hero this high at most, a press kept this long (s)
  keepStolen: 400, // a stolen car stays out while the player is this close
  half: { l: 2.2, w: 0.9 }, wheelbase: 2.7,
  accel: 8.5, brake: 20, reverse: 6, top: 28, coast: 0.6, drag: 0.0016, // m/s², m/s
  steer: 0.6, steerRate: 3.2, // radians at the wheel, and how fast it turns
  grip: 7, handbrake: { grip: 1.6, brake: 9, turn: 1.5 }, // sideways grip (1/s); the handbrake lets the back slide
  bounce: 0.25,
  // a job's car (a getaway car on its run, a sludge tanker): it drives itself along its path at up to speed m/s, slowing for
  // turns; a stopped one brakes to a halt
  auto: { speed: 17, turnSlow: 0.5, look: 7, steerK: 2.2, reach: 6 },
  // car against car: each car is two circles (radius r, off m from the middle, front and back). A hit pushes the two apart and
  // trades their speed along the hit (restitution e); a street car the driven car meets becomes a real car (it can be pushed)
  hit: { r: 0.95, off: 1.25, e: 0.3, traffic: 3.2 },
};
// paint: the city's car colours (cityview.js CAR_COLS), with a few brighter ones for the hero's pick
export const CAR_PAINT = [[0.9, 0.9, 0.88], [0.12, 0.12, 0.13], [0.6, 0.62, 0.64], [0.7, 0.12, 0.1], [0.14, 0.24, 0.5], [0.95, 0.72, 0.1], [0.25, 0.36, 0.3], [0.8, 0.45, 0.2], [0.85, 0.2, 0.55], [0.1, 0.6, 0.7]];


/* ---- the traffic (cityview.js CAR_VS on the CPU) ---- */
// T: { n, lane, move, color } (the instance arrays: lane = start x, y, z, heading 0 +x, 1 -x, 2 +z, 3 -z; move = length,
// speed, phase). The car's middle at time t is lane.xyz + f * mod(phase + speed * t, length), front along f.
const HEAD = [[1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, Math.PI], [0, -1, 0]]; // fx, fz, the yaw cars.js uses (front -sin, -cos)
export function trafficAt(T, i, t, out = {}) {
  const L = T.lane, M = T.move, o = i * 4;
  const len = M[o], v = M[o + 1];
  let s = M[o + 2] + v * t;
  s -= len * Math.floor(s / len); // GLSL mod
  const h = HEAD[Math.min(3, Math.max(0, Math.round(L[o + 3])))];
  out.i = i; out.s = s; out.len = len;
  out.x = L[o] + h[0] * s; out.y = L[o + 1]; out.z = L[o + 2] + h[1] * s; out.yaw = h[2]; out.fx = h[0]; out.fz = h[1]; out.speed = v;
  out.paint = T.color ? [T.color[i * 3], T.color[i * 3 + 1], T.color[i * 3 + 2]] : CAR_PAINT[0];
  return out;
}
// The street car whose body (a 4.4 m segment) is closest to (x, z) and within reach, or null. Expressway cars (y over 1), hidden
// (stolen) cars and cars shrinking at the ends of their lane are skipped.
const TQ = {};
export function nearTraffic(T, x, z, t, reach = CAR.steal) {
  if (!T || !T.n) return null;
  let best = null, bd = reach;
  const L = T.lane, M = T.move;
  for (let i = 0; i < T.n; i++) {
    const o = i * 4;
    if (Math.abs(L[o + 1]) > 1 || !(M[o] > 20) || !(M[o + 1] > 0)) continue;
    // quick reject: the lane's line is too far across
    const h = L[o + 3], alongX = h < 1.5;
    if (Math.abs(alongX ? z - L[o + 2] : x - L[o]) > reach) continue;
    trafficAt(T, i, t, TQ);
    if (TQ.s < 8 || TQ.len - TQ.s < 8) continue;
    const dx = x - TQ.x, dz = z - TQ.z, along = clamp(dx * TQ.fx + dz * TQ.fz, -CAR.half.l, CAR.half.l);
    const d = Math.hypot(dx - TQ.fx * along, dz - TQ.fz * along);
    if (d < bd) { bd = d; best = trafficAt(T, i, t, {}); best.dist = d; }
  }
  return best;
}

export function createCars(city, opts = {}) {
  const r = rng(opts.seed || 777);
  const streets = streetsOf(city);
  // kerb lines: along each side of each street, a parked car's middle 0.1 m in from the kerb
  const kerbs = [];
  for (const s of streets) for (const side of [-1, 1]) kerbs.push({ s, side, line: s.at + side * (s.w / 2 - s.walk - CAR.half.w + 0.1) });
  const cars = [];
  for (let i = 0; i < (opts.max || CAR.max); i++) cars.push({ id: i, on: false, x: 0, y: 0, z: 0, yaw: 0, speed: 0, side: 0, steer: 0, paint: CAR_PAINT[0], driven: false, bumpT: 9, vx: 0, vz: 0, traffic: -1 });
  const K = { cars, driving: null, first: true, events: [], stats: { spawned: 0, entered: 0, exited: 0, bumps: 0, stolen: 0, crashes: 0 } };
  const emit = (e) => { K.events.push(e); if (K.events.length > 32) K.events.shift(); };

  // a crossing's road at (along) on a kerb line, so no car parks across a junction
  const atJunction = (k, along) => streets.some((c) => c.axis !== k.s.axis && k.line > c.from - 1 && k.line < c.to + 1 && Math.abs(along - c.at) < c.w / 2 + 4);
  // is the box of a car at (x, z, yaw) clear of the city (buildings, the lake)?
  function clear(x, z, yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (const t of [-1.5, 0, 1.5]) {
      const px = x + fx * t, pz = z + fz * t;
      if (city.isWater(px, pz) || city.collideSphere(px, 0.8, pz, 0.95)) return false;
      const tb = city.topBelow(px, 2.5, pz, 0.5);
      if (tb && tb.y > 0.4) return false;
    }
    return true;
  }
  function spot(fx, fz, lo, hi) {
    for (let k = 0; k < 30; k++) {
      const kb = kerbs[Math.floor(r() * kerbs.length)];
      const across = Math.abs(kb.line - (kb.s.axis === "x" ? fx : fz));
      if (across > hi) continue;
      const fa = kb.s.axis === "x" ? fz : fx, reach = Math.sqrt(hi * hi - across * across);
      const a0 = Math.max(kb.s.from + 6, fa - reach), a1 = Math.min(kb.s.to - 6, fa + reach);
      if (a1 <= a0) continue;
      const along = a0 + r() * (a1 - a0);
      if (atJunction(kb, along)) continue;
      const x = kb.s.axis === "x" ? kb.line : along, z = kb.s.axis === "x" ? along : kb.line, d = Math.hypot(x - fx, z - fz);
      if (d < lo || d > hi) continue;
      // facing with the traffic on that side (right-hand traffic: north-south roads carry north (−z) east of the centre)
      const pos = kb.side > 0;
      const yaw = kb.s.axis === "x" ? (pos ? 0 : Math.PI) : (pos ? -Math.PI / 2 : Math.PI / 2);
      if (!clear(x, z, yaw)) continue;
      if (cars.some((c) => c.on && Math.hypot(c.x - x, c.z - z) < 7)) continue;
      return { x, z, yaw };
    }
    return null;
  }

  // One frame. focus: the player; drive: the input when the hero drives { throttle -1..1, steer -1..1, handbrake } (else null);
  // traffic: { T, t } (the street cars and the clock), for the driven car to hit them.
  K.update = function update(dt, focus, drive, traffic = null) {
    dt = clamp(dt || 0, 0, 0.1);
    let free = 0;
    for (const c of cars) {
      if (!c.on) { free++; continue; }
      if (c.job) continue; // a job's car stays until the job lets it go
      if (c !== K.driving && Math.hypot(c.x - focus.x, c.z - focus.z) > (c.traffic >= 0 ? CAR.keepStolen : CAR.keep)) { off(c); free++; }
    }
    let n = K.first ? CAR.max : 1;
    for (const c of cars) {
      if (!free || n <= 0) break;
      if (c.on) continue;
      n--;
      const sp = spot(focus.x, focus.z, K.first ? CAR.first : CAR.spawnMin, CAR.spawnMax);
      if (!sp) continue;
      Object.assign(c, { on: true, x: sp.x, y: 0, z: sp.z, yaw: sp.yaw, speed: 0, side: 0, steer: 0, paint: CAR_PAINT[Math.floor(r() * CAR_PAINT.length)], driven: false, vx: 0, vz: 0, traffic: -1 });
      free--; K.stats.spawned++;
    }
    K.first = false;
    // a street car in the driven car's way becomes a real car, so the hit below can push it
    if (K.driving && traffic && traffic.T && Math.abs(K.driving.speed) > 1) {
      const c = K.driving, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), sg = Math.sign(c.speed);
      const t = nearTraffic(traffic.T, c.x + fx * CAR.half.l * sg, c.z + fz * CAR.half.l * sg, traffic.t, CAR.hit.traffic);
      if (t && !cars.some((q) => q.on && q.traffic === t.i)) {
        const q = K.steal(t, c, true);
        if (q) { q.speed = t.speed; emit({ type: "struck", traffic: t.i, id: q.id, x: q.x, z: q.z }); }
      }
    }
    for (const c of cars) if (c.on) step(c, dt, c === K.driving ? drive : c.auto ? autoDrive(c) : null);
    collide();
  };
  // Car against car: two circles each. An overlap pushes the cars apart (half each, unless the push would go into a wall) and
  // trades their velocity along the hit; the result goes back into each car's speed and slide.
  const H = CAR.hit, CA = [{ x: 0, z: 0 }, { x: 0, z: 0 }], CB = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  function circles(c, out) {
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    out[0].x = c.x + fx * H.off; out[0].z = c.z + fz * H.off; out[1].x = c.x - fx * H.off; out[1].z = c.z - fz * H.off;
  }
  function setVel(c, vx, vz) {
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    c.speed = clamp(vx * fx + vz * fz, -CAR.reverse * 2, CAR.top); c.side = vx * -fz + vz * fx; c.vx = vx; c.vz = vz;
  }
  function collide() {
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      if (!a.on) continue;
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        if (!b.on || Math.abs(a.x - b.x) > 6 || Math.abs(a.z - b.z) > 6) continue;
        circles(a, CA); circles(b, CB);
        let best = null, depth = 0;
        for (const p of CA) for (const q of CB) {
          const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz), over = H.r * 2 - d;
          if (over > depth) { depth = over; best = d > 1e-4 ? { nx: dx / d, nz: dz / d } : { nx: 1, nz: 0 }; }
        }
        if (!best) continue;
        const { nx, nz } = best;
        // push apart: half each (all to the other when one cannot move)
        const ax = a.x + nx * depth / 2, az = a.z + nz * depth / 2, bx = b.x - nx * depth / 2, bz = b.z - nz * depth / 2;
        const aOk = clear(ax, az, a.yaw), bOk = clear(bx, bz, b.yaw);
        if (aOk) { a.x = ax; a.z = az; } else if (clear(b.x - nx * depth, b.z - nz * depth, b.yaw)) { b.x -= nx * depth; b.z -= nz * depth; }
        if (bOk) { b.x = bx; b.z = bz; } else if (clear(a.x + nx * depth, a.z + nz * depth, a.yaw)) { a.x += nx * depth; a.z += nz * depth; }
        // trade the velocity along the hit (equal masses)
        const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (rel >= 0) continue; // already moving apart
        const jn = -(1 + H.e) * rel / 2;
        setVel(a, a.vx + nx * jn, a.vz + nz * jn);
        setVel(b, b.vx - nx * jn, b.vz - nz * jn);
        K.stats.crashes++;
        if (-rel > 2) emit({ type: "bump", speed: -rel, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, id: a.id, other: b.id, car: true });
      }
    }
  }
  // the self-driving input of a job's car: toward the next point of its path, slower in a turn; stopped: brake
  const AUTO_IN = { throttle: 0, steer: 0, handbrake: false };
  function autoDrive(c) {
    const A = c.auto, Q = CAR.auto;
    AUTO_IN.handbrake = false;
    if (A.stop || A.i >= A.path.length) { AUTO_IN.throttle = c.speed > 0.3 ? -1 : 0; AUTO_IN.steer = A.stop ? A.swerve : 0; if (!A.done && A.i >= A.path.length) { A.done = true; emit({ type: "arrived", id: c.id }); } return AUTO_IN; }
    const q = A.path[A.i], dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz);
    if (d < Q.reach) { A.i++; return autoDrive(c); }
    const want = Math.atan2(-dx, -dz), err = wrap(want - c.yaw);
    AUTO_IN.steer = clamp(err * Q.steerK, -1, 1);
    const top = (A.speed || Q.speed) * (1 - Q.turnSlow * Math.min(1, Math.abs(err)));
    AUTO_IN.throttle = c.speed < top ? 1 : c.speed > top + 2 ? -0.5 : 0;
    return AUTO_IN;
  }
  // A job's car at (x, z, yaw) in paint: a free slot, else the farthest car the hero is not in. o: { path (points to drive
  // along; none: parked), speed, tanker }. Returns the car; K.release(c) gives it back.
  K.jobCar = function jobCar(x, z, yaw, paint, o = {}) {
    let c = cars.find((q) => !q.on);
    if (!c) { let fd = -1; for (const q of cars) { if (q === K.driving || q.job) continue; const d = Math.hypot(q.x - x, q.z - z); if (d > fd) { fd = d; c = q; } } if (!c) return null; off(c); }
    Object.assign(c, { on: true, x, y: 0, z, yaw, speed: 0, side: 0, steer: 0, paint: paint.slice(0, 3), driven: false, vx: 0, vz: 0, bumpT: 9, traffic: -1, job: true, tanker: !!o.tanker,
      auto: o.path ? { path: o.path, i: 0, speed: o.speed || CAR.auto.speed, stop: false, swerve: 0, done: false } : null });
    emit({ type: "jobcar", id: c.id, x, z });
    return c;
  };
  // a job's car stops: it swerves (a little to one side) and brakes to a halt
  K.stopCar = function stopCar(c, swerve = 0.5) { if (c && c.auto) { c.auto.stop = true; c.auto.swerve = swerve; } };
  K.release = function release(c) { if (c) { c.job = false; c.auto = null; c.tanker = false; } };
  // a car goes back to the pool; a stolen one gives its traffic car back to the street
  function off(c) {
    c.on = false; c.job = false; c.auto = null; c.tanker = false;
    if (c.traffic >= 0) { emit({ type: "release", traffic: c.traffic, id: c.id }); c.traffic = -1; }
  }
  // the car model: a bicycle with grip. side: the sideways slide (m/s) the grip takes away
  function step(c, dt, inp) {
    const th = inp ? clamp(inp.throttle || 0, -1, 1) : 0, hb = !!(inp && inp.handbrake);
    const wantSteer = inp ? clamp(inp.steer || 0, -1, 1) * CAR.steer * (1 - 0.55 * clamp(Math.abs(c.speed) / CAR.top, 0, 1)) : 0;
    c.steer += (wantSteer - c.steer) * (1 - Math.exp(-CAR.steerRate * dt));
    // throttle: forward drives (or brakes a car rolling back); back brakes, then reverses
    if (th > 0) c.speed += (c.speed < -0.3 ? CAR.brake : CAR.accel) * th * dt;
    else if (th < 0) c.speed += (c.speed > 0.3 ? -CAR.brake : -CAR.accel * (CAR.reverse / CAR.top) * 2) * -th * dt;
    else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), CAR.coast * dt * 4);
    if (hb) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), CAR.handbrake.brake * dt);
    c.speed -= c.speed * Math.abs(c.speed) * CAR.drag * dt * 10;
    c.speed = clamp(c.speed, -CAR.reverse, CAR.top);
    // the turn: speed over the wheelbase times the steer; the handbrake lets the back swing out
    const turn = (c.speed / CAR.wheelbase) * Math.tan(c.steer) * (hb ? CAR.handbrake.turn : 1);
    c.yaw = wrap(c.yaw + turn * dt);
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = -fz, rz = fx;
    c.side *= Math.exp(-(hb ? CAR.handbrake.grip : CAR.grip) * dt);
    if (hb) c.side += -turn * Math.abs(c.speed) * 0.08 * dt * 10;
    c.vx = fx * c.speed + rx * c.side; c.vz = fz * c.speed + rz * c.side;
    if (Math.abs(c.vx) + Math.abs(c.vz) < 1e-4) return;
    const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
    if (clear(nx, nz, c.yaw)) { c.x = nx; c.z = nz; c.bumpT += dt; return; }
    // a wall (or the lake, or a step): stop and bounce back a little
    const hit = Math.abs(c.speed);
    c.speed = -c.speed * CAR.bounce; c.side = 0;
    if (c.bumpT > 0.3 && hit > 2) { K.stats.bumps++; emit({ type: "bump", speed: hit, x: c.x, z: c.z, id: c.id }); }
    c.bumpT = 0;
  }

  // the parked car the hero can get into from (x, y, z), or null
  K.near = function near(x, y, z) {
    if (y > 1.6) return null;
    let best = null, bd = CAR.enter;
    for (const c of cars) { if (!c.on || c.job) continue; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  // A street car (trafficAt's { i, x, z, yaw, paint }) becomes a car here, stopped, in its colour: a free slot, else the
  // farthest car the hero is not in (nor a job's). Returns the car (main.js then gets in), or null while the hero drives. quiet:
  // the driven car hit it (no steal counted, and it works while driving).
  K.steal = function steal(t, from, quiet = false) {
    if (!t || (K.driving && !quiet)) return null;
    let c = cars.find((q) => !q.on);
    if (!c) {
      const fx = from ? from.x : t.x, fz = from ? from.z : t.z;
      let fd = -1;
      for (const q of cars) { if (q === K.driving || q.job) continue; const d = Math.hypot(q.x - fx, q.z - fz); if (d > fd) { fd = d; c = q; } }
      if (!c) return null;
      off(c);
    }
    Object.assign(c, { on: true, x: t.x, y: 0, z: t.z, yaw: t.yaw, speed: 0, side: 0, steer: 0, paint: t.paint.slice(0, 3), driven: false, vx: 0, vz: 0, bumpT: 9, traffic: t.i });
    if (!quiet) { K.stats.stolen++; emit({ type: "steal", id: c.id, traffic: t.i, x: c.x, z: c.z }); }
    return c;
  };
  K.enter = function enter(c) {
    if (!c || K.driving) return false;
    K.driving = c; c.driven = true; c.speed = 0; c.side = 0;
    K.stats.entered++; emit({ type: "enter", id: c.id, x: c.x, z: c.z });
    return true;
  };
  // out at the driver's side (the left), else the right, else over the roof; returns where the hero stands
  K.exit = function exit() {
    const c = K.driving;
    if (!c) return null;
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = -fz, rz = fx;
    let out = null;
    for (const s of [-1, 1]) {
      const x = c.x + rx * s * 1.7, z = c.z + rz * s * 1.7;
      if (!city.isWater(x, z) && !city.collideSphere(x, 0.9, z, 0.35)) { out = { x, y: Math.max(0, city.groundY(x, z)), z }; break; }
    }
    if (!out) out = { x: c.x, y: 1.6, z: c.z };
    out.vx = c.vx * 0.6; out.vz = c.vz * 0.6;
    K.driving = null; c.speed *= 0.5;
    K.stats.exited++; emit({ type: "exit", id: c.id, x: out.x, z: out.z });
    return out;
  };
  // the moving cars, for the people to jump out of the way and the goons to be knocked over
  K.hazards = function hazards() {
    const out = [];
    for (const c of cars) if (c.on && Math.abs(c.speed) > 2) out.push({ x: c.x + -Math.sin(c.yaw) * 1.6 * Math.sign(c.speed), z: c.z + -Math.cos(c.yaw) * 1.6 * Math.sign(c.speed), vx: c.vx, vz: c.vz, r: 3.2 });
    return out;
  };
  K.info = () => ({ cars: cars.filter((c) => c.on).length, driving: K.driving ? { id: K.driving.id, x: K.driving.x, z: K.driving.z, yaw: K.driving.yaw, speed: K.driving.speed } : null, stats: { ...K.stats },
    list: cars.filter((c) => c.on).map((c) => ({ id: c.id, x: c.x, z: c.z, yaw: c.yaw, speed: c.speed, traffic: c.traffic, paint: c.paint, job: !!c.job, tanker: !!c.tanker, auto: !!c.auto })) });
  return K;
}
