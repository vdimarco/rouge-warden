// First Breath: stage 8, Birth (`birth`), the endless runner of first-breath-action-genres (design.md 5.8, 4.2 to 4.5,
// 4.11; tasks 8.1 to 8.7). Plays the stage in node with no DOM: idle, scripted lane and tuck input, the shared bot at
// several skills, seeded random input, garbage input, and through core/run.js (practice, one-button). Asserts the meta;
// the 8 waves at their times; 65.5 s for every input; the course (every fold leaves an open lane or a tight gap, the
// spacing, reachability and tuck rules, the gates' shapes); lanes by drag, flick, hold and keys; the tuck (taps,
// presses, a swipe down, its cooldown and buffer); a bump only slows you; the four gates and turnDir; calm bubbles;
// the light ramp and no flap at the light; no foe, bullet or hp; the score parts and that points add up; Assist;
// resume; jump; botSteer (memory only in r.mem); the facts and strings.
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
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { CARERS, fill } from "../../public/first-breath/core/text.js";
import { SUBJECT } from "../../public/first-breath/render/camera.js";

const FILE = "qa/first-breath/stage-birth.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const named = (evs, name) => evs.filter((e) => e.name === name);
const sfx = (evs, id) => evs.filter((e) => e.name === "sfx" && e.id === id);
const MAX_STEPS = Math.ceil((birth.meta.capS + 5) / DT);
const L = TUNE.lanes;

// The clock from the tune: wave k's warning, surge start and surge end; the light; the end.
const W = (k) => TUNE.leadS + TUNE.periodS * k;
const S = (k) => W(k) + TUNE.warnS;
const E = (k) => S(k) + TUNE.surgeS;
const LIGHT_AT = TUNE.leadS + TUNE.periodS * TUNE.waves;
const END_AT = LIGHT_AT + TUNE.exposureS + TUNE.whiteS + TUNE.holdS;

// Play one attempt; `input(st)` gives each step's intents (or a bot). Returns the state, the events and every view's
// problems (each `every` steps).
function play({ seed = 1, carry = DEFAULT_CARRY, opts = {}, input = null, bot = null, every = 30, each = null } = {}) {
  const st = birth.create(seed, carry, { assist: false, oneButton: false, motherPhase: 0, ...opts });
  const evs = [...st.events];
  st.events.length = 0;
  const bad = [];
  for (let n = 0; n < MAX_STEPS && !birth.result(st).done; n++) {
    if (every && n % every === 0) {
      const out = validate(birth.view(st));
      if (out.length) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${out.join("; ")}`);
    }
    const it = bot ? bot.intents(birth, st) : input ? input(st) : makeIntents();
    birth.step(st, it);
    if (each) each(st, st.events);
    evs.push(...st.events);
    st.events.length = 0;
  }
  const last = validate(birth.view(st));
  if (last.length) bad.push(`last view: ${last.join("; ")}`);
  return { st, evs, bad, res: birth.result(st) };
}

// Seeded random input: the stick wanders, presses and taps now and then.
function randomAt(seed) {
  const r = stream(seed, "birth-test-random");
  let sx = 0, sy = 0;
  return (st) => {
    if (r() < 0.05) { sx = r() * 2 - 1; sy = r() * 2 - 1; }
    const at = st.t + DT * 0.5;
    const presses = r() < 0.03 ? [{ t: at, raw: at, ...(r() < 0.3 ? { dir: r() < 0.5 ? "left" : "right" } : {}) }] : [];
    const taps = r() < 0.02 ? [{ t: at }] : [];
    return makeIntents({ steer: { x: sx, y: sy }, presses, taps, touching: true });
  };
}

const IDLE = play({ every: 1 });
const BOTS = {};
const RUNS = {};
for (const skill of [1, 0.7, 0.5]) {
  RUNS[skill] = [];
  for (let seed = 1; seed <= 6; seed++) RUNS[skill].push(play({ seed, bot: createBot(skill, seed), every: 60 }));
  BOTS[skill] = Math.round(RUNS[skill].reduce((a, p) => a + p.res.score.total, 0) / RUNS[skill].length);
}
const REF = RUNS[1][0];

await check("meta: the runner (steer and tap, meta.action, no hp, never fails), the moments waves and light at 280", () => {
  const m = birth.meta;
  assert.equal(m.id, "birth"); assert.equal(m.index, 7); assert.equal(m.name, "Birth"); assert.equal(m.verb, "Ride");
  assert.deepEqual([...m.families], ["steer", "tap"]);
  assert.equal(m.action, true);
  assert.equal(m.canFail, false);
  assert.equal(m.orient, "fit");
  assert.equal(m.parS, 65.5);
  assert.equal(m.capS, 80);
  assert.deepEqual(m.moments.map((x) => [x.id, [...x.ga]]), [["waves", [280, 280]], ["light", [280, 280]]]);
  assert.deepEqual(birth.targets(IDLE.st, 10), [], "no timed targets");
});

await check("8 waves at their times: a warning at 2.0 + 7.5 k, a 5.0 s surge 1.0 s later, then the light at 62.0 s", () => {
  for (const p of [IDLE, REF]) {
    const warn = sfx(p.evs, "birth.warn").map((e) => e.t), swell = sfx(p.evs, "birth.swell").map((e) => e.t), breath = sfx(p.evs, "birth.breath").map((e) => e.t);
    assert.equal(warn.length, 8); assert.equal(swell.length, 8); assert.equal(breath.length, 8);
    for (let k = 0; k < 8; k++) {
      near(warn[k], W(k), DT + 1e-9, `warning ${k + 1}`);
      near(swell[k], S(k), DT + 1e-9, `surge ${k + 1}`);
      near(breath[k], E(k), DT + 1e-9, `surge ${k + 1} ends`);
    }
    const light = named(p.evs, "moment").find((e) => e.id === "light");
    near(light.t, LIGHT_AT, DT + 1e-9, "the light");
  }
});

await check("the stage ends at 65.5 s for every input (idle, bots, random input, garbage, one-button), with the goal met", () => {
  const runs = [IDLE, ...Object.values(RUNS).flat(), play({ seed: 3, input: randomAt(3) }), play({ seed: 4, input: randomAt(4), opts: { assist: true } })];
  for (const p of runs) {
    assert.equal(p.res.done, true);
    assert.equal(p.res.goalMet, true);
    near(p.st.t, END_AT, DT + 1e-9, `seed ${p.st.seed}: the end`);
    assert.equal(p.res.metrics.ko, false);
    assert.equal(named(p.evs, "milestone").filter((e) => e.id === "born").length, 1, "born once");
    assert.equal(named(p.evs, "done").length, 1);
    assert.deepEqual(p.bad, [], "every view is valid");
  }
});

// The course plans of many seeds, both modes: every obstacle in order with its shape.
function plans() {
  const out = [];
  for (let seed = 1; seed <= 40; seed++) for (const assist of [false, true]) {
    const st = birth.create(seed, null, { assist, motherPhase: 0 });
    out.push({ seed, assist, st, plan: st.plan });
  }
  return out;
}
const PLANS = plans();
// does a circle of radius r at x hit the obstacle's rects (at its middle line)?
const blocked = (o, x, r) => o.rects.some(([x0, x1]) => Math.max(x0 - x, 0, x - x1) < r);

await check("every fold leaves an open lane or a tight gap; tight gaps need the tuck; blocked lanes are blocked", () => {
  for (const { seed, assist, st, plan } of PLANS) {
    const tag = `seed ${seed}${assist ? " assist" : ""}`;
    for (const it of plan) {
      if (it.kind === "bubble") continue;
      assert.ok(it.open.length >= 1, `${tag}: an open lane`);
      // the shape as laid (shapeOf is internal: lay a copy through jump-free state by checking a laid one below)
    }
    // lay the whole course as the stage does and check every laid obstacle's geometry
    const s2 = birth.create(seed, null, { assist, motherPhase: 0 });
    const seen = new Set();
    for (let n = 0; n < MAX_STEPS && !birth.result(s2).done; n++) {
      for (const o of s2.obs) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        const kind = o.kind === "gate" ? TUNE.gates[o.gate].kind : o.tight ? "tight" : "fold";
        if (kind === "fold") {
          for (const j of o.open) assert.ok(!blocked(o, L[j], TUNE.hitR), `${tag} fold ${o.id}: lane ${j} is open`);
          for (const j of o.block) assert.ok(blocked(o, L[j], TUNE.hitR), `${tag} fold ${o.id}: lane ${j} is blocked`);
          assert.ok(o.flaps.every((f) => (f.side < 0 ? f.tip < 0 || o.block.includes(1) : f.tip > 0 || o.block.includes(1))), `${tag}: each flap from one side`);
        } else if (kind === "tight" || kind === "tuck" || kind === "lift") {
          const lanes = kind === "tuck" ? [0, 1, 2] : o.open;
          for (const j of [0, 1, 2]) {
            if (lanes.includes(j)) {
              assert.ok(!blocked(o, L[j], TUNE.tuckR), `${tag} ${kind} ${o.id}: lane ${j} passes tucked`);
              assert.ok(blocked(o, L[j], TUNE.hitR), `${tag} ${kind} ${o.id}: lane ${j} bumps you untucked`);
            } else assert.ok(blocked(o, L[j], TUNE.tuckR), `${tag} ${kind} ${o.id}: lane ${j} is closed`);
          }
        } else {
          const g = o.open[0], far = 2 - g;
          assert.ok(g === 0 || g === 2, `${tag}: a turn gate in an outer lane`);
          assert.ok(!blocked(o, L[g], TUNE.hitR) && !blocked(o, L[1], TUNE.hitR), `${tag}: the gate lane and the middle are open`);
          assert.ok(blocked(o, L[far], TUNE.hitR), `${tag}: the far outer lane has a flap`);
        }
        assert.ok(o.flaps.every((f) => f.side === -1 || f.side === 1), "each flap touches one wall");
      }
      birth.step(s2, makeIntents());
      s2.events.length = 0;
    }
  }
});

await check("the course's rhythm: spacing at least 0.7 s (0.55 s in waves 5 to 8), close folds within a lane of each other, tight gaps 1.4 s apart, gates clear", () => {
  for (const { seed, assist, plan } of PLANS) {
    const tag = `seed ${seed}${assist ? " assist" : ""}`;
    const obs = plan.filter((it) => it.kind !== "bubble");
    const foldK = assist ? TUNE.assist.foldK : 1;
    let lastTight = -Infinity;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i], p = obs[i - 1];
      if (p && p.wave === o.wave) {
        const dt = o.tm - p.tm;
        const minGap = (o.wave >= TUNE.lateFrom ? TUNE.minGapLateS : TUNE.minGapS) * foldK;
        assert.ok(dt >= Math.min(minGap, TUNE.gateGapS) - 0.09, `${tag}: ${dt.toFixed(2)} s between ${p.id} and ${o.id}`);
        const shift = dt < TUNE.quickS * foldK ? 1 : 2;
        assert.ok(p.open.some((a) => o.open.some((b) => Math.abs(a - b) <= shift)), `${tag}: ${o.id} reachable from ${p.id} in ${dt.toFixed(2)} s`);
        if (o.kind === "gate" || p.kind === "gate") assert.ok(dt >= TUNE.gateGapS - 0.09, `${tag}: a fold ${dt.toFixed(2)} s from a gate`);
      }
      if (o.tight) {
        assert.ok(o.tm - lastTight >= TUNE.tightGapS - 1e-9, `${tag}: tight gaps ${(o.tm - lastTight).toFixed(2)} s apart`);
        if (o.kind === "fold") assert.ok(o.wave >= TUNE.tightFrom, `${tag}: a tight gap in wave ${o.wave + 1}`);
        lastTight = o.tm;
      }
    }
    // the gates: one in each even wave, 2.5 s into its surge; folds only inside the surges
    const gates = obs.filter((o) => o.kind === "gate");
    assert.deepEqual(gates.map((g) => [g.gate, g.wave]), [[0, 1], [1, 3], [2, 5], [3, 7]], tag);
    for (const o of obs) {
      const s = S(o.wave), e = E(o.wave);
      assert.ok(o.tm >= s + TUNE.foldLead - 0.09 && o.tm <= e - TUNE.foldTail + 0.09, `${tag}: ${o.id} at ${o.tm.toFixed(2)} inside surge ${o.wave + 1}`);
    }
    // bubbles: 3 a wave, none after wave 8's surge
    const bub = plan.filter((it) => it.kind === "bubble");
    assert.equal(bub.length, 23, `${tag}: ${bub.length} bubbles`);
    assert.ok(bub.every((b) => b.tm < E(7)), `${tag}: no bubble frames the light`);
  }
});

await check("the waves speed up: rest 22 u/s, surges 50 rising 4 a wave to 78, ramps over 0.6 s; wave 8's speed carries into the light", () => {
  // the ref bot never bumps, so the course is never late and the rests stay at 22 u/s
  const st = birth.create(1, null, { motherPhase: 0 });
  const bot = createBot(1, 1);
  const vs = [];
  for (let n = 0; n < MAX_STEPS && !birth.result(st).done; n++) { birth.step(st, bot.intents(birth, st)); st.events.length = 0; vs.push([st.t, st.v]); }
  const at = (t) => vs.find((x) => x[0] >= t - 1e-9)[1];
  near(at(1.0), 22, 1e-6, "rest before wave 1");
  for (let k = 0; k < 8; k++) {
    const top = Math.max(...vs.filter((x) => x[0] > S(k) && x[0] < E(k)).map((x) => x[1]));
    near(top, 50 + 4 * k, 1e-6, `surge ${k + 1}`);
    if (k < 7) near(at(E(k) + TUNE.rampS + 0.1), 22, 1e-6, `rest after ${k + 1}`);
  }
  near(at(LIGHT_AT + 1), 78, 1e-6, "into the light at wave 8's speed");
  // idle bumps, so the course runs late: the rests carry it on a little faster (at most 30 u/s more)
  const vi = [];
  const s2 = birth.create(1, null, { motherPhase: 0 });
  for (let n = 0; n < MAX_STEPS && !birth.result(s2).done; n++) { birth.step(s2, makeIntents()); s2.events.length = 0; vi.push([s2.t, s2.v]); }
  const rests = vi.filter(([t]) => t > TUNE.leadS && [0, 1, 2, 3, 4, 5, 6].some((k) => t > E(k) + TUNE.rampS && t < S(k + 1)));
  // (the catch-up starts while the planned speed is within 0.5 u/s of the rest's, as the ramp ends)
  assert.ok(rests.every(([, v]) => v >= 22 - 1e-9 && v <= 22.5 + TUNE.catchV + 1e-9));
  assert.ok(rests.some(([, v]) => v > 23), "the late course catches up in a rest");
  // Assist: surges 0.8× as fast
  const a = birth.create(1, null, { assist: true, motherPhase: 0 });
  near(a.waves[7].v, 78 * 0.8, 1e-9, "Assist slows the surges");
});

await check("lanes: a flick takes the next lane, a held drag slides on, letting go settles; arrows move one lane a keydown", () => {
  const st = birth.create(2, null, { motherPhase: 0 });
  const run = (n, it) => { for (let i = 0; i < n; i++) { birth.step(st, makeIntents(it)); st.events.length = 0; } };
  assert.equal(st.lane, 1); assert.equal(st.x, 0);
  run(4, { steer: { x: 1, y: 0 }, touching: true });      // a flick right: 4 steps
  run(30, { touching: false });
  assert.equal(st.lane, 2); near(st.x, L[2], 1e-6, "settled in the right lane");
  run(40, { steer: { x: -0.8, y: 0 }, touching: true });  // held left: slides across both lanes
  assert.equal(st.lane, 0); near(st.x, L[0], 1e-6, "at the left lane");
  run(30, {});
  near(st.x, L[0], 1e-6, "stays there");
  run(3, { steer: { x: 0.2, y: 0 }, touching: true });    // under the engage point: nothing
  run(10, {});
  assert.equal(st.lane, 0);
  const tp = (dir) => ({ presses: [{ t: st.t + DT / 2, raw: st.t + DT / 2, dir }] });
  run(1, tp("right")); run(30, {});
  assert.equal(st.lane, 1); near(st.x, 0, 1e-6, "one lane by an arrow");
  run(1, tp("right")); run(1, tp("right")); run(30, {});
  assert.equal(st.lane, 2, "never past the edge");
  // a lane move takes about a quarter second
  const s2 = birth.create(2, null, { motherPhase: 0 });
  let n = 0;
  birth.step(s2, makeIntents({ presses: [{ t: 0, raw: 0, dir: "left" }] }));
  while (Math.abs(s2.x - L[0]) > 0.5 && n < 100) { birth.step(s2, makeIntents()); n++; }
  assert.ok(n * DT <= 0.4, `a lane in ${(n * DT).toFixed(2)} s`);
});

await check("the tuck: a tap, a press or a swipe down curls you small for 0.5 s; 0.9 s from start to start; a press 0.15 s early is kept", () => {
  const st = birth.create(2, null, { motherPhase: 0 });
  const run = (n, it = {}) => { for (let i = 0; i < n; i++) { birth.step(st, makeIntents(it)); st.events.length = 0; } };
  run(1, { taps: [{ t: 0 }] });
  assert.ok(st.tuckT > 0, "a tap tucks");
  near(st.tuckT, TUNE.tuckS - DT, 1e-9, "for 0.5 s");
  const v = birth.view(st);
  assert.ok(v.splats.length > 0);
  run(Math.round(0.5 / DT));
  assert.equal(st.tuckT, 0, "and uncurls");
  run(Math.round(0.2 / DT), { presses: [{ t: st.t, raw: st.t }] });   // pressed again 0.7 s after the start: too soon
  assert.equal(st.tucks, 1);
  run(1, { presses: [{ t: st.t, raw: st.t }] });                       // 0.72 s: still too soon, and not yet kept
  const tAt = st.tuckAt;
  run(Math.round(0.1 / DT));
  run(1, { presses: [{ t: st.t, raw: st.t }] });                       // 0.83 s: within 0.15 s of ready: kept
  run(Math.round(0.1 / DT));
  assert.equal(st.tucks, 2, "the kept press tucks when the tuck is back");
  near(st.tuckAt - tAt, TUNE.tuckCdS, DT + 1e-9, "on the dot");
  run(Math.round(1 / DT));
  run(3, { steer: { x: 0, y: -1 }, touching: true });                  // a swipe down
  assert.equal(st.tucks, 3);
  run(Math.round(1 / DT), { steer: { x: 0, y: -1 }, touching: true }); // held down: no second tuck
  assert.equal(st.tucks, 3);
  run(2, { steer: { x: 0, y: 0 } }); run(Math.round(1 / DT)); run(3, { steer: { x: 0, y: -1 }, touching: true });
  assert.equal(st.tucks, 4, "the stick back up, then down again");
  // one-button mode: a tap is no tuck (only the run's presses are)
  const o = birth.create(2, null, { motherPhase: 0, oneButton: true });
  birth.step(o, makeIntents({ taps: [{ t: 0 }] }));
  assert.equal(o.tucks, 0);
});

await check("a bump only slows you: 22 u/s for 0.6 s, the flow ends, a soft boop; never hp, never the end time", () => {
  const p = play({ seed: 5, every: 0, each: (st, evs) => {
    for (const e of evs) if (e.name === "sfx" && e.id === "birth.bump") {
      assert.ok(st.v <= TUNE.bumpV + 1e-9, "slowed");
      assert.equal(st.flow, 0);
      near(st.bumpT, TUNE.bumpS, DT + 1e-9, "for 0.6 s");
    }
  } });
  assert.ok(p.res.metrics.bumps > 0, "idle bumps");
  assert.equal(p.res.metrics.bumps, sfx(p.evs, "birth.bump").length);
  assert.equal(p.st.A, undefined, "no action world");
  assert.equal(p.st.hp, undefined, "no hp");
  near(p.st.t, END_AT, DT + 1e-9, "on time");
  // Assist: a bump costs 0.3 s
  const a = birth.create(5, null, { assist: true, motherPhase: 0 });
  let seen = false;
  for (let n = 0; n < MAX_STEPS && !birth.result(a).done && !seen; n++) {
    birth.step(a, makeIntents());
    if (sfx(a.events, "birth.bump").length) { near(a.bumpT, TUNE.assist.bumpS, DT + 1e-9, "Assist: 0.3 s"); seen = true; }
    a.events.length = 0;
  }
  assert.ok(seen);
});

await check("the four gates: Tuck, Turn, Lift and Turn back; the ref bot hits all four; turnDir from the Turn gate; idle misses with 'anyway'", () => {
  for (const p of RUNS[1]) {
    const m = p.res.metrics;
    assert.deepEqual(m.gates, [true, true, true, true], `seed ${p.st.seed}`);
    assert.equal(m.turnDir, m.turnSide, "the Turn gate's side is turnDir");
    assert.equal(p.res.carryOut.turnDir, m.turnSide);
    const subs = named(p.evs, "subgoal");
    assert.deepEqual(subs.filter((e) => e.state === "done").map((e) => e.text), ["birth.tucked", "birth.turned", "birth.lifted", "birth.turnedBack"]);
    assert.equal(sfx(p.evs, "birth.gate").length, 4);
  }
  // the gates' sides: Turn on turnSide, Turn back on the other
  for (const { st, plan } of PLANS.slice(0, 20)) {
    const g = plan.filter((it) => it.kind === "gate");
    assert.deepEqual(g[1].open, [st.turnSide > 0 ? 2 : 0]);
    assert.deepEqual(g[3].open, [st.turnSide > 0 ? 0 : 2]);
  }
  const subs = named(IDLE.evs, "subgoal");
  assert.deepEqual(subs.filter((e) => e.state === "shown").map((e) => [e.id, e.text]),
    [["gate0", "birth.gate.tuck"], ["gate1", "birth.gate.turn"], ["gate2", "birth.gate.lift"], ["gate3", "birth.gate.back"]]);
  for (const e of subs.filter((x) => x.state === "shown")) near(e.t, W(TUNE.gates[Number(e.id.slice(4))].wave), DT + 1e-9, `${e.id} at its warning`);
  // idle sits in the middle: it misses the Tuck and Lift gates (untucked) and the turn gates (the middle lane)
  assert.ok(subs.filter((e) => e.state === "auto").every((e) => e.text === "birth.anyway"));
  assert.equal(IDLE.res.metrics.gatesHit, 0);
  // each move plays on its wave either way
  for (const p of [IDLE, REF]) for (let gi = 0; gi < 4; gi++) {
    const at = p.st.moveAt[gi];
    assert.ok(at !== null && at <= E(TUNE.gates[gi].wave) + DT + 1e-9, `move ${gi} by its surge's end`);
  }
});

await check("calm bubbles: 3 a wave, 100 each up to 900; a chime and a +100 tag", () => {
  for (const p of [REF, IDLE]) {
    assert.equal(p.res.metrics.offered, 23);
    assert.equal(sfx(p.evs, "birth.bubble").length, p.res.metrics.bubbles);
    assert.equal(p.res.parts.find((x) => x.id === "bubbles").value, Math.min(TUNE.score.bubbles, 100 * p.res.metrics.bubbles));
  }
  assert.ok(REF.res.metrics.bubbles >= 9, `the ref bot takes ${REF.res.metrics.bubbles}`);
});

await check("the light: the glow fills the screen, exposure 1 → 6 over 2.0 s, white 0 → 1 over 1.0 s, a 0.5 s hold; no flap at the light; born", () => {
  const st = birth.create(1, null, { motherPhase: 0 });
  const views = [];
  for (let n = 0; n < MAX_STEPS && !birth.result(st).done; n++) {
    birth.step(st, makeIntents());
    st.events.length = 0;
    if (st.t >= LIGHT_AT - 1 - 1e-9) views.push([st.t, birth.view(st)]);
  }
  const at = (t) => views.find((x) => x[0] >= t - 1e-9)[1];
  const l = (t) => at(t).light;
  near(l(LIGHT_AT + 1).exposure, 3.5, 0.05, "exposure half way");
  near(l(LIGHT_AT + 2).exposure, 6, 0.05, "exposure 6");
  near(l(LIGHT_AT + 2.5).white, 0.5, 0.05, "white half way");
  near(l(LIGHT_AT + 3.0).white, 1, 1e-9, "white");
  const runnerAt = (t) => at(t).strips.find((s) => s.kind === "runner");
  assert.equal(runnerAt(LIGHT_AT + TUNE.retractS + 0.05).flaps.length, 0, "the flaps fold away");
  assert.equal(runnerAt(LIGHT_AT + 0.5).bubbles.length, 0);
  for (const [t, v] of views) {
    const glow = v.marks.find((m) => m.kind === "light");
    if (t >= LIGHT_AT + 2) near(glow.r, (TUNE.lightR[2] * v.camera.span) / TUNE.span, 0.5, "the glow fills the screen");
    if (t >= LIGHT_AT) assert.equal(birth.prompt(st).gesture, "none");
  }
  // jump to the light: nothing left in the channel at once
  const j = birth.create(1, null, { motherPhase: 0 });
  for (let i = 0; i < 600; i++) birth.step(j, makeIntents());
  birth.jump(j, "light");
  const r = birth.view(j).strips.find((s) => s.kind === "runner");
  assert.equal(r.flaps.length + r.posts.length + r.hoops.length + r.bubbles.length, 0);
});

await check("no foe, bullet or hp: the action part holds only tags and flecks", () => {
  for (const p of [REF, IDLE]) {
    const st = birth.create(p.st.seed, null, { motherPhase: 0 });
    const bot = createBot(1, p.st.seed);
    for (let n = 0; n < 2400; n++) {
      birth.step(st, bot.intents(birth, st));
      st.events.length = 0;
      if (n % 120) continue;
      const a = birth.view(st).action;
      assert.ok(a && !a.bullets && !a.foes && !a.hp && !a.boss && !a.player, "only pops, bursts and shake");
      assert.ok(a.shake >= 0 && a.shake <= 1);
    }
  }
});

await check("score: Goal 3,000; folds 3,500 less 400 a bump; 400 a gate; bubbles to 900; Flourish by the best flow; the points add up", () => {
  for (const p of [IDLE, ...RUNS[1], ...RUNS[0.5]]) {
    const m = p.res.metrics, part = (id) => p.res.parts.find((x) => x.id === id).value;
    assert.equal(part("goal"), 3000);
    assert.equal(part("folds"), Math.max(0, 3500 - 400 * m.bumps));
    assert.equal(part("gates"), 400 * m.gatesHit);
    assert.equal(part("flourish"), Math.round(1000 * Math.min(1, m.bestFlow / 30)));
    const sum = named(p.evs, "points").reduce((a, e) => a + e.add, 0);
    assert.equal(sum, p.res.score.total, "the points events add up to the total");
  }
  // more skill scores more; the ref bot is Great or better every seed
  assert.ok(BOTS[1] >= BOTS[0.7] && BOTS[0.7] >= BOTS[0.5] && BOTS[0.5] > IDLE.res.score.total, JSON.stringify({ ...BOTS, idle: IDLE.res.score.total }));
  for (const p of RUNS[1]) assert.ok(["Great", "Glowing"].includes(gradeOf(p.res.score.total, true)), `seed ${p.st.seed}: ${p.res.score.total}`);
  assert.ok(gradeOf(IDLE.res.score.total, true) === "Good", `idle ${IDLE.res.score.total}`);
});

await check("a tight gap tucked in its middle passes; untucked, or off its middle, bumps", () => {
  // find a seed and a tight fold, then ride to it in its lane, tucking (or not) just before it
  for (const tuck of [true, false]) {
    const st = birth.create(9, null, { motherPhase: 0 });
    const tight = st.plan.find((it) => it.kind === "fold" && it.tight);
    assert.ok(tight, "seed 9 has a tight gap");
    const lane = tight.open[0];
    let met = null;
    for (let n = 0; n < MAX_STEPS && !birth.result(st).done && met === null; n++) {
      const o = st.obs.find((x) => x.id === tight.id);
      const it = { presses: [] };
      if (st.t < tight.tm - 0.6) {
        // keep clear of everything else: ride the ideal lane for what is next (the ref bot), then go to the gap's lane
        const a = birth.botSteer(st, 1, null);
        it.steer = a.steer;
        if (a.dash) it.presses.push({ t: st.t, raw: st.t });
      } else {
        st.lane = lane;
        if (o && tuck && st.tuckT === 0 && (o.s - st.d) / st.v < 0.12) it.presses.push({ t: st.t, raw: st.t });
      }
      birth.step(st, makeIntents(it));
      st.events.length = 0;
      if (o && o.done) met = o.bumped;
    }
    assert.equal(met, !tuck, tuck ? "tucked in the gap: no bump" : "untucked: a bump");
  }
});

await check("the anchor sits high on a portrait screen (the way ahead below you), and the cue is you or the gold arrow", () => {
  const H = 844, Wd = 390, k = Wd / TUNE.span;
  const y = SUBJECT.fit.portrait[1] * H - TUNE.camOff * k;
  assert.ok(y / H < 0.4 && y / H > 0.2, `you at ${(100 * y / H).toFixed(0)}% of the height`);
  for (const p of [REF]) {
    const st = birth.create(p.st.seed, null, { motherPhase: 0 });
    const bot = createBot(1, p.st.seed);
    let arrows = 0;
    for (let n = 0; n < MAX_STEPS && !birth.result(st).done; n++) {
      birth.step(st, bot.intents(birth, st));
      st.events.length = 0;
      if (n % 15) continue;
      const v = birth.view(st);
      near(v.anchor.y - v.camera.y, (TUNE.camOff * v.camera.span) / TUNE.span, 1e-9, "the camera rides with you");
      assert.ok(v.camera.span >= TUNE.span - 1e-9 && v.camera.span <= TUNE.span * (1 + TUNE.zoomK) + 1e-9, "the camera pulls back a little");      const arrow = v.marks.find((m) => m.kind === "arrow");
      if (arrow) arrows++;
      if (st.moment === "waves") assert.ok((v.cue.x === v.anchor.x && v.cue.y === v.anchor.y) || (arrow && v.cue.x === arrow.x), "the cue");
    }
    assert.ok(arrows > 10, "the gold arrows show at the turn gates");
  }
});

await check("prompts: move with lane keys in the waves (the gate's line while one is coming, the rest line in the rests), none in the light", () => {
  const pr = named(IDLE.evs, "prompt");
  assert.ok(pr.every((e) => (e.gesture === "move" && e.keys === "lanes") || e.gesture === "none"));
  const texts = [...new Set(pr.map((e) => e.text))];
  const ALLOWED = ["birth.prompt.move", "birth.again", "birth.gate.tuck", "birth.gate.turn", "birth.gate.lift", "birth.gate.back", "birth.go", null];
  assert.ok(texts.every((x) => ALLOWED.includes(x)), JSON.stringify(texts));
  for (const x of ALLOWED.filter((y) => y !== "birth.go")) assert.ok(texts.includes(x), `${x} shows`);
  assert.ok(named(REF.evs, "prompt").some((e) => e.text === "birth.go"), "the last rest says Into the light");
  for (const g of ["birth.gate.tuck", "birth.gate.turn", "birth.gate.lift", "birth.gate.back"]) {
    const k = TUNE.gates.findIndex((x) => x.text === g);
    near(pr.find((e) => e.text === g).t, W(TUNE.gates[k].wave), DT + 1e-9, `${g} from its wave's warning`);
  }
  const restAt = pr.find((e) => e.text === "birth.again");
  near(restAt.t, E(0), DT + 1e-9, "the first rest");
  assert.equal(pr[pr.length - 1].gesture, "none");
});

await check("captions: the six facts once each, in order, as fact events", () => {
  for (const p of [IDLE, REF, RUNS[0.5][1]]) {
    const shown = named(p.evs, "fact");
    assert.deepEqual(shown.map((e) => e.id), ["birth.waves", "birth.fast", "birth.tuck", "birth.turn", "birth.skull", "birth.overlap"]);
    assert.ok(shown.every((e) => e.where === "caption" && e.t < LIGHT_AT));
  }
});

await check("determinism: the same seed and input give the same events and result", () => {
  for (const seed of [1, 7]) {
    const a = play({ seed, bot: createBot(0.7, seed), every: 0 }), b = play({ seed, bot: createBot(0.7, seed), every: 0 });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs));
    assert.deepEqual(a.res, b.res);
  }
  assert.notDeepEqual(birth.create(1, null, {}).plan.map((x) => x.open), birth.create(2, null, {}).plan.map((x) => x.open), "seeds differ");
});

await check("botSteer: lanes and tucks; at skill 1 no memory and no draws; below it, memory only in r.mem", () => {
  const st = birth.create(3, null, { motherPhase: 0 });
  for (let i = 0; i < 400; i++) birth.step(st, makeIntents());
  let calls = 0;
  const r = () => { calls++; return 0.5; };
  const a = birth.botSteer(st, 1, r);
  assert.equal(calls, 0, "no draws at skill 1");
  assert.equal(r.mem, undefined, "no memory at skill 1");
  assert.ok(Math.abs(a.steer.x) <= 1 && a.steer.y === 0 && a.dir === null && a.hold === false && typeof a.dash === "boolean");
  const r2 = stream(3, "bot"); r2.mem = {};
  const snap = JSON.stringify({ x: st.x, lane: st.lane, t: st.t, obs: st.obs.length });
  birth.botSteer(st, 0.5, r2);
  assert.ok(r2.mem.seen && typeof r2.mem.seen === "object", "it remembers what it saw");
  assert.equal(JSON.stringify({ x: st.x, lane: st.lane, t: st.t, obs: st.obs.length }), snap, "the state is unchanged");
  assert.deepEqual(birth.botSteer(st, 0, r2), { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false }, "idle");
});

await check("through the run: practice with the ref bot (no overlay, straight on), and one-button held rides it well", () => {
  const run = createRun({ seed: 3, start: { practice: "birth" } });
  const bot = createBot(1, 3);
  const evs = [];
  while (run.screen !== "result" && evs.length < 1e6) {
    if (run.screen === "stage") {
      const it = bot.intents(run.mod, run.state);
      const shift = (l) => l.map((e) => ({ ...e, t: e.t + run.stageStart, raw: e.raw + run.stageStart }));
      run.step({ ...it, presses: shift(it.presses), releases: shift(it.releases) });
    } else run.step(makeIntents());
    evs.push(...run.events.splice(0));
  }
  assert.ok(!named(evs, "screen").some((e) => e.screen === "overlay"), "no overlay after Birth");
  const s = run.summary().stages[0];
  assert.equal(s.id, "birth");
  assert.ok(["Great", "Glowing"].includes(s.grade), s.grade);
  // one-button: the button held all through; steer comes from botSteer only while touching, and so does the tuck
  for (const held of [true, false]) {
    const r3 = createRun({ seed: 6, settings: { oneButton: true }, start: { practice: "birth" } });
    while (r3.screen === "stage") {
      r3.step(makeIntents({ touching: held, presses: [], steer: { x: 1, y: 1 } }));
      if (!held) assert.deepEqual(r3.lastIntents.steer, { x: 0, y: 0 }, "released: no steer");
      r3.events.length = 0;
    }
    const one = r3.summary().stages[0];
    if (held) assert.ok(one.score.total >= 8500, `one-button held scores ${one.score.total}`);
    else assert.equal(one.goalMet, true, "released all through, it still ends on time");
    assert.equal(r3.summary().marks.oneButton, true);
  }
});

await check("resume: nothing bumps you for 1.2 s after Resume", () => {
  const st = birth.create(5, null, { motherPhase: 0 });
  for (let i = 0; i < 1200; i++) birth.step(st, makeIntents());
  const b0 = st.bumps;
  birth.resume(st);
  for (let i = 0; i < Math.round(1.15 / DT); i++) { birth.step(st, makeIntents()); st.events.length = 0; }
  assert.equal(st.bumps, b0, "no bump in the grace");
  assert.equal(birth.resume(st), 0);
});

await check("jump: waves again lays a fresh course from now; light settles the gates; the cap ends a long jump", () => {
  const st = birth.create(2, null, { motherPhase: 0 });
  for (let i = 0; i < 900; i++) birth.step(st, makeIntents());
  assert.equal(birth.jump(st, "waves"), true);
  near(st.waves[0].warn, st.t + TUNE.leadS, 1e-9, "the waves from now");
  assert.equal(st.moment, "waves");
  assert.equal(birth.jump(st, "moon"), false);
  assert.equal(birth.jump(st, "light"), true);
  assert.equal(st.moment, "light");
  assert.ok(st.gateSt.every((g) => g.done));
  for (let i = 0; i < 400 && !birth.result(st).done; i++) birth.step(st, makeIntents());
  assert.equal(birth.result(st).done, true);
  // a fresh course late in the cap still ends by the cap
  const c = birth.create(2, null, { motherPhase: 0 });
  for (let i = 0; i < 2400; i++) birth.step(c, makeIntents());
  birth.jump(c, "waves");
  for (let i = 0; i < MAX_STEPS && !birth.result(c).done; i++) birth.step(c, makeIntents());
  assert.ok(c.t <= birth.meta.capS + DT + 1e-9, `ends by the cap: ${c.t}`);
});

await check("her beats: 76 → 92 bpm over the waves from motherPhase, then 92; your heart at 130", () => {
  const st = birth.create(1, DEFAULT_CARRY, { motherPhase: 0.37 });
  near(st.beats.mother[0], 0.37, 1e-12, "her first beat at motherPhase");
  near(st.beats.bpm("mother", 0), 76, 1e-9, "76 at the start");
  near(st.beats.bpm("mother", LIGHT_AT - 1e-6), 92, 1e-3, "92 by the light");
  near(st.beats.bpm("mother", END_AT), 92, 1e-9, "92 in the light");
  near(st.beats.bpm("you", 10), 130, 1e-9, "your heart at 130 bpm");
});

await check("garbage input never throws", () => {
  const st = birth.create(1, null, null);
  const junk = [null, undefined, {}, { presses: "x", releases: 5, dir: "sideways" }, { presses: [{ t: NaN }, null, { t: "1" }] },
    { presses: [{ t: -50, raw: -50 }], releases: [{ t: 1e9 }], taps: [null, { t: 1 }] }, { steer: null, touching: "yes" },
    { steer: { x: NaN, y: 5 } }, { steer: { x: 1e9, y: -1e9 } }];
  for (let n = 0; n < 6000 && !birth.result(st).done; n++) {
    assert.doesNotThrow(() => birth.step(st, junk[n % junk.length]));
    st.events.length = 0;
    if (n % 97 === 0) assert.deepEqual(validate(birth.view(st)), []);
    assert.ok(Number.isFinite(st.x) && st.x >= L[0] - 1e-9 && st.x <= L[2] + 1e-9);
  }
  assert.equal(birth.result(st).done, true);
  assert.doesNotThrow(() => { birth.step(null, null); birth.prompt(null); birth.targets(null); birth.botSteer(null, 1, null); birth.view(null); birth.result(null); });
  assert.deepEqual(validate(birth.view(null)), []);
  assert.equal(birth.jump(null, "light"), false);
  // sparks round you
  const v = birth.view(birth.create(1, mergeCarry(DEFAULT_CARRY, { sparks: 3 }), {}));
  assert.deepEqual(validate(v), []);
});

// Facts and strings (v1 15.1 to 15.4).
const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

await check("facts: the v1 set, from the allow-list, R or A, checked, gaDay 280, short, no label in the text", () => {
  assert.deepEqual(FACTS.map((f) => [f.id, f.where]), [["birth.card", "card"], ["birth.fast", "caption"],
    ["birth.waves", "caption"], ["birth.tuck", "caption"], ["birth.turn", "caption"], ["birth.skull", "caption"],
    ["birth.overlap", "caption"]]);
  for (const f of FACTS) {
    assert.equal(f.stage, "birth");
    assert.equal(f.gaDay, 280);
    assert.equal(f.checked, true);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    for (const k of f.src) assert.ok(SOURCES[k], `${f.id}: ${k} is on the allow-list`);
    for (const carer of Object.keys(CARERS)) {
      const text = fill(f.text, {}, { carer });
      assert.ok(words(text) <= 20, `${f.id}: ${words(text)} words`);
      for (const s of sentences(text)) assert.ok(words(s) <= 16, `${f.id}: a sentence of ${words(s)} words`);
      assert.ok(!BANNED.test(text) && !PRONOUNS.test(text), `${f.id}: ${text}`);
    }
  }
});

await check("strings: every shown id exists; plain and tender; no banned word, pronoun, em dash or score framing", () => {
  const used = new Set();
  for (const p of [IDLE, REF]) {
    for (const e of p.evs) {
      if (e.name === "prompt" && e.text) used.add(e.text);
      if (e.name === "subgoal") used.add(e.text);
    }
    for (const part of p.res.parts) if (part.label.startsWith("birth.")) used.add(part.label);
    for (const q of p.st.pops) if (q.word) used.add(q.word);
  }
  used.add("birth.pop.flow"); used.add("birth.pop.tight");
  for (const id of used) assert.ok(TEXT[id], `${id} has a string`);
  for (const [id, text] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("birth."), id);
    assert.ok(!/—/.test(text), `${id}: no em dash`);
    for (const carer of Object.keys(CARERS)) {
      const s = fill(text, {}, { carer });
      assert.ok(!BANNED.test(s), `${id}: ${s}`);
      assert.ok(!PRONOUNS.test(s), `${id}: ${s}`);
      for (const x of sentences(s)) assert.ok(words(x) <= 16, `${id}: a sentence of ${words(x)} words`);
    }
    assert.ok(!/apgar|score|points/i.test(text), `${id} frames no score`);
  }
  assert.equal(TEXT["birth.prompt.move"], "Drag to change lanes. Tap to tuck.");
  assert.equal(TEXT["birth.again"], "Rest. Another wave will come.");
  assert.equal(TEXT["birth.anyway"], "The wave moves you on anyway.");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks (idle ${IDLE.res.score.total}, ${IDLE.res.metrics.clean}/${IDLE.res.metrics.folds} folds; bot means ${Object.entries(BOTS).map(([k, v]) => `${k}: ${v}`).join(", ")})`);
}
