// Loon Lake around the cottage dock: one map that the 3D world and the fish both read.
// Units are meters. Y is up. The angler stands at the end of the dock at x = 0, z = 0, and faces the lake (-z).
// +x is to the angler's right. The water surface is y = 0.
// height(x, z) > 0 is land (its height above the water). height(x, z) < 0 is water (minus its depth).

// a small seeded random, so every copy of the map is the same
export function rng(seed) {
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
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// smooth 2D value noise, about -1..1
function hash(ix, iz) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

// the dock: 2.4 m wide, from the angler back to the south shore
export const DOCK = { x0: -1.2, x1: 1.2, z0: -0.6, z1: 21, deck: 0.6 };
// where the eye and the reel are, when you stand at the end of the dock
export const EYE = { x: 0, y: 2.25, z: 0.35 };
export const ROD = { base: { x: 0.28, y: 1.45, z: -0.05 }, length: 2.3 };

// the lake is a wide bay; the dock sits in the middle of its south shore
const LX = 5, LZ = -95, RX = 140, RZ = 115;
// the rocky point comes out from the east shore; Clog Island sits far out to the north-east
export const POINT = { ax: 100, az: -32, bx: 38, bz: -27, r: 9 };
export const ISLAND = { x: 34, z: -128, r: 15, top: 9 };
// the weed flat and the lily pads, to the angler's left
export const WEEDS = { x0: -46, x1: -11, z0: -36, z1: -3 };
export const PADS = { x0: -36, x1: -14, z0: -25, z1: -6 };

function capsule(x, z, c) {
  const dx = c.bx - c.ax, dz = c.bz - c.az, l2 = dx * dx + dz * dz;
  const t = clamp(((x - c.ax) * dx + (z - c.az) * dz) / l2, 0, 1);
  return Math.hypot(x - c.ax - dx * t, z - c.az - dz * t) - c.r;
}
// how far inside the bay a point is: below 1 is water, above 1 is the shore
function bay(x, z) {
  const a = Math.atan2(x - LX, z - LZ);
  const wob = 1 + 0.05 * noise(a * 3 + 10, 1.7) + 0.025 * noise(a * 9 + 3, 4.2);
  return (((x - LX) / RX) ** 2 + ((z - LZ) / RZ) ** 2) / (wob * wob);
}
export const pointDist = (x, z) => capsule(x, z, POINT);
export const islandDist = (x, z) => Math.hypot(x - ISLAND.x, z - ISLAND.z) - ISLAND.r;

// the height of the ground: land above 0, the lake bottom below 0
export function height(x, z) {
  const e = bay(x, z), dp = pointDist(x, z), di = islandDist(x, z);
  // land: the shore rises into low hills
  if (e >= 1 || dp < 0 || di < 0) {
    let h = 0.4;
    if (e >= 1) h = Math.max(h, Math.min(38, (Math.sqrt(e) - 1) * 120) + 3 * noise(x / 17, z / 17) + 6 * noise(x / 61, z / 61) * smooth(1, 1.3, e));
    if (dp < 0) h = Math.max(h, Math.min(5, -dp * 0.7) + 0.8 * noise(x / 5, z / 5));
    if (di < 0) h = Math.max(h, ISLAND.top * smooth(0, ISLAND.r, -di) + 0.6 * noise(x / 6, z / 6));
    return Math.max(0.15, h);
  }
  // water: shallow by the south shore, a drop-off 40 to 65 m out, then the deep basin
  const s = 20 - z; // meters out from the south shore (at x = 0)
  let d = s < 38 ? 0.3 + 0.08 * s : s < 60 ? 3.3 + 11 * smooth(38, 60, s) : 14.3 + 6 * smooth(60, 140, s);
  d += 0.6 * noise(x / 9, z / 9);
  // every shore shelves up
  d = Math.min(d, 24 * smooth(0, 0.28, 1 - e));
  // the weed flat stays shallow
  const inW = smooth(0, 6, Math.min(x - WEEDS.x0, WEEDS.x1 - x, z - WEEDS.z0, WEEDS.z1 - z));
  d = d * (1 - inW) + Math.min(d, 2.2 + 0.4 * noise(x / 4, z / 4)) * inW;
  // shoals around the rocky point and the island
  d = Math.min(d, 0.5 + 0.55 * Math.max(0, dp), 0.6 + 0.45 * Math.max(0, di));
  return -Math.max(0.2, d);
}
export const depth = (x, z) => Math.max(0, -height(x, z));
export const isLand = (x, z) => height(x, z) > 0;
export function onDock(x, z) { return x > DOCK.x0 - 0.3 && x < DOCK.x1 + 0.3 && z > DOCK.z0 - 0.3 && z < DOCK.z1; }

// boulders on the rocky point shoal and the island shore; some break the surface
export const ROCKS = (() => {
  const r = rng(71), out = [];
  for (let i = 0; out.length < 26 && i < 2000; i++) {
    const t = r();
    const x = POINT.bx - 14 + r() * 50, z = POINT.bz - 16 + r() * 30;
    const dp = pointDist(x, z);
    if (dp < 0.5 || dp > 13 || isLand(x, z)) continue;
    out.push({ x, z, r: 0.5 + r() * 1.6 * (1 - dp / 18), top: t < 0.45 ? 0.2 + r() * 0.7 : -(0.3 + r() * 1.2) });
  }
  for (let i = 0; i < 10; i++) { const a = i * 0.63 + r(), R = ISLAND.r + 2 + r() * 5; out.push({ x: ISLAND.x + Math.sin(a) * R, z: ISLAND.z + Math.cos(a) * R, r: 0.6 + r() * 1.2, top: r() < 0.5 ? 0.3 : -0.8 }); }
  return out;
})();
// lily pads: {x, z, r, rot}. Reeds: clumps along the weed flat edge and the west shore
export const LILIES = (() => {
  const r = rng(12), out = [];
  for (let i = 0; out.length < 150 && i < 4000; i++) {
    const x = PADS.x0 + r() * (PADS.x1 - PADS.x0), z = PADS.z0 + r() * (PADS.z1 - PADS.z0);
    if (noise(x / 6, z / 6) < -0.15) continue;
    out.push({ x, z, r: 0.25 + r() * 0.35, rot: r() * Math.PI * 2, flower: r() < 0.08 });
  }
  return out;
})();
export const REEDS = (() => {
  const r = rng(33), out = [];
  for (let i = 0; out.length < 70 && i < 6000; i++) {
    const x = -95 + r() * 90, z = -60 + r() * 75;
    const d = depth(x, z);
    if (d < 0.25 || d > 1.3 || isLand(x, z) || Math.abs(x) < 5) continue;
    out.push({ x, z, n: 5 + ((r() * 9) | 0), h: 0.8 + r() * 0.9 });
  }
  return out;
})();

// what kind of water a point is in: the fish choose by this
export function zone(x, z) {
  if (isLand(x, z)) return "land";
  const d = depth(x, z);
  if (islandDist(x, z) < 20) return "island";
  if (pointDist(x, z) < 15) return "rocks";
  if (x > PADS.x0 - 2 && x < PADS.x1 + 2 && z > PADS.z0 - 2 && z < PADS.z1 + 2) return "pads";
  if (x > WEEDS.x0 && x < WEEDS.x1 && z > WEEDS.z0 && z < WEEDS.z1) return "weeds";
  if (Math.abs(x) < 7 && z > -9) return "dock";
  if (d < 4) return "sand";
  if (d < 11) return "dropoff";
  return "deep";
}
export const ZONE_NAMES = { land: "Land", island: "Clog Island", rocks: "The rocky point", pads: "The lily pads", weeds: "The weed flat", dock: "By the dock", sand: "The sand flat", dropoff: "The drop-off", deep: "Deep water" };
