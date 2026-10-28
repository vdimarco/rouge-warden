// First Breath: the bake cache (design.md 14.1). Still sheets are cut and shadowed once into offscreen canvases and
// blitted every frame:
// - the renderer's frames (the tunnel-book flats of stages 3 to 7, the straight side flats of stage 8, the ending's
//   room sheets), once per stage, size, scale step and tier, with a margin so the vignette's scaled blit still covers
//   the screen; and the inner sheet behind the bodies (stages 6 and 7: the fluid);
// - the course tiles (stages 1 and 3): world-space chunks 64 u long across the course, keyed by stage, scale step,
//   orientation and chunk index, each holding the floor dots, the warm and cool sides and the wall sheets. The
//   stage sends only the visible window of each course strip; a chunk the window does not yet cover is baked as
//   provisional and baked again once it is covered. While the span eases (stage 1, 170 to 150 u) chunks are blitted
//   scaled and baked again once it settles. A camera turn re-bakes. Chunks far behind leave the cache;
// - the dot atlas (points and motes: paper dots in 8 sizes per tone, their cheap shadow baked in);
// - the dapple tiles (the caustics sheet: cut cream spots) and the grain tile.
// A frame that bakes is flagged; render/perf.js leaves it out of the frame cost.
//
// Sources (14.2): tunnel books and shadow boxes (paper engineering) for the stacked frames with windows; Gris (Nomada
// Studio) for layered silhouettes darker toward the viewer; Charley Harper's rows of dots for the floor dots; MDN,
// "Optimizing canvas" (pre-render similar or repeating objects on an offscreen canvas). World-space course tiles,
// the vignette as the front frame closing in, the union of course sheets by destination-out: none fit, our own.
// The dapple sheet: adapted from Zucconi, "Believable Caustics Reflections" (2019), the idea of one tileable texture
// moved twice against itself; here two baked tiles of cut cream spots.
import * as P from "./paper.js";
import { STAGES, ROLES, roleHex, SHARED } from "./palette.js";
import { glowDiscs } from "./low.js";

export const CHUNK_U = 64;          // course chunk length (u)
const CHUNK_X = 175;                // chunk half-width across the course (u)
const KREF = 2.6;                   // cut space: world u × this, so a course edge is the same at every zoom

const ink = SHARED.ink;
const TONE_SEED = { womb: 0, warm: 1, cool: 2 };
const fin = (v) => typeof v === "number" && Number.isFinite(v);

// ---- the renderer's frames
// The window of frame layer i (0 = the back-most, smallest window) as an ellipse, in CSS px.
export function frameWindows(v, rec) {
  const short = Math.min(v.W, v.H);
  const R = (rec.size || 0.5) * short;
  const layout = v.cam.layout;
  const [sx, sy] = layout === "portrait" ? [0.93, 1.28] : layout === "landscape" ? [1.38, 0.97] : [1.26, 0.96];
  const n = rec.tokens.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = 1 - (n - 1 - i) * 0.085;
    out.push({ cx: v.cam.subject.x, cy: v.cam.subject.y, rx: R * sx * f, ry: R * sy * f });
  }
  return { R, list: out };
}

export function bakeFrames(v, stage, rec, tier) {
  const short = Math.min(v.W, v.H), long = Math.max(v.W, v.H);
  const m = Math.ceil(0.2 * long);
  const hs = v.hs;
  const win = frameWindows(v, rec);
  const flat = tier.bakeShadow === "flat";
  const b = P.bakeCanvas(v.makeCanvas, 0, 0, v.W, v.H, m, v.dpx, (c) => {
    const n = rec.tokens.length;
    for (let i = 0; i < n; i++) {
      const color = roleHex(stage, rec.tokens[i]);
      const w = win.list[i];
      const p = new Path2D();
      const h = (5 + 1.6 * i) * hs;
      if (rec.shape === "sides") {
        // two straight side flats: each touches only its own screen side (and runs past the top and bottom)
        const xs = [w.cx - (0.45 * v.W) * (1 - (n - 1 - i) * 0.09), w.cx + (0.45 * v.W) * (1 - (n - 1 - i) * 0.09)];
        for (let side = 0; side < 2; side++) {
          const x = xs[side], outer = side === 0 ? -m : v.W + m;
          const edge = [];
          for (let y = -m; y <= v.H + m; y += 18) edge.push(x + 3 * hs * Math.sin(y * 0.013 + i * 1.7 + side), y);
          const pts = P.cut(edge, false, { step: 6, amp: 1.6 * hs, jitter: 0.5, seed: 40 + i * 2 + side });
          const poly = side === 0 ? [outer, -m, ...pts, outer, v.H + m] : [outer, v.H + m, ...P.rev2(pts), outer, -m];
          P.path(poly, true, p);
        }
        P.sheet(c, p, color, h, flatOr(flat, { edge: 0, core: 0.2, coreWidth: 2 * hs, grain: tier.grain * 0.9, pattern: v.pattern, ga: 0.5 + i, shadow: { alpha: 0.42 } }));
      } else if (rec.shape === "room") {
        // the ending's warm room: large soft sheets in two corners, never a closed window
        const blob = i === 0
          ? P.circle(v.W * 0.06, v.H * 1.04, short * 0.92, { seed: 61, step: 8, amp: 2.5 * hs, scallops: 5, depth: 6 * hs })
          : P.circle(v.W * 1.02, v.H * 0.0, short * 0.62, { seed: 62, step: 8, amp: 2.5 * hs, scallops: 4, depth: 5 * hs });
        P.path(blob, true, p);
        P.sheet(c, p, color, (3 + 2 * i) * hs, flatOr(flat, { edge: 0, core: 0.25, coreWidth: 2 * hs, grain: tier.grain * 0.7, pattern: v.pattern, ga: 1 + i, shadow: { alpha: 0.18 } }));
      } else {
        p.rect(-m, -m, v.W + 2 * m, v.H + 2 * m);
        const sc = rec.shape === "scallop" ? rec.scallops || 12 : rec.scallops || 0;
        const ring = P.circle(w.cx, w.cy, 1, {
          n: 168, amp: 0, jitter: 0, scallops: sc, depth: sc ? (rec.depthK || 1.2) * 0.034 * (1 + 0.12 * i) : 0,
          rot: (i % 2) * (Math.PI / Math.max(1, sc)), sx: w.rx, sy: w.ry,
        });
        const pts = P.cut(ring, true, { step: 6, amp: 1.4 * hs, jitter: 0.45, seed: 50 + i });
        P.path(pts, true, p);
        P.sheet(c, p, color, h, flatOr(flat, { rule: "evenodd", edge: 0, core: 0.22, coreWidth: 2.2 * hs, grain: tier.grain * 0.9, pattern: v.pattern, ga: 0.6 + i, shadow: { alpha: 0.42, blur: 2.5 * hs + 0.4 * h } }));
      }
    }
  });
  b.win = win;
  b.front = roleHex(stage, rec.tokens[rec.tokens.length - 1]);
  return b;
}

// The inner sheet of stages 6 and 7 (the fluid in the window), baked once per size.
export function bakeInner(v, stage, role, rec, tier) {
  const win = frameWindows(v, rec).list[0];
  const color = roleHex(stage, role.inner);
  const m = 20 * v.hs;
  return P.bakeCanvas(v.makeCanvas, 0, 0, v.W, v.H, m, v.dpx, (c) => {
    const pts = P.cut(P.circle(win.cx, win.cy + 6 * v.hs, 1, { n: 120, amp: 0, jitter: 0, sx: win.rx * 0.9, sy: win.ry * 0.9 }), true, { step: 7, amp: 1.6 * v.hs, seed: 71 });
    const p = P.path(pts);
    P.sheet(c, p, color, 2.5 * v.hs, flatOr(tier.bakeShadow === "flat", { edge: 1.2, grain: tier.grain, pattern: v.pattern, ga: 2.2, shadow: { alpha: 0.3 } }));
  });
}

function flatOr(flat, o) {
  if (!flat) return o;
  return { ...o, grain: 0, shadow: { ...(o.shadow || {}), blur: 0, strokes: 0 } };
}

// ---- the course
// The chunk camera: world → chunk-local px (the camera's turn and scale, no translation), origin at (0, j·64).
function chunkMap(cam, j) {
  const c = Math.cos(cam.theta), s = Math.sin(cam.theta), k = cam.pxPerU, y0 = j * CHUNK_U;
  return (wx, wy) => [(c * wx - s * (wy - y0)) * k, -(s * wx + c * (wy - y0)) * k];
}

// Edges of a course strip at depth D (u), as world polylines: left (+normal) and right (−normal).
export function stripEdges(st, D) {
  const pts = st.pts, w = st.w, n = pts.length >> 1;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = pts[2 * b] - pts[2 * a], ty = pts[2 * b + 1] - pts[2 * a + 1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const half = (fin(w[i]) ? w[i] : w[w.length - 1] || 20) / 2 + D;
    L.push(pts[2 * i] - ty * half, pts[2 * i + 1] + tx * half);
    R.push(pts[2 * i] + ty * half, pts[2 * i + 1] - tx * half);
  }
  return { L, R };
}

// One course edge cut in cut space (world × KREF), then mapped to chunk px.
export function cutCourseEdge(worldPts, k, hs, seed, map) {
  const cs = new Array(worldPts.length);
  for (let i = 0; i < worldPts.length; i++) cs[i] = worldPts[i] * KREF;
  const f = KREF / k;     // px → cut-space units
  const cutPts = P.cut(cs, false, { space: "cut", step: Math.max(7, P.minStep()) * f, amp: 1.7 * hs * f, jitter: 0.5 * f, lambda: 50 * f, snip: 7 * f, seed });
  if (!map) return cutPts.map((v) => v / KREF);
  const out = new Array(cutPts.length);
  for (let i = 0; i < cutPts.length; i += 2) { const q = map(cutPts[i] / KREF, cutPts[i + 1] / KREF); out[i] = q[0]; out[i + 1] = q[1]; }
  return out;
}

function lumenPoly(st, D, k, hs, seed, map) {
  const e = stripEdges(st, D);
  const L = cutCourseEdge(e.L, k, hs, seed, map), R = cutCourseEdge(e.R, k, hs, seed + 1, map);
  return L.concat(P.rev2(R));
}

// Bake one chunk. strips: this frame's course strips (world). The chunk is cut, shadowed and lit over a padded world
// range (PAD u beyond each end) so shadows and lit edges run on across its edges; only its core is blitted.
// Returns { cv, lx, ly, w, h (the core in chunk-local CSS px), sx, sy (the core's offset in the canvas, device px),
// k, theta, j, dpx and tier (the step and tier it was baked at) }.
export const CHUNK_PAD = 12;
export function bakeChunk(v, stage, strips, j, scratch, tier) {
  const job = chunkJob(v, stage, strips, j, scratch, tier);
  while (!job.step());
  return job.result;
}

// The same bake as a job in slices, so the renderer can spread a chunk over frames: the floor dots and the sides,
// then one wall sheet per slice (a wall sheet uses the scratch canvases only within its own slice, so jobs may take
// turns). job.step() runs the next slice and returns true once the chunk is done (job.result, as bakeChunk returns).
// Each slice ends by drawing the chunk into a 1 × 1 canvas: canvas 2D records its draws and rasters them at the
// canvas's next use, so without it a chunk baked over frames would still raster all at once, at its first blit.
// v, strips and the camera are those of the frame the job starts on (a complete chunk is the same in any window).
// Source: none fit, our own (MDN, "Optimizing canvas", pre-render offscreen; the slices and the flush are ours).
export function chunkJob(v, stage, strips, j, scratch, tier) {
  const it = chunkSlices(v, stage, strips, j, scratch, tier);
  const job = {
    j, k: v.cam.pxPerU, theta: v.cam.theta, dpx: v.dpx, tier: tier.name, slices: 0, done: false, result: null,
    step() {
      if (job.done) return true;
      const r = it.next();
      job.slices++;
      if (r.done) { job.done = true; job.result = r.value; }
      return job.done;
    },
  };
  return job;
}

// Make the browser raster a bake's draws now, in this frame (drawing it into a 1 × 1 canvas does; renderer.js uses it
// for the stage paper it bakes over frames).
let flushCv = null;
export function rasterNow(v, cv) {
  if (!flushCv) flushCv = v.makeCanvas(1, 1).getContext("2d");
  flushCv.drawImage(cv, 0, 0, 1, 1, 0, 0, 1, 1);
}
const flush = rasterNow;

function* chunkSlices(v, stage, strips, j, scratch, tier) {
  const role = ROLES[stage].course;
  const cam = v.cam, k = cam.pxPerU, hs = v.hs;
  const map = chunkMap(cam, j);
  const box = (ya, yb) => {
    const q = [map(-CHUNK_X, ya), map(CHUNK_X, ya), map(-CHUNK_X, yb), map(CHUNK_X, yb)];
    const x0 = Math.min(...q.map((e) => e[0])), y0 = Math.min(...q.map((e) => e[1]));
    return { x: x0, y: y0, w: Math.max(...q.map((e) => e[0])) - x0, h: Math.max(...q.map((e) => e[1])) - y0 };
  };
  const ya = j * CHUNK_U - CHUNK_PAD, yb = (j + 1) * CHUNK_U + CHUNK_PAD;
  const pad = box(ya, yb), core = box(j * CHUNK_U, (j + 1) * CHUNK_U);
  const lx = pad.x, ly = pad.y, w = pad.w, h = pad.h;
  const dpx = v.dpx;
  const W = Math.max(1, Math.ceil(w * dpx)), H = Math.max(1, Math.ceil(h * dpx));
  const cv = v.makeCanvas(W, H);
  const c = cv.getContext("2d");
  const T = (cc) => cc.setTransform(dpx, 0, 0, dpx, -lx * dpx, -ly * dpx);
  T(c);
  c.__dpx = dpx;
  const flat = tier.bakeShadow === "flat";

  // floor dots (world-anchored, from a hash of their cell)
  const tones = (role.floorDots || []).map((r) => roleHex(stage, r));
  if (tones.length) {
    const cell = 9;
    for (let gx = Math.floor(-CHUNK_X / cell); gx < CHUNK_X / cell; gx++) {
      for (let gy = Math.floor(ya / cell); gy < yb / cell; gy++) {
        const hh = P.hash2(gx, gy, 901);
        if (hh < 0.25) continue;
        const wx = (gx + 0.5 + 0.4 * P.hash2(gx, gy, 902)) * cell, wy = (gy + 0.5 + 0.4 * P.hash2(gx, gy, 903)) * cell;
        const q = map(wx, wy);
        const r = (0.7 + 1.6 * Math.pow(0.5 + 0.5 * P.hash2(gx, gy, 904), 2)) * k * 0.55;
        const pth = P.path(P.circle(q[0], q[1], r, { step: 3, amp: 0.25, jitter: 0.12, seed: 7 }));
        if (!flat) P.shadowCheap(c, pth, 1.2 * hs, { alpha: 0.28, strokes: 1 });
        else P.shadowCheap(c, pth, 1.2 * hs, { alpha: 0.24, strokes: 0 });
        P.paper(c, pth, tones[(gx * 7 + gy * 13) & 1 ? 0 : tones.length - 1], { edge: 0.5 * hs });
      }
    }
  }
  // the warm and cool sides (sheets inside their lumen)
  for (const st of strips) {
    const tok = role.tones[st.tone];
    if (!tok) continue;
    const poly = lumenPoly(st, -1.5, k, hs, st.tone === "warm" ? 41 : 43, map);
    const p = P.path(poly);
    P.sheet(c, p, roleHex(stage, tok), 2.2 * hs, flatOr(flat, { edge: 1, grain: tier.grain, pattern: v.pattern, ga: st.tone === "warm" ? 0.7 : 2.2, shadow: { alpha: 0.34 } }));
  }
  flush(v, cv);
  // the wall sheets, inner to outer, each higher and darker: a layer with every lumen cut out (their union), its
  // soft shadow from offset copies of its silhouette, a paler copy toward the light for the lit edge, then the layer
  for (let i = 0; i < role.walls.length; i++) {
    yield;
    const tok = role.walls[i];
    const [L, S] = scratch(W, H);
    const lc = L.getContext("2d"), sc = S.getContext("2d");
    lc.__dpx = dpx;
    const color = roleHex(stage, tok);
    const D = role.depth[i], hh = role.height[i] * hs;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = "source-over";
    lc.clearRect(0, 0, W, H);
    lc.fillStyle = color;
    lc.fillRect(0, 0, W, H);
    if (tier.grain > 0 && v.pattern) { T(lc); P.grainOver(lc, null, v.pattern, tier.grain * 0.9, 0, 0, i * 0.9 + 1, 1); }
    T(lc);
    lc.globalCompositeOperation = "destination-out";
    lc.fillStyle = "#000";
    // seeds by tone, never by the strip's place in the list (a strip that leaves the window must not recut the rest)
    for (const st of strips) lc.fill(P.path(lumenPoly(st, D, k, hs, 10 + 10 * i + 2 * (TONE_SEED[st.tone] || 0), map)));
    lc.globalCompositeOperation = "source-over";
    lc.setTransform(1, 0, 0, 1, 0, 0);
    // the silhouette in ink
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = "source-over";
    sc.clearRect(0, 0, W, H);
    sc.drawImage(L, 0, 0);
    sc.globalCompositeOperation = "source-in";
    sc.fillStyle = ink;
    sc.fillRect(0, 0, W, H);
    sc.globalCompositeOperation = "source-over";
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    const off = P.shadowOffset(hh), blur = P.blurOf(hh) * dpx;
    const taps = flat ? [[0, 0]] : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    const a = flat ? 0.34 : 0.38;
    c.globalAlpha = flat ? a : 1 - Math.pow(1 - a, 1 / taps.length) * 1.0;
    for (const [tx, ty] of taps) c.drawImage(S, off.x * dpx + tx * blur * 0.5, off.y * dpx + ty * blur * 0.5);
    // the lit edge: the layer shifted toward the light, mixed toward cream
    c.globalAlpha = 1;
    sc.globalCompositeOperation = "source-in";
    sc.fillStyle = P.mix(color, P.CREAM, 0.2);
    sc.fillRect(0, 0, W, H);
    sc.globalCompositeOperation = "source-over";
    c.drawImage(S, -P.LX * 1.1 * hs * dpx * 0.6, -P.LY * 1.1 * hs * dpx);
    c.drawImage(L, 0, 0);
    c.restore();
    flush(v, cv);
  }
  return { cv, lx: core.x, ly: core.y, w: core.w, h: core.h, sx: (core.x - lx) * dpx, sy: (core.y - ly) * dpx, k, theta: cam.theta, j, dpx, tier: tier.name };
}

// ---- the dot atlas: paper dots in 8 sizes per tone, each with its cheap shadow and lit edge baked in
export function bakeAtlas(v, tones, r0, dr, tier) {
  const sizes = 8, hs = v.hs, dpx = v.dpx;
  const rMax = (r0 + dr * (sizes - 1)) * hs;
  const pad = Math.ceil(rMax + P.blurOf(1.5 * hs) + 2.5 * hs);
  const cell = 2 * pad;
  const cv = v.makeCanvas(Math.ceil(cell * sizes * dpx), Math.ceil(cell * tones.length * dpx));
  const c = cv.getContext("2d");
  c.setTransform(dpx, 0, 0, dpx, 0, 0);
  tones.forEach((tone, ti) => {
    for (let si = 0; si < sizes; si++) {
      const x = si * cell + pad, y = ti * cell + pad, r = (r0 + dr * si) * hs;
      const p = P.path(P.circle(x, y, r, { step: 2.5, amp: Math.min(0.35, r * 0.08), jitter: 0.12, seed: 3 + si }));
      if (tier.shadow !== "flat") P.shadowCheap(c, p, 1.5 * hs, { alpha: 0.3, strokes: 1 });
      P.paper(c, p, tone, { edge: 0.5 * hs, edgeMix: 0.3 });
    }
  });
  return { cv, cell, pad, sizes, dpx, tones };
}

// ---- the dapple tiles: cut cream spots on transparency
// The tile is made at device resolution (220 × hs CSS px across) and filled 1:1 (render/renderer.js).
export function bakeDapple(v, color, seed) {
  const f = v.dpx * v.hs, S = Math.max(16, Math.round(220 * f));
  const cv = v.makeCanvas(S, S);
  const c = cv.getContext("2d");
  for (let i = 0; i < 12; i++) {
    const x = (0.5 + 0.5 * P.hash1(i, seed)) * S, y = (0.5 + 0.5 * P.hash1(i, seed + 1)) * S;
    const r = (5 + 12 * Math.pow(0.5 + 0.5 * P.hash1(i, seed + 2), 2)) * f;
    c.fillStyle = color;
    for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
      c.fill(P.path(P.circle(x + ox, y + oy, r, { step: 4, amp: r * 0.12, seed: seed + i, scallops: 3, depth: r * 0.15 })));
    }
  }
  return cv;
}

// ---- small helpers used by items.js and renderer.js
export function glowList(tier) { return glowDiscs(tier); }
export { KREF };
