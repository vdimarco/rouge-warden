// First Breath: stage 8, Birth (`birth`), design.md 6.8, 4.1, 5.2 to 5.4, 7, 15, 16.4 and 18; tasks 2.31 to 2.34.
// Plays the stage in node with no DOM (16.11): idle, the scripted ideal input, scripted partial input, the shared bot
// at several skills and seeded random input, and through core/run.js (practice, a press at stageStart + target.t,
// one-button). Asserts the meta and the 4.1 moments; determinism for two seeds; the ideal input reaching Glowing; idle
// ending by itself inside the cap with goalMet true; the skill 0.7 bot completing (and skill 1.0 at 8,500 or more);
// one live gesture per moment (dragHold through the waves, none in the light); every sub-goal ending done or auto; the 16 targets carrying P,
// with their preview; every view valid; every wave moving you on with no input; the squeeze; the light (exposure,
// white, the bottom glow, `born`); the score parts (overlap, moves at 0.7 and 0.4, rested gaps, Flourish); turnDir
// from the Turn wave setting Turn back; an early hold from the warning on time; botSteer (memory only in r.mem);
// jump; her beats 76 → 92 bpm; the facts and strings; and that garbage input never throws.
// node qa/first-breath/stage-birth.test.mjs
import assert from "node:assert/strict";
import * as birth from "../../public/first-breath/core/stages/birth.js";
import { TUNE } from "../../public/first-breath/core/stages/birth.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/birth.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/birth.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { createRun } from "../../public/first-breath/core/run.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { DT } from "../../public/first-breath/core/clock.js";
import { check as checkTargets, previewS } from "../../public/first-breath/core/lib/track.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { CARERS, fill } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/stage-birth.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const named = (evs, name) => evs.filter((e) => e.name === name);
const MAX_STEPS = Math.ceil((birth.meta.capS + 5) / DT);

// The clock of 6.8 from the tune: warning, swell start and swell end of wave k (0..7); the light; the end.
const W = (k) => TUNE.leadS + TUNE.periodS * k;
const S = (k) => W(k) + TUNE.warnS;
const E = (k) => S(k) + TUNE.swellS;
const LIGHT_AT = E(7) + TUNE.restS;
const END_AT = LIGHT_AT + TUNE.exposureS + TUNE.whiteS + TUNE.holdS;
const IDEAL_DIRS = [null, "down", null, "right", null, "up", null, "left"];   // Turn to the right, so Turn back is left

// Play one attempt; `input(st)` gives each step's intents. Returns the state, the events, what the prompt was at each
// step (after the step) and every view's problems.
function play({ seed = 1, carry = DEFAULT_CARRY, opts = {}, input = null, bot = null, every = 1, each = null } = {}) {
  const st = birth.create(seed, carry, { assist: false, oneButton: false, motherPhase: 0, ...opts });
  const evs = [...st.events];
  st.events.length = 0;
  const seen = [{ t: 0, moment: st.moment, ...birth.prompt(st) }];
  const bad = [];
  for (let n = 0; n < MAX_STEPS && !birth.result(st).done; n++) {
    if (n % every === 0) {
      const out = validate(birth.view(st));
      if (out.length) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${out.join("; ")}`);
    }
    const it = bot ? bot.intents(birth, st) : input ? input(st) : makeIntents();
    birth.step(st, it);
    if (each) each(st, st.events);
    evs.push(...st.events);
    st.events.length = 0;
    seen.push({ t: st.t, moment: st.moment, ...birth.prompt(st) });
  }
  const last = validate(birth.view(st));
  if (last.length) bad.push(`last view: ${last.join("; ")}`);
  return { st, evs, seen, bad, res: birth.result(st) };
}

// A scripted hold per wave: press at pressAt(k), release at releaseAt(k), dragging dirs[k] while held. skip lists
// waves left alone.
function scripted({ dirs = IDEAL_DIRS, pressAt = S, releaseAt = E, skip = [] } = {}) {
  return (st) => {
    const t0 = st.t, t1 = t0 + DT;
    const presses = [], releases = [];
    let dir = null, touching = false;
    for (let k = 0; k < 8; k++) {
      if (skip.includes(k)) continue;
      const p = pressAt(k), r = releaseAt(k);
      if (p >= t0 && p < t1) presses.push({ t: p, raw: p });
      if (r >= t0 && r < t1) releases.push({ t: r, raw: r });
      if (t1 > p && t0 < r) { touching = true; dir = dirs[k] || null; }
    }
    return makeIntents({ presses, releases, dir, touching });
  };
}

// Seeded random input: holds that start and stop at random, in random directions.
function randomInput(seed) {
  const r = stream(seed, "birth-test-random");
  let held = false;
  return () => {
    const presses = [], releases = [];
    const dirs = [null, "up", "down", "left", "right"];
    const dir = dirs[Math.floor(r() * dirs.length)];
    if (r() < 0.04) {
      if (held) releases.push({ t: 0, raw: 0 }); else presses.push({ t: 0, raw: 0 });
      held = !held;
    }
    return { presses, releases, dir, touching: held, steer: { x: r() * 2 - 1, y: r() * 2 - 1 } };
  };
}
// random presses need stage times: wrap so each event lands inside the step
const randomAt = (seed) => {
  const f = randomInput(seed);
  return (st) => {
    const it = f();
    const at = st.t + DT * 0.5;
    return makeIntents({ ...it, presses: it.presses.map(() => ({ t: at, raw: at })), releases: it.releases.map(() => ({ t: at, raw: at })) });
  };
};

const IDLE = play({ every: 1 });
const IDEAL = play({ input: scripted(), every: 1 });

await check("meta and the 4.1 moments (waves and light, both 280 → 280)", () => {
  const m = birth.meta;
  assert.equal(m.id, "birth"); assert.equal(m.index, 7); assert.equal(m.name, "Birth"); assert.equal(m.verb, "Ride");
  assert.equal(m.orient, "fit");
  assert.deepEqual([...m.families], ["hold"]);
  assert.deepEqual({ ...m.ga }, { start: 280, end: 280 });
  assert.deepEqual({ ...m.mm }, { start: 700, end: 700 });
  assert.equal(m.fertilized, true);
  assert.equal(m.motherBpm, 76);
  assert.equal(m.capS, 80); assert.equal(m.parS, 70);
  assert.equal(m.canFail, false); assert.equal(m.scored, true);
  assert.deepEqual(m.moments.map((x) => ({ id: x.id, ga: [...x.ga], lenS: x.lenS })),
    [{ id: "waves", ga: [280, 280], lenS: null }, { id: "light", ga: [280, 280], lenS: null }]);
  for (const s of IDLE.seen) assert.ok(m.moments.some((x) => x.id === s.moment), `moment ${s.moment}`);
  assert.deepEqual(named(IDLE.evs, "moment").map((e) => [e.id, +e.t.toFixed(3)]), [["waves", 0], ["light", LIGHT_AT]]);
  assert.equal(IDLE.st.gaDay, 280);
  assert.equal(IDLE.st.fertilized, true);
});

await check("the timeline: 8 waves every 8.0 s, warning 1.0 s before a 5.0 s swell, the first warning at 2.0 s", () => {
  const sub = named(IDLE.evs, "subgoal").filter((e) => e.state === "shown");
  assert.deepEqual(sub.map((e) => e.id), ["wave1", "wave2", "wave3", "wave4", "wave5", "wave6", "wave7", "wave8"]);
  sub.forEach((e, k) => near(e.t, W(k), DT + 1e-9, `wave ${k + 1} warns`));
  near(W(0), 2.0, 1e-12, "first warning");
  const swells = named(IDLE.evs, "sfx").filter((e) => e.id === "birth.swell");
  assert.equal(swells.length, 8);
  swells.forEach((e, k) => { near(e.at, S(k), 1e-9, `swell ${k + 1}`); assert.equal(e.dur, 5); assert.equal(e.cutoffHz, 300); });
  near(LIGHT_AT, 67, 1e-9, "the light after the 8th rest");
  near(END_AT, 70.5, 1e-9, "the end");
});

await check("targets carry P: a press at each swell start and a release at its end, spaced by the 5.2 rule", () => {
  const st = birth.create(1, DEFAULT_CARRY, { motherPhase: 0.4 });
  const list = birth.targets(st, 1000);
  assert.equal(list.length, 16);
  assert.deepEqual(checkTargets(list), [], "every target has an id, a time, a kind and P ≥ 0.5 s, sorted and spaced");
  list.forEach((x, i) => {
    const k = i >> 1;
    assert.equal(x.kind, i % 2 ? "release" : "press");
    near(x.t, i % 2 ? E(k) : S(k), 1e-9, `${x.id} time`);
    assert.ok(Number.isFinite(x.P) && x.P >= 0.5, `${x.id} P`);
    assert.equal(x.heart, "mother");
    if (i === 0) near(x.P, 60 / st.beats.bpm("mother", S(0)), 1e-9, "the first P is her beat period");
    else near(x.P, x.t - list[i - 1].t, 1e-9, `${x.id} P is the gap`);
  });
  // preview: the wave ring shows each press target at least max(2 beats, 1.2 s) ahead
  for (let k = 0; k < 8; k++) {
    const pre = previewS(60 / st.beats.bpm("mother", S(k)));
    const t = S(k) - pre + 2 * DT;
    const s2 = birth.create(1, DEFAULT_CARRY, { motherPhase: 0.4 });
    while (s2.t < t) { birth.step(s2, makeIntents()); s2.events.length = 0; }
    const ring = birth.view(s2).rings.find((g) => g.id === "wave");
    assert.ok(ring, `wave ${k + 1}: its ring shows ${pre.toFixed(2)} s ahead`);
    assert.ok(birth.targets(s2, pre).some((x) => x.kind === "press" && Math.abs(x.t - S(k)) < 1e-9), "and targets() lists it");
    if (k >= 1) break;                         // the first two are enough to keep the suite fast; the rule is shared
  }
});

await check("the scripted ideal input reaches Glowing (10,000)", () => {
  const { res, evs, bad, st } = IDEAL;
  assert.deepEqual(bad, []);
  assert.equal(res.done, true);
  assert.equal(res.goalMet, true);
  assert.deepEqual(res.score, { goal: 3000, skill: 6000, flourish: 1000, total: 10000 });
  assert.equal(gradeOf(res.score.total, res.goalMet), "Glowing");
  const judges = named(evs, "judge");
  assert.equal(judges.length, 16);
  for (const j of judges) { assert.equal(j.grade, "in", j.target); near(j.errMs, 0, 1e-6, `${j.target} errMs`); }
  assert.deepEqual(Object.values(st.subgoals), Array(8).fill("done"));
  assert.equal(res.metrics.rests, 8);
  assert.equal(res.metrics.smooth, 8);
  assert.equal(res.metrics.moves, 2400);
  assert.deepEqual(res.carryOut, { turnDir: 1 });
  assert.deepEqual(res.parts.map((p) => [p.id, p.value, p.max]), [["goal", 3000, 3000], ["overlap", 3000, 3000],
    ["moves", 2400, 2400], ["rests", 600, 600], ["flourish", 1000, 1000]]);
  assert.equal(res.parts.reduce((a, p) => a + p.value, 0), res.score.total, "the parts add up to the total");
});

await check("idle ends by itself at 70.5 s (inside the 80 s cap) with goalMet true, and earns only the Goal", () => {
  const { res, st, bad, evs } = IDLE;
  assert.deepEqual(bad, []);
  assert.equal(res.done, true);
  assert.equal(res.goalMet, true);
  near(st.t, END_AT, DT + 1e-9, "the stage time at the end");
  assert.ok(st.t <= birth.meta.capS);
  assert.equal(res.metrics.how, "end");
  assert.deepEqual(res.score, { goal: 3000, skill: 0, flourish: 0, total: 3000 }, "no rest points without a held wave");
  assert.equal(gradeOf(res.score.total, true), "Good");
  assert.deepEqual(Object.values(st.subgoals), Array(8).fill("auto"));
  assert.equal(named(evs, "judge").filter((j) => j.grade === "miss").length, 16, "every target passes as a miss");
  assert.equal(named(evs, "points").length, 0);
  assert.equal(named(evs, "done").length, 1);
});

await check("every wave moves you on with no input (1/8 of the way each), and the opening glow grows", () => {
  const st = birth.create(3, DEFAULT_CARRY, { motherPhase: 0 });
  const ys = [], rs = [];
  const at = (t) => { while (st.t < t - 1e-9) { birth.step(st, makeIntents()); st.events.length = 0; } };
  at(0);
  ys.push(birth.view(st).anchor.y); rs.push(birth.view(st).marks.find((m) => m.kind === "light").r);
  for (let k = 0; k < 8; k++) {
    at(E(k) + 0.1);
    const v = birth.view(st);
    ys.push(v.anchor.y); rs.push(v.marks.find((m) => m.kind === "light").r);
  }
  for (let k = 1; k < ys.length; k++) {
    assert.ok(ys[k] < ys[k - 1] - 1, `wave ${k} moves you down: ${ys[k - 1]} → ${ys[k]}`);
    near(ys[k - 1] - ys[k], (TUNE.figureY0 - TUNE.figureY1) / 8, 1e-6, `wave ${k} moves you 1/8 of the way`);
    assert.ok(rs[k] > rs[k - 1], `wave ${k} grows the glow`);
  }
  near(ys[8], TUNE.figureY1, 1e-6, "all the way after wave 8");
  // between waves you hold still: nothing moves you in a rest
  at(E(2) + 1); const a = birth.view(st).anchor.y; at(E(2) + 2.5); assert.equal(birth.view(st).anchor.y, a);
});

await check("the anchor stays in the free part of the screen (above 60% of a portrait height)", () => {
  // fit: 100 u across a 390 px width; the subject at 42% of 844 px; 60% is (0.60 − 0.42) × 844 / 3.9 u below it
  const room = ((0.6 - 0.42) * 844) / 3.9;
  for (const { st } of [IDLE, IDEAL]) {
    const v = birth.view(st);
    assert.ok(v.anchor.y >= -room, `anchor ${v.anchor.y} u`);
  }
  assert.ok(TUNE.figureY1 > -room && TUNE.figureY0 < room);
});

await check("determinism: the same seed and input give the same events and result (seeds 1 and 7)", () => {
  for (const seed of [1, 7]) {
    const a = play({ seed, bot: createBot(0.7, seed), every: 30, opts: { motherPhase: 0.21 } });
    const b = play({ seed, bot: createBot(0.7, seed), every: 30, opts: { motherPhase: 0.21 } });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}: events`);
    assert.deepEqual(a.res, b.res, `seed ${seed}: result`);
    const c = play({ seed, input: randomAt(seed), every: 30 });
    const d = play({ seed, input: randomAt(seed), every: 30 });
    assert.equal(JSON.stringify(c.evs), JSON.stringify(d.evs), `seed ${seed}: random input events`);
    assert.deepEqual(c.res, d.res);
  }
});

const BOTS = {};
await check("the shared bot completes at skill 0.7 (and skill 1.0 scores 8,500 or more on every seed)", () => {
  for (const skill of [1, 0.7, 0.4]) {
    const totals = [];
    for (let seed = 1; seed <= 10; seed++) {
      const p = play({ seed, bot: createBot(skill, seed), every: 15, opts: { motherPhase: (seed % 7) / 10 } });
      assert.deepEqual(p.bad, [], `skill ${skill} seed ${seed} views`);
      assert.equal(p.res.done, true, `skill ${skill} seed ${seed} completes`);
      assert.equal(p.res.goalMet, true);
      near(p.st.t, END_AT, DT + 1e-9, "the same length for everyone");
      for (const [id, s] of Object.entries(p.st.subgoals)) assert.ok(s === "done" || s === "auto", `${id} ${s}`);
      if (skill === 1) assert.ok(p.res.score.total >= 8500, `skill 1 seed ${seed}: ${p.res.score.total}`);
      totals.push(p.res.score.total);
    }
    BOTS[skill] = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  }
  assert.ok(BOTS[1] >= BOTS[0.7] && BOTS[0.7] >= BOTS[0.4], `means ${JSON.stringify(BOTS)}`);
});

await check("one live gesture per moment: dragHold through the waves (a plain hold counts), none in the light", () => {
  for (const { seen, evs } of [IDLE, IDEAL]) {
    for (const s of seen) {
      const want = s.moment === "light" || s.t >= LIGHT_AT - 1e-9 ? "none" : "dragHold";
      assert.equal(s.gesture, want, `t ${s.t.toFixed(3)} (${s.moment})`);
      assert.equal(s.keys, "steer");
    }
    assert.deepEqual([...new Set(seen.filter((s) => s.moment === "waves").map((s) => s.gesture))], ["dragHold"], "one gesture in waves");
    assert.deepEqual([...new Set(seen.filter((s) => s.moment === "light").map((s) => s.gesture))], ["none"], "and one in the light");
    // every change of prompt is an event, and the events agree with prompt()
    const prompts = named(evs, "prompt");
    let i = 0;
    for (const s of seen) {
      while (i + 1 < prompts.length && prompts[i + 1].t <= s.t + 1e-9) i++;
      assert.deepEqual({ g: prompts[i].gesture, x: prompts[i].text }, { g: s.gesture, x: s.text }, `prompt at ${s.t.toFixed(3)}`);
    }
    assert.equal(prompts[0].t, 0, "the prompt names the gesture at once (by 0.5 s)");
    assert.equal(prompts[0].text, "birth.ride");
  }
  // the prompt lines: each wave's own, then a rest line
  const texts = IDEAL.seen.filter((s) => s.text).map((s) => s.text);
  for (const id of ["birth.hold", "birth.tuck.do", "birth.turn.do", "birth.lift.do", "birth.back.do", "birth.rest"]) assert.ok(texts.includes(id), id);
  assert.ok(IDLE.seen.some((s) => s.text === "birth.again"), "after a missed wave: Rest. Another wave will come.");
});

await check("every sub-goal ends done or auto (idle, ideal, bots, random input), each shown at its warning", () => {
  const runs = [IDLE, IDEAL, play({ bot: createBot(0.4, 3), every: 60 }), play({ input: randomAt(5), every: 60 })];
  for (const p of runs) {
    assert.equal(Object.keys(p.st.subgoals).length, 8);
    for (const [id, s] of Object.entries(p.st.subgoals)) assert.ok(s === "done" || s === "auto", `${id} ended ${s}`);
    for (let k = 0; k < 8; k++) {
      const evs = named(p.evs, "subgoal").filter((e) => e.id === "wave" + (k + 1));
      assert.equal(evs.length, 2, `wave ${k + 1}: shown, then settled`);
      assert.equal(evs[0].state, "shown");
      near(evs[1].t, E(k), DT + 1e-9, `wave ${k + 1} settles at the swell's end`);
      assert.ok(TEXT[evs[1].text], `${evs[1].text} is a string`);
    }
  }
  assert.ok(named(IDLE.evs, "subgoal").some((e) => e.text === "birth.again"), "the miss line");
  assert.ok(named(IDLE.evs, "subgoal").some((e) => e.text === "birth.anyway"), "a move plays anyway");
});

await check("every view is valid, with a camera, an anchor and a cue (idle, ideal, bots, random, after jumps)", () => {
  assert.deepEqual(IDLE.bad, []);
  assert.deepEqual(IDEAL.bad, []);
  assert.deepEqual(play({ input: randomAt(9), every: 1 }).bad, []);
  for (const input of [scripted(), () => makeIntents()]) {
    const st = birth.create(1, DEFAULT_CARRY, { motherPhase: 0 });
    for (let n = 0; n < 4300; n++) {
      if (n % 7 === 0) {
        const v = birth.view(st);
        assert.deepEqual(validate(v), [], `t ${st.t.toFixed(2)}`);
        assert.equal(v.camera.orient, "fit");
        assert.equal(v.camera.span, 100);
        near(v.camera.mmPerU, 7, 1e-9, "700 mm across 100 u");
        assert.deepEqual(v.scale, { mm: 100 });
        assert.ok(v.anchor && Number.isFinite(v.anchor.x));
        assert.ok(v.cue && Number.isFinite(v.cue.x), "a cue in every frame");
        assert.ok(v.splats.length >= 10 && v.splats.length <= 14, "you, as the figure");
        assert.ok(v.marks.some((m) => m.kind === "light"), "the opening glow");
        assert.ok(v.rings.some((g) => g.kind === "mother"), "her ring");
      }
      birth.step(st, input(st));
      st.events.length = 0;
      if (birth.result(st).done) break;
    }
  }
  // prompt waves show the direction sticker; wave 4 shows both sides
  const st = birth.create(1, DEFAULT_CARRY, {});
  const to = (t) => { while (st.t < t) { birth.step(st, makeIntents()); st.events.length = 0; } };
  to(S(1) + 1);
  let arrows = birth.view(st).marks.filter((m) => m.kind === "arrow");
  assert.equal(arrows.length, 1); near(arrows[0].ang, -Math.PI / 2, 1e-12, "Tuck points down");
  to(S(3) + 1);
  arrows = birth.view(st).marks.filter((m) => m.kind === "arrow");
  assert.deepEqual(arrows.map((m) => m.ang).sort(), [0, Math.PI].sort(), "Turn: both sides");
  to(S(5) + 1);
  near(birth.view(st).marks.find((m) => m.kind === "arrow").ang, Math.PI / 2, 1e-12, "Lift points up");
  to(S(6) + 1);
  assert.equal(birth.view(st).marks.filter((m) => m.kind === "arrow").length, 0, "plain waves have none");
  const sw = birth.view(st).strips.find((s) => s.kind === "ripples");
  assert.ok(sw && sw.items.length === 3, "a swell shows its pressure rings");
});

await check("the squeeze: vignette 0.15 at rest, 0.35 at a swell's peak; the sway rises with it", () => {
  const st = birth.create(1, DEFAULT_CARRY, {});
  const to = (t) => { while (st.t < t - 1e-9) { birth.step(st, makeIntents()); st.events.length = 0; } };
  to(E(0) + 1);
  near(birth.view(st).light.vignette, TUNE.vignetteRest, 1e-9, "rest");
  to(S(1) + TUNE.swellS / 2);
  near(birth.view(st).light.vignette, TUNE.vignettePeak, 1e-3, "the peak");
  assert.ok(birth.view(st).warp > 0.6);
  near(TUNE.vignettePeak, 0.35, 1e-12, "6.8: vignette to 35%");
  near(TUNE.wallPress, 0.06, 1e-12, "walls in 6% per swell");
  near(TUNE.filterHz, 300, 1e-12);
  assert.deepEqual([...TUNE.rumbleHz], [40, 80]);
});

await check("the light: the glow fills the screen, exposure 1 → 6 over 2.0 s, white 0 → 1 over 1.0 s, a 0.5 s hold, born", () => {
  const st = birth.create(2, DEFAULT_CARRY, {});
  const frames = [];
  const evs = [];
  while (!birth.result(st).done) {
    birth.step(st, makeIntents({ touching: true, presses: st.t > 66 && st.t < 66.02 ? [{ t: st.t, raw: st.t }] : [] }));
    evs.push(...st.events.splice(0));
    if (st.moment === "light" || st.done) frames.push({ t: st.t, v: birth.view(st) });
  }
  const light = named(evs, "moment").find((e) => e.id === "light");
  near(light.t, LIGHT_AT, DT + 1e-9, "the light starts after wave 8's rest");
  const open = named(evs, "sfx").find((e) => e.id === "birth.open");
  assert.ok(open && open.seconds === 1.5 && open.fromHz === 300 && open.toHz === 16000, "the sound opens 300 Hz → 16 kHz over 1.5 s");
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].v, b = frames[i].v;
    assert.ok(b.light.exposure >= a.light.exposure - 1e-12, "exposure never falls");
    assert.ok(b.light.white >= a.light.white - 1e-12, "white never falls");
    assert.ok(b.light.level >= a.light.level - 1e-12, "level never falls");
    assert.ok(b.light.vignette <= a.light.vignette + 1e-12, "the vignette only opens");
    assert.ok(b.warp <= a.warp + 1e-12, "the sway only settles");
    const la = a.marks.find((m) => m.kind === "light"), lb = b.marks.find((m) => m.kind === "light");
    assert.ok(lb.r >= la.r - 1e-12 && lb.on === 1 && lb.pulse === 0, "the glow only grows, steady");
    assert.equal(b.marks.filter((m) => m.kind !== "light").length, 0, "nothing else changes the light");
    assert.equal(b.strips.length, 0);
    assert.deepEqual(b.splats, a.splats, "you hold still in the light");
  }
  const at = (dt) => frames.find((f) => f.t >= LIGHT_AT + dt - 1e-9).v;
  near(at(1.0).light.exposure, 3.5, 0.1, "half way at 1.0 s");
  near(at(2.0).light.exposure, 6, 0.1, "6 at 2.0 s");
  near(at(2.0).light.white, 0, 0.02, "white starts at 2.0 s");
  near(at(3.0).light.white, 1, 1e-9, "white at 3.0 s");
  near(at(3.0).marks[0].r, TUNE.lightR[2], 1e-9, "the glow fills the screen");
  const born = named(evs, "milestone");
  assert.deepEqual(born.map((e) => e.id), ["born"], "born, once");
  near(born[0].t, END_AT, DT + 1e-9, "at the end of the light");
  assert.equal(named(evs, "points").filter((e) => e.t >= LIGHT_AT - 1e-9).length, 0, "no points in the light");
  assert.equal(birth.prompt(st).gesture, "none");
});

await check("score: any hold counts for overlap; a move needs its direction (0.7 → 600, 0.4 → 300)", () => {
  // the right overlap, but every prompt wave dragged the wrong way: no move points, the moves settle auto
  const wrong = play({ input: scripted({ dirs: [null, "up", null, "down", null, "down", null, "up"] }), every: 50 });
  assert.equal(wrong.res.metrics.moves, 0);
  near(wrong.res.metrics.meanOverlap, 1, 1e-6, "overlap still full");
  assert.deepEqual(wrong.res.score, { goal: 3000, skill: 3600, flourish: 1000, total: 7600 });
  assert.deepEqual(["wave2", "wave4", "wave6", "wave8"].map((id) => wrong.st.subgoals[id]), ["auto", "auto", "auto", "auto"]);
  assert.deepEqual(["wave1", "wave3", "wave5", "wave7"].map((id) => wrong.st.subgoals[id]), ["done", "done", "done", "done"]);
  // a plain hold with no direction (Space alone, or a touch that does not drag) counts as a hold only
  const plain = play({ input: scripted({ dirs: Array(8).fill(null) }), every: 50 });
  assert.equal(plain.res.metrics.moves, 0);
  assert.equal(plain.res.score.total, 7600);
  // late presses on the Tuck wave: 1.5 s late holds 0.7 of the swell (600), 3.0 s late 0.4 (300), 3.5 s late 0.3 (0)
  const late = (d) => play({ input: scripted({ pressAt: (k) => S(k) + (k === 1 ? d : 0) }), every: 1000 }).res;
  const w2 = (r) => r.metrics.waves[1];
  near(w2(late(1.5)).right, 0.7, 1e-6, "1.5 s late");
  assert.equal(late(1.5).metrics.moves, 2400);
  near(w2(late(3.0)).right, 0.4, 1e-6, "3.0 s late");
  assert.equal(late(3.0).metrics.moves, 2100);
  assert.equal(late(3.5).metrics.moves, 1800);
  assert.equal(late(3.5).metrics.smooth, 7, "a wave under 0.9 earns no Flourish share");
  assert.equal(late(3.5).score.flourish, 875);
  near(late(3.5).metrics.meanOverlap, (7 + 0.3) / 8, 1e-6, "mean overlap over 8 waves");
  // the overlap is the share held: release 0.6 s early on wave 1 (0.88: no Flourish share)
  const early = play({ input: scripted({ releaseAt: (k) => E(k) - (k === 0 ? 0.6 : 0) }), every: 1000 }).res;
  near(early.metrics.waves[0].overlap, 0.88, 1e-6, "0.88 held");
  assert.equal(early.metrics.smooth, 7);
});

await check("rested gaps: released for at least 80% of the rest's first 2.0 s, after a held wave", () => {
  const hold = (d) => play({ input: scripted({ releaseAt: (k) => E(k) + (k === 2 ? d : 0) }), every: 1000 }).res;
  assert.equal(hold(0.3).metrics.rests, 8, "a 0.3 s late release still rests (85%)");
  assert.equal(hold(0.5).metrics.rests, 7, "a 0.5 s late release does not (75%)");
  assert.equal(hold(0.5).score.skill, 6000 - 75);
  // a hold from the warning (6.8's bot policy) still rests: the next warning is after the judged 2.0 s
  const fromWarning = play({ input: scripted({ pressAt: W }), every: 1000 }).res;
  assert.equal(fromWarning.metrics.rests, 8);
  assert.equal(fromWarning.score.total, 10000);
  // a skipped wave earns no rest after it
  const skip = play({ input: scripted({ skip: [4] }), every: 1000 }).res;
  assert.equal(skip.metrics.rests, 7);
  assert.equal(IDLE.res.metrics.rests, 0);
});

await check("an early hold from the warning is on time for the press target; nothing is judged Off on the way", () => {
  const p = play({ input: scripted({ pressAt: (k) => W(k) + 0.1 }), every: 1000 });
  const judges = named(p.evs, "judge");
  assert.equal(judges.filter((j) => j.grade === "off").length, 0, "no Off");
  const presses = judges.filter((j) => j.target.includes("press"));
  assert.equal(presses.length, 8);
  presses.forEach((j, k) => {
    assert.equal(j.grade, "in"); assert.equal(j.held, true); near(j.t, S(k), 1e-9, "stamped at the swell start");
  });
  // a hold that began before the warning still counts as a hold, but its press target passes
  const before = play({ input: scripted({ pressAt: (k) => W(k) - (k === 3 ? 0.3 : 0) }), every: 1000 });
  const j4 = named(before.evs, "judge").filter((j) => j.target.startsWith("wave4.press")).map((j) => j.grade);
  assert.deepEqual(j4, ["off", "miss"], "1.3 s early is Off (a faint ring, 5.2), then the target passes");
  near(before.res.metrics.waves[3].overlap, 1, 1e-6);
  // Assist widens the windows (×1.6): a press 100 ms late is In time with Assist, Close without
  const late = (assist) => named(play({ opts: { assist }, input: scripted({ pressAt: (k) => S(k) + 0.1 }), every: 1000 }).evs, "judge")
    .find((j) => j.target.startsWith("wave2.press")).grade;
  assert.equal(late(false), "close");
  assert.equal(late(true), "in");
});

await check("turnDir: the Turn wave's side sets Turn back's way, and goes out in the carry", () => {
  const left = play({ input: scripted({ dirs: [null, "down", null, "left", null, "up", null, "right"] }), every: 1000 });
  assert.equal(left.res.metrics.turnDir, -1);
  assert.deepEqual(left.res.carryOut, { turnDir: -1 });
  assert.equal(left.res.score.total, 10000, "turning left, then back to the right, is just as good");
  const sameWay = play({ input: scripted({ dirs: [null, "down", null, "left", null, "up", null, "left"] }), every: 1000 });
  assert.equal(sameWay.res.metrics.moves, 1800, "Turn back must go the other way");
  // with no sideways hold the carry's turnDir stands
  const carry = mergeCarry(DEFAULT_CARRY, { turnDir: -1 });
  assert.deepEqual(play({ carry, every: 1000 }).res.carryOut, { turnDir: -1 });
  assert.deepEqual(play({ every: 1000 }).res.carryOut, { turnDir: 1 });
  // and botSteer turns the carry's way, then back
  const st = birth.create(1, carry, {});
  const r = stream(1, "t"); r.mem = {};
  while (st.t < S(3) + 1) { birth.step(st, makeIntents()); st.events.length = 0; }
  assert.equal(birth.botSteer(st, 1, r).dir, "left");
  while (st.t < S(7) + 1) { birth.step(st, makeIntents()); st.events.length = 0; }
  assert.equal(birth.botSteer(st, 1, r).dir, "right");
});

await check("botSteer: hold from the warning to the swell's end, the prompted way, memory only in r.mem", () => {
  const st = birth.create(4, DEFAULT_CARRY, {});
  const r1 = stream(1, "a"); r1.mem = {};
  const r2 = stream(2, "b"); r2.mem = {};
  const want = { 1: "down", 3: "right", 5: "up", 7: "left" };
  while (!birth.result(st).done) {
    const snap = JSON.stringify({ t: st.t, w: st.waves, s: st.subgoals, h: st.held, d: st.dir, td: st.turnDir });
    const a = birth.botSteer(st, 1, r1), b = birth.botSteer(st, 1, r2);
    assert.equal(JSON.stringify({ t: st.t, w: st.waves, s: st.subgoals, h: st.held, d: st.dir, td: st.turnDir }), snap, "the state is unchanged");
    assert.deepEqual(a, b, "at skill 1 the stream does not matter");
    const t = st.t;
    let k = -1;
    for (let i = 0; i < 8; i++) if (t >= W(i) - 1e-9 && t < E(i) + TUNE.bot.lagOutS) k = i;
    const inHold = k >= 0 && t >= W(k) && t < E(k);
    if (st.moment === "waves" && Math.abs(t - W(Math.max(0, k))) > 1e-6 && Math.abs(t - E(Math.max(0, k))) > 1e-6) {
      assert.equal(a.hold, inHold, `hold at ${t.toFixed(3)}`);
    }
    if (inHold) assert.equal(a.dir, want[k] || null, `dir at ${t.toFixed(3)}`);
    if (a.dir) assert.deepEqual(a.steer, { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: 1 }, down: { x: 0, y: -1 } }[a.dir]);
    birth.step(st, makeIntents());
    st.events.length = 0;
  }
  assert.deepEqual(birth.botSteer(st, 1, r1), { steer: { x: 0, y: 0 }, dir: null, hold: false }, "nothing when done");
  assert.ok(Array.isArray(r1.mem.u) && r1.mem.u.length === 3, "its draws live in r.mem");
  // below skill 1 the draws give lags and wrong ways; the same stream gives the same choices
  const lowA = stream(9, "low"); lowA.mem = {};
  const lowB = stream(9, "low"); lowB.mem = {};
  const s2 = birth.create(4, DEFAULT_CARRY, {});
  while (!birth.result(s2).done) {
    assert.deepEqual(birth.botSteer(s2, 0.3, lowA), birth.botSteer(s2, 0.3, lowB));
    birth.step(s2, makeIntents()); s2.events.length = 0;
  }
});

await check("through the run: practice with the ref bot (no overlay), presses at stageStart + target.t In time, one-button", () => {
  const run = createRun({ seed: 3, start: { practice: "birth" } });
  const bot = createBot(1, 3);
  const evs = [];
  while (run.screen !== "result" && evs.length < 1e6) {
    if (run.screen === "stage") {
      const it = bot.intents(run.mod, run.state);
      const shift = (l) => l.map((e) => ({ t: e.t + run.stageStart, raw: e.raw + run.stageStart }));
      run.step({ ...it, presses: shift(it.presses), releases: shift(it.releases) });
    } else run.step(makeIntents());
    evs.push(...run.events.splice(0));
  }
  assert.ok(!named(evs, "screen").some((e) => e.screen === "overlay"), "no overlay after Birth");
  const s = run.summary().stages[0];
  assert.equal(s.id, "birth");
  assert.equal(s.grade, "Glowing");
  // a press at stageStart + target.t (core time), never released, is In time
  const r2 = createRun({ seed: 5, start: { practice: "birth" } });
  const judged = [];
  let pressed = 0;
  while (r2.screen === "stage") {
    const st = r2.state;
    const x = r2.mod.targets(st, 1).find((y) => y.kind === "press" && y.t >= st.t && y.t < st.t + DT);
    if (x) { const t = r2.stageStart + x.t; pressed++; r2.step(makeIntents({ touching: true, presses: [{ t, raw: t + 0.09 }] })); }
    else r2.step(makeIntents({ touching: pressed > 0 }));
    judged.push(...named(r2.events.splice(0), "judge").filter((j) => j.target.includes("press")));
  }
  assert.equal(pressed, 8);
  assert.equal(judged.length, 8);
  for (const j of judged) { assert.equal(j.grade, "in"); near(j.errMs, 0, 1e-6, "errMs"); near(j.rawMs, 90, 1e-6, "rawMs"); }
  // one-button: the button held from each warning to each swell's end; dir comes from botSteer, so the moves count
  const r3 = createRun({ seed: 6, settings: { oneButton: true }, start: { practice: "birth" } });
  let down = false, checked = 0;
  while (r3.screen === "stage") {
    const t = r3.state.t, presses = [], releases = [];
    let k = -1;
    for (let i = 0; i < 8; i++) if (t >= W(i) - 1e-9) k = i;
    const want = k >= 0 && t < E(k);
    if (want && !down) { presses.push({ t: r3.t, raw: r3.t }); down = true; }
    if (!want && down) { releases.push({ t: r3.t, raw: r3.t }); down = false; }
    const rr = stream(0, "probe"); rr.mem = {};
    const a = birth.botSteer(r3.state, 1, rr);
    r3.step(makeIntents({ touching: down, presses, releases, dir: "up", steer: { x: 0, y: 1 } }));
    assert.equal(r3.lastIntents.dir, a.dir, `the held dir is botSteer's at ${t.toFixed(3)}`);
    assert.deepEqual(r3.lastIntents.steer, down ? a.steer : { x: 0, y: 0 }, "steer from botSteer only while touching");
    if (down && k >= 0 && TUNE.plan[k].move) checked++;
    r3.events.length = 0;
  }
  assert.ok(checked > 1000, "one-button held through the prompt waves");
  const one = r3.summary().stages[0];
  assert.equal(one.score.total, 10000, "one-button rides every wave and every move");
  assert.equal(r3.summary().marks.oneButton, true);
});

await check("her beats: 76 → 92 bpm over the waves from motherPhase, then 92; your heart at 130", () => {
  const st = birth.create(1, DEFAULT_CARRY, { motherPhase: 0.37 });
  near(st.beats.mother[0], 0.37, 1e-12, "her first beat at motherPhase");
  near(st.beats.bpm("mother", 0), 76, 1e-9, "76 at the start");
  near(st.beats.bpm("mother", LIGHT_AT - 1e-6), 92, 1e-3, "92 by the light");
  near(st.beats.bpm("mother", END_AT), 92, 1e-9, "92 in the light");
  const b = st.beats.between("mother", 0, END_AT);
  for (let i = 1; i < b.length; i++) {
    const gap = b[i] - b[i - 1];
    assert.ok(gap >= 60 / 92 - 1e-6 && gap <= 60 / 76 + 1e-6, `gap ${gap}`);
    if (i > 1) assert.ok(gap <= b[i - 1] - b[i - 2] + 1e-9, "she only speeds up");
  }
  near(st.beats.bpm("you", 10), 130, 1e-9, "your heart at 130 bpm");
});

await check("jump: into the light settles the waves; waves again restarts them; the cap ends a long jump", () => {
  const st = birth.create(1, DEFAULT_CARRY, {});
  const evs = [];
  const run = (input, until) => { while (!birth.result(st).done && st.t < until) { birth.step(st, input(st)); evs.push(...st.events.splice(0)); } };
  run(scripted(), 20);
  assert.equal(birth.jump(st, "light"), true);
  evs.push(...st.events.splice(0));
  assert.equal(st.moment, "light");
  assert.equal(birth.targets(st, 100).length, 0, "no open targets in the light");
  for (const [id, s] of Object.entries(st.subgoals)) assert.ok(s === "done" || s === "auto", `${id} ${s}`);
  assert.equal(Object.keys(st.subgoals).length, 3, "waves 1 to 3 had shown");
  run(() => makeIntents(), 100);
  assert.equal(birth.result(st).done, true);
  near(st.t, 20 + 3.5, DT + 1e-9, "3.5 s of light");
  assert.deepEqual(validate(birth.view(st)), []);
  assert.equal(birth.result(st).metrics.waves[0].overlap > 0.99, true, "the waves held so far are kept");
  // waves again from now
  const s2 = birth.create(1, DEFAULT_CARRY, {});
  while (s2.t < 10) { birth.step(s2, makeIntents()); s2.events.length = 0; }
  assert.equal(birth.jump(s2, "waves"), true);
  const t0 = s2.t;
  assert.equal(birth.targets(s2, 1000).length, 16);
  near(birth.targets(s2, 1000)[0].t, t0 + S(0), 1e-9, "laid from now");
  while (!birth.result(s2).done) { birth.step(s2, makeIntents()); s2.events.length = 0; }
  assert.equal(birth.result(s2).metrics.how, "cap", "10 + 70.5 s passes the 80 s cap");
  near(s2.t, birth.meta.capS, DT + 1e-9);
  assert.equal(birth.result(s2).goalMet, true);
  for (const [id, s] of Object.entries(s2.subgoals)) assert.ok(s === "done" || s === "auto", `${id} ${s}`);
  assert.equal(birth.jump(s2, "nowhere"), false);
  assert.equal(birth.probe(s2), null);
});

await check("garbage input never throws and changes nothing it should not", () => {
  const st = birth.create(1, null, null);
  const junk = [null, undefined, {}, { presses: "x", releases: 5, dir: "sideways" }, { presses: [{ t: NaN }, null, { t: "1" }] },
    { presses: [{ t: -50, raw: -50 }], releases: [{ t: 1e9 }] }, { steer: null, touching: "yes" }];
  for (let n = 0; n < 6000 && !birth.result(st).done; n++) {
    assert.doesNotThrow(() => birth.step(st, junk[n % junk.length]));
    st.events.length = 0;
    if (n % 97 === 0) assert.deepEqual(validate(birth.view(st)), []);
  }
  assert.equal(birth.result(st).done, true);
  assert.doesNotThrow(() => { birth.step(null, null); birth.prompt(null); birth.targets(null); birth.botSteer(null, 1, null); birth.view(null); });
  assert.deepEqual(validate(birth.view(null)), []);
  assert.equal(birth.jump(null, "light"), false);
  assert.ok(Number.isFinite(birth.result(st).score.total));
});

await check("points tick the HUD during the waves only and add up to the Skill and Flourish", () => {
  for (const p of [IDEAL, play({ bot: createBot(0.7, 2), every: 1000 })]) {
    const pts = named(p.evs, "points");
    assert.ok(pts.every((e) => e.part === "skill" || e.part === "flourish"), "no Goal tick");
    assert.ok(pts.every((e) => e.t < LIGHT_AT + 1e-9));
    const sum = pts.reduce((a, e) => a + e.add, 0);
    near(sum, p.res.score.skill + p.res.score.flourish, 8, "the ticks add up");
  }
});

// Facts and strings (15.1 to 15.4).
const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

await check("facts: the 6.8 set, from the allow-list, R or A, checked, gaDay 280, short, no label in the text", () => {
  assert.deepEqual(FACTS.map((f) => [f.id, f.where]), [["birth.card", "card"], ["birth.fast", "caption"],
    ["birth.waves", "caption"], ["birth.tuck", "caption"], ["birth.turn", "caption"], ["birth.skull", "caption"],
    ["birth.overlap", "caption"]]);
  for (const f of FACTS) {
    assert.equal(f.stage, "birth");
    assert.equal(f.gaDay, 280);
    assert.equal(f.checked, true);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.ok(f.src.length > 0);
    for (const k of f.src) assert.ok(SOURCES[k], `${f.id}: ${k} is on the allow-list`);
    for (const carer of Object.keys(CARERS)) {
      const text = fill(f.text, {}, { carer });
      assert.ok(words(text) <= 20, `${f.id}: ${words(text)} words`);
      for (const s of sentences(text)) assert.ok(words(s) <= 16, `${f.id}: a sentence of ${words(s)} words`);
      assert.ok(!BANNED.test(text) && !PRONOUNS.test(text), `${f.id}: ${text}`);
    }
    assert.ok(!/^(week|day)/i.test(f.text), `${f.id} starts with a label`);
    assert.ok(!/apgar/i.test(f.text));
  }
  near(FACTS.find((f) => f.id === "birth.overlap").access === "A" ? 1 : 0, 1, 0, "the PubMed abstract is A");
  // the stage shows each caption once, in order, as a fact event
  const shown = named(IDLE.evs, "fact");
  assert.deepEqual(shown.map((e) => e.id), ["birth.fast", "birth.waves", "birth.tuck", "birth.turn", "birth.skull", "birth.overlap"]);
  assert.ok(shown.every((e) => e.where === "caption"));
  assert.ok(shown.every((e) => FACTS.some((f) => f.id === e.id)));
});

await check("strings: every shown id exists; plain and tender; no banned word, pronoun or score framing", () => {
  const used = new Set();
  for (const p of [IDLE, IDEAL]) {
    for (const e of p.evs) {
      if (e.name === "prompt" && e.text) used.add(e.text);
      if (e.name === "subgoal") used.add(e.text);
      if (e.name === "caption") used.add(e.id);
    }
    for (const part of p.res.parts) if (part.label.startsWith("birth.")) used.add(part.label);
  }
  for (const id of used) assert.ok(TEXT[id], `${id} has a string`);
  for (const [id, text] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("birth."), id);
    for (const carer of Object.keys(CARERS)) {
      const s = fill(text, {}, { carer });
      assert.ok(!BANNED.test(s), `${id}: ${s}`);
      assert.ok(!PRONOUNS.test(s), `${id}: ${s}`);
      for (const x of sentences(s)) assert.ok(words(x) <= 16, `${id}: a sentence of ${words(x)} words`);
    }
    assert.ok(!/apgar|score|points/i.test(text), `${id} frames no score`);
  }
  assert.equal(TEXT["birth.hold"], "Hold through the wave.");
  assert.equal(TEXT["birth.tuck.do"], "Tuck: drag down and hold.");
  assert.equal(TEXT["birth.turn.do"], "Turn: drag sideways and hold.");
  assert.equal(TEXT["birth.lift.do"], "Lift: drag up and hold.");
  assert.equal(TEXT["birth.back.do"], "Turn back: drag the other way and hold.");
  assert.equal(TEXT["birth.rest"], "Rest.");
  assert.equal(TEXT["birth.again"], "Rest. Another wave will come.");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks (ideal ${IDEAL.res.score.total}, idle ${IDLE.res.score.total} in ${IDLE.st.t.toFixed(1)} s; bot means ${Object.entries(BOTS).map(([k, v]) => `${k}: ${v}`).join(", ")})`);
}
