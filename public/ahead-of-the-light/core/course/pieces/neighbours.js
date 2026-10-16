// Ahead of the Light: THE SUN'S NEIGHBOURS' pieces (final.md 11.5, design-tech 5.7): pleiades, sirius, hyades,
// alpha-cen and oort-comets. Leg 7 strings the named stars near the Sun close together, each one known by now, then
// crosses the Oort cloud to the heliopause. Each builds in its own frame (beats from its start, bearings from its entry
// line, + to the right). Pure: integer RNG and + − × ÷ only.
import { piece, knot, pair, tail, well, fuel, cue, jit, coin } from '../kinds.js';
import { lineField } from './field.js';
import { hubHop } from './common.js';

// ---------- pleiades (opener) ----------
// The Seven Sisters: a crown of seven stars (half 3°) across about 100° near your line, passing within half a beat,
// 15° apart centre to centre (a double hairline to slip between) but for one 22° gap (a graze on each side) or the
// way round either end. Then the cluster's outer stars, a light field with a fuel slot, and Atlas and Pleione as a
// pair to thread.
export const PLEIADES = piece({
  id: 'pleiades', leg: 'neighbours', roles: ['opener'], beats: [14, 16], diff: 2,
  params: { crown: [-20, 20], wide: [1, 5] },
  safe: { crown: 0, wide: 3 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'label', { label: 'THE PLEIADES' }), cue(1, 'fact', { fact: 'pleiades-far' })];
    const steps = [];
    for (let i = 0; i < 6; i++) steps.push(i === p.wide ? 22 : 15);
    const span = steps.reduce((a, b) => a + b, 0);
    let x = p.crown - span / 2;
    for (let i = 0; i < 7; i++) {
      const mid = Math.abs(i - 3);
      items.push(knot(3 + 0.5 - mid / 6, x, 3, { tag: 'sister', name: i === 3 ? 'ALCYONE' : null }));
      if (i < 6) x += steps[i];
    }
    const f = lineField(ctx, { b0: 6.5, b1: len - 1, line: p.crown + coin(rnd) * 10, fill: 0.55, off: [12, 26],
      vel: 4, hop: 0.08, fuel: 6, cap: 4 });
    // Atlas and Pleione, side by side in the sky, as a pair to thread on the field's line
    const pb = Math.round(len * 0.62);
    for (const it of f.items) if (Math.abs(it.beat - pb) > 0.75) items.push(it);
    const line = p.crown + (f.line - p.crown) * ((pb - 6.5) / Math.max(1, len - 7.5));
    items.push(pair(pb, line, 14, 3, { tag: 'pleiades', name: 'ATLAS · PLEIONE' }));
    return { items, exit: f.line };
  },
});

// ---------- sirius (build) ----------
// The neighbours' skin of hub-hop: Sirius A, the brightest star in Earth's sky, as a medium well off the line, and
// Sirius B, a small dense white dwarf (half 2°), 30° beyond it on the far side: touch it and you hit. Band A lies on a
// 60° wall gap 6 beats on, band B on two fuel cells.
export const SIRIUS = piece({
  id: 'sirius', leg: 'neighbours', roles: ['build'], beats: [14, 16], diff: 2,
  params: { off: [40, 65], bandA: [100, 150], bandB: [190, 230] },
  safe: { off: 50, bandA: 120, bandB: 210 },
  build(ctx) {
    const h = hubHop(ctx.rnd, 0, 'medium', ctx.p, true);
    const items = h.items.filter((it) => it.beat < ctx.len)
      .map((it) => (it.kind === 'well' ? { ...it, name: 'SIRIUS A', tag: 'sirius' } : it));
    items.push(knot(3, ctx.p.off + 30, 2, { name: 'SIRIUS B', tag: 'dwarf' }));
    return { items, exit: h.exit };
  },
});

// ---------- hyades (signature, ALDEBARAN AND THE HYADES: RISK) ----------
// The Hyades' V: two lines of five stars close from ±40° to ±9 to 12° of a drifting line over 8 beats, with two members
// inside it to weave round. Aldebaran, a big orange giant (half 8°), sits 55 to 70° off the line 2 beats before the
// V's mouth; it only looks like a member (it is about 67 light-years from us, the cluster about 153). Past the mouth
// the cluster's heart: a pair to thread and two stars beside it. A fuel slot a hairline inside one V star.
export const HYADES = piece({
  id: 'hyades', leg: 'neighbours', roles: ['signature'], beats: [16, 16], diff: 3,
  params: { mouth: [9, 12], drift: [-3, 3], ald: [55, 70] },
  safe: { mouth: 11, drift: 0, ald: 62 },
  build(ctx) {
    const { rnd, p } = ctx;
    const line = (b) => p.drift * b;
    const half = (b) => 40 - ((40 - p.mouth) * (b - 2)) / 8;
    const items = [cue(0.5, 'label', { label: 'THE HYADES' })];
    for (const b of [2, 4, 6, 8, 10]) {
      items.push(knot(b, line(b) - half(b), 3, { tag: 'hyades' }), knot(b, line(b) + half(b), 3, { tag: 'hyades' }));
      if (b === 6) {
        const s = coin(rnd);
        items.push(fuel(b, line(b) + s * (half(b) - 7.5)));
      }
    }
    const s = coin(rnd);
    items.push(knot(5, line(5) + s * (6 + rnd() * 3), 3, { opt: true, tag: 'member' }),
      knot(7, line(7) - s * (5 + rnd() * 3), 3, { opt: true, tag: 'member' }));
    items.push(knot(8, line(8) + coin(rnd) * p.ald, 8, { name: 'ALDEBARAN', tag: 'orange' }));
    items.push(pair(12, line(12), 12, 3, { tag: 'hyades' }),
      knot(13.5, line(13.5) + 20 + jit(rnd, 3), 3, { opt: true }), knot(15, line(15) - 20 + jit(rnd, 3), 3,
        { opt: true }));
    return { items, exit: line(12) };
  },
});

// ---------- alpha-cen (signature, ALPHA CENTAURI: FAMILY) ----------
// Alpha Centauri A and B as a pair (half 6° and 5°, a 24° gap) 10 to 30° off the line at beat 11, and Proxima, a small
// well, 140 to 160° round from them at beat 3. Whip Proxima and its band A flings you back onto the pair's line to
// thread it; band B lies on two fuel cells. Or ignore Proxima and thread the pair straight. Barnard's Star and Wolf
// 359 graze the way.
export const ALPHA_CEN = piece({
  id: 'alpha-cen', leg: 'neighbours', roles: ['signature'], beats: [16, 16], fixed: true, diff: 3,
  params: { pair: [10, 30], prox: [140, 160] },
  safe: { pair: 20, prox: 150 },
  build(ctx) {
    const { rnd, p } = ctx;
    const C = p.pair, P = C - p.prox, g = P + 17.5;   // you come at Proxima from the line's side and sweep back
    const aA = ((C - g) % 360 + 360) % 360, B = g + aA - 62;
    const items = [cue(0.5, 'label', { label: 'ALPHA CENTAURI' }), cue(1, 'fact', { fact: 'alpha-cen-far' }),
      knot(1.5, coin(rnd) * (16 + rnd() * 6), 3, { opt: true }),
      well(3, P, 'small', [C, B], 'PROXIMA', { tag: 'proxima' }),
      fuel(7.5, B, { band: true, must: true, slot: 'band' }), fuel(8, B + 5, { band: true, must: true, slot: 'band' }),
      knot(6, C - 19 + jit(rnd, 2), 2.5, { name: 'BARNARD\'S STAR', opt: true }),
      knot(9, C + 20 + jit(rnd, 2), 2.5, { name: 'WOLF 359', opt: true }),
      { kind: 'gate', beat: 11, psi: C, gap: 24, halves: [6, 5], pair: true, names: ['ALPHA CEN A', 'ALPHA CEN B'],
        name: 'ALPHA CENTAURI', tag: 'alpha-cen' }];
    let s = coin(rnd);
    for (const b of [13, 14.5]) {
      items.push(knot(b, C + s * (18 + rnd() * 8), 3, { opt: true }));
      s = -s;
    }
    return { items, exit: C };
  },
});

// ---------- oort-comets (crescendo end) ----------
// The Oort cloud is mostly empty: five comets (a knot with a short tail) over 10 beats, far apart. Ride a tail for a
// skim; cross one and you hit.
export const OORT_COMETS = piece({
  id: 'oort-comets', leg: 'neighbours', roles: ['crescendo'], beats: [10, 10], diff: 2,
  params: { spread: [50, 80] },
  safe: { spread: 65 },
  build(ctx) {
    const { rnd, p } = ctx;
    const items = [cue(0.5, 'label', { label: 'THE OORT CLOUD' })];
    let s = coin(rnd), at = s * (18 + rnd() * 10);
    for (const b of [1, 3, 5, 7, 9]) {
      items.push(...tail(b, at, 3, 2.5, { tag: 'comet' }));
      s = -s;
      at = at + s * (p.spread + rnd() * 20);
      if (Math.abs(at) > 140) at = s * (20 + rnd() * 20);
    }
    return { items, exit: 0 };
  },
});

export const PIECES = Object.freeze({
  pleiades: PLEIADES, sirius: SIRIUS, hyades: HYADES, 'alpha-cen': ALPHA_CEN, 'oort-comets': OORT_COMETS,
});
