// Ahead of the Light: VIRGO's pieces (final.md 11.5, design-tech 5.3): virgo-crowd, m87-jet, markarian and the WHALE's
// open road. Leg 3 crosses the Virgo Cluster toward the Local Group. Each builds in its own frame (beats from its
// start, bearings from its entry line, + to the right); gen.js places and mirrors them. Pure: integer RNG and + − × ÷
// only.
import { piece, knot, pair, wall, rail, well, fuel, pulse, cue, jit, int, coin } from '../kinds.js';
import { lineField } from './field.js';

const GROUP_WELLS = ['M49', 'M60', 'M89', 'M58'];

// ---------- virgo-crowd (build) ----------
// The cluster's crowd: two galaxy groups (an apex knot, then a pair a beat later with a 12° gap: graze the apex,
// thread the pair), then a small well whose band A lies on a pair of galaxies 5 beats on (whip, then thread) and
// band B on two fuel
// cells. A light swarm (0.9) fills the last beats round band A's line. A ship that does not whip can reach the pair
// the long way, grazing two knots on the way.
export const VIRGO_CROWD = piece({
  id: 'virgo-crowd', leg: 'virgo', roles: ['build'], beats: [14, 16], diff: 2,
  params: { off: [45, 65], bandA: [100, 135], bandB: [175, 215] },
  safe: { off: 55, bandA: 115, bandB: 195 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'crowd', { label: 'VIRGO CLUSTER' })];
    let s = coin(rnd);
    for (const b of [1.5, 4]) {
      const psi = s * (24 + rnd() * 12);
      items.push(knot(b, psi, 3, { opt: b > 2 }), pair(b + 1, psi + s * 4, 12, 2.5, { tag: 'group' }));
      s = -s;
    }
    const W = p.off, g = W - 17.5;              // a grab from the line's side sweeps away from the well
    const A = g - p.bandA, B = g - p.bandB;
    items.push(well(6, W, 'small', [A, B], GROUP_WELLS[int(rnd, 0, GROUP_WELLS.length - 1)], { tag: 'hub' }));
    items.push(fuel(9.5, B, { band: true, must: true, slot: 'band' }), fuel(10, B + 5, { band: true, must: true,
      slot: 'band' }));
    items.push(knot(8, A * 0.4 + 14, 3, { opt: true }), knot(9.5, A * 0.75 - 13, 3, { opt: true }));
    items.push(pair(11, A, 13, 3, { tag: 'twins', name: 'NGC 4567 · NGC 4568' }));
    const f = lineField(ctx, { b0: 12.5, b1: len - 0.5, line: A, fill: 0.92 * 0.9, vel: 4, hop: 0.1, fuel: 0, cap: 3 });
    items.push(...f.items);
    return { items, exit: f.line };
  },
});

// ---------- m87-jet (signature, M87: RISK) ----------
// M87, a landmark well 80 to 100° off the line. Its jet is a thin rail (half 2°) from beat 4 to 22, 130 to 170° on
// round from M87, whose skim band runs 9° out and pays × 2: RIDE THE JET. Eight knots in the jet (HST-1, D, E, F, I,
// A, B, C: the real names, outward from the core) bulge it to half 12° on their beats, so every one asks for a hop
// out and back. Band A drops you on the jet's riding line, band B on three fuel cells. Clear all eight for JET RIDER
// (+1 cell; the jetEnd cue). Globular clusters, small knots, drift between the line and M87 for whoever stays off the
// jet.
const JET_KNOTS = ['HST-1', 'D', 'E', 'F', 'I', 'A', 'B', 'C'];
const JET_BEATS = [5, 8, 10.5, 13, 15, 17.5, 20, 22.5];
export const M87_JET = piece({
  id: 'm87-jet', leg: 'virgo', roles: ['signature'], beats: [24, 24], fixed: true, diff: 4,
  params: { off: [80, 100], jet: [130, 170] },
  safe: { off: 90, jet: 150 },
  build(ctx) {
    const { p } = ctx;
    const M = p.off, J = M + p.jet, g = M - 25;
    const A = J + 10, B = g - 120;              // band A: the jet's riding line on the side the sweep reaches
    const items = [
      cue(0.5, 'm87', { name: 'M87' }), cue(1, 'fact', { fact: 'm87' }),
      well(2, M, 'landmark', [A, B], 'M87', { tag: 'm87' }),
      fuel(10, B, { band: true, must: true, slot: 'band' }), fuel(10.5, B - 6, { band: true, must: true, slot: 'band' }),
      fuel(11, B - 12, { band: true, must: true, slot: 'band' }),
      cue(4, 'jet', { psi: J }),
      rail(4, 22, J, 2, { skimBand: 9, skimX: 2, tag: 'jet', name: 'THE JET' }),
      cue(22.5, 'jetEnd', { reward: 'JET RIDER', fuel: 1, tag: 'jet' }), cue(22.5, 'fact', { fact: 'jet' }),
    ];
    JET_BEATS.forEach((b, i) => items.push(pulse(b, J, 2, 12, 1, { name: JET_KNOTS[i], tag: 'jet' })));
    const f = lineField(ctx, { b0: 6, b1: 22, line: M - 60, fill: 0.5, half: [1.5, 2.5], off: [9, 22], vel: 2,
      hop: 0.06, fuel: 8, cap: 3 });
    items.push(...f.items);
    return { items, exit: A + 2 };
  },
});

// ---------- markarian (signature, MARKARIAN'S CHAIN: FAMILY) ----------
// Galaxies on a curving arc: knot k at beat 1 + 2k on a(k) = t·k + c·k² ÷ 10 degrees, alternating 10° either side of
// it. Ride the arc and you graze them all (a long chain); its steepest turn is about 12 to 14° a beat. NGC 4435 and NGC
// 4438 (the Eyes) sit on it as a pair to thread at beat 6; NGC 4473 and NGC 4477 end it as another. A fuel slot a
// hairline outside the bend at knot 5, and six intracluster stars well inside the bend for a ship that leaves the arc.
export const MARKARIAN = piece({
  id: 'markarian', leg: 'virgo', roles: ['signature'], beats: [20, 20], diff: 3,
  params: { tilt: [6, 9], bend: [10, 13] },
  safe: { tilt: 8, bend: 12 },
  build(ctx) {
    const { rnd, p } = ctx;
    const a = (k) => p.tilt * k + (p.bend * k * k) / 10;
    const items = [cue(0.5, 'chain', { label: 'MARKARIAN\'S CHAIN' })];
    for (let k = 0; k < 8; k++) {
      const sd = k % 2 ? -1 : 1, psi = a(k) + sd * 10;
      if (k === 2) {
        // the Eyes, NGC 4435 and NGC 4438, a pair on the arc: thread them (two grazes and the pair's pay)
        items.push(pair(6, a(2.5), 12, 3, { tag: 'chain', name: 'THE EYES' }));
        continue;
      }
      if (k === 3) continue;
      items.push(knot(1 + 2 * k, psi, 3, { tag: 'chain' }));
      if (k === 5) items.push(fuel(1 + 2 * k, psi + sd * 7.5));
    }
    items.push(cue(6, 'fact', { fact: 'eyes' }));
    for (const b of [4, 6, 9, 12, 14.5, 16.5]) items.push(knot(b, a((b - 1) / 2) + 32 + rnd() * 16, 3, { opt: true }));
    const end = a(8.5);
    items.push(pair(18, end, 18, 5, { tag: 'chain', name: 'NGC 4473 · NGC 4477' }), cue(18, 'fact', { fact: 'chain' }));
    return { items, exit: end };
  },
});

// ---------- whale-road (open, the WHALE's leg) ----------
// The WHALE's open road: two rails 70° apart drifting a little, a few knots just inside them: room to draft the
// WHALE, to ride its breach and to slingshot past, and room for its bow wave beside it. A fuel slot a hairline from
// one knot. The RIVAL family's +6 beats lengthen it.
export const WHALE_ROAD = piece({
  id: 'whale-road', leg: 'virgo', roles: ['open'], beats: [16, 26], diff: 1,
  params: { drift: [-2, 2] },
  safe: { drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const w = p.drift;
    const items = [cue(0.5, 'open'), cue(0.5, 'whale'), rail(1, len - 1, -35, 1.5, { omega: w, tag: 'road' }),
      rail(1, len - 1, 35, 1.5, { omega: w, tag: 'road' })];
    let s = coin(rnd);
    const n = Math.min(5, Math.floor((len - 4) / 3.5));
    for (let k = 0; k < n; k++) {
      const b = 3.5 + 3.5 * k, at = w * (b - 1), K = at + s * (21 + jit(rnd, 2));
      items.push(knot(b, K, 2.5, { opt: k !== 1 }));
      if (k === 1) items.push(fuel(b, K - s * 7));
      s = -s;
    }
    return { items, exit: w * (len - 1) };
  },
});

export const PIECES = Object.freeze({
  'virgo-crowd': VIRGO_CROWD, 'm87-jet': M87_JET, markarian: MARKARIAN, 'whale-road': WHALE_ROAD,
});
