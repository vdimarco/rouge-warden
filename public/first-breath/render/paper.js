// First Breath: the paper kit (design.md 13.1, 14.1, 14.2). An ES-module port of the reference helpers in
// openspec/changes/archive/2026-10-19-add-first-breath/research/paper-cut/kit.src.js: hand-cut edges, the soft shadow from widening
// clipped strokes, the paper sheet (lit edge, flat colour, pale cut core, grain), the sticker's margin and keyline,
// the grain tile, and bitmap blits. Node imports it for paper.test.mjs: nothing here touches the DOM at load time;
// the grain tile takes a canvas factory, and paths use the global Path2D.
//
// Sources (14.2):
// - The layered paper-cut recipe, one drop shadow per layer plus a grain layer: Abduzeedo, "Learn How to Create Paper
//   Cut Effect with this Photoshop Tutorial"; Red Shark Digital, "How to create layered cut out paper in Adobe
//   Illustrator". Cut, not modelled: Rex Crowle, "Building the Touchy-Feely World of Tearaway" (GDC 2013).
// - The soft shadow from widening clipped strokes: none fit, our own (kit.src.js): the offset silhouette filled once,
//   then stroked with widening lines clipped to its outside, each pass weak enough that the stack sums to the
//   shadow's alpha at the edge. No ctx.filter, no shadowBlur (MDN, "Optimizing canvas").
// - Hand-cut snip edges jittered by world position: none fit, our own (14.1). Each edge point moves along its normal
//   by amp · noise(x / λ, y / λ) + jitter · hash(⌊x / s⌋, ⌊y / s⌋), with (x, y) the point's position in "cut space":
//   world units times a fixed scale for still sheets (course tiles), shape-local coordinates for moving items. A cut
//   never takes a list index, so a sliding course window and items that change order keep their edges.
// - Grain that moves and turns with its sheet: MDN, CanvasPattern.setTransform(). The grain tile itself: none fit,
//   our own (a tiling value-noise tile of mottle, streaks, specks and fibres, after kit.src.js).
// - Still sheets pre-rendered offscreen and blitted at whole device pixels: MDN, "Optimizing canvas"; below scale
//   step 1 the blits take sub-pixel offsets on purpose (14.1).

export const TAU = Math.PI * 2;
export const LX = 0.42, LY = 1;          // a shadow falls (0.42 h, h) px from its sheet: down and a little right
export const CREAM = "#fff6ea";          // the lit edge mixes toward this
export const INK = "#1a0610";

// ---- hashes and noise (no Math.random: the same shape every frame)
export function hash2(ix, iy, seed = 0) {
  let h = Math.imul((ix | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((iy | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((seed | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
export const hash1 = (i, seed = 0) => hash2(i, 0x51ed27, seed);

// Value noise on the integer lattice with a smoothstep fade, in [−1, 1].
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}

// ---- colour
const rgbCache = new Map();
export function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) { v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); rgbCache.set(hex, v); }
  return v;
}
const mixCache = new Map();
export function mix(a, b, t) {
  const key = a + b + t;
  let v = mixCache.get(key);
  if (!v) {
    const x = rgb(a), y = rgb(b);
    v = "#" + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, "0")).join("");
    if (mixCache.size > 4000) mixCache.clear();
    mixCache.set(key, v);
  }
  return v;
}
const lin = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
export function luminance(hex) { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }

// ---- detail: outlines never take more than one vertex per ~2.5 device pixels (the raster cost follows the vertex
// count; on desktop below step 1 a CSS px is a quarter of a device px)
let MIN_STEP = 0;
export function setDetail(dpx) { MIN_STEP = dpx > 0 ? 2.5 / dpx : 0; }
export const minStep = () => MIN_STEP;

// ---- cuts
// Hand cut: resample a polyline every `step` px (per segment, so shared vertices give shared points) and push each
// point along its segment's normal. o: { step = 7, amp = 1.4, jitter = 0.45, lambda = 60, seed = 0,
// at(x, y) → [cx, cy] (the point's cut-space position; default: the point itself) }.
export function cut(pts, closed = true, o = {}) {
  const step = o.space === "cut" ? o.step || 7 : Math.max(o.step || 7, MIN_STEP), amp = o.amp == null ? 1.4 : o.amp, jit = o.jitter == null ? 0.45 : o.jitter;
  const lam = o.lambda || 60, seed = o.seed || 0, at = o.at || null, s = o.snip || step;
  const n = pts.length >> 1;
  if (n < 2) return pts.slice();
  const segs = closed === false ? n - 1 : n;
  const out = [];
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-6) continue;
    const nx = -(by - ay) / L, ny = (bx - ax) / L;
    const m = Math.max(1, Math.round(L / step));
    for (let q = 0; q < m; q++) {
      const f = q / m;
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
      const c = at ? at(x, y) : null;
      const cx = c ? c[0] : x, cy = c ? c[1] : y;
      const d = amp * noise2(cx / lam, cy / lam, seed) + jit * hash2(Math.floor(cx / s), Math.floor(cy / s), seed + 7);
      out.push(x + nx * d, y + ny * d);
    }
  }
  if (closed === false) out.push(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]);
  return out;
}

// A cut disc as points: its wobble comes from the angle round it only (shape-local), the same for every item of a
// kind (`seed`), so discs that change order or move keep their shape. o: { amp, jitter, step, seed, scallops,
// depth, rot, sx, sy (stretch), n }.
export function circle(x, y, r, o = {}) {
  if (!(r > 0) || !Number.isFinite(r)) r = 0.5;
  const step = Math.max(o.step || 5, MIN_STEP);
  const n = o.n ? (o.fixed ? o.n : Math.max(8, Math.min(o.n, Math.round((TAU * r * Math.max(o.sx || 1, o.sy || 1)) / MIN_STEP) || o.n))) : Math.max(8, Math.min(96, Math.round((TAU * r) / step)));
  const amp = o.amp == null ? Math.min(1.2, r * 0.035) : o.amp, jit = o.jitter == null ? Math.min(0.35, r * 0.03) : o.jitter;
  const seed = o.seed || 0, sc = o.scallops || 0, dep = o.depth || 0, rot = o.rot || 0;
  const sx = o.sx || 1, sy = o.sy || 1;
  const out = new Array(n * 2);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    let rr = r + amp * noise2(1.3 * Math.cos(th) + 5, 1.3 * Math.sin(th) + 5, seed) + jit * hash2(Math.round(th * 9.55), 3, seed);
    if (sc) rr += dep * (Math.pow(Math.abs(Math.sin((th * sc) / 2)), 0.55) - 0.6);
    const a = th + rot;
    out[i * 2] = x + Math.cos(a) * rr * sx;
    out[i * 2 + 1] = y + Math.sin(a) * rr * sy;
  }
  return out;
}

// A capsule (two end circles joined by tangents) as points, with a wobble along its own outline (shape-local).
export function capsule(ax, ay, bx, by, ra, rb = ra, o = {}) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  if (L < 1e-6) return circle(ax, ay, Math.max(ra, rb), o);
  const a = Math.atan2(dy, dx);
  const s = Math.asin(Math.max(-1, Math.min(1, (ra - rb) / L)));
  const step = Math.max(o.step || 5, MIN_STEP), amp = o.amp == null ? Math.min(1, Math.max(ra, rb) * 0.03) : o.amp, seed = o.seed || 0;
  const out = [];
  const nA = Math.max(4, Math.round((Math.PI * ra) / step)), nB = Math.max(4, Math.round((Math.PI * rb) / step));
  let k = 0;
  const push = (cx, cy, rr, t) => {
    const w = amp * noise2(0.9 * Math.cos(t + k * 0.01) + 9, 0.9 * Math.sin(t) + 9, seed);
    out.push(cx + Math.cos(t) * (rr + w), cy + Math.sin(t) * (rr + w));
    k++;
  };
  for (let i = 0; i <= nB; i++) push(bx, by, rb, a - Math.PI / 2 - s + (i / nB) * (Math.PI + 2 * s));
  for (let i = 0; i <= nA; i++) push(ax, ay, ra, a + Math.PI / 2 - s + (i / nA) * (Math.PI - 2 * s));
  return out;
}

// A flat point list reversed pairwise (the other way round the same points).
export function rev2(a) {
  const n = a.length, o = new Array(n);
  for (let i = 0; i < n; i += 2) { o[n - 2 - i] = a[i]; o[n - 1 - i] = a[i + 1]; }
  return o;
}

// A path through a flat point array (straight segments: scissor snips).
export function path(pts, closed = true, into = null) {
  const p = into || new Path2D();
  if (pts.length < 4) return p;
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  if (closed !== false) p.closePath();
  return p;
}

// ---- shadows (screen space: the light is above and a little left in every layout)
export const shadowOffset = (h) => ({ x: LX * h, y: LY * h });
export const blurOf = (h) => 0.8 + 0.85 * h;

// The soft shadow of a sheet h px above the one below it (for bakes and the highest live sheets).
// o: { alpha = 0.34, blur, rule, color, n (max passes, 8), strokes (a cap on the passes) }
export function shadow(ctx, p, h, o = {}) {
  const rule = o.rule || "nonzero", alpha = o.alpha == null ? 0.34 : o.alpha;
  const off = shadowOffset(h), blur = o.blur == null ? blurOf(h) : o.blur;
  const n = Math.max(1, Math.min(o.strokes == null ? 8 : o.strokes, Math.round(blur / 2.2)));
  const ga = ctx.globalAlpha;
  ctx.save();
  ctx.translate(off.x, off.y);
  ctx.fillStyle = ctx.strokeStyle = o.color || INK;
  ctx.globalAlpha = ga * alpha;
  ctx.fill(p, rule);
  if (blur > 0.6 && n > 0) {
    const clip = new Path2D();
    clip.rect(-1e4, -1e4, 3e4, 3e4);
    clip.addPath(p);
    ctx.clip(clip, "evenodd");
    ctx.lineJoin = "round";
    const stepA = 1 - Math.pow(1 - alpha, 1 / n);
    ctx.globalAlpha = ga * stepA;
    for (let i = 1; i <= n; i++) { ctx.lineWidth = 2 * blur * Math.pow(i / n, 1.35); ctx.stroke(p); }
  }
  ctx.restore();
}

// The cheap shadow of a moving sheet: one offset silhouette fill at the shadow's offset; with `strokes` > 0 a second,
// weaker fill a little further out softens its far edge (two fills rasterize far faster than a wide stroke in
// software). o.stroke: true keeps the widening strokes instead (the highest live sheets: the arc, your sperm).
export function shadowCheap(ctx, p, h, o = {}) {
  const alpha = o.alpha == null ? 0.32 : o.alpha, strokes = o.strokes == null ? 1 : o.strokes;
  const off = shadowOffset(h), blur = o.blur == null ? blurOf(h) : o.blur;
  const ga = ctx.globalAlpha, rule = o.rule || "nonzero";
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = o.color || INK;
  if (strokes > 0 && !o.stroke) {
    ctx.translate(off.x, off.y);
    ctx.globalAlpha = ga * alpha * 0.72;
    ctx.fill(p, rule);
    ctx.translate(blur * 0.22, blur * 0.3);
    ctx.globalAlpha = ga * alpha * 0.45;
    ctx.fill(p, rule);
    ctx.restore();
    return;
  }
  ctx.translate(off.x, off.y);
  ctx.globalAlpha = ga * alpha;
  ctx.fill(p, rule);
  if (strokes > 0 && blur > 0.6) {
    ctx.lineJoin = "round";
    for (let i = 1; i <= strokes; i++) {
      ctx.globalAlpha = ga * alpha * (0.5 / i);
      ctx.lineWidth = (blur * i) / strokes;
      ctx.stroke(p);
    }
  }
  ctx.restore();
}

// ---- sheets
// A sheet of paper: a lit cut edge toward the light, the flat colour, a pale core along the cut edge, then the grain.
// o: { rule, edge (px, 0 for none), edgeMix, edgeColor, core (alpha), coreColor, coreWidth, grain (alpha),
//      pattern (a CanvasPattern), gx, gy, ga (grain angle), gs (grain scale) }
export function paper(ctx, p, color, o = {}) {
  const rule = o.rule || "nonzero";
  const ga = ctx.globalAlpha;
  const e = o.edge == null ? 0.9 : o.edge;
  if (e > 0) {
    ctx.save();
    ctx.translate(-LX * e * 0.6, -LY * e);
    ctx.fillStyle = o.edgeColor || mix(color, CREAM, o.edgeMix == null ? 0.32 : o.edgeMix);
    ctx.fill(p, rule);
    ctx.restore();
  }
  ctx.fillStyle = color;
  ctx.fill(p, rule);
  if (o.core) {
    ctx.save();
    ctx.clip(p, rule);
    ctx.strokeStyle = o.coreColor || CREAM;
    ctx.globalAlpha = ga * o.core;
    ctx.lineWidth = o.coreWidth || 2;
    ctx.lineJoin = "round";
    ctx.stroke(p);
    ctx.restore();
  }
  if (o.grain > 0 && o.pattern) {
    grainOver(ctx, p, o.pattern, o.grain, o.gx || 0, o.gy || 0, o.ga || 0, o.gs || 1, rule);
  }
}

// Fill a path with the grain pattern, turned and moved with its sheet.
// The tile maps 1:1 to device pixels (ctx.__dpx is the context's device px per CSS px), so a pattern fill never
// resamples the tile.
// The grain turns with its sheet by quarter turns only and moves by whole device pixels: a pattern fill then copies
// its tile without resampling (the raster cost of a resampled pattern is several times higher in software).
export function grainOver(ctx, p, pattern, alpha, gx = 0, gy = 0, ang = 0, s = 1, rule = "nonzero") {
  if (!pattern || !(alpha > 0)) return;
  const dpx = ctx.__dpx || 1;
  s /= dpx;
  if (pattern.setTransform && typeof DOMMatrix !== "undefined") {
    const q = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4;
    const c = [1, 0, -1, 0][q] * s, sn = [0, 1, 0, -1][q] * s;
    const tx = Math.round((((gx % 256) + 256) % 256) * dpx) / dpx, ty = Math.round((((gy % 256) + 256) % 256) * dpx) / dpx;
    pattern.setTransform(new DOMMatrix([c, sn, -sn, c, tx, ty]));
  }
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * alpha;
  ctx.fillStyle = pattern;
  if (p) ctx.fill(p, rule); else ctx.fillRect(-1e4, -1e4, 3e4, 3e4);
  ctx.globalAlpha = ga;
}

// Shadow then sheet.
export function sheet(ctx, p, color, h, o = {}) {
  if (h > 0) {
    if (o.cheap) shadowCheap(ctx, p, h, { rule: o.rule, ...(o.shadow || {}) });
    else shadow(ctx, p, h, { rule: o.rule, ...(o.shadow || {}) });
  }
  paper(ctx, p, color, o);
}

// A sticker's backing: the ink keyline (kl px outside the margin), then the cream margin m px round the shape.
export function sticker(ctx, p, m, o = {}) {
  ctx.save();
  ctx.lineJoin = "round";
  if (o.keyline !== false) {
    ctx.strokeStyle = o.keylineColor || INK;
    ctx.lineWidth = 2 * (m + (o.kl == null ? 2 : o.kl));
    ctx.stroke(p);
  }
  if (m > 0) {
    ctx.lineWidth = 2 * m;
    ctx.strokeStyle = ctx.fillStyle = o.margin || "#fff0cf";
    ctx.stroke(p);
    ctx.fill(p);
  }
  ctx.restore();
}

// ---- the grain tile: transparent, with light and dark specks of low alpha, so it works on any paper colour.
function tileNoise(nx, ny, seed) {
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % nx) + nx) % nx, y0 = ((yi % ny) + ny) % ny, x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny;
    const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}
// A small seeded stream for the tile (not Math.random).
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function grainTile(makeCanvas, S = 256) {
  const cv = makeCanvas(S, S);
  const g = cv.getContext("2d");
  const img = g.createImageData(S, S), D = img.data;
  const m1 = tileNoise(6, 6, 11), m2 = tileNoise(14, 14, 12), st = tileNoise(3, 56, 13), st2 = tileNoise(5, 90, 15), r = rng(14);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const x = i / S, y = j / S;
      const mott = 0.62 * m1(x * 6, y * 6) + 0.38 * m2(x * 14, y * 14);
      const streak = 0.6 * st(x * 3, y * 56) + 0.4 * st2(x * 5, y * 90);
      let v = 0.42 * mott + 0.34 * streak + (r() - 0.5) * 0.5;
      const sp = r();
      if (sp < 0.012) v += 0.9; else if (sp < 0.02) v -= 0.9;
      const o = (j * S + i) * 4;
      if (v > 0) { D[o] = 255; D[o + 1] = 246; D[o + 2] = 232; D[o + 3] = Math.min(255, v * 0.15 * 255); }
      else { D[o] = 40; D[o + 1] = 8; D[o + 2] = 22; D[o + 3] = Math.min(255, -v * 0.17 * 255); }
    }
  }
  g.putImageData(img, 0, 0);
  // fibres: short soft curls, drawn nine times so they wrap across the tile's edges
  const fr = rng(21);
  g.lineCap = "round";
  for (let n = 0; n < 90; n++) {
    const x0 = fr() * S, y0 = fr() * S, a = fr() * TAU, len = 5 + fr() * 16, bend = (fr() - 0.5) * 1.6;
    const light = fr() < 0.7;
    g.strokeStyle = light ? `rgba(255,246,232,${(0.1 + fr() * 0.12).toFixed(3)})` : `rgba(40,8,22,${(0.07 + fr() * 0.08).toFixed(3)})`;
    g.lineWidth = 0.5 + fr() * 0.6;
    for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
      g.beginPath();
      g.moveTo(x0 + ox, y0 + oy);
      g.quadraticCurveTo(x0 + ox + Math.cos(a + bend) * len * 0.5, y0 + oy + Math.sin(a + bend) * len * 0.5, x0 + ox + Math.cos(a) * len, y0 + oy + Math.sin(a) * len);
      g.stroke();
    }
  }
  return cv;
}

// ---- bakes and blits
// A bake: an offscreen canvas at device scale `dpr` covering (x, y, w, h) CSS px, plus a margin m.
export function bakeCanvas(makeCanvas, x, y, w, h, m, dpr, draw) {
  const W = Math.max(1, Math.ceil((w + 2 * m) * dpr)), H = Math.max(1, Math.ceil((h + 2 * m) * dpr));
  const cv = makeCanvas(W, H);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, (m - x) * dpr, (m - y) * dpr);
  c.__dpx = dpr;
  draw(c);
  return { cv, x: x - m, y: y - m, w: W / dpr, h: H / dpr, dpr };
}

// Draw a bake at its place moved by (ox, oy) CSS px and scaled by s about (px, py). At whole device pixels when the
// device pixel is a CSS pixel or larger (step 1); sub-pixel below it, so the slow sway moves smoothly (14.1).
export function blit(ctx, b, ox = 0, oy = 0, s = 1, px = 0, py = 0) {
  const k = ctx.__dpx || 1;
  let x = px + (b.x + ox - px) * s, y = py + (b.y + oy - py) * s;
  const w = b.w * s, h = b.h * s;
  if (s === 1 && k >= 0.999) { x = Math.round(x * k) / k; y = Math.round(y * k) / k; }
  ctx.drawImage(b.cv, x, y, w, h);
}
