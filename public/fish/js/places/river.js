// Cedar River: the tip of a gravel bar on a fast river, on an autumn dawn. The river flows from right to left (-x).
// Same frame as every place: the angler at (0, 0) faces -z, +x is to the right, the water surface is y = 0.
// height(x, z) > 0 is land, height(x, z) < 0 is water (minus its depth). flow(x, z) is the current in m/s.
import { rng, noise, smooth, boxIn, boxInset, snagGrid, NONE } from "./util.js";

// the tip of the gravel bar, 0.25 m above the water
const DOCK = { x0: -1.2, x1: 1.2, z0: -0.8, z1: 8, deck: 0.25 };
// the near bank bends back from the bar tip; the far bank is a steep cut bank about 58 m out
const nearZ = (x) => -0.8 + 0.2 * Math.abs(x) + 0.0012 * x * x;
const farZ = (x) => -60 - 7 * Math.sin((x - 15) / 50) + 2 * noise(x / 20, 3);
const POOL = { x: 22, z: -38, rx: 16, rz: 11 };       // the deep salmon pool
const EDDY = { x0: -14, x1: -1, z0: -9, z1: -1 };     // slack water behind the bar, flowing back upstream
const poolQ = (x, z) => ((x - POOL.x) / POOL.rx) ** 2 + ((z - POOL.z) / POOL.rz) ** 2;
// big rocks in the current, with slack "pockets" behind them (downstream is -x)
const BOULDERS = [[-4, -26, 1.2], [8, -21, 1.5], [14, -30, 1.0], [34, -24, 1.4], [-18, -36, 1.3], [-6, -44, 1.1], [40, -12, 1.2]].map(([x, z, r]) => ({ x, z, r }));
// the logjam downstream to the left: 6 logs, some just awash
const LOGS = (() => {
  const r = rng(909), out = [];
  for (let i = 0; i < 6; i++) {
    const x = -46 + r() * 16, z = -8 - r() * 10, a = r() * Math.PI, L = 4 + r() * 6;
    out.push({ ax: x - Math.cos(a) * L / 2, az: z - Math.sin(a) * L / 2, bx: x + Math.cos(a) * L / 2, bz: z + Math.sin(a) * L / 2, r: 0.3, top: r() < 0.4 ? 0.3 : -0.6 });
  }
  return out;
})();
// for the rub test a log is a row of short posts, 0.6 m apart: these are the river's snags
const LOGPOSTS = LOGS.flatMap((l) => {
  const n = Math.ceil(Math.hypot(l.bx - l.ax, l.bz - l.az) / 0.6);
  return Array.from({ length: n + 1 }, (_, i) => ({ x: l.ax + (l.bx - l.ax) * i / n, z: l.az + (l.bz - l.az) * i / n, r: l.r, top: l.top, kind: "logs" }));
});
const snagNear = snagGrid(LOGPOSTS, 6);

// the ground without the stand: the gravel bar and banks above 0, the river bed below 0
function ground(x, z) {
  const a = Math.min(40, nearZ(x)), b = farZ(x), t = (a - z) / (a - b); // t: 0 at the near bank, 1 at the far bank
  if (t <= 0) return Math.max(0.2, 0.25 + 0.05 * (z - a) + Math.max(0, z - a - 18) * 0.25 + 0.4 * noise(x / 9, z / 9));
  if (t >= 1) return Math.max(0.5, Math.min(30, 2.2 + (b - z) * 0.6) + 1.5 * noise(x / 10, z / 10));
  let d = 0.15 + 2.6 * smooth(0, 0.4, t) + 1.6 * smooth(0.45, 0.8, t);
  d = Math.min(d, 0.9 + 0.35 * (1 - t) * (a - b));                   // the far bank is a steep cut bank
  d += 3.6 * smooth(1.2, 0.2, poolQ(x, z));                          // the salmon pool
  d *= 1 - 0.7 * smooth(36, 52, x);                                  // the riffle upstream
  d *= 1 - 0.4 * smooth(-45, -65, x);                                // the tail-out downstream
  const inE = smooth(0, 3, boxInset(x, z, EDDY)); d = d * (1 - inE) + Math.min(d, 1.6) * inE;
  for (const B of BOULDERS) d = Math.min(d, Math.max(0, Math.hypot(x - B.x, z - B.z) - B.r) * 0.9 - 0.2);
  d += 0.35 * noise(x / 6, z / 6);
  return -Math.max(0.2, d);
}
// the stand is always dry: at least 0.25 m of gravel under the angler
function height(x, z) {
  const h = ground(x, z);
  return h < 0.25 && x > DOCK.x0 && x < DOCK.x1 && z > DOCK.z0 && z < DOCK.z1 ? 0.25 : h;
}
const depth = (x, z) => Math.max(0, -height(x, z));
const isLand = (x, z) => height(x, z) > 0;
function onStand(x, z) { return x > DOCK.x0 - 0.3 && x < DOCK.x1 + 0.3 && z > DOCK.z0 - 0.3 && z < DOCK.z1; }

// the current: fastest mid-river, slow in the pool and behind boulders, faster in the riffle, upstream in the eddy
function flow(x, z) {
  const a = Math.min(40, nearZ(x)), t = (a - z) / (a - farZ(x));
  if (!(t > 0 && t < 1)) return { x: 0, z: 0 }; // on land (or a bad point): no current
  let u = 1.15 * Math.pow(Math.sin(Math.PI * t), 0.6);
  u *= 1 + 0.35 * smooth(36, 52, x);
  u *= 1 - 0.65 * smooth(1.3, 0.3, poolQ(x, z));
  for (const B of BOULDERS) { const dx = B.x - x, dz = Math.abs(z - B.z); if (dx > 0 && dx < 6 && dz < B.r + 1) u *= 0.3 + 0.7 * smooth(0, 6, dx); }
  const e = smooth(0, 3, boxInset(x, z, EDDY));
  const ux = -u * (1 - e) + 0.15 * e;
  return { x: ux, z: 0.08 * ux * Math.cos((x - 15) / 50) };
}

// stones along the near bank, on both sides of the bar: {x, z, r, top}
const ROCKS = (() => {
  const r = rng(911), out = [];
  for (let i = 0; i < 16; i++) {
    const x = (i % 2 ? 1 : -1) * (4 + r() * 36), z = nearZ(x) - 1.5 + r() * 3;
    out.push({ x, z, r: 0.35 + r() * 0.5, top: Math.max(0, height(x, z)) + 0.15 + r() * 0.35 });
  }
  return out;
})();
// reed clumps in the shallow side of the eddy: {x, z, n, h}
const REEDS = (() => {
  const r = rng(913), out = [];
  for (let i = 0; out.length < 16 && i < 4000; i++) {
    const x = EDDY.x0 + r() * (EDDY.x1 - EDDY.x0), z = EDDY.z0 + r() * (EDDY.z1 - EDDY.z0);
    const d = depth(x, z);
    if (d < 0.2 || d > 1.3 || x > -2.5) continue;
    out.push({ x, z, n: 4 + ((r() * 7) | 0), h: 0.7 + r() * 0.8 });
  }
  return out;
})();

// what kind of water a point is in: the fish choose by this
function zone(x, z) {
  if (height(x, z) > 0) return "land";
  if (boxIn(x, z, EDDY)) return "eddy";
  for (const p of snagNear(x, z)) if (Math.hypot(p.x - x, p.z - z) < 3) return "logs";
  for (const B of BOULDERS) { const dx = B.x - x; if (dx > -1 && dx < 6 && Math.abs(z - B.z) < B.r + 2) return "pocket"; }
  if (poolQ(x, z) < 1) return "pool";
  if (x > 38) return "riffle";
  if (x < -45) return "tail";
  if (-height(x, z) < 1) return "bank";
  return "run";
}
const ZONE_NAMES = { land: "Land", run: "The main current", pocket: "Behind a boulder", pool: "The deep pool", logs: "The logjam", eddy: "The eddy", bank: "Near the bank", riffle: "The riffle", tail: "The tail-out" };

export const river = {
  id: "river", name: "Cedar River",
  stand: { dock: DOCK, eye: { x: 0, y: 1.9, z: 0.35 }, rod: { base: { x: 0.28, y: 1.1, z: -0.05 }, length: 2.3 }, kind: "bar" },
  height, depth, isLand, onStand, zone, zoneNames: ZONE_NAMES, treeMin: 1.2,
  flow, snags: LOGPOSTS, snagNear, rough: null,
  props: { rocks: ROCKS, lilies: NONE, reeds: REEDS, stumps: NONE, logs: LOGS, boulders: BOULDERS },
  features: { nearZ, farZ, pool: POOL, eddy: EDDY },
};
