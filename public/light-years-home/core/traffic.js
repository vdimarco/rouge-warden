// Light Years Home v3: traffic as pure functions of time (tech §3.4). Galaxies flow along roads (splines with a tube),
// circle on orbits (ring roads), drift slowly in swarms, or sit still (the Wall's seeded opening galaxies). The core and
// the renderer call the same functions with the same time, so they agree without sharing buffers. Nothing here is game
// state: buildTraffic makes typed arrays once per zone and seed.
import { TUNE } from './tune.js';
import { mulberry32, hashSeed } from './rng.js';

export const KIND = Object.freeze({ road: 0, orbit: 1, swarm: 2, parked: 3 });
export const MIXES = Object.freeze(['spiral', 'elliptical', 'dwarf', 'big', 'mixed']);
const MIX_CODE = Object.fromEntries(MIXES.map((m, i) => [m, i]));

const FADE = 0.03;          // traffic fades in over the first 3% of a road and out over the last 3%
const STEP = 0.5;           // u between road samples
const LANE = 3.5;           // u: roads with seeded galaxies keep their centre lane clear for the opening
const ROAD_SHARE = 0.7;     // share of a swarm placed along the zone's roads
const ROAD_SPREAD = 22;     // u either side of a road
const ROAD_H = 1.5;         // u above or below the plane for those
const OPENING_W = 3;        // the opening road's weight for road-side dwarfs
const OPEN_LEN = 160;       // u of the entry line kept clear
const OPEN_SPREAD = 40;
const OPEN_BIAS = 1.6;      // > 1 gathers the opening road's dwarfs toward its start
const PART_X = 2;           // road traffic keeps outside this × a well's rs (its sling ring)
const PART_BAND = 10;       // u: the band it flows round in     // u either side of the opening road: its halo fills the space round the drop-out
const TAU = Math.PI * 2;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const pick = (rng, v) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * rng() : v);

// One road as an arc-length table: positions every STEP u, unit tangents, the right-hand side in the plane and the
// tube radius at each sample. Catmull-Rom through the points, as the races calc does.
function buildRoad(road) {
  const pts = road.pts.map((p) => [p[0], p[1], p[2] || 0]);
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const dense = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
    const n = Math.max(4, Math.ceil(seg / 0.25));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  dense.push(pts[pts.length - 1]);
  // Resample by arc length.
  const xs = [dense[0][0]], ys = [dense[0][1]], zs = [dense[0][2]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (d <= 0) continue;
    let u = STEP - acc;
    while (u <= d) {
      const f = u / d;
      xs.push(a[0] + (b[0] - a[0]) * f); ys.push(a[1] + (b[1] - a[1]) * f); zs.push(a[2] + (b[2] - a[2]) * f);
      u += STEP;
    }
    acc = d - (u - STEP);
  }
  const n = xs.length;
  const L = (n - 1) * STEP;
  const x = Float64Array.from(xs), y = Float64Array.from(ys), z = Float64Array.from(zs);
  const tx = new Float64Array(n), ty = new Float64Array(n), tz = new Float64Array(n);
  const rx = new Float64Array(n), ry = new Float64Array(n), tube = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = x[b] - x[a], dy = y[b] - y[a], dz = z[b] - z[a];
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    tx[i] = dx; ty[i] = dy; tz[i] = dz;
    const h = Math.hypot(dx, dy) || 1;
    rx[i] = dy / h; ry[i] = -dx / h;                  // right of the flow along pts, in the plane (up is +z)
  }
  // Tube radius: a number, or [[from, to, r], ...] as fractions of the length, blended over 3% at each change.
  const spec = road.tube ?? 10;
  for (let i = 0; i < n; i++) {
    const f = L > 0 ? (i * STEP) / L : 0;
    if (typeof spec === 'number') { tube[i] = spec; continue; }
    let r = spec[0][2];
    for (let j = 0; j < spec.length; j++) {
      const [from, , rad] = spec[j];
      if (j === 0) { r = rad; continue; }
      r += (rad - r) * smooth(from - FADE / 2, from + FADE / 2, f);
    }
    tube[i] = r;
  }
  return { id: road.id, n, L, x, y, z, tx, ty, tz, rx, ry, tube, shift: null };
}

/**
 * buildTraffic(zoneData, seed, tune?) → Traffic. Typed arrays, one entry per body:
 *   kind (KIND), road (index into roads, orbits or swarms; -1 when parked), mix (MIXES index), variant (0..255, for
 *   the renderer's atlas), s0 (road arc length, orbit or swarm phase at t = 0), speed (road u/s signed by flow; orbit
 *   and swarm angular speed), offset (road lateral fraction −1..1; orbit radius; swarm drift amplitude), offZ (height),
 *   bx, by, bz (orbit centre, swarm or parked position), p2 (swarm second phase), size (drawn radius), rc (collider
 *   radius, CORE_X × size, 0 when the swarm has no colliders).
 * Plus roads (arc-length tables), n, maxSpeed (u/s, the fastest body) and zoneId.
 */
export function buildTraffic(zoneData, seed = 1, tune = TUNE) {
  const rng = mulberry32(hashSeed('traffic', zoneData?.id ?? 'zone', seed));
  const roadsIn = (zoneData?.roads || []).filter((r) => r && r.kind === 'road' && Array.isArray(r.pts) && r.pts.length >= 2);
  const orbits = (zoneData?.roads || []).filter((r) => r && r.kind === 'orbit');
  const swarms = zoneData?.swarms || [];
  const roads = roadsIn.map(buildRoad);
  // The opening lane: on a road with seeded galaxies, the clear lane follows the entry line (not the road's centre)
  // for the seeded stretch, so a bend in the road never swings its traffic across the drop-out's straight line.
  roadsIn.forEach((spec, ri) => {
    if (!(Array.isArray(spec.seeded) && spec.seeded.length && zoneData.entry)) return;
    const road = roads[ri];
    const e = zoneData.entry, ep = e.pos || [0, 0, 0], hd = ((e.heading ?? 0) * Math.PI) / 180;
    const fx = Math.sin(hd), fy = Math.cos(hd);
    const reach = Math.max(...spec.seeded.map((q) => q.ahead)) + 15;
    road.shift = new Float64Array(road.n);
    for (let j = 0; j < road.n; j++) {
      const ahead = (road.x[j] - ep[0]) * fx + (road.y[j] - ep[1]) * fy;
      const w = ahead < -10 || ahead > reach + 30 ? 0 : ahead <= reach ? 1 : 1 - (ahead - reach) / 30;
      const lx = ep[0] + fx * ahead - road.x[j], ly = ep[1] + fy * ahead - road.y[j];   // road centre to the line
      road.shift[j] = w * (lx * road.rx[j] + ly * road.ry[j]);
    }
  });
  const coreX = tune.COLLIDE.CORE_X;

  let n = 0;
  for (const r of roadsIn) n += (r.count | 0) + (Array.isArray(r.seeded) ? r.seeded.length : 0);
  for (const o of orbits) n += o.count | 0;
  for (const s of swarms) n += s.count | 0;

  // Road traffic parts round every gravity well's sling ring (2 × rs), so a drift round a giant has clear space.
  const parts = [];
  for (const b of zoneData?.bodies || []) if (b.well?.rs > 0) parts.push(b.pos[0], b.pos[1], PART_X * b.well.rs);
  const t = {
    zoneId: zoneData?.id ?? null, n, roads, maxSpeed: 0, parts: Float64Array.from(parts),
    kind: new Uint8Array(n), road: new Int16Array(n), mix: new Uint8Array(n), variant: new Uint8Array(n),
    s0: new Float64Array(n), speed: new Float64Array(n), offset: new Float64Array(n), offZ: new Float64Array(n),
    bx: new Float64Array(n), by: new Float64Array(n), bz: new Float64Array(n), p2: new Float64Array(n),
    size: new Float32Array(n), rc: new Float32Array(n),
  };
  let i = 0;
  const common = (mix, size) => {
    t.mix[i] = MIX_CODE[mix] ?? 0;
    t.variant[i] = Math.floor(rng() * 256);
    t.size[i] = size;
    t.rc[i] = coreX * size;
  };

  // Roads, then each road's seeded galaxies (parked on the entry line: ahead along the entry heading, lateral to its
  // right), so the opening's near misses do not depend on how long the title showed.
  roadsIn.forEach((spec, ri) => {
    const road = roads[ri];
    const flow = spec.flow === -1 ? -1 : 1;
    const lane = Array.isArray(spec.seeded) && spec.seeded.length > 0;
    for (let k = 0; k < (spec.count | 0); k++, i++) {
      t.kind[i] = KIND.road;
      t.road[i] = ri;
      t.s0[i] = rng() * road.L;
      const v = pick(rng, spec.speed ?? 6) * (0.9 + 0.2 * rng());
      t.speed[i] = flow * v;
      t.maxSpeed = Math.max(t.maxSpeed, v);
      const o = rng() * 2 - 1;
      // Lane roads: the offset is LANE plus a share of what is left of the tube, on either side.
      t.offset[i] = lane ? (o < 0 ? -1 : 1) * (2 + Math.abs(o)) : o;     // |offset| > 2 marks a lane body
      t.offZ[i] = (rng() * 2 - 1) * Math.min(4, 0.25 * (spec.tube?.[0]?.[2] ?? spec.tube ?? 10));
      common(spec.mix, pick(rng, spec.size ?? [1, 2.5]));
    }
    if (lane) {
      const e = zoneData.entry || {};
      const ep = e.pos || [0, 0, 0];
      const hd = ((e.heading ?? 0) * Math.PI) / 180;
      const fx = Math.sin(hd), fy = Math.cos(hd);
      for (const s of spec.seeded) {
        t.kind[i] = KIND.parked;
        t.road[i] = -1;
        t.bx[i] = ep[0] + fx * s.ahead + fy * s.lateral;
        t.by[i] = ep[1] + fy * s.ahead - fx * s.lateral;
        t.bz[i] = ep[2] || 0;
        common(spec.mix, s.r ?? 2);
        i++;
      }
    }
  });

  orbits.forEach((o, oi) => {
    const dir = o.dir === -1 ? -1 : 1;
    for (let k = 0; k < (o.count | 0); k++, i++) {
      t.kind[i] = KIND.orbit;
      t.road[i] = oi;
      const r = pick(rng, o.r);
      const v = pick(rng, o.speed ?? 6);
      t.offset[i] = r;
      t.speed[i] = (dir * v) / Math.max(1, r);
      t.maxSpeed = Math.max(t.maxSpeed, v);
      t.s0[i] = rng() * TAU;
      t.bx[i] = o.centre?.[0] ?? 0;
      t.by[i] = o.centre?.[1] ?? 0;
      t.offZ[i] = (rng() * 2 - 1) * 0.5 * (o.height ?? 0);
      common(o.mix, pick(rng, o.size ?? [1.5, 3]));
    }
  });

  // Roads weighted by length; the opening road (the one with seeded galaxies) counts OPENING_W times. The opening
  // line (the entry heading, OPEN_LEN u ahead) stays clear of swarm bodies, so the first seconds have no surprise hit.
  const lane = roadsIn.some((r) => Array.isArray(r.seeded) && r.seeded.length) ? zoneData.entry : null;
  const lp = lane?.pos || [0, 0, 0], lh = ((lane?.heading ?? 0) * Math.PI) / 180;
  const inLane = (x, y) => {
    if (!lane) return false;
    const dx = x - lp[0], dy = y - lp[1];
    const along = dx * Math.sin(lh) + dy * Math.cos(lh);
    const side = dx * Math.cos(lh) - dy * Math.sin(lh);
    return along > -10 && along < OPEN_LEN && Math.abs(side) < LANE;
  };
  const roadW = [];
  roadsIn.forEach((spec, ri) => {
    roadW.push((roadW[ri - 1] || 0) + roads[ri].L * (Array.isArray(spec.seeded) && spec.seeded.length ? OPENING_W : 1));
  });
  const pickRoad = (x) => {
    let j = 0;
    while (j < roadW.length - 1 && x >= roadW[j]) j++;
    return j;
  };
  swarms.forEach((s, si) => {
    const R = s.area?.r ?? 400;
    const c = s.centre || s.area?.centre || [0, 0];
    const avoid = s.avoid || [];
    for (let k = 0; k < (s.count | 0); k++, i++) {
      let x = 0, y = 0;
      // Dwarfs trace the web: a share of each swarm gathers along the roads (the filaments), the rest spreads out.
      const onRoad = roads.length > 0 && rng() < ROAD_SHARE;
      for (let tries = 0; tries < 24; tries++) {
        if (onRoad) {
          const ri = pickRoad(rng() * roadW[roadW.length - 1]);
          const road = roads[ri];
          const opening = !!roadsIn[ri].seeded?.length;
          // On the opening road they gather toward the drop-out end, where every heading a new player picks runs.
          const j = Math.floor((opening ? rng() ** OPEN_BIAS : rng()) * road.n);
          const spread = opening ? OPEN_SPREAD : ROAD_SPREAD;
          const off = (rng() + rng() + rng() - 1.5) * 2 * spread;       // about ±spread, peaked at the road
          x = road.x[j] + road.rx[j] * off;
          y = road.y[j] + road.ry[j] * off;
        } else {
          const a = rng() * TAU, rr = R * Math.sqrt(rng());
          x = c[0] + rr * Math.cos(a);
          y = c[1] + rr * Math.sin(a);
        }
        if (Math.hypot(x - c[0], y - c[1]) <= R && !inLane(x, y)
          && !avoid.some((v) => Math.hypot(x - v.centre[0], y - v.centre[1]) < v.r)) break;
      }
      const h = s.h ?? 60;
      t.kind[i] = KIND.swarm;
      t.road[i] = si;
      t.bx[i] = x;
      t.by[i] = y;
      // Along a road they keep to the plane, where you drive; out in the field 60% stay near it, the rest fill the slab.
      t.bz[i] = (rng() * 2 - 1) * (onRoad ? ROAD_H : rng() < 0.6 ? 0.12 * h : h);
      t.offset[i] = pick(rng, s.drift ?? [1, 3]);
      t.speed[i] = 0.04 + 0.08 * rng();                          // rad/s: a slow Lissajous drift
      t.s0[i] = rng() * TAU;
      t.p2[i] = rng() * TAU;
      t.maxSpeed = Math.max(t.maxSpeed, t.offset[i] * t.speed[i] * 1.6);
      common(s.mix, pick(rng, s.size ?? [0.5, 1]));
      if (s.colliders === false) t.rc[i] = 0;
    }
  });
  return t;
}

const VA = [0, 0, 0], VB = [0, 0, 0];

// place() writes body i's position and fade at time TT[0] into PF (x, y, z, fade). Numbers travel through these two
// typed arrays rather than arguments and return values, so filling 2,300 bodies boxes no number.
const TT = new Float64Array(1);
const PF = new Float64Array(4);

function place(tr, i) {
  const t = TT[0];
  switch (tr.kind[i]) {
    case KIND.road: {
      const road = tr.roads[tr.road[i]];
      const L = road.L;
      let s = (tr.s0[i] + tr.speed[i] * t) % L;
      if (s < 0) s += L;
      const f = s / STEP;
      const j = Math.min(road.n - 2, Math.floor(f));
      const u = f - j;
      const tube = road.tube[j] + (road.tube[j + 1] - road.tube[j]) * u;
      const o = tr.offset[i];
      const wide = tube > LANE ? tube - LANE : 0;
      let lat;
      if (o > 2 || o < -2) {
        // A lane body: LANE or more from the lane's centre, which is the road's centre shifted onto the entry line.
        const sh = road.shift ? road.shift[j] + (road.shift[j + 1] - road.shift[j]) * u : 0;
        lat = o > 2 ? (sh > 0 ? sh : 0) + LANE + (o - 2) * wide : (sh < 0 ? sh : 0) - LANE + (o + 2) * wide;
      } else {
        lat = o * tube;
      }
      const rx = road.rx[j] + (road.rx[j + 1] - road.rx[j]) * u, ry = road.ry[j] + (road.ry[j + 1] - road.ry[j]) * u;
      let px = road.x[j] + (road.x[j + 1] - road.x[j]) * u + rx * lat;
      let py = road.y[j] + (road.y[j + 1] - road.y[j]) * u + ry * lat;
      // Part round wells: the disc out to R + PART_BAND is squeezed into the band from R to R + PART_BAND.
      const pa = tr.parts;
      for (let k = 0; k < pa.length; k += 3) {
        const dx = px - pa[k], dy = py - pa[k + 1], R = pa[k + 2];
        const d2 = dx * dx + dy * dy, out = R + PART_BAND;
        if (d2 < out * out) {
          const d = Math.sqrt(d2);
          const f = d > 1e-6 ? (R + (d * PART_BAND) / out) / d : 0;
          px = pa[k] + dx * f; py = pa[k + 1] + (d > 1e-6 ? dy * f : R);
        }
      }
      PF[0] = px;
      PF[1] = py;
      PF[2] = road.z[j] + (road.z[j + 1] - road.z[j]) * u + tr.offZ[i];
      // Fade: smoothstep in over the first FADE of the road, out over the last.
      const q = s / L;
      let a = q / FADE, b = (1 - q) / FADE;
      a = a > 1 ? 1 : a; b = b > 1 ? 1 : b;
      const m = a < b ? a : b;
      PF[3] = m * m * (3 - 2 * m);
      return;
    }
    case KIND.orbit: {
      const a = tr.s0[i] + tr.speed[i] * t;
      const r = tr.offset[i];
      PF[0] = tr.bx[i] + r * Math.cos(a);
      PF[1] = tr.by[i] + r * Math.sin(a);
      PF[2] = tr.offZ[i];
      PF[3] = 1;
      return;
    }
    case KIND.swarm: {
      const w = tr.speed[i], a = tr.offset[i];
      PF[0] = tr.bx[i] + a * Math.sin(w * t + tr.s0[i]);
      PF[1] = tr.by[i] + a * Math.sin(w * 1.37 * t + tr.p2[i]);
      PF[2] = tr.bz[i] + 0.3 * a * Math.sin(w * 0.71 * t + tr.s0[i] + tr.p2[i]);
      PF[3] = 1;
      return;
    }
    default:
      PF[0] = tr.bx[i]; PF[1] = tr.by[i]; PF[2] = tr.bz[i]; PF[3] = 1;
  }
}

/**
 * posAt(traffic, i, t, out) → fade. Writes body i's position at time t into out ([x, y, z]) and returns how visible
 * it is (0..1). Roads fade over their first and last 3%; colliders are off while a body is faded (fade < 1).
 */
export function posAt(tr, i, t, out) {
  TT[0] = t;
  place(tr, i);
  out[0] = PF[0]; out[1] = PF[1]; out[2] = PF[2];
  return PF[3];
}

/** velAt(traffic, i, t, out) → out: body i's velocity at time t (u/s). */
export function velAt(tr, i, t, out) {
  switch (tr.kind[i]) {
    case KIND.road: {
      // The change of posAt itself, so a body off the centre line of a bend moves at its own speed.
      posAt(tr, i, t + 0.01, VA);
      posAt(tr, i, t - 0.01, VB);
      out[0] = (VA[0] - VB[0]) * 50; out[1] = (VA[1] - VB[1]) * 50; out[2] = (VA[2] - VB[2]) * 50;
      return out;
    }
    case KIND.orbit: {
      const a = tr.s0[i] + tr.speed[i] * t;
      const rw = tr.offset[i] * tr.speed[i];
      out[0] = -rw * Math.sin(a); out[1] = rw * Math.cos(a); out[2] = 0;
      return out;
    }
    case KIND.swarm: {
      const w = tr.speed[i], a = tr.offset[i];
      out[0] = a * w * Math.cos(w * t + tr.s0[i]);
      out[1] = a * w * 1.37 * Math.cos(w * 1.37 * t + tr.p2[i]);
      out[2] = 0.3 * a * w * 0.71 * Math.cos(w * 0.71 * t + tr.s0[i] + tr.p2[i]);
      return out;
    }
    default:
      out[0] = 0; out[1] = 0; out[2] = 0;
      return out;
  }
}

/**
 * fillPositions(traffic, t, outF32, outFade?) → outF32: every body's position at t as x, y, z triples (for the
 * renderer's instances and the collision grid). outFade, if given, gets each body's fade.
 */
export function fillPositions(tr, t, out, outFade = null) {
  TT[0] = t;
  for (let i = 0; i < tr.n; i++) {
    place(tr, i);
    out[i * 3] = PF[0]; out[i * 3 + 1] = PF[1]; out[i * 3 + 2] = PF[2];
    if (outFade) outFade[i] = PF[3];
  }
  return out;
}
