// First Breath: every draw-list item of design.md 16.5 drawn as paper (the table in 14.1), live or from the bake
// cache. render/renderer.js calls these in the draw order of 14.1; each takes the frame F:
//   F = { ctx, v (view: W, H, dpx, hs, cam, makeCanvas, pattern), X(x, y), Y(x, y) (world u → CSS px), k (px per u),
//         stage, role (palette ROLES row), tier (render/low.js), d (the draw list), t (wall seconds), sway { x, y },
//         stickers (cue stickers drawn this frame: { x, y, r }), stats { splats, points }, cache (render/bake.js) }
// No stage knows the frame is paper; nothing here draws text (labels are DOM tags).
//
// Sources (14.2): Henri Matisse's cut-outs ("The Snail", "Polynesia, the Sky") for flat cut shapes on fields of
// colour; Matisse, "Blue Nude II", for a body told in a few cut pieces (the figure: one union shadow, each piece its
// own sheet); Charley Harper's flat prints for round forms, rows of dots and concentric targets (the egg, the
// corona); Tearaway (Media Molecule) and Rex Crowle's GDC 2013 talk for the twisted paper ribbon (tails, cord) and
// cut card; the tails' travelling sine (our own design); the cilia's metachronal wave after the review PMC11044847;
// the villous tree's pulse by arc length (our own: one swell per beat, exp(−((φ − s/c − 0.08)/0.06)²)); the guard
// arc (a cut cream sheet of two concentric arcs joined by round ends, after Tearaway's cut card); the paper glow (our
// own: stacked translucent cream discs, no gradient, blur or filter); the cue sticker (our own, after the cream
// card under "you" in the reference art); the birth light, the exposure and white sheets (our own, after Jenova
// Chen, "Designing Journey", GDC 2013, for the arc; WCAG 2.3.1 for the steady rise).
import * as P from "./paper.js";
import { SHARED, roleHex } from "./palette.js";
import { glowDiscs } from "./low.js";

const TAU = Math.PI * 2;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));
const num = (v, d) => (fin(v) ? v : d);
const onOf = (on) => (on === true ? 1 : on === false ? 0.35 : clamp01(num(on, 1)));

// ---- shared helpers
export const hexOf = (F, role) => roleHex(F.stage, role);

function shadowLive(F, p, h, o = {}) {
  if (!(h > 0)) return;
  P.shadowCheap(F.ctx, p, h, { alpha: o.alpha == null ? 0.32 : o.alpha, strokes: F.tier.shadowStrokes, rule: o.rule });
}
function sheetLive(F, p, color, h, o = {}) {
  shadowLive(F, p, h, o);
  P.paper(F.ctx, p, color, {
    rule: o.rule, edge: F.tier.edge ? (o.edge == null ? 0.8 * F.v.hs : o.edge) : 0, edgeMix: o.edgeMix, core: o.core,
    coreColor: o.coreColor, coreWidth: o.coreWidth,
    grain: o.big && F.tier.grain ? F.tier.grain * (o.grain == null ? 0.8 : o.grain) : 0, pattern: F.v.pattern,
    gx: o.gx, gy: o.gy, ga: o.ga,
  });
}

// A paper glow: stacked translucent discs (r, 0.72 r, 0.45 r at 0.10, 0.12, 0.16 × on), no shadow.
export function paperGlow(F, x, y, r, on, color = null) {
  if (!(on > 0.01) || !(r > 0.5)) return;
  const ctx = F.ctx, ga = ctx.globalAlpha;
  ctx.fillStyle = color || hexOf(F, F.role.glow || "glow") || SHARED.glow;
  for (const [f, a] of glowDiscs(F.tier)) {
    ctx.globalAlpha = ga * a * on;
    ctx.fill(P.path(P.circle(x, y, r * f, { step: Math.max(5, r * f * 0.25), amp: r * f * 0.025, jitter: 0, seed: 17 })));
  }
  ctx.globalAlpha = ga;
}

// ---- splats
function ruleOf(rules, s) {
  for (const r of rules) {
    if (r.hue && !(s.hue >= r.hue[0] - 1e-9 && s.hue <= r.hue[1] + 1e-9)) continue;
    if (r.k && s.k !== r.k) continue;
    if (r.m && !(s.m >= r.m[0] && s.m <= r.m[1])) continue;
    if (r.v && !(s.v >= r.v[0] && s.v <= r.v[1])) continue;
    if (r.r && !(s.r >= r.r[0] && s.r <= r.r[1])) continue;
    return r;
  }
  return rules[rules.length - 1];
}

// One splat's screen outline (shape-local wobble only: the same for every splat of its token).
function splatPts(F, s, seedBase = 0, rule = null) {
  const k = F.k;
  const r = Math.max(0.6, num(s.r, 1) * k);
  const x = F.X(s.x, s.y), y = F.Y(s.x, s.y);
  if (s.k === "s" && fin(s.x2) && fin(s.y2) && (s.x2 !== s.x || s.y2 !== s.y)) {
    const x2 = F.X(s.x2, s.y2), y2 = F.Y(s.x2, s.y2);
    return { pts: P.capsule(x, y, x2, y2, r, r, { step: Math.max(3, r * 0.35), amp: Math.min(0.9, r * 0.04), seed: seedBase + 5 }), x, y, r };
  }
  const sc = rule && rule.scallops ? rule.scallops : 0;
  return { pts: P.circle(x, y, r, { step: Math.max(2.5, Math.min(6, r * 0.3)), seed: seedBase + 3, scallops: sc, depth: sc ? r * 0.05 : 0 }), x, y, r };
}

// Classify the splats into bodies. Splats paired with a tail item (sperm heads) are skipped here (tails draw them).
export function classifySplats(F, skip) {
  const rules = F.role.splats || [{ token: "glow", h: 4, group: "solo" }];
  const bodies = [];
  let fig = null;
  const sp = F.d.splats || [];
  for (let i = 0; i < sp.length; i++) {
    if (skip && skip.has(i)) continue;
    const s = sp[i];
    if (!s || !fin(s.x) || !fin(s.y)) continue;
    const r = ruleOf(rules, s);
    if (r.group === "figure") {
      if (!fig) { fig = { kind: "figure", pieces: [], h: r.h }; bodies.push(fig); }
      fig.pieces.push({ s, r });
      continue;
    }
    if (r.group === "cells") {
      const last = bodies[bodies.length - 1];
      if (last && last.kind === "cells" && last.rule === r) last.pieces.push({ s, r });
      else bodies.push({ kind: "cells", rule: r, pieces: [{ s, r }], h: r.h });
      continue;
    }
    bodies.push({ kind: r.group === "heart" ? "heart" : "solo", pieces: [{ s, r }], h: r.h, rule: r });
  }
  return bodies;
}

// Draw the bodies (all but the hearts and stickers, which drawSubjects draws on top).
export function drawBodies(F, bodies) {
  const ctx = F.ctx, hs = F.v.hs;
  for (const b of bodies) {
    if (b.kind === "heart" || (b.rule && b.rule.sticker)) continue;
    if (b.kind === "figure") { drawFigure(F, b); continue; }
    const shapes = b.pieces.map(({ s, r }) => ({ ...splatPts(F, s, tokenSeed(r.token), r), s, rule: r }));
    const union = new Path2D();
    for (const q of shapes) P.path(q.pts, true, union);
    const h = num(b.h, 4) * hs;
    const big = shapes.some((q) => q.r * 2 >= F.tier.grainMinPx);
    shadowLive(F, union, h, { alpha: 0.34 });
    if (b.kind === "cells") {
      // each cell its own sheet with a pale cut edge (13.3: the core is the brightest ring at the cell's edge)
      const color = hexOf(F, b.rule.token), core = hexOf(F, b.rule.core);
      for (const q of shapes) {
        const p = P.path(q.pts);
        P.paper(ctx, p, color, { edge: F.tier.edge ? 0.9 * hs : 0, edgeMix: 0.3, core: q.s.k === "s" ? 0 : 0.95,
          coreColor: core, coreWidth: Math.max(1.6, Math.min(3.2, q.r * 0.16)) * hs,
          grain: big && F.tier.grain ? F.tier.grain * 0.6 : 0, pattern: F.v.pattern, ga: 0.4 });
      }
    } else {
      const color = hexOf(F, b.rule.token);
      P.paper(ctx, union, color, { edge: F.tier.edge ? 0.8 * hs : 0, edgeMix: 0.32,
        grain: big && F.tier.grain ? F.tier.grain * 0.7 : 0, pattern: F.v.pattern, ga: tokenSeed(b.rule.token) * 0.3,
        gx: F.X(0, 0), gy: F.Y(0, 0) });
      if (b.rule.nucleus) for (const q of shapes) {
        if (!(q.s.n > 0)) continue;
        const rn = q.r * (0.3 + 0.25 * clamp01(q.s.n));
        const p = P.path(P.circle(q.x, q.y, rn, { step: 2.5, seed: 9 }));
        sheetLive(F, p, hexOf(F, b.rule.nucleus), 1.6 * hs, { alpha: 0.3 });
      }
    }
    F.stats.splats += b.pieces.length;
  }
}

const seedCache = new Map();
function tokenSeed(tok) {
  const key = typeof tok === "string" ? tok : JSON.stringify(tok);
  let v = seedCache.get(key);
  if (v === undefined) { v = 0; for (let i = 0; i < key.length; i++) v = (v * 31 + key.charCodeAt(i)) >>> 0; v %= 997; seedCache.set(key, v); }
  return v;
}

// The figure: a round head, a curled bean of a body and buds or short folded limbs, with one union shadow and each
// piece its own sheet (body, then limbs, then the head on top). No face (14.4).
function drawFigure(F, b) {
  const ctx = F.ctx, hs = F.v.hs;
  let headRule = null, bodyRule = null;
  const items = [];
  let firstCap = true;
  for (const { s, r } of b.pieces) {
    const q = splatPts(F, s, r.piece === "head" ? 31 : 37);
    let tok, z;
    if (r.piece === "head") { tok = r.token; z = 2; headRule = r; }
    else if (s.k === "s" && firstCap) { tok = r.token; z = 0; firstCap = false; bodyRule = r; }
    else { tok = r.limbs || r.token; z = 1; }
    items.push({ q, tok, z });
  }
  const union = new Path2D();
  for (const it of items) P.path(it.q.pts, true, union);
  const h = num(b.h, 4.5) * hs;
  shadowLive(F, union, h, { alpha: 0.36 });
  items.sort((a, c) => a.z - c.z);
  for (const it of items) {
    const p = P.path(it.q.pts);
    P.paper(ctx, p, hexOf(F, it.tok), { edge: F.tier.edge ? 1 * hs : 0, edgeMix: 0.4 });
  }
  // one grain over the whole figure (it moves with the figure)
  const big = items.some((it) => it.q.r * 2 >= F.tier.grainMinPx);
  if (big && F.tier.grain) P.grainOver(ctx, union, F.v.pattern, F.tier.grain * 0.6, items[0].q.x, items[0].q.y, 0, 1);
  F.stats.splats += b.pieces.length;
  void headRule; void bodyRule;
}

// Hearts and sticker splats (the gold nucleus in the egg, the root's growing tip): on top of the bodies.
export function drawSubjects(F, bodies) {
  const ctx = F.ctx, hs = F.v.hs;
  for (const b of bodies) {
    if (!(b.kind === "heart" || (b.rule && b.rule.sticker))) continue;
    for (const { s, r } of b.pieces) {
      const q = splatPts(F, s, 41);
      const p = P.path(q.pts);
      const h = num(r.h, 6) * hs;
      if (r.sticker) {
        const m = Math.max(1.2, 1.4 * hs);
        shadowLive(F, p, h, { alpha: 0.4 });
        P.sticker(ctx, p, m, {});
        F.stickers.push({ x: q.x, y: q.y, r: q.r + m + 4 });
      } else shadowLive(F, p, h * 0.6, { alpha: 0.3 });
      P.paper(ctx, p, hexOf(F, r.token), { edge: F.tier.edge ? 0.6 * hs : 0, edgeMix: 0.45 });
      F.stats.splats++;
    }
  }
}

// ---- points: atlas dots (and the render motes)
export function drawPoints(F, atlas) {
  const pt = F.d.points;
  if (!pt || !(pt.n > 0) || !pt.xy || !atlas) return;
  const ctx = F.ctx, n = Math.min(pt.n, 600, pt.xy.length >> 1);
  const tones = F.role.dots ? F.role.dots.length : 1;
  const dimRow = F.role.dotsDim ? tones : -1;
  const cell = atlas.cell, src = cell * atlas.dpx, ga = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const a = pt.a ? clamp01(pt.a[i]) : 0.8;
    if (a < 0.02) continue;
    const wx = pt.xy[2 * i], wy = pt.xy[2 * i + 1];
    const x = F.X(wx, wy), y = F.Y(wx, wy);
    if (x < -cell || y < -cell || x > F.v.W + cell || y > F.v.H + cell) continue;
    const size = (P.hash1(i, 77) * 0.5 + 0.5) * atlas.sizes | 0;
    let row = ((P.hash1(i, 78) * 0.5 + 0.5) * tones) | 0, alpha = a;
    if (dimRow >= 0 && a < 0.5) { row = dimRow; alpha = Math.min(1, a * 2.2); }
    ctx.globalAlpha = ga * Math.min(1, alpha * 1.15);
    ctx.drawImage(atlas.cv, size * src, row * src, src, src, x - atlas.pad, y - atlas.pad, cell, cell);
  }
  ctx.globalAlpha = ga;
  F.stats.points += n;
}

export function drawMotes(F, atlas, count) {
  if (!atlas || !(count > 0)) return;
  const ctx = F.ctx, W = F.v.W, H = F.v.H, t = F.t, ga = ctx.globalAlpha;
  const row = atlas.tones.length - 1, cell = atlas.cell, src = cell * atlas.dpx;
  // the motes drift with the camera a little (they sit far back) and on their own slow currents
  const ox = F.X(0, 0) * 0.15, oy = F.Y(0, 0) * 0.15;
  for (let i = 0; i < count; i++) {
    const u = 0.5 + 0.5 * P.hash1(i, 501), w = 0.5 + 0.5 * P.hash1(i, 502);
    const x = ((u * (W + 40) + ox + 6 * t * (0.3 + w) + 8 * Math.sin(t * 0.21 + i)) % (W + 40) + (W + 40)) % (W + 40) - 20;
    const y = ((w * (H + 40) + oy - 4 * t * (0.2 + u) + 6 * Math.cos(t * 0.17 + i * 1.7)) % (H + 40) + (H + 40)) % (H + 40) - 20;
    ctx.globalAlpha = ga * (0.35 + 0.45 * w);
    ctx.drawImage(atlas.cv, ((i % 3) | 0) * src, row * src, src, src, x - atlas.pad, y - atlas.pad, cell, cell);
  }
  ctx.globalAlpha = ga;
  F.stats.points += count;
}

// ---- tails (sperm): a teardrop head and a ribbon tail cut from one strip, twisting to show its back
// Local +x is forward; (x, y) is the head's centre (px), ang its screen angle, L the whole length, rh the head radius.
export function spermShape(x, y, ang, L, rh, phase, o = {}) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const N = o.N || 12, twist = o.twist !== false;
  const beat = TAU * phase;
  const neck = -0.8 * rh, tl = Math.max(4, L - 1.8 * rh);
  const up = [], lo = [], tz = [];
  const cx = [], cy = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    cx.push(neck - u * tl);
    cy.push(tl * 0.11 * Math.pow(u, 1.15) * Math.sin(u * 5.2 - beat));
    tz.push(Math.cos(u * 5.5 - beat * 0.5 + 0.6));
  }
  for (let i = 0; i <= N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
    let tx = cx[b] - cx[a], ty = cy[b] - cy[a];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const u = i / N;
    const hw = rh * 0.5 * Math.pow(1 - u, 1.1) + 0.55 * (o.thin || 1);
    const w = hw * (twist ? 0.45 + 0.55 * Math.abs(tz[i]) : 1);
    up.push(cx[i] - ty * w, cy[i] + tx * w);
    lo.push(cx[i] + ty * w, cy[i] - tx * w);
  }
  const pts = [];
  const T = (lx, ly) => pts.push(x + lx * cs - ly * sn, y + lx * sn + ly * cs);
  for (let i = N; i >= 0; i--) T(up[i * 2], up[i * 2 + 1]);
  const a0 = 0.72 * Math.PI, M = 12;
  for (let i = 0; i <= M; i++) {
    const a = -a0 + (i / M) * 2 * a0;
    // a teardrop: a little longer toward the front
    T(Math.cos(a) * rh * (1 + 0.12 * Math.max(0, Math.cos(a))), Math.sin(a) * rh * 0.92);
  }
  for (let i = 0; i <= N; i++) T(lo[i * 2], lo[i * 2 + 1]);
  const backs = [];
  if (twist) {
    let i = 1;
    while (i <= N) {
      if (tz[i] >= 0) { i++; continue; }
      const s0 = i;
      while (i <= N && tz[i] < 0) i++;
      const s1 = Math.min(N, i);
      const q = [];
      const Q = (lx, ly) => q.push(x + lx * cs - ly * sn, y + lx * sn + ly * cs);
      for (let k = s0 - 1; k <= s1; k++) Q(up[k * 2], up[k * 2 + 1]);
      for (let k = s1; k >= s0 - 1; k--) Q(lo[k * 2], lo[k * 2 + 1]);
      backs.push(q);
    }
  }
  return { pts, backs };
}

// Pair tail items with the head splats at the same place (stage 1 draws its heads as splats).
export function pairHeads(d) {
  const used = new Set(), heads = new Map();
  const sp = d.splats || [];
  for (const st of d.strips || []) {
    if (!st || st.kind !== "tails") continue;
    for (const it of st.items || []) {
      for (let i = 0; i < sp.length; i++) {
        if (used.has(i)) continue;
        const s = sp[i];
        if (s && Math.abs(s.x - it.x) < 1e-6 && Math.abs(s.y - it.y) < 1e-6) { used.add(i); heads.set(it, s); break; }
      }
    }
  }
  return { used, heads };
}

const isYouHue = (h) => fin(h) && h > 0.095 && h < 0.13;

export function drawTails(F, st, heads, { subject }) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k, tails = F.role.tails || {};
  const items = (st.items || []).filter((it) => it && fin(it.x) && fin(it.y));
  const mine = items.filter((it) => it.ring === "halo" || it.ring === "dashed" || isYouHue(it.hue));
  const rivals = items.filter((it) => !mine.includes(it));
  if (!subject) {
    if (!rivals.length) return;
    // the pack: every shadow in one fill, then the paper in one fill and the backs in one (order-independent)
    const out = new Path2D(), back = new Path2D();
    for (const it of rivals) {
      const s = heads.get(it);
      const L = Math.max(6, num(it.len, 10) * k);
      const rh = s ? Math.max(1.6, s.r * k) : Math.max(1.6, 0.13 * L);
      const shape = spermShape(F.X(it.x, it.y), F.Y(it.x, it.y), F.v.cam.screenAngle(num(it.ang, 0)), L, rh, num(it.phase, 0), { twist: F.tier.twist });
      P.path(shape.pts, true, out);
      for (const b of shape.backs) P.path(b, true, back);
    }
    shadowLive(F, out, 4 * hs, { alpha: 0.3 });
    const col = hexOf(F, tails.rival || "rival") || "#967088";
    P.paper(ctx, out, col, { edge: F.tier.edge ? 0.6 * hs : 0, edgeMix: 0.3 });
    if (F.tier.twist) { ctx.fillStyle = hexOf(F, tails.rivalBack || "rivalBack") || P.mix(col, "#000000", 0.15); ctx.fill(back); }
    F.stats.splats += rivals.filter((it) => heads.has(it)).length;
    return;
  }
  for (const it of mine) {
    const s = heads.get(it);
    const L = Math.max(8, num(it.len, 10) * k);
    const rh = s ? Math.max(2, s.r * k) : Math.max(2, 0.14 * L);
    const x = F.X(it.x, it.y), y = F.Y(it.x, it.y), ang = F.v.cam.screenAngle(num(it.ang, 0));
    const shape = spermShape(x, y, ang, L, rh * 1.15, num(it.phase, 0), { twist: F.tier.twist, thin: 1.6 });
    const p = P.path(shape.pts);
    const m = 2.6 * hs;
    const h = 7.5 * hs;
    // the sticker: the deepest shadow, the ink keyline, the cream card, then you
    P.shadowCheap(ctx, p, h, { alpha: 0.4, strokes: F.tier.shadowStrokes ? 2 : 0, stroke: true, blur: P.blurOf(h) + m });
    P.sticker(ctx, p, m, {});
    const col = hexOf(F, tails.you || "you") || SHARED.you;
    P.paper(ctx, p, col, { edge: F.tier.edge ? 0.9 * hs : 0, edgeMix: 0.45 });
    if (F.tier.twist && shape.backs.length) { ctx.fillStyle = hexOf(F, tails.youBack || "youBack") || SHARED.youBack; for (const b of shape.backs) ctx.fill(P.path(b)); }
    if (it.ring === "dashed") {
      // cut cream dashes round the head
      const R = rh * 1.12 + m + 3.2 * hs, n = 8, dash = new Path2D();
      const rot = F.t * 0.8;
      for (let i = 0; i < n; i++) {
        const a0 = rot + (i / n) * TAU, a1 = a0 + (TAU / n) * 0.5;
        const q = [];
        for (let j = 0; j <= 3; j++) { const a = a0 + ((a1 - a0) * j) / 3; q.push(x + Math.cos(a) * (R + 1.1 * hs), y + Math.sin(a) * (R + 1.1 * hs)); }
        for (let j = 3; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / 3; q.push(x + Math.cos(a) * (R - 1.1 * hs), y + Math.sin(a) * (R - 1.1 * hs)); }
        P.path(q, true, dash);
      }
      ctx.save();
      ctx.lineJoin = "round";
      ctx.strokeStyle = SHARED.ink; ctx.lineWidth = 2.2; ctx.stroke(dash);
      ctx.fillStyle = hexOf(F, tails.dashes || "margin") || SHARED.margin; ctx.fill(dash);
      ctx.restore();
    }
    F.stickers.push({ x, y, r: rh + m + 8 * hs });
    if (s) F.stats.splats++;
  }
}

// ---- strips
export function drawCilia(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  const a = st.a || [0, 0], b = st.b || [0, 0];
  const count = Math.max(1, Math.min(80, num(st.count, 12) | 0));
  const every = F.tier.ciliaEvery || 1;
  const ax = F.X(a[0], a[1]), ay = F.Y(a[0], a[1]), bx = F.X(b[0], b[1]), by = F.Y(b[0], b[1]);
  const L = Math.hypot(bx - ax, by - ay) || 1, tx = (bx - ax) / L, ty = (by - ay) / L;
  // they point inward: toward the screen point of the world origin side
  const o = { x: F.X(0, a[1]), y: F.Y(0, a[1]) };
  let nx = -ty, ny = tx;
  if ((o.x - ax) * nx + (o.y - ay) * ny < 0) { nx = -nx; ny = -ny; }
  const len = Math.max(5, 4.2 * k), w = Math.max(0.9, 0.5 * k);
  const amp = num(st.amp, 0.4), ph = num(st.phase, 0);
  const p = new Path2D();
  for (let i = 0; i < count; i += every) {
    const u = (i + 0.5) / count;
    const x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
    if (x < -len * 2 || y < -len * 2 || x > F.v.W + len * 2 || y > F.v.H + len * 2) continue;
    const bend = amp * 0.9 * Math.sin(TAU * (ph + u * 3));
    const cx = nx * Math.cos(bend) + tx * Math.sin(bend), cy = ny * Math.cos(bend) + ty * Math.sin(bend);
    const ex = x + cx * len, ey = y + cy * len;
    P.path([x - tx * w, y - ty * w, ex + tx * w * 0.2, ey + ty * w * 0.2, ex - tx * w * 0.2, ey - ty * w * 0.2, x + tx * w, y + ty * w], true, p);
  }
  shadowLive(F, p, 2 * hs, { alpha: 0.28 });
  P.paper(ctx, p, hexOf(F, F.role.cilia || "glow"), { edge: 0 });
}

// The tree: cut ribbons by node width (strokes in four width buckets), its pulse as cream beads by arc length.
const treeMemo = new WeakMap();
function arcLengths(nodes) {
  let m = treeMemo.get(nodes);
  if (m) return m;
  const n = nodes.length >> 2, s = new Float32Array(n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const p = nodes[4 * i + 2];
    if (p >= 0 && p < i) { s[i] = s[p] + Math.hypot(nodes[4 * i] - nodes[4 * p], nodes[4 * i + 1] - nodes[4 * p + 1]); if (s[i] > max) max = s[i]; }
  }
  m = { s, max };
  treeMemo.set(nodes, m);
  return m;
}

export function drawTree(F, st) {
  const nd = st.nodes;
  if (!nd || nd.length < 8) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k, n = nd.length >> 2;
  let wmax = 0;
  for (let i = 0; i < n; i++) if (nd[4 * i + 3] > wmax) wmax = nd[4 * i + 3];
  const B = 4, buckets = Array.from({ length: B }, () => new Path2D()), widths = new Float32Array(B);
  for (let i = 0; i < n; i++) {
    const p = nd[4 * i + 2];
    if (!(p >= 0) || p >= n) continue;
    const w = nd[4 * i + 3];
    const bi = Math.min(B - 1, Math.floor((w / (wmax || 1)) * B * 0.999));
    widths[bi] = Math.max(widths[bi], w);
    buckets[bi].moveTo(F.X(nd[4 * p], nd[4 * p + 1]), F.Y(nd[4 * p], nd[4 * p + 1]));
    buckets[bi].lineTo(F.X(nd[4 * i], nd[4 * i + 1]), F.Y(nd[4 * i], nd[4 * i + 1]));
  }
  const color = hexOf(F, F.role.tree || "glow");
  const lw = (bi) => Math.max(1, Math.min(14 * hs, widths[bi] * k * 0.9));
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // the shadow, then a lit edge toward the light, then the ribbons
  const sh = 2.5 * hs, off = P.shadowOffset(sh);
  ctx.translate(off.x, off.y);
  ctx.strokeStyle = SHARED.ink; ctx.globalAlpha = 0.3;
  for (let bi = 0; bi < B; bi++) if (widths[bi] > 0) { ctx.lineWidth = lw(bi) + (F.tier.shadowStrokes ? 1.2 * hs : 0); ctx.stroke(buckets[bi]); }
  ctx.translate(-off.x - P.LX * 0.5 * hs, -off.y - 0.8 * hs);
  ctx.globalAlpha = 1;
  if (F.tier.edge) {
    ctx.strokeStyle = P.mix(color, P.CREAM, 0.35);
    for (let bi = 0; bi < B; bi++) if (widths[bi] > 0) { ctx.lineWidth = lw(bi); ctx.stroke(buckets[bi]); }
  }
  ctx.translate(P.LX * 0.5 * hs, 0.8 * hs);
  ctx.strokeStyle = color;
  for (let bi = 0; bi < B; bi++) if (widths[bi] > 0) { ctx.lineWidth = lw(bi); ctx.stroke(buckets[bi]); }
  ctx.restore();
  // beads: one swell per beat, riding out from the root by arc length
  const phi = clamp01(num(st.pulse, 0));
  const { s, max } = arcLengths(nd);
  if (max > 0) {
    const beads = new Path2D();
    let any = false;
    for (let i = 1; i < n; i += 1) {
      const u = s[i] / max;
      const e = Math.exp(-(((phi - u * 0.6 - 0.08) / 0.06) ** 2));
      if (e < 0.25) continue;
      const r = Math.max(0.8, Math.min(5 * hs, (0.35 * nd[4 * i + 3] + 0.5) * k * 0.8)) * e;
      P.path(P.circle(F.X(nd[4 * i], nd[4 * i + 1]), F.Y(nd[4 * i], nd[4 * i + 1]), r, { n: 8, amp: 0, jitter: 0 }), true, beads);
      any = true;
    }
    if (any) { shadowLive(F, beads, 1.2 * hs, { alpha: 0.25 }); ctx.fillStyle = hexOf(F, F.role.beads || "glow"); ctx.fill(beads); }
  }
}

// Catmull-Rom through screen points, `per` samples a segment.
function smoothLine(pts, per) {
  const n = pts.length >> 1;
  if (n < 3) return pts.slice();
  const out = [];
  const g = (i) => [pts[2 * Math.max(0, Math.min(n - 1, i))], pts[2 * Math.max(0, Math.min(n - 1, i)) + 1]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    for (let q = 0; q < per; q++) {
      const t = q / per, t2 = t * t, t3 = t2 * t;
      out.push(0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3));
    }
  }
  out.push(pts[2 * (n - 1)], pts[2 * (n - 1) + 1]);
  return out;
}

// The cord: a twisted paper ribbon (its back colour where it turns), its lights plain gold beads on it.
export function drawCord(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  const wp = st.pts || [];
  if (wp.length < 4) return;
  const sp = [];
  for (let i = 0; i + 1 < wp.length; i += 2) sp.push(F.X(wp[i], wp[i + 1]), F.Y(wp[i], wp[i + 1]));
  const c = smoothLine(sp, 4);
  const N = (c.length >> 1) - 1;
  const cl = [0];
  for (let i = 1; i <= N; i++) cl.push(cl[i - 1] + Math.hypot(c[2 * i] - c[2 * i - 2], c[2 * i + 1] - c[2 * i - 1]));
  const cw = Math.max(1.8, Math.min(8 * hs, 1.25 * k));
  const up = [], lo = [], tz = [];
  for (let i = 0; i <= N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
    let tx = c[2 * b] - c[2 * a], ty = c[2 * b + 1] - c[2 * a + 1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const z = Math.cos((cl[i] / (4.2 * cw)) * Math.PI - F.t * 0.6);
    tz.push(z);
    const ww = cw * (F.tier.twist ? 0.42 + 0.58 * Math.abs(z) : 1);
    up.push(c[2 * i] - ty * ww, c[2 * i + 1] + tx * ww);
    lo.push(c[2 * i] + ty * ww, c[2 * i + 1] - tx * ww);
  }
  const ribbon = up.concat(P.rev2(lo));
  const p = P.path(ribbon);
  sheetLive(F, p, hexOf(F, F.role.cord || "glow"), 3 * hs, { alpha: 0.32, edge: 0.6 * hs });
  if (F.tier.twist) {
    const back = new Path2D();
    for (let i = 1; i <= N;) {
      if (tz[i] >= 0) { i++; continue; }
      const s0 = i; while (i <= N && tz[i] < 0) i++;
      const s1 = Math.min(N, i), q = [];
      for (let j = s0 - 1; j <= s1; j++) q.push(up[2 * j], up[2 * j + 1]);
      for (let j = s1; j >= s0 - 1; j--) q.push(lo[2 * j], lo[2 * j + 1]);
      P.path(q, true, back);
    }
    ctx.fillStyle = hexOf(F, F.role.cordBack || F.role.cord || "glow"); ctx.fill(back);
  }
  const lights = Array.isArray(st.lights) ? st.lights : [];
  if (lights.length) {
    const beads = new Path2D(), total = cl[N];
    for (const f of lights) {
      if (!fin(f)) continue;
      const dist = clamp01(f) * total;
      let j = 1; while (j < N && cl[j] < dist) j++;
      const fr = (dist - cl[j - 1]) / Math.max(1e-6, cl[j] - cl[j - 1]);
      const x = c[2 * (j - 1)] + (c[2 * j] - c[2 * (j - 1)]) * fr, y = c[2 * (j - 1) + 1] + (c[2 * j + 1] - c[2 * (j - 1) + 1]) * fr;
      P.path(P.circle(x, y, cw * 1.05, { n: 12, amp: 0.15, jitter: 0.08, seed: 90 }), true, beads);
    }
    shadowLive(F, beads, 2 * hs, { alpha: 0.32 });
    ctx.fillStyle = hexOf(F, F.role.lights || "glow"); ctx.fill(beads);
  }
}

// The lane (a sheet along the chevrons' line, w wide) and the chevrons: cut cream V shapes with the keyline,
// sliding with phase.
export function drawChevrons(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  const wp = st.pts || [];
  if (wp.length < 4) return;
  const n = wp.length >> 1;
  const w = num(st.w, 20);
  // the lane sheet
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = wp[2 * b] - wp[2 * a], ty = wp[2 * b + 1] - wp[2 * a + 1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const x = wp[2 * i], y = wp[2 * i + 1], half = w / 2 * 0.62;
    L.push(F.X(x - ty * half, y + tx * half), F.Y(x - ty * half, y + tx * half));
    R.push(F.X(x + ty * half, y - tx * half), F.Y(x + ty * half, y - tx * half));
  }
  if (F.role.lane) {
    const lane = P.path(P.cut(L, false, { step: 9, amp: 0.8 * hs, seed: 43 }).concat(P.rev2(P.cut(R, false, { step: 9, amp: 0.8 * hs, seed: 44 }))));
    sheetLive(F, lane, hexOf(F, F.role.lane), 1.6 * hs, { alpha: 0.3, edge: 0.8 * hs, big: true, gx: F.X(0, 0), gy: F.Y(0, 0), ga: 1.9 });
  }
  // chevrons every 12 u along the line, sliding forward with phase
  const gap = 17, ph = clamp01(num(st.phase, 0));
  const y0 = wp[1], y1 = wp[2 * (n - 1) + 1];
  const pth = new Path2D();
  const arm = 4.6 * k, span = 3.4 * k, th = 1.5 * k;
  for (let yy = Math.ceil((y0 - ph * gap) / gap) * gap + ph * gap; yy <= y1; yy += gap) {
    // the line's x at yy (the lane runs along world y)
    let i = 0; while (i < n - 2 && wp[2 * (i + 1) + 1] < yy) i++;
    const ya = wp[2 * i + 1], yb = wp[2 * (i + 1) + 1], f = yb > ya ? (yy - ya) / (yb - ya) : 0;
    const xx = wp[2 * i] + (wp[2 * (i + 1)] - wp[2 * i]) * f;
    const cx = F.X(xx, yy), cy = F.Y(xx, yy);
    const fwd = F.v.cam.screenAngle(Math.PI / 2);
    const fx = Math.cos(fwd), fy = Math.sin(fwd), sx = -fy, sy = fx;
    const V = [];
    const Q = (a, b) => V.push(cx + fx * a + sx * b, cy + fy * a + sy * b);
    Q(1.6 * k, 0); Q(-arm + 1.6 * k, span); Q(-arm + 1.6 * k - th, span); Q(1.6 * k - th, 0); Q(-arm + 1.6 * k - th, -span); Q(-arm + 1.6 * k, -span);
    P.path(V, true, pth);
  }
  ctx.save();
  shadowLive(F, pth, 1.3 * hs, { alpha: 0.3 });
  ctx.lineJoin = "round"; ctx.strokeStyle = SHARED.ink; ctx.lineWidth = 2.4; ctx.globalAlpha = 0.85; ctx.stroke(pth);
  ctx.globalAlpha = 1; ctx.fillStyle = hexOf(F, F.role.chevron || "glow"); ctx.fill(pth);
  ctx.restore();
}

// Ripples: cut paper rings (an even-odd annulus) at alpha a; dashed as cut dashes.
export function drawRipples(F, st, { big }) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k, ga = ctx.globalAlpha;
  const bigCol = F.role.rippleBig ? hexOf(F, F.role.rippleBig) : null;
  for (const it of st.items || []) {
    if (!it || !fin(it.x) || !fin(it.y) || !(it.r > 0)) continue;
    const isBig = !!bigCol && it.r >= 40 && !it.dashed && it.a <= 0.3;
    if (isBig !== !!big) continue;
    const a = clamp01(num(it.a, 0.6));
    if (a < 0.01) continue;
    const x = F.X(it.x, it.y), y = F.Y(it.x, it.y), R = it.r * k;
    if (x + R < -20 || y + R < -20 || x - R > F.v.W + 20 || y - R > F.v.H + 20) continue;
    if (isBig) {
      // the egg's target rings: paper rings of the board's ripple tone, with their shadow
      const th = Math.max(4, 3.2 * k);
      const p = new Path2D();
      P.path(P.circle(x, y, R + th / 2, { step: 6, seed: 23 }), true, p);
      P.path(P.circle(x, y, R - th / 2, { step: 6, seed: 24 }), true, p);
      sheetLive(F, p, bigCol, 1.5 * hs, { rule: "evenodd", alpha: 0.3, edge: 0.7 * hs, big: true, gx: x, gy: y });
      continue;
    }
    const th = Math.max(1.3, Math.min(3.2 * hs, 0.06 * R + 1.1 * hs));
    const color = it.dashed && F.role.ghost ? hexOf(F, F.role.ghost) : hexOf(F, F.role.ripple || "glow");
    const p = new Path2D();
    if (it.dashed) {
      const n = Math.max(6, Math.min(28, Math.round((TAU * R) / (9 * hs))));
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = a0 + (TAU / n) * 0.55, q = [];
        for (let j = 0; j <= 3; j++) { const t = a0 + ((a1 - a0) * j) / 3; q.push(x + Math.cos(t) * (R + th / 2), y + Math.sin(t) * (R + th / 2)); }
        for (let j = 3; j >= 0; j--) { const t = a0 + ((a1 - a0) * j) / 3; q.push(x + Math.cos(t) * (R - th / 2), y + Math.sin(t) * (R - th / 2)); }
        P.path(q, true, p);
      }
    } else {
      P.path(P.circle(x, y, R + th / 2, { step: Math.max(4, R * 0.2), amp: 0.3, jitter: 0.1, seed: 25 }), true, p);
      P.path(P.circle(x, y, Math.max(0.3, R - th / 2), { step: Math.max(4, R * 0.2), amp: 0.3, jitter: 0.1, seed: 26 }), true, p);
    }
    const kl = F.stage === "ending" ? "#fff8f0" : SHARED.ink;
    ctx.globalAlpha = ga * a * 0.75;
    ctx.lineJoin = "round"; ctx.strokeStyle = kl; ctx.lineWidth = 2; ctx.stroke(p);
    ctx.globalAlpha = ga * a;
    ctx.fillStyle = color;
    ctx.fill(p, it.dashed ? "nonzero" : "evenodd");
    ctx.globalAlpha = ga;
  }
}

// The arc: a cut cream band of two concentric arcs joined by round ends, with the keyline, the highest sheet and its
// soft live shadow (fill plus 2 strokes); glow adds a paper glow behind it.
export function drawArc(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  if (!fin(st.x) || !fin(st.y) || !(st.r > 0)) return;
  const a0 = num(st.a0, 0), a1 = num(st.a1, 0);
  const sweep = a1 - a0;
  if (!(Math.abs(sweep) > 1e-4)) return;
  const full = Math.abs(sweep) >= TAU - 1e-3;
  const w = Math.max(2.2, num(st.w, 2) * k), R = st.r * k;
  const cx = F.X(st.x, st.y), cy = F.Y(st.x, st.y);
  const s0 = F.v.cam.screenAngle(a0), s1 = s0 - sweep;      // screen angles (y down)
  const n = Math.max(12, Math.min(120, Math.round((Math.abs(sweep) * R) / 4)));
  const ro = R + w / 2, ri = Math.max(0.5, R - w / 2);
  const isSmall = F.role.arcSmall && st.r < 15;
  const color = hexOf(F, isSmall ? F.role.arcSmall : F.role.arc || "glow") || SHARED.glow;
  let p;
  if (full) {
    p = new Path2D();
    P.path(P.circle(cx, cy, ro, { step: 5, seed: 27 }), true, p);
    P.path(P.circle(cx, cy, ri, { step: 5, seed: 28 }), true, p);
  } else {
    const pts = [], dir = s1 > s0 ? 1 : -1;
    // a round end at screen angle a: from the outer edge (β = 0) round the tip to the inner edge (β = π)
    const cap = (a, sgn, from, to) => {
      const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
      const rx = Math.cos(a), ry = Math.sin(a), tx = -Math.sin(a) * sgn, ty = Math.cos(a) * sgn;
      for (let j = 1; j < 8; j++) {
        const b = from + ((to - from) * j) / 8;
        pts.push(ex + (w / 2) * (Math.cos(b) * rx + Math.sin(b) * tx), ey + (w / 2) * (Math.cos(b) * ry + Math.sin(b) * ty));
      }
    };
    for (let i = 0; i <= n; i++) { const a = s0 + ((s1 - s0) * i) / n; pts.push(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro); }
    cap(s1, dir, 0, Math.PI);
    for (let i = n; i >= 0; i--) { const a = s0 + ((s1 - s0) * i) / n; pts.push(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri); }
    cap(s0, -dir, Math.PI, 0);
    p = P.path(P.cut(pts, true, { step: 5, amp: 0.5 * hs, jitter: 0.2, seed: 29 }));
  }
  const glow = clamp01(num(st.glow, 0));
  if (glow > 0.02 && !full) {
    const mid = s0 - sweep / 2;
    paperGlow(F, cx + Math.cos(mid) * R, cy + Math.sin(mid) * R, Math.max(w * 3, Math.abs(sweep) * R * 0.45), glow * 0.9, color);
  }
  const h = (isSmall || full ? 4 : 10) * hs;
  const rule = full ? "evenodd" : "nonzero";
  P.shadowCheap(ctx, p, h, { alpha: 0.38, strokes: F.tier.shadowStrokes ? 2 : 0, stroke: true, rule });
  ctx.save(); ctx.lineJoin = "round"; ctx.strokeStyle = SHARED.ink; ctx.lineWidth = 4; ctx.stroke(p); ctx.restore();
  P.paper(ctx, p, color, { rule, edge: F.tier.edge ? 0.8 * hs : 0, edgeMix: 0.2,
    grain: F.tier.grain ? F.tier.grain * 0.6 : 0, pattern: F.v.pattern, gx: cx, gy: cy });
  if (!full) F.stickers.push({ arc: true, x: cx, y: cy, r: R, w: w + 10 * hs, s0, s1 });
}

// ---- marks
// A crescent band across the course (stage 1 waves; stage 3 squeezes): its middle runs ahead and is thickest.
function bandPts(F, m, thick, bow) {
  const ang = num(m.ang, Math.PI / 2);
  const fx = Math.cos(ang), fy = Math.sin(ang), sx = -fy, sy = fx;
  const r = num(m.r, 10), out = [];
  const N = 24;
  const thk = (l) => thick * (0.25 + 0.75 * Math.max(0, 1 - l * l));
  for (let j = 0; j <= N; j++) { const l = -1 + (2 * j) / N, f = -bow * l * l + thk(l) / 2; out.push(m.x + sx * l * r + fx * f, m.y + sy * l * r + fy * f); }
  for (let j = N; j >= 0; j--) { const l = -1 + (2 * j) / N, f = -bow * l * l - thk(l) / 2; out.push(m.x + sx * l * r + fx * f, m.y + sy * l * r + fy * f); }
  const scr = new Array(out.length);
  for (let i = 0; i < out.length; i += 2) { scr[i] = F.X(out[i], out[i + 1]); scr[i + 1] = F.Y(out[i], out[i + 1]); }
  return scr;
}

export function drawGroundMarks(F) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k, role = F.role, stage = F.stage;
  for (const m of F.d.marks || []) {
    if (!m || !fin(m.x) || !fin(m.y)) continue;
    const x = F.X(m.x, m.y), y = F.Y(m.x, m.y), r = Math.max(0.5, num(m.r, 4) * k);
    const on = onOf(m.on), pulse = clamp01(num(m.pulse, 0));
    switch (m.kind) {
      case "band": {
        if (!role.band) break;
        const w = num(m.w, 10);
        const thick = stage === "swim" ? Math.min(18, w * 0.3) : w * 0.55;
        const pts = P.cut(bandPts(F, m, thick, stage === "swim" ? w * 0.22 : 0), true, { step: 7, amp: 1 * hs, seed: 33 });
        const p = P.path(pts);
        ctx.save(); ctx.globalAlpha *= Math.max(0.15, on);
        sheetLive(F, p, hexOf(F, role.band), 1.8 * hs, { alpha: 0.3, big: true, gx: x, gy: y, ga: 1.1 });
        ctx.restore();
        break;
      }
      case "meet": {
        if (!role.meet) break;
        const pts = P.cut(bandPts(F, { ...m, r: num(m.r, 10) * 1.05 }, num(m.w, 10), 0), true, { step: 7, amp: 1.2 * hs, seed: 34 });
        const p = P.path(pts);
        sheetLive(F, p, hexOf(F, role.meet), 1.8 * hs, { alpha: 0.32, big: true, gx: x, gy: y });
        paperGlow(F, x, y, r * 1.2, 0.35 + 0.4 * pulse);
        break;
      }
      case "warm": case "cool":
        if (stage === "swim") { if (m.kind === "warm") paperGlow(F, x, y, r * 1.1, 0.3 + 0.5 * pulse); }
        else paperGlow(F, x, y, r * 1.4, on * (0.7 + 0.3 * pulse), hexOf(F, role.glow));
        break;
      case "pool": {
        const rr = r * (1 + 0.12 * pulse);
        const tok = m.on === true || (fin(m.on) && m.on > 0.5) ? role.poolOn || role.pool : role.pool;
        const p = P.path(P.circle(x, y, rr, { step: Math.max(3, rr * 0.25), seed: 35, scallops: rr > 12 ? 7 : 0, depth: rr * 0.05 }));
        const col = hexOf(F, tok || "glow");
        if (m.rim === "wavy") {
          // a wavy-cut pale rim under the pool (never drops)
          const rim = P.path(P.circle(x, y, rr + Math.max(1.6, 1.4 * hs), { step: 3, seed: 36, scallops: 9, depth: Math.max(0.8, rr * 0.08) }));
          sheetLive(F, rim, hexOf(F, role.poolRim || "glow"), 1.2 * hs, { alpha: 0.26 });
          sheetLive(F, p, col, 0, { edge: 0.5 * hs, big: rr * 2 >= F.tier.grainMinPx });
        } else {
          if (stage === "root") { P.sticker(ctx, p, 0, { kl: 1.2 }); F.stickers.push({ x, y, r: rr + 4 }); }
          sheetLive(F, p, col, 1.5 * hs, { alpha: 0.3, edge: 0.6 * hs, big: rr * 2 >= F.tier.grainMinPx });
          if (m.rim === "dotted") {
            const n = Math.max(6, Math.min(18, Math.round((TAU * rr) / (6 * hs)))), dots = new Path2D();
            for (let i = 0; i < n; i++) { const a = (i / n) * TAU; P.path(P.circle(x + Math.cos(a) * (rr + 2.4 * hs), y + Math.sin(a) * (rr + 2.4 * hs), Math.max(0.9, 1.1 * hs), { n: 7, amp: 0, jitter: 0 }), true, dots); }
            ctx.fillStyle = hexOf(F, role.poolRim || "glow"); ctx.fill(dots);
          }
        }
        break;
      }
      case "lake": {
        const rr = r * (1 + 0.05 * pulse);
        const p = P.path(P.circle(x, y, rr, { step: 5, seed: 37, scallops: 15, depth: rr * 0.03 }));
        sheetLive(F, p, hexOf(F, role.lake || "glow"), 3 * hs, { alpha: 0.36, big: true, gx: x, gy: y, ga: 0.4 });
        if (role.lake2) {
          const p2 = P.path(P.circle(x + rr * 0.05, y - rr * 0.04, rr * 0.7, { step: 5, seed: 38, scallops: 11, depth: rr * 0.025 }));
          sheetLive(F, p2, hexOf(F, role.lake2), 1.8 * hs, { alpha: 0.3, big: true, gx: x, gy: y, ga: 1.4 });
        }
        break;
      }
      case "spot": {
        if (stage === "root") {
          const p = P.path(P.circle(x, y, r, { step: 4, seed: 39 }));
          sheetLive(F, p, hexOf(F, m.on === true ? role.spotOn || role.spot : role.spot), 1.2 * hs, { alpha: 0.26, big: true, gx: x, gy: y });
          if (m.on === true) paperGlow(F, x, y, r * 1.5, 0.5 + 0.4 * pulse);
        } else if (stage === "answer") {
          const rr = r * (1 + 0.25 * pulse);
          const p = P.path(P.circle(x, y, rr, { step: 3, seed: 40 }));
          if (m.rim === "dotted" || m.on === false) {
            const n = 10, dots = new Path2D();
            for (let i = 0; i < n; i++) { const a = (i / n) * TAU; P.path(P.circle(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(0.9, 1.1 * hs), { n: 7, amp: 0, jitter: 0 }), true, dots); }
            ctx.save(); ctx.globalAlpha *= 0.8; ctx.fillStyle = hexOf(F, role.slot || "glow"); ctx.fill(dots); ctx.restore();
          } else {
            shadowLive(F, p, 3 * hs, { alpha: 0.34 });
            P.sticker(ctx, p, 0, { kl: 2 });
            P.paper(ctx, p, hexOf(F, role.slot || "glow"), { edge: 0.6 * hs, edgeMix: 0.1 });
          }
          F.stickers.push({ x, y, r: rr + 6 });
        } else if (stage === "ending") {
          const p = P.path(P.circle(x, y, Math.max(1.2, r), { n: 10, seed: 41 }));
          ctx.save(); ctx.globalAlpha *= on; sheetLive(F, p, hexOf(F, role.spot || "glow"), 1.5 * hs, { alpha: 0.2 }); ctx.restore();
        } else paperGlow(F, x, y, r * 1.3, on * (0.6 + 0.4 * pulse));
        break;
      }
      case "glowwall":
        if (stage === "turn" && role.snug) {
          // the snug wall: a cut sheet pressed in from the wall, glowing as the room opens
          const ang = F.v.cam.screenAngle(num(m.ang, 0));
          const p = P.path(P.circle(x + Math.cos(ang) * r * 0.5, y + Math.sin(ang) * r * 0.5, r * 1.15, { step: 5, seed: 42, sx: 1, sy: 1 }));
          sheetLive(F, p, hexOf(F, role.snug), 2.4 * hs, { alpha: 0.32, big: true, gx: x, gy: y });
          paperGlow(F, x, y, r * 1.2, on * 0.9);
        } else if (stage === "answer" && role.disc) {
          const p = P.path(P.circle(x, y, r, { step: 4, seed: 43, scallops: 13, depth: r * 0.06 }));
          sheetLive(F, p, hexOf(F, role.disc), 3 * hs, { alpha: 0.34, big: true, gx: x, gy: y });
          paperGlow(F, x, y, r * 1.35, 0.3 + 0.3 * pulse);
        } else paperGlow(F, x, y, r, on * (0.75 + 0.25 * pulse));
        break;
      case "glow":
        paperGlow(F, x, y, r, on * (0.8 + 0.2 * pulse));
        break;
      case "hand":
        // a soft cream oval pressed into the wall, never a hand shape
        paperGlow(F, x, y, r * 1.2, on, hexOf(F, role.hand || role.glow));
        if (on > 0.05) {
          const p = P.path(P.circle(x, y, r * 0.75, { step: 4, seed: 44, sx: 1.25, sy: 0.85 }));
          ctx.save(); ctx.globalAlpha *= clamp01(on) * 0.6; ctx.fillStyle = hexOf(F, role.hand || role.glow); ctx.fill(p); ctx.restore();
        }
        break;
      case "light":
        if (stage !== "birth") paperGlow(F, x, y, Math.max(r, 3 * hs) * 1.8, on * (0.6 + 0.4 * pulse));
        break;
      default: break;
    }
  }
}

// The arrows: a cut arrow sticker pointing along ang (world).
export function drawArrows(F) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k, role = F.role;
  for (const m of F.d.marks || []) {
    if (!m || m.kind !== "arrow" || !fin(m.x) || !fin(m.y)) continue;
    const x = F.X(m.x, m.y), y = F.Y(m.x, m.y), r = Math.max(6 * hs, num(m.r, 5) * k);
    const a = F.v.cam.screenAngle(num(m.ang, 0));
    const fx = Math.cos(a), fy = Math.sin(a), sx = -fy, sy = fx;
    const Q = [];
    const q = (u, v) => Q.push(x + fx * u * r + sx * v * r, y + fy * u * r + sy * v * r);
    q(1, 0); q(0.05, 0.75); q(0.05, 0.32); q(-0.9, 0.32); q(-0.9, -0.32); q(0.05, -0.32); q(0.05, -0.75);
    const p = P.path(P.cut(Q, true, { step: 4, amp: 0.4 * hs, jitter: 0.15, seed: 45 }));
    const spec = role.arrow || { token: "glow", sticker: false };
    const on = onOf(m.on);
    ctx.save();
    ctx.globalAlpha *= 0.55 + 0.45 * on;
    P.shadowCheap(ctx, p, 6 * hs, { alpha: 0.38, strokes: F.tier.shadowStrokes });
    P.sticker(ctx, p, spec.sticker ? 2 * hs : 0, { kl: 2 });
    P.paper(ctx, p, hexOf(F, spec.token), { edge: 0.6 * hs, edgeMix: 0.3 });
    ctx.restore();
    F.stickers.push({ x, y, r: r + 6 });
  }
}

// The birth light: a cream-white paper glow along the whole bottom edge that grows, never anatomy (13.1). Three
// stacked translucent sheets with wavy cut tops, each the full width of the screen.
export function drawBirthLight(F) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k, W = F.v.W, H = F.v.H, ga = ctx.globalAlpha;
  for (const m of F.d.marks || []) {
    if (!m || m.kind !== "light") continue;
    const on = onOf(m.on), pulse = clamp01(num(m.pulse, 0));
    // its reach is a share of the screen's height (r is in u of the 100 u span: 96 u, the end of the waves, reaches
    // 28% of the height in every layout)
    const reach = Math.max(14 * hs, (num(m.r, 40) / 100) * 0.29 * H) * (1 + 0.06 * pulse);
    const white = clamp01(num(F.d.light && F.d.light.white, 0));
    const color = P.mix(hexOf(F, "opening") || SHARED.glow, "#ffffff", clamp01(num(F.d.light && F.d.light.exposure, 1) - 1) / 5);
    // the innermost sheet, along the edge, is opaque cream: the brightest region of the frame touches the whole
    // bottom edge (13.3), over the side flats as much as between them
    const layers = F.tier.glowDiscs >= 3 ? [[1, 0.22], [0.62, 0.3], [0.3, 1]] : [[1, 0.28], [0.3, 1]];
    ctx.fillStyle = color;
    for (const [f, a] of layers) {
      const top = H - reach * f;
      const pts = [-10, H + 10];
      for (let x = -10; x <= W + 10; x += 14) pts.push(x, top + 4 * hs * Math.sin(x * 0.021 + f * 5 + F.t * 0.4) * (1 - white));
      pts.push(W + 10, H + 10);
      ctx.globalAlpha = ga * a * on;
      ctx.fill(P.path(pts));
    }
    ctx.globalAlpha = ga;
    // the light is the cue in the light moment: it carries no bead
    F.stickers.push({ x: F.X(m.x, m.y), y: F.Y(m.x, m.y), r: 12 * hs, light: true });
  }
}

// The cue sticker: wherever the draw list's cue sits and no sticker of this frame covers it, a small cream bead
// on an ink keyline in a paper glow, so the cue is always the brightest thing (13.1, 12).
export function drawCue(F) {
  const c = F.d.cue;
  if (!c || !fin(c.x) || !fin(c.y) || F.stage === "ending") return null;
  const x = F.X(c.x, c.y), y = F.Y(c.x, c.y), hs = F.v.hs;
  const ctx = F.ctx;
  // on a sticker already (a pool, the heart, an arrow, the arc, a slot): only a small white core, a glint on it
  let by = null;
  for (const s of F.stickers) {
    if (s.arc) { if (Math.abs(Math.hypot(x - s.x, y - s.y) - s.r) <= s.w) { by = "arc"; break; } }
    else if (Math.hypot(x - s.x, y - s.y) <= s.r) { by = s.light ? "light" : "sticker"; break; }
  }
  if (by === "light") return { x, y, by };
  if (by) {
    ctx.fillStyle = "#ffffff";
    ctx.fill(P.path(P.circle(x, y, 1.9 * hs, { n: 10, amp: 0.1, jitter: 0.05, seed: 47 })));
    return { x, y, by };
  }
  paperGlow(F, x, y, 15 * hs, 0.9, SHARED.glow);
  const r = 3.6 * hs;
  const p = P.path(P.circle(x, y, r, { n: 14, amp: 0.15, jitter: 0.08, seed: 46 }));
  P.shadowCheap(ctx, p, 4 * hs, { alpha: 0.36, strokes: F.tier.shadowStrokes });
  P.sticker(ctx, p, 1.6 * hs, { kl: 2 });
  ctx.fillStyle = "#ffffff";
  ctx.fill(p);
  return { x, y, by: "bead" };
}
