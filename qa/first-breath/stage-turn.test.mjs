// First Breath: stage 7, Third Trimester (`turn`), design.md 6.7, 4.1, 5.2, 5.4, 7, 16.4 and 18; tasks 2.27 to 2.30.
// Plays the stage in node with no DOM (16.11): idle, the scripted ideal input, the shared bot at several skills and
// seeded random input. Asserts the meta and the 4.1 moments; determinism for two seeds; the ideal input reaching
// Glowing; idle ending by itself well inside the cap with goalMet true; the skill 0.7 bot completing; one live gesture
// per moment; every sub-goal ending done or auto; the 8 breath targets (press on beat 1, release on beat 5, each with
// its P) and their preview; every view valid; the ring shrinking anyway and a missed breath earning nothing, silently;
// the turn speeds (60°/s roomy, 15°/s outside, Assist 25°/s and 3.5 s roomy moments); the turn by itself at 30 s over
// 3 s; the Flourish only for a turn you finish yourself; nothing judged in the rest; botSteer (full stick the shorter
// way only in roomy moments, memory only in r.mem); one-button play; jump; the song carried in; the facts and strings
// (sources, access, word counts, banned words and pronouns); and that garbage input never throws.
// node qa/first-breath/stage-turn.test.mjs
import assert from "node:assert/strict";
import * as turn from "../../public/first-breath/core/stages/turn.js";
import { TUNE } from "../../public/first-breath/core/stages/turn.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/turn.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/turn.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { DT, mmPerShortAxis, label as clockLabel, range } from "../../public/first-breath/core/clock.js";
import { check as checkTargets, previewS } from "../../public/first-breath/core/lib/track.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { CARERS, fill, say } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/stage-turn.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const PER = 60 / 72;
const MAX_STEPS = Math.ceil((turn.meta.capS + 5) / DT);
const named = (evs, name) => evs.filter((e) => e.name === name);

// The 4.1 rows for this stage.
const MOMENTS = [
  { id: "breathe", ga: [196, 231], lenS: (32 * 60) / 72 },
  { id: "turn", ga: [231, 252], lenS: 30 },
  { id: "rest", ga: [259, 280], lenS: 16 },
  { id: "outro", ga: [280, 280], lenS: null },
];
const GESTURES = { breathe: "hold", turn: "drag", rest: "hold", outro: "none" };

// Is the turn `el` seconds in a roomy moment? (6.7: 2.5 s every 6.0 s, on her out-breath, the end of each cycle)
const roomy = (el, assist = false) => {
  const len = assist ? 3.5 : 2.5;
  const ph = el - 6 * Math.floor(el / 6);
  return el >= 0 && ph >= 6 - len - 1e-9;
};

// Play one attempt. `input(st, ctx)` gives each step's intents (ctx: { turnT0, headDown, restT0 } from the events).
// Returns the state, every event, the prompt seen at each step (with its moment) and every view's problems.
function play({ seed = 1, carry = DEFAULT_CARRY, opts = {}, input = null, bot = null, every = 1, before = null } = {}) {
  const st = turn.create(seed, carry, { assist: false, oneButton: false, motherPhase: 0, ...opts });
  const evs = [...st.events];
  st.events.length = 0;
  const ctx = { turnT0: null, headDown: null, restT0: null };
  const seen = [];
  const bad = [];
  const ga = [];
  let n = 0;
  for (; n < MAX_STEPS && !turn.result(st).done; n++) {
    if (n % every === 0) {
      const v = turn.view(st);
      const out = validate(v);
      if (out.length) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${out.join("; ")}`);
    }
    if (before) before(st, ctx);
    seen.push({ moment: st.moment, gesture: turn.prompt(st).gesture, t: st.t });
    const it = bot ? bot.intents(turn, st) : input ? input(st, ctx) : makeIntents();
    turn.step(st, it);
    for (const e of st.events) {
      if (e.name === "moment" && e.id === "turn") ctx.turnT0 = e.t;
      if (e.name === "moment" && e.id === "rest") ctx.restT0 = e.t;
      if (e.name === "milestone" && e.id === "headDown") ctx.headDown = e.t;
    }
    evs.push(...st.events);
    st.events.length = 0;
    ga.push({ t: st.t, gaDay: st.gaDay, mm: mmPerShortAxis(turn.meta, st.gaDay) });
  }
  bad.push(...validate(turn.view(st)).map((l) => `last view: ${l}`));
  return { st, evs, seen, bad, ga, steps: n, res: turn.result(st) };
}

// The scripted ideal input: press on beat 1 and release on beat 5 exactly; full stick only in roomy moments until
// head-down; a fresh press at the start of the rest.
function ideal(stickX = 1) {
  let restPressed = false;
  return (st, ctx) => {
    const t0 = st.t, t1 = t0 + DT;
    const presses = [], releases = [];
    for (const x of turn.targets(st, 1)) {
      if (x.t >= t0 && x.t < t1) (x.kind === "press" ? presses : releases).push({ t: x.t, raw: x.t });
    }
    let steer = { x: 0, y: 0 };
    if (ctx.turnT0 !== null && ctx.headDown === null && roomy(t0 - ctx.turnT0)) steer = { x: stickX, y: 0 };
    if (ctx.restT0 !== null && !restPressed) { presses.push({ t: t0, raw: t0 }); restPressed = true; }
    return makeIntents({ steer, touching: true, presses, releases });
  };
}

// Seeded random input: presses, releases and drags at any time.
function noisy(seed) {
  const r = stream(seed, "noise");
  let down = false;
  return (st) => {
    const t = st.t + r() * DT;
    const presses = [], releases = [];
    if (!down && r() < 0.04) { presses.push({ t, raw: t }); down = true; } else if (down && r() < 0.05) { releases.push({ t, raw: t }); down = false; }
    const steer = r() < 0.3 ? { x: 2 * r() - 1, y: 2 * r() - 1 } : { x: 0, y: 0 };
    return makeIntents({ steer, touching: down, presses, releases });
  };
}

// The arc strip's span in degrees: how far you have turned from head-up.
const turnedDeg = (st) => {
  const a = turn.view(st).strips.find((s) => s.kind === "arc");
  return a ? ((a.a1 - a.a0) * 180) / Math.PI : null;
};

// A plain-data picture of a value (functions as a marker, typed arrays as lists), for comparing states.
function snap(v, seen = new WeakSet()) {
  if (typeof v === "function") return "[fn]";
  if (typeof v === "number" && !Number.isFinite(v)) return String(v);
  if (v === null || typeof v !== "object") return v;
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (seen.has(v)) return "[cycle]";
  seen.add(v);
  const out = Array.isArray(v) ? v.map((x) => snap(x, seen)) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, snap(v[k], seen)]));
  seen.delete(v);
  return out;
}

// Shared runs.
const IDLE = play({ seed: 1, every: 1 });
const IDEAL = play({ seed: 1, input: ideal(), every: 1 });
const REF = play({ seed: 1, bot: createBot(1, 1), every: 3 });
const MIDS = Array.from({ length: 10 }, (_, i) => play({ seed: i + 1, opts: { motherPhase: (i * 0.137) % PER }, bot: createBot(0.7, i + 1), every: 5 }));
const NOISY = [1, 2, 3].map((s) => play({ seed: s, input: noisy(s), every: 2 }));
const ALL = [IDLE, IDEAL, REF, ...MIDS, ...NOISY];

await check("meta: the 6.7 stage, its families and the 4.1 moments", () => {
  const m = turn.meta;
  assert.equal(m.id, "turn");
  assert.equal(m.index, 6);
  assert.equal(m.name, "Third Trimester");
  assert.equal(m.verb, "Turn");
  assert.equal(m.orient, "fit");
  assert.deepEqual([...m.families], ["hold", "rotate"]);
  assert.ok(m.families.length <= 2);
  assert.deepEqual({ ...m.ga }, { start: 196, end: 280 });
  assert.deepEqual({ ...m.mm }, { start: 600, end: 700 });
  assert.equal(m.fertilized, true);
  assert.equal(m.motherBpm, 72);
  assert.equal(m.capS, 100);
  assert.equal(m.canFail, false);
  assert.equal(m.scored, true);
  assert.deepEqual(m.moments.map((x) => x.id), MOMENTS.map((x) => x.id));
  m.moments.forEach((x, i) => {
    assert.deepEqual([...x.ga], MOMENTS[i].ga, `${x.id} ga`);
    if (MOMENTS[i].lenS === null) assert.ok(!(x.lenS > 0), `${x.id} has no lenS`);
    else near(x.lenS, MOMENTS[i].lenS, 1e-9, `${x.id} lenS`);
  });
});

await check("determinism: the same seed and input give the same events and result (seeds 3 and 11)", () => {
  for (const seed of [3, 11]) {
    const a = play({ seed, bot: createBot(0.7, seed), every: 50 });
    const b = play({ seed, bot: createBot(0.7, seed), every: 50 });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}: events`);
    assert.deepEqual(a.res, b.res, `seed ${seed}: result`);
    const c = play({ seed, input: noisy(seed), every: 50 });
    const d = play({ seed, input: noisy(seed), every: 50 });
    assert.equal(JSON.stringify(c.evs), JSON.stringify(d.evs), `seed ${seed}: random input events`);
    assert.equal(JSON.stringify(snap(turn.view(c.st))), JSON.stringify(snap(turn.view(d.st))), `seed ${seed}: last view`);
  }
});

await check("the scripted ideal input reaches Glowing (10,000) for several her-beat phases and both turn directions", () => {
  for (const [phase, x] of [[0, 1], [0.3, -1], [0.8, 1]]) {
    const r = phase === 0 && x === 1 ? IDEAL : play({ seed: 5, opts: { motherPhase: phase }, input: ideal(x), every: 20 });
    assert.equal(r.res.done, true);
    assert.equal(r.res.goalMet, true);
    assert.deepEqual(r.res.score, { goal: 3000, skill: 6000, flourish: 1000, total: 10000 }, `phase ${phase}, stick ${x}`);
    assert.equal(gradeOf(r.res.score.total, r.res.goalMet), "Glowing");
    assert.equal(r.res.metrics.turnedBy, "you");
    near(r.res.metrics.roomyDeg, 180, 1e-6, "every degree in roomy moments");
    assert.ok(r.res.metrics.turnS < 30);
    near(r.st.t, 57.6 + phase, 1.2, "about 58 s (3.1: ref 60 s)");
    const judged = named(r.evs, "judge");
    assert.equal(judged.length, 8);
    assert.ok(judged.every((e) => e.grade === "in" && e.errMs === 0));
    const parts = r.res.parts.reduce((a, p) => a + p.value, 0);
    assert.equal(parts, r.res.score.total, "the parts add up to the total");
  }
});

await check("idle: the stage ends by itself well inside the cap, goal met, Goal only, every sub-goal by itself", () => {
  const { st, res, evs } = IDLE;
  assert.equal(res.done, true);
  assert.equal(res.goalMet, true);
  assert.deepEqual(res.score, { goal: 3000, skill: 0, flourish: 0, total: 3000 });
  assert.equal(gradeOf(res.score.total, true), "Good");
  near(st.t, 80, 1.5, "about 80 s (3.1: idle 81 s)");
  assert.ok(st.t < turn.meta.capS);
  assert.deepEqual(st.subgoals, { breaths: "auto", turn: "auto" });
  assert.equal(res.metrics.turnedBy, "auto");
  assert.equal(named(evs, "done").length, 1);
  assert.equal(named(evs, "points").filter((e) => e.part === "skill" || e.part === "flourish").length, 0, "no skill or flourish points");
  // the cap itself: a stage held in a moment past 100 s still ends, complete
  const held = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  turn.jump(held, "rest");
  held.rest.t0 = 1e9;                           // a stuck clock: only the cap can end it
  for (let i = 0; i < MAX_STEPS && !turn.result(held).done; i++) { turn.step(held, makeIntents()); held.events.length = 0; }
  assert.equal(turn.result(held).done, true);
  assert.equal(turn.result(held).goalMet, true);
  assert.equal(held.how, "cap");
  near(held.t, turn.meta.capS, DT + 1e-9, "ends at the cap");
});

await check("the skill 0.7 bot completes: goal met, turned by itself before 30 s, Great or better in ≥ 8 of 10 seeds", () => {
  let great = 0;
  for (const r of MIDS) {
    assert.equal(r.res.done, true);
    assert.equal(r.res.goalMet, true);
    assert.equal(r.res.metrics.turnedBy, "you");
    assert.ok(r.res.metrics.turnS < 30, `turn took ${r.res.metrics.turnS}`);
    assert.ok(r.st.t > 55 && r.st.t < 70, `stage time ${r.st.t.toFixed(1)} s`);
    if (r.res.score.total >= 6500) great++;
  }
  assert.ok(great >= 8, `${great} of 10 Great or better`);
  assert.equal(REF.res.score.total, 10000, "the ref bot (skill 1) scores 10,000");
});

await check("one live gesture per moment, and each moment's gesture is the 6.7 one", () => {
  for (const r of ALL) {
    const by = {};
    for (const s of r.seen) {
      if (!(s.moment in by)) by[s.moment] = s.gesture;
      assert.equal(s.gesture, by[s.moment], `${s.moment} at ${s.t.toFixed(2)} s`);
    }
    for (const [m, g] of Object.entries(by)) assert.equal(g, GESTURES[m], m);
    const ps = named(r.evs, "prompt");
    const live = ps.slice(0, -1);
    assert.deepEqual(live.map((p) => p.gesture), ["hold", "drag", "hold", "none"], "one prompt per moment");
    assert.deepEqual(live.map((p) => p.text), ["turn.breathe", "turn.turn", "turn.rest", "turn.outro"]);
    assert.ok(ps.every((p) => p.keys === "steer"));
    assert.equal(ps[ps.length - 1].gesture, "none", "the last prompt at the end is none");
    assert.deepEqual(named(r.evs, "moment").map((e) => e.id), ["breathe", "turn", "rest", "outro"]);
  }
});

await check("every sub-goal is shown, then ends done or auto, each with its text", () => {
  for (const r of ALL) {
    const subs = named(r.evs, "subgoal");
    for (const id of ["breaths", "turn"]) {
      const mine = subs.filter((e) => e.id === id);
      assert.equal(mine.length, 2, `${id}: shown then settled`);
      assert.equal(mine[0].state, "shown");
      assert.ok(mine[1].state === "done" || mine[1].state === "auto");
      for (const e of mine) assert.ok(TEXT[e.text], `${e.text} is a string`);
    }
    for (const v of Object.values(r.st.subgoals)) assert.ok(v === "done" || v === "auto");
  }
});

await check("the 8 breath targets: press on beat 1, release on beat 5, on her beats, each with its P and its preview", () => {
  for (const phase of [0, 0.3, 0.6, 0.83]) {
    const st = turn.create(2, DEFAULT_CARRY, { motherPhase: phase });
    const xs = turn.targets(st, 60);
    assert.equal(xs.length, 8);
    assert.deepEqual(checkTargets(xs), [], "spacing ≥ 0.5 s, sorted, every P ≥ 0.5 s");
    assert.deepEqual(xs.map((x) => x.kind), ["press", "release", "press", "release", "press", "release", "press", "release"]);
    assert.ok(xs.every((x) => x.heart === "mother" && x.group === "breath"));
    const b0 = xs[0].t;
    assert.ok(b0 >= 1.0 - 1e-9 && b0 < 1.0 + PER, `beat 1 at ${b0} (her first beat at or after 1.0 s)`);
    const beats = Array.from(st.beats.mother);
    assert.ok(beats.some((b) => Math.abs(b - b0) < 1e-9), "beat 1 is one of her beats");
    assert.ok(!beats.some((b) => b >= 1.0 - 1e-9 && b < b0 - 1e-9), "and the first at or after 1.0 s");
    xs.forEach((x, i) => {
      const j = i >> 1;
      const want = b0 + (8 * j + (x.kind === "press" ? 0 : 4)) * PER;
      near(x.t, want, 1e-6, `${x.id} on beat ${x.kind === "press" ? 1 : 5} of breath ${j + 1}`);
      const P = i === 0 ? PER : x.t - xs[i - 1].t;
      near(x.P, P, 1e-9, `${x.id} P`);
    });
    // her beats carry no jitter through the breaths (5.1)
    for (let k = 1; k < beats.length && beats[k] < xs[7].t + 4 * PER; k++) near(beats[k] - beats[k - 1], PER, 1e-9, "no jitter in the track");
  }
  // each target's ring shows at least max(2 beats, 1.2 s) before its time (the first from the first frame)
  const st = turn.create(4, DEFAULT_CARRY, { motherPhase: 0.5 });
  const xs = turn.targets(st, 60);
  const firstSeen = new Map();
  for (let i = 0; i < 2400 && st.moment === "breathe"; i++) {
    for (const g of turn.view(st).rings) if (g.id.startsWith("t:") && !firstSeen.has(g.id)) firstSeen.set(g.id, st.t);
    turn.step(st, makeIntents());
    st.events.length = 0;
  }
  xs.forEach((x, i) => {
    const seen = firstSeen.get("t:" + x.id);
    assert.ok(seen !== undefined, `${x.id} has a ring`);
    if (i === 0) assert.equal(seen, 0, "the first target's ring is there from the first frame");
    else assert.ok(x.t - seen >= previewS(PER) - DT, `${x.id} shows ${(x.t - seen).toFixed(2)} s ahead`);
  });
  assert.deepEqual(turn.targets(IDLE.st, 10), [], "no targets once done");
});

await check("every view is a valid draw list, with a camera, the anchor, the scale bar and a cue while there is one", () => {
  for (const r of ALL) assert.deepEqual(r.bad, []);
  const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  const kinds = new Set();
  for (let i = 0; i < MAX_STEPS && !turn.result(st).done; i++) {
    const v = turn.view(st);
    assert.equal(v.stage, "turn");
    assert.equal(v.camera.orient, "fit");
    assert.equal(v.camera.span, 100);
    near(v.camera.mmPerU * v.camera.span, mmPerShortAxis(turn.meta, st.gaDay), 1e-9, "mmPerU");
    assert.equal(v.scale.mm, 100, "a 10 cm bar");
    assert.deepEqual(v.anchor, { x: 0, y: 0 });
    if (st.moment === "breathe" || st.moment === "rest") assert.ok(v.cue, `a cue in ${st.moment}`);
    assert.ok(v.splats.length >= 12, "the figure and the placenta disc");
    assert.ok(v.strips.some((s) => s.kind === "cord"), "the cord");
    for (const g of v.rings) kinds.add(g.kind);
    for (const s of v.strips) kinds.add(s.kind);
    for (const m of v.marks) kinds.add(m.kind);
    turn.step(st, ideal()(st, { turnT0: st.moment === "turn" ? st.turn.t0 : null, headDown: st.turn.by ? 1 : null, restT0: st.rest.t0 }));
    st.events.length = 0;
  }
  for (const k of ["mother", "you", "breath", "approach", "hold", "rest", "cord", "arc", "ripples", "glow", "glowwall", "spot"]) assert.ok(kinds.has(k), `draws ${k}`);
});

await check("the ring grows and shrinks by itself; a missed breath earns nothing and no sound marks it", () => {
  const a = turn.create(6, DEFAULT_CARRY, { motherPhase: 0.2 });
  const b = turn.create(6, DEFAULT_CARRY, { motherPhase: 0.2 });
  const inp = ideal();
  const ctx = { turnT0: null, headDown: null, restT0: null };
  const rs = [];
  while (a.moment === "breathe") {
    const ra = turn.view(a).rings.find((g) => g.id === "breath"), rb = turn.view(b).rings.find((g) => g.id === "breath");
    assert.equal(ra.r, rb.r, "the same ring with and without input");
    assert.equal(ra.progress, rb.progress);
    rs.push({ t: a.t, r: ra.r });
    turn.step(a, inp(a, ctx)); turn.step(b, makeIntents());
    a.events.length = 0; b.events.length = 0;
  }
  const xs = turn.targets(turn.create(6, DEFAULT_CARRY, { motherPhase: 0.2 }), 60);
  const at = (t) => rs.reduce((p, q) => (Math.abs(q.t - t) < Math.abs(p.t - t) ? q : p)).r;
  for (let j = 0; j < 4; j++) {
    const b1 = xs[2 * j].t, b5 = xs[2 * j + 1].t;
    near(at(b1), TUNE.ring.r0, 0.2, `breath ${j + 1}: small on beat 1`);
    near(at(b5), TUNE.ring.r1, 0.2, `breath ${j + 1}: full on beat 5`);
    near(at(b5 + 4 * PER - DT), TUNE.ring.r0, 0.3, `breath ${j + 1}: small again by itself`);
  }
  const breathe = IDLE.evs.filter((e) => e.t < IDLE.evs.find((x) => x.name === "moment" && x.id === "turn").t);
  assert.equal(named(breathe, "judge").length, 8);
  assert.ok(named(breathe, "judge").every((e) => e.grade === "miss"));
  assert.equal(named(breathe, "sfx").length, 0, "no sound marks a miss");
  assert.equal(named(breathe, "points").length, 0, "a missed breath earns nothing");
});

await check("the turn: 60°/s in a roomy moment, 15°/s outside, the stick's sign sets the way, Assist 25°/s and 3.5 s", () => {
  const at = (assist, stick, from, secs) => {
    const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0, assist });
    turn.jump(st, "turn");
    const t0 = st.t;
    while (st.t - t0 < from - 1e-9) { turn.step(st, makeIntents()); st.events.length = 0; }
    const d0 = turnedDeg(st);
    const n = Math.round(secs / DT);
    for (let i = 0; i < n; i++) { turn.step(st, makeIntents({ steer: { x: stick, y: 0 }, touching: true })); st.events.length = 0; }
    return { st, deg: turnedDeg(st) - d0, view: turn.view(st) };
  };
  near(at(false, 1, 0, 1).deg, 15, 0.01, "outside: 15°/s at full stick");
  near(at(false, 0.5, 0, 1).deg, 7.5, 0.01, "half stick, half speed");
  near(at(false, 1, 3.5, 1).deg, 60, 0.01, "roomy: 60°/s");
  near(at(true, 1, 0, 1).deg, 25, 0.01, "Assist outside: 25°/s");
  near(at(true, 1, 2.5, 1).deg, 60, 0.01, "Assist: roomy from 2.5 s (3.5 s long)");
  near(at(false, 1, 2.5, 0.5).deg, 7.5, 0.01, "no Assist: 2.5 s in is not roomy yet");
  // the stick's sign: right is clockwise as seen (the head goes right), left anticlockwise
  const head = (stick) => {
    const r = at(false, stick, 0, 1);
    const f = r.view.splats.filter((p) => p.k === "c" && p.m === 1)[0];  // the figure's head
    return f.x;
  };
  assert.ok(head(1) > 0.5, "stick right: the head tips right");
  assert.ok(head(-1) < -0.5, "stick left: the head tips left");
  // roomy moments come every 6.0 s and last 2.5 s (Assist 3.5 s), in the sfx and the caption
  const r = IDLE.evs.filter((e) => e.name === "sfx" && e.id === "roomy");
  const t0 = IDLE.evs.find((e) => e.name === "moment" && e.id === "turn").t;
  assert.deepEqual(r.map((e) => +(e.t - t0).toFixed(3)), [3.5, 9.5, 15.5, 21.5, 27.5]);
  assert.equal(IDLE.evs.filter((e) => e.name === "caption" && e.id === "turn.roomy").length, 1, "the first roomy moment says so");
  // turning outside a roomy moment costs nothing and earns no roomy degrees; back and forth earns nothing either
  const out = at(false, 1, 0, 3.4);
  assert.equal(turn.result(out.st).metrics.roomyDeg, 0);
  const wob = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  turn.jump(wob, "turn");
  for (let i = 0; i < 60 * 12 && !wob.turn.by; i++) {
    const el = wob.t - wob.turn.t0;
    const x = roomy(el) ? 1 : -1;            // forward when roomy, back again outside
    turn.step(wob, makeIntents({ steer: { x, y: 0 }, touching: true }));
    wob.events.length = 0;
    if (wob.turn.by) break;                  // head-down: the arc is gone, the turn is scored
    assert.ok(turn.result(wob).metrics.roomyDeg <= turnedDeg(wob) + 1e-6, "roomy degrees never pass the turn held now");
  }
});

await check("the turn by itself at 30 s over 3 s, with its line; the Flourish only for a turn you finish yourself", () => {
  const evs = IDLE.evs;
  const t0 = evs.find((e) => e.name === "moment" && e.id === "turn").t;
  const auto = evs.find((e) => e.name === "subgoal" && e.id === "turn" && e.state === "auto");
  near(auto.t - t0, 30, DT + 1e-9, "the turn by itself starts at 30 s");
  assert.equal(say(auto.text), "You turn now.");
  const head = evs.find((e) => e.name === "fact" && e.id === "turn.head");
  near(head.t, auto.t, DT + 1e-9, "with 'Most babies turn head-down by 36 to 37 weeks.'");
  const hd = named(evs, "milestone").filter((e) => e.id === "headDown");
  assert.equal(hd.length, 1);
  near(hd[0].t - auto.t, 3, DT + 1e-9, "over 3 s");
  const rest = evs.find((e) => e.name === "moment" && e.id === "rest");
  near(rest.t, hd[0].t, DT + 1e-9, "the rest follows");
  assert.equal(IDLE.res.score.flourish, 0);
  // the figure ends head-down: the head below the body
  const v = turn.view(IDLE.st);
  const body = v.splats.find((p) => p.k === "s" && p.m === 1), headS = v.splats.filter((p) => p.k === "c" && p.m === 1)[0];
  assert.ok(headS.y < Math.min(body.y, body.y2), "head-down");
  // a turn made only outside roomy moments still finishes yourself before 30 s: the Flourish, no roomy degrees
  const slow = play({ seed: 1, input: (st, ctx) => makeIntents({ steer: { x: ctx.turnT0 !== null && !roomy(st.t - ctx.turnT0) ? 1 : 0, y: 0 }, touching: true }) });
  assert.equal(slow.res.metrics.turnedBy, "you");
  assert.equal(slow.res.score.flourish, 1000);
  assert.ok(slow.res.parts.find((p) => p.id === "turn").value < 400, "few roomy degrees");
  for (const r of ALL) assert.equal(named(r.evs, "milestone").filter((e) => e.id === "headDown").length, 1, "headDown once");
});

await check("nothing is judged in the rest: no judge, no points, the score holds, no targets", () => {
  for (const seed of [1, 2]) {
    const st = turn.create(seed, DEFAULT_CARRY, { motherPhase: 0 });
    const inp = ideal();
    const ctx = { turnT0: null, headDown: null, restT0: null };
    while (st.moment !== "rest") {
      turn.step(st, inp(st, ctx));
      for (const e of st.events) {
        if (e.name === "moment" && e.id === "turn") ctx.turnT0 = e.t;
        if (e.name === "milestone" && e.id === "headDown") ctx.headDown = e.t;
      }
      st.events.length = 0;
    }
    const before = JSON.stringify(turn.result(st).score);
    const r = stream(seed, "mash");
    let down = false;
    const evs = [];
    while (!turn.result(st).done) {
      const t = st.t + r() * DT;
      const it = r() < 0.2 ? (down ? { releases: [{ t, raw: t }] } : { presses: [{ t, raw: t }] }) : {};
      if (it.presses) down = true; else if (it.releases) down = false;
      assert.deepEqual(turn.targets(st, 30), []);
      turn.step(st, makeIntents({ ...it, touching: down, steer: { x: 2 * r() - 1, y: 0 } }));
      evs.push(...st.events);
      st.events.length = 0;
      if (!turn.result(st).done) assert.equal(JSON.stringify(turn.result(st).score.skill), JSON.stringify(JSON.parse(before).skill));
    }
    assert.equal(named(evs, "judge").length, 0, "no judge in the rest or the outro");
    assert.deepEqual(named(evs, "points").map((e) => e.part), ["goal"], "only the Goal, at the end");
    const after = turn.result(st).score;
    assert.equal(after.skill, JSON.parse(before).skill);
    assert.equal(after.flourish, JSON.parse(before).flourish);
  }
  // the rest lasts 16 s, then 3 s of "You are ready.", and holding warms your heart ring a little
  const evs = IDEAL.evs;
  const rest = evs.find((e) => e.name === "moment" && e.id === "rest"), outro = evs.find((e) => e.name === "moment" && e.id === "outro");
  near(outro.t - rest.t, 16, DT + 1e-9, "rest 16 s");
  near(named(evs, "done")[0].t - outro.t, 3, DT + 1e-9, "outro 3 s");
  assert.equal(say("turn.outro"), "You are ready.");
  assert.equal(clockLabel(280) + ". " + say("turn.outro"), "Week 40. You are ready.");
  assert.ok(IDEAL.st.rest.warm > 0.9, "held: warm");
  assert.equal(IDLE.st.rest.warm, 0, "not held: no warmth");
});

await check("the rest hums the song carried in (song event), and the ripples show its notes", () => {
  const notes = [60, 62, 64, 67, 69, 67, 64, 62, 60, 62, 64, 67, 69, 72, 69, 67];
  const carry = mergeCarry(DEFAULT_CARRY, { song: { notes, lit: 0b1010101010101010 } });
  const r = play({ seed: 2, carry, every: 10 });
  const song = named(r.evs, "song");
  assert.equal(song.length, 1);
  assert.deepEqual(song[0].notes, notes);
  assert.equal(song[0].lit, 0b1010101010101010);
  // the hum's note period (sound.hum: noteS + gapS, start to start) is the ripples' period, 0.95 s (it was 1.45 s)
  assert.equal(song[0].noteS, TUNE.rest.noteGapS, "song.noteS is the drawn note period");
  assert.ok(!song[0].gapS, `no extra gap between the hummed notes (gapS ${song[0].gapS})`);
  const rest = r.evs.find((e) => e.name === "moment" && e.id === "rest");
  near(song[0].t, rest.t, 1e-9, "at the rest's start");
  assert.equal(r.evs.filter((e) => e.name === "caption" && e.id === "turn.hum").length, 1);
  const st = turn.create(2, carry, { motherPhase: 0 });
  turn.jump(st, "rest");
  let ripples = 0;
  for (let i = 0; i < 16 * 60; i++) { if (turn.view(st).strips.some((s) => s.kind === "ripples")) ripples++; turn.step(st, makeIntents()); st.events.length = 0; }
  assert.ok(ripples > 600, `ripples in ${ripples} of 960 frames`);
  const d = turn.create(2, DEFAULT_CARRY, { motherPhase: 0 });
  turn.jump(d, "rest");
  assert.deepEqual(named(d.events, "song")[0].notes, [...DEFAULT_CARRY.song.notes], "the default song when none is carried");
});

await check("botSteer: full stick the shorter way only in roomy moments, memory only in r.mem, hold in the rest", () => {
  const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  const none = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  const r0 = stream(9, "x"); r0.mem = {};
  assert.deepEqual(turn.botSteer(st, 1, r0), none, "breathe: the bot plays the targets, not the stick");
  turn.jump(st, "turn");
  const t0 = st.t;
  let on = 0, off = 0;
  for (let i = 0; i < 60 * 12 && st.moment === "turn"; i++) {
    const r = stream(9, "y"); r.mem = {};
    const a = turn.botSteer(st, 1, r);
    if (roomy(st.t - t0) && !st.turn.by) {
      assert.equal(Math.abs(a.steer.x), 1); assert.equal(a.steer.y, 0);
      assert.equal(a.dir, a.steer.x > 0 ? "right" : "left");
      on++;
    } else { assert.deepEqual(a, none); off++; }
    turn.step(st, makeIntents({ steer: a.steer, touching: a.steer.x !== 0, dir: a.dir }));
    st.events.length = 0;
  }
  assert.ok(on > 100 && off > 100);
  // the shorter way: tipped anticlockwise (head left), keep going anticlockwise (stick left)
  const left = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  turn.jump(left, "turn");
  for (let i = 0; i < 60; i++) { turn.step(left, makeIntents({ steer: { x: -1, y: 0 }, touching: true })); left.events.length = 0; }
  while (!roomy(left.t - left.turn.t0)) { turn.step(left, makeIntents()); left.events.length = 0; }
  const rr = stream(1, "z"); rr.mem = {};
  assert.equal(turn.botSteer(left, 1, rr).steer.x, -1);
  assert.equal(turn.botSteer(left, 1, rr).dir, "left");
  // memory only in r.mem; the state is unchanged
  const m = turn.create(3, DEFAULT_CARRY, { motherPhase: 0 });
  turn.jump(m, "turn");
  for (let i = 0; i < 60 * 4; i++) { turn.step(m, makeIntents()); m.events.length = 0; }
  const r = stream(4, "w"); r.mem = {};
  const keys = Object.keys(r).sort();
  const before = JSON.stringify(snap(m));
  for (let i = 0; i < 5; i++) turn.botSteer(m, 0.7, r);
  assert.equal(JSON.stringify(snap(m)), before, "botSteer leaves the state alone");
  assert.deepEqual(Object.keys(r).sort(), keys, "only r.mem holds memory");
  assert.ok(Object.keys(r.mem).length > 0, "and it uses r.mem");
  // a stream with no mem still works (no memory then)
  assert.doesNotThrow(() => turn.botSteer(m, 0.5, stream(1, "bare")));
  assert.doesNotThrow(() => turn.botSteer(m, 0.5, null));
  // the rest: the bot keeps its thumb down; the outro and the end: nothing
  const rest = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  turn.jump(rest, "rest");
  assert.equal(turn.botSteer(rest, 0.7, r0).hold, true);
  turn.jump(rest, "outro");
  assert.deepEqual(turn.botSteer(rest, 1, r0), none);
  assert.deepEqual(turn.botSteer(IDLE.st, 1, r0), none);
});

await check("one-button: steer from botSteer at skill 1 only while touching turns you head-down before 30 s", () => {
  // the run's rule (16.4): intents.steer = touching ? botSteer(state, 1).steer : 0; here the button is held throughout
  const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0, oneButton: true });
  turn.jump(st, "turn");
  const rOne = stream(1, "oneButton"); rOne.mem = {};
  while (st.moment === "turn") {
    const a = turn.botSteer(st, 1, rOne);
    turn.step(st, makeIntents({ steer: a.steer, dir: a.dir, touching: true }));
    st.events.length = 0;
  }
  const res = turn.result(st);
  assert.equal(res.metrics.turnedBy, "you");
  near(res.metrics.roomyDeg, 180, 1e-6, "all in roomy moments");
  assert.equal(res.score.flourish, 1000);
});

await check("jump: forward to any moment, never back; skipped moments settle by themselves; gaDay never decreases", () => {
  for (const to of ["turn", "rest", "outro"]) {
    const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
    for (let i = 0; i < 200; i++) { turn.step(st, makeIntents()); st.events.length = 0; }
    const ga0 = st.gaDay;
    assert.equal(turn.jump(st, to), true);
    assert.equal(st.moment, to);
    assert.ok(st.gaDay >= ga0);
    near(st.gaDay, MOMENTS.find((m) => m.id === to).ga[0], 1e-9, `${to}: gaDay at its start`);
    assert.equal(turn.prompt(st).gesture, GESTURES[to]);
    assert.equal(turn.jump(st, "breathe"), false, "never back");
    assert.equal(turn.jump(st, "carried"), false, "an unknown moment");
    assert.equal(turn.jump(st, to), true, "the moment it is in");
    let last = st.gaDay;
    for (let i = 0; i < MAX_STEPS && !turn.result(st).done; i++) {
      turn.step(st, makeIntents()); st.events.length = 0;
      assert.ok(st.gaDay >= last - 1e-12); last = st.gaDay;
    }
    assert.equal(turn.result(st).done, true);
    for (const v of Object.values(st.subgoals)) assert.ok(v === "done" || v === "auto");
    assert.equal(st.turn.milestone, true, "head-down, by itself if skipped");
  }
  for (const r of ALL) {
    for (let i = 1; i < r.ga.length; i++) {
      assert.ok(r.ga[i].gaDay >= r.ga[i - 1].gaDay - 1e-9, `gaDay ${r.ga[i - 1].gaDay} → ${r.ga[i].gaDay}`);
      assert.ok(r.ga[i].mm >= r.ga[i - 1].mm - 1e-9);
    }
    assert.equal(r.st.gaDay, 280);
  }
  assert.equal(turn.jump(IDLE.st, "outro"), false, "not after the end");
});

await check("gaDay follows the 4.1 moments: 196 → 231 over the breaths, 231 → 252 over 30 s (or at head-down), 259 → 280", () => {
  const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  const seen = { breathe: [], turn: [], rest: [], outro: [] };
  for (let i = 0; i < MAX_STEPS && !turn.result(st).done; i++) {
    seen[st.moment].push(st.gaDay);
    turn.step(st, makeIntents()); st.events.length = 0;
  }
  near(seen.breathe[0], 196, 1e-9, "breathe start");
  near(Math.max(...seen.breathe), 231, 0.05, "breathe end");
  near(seen.turn[0], 231, 1e-9, "turn start");
  near(Math.max(...seen.turn), 252, 1e-9, "turn end");
  near(seen.rest[0], 259, 1e-9, "rest start");
  near(Math.max(...seen.rest), 280, 0.05, "rest end");
  assert.ok(seen.outro.every((g) => g === 280));
  const hd = IDEAL.evs.find((e) => e.name === "milestone" && e.id === "headDown");
  assert.ok(hd.t - IDEAL.evs.find((e) => e.name === "moment" && e.id === "turn").t < 12, "the ideal turn is early");
});

await check("facts: the 6.7 ids, allow-listed sources, R or A, word counts, no Week or Day start; captions in order", () => {
  const ids = FACTS.map((f) => f.id);
  assert.deepEqual(ids, ["turn.card", "turn.lungs", "turn.focus", "turn.voices", "turn.practice", "turn.curl", "turn.head", "turn.voice"]);
  const where = Object.fromEntries(FACTS.map((f) => [f.id, f.where]));
  assert.equal(where["turn.card"], "card");
  assert.equal(where["turn.voice"], "overlay");
  for (const id of ["turn.lungs", "turn.practice", "turn.focus", "turn.voices", "turn.curl", "turn.head"]) assert.equal(where[id], "caption", id);
  assert.ok(!ids.includes("turn.weight"), "the WHO weight stays out until it is checked");
  for (const f of FACTS) {
    assert.equal(f.stage, "turn");
    assert.equal(f.checked, true);
    assert.ok(f.access === "R" || f.access === "A", `${f.id} access`);
    assert.ok(f.src.length > 0 && f.src.every((k) => SOURCES[k]), `${f.id} sources ${f.src}`);
    assert.ok(!/^(week|day)\b/i.test(f.text), `${f.id} starts with a label`);
    assert.ok(f.gaDay >= 196 && f.gaDay <= 280);
    if (f.gaEnd !== undefined) {
      assert.ok(f.gaEnd > f.gaDay && !(f.gaDay < 42 && f.gaEnd >= 42));
      assert.equal(range(f.gaDay, f.gaEnd), "Weeks 31 to 34");
    }
    for (const c of Object.keys(CARERS)) {
      const text = fill(f.text, {}, { carer: c });
      assert.ok(words(text) <= 20, `${f.id} (${c}): ${words(text)} words`);
      for (const s of sentences(text)) assert.ok(words(s) <= 16, `${f.id}: "${s}"`);
    }
  }
  assert.ok(/about/.test(FACTS[0].text), "the trimester card says about");
  // in play: each caption fact once, in gaDay order, at or after its day, apart from each other
  for (const r of [IDLE, IDEAL, MIDS[0]]) {
    const caps = r.evs.filter((e) => e.name === "fact");
    assert.deepEqual(caps.map((e) => e.id), ["turn.lungs", "turn.focus", "turn.voices", "turn.practice", "turn.curl", "turn.head"]);
    for (let i = 1; i < caps.length; i++) assert.ok(caps[i].t - caps[i - 1].t >= TUNE.captionGapS - 1e-9);
    for (const e of caps) {
      const f = FACTS.find((x) => x.id === e.id);
      const g = r.ga.find((x) => Math.abs(x.t - e.t) < 1e-9);
      assert.ok(g && g.gaDay >= f.gaDay - 1e-9, `${e.id} at gaDay ${g && g.gaDay}`);
      if (f.gaEnd) assert.ok(g.gaDay <= f.gaEnd, `${e.id} inside its span`);
    }
  }
});

function sentences(text) { return text.split(/(?<=[.!?])\s+/).filter(Boolean); }
function words(text) { return text.split(/\s+/).filter((w) => /[\w{]/.test(w)).length; }
const BANNED = /\b(die|dies|died|dying|dead|death|lose|loses|losing|lost|loser|nicu)\b|\b(kill|fail|miscarr|abort|sex|pain|hurt|danger|sick|viab|prematur|invad|invas|attack|destroy|defeat|conquer|enem|fight|battle)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;

await check("strings: every id the stage emits is a string; no banned word, no pronoun, short sentences, every carer", () => {
  const used = new Set();
  for (const r of ALL) {
    for (const e of r.evs) {
      if (e.name === "prompt" && e.text) used.add(e.text);
      if (e.name === "subgoal" || e.name === "caption") used.add(e.text || e.id);
    }
    for (const p of r.res.parts) used.add(p.label);
  }
  for (const id of used) assert.notEqual(say(id), id, `${id} is registered`);
  const texts = [...Object.values(TEXT), ...FACTS.map((f) => f.text)];
  for (const raw of texts) {
    for (const c of Object.keys(CARERS)) {
      const s = fill(raw, {}, { carer: c });
      assert.ok(!BANNED.test(s), `banned word in "${s}"`);
      assert.ok(!PRONOUNS.test(s), `pronoun in "${s}"`);
      for (const x of sentences(s)) assert.ok(words(x) <= 16, `"${x}"`);
    }
  }
  assert.equal(say("turn.breathe"), "Hold. Let go.");
  assert.equal(say("turn.turn"), "Drag to turn. Turn when it is roomy.");
  // the rest is a hold and needs a fresh touch (5.3), so it never asks to keep the thumb from the turn down (F15)
  assert.equal(say("turn.rest"), "Rest. Touch and hold if you like.");
  assert.equal(say("turn.goal.turnAuto"), "You turn now.");
});

await check("never throws: garbage intents, carry and options; probe is null; view and probe are pure", () => {
  const junk = [null, undefined, {}, 5, "x", { presses: [null, { t: NaN }, { t: "a" }, { t: Infinity }], releases: 3, steer: { x: NaN, y: 1 } },
    { steer: { x: 1e9, y: -1e9 }, presses: [{ t: -50 }], releases: [{ t: 1e9 }] }, { steer: null, touching: "yes", dir: 7 }];
  for (const carry of [null, undefined, { song: { notes: [1] }, nestleX: 99, treeSeed: -4 }, DEFAULT_CARRY]) {
    for (const opts of [null, undefined, { motherPhase: NaN }, { motherPhase: 7, assist: 1 }, {}]) {
      let st;
      assert.doesNotThrow(() => { st = turn.create(8, carry, opts); });
      for (let i = 0; i < MAX_STEPS && !turn.result(st).done; i++) {
        assert.doesNotThrow(() => turn.step(st, junk[i % junk.length]));
        st.events.length = 0;
        if (i % 97 === 0) assert.deepEqual(validate(turn.view(st)), [], `t ${st.t}`);
      }
      assert.equal(turn.result(st).done, true);
      assert.equal(st.faults, 0, "no fault was swallowed");
    }
  }
  assert.doesNotThrow(() => turn.step(null, null));
  for (const r of ALL) assert.equal(r.st.faults, 0);
  const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  for (let i = 0; i < 2000; i++) { turn.step(st, noisy(1)(st)); st.events.length = 0; }
  const before = JSON.stringify(snap(st));
  assert.equal(JSON.stringify(snap(turn.view(st))), JSON.stringify(snap(turn.view(st))));
  assert.equal(turn.probe(st), null);
  assert.equal(JSON.stringify(snap(st)), before);
});

await check("Assist widens the breath windows 1.6 times", () => {
  const late = (assist) => {
    const st = turn.create(1, DEFAULT_CARRY, { motherPhase: 0, assist });
    const x = turn.targets(st, 5)[0];
    const evs = [];
    while (st.t < x.t + 0.5) {
      const t = x.t + 0.1;
      const it = t >= st.t && t < st.t + DT ? makeIntents({ presses: [{ t, raw: t }], touching: true }) : makeIntents();
      turn.step(st, it);
      evs.push(...st.events); st.events.length = 0;
    }
    return named(evs, "judge")[0].grade;
  };
  assert.equal(late(false), "close", "100 ms late: Close");
  assert.equal(late(true), "in", "100 ms late with Assist: In time");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const mid = MIDS.map((r) => r.res.score.total);
  console.log(`PASS ${FILE}: ${passed} checks (ideal ${IDEAL.res.score.total} in ${IDEAL.st.t.toFixed(1)} s; ref ${REF.res.score.total} in ${REF.st.t.toFixed(1)} s; `
    + `mid mean ${Math.round(mid.reduce((a, b) => a + b, 0) / mid.length)} in ${(MIDS.reduce((a, r) => a + r.st.t, 0) / MIDS.length).toFixed(1)} s; idle ${IDLE.res.score.total} in ${IDLE.st.t.toFixed(1)} s)`);
}
