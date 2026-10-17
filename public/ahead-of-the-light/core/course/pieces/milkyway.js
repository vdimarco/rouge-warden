// Ahead of the Light: THE MILKY WAY's pieces (final.md 11.5, design-tech 5.5): disc-entry, crowded-centre,
// spiral-arms, dust-road and arm-funnel. Leg 5 drops into the Milky Way's disc, past its crowded centre or along its
// outer arms, through a dust lane and down the Orion Arm's funnel. Each builds in its own frame (beats from its start,
// bearings from its entry line, + to the right). Pure: integer RNG and + − × ÷ only.
import { piece, knot, wall, rail, fuel, fog, cue, jit, coin } from '../kinds.js';
import { lineField, arcField } from './field.js';

// ---------- disc-entry (opener) ----------
// The disc's layers: three thin walls 2 beats apart with gaps of 70°, 60° and 50°, each 40 to 80° round from the
// last, so you weave down through them. A fuel slot a hairline inside the third gap's far edge. Then the disc's
// stars, a light field round the third gap's line.
export const DISC_ENTRY = piece({
  id: 'disc-entry', leg: 'milkyway', roles: ['opener'], beats: [12, 16], diff: 2,
  params: { first: [40, 80], swing: [40, 80], last: [40, 80] },
  safe: { first: 60, swing: 60, last: 60 },
  build(ctx) {
    const { rnd, len } = ctx;
    const p = ctx.p;
    const items = [cue(0.5, 'disc', { label: 'THE MILKY WAY' }), cue(1, 'fact', { fact: 'lmc-far' })];
    let c = coin(rnd) * p.first, dir = coin(rnd);
    const gaps = [[2, 70, 0], [4, 60, p.swing], [6, 50, p.last]];
    for (const [b, w, turn] of gaps) {
      c += dir * turn;
      if (turn) dir = rnd() < 0.7 ? -dir : dir;
      items.push(wall(b, [{ psi: c, w, tag: 'disc' }], { thin: true }));
    }
    items.push(fuel(6, c + dir * (25 - 4.5)));
    const f = lineField(ctx, { b0: 8, b1: len - 1, line: c, fill: 0.6, off: [10, 24], vel: 5, hop: 0.08, fuel: 0,
      cap: 4 });
    items.push(...f.items);
    return { items, exit: f.line };
  },
});

// ---------- crowded-centre (signature, THE GALACTIC CENTRE: RISK) ----------
// The bar: a block 100° wide (a rail of half 50°) for 10 beats, 35 to 60° off the line, so it covers your line and
// you must pick a side. Its edges skim × 1.5. The crowd presses on both edges: stars begin 12° out from the riding
// line, so riding the edge means hairlines too; the far side of the ring is thinner. When the bar ends, the bulge's
// crowd fills the middle. KEEP OUT OF THE CROWDED CENTRE plays the first time (the crowd cue).
export const CROWDED_CENTRE = piece({
  id: 'crowded-centre', leg: 'milkyway', roles: ['signature'], beats: [20, 20], diff: 4,
  params: { bar: [35, 60], drift: [-2, 2] },
  safe: { bar: 45, drift: 0 },
  build(ctx) {
    const { p } = ctx;
    const C = p.bar, w = p.drift;
    const items = [cue(0.5, 'crowd', { label: 'THE GALACTIC CENTRE' }), cue(1, 'fact', { fact: 'centre-far' }),
      rail(2, 12, C, 50, { omega: w, skimX: 1.5, tag: 'bar', name: 'THE BAR' })];
    const at = (b) => C + w * (b - 2);
    // the crowd on both edges and the thin far side, while the bar lasts (each slot keyed to the bar's drift)
    const edge = (lo, hi) => arcField(ctx, { b0: 2.5, b1: 11, from: lo, to: hi, per: 1, fill: 0.5, space: 24,
      half: [2, 3.5], cap: 2, fuel: 0 });
    const shift = (it) => ({ ...it, psi: it.psi + w * (it.beat - 2) });
    for (const it of edge(C + 66, C + 104).items) items.push(shift(it));
    for (const it of edge(C - 104, C - 66).items) items.push(shift(it));
    const far = arcField(ctx, { b0: 3, b1: 11, from: C + 120, to: C + 240, per: 1, fill: 0.45, space: 30,
      half: [2.5, 3.5], cap: 2, fuel: 6 });
    for (const it of far.items) items.push(shift(it));
    // after the bar: the bulge's crowd round where it stood, thinner further out
    const bulge = arcField(ctx, { b0: 13.5, b1: 19, from: at(12) - 70, to: at(12) + 70, per: 2, fill: 0.5, space: 28,
      half: [2, 3.5], cap: 5, fuel: 0 });
    items.push(...bulge.items);
    return { items, exit: at(12) + 180 };
  },
});

// ---------- spiral-arms (signature, THE OUTER DISC: FAMILY) ----------
// Two arms 180° apart, rails (half 2°) that both turn 6 to 9° a beat, each with two breaks of 16° of its turn. Star
// clouds sit 14 to 17° beside each arm every 2 beats on alternating sides: ride an arm between its clouds (a hairline
// on each) or hop out round them, and cross from one half of the ring to the other only at a break. A fuel cell a
// hairline outside one cloud.
export const SPIRAL_ARMS = piece({
  id: 'spiral-arms', leg: 'milkyway', roles: ['signature'], beats: [20, 20], diff: 3,
  params: { arm: [20, 40], turn: [6, 9], brk: [3, 6] },
  safe: { arm: 30, turn: 8, brk: 4 },
  build(ctx) {
    const { rnd, p } = ctx;
    const w = p.turn, blen = Math.ceil((16 / w) * 10) / 10;
    const items = [cue(0.5, 'arms', { label: 'THE ORION ARM' })];
    const arms = [[p.arm, 'PERSEUS ARM', 0], [p.arm - 180, 'SAGITTARIUS ARM', 3]];
    let cell = false;
    for (const [a0, name, lag] of arms) {
      const b1 = 1.5 + p.brk + lag, b2 = b1 + 7;
      const at = (b) => a0 + w * (b - 1.5);
      items.push(rail(1.5, 19, a0, 2, { omega: w, breaks: [[b1, b1 + blen], [b2, b2 + blen]], tag: 'arm', name }));
      let s = coin(rnd);
      for (let b = 2.5 + lag / 3; b <= 18; b += 2) {
        const d = 14 + rnd() * 3;
        items.push(knot(b, at(b) + s * d, 2.5 + rnd() * 0.5, { opt: true, tag: 'cloud' }));
        if (!cell && b >= 6) { items.push(fuel(b, at(b) + s * (d + 7.5))); cell = true; }
        s = -s;
      }
    }
    return { items, exit: p.arm + w * 17.5 - 8 };
  },
});

// ---------- dust-road (open) ----------
// An open road inside a dust lane: dust over the whole ring, two rails 60° apart drifting a little, and a few knots
// inside and outside them. In the dust hazards and rivals draw as dark silhouettes until 0.5 s out, so you read the
// ticks: IN THE DUST, TRUST THE TICKS (the dust cue). Drafting in the dark is the game. A fuel slot a hairline from
// one knot.
export const DUST_ROAD = piece({
  id: 'dust-road', leg: 'milkyway', roles: ['open'], beats: [12, 20], diff: 2,
  params: { drift: [-3, 3] },
  safe: { drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const w = p.drift;
    const items = [fog(0, len, [[-180, 180]]), cue(0.5, 'open'), cue(0.5, 'dust'),
      rail(1, len - 1, -30, 1.5, { omega: w }), rail(1, len - 1, 30, 1.5, { omega: w })];
    let s = coin(rnd);
    let k = 0;
    for (let b = 2.5; b <= len - 1.5; b += 2, k++) {
      const at = w * (b - 1);
      if (k % 3 === 2) items.push(knot(b, at + s * (60 + rnd() * 50), 3, { opt: true }));
      else {
        const d = 10 + rnd() * 9;
        items.push(knot(b, at + s * d, 2.5, { opt: k !== 1 }));
        if (k === 1) items.push(fuel(b, at + s * (d - 7)));
      }
      s = -s;
    }
    return { items, exit: w * (len - 1) };
  },
});

// ---------- arm-funnel (crescendo end) ----------
// The Orion Arm's mouth: two arm rails close from about ±56° to ±16° of the line at 4.4° a beat, onto the gate. Inside,
// knots on alternating sides a hairline from the closing walls; outside, a few stars for a ship that stayed out.
export const ARM_FUNNEL = piece({
  id: 'arm-funnel', leg: 'milkyway', roles: ['crescendo'], beats: [10, 10], diff: 3,
  params: { inner: [9, 12] },
  safe: { inner: 10 },
  build(ctx) {
    const { rnd, p } = ctx;
    const wall0 = (b) => 55.6 - 4.4 * (b - 1);
    const items = [cue(0.5, 'funnel', { label: 'THE ORION ARM' }),
      rail(1, 10, -55.6, 2, { omega: 4.4, tag: 'arm' }), rail(1, 10, 55.6, 2, { omega: -4.4, tag: 'arm' })];
    let s = coin(rnd);
    for (const b of [2.5, 4, 5.5, 7, 8.5]) {
      items.push(knot(b, s * (wall0(b) - p.inner - 2.5 - jit(rnd, 1)), 2.5, { opt: b > 3 }));
      s = -s;
    }
    for (const b of [3, 6.5]) items.push(knot(b, coin(rnd) * (90 + rnd() * 50), 3, { opt: true }));
    return { items, exit: 0 };
  },
});

export const PIECES = Object.freeze({
  'disc-entry': DISC_ENTRY, 'crowded-centre': CROWDED_CENTRE, 'spiral-arms': SPIRAL_ARMS, 'dust-road': DUST_ROAD,
  'arm-funnel': ARM_FUNNEL,
});
