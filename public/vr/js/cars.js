// In Full Swing: cars you can drive. Parked cars wait at the kerbs round the player (the moving traffic in cityview.js is drawn in
// a shader and cannot be entered). The hero gets in (R, a pad's B, the phone's CAR button), drives (W/S or the stick, A/D to
// steer, Space for the handbrake) and gets out at the driver's side. A car stops on walls and the lake edge, and bounces a little.
// Pure: no three, no DOM; carsview (in streetview.js's style) draws them.
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
  max: 10, keep: 170, spawnMin: 20, spawnMax: 120, first: 10, // parked cars round the player
  enter: 3.4, // the hero gets in from this close to the car's middle
  half: { l: 2.2, w: 0.9 }, wheelbase: 2.7,
  accel: 8.5, brake: 20, reverse: 6, top: 28, coast: 0.6, drag: 0.0016, // m/s², m/s
  steer: 0.6, steerRate: 3.2, // radians at the wheel, and how fast it turns
  grip: 7, handbrake: { grip: 1.6, brake: 9, turn: 1.5 }, // sideways grip (1/s); the handbrake lets the back slide
  bounce: 0.25,
};
// paint: the city's car colours (cityview.js CAR_COLS), with a few brighter ones for the hero's pick
export const CAR_PAINT = [[0.9, 0.9, 0.88], [0.12, 0.12, 0.13], [0.6, 0.62, 0.64], [0.7, 0.12, 0.1], [0.14, 0.24, 0.5], [0.95, 0.72, 0.1], [0.25, 0.36, 0.3], [0.8, 0.45, 0.2], [0.85, 0.2, 0.55], [0.1, 0.6, 0.7]];

export function createCars(city, opts = {}) {
  const r = rng(opts.seed || 777);
  const streets = streetsOf(city);
  // kerb lines: along each side of each street, a parked car's middle 0.1 m in from the kerb
  const kerbs = [];
  for (const s of streets) for (const side of [-1, 1]) kerbs.push({ s, side, line: s.at + side * (s.w / 2 - s.walk - CAR.half.w + 0.1) });
  const cars = [];
  for (let i = 0; i < (opts.max || CAR.max); i++) cars.push({ id: i, on: false, x: 0, y: 0, z: 0, yaw: 0, speed: 0, side: 0, steer: 0, paint: CAR_PAINT[0], driven: false, bumpT: 9, vx: 0, vz: 0 });
  const K = { cars, driving: null, first: true, events: [], stats: { spawned: 0, entered: 0, exited: 0, bumps: 0 } };
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

  // One frame. focus: the player; drive: the input when the hero drives { throttle -1..1, steer -1..1, handbrake } (else null).
  K.update = function update(dt, focus, drive) {
    dt = clamp(dt || 0, 0, 0.1);
    let free = 0;
    for (const c of cars) {
      if (!c.on) { free++; continue; }
      if (c !== K.driving && Math.hypot(c.x - focus.x, c.z - focus.z) > CAR.keep) { c.on = false; free++; }
    }
    let n = K.first ? CAR.max : 1;
    for (const c of cars) {
      if (!free || n <= 0) break;
      if (c.on) continue;
      n--;
      const sp = spot(focus.x, focus.z, K.first ? CAR.first : CAR.spawnMin, CAR.spawnMax);
      if (!sp) continue;
      Object.assign(c, { on: true, x: sp.x, y: 0, z: sp.z, yaw: sp.yaw, speed: 0, side: 0, steer: 0, paint: CAR_PAINT[Math.floor(r() * CAR_PAINT.length)], driven: false, vx: 0, vz: 0 });
      free--; K.stats.spawned++;
    }
    K.first = false;
    for (const c of cars) if (c.on) step(c, dt, c === K.driving ? drive : null);
  };
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
    for (const c of cars) { if (!c.on) continue; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
    return best;
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
    list: cars.filter((c) => c.on).map((c) => ({ id: c.id, x: c.x, z: c.z, yaw: c.yaw, speed: c.speed })) });
  return K;
}
