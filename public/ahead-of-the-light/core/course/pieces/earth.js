// Ahead of the Light: EARTH's pieces (final.md 8.2, 11.5, design-tech 5.8): kuiper, saturn, jupiter, belt-dense,
// asteroids, inner, moon and landing. Leg 8 runs in the order of the planets, from the Kuiper belt to the door at
// Earth, and is fixed but for sides and a few angles. Each builds in its own frame (beats from its start, bearings
// from its entry line, + to the right). Pure: integer RNG and + − × ÷ only.
import { piece, knot, pair, tail, wall, rail, well, fuel, cue, jit, coin } from '../kinds.js';
import { lineField } from './field.js';

// ---------- kuiper (opener) ----------
// The Kuiper belt: icy bodies and comets (a knot with a short tail) at about 0.6 a beat round a drifting line, one of
// them PLUTO. Neptune and Uranus pass as labels only. A fuel slot a hairline outside one icy body.
export const KUIPER = piece({
  id: 'kuiper', leg: 'earth', roles: ['opener'], beats: [12, 16], fixed: true, diff: 1,
  params: { amp: [14, 28], drift: [-3, 3] },
  safe: { amp: 20, drift: 0 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'label', { label: 'NEPTUNE', psi: coin(rnd) * 120 }),
      cue(len / 2, 'label', { label: 'URANUS', psi: coin(rnd) * 110 })];
    let s = coin(rnd), k = 0, cell = false;
    for (let b = 1.5; b <= len - 1; b += 1.5 + rnd() * 0.5, k++) {
      const line = p.drift * b, psi = line + s * (p.amp + jit(rnd, 6));
      if (k % 3 === 1) items.push(...tail(b, psi, 2.5, 2, { tag: 'comet' }));
      else {
        const h = 2 + rnd();
        items.push(knot(b, psi, h, { opt: true, name: k === 4 ? 'PLUTO' : null }));
        if (!cell && k >= 2) { items.push(fuel(b, psi + s * (h + 4.5))); cell = true; }
      }
      s = -s;
    }
    return { items, exit: p.drift * len };
  },
});

// ---------- saturn (build, fixed) ----------
// Beat 4: THE RINGS, a wall round the whole ring with three gaps. The CASSINI DIVISION, 40° wide and within 25° of
// your line, is the safe pass. The ENCKE GAP, 14° wide and 105 to 135° round one way, is a thread (a pair in the gap:
// the pair's pay and two grazes). The KEELER GAP, 10° wide and 105 to 135° round the other way, leaves 1.5° either
// side of the ship, two hairlines, and holds a fuel cell; it has no label (a secret). Ring fragments drift past each
// gap. Beat 12: Saturn, a large well; band A lies on TITAN (a knot to graze), band B on two fuel cells. The widths
// are not to scale. Two moonlets come first, on the way to the rings.
export const SATURN = piece({
  id: 'saturn', leg: 'earth', roles: ['build'], beats: [16, 16], fixed: true, diff: 3,
  params: { cassini: [-25, 25], encke: [105, 135], keeler: [105, 135] },
  safe: { cassini: 0, encke: 120, keeler: 120 },
  build(ctx) {
    const { rnd, p } = ctx;
    const C = p.cassini, E = p.encke, K = -p.keeler;
    const items = [cue(0.5, 'label', { label: 'SATURN' }), cue(1, 'fact', { fact: 'saturn-far' }),
      cue(3, 'label', { label: 'CASSINI DIVISION', psi: C }),
      knot(1.5, C + coin(rnd) * (26 + rnd() * 10), 2, { opt: true, tag: 'ring' }),
      knot(2.75, E - 24 + jit(rnd, 4), 2, { opt: true, tag: 'ring' }),
      wall(4, [{ psi: C, w: 40, tag: 'cassini' }, { psi: E, w: 14, tag: 'encke' }, { psi: K, w: 10, tag: 'keeler' }],
        { preview: true, name: 'THE RINGS' }),
      pair(4, E, 14, 2, { tag: 'encke', name: 'ENCKE GAP' }),
      fuel(4, K, { must: true, secret: true, slot: 'keeler' })];
    // ring fragments 20 to 60° past each gap
    for (const [g, b] of [[C, 5], [E, 6], [K, 7], [C, 8]]) {
      items.push(knot(b + jit(rnd, 0.25), g + coin(rnd) * (20 + rnd() * 40), 2, { opt: true, tag: 'ring' }));
    }
    const sg = coin(rnd), S = C + sg * 45, g = S - sg * 22.5;  // you come at Saturn from the Cassini side
    const sweep = -sg;                                          // and sweep away from it
    const A = g + sweep * 110, B = g + sweep * 170;
    items.push(well(12, S, 'large', [A, B], 'SATURN', { tag: 'saturn' }),
      fuel(14.5, B, { band: true, must: true, slot: 'band' }), fuel(15, B + sweep * 5, { band: true, must: true,
        slot: 'band' }),
      knot(15, A - sweep * 11, 3.5, { name: 'TITAN', target: true }));
    return { items, exit: A };
  },
});

// ---------- jupiter (signature, JUPITER: the long way) ----------
// Jupiter, a large well 35 to 60° off the line at beat 8, with its four big moons as knots (half 2.5°) in a line
// through its bearing at ±14° and ±28°: Ganymede passes before the window opens, guarding the far side; Io, Europa
// and Callisto pass after it, so a whip sweeps over them for grazes. Band A lies on the KIRKWOOD GAP, the 60° gap in
// the wall of rocks that opens the asteroid belt; band B on two fuel cells. THE VOYAGERS SWUNG ROUND JUPITER plays the
// first time (the voyagers cue).
export const JUPITER = piece({
  id: 'jupiter', leg: 'earth', roles: ['signature'], beats: [18, 18], fixed: true, diff: 3,
  params: { off: [35, 60], bandA: [100, 140] },
  safe: { off: 45, bandA: 120 },
  build(ctx) {
    const { rnd, p } = ctx;
    const J = p.off, g = J - 22.5;
    const A = g - p.bandA, B = A - 62;
    const items = [cue(0.5, 'voyagers'), cue(1, 'label', { label: 'JUPITER' }),
      knot(3, coin(rnd) * (16 + rnd() * 6), 3, { opt: true }), knot(5, J - 50 + jit(rnd, 5), 3, { opt: true }),
      knot(7.5, J + 28, 2.5, { name: 'GANYMEDE', tag: 'moon' }),
      well(8, J, 'large', [A, B], 'JUPITER', { tag: 'jupiter' }),
      knot(8.5, J + 14, 2.5, { name: 'IO', tag: 'moon' }), knot(9, J - 14, 2.5, { name: 'EUROPA', tag: 'moon' }),
      knot(9.5, J - 28, 2.5, { name: 'CALLISTO', tag: 'moon' }),
      fuel(12.5, B, { band: true, must: true, slot: 'band' }), fuel(13, B - 5, { band: true, must: true, slot: 'band' }),
      knot(12, A + 30 + jit(rnd, 6), 3, { opt: true, tag: 'trojan' }),
      wall(15, [{ psi: A, w: 60, tag: 'kirkwood' }], { preview: true, name: 'KIRKWOOD GAP' })];
    return { items, exit: A };
  },
});

// The asteroid belt's rubble: small rocks (half 2 to 3°) round a drifting line on both sides of it, Kirkwood gaps
// (FORKs) every few beats, a fuel slot a hairline inside a rock now and then. Its knots are field knots, so FLARES can
// make some of them pulse.
function rubble(ctx, o) {
  return lineField(ctx, { b0: 1, b1: ctx.len - 1, half: [2, 3], off: [8, 24], hop: 0.12, cap: 6,
    forkName: 'KIRKWOOD GAP', make: (b, psi, h, opt) => knot(b, psi, h, { opt, field: true, tag: 'rock' }), ...o });
}

// ---------- belt-dense (THE ASTEROID BELT: the short way) ----------
// The short way home: no Jupiter, no open road, and the belt at density 1.4 (rocks on both sides of the line more
// often, Kirkwood gaps every 9 beats). Fewer years, more risk. MANTA pushes here (the manta cue).
export const BELT_DENSE = piece({
  id: 'belt-dense', leg: 'earth', roles: ['signature'], beats: 'rest', diff: 4,
  build(ctx) {
    const items = [cue(0.5, 'label', { label: 'THE ASTEROID BELT' }), cue(0.5, 'manta')];
    const f = rubble({ ...ctx, density: 1.4 }, { both: 0.45, forks: 9, fuel: 7, vel: 7 });
    items.push(...f.items);
    return { items, exit: f.line };
  },
});

// ---------- asteroids (crescendo) ----------
// The asteroid belt the long way: rubble at density 1.1, Kirkwood gaps every 10 beats. MANTA's push zone (the manta
// cue): it rises through the field here, and blocking it means holding a line among the rocks.
export const ASTEROIDS = piece({
  id: 'asteroids', leg: 'earth', roles: ['crescendo'], beats: 'rest', diff: 3,
  build(ctx) {
    const items = [cue(0.5, 'label', { label: 'THE ASTEROID BELT' }), cue(0.5, 'manta')];
    const f = rubble(ctx, { both: 0.3, forks: 10, fuel: 8, vel: 6 });
    items.push(...f.items);
    return { items, exit: f.line };
  },
});

// ---------- inner (open) ----------
// The inner planets: an open road between two straight rails 60° apart, a few rocks just inside them, Mars as a label,
// and the Moon and Earth drawing on ahead. Room to draft MANTA and to get between it and the light. A fuel slot a
// hairline inside one rock.
export const INNER = piece({
  id: 'inner', leg: 'earth', roles: ['open'], beats: [12, 20], fixed: true, diff: 1,
  build(ctx) {
    const { rnd, len } = ctx;
    const items = [cue(0.5, 'open'), cue(1, 'label', { label: 'MARS', psi: coin(rnd) * (60 + rnd() * 40) }),
      rail(1, len - 1, -30, 1.5, { tag: 'road' }), rail(1, len - 1, 30, 1.5, { tag: 'road' }),
      cue(len - 2, 'label', { label: 'THE MOON' })];
    let s = coin(rnd);
    const n = Math.min(4, Math.floor((len - 3) / 3));
    for (let k = 0; k < n; k++) {
      const b = 3.5 + 3 * k;
      items.push(knot(b, s * 18, 2.5, { opt: k !== 1, tag: 'rock' }));
      if (k === 1) items.push(fuel(b, s * 11));
      s = -s;
    }
    return { items, exit: 0 };
  },
});

// ---------- moon (fixed) ----------
// The Moon, a small well 40 to 70° off the line 20 beats before the door. Its band A lies on the door's line (the
// landing puts the door on it, 16 beats on, so the piece is tested with the landing after it: after), its band B on
// two fuel cells that count at the landing. Two rocks to graze on the way.
export const MOON = piece({
  id: 'moon', leg: 'earth', roles: ['moon'], beats: [12, 12], fixed: true, diff: 2, after: 'landing',
  params: { off: [40, 70], bandA: [110, 150] },
  safe: { off: 55, bandA: 130 },
  build(ctx) {
    const { rnd, p } = ctx;
    const M = p.off, g = M - 17.5;
    const A = g - p.bandA, B = A - 62;
    const items = [well(4, M, 'small', [A, B], 'THE MOON', { tag: 'moon' }),
      knot(1.5, coin(rnd) * (18 + rnd() * 6), 3, { opt: true }),
      fuel(8.5, B, { band: true, must: true, slot: 'band' }), fuel(9, B - 5, { band: true, must: true, slot: 'band' }),
      knot(7, A + 16 + jit(rnd, 3), 3, { opt: true }), knot(10.5, A - 15 + jit(rnd, 3), 3, { opt: true })];
    return { items, exit: A };
  },
});

// ---------- landing (fixed, Earth's gate) ----------
// LAND BEFORE THE LIGHT. Earth's disc fills the centre at L − 8 (the earth cue); the DOOR, a 60° ring labelled EARTH,
// is at L − 4 on the Moon's band A line (the door cue: gen.js makes it the leg's gate, and race.js lands there). A
// few satellites graze the way in, none on the door's line. The rivals' race ends at the door.
export const LANDING = piece({
  id: 'landing', leg: 'earth', roles: ['gate'], beats: [12, 12], fixed: true, repeat: true, diff: 1,
  params: { door: [-8, 8] },
  safe: { door: 0 },
  build(ctx) {
    const { rnd, p, T } = ctx;
    const D = p.door, at = 8;
    const items = [cue(0.5, 'gateCall', { label: 'EARTH' }), cue(4, 'earth', { label: 'EARTH' }), cue(4.5, 'land'),
      cue(at, 'door', { psi: D, w: T.DOOR_DEG, label: 'EARTH' }), cue(at, 'gate', { label: 'EARTH', names: ['EARTH'] })];
    let s = coin(rnd);
    for (const b of [2, 3.5, 5.5]) {
      items.push(knot(b, D + s * (38 + rnd() * 25), 2, { opt: true, tag: 'satellite' }));
      s = -s;
    }
    return { items, exit: D };
  },
});

export const PIECES = Object.freeze({
  kuiper: KUIPER, saturn: SATURN, jupiter: JUPITER, 'belt-dense': BELT_DENSE, asteroids: ASTEROIDS, inner: INNER,
  moon: MOON, landing: LANDING,
});
