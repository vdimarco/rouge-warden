// First Breath: stage 1's race strip drawn live as cut paper (core/draw.js strip "race"; openspec change
// first-breath-action-genres, design.md 5.1 and 4.8). The bending tube turns with the camera, so the course cannot use
// the baked course tiles (they are world-y chunks baked at one camera turn); it is cut and painted every frame here:
// the outer wall sheet, then each lumen inward, so overlapping lumens (the fork, the cool loop) simply join. Each wall
// sheet casts its shadow into the hole below it and shows a lit edge; "outside a union of holes" is a stack of
// even-odd clips, one per hole, so no lumen ever cancels another. Edges are cut in world space by bake.js
// cutCourseEdge (world-fixed noise, world-fixed samples from the stage), so an edge stays put as you swim along it.
// Then the warm and cool sheets, the warm lane with its cream chevrons along the racing line, the cool tide with its
// wavy cut front, the knockout gates (pale rose bands with cut cream dashes, solid cream once closed), item boxes
// (bobbing cream paper cubes with a cut swirl), goo (dotted soft discs), white cells (big lilac blobs with dotted
// rims); and on top: sparks (keylined diamonds with a short trail), shields (cream bubble rings), the sperm that rest
// (faint, curled), slipstream streaks, drift confetti (1, 2 or 3 pieces a puff: cream, amber, rose), boost rings and
// speed lines. Nothing here draws text, and nothing flashes the screen.
//
// Sources: the paper sheets, cuts and cheap shadows are the renderer's own (render/paper.js, bake.js; v1 14.1, 14.2).
// Drift sparks that step through three colours and a mini-turbo after Mario Kart (Nintendo: Mario Kart DS and later);
// the slipstream streaks and speed lines after racing games' draft and boost read (Mario Kart 8, F-Zero); the cut-out
// clip stack is our own (MDN, "CanvasRenderingContext2D.clip()": successive clips intersect).
import * as P from "./paper.js";
import { roleHex, SHARED } from "./palette.js";
import { cutCourseEdge, stripEdges } from "./bake.js";

const TAU = Math.PI * 2;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));
const dash = (ctx, d) => { if (typeof ctx.setLineDash === "function") ctx.setLineDash(d); };

const TONE = {
  gate: "#f3c9d6", gateDash: "#fff4e2", tide: "#4e3a5e", tideFoam: "#d8c8e0", box: "#fff4e2", boxSwirl: "#f6ab48",
  goo: "#efe3cf", gooRim: "#c9b48f", cell: "#d8c8e0", cellRim: "#fff4e2", spark: "#ffe0c8", shield: "#fff4e2",
  rest: "#84607a", conf: ["#fff4e2", "#ffb23d", "#ff86b0"], line: "#fff4e2",
};
const hexOf = (F, tok, dflt) => (tok && roleHex(F.stage, tok)) || dflt;

// ---- the lumens: cut polygons in screen px, cached by their world window (the cut is world space, so a cached cut
// only needs mapping again when the camera moves)
const cutCache = new Map();
function cutWorld(part, D, k, hs, seed) {
  const n = part.pts.length;
  const key = `${part.tone}|${D}|${seed}|${n}|${part.pts[0].toFixed(2)},${part.pts[1].toFixed(2)}|${part.pts[n - 2].toFixed(2)},${part.pts[n - 1].toFixed(2)}|${k.toFixed(2)}|${hs}`;
  let e = cutCache.get(key);
  if (!e) {
    const ed = stripEdges(part, D);
    e = { L: cutCourseEdge(ed.L, k, hs, seed, null), R: cutCourseEdge(ed.R, k, hs, seed + 1, null) };
    cutCache.set(key, e);
    if (cutCache.size > 160) cutCache.delete(cutCache.keys().next().value);
  }
  return e;
}
function lumens(F, parts, D, seed0) {
  const out = [];
  for (const q of parts) {
    if (!q || !Array.isArray(q.pts) || q.pts.length < 4) continue;
    const seed = seed0 + (q.tone === "warm" ? 2 : q.tone === "cool" ? 4 : 0);
    const e = cutWorld(q, D, F.k, F.v.hs, seed);
    const pts = [];
    for (let i = 0; i < e.L.length; i += 2) pts.push(F.X(e.L[i], e.L[i + 1]), F.Y(e.L[i], e.L[i + 1]));
    for (let i = e.R.length - 2; i >= 0; i -= 2) pts.push(F.X(e.R[i], e.R[i + 1]), F.Y(e.R[i], e.R[i + 1]));
    out.push(pts);
  }
  return out;
}
function union(polys, dx = 0, dy = 0) {
  const p = new Path2D();
  for (const pts of polys) {
    if (pts.length < 6) continue;
    p.moveTo(pts[0] + dx, pts[1] + dy);
    for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i] + dx, pts[i + 1] + dy);
    p.closePath();
  }
  return p;
}
// Clip to everything outside the union of the polys (moved by dx, dy): one even-odd clip a hole, which intersect.
function clipOutside(ctx, polys, dx, dy, W, H) {
  for (const pts of polys) {
    const p = new Path2D();
    p.rect(-40, -40, W + 80, H + 80);
    if (pts.length >= 6) {
      p.moveTo(pts[0] + dx, pts[1] + dy);
      for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i] + dx, pts[i + 1] + dy);
      p.closePath();
    }
    ctx.clip(p, "evenodd");
  }
}

// One wall's cut into the layer below it: its shadow falls into the hole (down and a little right of the hole's top
// edges), and its lit edge shows at the hole's lower edges.
// Each pass is a clip stack and one fill, so the outer walls (whose shadows fall on the thin wall bands) skip their
// lit edge, and in the low tier only the floor's shadow is cut.
function wallEdge(F, holes, upperHex, h, alpha, lit = true) {
  const ctx = F.ctx, W = F.v.W, H = F.v.H, hs = F.v.hs;
  const inside = union(holes);
  const off = P.shadowOffset(h * hs);
  ctx.save();
  ctx.clip(inside);
  ctx.save();
  clipOutside(ctx, holes, off.x, off.y, W, H);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = P.INK;
  ctx.fill(inside);
  ctx.restore();
  if (lit && F.tier.edge && F.tier.shadow !== "flat") {
    const e = 1.1 * hs;
    ctx.save();
    clipOutside(ctx, holes, -P.LX * e * 0.6, -P.LY * e, W, H);
    ctx.fillStyle = P.mix(upperHex, P.CREAM, 0.28);
    ctx.fill(inside);
    ctx.restore();
  }
  ctx.restore();
  return inside;
}

// ---- the ground: the course, sheets, lane, tide, gates, boxes, goo and white cells
export function drawRaceGround(F, st) {
  if (!st || !Array.isArray(st.parts)) return;
  const ctx = F.ctx, W = F.v.W, H = F.v.H, hs = F.v.hs, k = F.k;
  const role = (F.role && F.role.course) || { walls: ["wall3", "wall2", "wall1"], depth: [0, 5, 10], height: [4.5, 4.5, 9] };
  const walls = role.walls.map((t) => hexOf(F, t, "#36102a"));
  const floor = hexOf(F, "floor", "#86355a");
  const n = walls.length;
  // the outer wall sheet
  ctx.fillStyle = walls[n - 1];
  ctx.fillRect(-40, -40, W + 80, H + 80);
  // each hole inward: the layer below shows through, then the wall's shadow and lit edge
  let floorHoles = null;
  for (let i = n - 1; i >= 0; i--) {
    const holes = lumens(F, st.parts, role.depth[i], 10 + 10 * i);
    const below = i > 0 ? walls[i - 1] : floor;
    ctx.fillStyle = below;
    ctx.fill(union(holes));
    if (i === 0) {
      floorHoles = holes;
      ctx.save();
      ctx.clip(union(holes));
      sheets(F, st);
      lanes(F, st);
      goo(F, st);
      tide(F, st);
      ctx.restore();
    }
    const low = F.tier.shadow === "flat";
    if (i === 0 || !low) wallEdge(F, holes, walls[i], role.height[i], i === 0 ? 0.36 : 0.32, i === 0);
  }
  gates(F, st);
  boxes(F, st);
  cells(F, st);
  return floorHoles;
}

// the warm and cool sheets on the floor
function sheets(F, st) {
  const ctx = F.ctx, hs = F.v.hs;
  const tones = (F.role && F.role.course && F.role.course.tones) || { warm: "warmTube", cool: "coolTube" };
  for (const tone of ["cool", "warm"]) {
    const parts = st.parts.filter((q) => q.tone === tone);
    if (!parts.length) continue;
    const p = union(lumens(F, parts, -1.5, tone === "warm" ? 41 : 43));
    P.shadowCheap(ctx, p, 2.2 * hs, { alpha: 0.3, strokes: F.tier.shadowStrokes ? 1 : 0 });
    P.paper(ctx, p, hexOf(F, tones[tone], tone === "warm" ? "#e8834f" : "#4e3a5e"), { edge: F.tier.edge ? 1 * hs : 0, edgeMix: 0.25 });
  }
}

// the warm lane on the racing line, with cream chevrons sliding forward
function lanes(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  const w = fin(st.laneW) ? st.laneW : 30;
  const laneHex = hexOf(F, "lane", "#f6ab48"), chevHex = hexOf(F, "chevrons", "#fde7c6");
  for (const ln of st.lanes || []) {
    const wp = ln && ln.pts, ps = ln && ln.ps;
    if (!Array.isArray(wp) || wp.length < 4 || !Array.isArray(ps) || ps.length !== wp.length >> 1) continue;
    const m = wp.length >> 1;
    const L = [], R = [];
    for (let i = 0; i < m; i++) {
      const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
      let tx = wp[2 * b] - wp[2 * a], ty = wp[2 * b + 1] - wp[2 * a + 1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const half = (w / 2) * 0.62, x = wp[2 * i], y = wp[2 * i + 1];
      L.push(F.X(x - ty * half, y + tx * half), F.Y(x - ty * half, y + tx * half));
      R.push(F.X(x + ty * half, y - tx * half), F.Y(x + ty * half, y - tx * half));
    }
    const lane = P.path(P.cut(L, false, { step: 9, amp: 0.8 * hs, seed: 43 }).concat(P.rev2(P.cut(R, false, { step: 9, amp: 0.8 * hs, seed: 44 }))));
    P.shadowCheap(ctx, lane, 1.6 * hs, { alpha: 0.26, strokes: 0 });
    ctx.save();
    ctx.globalAlpha *= 0.85;
    P.paper(ctx, lane, laneHex, { edge: F.tier.edge ? 0.8 * hs : 0 });
    ctx.restore();
    // chevrons every 17 u of progress, anchored to the track so they slide forward, never jump
    const gap = 17, ph = clamp01(st.phase);
    const pth = new Path2D();
    const arm = 4.6 * k, span = 3.4 * k, th = 1.5 * k;
    for (let i = 0; i + 1 < m; i++) {
      const ax = wp[2 * i], ay = wp[2 * i + 1], bx = wp[2 * i + 2], by = wp[2 * i + 3];
      const pa = ps[i], pb = ps[i + 1];
      if (!(pb > pa)) continue;
      for (let s = Math.ceil((pa - ph * gap) / gap) * gap + ph * gap; s < pb; s += gap) {
        if (s < pa) continue;
        const f = (s - pa) / (pb - pa), x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
        const cx = F.X(x, y), cy = F.Y(x, y);
        const fx0 = F.X(bx, by) - F.X(ax, ay), fy0 = F.Y(bx, by) - F.Y(ax, ay), fl = Math.hypot(fx0, fy0) || 1;
        const fx = fx0 / fl, fy = fy0 / fl, sx = -fy, sy = fx;
        const V = [];
        const Q = (a, b) => V.push(cx + fx * a + sx * b, cy + fy * a + sy * b);
        Q(1.6 * k, 0); Q(-arm + 1.6 * k, span); Q(-arm + 1.6 * k - th, span); Q(1.6 * k - th, 0); Q(-arm + 1.6 * k - th, -span); Q(-arm + 1.6 * k, -span);
        P.path(V, true, pth);
      }
    }
    P.shadowCheap(ctx, pth, 1.3 * hs, { alpha: 0.28, strokes: 0 });
    ctx.save();
    ctx.lineJoin = "round"; ctx.strokeStyle = SHARED.ink || P.INK; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.8; ctx.stroke(pth);
    ctx.globalAlpha = 1; ctx.fillStyle = chevHex; ctx.fill(pth);
    ctx.restore();
  }
}

// the cool tide: a lilac sheet over the course behind the pack, its front a wavy cut edge with cream foam
function tide(F, st) {
  const td = st.tide;
  if (!td || !Array.isArray(td.segs) || !td.segs.length) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k, t = F.t;
  const polys = [];
  for (const s of td.segs) {
    if (!s || !Array.isArray(s.pts) || s.pts.length < 4) continue;
    const e = stripEdges(s, 0);
    const pts = [];
    for (let i = 0; i < e.L.length; i += 2) pts.push(F.X(e.L[i], e.L[i + 1]), F.Y(e.L[i], e.L[i + 1]));
    for (let i = e.R.length - 2; i >= 0; i -= 2) pts.push(F.X(e.R[i], e.R[i + 1]), F.Y(e.R[i], e.R[i + 1]));
    polys.push(pts);
  }
  // the front: a scalloped tongue across the course, rolling forward a little
  const f = td.front;
  let front = null;
  if (f && fin(f.x) && fin(f.y)) {
    const c = Math.cos(f.ang), s = Math.sin(f.ang), nx = -s, ny = c, half = (f.w || 70) / 2;
    const pts = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const u = -half + (2 * half * i) / N;
      const wave = 2.6 * Math.sin(u * 0.35 + t * (td.flood ? 9 : 2.4)) + 1.4 * Math.sin(u * 0.9 - t * 1.7);
      const x = f.x + nx * u + c * wave, y = f.y + ny * u + s * wave;
      pts.push(F.X(x, y), F.Y(x, y));
    }
    for (let i = N; i >= 0; i--) {
      const u = -half + (2 * half * i) / N;
      const x = f.x + nx * u - c * 10, y = f.y + ny * u - s * 10;
      pts.push(F.X(x, y), F.Y(x, y));
    }
    front = pts;
    polys.push(pts);
  }
  const p = union(polys);
  ctx.save();
  P.shadowCheap(ctx, p, 2.5 * hs, { alpha: 0.28, strokes: 0 });
  ctx.globalAlpha *= 0.82;
  P.paper(ctx, p, TONE.tide, { edge: F.tier.edge ? 1.2 * hs : 0, edgeMix: 0.35 });
  ctx.restore();
  if (front) {
    // foam: dotted cream along the wavy front
    ctx.save();
    ctx.strokeStyle = TONE.tideFoam;
    ctx.globalAlpha = td.flood ? 0.95 : 0.7;
    ctx.lineWidth = (td.flood ? 2.6 : 1.8) * hs;
    ctx.lineCap = "round";
    dash(ctx, [0.5 * hs, 4.5 * hs]);
    ctx.beginPath();
    ctx.moveTo(front[0], front[1]);
    for (let i = 2; i < 50; i += 2) ctx.lineTo(front[i], front[i + 1]);
    ctx.stroke();
    dash(ctx, []);
    ctx.restore();
  }
  void k;
}

// knockout gates: a pale rose band across the passage; cut cream dashes while open (pulsing on its call), solid cream
// with an ink keyline once closed
function gates(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  for (const g of st.gates || []) {
    if (!g || ![g.x1, g.y1, g.x2, g.y2].every(fin)) continue;
    const ax = F.X(g.x1, g.y1), ay = F.Y(g.x1, g.y1), bx = F.X(g.x2, g.y2), by = F.Y(g.x2, g.y2);
    const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
    const shut = clamp01(g.shut), w = (2.6 + 1.6 * shut) * k * 0.5;
    const band = P.path(P.cut([ax + nx * w, ay + ny * w, bx + nx * w, by + ny * w, bx - nx * w, by - ny * w, ax - nx * w, ay - ny * w], true, { step: 6, amp: 0.6 * hs, seed: 51 + g.n }));
    P.shadowCheap(ctx, band, 2 * hs, { alpha: 0.3, strokes: 0 });
    const col = shut > 0 ? P.mix(TONE.gate, TONE.gateDash, shut) : TONE.gate;
    ctx.save();
    ctx.globalAlpha *= shut > 0 ? 1 : 0.75 + 0.25 * clamp01(g.pulse);
    if (shut > 0.5) { ctx.lineJoin = "round"; ctx.strokeStyle = P.INK; ctx.lineWidth = 2 * hs; ctx.stroke(band); }
    P.paper(ctx, band, col, { edge: F.tier.edge ? 0.8 * hs : 0 });
    ctx.restore();
    if (shut < 1) {
      // cut cream dashes along the band, sliding while the gate calls
      ctx.save();
      ctx.globalAlpha *= 1 - shut;
      ctx.strokeStyle = TONE.gateDash;
      ctx.lineWidth = 1.6 * hs;
      ctx.lineCap = "round";
      const seg = 3.2 * k, gap = 2.6 * k, off = (g.call ? F.t * 2.2 * k : 0) % (seg + gap);
      dash(ctx, [seg, gap]);
      ctx.lineDashOffset = -off;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      dash(ctx, []);
      ctx.restore();
    }
  }
}

// item boxes: bobbing cream paper cubes with a cut swirl and an ink keyline; a taken one pops up and fades
function boxes(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  for (const b of st.boxes || []) {
    if (!b || !fin(b.x) || !fin(b.y)) continue;
    const pop = clamp01(b.pop), a = clamp01(b.a);
    if (a <= 0.01 && (pop <= 0 || pop >= 1)) continue;
    const x = F.X(b.x, b.y), y = F.Y(b.x, b.y) - (fin(b.bob) ? b.bob : 0) * 0.7 * k;
    const s = (3.3 + (a < 1 ? 0 : 0) + pop * 2.5) * k * (a > 0 ? 0.6 + 0.4 * a : 1);
    const ang = (fin(b.ang) ? -b.ang : 0) + 0.3;
    const c = Math.cos(ang), sn = Math.sin(ang);
    const sq = [];
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) sq.push(x + (u * c - v * sn) * s, y + (u * sn + v * c) * s);
    const p = P.path(P.cut(sq, true, { step: 5, amp: 0.5 * hs, seed: 61 }));
    ctx.save();
    ctx.globalAlpha *= a > 0 ? a : 1 - pop;
    P.shadowCheap(ctx, p, 3 * hs, { alpha: 0.35, strokes: 0 });
    ctx.lineJoin = "round"; ctx.strokeStyle = P.INK; ctx.lineWidth = 2 * hs; ctx.stroke(p);
    P.paper(ctx, p, TONE.box, { edge: F.tier.edge ? 0.8 * hs : 0 });
    // the cut swirl
    ctx.strokeStyle = TONE.boxSwirl;
    ctx.lineWidth = 1.5 * hs;
    ctx.lineCap = "round";
    ctx.beginPath();
    const turns = 1.6, r0 = s * 0.62;
    for (let i = 0; i <= 18; i++) {
      const u = i / 18, th = ang + F.t * 1.5 + u * turns * TAU, r = r0 * (1 - 0.8 * u);
      const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// goo: soft paper discs with a dotted rim
function goo(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  for (const g of st.goo || []) {
    if (!g || !fin(g.x) || !fin(g.y)) continue;
    const x = F.X(g.x, g.y), y = F.Y(g.x, g.y), r = (g.r || 5) * k;
    const p = P.path(P.circle(x, y, r, { step: 4, seed: 73, scallops: 6, depth: r * 0.12, rot: F.t * 0.4 }));
    ctx.save();
    ctx.globalAlpha *= clamp01(g.a);
    P.shadowCheap(ctx, p, 1.4 * hs, { alpha: 0.25, strokes: 0 });
    ctx.globalAlpha *= 0.9;
    P.paper(ctx, p, TONE.goo, { edge: 0 });
    ctx.strokeStyle = TONE.gooRim; ctx.lineWidth = 1.6 * hs; ctx.lineCap = "round";
    dash(ctx, [0.4 * hs, 3.6 * hs]);
    ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.stroke();
    dash(ctx, []);
    ctx.restore();
  }
}

// white cells: big pale lilac blobs with a dotted rim, slowly wobbling
function cells(F, st) {
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  for (const c of st.cells || []) {
    if (!c || !fin(c.x) || !fin(c.y)) continue;
    const x = F.X(c.x, c.y), y = F.Y(c.x, c.y), r = (c.r || 7) * k;
    const ph = fin(c.ph) ? c.ph : 0;
    const p = P.path(P.circle(x, y, r, { step: Math.max(3, r * 0.2), seed: 74 + (c.i | 0), scallops: 5, depth: r * (0.1 + 0.04 * Math.sin(ph * 2)), rot: ph * 0.5 }));
    P.shadowCheap(ctx, p, 4 * hs, { alpha: 0.32, strokes: F.tier.shadowStrokes ? 1 : 0 });
    P.paper(ctx, p, TONE.cell, { edge: F.tier.edge ? 1 * hs : 0, edgeMix: 0.35 });
    ctx.save();
    ctx.strokeStyle = TONE.cellRim; ctx.lineWidth = 1.8 * hs; ctx.lineCap = "round";
    dash(ctx, [0.5 * hs, 4 * hs]);
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, ph, ph + TAU); ctx.stroke();
    dash(ctx, []);
    // a soft core
    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = P.mix(TONE.cell, "#9a86b0", 0.4);
    ctx.beginPath(); ctx.arc(x + Math.cos(ph) * r * 0.2, y + Math.sin(ph) * r * 0.2, r * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---- on top: sparks, shields, resting sperm, streaks, confetti, rings and speed lines
export function drawRaceTop(F, st) {
  if (!st) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k;
  // the sperm that rest: faint, curled, dim
  for (const r of st.rest || []) {
    if (!r || !fin(r.x) || !fin(r.y)) continue;
    const x = F.X(r.x, r.y), y = F.Y(r.x, r.y), a = F.v.cam.screenAngle(fin(r.ang) ? r.ang : 0);
    ctx.save();
    // you rest in your own marigold (dimmed), so you can still find yourself; the others faint
    ctx.globalAlpha *= r.you ? 0.85 : 0.5 * clamp01(r.a) + 0.15;
    ctx.strokeStyle = r.you ? P.mix(TONE.rest, "#ffc53d", 0.7) : TONE.rest;
    ctx.lineWidth = (r.you ? 2.4 : 1.6) * hs; ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, th = a + Math.PI + u * 2.6, rr = (1 + u * 4.5) * k;
      const px = x + Math.cos(a + Math.PI) * u * 3 * k + Math.cos(th) * rr * 0.6, py = y + Math.sin(a + Math.PI) * u * 3 * k + Math.sin(th) * rr * 0.6;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = r.you ? P.mix(TONE.rest, "#ffc53d", 0.7) : TONE.rest;
    if (r.you) { ctx.strokeStyle = P.INK; ctx.lineWidth = 2 * hs; ctx.beginPath(); ctx.ellipse(x, y, 3 * k, 2.2 * k, a, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(x, y, 3 * k, 2.2 * k, a, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // slipstream: three thin cream streaks behind the sperm you draft
  for (const s of st.streaks || []) {
    if (!s || !s.you || !fin(s.x) || !fin(s.y)) continue;
    const x = F.X(s.x, s.y), y = F.Y(s.x, s.y), a = F.v.cam.screenAngle(s.ang || 0);
    const c = Math.cos(a), sn = Math.sin(a);
    ctx.save();
    ctx.globalAlpha *= 0.55 * clamp01(s.a);
    ctx.strokeStyle = TONE.line; ctx.lineWidth = 1.2 * hs; ctx.lineCap = "round";
    for (const off of [-2.2, 0, 2.2]) {
      const ph = ((F.t * 3 + off) % 1 + 1) % 1;
      const b0 = (8 + 5 * ph) * k, b1 = b0 + (10 - 3 * Math.abs(off)) * k;
      ctx.beginPath();
      ctx.moveTo(x - c * b0 - sn * off * k, y - sn * b0 + c * off * k);
      ctx.lineTo(x - c * b1 - sn * off * k, y - sn * b1 + c * off * k);
      ctx.stroke();
    }
    ctx.restore();
  }
  // sparks: keylined diamonds with a short trail
  for (const s of st.sparks || []) {
    if (!s || !fin(s.x) || !fin(s.y)) continue;
    const x = F.X(s.x, s.y), y = F.Y(s.x, s.y), a = F.v.cam.screenAngle(s.ang || 0);
    const c = Math.cos(a), sn = Math.sin(a), r = 2.2 * k;
    ctx.save();
    ctx.strokeStyle = TONE.spark; ctx.globalAlpha *= 0.5; ctx.lineWidth = 1.6 * hs; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - c * r, y - sn * r); ctx.lineTo(x - c * r * 4, y - sn * r * 4); ctx.stroke();
    ctx.restore();
    const V = [x + c * r * 1.4, y + sn * r * 1.4, x - sn * r * 0.8, y + c * r * 0.8, x - c * r, y - sn * r, x + sn * r * 0.8, y - c * r * 0.8];
    const p = P.path(V);
    P.shadowCheap(ctx, p, 3 * hs, { alpha: 0.3, strokes: 0 });
    ctx.save();
    ctx.lineJoin = "round"; ctx.strokeStyle = P.INK; ctx.lineWidth = 2 * hs; ctx.stroke(p);
    ctx.fillStyle = TONE.spark; ctx.fill(p);
    ctx.restore();
  }
  // shields: cream bubble rings
  for (const s of st.shields || []) {
    if (!s || !fin(s.x) || !fin(s.y)) continue;
    const x = F.X(s.x, s.y), y = F.Y(s.x, s.y), r = (s.r || 6.5) * k;
    ctx.save();
    ctx.globalAlpha *= clamp01(s.a);
    ctx.fillStyle = TONE.shield; ctx.globalAlpha *= 0.16;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = clamp01(s.a) * 0.9;
    ctx.strokeStyle = P.INK; ctx.lineWidth = 3.2 * hs;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = TONE.shield; ctx.lineWidth = 1.8 * hs;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke();
    ctx.restore();
  }
  // your drift: a glow at the tail in the level's colour, and the rivals' drifts as small sparks
  const conf = TONE.conf;
  const glowAt = (x, y, level, r) => {
    ctx.save();
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = conf[Math.max(0, Math.min(2, level - 1))];
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  };
  if (st.drift && fin(st.drift.x)) {
    // the mini-turbo: a glow at your tail in the level's colour, a turning ring of cut dashes round it and sparks
    // flicking out (more of them at each level), so the level reads by count as well as colour
    const lv = Math.max(1, Math.min(3, st.drift.level | 0)), col = conf[lv - 1];
    const a = F.v.cam.screenAngle(st.drift.ang || 0);
    const x = F.X(st.drift.x, st.drift.y) - Math.cos(a) * 10 * k, y = F.Y(st.drift.x, st.drift.y) - Math.sin(a) * 10 * k;
    const r = (2.6 + 1.1 * lv + 0.6 * Math.sin(F.t * 31)) * k;
    glowAt(x, y, lv, r);
    ctx.save();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 3.4 * hs; ctx.lineCap = "round";
    dash(ctx, [2.2 * k, 1.6 * k]); ctx.lineDashOffset = -F.t * 40 * hs;
    ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 1.8 * hs;
    ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TAU); ctx.stroke();
    dash(ctx, []);
    for (let i = 0; i < 2 + 2 * lv; i++) {
      const h = P.hash2(Math.floor(F.t * 24), i, 17), h2 = P.hash2(Math.floor(F.t * 24), i, 18);
      const th = a + Math.PI + (h - 0.5) * 2.6, d = r * (1.4 + 1.6 * Math.abs(h2));
      const px = x + Math.cos(th) * d, py = y + Math.sin(th) * d;
      ctx.fillStyle = P.INK; ctx.fillRect(px - 1.2 * hs - 0.8 * k, py - 1.2 * hs - 0.8 * k, 1.6 * k + 2.4 * hs, 1.6 * k + 2.4 * hs);
      ctx.fillStyle = col; ctx.fillRect(px - 0.8 * k, py - 0.8 * k, 1.6 * k, 1.6 * k);
    }
    ctx.restore();
  }
  for (const q of st.rivalsDrift || []) if (q && fin(q.x)) glowAt(F.X(q.x, q.y), F.Y(q.x, q.y), q.level, 1.8 * k);
  // effects: drift confetti puffs, boost rings, spins, shield pops
  for (const e of st.fx || []) {
    if (!e || !fin(e.x) || !fin(e.y)) continue;
    const x = F.X(e.x, e.y), y = F.Y(e.x, e.y), age = clamp01(e.age);
    if (e.kind === "puff" || e.kind === "level") {
      const nPieces = Math.max(1, Math.min(3, e.n | 0)) * (e.kind === "level" ? 3 : 1);
      const col = conf[Math.max(0, Math.min(2, (e.n | 0) - 1))];
      const a = F.v.cam.screenAngle(e.ang || 0);
      for (let i = 0; i < nPieces; i++) {
        const h = P.hash2(e.seed, i, 5), h2 = P.hash2(e.seed, i, 6);
        const th = a + Math.PI + (h - 0.5) * 2.8, d = (3 + 13 * age * (0.6 + 0.4 * h2)) * k;
        const px = x + Math.cos(th) * d, py = y + Math.sin(th) * d + age * age * 4 * k;
        const s = (1.5 + 0.8 * h2) * k * (1 - age * 0.4), rot = e.seed + i + age * 7;
        ctx.save();
        ctx.globalAlpha *= 1 - age;
        ctx.translate(px, py); ctx.rotate(rot);
        ctx.fillStyle = P.INK; ctx.fillRect(-s * 0.6 - 0.8 * hs, -s * 0.35 - 0.8 * hs, s * 1.2 + 1.6 * hs, s * 0.7 + 1.6 * hs);
        ctx.fillStyle = col; ctx.fillRect(-s * 0.6, -s * 0.35, s * 1.2, s * 0.7);
        ctx.restore();
      }
    } else {
      const lv = Math.max(1, Math.min(3, e.n | 0));
      const big = e.kind === "boost" ? 1 + 0.4 * (lv - 1) : e.kind === "spin" ? 1.2 : 1;
      const r = (3 + 13 * big * Math.sqrt(age)) * k;
      const col = e.kind === "boost" ? conf[lv - 1] : e.kind === "shield" ? TONE.shield : e.kind === "spin" ? TONE.spark : "#fff4e2";
      ctx.save();
      ctx.globalAlpha *= (1 - age) * (e.you ? 1 : 0.65);
      ctx.lineWidth = (e.kind === "boost" ? 3.2 : 2) * hs * (1 - age * 0.5) + 2 * hs;
      if (e.kind === "spin" || e.kind === "slip") dash(ctx, [2.5 * hs, 3 * hs]);
      ctx.strokeStyle = P.INK; ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = (1 - age) * (e.you ? 1 : 0.65);
      ctx.strokeStyle = col; ctx.lineWidth -= 2 * hs;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      dash(ctx, []);
      // a burst of paper flecks for a boost, a hit or a shield popping
      const nb = e.kind === "boost" ? 5 + 3 * lv : 7;
      for (let i = 0; i < nb; i++) {
        const h = P.hash2(e.seed, i, 21), h2 = P.hash2(e.seed, i, 22);
        const th = (i / nb) * TAU + h, d = r * (0.7 + 0.5 * Math.abs(h2));
        const px = x + Math.cos(th) * d, py = y + Math.sin(th) * d + age * age * 3 * k;
        const s = (1.3 + 0.6 * Math.abs(h)) * k * (1 - age * 0.5);
        ctx.save();
        ctx.translate(px, py); ctx.rotate(th + age * 5);
        ctx.fillStyle = P.INK; ctx.fillRect(-s * 0.6 - hs, -s * 0.3 - hs, s * 1.2 + 2 * hs, s * 0.6 + 2 * hs);
        ctx.fillStyle = col; ctx.fillRect(-s * 0.6, -s * 0.3, s * 1.2, s * 0.6);
        ctx.restore();
      }
      ctx.restore();
    }
  }
  // speed lines round you while a boost lasts
  const L = st.lines;
  if (L && fin(L.x) && fin(L.y) && !(F.motion && F.motion.reduced)) {
    const x = F.X(L.x, L.y), y = F.Y(L.x, L.y), a = F.v.cam.screenAngle(L.ang || 0);
    const c = Math.cos(a), sn = Math.sin(a), A = clamp01(L.a);
    ctx.save();
    ctx.strokeStyle = TONE.line; ctx.lineCap = "round";
    for (let i = 0; i < 10; i++) {
      const h = P.hash2(L.seed | 0, i, 9), h2 = P.hash2(L.seed | 0, i, 10);
      const side = (i % 2 ? 1 : -1) * (6 + 14 * Math.abs(h)) * k;
      const along = (h2 * 18 - 4) * k, len = (8 + 14 * A) * k;
      const px = x + c * along - sn * side, py = y + sn * along + c * side;
      ctx.globalAlpha = 0.35 + 0.5 * A;
      ctx.lineWidth = (1.2 + 1.1 * A) * hs;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - c * len, py - sn * len); ctx.stroke();
    }
    ctx.restore();
  }
}
