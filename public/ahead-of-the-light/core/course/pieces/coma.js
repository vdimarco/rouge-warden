// Ahead of the Light: COMA's pieces (final.md 11.5): coma-outskirts, first-well, coma-jellyfish, great-wall. Leg 2
// crosses the Coma Cluster's thousand galaxies toward Virgo; first-well also teaches the whip in leg 1's build on a
// player's first runs. Each builds in its own frame (beats from its start, bearings from its entry line, + to the
// right). Pure: integer RNG and + − × ÷ only.
import { piece, knot, pair, tail, wall, rail, well, fuel, cue, jit, coin } from '../kinds.js';

// ---------- coma-outskirts (opener) ----------
// Groups of three galaxies every 3 beats, 25 to 45° off the line on alternating sides: an apex knot, then a pair a
// beat later. Graze past the apex and thread the pair: two hairlines. A fuel slot a hairline inside one apex.
export const COMA_OUTSKIRTS = piece({
  id: 'coma-outskirts', leg: 'coma', roles: ['opener'], beats: [12, 16], diff: 2,
  params: { off: [25, 40], drift: [-3, 3] },
  safe: { off: 32, drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'outskirts')];
    let s = coin(rnd), k = 0;
    for (let b = 1; b + 1 <= len - 1; b += 3, k++) {
      const line = p.drift * b, psi = line + s * (p.off + jit(rnd, 5));
      items.push(knot(b, psi, 3, { opt: k !== 1 }));
      items.push(pair(b + 1, psi + p.drift, 9, 3, { tag: 'group' }));
      if (k === 1) items.push(fuel(b, psi - s * 7.5));
      s = -s;
    }
    return { items, exit: p.drift * len };
  },
});

// ---------- first-well (build, teaching: until a GOOD whip in any run) ----------
// NGC 4911, a medium well at beat 8, 60° off the line. Grabbed from the line's side, band A (105° round) lies on a
// 60° wall gap at beat 14 and band B (165° round, the band beside it) on two fuel cells at beats 12.5 and 13 that
// lead back toward that gap. PRESS AS IT PASSES, HOLD, LET GO. A ship that does not whip finds the gap on its own,
// grazing two knots on the way.
export const FIRST_WELL = piece({
  id: 'first-well', leg: 'coma', roles: ['build'], beats: [16, 16], fixed: true, diff: 1,
  teach: { key: 'goodWhip' },
  build() {
    const W = 60, grab = W - 30, A = grab - 105, B = grab - 165;
    const items = [
      knot(1.5, -20, 3, { opt: true }), knot(3, 18, 3, { opt: true }),
      cue(4.5, 'whip', { well: 'NGC 4911' }), knot(5.5, -24, 3, { opt: true }),
      well(8, W, 'medium', [A, B], 'NGC 4911', { teach: true }),
      knot(10.5, A * 0.4 + 12, 3, { opt: true }), knot(12, A * 0.75 - 12, 3, { opt: true }),
      fuel(12.5, B, { band: true, must: true, slot: 'band' }), fuel(13, B + 9, { band: true, must: true, slot: 'band' }),
      wall(14, [{ psi: A, w: 60, tag: 'band' }]),
      knot(15.5, A + 20, 3, { opt: true }),
    ];
    return { items, exit: A };
  },
});

// ---------- coma-jellyfish (signature, COMA'S HEART: RISK) ----------
// D100's stripped gas: six tails (a knot with a thin rail behind it for 2.5 beats), 18 to 30° either side of the
// line, 2 beats apart, and two knots on the line between them, so the line is never free for long. Ride a tail to
// skim; cross one and you hit. A fuel slot a hairline inside the third tail.
export const COMA_JELLYFISH = piece({
  id: 'coma-jellyfish', leg: 'coma', roles: ['signature'], beats: [16, 16], diff: 3,
  params: { off: [18, 30], drift: [-3, 3] },
  safe: { off: 24, drift: 0 },
  build(ctx) {
    const { rnd, p } = ctx;
    const items = [cue(0.5, 'jellyfish', { name: 'D100' })];
    let s = coin(rnd);
    for (let k = 0; k < 6; k++) {
      const b = 1 + 2 * k, line = p.drift * b, psi = line + s * (p.off + jit(rnd, 3));
      items.push(...tail(b, psi, 3.5, 2.5, { tag: 'jelly' }));
      if (k === 2) items.push(fuel(b + 1, psi - s * 5.5));
      if (k === 1 || k === 3) items.push(knot(b + 1, line + p.drift + jit(rnd, 3), 3, { name: k === 1 ? 'D100' : null }));
      s = -s;
    }
    items.push(knot(14, p.drift * 14 + coin(rnd) * 16, 3, { opt: true }));
    return { items, exit: p.drift * 15 };
  },
});

// ---------- great-wall (signature, THE GREAT WALL: FAMILY) ----------
// The CfA2 Great Wall: a rail of half 90° for 12 beats beside the line. Its edge skims × 1.5 (WALL RIDE). Knots
// 12 to 20° off the edge every beat: riding the edge means hairlines, or a hit. Stand off and touch nothing. A fuel
// slot a hairline from the edge halfway along.
export const GREAT_WALL = piece({
  id: 'great-wall', leg: 'coma', roles: ['signature'], beats: [16, 16], diff: 3,
  params: { edge: [8, 14], drift: [-2, 2] },
  safe: { edge: 10, drift: 0 },
  build(ctx) {
    const { rnd, p } = ctx;
    const E = p.edge, w = p.drift;
    const items = [cue(0.5, 'wallRide', { name: 'GREAT WALL' }),
      rail(1, 13, E + 90, 90, { omega: w, skimX: 1.5, tag: 'great-wall', name: 'GREAT WALL' })];
    for (let b = 2; b <= 12; b++) {
      const edge = E + w * (b - 1);
      if (b === 7) { items.push(fuel(b, edge - 4.5)); continue; }
      items.push(knot(b, edge - (12 + rnd() * 8), 2.5 + rnd() * 0.5, { opt: true, tag: 'wall-knot' }));
    }
    items.push(knot(14.5, E + w * 12 - 30, 3, { opt: true }));
    return { items, exit: E + w * 12 - 22 };
  },
});

export const PIECES = Object.freeze({
  'coma-outskirts': COMA_OUTSKIRTS, 'first-well': FIRST_WELL, 'coma-jellyfish': COMA_JELLYFISH,
  'great-wall': GREAT_WALL,
});
