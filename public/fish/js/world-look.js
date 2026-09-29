// How each place looks: the hours of its day, its light, its shore, its trees and how its ground is painted.
// Data and pure functions only (world-env builds the meshes from this, world.js sets the light). The map is in places/*.js.
//
// LOOK[id]:
//   hours        keyframes of the day (see LOON_HOURS); the first and last h set the clock range of the place
//   sunTurn      degrees added to the compass bearing of the sun path
//   moon         null, or { from, fade, az, el, col, si }: after hour `from` a moon takes the sun's place
//   fog(h, base) null, or the fog of the hour: { near, far, col, k } (base is the table's near and far; col is mixed in by k)
//   nightShadow  the shadow of a following fish is hidden when the night value is above this (null: never)
//   swell        how tall the big waves are (1 = Loon Lake)
//   flow         null, or { x, z, foam }: the water noise scrolls at this speed (m/s); foam streaks on high quality
//   water        null (the water plane is the depth box), or { x0, z0, w, h }
//   shore        what the water mirrors: the far shore is an ellipse c, trees treeH tall (amp, tips: how ragged),
//                nothing lower than minEl, and up to two round hills `isles` [{ x, z, r, h }] (h: how tall, 1 = Loon's island)
//   depthBox     the part of the map that the water texture covers, { x0, z0, w, h, nx, nz }
//   terrain      the ground mesh: x and z ranges with an even step, far = how far it goes on with growing steps;
//                grade(d, step) gives finer steps near the angler
//   title        the anchor of the title camera
//   trees        where trees stand and what they look like: seed, caps (most trees drawn: pines, leafy, far cones; low and high),
//                near / leafy / far (the grid, where a tree may stand, its size), pineTint (see treeSpots in world-env)
//   ground(x, z, place)   the ground the camera sees (the map, with far hills and the stand's slab left out)
//   forest(x, z, place)   where the trees grow, 0..1
//   paint(x, z, h, ny, place)   the colour of the ground there (h: its height, ny: how flat it is)
//   reedTint     null, or a colour factor for the reeds (dry autumn reeds)
//   props        the scenery to build for this place (world-env has a builder for each name; "granite" and "boulders"
//                are rocks added to the rocks mesh; "fireflies" and "gulls" are built by world.js)
import { hex, mix3, mul3 } from "./world-env.js";
import { noise, smooth, clamp, capsule, boxInset } from "./places/util.js";

const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- the hours ---------------- */

// Keyframes of the day. Colours are sRGB hex; si = sun strength, hi = sky light strength.
const LOON_HOURS = [
  { h: 4.5, zen: "#0e1634", hor: "#2e3658", glow: "#3a2440", sun: "#ff8a50", si: 0, sky: "#6a78a8", gnd: "#2a3024", hi: 1.9, fog: "#2e3658", near: 50, far: 520, deep: "#0c1622", shal: "#1a2622", cl: "#3a4260", cs: "#1c2240", forest: "#10180f", night: 1 },
  { h: 5.5, zen: "#2e4278", hor: "#c2908a", glow: "#e8866a", sun: "#ff9a60", si: 0.25, sky: "#9aa4c8", gnd: "#3a4028", hi: 2.1, fog: "#b69a9a", near: 30, far: 440, deep: "#1a2c3a", shal: "#3a4436", cl: "#e8b0a0", cs: "#6a6a8a", forest: "#1c2a1c", night: 0.35 },
  { h: 6.5, zen: "#5a86c4", hor: "#f4caa6", glow: "#ffb070", sun: "#ffc890", si: 1.15, sky: "#a8c0e0", gnd: "#4a5230", hi: 2.0, fog: "#e6c8b0", near: 35, far: 480, deep: "#224050", shal: "#58623e", cl: "#fff0dc", cs: "#9aa0b4", forest: "#28402a", night: 0 },
  { h: 9, zen: "#4f92e0", hor: "#d4e6f2", glow: "#fff0d0", sun: "#fff0d8", si: 1.65, sky: "#b8d4f0", gnd: "#5a6a38", hi: 1.65, fog: "#c8dcea", near: 80, far: 760, deep: "#1e4a60", shal: "#6a7446", cl: "#ffffff", cs: "#a8b8cc", forest: "#2c4a30", night: 0 },
  { h: 12, zen: "#3f86dc", hor: "#cfe4f6", glow: "#fff8e0", sun: "#fff8ea", si: 1.8, sky: "#bcd8f4", gnd: "#5e6e3a", hi: 1.6, fog: "#c6dcee", near: 95, far: 820, deep: "#1a4a64", shal: "#6e7a4a", cl: "#ffffff", cs: "#aebdd0", forest: "#2e4c32", night: 0 },
  { h: 16.5, zen: "#4a8cdc", hor: "#dbe6ea", glow: "#fff0c8", sun: "#fff0d0", si: 1.7, sky: "#c0d6ec", gnd: "#5e6a38", hi: 1.6, fog: "#d2dee6", near: 85, far: 780, deep: "#1c4860", shal: "#6e7648", cl: "#fffaf0", cs: "#b0b8c8", forest: "#2c4a30", night: 0 },
  { h: 19, zen: "#5c86c8", hor: "#ffd8a0", glow: "#ffb452", sun: "#ffc47a", si: 1.65, sky: "#b0c0dc", gnd: "#5a5a34", hi: 1.5, fog: "#f2d6b2", near: 45, far: 580, deep: "#23405a", shal: "#6a6a42", cl: "#fff0d8", cs: "#b4a4b0", forest: "#2c3e2c", night: 0 },
  { h: 19.5, zen: "#5a80c2", hor: "#ffcf92", glow: "#ffa640", sun: "#ffb86a", si: 1.55, sky: "#aab8d4", gnd: "#585432", hi: 1.5, fog: "#f0cfa4", near: 42, far: 560, deep: "#223c56", shal: "#686640", cl: "#ffe8c8", cs: "#b098a8", forest: "#2a3a2a", night: 0 },
  { h: 20.3, zen: "#4a5ea8", hor: "#ff9e70", glow: "#ff7a44", sun: "#ff8e58", si: 0.9, sky: "#a0a0c4", gnd: "#4a4630", hi: 1.6, fog: "#d8a08a", near: 40, far: 520, deep: "#1e3048", shal: "#4a4636", cl: "#ffb89a", cs: "#8a7090", forest: "#202c22", night: 0.05 },
  { h: 21, zen: "#222a62", hor: "#b86a7e", glow: "#e0684a", sun: "#ff6a40", si: 0.12, sky: "#9a90c0", gnd: "#3a3630", hi: 2.2, fog: "#7a5a78", near: 38, far: 480, deep: "#141e34", shal: "#2a2e30", cl: "#d88a88", cs: "#4a4468", forest: "#161e1a", night: 0.45 },
  { h: 22, zen: "#0e1634", hor: "#2e3658", glow: "#3a2440", sun: "#ff6a40", si: 0, sky: "#6a78a8", gnd: "#2a3024", hi: 1.9, fog: "#2e3658", near: 50, far: 520, deep: "#0c1622", shal: "#1a2622", cl: "#3a4260", cs: "#1c2240", forest: "#10180f", night: 1 },
];

// small colour helpers on hex strings (no three.js needed)
const rgb = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const toHex = (c) => "#" + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
export const mixHex = (a, b, t) => { const p = rgb(a), q = rgb(b); return toHex(p.map((v, i) => lerp(v, q[i], t))); };
const scaleHex = (s, k) => toHex(rgb(s).map((v) => v * k));
const luma = (s) => { const c = rgb(s); return (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255; };
// a row's water colour in a new hue: `target` at the brightness that `ref` (the noon colour) has, darker or lighter as the row is
const retone = (col, ref, target) => { const k = clamp(luma(col) / luma(ref), 0.25, 1.4), t = rgb(target); return toHex(t.map((v) => v * k)); };

// Stump Bay: dusk into night. Fog is 0.6 of Loon Lake's. After 21.2 the moon lights the bay (see LOOK.stumps.moon).
const STUMP_HOURS = [
  { h: 18, zen: "#5a7ab8", hor: "#f0c690", glow: "#ffb060", sun: "#ffbe78", si: 1.5, sky: "#b0b4cc", gnd: "#5a5232", hi: 1.5, fog: "#e2c8a4", near: 27, far: 348, deep: "#16180e", shal: "#4a3e1e", cl: "#ffe0b8", cs: "#b09aa0", forest: "#2c3828", night: 0 },
  { h: 19, zen: "#5878b4", hor: "#f4c08a", glow: "#ffa858", sun: "#ffbc78", si: 1.4, sky: "#aab0c8", gnd: "#565030", hi: 1.5, fog: "#e6c49a", near: 27, far: 348, deep: "#16180e", shal: "#4a3e1e", cl: "#ffe2bc", cs: "#b09aa4", forest: "#2a3626", night: 0 },
  { h: 20, zen: "#465a9c", hor: "#f0906a", glow: "#ff7a48", sun: "#ff9060", si: 0.9, sky: "#9a9cc0", gnd: "#4a4430", hi: 1.7, fog: "#d09480", near: 24, far: 312, deep: "#141610", shal: "#3c321a", cl: "#ffb090", cs: "#8a7090", forest: "#202a22", night: 0.1 },
  { h: 20.8, zen: "#2c3878", hor: "#c8708a", glow: "#e8684a", sun: "#ff6a40", si: 0.2, sky: "#9890c0", gnd: "#3e3a34", hi: 2.1, fog: "#8a5c78", near: 24, far: 290, deep: "#12140e", shal: "#30281a", cl: "#d88a8a", cs: "#4a4468", forest: "#1a2420", night: 0.5 },
  { h: 21.2, zen: "#20307a", hor: "#6c6096", glow: "#503868", sun: "#ff6a40", si: 0, sky: "#8c96cc", gnd: "#38405a", hi: 2.4, fog: "#4c5080", near: 26, far: 300, deep: "#101410", shal: "#262214", cl: "#8a7c9c", cs: "#3c3e66", forest: "#1a2422", night: 0.85 },
  { h: 22, zen: "#1a2c70", hor: "#4a5c98", glow: "#405494", sun: "#ff6a40", si: 0, sky: "#94a6dc", gnd: "#3a4868", hi: 2.7, fog: "#3e4c7c", near: 30, far: 320, deep: "#0e1410", shal: "#222016", cl: "#5a6a9c", cs: "#2c3a68", forest: "#182422", night: 1 },
  { h: 23, zen: "#182868", hor: "#44588c", glow: "#3c5090", sun: "#ff6a40", si: 0, sky: "#94a6dc", gnd: "#3a4868", hi: 2.8, fog: "#3a4878", near: 30, far: 320, deep: "#0e1410", shal: "#222016", cl: "#56669a", cs: "#2a3866", forest: "#182422", night: 1 },
  { h: 24.5, zen: "#162664", hor: "#405488", glow: "#3a4e8c", sun: "#ff6a40", si: 0, sky: "#90a2d8", gnd: "#384666", hi: 2.8, fog: "#38466e", near: 30, far: 320, deep: "#0e1410", shal: "#222016", cl: "#52629a", cs: "#283664", forest: "#172220", night: 1 },
];

// Cedar River: Loon Lake's day, with teal river water and browner leaves in the mirror
const RIVER_HOURS = LOON_HOURS.map((r) => ({ ...r, deep: retone(r.deep, "#1a4a64", "#1e3a3a"), shal: retone(r.shal, "#6e7a4a", "#5a6a4a"), forest: mixHex(r.forest, "#3c3818", 0.45) }));
// Gull Rock: Loon Lake's day over green-grey sea water
const SEA_HOURS = LOON_HOURS.map((r) => ({ ...r, glow: r.si > 1 ? scaleHex(r.glow, 0.55) : r.glow, cl: r.si > 1 ? scaleHex(mixHex(r.cl, r.cs, 0.2), 0.92) : r.cl, deep: retone(r.deep, "#1a4a64", "#16323c"), shal: retone(r.shal, "#6e7a4a", "#3a6660"), forest: mixHex(r.forest, "#1c3a34", 0.4) }));

/* ---------------- the ground of Loon Lake, as it always was ---------------- */

const bayE = (x, z, b) => Math.hypot((x - b.x) / b.rx, (z - b.z) / b.rz);

// The ground: the map near the stand and in the water. Beyond the reach of a cast the shore rises gently into
// rolling far hills instead (the map climbs steeply, which reads as a wall from the dock). Only the picture uses this.
function hills(bay, c, span, slope, base) {
  return (x, z, place) => {
    const h = place.height(x, z);
    if (h <= 0) return h;
    const e = bayE(x, z, bay);
    if (e < 1) return h;  // the point, Clog Island, the road
    const r = e - 1;  // bayE is already the square root of the map's bay()
    let v = base + r * slope + 2.5 * noise(x / 17, z / 17) * smooth(0, 0.05, r);
    v += smooth(0.2, 1.6, r) * (5 + 18 * (0.5 + 0.5 * noise(x / 170 + 4, z / 170 - 2)) + 5 * noise(x / 55, z / 55));
    v = Math.max(0.15, v);
    return lerp(h, v, smooth(span[0], span[1], Math.hypot(x - c[0], z - c[1])));
  };
}

const LOON_PAL = {
  sand: hex("#d9c28c"), wet: hex("#a8956a"), bed1: hex("#b5a47a"), bed2: hex("#7c7a52"), bed3: hex("#3e4a36"), weed: hex("#46602f"),
  grass: hex("#8fa650"), meadow: hex("#a8b45c"), forest: hex("#34502a"), far: hex("#3a5a34"), granite: hex("#bcaea6"), graniteDk: hex("#7c7672"), lichen: hex("#a3a672"),
};
const pointDist = (x, z, F) => capsule(x, z, F.point);
const islandDist = (x, z, F) => Math.hypot(x - F.island.x, z - F.island.z) - F.island.r;

function loonForest(x, z, place) {
  const F = place.features, e = bayE(x, z, F.bay);
  let f = 0.55 + 0.45 * noise(x / 26 + 7, z / 26 - 3) + 0.2 * noise(x / 9, z / 9);
  if (Math.abs(x) < 18 && z > 14 && z < 70) f -= 1.2 * (1 - smooth(10, 18, Math.abs(x)));   // the cottage lawn
  if (pointDist(x, z, F) < 0) f -= 0.9 * (1 - smooth(3, 13, Math.hypot(x - F.point.bx, z - F.point.bz))); // bare rock at the tip
  if (islandDist(x, z, F) < 0) f = 0.9;
  if (e > 1.5) f = Math.max(f, 0.75);
  return clamp(f, 0, 1);
}

function loonPaint(x, z, h, ny, place) {
  const F = place.features, P = LOON_PAL;
  const n1 = noise(x / 7.3, z / 7.3), n2 = noise(x / 2.1 + 3, z / 2.1);
  if (h < 0) {
    const d = -h;
    let c = d < 1.2 ? mix3(P.sand, P.bed1, smooth(0.1, 1.2, d)) : d < 5 ? mix3(P.bed1, P.bed2, smooth(1.2, 5, d)) : mix3(P.bed2, P.bed3, smooth(5, 14, d));
    const W = F.weeds, inWeeds = x > W.x0 && x < W.x1 && z > W.z0 && z < W.z1;
    if (inWeeds && d > 0.5) c = mix3(c, P.weed, clamp(0.55 + 0.5 * n1, 0, 1));
    if (pointDist(x, z, F) < 12 || islandDist(x, z, F) < 8) c = mix3(c, P.graniteDk, clamp(0.5 + n1, 0, 0.8));
    return mul3(c, 1 + 0.06 * n1);
  }
  const e = bayE(x, z, F.bay), rocky = pointDist(x, z, F) < 1.5 || (islandDist(x, z, F) < 0 && islandDist(x, z, F) > -3);
  if (h < 0.75) {
    let c = mix3(P.wet, P.sand, smooth(0.15, 0.6, h));
    if (rocky) c = mix3(P.granite, P.graniteDk, 0.5 + 0.5 * n2);
    return mul3(c, 1 + 0.08 * n2);
  }
  let c = mix3(P.grass, P.meadow, clamp(0.5 + n1, 0, 1));
  c = mix3(c, P.forest, loonForest(x, z, place) * 0.9);
  if (rocky) {
    // Canadian Shield: pale pink-grey granite ledges, dark seams, lichen and grass in the hollows, forest behind
    const seam = Math.abs(noise(x / 3.1 + 9, z / 1.3)) < 0.08 ? 0.55 : 0;
    let r = mix3(P.granite, P.graniteDk, clamp(0.25 + 0.5 * n2, 0, 1) * 0.6 + seam);
    r = mix3(r, P.lichen, clamp(n1 * 0.9, 0, 0.45));
    r = mix3(r, P.grass, clamp(0.1 + noise(x / 5, z / 5) * 0.9, 0, 0.7));
    c = mix3(r, c, clamp(loonForest(x, z, place) - 0.3, 0, 1) * 0.8);
  }
  if (ny < 0.72) c = mix3(c, mix3(P.granite, P.graniteDk, 0.4 + 0.4 * n2), smooth(0.72, 0.5, ny) * 0.8);
  if (e > 1.5) {
    // far hills read as forest canopy: dark with lighter crowns
    const crown = noise(x / 11, z / 11), big = noise(x / 70, z / 70);
    c = mix3(c, mul3(P.far, 0.9 + 0.3 * crown + 0.12 * big), smooth(1.5, 1.8, e));
  }
  return mul3(c, 1 + 0.07 * n2);
}

/* ---------------- Stump Bay ---------------- */

const SP = {
  mudLight: hex("#a08a5c"), mud: hex("#6a5a38"), peat: hex("#3c3826"), deep: hex("#22241a"), muck: hex("#3c4a2a"), sand: hex("#c8b078"),
  asphalt: hex("#4c4e52"), asphaltWet: hex("#8a8878"), gravel: hex("#7a766a"), wet: hex("#4a4232"), floor: hex("#4a4630"), grass: hex("#6a7a3c"),
  forest: hex("#2c3e26"), far: hex("#28402e"), rock: hex("#8a847c"),
};
const stumpsHills = hills({ x: 0, z: -70, rx: 125, rz: 90 }, [0, 10], [55, 95], 13, 0.4);
function stumpsGround(x, z, place) {
  const h = stumpsHills(x, z, place), D = place.stand.dock;
  // the road slab is a mesh of its own: the ground under it stays below it, so the two never fight
  if (x > D.x0 - 0.05 && x < D.x1 + 0.05 && z > D.z0 - 0.05 && z < D.z1) return Math.min(h, D.deck - 0.4);
  return h;
}
function stumpsForest(x, z, place) {
  const e = bayE(x, z, place.features.bay);
  let f = 0.55 + 0.45 * noise(x / 26 + 3, z / 26) + 0.2 * noise(x / 9, z / 9);
  if (Math.abs(x) < 10 && z > -2 && z < 75) f -= 1.2 * (1 - smooth(6, 10, Math.abs(x)));   // the road corridor
  if (e > 1.5) f = Math.max(f, 0.75);
  return clamp(f, 0, 1);
}
function stumpsPaint(x, z, h, ny, place) {
  const F = place.features, P = SP;
  const n1 = noise(x / 7.3, z / 7.3), n2 = noise(x / 2.1 + 3, z / 2.1);
  if (h < 0) {
    const d = -h;
    let c = d < 1.2 ? mix3(P.mudLight, P.mud, smooth(0.1, 1.2, d)) : d < 5 ? mix3(P.mud, P.peat, smooth(1.2, 5, d)) : mix3(P.peat, P.deep, smooth(5, 14, d));
    const cv = boxInset(x, z, F.cove), fl = boxInset(x, z, F.flat);
    if (cv > 0) c = mix3(c, P.muck, smooth(0, 5, cv) * clamp(0.55 + 0.5 * n1, 0, 0.9));
    if (fl > 0) c = mix3(c, P.sand, smooth(0, 5, fl) * 0.9);
    // the old road bed goes on under the water as a pale lane
    const lane = smooth(5, 3, Math.abs(x)) * smooth(1, -3, z);
    if (lane > 0) c = mix3(c, P.asphaltWet, lane * (0.7 + 0.2 * n2));
    if (Math.abs(z - F.creekZ(x)) < 6) c = mul3(c, 0.8);
    return mul3(c, 1 + 0.06 * n1);
  }
  const D = place.stand.dock;
  if (x > D.x0 - 0.5 && x < D.x1 + 0.5 && z > D.z0 - 0.5 && z < D.z1) return mul3(mix3(P.asphalt, P.gravel, clamp(0.5 + n2, 0, 0.6)), 1 + 0.08 * n2);
  const e = bayE(x, z, F.bay);
  if (h < 0.75) return mul3(mix3(P.wet, P.mud, smooth(0.15, 0.6, h)), 1 + 0.1 * n2);
  let c = mix3(P.grass, P.floor, clamp(0.5 + n1, 0, 1));
  c = mix3(c, P.forest, stumpsForest(x, z, place) * 0.9);
  if (ny < 0.72) c = mix3(c, mix3(P.rock, P.gravel, 0.4 + 0.4 * n2), smooth(0.72, 0.5, ny) * 0.8);
  if (e > 1.5) {
    const crown = noise(x / 11, z / 11), big = noise(x / 70, z / 70);
    c = mix3(c, mul3(P.far, 0.9 + 0.3 * crown + 0.12 * big), smooth(1.5, 1.8, e));
  }
  return mul3(c, 1 + 0.07 * n2);
}

/* ---------------- Cedar River ---------------- */

const RP = {
  gravelLight: hex("#c2b69a"), gravel: hex("#a09a82"), cobble: hex("#6c7062"), deepbed: hex("#3a4a44"), dark: hex("#4c5046"), wet: hex("#a09478"),
  grass: hex("#a49a48"), leaf: hex("#98602c"), floor: hex("#5a4a2c"), clay: hex("#8a6a4a"),
  orange: hex("#c87a2a"), red: hex("#a4462c"), gold: hex("#d4b042"), green: hex("#4a6a34"), far: hex("#5a5c30"),
};
// The river runs off both ways and bends out of sight behind wooded hills: a wavy line across the valley
const riverEnd = (x, z) => 235 + 0.3 * (z + 30) + 14 * Math.sin(z / 17) + 10 * noise(z / 30, 5) - Math.abs(x);
function riverGround(x, z, place) {
  let h = place.height(x, z);
  const end = riverEnd(x, z);
  if (end < 40) {
    // the valley closes: the bed climbs to a wooded bank
    const w = smooth(40, -10, end);
    h = lerp(h, 6 + 12 * w + 3 * noise(x / 20, z / 20), w);
  }
  if (h <= 0) return h;
  // behind the far bank the land climbs gently into wooded hills (the map climbs steeply, which reads as a wall from the bar)
  const df = place.features.farZ(x) - z;
  if (df > 3) {
    const gentle = 2.4 + df * 0.12 + 9 * smooth(30, 150, df) * (0.6 + 0.4 * noise(x / 60 + 2, z / 60)) + 2.5 * noise(x / 23, z / 23);
    h = lerp(h, gentle, smooth(3, 10, df));
  } else if (z > place.features.nearZ(x)) h += 3 * smooth(40, 110, z - place.features.nearZ(x)) * (0.5 + 0.5 * noise(x / 80 + 2, z / 80 - 4));
  return Math.max(0.15, h);
}

// the wooded banks near the water, where the full trees stand (further out only the small far cones)
function riverBand(x, z, place) {
  const F = place.features, dn = z - Math.min(40, F.nearZ(x)), df = F.farZ(x) - z;
  return Math.abs(x) < 240 && ((df > -2 && df < 48) || (dn > -2 && dn < 55));
}
function riverForest(x, z, place) {
  const h = riverGround(x, z, place);
  if (h < 0.9) return 0;                       // the bar and the wet gravel
  let f = 0.6 + 0.45 * noise(x / 26 + 7, z / 26 - 3) + 0.2 * noise(x / 9, z / 9);
  f = f * smooth(0.9, 1.5, h);
  if (h > 1.05) f = Math.max(f, 0.8);          // land higher than the cast limit is always wooded (a cast there hits a tree)
  return clamp(f, 0, 1);
}
function riverPaint(x, z, h, ny, place) {
  const F = place.features, P = RP;
  const n1 = noise(x / 7.3, z / 7.3), n2 = noise(x / 2.1 + 3, z / 2.1), n3 = noise(x / 1.1 + 8, z / 1.1 - 2);
  if (h < 0) {
    const d = -h;
    let c = d < 0.7 ? mix3(P.gravelLight, P.gravel, smooth(0.05, 0.7, d)) : d < 3 ? mix3(P.gravel, P.cobble, smooth(0.7, 3, d)) : mix3(P.cobble, P.deepbed, smooth(3, 7, d));
    c = mix3(c, P.dark, clamp(0.5 + n2 * 0.9, 0, 0.45) * (1 - smooth(1.5, 4, d)));
    if (((x - F.pool.x) / F.pool.rx) ** 2 + ((z - F.pool.z) / F.pool.rz) ** 2 < 1.4) c = mix3(c, P.deepbed, 0.5);
    return mul3(c, 1 + 0.07 * n1 + 0.05 * n3);
  }
  if (h < 0.75) {
    // bare gravel: the bar and the wet edge of the bank, with dark and pale stones
    let c = mix3(P.wet, P.gravelLight, smooth(0.05, 0.4, h));
    c = mix3(c, P.gravel, clamp(0.5 + n3 * 1.2, 0, 0.6));
    return mul3(c, 1 + 0.09 * n2);
  }
  const far = smooth(1.7, 2.6, Math.max(0, F.nearZ(x) - z) * 0.02 + Math.max(0, F.farZ(x) - z) * 0.02 + Math.abs(x) / 400);
  let c = mix3(P.grass, P.leaf, clamp(0.5 + n1, 0, 1));
  c = mix3(c, P.floor, riverForest(x, z, place) * 0.75);
  if (h < 1.6) c = mix3(mix3(P.wet, P.gravel, clamp(0.5 + n3, 0, 1)), c, smooth(0.75, 1.6, h));
  if (ny < 0.7) c = mix3(c, mix3(P.clay, P.gravel, 0.3 + 0.4 * n2), smooth(0.7, 0.4, ny) * 0.55);
  // far hills: a patchwork of autumn leaves and dark conifers
  const patch = noise(x / 38 + 3, z / 38 - 1), tone = noise(x / 15, z / 15);
  let leaf = patch > 0.35 ? P.red : patch > 0.05 ? P.orange : patch > -0.3 ? P.gold : P.green;
  leaf = mul3(leaf, 0.85 + 0.25 * tone);
  c = mix3(c, mix3(P.far, leaf, 0.75), far * 0.9 * smooth(2, 5, h));
  return mul3(c, 1 + 0.07 * n2);
}

/* ---------------- Gull Rock ---------------- */

const GP = {
  sand: hex("#d8c898"), sand2: hex("#a89870"), silt: hex("#6a7a64"), deep: hex("#34504e"), granite: hex("#9a948c"), graniteDk: hex("#5e5a58"),
  kelp: hex("#55603a"), wet: hex("#6a6658"), moss: hex("#6a7a48"), grass: hex("#8a9450"), forest: hex("#22382e"), top: hex("#a6a29a"),
};
function seaGround(x, z, place) {
  const h = place.height(x, z), D = place.stand.dock;
  // the wall is a mesh of its own: the ground under it stays below it
  if (x > D.x0 - 0.05 && x < D.x1 + 0.05 && z > D.z0 - 0.05 && z < D.z1) return Math.min(h, D.deck - 0.4);
  return h;
}
function seaForest(x, z, place) {
  const F = place.features, hd = capsule(x, z, F.head);
  if (hd > -1) return 0;
  // a clearing round the lighthouse
  return clamp(smooth(-1, -7, hd) * (0.85 + 0.35 * noise(x / 9 + 2, z / 9 - 6)) * smooth(9, 17, Math.hypot(x - F.light.x, z - F.light.z)), 0, 1);
}
function seaPaint(x, z, h, ny, place) {
  const P = GP;
  const n1 = noise(x / 7.3, z / 7.3), n2 = noise(x / 2.1 + 3, z / 2.1);
  if (h < 0) {
    const d = -h;
    let c = d < 1.5 ? mix3(P.sand, P.sand2, smooth(0.1, 1.5, d)) : d < 7 ? mix3(P.sand2, P.silt, smooth(1.5, 7, d)) : mix3(P.silt, P.deep, smooth(7, 16, d));
    if (place.rough(x, z)) c = mix3(c, P.graniteDk, clamp(0.5 + n1 * 1.2, 0, 0.75) * (1 - smooth(3, 8, d)));
    else if (d > 2 && d < 9) c = mix3(c, P.kelp, clamp(n1 * 0.9 - 0.1, 0, 0.35));
    return mul3(c, 1 + 0.06 * n1);
  }
  if (h < 0.9) return mul3(mix3(P.wet, P.granite, smooth(0.1, 0.8, h)), 1 + 0.1 * n2);
  const f = seaForest(x, z, place);
  let c = mix3(P.moss, P.grass, clamp(0.5 + n1, 0, 1));
  c = mix3(c, P.forest, f * 0.9);
  // bare granite ledges at the water and where it is steep
  c = mix3(c, mix3(P.granite, P.graniteDk, clamp(0.3 + 0.5 * n2, 0, 1)), Math.max(1 - smooth(0.9, 4, h), smooth(0.75, 0.5, ny) * 0.8) * 0.85);
  return mul3(c, 1 + 0.07 * n2);
}

/* ---------------- LOOK ---------------- */

// caps on the instanced trees: [pines, leafy trees, far cones] on low and on high quality
const CAPS = { low: [1100, 260, 2600], high: [2300, 560, 5200] };
const pineTint = (r) => { const k = 0.8 + r() * 0.35, b = r(); return [k * (0.95 + b * 0.1), k, k * (0.9 + (1 - b) * 0.2)]; };
const loonLeafTint = (r) => { const t = r(); return t < 0.15 ? [1.25, 1.0, 0.62] : [0.85 + t * 0.3, 0.9 + t * 0.2, 0.85]; };
// autumn leaves: a random pick of these colours, a little lighter or darker (the leaf mesh is pale, so the colour shows as it is)
const AUTUMN = [[hex("#c8742a"), 0.3], [hex("#a8402a"), 0.2], [hex("#d8b040"), 0.3], [hex("#4a6a30"), 0.2]];
const autumnTint = (r) => { let t = r(), c = AUTUMN[AUTUMN.length - 1][0]; for (const [col, w] of AUTUMN) { if (t < w) { c = col; break; } t -= w; } const k = 0.88 + r() * 0.24; return [c[0] * k, c[1] * k, c[2] * k]; };

const LOON_BAY = { x: 5, z: -95, rx: 140, rz: 115 };

export const LOOK = {
  loon: {
    hours: LOON_HOURS, sunTurn: 0, moon: null, fog: null, nightShadow: null, swell: 1, flow: null, water: null,
    shore: { c: LOON_BAY, treeH: 15, amp: 5, tips: 28, minEl: 0.045, isles: [{ x: 34, z: -128, r: 15, h: 1 }] },
    depthBox: { x0: -150, z0: -235, w: 310, h: 280, nx: 256, nz: 256 },
    terrain: { x: [-175, 190], z: [-255, 55], far: { x: [-620, 640], z: [-700, 380] }, step: { low: 4.4, high: 2.8 }, grade: null },
    title: { x: 7, y: 6, z: 7 },
    trees: {
      seed: 404, caps: CAPS,
      near: { x: [-230, 250], z: [-310, 90], step: 4.6, jit: 4, size: [10, 9], ok: (x, z, place) => bayE(x, z, place.features.bay) <= 1.62 },
      leafy: { p: (x, z) => 0.2 + 0.12 * noise(x / 40, z / 40), ok: (x, z, place) => islandDist(x, z, place.features) > 0, size: [8, 5], geo: null, tint: loonLeafTint },
      far: { x: [-560, 580], z: [-640, 160], step: 7.5, jit: 7, keep: 0.78, size: [9, 7], ok: (x, z, place) => { const e = bayE(x, z, place.features.bay); return !(e < 1.58 || e > 3.9 || (z > 60 && e > 1.9)); } },
      pineTint,
    },
    ground: hills(LOON_BAY, [0, 10], [55, 95], 13, 0.4), forest: loonForest, paint: loonPaint,
    reedTint: null,
    props: ["rocks", "granite", "dock", "cottage", "loon"],
  },

  stumps: {
    hours: STUMP_HOURS, sunTurn: 0,
    moon: { from: 21.2, fade: 0.5, az: 10, el: 20, col: "#c8d4ff", si: 0.35 },
    fog: null,   // the table already holds Loon Lake fog x 0.6
    nightShadow: 0.5, swell: 1, flow: null,
    water: null,
    shore: { c: { x: 0, z: -70, rx: 125, rz: 90 }, treeH: 13, amp: 4, tips: 30, minEl: 0.05, isles: [] },
    depthBox: { x0: -140, z0: -170, w: 280, h: 200, nx: 256, nz: 256 },
    terrain: { x: [-150, 150], z: [-175, 70], far: { x: [-620, 640], z: [-700, 380] }, step: { low: 4.4, high: 2.8 }, grade: (d, step) => step * (0.36 + 0.64 * smooth(6, 40, d)) },
    title: { x: 7, y: 6, z: 7 },
    trees: {
      seed: 606, caps: { low: [1000, 0, 2300], high: [2100, 0, 4600] },
      near: { x: [-260, 260], z: [-260, 100], step: 4.6, jit: 4, size: [10, 9], ok: (x, z, place) => bayE(x, z, place.features.bay) <= 1.6 },
      leafy: { p: (x, z) => 0.1 + 0.08 * noise(x / 40, z / 40), ok: () => true, size: [8, 5], geo: null, tint: loonLeafTint },
      far: { x: [-560, 580], z: [-640, 160], step: 7.5, jit: 7, keep: 0.78, size: [9, 7], ok: (x, z, place) => { const e = bayE(x, z, place.features.bay); return !(e < 1.55 || e > 3.9 || (z > 60 && e > 1.9)); } },
      pineTint,
    },
    ground: stumpsGround, forest: stumpsForest, paint: stumpsPaint,
    reedTint: null,
    props: ["rocks", "road", "stumps", "fireflies"],
  },

  river: {
    hours: RIVER_HOURS, sunTurn: 0, moon: null,
    // dawn mist: near 12, far 200 until 6.0, lifting to the table's fog by 10.0
    fog: (h, b) => { const w = 1 - smooth(6, 10, h); return { near: lerp(b.near, 12, w), far: lerp(b.far, 200, w), col: "#dcd0c8", k: w * 0.3 }; },
    nightShadow: null, swell: 1,
    flow: { x: -0.9, z: 0, foam: 1 },
    water: null,
    shore: { c: { x: 0, z: -32, rx: 420, rz: 31 }, treeH: 17, amp: 6, tips: 14, minEl: 0.05, isles: [] },
    depthBox: { x0: -300, z0: -75, w: 600, h: 120, nx: 512, nz: 128 },
    terrain: { x: [-270, 270], z: [-160, 70], far: { x: [-700, 700], z: [-700, 300] }, step: { low: 4.4, high: 2.8 }, grade: (d, step) => step * (0.36 + 0.64 * smooth(6, 40, d)) * (1 + 0.7 * smooth(110, 250, d)) },
    title: { x: 7, y: 5.6, z: 7 },
    trees: {
      seed: 808, caps: { low: [420, 520, 2300], high: [900, 1100, 4600] },
      near: { x: [-250, 250], z: [-230, 110], step: 4.6, jit: 4, size: [8, 7], ok: (x, z, place) => riverBand(x, z, place) },
      leafy: { p: () => 0.55, ok: () => true, size: [7, 4.5], geo: { lo: "#c8c4b4", hi: "#ffffff" }, tint: autumnTint },
      far: { x: [-640, 640], z: [-640, 200], step: 7.5, jit: 7, keep: 0.8, size: [9, 7], minH: 2, ok: (x, z, place) => !riverBand(x, z, place) },
      pineTint,
    },
    ground: riverGround, forest: riverForest, paint: riverPaint,
    reedTint: [1.15, 0.92, 0.7],
    props: ["rocks", "boulders", "logjam"],
  },

  sea: {
    hours: SEA_HOURS, sunTurn: 40, moon: null,
    // a morning fog bank: near 20, far 260 until 7.0, gone by 9.0
    fog: (h, b) => { const w = 1 - smooth(7, 9, h); return { near: lerp(b.near, 20, w), far: lerp(b.far, 260, w), col: "#cdd4d6", k: w * 0.6 }; },
    nightShadow: null, swell: 2.5, flow: null,
    water: { x0: -800, z0: -1400, w: 1600, h: 1600 },
    // an open horizon: no far shore. The headland is the one hill in the mirror
    shore: { c: { x: 0, z: 0, rx: 1e6, rz: 1e6 }, treeH: 15, amp: 5, tips: 28, minEl: 0, isles: [{ x: 60, z: -76, r: 30, h: 1.1 }, { x: 100, z: -10, r: 44, h: 1.1 }] },
    depthBox: { x0: -200, z0: -170, w: 400, h: 370, nx: 256, nz: 256 },
    terrain: { x: [-130, 170], z: [-135, 100], far: { x: [-130, 170], z: [-135, 100] }, step: { low: 4.4, high: 2.8 }, grade: (d, step) => step * (0.36 + 0.64 * smooth(6, 40, d)) },
    title: { x: 7, y: 7.8, z: 7 },
    trees: {
      seed: 707, caps: { low: [720, 0, 0], high: [1500, 0, 0] },
      near: { x: [10, 160], z: [-130, 90], step: 3.4, jit: 3, size: [7.5, 6.5], ok: () => true },
      leafy: { p: () => 0, ok: () => false, size: [8, 5], geo: null, tint: loonLeafTint },
      far: null,
      pineTint,
    },
    ground: seaGround, forest: seaForest, paint: seaPaint,
    reedTint: null,
    props: ["rocks", "wall", "gulls"],
  },
};

export const lookOf = (place) => LOOK[place && place.id] || LOOK.loon;
