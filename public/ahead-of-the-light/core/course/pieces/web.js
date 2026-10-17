// Ahead of the Light: THE WEB's pieces (final.md 11.5): web-first-knots, web-strands, web-junction, web-node,
// web-rail-plan. Leg 1 crosses the Sloan Great Wall's filaments toward Coma. Each builds in its own frame (beats from
// its start, bearings from its entry line, + to the right). Pure: integer RNG and + − × ÷ only.
import { piece, knot, pair, wall, rail, fuel, cue, jit, int, coin } from '../kinds.js';

// ---------- web-first-knots (opener, teaching: a player's first 3 runs) ----------
// Lab A's intro: a knot on your line, then a zigzag and a pair to thread, all inside leg 1's soft graze band. The
// burn lesson: the leg's fuel slot sits a hairline inside the beat-12 knot, and the cue at beat 13 (about 10 s in)
// says THE LIGHT IS GAINING · FLICK UP TO BURN, before the first well.
export const WEB_FIRST_KNOTS = piece({
  id: 'web-first-knots', leg: 'web', roles: ['opener'], beats: [16, 16], fixed: true, diff: 1,
  teach: { runs: 3 },
  build() {
    const soft = { soft: true };
    const items = [
      cue(0, 'steer'),
      knot(0, 0, 3.5, soft), knot(2, 25, 3.5, soft), cue(3, 'skim'), knot(4, -30, 3.5, soft), knot(6, 35, 3.5, soft),
      pair(8, 0, 17, 3.5, soft),
      knot(10, -20, 3.5, soft), knot(12, 18, 3.5, soft), fuel(12, 10, { must: true, slot: 'burn' }),
      cue(13, 'burn'), knot(14, -8, 3.5, soft),
    ];
    return { items, exit: 4 };
  },
});

// ---------- web-strands (opener) ----------
// Loose strands of the filament: short rails left and right of the line in turn, each with a knot just outside it.
// Ride a strand's outside for a skim and a graze, hop to the next, or hold the line and touch nothing. A fuel slot a
// hairline inside the second strand.
export const WEB_STRANDS = piece({
  id: 'web-strands', leg: 'web', roles: ['opener'], beats: [12, 16], diff: 1,
  params: { amp: [13, 18], drift: [-2, 2] },
  safe: { amp: 15, drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'strands')];
    let s = coin(rnd);
    let k = 0;
    for (let b = 1; b + 2 <= len - 0.5; b += 4, k++) {
      const end = Math.min(b + 3, len - 0.5), at = p.drift * b, psi = at + s * p.amp;
      items.push(rail(b, end, psi, 1.5, { omega: p.drift, tag: 'strand' }));
      items.push(knot(b + 1.5, psi + p.drift * 1.5 + s * (13 + rnd() * 3), 3, { opt: true }));
      if (k === 1) items.push(fuel(b + 2, psi + p.drift * 2 - s * 6));
      s = -s;
    }
    return { items, exit: p.drift * len };
  },
});

// ---------- web-junction (build) ----------
// A short highway ends; the next one's mouth lies 90 to 140° round a few beats later, with a preview tick 3 s ahead
// and three knots beside the direct path to graze on the way. Follow the filament, or let it go. In a later leg's
// 14 or 16-beat section the first highway is longer, so the junction fills it (no slack for the crescendo).
export const WEB_JUNCTION = piece({
  id: 'web-junction', leg: 'web', roles: ['build'], beats: [8, 16], diff: 2,
  params: { turn: [90, 140] },
  safe: { turn: 110 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    // longer than 10 beats (a whole section of a later leg), the first highway runs on to 6.5 beats before the end
    const aEnd = len > 10 ? len - 6.5 : len >= 10 ? 3.5 : 2.5, mouth = len - 2.5, T = p.turn;
    const items = [
      cue(0.5, 'junction'),
      rail(1, aEnd, -10, 1.5, { tag: 'highway' }), rail(1, aEnd, 10, 1.5, { tag: 'highway' }),
    ];
    // three knots beside the direct path, alternating sides
    let s = coin(rnd);
    const span = mouth - aEnd;
    for (let k = 1; k <= 3; k++) {
      const f = k / 4;
      items.push(knot(aEnd + span * f, T * f + s * 11, 2.5 + rnd(), { opt: true }));
      s = -s;
    }
    items.push(pair(mouth, T, 12, 1.5, { tag: 'mouth', preview: true }));
    items.push(rail(mouth + 1, len, T - 10, 1.5, { tag: 'highway' }), rail(mouth + 1, len, T + 10, 1.5,
      { tag: 'highway' }));
    items.push(fuel(mouth + 1.5, T + coin(rnd) * 16));
    return { items, exit: T };
  },
});

// ---------- web-node (signature) ----------
// Three filaments converge on a cluster: the outer two turn 6° a beat toward the middle one for 12 beats and end 28°
// either side of it, at a pair (half 5°, gap 22°). Ride any filament and it carries you to the node. The slowest
// drifter meets its hard moment on the outer rail, 70 to 110° round from your line (the drifter cue), so the light's
// catch shows on the burst ring's side arc in every layout. "Clusters sit where filaments meet."
export const WEB_NODE = piece({
  id: 'web-node', leg: 'web', roles: ['signature'], beats: [16, 16], diff: 3,
  params: { mid: [10, 14], turn: [5, 7] },
  safe: { mid: 12, turn: 6 },
  build(ctx) {
    const { p } = ctx;
    const M = p.mid, w = p.turn, run = 12;
    const L0 = M - 28 - w * run, R0 = M + 28 + w * run;
    const items = [
      cue(0.5, 'node'),
      rail(1, 13, L0, 1.5, { omega: w, tag: 'filament' }),
      rail(1, 13, R0, 1.5, { omega: -w, tag: 'filament' }),
      rail(2, 12, M, 1.5, { tag: 'filament' }),
      fuel(7, M - 6),
      cue(6, 'drifter', { psi: R0 - w * 5 }),
      knot(9.5, M - 14, 2.5, { opt: true }), knot(10.5, M + 15, 2.5, { opt: true }),
      pair(14, M, 22, 5, { tag: 'node', name: 'NODE' }),
      cue(14, 'fact', { fact: 'filament' }),
      knot(15.5, M + 22, 3, { opt: true }),
    ];
    return { items, exit: M };
  },
});

// ---------- web-rail-plan (signature) ----------
// Lab A's rail and the wall behind it, as lab A ships it now (the P1-4 fix): a rail 80° round for 3 beats, then at
// beat 6 a wall whose 50° gap lies beyond it, with a preview tick 3 s ahead. Ride the rail's far side (a fuel slot
// waits there), or go the long way round.
export const WEB_RAIL_PLAN = piece({
  id: 'web-rail-plan', leg: 'web', roles: ['signature'], beats: [10, 10], diff: 3,
  params: { rail: [72, 88], gap: [160, 178] },
  safe: { rail: 80, gap: 170 },
  build(ctx) {
    const { rnd, p } = ctx;
    const items = [
      cue(1, 'rail'),
      rail(1, 4, p.rail, 1.5, { tag: 'filament' }),
      fuel(2.5, p.rail + 6),
      cue(6, 'drifter', { psi: p.rail }),
      wall(6, [{ psi: p.gap, w: 50 }], { preview: true, plan: true }),
    ];
    const s = coin(rnd);
    items.push(knot(7.5, p.gap + s * (17 + jit(rnd, 3)), 3, { opt: true }));
    items.push(knot(9, p.gap - s * (19 + jit(rnd, 3)), 3, { opt: true }));
    return { items, exit: p.gap };
  },
});

export const PIECES = Object.freeze({
  'web-first-knots': WEB_FIRST_KNOTS, 'web-strands': WEB_STRANDS, 'web-junction': WEB_JUNCTION,
  'web-node': WEB_NODE, 'web-rail-plan': WEB_RAIL_PLAN,
});
