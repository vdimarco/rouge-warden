// Ahead of the Light: the hazard kinds (final.md 11.4), ported from lab A (lab/a/core.js resolve, lab/a/stage1.js
// builders). Each kind has a builder, blocked (the arcs a ship's centre may not hold, for the validator and the bots)
// and resolve (the pass rule every ship uses). Pure: no clocks, no trig.
//
// Bearings are degrees, + to the right, stored wrapped to [−180, 180). Beats count from the leg's start (or from a
// piece's start while a piece builds them). Half-widths are degrees.
//
//   knot    { beat, psi, half }                      a mass you pass at its beat
//   gate    { beat, psi, gap, halves, names, dock }  two giants with a THREAD gap (edge to edge) and a DOCK ring;
//           pair: true marks a mid-leg pair (no dock), which pays the pair's thread
//   wall    { beat, psi, gaps: [{ psi, w, tag }] }   a ring of mass; w is a gap's full width; outside every gap hits
//   rail    { beat, end, psi, half, omega, breaks, skimBand, skimX }   a filament from beat to end; omega turns it
//           (degrees a beat); breaks: [[b0, b1]] beats with no rail
//   well    { beat, psi, size, exits: [psi, psi], name }   a mass you can grab; its core passes like a knot
//   pickup  { beat, psi, type: 'fuel' | 'patch', slot }   a slot until gen.js picks it; band: true marks a pickup
//           on a well's exit band (R7 anchors it, R10 lets it sit in the open); must: true always spawns
//   pulse   { beat, psi, half0, half1, period, phase }  a knot that swells; its size at its pass is halfAt(item)
//   fog     { beat, end, arcs: [[from, to]], type: 'dust' }   no hit; hazards draw as silhouettes inside it
//   cue     { beat, name, data }                      a moment for captions, labels and sound; never a hazard
//
// Flags any item may carry: opt (the director may drop it), preview (a tick 3 s ahead), dark (drawn dark until
// 0.5 s out), soft (leg 1's 12° graze band), name, tag, piece (the piece id that placed it), sec (its section).
// Cue names the pieces use: launch, steer, skim, burn, whip, ram, wallRide, rail, landmark, gateCall, gate, vista,
// drifter (data.psi: where the slowest drifter meets its hard moment), jetEnd and the like for later legs.
import { TUNE } from '../tune.js';

export const KINDS = Object.freeze(['knot', 'wall', 'rail', 'gate', 'well', 'pickup', 'pulse', 'fog', 'cue']);
// Kinds that pass at one beat (instant) and kinds that last from beat to end.
export const INSTANT = Object.freeze(['knot', 'wall', 'gate', 'well', 'pulse']);
export const LASTING = Object.freeze(['rail', 'fog']);

export const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- builders (relative to a piece while it builds; gen.js places them) ----------

export const knot = (beat, psi, half = 3.5, extra = {}) => ({ kind: 'knot', beat, psi, half, ...extra });

// Two knots side by side as one item: thread the gap between them. gap is edge to edge.
export const pair = (beat, psi, gap, half = 3.5, extra = {}) =>
  ({ kind: 'gate', beat, psi, gap, halves: [half, half], pair: true, ...extra });

// A landmark gate: giants of halves [left, right] round a THREAD gap (edge to edge), and the DOCK ring.
export const gate = (beat, psi, gap, halves, names, dock, extra = {}) =>
  ({ kind: 'gate', beat, psi, gap, halves: [...halves], names: [...names], dock: { ...dock }, ...extra });

// A wall with one or more gaps: gaps [{ psi, w, tag }]. psi is the first gap's centre.
export const wall = (beat, gaps, extra = {}) => {
  const g = gaps.map((x) => ({ psi: x.psi, w: x.w, tag: x.tag || null }));
  return { kind: 'wall', beat, psi: g[0].psi, gaps: g, ...extra };
};

export const rail = (beat, end, psi, half = 1.5, extra = {}) =>
  ({ kind: 'rail', beat, end, psi, half, omega: 0, breaks: [], skimBand: 6, skimX: 1, ...extra });

// A knot with a short thin rail behind it: ride the tail to skim, cross it and you hit.
export const tail = (beat, psi, half = 3.5, len = 2.5, extra = {}) => [
  knot(beat, psi, half, extra),
  rail(beat, beat + len, psi, 1, { ...extra, tag: 'tail' }),
];

export const well = (beat, psi, size = 'medium', exits = [], name = null, extra = {}) =>
  ({ kind: 'well', beat, psi, size, exits: [...exits], name, ...extra });

export const fuel = (beat, psi, extra = {}) => ({ kind: 'pickup', type: 'fuel', beat, psi, slot: 'fuel', ...extra });
export const patch = (beat, psi, extra = {}) =>
  ({ kind: 'pickup', type: 'patch', beat, psi, slot: 'patch', ...extra });

export const pulse = (beat, psi, half0, half1, period = 2, extra = {}) =>
  ({ kind: 'pulse', beat, psi, half0, half1, period, phase: 0.5, ...extra });

export const fog = (beat, end, arcs = [[-180, 180]], extra = {}) =>
  ({ kind: 'fog', beat, end, arcs: arcs.map((a) => [a[0], a[1]]), type: 'dust', ...extra });

export const cue = (beat, name, data = {}) => ({ kind: 'cue', beat, name, data: { ...data } });

// A piece (11.5): data plus a builder. build(ctx) returns { items, exit } in the piece's own frame (beats from its
// start, bearings from its entry line, + to the right); exit is the safe line as it ends. ctx: { len, p (the rolled
// params), rnd, density, legNo, type, skin, T (tune), mods, first, lane }. params: at most three integer ranges;
// safe: params the tests prove; beats: [lo, hi] or 'rest'; teach: { runs } (while fewer runs were played) or { key }
// (while seen[key] is unset); repeat: may come back in a run (swarms, breathers, gates); fixed: only its side moves.
export function piece(def) {
  return Object.freeze({ roles: [], beats: [8, 16], params: {}, safe: {}, diff: 1, teach: null, repeat: false,
    fixed: false, leg: null, ...def });
}

// Small seeded helpers for builders: a value in [−d, d], an integer in [lo, hi], a sign.
export const jit = (rnd, d) => (rnd() * 2 - 1) * d;
export const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
export const coin = (rnd) => (rnd() < 0.5 ? -1 : 1);

// ---------- placing a relative item on the leg ----------

// Move an item a piece built (beats from the piece's start, bearings from its entry line) onto the leg: beat + b0,
// bearing anchor + m × psi (m = −1 mirrors). Mirroring swaps a gate's left and right giants.
export function place(item, b0, anchor, m = 1) {
  const at = (p) => r2(wrap(anchor + m * p));
  const o = { ...item, beat: item.beat + b0 };
  if (o.psi !== undefined) o.psi = at(item.psi);
  if (o.end !== undefined) o.end = item.end + b0;
  switch (item.kind) {
    case 'rail':
      o.omega = m * (item.omega || 0);
      o.breaks = (item.breaks || []).map(([a, b]) => [a + b0, b + b0]);
      break;
    case 'wall':
      o.gaps = item.gaps.map((g) => ({ ...g, psi: at(g.psi) }));
      o.psi = o.gaps[0].psi;
      break;
    case 'gate':
      if (m < 0) {
        o.halves = [item.halves[1], item.halves[0]];
        if (item.names) o.names = [item.names[1], item.names[0]];
      } else {
        o.halves = [...item.halves];
        if (item.names) o.names = [...item.names];
      }
      if (item.dock) o.dock = { ...item.dock, psi: at(item.dock.psi) };
      break;
    case 'well':
      o.exits = item.exits.map(at);
      break;
    case 'fog':
      o.arcs = item.arcs.map(([a, b]) => {
        const lo = m > 0 ? a : -b, hi = m > 0 ? b : -a;
        if (hi - lo >= 360) return [-180, 180];
        const from = r2(wrap(anchor + lo));
        return [from, r2(from + (hi - lo))];
      });
      break;
    case 'cue':
      o.data = { ...item.data };
      if (typeof item.data.psi === 'number') o.data.psi = at(item.data.psi);
      break;
    default:
  }
  return o;
}

// ---------- geometry ----------

// An item's bearing at a beat: a turning rail (omega, degrees a beat) turns from its start; everything else stays.
export function psiAt(item, beat) {
  return (item.psi || 0) + (item.omega ? item.omega * (beat - item.beat) : 0);
}

// A pulse's half-width at a beat: a triangle wave between half0 and half1 with its period in beats. At its own beat
// it is at half0 + (half1 − half0) × tri(phase); phase 0.5 (the default) passes at its largest.
export function halfAt(item, beat = item.beat) {
  if (item.kind !== 'pulse') return item.half || 0;
  const x = (beat - item.beat) / (item.period || 1) + (item.phase ?? 0.5);
  const f = x - Math.floor(x);
  const tri = 1 - Math.abs(2 * f - 1);
  return item.half0 + (item.half1 - item.half0) * tri;
}

// The core half-width a well passes with (its mass, as a knot), from the tuning table's well sizes.
export const wellCore = (item, tune = TUNE) => ((tune.WELLS && tune.WELLS[item.size]) || TUNE.WELLS.medium).core;
export const wellReach = (item, tune = TUNE) => ((tune.WELLS && tune.WELLS[item.size]) || TUNE.WELLS.medium).reach;

// Is a rail there at this beat (inside [beat, end) and outside its breaks)?
export function railOn(item, beat) {
  if (!(beat >= item.beat && beat < item.end)) return false;
  for (const [a, b] of item.breaks || []) if (beat >= a && beat < b) return false;
  return true;
}

// The half-width an instant kind passes with (knots and wells as masses, pulses at their pass size).
function massHalf(item, tune) {
  if (item.kind === 'well') return wellCore(item, tune);
  if (item.kind === 'pulse') return halfAt(item, item.beat);
  return item.half || 0;
}

const arc = (out, centre, half) => {
  if (half >= 180) { out.push([-180, 180]); return; }
  const from = wrap(centre - half);
  out.push([from, from + 2 * half]);
};

// The arcs a ship's centre may not hold at this beat, appended to out as [from, to] pairs (open intervals, degrees,
// from in [−180, 180), to = from + width, so an arc may run past 180). Instant kinds (knot, pulse, well, wall, gate)
// block only as they pass, so they give their arcs at their own beat whatever `beat` says; a rail blocks while it is
// on. shipHalf: the ship's half-width (3.5° for LANTERN; a rival's or another ship's for theirs).
export function blocked(item, beat = item.beat, out = [], shipHalf = TUNE.SHIP_HALF, tune = TUNE) {
  const S = shipHalf;
  switch (item.kind) {
    case 'knot': case 'pulse': case 'well':
      arc(out, item.psi, massHalf(item, tune) + S);
      break;
    case 'rail':
      if (railOn(item, beat)) arc(out, psiAt(item, beat), item.half + S);
      break;
    case 'gate': {
      const [hl, hr] = item.halves, g = item.gap / 2;
      const from1 = wrap(item.psi - g - 2 * hl - S);
      out.push([from1, from1 + 2 * hl + 2 * S]);
      const from2 = wrap(item.psi + g - S);
      out.push([from2, from2 + 2 * hr + 2 * S]);
      break;
    }
    case 'wall': {
      // the open part of each gap for a ship's centre, sorted round the ring; the arcs between them are blocked
      const open = [];
      for (const gp of item.gaps) {
        const h = gp.w / 2 - S;
        if (h >= 0) open.push([wrap(gp.psi - h), 2 * h]);
      }
      if (!open.length) { out.push([-180, 180]); break; }
      open.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < open.length; i++) {
        const end = open[i][0] + open[i][1];
        const next = i + 1 < open.length ? open[i + 1][0] : open[0][0] + 360;
        if (next > end) out.push([wrap(end), wrap(end) + (next - end)]);
      }
      break;
    }
    default:
  }
  return out;
}

// Is a bearing inside any [from, to] arc of a list (open intervals)?
export function inArcs(arcs, bearing) {
  for (const [from, to] of arcs) {
    if (to - from >= 360) return true;
    const d = (((bearing - from) % 360) + 360) % 360;
    if (d > 0 && d < to - from) return true;
  }
  return false;
}

const MISS = Object.freeze({ hit: false, overlap: Infinity, gaps: Object.freeze([]), thread: false, tag: null });

// The pass rule for a ship centred at `bearing` meeting this item at `beat`:
//   { hit, overlap, gaps: [{ g, side }], thread, tag }
// overlap: the smallest edge gap (degrees; under 0 is a hit). gaps: each edge passed and its gap; side +1 means the
// edge is to the ship's right. thread: it passed through a gate's or pair's gap. tag: a gap's tag on a wall, 'dock'
// inside a gate's DOCK ring, 'well' on a well's core, the pickup's type, 'dust' inside fog. A pickup also gives
// take: true when it is within PICK_DEG of the ship's edge. Lab A's resolve, extended to every kind.
export function resolve(item, bearing, beat = item.beat, tune = TUNE, shipHalf = tune.SHIP_HALF ?? TUNE.SHIP_HALF) {
  const S = shipHalf;
  switch (item.kind) {
    case 'knot': case 'pulse': case 'well': {
      const d = wrap(bearing - item.psi), a = Math.abs(d), sd = d >= 0 ? 1 : -1;
      const g = a - S - massHalf(item, tune);
      return { hit: g < 0, overlap: g, gaps: g < 0 ? [] : [{ g, side: -sd }], thread: false,
        tag: item.kind === 'well' ? 'well' : item.tag || null };
    }
    case 'rail': {
      if (!railOn(item, beat)) return MISS;
      const d = wrap(bearing - psiAt(item, beat)), a = Math.abs(d), sd = d >= 0 ? 1 : -1;
      const g = a - S - item.half;
      return { hit: g < 0, overlap: g, gaps: g < 0 ? [] : [{ g, side: -sd }], thread: false, tag: item.tag || 'rail' };
    }
    case 'wall': {
      let best = -Infinity, bestGap = null, bestD = 0;
      for (const gp of item.gaps) {
        const d = wrap(bearing - gp.psi);
        const inner = gp.w / 2 - Math.abs(d) - S;
        if (inner > best) { best = inner; bestGap = gp; bestD = d; }
      }
      if (!bestGap || best < 0) return { hit: true, overlap: best, gaps: [], thread: false, tag: null };
      const a = Math.abs(bestD), sd = bestD >= 0 ? 1 : -1;
      return { hit: false, overlap: best, gaps: [{ g: best, side: sd }, { g: bestGap.w / 2 + a - S, side: -sd }],
        thread: false, tag: bestGap.tag || null };
    }
    case 'gate': {
      const d = wrap(bearing - item.psi), a = Math.abs(d), sd = d >= 0 ? 1 : -1, g = item.gap / 2;
      const inner = g - a - S;
      if (inner >= 0) {
        return { hit: false, overlap: inner, gaps: [{ g: inner, side: sd }, { g: g + a - S, side: -sd }],
          thread: true, tag: item.pair ? 'pair' : 'thread' };
      }
      const h = d >= 0 ? item.halves[1] : item.halves[0];
      const outer = a - (g + 2 * h) - S;
      if (outer >= 0) {
        const dock = item.dock && Math.abs(wrap(bearing - item.dock.psi)) <= item.dock.w / 2;
        return { hit: false, overlap: outer, gaps: [{ g: outer, side: -sd }], thread: false,
          tag: dock ? 'dock' : item.pair ? null : 'past' };
      }
      return { hit: true, overlap: Math.max(inner, outer), gaps: [], thread: false, tag: null };
    }
    case 'pickup': {
      const a = Math.abs(wrap(bearing - item.psi)), g = a - S;
      return { hit: false, overlap: g, gaps: [], thread: false, tag: item.type,
        take: g <= (tune.PICK_DEG ?? TUNE.PICK_DEG) };
    }
    case 'fog': {
      const on = beat >= item.beat && beat < item.end && inArcs(item.arcs, bearing);
      return { hit: false, overlap: Infinity, gaps: [], thread: false, tag: on ? item.type || 'dust' : null };
    }
    default:
      return MISS;
  }
}

// The smallest edge gap for an item at a bearing (negative is a hit): lab A's edgeGap.
export function edgeGap(item, bearing, beat = item.beat, tune = TUNE) {
  const r = resolve(item, bearing, beat, tune);
  if (r.hit) return r.overlap;
  return r.gaps.reduce((m, x) => Math.min(m, x.g), Infinity);
}

// Is this item a hazard (something a ship can hit)?
export const isHazard = (item) => item.kind !== 'cue' && item.kind !== 'pickup' && item.kind !== 'fog';
