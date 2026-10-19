// First Breath: stage 3, The Embryo: first cells (`split`), "Split." (design.md 6.3, 4.1, 5.2 to 5.4, 7, 16.4).
// One cell in its clear shell is carried down the tube. On her heartbeat (72 bpm, no jitter: the whole stage is one
// target track) it pinches in two, then 4, 8 and 16 cells, one split a day for Days 1 to 4: taps on beats 2, 4 and 6
// of each day as an approach ring closes on the membrane, and the split plays on beat 6 by itself. Day 5 (`bloom`): a
// hollow fills while you hold (or by itself from beat 2); let go at the glow on beat 6. Day 6 (`hatch`): the same,
// against the shell; you slip out on beat 6 by itself. Then a 3 s outro toward the soft lining. A miss only means no
// sparkle: every split, the hollow and the hatch still happen. Pure: no DOM, no clocks, no storage, no Math.random.
//
// Choices the design left open (noted for tasks.md 2c):
// - Beat n of the stage is her n-th beat from beat 1 (her first beat at or after 1.0 s). Day d runs from half a beat
//   after beat 6(d − 1) to half a beat after beat 6d, so each target (and the split on beat 6) sits inside its day
//   and the Close window (+ grace) of the last one ends before the next moment. gaDay follows 4.1 over those beats.
// - The first tap target's P is her beat period (5.2); the others are 2 beats apart (P = 1.67 s). A release target's P
//   is 6 beats (5 s): the time since the target before it.
// - Release credit (6.3): In time 1, Close 0.5; a release outside Close after a hold of at least 1 beat 0.25 (also a
//   hold still down when its moment ends); never pressed 0. A release after a hold under 1 beat counts for nothing
//   (no mash). The best credit stands. A hold needs a fresh press (5.3): a press made in the tap moment (or the
//   outro) never counts as a hold; a hold pressed in bloom may carry on into hatch (the gesture stays `hold`).
// - Caption facts go out as `fact { id, where: "caption" }` only (one event per shown line); sounds go out as `sfx`
//   with ids pling, sparkle, tone, toneEnd and slip (strings `split.sfx.<id>` for their captions).
// - jump(state, moment) starts that moment now, its start beat her last beat at or before now (for `split`, beat 1 a
//   fresh lead-in after now); open targets of earlier moments close as
//   misses (silently), and the targets of that moment and those after are laid again.
import { DT, gaAt, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { CREDIT } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { stream } from "../rng.js";
import { createTrack, feed, upcoming, accuracy, counted, freeUntil, RESUME_FREE_S } from "../lib/track.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { TUNE } from "./split.tune.js";

const PB = 60 / TUNE.bpm;                  // her beat period, 0.833 s
const HALF = PB / 2;
const beatsS = (n) => (n * 60) / TUNE.bpm;
const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "split", index: 2, name: "The Embryo: first cells", verb: "Split",
  orient: "long",
  families: Object.freeze(["tap", "hold"]),
  ga: Object.freeze({ start: 15, end: 20 }), fertilized: true,
  mm: Object.freeze({ start: 0.45, end: 0.45 }),
  motherBpm: TUNE.bpm, parS: 34, capS: TUNE.capS, canFail: false, scored: true,
  moments: Object.freeze([
    mo("split", 15, 19, beatsS(TUNE.days * TUNE.beatsPerDay)),   // 24 of her beats
    mo("bloom", 19, 20, beatsS(TUNE.holdBeats)),                   // 6 beats
    mo("hatch", 20, 20),
    mo("outro", 20, 20),
  ]),
});

const IDS = meta.moments.map((m) => m.id);
const GESTURE = ["tap", "hold", "hold", "none"];
const TEXT_OF = ["split.tap", "split.hold", "split.hold", "split.outro"];
const SPLIT_END = TUNE.days * TUNE.beatsPerDay;                    // beat 24: the 4th split
const START_BEAT = [0, SPLIT_END, SPLIT_END + TUNE.holdBeats, SPLIT_END + 2 * TUNE.holdBeats];   // 0, 24, 30, 36
const RELEASE_BEAT = [null, START_BEAT[2], START_BEAT[3], null];   // bloom on 30, hatch on 36 (their beat 6)
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const lerp = (a, b, q) => a + (b - a) * q;
const ease = (q) => { const x = clamp01(q); return x * x * (3 - 2 * x); };
const EPS = 1e-9;

// ---- the beat grid ----

// Beat n of the stage (beat 1 is her first beat at or after the lead-in), from her laid beats; past either end of
// the laid list it goes on at her period.
function B(st, n) {
  const M = st.beats.mother, i = st.i1 + n - 1;
  if (!M.length) return st.i1 + (n - 1) * PB;
  if (i < 0) return M[0] + i * PB;
  if (i >= M.length) return M[M.length - 1] + (i - M.length + 1) * PB;
  return M[i];
}

function firstAtOrAfter(M, t) {
  let lo = 0, hi = M.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (M[mid] < t - EPS) lo = mid + 1; else hi = mid; }
  return lo;
}

// Lay the schedule from moment `from`, which starts at time t (0 at create; now after a jump).
function plan(st, from, t) {
  const M = st.beats.mother;
  if (from === 0) st.i1 = firstAtOrAfter(M, t + TUNE.leadS);
  else {
    // the moment's start beat is her last beat at or before now, so what came before it (the splits) is done
    let j = firstAtOrAfter(M, t);
    if (j >= M.length || M[j] > t + EPS) j -= 1;
    st.i1 = j - START_BEAT[from] + 1;
  }
  st.starts[from] = t;
  for (let j = from + 1; j < IDS.length; j++) st.starts[j] = B(st, START_BEAT[j]) + HALF;
  st.endT = st.starts[3] + TUNE.outroS;
}

const momentAt = (st, t) => { let i = IDS.length - 1; while (i > 0 && t < st.starts[i]) i--; return i; };
const splitT = (st, d) => B(st, d * TUNE.beatsPerDay);             // the split of day d plays on its beat 6
const hatchT = (st) => B(st, START_BEAT[3]);                        // you slip out on hatch beat 6

// ---- targets ----

function tapTargets(st) {
  const out = [];
  let prev = null;
  for (let d = 1; d <= TUNE.days; d++) {
    for (const k of TUNE.tapBeats) {
      const t = B(st, (d - 1) * TUNE.beatsPerDay + k);
      out.push({ id: `split.${st.gen}.${d}.${k}`, t, P: Math.max(0.5, prev === null ? PB : t - prev), kind: "tap",
        heart: "mother", group: "split", day: d });
      prev = t;
    }
  }
  return out;
}

function releaseTarget(st, mi) {
  const t = B(st, RELEASE_BEAT[mi]);
  return { id: `${IDS[mi]}.${st.gen}`, t, P: Math.max(0.5, t - B(st, START_BEAT[mi])), kind: "release", heart: "mother",
    group: IDS[mi] };
}

// Keep the earlier moments' targets (open ones close as misses) and lay the rest again from the new grid.
function relay(st, from) {
  const keep = (track, isEarlier) => {
    const out = [];
    track.targets.forEach((x, i) => {
      if (!isEarlier(x)) return;
      out.push({ x, r: track.results[i] || { grade: "miss", errMs: null, rawMs: null } });
    });
    return out;
  };
  const taps = keep(st.track, () => from > 0);
  const rels = keep(st.rel, (x) => IDS.indexOf(x.group) < from);
  st.gen++;
  const tapList = from > 0 ? taps.map((e) => e.x) : tapTargets(st);
  const relList = [...rels.map((e) => e.x)];
  for (const mi of [1, 2]) if (mi >= from) relList.push(releaseTarget(st, mi));
  st.track = createTrack(tapList, { assist: st.assist, lag: st.lag });
  st.rel = createTrack(relList, { assist: st.assist, lag: st.lag });
  const put = (track, list) => list.forEach((e) => { const i = track.targets.findIndex((x) => x.id === e.x.id); if (i >= 0) track.results[i] = e.r; });
  put(st.track, taps);
  put(st.rel, rels);
  if (from <= 2) st.floor[1] = 0;
  if (from <= 1) st.floor[0] = 0;
}

// ---- cell layouts (built once per state from the seed: the first cleavage axis is seeded) ----

function relax(cells, r, R) {
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i], b = cells[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const want = 1.55 * r;
        if (d >= want) continue;
        if (d < 1e-6) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const push = (want - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
    const lim = R - 0.85 * r;
    for (const c of cells) {
      const d = Math.hypot(c.x, c.y);
      if (d > lim) { c.x *= lim / d; c.y *= lim / d; }
    }
  }
  return cells;
}

function layouts(seed) {
  const r0 = stream(seed, "cleave");
  const axis0 = r0() * Math.PI;
  const R = TUNE.ballR;
  const L = [[{ x: 0, y: 0, r: TUNE.cellR[0] }]];
  for (let k = 1; k <= TUNE.days; k++) {
    const r = TUNE.cellR[k];
    const out = [];
    L[k - 1].forEach((p, i) => {
      const a = axis0 + k * (Math.PI / 2) + i * 0.7 + (r0() - 0.5) * 0.3;
      const s = r * 0.8;
      out.push({ x: p.x + Math.cos(a) * s, y: p.y + Math.sin(a) * s, r });
      out.push({ x: p.x - Math.cos(a) * s, y: p.y - Math.sin(a) * s, r });
    });
    L.push(relax(out, r, R));
  }
  // the blastocyst: an outer ring of 11 cells round the hollow, and 5 inner cells at the back (world −y)
  const morula = L[TUNE.days];
  const order = morula.map((c, i) => ({ i, d: Math.hypot(c.x, c.y), a: Math.atan2(c.y, c.x) })).sort((p, q) => q.d - p.d || p.i - q.i);
  const outer = order.slice(0, 11).sort((p, q) => p.a - q.a), inner = order.slice(11).sort((p, q) => p.a - q.a);
  const ring = [];
  for (let k = 0; k < 11; k++) { const a = -Math.PI + (TAU * (k + 0.5)) / 11; ring.push({ x: 10.6 * Math.cos(a), y: 10.6 * Math.sin(a), r: 3.3, a }); }
  const icm = [[0, -5.6], [-3.1, -6.6], [3.1, -6.6], [-1.7, -3.2], [1.7, -3.2]].map(([x, y]) => ({ x, y, r: 3.1, a: Math.atan2(y, x) }));
  icm.sort((p, q) => p.a - q.a);
  const assign = (cells, slots) => {
    let best = 0, bestCost = Infinity;
    for (let s = 0; s < slots.length; s++) {
      let cost = 0;
      cells.forEach((c, j) => { const sl = slots[(j + s) % slots.length], m = morula[c.i]; cost += Math.hypot(sl.x - m.x, sl.y - m.y); });
      if (cost < bestCost - 1e-9) { bestCost = cost; best = s; }
    }
    return cells.map((c, j) => ({ i: c.i, slot: slots[(j + best) % slots.length] }));
  };
  const blast = new Array(morula.length);
  for (const { i, slot } of [...assign(outer, ring), ...assign(inner, icm)]) blast[i] = { x: slot.x, y: slot.y, r: slot.r };
  return { L, blast };
}

// ---- create ----

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const carry = mergeCarry(carryIn, null);
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const s = seed >>> 0;
  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.moments[0].ga[0], fertilized: meta.fertilized,
    events: [], beats: makeBeats(s, [{ heart: "mother", from: 0, to: TUNE.capS + 60, bpm: TUNE.bpm, jitter: 0, first: phase }]),
    subgoals: {}, moment: IDS[0],
    mi: 0, i1: 0, starts: [0, 0, 0, 0], endT: 0, gen: 0,
    track: null, rel: null, floor: [0, 0],
    down: null,                 // the press now held: { t, mi, stale }
    fill: 0, push: 0,           // the hollow (bloom) and the press on the shell (hatch), 0..1
    splits: 0,                  // splits played so far
    slipped: false,             // you slipped out of the shell (hatch beat 6)
    said: {},                   // caption facts already shown
    fx: [], fxN: 0,             // short-lived sparkles and grade rings
    shown: { skill: 0, flourish: 0 },
    done: false, how: null, assist: !!o.assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry,
    lay: layouts(s),
    motes: null,
  };
  const rm = stream(s, "motes");
  st.motes = Array.from({ length: TUNE.motes }, () => ({ x: (rm() - 0.5) * (TUNE.tubeW - 10), y: rm() * 290, a: 0.25 + 0.35 * rm() }));
  plan(st, 0, 0);
  st.track = createTrack(tapTargets(st), { assist: st.assist, lag: st.lag });
  st.rel = createTrack([releaseTarget(st, 1), releaseTarget(st, 2)], { assist: st.assist, lag: st.lag });
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", promptOf(0));
  subgoal(st, "split", "split.goal.split");
  return st;
}

function promptOf(mi) {
  return { gesture: GESTURE[mi], text: TEXT_OF[mi], keys: "steer" };
}

// ---- scoring ----

function relCredit(st, mi) {
  const i = st.rel.targets.findIndex((x) => x.group === IDS[mi]);
  if (i < 0) return 0;
  const r = st.rel.results[i];
  const judged = r && (r.grade === "in" || r.grade === "close") ? CREDIT[r.grade] : 0;
  return Math.max(judged, st.floor[mi - 1] || 0);
}

function dayStats(st) {
  const out = [];
  for (let d = 1; d <= TUNE.days; d++) {
    let n = 0, hit = 0, inT = 0, judged = 0;
    st.track.targets.forEach((x, i) => {
      if (x.day !== d) return;
      n++;
      const r = st.track.results[i];
      if (r) judged++;
      if (r && (r.grade === "in" || r.grade === "close")) hit++;
      if (r && r.grade === "in") inT++;
    });
    // every tap of the day In time; a free one (after a resume, 5.2) is left out
    const ci = n ? counted(st.track, (x) => x.day === d) : [];
    const all = ci.length > 0 && ci.every((i) => st.track.results[i] && st.track.results[i].grade === "in");
    out.push({ n, hit, inT, judged, all });
  }
  return out;
}

function parts(st) {
  const acc = st.track.targets.length ? accuracy(st.track) : 0;
  const rels = [relCredit(st, 1), relCredit(st, 2)];
  // the mean over the release targets that count (a free one after a resume is left out, 5.2)
  const ri = counted(st.rel).map((i) => IDS.indexOf(st.rel.targets[i].group)).filter((mi) => mi === 1 || mi === 2);
  const relMean = ri.length ? ri.reduce((a, mi) => a + rels[mi - 1], 0) / ri.length : 0;
  const days = dayStats(st);
  const allDays = days.filter((d) => d.all).length;
  const splits = Math.round(TUNE.score.splits * acc);
  const release = Math.round(TUNE.score.release * relMean);
  const flourish = Math.min(PARTS.flourish, TUNE.score.perDay * allDays);
  return { acc, rels, relMean, days, allDays, splits, release, flourish };
}

// HUD score ticks: the running rounded parts, so the ticks add up to the result.
function tick(st) {
  const p = parts(st);
  const skill = p.splits + p.release;
  if (skill !== st.shown.skill) { emit(st, "points", { part: "skill", add: skill - st.shown.skill }); st.shown.skill = skill; }
  if (p.flourish !== st.shown.flourish) { emit(st, "points", { part: "flourish", add: p.flourish - st.shown.flourish }); st.shown.flourish = p.flourish; }
}

// ---- step ----

function fx(st, kind, data) {
  st.fx.push({ n: st.fxN++, kind, t: st.t, ...data });
  if (st.fx.length > 12) st.fx.splice(0, st.fx.length - 12);
}

function judged(st, r, ring) {
  const x = r.target;
  const at = Number.isFinite(r.errMs) ? x.t + r.errMs / 1000 : st.t;
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart, t: at });
  if (r.grade !== "miss") fx(st, "grade", { grade: r.grade, ring, t: at });   // a miss shows nothing
  if (r.grade === "in" || r.grade === "close") {
    if (x.kind === "tap") {
      fx(st, "hit", { grade: r.grade, day: x.day, t: at });
      emit(st, "sfx", { id: "sparkle", at, pitch: r.grade === "in" ? 1 : 0, gain: r.grade === "in" ? 0.6 : 0.35 });
    }
  }
}

function enter(st, mi) {
  st.mi = mi;
  st.moment = IDS[mi];
  emit(st, "moment", { id: st.moment });
  // stamped at the moment's own start, so the host's fresh-press line (ui/input.js, 5.3) is the one momentAt draws
  const at = Number.isFinite(st.starts[mi]) && st.starts[mi] <= st.t ? st.starts[mi] : st.t;
  emit(st, "prompt", { ...promptOf(mi), t: at });
  if (mi === 1) {
    st.gaDay = Math.max(st.gaDay, meta.moments[1].ga[0]);
    subgoal(st, "bloom", "split.goal.bloom");
  } else if (mi === 2) {
    st.gaDay = meta.moments[2].ga[0];
    st.fill = 1;
    subgoal(st, "hatch", "split.goal.hatch");
  } else if (mi === 3) {
    st.gaDay = meta.moments[3].ga[0];
    st.fill = 1;
  }
}

// A hold still down as its moment ends: 0.25 when it began in a hold moment at least a beat before.
function heldFloor(st, mi, tEnd) {
  const d = st.down;
  if (d && !d.stale && (d.mi === 1 || d.mi === 2) && d.mi <= mi && tEnd - d.t >= TUNE.minHoldBeats * PB - EPS) {
    st.floor[mi - 1] = Math.max(st.floor[mi - 1], TUNE.credit.heldOff);
  }
}

function leave(st, mi) {
  const tEnd = st.starts[mi + 1];
  if (mi === 0) {
    st.gaDay = meta.moments[0].ga[1];
    const hits = dayStats(st).reduce((a, d) => a + d.hit, 0);
    const you = hits >= st.track.targets.length / 2 && hits > 0;
    doneBy(st, "split", you ? "you" : "auto", you ? "split.done.split" : "split.auto.split");
  } else if (mi === 1 || mi === 2) {
    heldFloor(st, mi, tEnd);
    tick(st);
    const you = relCredit(st, mi) > 0;
    const id = IDS[mi];
    doneBy(st, id, you ? "you" : "auto", `split.${you ? "done" : "auto"}.${id}`);
    if (mi === 1) { st.gaDay = meta.moments[1].ga[1]; st.fill = 1; }
  }
}

function finish(st, how) {
  if (st.done) return;
  for (const r of feed(st.track, EMPTY_INTENTS, st.t + 3600)) judged(st, r, "approach");
  for (const r of feed(st.rel, EMPTY_INTENTS, st.t + 3600)) judged(st, r, "hold");
  if (st.mi === 1 || st.mi === 2) heldFloor(st, st.mi, st.t);
  st.done = true;
  st.how = how;
  st.gaDay = meta.ga.end;
  tick(st);
  for (const id of IDS.slice(0, 3)) {
    if (st.subgoals[id] === "shown") doneBy(st, id, "auto", `split.auto.${id}`);
  }
  emit(st, "points", { part: "goal", add: PARTS.goal });
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

// The caption facts and when each shows (stage seconds), so its label matches the clock then.
function captions(st) {
  return [
    ["split.small", splitT(st, 1) + 0.5],           // just after the first split: Day 2
    ["split.carried", B(st, 11) + 0.4],             // later on Day 2
    ["split.morula", splitT(st, 4) + 0.05],         // the ball of 16 cells, still Day 4
    ["split.inner", B(st, SPLIT_END + 5)],          // the hollow nearly full: Day 5
  ];
}

// Presses and releases in time order: the holds of bloom and hatch.
const list = (v) => (Array.isArray(v) ? v : []);

function holds(st, it) {
  const evs = [];
  for (const p of list(it.presses)) if (p && Number.isFinite(p.t)) evs.push({ t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t, up: false });
  for (const p of list(it.releases)) if (p && Number.isFinite(p.t)) evs.push({ t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t, up: true });
  evs.sort((a, b) => a.t - b.t || (a.up ? 1 : 0) - (b.up ? 1 : 0));
  const valid = [];
  for (const e of evs) {
    const mi = momentAt(st, e.t);
    if (!e.up) {
      // a new press replaces the one held (one pointer: input.js may drop a stale press's release, 5.3)
      const hold = GESTURE[mi] === "hold";
      st.down = { t: e.t, mi, stale: !hold };                   // a hold needs a fresh press in a hold moment
      if (hold) emit(st, "sfx", { id: "tone", at: e.t, pitch: mi, gain: 0.4 });
      continue;
    }
    const d = st.down;
    st.down = null;
    if (!d || d.stale) continue;
    emit(st, "sfx", { id: "toneEnd", at: e.t, pitch: mi, gain: 0.3 });
    if (GESTURE[mi] !== "hold") continue;
    if (e.t - d.t < TUNE.minHoldBeats * PB - EPS) continue;   // no mash: a short hold counts for nothing
    valid.push({ t: e.t, raw: e.raw, mi });
  }
  return valid;
}

export function step(st, intents) {
  if (!st || typeof st !== "object") return;
  try {
    stepInner(st, intents && typeof intents === "object" ? intents : EMPTY_INTENTS);
  } catch (e) {
    // a stage step never throws; end gently if something went wrong
    if (!st.done) { st.done = true; st.how = "error"; }
  }
}

function stepInner(st, it) {
  if (st.done) { st.t += DT; return; }
  const t1 = st.t + DT;

  // taps: every press is judged at touch-down against the open tap targets
  for (const r of feed(st.track, { presses: list(it.presses), releases: [] }, t1)) judged(st, r, "approach");

  // holds: fresh presses in bloom and hatch; a release after a hold of a beat or more is judged
  const valid = holds(st, it);
  for (const r of feed(st.rel, { presses: [], releases: valid }, t1)) judged(st, r, "hold");
  for (const v of valid) {
    const k = v.mi - 1;
    const i = st.rel.targets.findIndex((x) => x.group === IDS[v.mi]);
    const r = i >= 0 ? st.rel.results[i] : null;
    if (!r || (r.grade !== "in" && r.grade !== "close")) st.floor[k] = Math.max(st.floor[k], TUNE.credit.heldOff);
  }
  tick(st);

  st.t = t1;
  while (!st.done && st.mi < IDS.length - 1 && st.t >= st.starts[st.mi + 1] - EPS) {
    leave(st, st.mi);
    enter(st, st.mi + 1);
  }

  // the splits play on beat 6 of each day by themselves
  while (st.splits < TUNE.days && splitT(st, st.splits + 1) < st.t + EPS) {
    st.splits++;
    const d = dayStats(st)[st.splits - 1];
    emit(st, "sfx", { id: "pling", at: splitT(st, st.splits), pitch: st.splits, gain: 0.35 + 0.15 * d.hit });
    if (d.hit > 0) fx(st, "split", { day: st.splits, hits: d.hit, t: splitT(st, st.splits) });
  }

  // the hollow fills while you hold (or by itself from beat 2); the shell gives the same way in hatch
  const holding = !!(st.down && !st.down.stale && (st.down.mi === 1 || st.down.mi === 2));
  const rate = DT / (TUNE.holdFillBeats * PB);
  if (st.mi === 1) {
    const a = B(st, START_BEAT[1] + TUNE.autoFromBeat), b = B(st, RELEASE_BEAT[1]);
    st.fill = Math.min(1, Math.max(st.fill + (holding ? rate : 0), clamp01((st.t - a) / (b - a))));
  } else if (st.mi === 2 && st.t < hatchT(st)) {
    const a = B(st, START_BEAT[2] + TUNE.autoFromBeat), b = B(st, RELEASE_BEAT[2]);
    st.push = Math.min(1, Math.max(st.push + (holding ? rate : 0), clamp01((st.t - a) / (b - a))));
  }
  if (!st.slipped && st.t >= hatchT(st) - EPS && st.mi >= 2) {
    st.slipped = true;
    st.push = 1;
    emit(st, "sfx", { id: "slip", at: hatchT(st), pitch: 0, gain: 0.5 });
  }

  // gaDay (4.1): Days 1 to 4 over the 24 split beats, Day 5 over the 6 bloom beats, then Day 6
  if (st.mi === 0) st.gaDay = Math.max(st.gaDay, gaAt(meta.moments[0], st.t - (B(st, 0) + HALF)));
  else if (st.mi === 1) st.gaDay = Math.max(st.gaDay, gaAt(meta.moments[1], st.t - (B(st, START_BEAT[1]) + HALF)));
  else st.gaDay = meta.moments[st.mi].ga[0];

  for (const [id, at] of captions(st)) {
    if (st.said[id]) continue;
    if (st.t >= at - EPS) { st.said[id] = true; emit(st, "fact", { id, where: "caption" }); }
  }

  st.fx = st.fx.filter((f) => st.t - f.t < 0.9);
  if (st.t >= st.endT - EPS) finish(st, "end");
  else if (st.t >= meta.capS - EPS) finish(st, "cap");
}

// ---- the view ----

// The ball's centre in the world: carried forward down the tube, pressing on the shell in hatch, slipping out on
// hatch beat 6, then drifting faster toward the lining.
function ballAt(st) {
  const t = st.t, th = hatchT(st);
  let y = TUNE.driftUS * Math.min(t, th) + 2 * st.push;
  if (t > th) {
    y += TUNE.driftUS * (t - th) + TUNE.slipU * ease((t - th) / TUNE.slipS);
    if (t > st.starts[3]) y += TUNE.outroUS * Math.min(t - st.starts[3], TUNE.outroS);
  }
  return { x: 0, y };
}

const shellAt = (st) => ({ x: 0, y: TUNE.driftUS * Math.min(st.t, hatchT(st)) });

// The cells as splats, relative to the ball's centre: 1, 2, 4, 8 or 16 discs; two discs parting with a shrinking
// bridge capsule during a pinch; the morula opening round its hollow in bloom.
function cellSplats(st, bx, by) {
  const out = [];
  const { L, blast } = st.lay;
  const t = st.t;
  let k = 0;
  while (k < TUNE.days && splitT(st, k + 1) <= t + EPS) k++;
  const scale = t > hatchT(st) ? 1 + 0.1 * ease((t - hatchT(st)) / TUNE.slipS) : 1;
  const cell = (x, y, r) => out.push({ k: "c", x: bx + x * scale, y: by + y * scale, r: Math.max(0.3, r * scale), m: 1, n: 0.35, v: 0, hue: 0.02 });
  if (k < TUNE.days) {
    const d = k + 1, ts = splitT(st, d), t0 = ts - TUNE.pinchBeats * PB;
    let hits = 0;                                   // taps landed before the pinch deepen the furrow
    st.track.targets.forEach((x, i) => {
      const r = st.track.results[i];
      if (x.day === d && x.t < t0 && r && (r.grade === "in" || r.grade === "close")) hits++;
    });
    const q0 = Math.min(0.3, TUNE.furrowPerHit * hits);
    const q = t < t0 ? q0 : q0 + (1 - q0) * ease((t - t0) / (ts - t0));
    if (q <= 0) { for (const c of L[k]) cell(c.x, c.y, c.r); return out; }
    const kids = L[k + 1];
    L[k].forEach((p, i) => {
      const a = kids[2 * i], b = kids[2 * i + 1];
      const ax = lerp(p.x, a.x, q), ay = lerp(p.y, a.y, q), bxx = lerp(p.x, b.x, q), byy = lerp(p.y, b.y, q);
      const r = lerp(p.r * 0.92, a.r, q);
      cell(ax, ay, r);
      cell(bxx, byy, r);
      const rb = a.r * 0.7 * (1 - q);
      if (rb > 0.3) out.push({ k: "s", x: bx + ax * scale, y: by + ay * scale, r: rb, x2: bx + bxx * scale, y2: by + byy * scale, m: 0.9, n: 0, v: 0, hue: 0.02 });
    });
    return out;
  }
  const e = ease(st.mi >= 1 || st.done ? st.fill : 0);
  if (e > 0.02) out.push({ k: "c", x: bx, y: by + 2.8 * scale, r: Math.max(0.3, 7.4 * e * scale), m: 0.5, n: 0, v: 0, hue: 0.09 });
  L[TUNE.days].forEach((c, i) => {
    const s = blast[i];
    cell(lerp(c.x, s.x, e), lerp(c.y, s.y, e), lerp(c.r, s.r, e));
  });
  return out;
}

// The glow for a release target: it rises over the beat before the target and peaks on it.
function glowOn(st, x) {
  const dt = x.t - st.t;
  if (dt >= 0) return dt <= PB ? 1 - dt / PB : 0;
  return Math.max(0, 1 + dt / 0.3);
}

function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const ball = ballAt(st), shell = shellAt(st);
  const span = TUNE.span;
  const mm = mmPerShortAxis(meta, st.gaDay);
  const t = st.t;
  d.camera = { x: ball.x, y: ball.y, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = { mm: bar(mm) };
  const outroP = st.mi === 3 ? clamp01((t - st.starts[3]) / TUNE.outroS) : st.done ? 1 : 0;
  d.light = { level: 0.42 + 0.08 * outroP, warm: 0.6, exposure: 1, white: 0, vignette: 0.45, tint: 0 };
  d.warp = 0.2;
  d.caustics = 0;

  // the tube: a course sheet, its cilia on both walls, and fluid motes flowing past
  const cy = ball.y;
  const y0 = Math.floor((cy - 140) / 10) * 10;
  const pts = [], w = [];
  for (let i = 0; i < 30; i++) { pts.push(0, y0 + 10 * i); w.push(TUNE.tubeW); }
  d.strips.push({ kind: "course", pts, w, tone: "womb" });
  const c0 = Math.floor((cy - 140) / 5) * 5, wall = TUNE.tubeW / 2 - 1.5, cph = (t * 1.5) % 1;
  d.strips.push({ kind: "cilia", a: [-wall, c0], b: [-wall, c0 + 285], count: 58, phase: cph, amp: 0.55 });
  d.strips.push({ kind: "cilia", a: [wall, c0], b: [wall, c0 + 285], count: 58, phase: (cph + 0.5) % 1, amp: 0.55 });
  const n = st.motes.length;
  const xy = new Float32Array(2 * n), al = new Float32Array(n), id = new Float32Array(n);
  st.motes.forEach((m, i) => {
    const wy = m.y + 2.6 * t;
    const rel = (((wy - (cy - 140)) % 290) + 290) % 290;
    xy[2 * i] = m.x; xy[2 * i + 1] = cy - 140 + rel; al[i] = m.a; id[i] = i;   // each mote keeps its key
  });
  d.points = { n, xy, a: al, id, hue: 0.08 };

  // the clear shell: a cream ring that thins as you press on it, and opens at the front as you slip out
  const th = hatchT(st);
  const gap = t > th ? (80 * Math.PI / 180) * ease((t - th) / TUNE.slipS) : 0;
  const sw = TUNE.shellW - 1.0 * st.push;
  d.strips.push(gap > 0
    ? { kind: "arc", x: shell.x, y: shell.y, r: TUNE.shellR, a0: Math.PI / 2 + gap / 2, a1: Math.PI / 2 - gap / 2 + TAU, w: sw, glow: 0 }
    : { kind: "arc", x: shell.x, y: shell.y, r: TUNE.shellR, a0: 0, a1: TAU, w: sw, glow: 0 });

  // the cells
  d.splats.push(...cellSplats(st, ball.x, ball.y));

  // sparkles: a cut ring and small sparks for each landed tap, a ring for each split that had one, and rim sparks
  const items = [];
  for (const f of st.fx) {
    const age = t - f.t;
    if (age < 0) continue;
    if (f.kind === "hit") {
      const q = clamp01(age / 0.6);
      items.push({ x: ball.x, y: ball.y, r: TUNE.ringTo + 5 * q, a: (f.grade === "in" ? 0.9 : 0.55) * (1 - q), dashed: false });
      if (f.grade === "in") {
        for (let s = 0; s < 4; s++) {
          const a = (TAU * s) / 4 + f.day * 0.6;
          const rr = TUNE.ringTo + 2 + 6 * q;
          items.push({ x: ball.x + rr * Math.cos(a), y: ball.y + rr * Math.sin(a), r: 0.9, a: 0.9 * (1 - q), dashed: false });
        }
      }
    } else if (f.kind === "split") {
      const q = clamp01(age / 0.8);
      items.push({ x: ball.x, y: ball.y, r: TUNE.ballR + 1 + 8 * q, a: (0.35 + 0.2 * f.hits) * (1 - q), dashed: true });
    }
  }
  const sparks = Math.min(8, st.carry.sparks || 0);
  for (let s = 0; s < sparks; s++) {
    const a = (TAU * s) / Math.max(1, sparks) + t * 0.3;
    items.push({ x: ball.x + (TUNE.ballR + 0.8) * Math.cos(a), y: ball.y + (TUNE.ballR + 0.8) * Math.sin(a), r: 0.8, a: 0.8, dashed: false });
  }
  if (items.length) d.strips.push({ kind: "ripples", items });

  // marks: gentle squeezes of the tube passing, the glow to let go at, the soft lining ahead in the outro
  for (let k = Math.floor((cy - 130 - 5 * t) / 150); k <= Math.floor((cy + 150 - 5 * t) / 150); k++) {
    const yb = 150 * k + 5 * t;
    if (yb < cy - 130 || yb > cy + 150) continue;
    d.marks.push({ kind: "band", x: 0, y: yb, r: TUNE.tubeW / 2 - 2, w: 14, rim: "wavy", on: true, pulse: st.beats.phase("mother", t), ang: Math.PI / 2 });
  }
  const tgts = targets(st, 2 * PB + 0.05);
  const rel = st.done ? [] : upcoming(st.rel, t, 10).filter((x) => IDS.indexOf(x.group) <= st.mi);
  for (const x of rel) {
    const on = glowOn(st, x);
    if (on > 0) d.marks.push({ kind: "glow", x: ball.x, y: ball.y, r: 22, on, pulse: on });
  }
  if (outroP > 0) d.marks.push({ kind: "spot", x: 0, y: ball.y + 75, r: 20 + 30 * outroP, on: outroP, pulse: 0 });

  // rings (DOM): her beat; the approach ring closing on the membrane over the 2 beats before each tap; the hold ring
  // in bloom and hatch; a short grade ring for each judged target
  d.rings.push({ id: "mother", kind: "mother", x: ball.x, y: ball.y, r: TUNE.motherR, progress: clamp01(st.beats.phase("mother", t)) });
  let cueR = null;
  for (const x of tgts.filter((x) => x.kind === "tap").slice(0, 2)) {
    const p = clamp01(1 - (x.t - t) / (2 * PB));
    const r = lerp(TUNE.ringFrom, TUNE.ringTo, p);
    d.rings.push({ id: "t:" + x.id, kind: "approach", x: ball.x, y: ball.y, r, progress: p });
    if (cueR === null) cueR = r;
  }
  for (const x of rel.slice(0, 1)) {
    const p = clamp01(1 - (x.t - t) / (2 * PB));
    const r = lerp(TUNE.ringFrom, TUNE.ringTo, p);
    const held = !!(st.down && !st.down.stale && (st.down.mi === 1 || st.down.mi === 2));
    const hp = held ? clamp01((t - st.down.t) / Math.max(PB, x.t - st.down.t)) : 0;
    d.rings.push({ id: "h:" + x.id, kind: "hold", x: ball.x, y: ball.y, r, progress: hp, dashed: !held });
    if (cueR === null) cueR = r;
  }
  for (const f of st.fx) {
    if (f.kind !== "grade" || d.rings.length >= 8) continue;
    const age = t - f.t;
    if (age < 0 || age > (f.grade === "off" ? 0.3 : 0.45)) continue;
    const g = { id: "g:" + f.n, kind: f.ring === "hold" ? "hold" : "approach", x: ball.x, y: ball.y, r: TUNE.ringTo, progress: 1, grade: f.grade };
    if (f.grade === "off") g.dotted = true;
    d.rings.push(g);
  }

  d.anchor = { x: ball.x, y: ball.y };
  d.cue = cueR === null ? null : { x: ball.x, y: ball.y + cueR };
  return d;
}

export function prompt(st) {
  return st.done ? { ...NONE } : promptOf(st.mi);
}

export function targets(st, horizonS) {
  if (st.done) return [];
  const h = Number.isFinite(horizonS) ? horizonS : 3;
  return [...upcoming(st.track, st.t, h), ...upcoming(st.rel, st.t, h)]
    .sort((a, b) => a.t - b.t)
    .map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group }));
}

// Taps and holds only: the shared bot times them; there is nothing to steer, so r and r.mem are never touched.
export function botSteer(st, skill, r) {
  return { steer: { x: 0, y: 0 }, dir: null, hold: false };
}

export function probe(st) {
  return null;
}

export function result(st) {
  const p = parts(st);
  const goalMet = !!st.done;
  const score = clampScore({ goal: goalMet ? PARTS.goal : 0, skill: p.splits + p.release, flourish: p.flourish });
  const grades = { in: 0, close: 0, off: 0, miss: 0 };
  st.track.results.forEach((r) => { if (r) grades[r.grade] = (grades[r.grade] || 0) + 1; });
  let k = 0;
  while (k < TUNE.days && splitT(st, k + 1) <= st.t + EPS) k++;
  return {
    done: !!st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "splits", label: "split.part.splits", value: p.splits, max: TUNE.score.splits },
      { id: "release", label: "split.part.release", value: p.release, max: TUNE.score.release },
      { id: "days", label: "split.part.days", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: {
      targets: st.track.targets.length, accuracy: p.acc, taps: grades, release: p.rels, releaseCredit: p.relMean,
      daysInTime: p.allDays, cells: 2 ** k, moment: st.moment, how: st.how, capped: st.how === "cap",
    },
    carryOut: {},
  };
}

// Fair resume (5.2): the open tap and release targets of the first 1.2 s after Resume are free.
export function resume(st) {
  if (!st || st.done || !st.track || !st.rel) return 0;
  const until = st.t + RESUME_FREE_S;
  const n = freeUntil(st.track, until) + freeUntil(st.rel, until);
  if (n) tick(st);
  return n;
}

export function jump(st, id) {
  const i = IDS.indexOf(id);
  if (i < 0 || !st || typeof st !== "object") return false;
  st.done = false;
  st.how = null;
  st.down = st.down ? { ...st.down, stale: true } : null;
  plan(st, i, st.t);
  relay(st, i);
  st.splits = 0;
  while (st.splits < TUNE.days && splitT(st, st.splits + 1) < st.t + EPS) st.splits++;
  st.slipped = st.t >= hatchT(st) - EPS && i >= 2 ? true : false;
  st.fill = i >= 2 ? 1 : 0;
  st.push = i >= 3 ? 1 : 0;
  for (const [cid, at] of captions(st)) if (at < st.t) st.said[cid] = true;
  st.fx = [];
  enter(st, i);
  if (i === 0) {
    st.gaDay = meta.moments[0].ga[0];
    subgoal(st, "split", "split.goal.split");
  } else if (i === 1) st.gaDay = meta.moments[1].ga[0];
  for (let j = 0; j < i; j++) {
    const sid = IDS[j];
    if (j < 3 && st.subgoals[sid] !== "done" && st.subgoals[sid] !== "auto") {
      if (!st.subgoals[sid]) subgoal(st, sid, `split.goal.${sid}`);
      doneBy(st, sid, "auto", `split.auto.${sid}`);
    }
  }
  return true;
}
