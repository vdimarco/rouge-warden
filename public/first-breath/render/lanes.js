// First Breath: stage 6's note highway in cut paper (core/draw.js strip "lanes"; openspec change
// first-breath-action-genres, design.md 5.6 and 4.8). Three lanes fan from the warm patch on the wall down to your
// ring: each lane is a raised honey sheet with a hand-cut edge and cut cream dashes down its middle that slide one
// gap a beat on her heartbeat (beat lines). At the hit line each lane has a ghost ring of cut dashes that fills as a
// note comes; your lane's ring is a solid cream sticker (the gold DOM ring of her heartbeat sits on it). Notes are
// stickers (a 2 px ink keyline, a cream margin, then the note): gold voice discs for her hummed notes, gold with a
// cream heart for the sing-along, a cream disc with a rose core for her heartbeat, and the jump note a wide gold band
// across all three lanes with cut cream dashes. A missed note rides on past the line as a dotted ring and fades. In
// the fever the lanes warm toward gold and the sing-along notes sit in a paper glow. No text; no flashes (the fever
// eases in over 0.4 s in core).
//
// Sources: the note highway after Guitar Hero (Harmonix, 2005: lanes in perspective, gems that slide to a strikeline,
// beat lines that scroll with the song, a streak that lights star power) and osu!mania (receptors at the foot of each
// lane); the paper look is the renderer's own (render/paper.js cuts, stickers and cheap shadows, v1 14.1, 14.2).
import * as P from "./paper.js";
import { SHARED, roleHex } from "./palette.js";
import { paperGlow } from "./items.js";

const TAU = Math.PI * 2;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));
const num = (v, d) => (fin(v) ? v : d);
const lerp = (a, b, p) => a + (b - a) * p;

// the stage's paper, from its palette tokens (render/palette.js `answer`)
function tones(F, fever) {
  const h = (t) => roleHex(F.stage, t) || SHARED.glow;
  // the fever warms the lanes toward gold (a slow swell in core, never a flash)
  const lane = P.mix(P.mix(h("fluid"), h("dapple"), 0.5), "#ffd86a", 0.55 * fever);
  return {
    lane,
    dash: h("answerGhosts"),
    ghost: h("answerGhosts"),
    voice: P.mix(h("voiceRipples"), "#ffc53d", 0.35),
    sing: P.mix(h("voiceRipples"), "#ffc53d", 0.5),
    heart: P.mix(h("frame3"), h("you"), 0.45),
    cream: h("answerGhosts"),
    glow: h("warmPatch"),
    well: P.mix(h("frame3"), h("fluid"), 0.45),
  };
}

// The lane sheets, their dashes and the slots (under the bodies: you sit in your ring on the line).
export function drawLanes(F, st) {
  if (!st || !fin(st.y0) || !fin(st.y1)) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k, ga = ctx.globalAlpha;
  const y0 = st.y0, y1 = st.y1, g0 = num(st.gap0, 9), g1 = num(st.gap1, 22), w0 = num(st.w0, 6), w1 = num(st.w1, 13);
  const tail = Math.max(1, num(st.tail, 1.25));
  const fever = clamp01(st.fever);
  const T = tones(F, fever);
  const lx = (j, u) => (j - 1) * lerp(g0, g1, u);
  const ly = (u) => lerp(y0, y1, u);
  const lw = (u) => lerp(w0, w1, u);
  const alpha = Array.isArray(st.a) ? st.a.map(clamp01) : [1, 1, 1];
  const scr = (x, y) => [F.X(x, y), F.Y(x, y)];

  // 1. the three lane sheets, each a cut quad from the wall to just past the line
  for (let j = 0; j < 3; j++) {
    const a = alpha[j];
    if (!(a > 0.02)) continue;
    const L = [], R = [];
    for (const u of [0, 0.5, 1, tail, tail + 0.3]) {
      const x = lx(j, u), y = ly(u), w = lw(u) / 2;
      L.push(...scr(x - w, y));
      R.push(...scr(x + w, y));
    }
    const pts = P.cut(L, false, { step: 8, amp: 0.7 * hs, seed: 61 + j }).concat(P.rev2(P.cut(R, false, { step: 8, amp: 0.7 * hs, seed: 64 + j })));
    const p = P.path(pts);
    ctx.globalAlpha = ga * a * 0.85;
    P.shadowCheap(ctx, p, 1.4 * hs, { alpha: 0.22, strokes: F.tier.shadowStrokes ? 1 : 0 });
    P.paper(ctx, p, T.lane, { edge: F.tier.edge ? 0.7 * hs : 0, edgeMix: 0.35 });
    // 2. cut cream dashes down the middle, one gap a beat, sliding toward you on her heartbeat
    const ph = clamp01(st.beat), dash = new Path2D();
    for (let q = 0; q < 5; q++) {
      const u = (q + ph) * 0.25;
      if (u > 1.0001) continue;
      const ua = Math.max(0, u - 0.035), ub = Math.min(1, u + 0.035);
      const xa = lx(j, ua), xb = lx(j, ub), wa = lw(ua) * 0.08, wb = lw(ub) * 0.08;
      P.path([...scr(xa - wa, ly(ua)), ...scr(xa + wa, ly(ua)), ...scr(xb + wb, ly(ub)), ...scr(xb - wb, ly(ub))], true, dash);
    }
    ctx.globalAlpha = ga * a * (0.55 + 0.3 * fever);
    ctx.fillStyle = T.dash;
    ctx.fill(dash);
  }
  ctx.globalAlpha = ga;

  // 3. the slots at the line: a ghost ring of cut dashes, filling as a note comes; your lane's a solid cream ring
  const you = Math.max(0, Math.min(2, num(st.you, 1)));
  const youJ = Math.round(you);
  for (let j = 0; j < 3; j++) {
    const a = alpha[j];
    if (!(a > 0.02)) continue;
    const s = clamp01(Array.isArray(st.slots) ? st.slots[j] : 0);
    const [x, y] = scr(lx(j, 1), y1);
    const R = num(st.ring, lw(1) * 0.52) * k, th = Math.max(2, 1.1 * hs + 0.06 * R);
    const ring = new Path2D();
    const n = 14;
    for (let i = 0; i < n; i++) {
      const b0 = (i / n) * TAU, b1 = b0 + (TAU / n) * (0.5 + 0.35 * s), q = [];
      for (let m = 0; m <= 3; m++) { const b = b0 + ((b1 - b0) * m) / 3; q.push(x + Math.cos(b) * (R + th / 2), y + Math.sin(b) * (R + th / 2)); }
      for (let m = 3; m >= 0; m--) { const b = b0 + ((b1 - b0) * m) / 3; q.push(x + Math.cos(b) * (R - th / 2), y + Math.sin(b) * (R - th / 2)); }
      P.path(q, true, ring);
    }
    ctx.globalAlpha = ga * a * (0.45 + 0.55 * s);
    ctx.lineJoin = "round"; ctx.strokeStyle = SHARED.ink; ctx.lineWidth = 2; ctx.stroke(ring);
    ctx.fillStyle = T.ghost; ctx.fill(ring);
  }
  ctx.globalAlpha = ga;
  {
    const [x, y] = scr(lx(you, 1), y1);
    const R = num(st.ring, lw(1) * 0.52) * k * 0.92, th = Math.max(3, 2.2 * hs);
    const p = new Path2D();
    P.path(P.circle(x, y, R + th / 2, { n: 28, amp: 0.2, jitter: 0.08, seed: 66 }), true, p);
    P.path(P.circle(x, y, Math.max(1, R - th / 2), { n: 28, amp: 0.2, jitter: 0.08, seed: 67 }), true, p);
    ctx.globalAlpha = ga * Math.max(alpha[youJ], 0.0);
    if (ctx.globalAlpha > 0.02) {
      // a soft warm well inside your ring, so the pale figure in it reads
      ctx.save(); ctx.globalAlpha *= 0.55; ctx.fillStyle = T.well;
      ctx.fill(P.path(P.circle(x, y, Math.max(1, R - th / 2), { n: 24, amp: 0.2, jitter: 0.08, seed: 65 })));
      ctx.restore();
      P.shadowCheap(ctx, p, 2 * hs, { alpha: 0.3, rule: "evenodd", strokes: 0 });
      ctx.lineJoin = "round"; ctx.strokeStyle = SHARED.ink; ctx.lineWidth = 2; ctx.stroke(p);
      ctx.fillStyle = T.cream; ctx.fill(p, "evenodd");
    }
    ctx.globalAlpha = ga;
  }
}

// The notes, far ones first (over the bodies, so a note lands on you).
export function drawLaneNotes(F, st) {
  if (!st || !fin(st.y0) || !fin(st.y1)) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k, ga = ctx.globalAlpha;
  const y0 = st.y0, y1 = st.y1, g0 = num(st.gap0, 9), g1 = num(st.gap1, 22), w0 = num(st.w0, 6), w1 = num(st.w1, 13);
  const T = tones(F, clamp01(st.fever));
  const lx = (j, u) => (j - 1) * lerp(g0, g1, u);
  const ly = (u) => lerp(y0, y1, u);
  const lw = (u) => lerp(w0, w1, u);
  const scr = (x, y) => [F.X(x, y), F.Y(x, y)];
  const notes = (Array.isArray(st.notes) ? st.notes : []).slice().sort((a, b) => num(a.u, 0) - num(b.u, 0));
  for (const q of notes) {
    const u = num(q.u, 0), a = clamp01(q.a);
    if (!(a > 0.02)) continue;
    const y = ly(u);
    ctx.globalAlpha = ga * a;
    if (q.lane < 0) {
      // the jump note: a wide gold band across all three lanes, with cut cream dashes along it
      const xa = lx(0, u) - lw(u) / 2, xb = lx(2, u) + lw(u) / 2, rr = Math.max(1.5, num(q.r, 3) * 0.8);
      const [ax, ay] = scr(xa + rr, y), [bx, by] = scr(xb - rr, y);
      const p = P.path(P.capsule(ax, ay, bx, by, rr * k, rr * k, { seed: 68 }));
      if (q.state === 1) {
        ctx.setLineDash && ctx.setLineDash([1.5 * hs, 4 * hs]);
        ctx.lineWidth = 2; ctx.strokeStyle = T.cream; ctx.stroke(p);
        ctx.setLineDash && ctx.setLineDash([]);
        continue;
      }
      P.shadowCheap(ctx, p, 3 * hs, { alpha: 0.32, strokes: F.tier.shadowStrokes });
      P.sticker(ctx, p, 1.4 * hs, { kl: 2 });
      P.paper(ctx, p, T.sing, { edge: 0.6 * hs, edgeMix: 0.3 });
      const dashes = new Path2D(), n = 7;
      for (let i = 0; i < n; i++) {
        const f0 = (i + 0.25) / n, f1 = (i + 0.7) / n;
        const x0 = ax + (bx - ax) * f0, x1 = ax + (bx - ax) * f1, y0p = ay + (by - ay) * f0, y1p = ay + (by - ay) * f1, h = rr * k * 0.28;
        P.path([x0, y0p - h, x1, y1p - h, x1, y1p + h, x0, y0p + h], true, dashes);
      }
      ctx.fillStyle = T.cream; ctx.fill(dashes);
      F.stickers.push({ x: (ax + bx) / 2, y: (ay + by) / 2, r: Math.abs(bx - ax) / 2 + rr * k });
      continue;
    }
    const [x, yy] = scr(lx(q.lane, u), y);
    const R = Math.max(2.5, num(q.r, 4) * k);
    const p = P.path(P.circle(x, yy, R, { n: 18, amp: 0.25, jitter: 0.1, seed: 69 + (q.kind | 0) }));
    if (q.state === 1) {
      // missed: a dotted ring riding on past the line
      const dots = new Path2D(), n = 10;
      for (let i = 0; i < n; i++) { const b = (i / n) * TAU; P.path(P.circle(x + Math.cos(b) * R, yy + Math.sin(b) * R, Math.max(0.9, 1.1 * hs), { n: 7, amp: 0, jitter: 0 }), true, dots); }
      ctx.fillStyle = T.cream; ctx.fill(dots);
      continue;
    }
    const hot = clamp01(q.hot);
    if (hot > 0.02) { paperGlow(F, x, yy, R * 2.4, hot * 0.8, T.glow); ctx.globalAlpha = ga * a; }
    P.shadowCheap(ctx, p, 2.6 * hs, { alpha: 0.32, strokes: F.tier.shadowStrokes });
    const kind = q.kind | 0;
    P.sticker(ctx, p, kind === 0 ? 0 : 1.2 * hs, { kl: 2 });
    P.paper(ctx, p, kind === 0 ? T.cream : kind === 3 ? T.sing : T.voice, { edge: 0.5 * hs, edgeMix: 0.3 });
    if (kind === 0) {
      // her heartbeat: a rose core
      ctx.fillStyle = T.heart;
      ctx.fill(P.path(P.circle(x, yy, R * 0.48, { n: 12, amp: 0.1, jitter: 0.05, seed: 70 })));
    } else if (kind === 3) {
      // the sing-along: a small cream heart cut into the gold (two lobes and a point)
      const hr = R * 0.24, heart = new Path2D();
      P.path(P.circle(x - hr * 0.75, yy - hr * 0.3, hr, { n: 10, amp: 0, jitter: 0 }), true, heart);
      P.path(P.circle(x + hr * 0.75, yy - hr * 0.3, hr, { n: 10, amp: 0, jitter: 0 }), true, heart);
      P.path([x - hr * 1.65, yy - hr * 0.05, x + hr * 1.65, yy - hr * 0.05, x, yy + hr * 1.7], true, heart);
      ctx.fillStyle = T.cream; ctx.fill(heart);
    } else {
      // her hummed note: a cream glint
      ctx.fillStyle = T.cream;
      ctx.fill(P.path(P.circle(x - R * 0.28, yy - R * 0.3, R * 0.22, { n: 8, amp: 0, jitter: 0 })));
    }
    F.stickers.push({ x, y: yy, r: R + 4 });
  }
  ctx.globalAlpha = ga;
  drawMeter(F, st, T, lx, y1);
}

// The streak meter: `of` pips in an arc under your ring, one filled (gold, keylined) per In time note in a row; once
// the fever is lit (`lit` eases in) they all glow and swell a little on her beat. Empty pips are cream dotted rings.
// Shape code: filled discs against hollow rings, never hue alone.
function drawMeter(F, st, T, lx, y1) {
  const m = st.meter;
  if (!m || !fin(m.of) || m.of < 1) return;
  const a = clamp01(num(m.a, 1));
  if (!(a > 0.02)) return;
  const ctx = F.ctx, hs = F.v.hs, k = F.k, ga = ctx.globalAlpha;
  const of = Math.min(16, Math.round(m.of)), n = Math.max(0, Math.min(of, Math.round(num(m.n, 0))));
  const lit = clamp01(m.lit), beat = clamp01(st.beat);
  const you = Math.max(0, Math.min(2, num(st.you, 1)));
  const cx = F.X(lx(you, 1), y1), cy = F.Y(lx(you, 1), y1);
  const R = (num(st.ring, 9.5) + 2.6) * k;
  const r0 = Math.max(2.2, 0.95 * k);
  for (let i = 0; i < of; i++) {
    // from lower left to lower right, under the ring (screen y grows down)
    const b = Math.PI * (0.84 - (0.68 * i) / Math.max(1, of - 1));
    const x = cx + Math.cos(b) * R, y = cy + Math.sin(b) * R;
    const on = i < n;
    const r = r0 * (on ? 1 + 0.25 * lit * (1 - beat) : 0.8);
    const p = P.path(P.circle(x, y, r, { n: 10, amp: 0.1, jitter: 0.05, seed: 72 + i }));
    ctx.globalAlpha = ga * a;
    if (on) {
      if (lit > 0.02) { paperGlow(F, x, y, r * 2.6, 0.55 * lit, T.glow); ctx.globalAlpha = ga * a; }
      ctx.lineJoin = "round"; ctx.strokeStyle = SHARED.ink; ctx.lineWidth = 2; ctx.stroke(p);
      P.paper(ctx, p, lit > 0.5 ? T.sing : T.voice, { edge: 0, edgeMix: 0 });
    } else {
      // an empty pip: a pale cream hole with a dotted ink rim
      ctx.globalAlpha = ga * a * 0.5; ctx.fillStyle = T.cream; ctx.fill(p);
      ctx.globalAlpha = ga * a * 0.7;
      ctx.lineWidth = Math.max(1.2, 0.45 * hs); ctx.strokeStyle = SHARED.ink;
      ctx.setLineDash && ctx.setLineDash([1.2 * hs, 1.4 * hs]);
      ctx.stroke(p);
      ctx.setLineDash && ctx.setLineDash([]);
    }
  }
  ctx.globalAlpha = ga;
}
