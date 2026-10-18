// First Breath: stage 6, Second Trimester (`answer`), the WAVE-0 STUB (design.md 16.4, 16.12; tasks.md 1.7). It stands in for
// the stage until its wave-1 builder replaces this file with the design.md 6.6 form. It follows the Stage interface
// exactly, so core/run.js, core/bots.js and the tests can play a whole run now. Pure: no DOM, no clocks, no storage.
// Taps on her 78 bpm beats in beat and phrases. Milestones hearing (start of hear) and eyes (end of eyes). Carry
// out: song with the carried notes and lit = a mask of the first 16 phrase targets graded Close or better.
//
// Stub rules (the same in all 9 wave-0 stubs; the engine is the second half of this file):
// - A timer. PLAN gives each moment's stub seconds, its live gesture and its targets; the moments play in order and
//   the stage ends after the last one (or at meta.capS). The default length is 3.1's ref time (swim: its cap).
//   opts.stubS (seconds; a test hook that core/run.js passes through from createRun's stageOpts) scales the plan to
//   that length. A real stage ignores it. gaDay follows each 4.1 moment over its stub seconds (clock.gaAt).
// - Her beats start at opts.motherPhase at meta.motherBpm (5.1), with jitter only in free time.
// - Targets: a "tap" moment lays a tap on every 2nd beat of its heart, a "hold" moment a press on a beat and a release
//   2 beats later; none comes sooner than 2 s after the start (or a jump), so each one is listed for its preview.
//   Score: Goal 3,000 when done, Skill 6,000 x accuracy, Flourish 1,000 x the best In-time streak over min(8, targets).
// - One sub-goal ("stub"), shown at the start and settled at the end. jump(state, id) starts that moment now: the
//   moments after it follow on, open targets are dropped and new ones laid. probe() is null.
// - Strings are ids only (`answer.text.js` is empty in wave 0, so say() shows the id).
import { DT, gaAt, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { CREDIT } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { createTrack, feed, upcoming, accuracy, streak } from "../lib/track.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { figure } from "../lib/figure.js";

// One 4.1 moment: gaDay from → to while it runs, and the lenS that gaDay follows (null where 4.1 gives none).
const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "answer", index: 5, name: "Second Trimester", verb: "Answer",
  orient: "fit",
  families: Object.freeze(["tap"]),
  ga: Object.freeze({ start: 98, end: 195 }), fertilized: true,
  mm: Object.freeze({ start: 150, end: 600 }),
  motherBpm: 78, parS: 64, capS: 80, canFail: false, scored: true,
  moments: Object.freeze([
    mo("hear", 105, 105),
    mo("beat", 105, 126, (8 * 60) / 78),
    mo("phrases", 133, 175, (60 * 60) / 78),
    mo("eyes", 175, 182, 4),
    mo("outro", 189, 195, 3),
  ]),
});

// The stub's timeline, one entry per meta.moments entry and in the same order: s is the moment's stub seconds (a
// number, or a function of the carry), gesture its live gesture (keys "turn" only in the egg's guard), targets
// "tap" | "hold" | none, heart the targets' heart (default hers); extra moments come only through jump().
const PLAN = [
  { id: "hear", s: 3, gesture: "none" },
  { id: "beat", s: 7.7, gesture: "tap", targets: "tap" },
  { id: "phrases", s: 46.3, gesture: "tap", targets: "tap" },
  { id: "eyes", s: 4, gesture: "none" },
  { id: "outro", s: 3, gesture: "none" },
];

// Milestone events (16.6) at the start or end of a moment.
const MILESTONES = { hear: { start: "hearing" }, eyes: { end: "eyes" } };

// Her beats with no jitter (5.1); your heart along clock.bpmYou from gaDay 98 to 195.
function segments(phase, st, end) {
  return [
    { heart: "mother", from: 0, to: end + 30, bpm: meta.motherBpm, jitter: 0, first: phase },
    { heart: "you", from: 0, to: end, gaFrom: 98, gaTo: 195, jitter: 0 },
    { heart: "you", from: end, to: end + 30, gaFrom: 195, jitter: 0 },
  ];
}

// The view: span in u across the short axis, the subject's size in stages 1 and 2, the light level.
const VIEW = { span: () => 100, you: null, light: 0.6 };

function look(st, d) {
  d.splats.push(...figure("thumb", 45, st.gaDay));
  if (st.moment === "phrases") {
    const p = clamp01(st.beats.phase("mother", st.t));
    d.strips.push({ kind: "ripples", items: [{ x: -35, y: 25, r: 4 + 12 * p, a: 1 - p, dashed: false }] });
  }
}

// The stage's own touches on the shared engine below (each is optional).
const HOOKS = {
  carryOut(st) {
    let lit = 0, k = 0;
    st.track.targets.forEach((x, i) => {
      if (x.group !== "phrases" || k >= 16) return;
      const r = st.track.results[i];
      if (r && (r.grade === "in" || r.grade === "close")) lit |= 1 << k;
      k++;
    });
    return { song: { notes: st.carry.song.notes, lit } };
  },
};

// ---- the shared stub engine (the same in every wave-0 stub) ----

const LEAD_S = 2;        // no target in the first 2 s after the start or a jump, so each one gets its preview (5.2)
const TAIL_S = 0.25;     // a moment's last target comes at least this long before the moment ends
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const MAIN = PLAN.filter((p) => !p.extra).length;   // the moments played in order; the extra ones only by jump()
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function promptOf(i) {
  const p = PLAN[i];
  return { gesture: p.gesture, text: meta.id + "." + p.id, keys: p.keys || "steer" };
}

// Seconds per moment: the stub lengths, scaled so the moments played in order last opts.stubS when it is given.
function lengths(carry, stubS) {
  const base = PLAN.map((p) => (typeof p.s === "function" ? p.s(carry) : p.s));
  if (!(stubS > 0)) return base;
  const main = base.slice(0, MAIN).reduce((a, b) => a + b, 0);
  return base.map((s) => (s * stubS) / main);
}

// Moment i starts at stage time t; the moments after it follow on.
function planFrom(st, i, t) {
  st.starts[i] = t;
  for (let j = i + 1; j < PLAN.length; j++) st.starts[j] = st.starts[j - 1] + st.lens[j - 1];
}

const periodOf = (st, heart, t) => 60 / st.beats.bpm(heart, t);

// Targets for moment `from` on, none before t0 + LEAD_S: taps on every 2nd beat of the moment's heart; holds as a
// press on a beat and a release 2 beats later. No two targets are closer than max(0.5 s, 1.9 beats).
function lay(st, from, t0) {
  const out = [];
  let last = st.lastT;
  for (let i = from; i < PLAN.length; i++) {
    const p = PLAN[i];
    if (!p.targets || (p.extra && i !== from)) continue;
    const heart = p.heart || "mother";
    const a = Math.max(st.starts[i], t0 + LEAD_S), b = st.starts[i] + st.lens[i] - TAIL_S;
    if (!(b > a)) continue;
    const bs = st.beats.between(heart, a, b);
    const free = (x) => !(x - last < Math.max(0.5, 1.9 * periodOf(st, heart, x)));
    const gap = (x) => Math.max(0.5, Number.isFinite(last) ? x - last : periodOf(st, heart, x));
    let k = 0;
    const add = (kind, t, P) => out.push({ id: p.id + "." + st.gen + "." + k++, t, P, kind, heart, group: p.id });
    if (p.targets === "tap") {
      for (const x of bs) if (free(x)) { add("tap", x, gap(x)); last = x; }
    } else {
      for (let j = 0; j + 2 < bs.length; j++) {
        if (!free(bs[j])) continue;
        add("press", bs[j], gap(bs[j]));
        add("release", bs[j + 2], bs[j + 2] - bs[j]);
        last = bs[j + 2];
        j += 3;
      }
    }
  }
  st.lastT = last;
  return out;
}

// After a jump: keep the judged targets, drop the open ones and lay new ones from now.
function relay(st) {
  const keep = [], res = new Map();
  st.track.targets.forEach((x, i) => { const r = st.track.results[i]; if (r) { keep.push(x); res.set(x.id, r); } });
  st.gen++;
  st.lastT = keep.length ? keep[keep.length - 1].t : -Infinity;
  const track = createTrack([...keep, ...lay(st, st.mi, st.t)], { assist: st.assist });
  track.targets.forEach((x, i) => { if (res.has(x.id)) track.results[i] = res.get(x.id); });
  st.track = track;
}

function edge(st, i, which) {
  const m = MILESTONES[PLAN[i].id];
  if (m && m[which]) emit(st, "milestone", { id: m[which] });
  if (HOOKS.moment) HOOKS.moment(st, PLAN[i].id, which);
}

function enter(st, i) {
  st.mi = i;
  st.moment = PLAN[i].id;
  st.gaDay = meta.moments[i].ga[0];
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", promptOf(i));
  edge(st, i, "start");
}

// A moment ends: gaDay jumps to its end (4.1), then the next moment, or the end of the stage.
function advance(st) {
  const i = st.mi;
  st.gaDay = meta.moments[i].ga[1];
  edge(st, i, "end");
  if (PLAN[i].extra || i >= MAIN - 1) return finish(st, PLAN[i].extra ? PLAN[i].id : "end");
  enter(st, i + 1);
}

function judged(st, r) {
  const x = r.target;
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart,
    t: Number.isFinite(r.errMs) ? x.t + r.errMs / 1000 : st.t });
  const c = CREDIT[r.grade] || 0;
  if (c > 0) emit(st, "points", { part: "skill", add: Math.round((PARTS.skill * c) / st.track.targets.length) });
}

function finish(st, how) {
  if (st.done) return;
  for (const r of feed(st.track, EMPTY_INTENTS, st.t + 3600)) judged(st, r);
  st.done = true;
  st.how = how;
  if (HOOKS.finish) HOOKS.finish(st, how);
  const you = result(st).goalMet && st.track.targets.length > 0 && accuracy(st.track) >= 0.5;
  doneBy(st, "stub", you ? "you" : "auto", meta.id + (you ? ".goalDone" : ".goalAuto"));
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const carry = mergeCarry(carryIn, null);
  const lens = lengths(carry, Number(o.stubS));
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const st = {
    id: meta.id, seed: seed >>> 0, t: 0, gaDay: meta.moments[0].ga[0], fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: PLAN[0].id,
    mi: 0, starts: [], lens, gen: 0, lastT: -Infinity, track: null,
    done: false, how: null, assist: !!o.assist, oneButton: !!o.oneButton, carry, x: {},
  };
  planFrom(st, 0, 0);
  const end = st.starts[MAIN - 1] + lens[MAIN - 1];
  st.beats = makeBeats(seed, segments(phase, st, end));
  st.track = createTrack(lay(st, 0, 0), { assist: st.assist });
  if (HOOKS.create) HOOKS.create(st, seed);
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", promptOf(0));
  subgoal(st, "stub", meta.id + ".goal");
  edge(st, 0, "start");
  return st;
}

export function step(st, intents) {
  const it = intents || EMPTY_INTENTS;
  if (st.done) { st.t += DT; return; }
  if (HOOKS.step) HOOKS.step(st, it);
  for (const r of feed(st.track, it, st.t + DT)) judged(st, r);
  st.t += DT;
  while (!st.done && st.t >= st.starts[st.mi] + st.lens[st.mi] - 1e-9) advance(st);
  if (st.done) return;
  const m = meta.moments[st.mi];
  st.gaDay = gaAt({ ga: m.ga, lenS: st.lens[st.mi] }, st.t - st.starts[st.mi]);
  if (!PLAN[st.mi].extra && st.t >= meta.capS - 1e-9) finish(st, "cap");
}

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

function rings(st, span) {
  const out = [{ id: "mother", kind: "mother", x: 0, y: 0, r: span * 0.12, progress: clamp01(st.beats.phase("mother", st.t)) }];
  const you = st.beats.you;
  if (you && you.length && st.t >= you[0]) {
    out.push({ id: "you", kind: "you", x: 0, y: 0, r: span * 0.07, progress: clamp01(st.beats.phase("you", st.t)), dashed: true });
  }
  for (const x of targets(st, 2.5).slice(0, 2)) {
    const p = clamp01(1 - (x.t - st.t) / 2.5);
    out.push({ id: "t:" + x.id, kind: x.kind === "release" ? "hold" : "approach", x: 0, y: 0, r: span * (0.3 - 0.18 * p), progress: p });
  }
  return out;
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const span = VIEW.span(st);
  const mm = mmPerShortAxis(meta, st.gaDay);
  d.camera = { x: 0, y: 0, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = VIEW.you ? { you: VIEW.you } : { mm: bar(mm) };
  d.light = { level: VIEW.light, warm: 0.6, exposure: 1, white: 0, vignette: 0.5, tint: 0 };
  d.rings = rings(st, span);
  d.anchor = { x: 0, y: 0 };
  d.cue = targets(st, 2.5).length ? { x: 0, y: 0 } : null;
  look(st, d);
  return d;
}

export function prompt(st) {
  return st.done ? { ...NONE } : promptOf(st.mi);
}

export function targets(st, horizonS) {
  if (st.done) return [];
  return upcoming(st.track, st.t, horizonS).map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group }));
}

// Forward (world +y) in drag moments, down in dragHold ones, still otherwise. The stub keeps no memory, so it never
// touches r or r.mem.
export function botSteer(st, skill, r) {
  const g = st.done ? "none" : PLAN[st.mi].gesture;
  const m = 0.4 + 0.6 * clamp01(skill);
  if (g === "drag") return { steer: { x: 0, y: m }, dir: "up", hold: false };
  if (g === "dragHold") return { steer: { x: 0, y: -m }, dir: "down", hold: false };
  return { steer: { x: 0, y: 0 }, dir: null, hold: false };
}

export function probe(st) {
  return null;
}

export function result(st) {
  const n = st.track.targets.length;
  const acc = n ? accuracy(st.track) : 0;
  const best = streak(st.track).best;
  const goalMet = HOOKS.goalMet ? HOOKS.goalMet(st) : st.done;
  const score = meta.scored ? clampScore({
    goal: goalMet ? PARTS.goal : 0,
    skill: PARTS.skill * acc,
    flourish: PARTS.flourish * Math.min(1, best / Math.max(1, Math.min(8, n))),
  }) : null;
  const out = {
    done: st.done,
    goalMet,
    score,
    parts: score ? [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "timing", label: "part.skill", value: score.skill, max: PARTS.skill },
      { id: "streak", label: "part.flourish", value: score.flourish, max: PARTS.flourish },
    ] : [],
    metrics: { stub: true, targets: n, accuracy: acc, streak: best, moment: st.moment, how: st.how },
    carryOut: HOOKS.carryOut ? HOOKS.carryOut(st) : {},
  };
  return HOOKS.result ? HOOKS.result(st, out) : out;
}

export function jump(st, id) {
  const i = PLAN.findIndex((p) => p.id === id);
  if (i < 0) return false;
  st.done = false;
  st.how = null;
  planFrom(st, i, st.t);
  enter(st, i);
  relay(st);
  return true;
}
