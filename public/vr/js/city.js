// In Full Swing: the city. A seeded layout of the Big Smoke (streets, towers, the Needle, the Dome, the expressway),
// its colliders in a uniform grid over x/z, the ray and sphere queries, and every spot the game needs.
// Pure: no three, no DOM. Plain {x, y, z}. Node imports it for the tests.
import { WORLD, SWING } from "./config.js";

/* ---------------- helpers ---------------- */
// mulberry32: the same seed always builds the same city
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
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Layout numbers snap to half metres, so every edge is exact in floating point and the JSON stays short.
const half = (v) => Math.round(v * 2) / 2;
const r2 = (v) => Math.round(v * 100) / 100;
// Math.hypot boxes its arguments in V8; the per-step queries use these instead
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const len2 = (x, z) => Math.sqrt(x * x + z * z);
// horizontal distance from a point to a rectangle (0 inside)
function rectDist(r, x, z) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX), dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return len2(dx, dz);
}

/* ---------------- the map ---------------- */
const B = WORLD.bounds, SHORE = WORLD.shoreZ, NEEDLE = WORLD.needle, DOME = WORLD.dome;
const HARBOUR = 0, FINANCIAL = 1, OLDTOWN = 2, MARKET = 3, UPTOWN = 4, WAREHOUSE = 5;
export const DISTRICTS = [
  { id: HARBOUR, name: "Harbourfront", cx: -40, cz: 190, r: 300 },
  { id: FINANCIAL, name: "Financial", cx: -30, cz: -210, r: 240 },
  { id: OLDTOWN, name: "Old Town", cx: -470, cz: -300, r: 260 },
  { id: MARKET, name: "Market", cx: -200, cz: 50, r: 180 },
  { id: UPTOWN, name: "Uptown", cx: 0, cz: -620, r: 200 },
  { id: WAREHOUSE, name: "Warehouse", cx: 450, cz: -300, r: 260 },
];
// Everything south of the z = 110 street is the Harbourfront; elsewhere the nearest centre, scaled by its radius.
export function districtAt(x, z) {
  if (z > 110) return HARBOUR;
  let best = FINANCIAL, bd = Infinity;
  for (let i = 1; i < DISTRICTS.length; i++) {
    const D = DISTRICTS[i], d = Math.hypot(x - D.cx, z - D.cz) / D.r;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Street centre lines. They run the full length (xs: north-south, z from minZ to the shore; zs: east-west).
// The gaps are about 72 x 96 m. Two double blocks (around the start and the Dome) are cut by partial streets below.
const XS = [-594, -522, -450, -378, -306, -234, -162, -18, 150, 222, 294, 366, 438, 510, 582];
const ZS = [-658, -562, -466, -370, -274, -178, -82, 14, 110];
// Wider avenues and partial streets. axis "x": a north-south street with centre x = at, from z = from to z = to.
const AVENUES = [
  { axis: "z", at: 14, w: 30, from: B.minX, to: B.maxX },
  { axis: "z", at: -370, w: 30, from: B.minX, to: B.maxX },
  { axis: "x", at: -306, w: 30, from: B.minZ, to: SHORE },
  { axis: "x", at: 294, w: 30, from: B.minZ, to: SHORE },
  { axis: "x", at: -90, w: 20, from: B.minZ, to: 14 },
  { axis: "x", at: 66, w: 20, from: B.minZ, to: 110 },
  // The start avenue: 44 m of open air that carries the view from the start roof down to the Needle.
  { axis: "x", at: -90, w: 44, from: 110, to: 262 },
];
// The Harbourfront condo row sits between the z = 110 street and the expressway, in two bands with a lane between.
const HB = { z0: 120, z1: 262, lane0: 186, lane1: 196 };
// Open plazas: nothing is built this close to the Needle or the Dome (horizontal metres from the centre).
const NEEDLE_PLAZA = 34, DOME_PLAZA = DOME.r + 8;
// The expressway runs just south of the Dome, so its deck clears the Dome's base (config says z about 270).
const XWAY = { z: Math.max(WORLD.expressway.z, DOME.z + DOME.r + WORLD.expressway.w / 2 + 2), y: WORLD.expressway.y, w: WORLD.expressway.w, x0: B.minX, x1: B.maxX };
// Parks: whole blocks, picked by a point inside them.
const PARK_AT = [[-414, -130], [186, -514], [-267, 64]];
// The start building: a 44 m brick roof on the Market side of the z = 110 street, facing the Needle down the avenue.
const START_LOT = { minX: -89, minZ: 59, maxX: -63, maxZ: 85 };
const START_H = 44;

const lineWidth = (at, axis) => {
  for (const a of AVENUES) if (a.axis === axis && a.at === at && a.to - a.from > 900) return a.w;
  return WORLD.street;
};

// Every street as rectangles, for the layout rules and the tests.
function streetRects() {
  const out = [];
  for (const x of XS) { const w = lineWidth(x, "x"); out.push({ minX: x - w / 2, maxX: x + w / 2, minZ: B.minZ, maxZ: SHORE }); }
  for (const z of ZS) { const w = lineWidth(z, "z"); out.push({ minX: B.minX, maxX: B.maxX, minZ: z - w / 2, maxZ: z + w / 2 }); }
  for (const a of AVENUES) {
    if (a.axis === "x") out.push({ minX: a.at - a.w / 2, maxX: a.at + a.w / 2, minZ: a.from, maxZ: a.to });
    else out.push({ minX: a.from, maxX: a.to, minZ: a.at - a.w / 2, maxZ: a.at + a.w / 2 });
  }
  return out;
}

// The spaces between street lines, from lo to hi.
function gaps(lines, axis, lo, hi) {
  const out = [];
  let a = lo;
  for (const at of lines) { const w = lineWidth(at, axis); out.push([a, at - w / 2]); a = at + w / 2; }
  out.push([a, hi]);
  return out.filter(([p, q]) => q - p >= 8);
}

// Blocks: the grid cells, cut again by the partial north-south streets.
function makeBlocks() {
  const xg = gaps(XS, "x", B.minX + 4, B.maxX - 4);
  const zg = gaps(ZS, "z", B.minZ + 4, HB.z1);
  const blocks = [];
  for (const [z0, z1] of zg) {
    for (const [x0, x1] of xg) {
      let parts = [[x0, x1]];
      const zc = (z0 + z1) / 2;
      for (const a of AVENUES) {
        if (a.axis !== "x" || a.to - a.from > 900 || zc < a.from || zc > a.to) continue;
        const e0 = a.at - a.w / 2, e1 = a.at + a.w / 2, next = [];
        for (const [p, q] of parts) {
          if (e1 <= p || e0 >= q) { next.push([p, q]); continue; }
          if (e0 - p >= 8) next.push([p, e0]);
          if (q - e1 >= 8) next.push([e1, q]);
        }
        parts = next;
      }
      for (const [p, q] of parts) blocks.push({ minX: p, maxX: q, minZ: z0, maxZ: z1 });
    }
  }
  return blocks;
}

/* ---------------- lots and buildings ---------------- */
// How each district cuts a block into lots: longest side, alley between lots, shortest side kept.
const LOTS = {
  [HARBOUR]: { max: 70, alley: 10, min: 20 }, // one tower per band, 66 m deep
  [FINANCIAL]: { max: 44, alley: 10, min: 18 }, // 10 m alleys between 150-250 m towers: the deep canyons
  [OLDTOWN]: { max: 26, alley: 3, min: 9 },
  [MARKET]: { max: 30, alley: 4, min: 10 },
  [UPTOWN]: { max: 46, alley: 8, min: 16 },
  [WAREHOUSE]: { max: 54, alley: 6, min: 18 },
};

// Cut a rectangle in two along its longer side until each piece is small enough.
function splitLots(r, P, rnd, out) {
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  if (w < P.min || d < P.min) return;
  if (w <= P.max && d <= P.max) { out.push(r); return; }
  const alongX = w >= d;
  const len = alongX ? w : d;
  const room = len - P.alley;
  if (room < 2 * P.min) { out.push(r); return; }
  const t = clamp(0.4 + 0.2 * rnd(), P.min / room, 1 - P.min / room);
  const a = half((alongX ? r.minX : r.minZ) + room * t);
  const b = a + P.alley;
  if (alongX) {
    splitLots({ minX: r.minX, maxX: a, minZ: r.minZ, maxZ: r.maxZ }, P, rnd, out);
    splitLots({ minX: b, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ }, P, rnd, out);
  } else {
    splitLots({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: a }, P, rnd, out);
    splitLots({ minX: r.minX, maxX: r.maxX, minZ: b, maxZ: r.maxZ }, P, rnd, out);
  }
}

// Keep a lot clear of a round plaza: cut the side that faces it, keep the biggest piece, or drop the lot.
function trimCircle(r, cx, cz, R, min) {
  if (rectDist(r, cx, cz) >= R) return r;
  const opts = [
    { ...r, maxX: Math.min(r.maxX, Math.floor(cx - R)) }, { ...r, minX: Math.max(r.minX, Math.ceil(cx + R)) },
    { ...r, maxZ: Math.min(r.maxZ, Math.floor(cz - R)) }, { ...r, minZ: Math.max(r.minZ, Math.ceil(cz + R)) },
  ];
  let best = null, area = 0;
  for (const o of opts) {
    const w = o.maxX - o.minX, d = o.maxZ - o.minZ;
    if (w >= min && d >= min && w * d > area) { best = o; area = w * d; }
  }
  return best;
}

// A lot is on an avenue if one of its sides faces a wide street: those rows get taller, so the avenues read as
// lines of towers you can chain swings along.
function onAvenue(r) {
  for (const a of AVENUES) {
    if (a.w < 30) continue;
    if (a.axis === "x" && (Math.abs(r.minX - (a.at + a.w / 2)) < 1 || Math.abs(r.maxX - (a.at - a.w / 2)) < 1)) return true;
    if (a.axis === "z" && (Math.abs(r.minZ - (a.at + a.w / 2)) < 1 || Math.abs(r.maxZ - (a.at - a.w / 2)) < 1)) return true;
  }
  return false;
}

function pick(rnd, table) {
  let t = rnd() * table.reduce((s, e) => s + e[1], 0);
  for (const [k, w] of table) { t -= w; if (t <= 0) return k; }
  return table[table.length - 1][0];
}
const KINDS = {
  [HARBOUR]: [["glass", 1]],
  [FINANCIAL]: [["glass", 55], ["stone", 20], ["concrete", 20], ["gold", 5]],
  [OLDTOWN]: [["brick", 65], ["stone", 35]],
  [MARKET]: [["brick", 60], ["concrete", 40]],
  [UPTOWN]: [["glass", 45], ["concrete", 35], ["stone", 20]],
  [WAREHOUSE]: [["loft", 75], ["brick", 25]],
};

// Height by district (spec §4.2): the Financial core rises toward its centre, the low districts stay low
// except along the avenues.
function heightFor(dist, r, rnd) {
  const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2, av = onAvenue(r);
  if (dist === FINANCIAL) {
    const t = clamp(1 - Math.hypot(cx + 30, cz + 210) / 260, 0, 1);
    return clamp(120 + 70 * t + 70 * rnd() * (0.4 + 0.6 * t), 120, 250);
  }
  if (dist === UPTOWN) return clamp(60 + 100 * Math.pow(rnd(), av ? 0.6 : 1.4), 60, 160);
  if (dist === OLDTOWN) return av ? 28 + 17 * rnd() : 12 + 33 * Math.pow(rnd(), 1.6);
  if (dist === MARKET) return av ? 26 + 19 * rnd() : 12 + 33 * Math.pow(rnd(), 1.3);
  if (dist === WAREHOUSE) return 18 + 22 * rnd();
  return 80 + 100 * rnd();
}

// Setback tiers, one box each. Towers get 1-3; the Harbourfront gets a podium and a tower; low buildings get one.
function tiersFor(r, h, dist, rnd, flank) {
  const tiers = [];
  const box = (minX, minZ, maxX, maxZ, y0, y1) => tiers.push({ minX: half(minX), minZ: half(minZ), maxX: half(maxX), maxZ: half(maxZ), y0: half(y0), y1: half(y1) });
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  if (flank) {
    // the two towers that frame the start avenue: a sheer wall to 75 % of the height, then a crown
    const y0 = Math.max(100, h * 0.75);
    box(r.minX, r.minZ, r.maxX, r.maxZ, 0, y0);
    box(r.minX + 3, r.minZ + 3, r.maxX - 3, r.maxZ - 3, y0, h);
    return tiers;
  }
  if (dist === HARBOUR) {
    // podium, then a slim tower flush with one corner of the podium, then sometimes a crown
    const p = 10 + 10 * rnd();
    box(r.minX, r.minZ, r.maxX, r.maxZ, 0, p);
    const tw = Math.max(16, w * (0.55 + 0.2 * rnd())), td = Math.max(16, d * (0.5 + 0.2 * rnd()));
    const tx = rnd() < 0.5 ? r.minX : r.maxX - tw, tz = rnd() < 0.5 ? r.minZ : r.maxZ - td;
    if (rnd() < 0.5 && tw > 22 && td > 22) {
      const hc = h * (0.88 + 0.06 * rnd());
      box(tx, tz, tx + tw, tz + td, p, hc);
      box(tx + 3, tz + 3, tx + tw - 3, tz + td - 3, hc, h);
    } else box(tx, tz, tx + tw, tz + td, p, h);
    return tiers;
  }
  if (h < 60) { box(r.minX, r.minZ, r.maxX, r.maxZ, 0, h); return tiers; }
  let n = 1 + Math.floor(rnd() * 3);
  if (Math.min(w, d) < 26) n = Math.min(n, 2);
  if (Math.min(w, d) < 20) n = 1;
  if (n === 1) { box(r.minX, r.minZ, r.maxX, r.maxZ, 0, h); return tiers; }
  const y1 = h * (n === 2 ? 0.6 + 0.2 * rnd() : 0.5 + 0.15 * rnd());
  box(r.minX, r.minZ, r.maxX, r.maxZ, 0, y1);
  const i1 = Math.min(2 + Math.floor(rnd() * 4), (Math.min(w, d) - 12) / 2);
  if (n === 2) { box(r.minX + i1, r.minZ + i1, r.maxX - i1, r.maxZ - i1, y1, h); return tiers; }
  const y2 = h * (0.8 + 0.1 * rnd());
  box(r.minX + i1, r.minZ + i1, r.maxX - i1, r.maxZ - i1, y1, y2);
  const i2 = Math.min(i1 + 2 + Math.floor(rnd() * 3), (Math.min(w, d) - 10) / 2);
  box(r.minX + i2, r.minZ + i2, r.maxX - i2, r.maxZ - i2, y2, h);
  return tiers;
}

// Fill the city with buildings. Returns { buildings, parks }.
function makeBuildings(rnd) {
  const buildings = [], parks = [];
  const add = (r, dist, h, kind, opts = {}) => {
    const tiers = tiersFor(r, h, dist, rnd, opts.flank);
    const top = tiers[tiers.length - 1].y1;
    buildings.push({
      id: buildings.length, x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, w: r.maxX - r.minX, d: r.maxZ - r.minZ, h: top,
      kind, district: dist, tiers, roofY: top, seed: Math.floor(rnd() * 1e6),
    });
  };
  // the start building comes first, so its id is 0
  add(START_LOT, MARKET, START_H, "brick");
  for (const blk of makeBlocks()) {
    const cx = (blk.minX + blk.maxX) / 2, cz = (blk.minZ + blk.maxZ) / 2;
    if (PARK_AT.some(([px, pz]) => px > blk.minX && px < blk.maxX && pz > blk.minZ && pz < blk.maxZ)) { parks.push({ ...blk }); continue; }
    const dist = districtAt(cx, cz), P = LOTS[dist];
    // cut the block into rectangles to fill
    let areas = [blk];
    if (dist === HARBOUR) {
      areas = [{ ...blk, maxZ: HB.lane0 }, { ...blk, minZ: HB.lane1 }];
    } else if (START_LOT.minX > blk.minX && START_LOT.maxX < blk.maxX && START_LOT.minZ > blk.minZ && START_LOT.maxZ < blk.maxZ) {
      // around the start building, with alleys of 6-7 m
      areas = [
        { ...blk, maxX: START_LOT.minX - 6 }, { ...blk, minX: START_LOT.maxX + 6 },
        { minX: START_LOT.minX, maxX: START_LOT.maxX, minZ: blk.minZ, maxZ: START_LOT.minZ - 7 },
      ];
    }
    const lots = [];
    for (const a of areas) splitLots(a, P, rnd, lots);
    for (let lot of lots) {
      lot = trimCircle(lot, NEEDLE.x, NEEDLE.z, NEEDLE_PLAZA, P.min);
      if (lot) lot = trimCircle(lot, DOME.x, DOME.z, DOME_PLAZA, P.min);
      if (!lot) continue;
      // the whole block belongs to one district, so a lot is always cut to its own district's size
      const ld = dist;
      // a few Financial lots stay open as small plazas at the foot of the towers
      if (ld === FINANCIAL && rnd() < 0.07) continue;
      // the two towers on either side of the start avenue, just past the z = 110 street
      const flank = ld === HARBOUR && lot.minZ === HB.z0 && (lot.maxX === -112 || lot.minX === -68);
      const h = half(flank ? 140 + 30 * rnd() : heightFor(ld, lot, rnd));
      add(lot, ld, h, pick(rnd, KINDS[ld]), { flank });
    }
  }
  // Three landmark towers at the heart of the Financial core, one of them gold.
  const core = buildings.filter((b) => b.district === FINANCIAL && b.w >= 28 && b.d >= 28)
    .sort((a, b) => Math.hypot(a.x + 30, a.z + 210) - Math.hypot(b.x + 30, b.z + 210)).slice(0, 3);
  core.forEach((b, i) => {
    const r = b.tiers[0];
    b.h = b.roofY = half(236 + 24 * rnd());
    b.tiers = tiersFor(r, b.h, FINANCIAL, rnd, false);
    b.h = b.roofY = b.tiers[b.tiers.length - 1].y1;
    b.kind = i === 1 ? "gold" : "glass";
  });
  return { buildings, parks };
}

/* ---------------- colliders ---------------- */
function makeColliders(buildings) {
  const cols = [];
  const box = (minX, minY, minZ, maxX, maxY, maxZ, tag, bid = -1) => cols.push({ type: "box", id: cols.length, minX, minY, minZ, maxX, maxY, maxZ, tag, bid });
  const cyl = (x, z, r, y0, y1, tag) => cols.push({ type: "cyl", id: cols.length, x, z, r: r2(r), y0, y1, tag });
  for (const b of buildings) for (const t of b.tiers) box(t.minX, t.y0, t.minZ, t.maxX, t.y1, t.maxZ, "building", b.id);
  // The Needle: shaft, four collars you can hang from, the walkable deck under the pod, the pod, the antenna.
  const N = NEEDLE;
  cyl(N.x, N.z, N.shaftR, 0, N.podY0, "needle");
  for (const y of N.collars) cyl(N.x, N.z, N.shaftR + 0.4, y - 0.75, y + 0.75, "needle");
  cyl(N.x, N.z, N.podR + 3, N.deckY - 1, N.deckY, "needle");
  cyl(N.x, N.z, N.podR, N.podY0, N.podY1, "needle");
  cyl(N.x, N.z, 3.2, N.podY1, 322, "needle");
  cyl(N.x, N.z, 1.4, 322, N.top, "needle");
  // The Dome: stacked drums inside the shell (radius taken half way up each drum of a squashed half-sphere).
  const lv = [0, 12, 22, 30, 36, DOME.h];
  for (let i = 0; i < lv.length - 1; i++) {
    const ym = (lv[i] + lv[i + 1]) / 2;
    cyl(DOME.x, DOME.z, DOME.r * Math.sqrt(1 - (ym / DOME.h) ** 2), lv[i], lv[i + 1], "dome");
  }
  // The expressway: 80 m deck slabs, and piers every 40 m between the slab joints.
  const X = XWAY, hw = X.w / 2;
  for (let x = X.x0; x < X.x1; x += 80) box(x, X.y - 1.5, X.z - hw, Math.min(x + 80, X.x1), X.y, X.z + hw, "expressway");
  for (let x = X.x0 + 20; x < X.x1; x += 40) box(x - 1.5, 0, X.z - 5, x + 1.5, X.y - 1.5, X.z + 5, "expressway");
  return cols;
}

/* ---------------- the grid and the queries ---------------- */
// A uniform grid over x/z. Each cell lists the colliders whose footprint touches it, so a ray walks the cells it
// crosses (2D DDA) and a sphere looks only at the cells under it.
const CELL = 32;
const MAST_R = 0.45; // a roof antenna's collider: wider than the drawn pole, so a rope finds it

function makeQueries(cols) {
  const x0 = B.minX - 64, z0 = B.minZ - 64;
  const nx = Math.ceil((B.maxX + 64 - x0) / CELL), nz = Math.ceil((SHORE + 64 - z0) / CELL);
  const x1 = x0 + nx * CELL, z1 = z0 + nz * CELL;
  let maxY = 0;
  const foot = (c) => (c.type === "box" ? [c.minX, c.minZ, c.maxX, c.maxZ] : [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r]);
  const cellRange = (a, b, o, n) => [clamp(Math.floor((a - o) / CELL), 0, n - 1), clamp(Math.floor((b - o) / CELL), 0, n - 1)];
  // compressed rows: start[cell] .. start[cell + 1] index into items
  const start = new Int32Array(nx * nz + 1);
  for (const c of cols) {
    const [a, b, p, q] = foot(c), [i0, i1] = cellRange(a, p, x0, nx), [k0, k1] = cellRange(b, q, z0, nz);
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) start[k * nx + i + 1]++;
    maxY = Math.max(maxY, c.type === "box" ? c.maxY : c.y1);
  }
  for (let i = 0; i < nx * nz; i++) start[i + 1] += start[i];
  const items = new Int32Array(start[nx * nz]), fill = start.slice(0, nx * nz);
  for (const c of cols) {
    const [a, b, p, q] = foot(c), [i0, i1] = cellRange(a, p, x0, nx), [k0, k1] = cellRange(b, q, z0, nz);
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) items[fill[k * nx + i]++] = c.id;
  }
  // Each query stamps the colliders it has seen, so a collider in several cells is tested once.
  const mark = new Uint32Array(cols.length);
  let stamp = 0;
  const nextStamp = () => { if (++stamp > 0xfffffff0) { mark.fill(0); stamp = 1; } return stamp; };

  /* ---- rays ---- */
  // face codes: 0..5 box -x +x -y +y -z +z, 6 cylinder side, 7 top cap, 8 bottom cap
  let face = -1;
  // slab test; a ray that starts inside a box does not hit it
  function rayBox(c, ox, oy, oz, dx, dy, dz, tMax) {
    let tn = -Infinity, tf = Infinity, f = -1;
    if (dx === 0) { if (ox < c.minX || ox > c.maxX) return Infinity; }
    else { const a = (c.minX - ox) / dx, b = (c.maxX - ox) / dx; if (Math.min(a, b) > tn) { tn = Math.min(a, b); f = dx > 0 ? 0 : 1; } tf = Math.min(tf, Math.max(a, b)); }
    if (dy === 0) { if (oy < c.minY || oy > c.maxY) return Infinity; }
    else { const a = (c.minY - oy) / dy, b = (c.maxY - oy) / dy; if (Math.min(a, b) > tn) { tn = Math.min(a, b); f = dy > 0 ? 2 : 3; } tf = Math.min(tf, Math.max(a, b)); }
    if (dz === 0) { if (oz < c.minZ || oz > c.maxZ) return Infinity; }
    else { const a = (c.minZ - oz) / dz, b = (c.maxZ - oz) / dz; if (Math.min(a, b) > tn) { tn = Math.min(a, b); f = dz > 0 ? 4 : 5; } tf = Math.min(tf, Math.max(a, b)); }
    if (tn > tf || tn < 0 || tn >= tMax) return Infinity;
    face = f;
    return tn;
  }
  // vertical cylinder with caps; a ray that starts inside does not hit it
  function rayCyl(c, ox, oy, oz, dx, dy, dz, tMax) {
    const px = ox - c.x, pz = oz - c.z, rr = c.r * c.r;
    let best = tMax, f = -1;
    const a = dx * dx + dz * dz, cc = px * px + pz * pz - rr;
    if (a > 1e-12 && cc > 0) {
      const b = px * dx + pz * dz, disc = b * b - a * cc;
      if (disc >= 0) {
        const t = (-b - Math.sqrt(disc)) / a, y = oy + dy * t;
        if (t >= 0 && t < best && y >= c.y0 && y <= c.y1) { best = t; f = 6; }
      }
    }
    if (dy < 0 && oy >= c.y1) {
      const t = (c.y1 - oy) / dy, hx = px + dx * t, hz = pz + dz * t;
      if (t < best && hx * hx + hz * hz <= rr) { best = t; f = 7; }
    } else if (dy > 0 && oy <= c.y0) {
      const t = (c.y0 - oy) / dy, hx = px + dx * t, hz = pz + dz * t;
      if (t < best && hx * hx + hz * hz <= rr) { best = t; f = 8; }
    }
    if (f < 0) return Infinity;
    face = f;
    return best;
  }

  // Walks the cells the ray crosses, nearest first, and stops once the best hit lies before the next cell.
  // d need not be unit length; t in out is metres along the ray. Returns out, or null for no hit within maxDist.
  function raycast(ox, oy, oz, dx, dy, dz, maxDist, out) {
    const len = len3(dx, dy, dz);
    if (!(len > 0) || !(maxDist > 0)) return null;
    dx /= len; dy /= len; dz /= len;
    let t0 = 0, t1 = maxDist;
    // clip to the grid and to the height of the tallest collider
    if (dx === 0) { if (ox < x0 || ox > x1) return null; } else { const a = (x0 - ox) / dx, b = (x1 - ox) / dx; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); }
    if (dz === 0) { if (oz < z0 || oz > z1) return null; } else { const a = (z0 - oz) / dz, b = (z1 - oz) / dz; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); }
    if (dy === 0) { if (oy < -1 || oy > maxY + 1) return null; } else { const a = (-1 - oy) / dy, b = (maxY + 1 - oy) / dy; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); }
    if (t0 > t1) return null;
    let ix = clamp(Math.floor((ox + dx * t0 - x0) / CELL), 0, nx - 1), iz = clamp(Math.floor((oz + dz * t0 - z0) / CELL), 0, nz - 1);
    const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sz = dz > 0 ? 1 : dz < 0 ? -1 : 0;
    let tx = sx > 0 ? (x0 + (ix + 1) * CELL - ox) / dx : sx < 0 ? (x0 + ix * CELL - ox) / dx : Infinity;
    let tz = sz > 0 ? (z0 + (iz + 1) * CELL - oz) / dz : sz < 0 ? (z0 + iz * CELL - oz) / dz : Infinity;
    const ddx = sx ? CELL / Math.abs(dx) : Infinity, ddz = sz ? CELL / Math.abs(dz) : Infinity;
    const s = nextStamp();
    let best = t1, hit = -1, hitFace = -1;
    for (;;) {
      const cell = iz * nx + ix;
      for (let p = start[cell], e = start[cell + 1]; p < e; p++) {
        const k = items[p];
        if (mark[k] === s) continue;
        mark[k] = s;
        const c = cols[k];
        const t = c.type === "box" ? rayBox(c, ox, oy, oz, dx, dy, dz, best) : rayCyl(c, ox, oy, oz, dx, dy, dz, best);
        if (t < best) { best = t; hit = k; hitFace = face; }
      }
      const tn = Math.min(tx, tz);
      if (best <= tn || tn > t1) break;
      if (tx < tz) { ix += sx; tx += ddx; if (ix < 0 || ix >= nx) break; } else { iz += sz; tz += ddz; if (iz < 0 || iz >= nz) break; }
    }
    if (hit < 0) return null;
    const c = cols[hit], o = out || {};
    o.t = best; o.x = ox + dx * best; o.y = oy + dy * best; o.z = oz + dz * best; o.collider = c;
    o.nx = 0; o.ny = 0; o.nz = 0;
    if (hitFace === 6) { o.nx = (o.x - c.x) / c.r; o.nz = (o.z - c.z) / c.r; }
    else if (hitFace === 7) o.ny = 1;
    else if (hitFace === 8) o.ny = -1;
    else if (hitFace < 2) o.nx = hitFace === 0 ? -1 : 1;
    else if (hitFace < 4) o.ny = hitFace === 2 ? -1 : 1;
    else o.nz = hitFace === 4 ? -1 : 1;
    return o;
  }

  /* ---- spheres ---- */
  const PO = { x: 0, y: 0, z: 0 };
  // The smallest move that takes a sphere out of one collider, in PO. False when they do not touch.
  function pushOut(c, px, py, pz, r) {
    if (c.type === "box") {
      const qx = clamp(px, c.minX, c.maxX), qy = clamp(py, c.minY, c.maxY), qz = clamp(pz, c.minZ, c.maxZ);
      const ex = px - qx, ey = py - qy, ez = pz - qz, d2 = ex * ex + ey * ey + ez * ez;
      if (d2 >= r * r) return false;
      if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; PO.x = ex * k; PO.y = ey * k; PO.z = ez * k; return true; }
      // the centre is inside: leave through the nearest face
      const m = [px - c.minX, c.maxX - px, py - c.minY, c.maxY - py, pz - c.minZ, c.maxZ - pz];
      let j = 0;
      for (let i = 1; i < 6; i++) if (m[i] < m[j]) j = i;
      PO.x = PO.y = PO.z = 0;
      const v = m[j] + r;
      if (j === 0) PO.x = -v; else if (j === 1) PO.x = v; else if (j === 2) PO.y = -v; else if (j === 3) PO.y = v; else if (j === 4) PO.z = -v; else PO.z = v;
      return true;
    }
    const ex = px - c.x, ez = pz - c.z, dxz = len2(ex, ez), qy = clamp(py, c.y0, c.y1);
    if (dxz > c.r) {
      const qx = c.x + ex * c.r / dxz, qz = c.z + ez * c.r / dxz;
      const fx = px - qx, fy = py - qy, fz = pz - qz, d = len3(fx, fy, fz);
      if (d >= r || d < 1e-9) return false;
      const k = (r - d) / d; PO.x = fx * k; PO.y = fy * k; PO.z = fz * k;
      return true;
    }
    if (py > c.y1 || py < c.y0) {
      const d = Math.abs(py - qy);
      if (d >= r) return false;
      PO.x = PO.z = 0; PO.y = (py > c.y1 ? 1 : -1) * (r - d);
      return true;
    }
    // the centre is inside the drum: out through the side, the top or the bottom, whichever is nearest
    const side = c.r - dxz + r, up = c.y1 - py + r, down = py - c.y0 + r;
    PO.x = PO.y = PO.z = 0;
    if (side <= up && side <= down) {
      const ux = dxz > 1e-9 ? ex / dxz : 1, uz = dxz > 1e-9 ? ez / dxz : 0;
      PO.x = ux * side; PO.z = uz * side;
    } else if (up <= down) PO.y = up;
    else PO.y = -down;
    return true;
  }

  // Fills NEAR with the ids of the colliders whose cells touch the square of half-size r around (x, z), each once.
  // Returns how many. No allocation, so the physics can call it every step.
  const NEAR = new Int32Array(cols.length);
  const cellOf = (v, o, n) => clamp(Math.floor((v - o) / CELL), 0, n - 1);
  function gather(x, z, r) {
    const s = nextStamp(), i0 = cellOf(x - r, x0, nx), i1 = cellOf(x + r, x0, nx), k0 = cellOf(z - r, z0, nz), k1 = cellOf(z + r, z0, nz);
    let n = 0;
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const cell = k * nx + i;
      for (let p = start[cell], e = start[cell + 1]; p < e; p++) {
        const id = items[p];
        if (mark[id] === s) continue;
        mark[id] = s;
        NEAR[n++] = id;
      }
    }
    return n;
  }
  function overlapsAny(x, y, z, r) {
    const n = gather(x, z, r);
    for (let j = 0; j < n; j++) if (surfaceDist(cols[NEAR[j]], x, y, z) < r - 1e-6) return true;
    return false;
  }
  // A sphere stuck where two solids meet (the shaft under the deck, a pier under a slab) can bounce between them.
  // Then try every face of every solid it touches and take the nearest spot that is clear of all of them.
  const EX = new Float64Array(64 * 4);
  function unstick(x, y, z, r) {
    let m = 0;
    const add = (ax, ay, az) => { if (m < EX.length) { EX[m] = ax; EX[m + 1] = ay; EX[m + 2] = az; EX[m + 3] = (ax - x) ** 2 + (ay - y) ** 2 + (az - z) ** 2; m += 4; } };
    const n = gather(x, z, r);
    for (let j = 0; j < n; j++) {
      const c = cols[NEAR[j]];
      if (surfaceDist(c, x, y, z) >= r) continue;
      if (c.type === "box") {
        add(c.minX - r, y, z); add(c.maxX + r, y, z); add(x, c.minY - r, z); add(x, c.maxY + r, z); add(x, y, c.minZ - r); add(x, y, c.maxZ + r);
      } else {
        const ex = x - c.x, ez = z - c.z, l = len2(ex, ez), ux = l > 1e-9 ? ex / l : 1, uz = l > 1e-9 ? ez / l : 0;
        add(c.x + ux * (c.r + r), y, c.z + uz * (c.r + r)); add(x, c.y1 + r, z); add(x, c.y0 - r, z);
      }
    }
    let best = -1;
    for (let i = 0; i < m; i += 4) {
      if (best >= 0 && EX[i + 3] >= EX[best + 3]) continue;
      if (!overlapsAny(EX[i], EX[i + 1], EX[i + 2], r)) best = i;
    }
    if (best < 0) return false;
    PO.x = EX[best]; PO.y = EX[best + 1]; PO.z = EX[best + 2];
    return true;
  }

  // Pushes a sphere out of every collider it overlaps (a few passes, for corners and stacks).
  // out gets the new centre and the unit direction of the total push. Returns true if anything was touched.
  function collideSphere(x, y, z, r, out) {
    let px = x, py = y, pz = z, hit = false, moved = false;
    for (let pass = 0; pass < 3; pass++) {
      moved = false;
      const n = gather(px, pz, r);
      for (let j = 0; j < n; j++) if (pushOut(cols[NEAR[j]], px, py, pz, r)) { px += PO.x; py += PO.y; pz += PO.z; hit = moved = true; }
      if (!moved) break;
    }
    if (moved && overlapsAny(px, py, pz, r) && unstick(x, y, z, r)) { px = PO.x; py = PO.y; pz = PO.z; }
    if (out) {
      const ex = px - x, ey = py - y, ez = pz - z, l = len3(ex, ey, ez);
      out.x = px; out.y = py; out.z = pz;
      if (l > 1e-12) { out.nx = ex / l; out.ny = ey / l; out.nz = ez / l; } else { out.nx = 0; out.ny = 1; out.nz = 0; }
    }
    return hit;
  }

  // The highest collider top at or below y under a disc of radius r around (x, z). Reuses one result object.
  const TB = { y: 0, collider: null };
  function topBelow(x, y, z, r = 0) {
    let best = -Infinity, bc = null;
    const n = gather(x, z, r);
    for (let j = 0; j < n; j++) {
      const c = cols[NEAR[j]];
      const top = c.type === "box" ? c.maxY : c.y1;
      if (top > y || top <= best) continue;
      const over = c.type === "box" ? rectDist(c, x, z) <= r : len2(x - c.x, z - c.z) <= c.r + r;
      if (over) { best = top; bc = c; }
    }
    if (!bc) return null;
    TB.y = best; TB.collider = bc;
    return TB;
  }

  // Distance from a point to the nearest collider within R (Infinity if none). filter(c) can skip colliders.
  function nearestSurface(x, y, z, R, filter) {
    let best = Infinity;
    const n = gather(x, z, R);
    for (let j = 0; j < n; j++) {
      const c = cols[NEAR[j]];
      if (filter && !filter(c)) continue;
      best = Math.min(best, surfaceDist(c, x, y, z));
    }
    return best <= R ? best : Infinity;
  }

  return { raycast, collideSphere, topBelow, nearestSurface, grid: { x0, z0, nx, nz, cell: CELL } };
}

// Distance from a point to a collider (0 inside).
export function surfaceDist(c, x, y, z) {
  if (c.type === "box") {
    const dx = Math.max(c.minX - x, 0, x - c.maxX), dy = Math.max(c.minY - y, 0, y - c.maxY), dz = Math.max(c.minZ - z, 0, z - c.maxZ);
    return len3(dx, dy, dz);
  }
  const dr = Math.max(len2(x - c.x, z - c.z) - c.r, 0), dy = Math.max(c.y0 - y, 0, y - c.y1);
  return len2(dr, dy);
}

/* ---------------- spots ---------------- */
// The ideal first swing: walk from the start toward the gold ring, step off the roof, and swing on a rope of 97 %
// of the distance. A point mass with the game's gravity and drag and no walls; the first Loonies go along its path.
function firstSwingPath(start, roof, ring) {
  const g = SWING.gravity, cd = SWING.quadDragC, h = 1 / 60;
  let x = start.x, y = start.y + SWING.chestH, z = start.z;
  const hx = ring.x - x, hz = ring.z - z, hl = Math.hypot(hx, hz);
  let vx = (hx / hl) * SWING.ground.run, vy = 0, vz = (hz / hl) * SWING.ground.run;
  const L = Math.hypot(ring.x - x, ring.y - y, ring.z - z) * SWING.attachLengthFactor;
  const pts = [];
  let onRoof = true, rising = false;
  for (let i = 0; i < 60 * 10; i++) {
    if (onRoof && (x < roof.minX || x > roof.maxX || z < roof.minZ || z > roof.maxZ)) onRoof = false;
    if (!onRoof) {
      vy -= g * h;
      const s = Math.hypot(vx, vy, vz);
      vx -= vx * s * cd * h; vy -= vy * s * cd * h; vz -= vz * s * cd * h;
    }
    x += vx * h; y += vy * h; z += vz * h;
    const ex = x - ring.x, ey = y - ring.y, ez = z - ring.z, d = Math.hypot(ex, ey, ez);
    if (!onRoof && d > L) {
      const ux = ex / d, uy = ey / d, uz = ez / d, vr = vx * ux + vy * uy + vz * uz;
      x = ring.x + ux * L; y = ring.y + uy * L; z = ring.z + uz * L;
      if (vr > 0) { vx -= ux * vr; vy -= uy * vr; vz -= uz * vr; }
    }
    if (onRoof) continue;
    pts.push({ x, y, z });
    if (vy > 0) rising = true;
    else if (rising) break; // the far end of the arc
  }
  return pts;
}

// n rings spread evenly along a polyline of waypoints; each faces along the path.
function ringsAlong(way, n) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < way.length - 1; i++) {
    const a = way[i], b = way[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    seg.push({ a, b, l, s: total });
    total += l;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = (total * (i + 0.5)) / n;
    const sg = seg.find((q) => s <= q.s + q.l) || seg[seg.length - 1];
    const t = (s - sg.s) / sg.l, { a, b, l } = sg;
    out.push({
      x: r2(a[0] + (b[0] - a[0]) * t), y: r2(a[1] + (b[1] - a[1]) * t), z: r2(a[2] + (b[2] - a[2]) * t),
      nx: r2((b[0] - a[0]) / l), ny: r2((b[1] - a[1]) / l), nz: r2((b[2] - a[2]) / l), r: 5,
    });
  }
  return out;
}

/* ---------------- the city ---------------- */
// generate(seed) → City (spec §4.2). Deterministic: the same seed gives the same city, down to the last bit.
export function generate(seed = WORLD.seed) {
  const rnd = rng(seed);
  const { buildings, parks } = makeBuildings(rnd);
  const colliders = makeColliders(buildings);
  let Q = makeQueries(colliders); // rebuilt once the roof antennas are in (they keep clear of the spots chosen first)
  const N = NEEDLE;
  const OUT = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
  const topOf = (c) => (c.type === "box" ? c.maxY : c.y1);
  const isClear = (x, y, z, r) => !Q.collideSphere(x, y, z, r);
  const anchorNear = (x, y, z) => Q.nearestSurface(x, y, z, WORLD.anchorReach) <= WORLD.anchorReach;
  // Push a point out of the colliders until it has r of clear space; false if it cannot.
  const clearOut = (p, r) => {
    for (let i = 0; i < 6; i++) {
      if (!Q.collideSphere(p.x, p.y, p.z, r, OUT)) return true;
      p.x = OUT.x; p.y = OUT.y; p.z = OUT.z;
    }
    return isClear(p.x, p.y, p.z, r);
  };

  /* ---- the start and the gold ring ---- */
  const sb = buildings[0];
  const start = { x: sb.x, y: sb.roofY, z: sb.z, yaw: 0 };
  start.yaw = r2(Math.atan2(-(N.x - start.x), -(N.z - start.z)));
  // The gold ring: on the avenue face of the east flank tower, 35 m above your chest and 65 m away, so the first
  // swing bottoms out about 16 m over the street and runs along the tower, not into it.
  const flankE = buildings.find((b) => b.district === HARBOUR && b.tiers[0].minX === -68 && b.tiers[0].minZ === HB.z0);
  const goldRing = { x: flankE.tiers[0].minX, y: start.y + 36, z: flankE.tiers[0].minZ + 7, nx: -1, ny: 0, nz: 0 };

  /* ---- the Needle, the Dome, the expressway ---- */
  const toStart = Math.atan2(start.x - N.x, start.z - N.z);
  const pipes = [0, 1, 2].map((i) => {
    const a = toStart + (i * 2 * Math.PI) / 3, c = Math.cos(20 * Math.PI / 180);
    const dx = Math.sin(a), dz = Math.cos(a);
    return { id: i, x: r2(N.x + dx * (N.podR + 0.6)), y: N.podY1 - 2, z: r2(N.z + dz * (N.podR + 0.6)), nx: r2(dx * c), ny: r2(Math.sin(20 * Math.PI / 180)), nz: r2(dz * c) };
  });
  const needle = {
    x: N.x, z: N.z, shaftR: N.shaftR, podY0: N.podY0, podY1: N.podY1, podR: N.podR, top: N.top,
    collars: N.collars.map((y) => ({ y, r: N.shaftR + 0.4 })), deck: { y: N.deckY, r: N.podR + 3 }, pipes,
  };

  /* ---- Loonies ---- */
  const loonies = [];
  const addLoonie = (x, y, z, first = false) => loonies.push({ id: loonies.length, x: r2(x), y: r2(y), z: r2(z), first });
  // 8 on the ideal first swing, spread evenly along its arc (the part above 15 m), kept 1.7 m off the walls
  {
    const path = firstSwingPath(start, sb.tiers[0], goldRing).filter((p) => p.y >= 15);
    let len = 0;
    const acc = path.map((p, i) => (i ? (len += Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y, p.z - path[i - 1].z)) : 0));
    for (let i = 0; i < 8; i++) {
      const s = len * (0.06 + (0.88 * i) / 7);
      const j = Math.max(0, acc.findIndex((a) => a >= s));
      const p = { ...path[j] };
      if (!clearOut(p, 1.7)) p.y += 3;
      addLoonie(p.x, p.y, p.z, true);
    }
  }
  // 10 in a spiral around the Needle shaft
  for (let i = 0; i < 10; i++) {
    const a = toStart + i * 0.9;
    addLoonie(N.x + Math.sin(a) * 15, 30 + i * 24, N.z + Math.cos(a) * 15);
  }
  // 4 over the lake, close to the shore
  for (const [x, y, z] of [[-300, 17, 318], [-262, 19, 322], [190, 17, 318], [228, 19, 322]]) addLoonie(x, y, z);

  /* ---- clogs: two per district, on roofs with something taller close by ---- */
  const clogs = [];
  for (const D of DISTRICTS) {
    const cands = buildings.filter((b) => b.district === D.id && b.id !== sb.id && b.roofY >= 12).map((b) => {
      const t = b.tiers[b.tiers.length - 1];
      return { b, x: (t.minX + t.maxX) / 2, z: (t.minZ + t.maxZ) / 2, area: (t.maxX - t.minX) * (t.maxZ - t.minZ), k: rnd() };
    }).filter((c) => c.area >= 100).sort((p, q) => p.k - q.k);
    const got = [];
    for (const c of cands) {
      if (got.length === 2) break;
      if (got.some((g) => Math.hypot(g.x - c.x, g.z - c.z) < 150)) continue;
      const above = Q.nearestSurface(c.x, c.b.roofY + 1, c.z, WORLD.anchorReach, (k) => k.bid !== c.b.id && topOf(k) > c.b.roofY + 8);
      if (above > WORLD.anchorReach) continue;
      got.push(c);
    }
    // a district too small for the 150 m spread falls back to 20 m
    for (const c of cands) {
      if (got.length === 2) break;
      if (got.includes(c) || got.some((g) => Math.hypot(g.x - c.x, g.z - c.z) < 20)) continue;
      if (Q.nearestSurface(c.x, c.b.roofY + 1, c.z, WORLD.anchorReach, (k) => k.bid !== c.b.id && topOf(k) > c.b.roofY + 8) <= WORLD.anchorReach) got.push(c);
    }
    for (const c of got) clogs.push({ id: clogs.length, x: r2(c.x), y: c.b.roofY, z: r2(c.z), bid: c.b.id, district: D.id });
  }

  // 8 on roofs between 15 and 110 m (not the start roof, not a clog roof)
  {
    const taken = new Set([sb.id, ...clogs.map((c) => c.bid)]);
    const roofs = buildings.filter((b) => !taken.has(b.id) && b.roofY >= 15 && b.roofY <= 110).map((b) => ({ b, k: rnd() })).sort((p, q) => p.k - q.k);
    let n = 0;
    for (const { b } of roofs) {
      if (n === 8) break;
      const t = b.tiers[b.tiers.length - 1];
      if (t.maxX - t.minX < 10 || t.maxZ - t.minZ < 10) continue;
      const x = (t.minX + t.maxX) / 2, z = (t.minZ + t.maxZ) / 2, y = b.roofY + 1.7;
      if (loonies.some((l) => Math.hypot(l.x - x, l.z - z) < 120)) continue;
      if (!isClear(x, y, z, 1.6)) continue;
      addLoonie(x, y, z); n++;
    }
  }
  // The rest in chains of 5 along the streets, sagging like the bottom of a swing, at half the local skyline.
  {
    let tries = 0;
    const heights = (x, z) => {
      let s = 0, n = 0;
      for (const b of buildings) if (Math.abs(b.x - x) < 60 && Math.abs(b.z - z) < 60) { s += b.h; n++; }
      return n ? s / n : 0;
    };
    while (loonies.length < WORLD.loonies && tries++ < 2000) {
      const alongX = rnd() < 0.5;
      const x = alongX ? B.minX + 60 + rnd() * (B.maxX - B.minX - 120) : XS[Math.floor(rnd() * XS.length)];
      const z = alongX ? ZS[Math.floor(rnd() * (ZS.length - 1))] : B.minZ + 60 + rnd() * (60 - B.minZ);
      if (loonies.some((l) => Math.hypot(l.x - x, l.z - z) < 70)) continue;
      const H = heights(x, z);
      if (!H) continue;
      const y0 = clamp(H * 0.5, 18, 110), n = Math.min(5, WORLD.loonies - loonies.length);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 12, k = (i - (n - 1) / 2) / 2;
        pts.push({ x: alongX ? x + o : x, y: y0 + 5 * k * k, z: alongX ? z : z + o });
      }
      if (pts.every((p) => isClear(p.x, p.y, p.z, 1.6) && anchorNear(p.x, p.y, p.z))) for (const p of pts) addLoonie(p.x, p.y, p.z);
    }
  }

  /* ---- trials ---- */
  const fixRing = (r) => {
    for (let i = 0; i < 10 && !isClear(r.x, r.y, r.z, r.r + 1); i++) r.y = r2(r.y + 3);
    return r;
  };
  // Harbour Loop: east along the shore, up the -162 street, west along the z = 110 street, back down to the lake.
  const loop = ringsAlong([[-380, 20, 308], [-162, 22, 308], [-162, 34, 110], [-378, 30, 110], [-378, 22, 300]], 12).map(fixRing);
  // Tower Run: through the Financial canyons along the street centres, 65-115 m up.
  const run = ringsAlong([[-90, 66, 0], [-90, 80, -178], [-18, 92, -178], [-18, 104, -274], [66, 114, -274], [66, 100, -370], [150, 90, -370], [150, 80, -274], [222, 70, -274]], 14).map(fixRing);
  // Needle Drop: from the deck, a falling spiral on the lake side of the Needle, down to the street.
  const drop = [];
  for (let i = 0; i < 10; i++) {
    const a = -0.6 + (1.2 * i) / 9, R = 28 + i * 1.3;
    drop.push([N.x + Math.sin(a) * R, 240 - i * 25.8, N.z + Math.cos(a) * R]);
  }
  drop.push([N.x + Math.sin(0.73) * 42, -18, N.z + Math.cos(0.73) * 42]);
  const dropRings = drop.slice(0, 10).map(([x, y, z], i) => {
    const [bx, by, bz] = drop[i + 1], l = Math.hypot(bx - x, by - y, bz - z);
    return fixRing({ x: r2(x), y: r2(y), z: r2(z), nx: r2((bx - x) / l), ny: r2((by - y) / l), nz: r2((bz - z) / l), r: 5 });
  });
  // a trial starts on a roof: the nearest top tier of a fitting height, 15-70 m from the first ring
  const roofNear = (p, yMax) => {
    let best = null, bs = Infinity;
    for (const b of buildings) {
      const t = b.tiers[b.tiers.length - 1];
      if (b.id === sb.id || t.maxX - t.minX < 12 || t.maxZ - t.minZ < 12 || b.roofY > yMax) continue;
      const x = (t.minX + t.maxX) / 2, z = (t.minZ + t.maxZ) / 2, d = Math.hypot(x - p.x, b.roofY - p.y, z - p.z);
      if (d < 15 || d > 70) continue;
      const s = Math.abs(d - 40);
      if (s < bs) { bs = s; best = { x, y: b.roofY, z }; }
    }
    return best;
  };
  const trials = [
    { id: 0, name: "Harbour Loop", intense: false, start: { x: -400, y: XWAY.y, z: XWAY.z }, rings: loop },
    { id: 1, name: "Tower Run", intense: false, start: roofNear(run[0], run[0].y + 10) || { ...start }, rings: run },
    { id: 2, name: "Needle Drop", intense: true, start: { x: N.x, y: N.deckY, z: N.z + N.podR + 1.5 }, rings: dropRings },
  ];

  /* ---- safe spots: the start, and up to 4 roomy roofs per district, 90 m apart ---- */
  const safe = [{ x: start.x, y: start.y, z: start.z, bid: sb.id, district: sb.district }];
  for (const D of DISTRICTS) {
    const cands = buildings.filter((b) => b.district === D.id && b.id !== sb.id && b.roofY <= (D.id === HARBOUR ? 180 : 130)).map((b) => ({ b, k: rnd() })).sort((p, q) => p.k - q.k);
    let n = 0;
    for (const { b } of cands) {
      if (n === 4) break;
      const t = b.tiers[b.tiers.length - 1];
      if (t.maxX - t.minX < 14 || t.maxZ - t.minZ < 14) continue;
      const x = (t.minX + t.maxX) / 2, z = (t.minZ + t.maxZ) / 2;
      if (safe.some((s) => Math.hypot(s.x - x, s.z - z) < 90)) continue;
      safe.push({ x, y: b.roofY, z, bid: b.id, district: D.id }); n++;
    }
  }

  /* ---- queries ---- */
  const isWater = (x, z) => z > SHORE;
  const groundY = (x, z) => (z > SHORE ? -10 : 0); // the lake bed sits well under the surface, so you splash first
  /* ---- roof antennas on the tall towers: thin poles a rope catches and you can climb (cityview draws these) ---- */
  // One to three per roof over 60 m, 2.5 m in from the edges, 4 m apart, and 9 m from the start, the gold ring, every
  // clog, trial start and safe spot on that roof.
  const keep = [start, goldRing, ...clogs, ...trials.map((t) => t.start), ...safe];
  for (const b of buildings) {
    b.masts = [];
    const t = b.tiers[b.tiers.length - 1], w = t.maxX - t.minX, d = t.maxZ - t.minZ;
    if (b.roofY <= 60 || w < 8 || d < 8) continue;
    const r = rng(b.seed + 97), n = 1 + Math.floor(r() * (b.roofY > 150 ? 3 : 2));
    for (let tries = 0; b.masts.length < n && tries < 16; tries++) {
      const x = r2(t.minX + 2.5 + (w - 5) * r()), z = r2(t.minZ + 2.5 + (d - 5) * r()), h = r2(6 + ((b.roofY > 180 ? 26 : 14) - 6) * r());
      if (b.masts.some((m) => Math.hypot(m.x - x, m.z - z) < 4)) continue;
      if (keep.some((k) => Math.abs((k.y ?? t.y1) - t.y1) < 6 && Math.hypot(k.x - x, k.z - z) < 9)) continue;
      b.masts.push({ x, z, y: t.y1, h });
      colliders.push({ type: "cyl", id: colliders.length, x, z, r: MAST_R, y0: t.y1, y1: r2(t.y1 + h), tag: "antenna", bid: b.id });
    }
  }
  Q = makeQueries(colliders);

  const nearestSafe = (x, y, z) => {
    let best = safe[0], bd = Infinity;
    for (const s of safe) { const d = (s.x - x) ** 2 + (s.y - y) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  };

  return {
    seed, bounds: { ...B }, shoreZ: SHORE,
    buildings, colliders,
    streets: { xs: XS.slice(), zs: ZS.slice(), width: WORLD.street, avenues: AVENUES.map((a) => ({ ...a })) }, parks,
    districts: DISTRICTS.map((d) => ({ ...d })),
    needle, dome: { x: DOME.x, z: DOME.z, r: DOME.r, h: DOME.h }, expressway: { ...XWAY },
    start, clogs, loonies, goldRing, trials, safe,
    groundY, isWater, nearestSafe, districtAt,
    raycast: Q.raycast, collideSphere: Q.collideSphere, topBelow: Q.topBelow, nearestSurface: Q.nearestSurface,
  };
}
