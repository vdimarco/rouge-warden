// First Breath: stage 1, The Race (`swim`), design.md 6.1, 16.4, 18 (stage-swim row), tasks.md 2.1 to 2.5. Played in
// node with no DOM (16.11). The common stage checks: the same seed and input give the same race; the scripted ideal
// input (the ref bot, and botSteer at skill 1 held down) reaches Glowing; idle ends by the 117 s cap with goalMet
// false; the bot at skill 0.7 completes; one live gesture per moment; at most two families; every sub-goal ends done
// or auto; targets carry P (the race has none); meta.moments match the 4.1 table; every view validates. And the race
// checks: rival determinism over 20 seeds; placeNow at every step, arrivals by time and the shown place's 0.25 s
// hold; bumps (pushed apart every step, 0.7 at most once per 0.4 s, top speed back after 0.6 s, never a sperm that is
// not swimming); the cool loop back at 1,300 u within 6 s with no input, moment fork all the while; waves never lift
// an idle sperm and every bot uses each wave's shared threshold; the lane at ≥ 70 u/s and a wall at ≤ 65 u/s; the
// glow attach rule, ready on her 4th beat, detaching; ready ×1.6 on the stick term only; only the two front-runners
// among the rivals get ready; rivals 500 u behind you rest; the ref bot 1st in ≥ 18 of 20 seeds at 44 to 54 s; the
// mid bot in the top 3 in ≥ 18 with a mean arrival of 55 to 65 s; idle never past the gate, 20th at 117 s; a finish
// outside the top 3 ends with goalMet false; never past 120 s with meet or carried; botSteer's memory only in r.mem;
// probe's race shape; the facts and strings (sources, the tone rules, no harm). The race numbers in swim.tune.js must
// equal the race sim's (qa/first-breath/race-sim.mjs).
// node qa/first-breath/stage-swim.test.mjs        (FB_SWIM_SEEDS=N sets the seeds for the race gates; default 20)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as swim from "../../public/first-breath/core/stages/swim.js";
import { TUNE } from "../../public/first-breath/core/stages/swim.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/swim.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/swim.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate, LIMITS } from "../../public/first-breath/core/draw.js";
import { DT } from "../../public/first-breath/core/clock.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { say } from "../../public/first-breath/core/text.js";
import { grade } from "../../public/first-breath/core/score.js";
import { check as checkTargets } from "../../public/first-breath/core/lib/track.js";

const FILE = "qa/first-breath/stage-swim.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 10).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const SEEDS = Array.from({ length: Math.max(1, Number(process.env.FB_SWIM_SEEDS) || 20) }, (_, i) => i + 1);
const OPTS = { assist: false, oneButton: false, motherPhase: 0 };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const prog = (sp) => (sp.arrived ? TUNE.TUBE_END : sp.zone === "loop" ? TUNE.FORK : sp.p);
const RACE_MOMENTS = ["womb", "gate", "fork", "tube"];

// ---------------------------------------------------------------- playing

// Play one stage to its end. `input(st)` gives the intents (else the bot at `skill`); `each(st, evs)` sees every step.
function play(seed, { skill = null, input = null, each = null, opts = OPTS, carry = DEFAULT_CARRY, max = 20000, st = null } = {}) {
  const s = st || swim.create(seed, carry, opts);
  const bot = skill === null ? null : createBot(skill, seed);
  const evs = [...s.events];
  s.events.length = 0;
  for (let n = 0; n < max && !swim.result(s).done; n++) {
    const it = input ? input(s) : bot ? bot.intents(swim, s) : makeIntents();
    swim.step(s, it);
    const out = s.events.splice(0);
    evs.push(...out);
    if (each) each(s, out);
  }
  return { st: s, evs, res: swim.result(s) };
}

// The per-step race checks: placeNow, the shown place and its 0.25 s hold, place events, arrivals, rivals resting,
// one live gesture per moment, every 30th view valid. Returns the moments' gestures seen.
function watcher(st) {
  let since = 0, prevNow = st.placeNow, prevShown = st.place, n = 0, mustRest = [];
  const gestures = {};
  const note = (m, g) => { (gestures[m] = gestures[m] || new Set()).add(g); };
  note(st.moment, swim.prompt(st).gesture);
  const each = (s, evs) => {
    n++;
    if (n % 30 === 0) assert.deepEqual(validate(swim.view(s)), [], `view at ${s.t.toFixed(2)} s (${s.moment})`);
    for (const e of evs) if (e.name === "prompt" && !s.done) note(s.moment, e.gesture);
    if (s.done) return;
    note(s.moment, swim.prompt(s).gesture);
    const you = s.you;
    // placeNow: 1 + the sperm with more progress; arrivals rank by time, ahead of all others
    if (you.arrived) {
      const before = s.rivals.filter((o) => o.arrived && o.arriveT < you.arriveT).length;
      assert.equal(you.place, 1 + before, "your arrival place is by arrival time");
      assert.equal(s.placeNow, you.place, "placeNow holds your arrival place");
    } else {
      const yp = prog(you);
      assert.equal(s.placeNow, 1 + s.rivals.filter((o) => o.arrived || prog(o) > yp).length, `placeNow at ${s.t.toFixed(2)} s`);
    }
    // the shown place changes only after a new placeNow has held for 0.25 s, with one place event
    if (s.placeNow !== prevNow) { since = s.t; prevNow = s.placeNow; }
    const pe = evs.filter((e) => e.name === "place");
    if (s.place !== prevShown) {
      assert.equal(s.place, s.placeNow);
      assert.ok(s.t - since >= TUNE.PLACE_HOLD_S - 1e-9, `the shown place changed after ${(s.t - since).toFixed(3)} s`);
      assert.equal(pe.length, 1);
      assert.deepEqual([pe[0].place, pe[0].of], [s.place, 20]);
      prevShown = s.place;
    } else assert.equal(pe.length, 0, "no place event without a change");
    if (s.place !== s.placeNow) assert.ok(s.t - since < TUNE.PLACE_HOLD_S - 1e-9, "a held place is shown");
    // a rival in the tube 500 u or more behind you rests: the step decides from where everyone was at its start
    for (const o of mustRest) assert.ok(o.rest !== null, `rival ${o.id} rests at ${s.t.toFixed(2)} s`);
    mustRest = !you.arrived && s.racing
      ? s.rivals.filter((o) => !o.arrived && o.zone === "tube" && prog(you) - prog(o) >= TUNE.REST_BEHIND) : [];
  };
  return { each, gestures };
}

const arrivalsOk = (evs) => {
  const arr = evs.filter((e) => e.name === "arrive");
  arr.forEach((e, i) => assert.equal(e.place, i + 1, "arrive events come in place order"));
  return arr;
};

// ---------------------------------------------------------------- the races, shared by several checks

const RACES = { ref: [], mid: [], idle: [] };
const GESTURES = {};
const mergeG = (g) => { for (const [m, set] of Object.entries(g)) for (const x of set) (GESTURES[m] = GESTURES[m] || new Set()).add(x); };

await check("over 20 seeds the ref bot plays the same race twice: the same rival positions at every step", () => {
  for (const seed of SEEDS) {
    const a = swim.create(seed, DEFAULT_CARRY, OPTS), b = swim.create(seed, DEFAULT_CARRY, OPTS);
    const ba = createBot(1, seed), bb = createBot(1, seed);
    const w = watcher(a);
    const evs = [...a.events];
    a.events.length = 0; b.events.length = 0;
    let steps = 0;
    while (!swim.result(a).done && steps < 20000) {
      swim.step(a, ba.intents(swim, a));
      swim.step(b, bb.intents(swim, b));
      steps++;
      for (let i = 0; i < a.all.length; i++) {
        const x = a.all[i], y = b.all[i];
        if (x.x !== y.x || x.p !== y.p || x.zone !== y.zone || x.loopS !== y.loopS || x.speed !== y.speed) {
          assert.fail(`seed ${seed}: sperm ${x.id} differs at step ${steps} (${x.x}, ${x.p}) vs (${y.x}, ${y.p})`);
        }
      }
      assert.equal(JSON.stringify(a.events), JSON.stringify(b.events), `seed ${seed}: the same events at step ${steps}`);
      const out = a.events.splice(0);
      b.events.length = 0;
      evs.push(...out);
      w.each(a, out);
    }
    assert.equal(swim.result(b).done, true);
    assert.deepEqual(swim.result(a), swim.result(b), `seed ${seed}: the same result`);
    arrivalsOk(evs);
    mergeG(w.gestures);
    RACES.ref.push({ seed, st: a, evs, res: swim.result(a) });
  }
});

await check("the mid bot (0.7) and idle play 20 seeds; placeNow, the shown place and resting hold at every step", () => {
  for (const seed of SEEDS) {
    for (const [name, skill] of [["mid", 0.7], ["idle", 0]]) {
      const st = swim.create(seed, DEFAULT_CARRY, OPTS);
      const w = watcher(st);
      const r = play(seed, { skill, st, each: w.each });
      assert.equal(r.res.done, true, `${name} seed ${seed} completes`);
      assert.equal(r.res.metrics.fault, null, `${name} seed ${seed}: no fault`);
      arrivalsOk(r.evs);
      mergeG(w.gestures);
      RACES[name].push({ seed, ...r });
    }
  }
});

// ---------------------------------------------------------------- the 6.1 gates

await check("the ref bot is 1st in ≥ 18 of 20 seeds and arrives at 44 to 54 s", () => {
  const n = RACES.ref.length, need = Math.ceil(0.9 * n);
  const first = RACES.ref.filter((r) => r.res.metrics.place === 1).length;
  assert.ok(first >= need, `1st in ${first} of ${n}`);
  for (const r of RACES.ref) {
    assert.equal(r.res.metrics.arrived, true, `seed ${r.seed} arrives`);
    const at = r.res.metrics.arriveT;
    assert.ok(at >= 44 && at <= 54, `seed ${r.seed} arrives at ${at.toFixed(1)} s`);
  }
});

await check("the mid bot (0.7) is in the top 3 in ≥ 18 of 20 seeds, with a mean arrival of 55 to 65 s", () => {
  const n = RACES.mid.length, need = Math.ceil(0.9 * n);
  const top = RACES.mid.filter((r) => r.res.metrics.place <= 3).length;
  assert.ok(top >= need, `top 3 in ${top} of ${n}`);
  const arr = RACES.mid.filter((r) => r.res.metrics.arrived).map((r) => r.res.metrics.arriveT);
  assert.equal(arr.length, n, "every mid race arrives");
  const m = mean(arr);
  assert.ok(m >= 55 && m <= 65, `mean arrival ${m.toFixed(1)} s`);
});

await check("idle never passes the gate and ends at the 117 s cap, 20th, with goalMet false", () => {
  for (const r of RACES.idle) {
    assert.ok(r.st.you.maxP < TUNE.WOMB_END, `seed ${r.seed}: reached ${r.st.you.maxP} u`);
    near(r.st.t, 117, 1e-6, `seed ${r.seed} ends at the cap`);
    assert.equal(r.res.goalMet, false);
    assert.equal(r.res.metrics.capped, true);
    assert.equal(r.res.metrics.place, 20);
    assert.equal(r.res.score.goal, 0);
    assert.equal(r.res.carryOut.sperm.place, 20, "the carry takes the place");
    assert.equal(r.st.you.rideS, 0, "the waves never lift an idle sperm");
    assert.deepEqual(r.st.you.waves, []);
    assert.ok(r.st.rivals.every((o) => o.maxP >= TUNE.FORK), "every rival passes the gate");
  }
});

await check("the scripted ideal input reaches Glowing: the ref bot, and botSteer at skill 1 held down (one-button)", () => {
  for (const r of RACES.ref) {
    const g = grade(r.res.score.total, r.res.goalMet);
    assert.equal(g, "Glowing", `seed ${r.seed}: ${r.res.score.total} (${g})`);
  }
  for (const seed of [1, 2, 3]) {
    const rOne = stream(seed, "oneButton");
    rOne.mem = {};
    const r = play(seed, { input: (s) => makeIntents({ steer: swim.botSteer(s, 1, rOne).steer, touching: true }) });
    assert.equal(grade(r.res.score.total, r.res.goalMet), "Glowing", `held one-button seed ${seed}: ${r.res.score.total}`);
    assert.equal(r.res.metrics.place, 1);
  }
});

await check("every race ends by its cap; with meet or carried never past 120 s; the stage ends with done", () => {
  for (const r of [...RACES.ref, ...RACES.mid, ...RACES.idle]) {
    assert.ok(r.st.t <= 120 + 1e-6, `seed ${r.seed} ran ${r.st.t}`);
    assert.equal(r.evs.filter((e) => e.name === "done").length, 1, "one done event");
    if (r.res.metrics.arrived) near(r.st.t - r.res.metrics.arriveT, TUNE.MEET_S, DT + 1e-6, "meet lasts 2.5 s");
  }
  // Go on after the cap: the 3 s carry, input none, done at 120 s, goalMet false, Goal 0, Skill kept
  const idle = RACES.idle[0];
  const before = swim.result(idle.st);
  assert.equal(swim.jump(idle.st, "carried"), true);
  assert.equal(idle.st.moment, "carried");
  assert.equal(swim.result(idle.st).done, false);
  assert.equal(swim.prompt(idle.st).gesture, "none");
  const r = play(idle.seed, { st: idle.st, input: () => makeIntents({ steer: { x: 1, y: 1 }, touching: true }) });
  near(r.st.t, 120, 1e-6, "the carry ends at 120 s");
  assert.equal(r.res.done, true);
  assert.equal(r.res.goalMet, false);
  assert.equal(r.res.score.goal, 0);
  assert.equal(r.res.score.skill, before.score.skill);
  assert.ok(r.evs.some((e) => e.name === "moment" && e.id === "carried"));
  assert.deepEqual(validate(swim.view(r.st)), []);
  near(r.st.you && swim.probe(r.st).you.y, TUNE.TUBE_END + TUNE.MEET_GLIDE, 1e-6, "carried to the meeting place");
  // a mid-race Go on after the cap, from the cool loop or the tube, also ends at 120 s
  const st = swim.create(4, DEFAULT_CARRY, OPTS);
  play(4, { st, skill: 0.25 });
  if (swim.result(st).metrics.capped) {
    swim.jump(st, "carried");
    play(4, { st });
    near(st.t, 120, 1e-6, "carried from a mid-course cap");
  }
});

await check("a finish outside the top 3 ends with goalMet false, Goal 0 and the goal sub-goal settled auto", () => {
  let found = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const bot = createBot(1, seed);
    const r = play(seed, { input: (s) => (s.t < 62 ? makeIntents() : bot.intents(swim, s)) });
    if (!r.res.metrics.arrived || r.res.metrics.place <= 3) continue;
    found++;
    assert.equal(r.res.done, true);
    assert.equal(r.res.goalMet, false, `seed ${seed}: place ${r.res.metrics.place}`);
    assert.equal(r.res.metrics.capped, false, "not the cap: Go on goes straight to the overlay");
    assert.equal(r.res.score.goal, 0);
    assert.equal(r.res.score.flourish, 0);
    assert.equal(r.st.subgoals.goal, "auto");
    assert.equal(r.res.carryOut.sperm.place, r.res.metrics.place);
  }
  assert.ok(found >= 1, "a late start finishes outside the top 3 in some seed");
});

// ---------------------------------------------------------------- the common stage checks

await check("meta: the 4.1 moments, one family (steer), canFail, the 117 s cap", () => {
  const m = swim.meta;
  assert.deepEqual([m.id, m.index, m.name, m.verb, m.orient], ["swim", 0, "The Race", "Race", "long"]);
  assert.deepEqual([...m.families], ["steer"]);
  assert.ok(m.families.length <= 2);
  assert.deepEqual([m.ga.start, m.ga.end, m.fertilized, m.canFail, m.scored, m.capS, m.motherBpm], [14, 14, false, true, true, 117, 72]);
  assert.deepEqual(m.moments.map((x) => x.id), ["womb", "gate", "fork", "tube", "meet", "carried"]);
  for (const x of m.moments) {
    assert.deepEqual([...x.ga], [14, 14], `${x.id} stays at gaDay 14`);
    assert.equal(x.lenS, null, `${x.id} has no lenS (4.1: –)`);
  }
});

await check("one live gesture per moment: drag in womb, gate, fork and tube; none in meet and carried", () => {
  const want = { womb: "drag", gate: "drag", fork: "drag", tube: "drag", meet: "none" };
  for (const [m, g] of Object.entries(want)) {
    assert.ok(GESTURES[m], `saw ${m}`);
    assert.deepEqual([...GESTURES[m]], [g], `${m}: ${[...GESTURES[m]].join(", ")}`);
  }
  const st = swim.create(1, DEFAULT_CARRY, OPTS);
  assert.deepEqual(swim.prompt(st), { gesture: "drag", text: null, keys: "steer" }, "live at once, the text at 0.3 s");
  const r = play(1, { st, max: 20 });
  const p = r.evs.filter((e) => e.name === "prompt");
  assert.equal(p[0].t, 0, "the first prompt at the stage start");
  near(p[1].t, 0.3, 1e-9, "\"Drag to swim.\" at 0.3 s");
  assert.equal(p[1].text, "swim.prompt");
  assert.ok(p.every((e) => e.gesture === "drag" && e.keys === "steer"));
  // the stick is read from 0.5 s
  const s2 = swim.create(1, DEFAULT_CARRY, OPTS);
  play(1, { st: s2, max: 29, input: () => makeIntents({ steer: { x: 0, y: 1 }, touching: true }) });
  assert.equal(s2.you.speed, 0, "no steering before 0.5 s");
  play(1, { st: s2, max: 2, input: () => makeIntents({ steer: { x: 0, y: 1 }, touching: true }) });
  assert.ok(s2.you.speed > 0, "steering live at 0.5 s");
});

await check("every sub-goal ends done or auto, and is shown or settled with an event", () => {
  for (const r of [...RACES.ref, ...RACES.mid, ...RACES.idle]) {
    assert.ok(r.st.subgoals.goal, "the goal line is shown");
    for (const [id, s] of Object.entries(r.st.subgoals)) assert.ok(s === "done" || s === "auto", `seed ${r.seed}: ${id} is ${s}`);
    const ev = r.evs.filter((e) => e.name === "subgoal");
    for (const id of Object.keys(r.st.subgoals)) assert.ok(ev.some((e) => e.id === id && e.state !== "shown"), `${id} settles with an event`);
  }
  const ref = RACES.ref[0];
  assert.deepEqual(ref.st.subgoals, { goal: "done", warm: "done", ready: "done" });
  const goal = ref.evs.find((e) => e.name === "subgoal" && e.id === "goal");
  near(goal.t, 1.0, 1e-9, "the goal line at 1.0 s");
  assert.equal(goal.text, "swim.goal");
});

await check("targets carry P: the race has no timed targets", () => {
  for (const r of [RACES.ref[0], RACES.idle[0]]) {
    const t = swim.targets(r.st, 10);
    assert.ok(Array.isArray(t));
    assert.deepEqual(checkTargets(t), []);
    assert.ok(t.every((x) => Number.isFinite(x.P)));
  }
  const st = swim.create(2, DEFAULT_CARRY, OPTS);
  for (let i = 0; i < 300; i++) { assert.deepEqual(swim.targets(st, 5), []); swim.step(st, makeIntents()); }
});

await check("the same seed and input give the same result (two seeds, mid bot and a scripted stick)", () => {
  for (const seed of [3, 11]) {
    const a = play(seed, { skill: 0.7 }), b = play(seed, { skill: 0.7 });
    assert.deepEqual(a.res, b.res);
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs));
    const script = () => { const r = stream(seed, "script"); return (s) => makeIntents({ steer: { x: 2 * r() - 1, y: r() }, touching: true }); };
    const c = play(seed, { input: script() }), d = play(seed, { input: script() });
    assert.equal(JSON.stringify(swim.probe(c.st)), JSON.stringify(swim.probe(d.st)));
    assert.deepEqual(c.res, d.res);
  }
  const e = play(5, { skill: 0.7 }), f = play(6, { skill: 0.7 });
  assert.notEqual(JSON.stringify(swim.probe(e.st)), JSON.stringify(swim.probe(f.st)), "another seed, another race");
});

await check("every view is valid, with a camera, an anchor at you and a cue; the course stays within 32 points a strip", () => {
  const spans = new Set();
  const look = (s) => {
    const v = swim.view(s);
    assert.deepEqual(validate(v), []);
    const pr = swim.probe(s);
    assert.deepEqual(v.anchor, { x: pr.you.x, y: pr.you.y }, "the anchor is you");
    assert.ok(v.cue && Number.isFinite(v.cue.x) && Number.isFinite(v.cue.y), "a cue");
    assert.deepEqual(v.scale, { you: "0.05 mm" });
    assert.equal(v.camera.orient, "long");
    near(v.camera.mmPerU * v.camera.span, 0.3, 1e-9, "0.3 mm across the short axis");
    const courses = v.strips.filter((x) => x.kind === "course");
    assert.ok(courses.length >= 1 && courses.every((x) => x.pts.length / 2 <= LIMITS.coursePts));
    const tails = v.strips.find((x) => x.kind === "tails");
    assert.ok(tails.items.some((x) => x.ring === "halo"), "you, with the sticker");
    if (pr.you.y < TUNE.WOMB_END) assert.equal(v.camera.span, 170);
    if (pr.you.y >= TUNE.GATE_END) assert.equal(v.camera.span, 150);
    spans.add(v.camera.span);
    return v;
  };
  let bands = 0, glows = 0, meets = 0, cool = 0, chev = 0;
  play(9, { skill: 0.7, each: (s) => {
    if (s.done) return;
    const v = look(s);
    bands += v.marks.some((m) => m.kind === "band") ? 1 : 0;
    glows += v.marks.some((m) => m.kind === "glowwall") ? 1 : 0;
    meets += v.marks.some((m) => m.kind === "meet") ? 1 : 0;
    cool += v.strips.some((x) => x.kind === "course" && x.tone === "cool") ? 1 : 0;
    chev += v.strips.some((x) => x.kind === "chevrons") ? 1 : 0;
  } });
  assert.ok(bands && glows && meets && cool && chev, `waves ${bands}, glow walls ${glows}, meet ${meets}, cool loop ${cool}, lane ${chev}`);
  assert.ok(spans.has(170) && spans.has(150), "170 u in the womb, 150 u from the gate on");
});

// ---------------------------------------------------------------- the race rules, one by one

// A state at 1.0 s (steering live, no wave yet) with every rival parked far behind, not swimming.
function lab(seed = 1) {
  const st = swim.create(seed, DEFAULT_CARRY, OPTS);
  for (let i = 0; i < 60; i++) swim.step(st, makeIntents());
  st.events.length = 0;
  for (const o of st.rivals) Object.assign(o, { x: 0, p: -15, speed: 0, mag: 0, attached: "rest", rest: 0 });
  return st;
}
const full = makeIntents({ steer: { x: 0, y: 1 }, touching: true });

await check("bumps: pushed apart every step; 0.7 of the speed at most once per 0.4 s; top speed back after 0.6 s", () => {
  const st = lab();
  const you = st.you, o = st.rivals[5];
  Object.assign(you, { x: 0, p: 600, speed: 40, ang: Math.PI / 2 });
  Object.assign(o, { x: 2, p: 600, speed: 40, ang: Math.PI / 2, attached: null, rest: null });
  const t0 = st.t;
  swim.step(st, full);
  near(Math.hypot(o.x - you.x, o.p - you.p), 6, 1e-6, "pushed apart to touching");
  near(you.speed, 0.7 * 42, 1e-9, "you keep 0.7 of your speed (40 + 2 this step)");
  assert.equal(you.bumps, 1);
  assert.equal(o.bumps, 1);
  near(you.bumpAt, t0, 1e-12, "the bump time");
  const bump = st.events.find((e) => e.name === "bump");
  assert.ok(bump && [bump.a, bump.b].includes("you") && [bump.a, bump.b].includes(5), "a bump event names both");
  assert.ok(swim.view(st).strips.some((x) => x.kind === "ripples"), "a contact ring");
  // overlapping again before 0.4 s: pushed apart, but no second speed loss
  for (let k = 0; k < 5; k++) {
    Object.assign(o, { x: you.x + 1, p: you.p });
    const s0 = you.speed;
    swim.step(st, full);
    near(Math.hypot(o.x - you.x, o.p - you.p), 6, 1e-6, "pushed apart again");
    near(you.speed, Math.min(55 * (0.8 + 0.2 * Math.min(1, (st.t - DT - t0) / 0.6)), s0 + 2), 1e-9, "no second loss within 0.4 s");
    assert.equal(you.bumps, 1);
  }
  // after 0.4 s the next overlap costs speed again
  o.p = -15; o.attached = "rest";
  while (st.t - t0 < 0.4) swim.step(st, full);
  Object.assign(o, { x: you.x + 1, p: you.p, attached: null, speed: 40 });
  swim.step(st, full);
  assert.equal(you.bumps, 2, "a new loss after 0.4 s");
  // the top speed: ×0.8 right after a bump, ×1 after 0.6 s (read from the drag toward the target)
  o.p = -15; o.attached = "rest";
  const tb = you.bumpAt;
  const topNow = () => {
    you.speed = 80;
    const e = Math.exp(-1.8 * DT);
    swim.step(st, full);
    return (you.speed - 80 * e) / (1 - e) / 55;
  };
  const top1 = topNow();
  near(top1, 0.8 + 0.2 * ((st.t - DT - tb) / 0.6), 1e-6, "eased from ×0.8");
  assert.ok(top1 < 0.9);
  while (st.t - tb < 0.62) swim.step(st, full);
  near(topNow(), 1, 1e-9, "back to ×1 after 0.6 s");
});

await check("sperm that are not swimming are never bumped: an idle sperm, and an attached one", () => {
  const st = lab();
  const you = st.you, o = st.rivals[3];
  Object.assign(you, { x: 0, p: 600, speed: 0 });
  Object.assign(o, { x: 1, p: 600, speed: 40, ang: Math.PI / 2, attached: null, rest: null });
  for (let i = 0; i < 10; i++) {
    swim.step(st, makeIntents());
    assert.deepEqual([you.x, you.p], [0, 600], "idle: you are passed over");
    o.x = you.x + 1; o.p = you.p;
  }
  assert.equal(you.bumps, 0);
  assert.equal(o.bumps, 0);
  assert.ok(!st.events.some((e) => e.name === "bump"));
  // an attached sperm with a swimming one on top of it
  Object.assign(you, { x: 0, p: 700, speed: 50, ang: Math.PI / 2 });
  const r = st.rivals[4];
  Object.assign(r, { x: 0.5, p: 701, speed: 0, attached: "rest", rest: 0 });
  swim.step(st, full);
  assert.deepEqual([r.x, r.p], [0.5, 701], "the resting sperm does not move");
  assert.equal(you.bumps, 0);
});

await check("the cool loop brings you back to the fork at 1,300 u within 6 s, also with no input; moment fork all the while", () => {
  for (const stick of [0, 1]) {
    const st = lab(2);
    swim.jump(st, "fork");
    const cool = -st.warm;
    let n = 0;
    while (st.you.zone !== "loop" && n++ < 300) swim.step(st, makeIntents({ steer: { x: 0.8 * cool, y: 0.6 }, touching: true }));
    assert.equal(st.you.zone, "loop", "the cool side of the split leads into the loop");
    if (!stick) st.you.speed = 0;                         // idle from the mouth: only the loop's flow carries it
    assert.ok(st.events.some((e) => e.name === "fork" && e.tube === "cool"));
    const t0 = st.t;
    while (st.you.zone === "loop" && st.t - t0 < 10) {
      swim.step(st, stick ? full : makeIntents());
      assert.equal(st.moment, "fork");
      assert.equal(swim.probe(st).you.progress, 1300, "counts as at 1,300 u");
      assert.equal(swim.view(st).strips.some((x) => x.kind === "course" && x.tone === "cool"), true);
    }
    const dt = st.t - t0;
    assert.ok(dt <= 6, `back after ${dt.toFixed(2)} s (stick ${stick})`);
    assert.ok(stick ? dt < 2.5 : dt > 3.5, `${dt.toFixed(2)} s: about 1.7 s at full stick, 4.0 s idle`);
    assert.equal(st.you.p, 1300);
    assert.equal(st.you.zone, "path");
    assert.equal(st.moment, "fork");
    assert.equal(st.you.loops, 1);
  }
  // rivals that took the cool way came back and went on
  const coolRivals = RACES.ref.flatMap((r) => r.st.rivals.filter((o) => o.loops > 0));
  assert.ok(coolRivals.length > 0, "some rivals take the cool way");
  assert.ok(coolRivals.every((o) => o.zone === "tube" || o.zone === "path"), "and come back out");
});

await check("the waves lift only a sperm that swims with them, and every bot uses each wave's shared threshold", () => {
  for (const r of [...RACES.ref, ...RACES.mid]) {
    const skillOf = (sp) => (sp.you ? (r === RACES.ref.find((x) => x === r) ? 1 : 0.7) : sp.skill);
    for (const sp of r.st.all) {
      const sk = sp.you ? (RACES.ref.includes(r) ? 1 : 0.7) : sp.skill;
      for (const k of sp.waves) assert.ok(r.st.thr[k] < 0.3 + 0.7 * sk, `seed ${r.seed}: ${sp.id} (skill ${sk}) rode wave ${k} (threshold ${r.st.thr[k].toFixed(2)})`);
    }
    void skillOf;
  }
  // the thresholds are the shared stream values
  const st = swim.create(7, DEFAULT_CARRY, OPTS);
  for (let k = 0; k < 5; k++) {
    const w = stream(7, "wave:" + k);
    assert.equal(st.thr[k], w());
    assert.equal(st.cen[k], (2 * w() - 1) * 40);
  }
  // a wave over an idle head does not lift it; the same head swimming with it is lifted to 140 u/s
  for (const stick of [0, 1]) {
    const s = lab(7);
    while (s.t < 2.0) swim.step(s, makeIntents());
    const front = -20 + 140 * (s.t - 1.2);
    Object.assign(s.you, { x: s.cen[0], p: front - 30, speed: stick ? 140 : 0, ang: Math.PI / 2 });
    swim.step(s, stick ? full : makeIntents());
    assert.equal(s.you.lifted, !!stick, `stick ${stick}`);
    if (stick) assert.equal(s.you.speed, 140, "lifted to 140 u/s");
    else assert.equal(s.you.speed, 0);
  }
});

await check("in the tube at full stick the lane centre gives ≥ 70 u/s and a wall ≤ 65 u/s", () => {
  const run = (setup, steer) => {
    const st = lab(1);
    swim.jump(st, "tube");
    Object.assign(st.you, { p: 2200, lastCheck: 2200, speed: 55, ang: Math.PI / 2 });
    setup(st);
    const v = [];
    for (let i = 0; i < 600; i++) { const p0 = st.you.p; swim.step(st, steer(st)); v.push((st.you.p - p0) / DT); }
    return mean(v);
  };
  const lane = run((st) => { st.you.x = st.warm * 30 + 12 * Math.sin(2 * Math.PI * 0.1 * st.t); }, (st) => {
    const a = Math.max(-20, Math.min(20, Math.atan2(st.warm * 30 + 12 * Math.sin(2 * Math.PI * 0.1 * st.t) - st.you.x, 40) * 180 / Math.PI)) * Math.PI / 180;
    return makeIntents({ steer: { x: Math.sin(a), y: Math.cos(a) }, touching: true });
  });
  assert.ok(lane >= 70, `lane ${lane.toFixed(1)} u/s`);
  for (const side of [-1, 1]) {
    const wall = run((st) => { st.you.x = st.warm * 30 + side * 27; }, () => full);
    assert.ok(wall <= 65, `wall ${wall.toFixed(1)} u/s`);
  }
});

await check("letting go inside a glow attaches (speed 0, no drift); ready on her 4th beat; a stick ≥ 0.25 detaches", () => {
  const st = lab(3);
  swim.jump(st, "tube");
  const g = { x: st.warm * 30 - 30, y: 1700 };
  Object.assign(st.you, { x: g.x + 8 * Math.sign(st.warm * 30 - g.x || 1), p: g.y - 5, lastCheck: 1400, speed: 30, ang: Math.PI / 2 });
  swim.step(st, makeIntents());
  assert.equal(st.you.attached, "glow");
  assert.equal(st.you.speed, 0);
  const tAttach = st.t;
  const beats = Array.from(st.beats.mother).filter((b) => b > tAttach);
  const at = [st.you.x, st.you.p];
  let readyStep = null;
  for (let i = 0; i < 300 && readyStep === null; i++) {
    swim.step(st, makeIntents({ steer: { x: 0.1, y: 0.1 }, touching: true }));
    assert.deepEqual([st.you.x, st.you.p], at, "no drift, no current");
    if (st.you.ready) readyStep = st.t;
  }
  assert.equal(st.you.readyAt, beats[3], "ready on her 4th beat");
  assert.ok(readyStep >= beats[3] && readyStep - DT < beats[3] + 1e-9, "in the step that holds it");
  const wait = beats[3] - tAttach;
  assert.ok(wait >= 2.4 && wait <= 3.4, `${wait.toFixed(2)} s on the glow`);
  assert.equal(st.you.readyHow, "glow");
  assert.ok(st.events.some((e) => e.name === "milestone" && e.id === "ready"));
  assert.ok(swim.view(st).marks.some((m) => m.kind === "glowwall" && m.on === 1), "your glow is lit");
  swim.step(st, makeIntents({ steer: { x: 0, y: 0.3 }, touching: true }));
  assert.equal(st.you.attached, null, "detached");
  for (let i = 0; i < 30; i++) swim.step(st, full);
  assert.ok(st.you.p > g.y, "and swims on");
  // a sperm that drifts back to its last checkpoint with no stick holds there
  const s2 = lab(3);
  swim.jump(s2, "tube");
  Object.assign(s2.you, { x: s2.warm * 30, p: 2205, lastCheck: 2200, speed: 0 });
  for (let i = 0; i < 120; i++) swim.step(s2, makeIntents());
  assert.equal(s2.you.p, 2200, "the current never pushes it behind 2,200 u");
  assert.equal(s2.you.attached, "check");
});

await check("ready multiplies only the stick term, by 1.6: not the bonuses, not the current, not a wave", () => {
  const fwd = (ready) => {
    const st = lab(4);
    swim.jump(st, "tube");
    const lx = st.warm * 30 + 12 * Math.sin(2 * Math.PI * 0.1 * st.t);
    Object.assign(st.you, { x: lx, p: 2300, lastCheck: 2200, speed: ready ? 88 : 55, ang: Math.PI / 2, ready });
    const p0 = st.you.p;
    swim.step(st, full);
    return { v: (st.you.p - p0) / DT, s: st.you.speed };
  };
  const a = fwd(false), b = fwd(true);
  near(a.s, 55, 1e-9, "unready own speed");
  near(b.s, 88, 1e-9, "ready own speed 55 × 1.6");
  near(b.v - a.v, 33, 1e-6, "the forward gain is the stick term's alone");
  const s = lab(7);
  while (s.t < 2.0) swim.step(s, makeIntents());
  Object.assign(s.you, { x: s.cen[0], p: -20 + 140 * (s.t - 1.2) - 30, speed: 140, ang: Math.PI / 2, ready: true });
  swim.step(s, full);
  assert.equal(s.you.speed, 140, "a wave lifts a ready sperm to 140 u/s, not more");
});

await check("among the rivals only the two front-runners ever get ready, on a glow; resting never makes one ready", () => {
  let readies = 0;
  for (const r of [...RACES.ref, ...RACES.mid, ...RACES.idle]) {
    for (const o of r.st.rivals) {
      if (o.ready) { readies++; assert.ok(o.id < 2, `seed ${r.seed}: rival ${o.id} (skill ${o.skill}) got ready`); }
      if (o.ready) assert.equal(o.readyHow, "glow", "ready only on a glow");
      if (o.rest !== null && o.ready) assert.ok(o.readyAt <= o.rest, `rival ${o.id} was ready before it rested`);
    }
    assert.ok(r.st.rivals.filter((o) => o.ready).length + (r.st.you.ready ? 1 : 0) <= 3, "at most 3 of the 20");
  }
  assert.ok(readies > 0, "the front-runners do rest and get ready");
});

await check("a rival in the tube 500 u or more behind you rests, attached to a wall, and the caption says so", () => {
  let rested = 0;
  for (const r of [...RACES.ref, ...RACES.mid]) {
    for (const o of r.st.rivals) {
      if (o.rest === null) continue;
      rested++;
      assert.ok(o.arrived || o.attached === "rest", `seed ${r.seed}: rival ${o.id} rests on a wall`);
    }
    if (r.st.rivals.some((o) => o.rest !== null)) {
      assert.ok(r.evs.some((e) => e.name === "caption" && e.id === "swim.othersRest") || r.st.said.includes("swim.othersRest"), "Some sperm rest on the walls.");
    }
  }
  assert.ok(rested > 0, "rivals rest far behind a good swimmer");
  assert.ok(RACES.idle.every((r) => r.st.rivals.every((o) => o.rest === null)), "nobody rests behind an idle you");
});

await check("botSteer keeps its memory only in r.mem, and returns { steer, dir, hold }", () => {
  const st = swim.create(5, DEFAULT_CARRY, OPTS);
  const bot = createBot(0.7, 5);
  for (let i = 0; i < 900; i++) swim.step(st, bot.intents(swim, st));
  const before = JSON.stringify(st, (k, v) => (typeof v === "function" ? "[fn]" : v));
  const ra = stream(1, "a"), rb = stream(1, "a");
  ra.mem = {}; rb.mem = {};
  const a = swim.botSteer(st, 0.7, ra);
  assert.equal(JSON.stringify(st, (k, v) => (typeof v === "function" ? "[fn]" : v)), before, "the state is unchanged");
  assert.ok(Object.keys(ra.mem).length > 0, "its memory is in r.mem");
  assert.deepEqual(rb.mem, {}, "another caller's memory is untouched");
  assert.deepEqual(swim.botSteer(st, 0.7, rb), a, "the same stream and memory give the same stick");
  assert.deepEqual(Object.keys(a).sort(), ["dir", "hold", "steer"]);
  assert.equal(a.hold, false);
  assert.ok(Math.hypot(a.steer.x, a.steer.y) <= 1 + 1e-9);
  const still = swim.botSteer(swim.create(5, DEFAULT_CARRY, OPTS), 1, Object.assign(stream(2, "b"), { mem: {} }));
  assert.deepEqual(still.steer, { x: 0, y: 0 }, "still before 0.5 s");
  assert.doesNotThrow(() => swim.botSteer(st, 1, null), "no stream: no throw");
  // each rival keeps its own stream and memory in the state
  assert.ok(st.rivals.every((o) => typeof o.r === "function" && o.r.mem && typeof o.r.mem === "object"));
  assert.equal(new Set(st.rivals.map((o) => o.r.mem)).size, 19);
});

await check("probe returns the race shape of 16.9 in world units", () => {
  const r = RACES.mid[0];
  const p = swim.probe(r.st);
  assert.deepEqual(Object.keys(p).sort(), ["of", "place", "placeNow", "rivals", "you"]);
  assert.equal(p.of, 20);
  assert.deepEqual(Object.keys(p.you).sort(), ["progress", "ready", "x", "y"]);
  assert.equal(p.rivals.length, 19);
  for (const o of p.rivals) {
    assert.deepEqual(Object.keys(o).sort(), ["id", "progress", "ready", "skill", "state", "tube", "x", "y"]);
    assert.ok(["swim", "rest", "arrived"].includes(o.state));
    assert.ok(["warm", "cool", null].includes(o.tube));
    assert.ok([o.x, o.y, o.progress].every(Number.isFinite));
  }
  assert.deepEqual(p.rivals.map((o) => o.skill), [...TUNE.SKILLS], "rivals by rung: the skill ladder");
  assert.equal(p.place, r.res.metrics.place);
  const st = swim.create(1, DEFAULT_CARRY, OPTS);
  const q = swim.probe(st);
  assert.deepEqual([q.place, q.placeNow, q.you.x, q.you.y, q.you.progress], [9, 9, -5, 24, 24], "row 3 of the grid: 9th");
  assert.deepEqual(q.rivals.map((o) => o.y).sort((a, b) => a - b), [0, 0, 0, 0, 12, 12, 12, 12, 24, 24, 24, 36, 36, 36, 36, 48, 48, 48, 48]);
});

await check("the carry: your tint in, your place and glow out; Assist still lets the ref bot place 1st", () => {
  const carry = mergeCarry(DEFAULT_CARRY, { sperm: { hue: 0.2 } });
  const r = play(2, { skill: 1, carry });
  assert.deepEqual(r.res.carryOut, { sperm: { hue: 0.2, place: 1, glow: 1 } });
  assert.ok(swim.view(r.st).strips.find((x) => x.kind === "tails").items.some((x) => x.ring === "halo" && x.hue === 0.2));
  const idle = RACES.idle[0].res.carryOut.sperm;
  assert.deepEqual([idle.place, idle.glow], [20, 0.5]);
  assert.deepEqual(mergeCarry(DEFAULT_CARRY, r.res.carryOut).sperm, { hue: 0.2, place: 1, glow: 1 }, "mergeCarry keeps it");
  // Assist: your current ×0.7 (drift back on the tube centre with no stick)
  const drift = (assist) => {
    const st = swim.create(1, DEFAULT_CARRY, { ...OPTS, assist });
    for (let i = 0; i < 40; i++) swim.step(st, makeIntents());
    swim.jump(st, "tube");
    Object.assign(st.you, { x: st.warm * 30, p: 2500, lastCheck: 2200, speed: 0 });   // the lane covers the centre
    const p0 = st.you.p;
    swim.step(st, makeIntents());
    return (p0 - st.you.p) / DT;
  };
  near(drift(true) / drift(false), 0.7, 1e-6, "Assist: the current ×0.7");
  const a = play(3, { skill: 1, opts: { ...OPTS, assist: true } });
  assert.equal(a.res.metrics.place, 1);
});

await check("her beats start at motherPhase at 72 bpm; gaDay stays 14, before fertilization", () => {
  const st = swim.create(1, DEFAULT_CARRY, { ...OPTS, motherPhase: 0.37 });
  near(st.beats.mother[0], 0.37, 1e-12, "her first beat");
  near(st.beats.bpm("mother", 10), 72, 1e-9);
  assert.equal(st.gaDay, 14);
  assert.equal(st.fertilized, false);
  assert.ok(RACES.ref.every((r) => r.st.gaDay === 14 && r.st.fertilized === false));
});

// ---------------------------------------------------------------- facts, strings and tone

const RACE_TEXT = /\b(fastest|winner|win|wins|won)\b|\bbeats? the\b/i;
const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter(Boolean);
const words = (t) => t.split(/\s+/).filter(Boolean).length;

await check("the facts: the 15.2 rows, allow-listed sources, access R or A, labels at Week 2, no swim.race", () => {
  const ids = FACTS.map((f) => f.id);
  assert.deepEqual(ids, ["swim.half", "swim.waves", "swim.few", "swim.side", "swim.warm", "swim.flow", "swim.walls", "swim.rest",
    "swim.ready", "swim.hyper", "swim.wait", "swim.frame"]);
  for (const f of FACTS) {
    assert.equal(f.stage, "swim");
    assert.equal(f.gaDay, 14);
    assert.equal(f.fertilized, false);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.equal(f.checked, true);
    assert.ok(f.src.length > 0 && f.src.every((k) => SOURCES[k]), `${f.id}: ${f.src.join(", ")}`);
    assert.ok(["card", "caption", "overlay", "end", "result"].includes(f.where));
    assert.ok(words(f.text) <= 20, `${f.id}: ${words(f.text)} words`);
    for (const s of sentences(f.text)) assert.ok(words(s) <= 16, `${f.id}: "${s}"`);
    assert.ok(!/^(Week|Day)\b/.test(f.text));
  }
  assert.equal(FACTS.find((f) => f.id === "swim.wait").where, "overlay");
  assert.equal(FACTS.find((f) => f.id === "swim.frame").where, "result");
  assert.ok(!ids.includes("swim.race"));
  // every fact the stage shows is in the table; the ref race shows every caption fact
  const shown = new Set(RACES.ref.flatMap((r) => r.evs.filter((e) => e.name === "fact").map((e) => e.id)));
  for (const id of shown) assert.ok(ids.includes(id), id);
  for (const f of FACTS.filter((x) => x.where === "caption")) assert.ok(shown.has(f.id), `${f.id} is shown in a ref race`);
  const first = RACES.ref[0].evs.find((e) => e.name === "fact" || e.name === "caption");
  assert.equal(first.id, "swim.half", "swim.half is the first caption");
});

await check("the strings: every id the stage uses is registered; plain words, no harm, no race boasts, no pronouns", () => {
  const used = new Set();
  for (const r of [...RACES.ref, ...RACES.mid, ...RACES.idle]) {
    for (const e of r.evs) {
      if (e.name === "prompt" && e.text) used.add(e.text);
      if (e.name === "subgoal" || e.name === "caption") used.add(e.text || e.id);
    }
    for (const p of r.res.parts) used.add(p.label);
  }
  used.add("swim.carried");
  for (const id of used) assert.notEqual(say(id), id, `${id} is registered`);
  const all = [...Object.values(TEXT), ...FACTS.map((f) => f.text)];
  for (const text of all) {
    for (const carer of ["mother", "mum", "mom", "parent"]) {
      const t = text.replace(/\{carer\}/g, "your " + carer).replace(/\{Carer\}/g, "Your " + carer);
      assert.ok(!BANNED.test(t), `banned word in "${t}"`);
      assert.ok(!PRONOUNS.test(t), `pronoun in "${t}"`);
      assert.ok(!RACE_TEXT.test(t), `race boast in "${t}"`);
    }
    for (const s of sentences(text)) assert.ok(words(s) <= 16, `"${s}"`);
  }
  // no event names harm, and every event name is one of 16.6
  const names = new Set(["moment", "prompt", "subgoal", "judge", "points", "fact", "caption", "sfx", "milestone", "song", "place",
    "bump", "fork", "arrive", "bounce", "stick", "loose", "held", "goldIn", "nudge", "enter", "seal", "done"]);
  for (const r of [...RACES.ref, ...RACES.idle]) {
    for (const e of r.evs) {
      assert.ok(names.has(e.name), e.name);
      for (const v of Object.values(e)) if (typeof v === "string") assert.ok(!BANNED.test(v), `${e.name}: ${v}`);
    }
  }
});

await check("the points events add up to the score, and the parts add up to the total", () => {
  for (const r of [...RACES.ref.slice(0, 5), ...RACES.mid.slice(0, 5), ...RACES.idle.slice(0, 3)]) {
    const sum = { goal: 0, skill: 0, flourish: 0 };
    for (const e of r.evs.filter((x) => x.name === "points")) { assert.ok(e.add > 0); sum[e.part] += e.add; }
    assert.deepEqual(sum, { goal: r.res.score.goal, skill: r.res.score.skill, flourish: r.res.score.flourish }, `seed ${r.seed}`);
    const parts = r.res.parts.reduce((a, p) => a + p.value, 0);
    assert.ok(Math.abs(parts - r.res.score.total) <= 3, `parts ${parts} vs total ${r.res.score.total}`);
  }
  const ref = RACES.ref[0].res;
  assert.equal(ref.score.goal, 3000);
  assert.equal(ref.score.flourish, 1000, "1st place");
  assert.ok(ref.parts.find((p) => p.id === "waves").value === 1500, "5 s on the waves");
  assert.equal(ref.parts.find((p) => p.id === "ready").value, 1000);
});

await check("swim.tune.js keeps the race sim's numbers (qa/first-breath/race-sim.mjs TUNE)", () => {
  const src = readFileSync(fileURLToPath(new URL("./race-sim.mjs", import.meta.url)), "utf8");
  const m = /const TUNE = (\{[\s\S]*?\n\});/.exec(src);
  assert.ok(m, "the sim's TUNE block");
  const sim = new Function("return " + m[1])();
  for (const [k, v] of Object.entries(sim)) {
    assert.ok(k in TUNE, `${k} is in swim.tune.js`);
    assert.deepEqual(Array.isArray(v) ? [...TUNE[k]] : TUNE[k], v, k);
  }
});

await check("no step throws and no fault is kept, also for odd input", () => {
  const st = swim.create(8, DEFAULT_CARRY, OPTS);
  const odd = [null, undefined, {}, makeIntents({ steer: { x: NaN, y: 1 } }), { steer: { x: 5, y: -9 } }, { steer: null }];
  for (let i = 0; i < 3000; i++) swim.step(st, odd[i % odd.length]);
  assert.equal(st.fault, null);
  assert.equal(swim.jump(st, "nowhere"), false);
  assert.doesNotThrow(() => swim.view(st));
  assert.doesNotThrow(() => swim.result(st));
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const ref = RACES.ref, mid = RACES.mid;
  const arr = (rs) => mean(rs.filter((r) => r.res.metrics.arrived).map((r) => r.res.metrics.arriveT)).toFixed(1);
  console.log(`PASS ${FILE}: ${passed} checks (${SEEDS.length} seeds; ref 1st in ${ref.filter((r) => r.res.metrics.place === 1).length}, mean arrival ${arr(ref)} s;`
    + ` mid top 3 in ${mid.filter((r) => r.res.metrics.place <= 3).length}, mean arrival ${arr(mid)} s; idle 20th in ${RACES.idle.filter((r) => r.res.metrics.place === 20).length})`);
}
