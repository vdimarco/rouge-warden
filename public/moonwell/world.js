// Moonwell: the world. An endless row of islands, made from a seed as the pearl travels right.
// Between two islands is a gap over the water, and a pair of gold flippers guards it. Station k is the bowl around
// gap k: from the ridge of island k on its left to the ridge of island k+1 on its right. World units: the pearl is
// 30 across, y points down, and the water lies at WATER. No DOM here, so the node checks in qa/moonwell/ import it.

export const BALL_R = 15;
export const REGION = 8;          // every eighth island is a shrine, and the next region starts after it
export const WATER = 470;
export const FLIP = { len: 84, r0: 15, r1: 8, rest: 0.46, up: -0.72 };
const INLANE = 0.55, INLANE_RUN = 72;

export const BIOMES = [
  { name: 'Willow Meadow', sky: ['#081430', '#1c2f58'], haze: '#3a4f7a', grass: '#86ad5c', grassDark: '#4c7342', rock: '#b4a68d', rockDark: '#4b4656', water: '#1b7d8a', accent: '#ffe3a0', deco: ['pine', 'pine', 'bush', 'flower', 'lamp'] },
  { name: 'Lantern Bridge', sky: ['#0a1129', '#2b2a55'], haze: '#4b4a78', grass: '#7b9d58', grassDark: '#46653d', rock: '#bfae92', rockDark: '#544a5a', water: '#1d6f86', accent: '#ffc86b', deco: ['lamp', 'lamp', 'arch', 'bush', 'flower'] },
  { name: 'Lily Pond', sky: ['#06162c', '#14405a'], haze: '#2f6574', grass: '#6fb07a', grassDark: '#3d7356', rock: '#a9a493', rockDark: '#3f4b55', water: '#1f9a9a', accent: '#c9ffe9', deco: ['reed', 'reed', 'mushroom', 'bush', 'flower'] },
  { name: 'Star Garden', sky: ['#0b0c2a', '#33285a'], haze: '#5a4a86', grass: '#8aa86a', grassDark: '#526b48', rock: '#c8b48c', rockDark: '#57475e', water: '#2a5f8f', accent: '#ffe08a', deco: ['starpost', 'crystal', 'flower', 'pine', 'lamp'] },
  { name: 'Crystal Hollow', sky: ['#070a22', '#251c4d'], haze: '#46337a', grass: '#7a9a78', grassDark: '#3e5a55', rock: '#a59cb0', rockDark: '#3b3550', water: '#3a4fa0', accent: '#d8b8ff', deco: ['crystal', 'crystal', 'mushroom', 'bush', 'pine'] },
  { name: 'Cloud Isles', sky: ['#0d1a3a', '#3b4f7f'], haze: '#6e83ad', grass: '#9cc07a', grassDark: '#5d8250', rock: '#d3cab8', rockDark: '#66657a', water: '#3b7fb0', accent: '#ffffff', deco: ['cloud', 'pine', 'flower', 'bush', 'lamp'] },
];

// mulberry32: small, fast and the same on every machine
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  return next;
}
const hash = (seed, k, salt = 0) => {
  let h = (seed ^ Math.imul(k + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// How hard island k is, from 0 to 1: it climbs over the first 60 islands and keeps creeping after that.
export const difficulty = (k) => Math.min(1, k / 60) * 0.85 + Math.min(0.15, Math.max(0, k - 60) / 400);
export const biomeOf = (k) => BIOMES[Math.floor(k / REGION) % BIOMES.length];
export const isShrine = (k) => k % REGION === REGION - 1;

// A cubic Hermite curve from p0 to p1 with end tangents m0 and m1, as n + 1 points
function hermite(p0, m0, p1, m1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, t2 = t * t, t3 = t2 * t;
    const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
    out.push([a * p0[0] + b * m0[0] + c * p1[0] + d * m1[0], a * p0[1] + b * m0[1] + c * p1[1] + d * m1[1]]);
  }
  return out;
}

export function createWorld(seed = 1) {
  const world = { seed: seed >>> 0, list: [], first: 0, decorated: -1 };
  ensure(world, 6);
  return world;
}

export const station = (world, k) => world.list[k - world.first];
export const lastIndex = (world) => world.first + world.list.length - 1;

// Make islands up to k, and dress the bowls up to k - 4: a rail or a portal needs the islands ahead of it.
export function ensure(world, k) {
  while (lastIndex(world) < k + 4) world.list.push(build(world, lastIndex(world) + 1));
  while (world.decorated < k) dress(world, ++world.decorated);
}

// Drop the islands far behind the pearl. The pearl never goes back past a closed gate.
export function trim(world, k) {
  while (world.first < k - 2) { world.list.shift(); world.first++; }
}

// The stations whose span holds x (with a margin), for collisions and drawing
export function near(world, x0, x1) {
  const out = [];
  for (const s of world.list) if (s.x1 >= x0 && s.x0 <= x1) out.push(s);
  return out;
}

function build(world, k) {
  const prev = k > 0 ? station(world, k - 1) : null;
  const r = rng(hash(world.seed, k, 1));
  const d = difficulty(k);
  const x0 = prev ? prev.x1 : 0, y0 = prev ? prev.y1 : -320;
  // the floor wanders, but it is pulled back toward 0, and the bowl is always at least 140 below its left ridge
  let fy = k === 0 ? 0 : clamp(prev.fy + r.range(-90, 130) - 0.3 * prev.fy, -200, 200);
  fy = Math.max(fy, y0 + 140);
  const shrine = isShrine(k);
  const Hr = k === 0 ? 210 : k === 1 ? 240 : clamp(240 + 190 * d + r.range(-40, 45), 210, 470);
  const P = 106 + 12 * d + r.range(0, 4);
  const Hl = fy - y0;
  const Wl = Math.max(k === 0 ? 400 : r.range(360, 450), P + 90 + 0.55 * Hl);
  const Wr = Math.max(r.range(380, 480) + 50 * d, P + 90 + 0.55 * Hr);
  const cx = x0 + Wl, x1 = cx + Wr, y1 = fy - Hr;

  const f = FLIP;
  const flippers = [
    { side: -1, px: cx - P, py: fy, len: f.len, r0: f.r0, r1: f.r1, rest: f.rest, up: f.up },
    { side: 1, px: cx + P, py: fy, len: f.len, r0: f.r0, r1: f.r1, rest: Math.PI - f.rest, up: Math.PI - f.up },
  ];
  for (const fl of flippers) { fl.th = fl.rest; fl.om = 0; }

  // The slopes: a smooth hill from the ridge down to the inlane, then a straight inlane onto the flipper.
  const lane = (side) => {
    const sx = Math.cos(INLANE), sy = Math.sin(INLANE);
    const px = cx + side * P, foot = [px - side * f.r0 * sy, fy - f.r0 * sx];
    const top = [foot[0] + side * INLANE_RUN, foot[1] - INLANE_RUN * Math.tan(INLANE)];
    return { foot, top, dir: [side * sx, -sy] };
  };
  const L = lane(-1), R = lane(1);
  const span = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const lc = span([x0, y0], L.top), rc = span(R.top, [x1, y1]);
  const left = hermite([x0, y0], [lc, 0], L.top, [-L.dir[0] * lc, -L.dir[1] * lc], 12).concat([L.foot]);
  const right = [R.foot].concat(hermite(R.top, [R.dir[0] * rc, R.dir[1] * rc], [x1, y1], [rc, 0], 12));
  const cliffL = [[cx - P - 4, fy + 12], [cx - P - 44, WATER + 80]];
  const cliffR = [[cx + P + 4, fy + 12], [cx + P + 44, WATER + 80]];
  const segs = [];
  const chain = (pts) => { for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]); };
  chain(left); chain(right); chain(cliffL); chain(cliffR);

  return {
    k, seed: hash(world.seed, k, 2), biome: biomeOf(k), d, shrine,
    x0, y0, x1, y1, cx, fy, P, Wl, Wr, Hl, Hr,
    left, right, cliffL, cliffR, segs, flippers,
    // the gate on this station's left ridge closes once the pearl is past it; station 0 starts with a wall
    gate: k === 0 ? 1 : 0, sealed: shrine,
    drainY: fy + 150,
    stars: [], bumpers: [], lanterns: [], mills: [], rail: null, portal: null, exit: null, well: null, pearl: null,
    deco: [],
    // the first three islands have a moon post between the flippers, so a new player's pearl cannot drain there
    posts: k <= 2 ? [{ x: cx, y: fy + 34, r: 7 }] : [],
  };
}

// The ideal forward shot: from the left flipper, up and right, over the right ridge with room to spare.
export function idealArc(s, g = 1500, angle = 1.05, clear = 70) {
  const ox = s.cx - s.P + 52, oy = s.fy - 34;
  const D = s.x1 - ox, h = oy - (s.y1 - clear);
  let a = angle;
  while (D * Math.tan(a) - h <= 40 && a < 1.4) a += 0.04;
  const v = Math.sqrt((g * D * D) / (2 * Math.cos(a) ** 2 * (D * Math.tan(a) - h)));
  const vx = v * Math.cos(a), vy = -v * Math.sin(a);
  return { ox, oy, vx, vy, v, at: (t) => [ox + vx * t, oy + vy * t + 0.5 * g * t * t] };
}

// Points along an arc, about every `gap` units of path, from x = xa to x = xb
function alongArc(arc, xa, xb, gap) {
  const out = [];
  let last = null;
  for (let t = 0; t < 3; t += 0.004) {
    const p = arc.at(t);
    if (p[0] < xa) continue;
    if (p[0] > xb) break;
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= gap) { out.push(p); last = p; }
  }
  return out;
}

// y of the ground under x in a bowl
export function groundY(s, x) {
  const pts = x <= s.cx - s.P ? s.left : x >= s.cx + s.P ? s.right : null;
  if (!pts) return s.fy;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if ((x >= ax && x <= bx) || (x >= bx && x <= ax)) return ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
  }
  return pts[pts.length - 1][1];
}

// room for a feature at x, y: away from the others, well above the ground, and not over the flippers
const free = (s, x, y, gap, others = [...s.bumpers, ...s.lanterns, ...s.stars, ...s.mills]) =>
  [...others, s.portal, s.exit, s.rail && s.rail.mouth, s.pearl].every((o) => !o || Math.hypot(o.x - x, o.y - y) > gap + (o.half || o.r || 0)) &&
  y < groundY(s, x) - gap * 0.8 - BALL_R &&
  !(Math.abs(x - s.cx) < s.P + 30 && y > s.fy - 230);

function dress(world, k) {
  const s = station(world, k);
  if (!s) return;
  const r = rng(hash(world.seed, k, 3));
  const d = s.d;
  const top = Math.min(s.y0, s.y1);
  const pick = (lo, hi, ylo, yhi, gap, tries = 30) => {
    for (let i = 0; i < tries; i++) {
      const x = r.range(lo, hi), y = r.range(ylo, yhi);
      if (free(s, x, y, gap)) return [x, y];
    }
    return null;
  };
  const arc = idealArc(s);

  if (k === 0) {
    // The first island teaches the shot: stars mark the ideal arc, and nothing gets in the way.
    for (const [x, y] of alongArc(arc, s.cx - 30, s.x1 + 60, 72)) s.stars.push({ x, y });
  } else if (s.shrine) {
    // the moonwell sits on the ideal shot, so a good flip goes straight in
    const [wx, wy] = arc.at(Math.max(0.15, (s.cx + 30 - arc.ox) / arc.vx));
    s.well = { x: wx, y: Math.max(wy, s.fy - 420), r: 54, pull: 240 };
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      s.stars.push({ x: s.well.x + Math.cos(a) * 112, y: s.well.y + Math.sin(a) * 112 });
    }
  } else {
    const shape = r.pick(d < 0.2 ? ['arc', 'arc', 'high', 'line'] : ['arc', 'high', 'line', 'ring', 'zig']);
    if (shape === 'arc') for (const [x, y] of alongArc(arc, s.cx - 20, s.x1 + 80, 74)) s.stars.push({ x, y });
    if (shape === 'high') for (const [x, y] of alongArc(idealArc(s, 1500, 1.12, 190), s.cx, s.x1 + 160, 80)) s.stars.push({ x, y });
    if (shape === 'line') for (let i = 0; i < 5; i++) s.stars.push({ x: s.x1 - 150 + i * 70, y: s.y1 - 110 - Math.sin(i / 4 * Math.PI) * 40 });
    if (shape === 'zig') for (let i = 0; i < 6; i++) s.stars.push({ x: s.cx - 40 + i * 62, y: top - 60 - (i % 2) * 70 - i * 18 });

    // A gold rail or a moon portal: never across a shrine, and never into the islands of the next region.
    const nextShrine = Math.ceil((k + 1) / REGION) * REGION - 1;
    const room = nextShrine - k - 1;
    const rich = world.richer || 1;
    if (k >= 3 && room >= 3 && r.chance(0.22 * rich)) {
      const n = Math.min(room - 1, r.int(2, 3));
      s.rail = makeRail(world, s, n, r);
    } else if (k >= 4 && room >= 3 && r.chance(0.14 * rich)) {
      const to = station(world, k + 2);
      // the portal floats near the top of a forward shot
      const [ax, ay] = arc.at(Math.max(0.2, (s.cx + s.Wr * 0.35 - arc.ox) / arc.vx));
      const p = pick(ax - 60, ax + 60, Math.min(ay, top - 80) - 60, Math.min(ay, top - 80) + 40, 90);
      if (p && to) {
        s.portal = { x: p[0], y: p[1], r: 40, to: k + 2 };
        to.exit = { x: to.x0 + 140, y: Math.min(to.y0, to.fy - 280) - 60, r: 40, from: k };
      }
    }
    // bumpers: more of them further on, off to the sides and high, so the flipper shot stays readable
    const nb = r.int(d < 0.15 ? 0 : 1, 1 + Math.round(2 * d + r()));
    for (let i = 0; i < nb; i++) {
      const p = pick(s.x0 + 90, s.x1 - 80, top - 330, s.fy - 230, 110);
      if (p) s.bumpers.push({ x: p[0], y: p[1], r: 30, flash: 0 });
    }
    if (shape === 'ring' && s.bumpers.length) {
      const b = s.bumpers[0];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; s.stars.push({ x: b.x + Math.cos(a) * 78, y: b.y + Math.sin(a) * 78 }); }
    }
    // lanterns hang to the upper left, where a pass from the right flipper goes
    if (k >= 2 && r.chance(0.55)) {
      const lx = s.x0 + 80 + r.range(0, 40), ly = Math.min(s.y0, s.fy - 260) - r.range(40, 120);
      for (let i = 0; i < 3; i++) {
        const x = lx + i * 64, y = ly + Math.sin(i * 1.4) * 24;
        if (free(s, x, y, 40)) s.lanterns.push({ x, y, r: 14, lit: false, flash: 0 });
      }
      if (s.lanterns.length < 3) s.lanterns.length = 0;
    }
    // a mill turns in the air near the right ridge and can block or fling a shot
    if (k >= 6 && r.chance(0.15 + 0.4 * d)) {
      const x = s.x1 - s.Wr * r.range(0.3, 0.5), y = s.y1 - r.range(70, 150);
      const half = r.range(70, 92);
      if (free(s, x, y, half + 30, [...s.bumpers, ...s.lanterns])) {
        s.mills.push({ x, y, half, r: 9, a: r.range(0, Math.PI), om: (r.chance(0.5) ? 1 : -1) * r.range(1.3, 2.2) });
        // the mill stands on the ideal line: its stars move out of its sweep
        s.stars = s.stars.filter((st) => Math.hypot(st.x - x, st.y - y) > half + 26);
      }
    }
    if (k % 10 === 9) {
      const p = pick(s.cx - 40, s.cx + 120, top - 300, top - 200, 80, 60) || [s.cx + 40, top - 250];
      s.pearl = { x: p[0], y: p[1], r: 26 };
    }
  }
  // no star sits in the ground, whatever shape placed it
  s.stars = s.stars.filter((st) => st.y < groundY(s, st.x) - BALL_R - 10);
  decorate(s, r);
}

// A rail starts at a mouth high over the right ridge, sweeps over n islands (with a loop now and then) and lets the
// pearl drop into the bowl of station k + n.
function makeRail(world, s, n, r) {
  const mouth = { x: s.x1 - r.range(60, 110), y: s.y1 - r.range(110, 160), r: 34 };
  const pts = [[mouth.x, mouth.y], [mouth.x + 110, mouth.y - 100]];
  const hi = (st) => Math.min(st.y0, st.y1);
  const add = (x, y) => { if (x > pts[pts.length - 1][0] + 40) pts.push([x, y]); };
  if (r.chance(0.5)) {
    // a vertical loop just past the mouth: up the right side, over the top and down the left
    const rad = 100, cx = mouth.x + 300, cy = mouth.y - 100 - rad;
    pts.push([cx - 40, cy + rad]);
    for (let i = 1; i < 28; i++) { const a = Math.PI / 2 - (i / 28) * Math.PI * 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
    pts.push([cx + 60, cy + rad]);
  }
  for (let j = 1; j < n; j++) {
    const st = station(world, s.k + j);
    add(st.cx, hi(st) - 280 + r.range(-40, 40));
    add(st.x1, st.y1 - 230);
  }
  const end = station(world, s.k + n);
  add(end.x0 + end.Wl * 0.45, Math.min(end.y0, end.fy - 300) - 40);
  return { mouth, pts, to: s.k + n, length: pathLength(pts) };
}

export function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// A point on a polyline, a distance u along it, with its direction
export function pathAt(pts, u) {
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy);
    if (u <= l || i === pts.length - 1) {
      const t = Math.min(1, u / (l || 1));
      return { x: pts[i - 1][0] + dx * t, y: pts[i - 1][1] + dy * t, dx: dx / (l || 1), dy: dy / (l || 1) };
    }
    u -= l;
  }
  const p = pts[pts.length - 1];
  return { x: p[0], y: p[1], dx: 1, dy: 0 };
}

// Trees, lamps, reeds and crystals on the slopes, by biome. They do not collide.
function decorate(s, r) {
  const kinds = s.biome.deco;
  const place = (pts, from, to) => {
    const n = r.int(2, 4);
    for (let i = 0; i < n; i++) {
      const t = r.range(from, to), j = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const p = pts[j], q = pts[j + 1], f = t * (pts.length - 1) - j;
      s.deco.push({ kind: r.pick(kinds), x: p[0] + (q[0] - p[0]) * f, y: p[1] + (q[1] - p[1]) * f, s: r.range(0.75, 1.25), flip: r.chance(0.5), hue: r() });
    }
  };
  place(s.left, 0.05, 0.6);
  place(s.right, 0.45, 0.95);
}
