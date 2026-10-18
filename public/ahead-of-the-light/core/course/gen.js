// Ahead of the Light: the leg generator (final.md 11.6): hand-made pieces placed by seed, edited by the lane, its
// condition and the build's mods, validated (11.8) and hashed. Spelunky's room templates and Dead Cells' concept graph,
// scaled down. Pure: integer RNG and + − × ÷ only (no trig), so a seed builds the same leg on every device.
import { TUNE } from '../tune.js';
import { mulberry32, hashSeed } from '../../../light-years-home/core/rng.js';
import { LEG_TYPES, ROUTE, FALLBACK, FAMILY_EDITS, CONDITIONS, laneOf } from './legs.js';
import { place, blocked, wrap, coin, int, isHazard } from './kinds.js';
import { validateLeg } from './validate.js';
import { PIECES as COMMON } from './pieces/common.js';
import { PIECES as WEB } from './pieces/web.js';
import { PIECES as COMA } from './pieces/coma.js';
import { PIECES as VIRGO } from './pieces/virgo.js';
import { PIECES as LOCAL } from './pieces/local.js';
import { PIECES as MILKYWAY } from './pieces/milkyway.js';
import { PIECES as ORION } from './pieces/orion.js';
import { PIECES as NEIGHBOURS } from './pieces/neighbours.js';
import { PIECES as EARTH } from './pieces/earth.js';
import { PIECES as GATES } from './pieces/gates.js';

// Every piece by id. A piece file only has to add itself to its PIECES to plug in.
export const PIECES = Object.freeze({ ...COMMON, ...WEB, ...COMA, ...VIRGO, ...LOCAL, ...MILKYWAY, ...ORION,
  ...NEIGHBOURS, ...EARTH, ...GATES });

const ATTEMPTS = 6;                 // re-rolls of a failing section before its piece's safe params (11.6 step 9)
const SEAM = 60;                    // ° round the anchor kept clear in a piece's first beat (11.5)
const LOCAL_RULES = new Set(['R1', 'R2', 'R3', 'R4', 'R5', 'R7', 'R8', 'R10']);

export function legSeed(runSeed, type, laneId) { return hashSeed(runSeed, 'course', type, laneId); }

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
};
const idOf = (e) => (Array.isArray(e) ? e[0] : e);
const weightOf = (e) => (Array.isArray(e) ? e[1] : 1);

// Is a teaching piece still to be taught? teach.runs: while fewer runs were played (seen.runs); teach.key: while
// seen[key] is unset.
export function teaching(pc, seen = {}) {
  if (!pc.teach) return false;
  if (pc.teach.runs !== undefined) return (seen.runs || 0) < pc.teach.runs;
  if (pc.teach.key) return !seen[pc.teach.key];
  return false;
}

// The leg's sections after the lane, its family, its condition and the mods: [{ role, beats, pool, opts, force }].
function planSections(def, L, legNo, T, mods) {
  const out = [];
  const launch = legNo === 0 ? T.LAUNCH_BEATS_FIRST : T.LAUNCH_BEATS;
  if (L.kind === 'void') {
    out.push({ role: 'launch', beats: launch, pool: [] });
    out.push({ role: 'void', beats: 'rest', pool: [L.piece], opts: { density: 0.4 } });
    const g = def.sections.find((s) => s[0] === 'gate');
    out.push({ role: 'gate', beats: g[1], pool: g[2] });
    return out;
  }
  for (const [role, beats, pool, opts = {}] of def.sections) {
    if (L.drop && L.drop.includes(role)) continue;
    const s = { role, beats: role === 'launch' ? launch : beats, pool: pool || [], opts: { ...opts } };
    if (pool === 'lane') {
      s.pool = L.seq ? [] : Array.isArray(L.piece) ? L.piece : [L.piece];
      if (L.seq) s.seq = [...L.seq];
      if (L.sig === 'rest') s.beats = 'rest';
    }
    out.push(s);
  }
  const fam = L.kind === 'family' && L.fam ? FAMILY_EDITS[L.fam] : null;
  const cond = L.cond ? CONDITIONS[L.cond] : null;
  const dens = (role) => role === 'build' || role === 'crescendo';
  for (const s of out) {
    if (!dens(s.role)) continue;
    let d = s.opts.density ?? 1;
    if (L.kind === 'risk') d *= T.RISK_DENSITY;
    if (cond && cond.density) d *= cond.density;
    if (mods.density) d *= mods.density;
    s.opts.density = d;
  }
  const build = out.find((s) => s.role === 'build');
  if (fam && fam.piece && build) build.force = fam.piece;
  // TIDES' extra hub-hop takes the build, but never Earth's (it runs the planets in order: Saturn stays)
  if (cond && cond.piece && build && !build.force && !def.fixedRoute) build.force = cond.piece;
  if (fam && fam.open) {
    const open = out.find((s) => s.role === 'open');
    if (open && typeof open.beats === 'number') open.beats += fam.open;
  }
  return out;
}

// The leg's length: the route's beats × the lane's length factor, + RISK's beats, + the RIVAL family's open road.
function legLength(def, L, legNo, T) {
  let n = T.LEG_BEATS[legNo] ?? def.beats;
  if (L.kind === 'void') n = Math.round(n * T.VOID_X);
  if (L.kind === 'short') n = Math.round(n * T.BELT_X);
  if (L.kind === 'risk') n += T.RISK_BEATS;
  const fam = L.kind === 'family' && L.fam ? FAMILY_EDITS[L.fam] : null;
  if (fam && fam.open && def.sections.some((s) => s[0] === 'open')) n += fam.open;
  return n;
}

// Choose a section's pieces from its stream: teaching pieces first while unseen (once a run: a teaching piece the run
// has used is not taught again), then a weighted pick among the pieces this run has not used (a pool that `used`
// empties may repeat a common piece), then the role's fallback.
function choose(sec, rnd, ctx) {
  const { seen, usedAll } = ctx;
  const count = sec.opts && sec.opts.count ? sec.opts.count : 1;
  if (sec.seq) return sec.seq.filter((id) => PIECES[id]).map((id) => PIECES[id]);
  if (sec.force && PIECES[sec.force]) {
    const rest = count > 1 ? choose({ ...sec, force: null, opts: { ...sec.opts, count: count - 1 } }, rnd,
      { ...ctx, usedAll: new Set([...usedAll, sec.force]) }) : [];
    return [PIECES[sec.force], ...rest];
  }
  const written = sec.pool.filter((e) => PIECES[idOf(e)]);
  const teach = written.filter((e) => teaching(PIECES[idOf(e)], seen) && !usedAll.has(idOf(e)));
  if (teach.length) return [PIECES[idOf(teach[0])]];
  const able = written.filter((e) => !PIECES[idOf(e)].teach);
  const picks = [];
  const taken = new Set(usedAll);
  for (let n = 0; n < count; n++) {
    let cand = able.filter((e) => !taken.has(idOf(e)) || PIECES[idOf(e)].repeat);
    if (!cand.length) cand = able.filter((e) => !PIECES[idOf(e)].leg && !picks.includes(PIECES[idOf(e)]));
    if (!cand.length) break;
    let total = 0;
    for (const e of cand) total += weightOf(e);
    let r = rnd() * total, pick = cand[cand.length - 1];
    for (const e of cand) { r -= weightOf(e); if (r < 0) { pick = e; break; } }
    picks.push(PIECES[idOf(pick)]);
    taken.add(idOf(pick));
  }
  if (!picks.length) {
    const fb = sec.beats === 'rest' ? PIECES.swarm : PIECES[FALLBACK[sec.role]] || PIECES['easy-knots'];
    picks.push(fb);
  }
  return picks;
}

// How long a piece runs in a section of n beats ('rest' takes n as it is).
function pieceLen(pc, n) {
  if (pc.beats === 'rest') return n;
  const [lo, hi] = pc.beats;
  return Math.max(lo, Math.min(hi, n));
}

function rollParams(pc, rnd, safe) {
  const p = {};
  for (const [k, [lo, hi]] of Object.entries(pc.params)) p[k] = safe ? pc.safe[k] ?? lo : int(rnd, lo, hi);
  return p;
}

// Does an item come within SEAM° of the anchor? (The seam rule: a piece's first beat stays clear round the line the
// ship is probably on.)
function nearAnchor(it, anchor) {
  if (it.kind === 'cue' || it.kind === 'fog') return false;
  if (it.kind === 'pickup') return Math.abs(wrap(it.psi - anchor)) < SEAM;
  const zone = wrap(anchor - SEAM);
  for (const [from, to] of blocked(it, it.beat, [], 0)) if (overlap(from, to - from, zone, 2 * SEAM)) return true;
  return false;
}

// Do two arcs [a, a + aw) and [b, b + bw) meet on the ring?
function overlap(a, aw, b, bw) {
  if (aw >= 360 || bw >= 360) return true;
  const d1 = (((b - a) % 360) + 360) % 360, d2 = (((a - b) % 360) + 360) % 360;
  return d1 < aw || d2 < bw;
}

// One draft of the leg for the given attempt per section.
function assemble(G, attempts) {
  const { def, L, legNo, T, mods, seed, total } = G;
  const usedAll = new Set(G.used);
  const plans = G.sections.map((sec, i) => {
    const a = Math.min(attempts[i], ATTEMPTS);
    const rnd = mulberry32(hashSeed(seed, i, a));
    const pcs = sec.role === 'launch' ? [] : choose(sec, rnd, { seen: G.seen, usedAll });
    for (const pc of pcs) if (!pc.repeat) usedAll.add(pc.id);
    const count = pcs.length || 1;
    return { sec, rnd, pcs, safe: attempts[i] > ATTEMPTS, n: sec.beats === 'rest' ? null : sec.beats / count };
  });
  // lengths: every section but the rest one shares its beats among its pieces (a sequence runs each piece at its
  // own length); then the rest section takes what is left
  let fixed = 0;
  for (const pl of plans) {
    if (pl.n === null) continue;
    const k = pl.pcs.length, n = pl.sec.beats;
    pl.lens = pl.pcs.map((pc, j) => {
      if (pl.sec.seq) return pc.beats === 'rest' ? n : pc.beats[1];
      const share = j < k - 1 ? Math.floor(n / k) : n - Math.floor(n / k) * (k - 1);
      return pieceLen(pc, share);
    });
    pl.len = k ? pl.lens.reduce((x, y) => x + y, 0) : n;
    fixed += pl.len;
  }
  const restPl = plans.find((pl) => pl.n === null);
  if (restPl) {
    restPl.len = Math.max(4, total - fixed);
    restPl.lens = restPl.pcs.map(() => restPl.len / restPl.pcs.length);
  }
  const items = [], sections = [];
  let b0 = 0, anchor = 0, content = false;
  plans.forEach((pl, i) => {
    const sec = pl.sec;
    const rec = { role: sec.role, id: null, ids: [], b0, b1: b0 + pl.len, params: [], mirror: [], anchor,
      attempt: attempts[i] };
    pl.pcs.forEach((pc, k) => {
      const len = pl.lens[k];
      const p = rollParams(pc, pl.rnd, pl.safe);
      const m = coin(pl.rnd);
      const ctx = { len, p, rnd: pl.rnd, density: (sec.opts && sec.opts.density) || 1, opts: sec.opts || {},
        legNo, type: G.type, skin: def.skin, T, mods, first: legNo === 0, lane: L, gate: def.gate };
      const built = pc.build(ctx);
      for (const it of built.items) {
        if (it.beat >= len + 1e-9 && it.kind !== 'cue') continue;
        const o = place(it, b0, anchor, m);
        if (content && it.beat < 1 && nearAnchor(o, anchor)) continue;
        o.piece = pc.id;
        o.sec = i;
        if (o.kind === 'pickup' && o.band) o.group = `${i}.${k}`;
        items.push(o);
      }
      rec.ids.push(pc.id);
      rec.params.push(p);
      rec.mirror.push(m);
      anchor = wrap(anchor + m * (built.exit || 0));
      b0 += len;
      content = true;
    });
    if (!pl.pcs.length) b0 += pl.len;
    rec.id = rec.ids[0] || null;
    rec.b1 = b0;
    rec.exit = anchor;
    sections.push(rec);
  });
  return { items, sections, beats: b0 };
}

// Lane conditions that edit the built items (DUST, FLARES). FLARES turns every third optional knot of the crescendo's
// field into a pulse: the swarm's, or any piece's knots marked field (Orion's MAKO field, the asteroid belt).
function applyCondition(G, draft) {
  const cond = G.L.cond ? CONDITIONS[G.L.cond] : null;
  if (!cond) return;
  const { items, sections } = draft;
  if (cond.id === 'dust') {
    const sig = sections.find((s) => s.role === 'signature');
    if (sig) items.push({ kind: 'fog', beat: sig.b0, end: sig.b1, arcs: [[-180, 180]], type: 'dust', piece: 'dust',
      sec: sections.indexOf(sig) });
    const cres = sections.filter((s) => s.role === 'crescendo');
    if (cres.length) {
      const c0 = cres[0].b0, c1 = cres[cres.length - 1].b1, mid = c0 + Math.round((c1 - c0) / 2);
      items.push({ kind: 'fog', beat: mid, end: c1, arcs: [[-180, 180]], type: 'dust', piece: 'dust',
        sec: sections.indexOf(cres[0]) });
    }
  }
  if (cond.id === 'flares') {
    const rnd = mulberry32(hashSeed(G.seed, 'flares'));
    let k = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind !== 'knot' || !(it.piece === 'swarm' || it.field) || !it.opt) continue;
      if (k++ % cond.pulse.every !== 0) continue;
      items[i] = { kind: 'pulse', beat: it.beat, psi: it.psi, half0: cond.pulse.half0, half1: cond.pulse.half1,
        period: cond.pulse.period, phase: 0.25 + rnd() * 0.5, opt: it.opt, piece: it.piece, sec: it.sec,
        ...(it.field ? { field: true } : {}) };
    }
  }
}

// Pickups (11.6 step 7): every `must` slot spawns; then one fuel slot per third of the leg up to the leg's count
// (band cells on one exit line count once); the unchosen slot nearest 55 % of the leg becomes the patch.
function choosePickups(G, draft) {
  const { T, def, L, legNo } = G;
  const fam = L.kind === 'family' && L.fam ? FAMILY_EDITS[L.fam] : null;
  const cond = L.cond ? CONDITIONS[L.cond] : null;
  let count = T.FUEL_PER_LEG[legNo] ?? def.fuel;
  if (fam && fam.fuel) count += fam.fuel;
  if (cond && cond.fuel) count += cond.fuel;
  if (cond && cond.fuelX) count *= cond.fuelX;
  if (L.kind === 'void') count = 0;
  const wantPatch = L.kind !== 'void' && def.patch;
  const items = draft.items;
  const slots = [];
  const groups = new Map();
  items.forEach((it, i) => {
    if (it.kind !== 'pickup') return;
    const key = it.group || `s${i}`;
    if (!groups.has(key)) {
      groups.set(key, { key, idx: [], beat: it.beat, must: false, band: !!it.band, patch: false });
      slots.push(groups.get(key));
    }
    const g = groups.get(key);
    g.idx.push(i);
    if (it.must) g.must = true;
    if (it.type === 'patch') g.patch = true;
  });
  const rnd = mulberry32(hashSeed(G.seed, 'pickups'));
  const keep = new Map();          // group key → 'fuel' | 'patch'
  const fuelSlots = slots.filter((g) => !g.patch);
  for (const g of fuelSlots) if (g.must && count >= 0 && L.kind !== 'void') keep.set(g.key, 'fuel');
  const launchEnd = draft.sections[0] ? draft.sections[0].b1 : 0;
  const gateSec = draft.sections.find((s) => s.role === 'gate');
  const span0 = launchEnd, span1 = gateSec ? gateSec.b0 : draft.beats;
  const third = (b) => Math.min(2, Math.max(0, Math.floor(((b - span0) / Math.max(1, span1 - span0)) * 3)));
  let have = [...keep.keys()].length;
  const order = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const pickIn = (cands) => {
    const band = cands.filter((g) => g.band);
    const from = band.length && rnd() < 0.5 ? band : cands;
    return from[Math.floor(rnd() * from.length)];
  };
  for (const t of order) {
    if (have >= count) break;
    if (fuelSlots.some((g) => keep.has(g.key) && third(g.beat) === t)) continue;
    const cands = fuelSlots.filter((g) => !keep.has(g.key) && third(g.beat) === t);
    if (!cands.length) continue;
    let pick = pickIn(cands);
    // a pick at a third's edge, under 3 beats from a kept cell, moves to a slot 4 beats clear of them if one exists
    if (fuelSlots.some((h) => keep.has(h.key) && Math.abs(h.beat - pick.beat) < 3)) {
      const far = cands.filter((g) => fuelSlots.every((h) => !keep.has(h.key) || Math.abs(h.beat - g.beat) >= 4));
      if (far.length) pick = far[Math.floor(rnd() * far.length)];
    }
    keep.set(pick.key, 'fuel');
    have++;
  }
  // more than one per third (RICH, FLARES, SHIP): spread the rest at least 4 beats from any kept slot
  let guard = 0;
  while (have < count && guard++ < 50) {
    const cands = fuelSlots.filter((g) => !keep.has(g.key)
      && fuelSlots.every((h) => !keep.has(h.key) || Math.abs(h.beat - g.beat) >= 4));
    const loose = cands.length ? cands : fuelSlots.filter((g) => !keep.has(g.key));
    if (!loose.length) break;
    keep.set(pickIn(loose).key, 'fuel');
    have++;
  }
  if (wantPatch) {
    const at = draft.beats * T.PATCH_AT;
    const free = slots.filter((g) => !keep.has(g.key) && !g.band);
    const must = free.find((g) => g.patch && g.must);
    let best = must || null, bestD = Infinity;
    if (!best) {
      for (const g of free) {
        const d = Math.abs(g.beat - at) - (g.patch ? 4 : 0);
        if (d < bestD) { bestD = d; best = g; }
      }
    }
    if (best) keep.set(best.key, 'patch');
  }
  const out = [];
  items.forEach((it, i) => {
    if (it.kind !== 'pickup') { out.push(it); return; }
    const key = it.group || `s${i}`;
    const k = keep.get(key);
    if (!k) return;
    const o = { ...it, type: k };
    if (k === 'patch') delete o.group;
    out.push(o);
  });
  draft.items = out;
}

// The rules the leg hands to handle.js and survival.js (VOID, conditions). redX is null unless a condition sets
// it (TIDES): handle pays the larger of it and the race's RED_X, so a card's RED_X (TIDAL FRAME) still counts.
function legRules(G) {
  const T = G.T, cond = G.L.cond ? CONDITIONS[G.L.cond] : null;
  const r = { noDrag: false, burnCap: T.BURN_CAP, dragX: 1, skimX: 1, wideFree: false, redSpan: T.RED_SPAN,
    redX: null, dustPush: 1, patchAlways: false };
  if (G.L.kind === 'void') { r.noDrag = true; r.burnCap = null; }
  if (cond && cond.rules) Object.assign(r, cond.rules);
  const fam = G.L.kind === 'family' && G.L.fam ? FAMILY_EDITS[G.L.fam] : null;
  if (fam && fam.patch) r.patchAlways = true;
  return r;
}

function legField(G) {
  const f = { ...G.def.field };
  if (G.L.kind === 'void') return { regulars: 0, drifters: 0, boss: null, none: true };
  const fam = G.L.kind === 'family' && G.L.fam ? FAMILY_EDITS[G.L.fam] : null;
  if (fam && fam.drifters && !f.boss) f.drifters += fam.drifters;
  return f;
}

const r3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);

// The canonical list: sorted by beat (stable), numbered, numbers rounded to 1/1000.
function finish(draft) {
  const items = draft.items.map((it, i) => ({ it, i }));
  items.sort((a, b) => a.it.beat - b.it.beat || a.i - b.i);
  return items.map(({ it }, id) => {
    const o = { id };
    for (const [k, v] of Object.entries(it)) {
      if (v === undefined) continue;
      if (typeof v === 'number') o[k] = r3(v);
      else if (Array.isArray(v)) o[k] = v.map((x) => (Array.isArray(x) ? x.map(r3) : typeof x === 'object' && x
        ? Object.fromEntries(Object.entries(x).map(([a, b]) => [a, r3(b)])) : r3(x)));
      else if (v && typeof v === 'object') o[k] = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, r3(b)]));
      else o[k] = v;
    }
    return o;
  });
}

// FNV-1a of the canonical item list, as base 36.
export function hashItems(items) { return hashSeed(JSON.stringify(items)).toString(36); }

// Build one leg. runSeed: the run's seed; type: a ROUTE id; lane: the chart's lane ({ id, name, kind, fam, piece,
// cond }), its name or id, or null for the leg's first; mods: the build's (gateWell for SLINGSHOT HOME, density);
// seen: the meta's teaching flags ({ runs, goodWhip, ... }); used: piece ids this run has flown.
// → { type, name, legNo, lane, seed, beats, items, sections, gate, pickups, wells, labels, rules, noDrag, burnCap,
//     dragX, redSpan, redX, field, mods, hash, report }, frozen. noDrag, burnCap (null in the VOID), dragX
//     (HEADWIND), redSpan and redX (TIDES; null elsewhere) repeat rules' for handle.js.
//     sections: [{ role, id, ids, b0, b1, params, mirror, anchor, exit, attempt }].
export function buildLeg({ runSeed = 1, type = 'web', lane = null, mods = {}, seen = {}, used = new Set(),
  tune = TUNE, validate = true } = {}) {
  const T = tune;
  const def = LEG_TYPES[type] ? LEG_TYPES[type] : LEG_TYPES.web;
  if (!LEG_TYPES[type]) type = 'web';
  const legNo = Math.max(0, ROUTE.indexOf(type));
  const L = laneOf(type, lane);
  const seed = legSeed(runSeed, type, L.id);
  const G = { def, L, legNo, T, mods: mods || {}, seed, type, seen: seen || {},
    used: used instanceof Set ? used : new Set(used || []) };
  G.total = legLength(def, L, legNo, T);
  G.sections = planSections(def, L, legNo, T, G.mods);
  const attempts = G.sections.map(() => 0);
  let draft = null, report = null, items = null, tries = 0;
  for (;;) {
    draft = assemble(G, attempts);
    applyCondition(G, draft);
    choosePickups(G, draft);
    items = finish(draft);
    if (!validate) { report = { ok: true, errors: [], skipped: true }; break; }
    report = validateLeg({ type, beats: draft.beats, items, sections: draft.sections, legNo, lane: L }, { tune: T });
    const bad = report.errors.find((e) => LOCAL_RULES.has(e.rule));
    if (!bad || ++tries > 60) break;
    let i = draft.sections.findIndex((s) => bad.beat >= s.b0 && bad.beat < s.b1);
    if (i < 0) i = draft.sections.length - 1;
    // a failure in a section's first beats may come from the seam: re-roll the section before it once it has
    // tried its own safe params
    if (attempts[i] > ATTEMPTS && i > 0 && draft.sections[i - 1].role !== 'launch' && attempts[i - 1] <= ATTEMPTS) i -= 1;
    if (attempts[i] > ATTEMPTS) break;
    attempts[i]++;
  }
  report.attempts = [...attempts];
  const gateIt = items.find((it) => it.kind === 'gate' && !it.pair && it.piece && it.piece === (draft.sections
    .find((s) => s.role === 'gate') || {}).id);
  // Earth's gate is the landing's DOOR, a cue (not a hazard, and no THREAD pay): { door: true, psi, gap: its width }
  const gateSec = draft.sections.find((s) => s.role === 'gate') || {};
  const doorIt = gateIt ? null : items.find((it) => it.kind === 'cue' && it.name === 'door' && it.piece === gateSec.id);
  const gate = gateIt ? { id: gateIt.gateId || gateIt.piece, beat: gateIt.beat, psi: gateIt.psi, gap: gateIt.gap,
    halves: gateIt.halves, names: gateIt.names, dock: gateIt.dock, label: gateIt.label || null, item: gateIt.id }
    : doorIt ? { id: def.gate, beat: doorIt.beat, psi: doorIt.data.psi, gap: doorIt.data.w, door: true,
      names: ['EARTH'], label: doorIt.data.label || 'EARTH', item: doorIt.id }
      : { id: def.gate, beat: draft.beats - 4 };
  const labels = [];
  for (const it of items) {
    if (it.name && it.kind !== 'cue') labels.push({ id: it.id, beat: it.beat, psi: it.psi, text: it.name });
    if (it.kind === 'cue' && (it.name === 'landmark' || it.name === 'gate') && it.data.label) {
      labels.push({ id: it.id, beat: it.beat, psi: null, text: it.data.label });
    }
  }
  const rules = legRules(G);
  return deepFreeze({
    type, name: def.name, legNo,
    lane: { id: L.id, name: L.name, kind: L.kind, fam: L.fam, cond: L.cond, piece: L.piece ?? null, seq: L.seq ?? null },
    seed, beats: draft.beats, items, sections: draft.sections, gate,
    pickups: items.filter((it) => it.kind === 'pickup'),
    wells: items.filter((it) => it.kind === 'well'),
    labels, rules, noDrag: rules.noDrag, burnCap: rules.burnCap, dragX: rules.dragX, redSpan: rules.redSpan,
    redX: rules.redX, field: legField(G), mods: { ...G.mods },
    hash: hashItems(items), report,
  });
}

// The piece ids a leg used that may not repeat in the run (run.js adds them to run.used).
export function piecesOf(leg) {
  const out = [];
  for (const s of leg.sections) for (const id of s.ids || []) if (PIECES[id] && !PIECES[id].repeat) out.push(id);
  return out;
}

// How many hazards pass in a leg (R12's count): every hazard item once.
export const passCount = (leg) => leg.items.filter(isHazard).length;
