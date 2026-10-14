// Ahead of the Light: the pieces every leg can use (final.md 11.5): swarm, open-road, breather, highway, sheets,
// hub-hop, rumble, fuel-run, easy-knots. Each is data plus a builder in its own frame: beats from its start, bearings
// from its entry line, + to the right. gen.js places, mirrors and validates them. Pure: integer RNG and + − × ÷ only.
import { piece, knot, pair, wall, rail, well, fuel, patch, cue, jit, int, coin } from '../kinds.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- swarm (crescendo) ----------
// Lab A's swarm generalised: knots on eighth-note slots along a drifting line. Most sit 9 to 23° to one side of the
// line (ride the line to graze some, weave to graze them all); about one in eight sits on it, so you must hop. A slot
// fills with chance 0.92 × density (lab A's rests at density 1.0); a run of 8 slots keeps one rest below density 1.3,
// so at most 5 knots pass inside the ring at once. Every 10 beats a FORK: a wall with two 46° gaps either side of the
// line, one with a fuel slot a hairline inside its far edge (one line choice: the safe gap or the rich one). Every
// 8 beats one side knot carries a fuel slot a hairline inside it. ctx.opts.well puts a small well with its bands in
// the middle (Virgo's swarm).
function swarmBuild(ctx) {
  const { rnd, len, density = 1 } = ctx;
  const items = [];
  const fill = clamp(0.92 * density, 0.35, 1);
  let line = 0, vel = 0, side = coin(rnd), lastFuel = -8, empties = 0;
  const slots = Math.max(0, Math.floor((len - 1) * 2));
  let wellAt = -1;
  if (ctx.opts && ctx.opts.well && len >= 20) wellAt = Math.floor(len / 2) - 4;
  const forks = [];
  if (len >= 16) for (let b = 8; b <= len - 4; b += 10) if (wellAt < 0 || Math.abs(b - wellAt - 5) > 8) forks.push(b);
  for (let i = 0; i < slots; i++) {
    const beat = 1 + i / 2;
    if (i % 8 === 0) vel = jit(rnd, 9);
    line += vel;
    if (wellAt >= 0 && beat >= wellAt && beat < wellAt + 10) {
      if (beat === wellAt) {
        const hop = hubHop(rnd, line, 'small', { off: int(rnd, 40, 60), bandA: int(rnd, 100, 140), bandB: 200 },
          false);
        for (const it of hop.items) items.push({ ...it, beat: it.beat + wellAt });
      }
      continue;
    }
    const fork = forks.find((b) => Math.abs(beat - b) <= 1);
    if (fork !== undefined) {
      empties = 0;
      if (beat === fork) {
        const d = 38 + rnd() * 17, rich = coin(rnd);
        items.push(wall(beat, [{ psi: line - d, w: 46, tag: 'fork' }, { psi: line + d, w: 46, tag: 'fork' }]));
        items.push(fuel(beat, line + rich * (d + 23 - 4.5)));
      }
      continue;
    }
    const r = rnd();
    // never more than three empty slots in a row: the swarm is never empty
    const must = empties >= 3;
    if (!must && i % 8 === 7 && density < 1.3 && r < 0.7) { empties++; continue; }
    if (rnd() > fill && !must) { empties++; continue; }
    empties = 0;
    let off;
    if (r < 0.12) off = jit(rnd, 3);
    else {
      side = rnd() < 0.8 ? -side : side;
      off = side * (9 + rnd() * 14);
    }
    const half = 2 + rnd() * 2;
    const k = knot(beat, line + off, half, { opt: true });
    if (Math.abs(off) >= 14 && beat - lastFuel >= 8 && beat <= len - 2) {
      // a fuel slot a hairline inside the knot, toward the line; its anchor knot stays through a breather
      const s = off > 0 ? 1 : -1;
      items.push(fuel(beat, line + off - s * (half + 4.5)));
      k.opt = false;
      lastFuel = beat;
    }
    items.push(k);
  }
  return { items, exit: line };
}

export const SWARM = piece({
  id: 'swarm', roles: ['crescendo'], beats: 'rest', repeat: true, diff: 2,
  build: swarmBuild,
});

// ---------- hub-hop (build) ----------
// A well off the line; grab it from either side. Band A lies on a 60° wall gap 6 beats later, band B on a short
// fuel line. A ship that does not whip finds the gap the long way. p.off: the well's offset; p.bandA, p.bandB: how
// far round from a grab 25° in from the reach each band sits (sweeping away from the well). The fuel line always
// spawns (a band must point at something) and counts as one of the leg's cells.
function hubHop(rnd, line, size, p, extra = true) {
  const items = [];
  const W = line + p.off;
  const grab = W - 25;                          // a grab from the line's side, sweeping away from the well
  const A = grab - p.bandA, B = grab - p.bandB;
  items.push(well(3, W, size, [A, B], null, { tag: 'hub' }));
  items.push(wall(9, [{ psi: A, w: 60, tag: 'band' }]));
  items.push(fuel(7.5, B, { band: true, must: true, slot: 'band' }), fuel(8, B + 4, { band: true, must: true,
    slot: 'band' }));
  if (extra) {
    items.push(knot(1.5, line - 18, 3, { opt: true }), knot(2, line + 14, 2.5, { opt: true }));
    // the way round to the gap for a ship that does not whip
    items.push(knot(5.5, line + (A - line) * 0.35 + 12, 3, { opt: true }),
      knot(7, line + (A - line) * 0.7 - 12, 3, { opt: true }));
    let s = coin(rnd);
    for (const b of [11, 12.5, 14]) {
      items.push(knot(b, A + s * (16 + rnd() * 10), 2.5 + rnd(), { opt: true }));
      s = -s;
    }
  }
  return { items, exit: A };
}

export const HUB_HOP = piece({
  id: 'hub-hop', roles: ['build', 'opener'], beats: [14, 16], diff: 2,
  params: { off: [40, 70], bandA: [100, 150], bandB: [190, 230] },
  safe: { off: 55, bandA: 120, bandB: 210 },
  build(ctx) {
    const h = hubHop(ctx.rnd, 0, 'medium', ctx.p, true);
    return { items: h.items.filter((it) => it.beat < ctx.len), exit: h.exit };
  },
});

// ---------- easy-knots (opener) ----------
// A seeded zigzag of knots every 2 beats round a drifting line, wide enough that the line itself is clean: steer
// toward each to graze it. One fuel slot a hairline inside the middle knot, and a pair on the line a beat after it
// to thread.
export const EASY_KNOTS = piece({
  id: 'easy-knots', roles: ['opener', 'build'], beats: [8, 16], diff: 1,
  params: { amp: [16, 28], drift: [-3, 3] },
  safe: { amp: 22, drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [];
    const n = Math.min(7, Math.floor((len - 1) / 2));
    let s = coin(rnd);
    const mid = Math.floor(n / 2);
    for (let k = 0; k < n; k++) {
      const b = 1.5 + 2 * k, line = p.drift * b;
      const half = 2.5 + rnd() * 1.5, psi = line + s * (p.amp + jit(rnd, 4));
      items.push(knot(b, psi, half, { opt: k !== mid }));
      if (k === mid) {
        items.push(fuel(b, psi - s * (half + 4.5)));
        items.push(pair(b + 1, p.drift * (b + 1), 14, 2.5, { tag: 'pair' }));
      }
      s = -s;
    }
    return { items, exit: p.drift * len };
  },
});

// ---------- sheets (opener, build) ----------
// Lab A's walls: 60° gaps 3 beats apart swinging 120 to 150° side to side, then a 50° gap with a bait knot a beat
// earlier at the edge you come from. A fuel slot a hairline inside the far edge of the second gap.
export const SHEETS = piece({
  id: 'sheets', roles: ['opener', 'build'], beats: [8, 16], diff: 2,
  params: { first: [55, 95], swing: [110, 140], last: [55, 90] },
  safe: { first: 70, swing: 120, last: 70 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [];
    const sg = coin(rnd);
    let c = sg * p.first, dir = -sg;
    const beats = [];
    for (let b = 1; b <= len - 3.5; b += 3) beats.push(b);
    beats.forEach((b, i) => {
      if (i > 0) { c += dir * (p.swing + jit(rnd, 10)); dir = -dir; }
      items.push(wall(b, [{ psi: c, w: 60 }]));
      if (i === 1) {
        const far = -dir;                         // the far edge from where you came, away from the next swing
        items.push(fuel(b, c + far * (30 - 4.5)));
      }
    });
    const lastB = len - 1.5;
    const next = c + coin(rnd) * p.last;
    const from = Math.sign(c - next) || 1;
    items.push(knot(lastB - 1, next + from * 37, 3, { bait: true }));
    items.push(wall(lastB, [{ psi: next, w: 50 }]));
    return { items, exit: next };
  },
});

// ---------- highway (build) ----------
// Two rails 20° apart whose midline drifts: between them both edges skim (HIGHWAY, double skim). A pair at the mouth
// lets you thread in. A fuel slot a hairline outside one rail, halfway along: ride the highway, or ride outside it
// for the cell.
export const HIGHWAY = piece({
  id: 'highway', roles: ['build', 'opener'], beats: [8, 16], diff: 1,
  params: { drift: [-4, 4] },
  safe: { drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const w = p.drift;
    const items = [
      cue(0.5, 'highway'),
      pair(1, 0, 12, 1.5, { tag: 'mouth' }),
      rail(2, len - 0.5, -10, 1.5, { omega: w, tag: 'highway' }),
      rail(2, len - 0.5, 10, 1.5, { omega: w, tag: 'highway' }),
    ];
    const fb = Math.round(len / 2), s = coin(rnd);
    items.push(fuel(fb, w * (fb - 2) + s * 16));
    // a knot outside each rail to graze on the way past, for a ship that stays out
    items.push(knot(fb - 2, w * (fb - 4) - s * 24, 2.5, { opt: true }));
    return { items, exit: w * (len - 2.5) };
  },
});

// ---------- open-road (open) ----------
// Two rails 60° apart drifting a little: room to draft, pass and slam. At most four knots, each just inside a rail.
export const OPEN_ROAD = piece({
  id: 'open-road', roles: ['open'], beats: [12, 20], repeat: true, diff: 1,
  params: { drift: [-3, 3] },
  safe: { drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const w = p.drift;
    const items = [cue(0.5, 'open'), rail(1, len - 1, -30, 1.5, { omega: w }), rail(1, len - 1, 30, 1.5, { omega: w })];
    let s = coin(rnd);
    const n = Math.min(4, Math.floor((len - 3) / 3));
    for (let k = 0; k < n; k++) {
      const b = 3.5 + 3 * k, at = w * (b - 1);
      items.push(knot(b, at + s * 19, 2.5, { opt: k !== 1 }));
      if (k === 1) items.push(fuel(b, at + s * (19 - 7)));
      s = -s;
    }
    return { items, exit: w * (len - 1) };
  },
});

// ---------- rumble (open, teaching) ----------
// A channel of two rails 40° apart with knots poking in from its walls every 3 beats: a ship slammed into one is a
// takedown. RAM IT INTO THE KNOT the first time.
export const RUMBLE = piece({
  id: 'rumble', roles: ['open'], beats: [14, 20], diff: 2, teach: { runs: 3 },
  params: { drift: [-2, 2] },
  safe: { drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const w = p.drift;
    const items = [cue(0.5, 'ram'), rail(1, len - 1, -20, 1.5, { omega: w, tag: 'channel' }),
      rail(1, len - 1, 20, 1.5, { omega: w, tag: 'channel' })];
    let s = coin(rnd);
    for (let b = 3; b <= len - 2; b += 3) {
      const at = w * (b - 1);
      items.push(knot(b, at + s * 13, 2.5, { tag: 'ram' }));
      if (b === 6) items.push(fuel(b, at + s * (13 - 7)));
      s = -s;
    }
    return { items, exit: w * (len - 1) };
  },
});

// ---------- breather ----------
// At most three outlying knots (one near the line to graze), the landmark cue and the patch slot.
export const BREATHER = piece({
  id: 'breather', roles: ['breather'], beats: [4, 6], repeat: true, diff: 1,
  params: { near: [14, 20] },
  safe: { near: 16 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const s = coin(rnd);
    const items = [cue(0.5, 'landmark', { gate: ctx.gate || null }),
      knot(1.5, s * p.near, 3), patch(1.5, s * (p.near - 7.5), { slot: 'patch' }),
      knot(Math.min(len - 1, 3), -s * (60 + rnd() * 30), 3, { opt: true })];
    if (len >= 5) items.push(knot(len - 0.5, s * (95 + rnd() * 25), 3, { opt: true }));
    return { items, exit: 0 };
  },
});

// ---------- fuel-run (build, the SHIP family's edit) ----------
// A hard knot field round a weaving line, with two fuel cells that always spawn, each a hairline from a knot. The
// SHIP lane also makes the leg's patch always spawn (leg.rules.patchAlways); it stays near 55 % of the leg.
export const FUEL_RUN = piece({
  id: 'fuel-run', roles: ['build'], beats: [12, 16], diff: 3,
  params: { weave: [12, 22] },
  safe: { weave: 16 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'fuelRun')];
    let line = 0, s = coin(rnd);
    for (let b = 1.5; b <= len - 1; b += 1) {
      line += s * p.weave * 0.5;
      // a pair of knots either side of the line, 30 to 34° apart: thread them, hairline them, or go round
      const gap = 30 + rnd() * 4;
      items.push(knot(b, line - gap / 2, 3), knot(b, line + gap / 2, 3));
      if (b === 4.5 || b === len - 3.5) items.push(fuel(b, line + s * (gap / 2 - 7.5), { must: true }));
      if (Math.floor(b) % 3 === 0) s = -s;
    }
    return { items, exit: line };
  },
});

export const PIECES = Object.freeze({
  swarm: SWARM, 'hub-hop': HUB_HOP, 'easy-knots': EASY_KNOTS, sheets: SHEETS, highway: HIGHWAY,
  'open-road': OPEN_ROAD, rumble: RUMBLE, breather: BREATHER, 'fuel-run': FUEL_RUN,
});
export { hubHop };
