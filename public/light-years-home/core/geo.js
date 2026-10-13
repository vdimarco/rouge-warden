// Light Years Home: camera geometry. Where the ship is along each leg, how each scan frames its three candidates
// inside the free part of the screen (not under the HUD, the card, the chips or the flight strip), where the camera
// sits for reveals and the ending, and the camera description that the renderer, the overlay and picking share:
// position, orientation, field of view, layer weights, view rapidity and the direction of motion.
// Positions are heliocentric galactic light-years in float64. Quaternions follow the three.js camera convention
// (the camera looks down its −z axis with +y up). Pure: no DOM and no three.js.

import { OBJECTS, AU_LY, KM_PER_LY } from './objects.js';
import { CHAPTERS, STOPS, SCANS, INTRO, legPoints, legLengthLy, zonesFor, stopIndex } from './route.js';
import { viewRapidity, zoneLambda } from './physics.js';
import { project, radiusOf } from './project.js';

const D2R = Math.PI / 180;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => { const u = clamp(t, 0, 1); return u * u * u * (u * (6 * u - 15) + 10); };   // smootherstep

// ---------- vectors (plain arrays of float64) ----------

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a, fallback = [0, 0, 1]) => { const l = len(a); return l > 0 ? mul(a, 1 / l) : [...fallback]; };
// a (1 − t) + b t: exactly a at t = 0 and exactly b at t = 1.
const mix3 = (a, b, t) => [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
const NORTH = [0, 0, 1];   // the north galactic pole: "up" unless the view looks straight along it
const TOWARD_GC = [1, 0, 0];

// Unit directions a → b at a steady angular rate (spherical interpolation); nlerp would rush the middle of a sharp turn.
function slerpDir(a, b, t) {
  const th = Math.acos(clamp(dot(a, b), -1, 1)), s = Math.sin(th);
  if (s < 1e-6) return unit(mix3(a, b, t), b);
  return unit(add(mul(a, Math.sin((1 - t) * th) / s), mul(b, Math.sin(t * th) / s)), b);
}

// Rotate v about the unit axis k by angle a (Rodrigues).
function rotate(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}

// "Up" for a view along f: the galactic north at right angles to f, leaning on the Galactic Centre direction as f
// nears the pole so it never flips.
function refUp(f) {
  let u = sub(NORTH, mul(f, dot(NORTH, f)));
  const l = len(u);
  if (l < 0.3) u = add(u, mul(sub(TOWARD_GC, mul(f, dot(TOWARD_GC, f))), (0.3 - l) / 0.3));
  return unit(u, [0, 1, 0]);
}

// Orthonormal camera basis looking along fwd, with up as close to upHint as it can be.
function lookBasis(fwd, upHint) {
  const f = unit(fwd);
  const right = unit(cross(f, upHint || refUp(f)), unit(cross(f, refUp(f))));
  return { right, up: cross(right, f), fwd: f };
}

// ---------- quaternions [x, y, z, w], three.js camera convention ----------

// The rotation that takes the camera's local axes (+x right, +y up, −z forward) to the basis.
export function basisToQuat({ right, up, fwd }) {
  const m00 = right[0], m01 = up[0], m02 = -fwd[0];
  const m10 = right[1], m11 = up[1], m12 = -fwd[1];
  const m20 = right[2], m21 = up[2], m22 = -fwd[2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  const l = Math.hypot(x, y, z, w) || 1;
  return [x / l, y / l, z / l, w / l];
}

function quatRotate(q, v) {
  const [x, y, z, w] = q;
  const t = mul(cross([x, y, z], v), 2);
  return add(add(v, mul(t, w)), cross([x, y, z], t));
}

export function quatToBasis(q) {
  return { right: quatRotate(q, [1, 0, 0]), up: quatRotate(q, [0, 1, 0]), fwd: quatRotate(q, [0, 0, -1]) };
}

function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) {
    const q = a.map((v, i) => v * (1 - t) + s * b[i] * t);
    const l = Math.hypot(...q);
    return q.map((v) => v / l);
  }
  const th = Math.acos(d), sa = Math.sin((1 - t) * th) / Math.sin(th), sb = (s * Math.sin(t * th)) / Math.sin(th);
  return a.map((v, i) => v * sa + b[i] * sb);
}

// ---------- layers ----------

// Each layer draws in its own unit (ly per unit): cosmic Mly, group kly, galaxy ly, stars ly, solar AU.
export const LAYER_NAMES = ['cosmic', 'group', 'galaxy', 'stars', 'solar'];
export const LAYER_UNITS = { cosmic: 1e6, group: 1e3, galaxy: 1, stars: 1, solar: AU_LY };
// The view scale is the camera's distance from home (the Sun) in ly. The route closes in on home the way Powers of
// Ten closes in on one picnic, and the layers nest around it: the Solar System inside the star neighbourhood, inside
// the Milky Way, inside the Local Group, inside the cosmic web. A layer fades in over fadeIn (none at the first
// log10 value, full at the second) and out over fadeOut. They overlap on purpose: the galactic band and the stars stay
// behind the Solar System. While the galaxy layer fades in (1 Mly to 250 kly), the renderer swaps the Milky Way
// impostor (group) for its particles (galaxy), for example at group weight × (1 − galaxy weight).
export const LAYER_WINDOWS = {
  cosmic: { fadeIn: [5.3, 5.8], fadeOut: null },       // galaxies as dots, beyond about 600 kly
  group: { fadeIn: [3.9, 4.5], fadeOut: [7.9, 8.3] },  // the Local Group, M81 and Centaurus A, 30 kly to 80 Mly
  galaxy: { fadeIn: null, fadeOut: [5.4, 6.0] },       // the Milky Way fly-in, then the galactic band around you
  stars: { fadeIn: null, fadeOut: [3.9, 4.6] },        // named and generated stars, nebulae, open clusters
  solar: { fadeIn: null, fadeOut: [-2.6, -1.9] },      // the Sun, planets and the Moon, within about 800 AU
};
// The main layer for a scale: the first whose floor (log10 ly) the scale reaches.
const LAYER_FLOORS = [['cosmic', 6.5], ['group', 5.4], ['galaxy', 4.0], ['stars', -2], ['solar', -Infinity]];
// Clip planes in each layer's own unit. Point layers draw without depth; only the solar layer's meshes need it, so
// its near plane follows the nearest body (see solarNear).
const LAYER_CLIP = {
  cosmic: [1e-3, 1e5], group: [1e-3, 1e6], galaxy: [1e-2, 1e7], stars: [1e-6, 1e6], solar: [1e-6, 1e4],
};

// The view scale of a camera position: its distance from the Sun, ly.
export function viewScale(pos) {
  return Math.max(len(pos), 1e-12);
}

// Crossfade weights (0..1) of every layer for a view scale in ly.
export function layerWeights(scaleLy) {
  const s = Math.log10(Math.max(finite(scaleLy) ? scaleLy : 1, 1e-12));
  const out = {};
  for (const name of LAYER_NAMES) {
    const w = LAYER_WINDOWS[name];
    let v = 1;
    if (w.fadeIn) v *= smoothstep(w.fadeIn[0], w.fadeIn[1], s);
    if (w.fadeOut) v *= 1 - smoothstep(w.fadeOut[0], w.fadeOut[1], s);
    out[name] = v;
  }
  return out;
}

// The layer a scale belongs to: where a position is best kept in that layer's unit.
export function layerFor(scaleLy) {
  const s = Math.log10(Math.max(finite(scaleLy) ? scaleLy : 1, 1e-12));
  return LAYER_FLOORS.find(([, floor]) => s >= floor)[0];
}

// Half the distance to the nearest surface of the Sun, a planet or the Moon, in AU: the solar layer's near plane.
const BODIES = Object.values(OBJECTS).filter((o) => finite(o.radiusKm));
function solarNear(pos) {
  let best = Infinity;
  for (const o of BODIES) best = Math.min(best, len(sub(o.pos, pos)) - o.radiusKm / KM_PER_LY);
  return clamp((0.5 * best) / AU_LY, 1e-8, 1);
}

// ---------- layouts and the free content box ----------

export const LOOK_YAW = 60;      // look-drag limits around a scan's framing, degrees
export const LOOK_PITCH = 35;
export const SCAN_PAD = 30;      // candidate centres stay this far (CSS px) inside the free box
export const LAYOUTS = {
  desktop: { width: 1440, height: 900 },
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
};
// The HUD numbers each layout's free box comes from (final.md 2.9), CSS px unless marked as a share of the height.
export const HUD = {
  desktop: { top: 100, card: 360, cardGap: 16, captionAt: 0.70, captionHalf: 45 },   // top row, clock, info box
  portrait: { top: 100, bottomAt: 0.58 },                       // candidates above the caption at 62 %
  landscape: { top: 44, card: 300, cardGap: 8, captionAt: 0.74, captionHalf: 18 },
};

// 'landscape' for a short phone held sideways (height ≤ 500 px, as the stylesheet's max-height:500px query),
// 'portrait' for a narrow screen, else 'desktop'.
export function layoutMode(width, height) {
  if (height <= 500 && width > height) return 'landscape';
  if (width <= 760) return 'portrait';
  return 'desktop';
}

// The free content box for a viewport: the part of the screen where scan candidates go, not covered by the top row,
// clock line, info box, caption, card, chips or flight strip. safe: safe-area insets { top, right, bottom, left }.
// Returns { x, y, w, h, width, height, mode } in CSS px.
export function contentBox(width, height, safe = {}) {
  const W = finite(width) && width > 0 ? width : 1440, H = finite(height) && height > 0 ? height : 900;
  const st = finite(safe.top) ? safe.top : 0, sr = finite(safe.right) ? safe.right : 0;
  const sl = finite(safe.left) ? safe.left : 0;
  const mode = layoutMode(W, H);
  let x0 = sl, x1 = W - sr, y0, y1;
  if (mode === 'desktop') {
    const h = HUD.desktop;
    y0 = st + h.top;
    x1 = W - sr - h.card - h.cardGap;
    y1 = h.captionAt * H - h.captionHalf;
  } else if (mode === 'portrait') {
    y0 = st + HUD.portrait.top;
    y1 = HUD.portrait.bottomAt * H;
  } else {
    const h = HUD.landscape;
    y0 = st + h.top;
    x1 = W - sr - h.card - h.cardGap;
    y1 = h.captionAt * H - h.captionHalf;
  }
  if (x1 - x0 < 80) { x0 = 0; x1 = W; }
  if (y1 - y0 < 80) { y0 = 0; y1 = H; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, width: W, height: H, mode };
}

// The free box from the HUD's measured rects ({ top, clock, caption, card, chips, strip }, each { x, y, w, h } or a
// DOMRect-like { left, top, width, height }): below everything in the top third, left of a right-hand panel, above
// everything in the lower part. A simple rule for these layouts, not a general empty-rectangle search.
export function freeBox(rects, width, height) {
  const W = width, H = height;
  let x0 = 0, x1 = W, y0 = 0, y1 = H;
  for (const raw of Object.values(rects || {})) {
    if (!raw) continue;
    const r = { x: raw.x ?? raw.left, y: raw.y ?? raw.top, w: raw.w ?? raw.width, h: raw.h ?? raw.height };
    if (![r.x, r.y, r.w, r.h].every(finite) || r.w <= 0 || r.h <= 0) continue;
    if (r.y + r.h <= 0.35 * H) y0 = Math.max(y0, r.y + r.h);
    else if (r.x >= 0.45 * W && r.h >= 0.3 * H) x1 = Math.min(x1, r.x);
    else if (r.y >= 0.35 * H) y1 = Math.min(y1, r.y);
  }
  if (x1 - x0 < 80 || y1 - y0 < 80) return contentBox(W, H);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, width: W, height: H, mode: layoutMode(W, H) };
}

// The viewport a call works in. box: { x, y, w, h, width, height } in CSS px (contentBox, freeBox); without width
// and height the screen is a reference size for the aspect (390 px tall when wide, 900 px tall, or 390 px wide when
// tall) and box is in px of that screen, or in shares of it when every value is at most 1; no box: contentBox.
function viewportOf(aspect, box) {
  const ok = box && [box.x, box.y, box.w, box.h].every(finite) && box.w > 0 && box.h > 0;
  if (ok && finite(box.width) && finite(box.height) && box.width > 0 && box.height > 0) {
    return { box, W: box.width, H: box.height, aspect: box.width / box.height };
  }
  const a = finite(aspect) && aspect > 0 ? aspect : 1.6;
  const ref = a >= 1.8 ? [Math.round(390 * a), 390] : a >= 1 ? [Math.round(900 * a), 900] : [390, Math.round(390 / a)];
  const b = contentBox(ref[0], ref[1]);
  if (ok) {
    const share = [box.x, box.y, box.w, box.h].every((v) => v >= 0 && v <= 1);
    const [sx, sy] = share ? ref : [1, 1];
    Object.assign(b, { x: box.x * sx, y: box.y * sy, w: box.w * sx, h: box.h * sy });
  }
  return { box: b, W: ref[0], H: ref[1], aspect: ref[0] / ref[1] };
}

// The box in normalised device coordinates (y up), shrunk by pad px on every side.
function ndcBox(vp, pad) {
  const { box, W, H } = vp;
  const p = Math.max(0, Math.min(pad, box.w / 2 - 4, box.h / 2 - 4));
  return {
    x0: (2 * (box.x + p)) / W - 1, x1: (2 * (box.x + box.w - p)) / W - 1,
    y0: 1 - (2 * (box.y + box.h - p)) / H, y1: 1 - (2 * (box.y + p)) / H,
  };
}

// The vertical field of view in flight: 60° when the screen is wide, more on a tall phone so the sides keep room.
export function flightFov(aspect) {
  const a = finite(aspect) && aspect > 0 ? aspect : 1.6;
  return (2 * Math.atan(Math.tan(30 * D2R) / Math.sqrt(Math.min(a, 1)))) / D2R;
}

// ---------- legs ----------

const geomCache = new Map();
function legGeom(i) {
  if (geomCache.has(i)) return geomCache.get(i);
  if (!STOPS[i]) throw new Error(`no stop ${i}`);
  const pts = legPoints(i);
  const seg = [], dirs = [], cum = [0];
  for (let k = 1; k < pts.length; k++) {
    const d = sub(pts[k], pts[k - 1]);
    seg.push(len(d));
    dirs.push(unit(d, dirs[k - 2] || [1, 0, 0]));
    cum.push(cum[k - 1] + seg[k - 1]);
  }
  const g = { pts, seg, dirs, cum, total: legLengthLy(i) };
  geomCache.set(i, g);
  return g;
}

// The segment a distance along the leg falls on.
function segmentAt(g, d) {
  let k = 0;
  while (k < g.seg.length - 1 && d >= g.cum[k + 1]) k++;
  return k;
}

// Where the ship is after flying ly light-years along leg stopIndex (from → via → to). Both fork branches fly the same
// path. Returns { layer, pos ([x, y, z] ly), fwd (unit, the segment's direction), ly (clamped), lengthLy, segment }.
// At ly ≥ the leg's length, pos is exactly the end object's position.
export function legPath(stopIndex, branch = 'sheet', ly = 0) {
  const g = legGeom(stopIndex);
  const d = clamp(finite(ly) ? ly : 0, 0, g.total);
  const end = d >= g.total;
  const k = end ? g.seg.length - 1 : segmentAt(g, d);
  let pos;
  if (end) pos = [...g.pts[g.pts.length - 1]];
  else if (g.seg[k] > 0) pos = mix3(g.pts[k], g.pts[k + 1], clamp((d - g.cum[k]) / g.seg[k], 0, 1));
  else pos = [...g.pts[k]];
  return { layer: layerFor(viewScale(pos)), pos, fwd: [...g.dirs[k]], ly: d, lengthLy: g.total, segment: k };
}

// "Up" during a leg that turns at a via point: the normal of the plane the turn happens in, on the galactic north
// side. Every heading through the turn lies in that plane, so the view turns without rolling, even when the path runs
// close to a galactic pole (Virgo → Eridanus heads 21° from the south pole). Straight legs use galactic north.
function legUp(i) {
  const g = legGeom(i);
  let n = [0, 0, 0];
  for (let c = 1; c < g.dirs.length; c++) n = add(n, cross(g.dirs[c - 1], g.dirs[c]));
  if (len(n) < 1e-6) return null;
  n = unit(n);
  return dot(n, NORTH) < 0 ? mul(n, -1) : n;
}

// The leg's screen clock: where ly falls in design screen seconds (each zone's screen time at its notch). Inside a
// zone the distance follows the Eames pacing ℓ(p) = ly (1 − e^(−λp)) / (1 − e^(−λ)) with λ = zoneLambda(ly, next
// zone's ly), as the engine flies it, so this inverts it: p = −ln(1 + f (e^(−λ) − 1)) / λ for the share f of the zone.
const clockCache = new Map();
function legClock(i, branch) {
  const key = `${i}:${branch}`;
  if (clockCache.has(key)) return clockCache.get(key);
  const zones = zonesFor(i, branch);
  let s0 = 0;
  const out = zones.map((z, k) => {
    const c = { startLy: z.startLy, ly: z.ly, screen: z.screen > 0 ? z.screen : 1.2, s0,
      lambda: k < zones.length - 1 ? zoneLambda(z.ly, zones[k + 1].ly) : 0 };
    s0 += c.screen;
    return c;
  });
  clockCache.set(key, out);
  return out;
}

function screenAt(clock, ly) {
  let k = 0;
  while (k < clock.length - 1 && ly >= clock[k].startLy + clock[k].ly) k++;
  const z = clock[k];
  const f = z.ly > 0 ? clamp((ly - z.startLy) / z.ly, 0, 1) : 1;
  const p = z.lambda > 1e-9 ? -Math.log1p(f * Math.expm1(-z.lambda)) / z.lambda : f;
  return z.s0 + p * z.screen;
}

export const TURN_SECONDS = 0.8;   // screen seconds each side of a via corner, per 60° of turn

// The heading the camera uses at ly along the leg: the path direction, turned smoothly through each via corner over
// screen time (most of a zone's distance passes in its first moments, so a turn spread over distance would snap):
// 1.6 s for a turn up to 60°, longer for a sharper one (the path doubles back 134° at Eridanus), so the view and the
// light-speed squeeze do not jump.
export function legHeading(stopIndex, branch = 'sheet', ly = 0) {
  const g = legGeom(stopIndex);
  const b = STOPS[stopIndex].branches && branch === 'void' ? 'void' : 'sheet';
  const d = clamp(finite(ly) ? ly : 0, 0, g.total);
  const k = d >= g.total ? g.seg.length - 1 : segmentAt(g, d);
  if (g.seg.length > 1) {
    const clock = legClock(stopIndex, b);
    const marks = [0, ...g.cum.slice(1, -1).map((c) => screenAt(clock, c)), screenAt(clock, g.total)];
    const now = screenAt(clock, d);
    for (let c = 1; c < g.seg.length; c++) {
      const turn = Math.acos(clamp(dot(g.dirs[c - 1], g.dirs[c]), -1, 1)) / D2R;
      const w = Math.min(TURN_SECONDS * Math.max(1, turn / 60), 0.45 * (marks[c] - marks[c - 1]),
        0.45 * (marks[c + 1] - marks[c]));
      if (w > 0 && Math.abs(now - marks[c]) < w) {
        return slerpDir(g.dirs[c - 1], g.dirs[c], smoothstep(marks[c] - w, marks[c] + w, now));
      }
    }
  }
  return [...g.dirs[k]];
}

// ---------- reveals ----------

export const REVEAL_ANGLE = 15;   // an extended landmark is seen this big (angular radius, degrees) at its reveal
export const MW_REVEAL_TILT = 38;   // degrees out of the disc plane for the Milky Way reveal, at least
const MW_POLE = [0, 0, 1];          // the Milky Way's disc normal in galactic axes

// dir turned toward or away from the pole so it is at least minDeg out of the plane, on the side it already is.
function tiltFromPlane(dir, pole, minDeg) {
  const e = dot(dir, pole);
  if (Math.abs(e) >= Math.sin(minDeg * D2R)) return dir;
  const h = unit(sub(dir, mul(pole, e)));
  const t = minDeg * D2R, side = e < 0 ? -1 : 1;
  return unit(add(mul(h, Math.cos(t)), mul(pole, side * Math.sin(t))));
}
export const REVEAL_FILL = 0.7;   // its ring then spans this share of the free box's shorter side
const EXTENDED = new Set(['wall', 'cluster', 'supercluster', 'galaxy', 'nebula', 'cluster-open', 'region']);

const isExtended = (o) => EXTENDED.has(o.kind) && finite(o.radiusLy) && o.radiusLy > 0;

// How far from the landmark the camera stops for a reveal, in ly. Extended landmarks are framed at REVEAL_ANGLE;
// stars at half the leg's drop-out zone; where the leg ends away from the landmark (the Milky Way's edge, the
// Kuiper belt), no closer than that end point.
const revealDist = new Map();
export function revealDistance(i) {
  if (revealDist.has(i)) return revealDist.get(i);
  const stop = STOPS[i];
  if (!stop) throw new Error(`no stop ${i}`);
  const o = OBJECTS[stop.target.id];
  const endGap = len(sub(OBJECTS[stop.to].pos, o.pos));
  const zones = zonesFor(i);
  const fit = isExtended(o) ? o.radiusLy / Math.sin(REVEAL_ANGLE * D2R) : 0.5 * zones[zones.length - 1].ly;
  const d = stop.to === stop.target.id ? fit : Math.max(endGap, isExtended(o) ? fit : 0);
  revealDist.set(i, d);
  return d;
}

// Field of view and aim so the target sits at the centre of the free box and, if extended, its ring spans
// REVEAL_FILL of the box's shorter side.
function framePoint(pos, at, radius, vp, fovY, upHint) {
  const d = len(sub(at, pos));
  let T = Math.tan((fovY * D2R) / 2);
  if (radius > 0 && d > radius) {
    const want = (REVEAL_FILL * Math.min(vp.box.w, vp.box.h)) / 2;      // ring radius, px
    T = clamp((Math.tan(Math.asin(radius / d)) * (vp.H / 2)) / want, Math.tan(10 * D2R), Math.tan(55 * D2R));
  }
  const nb = ndcBox(vp, 0);
  const f0 = unit(sub(at, pos));
  const basis = centreOn([f0], f0, (upHint && unit(sub(upHint, mul(f0, dot(upHint, f0))))) || refUp(f0), vp.aspect,
    nb, T).basis;
  return { pos, basis, fovY: (2 * Math.atan(T)) / D2R };
}

const revealCache = new Map();
// The reveal pose of a stop: the camera stopped revealDistance from the landmark, on the side it came from (Earth:
// on the side the ending approaches from), looking at it. Its position does not depend on the layout; the field of
// view and the aim do. offset: from the leg's end point to the camera, which the flight view trails the ship by.
export function revealPose(stopIndex, aspect, box) {
  const vp = viewportOf(aspect, box);
  const key = `${stopIndex}|${vp.W}x${vp.H}|${vp.box.x},${vp.box.y},${vp.box.w},${vp.box.h}`;
  if (revealCache.has(key)) return revealCache.get(key);
  const stop = STOPS[stopIndex];
  const o = OBJECTS[stop.target.id];
  const g = legGeom(stopIndex);
  const end = OBJECTS[stop.to].pos;
  const dist = revealDistance(stopIndex);
  let back = stopIndex === STOPS.length - 1 ? approachDir()
    : stop.to === stop.target.id ? mul(g.dirs[g.dirs.length - 1], -1) : unit(sub(end, o.pos));
  // The Milky Way is seen from the side the route comes in on (the Andromeda line, 15.8° under the disc), raised to
  // MW_REVEAL_TILT out of the plane so the barred spiral reads as one (the video shows it about 30° to 35° tilted).
  if (stop.target.id === 'milky-way') back = tiltFromPlane(back, MW_POLE, MW_REVEAL_TILT);
  const pos = add(o.pos, mul(back, dist));
  const fov = isExtended(o) ? 60 : flightFov(vp.aspect);
  const f = framePoint(pos, o.pos, isExtended(o) ? o.radiusLy : 0, vp, fov);
  const out = { ...f, velocity: [...g.dirs[g.dirs.length - 1]], offset: sub(pos, end) };
  cacheSet(revealCache, key, out);
  return out;
}

// Cached poses are frozen all the way down, so a caller cannot change them for the next caller by mistake.
function freeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}

function cacheSet(cache, key, value) {
  if (cache.size > 256) cache.clear();
  cache.set(key, freeze(value));
}

// ---------- scans ----------

// A scan by stop index (its stop scan), by scan id ('coma', 'triangulum', ...), or { stop, mode }.
export function scanEntry(ref) {
  let sc;
  if (typeof ref === 'number') sc = SCANS.find((s) => s.stop === ref && s.mode === 'stop');
  else if (typeof ref === 'string') sc = SCANS.find((s) => s.id === ref);
  else if (ref && typeof ref === 'object') {
    sc = SCANS.find((s) => s.stop === ref.stop && s.mode === (ref.mode === 'spot' ? 'spot' : 'stop'))
      || (ref.id && SCANS.find((s) => s.id === ref.id));
  }
  if (!sc) throw new Error(`no scan ${JSON.stringify(ref)}`);
  return sc;
}

// The object ids a scan shows: the run's draw ({ A, B, C } for this scan, or the whole draw keyed by scan id), else
// the target and every decoy.
export function candidateIds(ref, draw) {
  const sc = scanEntry(ref);
  const d = draw && (draw[sc.id] || (draw.A ? draw : null));
  if (d && d.A) return [d.A, d.B, d.C].filter((id) => OBJECTS[id]);
  return [sc.entry.target.id, ...sc.entry.decoys.map((x) => x.id)];
}

// Where the camera stands when a scan opens, before any pull-back: where the previous reveal left it (the start, for
// the first scan).
function scanAnchor(sc) {
  if (sc.mode === 'spot') return revealPose(sc.stop, 1.6).pos;
  return sc.stop === 0 ? [...OBJECTS.start.pos] : revealPose(sc.stop - 1, 1.6).pos;
}

// Objects framed with the candidates: the ring the opening points at (Laniakea) on the first scan.
function extraFrame(sc) {
  return sc.mode === 'stop' && sc.stop === 0 ? INTRO.filter((l) => l.ring && OBJECTS[l.ring]).map((l) => l.ring) : [];
}

// The tan-plane extent every point needs: the smallest tan(fovY/2) that keeps (X, Y) (tangent coordinates, X along
// right, Y along up) inside the box.
function needT(X, Y, aspect, nb) {
  let t = 0;
  if (X > 0) t = Math.max(t, nb.x1 > 0 ? X / (aspect * nb.x1) : Infinity);
  if (X < 0) t = Math.max(t, nb.x0 < 0 ? X / (aspect * nb.x0) : Infinity);
  if (Y > 0) t = Math.max(t, nb.y1 > 0 ? Y / nb.y1 : Infinity);
  if (Y < 0) t = Math.max(t, nb.y0 < 0 ? Y / nb.y0 : Infinity);
  return t;
}

// Turn the view (keeping its roll) until the directions' bounding box sits centred in the box. With T given the
// field of view is fixed; without it, T is the smallest that fits. Returns { T, basis } or null when a direction
// ends up behind the camera.
function centreOn(dirs, f0, up0, aspect, nb, fixedT) {
  let f = f0, up = up0, T = fixedT || 0;
  const cx = (nb.x0 + nb.x1) / 2, cy = (nb.y0 + nb.y1) / 2;
  for (let it = 0; it < 60; it++) {
    const right = unit(cross(f, up));
    up = cross(right, f);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, need = 0;
    for (const u of dirs) {
      const z = dot(u, f);
      if (z < 0.05) return null;
      const X = dot(u, right) / z, Y = dot(u, up) / z;
      xmin = Math.min(xmin, X); xmax = Math.max(xmax, X); ymin = Math.min(ymin, Y); ymax = Math.max(ymax, Y);
      need = Math.max(need, needT(X, Y, aspect, nb));
    }
    if (!fixedT) T = need;
    const dx = (xmin + xmax) / 2 - cx * aspect * T, dy = (ymin + ymax) / 2 - cy * T;
    if (it === 59 || Math.abs(dx) + Math.abs(dy) < 1e-10 * (1 + T)) return { T: need, basis: { right, up, fwd: f } };
    f = unit(add(f, add(mul(right, dx), mul(up, dy))));
    up = unit(sub(up, mul(f, dot(up, f))), refUp(f));
  }
  return null;
}

const ROLLS = 24;
// The best orientation from camera position C for points pts: the roll (around the mean direction) and aim that need
// the narrowest field of view, with a small preference for keeping galactic north up.
function bestFit(C, pts, aspect, nb, rolls = ROLLS) {
  const dirs = pts.map((p) => unit(sub(p, C)));
  const f0 = unit(dirs.reduce(add, [0, 0, 0]), dirs[0]);
  const ref = refUp(f0);
  let best = null;
  for (let k = 0; k < rolls; k++) {
    const roll = ((k <= rolls / 2 ? k : k - rolls) * 2 * Math.PI) / rolls;
    const r = centreOn(dirs, f0, rotate(ref, f0, roll), aspect, nb, 0);
    if (!r) continue;
    const key = r.T * (1 + (0.08 * Math.abs(roll)) / Math.PI);
    if (!best || key < best.key) best = { ...r, key };
  }
  return best;
}

const SLACK = 1.06;          // field-of-view headroom over the tightest fit
export const MIN_SEP_PX = 40; // candidates closer than this on screen send the camera looking for a better viewpoint

// A framing from camera position C: the tightest fit, then a little headroom within [tMin, tMax]. The fit is centred
// in the box at its own field of view; widening only draws the points toward the screen centre, which lies inside
// the box, so they stay inside. minSep: the closest two of the first n points (the candidates), CSS px.
// Null when the points do not fit at tMax.
function frameAt(C, pts, n, vp, nb, lim, rolls) {
  const fit = bestFit(C, pts, vp.aspect, nb, rolls);
  if (!fit || fit.T * SLACK > lim.tMax) return null;
  const T = clamp(fit.T * SLACK, lim.tMin, lim.tMax);
  const { right, up, fwd } = fit.basis;
  const xy = pts.slice(0, n).map((p) => {
    const u = unit(sub(p, C)), z = dot(u, fwd);
    return [((dot(u, right) / z / (vp.aspect * T)) * vp.W) / 2, ((dot(u, up) / z / T) * vp.H) / 2];
  });
  let minSep = Infinity;
  for (let i = 0; i < xy.length; i++) {
    for (let j = i + 1; j < xy.length; j++) {
      minSep = Math.min(minSep, Math.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]));
    }
  }
  return { C, basis: fit.basis, T, minSep };
}

// Points spread evenly over the sphere (Fibonacci lattice).
function sphere(i, n) {
  const z = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - z * z), a = i * Math.PI * (3 - Math.sqrt(5));
  return [r * Math.cos(a), r * Math.sin(a), z];
}

// When the candidates crowd together from where the camera stands (Earth, Venus and Mars line up seen from the
// Kuiper belt), look for a viewpoint around them that spreads them apart: the most on-screen room between the
// closest two, with a small preference for the side the camera came from.
function vantage(anchor, pts, n, vp, nb, lim) {
  const cands = pts.slice(0, n);
  const G = mul(cands.reduce(add, [0, 0, 0]), 1 / cands.length);
  const R = Math.max(...cands.map((p) => len(sub(p, G)))) || 1;
  const toAnchor = unit(sub(anchor, G));
  let best = null;
  for (let i = 0; i < 64; i++) {
    const dir = sphere(i, 64);
    for (const k of [0.3, 0.45, 0.7, 1, 1.5, 2.2, 3.3, 5, 8, 12, 20]) {
      const f = frameAt(add(G, mul(dir, k * R)), pts, n, vp, nb, lim, 8);
      if (!f) continue;
      const score = f.minSep * (1 + 0.15 * dot(dir, toAnchor));
      if (!best || score > best.score) best = { ...f, score };
    }
  }
  return best && (frameAt(best.C, pts, n, vp, nb, lim, ROLLS) || best);
}

const scanCache = new Map();

// The camera framing for a scan: every candidate (and, on the first scan, the Laniakea ring) inside the free box of
// the layout, at least SCAN_PAD px from its edges, with the roll free. The camera starts where the previous reveal
// left it. When the candidates spread too wide for the scan's widest field of view, it pulls back, away from them;
// when two of them crowd closer than MIN_SEP_PX, it looks for a viewpoint that spreads them.
// ref: stop index, scan id or { stop, mode }. aspect: width / height. box: contentBox(...) (CSS px with width and
// height), or shares of the screen. opts: { ids } to frame given candidates, or { draw } (the run's draw).
// Returns { id, stop, mode, ids, frame, pos, basis, quat, fovY, aspect, width, height, box, anchor, pull (ly from the
// anchor), moved ('none' | 'pull' | 'vantage'), minSepPx }.
export function scanPose(ref, aspect, box, opts = {}) {
  const sc = scanEntry(ref);
  const vp = viewportOf(aspect, box);
  const ids = Array.isArray(opts.ids) && opts.ids.length ? opts.ids.filter((id) => OBJECTS[id])
    : candidateIds(sc, opts.draw);
  // The framing does not depend on which letter each candidate got, so the same set always gets the same view.
  const set = [...ids].sort();
  const frame = [...set, ...extraFrame(sc).filter((id) => !ids.includes(id))];
  const b = vp.box;
  const key = `${sc.id}|${frame.join(',')}|${vp.W}x${vp.H}|${b.x},${b.y},${b.w},${b.h}`;
  if (scanCache.has(key)) return { ...scanCache.get(key), ids };

  const pts = frame.map((id) => OBJECTS[id].pos);
  const nb = ndcBox(vp, SCAN_PAD);
  const { fovMin = 6, fovMax = 60 } = sc.entry.scan || {};
  const lim = {
    tMin: Math.tan((fovMin * D2R) / 2),
    tMax: Math.min(Math.tan((fovMax * D2R) / 2), Math.tan(55 * D2R) / Math.max(vp.aspect, 1)),
  };
  const anchor = scanAnchor(sc);
  let best = frameAt(anchor, pts, ids.length, vp, nb, lim), moved = 'none';
  if (!best) {
    // Pull back, away from the candidates, until they fit: step out, then halve in.
    const away = unit(mul(pts.map((p) => unit(sub(p, anchor))).reduce(add, [0, 0, 0]), -1), [0, 0, 1]);
    const L = pts.reduce((s, p) => s + len(sub(p, anchor)), 0) / pts.length || 1;
    let lo = 0, hi = 0.02 * L, hiFit = null;
    for (let k = 0; k < 80 && !hiFit; k++) {
      hiFit = frameAt(add(anchor, mul(away, hi)), pts, ids.length, vp, nb, lim);
      if (!hiFit) { lo = hi; hi *= 1.5; }
    }
    for (let k = 0; k < 40 && hiFit && hi - lo > 1e-4 * hi; k++) {
      const mid = (lo + hi) / 2, f = frameAt(add(anchor, mul(away, mid)), pts, ids.length, vp, nb, lim);
      if (f) { hi = mid; hiFit = f; } else lo = mid;
    }
    if (hiFit) { best = hiFit; moved = 'pull'; }
  }
  if (!best || best.minSep < MIN_SEP_PX) {
    const v = vantage(anchor, pts, ids.length, vp, nb, lim);
    if (v && (!best || v.minSep > 1.25 * best.minSep)) { best = v; moved = 'vantage'; }
  }
  if (!best) throw new Error(`scan ${sc.id}: no framing fits`);

  // Check with the shared projection; widen a little if rounding left a point outside.
  let T = best.T, cam;
  for (let k = 0; k < 20; k++) {
    cam = { pos: best.C, basis: best.basis, fovY: (2 * Math.atan(T)) / D2R, aspect: vp.aspect, width: vp.W,
      height: vp.H, phiView: 0 };
    const inside = pts.every((p) => {
      const q = project(p, cam, 0);
      return q.front && q.x >= b.x + SCAN_PAD - 0.5 && q.x <= b.x + b.w - SCAN_PAD + 0.5
        && q.y >= b.y + SCAN_PAD - 0.5 && q.y <= b.y + b.h - SCAN_PAD + 0.5;
    });
    if (inside || T >= lim.tMax) break;
    T = Math.min(lim.tMax, T * 1.02);
  }
  const xy = set.map((id) => project(id, cam, 0));
  let minSepPx = Infinity;
  for (let i = 0; i < xy.length; i++) {
    for (let j = i + 1; j < xy.length; j++) {
      minSepPx = Math.min(minSepPx, Math.hypot(xy[i].x - xy[j].x, xy[i].y - xy[j].y));
    }
  }
  const out = {
    id: sc.id, stop: sc.stop, mode: sc.mode, ids, frame, pos: cam.pos, basis: cam.basis, quat: basisToQuat(cam.basis),
    fovY: cam.fovY, aspect: vp.aspect, width: vp.W, height: vp.H, box: { ...b }, anchor,
    pull: len(sub(cam.pos, anchor)), moved, minSepPx,
  };
  cacheSet(scanCache, key, out);
  return out;
}

// ---------- the camera ----------

export const FLIGHT_BLEND = 1.2;   // seconds: scan framing → flight view
export const CLUE_BLEND = 2.0;     // seconds: reveal → the next scan's framing
export const SPOT_BLEND = 1.0;     // seconds: a spot's framing → aimed at its answer
export const INTRO_PUSH = 6;       // seconds: the title view eases into the first scan
export const APPROACH = 8;         // seconds: Earth grows at the start of the ending
export const ADDRESS = ['earth', 'sun', 'orion-arm', 'milky-way', 'local-group', 'laniakea'];
export const ENDING = ['approach', 'today', 'clocks', 'address', 'card'];   // engine.ENDING_BEATS
const CHAPTER_STARTS = CHAPTERS.map((c) => stopIndex(c.stops[0]));
const LAST = STOPS.length - 1;
const EARTH_R_LY = OBJECTS.earth.radiusKm / KM_PER_LY;

// A pose is { pos, basis, fovY, velocity, phiView, fade, ship? }. Blending two: position linear, orientation by
// slerp, field of view and view rapidity linear.
function blendPose(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    ...b,
    pos: mix3(a.pos, b.pos, t),
    basis: quatToBasis(slerp(basisToQuat(a.basis), basisToQuat(b.basis), t)),
    fovY: a.fovY * (1 - t) + b.fovY * t,
    velocity: unit(mix3(a.velocity || b.velocity, b.velocity, t), b.velocity),
    phiView: (a.phiView || 0) * (1 - t) + (b.phiView || 0) * t,
    fade: (a.fade ?? 1) * (1 - t) + (b.fade ?? 1) * t,
  };
}

// Yaw (about the framing's up, + looks right) then pitch (about the turned right axis, + looks up), in degrees.
function applyLook(basis, yawDeg, pitchDeg) {
  const y = yawDeg * D2R, p = pitchDeg * D2R;
  const f1 = add(mul(basis.fwd, Math.cos(y)), mul(basis.right, Math.sin(y)));
  const r1 = sub(mul(basis.right, Math.cos(y)), mul(basis.fwd, Math.sin(y)));
  const f2 = add(mul(f1, Math.cos(p)), mul(basis.up, Math.sin(p)));
  const u2 = sub(mul(basis.up, Math.cos(p)), mul(f1, Math.sin(p)));
  return { right: unit(r1), up: unit(u2), fwd: unit(f2) };
}

function clampLook(look) {
  const yaw = finite(look && look.yaw) ? clamp(look.yaw, -LOOK_YAW, LOOK_YAW) : 0;
  const pitch = finite(look && look.pitch) ? clamp(look.pitch, -LOOK_PITCH, LOOK_PITCH) : 0;
  return { yaw, pitch };
}

// The look offsets (degrees, clamped to the look limits) that bring a position, an object id or a project() input
// to the middle of the free box, for a camera made by cameraFor (it keeps the scan's framing in cam.frame). Used to
// swing the view when an edge chevron is tapped.
export function lookToward(target, cam) {
  const base = cam.frame || cam.basis;
  const pos = typeof target === 'string' ? OBJECTS[target].pos : Array.isArray(target) ? target : target.pos;
  const n = unit(sub(pos, cam.pos));
  const T = Math.tan((cam.fovY * D2R) / 2);
  const H = cam.height || 1, W = cam.width || (cam.aspect || 1) * H;
  const b = cam.box || { x: 0, y: 0, w: W, h: H };
  const mid = [((2 * (b.x + b.w / 2)) / W - 1) * T * (W / H), (1 - (2 * (b.y + b.h / 2)) / H) * T, 1];
  const toward = unit(add(add(mul(base.right, mid[0]), mul(base.up, mid[1])), base.fwd));
  const angles = (v) => [Math.atan2(dot(v, base.right), dot(v, base.fwd)),
    Math.atan2(dot(v, base.up), Math.hypot(dot(v, base.right), dot(v, base.fwd)))];
  const [ty, tp] = angles(n), [my, mp] = angles(toward);
  return clampLook({ yaw: (ty - my) / D2R, pitch: (tp - mp) / D2R });
}

const asPose = (p) => ({ pos: p.pos, basis: p.basis, fovY: p.fovY, velocity: p.velocity || p.basis.fwd, phiView: 0,
  fade: 1 });

function scanPoseFor(sc, draw, vp) {
  return asPose(scanPose(sc, vp.aspect, vp.box, { draw }));
}

// The title view: the first scan's framing, a little wider.
function titlePose(vp) {
  const p = scanPoseFor(scanEntry(0), null, vp);
  const T = Math.min(Math.tan((p.fovY * D2R) / 2) * 1.3, Math.tan(60 * D2R));
  return { ...p, fovY: (2 * Math.atan(T)) / D2R };
}

// The reveal of a spot: the spot's framing turned so its answer sits in the middle of the free box.
function spotRevealPose(i, draw, vp) {
  const sc = scanEntry({ stop: i, mode: 'spot' });
  const base = scanPose(sc, vp.aspect, vp.box, { draw });
  const f = framePoint(base.pos, OBJECTS[sc.entry.target.id].pos, 0, vp, base.fovY, base.basis.up);
  return { ...asPose(base), basis: f.basis };
}

// What the screen showed just before stop i's clue: the previous reveal, or its spot's reveal.
function beforeClue(i, draw, vp) {
  if (i <= 0) return scanPoseFor(scanEntry(0), draw, vp);
  if (STOPS[i - 1].spot) return spotRevealPose(i - 1, draw, vp);
  return asPose(revealPose(i - 1, vp.aspect, vp.box));
}

// The flight view: trailing the ship by the reveal's offset and looking along the heading; in the drop-out it turns
// to the reveal's aim while the light-speed squeeze eases to nothing. The view rapidity is the engine's
// (flight.view), else viewRapidity(flight.x).
function flightPose(state, vp) {
  const i = clamp(state.stop | 0, 0, LAST), f = state.flight, branch = state.branch === 'void' ? 'void' : 'sheet';
  const zones = zonesFor(i, branch);
  const zi = clamp(Number.isInteger(f.zone) ? f.zone : 0, 0, zones.length - 1);
  const z = zones[zi];
  const p = clamp(finite(f.p) ? f.p : 0, 0, 1);
  const ly = finite(f.ly) ? f.ly : z.startLy + p * z.ly;
  const ship = legPath(i, branch, ly).pos;
  const heading = legHeading(i, branch, ly);
  const rv = revealPose(i, vp.aspect, vp.box);
  let basis = lookBasis(heading, legUp(i)), fovY = flightFov(vp.aspect);
  let phi = finite(f.view) ? Math.max(0, f.view) : viewRapidity(finite(f.x) ? f.x : 0);
  if (zi === zones.length - 1) {
    const q = ease(p);
    basis = quatToBasis(slerp(basisToQuat(basis), basisToQuat(rv.basis), q));
    fovY = fovY * (1 - q) + rv.fovY * q;
    phi *= 1 - q;
  }
  return { pos: add(ship, rv.offset), ship, basis, fovY, velocity: heading, phiView: phi, fade: 1 };
}

// Earth is approached from between the Kuiper belt point and the Sun, so its day side shows with a terminator.
function approachDir() {
  const e = OBJECTS.earth.pos;
  return unit(add(unit(sub(OBJECTS.kuiper.pos, e)), mul(unit(mul(e, -1)), 1.3)));
}

// A still that frames an object for the ending's address: Earth and the Sun from their sunlit side, the rest from
// above the galactic plane at the reveal framing distance.
function stillPose(id, vp) {
  if (id === 'earth') return earthStill(vp);
  const o = OBJECTS[id];
  let from, dist, radius = 0;
  if (id === 'sun') { from = unit(add(unit(OBJECTS.earth.pos), [0, 0, 0.6])); dist = 3 * AU_LY; }
  else { from = unit([-0.35, 0.2, 1]); radius = radiusOf(o); dist = radius / Math.sin(REVEAL_ANGLE * D2R); }
  const f = framePoint(add(o.pos, mul(from, dist)), o.pos, radius, vp, 50);
  return { ...f, velocity: f.basis.fwd, phiView: 0, fade: 1 };
}

// Earth at the end of the approach, for the date and the clocks, "Home." and the score card: seen from the sunlit
// approach side, centred in the lower 72 % of the free box (the date stamp sits above it, the caption below the box),
// its disc filling REVEAL_FILL of that part's shorter side at the flight field of view. As in the video, the caption
// never covers the planet.
const EARTH_BOX_TOP = 0.28;
function earthStill(vp) {
  const b = vp.box;
  const low = { ...vp, box: { ...b, y: b.y + EARTH_BOX_TOP * b.h, h: (1 - EARTH_BOX_TOP) * b.h } };
  const fovY = flightFov(vp.aspect);
  const want = (REVEAL_FILL * Math.min(low.box.w, low.box.h)) / 2;
  const ang = Math.atan((want * Math.tan((fovY * D2R) / 2)) / (vp.H / 2));
  const e = OBJECTS.earth.pos;
  const f = framePoint(add(e, mul(approachDir(), EARTH_R_LY / Math.sin(ang))), e, 0, low, fovY);
  return { ...f, velocity: f.basis.fwd, phiView: 0, fade: 1 };
}

// The ending (engine beats approach, today, clocks, address, card): Earth grows from the reveal distance and settles
// in the lower part of the screen while the Moon passes; it holds for 'today' and the clocks; then one still per
// address line (following the caption's ring when say is given, else every 2.5 s); Earth again for "Home." and the
// score card. ending: { beat, t } (engine state.ending); say: engine state.say.
export function endingPose(ending, aspect, box, say) {
  const vp = viewportOf(aspect, box);
  const beat = clamp(Number.isInteger(ending && ending.beat) ? ending.beat : 0, 0, ENDING.length - 1);
  const t = finite(ending && ending.t) ? Math.max(0, ending.t) : 0;
  if (ENDING[beat] === 'address') {
    // "Not the centre of anything." has no ring and stays on Laniakea; "Home." rings Earth.
    const cur = say && say.current;
    const ring = cur ? cur.ring : undefined;
    const id = ADDRESS.includes(ring) ? ring : ring === 'home' ? 'earth' : cur ? 'laniakea'
      : ADDRESS[clamp(Math.floor(t / 2.5), 0, ADDRESS.length - 1)];
    return stillPose(id, vp);
  }
  if (ENDING[beat] === 'card') return stillPose('earth', vp);
  const e = OBJECTS.earth.pos;
  const still = earthStill(vp);
  const k = ENDING[beat] === 'approach' ? ease(t / APPROACH) : 1;
  const d0 = revealDistance(LAST), d1 = len(sub(still.pos, e));
  const pos = add(e, mul(approachDir(), d0 * (d1 / d0) ** k));
  // Aim so Earth sits in the lower part of the free box (the line to Earth does not turn as the camera closes in);
  // the turn from the reveal's aim takes the first 2 s.
  const rv = revealPose(LAST, vp.aspect, vp.box);
  const w = ENDING[beat] === 'approach' ? ease(t / 2) : 1;
  const basis = quatToBasis(slerp(basisToQuat(rv.basis), basisToQuat(still.basis), w));
  return { pos, basis, fovY: rv.fovY * (1 - w) + still.fovY * w, velocity: basis.fwd, phiView: 0, fade: 1 };
}

// Earth and the Moon together for the cabinet art (?keyart=1): seen from just beyond the Moon on its sunlit side, the
// Moon large in front and a gibbous Earth behind it, both well inside the box. Returns a camera description like
// cameraFor's.
export function keyartPose(aspect, box) {
  const vp = viewportOf(aspect, box);
  const e = OBJECTS.earth.pos, m = OBJECTS.moon.pos;
  const out = unit(sub(m, e)), sun = unit(mul(e, -1));
  const side = unit(sub(sun, mul(out, dot(sun, out))));
  const pos = add(m, mul(unit(add(out, mul(side, 0.2))), 8 * EARTH_R_LY));
  const nb = ndcBox(vp, Math.min(60, vp.box.h / 4));
  const fit = bestFit(pos, [e, m], vp.aspect, nb);
  const T = clamp(fit.T * 1.1, Math.tan(4 * D2R), Math.tan(50 * D2R));
  return describe({ pos, basis: fit.basis, fovY: (2 * Math.atan(T)) / D2R, velocity: fit.basis.fwd, phiView: 0,
    fade: 1 }, vp, { phase: 'keyart', ship: e });
}

// The scan (stop or spot) a state is on.
function scanOf(state) {
  return scanEntry({ stop: clamp(state.stop | 0, 0, LAST), mode: state.mode === 'spot' ? 'spot' : 'stop' });
}

// The camera for a game state (engine state shape, final.md 2.13). aspect: width / height. look: { yaw, pitch }
// (degrees: the player's drag in a scan, clamped to ±60 and ±35; keep passing the last values for the first 1.2 s of
// a flight so the turn starts where the player was looking) and reduced: true for reduced motion (cuts, no sweeps,
// no fold). box: the free box (contentBox or freeBox, CSS px with width and height). Returns the camera description
// shared by render/view.sync, ui/overlay and picking:
//   phase · pos [x, y, z] ly (camera) · ship [x, y, z] ly (the ship) · basis { right, up, fwd } · quat [x, y, z, w]
//   fovY (degrees, vertical) · aspect · width · height (CSS px) · box (the free box)
//   scale (ly from the Sun) · layer (main layer) · near · far (its clip planes, in its unit)
//   layerWeights { cosmic, group, galaxy, stars, solar }
//   layers { name: { weight, unit (ly), origin (pos / unit, float64: set the layer root to −origin), near, far } }
//   phiView · expPhi · expMinusPhi · velocity (unit, galaxy frame) · velocityView (camera axes, [0, 0, −1] ahead)
//   frame (the scan framing before look, or null) · look { yaw, pitch } (as used) · fade (0..1)
export function cameraFor(state, aspect, look = {}, box) {
  const vp = viewportOf(aspect, box);
  const s = state || {};
  const phase = s.phase || 'title';
  const t = finite(s.phaseT) ? Math.max(0, s.phaseT) : 0;
  const reduced = Boolean(look && look.reduced);
  const w = (dur) => (reduced ? 1 : ease(t / dur));
  const lk = clampLook(look);
  let pose, frame = null, used = { yaw: 0, pitch: 0 };
  const withLook = (p) => {
    frame = p.basis;
    used = lk;
    return { ...p, basis: applyLook(p.basis, lk.yaw, lk.pitch) };
  };

  if (phase === 'title') {
    pose = withLook(titlePose(vp));
  } else if (phase === 'intro') {
    pose = blendPose(titlePose(vp), scanPoseFor(scanEntry(0), s.draw, vp), w(INTRO_PUSH));
  } else if (phase === 'clue' || phase === 'scan' || phase === 'fork') {
    const sc = scanOf(s);
    const to = scanPoseFor(sc, s.draw, vp);
    if (phase === 'clue') {
      const from = sc.mode === 'spot' ? asPose(revealPose(sc.stop, vp.aspect, vp.box))
        : beforeClue(sc.stop, s.draw, vp);
      pose = blendPose(from, to, w(CLUE_BLEND));
    } else pose = withLook(to);
  } else if (phase === 'flight' && s.flight) {
    pose = flightPose(s, vp);
    if (t < FLIGHT_BLEND && !reduced) {
      const from = scanPoseFor(scanEntry(clamp(s.stop | 0, 0, LAST)), s.draw, vp);
      pose = blendPose({ ...from, basis: applyLook(from.basis, lk.yaw, lk.pitch) }, pose, w(FLIGHT_BLEND));
    }
  } else if (phase === 'reveal') {
    if (s.mode === 'spot') {
      const sc = scanOf(s);
      pose = blendPose(scanPoseFor(sc, s.draw, vp), spotRevealPose(sc.stop, s.draw, vp), w(SPOT_BLEND));
    } else pose = asPose(revealPose(clamp(s.stop | 0, 0, LAST), vp.aspect, vp.box));
  } else if (phase === 'chapter') {
    // The card between chapters holds what the last reveal showed; the engine may already point at the next stop.
    const i = clamp(s.stop | 0, 0, LAST);
    pose = beforeClue(CHAPTER_STARTS.includes(i) && i > 0 ? i : Math.min(i + 1, LAST), s.draw, vp);
  } else if (phase === 'ending') {
    pose = endingPose(s.ending, vp.aspect, vp.box, s.say);
  } else if (phase === 'lost') {
    // The sky folds into the point ahead and fades; under reduced motion it only fades.
    const base = s.flight ? flightPose(s, vp) : beforeClue(clamp(s.stop | 0, 0, LAST), s.draw, vp);
    pose = { ...base, phiView: (base.phiView || 0) + (reduced ? 0 : 4 * smoothstep(0, 2.5, t)),
      fade: 1 - smoothstep(1.5, 3.5, t) };
  } else {
    pose = withLook(scanPoseFor(scanOf(s), s.draw, vp));
  }
  return describe(pose, vp, { phase, frame, look: used, ship: pose.ship || shipOf(s) });
}

// Work out ahead of time the framings this stop and the next will need (a viewpoint search can take tens of ms the
// first time), so main.js can call it in idle time during a flight or a reveal. Returns the scan ids prepared.
export function prepareScans(state, aspect, box) {
  const vp = viewportOf(aspect, box);
  const s = state || {};
  const i = clamp(s.stop | 0, 0, LAST);
  return SCANS.filter((sc) => sc.stop === i || sc.stop === i + 1).map((sc) => {
    scanPose(sc, vp.aspect, vp.box, { draw: s.draw });
    return sc.id;
  });
}

// The ship's own position in a state: along the leg in flight, else where the last leg ended.
function shipOf(s) {
  const i = clamp(s.stop | 0, 0, LAST);
  if (s.flight && (s.phase === 'flight' || s.phase === 'lost')) {
    return legPath(i, s.branch === 'void' ? 'void' : 'sheet', s.flight.ly).pos;
  }
  if (!s.phase || s.phase === 'title' || s.phase === 'intro') return [...OBJECTS.start.pos];
  if (s.phase === 'reveal' || s.phase === 'ending' || s.mode === 'spot') return [...OBJECTS[STOPS[i].to].pos];
  return [...OBJECTS[STOPS[i].from].pos];
}

// The full camera description from a pose.
function describe(pose, vp, { phase, frame = null, look = { yaw: 0, pitch: 0 }, ship } = {}) {
  const basis = { right: unit(pose.basis.right), up: unit(pose.basis.up), fwd: unit(pose.basis.fwd) };
  const scale = viewScale(pose.pos);
  const weights = layerWeights(scale);
  const layer = layerFor(scale);
  const layers = {};
  for (const name of LAYER_NAMES) {
    const unitLy = LAYER_UNITS[name];
    const [near, far] = name === 'solar' ? [solarNear(pose.pos), LAYER_CLIP.solar[1]] : LAYER_CLIP[name];
    layers[name] = { weight: weights[name], unit: unitLy, origin: pose.pos.map((v) => v / unitLy), near, far };
  }
  const phi = Math.max(0, finite(pose.phiView) ? pose.phiView : 0);
  const v = unit(pose.velocity || basis.fwd);
  return {
    phase, pos: [...pose.pos], ship: ship ? [...ship] : [...pose.pos], basis, quat: basisToQuat(basis),
    fovY: pose.fovY, aspect: vp.aspect, width: vp.W, height: vp.H, box: { ...vp.box },
    scale, layer, near: layers[layer].near, far: layers[layer].far, layerWeights: weights, layers,
    phiView: phi, expPhi: Math.exp(phi), expMinusPhi: Math.exp(-phi),
    velocity: v, velocityView: [dot(v, basis.right), dot(v, basis.up), -dot(v, basis.fwd)],
    frame: frame ? { right: [...frame.right], up: [...frame.up], fwd: [...frame.fwd] } : null, look,
    fade: clamp(finite(pose.fade) ? pose.fade : 1, 0, 1),
  };
}
