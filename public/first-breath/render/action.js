// First Breath: the action layer's draw items as paper (contract.md; core/draw.js validateAction). render/items.js
// re-exports these and render/renderer.js calls them in its draw order: the arena wall, the safe zone, telegraphs
// and pickups on the ground; foes with the bodies; bullets over the bodies; your hitbox marker on top; the hit flash
// over the frame. The screen shake is an offset the renderer adds to its sway (none with reduced motion). Nothing
// here draws text (number pops are DOM: ui/pops.js).
//
// Colours: ROLES[stage].action (render/palette.js) names a stage's tokens; anything it leaves out comes from
// ACTION_TONES below. Bullets are batched: one path per tone for each of its sheets (shadow, ink keyline, colour, pale
// core), so 640 bullets cost a fixed 16 fills; the low tier drops the shadow and cuts each bullet with fewer points.
//
// Sources: the danmaku bullet read (a dark keyline, a strong colour and a pale core, so a bullet reads on any ground;
// a small marked hitbox) after the Touhou Project games; batching every bullet of a colour into one path after MDN,
// "Optimizing canvas" (fewer state changes and draw calls); the cut-paper look of the rest after the renderer's own
// sheets (render/paper.js: a lit edge, a cheap offset shadow).
import * as P from "./paper.js";
import { roleHex } from "./palette.js";

const TAU = Math.PI * 2;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));

export const ACTION_TONES = Object.freeze({
  foe: "#3f6f78",      // germs: a cool teal on the warm grounds
  foe2: "#6a5a9a",     // spores and rings: violet
  boss: "#2f5560",
  bossCore: "#7fb3a8",
  mine: "#ffc53d",     // your sparks: the marigold accent
  b1: "#24466e",       // foe bullets: deep blue, magenta, violet (tones 1, 2, 3), each with a cream core
  b2: "#8a1f4a",
  b3: "#4e3384",
  core: "#fff4e2",
  food: "#ffd86a",
  heal: "#ff6f8f",
  up: "#fff4e2",
  tell: "#fff4e2",
  wall: "#c25470",
  zone: "#1a0610",
});

function tone(F, key) {
  const a = F.role && F.role.action;
  const v = a && a[key];
  return (v && roleHex(F.stage, v)) || ACTION_TONES[key];
}
const act = (F) => (F.d && F.d.action) || null;
const dash = (ctx, d) => { if (typeof ctx.setLineDash === "function") ctx.setLineDash(d); };

// The shake offset (CSS px) for this frame: up to 5 px × hs, a smooth wobble in time (none with reduced motion).
export function shakeOffset(d, t, hs, reduced) {
  const a = d && d.action;
  if (!a || reduced || !(a.shake > 0.01)) return { x: 0, y: 0 };
  const k = a.shake * a.shake * 5 * hs;
  return { x: k * Math.sin(t * 93.1) * Math.cos(t * 41.7), y: k * Math.cos(t * 87.3) * Math.sin(t * 57.9 + 1) };
}

// ---- the ground: the arena's wall, the safe zone, telegraphs, pickups

export function drawArena(F) {
  const a = act(F);
  if (!a || !a.arena) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs, z = a.arena;
  const x = F.X(z.x, z.y), y = F.Y(z.x, z.y), r = z.r * k;
  const p = new Path2D();
  P.path(P.circle(x, y, r + Math.max(F.v.W, F.v.H), { n: 24, amp: 0, jitter: 0 }), true, p);
  P.path(P.circle(x, y, r, { step: 7, seed: 71, scallops: 18, depth: 1.6 * hs }), true, p);
  P.shadowCheap(ctx, p, 3.5 * hs, { alpha: 0.34, strokes: F.tier.shadowStrokes, rule: "evenodd" });
  P.paper(ctx, p, tone(F, "wall"), { rule: "evenodd", edge: F.tier.edge ? 1.1 * hs : 0, edgeMix: 0.3,
    grain: F.tier.grain ? F.tier.grain * 0.6 : 0, pattern: F.v.pattern, gx: x, gy: y });
}

export function drawZone(F) {
  const a = act(F);
  if (!a || !a.zone) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs, z = a.zone;
  const x = F.X(z.x, z.y), y = F.Y(z.x, z.y), r = Math.max(2, z.r * k);
  const outside = new Path2D();
  outside.rect(-20, -20, F.v.W + 40, F.v.H + 40);
  P.path(P.circle(x, y, r, { step: 6, seed: 72 }), true, outside);
  ctx.save();
  ctx.globalAlpha *= 0.3;
  ctx.fillStyle = tone(F, "zone");
  ctx.fill(outside, "evenodd");
  ctx.restore();
  // the zone's edge: a cut cream strip; where it is going, a dotted ring
  const edge = new Path2D();
  P.path(P.circle(x, y, r + 1.6 * hs, { step: 6, seed: 73 }), true, edge);
  P.path(P.circle(x, y, Math.max(1, r - 1.6 * hs), { step: 6, seed: 73 }), true, edge);
  P.paper(ctx, edge, tone(F, "tell"), { rule: "evenodd", edge: 0 });
  if (z.next) {
    const nx = F.X(z.next.x, z.next.y), ny = F.Y(z.next.x, z.next.y), nr = Math.max(2, z.next.r * k);
    const n = Math.max(10, Math.min(60, Math.round((TAU * nr) / (9 * hs)))), dots = new Path2D();
    for (let i = 0; i < n; i++) { const t = (i / n) * TAU; P.path(P.circle(nx + Math.cos(t) * nr, ny + Math.sin(t) * nr, 1.4 * hs, { n: 7, amp: 0, jitter: 0 }), true, dots); }
    ctx.fillStyle = tone(F, "tell");
    ctx.fill(dots);
  }
}

// A strip from (x, y) along screen angle a: length L px, half width w px.
function stripPts(x, y, a, L, w) {
  const c = Math.cos(a), s = Math.sin(a), nx = -s * w, ny = c * w;
  return [x + nx, y + ny, x + c * L + nx, y + s * L + ny, x + c * L - nx, y + s * L - ny, x - nx, y - ny];
}

export function drawTells(F) {
  const a = act(F);
  if (!a || !Array.isArray(a.tells) || !a.tells.length) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs, col = tone(F, "tell"), ink = P.INK;
  for (const t of a.tells) {
    if (!t || !fin(t.x) || !fin(t.y)) continue;
    const x = F.X(t.x, t.y), y = F.Y(t.x, t.y), p = clamp01(t.p);
    const sa = F.v.cam.screenAngle(fin(t.ang) ? t.ang : 0);
    ctx.save();
    switch (t.kind) {
      case "line": case "charge": {
        const L = Math.max(8, (fin(t.len) ? t.len : 40) * k), w = Math.max(1.5 * hs, (fin(t.w) ? t.w : 1.2) * k);
        const outer = P.path(stripPts(x, y, sa, L, w));
        ctx.globalAlpha *= 0.35 + 0.35 * p;
        ctx.lineWidth = 2 * hs; ctx.strokeStyle = ink; dash(ctx, [5 * hs, 4 * hs]); ctx.stroke(outer);
        dash(ctx, []);
        ctx.globalAlpha = 0.25 + 0.5 * p;
        ctx.fillStyle = col;
        ctx.fill(P.path(stripPts(x, y, sa, L * p, w * (t.kind === "charge" ? 1 : 0.55))));
        break;
      }
      case "fan": {
        const R = Math.max(10, (fin(t.r) ? t.r : 30) * k), half = Math.max(0.05, fin(t.w) ? t.w : 0.3);
        const pts = [x, y];
        for (let i = 0; i <= 12; i++) { const b = sa - half + (2 * half * i) / 12; pts.push(x + Math.cos(b) * R, y + Math.sin(b) * R); }
        const fan = P.path(pts);
        ctx.globalAlpha *= 0.18 + 0.32 * p;
        ctx.fillStyle = col; ctx.fill(fan);
        ctx.globalAlpha = 0.45 + 0.4 * p;
        ctx.lineWidth = 1.6 * hs; ctx.strokeStyle = ink; dash(ctx, [4 * hs, 4 * hs]); ctx.stroke(fan);
        break;
      }
      case "ring": {
        // a ring closes in on its emitter as the pattern comes
        const r = Math.max(4, (fin(t.r) ? t.r : 6) * k * (1.9 - 0.9 * p));
        const ring = P.path(P.circle(x, y, r, { step: 5, amp: 0, jitter: 0 }));
        ctx.globalAlpha *= 0.4 + 0.5 * p;
        ctx.lineWidth = (2.4 + 1.4 * p) * hs; ctx.strokeStyle = ink; ctx.stroke(ring);
        ctx.lineWidth = (1.2 + 1 * p) * hs; ctx.strokeStyle = col; dash(ctx, [6 * hs, 4 * hs]); ctx.stroke(ring);
        break;
      }
      default: {                                   // spot: where a foe comes in
        const r = Math.max(4, (fin(t.r) ? t.r : 4) * k);
        const ring = P.path(P.circle(x, y, r, { step: 4, amp: 0, jitter: 0 }));
        ctx.globalAlpha *= 0.3 + 0.5 * p;
        ctx.lineWidth = 1.6 * hs; ctx.strokeStyle = col; dash(ctx, [2 * hs, 3 * hs]); ctx.stroke(ring);
        dash(ctx, []);
        ctx.globalAlpha = 0.25 * p;
        ctx.fillStyle = col; ctx.fill(P.path(P.circle(x, y, r * p, { step: 4, amp: 0, jitter: 0 })));
        break;
      }
    }
    ctx.restore();
  }
}

// Pickups: food beads, heal hearts and up stars, one path per kind for each sheet.
const HEART = (x, y, r) => {
  const out = [];
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * TAU;
    out.push(x + r * 0.95 * Math.pow(Math.sin(t), 3), y - r * (0.8 * Math.cos(t) - 0.3 * Math.cos(2 * t) - 0.12 * Math.cos(3 * t) - 0.05 * Math.cos(4 * t)) - r * 0.15);
  }
  return out;
};
const STAR = (x, y, r) => {
  const out = [];
  for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? r * 0.45 : r; out.push(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
  return out;
};
export function drawPickups(F) {
  const a = act(F), b = a && a.pickups;
  if (!b || !(b.n > 0)) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs, W = F.v.W, H = F.v.H;
  const shapes = [new Path2D(), new Path2D(), new Path2D()], shadow = new Path2D();
  const rr = Math.max(2.2 * hs, 1.3 * k);
  let any = false;
  for (let i = 0; i < b.n; i++) {
    if (b.a && b.a[i] < 0.5) continue;                 // its blink, off
    const x = F.X(b.xy[2 * i], b.xy[2 * i + 1]), y = F.Y(b.xy[2 * i], b.xy[2 * i + 1]);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    const kd = b.kind[i];
    const pts = kd === 1 ? HEART(x, y, rr * 1.5) : kd === 2 ? STAR(x, y, rr * 1.7) : P.circle(x, y, rr, { n: 8, amp: 0.2, jitter: 0.1, seed: 74, fixed: true });
    P.path(pts, true, shapes[kd]);
    P.path(pts, true, shadow);
    any = true;
  }
  if (!any) return;
  if (F.tier.shadowStrokes > 0) P.shadowCheap(ctx, shadow, 2.2 * hs, { alpha: 0.3, strokes: 0 });
  const cols = [tone(F, "food"), tone(F, "heal"), tone(F, "up")];
  for (let kd = 0; kd < 3; kd++) {
    if (kd > 0) { ctx.save(); ctx.lineJoin = "round"; ctx.lineWidth = 2.2 * hs; ctx.strokeStyle = P.INK; ctx.stroke(shapes[kd]); ctx.restore(); }
    P.paper(ctx, shapes[kd], cols[kd], { edge: F.tier.edge ? 0.6 * hs : 0, edgeMix: 0.5 });
  }
}

// ---- foes: paper cut-outs by kind

function foeShape(kind, x, y, r, ang, t, id) {
  switch (kind) {
    case "germ": return P.circle(x, y, r, { step: Math.max(2.5, r * 0.25), seed: 81, scallops: 9, depth: r * 0.16, rot: t * 0.6 + id });
    case "spore": return P.circle(x, y, r, { step: 2, seed: 82, scallops: 7, depth: r * 0.42, rot: t * 1.4 + id });
    case "blob": return P.circle(x, y, r, { step: Math.max(3, r * 0.2), seed: 83, scallops: 3, depth: r * (0.12 + 0.05 * Math.sin(t * 3 + id)), rot: t * 0.4 });
    case "drop": {
      const c = Math.cos(ang), s = Math.sin(ang), out = [];
      for (let i = 0; i < 18; i++) {
        const u = (i / 18) * TAU, rr = r * (0.75 + 0.35 * Math.pow(Math.max(0, Math.cos(u)), 6));
        const px = Math.cos(u) * rr * (1 + 0.5 * Math.max(0, Math.cos(u))), py = Math.sin(u) * rr;
        out.push(x + px * c - py * s, y + px * s + py * c);
      }
      return out;
    }
    case "guard": {
      const out = [];
      for (let i = 0; i < 6; i++) { const u = ang + (i / 6) * TAU; out.push(x + Math.cos(u) * r, y + Math.sin(u) * r); }
      return out;
    }
    case "rival": {
      const c = Math.cos(ang), s = Math.sin(ang), out = [];
      for (let i = 0; i < 16; i++) {
        const u = (i / 16) * TAU, px = Math.cos(u) * r * (Math.cos(u) > 0 ? 1.25 : 0.95), py = Math.sin(u) * r * 0.8;
        out.push(x + px * c - py * s, y + px * s + py * c);
      }
      return out;
    }
    // the big germ: a germ's spiky rim, bigger, breathing slowly
    case "boss": return P.circle(x, y, r, { step: Math.max(4, r * 0.16), seed: 85, scallops: 13, depth: r * (0.15 + 0.03 * Math.sin(t * 2.2)), rot: t * 0.25 });
    default: return P.circle(x, y, r, { step: Math.max(3, r * 0.25), seed: 86 });        // ring, cell
  }
}

// A clump: stacked sage and brown paper discs round a middle one, turning slowly, each breathing a little.
const CLUMP = ["#9fae7e", "#8a6a4a", "#7d8f62"];
function clumpDiscs(x, y, r, t) {
  const out = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + t * 0.25, rr = r * (0.42 + 0.05 * Math.sin(t * 2.1 + k * 1.7)), d = r * 0.56;
    out.push({ pts: P.circle(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, { step: Math.max(3, rr * 0.3), seed: 96 + k }), c: k % 2 });
  }
  out.push({ pts: P.circle(x, y, r * 0.66, { step: Math.max(3, r * 0.2), seed: 104, scallops: 5, depth: r * 0.05, rot: t * 0.2 }), c: 2 });
  return out;
}

export function drawFoes(F) {
  const a = act(F);
  if (!a || !Array.isArray(a.foes) || !a.foes.length) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs, t = F.t, W = F.v.W, H = F.v.H;
  const items = [];
  const union = new Path2D();
  a.foes.forEach((f, i) => {
    if (!f || !fin(f.x) || !fin(f.y)) return;
    const x = F.X(f.x, f.y), y = F.Y(f.x, f.y);
    const born = f.born === undefined ? 1 : clamp01(f.born);
    const r = Math.max(1.5, f.r * k * (0.35 + 0.65 * born));
    if (x < -r - 10 || y < -r - 10 || x > W + r + 10 || y > H + r + 10) return;
    const sa = F.v.cam.screenAngle(fin(f.ang) ? f.ang : 0);
    if (f.look === "clump") {                         // a clump (stage 3's Knot): overlapping paper discs (design.md 4.8)
      const discs = clumpDiscs(x, y, r, t);
      const p = new Path2D();
      for (const d of discs) { P.path(d.pts, true, p); if (born >= 1) P.path(d.pts, true, union); }
      items.push({ f, x, y, r, p, born, discs });
      return;
    }
    const pts = foeShape(f.kind, x, y, r, sa, t, i * 0.7);
    const p = P.path(pts);
    if (f.kind === "ring") P.path(P.rev2(P.circle(x, y, r * 0.48, { step: 3, seed: 87 })), true, p);
    items.push({ f, x, y, r, p, born });
    if (born >= 1) P.path(pts, true, union);
  });
  if (!items.length) return;
  P.shadowCheap(ctx, union, 4 * hs, { alpha: 0.32, strokes: F.tier.shadowStrokes });
  for (const it of items) {
    const { f, x, y, r, p, born } = it;
    const kind = f.kind;
    const col = kind === "boss" ? tone(F, "boss") : kind === "spore" || kind === "ring" ? tone(F, "foe2") : tone(F, "foe");
    ctx.save();
    if (born < 1) ctx.globalAlpha *= 0.35 + 0.5 * born;
    if (it.discs) for (const d of it.discs) P.paper(ctx, P.path(d.pts), CLUMP[d.c], { edge: F.tier.edge ? 0.8 * hs : 0, edgeMix: 0.38 });
    else P.paper(ctx, p, col, { rule: kind === "ring" ? "evenodd" : "nonzero", edge: F.tier.edge ? 0.8 * hs : 0, edgeMix: 0.38 });
    // a pale cut core: the germs' spots, the blobs' and the big germ's middles (it grows as a blob's shot comes)
    if (kind === "germ" || kind === "cell") {
      const q = new Path2D();
      P.path(P.circle(x - r * 0.28, y - r * 0.2, r * 0.2, { n: 8, seed: 88 }), true, q);
      P.path(P.circle(x + r * 0.25, y + r * 0.22, r * 0.14, { n: 8, seed: 89 }), true, q);
      ctx.fillStyle = P.mix(col, P.CREAM, 0.45); ctx.fill(q);
    } else if (kind === "blob" || kind === "drop" || kind === "boss" || kind === "ring" || f.charge > 0) {
      // the core swells and pales as a shot winds up (f.charge), so you see it coming
      const ch = clamp01(f.charge), base = kind === "boss" ? 0.45 : kind === "ring" ? 0.3 : 0.36;
      const core = P.path(P.circle(x, y, r * base * (1 + 0.45 * ch), { step: 3, seed: 90, scallops: kind === "boss" ? 7 : 0, depth: r * 0.04 }));
      // a boss's core takes its phase's colour (as its HUD bar does): teal, then violet, then rose (never red)
      const bc = kind !== "boss" ? null : (f.phase | 0) >= 2 ? "#e2a6bd" : (f.phase | 0) === 1 ? "#b9abe2" : tone(F, "bossCore");
      ctx.fillStyle = P.mix(bc || P.mix(col, P.CREAM, 0.5), "#ffffff", 0.7 * ch);
      if (kind !== "ring" || ch > 0) ctx.fill(core);
    }
    // a hit flash brightens that foe only; a boss under steady fire only a little (the flash rule: few big swings)
    if (f.flash > 0.01) { ctx.globalAlpha = Math.min(1, ctx.globalAlpha) * (f.boss ? 0.3 : 0.85) * f.flash; ctx.fillStyle = "#ffffff"; ctx.fill(p, kind === "ring" ? "evenodd" : "nonzero"); }
    ctx.restore();
    // the big germ's hp: a cut cream arc round it, shrinking
    if (f.boss && born >= 1) {
      const hp = clamp01(f.hp), R = r + 4.5 * hs;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 5 * hs; ctx.strokeStyle = P.INK; ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * 0.999); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 3 * hs; ctx.strokeStyle = tone(F, "core");
      ctx.beginPath(); ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.001, hp)); ctx.stroke();
      ctx.restore();
    }
  }
}

// ---- bursts: paper flecks flying out from a clear (the foe's colour), a hit (cream) or a pickup (food)

export function drawBursts(F) {
  const a = act(F);
  if (!a || !Array.isArray(a.bursts) || !a.bursts.length) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs;
  const paths = [new Path2D(), new Path2D(), new Path2D()], alpha = [0, 0, 0];
  for (const q of a.bursts) {
    if (!q || !fin(q.x) || !fin(q.y)) continue;
    const kd = Math.max(0, Math.min(2, q.kind | 0)), u = clamp01(q.age), x = F.X(q.x, q.y), y = F.Y(q.x, q.y);
    const R = Math.max(3 * hs, q.r * k) * (0.8 + 1.8 * Math.sqrt(u)), s = Math.max(1, (1.6 + 0.25 * q.r * k / hs) * hs * (1 - u * 0.7));
    const n = kd === 1 ? 9 : 7, rot = fin(q.rot) ? q.rot : 0;
    for (let j = 0; j < n; j++) {
      const t = rot + (j / n) * TAU, px = x + Math.cos(t) * R, py = y + Math.sin(t) * R;
      // a small cut triangle, turned along its flight
      paths[kd].moveTo(px + Math.cos(t) * s, py + Math.sin(t) * s);
      paths[kd].lineTo(px + Math.cos(t + 2.3) * s * 0.8, py + Math.sin(t + 2.3) * s * 0.8);
      paths[kd].lineTo(px + Math.cos(t - 2.3) * s * 0.8, py + Math.sin(t - 2.3) * s * 0.8);
      paths[kd].closePath();
    }
    alpha[kd] = Math.max(alpha[kd], 1 - u);
  }
  const cols = [tone(F, "foe"), tone(F, "core"), tone(F, "food")];
  for (let kd = 0; kd < 3; kd++) {
    if (!(alpha[kd] > 0)) continue;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, 0.3 + alpha[kd]);
    ctx.fillStyle = P.INK; ctx.globalAlpha *= 0.35; ctx.translate(0.6 * hs, 1.2 * hs); ctx.fill(paths[kd]);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= Math.min(1, 0.3 + alpha[kd]);
    ctx.fillStyle = cols[kd]; ctx.fill(paths[kd]);
    ctx.restore();
  }
}

// ---- bullets: batched by tone

export function drawBullets(F) {
  const a = act(F), b = a && a.bullets;
  if (!b || !(b.n > 0)) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs, W = F.v.W, H = F.v.H, low = F.tier.shadowStrokes === 0;
  const body = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const rim = [null, new Path2D(), new Path2D(), new Path2D()];
  const core = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const shadow = new Path2D();
  const used = [false, false, false, false];
  const nPts = low ? 6 : 9;
  const key = Math.max(0.9, 1.1 * hs);
  const disc = (into, x, y, r) => {
    into.moveTo(x + r, y);
    for (let j = 1; j < nPts; j++) { const t = (j / nPts) * TAU; into.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); }
    into.closePath();
  };
  // a capsule from (ax, ay) to (bx, by) of radius r: half a disc at each end
  const streak = (into, ax, ay, bx, by, r) => {
    const a = Math.atan2(by - ay, bx - ax);
    into.moveTo(bx + Math.cos(a - Math.PI / 2) * r, by + Math.sin(a - Math.PI / 2) * r);
    for (let j = 1; j <= 4; j++) { const t = a - Math.PI / 2 + (j / 4) * Math.PI; into.lineTo(bx + Math.cos(t) * r, by + Math.sin(t) * r); }
    for (let j = 0; j <= 4; j++) { const t = a + Math.PI / 2 + (j / 4) * Math.PI; into.lineTo(ax + Math.cos(t) * r, ay + Math.sin(t) * r); }
    into.closePath();
  };
  for (let i = 0; i < b.n; i++) {
    const wx = b.xy[2 * i], wy = b.xy[2 * i + 1];
    const x = F.X(wx, wy), y = F.Y(wx, wy);
    if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
    const tn = b.tone[i] & 3, r = Math.max(1.4 * hs, b.r[i] * k);
    used[tn] = true;
    if (tn === 0) {
      // your sparks: short streaks along their flight (a capsule of 3 r), a white core
      const sa = b.ang ? F.v.cam.screenAngle(b.ang[i]) : 0, c = Math.cos(sa), s = Math.sin(sa), L = b.ang ? r * 1.7 : 0;
      if (a.ys) {
        // stage 7's antibodies (design.md 5.7): small paper Ys, the stem behind, the arms open ahead
        const fx = x + c * L * 0.15, fy = y + s * L * 0.15, w = r * 0.42;
        streak(body[0], x - c * L, y - s * L, fx, fy, w);
        for (const q of [0.6, -0.6]) {
          const qc = Math.cos(q), qs = Math.sin(q), ac = c * qc - s * qs, as = s * qc + c * qs;
          streak(body[0], fx, fy, fx + ac * L * 0.95, fy + as * L * 0.95, w);
        }
        continue;
      }
      streak(body[0], x - c * L, y - s * L, x + c * L * 0.4, y + s * L * 0.4, r * 0.72);
      disc(core[0], x + c * L * 0.25, y + s * L * 0.25, r * 0.36);
      continue;
    }
    disc(rim[tn], x, y, r + key);
    disc(body[tn], x, y, r);
    disc(core[tn], x, y, r * 0.46);
    if (!low) disc(shadow, x, y, r + key);
  }
  // your sparks first (under the foes' bullets), a little see-through
  if (used[0]) {
    ctx.save();
    ctx.globalAlpha *= 0.9;
    ctx.lineJoin = "round"; ctx.lineWidth = 1.4 * hs; ctx.strokeStyle = P.mix(tone(F, "mine"), P.INK, a.ys ? 0.8 : 0.45); ctx.stroke(body[0]);
    ctx.fillStyle = tone(F, "mine"); ctx.fill(body[0]);
    ctx.fillStyle = "#ffffff"; ctx.fill(core[0]);
    ctx.restore();
  }
  if (!low && (used[1] || used[2] || used[3])) {
    const off = P.shadowOffset(3 * hs);
    ctx.save(); ctx.translate(off.x, off.y); ctx.globalAlpha *= 0.3; ctx.fillStyle = P.INK; ctx.fill(shadow); ctx.restore();
  }
  const cols = [null, tone(F, "b1"), tone(F, "b2"), tone(F, "b3")], cream = tone(F, "core");
  for (let tn = 1; tn < 4; tn++) {
    if (!used[tn]) continue;
    ctx.fillStyle = P.INK; ctx.fill(rim[tn]);
    ctx.fillStyle = cols[tn]; ctx.fill(body[tn]);
    ctx.fillStyle = cream; ctx.fill(core[tn]);
  }
}

// ---- you: the hitbox marker (on top of everything but the frames), the i-frame ring, the dash trail

export function drawPlayer(F) {
  const a = act(F), p = a && a.player;
  if (!p || !fin(p.x) || !fin(p.y)) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs;
  const x = F.X(p.x, p.y), y = F.Y(p.x, p.y);
  const r = Math.max(2.4 * hs, p.r * k);
  ctx.save();
  if (p.dash > 0) {
    // the dash: three fading cream discs behind you
    const sa = F.v.cam.screenAngle(fin(p.ang) ? p.ang : 0);
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.35 * p.dash * (1 - i / 4);
      ctx.fillStyle = tone(F, "core");
      ctx.fill(P.path(P.circle(x - Math.cos(sa) * i * 3.2 * r, y - Math.sin(sa) * i * 3.2 * r, Math.max(1, (p.body || 3) * k * (1 - i * 0.18)), { step: 5, seed: 91 })));
    }
    ctx.globalAlpha = 1;
  }
  if (p.inv > 0) {
    // i-frames: a soft cream ring round your body that blinks
    const on = Math.cos(F.t * 28) > -0.2;
    if (on) {
      ctx.globalAlpha = 0.5 * Math.min(1, p.inv * 2);
      ctx.lineWidth = 2 * hs; ctx.strokeStyle = tone(F, "core");
      ctx.stroke(P.path(P.circle(x, y, (p.body || 3) * k * 1.5, { step: 5, amp: 0, jitter: 0 })));
      ctx.globalAlpha = 1;
    }
  }
  // the hitbox: a cream bead on an ink keyline; a thin arc fills while the dash comes back
  const bead = P.path(P.circle(x, y, r, { n: 12, amp: 0.1, jitter: 0.05, seed: 92 }));
  P.sticker(ctx, bead, 0, { kl: 1.6 * hs });
  ctx.fillStyle = "#ffffff";
  ctx.fill(bead);
  const ready = clamp01(p.ready);
  if (ready < 1) {
    ctx.lineWidth = 1.6 * hs; ctx.strokeStyle = P.INK; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(x, y, r + 3 * hs, -Math.PI / 2, -Math.PI / 2 + TAU * ready); ctx.stroke();
  }
  ctx.restore();
  F.stickers.push({ x, y, r: r + 4 });
}

// ---- gift bubbles (stages 3 and 7, design.md 4.6): a cream paper disc on an ink keyline with a cut ink icon; its
// one-word name is a DOM tag (a pop with a word). `on` (0..1) fills an ink arc round it: the bubble that picks itself.
// `lv` small dots under the icon: the levels you already have of it. Icons by name; an unknown name is a star.
const ICON = {
  quick: () => [[[-0.45, 0.05], [0, -0.4], [0.45, 0.05]], [[-0.45, 0.45], [0, 0], [0.45, 0.45]]],
  spread: () => [[[0, 0.5], [0, -0.45]], [[0, 0.5], [-0.42, -0.3]], [[0, 0.5], [0.42, -0.3]]],
  bounce: () => [[[-0.55, -0.35], [-0.2, 0.35], [0.15, -0.35], [0.5, 0.35]]],
  dash: () => [[[-0.5, 0], [0.45, 0]], [[0.15, -0.3], [0.45, 0], [0.15, 0.3]], [[-0.5, -0.32], [-0.1, -0.32]], [[-0.5, 0.32], [-0.1, 0.32]]],
  magnet: () => {
    const u = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (i / 8); u.push([-0.4 * Math.cos(a), 0.05 + 0.4 * Math.sin(a)]); }
    return [[[-0.4, -0.45], ...u.slice(0, 1)], u, [[0.4, 0.05], [0.4, -0.45]]];
  },
};
const ICON_FILL = {
  sticky: () => { const o = [0, -0.58]; for (let i = 0; i <= 12; i++) { const a = -Math.PI / 6 + (i / 12) * (4 * Math.PI / 3); o.push(0.36 * Math.cos(a), 0.14 + 0.36 * Math.sin(a)); } return o; },
  chain: () => { const o = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, rr = i % 2 ? 0.2 : 0.55; o.push(Math.cos(a) * rr, Math.sin(a) * rr); } return o; },
  star: () => { const o = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? 0.22 : 0.52; o.push(Math.cos(a) * rr, Math.sin(a) * rr); } return o; },
};

export function drawGifts(F) {
  const a = act(F);
  if (!a || !Array.isArray(a.gifts) || !a.gifts.length) return;
  const ctx = F.ctx, k = F.k, hs = F.v.hs, ink = P.INK, cream = tone(F, "core");
  for (const g of a.gifts) {
    if (!g || !fin(g.x) || !fin(g.y)) continue;
    const x = F.X(g.x, g.y), y = F.Y(g.x, g.y), al = g.a === undefined ? 1 : clamp01(g.a);
    const rr = Math.max(9 * hs, (fin(g.r) ? g.r : 5) * k);
    ctx.save();
    ctx.globalAlpha *= 0.3 + 0.7 * al;
    const disc = P.path(P.circle(x, y, rr, { step: 4, seed: 95, amp: 0.4, jitter: 0.1 }));
    P.shadowCheap(ctx, disc, 3 * hs, { alpha: 0.3, strokes: F.tier.shadowStrokes });
    P.sticker(ctx, disc, 0, { kl: 1.6 * hs });
    P.paper(ctx, disc, cream, { edge: F.tier.edge ? 0.8 * hs : 0, edgeMix: 0.5 });
    // a bubble's shine: a short cut arc at its upper left
    ctx.lineCap = "round";
    ctx.lineWidth = 1.6 * hs; ctx.strokeStyle = "#ffffff"; ctx.globalAlpha = Math.min(1, ctx.globalAlpha) * 0.8;
    ctx.beginPath(); ctx.arc(x, y, rr * 0.72, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.globalAlpha = 0.3 + 0.7 * al;
    // the icon, in ink
    const s = rr * 0.8, id = typeof g.icon === "string" ? g.icon : "";
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.8 * hs, rr * 0.16);
    if (ICON[id]) {
      for (const line of ICON[id]()) {
        ctx.beginPath();
        line.forEach(([u, v], i) => (i ? ctx.lineTo(x + u * s, y + v * s) : ctx.moveTo(x + u * s, y + v * s)));
        ctx.stroke();
      }
    } else if (id === "shell") {
      ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, s * 0.12, 0, TAU); ctx.fill();
    } else if (id === "orbit") {
      ctx.lineWidth = Math.max(1, rr * 0.07);
      ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.stroke();
      for (const [u, v, q] of [[0, 0, 0.2], [0.5, 0, 0.13], [-0.5, 0, 0.13]]) { ctx.beginPath(); ctx.arc(x + u * s, y + v * s, s * q, 0, TAU); ctx.fill(); }
    } else {
      const pts = (ICON_FILL[id] || ICON_FILL.star)();
      const q = [];
      for (let i = 0; i < pts.length; i += 2) q.push(x + pts[i] * s, y + pts[i + 1] * s);
      ctx.fill(P.path(q));
    }
    // the levels you have of it: small ink dots under the icon
    const lv = Math.max(0, Math.min(4, fin(g.lv) ? g.lv | 0 : 0));
    for (let i = 0; i < lv; i++) { ctx.beginPath(); ctx.arc(x + (i - (lv - 1) / 2) * rr * 0.28, y + rr * 0.68, Math.max(1, rr * 0.07), 0, TAU); ctx.fill(); }
    // the one that picks itself: an ink arc filling round it
    const on = clamp01(g.on);
    if (on > 0.01) {
      ctx.lineWidth = 2.2 * hs; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(x, y, rr + 4 * hs, -Math.PI / 2, -Math.PI / 2 + TAU * on); ctx.stroke();
    }
    ctx.restore();
    F.stickers.push({ x, y, r: rr + 4 });
  }
}

// The hit flash: one translucent sheet of the stage's tint over the frame (one rise, never a strobe).
export function drawFlash(F, tintHex) {
  const a = act(F);
  if (!a || !(a.flash > 0.01)) return;
  const ctx = F.ctx;
  ctx.save();
  ctx.setTransform(F.v.dpx, 0, 0, F.v.dpx, 0, 0);
  ctx.globalAlpha = 0.2 * clamp01(a.flash);
  ctx.fillStyle = tintHex || "#ff8a7a";
  ctx.fillRect(0, 0, F.v.W, F.v.H);
  ctx.restore();
}
