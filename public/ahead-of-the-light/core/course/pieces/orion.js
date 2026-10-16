// Ahead of the Light: ORION's pieces (final.md 11.5, design-tech 5.6): young-stars, betelgeuse, nursery, trapezium,
// belt-run and the MAKO's knot field. Leg 6 crosses the Orion complex to the Local Bubble. Each builds in its own frame
// (beats from its start, bearings from its entry line, + to the right). Pure: integer RNG and + − × ÷ only.
import { piece, knot, pair, well, fuel, pulse, cue, jit, coin } from '../kinds.js';
import { lineField } from './field.js';
import { hubHop } from './common.js';

// A young star: a dark point that flares to its pass size over the 2.5 beats before it passes (its tick still shows
// that size 1.3 s ahead, as for any pulse).
const star = (b, psi, h, opt, extra = {}) => pulse(b, psi, 0, h, 5, { opt, tag: 'young', ...extra });

// ---------- young-stars (opener) ----------
// Orion's skin of easy-knots: a zigzag of young stars every 2 beats round a drifting line, each flaring as it comes,
// wide enough that the line itself is clean, so steer toward each to graze it. A fuel slot a hairline inside the
// middle star, and a pair on the line a beat after it to thread. The nursery's flare, met gently first.
export const YOUNG_STARS = piece({
  id: 'young-stars', leg: 'orion', roles: ['opener'], beats: [12, 16], diff: 1,
  params: { amp: [16, 26], drift: [-3, 3] },
  safe: { amp: 21, drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'label', { label: 'ORION' })];
    const n = Math.min(7, Math.floor((len - 1) / 2));
    let s = coin(rnd);
    const mid = Math.floor(n / 2);
    for (let k = 0; k < n; k++) {
      const b = 1.5 + 2 * k, line = p.drift * b;
      const half = 3 + rnd(), psi = line + s * (p.amp + jit(rnd, 4));
      items.push(star(b, psi, half, k !== mid));
      if (k === mid) {
        items.push(fuel(b, psi - s * (half + 4.5)));
        items.push(pair(b + 1, p.drift * (b + 1), 14, 2.5, { tag: 'pair' }));
      }
      s = -s;
    }
    return { items, exit: p.drift * len };
  },
});

// ---------- betelgeuse (build) ----------
// Orion's skin of hub-hop: Betelgeuse, the red supergiant, as a large well off the line. Band A lies on a 60° wall gap
// 6 beats on, band B on two fuel cells; a ship that does not whip finds the gap the long way round, grazing as it goes.
export const BETELGEUSE = piece({
  id: 'betelgeuse', leg: 'orion', roles: ['build'], beats: [14, 16], diff: 2,
  params: { off: [45, 70], bandA: [100, 150], bandB: [190, 225] },
  safe: { off: 55, bandA: 120, bandB: 205 },
  build(ctx) {
    const h = hubHop(ctx.rnd, 0, 'large', ctx.p, true);
    const items = h.items.filter((it) => it.beat < ctx.len)
      .map((it) => (it.kind === 'well' ? { ...it, name: 'BETELGEUSE', tag: 'betelgeuse' } : it));
    items.push(cue(1, 'fact', { fact: 'betelgeuse-far' }));
    return { items, exit: h.exit };
  },
});

// ---------- nursery (signature, THE ORION NEBULA: RISK, then the trapezium) ----------
// The stellar nursery: young stars two a beat round a drifting line, each a dark point until it flares to half 3 to
// 4.5° in the 2.5 beats before its pass. Read the ticks, not the stars. Twice a dark cloud forks the way (a wall with
// two gaps, a cell inside one); a fuel slot a hairline inside a star now and then.
export const NURSERY = piece({
  id: 'nursery', leg: 'orion', roles: ['signature'], beats: [18, 18], diff: 4,
  params: { vel: [6, 9] },
  safe: { vel: 7 },
  build(ctx) {
    const items = [cue(0.5, 'nursery', { label: 'THE ORION NEBULA' }), cue(1, 'fact', { fact: 'orion-far' })];
    const f = lineField(ctx, { b0: 1.5, b1: ctx.len - 0.5, fill: 0.95, half: [3, 4.5], off: [10, 24], vel: ctx.p.vel,
      hop: 0.15, fuel: 8, cap: 6, forks: 8, forkName: 'DARK CLOUD', make: (b, psi, h, opt) => star(b, psi, h, opt) });
    items.push(...f.items);
    return { items, exit: f.line };
  },
});

// ---------- trapezium (signature, after the nursery) ----------
// The Trapezium: four bright young stars (half 4°) at ±9° and ±33° of a line near yours. The middle two are a pair
// with a 10° gap: thread it for two hairlines and the pair's pay (TRAPEZIUM). The two side gaps are 16°, a graze on
// each edge; outside them the way is open.
export const TRAPEZIUM = piece({
  id: 'trapezium', leg: 'orion', roles: ['signature'], beats: [10, 10], fixed: true, diff: 3,
  params: { off: [0, 25] },
  safe: { off: 12 },
  build(ctx) {
    const { rnd, p } = ctx;
    const c = p.off;
    const items = [cue(1, 'trapezium', { label: 'TRAPEZIUM' }),
      knot(2, c + coin(rnd) * (22 + rnd() * 6), 3, { opt: true }), knot(3.5, c + coin(rnd) * (40 + rnd() * 10), 3,
        { opt: true }),
      pair(5, c, 10, 4, { tag: 'trapezium', name: 'TRAPEZIUM' }),
      knot(5, c - 33, 4, { tag: 'trapezium' }), knot(5, c + 33, 4, { tag: 'trapezium' })];
    let s = coin(rnd);
    for (const b of [6.5, 8, 9.5]) {
      items.push(knot(b, c + s * (16 + rnd() * 10), 3, { opt: true }));
      s = -s;
    }
    return { items, exit: c };
  },
});

// ---------- belt-run (signature, ORION'S BELT: FAMILY) ----------
// Alnitak, Alnilam and Mintaka: three medium wells 11 beats apart, on the line, 50° and 100° round. Each well's band A
// lies on the next well's reach, so three whips can chain round the belt (BELT RUN, the beltRun cue). From the side
// the belt turns toward the whip is short and safe; from the other side it is a long sweep through the red zone for
// more speed. Alnitak's and Alnilam's band B lie on fuel; Mintaka's band A on THE SWORD, a pair to thread, its band B
// on a last cell. A few stars along the line for a ship that does not whip.
export const BELT_RUN = piece({
  id: 'belt-run', leg: 'orion', roles: ['signature'], beats: [28, 28], fixed: true, diff: 3,
  params: { first: [-8, 8], step: [46, 54] },
  safe: { first: 0, step: 50 },
  build(ctx) {
    const { rnd, p } = ctx;
    const names = ['ALNITAK', 'ALNILAM', 'MINTAKA'];
    const at = [2, 13, 24].map((b, i) => ({ b, psi: p.first + p.step * i, name: names[i] }));
    const items = [cue(0.5, 'belt', { label: 'ORION\'S BELT' })];
    at.forEach((w, i) => {
      const g = w.psi + 20;                     // a grab on the side the belt turns toward sweeps on round
      const A = i < 2 ? at[i + 1].psi + 20 : g + 60;
      const B = g + 140;
      items.push(well(w.b, w.psi, 'medium', [A, B], w.name, { tag: 'belt' }));
      if (i < 2) {
        items.push(fuel(w.b + 5, B, { band: true, must: true, slot: 'band' }),
          fuel(w.b + 5.5, B + 5, { band: true, must: true, slot: 'band' }));
        items.push(knot(w.b + 4, w.psi - 30 + jit(rnd, 4), 3, { opt: true }),
          knot(w.b + 7.5, w.psi + 25 + jit(rnd, 4), 3, { opt: true }));
      } else {
        items.push(fuel(w.b + 3, B, { band: true, must: true, slot: 'band' }));
        items.push(pair(w.b + 3.5, A, 12, 3, { tag: 'sword', name: 'THE SWORD' }));
      }
    });
    items.push(cue(27.5, 'beltRun', { wells: 3 }));
    return { items, exit: at[2].psi + 80 };
  },
});

// ---------- mako-field (crescendo, the MAKO's leg) ----------
// MAKO's hunting ground: a knot field round a drifting line in which many side knots come doubled, a second knot 12
// to 20° further out, too close to pass between. A shove into one is a takedown, so MAKO's aimed slams always have
// something to work with (and so do yours). FORKs every 12 beats; a fuel slot a hairline inside a knot every 8.
export const MAKO_FIELD = piece({
  id: 'mako-field', leg: 'orion', roles: ['crescendo'], beats: 'rest', repeat: true, diff: 3,
  build(ctx) {
    const items = [cue(0.5, 'mako')];
    const f = lineField(ctx, { b0: 1, b1: ctx.len - 1, fill: 0.7 * (ctx.density || 1), half: [2, 3.5], off: [9, 22],
      twin: 0.35, hop: 0.1, forks: 12, fuel: 8, cap: 5,
      make: (b, psi, h, opt) => knot(b, psi, h, { opt, field: true }) });
    items.push(...f.items);
    return { items, exit: f.line };
  },
});

export const PIECES = Object.freeze({
  'young-stars': YOUNG_STARS, betelgeuse: BETELGEUSE, nursery: NURSERY, trapezium: TRAPEZIUM, 'belt-run': BELT_RUN,
  'mako-field': MAKO_FIELD,
});
