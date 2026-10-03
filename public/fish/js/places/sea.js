// Gull Rock: the end of a granite breakwater, with the open sea ahead and a spruce headland with a light on the right.
// Same frame as every place: the angler at (0, 0) faces -z, +x is to the right, the water surface is y = 0.
// height(x, z) > 0 is land, height(x, z) < 0 is water (minus its depth). rough(x, z) is rocky bottom.
import { rng, noise, smooth, capsule, NONE } from "./util.js";

// the top of the wall: 4.4 m wide, 2.4 m above the water, running back 160 m to the shore
const DOCK = { x0: -2.2, x1: 2.2, z0: -0.8, z1: 160, deck: 2.4 };
const JET = { x0: -2.2, x1: 2.2, z0: -0.8 };
const HEAD = { ax: 120, az: 60, bx: 50, bz: -90, r: 22 };   // the spruce headland on the right; the light at its tip
const BAR = { x: -42, z: -30, rx: 22, rz: 13 };               // a sand bar on the left
// the lighthouse: on the headland's crest, 10 m back from its tip
const LIGHT = (() => {
  const dx = HEAD.bx - HEAD.ax, dz = HEAD.bz - HEAD.az, l = Math.hypot(dx, dz);
  return { x: HEAD.bx + dx / l * (HEAD.r - 10), z: HEAD.bz + dz / l * (HEAD.r - 10) };
})();
// how far a point is from the wall (0 on it)
const jetDist = (x, z) => Math.hypot(Math.max(JET.x0 - x, x - JET.x1, 0), Math.max(JET.z0 - z, 0));
const barQ = (x, z) => ((x - BAR.x) / BAR.rx) ** 2 + ((z - BAR.z) / BAR.rz) ** 2;

function height(x, z) {
  const jd = jetDist(x, z), hd = capsule(x, z, HEAD);
  if (jd <= 0 && z < 160) return 2.4;
  if (hd < 0 || z > 160) return Math.max(0.3, Math.min(24, -hd * 0.55) + 2 * noise(x / 13, z / 13), z > 160 ? (z - 160) * 0.3 : 0);
  // water: sand sloping out to the deep sea
  const R = Math.hypot(x, z);
  let d = 4 + 0.11 * Math.min(R, 130) + 0.7 * noise(x / 11, z / 11);
  d += 6 * smooth(36, 44, R) * (1 - smooth(58, 68, R));            // the tide channel, 36-68 m out
  d = Math.min(d, 0.3 + 0.75 * jd);                                  // the rock apron of the breakwater
  d = Math.min(d, 1.2 + 0.28 * Math.max(0, hd));                     // the ledge under the headland
  { const q = barQ(x, z), w = smooth(2.5, 1.0, q); d = d * (1 - w) + Math.min(d, 1.0 + 1.5 * q) * w; } // the sand bar, left
  return -Math.max(0.3, d);
}
const depth = (x, z) => Math.max(0, -height(x, z));
const isLand = (x, z) => height(x, z) > 0;
function onStand(x, z) { return x > DOCK.x0 - 0.3 && x < DOCK.x1 + 0.3 && z > DOCK.z0 - 0.3 && z < DOCK.z1; }
// rocky bottom: the apron at the foot of the wall and the ledge under the headland
const rough = (x, z) => jetDist(x, z) < 6.5 || capsule(x, z, HEAD) < 8;

// 110 rocks: 60 on the apron at the end of the wall, 50 along the foot of the headland. {x, z, r, top}
const ROCKS = (() => {
  const r = rng(707), out = [];
  for (let i = 0; out.length < 60 && i < 4000; i++) {
    const x = (r() * 2 - 1) * 9, z = -9 + r() * 30;
    const jd = jetDist(x, z);
    if (jd < 0.4 || jd > 6) continue;
    // in front of the wall they stay under the water, so a fish can come in to the wall; beside it some break the surface
    const top = z < DOCK.z0 ? -(0.4 + r() * 0.6) : 0.5 - 0.2 * jd + (r() - 0.5) * 0.6;
    out.push({ x, z, r: 0.6 + r() * 1.0, top });
  }
  for (let i = 0; out.length < 110 && i < 8000; i++) {
    const x = 25 + r() * 70, z = -118 + r() * 128;
    const hd = capsule(x, z, HEAD);
    if (hd < -3 || hd > 6) continue;
    const top = hd < 0 ? height(x, z) + 0.2 + r() * 0.5 : 0.4 - 0.25 * hd + (r() - 0.5) * 0.4;
    out.push({ x, z, r: 0.8 + r() * 1.4, top });
  }
  return out;
})();

// what kind of water a point is in: the fish choose by this
function zone(x, z) {
  const h = height(x, z);
  if (h > 0) return "land";
  if (jetDist(x, z) < 12) return "wall";
  if (capsule(x, z, HEAD) < 22) return "ledge";
  if (barQ(x, z) < 1.6) return "bar";
  const R = Math.hypot(x, z);
  if (R > 38 && R < 66) return "channel";
  return -h < 9 ? "sand" : "open";
}
const ZONE_NAMES = { land: "Land", sand: "Sandy bottom", bar: "The sand bar", channel: "The tide channel", wall: "By the wall", ledge: "The ledge", open: "Open sea" };

export const sea = {
  id: "sea", name: "Gull Rock",
  stand: { dock: DOCK, eye: { x: 0, y: 4.05, z: 0.35 }, rod: { base: { x: 0.28, y: 3.25, z: -0.05 }, length: 2.3 }, kind: "wall" },
  height, depth, isLand, onStand, zone, zoneNames: ZONE_NAMES, treeMin: 3,
  flow: null, snags: NONE, snagNear: () => NONE, rough,
  props: { rocks: ROCKS, lilies: NONE, reeds: NONE, stumps: NONE, logs: NONE, boulders: NONE },
  features: { jetty: JET, head: HEAD, bar: BAR, light: LIGHT },
};
