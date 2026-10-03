// Stump Bay: a flooded forest at dusk. An old road runs down into a reservoir, and the angler stands at its end.
// The road bed goes on under the water as a clear lane, with dead trees and stumps standing all around it.
// Same frame as every place: the angler at (0, 0) faces -z, +x is to the right, the water surface is y = 0.
// height(x, z) > 0 is land, height(x, z) < 0 is water (minus its depth).
import { rng, noise, smooth, boxIn, boxInset, snagGrid, NONE } from "./util.js";

// the end of the road: 7.2 m of asphalt, 0.5 m above the water
const DOCK = { x0: -3.6, x1: 3.6, z0: -0.5, z1: 60, deck: 0.5 };
// the reservoir is an ellipse around the road end
const BAY = { x: 0, z: -70, rx: 125, rz: 90 };
const COVE = { x0: -60, x1: -24, z0: -30, z1: -2 }; // lily pads and reeds, to the left
const FLAT = { x0: 24, x1: 62, z0: -24, z1: 2 };     // a warm sand flat, to the right (gar)
// the old creek bed crosses the bay 34 to 46 m out
const creekZ = (x) => -40 + 6 * Math.sin(x / 23) + 3 * noise(x / 40, 7);

// how far inside the bay a point is: below 1 is water, above 1 is the shore
function bay(x, z) {
  const a = Math.atan2(x - BAY.x, z - BAY.z);
  const wob = 1 + 0.06 * noise(a * 3 + 4, 2.1) + 0.03 * noise(a * 8 + 1, 5.3);
  return (((x - BAY.x) / BAY.rx) ** 2 + ((z - BAY.z) / BAY.rz) ** 2) / (wob * wob);
}
function height(x, z) {
  const e = bay(x, z);
  const road = x > DOCK.x0 && x < DOCK.x1 && z > DOCK.z0 && z < DOCK.z1;
  if (e >= 1 || road) {
    let h = road ? 0.5 : 0.4;
    if (e >= 1) h = Math.max(h, Math.min(30, (Math.sqrt(e) - 1) * 90) + 2.5 * noise(x / 15, z / 15));
    return Math.max(0.15, h);
  }
  // water: the timber floor slopes down to 4-6 m
  const s = 20 - z;
  let d = s < 40 ? 0.4 + 0.13 * s : 5.6 + 1.2 * smooth(40, 110, s);
  d += 0.5 * noise(x / 8, z / 8);
  d += 4.2 * smooth(6, 1.5, Math.abs(z - creekZ(x)));             // the old creek bed
  const lane = smooth(5, 3, Math.abs(x)) * smooth(1, -3, z);       // the old road bed, under the water
  d = d * (1 - lane) + Math.min(d, 1.1 + 0.035 * -z) * lane;
  const inC = smooth(0, 6, boxInset(x, z, COVE)); d = d * (1 - inC) + Math.min(d, 1.4 + 0.3 * noise(x / 5, z / 5)) * inC;
  const inF = smooth(0, 6, boxInset(x, z, FLAT)); d = d * (1 - inF) + Math.min(d, 1.5 + 0.4 * noise(x / 6, z / 6)) * inF;
  // every shore shelves up
  d = Math.min(d, 20 * smooth(0, 0.25, 1 - e));
  return -Math.max(0.2, d);
}
const depth = (x, z) => Math.max(0, -height(x, z));
const isLand = (x, z) => height(x, z) > 0;
function onStand(x, z) { return x > DOCK.x0 - 0.3 && x < DOCK.x1 + 0.3 && z > DOCK.z0 - 0.3 && z < DOCK.z1; }

// 120 stumps and dead trees in groves, 2.4 m apart, on both sides of the lane. About 30% are dead trees 3-7 m tall;
// the rest are stumps 0.25-1.35 m above the water. They are the snags the line rubs on.
const STUMPS = (() => {
  const r = rng(515), out = [];
  for (let i = 0; out.length < 120 && i < 40000; i++) {
    const x = -78 + r() * 156, z = -85 + r() * 82;
    if (Math.abs(x) < 5.5) continue;
    const h = height(x, z);
    if (h > 0 || -h < 1.6 || boxIn(x, z, COVE, 2) || boxIn(x, z, FLAT, 1) || Math.abs(z - creekZ(x)) < 3.5) continue;
    const k = 0.5 + 0.5 * noise(x / 18 + 3, z / 18);                // groves
    if (r() > 0.2 + 0.8 * k) continue;
    if (out.some((s) => Math.hypot(s.x - x, s.z - z) < 2.4)) continue;
    const tall = r() < 0.3;
    out.push({ x, z, r: 0.18 + r() * 0.26, top: tall ? 3 + r() * 4 : 0.25 + r() * 1.1, tall, kind: "stump" });
  }
  return out;
})();
const snagNear = snagGrid(STUMPS, 6);
function nearStump(x, z, R) { for (const s of snagNear(x, z)) if (Math.hypot(s.x - x, s.z - z) < R) return true; return false; }

// riprap: broken rock along both sides of the road end
const ROCKS = (() => {
  const r = rng(516), out = [];
  for (let i = 0; i < 20; i++) {
    const side = i % 2 ? 1 : -1;
    out.push({ x: side * (3.8 + r() * 2.2), z: -1 + r() * 9, r: 0.45 + r() * 0.6, top: 0.1 + r() * 0.45 });
  }
  return out;
})();
// lily pads in the cove, in patches: {x, z, r, rot, flower}
const LILIES = (() => {
  const r = rng(517), out = [];
  for (let i = 0; out.length < 120 && i < 4000; i++) {
    const x = COVE.x0 + r() * (COVE.x1 - COVE.x0), z = COVE.z0 + r() * (COVE.z1 - COVE.z0);
    if (noise(x / 6 + 20, z / 6) < -0.05) continue;
    out.push({ x, z, r: 0.25 + r() * 0.35, rot: r() * Math.PI * 2, flower: r() < 0.08 });
  }
  return out;
})();
// reed clumps in a ring along the inside edge of the cove, around the pads: {x, z, n, h}
const REEDS = (() => {
  const r = rng(518), out = [];
  for (let i = 0; out.length < 40 && i < 6000; i++) {
    const x = COVE.x0 + r() * (COVE.x1 - COVE.x0), z = COVE.z0 + r() * (COVE.z1 - COVE.z0);
    const e = boxInset(x, z, COVE);
    if (e < 0.5 || e > 4 || isLand(x, z)) continue;
    out.push({ x, z, n: 5 + ((r() * 9) | 0), h: 0.8 + r() * 0.9 });
  }
  return out;
})();

// what kind of water a point is in: the fish choose by this
function zone(x, z) {
  if (height(x, z) > 0) return "land";
  if (boxIn(x, z, COVE, 2)) return "pads";
  if (Math.abs(x) < 5 && z < -1) return "lane";
  if (Math.abs(z - creekZ(x)) < 5) return "channel";
  if (nearStump(x, z, 4.5)) return "timber";
  if (boxIn(x, z, FLAT, 2)) return "flat";
  return -height(x, z) < 3 ? "flat" : "open";
}
const ZONE_NAMES = { land: "Land", timber: "The stumps", open: "Open water", lane: "The old road", pads: "The lily cove", channel: "The creek bed", flat: "The sand flat" };

export const stumps = {
  id: "stumps", name: "Stump Bay",
  stand: { dock: DOCK, eye: { x: 0, y: 2.15, z: 0.35 }, rod: { base: { x: 0.28, y: 1.35, z: -0.05 }, length: 2.3 }, kind: "road" },
  height, depth, isLand, onStand, zone, zoneNames: ZONE_NAMES, treeMin: 1.2,
  flow: null, snags: STUMPS, snagNear, rough: null,
  props: { rocks: ROCKS, lilies: LILIES, reeds: REEDS, stumps: STUMPS, logs: NONE, boulders: NONE },
  features: { bay: BAY, cove: COVE, flat: FLAT, creekZ, road: DOCK },
};
