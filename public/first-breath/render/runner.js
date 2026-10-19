// First Breath: stage 8's channel in cut paper (core/draw.js strip "runner"; openspec change first-breath-action-genres,
// design.md 5.8 and 4.8). Straight plum side walls with hand-cut inner edges (cut in world space, so an edge stays put
// as it slides past), darker toward the screen's edges, pressing in a little on each surge (not with reduced motion);
// a slightly lighter channel floor with faint cut cream dashes between the lanes and, in a surge, thin cream speed
// streaks that stretch with the speed. The folds are plum paper flaps cut from one side wall each (a long tongue with
// a round tip, an ink keyline and a cheap shadow), so no closed ring of sheet edges ever forms; a flap you bump bends
// back toward its wall. The gates are pale rose: flaps and posts with cut cream dashes across their openings, and
// the turn gates a dashed cream hoop across their lane (solid once you pass it, dotted if missed). Each tight gap has
// a dotted cream ring where you tuck through. Calm bubbles are cream paper discs with a glint. No text, no flashes.
//
// Sources: three lanes and obstacles that close some of them after Subway Surfers (Kiloo and SYBO, 2012); the seeded
// always-passable obstacles and speed that ramps after Adam Saltsman, "Tuning Canabalt" (Gamasutra, 2010); speed lines
// that stretch with the speed after racing games' boost read (F-Zero, Mario Kart 8); the paper sheets, cuts, stickers
// and cheap shadows are the renderer's own (render/paper.js; v1 14.1, 14.2).
import * as P from "./paper.js";
import { roleHex, SHARED } from "./palette.js";
import { paperGlow } from "./items.js";

const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));
const num = (v, d) => (fin(v) ? v : d);
const lerp = (a, b, p) => a + (b - a) * p;

const GATE = "#f3c9d6", GATE_DASH = "#fff4e2";

function tones(F) {
  const h = (t, d) => roleHex(F.stage, t) || d;
  const back = h("back", "#6a2a4a"), you = h("you", "#e8a0b8"), f3 = h("flat3", "#521a38"), f2 = h("flat2", "#3e1028");
  return {
    floor: P.mix(back, you, 0.1),
    wall: f3,
    rib: P.mix(f2, h("flat1", "#2a0818"), 0.3),
    fold: P.mix(f3, you, 0.55),
    cream: h("opening", "#fff4e2"),
  };
}

// The world y range on screen (with a margin), from the camera.
function yRange(F, pad = 20) {
  const cam = F.v.cam, W = F.v.W, Hh = F.v.H;
  let y0 = Infinity, y1 = -Infinity;
  for (const [px, py] of [[0, 0], [W, 0], [0, Hh], [W, Hh]]) { const w = cam.toWorld(px, py); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y); }
  return [y0 - pad, y1 + pad];
}
function xRange(F) {
  const cam = F.v.cam;
  const a = cam.toWorld(0, 0).x, b = cam.toWorld(F.v.W, 0).x;
  return [Math.min(a, b) - 30, Math.max(a, b) + 30];
}

// The walls' inner edge at world y: straight, with a small cut wobble fixed to the world.
const edgeAt = (y, side, wall) => side * (wall + 0.9 * P.noise2(y / 13, side * 3.1, 81) + 0.35 * P.hash2(Math.floor(y / 4), side, 83));

// Under the bodies: the floor, the lane dashes, the speed streaks and the side walls.
export function drawRunnerGround(F, st) {
  if (!st || !fin(st.wallX)) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k, ga = ctx.globalAlpha;
  const T = tones(F);
  const press = F.rmBirth ? 0 : clamp01(st.press) * num(st.wallPress, 2.5);
  const wall = st.wallX - press;
  const [y0, y1] = yRange(F);
  const [xa, xb] = xRange(F);
  const X = F.X, Y = F.Y;
  const speed = clamp01(st.speed);

  // 1. the channel floor: a softly lighter sheet between the walls
  {
    const p = new Path2D();
    p.moveTo(X(-wall - 3, y1), Y(-wall - 3, y1)); p.lineTo(X(wall + 3, y1), Y(wall + 3, y1));
    p.lineTo(X(wall + 3, y0), Y(wall + 3, y0)); p.lineTo(X(-wall - 3, y0), Y(-wall - 3, y0)); p.closePath();
    ctx.globalAlpha = ga * 0.8;
    ctx.fillStyle = T.floor;
    ctx.fill(p);
    ctx.globalAlpha = ga;
  }

  // 2. cut cream dashes between the lanes (world-fixed, so they slide past at your speed)
  const lanes = Array.isArray(st.lanes) ? st.lanes : [-18, 0, 18];
  {
    const dash = new Path2D(), gap = 14, len = 5 + 3 * speed, w = 0.55;
    for (let j = 0; j < 2; j++) {
      const x = (lanes[j] + lanes[j + 1]) / 2;
      for (let y = Math.floor(y0 / gap) * gap; y <= y1; y += gap) {
        P.path([X(x - w, y), Y(x - w, y), X(x + w, y), Y(x + w, y), X(x + w * 0.8, y + len), Y(x + w * 0.8, y + len), X(x - w * 0.8, y + len), Y(x - w * 0.8, y + len)], true, dash);
      }
    }
    ctx.globalAlpha = ga * (0.2 + 0.12 * speed);
    ctx.fillStyle = T.cream;
    ctx.fill(dash);
    ctx.globalAlpha = ga;
  }

  // 3. speed streaks in a surge: thin cream lines, longer the faster you go
  if (speed > 0.05) {
    const lines = new Path2D(), bin = 9, len = 6 + 22 * speed;
    for (let y = Math.floor(y0 / bin) * bin; y <= y1; y += bin) {
      const i = Math.round(y / bin);
      if (P.hash1(i, 91) < 0.1) continue;
      const x = P.hash1(i, 93) * (wall - 4);
      const w = 0.22 + 0.12 * (P.hash1(i, 95) + 1);
      P.path([X(x - w, y), Y(x - w, y), X(x + w, y), Y(x + w, y), X(x, y + len), Y(x, y + len)], true, lines);
    }
    ctx.globalAlpha = ga * 0.16 * speed;
    ctx.fillStyle = T.cream;
    ctx.fill(lines);
    ctx.globalAlpha = ga;
  }

  // 4. the side walls: one sheet a side with its cut inner edge and its shadow on the floor, then soft ribs
  for (const side of [-1, 1]) {
    const outer = side < 0 ? xa : xb;
    const pts = [], step = 6;
    for (let y = Math.floor(y0 / step) * step; y <= y1 + step; y += step) { const x = edgeAt(y, side, wall); pts.push(X(x, y), Y(x, y)); }
    const cut = P.cut(pts, false, { step: 7, amp: 0.9 * hs, jitter: 0.4, seed: 71 + side });
    const p = P.path([X(outer, y0 - 6), Y(outer, y0 - 6), ...cut, X(outer, y1 + 12), Y(outer, y1 + 12)]);
    P.shadowCheap(ctx, p, 4 * hs, { alpha: 0.42, strokes: F.tier.shadowStrokes });
    P.paper(ctx, p, T.wall, { edge: F.tier.edge ? 0.8 * hs : 0, edgeMix: 0.3 });
    // ribs: soft darker cuts across the wall, fixed to the world (they slide past with you)
    const ribs = new Path2D(), gap = 22;
    for (let y = Math.floor(y0 / gap) * gap; y <= y1; y += gap) {
      const i = Math.round(y / gap), yy = y + 4 * P.hash1(i, 97 + side);
      const xIn = edgeAt(yy, side, wall) + side * 2.5, xOut = xIn + side * (10 + 6 * (P.hash1(i, 99) + 1));
      P.path([X(xIn, yy), Y(xIn, yy), X(xOut, yy + 1.2), Y(xOut, yy + 1.2), X(xOut, yy + 2.4), Y(xOut, yy + 2.4), X(xIn, yy + 1.4), Y(xIn, yy + 1.4)], true, ribs);
    }
    ctx.globalAlpha = ga * 0.35;
    ctx.fillStyle = T.rib;
    ctx.fill(ribs);
    ctx.globalAlpha = ga;
  }
}

// A flap from its wall to its tip: a long tongue with a round tip, cut edges (seeded per flap, so it keeps its shape).
// A bumped flap bends back toward its wall and its tip sags a little the way you came.
function flapPath(F, f, wall) {
  const X = F.X, Y = F.Y, hs = F.v.hs;
  const side = f.side, inward = -side, h = num(f.h, 3.5), bend = clamp01(f.bend);
  const root = side * (wall + 4);
  const tip = lerp(f.tip, side * (wall - 1), 0.45 * bend), sag = 2.2 * bend;
  const neck = tip - inward * h;
  const pts = [X(root, f.y + h), Y(root, f.y + h)];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const th = Math.PI / 2 - (Math.PI * i) / n;
    const x = neck + inward * h * Math.cos(th), y = f.y + sag + h * Math.sin(th);
    pts.push(X(x, y), Y(x, y));
  }
  pts.push(X(root, f.y - h), Y(root, f.y - h));
  return P.path(P.cut(pts, true, { step: 6, amp: 0.7 * hs, jitter: 0.35, seed: 40 + num(f.seed, 0) }));
}

function capsulePath(F, x0, x1, y, h, seed) {
  const X = F.X, Y = F.Y, k = F.k, hs = F.v.hs;
  const a = [X(x0 + h, y), Y(x0 + h, y)], b = [X(x1 - h, y), Y(x1 - h, y)];
  return P.path(P.capsule(a[0], a[1], b[0], b[1], h * k, h * k, { seed: 60 + seed, amp: 0.5 * hs }));
}

// A dashed line across [x − w/2, x + w/2] at y (the gate's line), in screen px.
function dashLine(F, x, y, w, th, n, fill = 0.55) {
  const X = F.X, Y = F.Y, p = new Path2D();
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = u0 + fill / n;
    const xa = x - w / 2 + w * u0, xb = x - w / 2 + w * u1;
    P.path([X(xa, y - th), Y(xa, y - th), X(xb, y - th), Y(xb, y - th), X(xb, y + th), Y(xb, y + th), X(xa, y + th), Y(xa, y + th)], true, p);
  }
  return p;
}

// Over the floor, under you: the tight-gap rings, the folds, the gates and the calm bubbles.
export function drawRunnerItems(F, st) {
  if (!st || !fin(st.wallX)) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k, ga = ctx.globalAlpha;
  const T = tones(F);
  const press = F.rmBirth ? 0 : clamp01(st.press) * num(st.wallPress, 2.5);
  const wall = st.wallX - press;
  const [y0, y1] = yRange(F, 30);
  const vis = (y) => y >= y0 && y <= y1;
  const X = F.X, Y = F.Y;

  // 1. the tight gaps: a dotted cream ring where you tuck through
  for (const g of st.gaps || []) {
    if (!g || !vis(g.y)) continue;
    const x = X(g.x, g.y), y = Y(g.x, g.y), R = Math.max(5 * hs, (g.w / 2 + 2.2) * k);
    const p = new Path2D(), n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      P.path(P.circle(x + Math.cos(a) * R, y + Math.sin(a) * R, Math.max(1.1, 0.55 * hs), { n: 6, amp: 0, jitter: 0 }), true, p);
    }
    ctx.globalAlpha = ga * 0.8 * clamp01(g.a);
    ctx.fillStyle = T.cream;
    ctx.fill(p);
  }
  ctx.globalAlpha = ga;

  // 2. the folds and the gates' flaps
  for (const f of st.flaps || []) {
    if (!f || !vis(f.y)) continue;
    const a = clamp01(f.a) * (f.bend > 0 ? lerp(1, 0.75, clamp01(f.bend)) : 1);
    if (a < 0.02) continue;
    const p = flapPath(F, f, wall);
    ctx.save();
    ctx.globalAlpha = ga * a;
    P.shadowCheap(ctx, p, 3 * hs, { alpha: 0.38, strokes: F.tier.shadowStrokes });
    P.sticker(ctx, p, 0, { kl: 1.2 });
    P.paper(ctx, p, f.tone ? GATE : T.fold, { edge: F.tier.edge ? 0.7 * hs : 0, edgeMix: 0.35 });
    if (!f.tone) {
      // a soft crease along the flap, so it reads as folded paper
      const side = f.side, h = num(f.h, 3.5), root = side * (wall + 2), tip = lerp(f.tip, side * (wall - 1), 0.45 * clamp01(f.bend));
      const end = tip + side * h * 1.2, yy = f.y - 0.35 * h, sag = 2.2 * clamp01(f.bend);
      const c = new Path2D();
      P.path([X(root, yy), Y(root, yy), X(end, yy + sag * 0.6), Y(end, yy + sag * 0.6), X(end, yy + sag * 0.6 - 0.55), Y(end, yy + sag * 0.6 - 0.55), X(root, yy - 0.55), Y(root, yy - 0.55)], true, c);
      ctx.fillStyle = T.wall; ctx.globalAlpha = ga * a * 0.45; ctx.fill(c);
    } else {
      // the gate's cut cream dashes along its flap
      const d = dashLine(F, (f.tip + f.side * (wall + 2)) / 2, f.y, Math.abs(f.side * (wall + 2) - f.tip) - 2, 0.5, 3);
      ctx.fillStyle = GATE_DASH; ctx.globalAlpha = ga * a * 0.9; ctx.fill(d);
    }
    ctx.restore();
  }

  // 3. the tuck gate's posts between the lanes
  for (const q of st.posts || []) {
    if (!q || !vis(q.y)) continue;
    const a = clamp01(q.a);
    if (a < 0.02) continue;
    const p = capsulePath(F, q.x0, q.x1, q.y, num(q.h, 3.5), num(q.seed, 0));
    ctx.save();
    ctx.globalAlpha = ga * a;
    P.shadowCheap(ctx, p, 3 * hs, { alpha: 0.38, strokes: F.tier.shadowStrokes });
    P.sticker(ctx, p, 0, { kl: 1.2 });
    P.paper(ctx, p, GATE, { edge: F.tier.edge ? 0.7 * hs : 0, edgeMix: 0.35 });
    const d = dashLine(F, (q.x0 + q.x1) / 2, q.y, q.x1 - q.x0 - 3, 0.5, 2);
    ctx.fillStyle = GATE_DASH; ctx.globalAlpha = ga * a * 0.9; ctx.fill(d);
    ctx.restore();
  }

  // 4. the gates' lines: dashed cream across the way through (solid once you pass it, dotted if missed)
  for (const g of st.hoops || []) {
    if (!g || !vis(g.y)) continue;
    const a = clamp01(g.a);
    if (a < 0.02) continue;
    const on = clamp01(g.on), hit = g.hit;
    const th = 0.55 + 0.5 * on;
    const p = dashLine(F, g.x, g.y, g.w, th, hit === 0 ? 14 : 7, hit === 0 ? 0.3 : lerp(0.55, 1, on));
    if (on > 0) paperGlow(F, X(g.x, g.y), Y(g.x, g.y), (g.w / 2) * k, 0.6 * on * a, T.cream);
    ctx.globalAlpha = ga * a * (hit === 0 ? 0.45 : 0.9);
    ctx.fillStyle = T.cream;
    ctx.fill(p);
    ctx.globalAlpha = ga;
    if (g.kind === "turn" || g.kind === "back") {
      // the hoop's two end beads
      const e = new Path2D();
      for (const sx of [-1, 1]) P.path(P.circle(X(g.x + sx * g.w / 2, g.y), Y(g.x + sx * g.w / 2, g.y), Math.max(2, 1.3 * k), { n: 10, seed: 64 }), true, e);
      ctx.save();
      ctx.globalAlpha = ga * a;
      P.sticker(ctx, e, 0, { kl: 1 });
      ctx.fillStyle = GATE; ctx.fill(e);
      ctx.restore();
    }
  }

  // 5. calm bubbles: cream discs with a keyline, a soft glow and a glint
  for (const b of st.bubbles || []) {
    if (!b || !vis(b.y)) continue;
    const a = clamp01(b.a);
    if (a < 0.02) continue;
    const x = X(b.x, b.y), y = Y(b.x, b.y), R = Math.max(3 * hs, b.r * k);
    paperGlow(F, x, y, R * 2.2, 0.35 * a, T.cream);
    // a thin bubble ring round it
    const ring = new Path2D();
    P.path(P.circle(x, y, R * 1.55 + 0.6 * hs, { n: 18, amp: 0.1, jitter: 0, seed: 67 }), true, ring);
    P.path(P.circle(x, y, R * 1.55 - 0.4 * hs, { n: 18, amp: 0.1, jitter: 0, seed: 67 }), true, ring);
    ctx.globalAlpha = ga * a * 0.5; ctx.fillStyle = T.cream; ctx.fill(ring, "evenodd"); ctx.globalAlpha = ga;
    const p = P.path(P.circle(x, y, R, { n: 16, amp: 0.15, jitter: 0.05, seed: 66 }));
    ctx.save();
    ctx.globalAlpha = ga * a;
    P.shadowCheap(ctx, p, 2.5 * hs, { alpha: 0.3, strokes: F.tier.shadowStrokes });
    P.sticker(ctx, p, 0, { kl: 1 });
    ctx.fillStyle = T.cream; ctx.fill(p);
    ctx.fillStyle = SHARED.white || "#ffffff";
    ctx.fill(P.path(P.circle(x - R * 0.32, y - R * 0.32, R * 0.28, { n: 8, amp: 0, jitter: 0 })));
    ctx.restore();
  }
  ctx.globalAlpha = ga;
}
