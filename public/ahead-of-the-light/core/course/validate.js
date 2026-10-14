// Ahead of the Light: the leg validator (final.md 11.8; design-tech 7). It checks R1 to R13 on every generated leg.
// R3 (a path exists) and R4 (no traps) run on a grid of 360 one-degree bins and 8 sub-steps a beat, each row packed
// into 12 words, with rails blocking while they last and never crossed. Pure.
import { TUNE } from '../tune.js';
import { LEG_TYPES, ROUTE } from './legs.js';
import { blocked, psiAt, railOn, wrap, wellCore, wellReach, isHazard, INSTANT } from './kinds.js';

export const SUB = 8;                       // sub-steps a beat
const W = 12;                               // words a row (384 bits; bins 0..359 used)
const TOP = 0xff;                           // the bits of the last word in use (bins 352..359)
export const DEFAULTS = Object.freeze({ turn: 240, humanTurn: 200, react: 0.35, tick: 1.3, bps: 2.702, ring: 2.5 });
export const RULES = Object.freeze(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13']);

// ---------- packed rows ----------
const row = () => new Uint32Array(W);
const binOf = (b) => ((Math.round(b) + 180) % 360 + 360) % 360;
const setBin = (r, i) => { r[i >>> 5] |= 1 << (i & 31); };
const getBin = (r, i) => (r[i >>> 5] >>> (i & 31)) & 1;
function count(r) {
  let n = 0;
  for (let i = 0; i < W; i++) { let v = r[i]; while (v) { v &= v - 1; n++; } }
  return n;
}
const empty = (r) => { for (let i = 0; i < W; i++) if (r[i]) return false; return true; };

// Bins whose bearing (an integer, bin − 180) lies strictly inside the arc (from, to).
function setArc(r, from, to) {
  if (to - from >= 360) { r.fill(0xffffffff); r[W - 1] = TOP; return; }
  for (let b = Math.floor(from) + 1; b < to; b++) {
    if (b <= from) continue;
    setBin(r, binOf(b));
  }
}

// One step round the ring both ways (bin 359 wraps to 0), into out.
function spread(src, out) {
  let carry = (src[W - 1] >>> 7) & 1;                  // bin 359 → bin 0
  for (let i = 0; i < W; i++) {
    const v = src[i];
    const left = ((v << 1) | carry) >>> 0;            // bin i → i + 1
    carry = v >>> 31;
    out[i] = left;
  }
  out[W - 1] &= TOP;
  let borrow = src[0] & 1;                              // bin 0 → bin 359
  for (let i = W - 1; i >= 0; i--) {
    const v = src[i];
    const right = (v >>> 1) | ((i < W - 1 ? src[i + 1] & 1 : 0) << 31);
    out[i] |= right >>> 0;
  }
  if (borrow) out[W - 1] |= 1 << 7;
  out[W - 1] &= TOP;
}

// Grow a set by `per` bins each way, never into a wall bin (so never across it).
const TMP = row(), TMP2 = row();
function expand(set, per, wall, out) {
  out.set(set);
  for (let s = 0; s < per; s++) {
    spread(out, TMP);
    let grew = false;
    for (let i = 0; i < W; i++) {
      const v = (out[i] | (TMP[i] & ~wall[i])) >>> 0;
      if (v !== out[i]) grew = true;
      out[i] = v;
    }
    if (!grew) break;
  }
  return out;
}

// ---------- the grid ----------
// inst[k]: bins blocked by instants passing in sub-step k; rail[k]: bins under a rail during it; starts: the sub-steps
// where something passes (instants and rail fronts).
export function grid(leg, tune = TUNE) {
  const S = tune.SHIP_HALF;
  const steps = Math.ceil(leg.beats * SUB) + SUB;
  const inst = [], rail = [];
  for (let k = 0; k < steps; k++) { inst.push(row()); rail.push(row()); }
  const starts = new Set();
  const arcs = [];
  for (const it of leg.items) {
    if (!isHazard(it)) continue;
    if (it.kind === 'rail') {
      const k0 = Math.max(0, Math.floor(it.beat * SUB)), k1 = Math.min(steps - 1, Math.ceil(it.end * SUB));
      starts.add(k0);
      const slide = Math.abs(it.omega || 0) / (2 * SUB);
      for (let k = k0; k <= k1; k++) {
        const bm = (k + 0.5) / SUB;
        if (!railOn(it, bm)) continue;
        const c = psiAt(it, bm), h = it.half + S + slide;
        setArc(rail[k], c - h, c + h);
      }
      continue;
    }
    const k = Math.floor(it.beat * SUB);
    if (k < 0 || k >= steps) continue;
    starts.add(k);
    arcs.length = 0;
    blocked(it, it.beat, arcs, S, tune);
    for (const [from, to] of arcs) setArc(inst[k], from, to);
  }
  return { steps, inst, rail, starts: [...starts].sort((a, b) => a - b) };
}

const perStep = (degPerS, bps) => Math.max(1, Math.round(degPerS / (bps * SUB)));

// R3: forward reachability from bearing 0 at `turn`°/s. → { ok, beat, sets }
export function corridor(g, opts) {
  const per = perStep(opts.turn, opts.bps);
  let R = row();
  setBin(R, 180);
  const sets = [];
  for (let k = 0; k < g.steps; k++) {
    const N = expand(R, per, g.rail[k], row());
    for (let i = 0; i < W; i++) N[i] &= ~(g.inst[k][i] | g.rail[k][i]);
    sets.push(N);
    if (empty(N)) return { ok: false, beat: k / SUB, sets };
    R = N;
  }
  return { ok: true, beat: null, sets };
}

// R4: for each sub-step k where something passes, a ship that sees it `tick` seconds ahead and starts to move
// `react` seconds later must still reach a safe bin at k at `humanTurn`°/s, past everything in between. It starts
// from any bearing it could hold then (the forward set) from which everything passing before k is survivable (it
// saw those earlier, so it is already placed for them); a bearing from which k is not survivable is doomed.
// → { worst, beat, doomed }
const backward = (g, k, q0, per, B, N, withK) => {
  for (let i = 0; i < W; i++) B[i] = withK ? ~(g.inst[k][i] | g.rail[k][i]) >>> 0 : 0xffffffff;
  B[W - 1] &= TOP;
  for (let q = k - 1; q >= q0; q--) {
    expand(B, per, g.rail[q + 1], N);
    for (let i = 0; i < W; i++) B[i] = N[i] & ~(g.rail[q][i] | g.inst[q][i]);
  }
  return B;
};
export function traps(g, sets, opts) {
  const per = perStep(opts.humanTurn, opts.bps);
  const h = Math.max(1, Math.round((opts.tick - opts.react) * opts.bps * SUB));
  let worst = 0, at = null, doomed = 0;
  const B = row(), P = row(), N = row(), D = row();
  for (const k of g.starts) {
    if (k >= g.steps) continue;
    const q0 = Math.max(0, k - h);
    backward(g, k, q0, per, B, N, true);
    backward(g, k, q0, per, P, N, false);
    const start = sets[q0];
    let total = 0;
    for (let i = 0; i < W; i++) { P[i] &= start[i]; D[i] = P[i] & ~B[i]; }
    const n = count(D);
    if (n) {
      total = count(P);
      const frac = n / Math.max(1, total);
      doomed++;
      if (frac > worst) { worst = frac; at = k / SUB; }
    }
  }
  return { worst, beat: at, doomed };
}

// ---------- helpers for the count rules ----------
const sectionAt = (leg, beat) => (leg.sections || []).find((s) => beat >= s.b0 && beat < s.b1) || null;
const hazards = (leg) => leg.items.filter(isHazard);

// The free bins (no hazard arc, ship half `half`) at a beat: instants within `win` beats and rails on.
function freeAt(leg, beat, win, half, tune) {
  const free = new Uint8Array(360).fill(1);
  const arcs = [];
  for (const it of leg.items) {
    if (!isHazard(it)) continue;
    if (it.kind === 'rail') { if (!railOn(it, beat)) continue; }
    else if (Math.abs(it.beat - beat) > win) continue;
    arcs.length = 0;
    if (it.kind === 'rail') {
      const c = psiAt(it, beat), w = it.half + half;
      arcs.push([wrap(c - w), wrap(c - w) + 2 * w]);
    } else blocked(it, it.beat, arcs, half, tune);
    for (const [from, to] of arcs) {
      if (to - from >= 360) { free.fill(0); continue; }
      for (let b = Math.floor(from) + 1; b < to; b++) if (b > from) free[binOf(b)] = 0;
    }
  }
  return free;
}

// The shortest way round from bearing b to a free bin (degrees), or Infinity.
function toFree(free, b) {
  const i0 = binOf(b);
  for (let d = 0; d <= 180; d++) if (free[(i0 + d) % 360] || free[(i0 - d + 360) % 360]) return d;
  return Infinity;
}

// The time from a press to a band reached `a`° round, at the sweep's speed (5.3), and the sweep's speed there.
function sweepT(a, T) {
  const k = (T.SWEEP1 - T.SWEEP0) / T.SWEEP_A;
  if (a <= T.SWEEP_A) return Math.log((T.SWEEP0 + k * a) / T.SWEEP0) / k;
  return Math.log(T.SWEEP1 / T.SWEEP0) / k + (a - T.SWEEP_A) / T.SWEEP1;
}
const sweepV = (a, T) => T.SWEEP0 + (T.SWEEP1 - T.SWEEP0) * Math.min(a, T.SWEEP_A) / T.SWEEP_A;
const mod360 = (v) => ((v % 360) + 360) % 360;

// Validate a leg (buildLeg's, or any { beats, items, sections, legNo, type, lane }). opts: DEFAULTS plus tune,
// rules (a subset of RULES to run), keep (return the corridor rows for the strip).
// → { ok, errors: [{ rule, beat, msg }], rules: { R1: { ok, worst, beat }, ... }, passes, quiet, trap, corridor }
export function validateLeg(leg, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const T = o.tune || TUNE;
  const run = new Set(o.rules || RULES);
  const errors = [];
  const rules = {};
  const fail = (rule, beat, msg) => { errors.push({ rule, beat, msg }); };
  const items = leg.items || [];
  const haz = hazards(leg);
  const def = LEG_TYPES[leg.type] || null;
  const legNo = leg.legNo ?? Math.max(0, ROUTE.indexOf(leg.type));
  const lane = leg.lane || {};

  // R1: hazards inside the ring at once (passing within `ring` beats ahead); 5 in a swarm
  if (run.has('R1')) {
    const beats = haz.filter((it) => it.kind !== 'rail').map((it) => it.beat).sort((a, b) => a - b);
    const rails = haz.filter((it) => it.kind === 'rail');
    let worst = 0, wb = 0, j0 = 0, j1 = 0;
    for (let k = 0; k < leg.beats * SUB; k++) {
      const b = k / SUB;
      while (j0 < beats.length && beats[j0] <= b) j0++;
      while (j1 < beats.length && beats[j1] <= b + o.ring) j1++;
      let n = j1 - j0;
      for (const r of rails) if (r.beat <= b + o.ring && r.end > b) n++;
      const sec = sectionAt(leg, b + o.ring / 2);
      const cap = sec && sec.role === 'crescendo' && sec.id === 'swarm' ? 5 : 7;
      if (n > worst) { worst = n; wb = b; }
      if (n > cap) { fail('R1', b, `${n} hazards inside the ring (most ${cap})`); break; }
    }
    rules.R1 = { ok: !errors.some((e) => e.rule === 'R1'), worst, beat: wb };
  }

  // R2: in a swarm, a gap of at least 30° within 60° of every bearing (among its knots and any rail beside them)
  if (run.has('R2')) {
    let ok = true, at = null;
    const seen = new Set();
    for (const it of items) {
      if (it.piece !== 'swarm' || (it.kind !== 'knot' && it.kind !== 'pulse') || seen.has(it.beat)) continue;
      seen.add(it.beat);
      const free = freeAt({ items: items.filter((x) => x.kind === 'knot' || x.kind === 'pulse' || x.kind === 'rail') },
        it.beat, 0.5, 0, T);
      const good = new Uint8Array(360);
      let run30 = 0;
      for (let i = 0; i < 720; i++) {
        if (free[i % 360]) run30++; else run30 = 0;
        if (run30 >= 30) for (let d = 0; d < 30; d++) good[(i - d + 720) % 360] = 1;
      }
      let covered = true;
      for (let i = 0; i < 360 && covered; i++) {
        let near = false;
        for (let d = 0; d <= 60 && !near; d++) near = good[(i + d) % 360] || good[(i - d + 360) % 360];
        covered = near;
      }
      if (!covered) { ok = false; at = it.beat; fail('R2', it.beat, 'no 30° gap within 60° of every bearing'); break; }
    }
    rules.R2 = { ok, beat: at };
  }

  // R3 and R4: the corridor and the trap check
  let g = null, cor = null;
  if (run.has('R3') || run.has('R4') || o.keep) {
    g = grid(leg, T);
    cor = corridor(g, o);
    rules.R3 = { ok: cor.ok, beat: cor.beat };
    if (!cor.ok && run.has('R3')) fail('R3', cor.beat, 'no path at 240°/s');
  }
  let trap = null;
  if (run.has('R4') && cor) {
    trap = cor.ok ? traps(g, cor.sets, o) : { worst: 1, beat: cor.beat, doomed: 1 };
    rules.R4 = { ok: trap.worst === 0, worst: trap.worst, beat: trap.beat };
    if (trap.worst > 0) fail('R4', trap.beat, `trap: ${Math.round(trap.worst * 100)} % of bearings doomed`);
  }

  // R5: a turn over 120° from one line-defining item (wall, gate, pair) to the next within 2 beats needs a preview
  if (run.has('R5')) {
    let ok = true, at = null;
    const lines = items.filter((it) => it.kind === 'wall' || it.kind === 'gate').sort((a, b) => a.beat - b.beat);
    for (let i = 1; i < lines.length; i++) {
      const X = lines[i];
      const prev = lines.slice(0, i).filter((Y) => Y.beat >= X.beat - 2 && Y.beat < X.beat);
      if (!prev.length || X.preview) continue;
      const fx = freeAt({ items: [X] }, X.beat, 0, T.SHIP_HALF, T);
      for (const Y of prev) {
        const fy = freeAt({ items: [Y] }, Y.beat, 0, T.SHIP_HALF, T);
        let need = Infinity;
        for (let b = 0; b < 360; b++) if (fy[b]) need = Math.min(need, toFree(fx, b - 180));
        if (need > 120) { ok = false; at = X.beat; fail('R5', X.beat, `a ${need}° turn in 2 beats with no preview`); }
      }
    }
    rules.R5 = { ok, beat: at };
  }

  // R6: wells at least 11 beats apart
  const wells = items.filter((it) => it.kind === 'well').sort((a, b) => a.beat - b.beat);
  if (run.has('R6')) {
    let ok = true, at = null;
    for (let i = 1; i < wells.length; i++) {
      if (wells[i].beat - wells[i - 1].beat < 11) {
        ok = false; at = wells[i].beat;
        fail('R6', at, `wells ${(wells[i].beat - wells[i - 1].beat).toFixed(1)} beats apart`);
      }
    }
    rules.R6 = { ok, beat: at };
  }

  // R7: every exit band's centre lies within 10° of a real target
  if (run.has('R7')) {
    let ok = true, at = null;
    for (const w of wells) {
      const sec = sectionAt(leg, w.beat);
      const open = sec && sec.role === 'open';
      for (const e of w.exits) {
        let hit = open;
        for (const it of items) {
          if (hit) break;
          const db = it.beat - w.beat;
          if (it.kind === 'wall' && db >= 1 && db <= 10) hit = it.gaps.some((gp) => Math.abs(wrap(gp.psi - e)) <= 10);
          else if (it.kind === 'gate' && db >= -1 && db <= 10) {
            hit = Math.abs(wrap(it.psi - e)) <= 10 || (it.dock && Math.abs(wrap(it.dock.psi - e)) <= 10);
          } else if (it.kind === 'pickup' && db >= 0 && db <= 10) hit = Math.abs(wrap(it.psi - e)) <= 10;
          else if (it.kind === 'well' && it !== w && db > 0 && db <= 16) {
            hit = Math.abs(wrap(it.psi - e)) <= wellReach(it, T);
          }
        }
        if (!hit) { ok = false; at = w.beat; fail('R7', w.beat, `an exit band at ${e.toFixed(0)}° points at nothing`); }
      }
    }
    rules.R7 = { ok, beat: at };
  }

  // R8: every whip: GOOD at least ±150 ms; at least 2.0 s from press to scorch
  if (run.has('R8')) {
    let ok = true, at = null;
    for (const w of wells) {
      const reach = wellReach(w, T), core = wellCore(w, T), S = T.SHIP_HALF;
      const scorch = T.LATCH_S + sweepT(360 - reach - core - S, T);
      if (scorch < 2.0) { ok = false; at = w.beat; fail('R8', w.beat, `${scorch.toFixed(2)} s from press to scorch`); }
      for (const e of w.exits) {
        let best = 0;
        for (const side of [-1, 1]) {
          const grab = w.psi + side * reach / 2;
          const a = side < 0 ? mod360(grab - e) : mod360(e - grab);
          const limit = 360 - reach / 2 - core - S - T.EXIT_W / 2;
          if (a < 40 || a > limit) continue;
          best = Math.max(best, (T.EXIT_W / 2) / sweepV(a, T));
        }
        if (best < 0.15) {
          ok = false; at = w.beat;
          fail('R8', w.beat, `band at ${e.toFixed(0)}°: GOOD ±${(best * 1000).toFixed(0)} ms`);
        }
      }
    }
    rules.R8 = { ok, beat: at };
  }

  // R9: at least 4 beats of breather after a signature
  if (run.has('R9')) rules.R9 = { ok: true, skipped: true };
  if (run.has('R9') && leg.sections && !(def && def.fixedRoute) && lane.kind !== 'void') {
    let ok = true, at = null;
    leg.sections.forEach((s, i) => {
      if (s.role !== 'signature') return;
      const n = leg.sections[i + 1];
      if (!n || n.role !== 'breather' || n.b1 - n.b0 < 4) {
        ok = false; at = s.b1;
        fail('R9', s.b1, 'no breather after the signature');
      }
    });
    rules.R9 = { ok, beat: at };
  }

  // R10: pickups 6 to 14° off the safe line (the nearest bearing that grazes nothing), never on it, never inside a
  // hazard; a pickup on a well's exit band may sit in the open (R7 anchors it)
  if (run.has('R10')) {
    let ok = true, at = null;
    for (const it of items) {
      if (it.kind !== 'pickup') continue;
      const body = freeAt(leg, it.beat, 0.25, T.SHIP_HALF, T);
      if (!body[binOf(it.psi)]) { ok = false; at = it.beat; fail('R10', it.beat, `a ${it.type} inside a hazard`); continue; }
      if (it.band) continue;
      const clean = freeAt(leg, it.beat, 0.25, T.SHIP_HALF + T.GRAZE, T);
      const d = toFree(clean, it.psi);
      if (d < 5.5 || d > 14) { ok = false; at = it.beat; fail('R10', it.beat, `a ${it.type} ${d}° off the safe line`); }
    }
    rules.R10 = { ok, beat: at };
  }

  // R11: an open road of at least 12 beats in every leg from leg 2 (the belt and the void excepted)
  if (run.has('R11')) rules.R11 = { ok: true, skipped: true };
  if (run.has('R11') && leg.sections) {
    const need = legNo >= 1 && lane.kind !== 'void' && lane.kind !== 'short';
    const ok = !need || leg.sections.some((s) => s.role === 'open' && s.b1 - s.b0 >= 12);
    rules.R11 = { ok };
    if (!ok) fail('R11', 0, 'no open road of 12 beats');
  }

  // R12: passes near the leg's target, scaled by its length
  const passes = haz.length;
  if (run.has('R12')) rules.R12 = { ok: true, skipped: true, passes };
  if (run.has('R12') && def) {
    const target = def.passes * (leg.beats / def.beats);
    const ok = passes >= 0.65 * target && passes <= 1.4 * target;
    rules.R12 = { ok, passes, target: Math.round(target), ratio: Math.round((passes / target) * 100) / 100 };
    if (!ok && lane.kind !== 'void') fail('R12', 0, `${passes} passes against ${Math.round(target)}`);
  }

  // R13: generation uses no trig and no Math.random (a property of the source, checked by course.test.mjs)
  if (run.has('R13')) rules.R13 = { ok: true, static: true };

  // never empty: the longest stretch with no hazard passing, between the launch and the gate
  const hb = [...new Set(haz.flatMap((it) => (it.kind === 'rail' ? [it.beat, it.end] : [it.beat])))]
    .sort((a, b) => a - b);
  const launchEnd = leg.sections && leg.sections[0] ? leg.sections[0].b1 : 0;
  let quiet = 0, quietAt = null;
  for (let i = 1; i < hb.length; i++) {
    if (hb[i] <= launchEnd) continue;
    const from = Math.max(hb[i - 1], launchEnd);
    let covered = false;
    for (const r of haz) if (r.kind === 'rail' && r.beat <= from && r.end >= hb[i]) covered = true;
    if (!covered && hb[i] - from > quiet) { quiet = hb[i] - from; quietAt = from; }
  }

  return {
    ok: errors.length === 0, errors, rules, passes, quiet, quietAt, trap,
    corridor: o.keep && cor ? cor.sets.map((r) => runsOf(r)) : null,
  };
}

// A row's free stretches as [from, to] bearings, for the strip.
function runsOf(r) {
  const out = [];
  let start = null;
  for (let i = 0; i <= 360; i++) {
    const on = i < 360 && getBin(r, i);
    if (on && start === null) start = i;
    if (!on && start !== null) { out.push([start - 180, i - 180]); start = null; }
  }
  return out;
}

export { INSTANT };
