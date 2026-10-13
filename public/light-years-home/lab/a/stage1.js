// Light Years Ahead (lab A): stage 1, THE WEB, out to the Coma Cluster. The script is written in beats, not depth:
// course speed is tied to the tempo, so every hazard passes the ship on its beat at any speed. Bearings are degrees
// from the start bearing, + to the right. Widths are half-widths in degrees. Pure: no DOM, no three.
import { mulberry32, hashSeed } from '../../core/rng.js';

export const STAGE_BEATS = 125;
export const COMA = { name: 'Coma Cluster', dist: '320 Mly', T: 4600 };

const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// ---------- builders ----------
// A galaxy knot: pass it close for a graze, touch it for a hit.
export const knot = (beat, psi, half = 3.5, extra = {}) => ({ kind: 'knot', beat, psi: wrap(psi), half, ...extra });
// Two knots side by side. Pass between them to thread (and graze both if it is tight).
export const pair = (beat, a, b, half = 3.5) => ({
  kind: 'gate', beat, psi: wrap((a + b) / 2), gap: Math.abs(b - a) / 2 - half, half, pair: true,
});
// A ring of galaxies with one gap: anywhere outside the gap is a hit; its two edges count as knots.
export const wall = (beat, centre, gapDeg, extra = {}) => ({ kind: 'wall', beat, psi: wrap(centre), gap: gapDeg / 2,
  ...extra });
// A filament along the course, beside the ship from beat to end: crossing it is a hit, riding close is a skim.
export const rail = (beat, end, psi, half = 1.5) => ({ kind: 'rail', beat, end, psi: wrap(psi), half });
// Two giant galaxies with a gap between them (edge to edge): thread it.
export const gate = (beat, centre, gapDeg, half, extra = {}) => ({ kind: 'gate', beat, psi: wrap(centre), gap: gapDeg / 2,
  half, ...extra });
// A cue: no hazard, just a moment the view and sound react to (a caption, the landmark, the slow pass).
export const cue = (beat, name, extra = {}) => ({ kind: 'cue', beat, cue: name, ...extra });

// The swarm: knots on eighth-note slots along a drifting line. Most sit 9 to 23° to one side of the line (ride the
// line to graze some, weave to graze them all); some sit on it, so you must hop. Returns { items, last }.
export function swarm(rnd, b0, b1, start) {
  const items = [];
  let line = start, vel = 0, last = start, side = rnd() < 0.5 ? -1 : 1;
  const slots = Math.round((b1 - b0) * 2);
  for (let i = 0; i < slots; i++) {
    const beat = b0 + i / 2;
    if (i % 8 === 0) vel = (rnd() * 2 - 1) * 9;
    line += vel;
    // A rest every so often keeps at most 5 knots inside the ring at top speed.
    if (i % 8 === 7 && rnd() < 0.7) continue;
    const r = rnd();
    let off;
    if (r < 0.12) off = (rnd() * 2 - 1) * 3;
    else {
      side = rnd() < 0.8 ? -side : side;
      off = side * (9 + rnd() * 14);
    }
    const half = 2 + rnd() * 2;
    last = line + off;
    items.push(knot(beat, last, half));
  }
  return { items, last };
}

// The whole stage for a seed. The intro (beats 0 to 16) is the same every time; the seed moves the walls' gaps, the
// bait sides, the rail, the swarm, Coma's gate and the glare slalom.
export const INTRO_SKIP = 9;      // retries after a run that got past the intro start here
export function buildStage(seed = 1) {
  const rnd = mulberry32(hashSeed(seed, 'lab-a', 'stage1'));
  const jit = (d) => (rnd() * 2 - 1) * d;
  const items = [
    cue(0.56, 'steer'),
    knot(6, 0),
    knot(8, 25), cue(10, 'skim'), knot(10, -30), knot(12, 35),
    pair(14, -12, 12),
    knot(16, -20), cue(16.5, 'burst'),
  ];
  // Walls with 60° gaps, swinging side to side; the seed picks the side of the first.
  const sg = rnd() < 0.5 ? -1 : 1;
  const c1 = sg * (90 + jit(15)), c2 = c1 - sg * (120 + jit(20)), c = c2 + sg * (150 + jit(20));
  items.push(wall(20, c1, 60), wall(24, c2, 60), wall(28, c, 60));
  // Walls with 50° gaps, each with a bait knot outside the gap edge you come from, one beat earlier.
  let from = c;
  for (const beat of [32, 36, 40, 44]) {
    const next = from + (rnd() < 0.5 ? -1 : 1) * (70 + jit(25));
    const side = Math.sign(wrap(from - next)) || 1;
    items.push(knot(beat - 1, next + side * (25 + 12), 3, { bait: true }));
    items.push(wall(beat, next, 50));
    from = next;
  }
  // The rail, then a wall whose gap is beyond it: ride the rail's far side, or flick across once it ends.
  const turn = rnd() < 0.5 ? -1 : 1;
  const railAt = from + turn * 80, G = from + turn * 170;
  items.push(rail(50, 54, railAt), cue(50, 'rail'));
  items.push(wall(56, G, 50, { plan: true }));
  // The breather: five outlying knots, wide apart, and Coma shows up dead ahead.
  const out = [[57.5, 85], [59, -110], [60, 60], [61.5, -55], [63, 120]];
  for (const [beat, psi] of out) items.push(knot(beat, G + turn * psi + jit(8), 3));
  items.push(cue(58, 'coma'));
  const sw = swarm(rnd, 64, 96, G + jit(30));
  items.push(cue(64, 'swarm'), ...sw.items);
  // Coma's gate: NGC 4889 and NGC 4874, a 30° gap centred opposite the swarm's last knot.
  const g = sw.last + 180;
  items.push(gate(98, g, 30, 9, { coma: true, names: ['NGC 4874', 'NGC 4889'] }));
  // Out of the glare: one knot a beat, alternating sides of the gate's line, dark until 0.5 s out.
  let s = rnd() < 0.5 ? -1 : 1;
  for (let beat = 100; beat < 120; beat++) {
    items.push(knot(beat, g + s * (15 + rnd() * 25), 3, { dark: true }));
    s = -s;
  }
  items.push(cue(120.6, 'vista'));
  items.sort((a, b) => a.beat - b.beat);
  items.forEach((it, i) => { it.id = i; });
  return items;
}
