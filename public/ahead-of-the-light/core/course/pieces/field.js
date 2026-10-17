// Ahead of the Light: the knot fields the later legs share (final.md 11.5): lab A's swarm generalised so each leg can
// give it its own twist (Virgo's galaxy groups, Orion's flaring young stars and MAKO's doubled knots, the asteroid
// belt's rubble) without writing a new swarm each time. Not a piece: the pieces in virgo.js, local.js, milkyway.js,
// orion.js and earth.js call these. Pure: integer RNG and + − × ÷ only.
import { knot, wall, fuel, jit, coin } from '../kinds.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const between = (rnd, [lo, hi]) => lo + rnd() * (hi - lo);

// Knots on half-beat slots round a drifting line. Most sit to one side of the line (o.off from it, the side flipping
// four times in five); about one in eight (o.hop) sits on it, so you must hop. o.both puts a second knot on the other
// side of the line in the same slot; o.twin doubles a side knot 12 to 20° further out (too close to pass between, so a
// shove into the pair is a takedown). Every o.forks beats a FORK: a wall with two 46° gaps either side of the line, a
// fuel slot a hairline inside one of them (the safe gap or the rich one); o.forkName names the wall. Every o.fuel beats
// a fuel slot a hairline inside a side knot, toward the line (o.fuel 0: none). o.make turns (beat, psi, half, opt) into
// the slot's item (a knot by default, or a pulse). At most o.cap hazards pass in any 2.5 beats, and never more than 3
// slots in a row are empty. → { items, line } with line the line's bearing at the last slot.
export function lineField(ctx, o = {}) {
  const { rnd } = ctx;
  const b0 = o.b0 ?? 1, b1 = o.b1 ?? ctx.len - 1;
  const fill = clamp(o.fill ?? 0.92 * (ctx.density || 1), 0.3, 1);
  const half = o.half || [2, 4], off = o.off || [9, 23];
  const make = o.make || ((b, psi, h, opt) => knot(b, psi, h, { opt }));
  const cap = o.cap ?? 6, every = o.fuel ?? 8, hop = o.hop ?? 0.12, cells = every > 0;
  const both = o.both ?? 0, twin = o.twin ?? 0;
  const items = [], counts = [];
  let line = o.line ?? 0, vel = 0, side = coin(rnd), lastFuel = -Infinity, empties = 0;
  const forks = [];
  if (o.forks) for (let b = b0 + o.forks - 2; b <= b1 - 3; b += o.forks) forks.push(b);
  const slots = Math.max(0, Math.floor((b1 - b0) * 2) + 1);
  for (let i = 0; i < slots; i++) {
    const beat = b0 + i / 2;
    if (i % 8 === 0) vel = jit(rnd, o.vel ?? 9);
    line += vel;
    const recent = counts.slice(-4).reduce((a, b) => a + b, 0);
    const room = cap - recent;
    const fork = forks.find((b) => Math.abs(beat - b) <= 1);
    if (fork !== undefined) {
      empties = 0;
      if (beat === fork && room >= 1) {
        const d = 38 + rnd() * 17, rich = coin(rnd);
        items.push(wall(beat, [{ psi: line - d, w: 46, tag: 'fork' }, { psi: line + d, w: 46, tag: 'fork' }],
          o.forkName ? { name: o.forkName } : {}));
        if (cells) items.push(fuel(beat, line + rich * (d + 23 - 4.5)));
        counts.push(1);
      } else counts.push(0);
      continue;
    }
    const r = rnd();
    const must = empties >= 3;
    if (room < 1 || (!must && rnd() > fill)) { empties++; counts.push(0); continue; }
    empties = 0;
    let n = 0;
    let offv;
    if (r < hop) offv = jit(rnd, 3);
    else {
      side = rnd() < 0.8 ? -side : side;
      offv = side * between(rnd, off);
    }
    const h = between(rnd, half);
    const s = offv >= 0 ? 1 : -1;
    let cell = false;
    if (cells && Math.abs(offv) >= 14 && beat - lastFuel >= every && beat <= b1 - 1) {
      // a fuel slot a hairline inside the knot, toward the line; its anchor knot stays through a breather
      items.push(fuel(beat, line + offv - s * (h + 4.5)));
      lastFuel = beat;
      cell = true;
    }
    items.push(make(beat, line + offv, h, !cell));
    n++;
    if (!cell && Math.abs(offv) >= 9 && room - n >= 1 && rnd() < twin) {
      items.push(make(beat, line + offv + s * (12 + rnd() * 8), between(rnd, half), true));
      n++;
    }
    if (!cell && room - n >= 1 && rnd() < both) {
      const o2 = -(Math.abs(offv) >= 9 ? s : coin(rnd)) * between(rnd, [Math.max(10, off[0]), off[1] + 6]);
      items.push(make(beat, line + o2, between(rnd, half), true));
      n++;
    }
    counts.push(n);
  }
  return { items, line };
}

// Knots spread over an arc of the ring rather than round a line: on each half-beat slot, up to o.per knots at random
// bearings inside [o.from, o.to] (degrees, from < to), each at least o.space from the others in its slot and from
// the slot before. At most o.cap hazards pass in any 2.5 beats. o.make as in lineField. Every o.fuel beats a fuel
// slot a hairline off a lone knot, on the side toward the arc's middle. → { items }
export function arcField(ctx, o) {
  const { rnd } = ctx;
  const b0 = o.b0 ?? 1, b1 = o.b1 ?? ctx.len - 1;
  const half = o.half || [2, 4], per = o.per ?? 1, space = o.space ?? 26, cap = o.cap ?? 6;
  const fill = clamp(o.fill ?? 0.9, 0.2, 1), every = o.fuel ?? 0;
  const make = o.make || ((b, psi, h, opt) => knot(b, psi, h, { opt }));
  const items = [], counts = [];
  let prev = [], lastFuel = -Infinity;
  const slots = Math.max(0, Math.floor((b1 - b0) * 2) + 1);
  const span = o.to - o.from;
  for (let i = 0; i < slots; i++) {
    const beat = b0 + i / 2;
    const room = cap - counts.slice(-4).reduce((a, b) => a + b, 0);
    const here = [];
    for (let k = 0; k < per && here.length < room; k++) {
      if (rnd() > fill) continue;
      let psi = null;
      for (let tries = 0; tries < 6 && psi === null; tries++) {
        const p = o.from + rnd() * span;
        if ([...here, ...prev].every((q) => Math.abs(q - p) >= space)) psi = p;
      }
      if (psi !== null) here.push(psi);
    }
    for (const psi of here) {
      const h = between(rnd, half);
      let opt = true;
      if (every && beat - lastFuel >= every && beat <= b1 - 1 && here.length === 1) {
        // the cell sits on the knot's side toward the arc's middle, a hairline off it (the arc's ends may meet
        // another field)
        const s = psi - (o.from + o.to) / 2 >= 0 ? -1 : 1;
        items.push(fuel(beat, psi + s * (h + 4.5)));
        lastFuel = beat;
        opt = false;
      }
      items.push(make(beat, psi, h, opt));
    }
    counts.push(here.length);
    prev = here;
  }
  return { items };
}
