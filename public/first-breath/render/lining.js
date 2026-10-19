// First Breath: stage 4's lining map as paper (first-breath-action-genres design.md 5.4, 4.8; core/stages/root.js
// liningView; core/draw.js "lining" strip). The renderer calls four parts in its draw order:
// - drawLiningFloor (with the course tiles): the deep lining under the map (your tunnels and open fluid show it), and
//   the edge tissue round it;
// - drawLiningSheets (after the ground marks, so a pool lies under the tissue until you tunnel to it): the soft front
//   sheet and the darker firm sheet with its rows of cut dots, as baked tiles of 25 u. Each tile bakes the cells of its
//   own square and two round it (the shadows that fall in from its neighbours), and bakes again only when the core
//   says a tunnel crossed it (its version), at most a few a frame; → true on a frame that baked (render/perf.js leaves
//   it out of the frame cost, as the course's bakes are);
// - drawLiningMid (with the strips, after the tree): knots, the aim ring, the tendril, compass pings, link glows, the
//   heart's pulse beads, crumbs and rings;
// - drawLiningTop (over the frames, with the cue sticker): the compass arrow at the screen edge when the pool it points
//   at is off screen.
// A cell is a disc a little wider than the cell, so the cut edges are scalloped like hand-cut paper. Nothing here
// draws text.
//
// Source: the destructible-terrain bitmap of Worms (Team17) and Dig Dug's tunnels: the ground is a grid of cells a
// tunnel clears, drawn from per-tile bakes that are redone only where it changed.
import * as P from "./paper.js";
import { roleHex } from "./palette.js";

const TAU = Math.PI * 2;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));
const OPEN = 0, SOFT = 1, FIRM = 2, EDGE = 5;
const MAX_PX_PER_U = 8;        // the bake's resolution cap (device px a world unit)
const BAKES_PER_FRAME = 6;     // tiles a tunnel crossed, baked again per frame (the first frame bakes all it shows)
const TONE = Object.freeze({
  soft: "#7a1e34", deep: "#5c1428", firm: "#44101e", knot: "#fff4e2", tendril: "#f4a890", bead: "#fff0dc",
  cream: "#fff4e2", you: "#ffc53d",
});

const tok = (F, t, dflt) => (t && roleHex(F.stage, t)) || dflt;
const dash = (ctx, d) => { if (typeof ctx.setLineDash === "function") ctx.setLineDash(d); };

// ---- the floor

function mapCorners(F, st) {
  const w = st.n * st.cell;
  return [[st.ox, st.oy], [st.ox + w, st.oy], [st.ox + w, st.oy + w], [st.ox, st.oy + w]].map(([x, y]) => [F.X(x, y), F.Y(x, y)]);
}

export function drawLiningFloor(F, st) {
  if (!st || !(st.a > 0)) return;
  const ctx = F.ctx;
  ctx.save();
  ctx.globalAlpha *= clamp01(st.a);
  // the lining outside the map (soft, like the edge tissue round it), then the deep lining inside it
  ctx.fillStyle = tok(F, "lining", TONE.soft);
  ctx.fillRect(-20, -20, F.v.W + 40, F.v.H + 40);
  const c = mapCorners(F, st), p = new Path2D();
  p.moveTo(c[0][0], c[0][1]);
  for (let i = 1; i < 4; i++) p.lineTo(c[i][0], c[i][1]);
  p.closePath();
  ctx.fillStyle = tok(F, "deepLining", TONE.deep);
  ctx.fill(p);
  if (F.tier.grain > 0 && F.v.pattern) P.grainOver(ctx, p, F.v.pattern, F.tier.grain * 0.5, F.X(st.ox, st.oy), F.Y(st.ox, st.oy));
  ctx.restore();
}

// ---- the tissue sheets, baked per tile

const BAKE = { key: "", map: "", tiles: new Map() };

function bakeTile(F, st, tx, ty, sc, theta, kRef) {
  const per = st.n / st.tiles, tu = per * st.cell;
  const S = Math.max(8, Math.round(tu * sc));
  const cv = F.v.makeCanvas(S, S);
  const g = cv.getContext("2d");
  const x0 = st.ox + tx * tu, y1 = st.oy + (ty + 1) * tu, k = S / tu;
  g.setTransform(k, 0, 0, -k, -x0 * k, y1 * k);         // world → tile px (y up → down)
  const n = st.n, grid = st.grid, c = st.cell;
  const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n ? EDGE : grid[j * n + i]);
  const soft = new Path2D(), firm = new Path2D(), dots = new Path2D(), specks = new Path2D();
  let any = false;
  const i0 = tx * per - 2, i1 = (tx + 1) * per + 1, j0 = ty * per - 2, j1 = (ty + 1) * per + 1;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const v = at(i, j);
      if (v !== SOFT && v !== FIRM && v !== EDGE) continue;
      const sheet = v === FIRM ? FIRM : SOFT;            // the edge round the map is cut like soft tissue
      // a disc a little off the cell's centre and a little larger than it: the union reads as a hand-cut edge
      const h = P.hash2(i, j, 47), hx = P.hash2(i, j, 48) - 0.5, hy = P.hash2(i, j, 49) - 0.5;
      const cx = st.ox + (i + 0.5 + 0.3 * hx) * c, cy = st.oy + (j + 0.5 + 0.3 * hy) * c;
      const r = c * (0.83 + 0.2 * h);
      const path = sheet === SOFT ? soft : firm;
      path.moveTo(cx + r, cy);
      path.arc(cx, cy, r, 0, TAU);
      any = true;
      if (v === FIRM && !(i & 1) && !(j & 1) && [at(i + 1, j), at(i - 1, j), at(i, j + 1), at(i, j - 1)].every((w) => w === FIRM)) {
        dots.moveTo(cx + c * 0.2, cy); dots.arc(cx, cy, c * 0.2, 0, TAU);
      } else if (sheet === SOFT && h > 0.93) {
        specks.moveTo(cx + c * 0.14, cy); specks.arc(cx + (h - 0.93) * 8, cy, c * 0.14, 0, TAU);
      }
    }
  }
  if (!any) return cv;
  // screen offsets (CSS px) turned into world units for this camera turn: the light stays up-left on screen
  const co = Math.cos(theta), sn = Math.sin(theta), hs = F.v.hs;
  const toW = (ox, oy) => ({ x: (co * ox - sn * oy) / kRef, y: -(sn * ox + co * oy) / kRef });
  const sh = P.shadowOffset(3.2 * hs), sw = toW(sh.x, sh.y), sw2 = toW(sh.x * 1.6, sh.y * 1.6);
  const ew = toW(-P.LX * 1.1 * hs * 0.6, -P.LY * 1.1 * hs);
  const fill = (path, color, off) => { g.save(); if (off) g.translate(off.x, off.y); g.fillStyle = color; g.fill(path); g.restore(); };
  const softHex = tok(F, "lining", TONE.soft), firmHex = tok(F, "frame2", TONE.firm);
  g.globalAlpha = 0.24; fill(soft, P.INK, sw2); fill(firm, P.INK, sw2);
  g.globalAlpha = 0.34; fill(soft, P.INK, sw); fill(firm, P.INK, sw);
  g.globalAlpha = 1;
  if (F.tier.edge) fill(soft, P.mix(softHex, P.CREAM, 0.26), ew);
  fill(soft, softHex, null);
  fill(specks, P.mix(softHex, tok(F, "deepLining", TONE.deep), 0.55), null);
  if (F.tier.edge) fill(firm, P.mix(firmHex, softHex, 0.45), ew);
  fill(firm, firmHex, null);
  fill(dots, P.mix(firmHex, softHex, 0.6), null);
  return cv;
}

export function drawLiningSheets(F, st) {
  if (!st || !(st.a > 0) || !(st.grid instanceof Uint8Array)) return false;
  const ctx = F.ctx, cam = F.v.cam, dpx = F.v.dpx || ctx.__dpx || 1;
  const theta = cam.theta || 0;
  const kRef = Math.min(F.v.W, F.v.H) / 160;
  const sc = Math.min(MAX_PX_PER_U, kRef * dpx);
  const key = `${F.v.W}x${F.v.H}|${dpx.toFixed(3)}|${theta.toFixed(3)}|${F.tier.name}|${F.tier.edge ? 1 : 0}`;
  const mapKey = `${st.ox},${st.oy},${st.n}`;
  if (BAKE.map !== mapKey) { BAKE.map = mapKey; BAKE.tiles.clear(); BAKE.key = key; }
  const fresh = BAKE.key !== key;
  if (fresh) BAKE.key = key;
  // the tiles on screen
  const tu = (st.n / st.tiles) * st.cell;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [px, py] of [[0, 0], [F.v.W, 0], [0, F.v.H], [F.v.W, F.v.H]]) {
    const w = cam.toWorld(px, py);
    x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y);
  }
  const ta = Math.max(0, Math.floor((x0 - st.ox) / tu)), tb = Math.min(st.tiles - 1, Math.floor((x1 - st.ox) / tu));
  const ua = Math.max(0, Math.floor((y0 - st.oy) / tu)), ub = Math.min(st.tiles - 1, Math.floor((y1 - st.oy) / tu));
  let baked = false, budget = BAKES_PER_FRAME;
  const rd = (v) => Math.round(v * dpx) / dpx;
  ctx.save();
  ctx.globalAlpha *= clamp01(st.a);
  for (let ty = ua; ty <= ub; ty++) {
    for (let tx = ta; tx <= tb; tx++) {
      const id = ty * st.tiles + tx, ver = st.ver[id];
      let t = BAKE.tiles.get(id);
      const stale = !t || t.key !== BAKE.key || t.ver !== ver;
      if (stale && (!t || t.key !== BAKE.key || budget > 0)) {
        if (t && t.key === BAKE.key) budget--;
        t = { cv: bakeTile(F, st, tx, ty, sc, theta, kRef), ver, key: BAKE.key };
        BAKE.tiles.set(id, t);
        baked = true;
      }
      // the tile's corners on screen, rounded to device px: neighbours share them, so no seam shows
      const wx0 = st.ox + tx * tu, wy1 = st.oy + (ty + 1) * tu;
      const ax = rd(F.X(wx0, wy1)), ay = rd(F.Y(wx0, wy1));
      const bx = rd(F.X(wx0 + tu, wy1)), by = rd(F.Y(wx0 + tu, wy1));
      const cx = rd(F.X(wx0, wy1 - tu)), cy = rd(F.Y(wx0, wy1 - tu));
      // the tile's own axes on screen (a turn and a scale: the camera turns by quarter turns only)
      const S = t.cv.width, ux = (bx - ax) / S, uy = (by - ay) / S, vx = (cx - ax) / S, vy = (cy - ay) / S;
      const su = Math.hypot(ux, uy) || 1e-9;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(Math.atan2(uy, ux));
      ctx.scale(su, (ux * vy - uy * vx) / su);
      ctx.drawImage(t.cv, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
  return baked || fresh;
}

// ---- knots, the tendril, pings, glows, beads, crumbs, rings

function disc(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }

export function drawLiningMid(F, st) {
  if (!st || !(st.a > 0)) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs;
  const cream = tok(F, "softSpot", TONE.cream);
  ctx.save();
  ctx.globalAlpha *= clamp01(st.a);
  // crumbs of tissue
  if (st.crumbs.length) {
    for (const firm of [0, 1]) {
      const p = new Path2D();
      for (const c of st.crumbs) if ((c.firm ? 1 : 0) === firm) { const r = Math.max(1, c.r * k); p.rect(F.X(c.x, c.y) - r, F.Y(c.x, c.y) - r, 2 * r, 2 * r); }
      ctx.fillStyle = firm ? P.mix(tok(F, "frame2", TONE.firm), cream, 0.15) : P.mix(tok(F, "lining", TONE.soft), cream, 0.2);
      ctx.fill(p);
    }
  }
  // knots: small cream paper discs on an ink keyline
  if (st.knots.length) {
    const ink = new Path2D(), fill = new Path2D(), core = new Path2D();
    for (const q of st.knots) {
      const x = F.X(q.x, q.y), y = F.Y(q.x, q.y), r = Math.max(3, q.r * k);
      disc(ink, x, y, r + 1.6 * hs); disc(fill, x, y, r); disc(core, x, y, r * 0.38);
    }
    P.shadowCheap(ctx, ink, 2.2 * hs, { alpha: 0.3, strokes: 0 });
    ctx.fillStyle = P.INK; ctx.fill(ink);
    ctx.fillStyle = cream; ctx.fill(fill);
    ctx.fillStyle = tok(F, "tree", "#f4a890"); ctx.fill(core);
  }
  // the aim: what a press now would snap to (a dotted cream ring that turns)
  if (st.aim) {
    const x = F.X(st.aim.x, st.aim.y), y = F.Y(st.aim.x, st.aim.y), r = Math.max(7, st.aim.r * k);
    ctx.save();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 3.4 * hs; dash(ctx, [3 * hs, 3 * hs]); ctx.lineDashOffset = -F.t * 12;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = cream; ctx.lineWidth = 1.8 * hs; ctx.stroke();
    ctx.restore();
  }
  // compass pings: rings from the pool, seen through the tissue
  for (const q of st.pings) {
    const x = F.X(q.x, q.y), y = F.Y(q.x, q.y), r = Math.max(4, q.r * k);
    ctx.save();
    ctx.globalAlpha *= 0.85 * clamp01(q.a);
    dash(ctx, [2.5 * hs, 3.5 * hs]);
    ctx.strokeStyle = P.INK; ctx.lineWidth = 3 * hs; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = cream; ctx.lineWidth = 1.6 * hs; ctx.stroke();
    ctx.restore();
  }
  // the tendril: a pale coral strip on an ink keyline, a hook at its tip
  if (st.tendril) {
    const tr = st.tendril;
    const ax = F.X(tr.x0, tr.y0), ay = F.Y(tr.x0, tr.y0), bx = F.X(tr.x1, tr.y1), by = F.Y(tr.x1, tr.y1);
    const len = Math.hypot(bx - ax, by - ay);
    if (len > 1) {
      const nx = -(by - ay) / len, ny = (bx - ax) / len, wav = (tr.state === 2 ? 0.6 : 2.2) * hs, segs = Math.max(2, Math.round(len / (8 * hs)));
      const p = new Path2D();
      p.moveTo(ax, ay);
      for (let i = 1; i <= segs; i++) {
        const u = i / segs, w = Math.sin(u * Math.PI * 3 + F.t * 30) * wav * Math.sin(u * Math.PI);
        p.lineTo(ax + (bx - ax) * u + nx * w, ay + (by - ay) * u + ny * w);
      }
      ctx.save();
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.strokeStyle = P.INK; ctx.lineWidth = Math.max(3.4 * hs, 1.9 * k); ctx.stroke(p);
      ctx.strokeStyle = tok(F, "tree", TONE.tendril); ctx.lineWidth = Math.max(1.8 * hs, 1.0 * k); ctx.stroke(p);
      const hook = new Path2D(); disc(hook, bx, by, Math.max(2.5 * hs, 1.2 * k));
      ctx.fillStyle = P.INK; ctx.fill(hook);
      if (tr.snap) { const h2 = new Path2D(); disc(h2, bx, by, Math.max(1.4 * hs, 0.7 * k)); ctx.fillStyle = cream; ctx.fill(h2); }
      ctx.restore();
    }
  }
  // the roots a heart pulse is lighting: a soft halo, then a bright cream line
  if (st.lit && st.lit.length) {
    ctx.save();
    ctx.lineCap = "round";
    const beadHex = tok(F, "beads", TONE.bead);
    for (const [w, al] of [[3.4, 0.3], [1.3, 1]]) {
      ctx.strokeStyle = beadHex;
      ctx.lineWidth = Math.max(w * 1.6 * hs, w * k);
      for (const q of st.lit) {
        ctx.globalAlpha = clamp01(q.a) * al;
        ctx.beginPath(); ctx.moveTo(F.X(q.px, q.py), F.Y(q.px, q.py)); ctx.lineTo(F.X(q.x, q.y), F.Y(q.x, q.y)); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // glows running back along the roots, and the heart's pulse beads running out
  for (const [list, rr] of [[st.glows, null], [st.beads, 2.2]]) {
    if (!list.length) continue;
    const halo = new Path2D(), core = new Path2D();
    for (const g of list) {
      const x = F.X(g.x, g.y), y = F.Y(g.x, g.y), r = Math.max(2, (rr || g.r) * k) * (0.6 + 0.4 * clamp01(g.a));
      disc(halo, x, y, r * 2.1); disc(core, x, y, r);
    }
    ctx.save();
    ctx.globalAlpha *= 0.28; ctx.fillStyle = tok(F, "beads", TONE.bead); ctx.fill(halo);
    ctx.restore();
    ctx.fillStyle = P.INK; ctx.save(); ctx.translate(0.6 * hs, 1.2 * hs); ctx.globalAlpha *= 0.35; ctx.fill(core); ctx.restore();
    ctx.fillStyle = tok(F, "beads", TONE.bead); ctx.fill(core);
  }
  // rings: a link (cream), your roots growing stronger (marigold: it is you), a heartbeat (cream, thin)
  for (const q of st.rings) {
    const x = F.X(q.x, q.y), y = F.Y(q.x, q.y), r = Math.max(4, q.r * k);
    ctx.save();
    ctx.globalAlpha *= clamp01(q.a);
    ctx.strokeStyle = P.INK; ctx.lineWidth = (q.kind === 2 ? 2.6 : 4) * hs; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = q.kind === 1 ? TONE.you : cream; ctx.lineWidth = (q.kind === 2 ? 1.2 : 2.2) * hs; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ---- the compass arrow at the screen edge

// The box the arrow keeps to (CSS px): clear of the HUD at the top and the prompt and captions at the bottom.
function arrowBox(F) {
  const W = F.v.W, H = F.v.H, portrait = H >= W;
  const side = Math.max(30, 0.06 * Math.min(W, H));
  const top = H * (portrait ? 0.17 : 0.2), bottom = H * (portrait ? 0.66 : 0.72);
  return { x0: side, x1: W - side, y0: top, y1: bottom };
}

export function drawLiningTop(F, st) {
  const c = st && st.compass;
  if (!c || !(st.a > 0)) return;
  const ctx = F.ctx, hs = F.v.hs, b = arrowBox(F);
  const tx = F.X(c.x, c.y), ty = F.Y(c.x, c.y);
  const pad = 14 * hs;
  if (tx > pad && tx < F.v.W - pad && ty > pad && ty < F.v.H - pad) return;   // on screen: the ping is enough
  const sx = F.v.cam.subject.x, sy = F.v.cam.subject.y;
  const dx = tx - sx, dy = ty - sy;
  let s = Infinity;
  if (dx > 0) s = Math.min(s, (b.x1 - sx) / dx); else if (dx < 0) s = Math.min(s, (b.x0 - sx) / dx);
  if (dy > 0) s = Math.min(s, (b.y1 - sy) / dy); else if (dy < 0) s = Math.min(s, (b.y0 - sy) / dy);
  if (!fin(s) || s <= 0) return;
  const x = sx + dx * s, y = sy + dy * s, a = Math.atan2(dy, dx);
  const size = (12 + 4 * clamp01(c.ping)) * hs;
  const p = new Path2D();
  const pt = (u, v) => [x + Math.cos(a) * u - Math.sin(a) * v, y + Math.sin(a) * u + Math.cos(a) * v];
  const tip = pt(size, 0), l = pt(-size * 0.7, size * 0.75), m = pt(-size * 0.3, 0), r = pt(-size * 0.7, -size * 0.75);
  p.moveTo(tip[0], tip[1]); p.lineTo(l[0], l[1]); p.lineTo(m[0], m[1]); p.lineTo(r[0], r[1]); p.closePath();
  ctx.save();
  ctx.globalAlpha *= clamp01(st.a);
  P.shadowCheap(ctx, p, 3 * hs, { alpha: 0.32, strokes: 0 });
  P.sticker(ctx, p, 1.4 * hs, { kl: 1.8 * hs });
  ctx.fillStyle = tok(F, "softSpot", TONE.cream);
  ctx.fill(p);
  ctx.restore();
  F.compassAt = { x, y, r: size * 1.6 };
}
