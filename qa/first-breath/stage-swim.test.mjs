// First Breath: stage 1, The Race (`swim`): the v1 race (v1 design 6.1, 16.4) with the kart parts of the change
// first-breath-action-genres (design.md 5.1; tasks.md 1.1 to 1.11). Played in node with no DOM (16.11).
// Kept from v1: the same seed and input give the same race; the place (rank by arrival, progress, then out) at every
// step and the shown place's 0.25 s hold; bumps (pushed apart, 0.7 at most once per 0.4 s, top speed back after
// 0.6 s, never a sperm that is not swimming); the cool loop back at 1,300 u within 6 s with no input; waves lift only a
// swimmer, by the shared thresholds; the lane at ≥ 70 u/s and a wall at ≤ 65 u/s on a straight; the glow attach rule,
// ready on her 4th beat, detaching; ready ×1.6 on the stick term only; one live gesture per moment; sub-goals end
// done or auto; no timed targets; every view valid; botSteer's memory only in r.mem; the carry; her beats; the facts
// and strings; the points add up; odd input never throws.
// New: the track's six bends that turn back to the start's heading and its 4,600 u; progress never jumps along the
// bends; the camera turns with the track; the turn rate is v1's with and without a drift; the drift starts only on
// a press while turning, charges blue, orange and pink at 0.6, 1.2 and 2.0 s and boosts +25, +30, +35 u/s for 0.5,
// 0.9, 1.3 s (nothing before blue); a press while straight, or E, uses the item; the item table by place; a spark homes
// on the sperm ahead and spins it out; a shield takes one hit; goo slips; a Warm glow makes you ready; the slipstream
// and the slingshot; white cells spin you out; each gate closes at its quota or its time and everyone behind rests;
// the tide reaches an idle sperm by about 14 s; once the third arrives the rest rest; out ends the stage with the
// Almost card's data and Go on plays `carried`; never past 120 s; the race gates through qa/first-breath/race-sim.mjs
// (ref top 3 in every seed and 1st in ≥ 16 of 20, mid and one-button top 3 in ≥ 18 of 20, idle never past gate 1).
// node qa/first-breath/stage-swim.test.mjs        (FB_SWIM_SEEDS=N sets the seeds for the race gates; default 20)
import assert from "node:assert/strict";
import * as swim from "../../public/first-breath/core/stages/swim.js";
import { TUNE } from "../../public/first-breath/core/stages/swim.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/swim.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/swim.text.js";
import { layTrack, lineAt } from "../../public/first-breath/core/stages/swim.track.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { DT } from "../../public/first-breath/core/clock.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { say } from "../../public/first-breath/core/text.js";
import { runAll, gatesOf } from "./race-sim.mjs";

const FILE = "qa/first-breath/stage-swim.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 10).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const SEEDS = Array.from({ length: Math.max(1, Number(process.env.FB_SWIM_SEEDS) || 20) }, (_, i) => i + 1);
const OPTS = { assist: false, oneButton: false, motherPhase: 0 };
const prog = (sp) => (sp.arrived ? TUNE.TUBE_END : sp.zone === "loop" ? TUNE.FORK : sp.p);
const DEG = Math.PI / 180;

// Play one stage to its end. `input(st)` gives the intents (else the bot at `skill`); `each(st, evs)` sees every step.
function play(seed, { skill = null, input = null, each = null, opts = OPTS, carry = DEFAULT_CARRY, max = 9000, st = null } = {}) {
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
// A state in the tube at t ≈ 0 with every rival out of the way (out, far behind), you at (x, p) heading up the track.
function lone(seed = 1, { p = 1720, x = null, speed = 60, opts = OPTS } = {}) {
  const st = swim.create(seed, DEFAULT_CARRY, opts);
  swim.jump(st, "tube");
  for (const r of st.rivals) { r.out = true; r.outT = -1; r.rest = -10; r.attached = "rest"; r.p = 0; r.zone = "path"; }
  const you = st.you;
  you.p = p; you.x = x === null ? st.xc : x; you.speed = speed; you.lastCheck = 1400;
  you.ang = you.vang = Math.PI / 2;
  you.wang = p < st.trk.bends[0].p0 ? Math.PI / 2 : lineAt(st.trk, p).phi;
  you.wrate = 0;
  st.t = 1;
  st.events.length = 0;
  return st;
}
// The world stick that points along the track at your place, turned by `deg` (+ left).
function stickAlong(st, deg = 0, m = 1) {
  const phi = lineAt(st.trk, Math.max(st.you.p, 0)).phi + (st.you.p < st.trk.bends[0].p0 ? 0 : 0);
  const a = (st.you.p < st.trk.bends[0].p0 ? Math.PI / 2 : phi) + deg * DEG;
  return { x: Math.cos(a) * m, y: Math.sin(a) * m };
}
const it = (steer, more = {}) => makeIntents({ steer, touching: true, ...more });

// ---------------------------------------------------------------- the races, shared by several checks

const RACES = { ref: [], mid: [], idle: [] };
const GESTURES = {};
const note = (m, g) => { (GESTURES[m] = GESTURES[m] || new Set()).add(g); };

// The per-step checks: the place (rank) and its 0.25 s hold; one live gesture per moment; every 30th view valid;
// progress never jumps.
function watcher() {
  let since = 0, prevNow = null, prevShown = null, n = 0;
  const lastP = new Map();
  return (s, evs) => {
    n++;
    if (prevNow === null) { prevNow = s.placeNow; prevShown = s.place; }
    if (n % 30 === 0) assert.deepEqual(validate(swim.view(s)), [], `view at ${s.t.toFixed(2)} s (${s.moment})`);
    for (const e of evs) if (e.name === "prompt" && !s.done) note(s.moment + (s.you.out ? ":out" : ""), e.gesture);
    for (const sp of s.all) {
      if (sp.zone !== "loop" && !sp.arrived) {
        const q = lastP.get(sp);
        if (q !== undefined && sp.zone === "tube") assert.ok(Math.abs(sp.p - q) < 6, `sperm ${sp.id} jumped from ${q} to ${sp.p}`);
      }
      lastP.set(sp, sp.zone === "loop" ? undefined : sp.p);
    }
    if (s.done) return;
    // the rank: arrivals by time, then racers by progress, then the out ones, the later out first
    const you = s.you;
    if (s.finalPlace === null && !you.arrived) {
      const grp = (o) => (o.arrived ? 0 : o.out ? 2 : 1);
      const ahead = s.rivals.filter((o) => grp(o) < grp(you) || (grp(o) === grp(you) && (grp(o) === 2 && o.outT !== you.outT
        ? o.outT > you.outT : prog(o) > prog(you)))).length;
      assert.ok(Math.abs(s.placeNow - (1 + ahead)) <= s.rivals.filter((o) => grp(o) === grp(you) && prog(o) === prog(you)).length,
        `placeNow ${s.placeNow} vs ${1 + ahead} at ${s.t.toFixed(2)} s`);
    }
    if (s.placeNow !== prevNow) { since = s.t; prevNow = s.placeNow; }
    const pe = evs.filter((e) => e.name === "place");
    if (s.place !== prevShown) {
      assert.equal(s.place, s.placeNow);
      assert.ok(s.t - since >= TUNE.PLACE_HOLD_S - 1e-9 || s.done, `the shown place changed after ${(s.t - since).toFixed(3)} s`);
      assert.equal(pe.length, 1);
      prevShown = s.place;
    } else assert.equal(pe.length, 0, "no place event without a change");
  };
}

await check("over the seeds the ref bot plays the same race twice: the same positions and events at every step", () => {
  for (const seed of SEEDS.slice(0, 4)) {
    const a = swim.create(seed, DEFAULT_CARRY, OPTS), b = swim.create(seed, DEFAULT_CARRY, OPTS);
    const ba = createBot(1, seed), bb = createBot(1, seed);
    a.events.length = 0; b.events.length = 0;
    let steps = 0;
    while (!swim.result(a).done && steps < 9000) {
      swim.step(a, ba.intents(swim, a));
      swim.step(b, bb.intents(swim, b));
      steps++;
      for (let i = 0; i < a.all.length; i++) {
        const x = a.all[i], y = b.all[i];
        if (x.x !== y.x || x.p !== y.p || x.zone !== y.zone || x.speed !== y.speed || x.item !== y.item) assert.fail(`seed ${seed}: sperm ${x.id} differs at step ${steps}`);
      }
      assert.equal(JSON.stringify(a.events), JSON.stringify(b.events), `seed ${seed}: the same events at step ${steps}`);
      a.events.length = 0; b.events.length = 0;
    }
    assert.deepEqual(swim.result(a), swim.result(b));
  }
});

await check("the ref, mid (0.7) and idle bots play every seed; the place, its hold, gestures and views hold at every step", () => {
  for (const seed of SEEDS.slice(0, 8)) {
    for (const [name, skill] of [["ref", 1], ["mid", 0.7], ["idle", 0]]) {
      const st = swim.create(seed, DEFAULT_CARRY, OPTS);
      note(st.moment, swim.prompt(st).gesture);
      const r = play(seed, { skill, st, each: watcher() });
      assert.equal(r.res.done, true, `${name} seed ${seed} completes`);
      assert.equal(r.res.metrics.fault, null, `${name} seed ${seed}: no fault`);
      const arr = r.evs.filter((e) => e.name === "arrive");
      arr.forEach((e, i) => assert.equal(e.place, i + 1, "arrive events come in place order"));
      RACES[name].push({ seed, ...r });
    }
  }
});

// ---------------------------------------------------------------- the race gates (race-sim.mjs)

await check("the race gates: ref top 3 in every seed and 1st in ≥ 16 of 20; mid and one-button top 3 in ≥ 18 of 20; idle never past gate 1", () => {
  const res = runAll(SEEDS, true);
  const g = gatesOf(res, SEEDS.length);
  assert.deepEqual(g.fails, []);
});

await check("idle: the cool tide reaches you at about 14 s in the womb; you rest; the stage ends with the Almost card's data", () => {
  for (const r of RACES.idle) {
    const m = r.res.metrics;
    assert.equal(m.out, "tide");
    near(m.outAt, 14, 1.5, "out at");
    assert.ok(r.st.you.p < 1100, "never past the womb");
    assert.equal(r.res.goalMet, false);
    assert.equal(m.capped, true, "metrics.capped: the card says 'You were ...' and Go on plays carried");
    assert.equal(r.res.score.goal, 0);
    assert.ok(r.st.t < 30, `ends soon after: ${r.st.t.toFixed(1)} s`);
    assert.ok(r.evs.some((e) => e.name === "caption" && e.id === "swim.tideYou"));
  }
});

await check("Go on after you are out plays the 3 s carried to the meeting place with input none, Goal 0", () => {
  const r = RACES.idle[0];
  const st = r.st;
  assert.equal(swim.jump(st, "carried"), true);
  const evs = [];
  let n = 0;
  while (!swim.result(st).done && n < 600) { swim.step(st, it({ x: 1, y: 0 })); evs.push(...st.events.splice(0)); n++; }
  near(n * DT, TUNE.CARRIED_S, 0.05, "carried lasts");
  assert.equal(swim.result(st).goalMet, false);
  assert.equal(swim.result(st).score.goal, 0);
  assert.equal(swim.prompt(st).gesture, "none");
  assert.ok(st.t <= 120);
});

await check("Try again keeps the grid: the same seed makes the same start", () => {
  const a = swim.create(5, DEFAULT_CARRY, OPTS), b = swim.create(5, DEFAULT_CARRY, OPTS);
  assert.deepEqual(a.all.map((s) => [s.x, s.p, s.skill]), b.all.map((s) => [s.x, s.p, s.skill]));
  assert.equal(a.rivals.length, 19);
  assert.deepEqual([a.you.x, a.you.p], [-5, 24], "you in row 3, slot 2");
});

// ---------------------------------------------------------------- meta, gestures, sub-goals, targets, views

await check("meta: the moments, families steer and tap, canFail, the 117 s cap", () => {
  assert.deepEqual(swim.meta.moments.map((m) => m.id), ["womb", "gate", "fork", "tube", "meet", "carried"]);
  assert.deepEqual([...swim.meta.families], ["steer", "tap"]);
  assert.equal(swim.meta.canFail, true);
  assert.equal(swim.meta.capS, 117);
  assert.equal(swim.meta.orient, "long");
});

await check("one live gesture per moment: move in womb, gate, fork and tube; none in meet, carried and once you are out", () => {
  for (const m of ["womb", "gate", "fork", "tube"]) if (GESTURES[m]) assert.deepEqual([...GESTURES[m]].filter((g) => g !== "none"), ["move"], m);
  for (const m of ["meet", "carried"]) if (GESTURES[m]) assert.deepEqual([...GESTURES[m]], ["none"], m);
  for (const [m, set] of Object.entries(GESTURES)) if (m.endsWith(":out")) assert.deepEqual([...set], ["none"], m);
});

await check("every sub-goal ends done or auto; the goal reads 'Race to the egg.'", () => {
  for (const r of [...RACES.ref, ...RACES.mid, ...RACES.idle]) {
    for (const [id, s] of Object.entries(r.st.subgoals)) assert.ok(s === "done" || s === "auto", `${id}: ${s}`);
  }
  assert.equal(TEXT["swim.goal"], "Race to the egg. Get there in the first three.");
});

await check("targets: the race has none", () => {
  const st = swim.create(1, DEFAULT_CARRY, OPTS);
  assert.deepEqual(swim.targets(st, 3), []);
});

await check("views: valid, a camera that turns with the track, an anchor at you and a cue; the race strip's parts", () => {
  const st = swim.create(2, DEFAULT_CARRY, OPTS);
  const bot = createBot(1, 2);
  let maxRot = 0;
  for (let n = 0; n < 60 * 45 && !swim.result(st).done; n++) {
    swim.step(st, bot.intents(swim, st));
    st.events.length = 0;
    if (n % 20) continue;
    const d = swim.view(st);
    assert.deepEqual(validate(d), []);
    const race = d.strips.find((s) => s.kind === "race");
    assert.ok(race && race.parts.length >= 1);
    assert.ok(d.anchor && Number.isFinite(d.anchor.x));
    assert.ok(d.cue && Number.isFinite(d.cue.x));
    maxRot = Math.max(maxRot, Math.abs(d.camera.rot));
    // the camera's turn is the track's heading near you, within the 0.5 s ease
    if (st.you.zone === "tube") {
      const phi = lineAt(st.trk, st.cam.p).phi;
      const err = Math.abs(Math.atan2(Math.sin(st.cam.phi - phi), Math.cos(st.cam.phi - phi)));
      assert.ok(err < 1.2, `the camera's turn is ${err.toFixed(2)} rad off the track's`);
    }
  }
  assert.ok(maxRot > 1, `the camera turned (${maxRot.toFixed(2)} rad)`);
});

// ---------------------------------------------------------------- the track

await check("the track: six bends (B3 a hairpin) that turn back to the start's heading; 4,600 u; the inside is shorter", () => {
  const trk = layTrack(TUNE.BENDS);
  assert.equal(trk.bends.length, 6);
  assert.deepEqual(TUNE.BENDS.map((b) => b[1]), [-90, 120, -180, 90, -90, 150]);
  assert.equal(TUNE.BENDS.reduce((a, b) => a + b[1], 0), 0);
  near(lineAt(trk, 4600).phi, Math.PI / 2, 1e-9, "the final straight runs +y");
  assert.equal(TUNE.TUBE_END, 4600);
  // gates and glow walls sit where design 5.1 puts them; glow walls on straights
  // the gates (tuned from the design's 14, 8 and 5 to 8, 5 and 4, so they close nearer the pace of design.md 5.1)
  assert.deepEqual(TUNE.GATES.map((g) => [...g]), [[1300, 8, 30], [2800, 5, 60], [4000, 4, 85]]);
  for (const g of TUNE.GLOWS) assert.ok(!trk.bends.some((b) => g >= b.p0 && g <= b.p1), `glow at ${g} on a straight`);
  // apart from the hairpin's two legs (2R apart), the centre line never comes within 120 u of itself
  const pts = [];
  for (let p = 1300; p <= 4650; p += 10) { const c = lineAt(trk, p); pts.push([p, c.x, c.y]); }
  for (const a of pts) for (const b of pts) {
    if (b[0] - a[0] < 400) continue;
    const d = Math.hypot(a[1] - b[1], a[2] - b[2]);
    const legs = a[0] < 2260 && a[0] > 1880 && b[0] > 2420 && b[0] < 2900;
    assert.ok(d >= (legs ? 105 : 120), `${a[0]} and ${b[0]} are ${d.toFixed(0)} u apart`);
  }
  // at the same stick, the inside of a bend gains progress faster than the outside (B3 is a right hairpin)
  const gain = (u) => {
    const st = lone(1, { p: 2280, speed: 55 });
    st.you.x = st.xc + u;
    const p0 = st.you.p;
    for (let i = 0; i < 20; i++) swim.step(st, it(stickAlong(st, 0)));
    return st.you.p - p0;
  };
  assert.ok(gain(15) > gain(-15) * 1.3, `inside ${gain(15).toFixed(1)} vs outside ${gain(-15).toFixed(1)}`);
});

await check("in the tube on a straight at full stick: the lane centre ≥ 70 u/s, a wall ≤ 65 u/s (v1)", () => {
  const speedAt = (u) => {
    const st = lone(1, { p: 2560, speed: 0 });
    st.you.x = st.xc + u;
    st.t = 0.5;
    let p0 = 0;
    for (let i = 0; i < 180; i++) {
      // hold the lane: the lane drifts, so steer back to it
      swim.step(st, it(stickAlong(st, 0)));
      if (i === 120) p0 = st.you.p;
    }
    return (st.you.p - p0) / (60 * DT);
  };
  // the lane centre at t near 2.5 s
  const st0 = lone(1, { p: 2560 });
  const laneU = TUNE.LANE_DRIFT * Math.sin(2 * Math.PI * TUNE.LANE_HZ * 2.5);
  assert.ok(speedAt(laneU) >= 70, `lane ${speedAt(laneU).toFixed(1)}`);
  assert.ok(speedAt(TUNE.TUBE_HALF - 4) <= 65 || speedAt(-(TUNE.TUBE_HALF - 4)) <= 65, "a wall is slower");
  void st0;
});

await check("the turn rate is v1's 3.0 rad/s, with and without a drift (no grip limit)", () => {
  for (const drift of [false, true]) {
    const st = lone(1, { p: 2600, speed: 60 });
    const turnS = [];
    let a0 = st.you.ang;
    if (drift) { st.you.wrate = 1; swim.step(st, it(stickAlong(st, 60), { presses: [{ t: st.t, raw: st.t }] })); assert.ok(st.you.drift, "a press while turning drifts"); a0 = st.you.ang; }
    for (let i = 0; i < 10; i++) {
      swim.step(st, it(stickAlong(st, 170)));
      const d = Math.abs(Math.atan2(Math.sin(st.you.ang - a0), Math.cos(st.you.ang - a0)));
      turnS.push(d / DT);
      a0 = st.you.ang;
    }
    for (const r of turnS) assert.ok(r <= TUNE.TURN + 0.05, `${drift ? "drifting" : "plain"}: ${r.toFixed(3)} rad/s`);
    assert.ok(Math.max(...turnS) > TUNE.TURN - 0.05, "it turns at the full rate");
  }
});

// ---------------------------------------------------------------- the drift

function driftFor(holdS, { release = "press" } = {}) {
  const st = lone(1, { p: 1460, speed: 70 });
  st.you.wrate = -1;
  // B1 bends right: steer 40° right of the track and press
  swim.step(st, it(stickAlong(st, -40), { presses: [{ t: st.t, raw: st.t }] }));
  const d0 = st.you.drift;
  const levels = [];
  let t = 0;
  while (t < holdS - 1e-9) {
    swim.step(st, it(stickAlong(st, -40)));
    t += DT;
    if (st.you.drift) levels.push([t, st.you.drift.level]);
  }
  const before = st.you.boosts.length;
  if (release === "press") swim.step(st, it(stickAlong(st, -40), { presses: [{ t: st.t, raw: st.t }] }));
  else if (release === "release") swim.step(st, it(stickAlong(st, -40), { releases: [{ t: st.t, raw: st.t }] }));
  else if (release === "lift") swim.step(st, makeIntents({ steer: { x: 0, y: 0 }, touching: false }));
  return { st, d0, levels, boost: st.you.boosts.slice(before)[0] || null };
}

await check("a drift: a press while turning starts it; blue, orange and pink at 0.6, 1.2 and 2.0 s; the boosts", () => {
  const lvAt = (levels, lv) => (levels.find((q) => q[1] >= lv) || [Infinity])[0];
  const r = driftFor(2.1);
  assert.ok(r.d0 && r.d0.side === -1, "a right drift");
  near(lvAt(r.levels, 1), 0.6, 0.05, "blue");
  near(lvAt(r.levels, 2), 1.2, 0.05, "orange");
  near(lvAt(r.levels, 3), 2.0, 0.05, "pink");
  assert.deepEqual([r.boost.v, r.boost.dur], [35, 1.3], "pink: +35 u/s for 1.3 s");
  assert.deepEqual([driftFor(0.7).boost.v, driftFor(0.7).boost.dur], [25, 0.5], "blue");
  assert.deepEqual([driftFor(1.3).boost.v, driftFor(1.3).boost.dur], [30, 0.9], "orange");
  assert.equal(driftFor(0.4).boost, null, "before blue: nothing");
  assert.ok(driftFor(0.8, { release: "release" }).boost, "a release (Space's keyup) lets it go");
  assert.ok(driftFor(0.8, { release: "lift" }).boost, "lifting lets it go");
  // the boost adds to the speed and eases off over its time
  const st = r.st, p0 = st.you.p;
  assert.ok(st.you.drift === null);
  void p0;
});

await check("a press while swimming straight uses the item, and does not drift; E (item: true) uses it even while turning", () => {
  const st = lone(1, { p: 2560, speed: 60 });
  st.you.wrate = 0;
  st.you.item = "rush";
  swim.step(st, it(stickAlong(st, 0), { presses: [{ t: st.t, raw: st.t }] }));
  assert.equal(st.you.drift, null);
  assert.equal(st.you.item, null);
  assert.ok(st.you.boosts.some((b) => b.v === 40 && b.dur === 1.2), "Rush: +40 u/s for 1.2 s");
  const s2 = lone(1, { p: 1460, speed: 70 });
  s2.you.wrate = -1; s2.you.item = "shield";
  swim.step(s2, it(stickAlong(s2, -40), { presses: [{ t: s2.t, raw: s2.t, item: true }] }));
  assert.equal(s2.you.drift, null, "E never drifts");
  assert.ok(s2.you.shieldUntil > s2.t + 7, "Shield for 8 s");
  // a press with nothing to use and no turn does nothing
  const s3 = lone(1, { p: 2560, speed: 60 });
  s3.you.wrate = 0;
  swim.step(s3, it(stickAlong(s3, 0), { presses: [{ t: s3.t, raw: s3.t }] }));
  assert.equal(s3.you.drift, null);
});

// ---------------------------------------------------------------- items

await check("item boxes: rows of 4 at 500, 2,050 and 3,330 u; a box rolls an item for 0.8 s and comes back after 2 s", () => {
  const st = swim.create(3, DEFAULT_CARRY, OPTS);
  assert.equal(st.boxes.length, 12);
  assert.deepEqual([...new Set(st.boxes.map((b) => b.p))], [500, 2050, 3330]);
  const st2 = lone(3, { p: 2040, speed: 30 });
  const box = st2.boxes.find((b) => b.p === 2050);
  st2.you.x = box.x;
  let got = null, rolledAt = null;
  for (let i = 0; i < 120 && !got; i++) {
    swim.step(st2, it(stickAlong(st2, 0, 0.5)));
    if (st2.you.roll && rolledAt === null) rolledAt = st2.t;
    if (st2.you.item) got = st2.t;
  }
  assert.ok(rolledAt !== null && got !== null, "rolled, then got");
  near(got - rolledAt, TUNE.ROLL_S, 0.03, "the roll");
  near(box.back - rolledAt, TUNE.BOX_BACK_S, 0.03, "the box comes back");
});

await check("the item table by place: the front gets Shield, Goo, Spark; the back gets Rush, Warm glow, Spark (seeded)", () => {
  const roll = (place, n = 2000) => {
    const st = lone(1, { p: 2560, speed: 0 });
    const you = st.you;
    const count = {};
    for (let i = 0; i < n; i++) {
      // a fresh box under you each time, your place forced
      st.boxes = [{ row: 0, i: 0, x: you.x, p: you.p, back: 0, takenAt: -1e9 }];
      you.item = null; you.roll = null; you.rank = place;
      swim.step(st, makeIntents());
      if (!you.roll) continue;
      count[you.roll.item] = (count[you.roll.item] || 0) + 1;
      st.t = 1;
    }
    const tot = Object.values(count).reduce((a, b) => a + b, 0);
    return Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / tot]));
  };
  // 2,000 rolls at places 2, 7 and 15: each share within 3 points of its row; only places 11 to 20 roll a Warm glow
  const front = roll(2), mid = roll(7), back = roll(15);
  const rows = [[front, { shield: 0.4, goo: 0.35, spark: 0.25 }], [mid, { spark: 0.35, rush: 0.3, shield: 0.25, goo: 0.1 }],
    [back, { rush: 0.4, glow: 0.3, spark: 0.3 }]];
  for (const [got, want] of rows) {
    assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort());
    for (const [k, v] of Object.entries(want)) near(got[k], v, 0.03, k);
  }
});

await check("a Spark homes on the nearest sperm ahead and spins it out (×0.3 for 0.8 s); a Shield takes one hit", () => {
  const shoot = (shield) => {
    const st = lone(4, { p: 2500, speed: 60 });
    const r = st.rivals[0];
    Object.assign(r, { out: false, outT: null, rest: null, attached: null, zone: "tube", p: 2560, x: st.xc + 12, speed: 50, ang: Math.PI / 2, vang: Math.PI / 2 });
    if (shield) r.shieldUntil = st.t + 8;
    st.you.item = "spark";
    st.you.wrate = 0;
    swim.step(st, it(stickAlong(st, 0), { presses: [{ t: st.t, raw: st.t }] }));
    assert.equal(st.sparks.length, 1);
    assert.equal(st.sparks[0].target, r, "it homes on the sperm ahead");
    let hitAt = null;
    for (let i = 0; i < 120 && hitAt === null; i++) { swim.step(st, it(stickAlong(st, 0))); if (r.spins || (shield && r.shieldUntil < 0)) hitAt = st.t; }
    return { st, r, hitAt };
  };
  const a = shoot(false);
  assert.ok(a.hitAt !== null, "the spark hits");
  assert.equal(a.r.slowK, TUNE.SPIN_K);
  near(a.r.slowUntil - a.hitAt, TUNE.SPIN_S, 0.02, "the spin-out");
  assert.equal(a.st.you.hits, 1, "your trick counts");
  const b = shoot(true);
  assert.ok(b.hitAt !== null, "the shield takes it");
  assert.equal(b.r.spins, 0, "no spin through a shield");
});

await check("Goo: dropped behind you; a sperm that swims into it slips (×0.4 for 0.6 s) and it is gone", () => {
  const st = lone(5, { p: 2500, speed: 60 });
  const r = st.rivals[1];
  Object.assign(r, { out: false, outT: null, rest: null, attached: null, zone: "tube", p: 2470, x: st.xc, speed: 70, ang: Math.PI / 2, vang: Math.PI / 2 });
  st.you.item = "goo";
  st.you.wrate = 0;
  swim.step(st, it(stickAlong(st, 0), { presses: [{ t: st.t, raw: st.t }] }));
  assert.equal(st.goos.length, 1);
  assert.ok(st.goos[0].p < st.you.p - 5, "behind you");
  for (let i = 0; i < 90 && !r.spins; i++) swim.step(st, it(stickAlong(st, 0)));
  assert.equal(r.spins, 1);
  assert.equal(r.slowK, TUNE.GOO_K);
  assert.equal(st.goos.length, 0);
  assert.equal(st.you.gooHits, 1);
});

await check("a Warm glow makes you ready at once ('Now you are ready.'), sperm.glow 1; when ready already it is a Rush", () => {
  const st = lone(6, { p: 2500, speed: 60 });
  st.you.item = "glow"; st.you.wrate = 0;
  swim.step(st, it(stickAlong(st, 0), { presses: [{ t: st.t, raw: st.t }] }));
  assert.equal(st.you.ready, true);
  assert.equal(st.you.readyHow, "item");
  assert.equal(swim.result(st).carryOut.sperm.glow, 1);
  st.you.item = "glow";
  swim.step(st, it(stickAlong(st, 0), { presses: [{ t: st.t, raw: st.t }] }));
  assert.ok(st.you.boosts.some((b) => b.v === 40), "a second one is a Rush");
});

await check("slipstream: behind a rival for 0.5 s gives +10 u/s; pulling out after 1.0 s gives the slingshot (+20 u/s, 0.6 s)", () => {
  const st = lone(7, { p: 2500, speed: 60 });
  const r = st.rivals[2];
  Object.assign(r, { out: false, outT: null, rest: null, attached: null, zone: "tube", p: 2518, x: st.xc, speed: 60, ang: Math.PI / 2, vang: Math.PI / 2, skill: 0.55, m: 0.73 });
  let onAt = null;
  for (let i = 0; i < 80; i++) {
    r.p = st.you.p + 18; r.x = st.you.x; r.speed = 60; r.ang = r.vang = st.you.ang;
    swim.step(st, it(stickAlong(st, 0)));
    if (st.you.slipOn && onAt === null) onAt = i * DT;
  }
  near(onAt, TUNE.SLIP_AFTER_S, 0.05, "the slipstream after");
  const n = st.you.boosts.length;
  r.x = st.you.x + 20;   // pull out
  swim.step(st, it(stickAlong(st, 0)));
  assert.equal(st.you.slings, 1);
  assert.ok(st.you.boosts.slice(n).some((b) => b.v === 20 && b.dur === 0.6));
});

await check("white cells drift across the womb; touching one spins you out unless a shield takes it", () => {
  const st = swim.create(8, DEFAULT_CARRY, OPTS);
  assert.equal(st.cells.length, 4);
  swim.step(st, makeIntents());
  const c = st.cells[0], you = st.you;
  for (const r of st.rivals) { r.out = true; r.outT = -1; r.rest = -10; r.attached = "rest"; }
  you.p = c.p; you.x = c.x; you.speed = 30;
  swim.step(st, makeIntents());
  assert.equal(you.spins, 1);
  you.cellSafe = -1; you.shieldUntil = st.t + 5; you.slowUntil = -1;
  you.p = st.cells[0].p; you.x = st.cells[0].x;
  swim.step(st, makeIntents());
  assert.equal(you.spins, 1, "the shield took it");
  assert.ok(you.shieldUntil < 0);
});

// ---------------------------------------------------------------- gates, tide, finish

await check("gates close at their quota or their time; every sperm behind rests; the racing count drops", () => {
  for (const r of [...RACES.ref, ...RACES.mid]) {
    const st = r.st;
    st.gates.forEach((g, i) => {
      if (!g.closed) return;
      assert.ok(g.n >= g.quota || Math.abs(g.closedAt - g.at) < 0.02, `gate ${i + 1} closed at ${g.closedAt} with ${g.n}`);
      for (const sp of st.all) if (!sp.passed[i]) assert.ok(sp.out, `sperm ${sp.id} behind gate ${i + 1} rests`);
      const ev = r.evs.find((e) => e.name === "gate" && e.n === i + 1);
      assert.ok(ev, "a gate event");
    });
    const races = r.evs.filter((e) => e.name === "race").map((e) => e.racing);
    for (let i = 1; i < races.length; i++) assert.ok(races[i] <= races[i - 1], "racing never rises");
  }
  // at least one gate closes in every ref and mid race, and the caption says the way closes
  assert.ok(RACES.mid.every((r) => r.st.gates[0].closed));
  assert.ok(RACES.mid.every((r) => r.evs.some((e) => e.name === "sfx" && e.id === "egg.fifth")), "a low chord as a gate closes");
});

await check("once the third reaches the meeting place every sperm still racing rests; you in the top 3 meet the egg", () => {
  for (const r of RACES.ref) {
    const st = r.st;
    if (st.arrived >= 3) for (const sp of st.all) assert.ok(sp.arrived || sp.out, `sperm ${sp.id}`);
    assert.equal(r.res.goalMet, r.res.metrics.place <= 3);
  }
  // a mid race that ends outside the top 3 is an out (the third came first): the Almost card's data
  for (const r of RACES.mid.filter((x) => !x.res.goalMet)) {
    assert.equal(r.res.metrics.capped, true);
    assert.ok(r.res.metrics.place > 3);
  }
});

await check("every race ends by its cap; meet and carried never past 120 s; the stage ends with done", () => {
  for (const r of [...RACES.ref, ...RACES.mid, ...RACES.idle]) {
    assert.ok(r.st.t <= 120, `${r.st.t}`);
    assert.ok(r.evs.some((e) => e.name === "done"));
  }
  // a swimmer that wanders: no input past the start but a little stick keeps it in the race until the cap or out
  const st = swim.create(9, DEFAULT_CARRY, OPTS);
  const r = play(9, { st, input: () => it({ x: 0.3, y: 0.3 }) });
  assert.ok(r.st.t <= 120);
  assert.equal(r.res.done, true);
});

// ---------------------------------------------------------------- v1 rules kept

await check("bumps: pushed apart; 0.7 of the speed at most once per 0.4 s; top speed back after 0.6 s; a shield takes one", () => {
  const st = lone(10, { p: 2500, speed: 50 });
  const r = st.rivals[3];
  Object.assign(r, { out: false, outT: null, rest: null, attached: null, zone: "tube", p: 2502, x: st.xc + 1, speed: 50, mag: 1, ang: Math.PI / 2, vang: Math.PI / 2 });
  st.you.mag = 1;
  swim.step(st, it(stickAlong(st, 0)));
  assert.equal(st.you.bumps, 1);
  assert.ok(Math.hypot(st.you.x - r.x, st.you.p - r.p) >= 2 * TUNE.HEAD_R - 1e-6, "pushed apart");
  r.p = st.you.p + 1; r.x = st.you.x;
  swim.step(st, it(stickAlong(st, 0)));
  assert.equal(st.you.bumps, 1, "not again within 0.4 s");
  const s2 = lone(10, { p: 2500, speed: 50 });
  const q = s2.rivals[3];
  Object.assign(q, { out: false, outT: null, rest: null, attached: null, zone: "tube", p: 2502, x: s2.xc + 1, speed: 50, mag: 1, ang: Math.PI / 2, vang: Math.PI / 2 });
  s2.you.mag = 1; s2.you.shieldUntil = s2.t + 8;
  swim.step(s2, it(stickAlong(s2, 0)));
  assert.equal(s2.you.bumps, 0, "the shield took the bump");
  assert.ok(s2.you.shieldUntil < 0);
});

await check("the cool loop brings you back to the fork at 1,300 u within 6 s, also with no input", () => {
  const st = swim.create(11, DEFAULT_CARRY, OPTS);
  swim.jump(st, "fork");
  st.you.x = -st.warm * 25; st.you.p = 1325; st.you.speed = 40; st.you.ang = st.you.vang = Math.PI / 2;
  swim.step(st, it({ x: 0, y: 1 }));
  for (let i = 0; i < 30 && st.you.zone !== "loop"; i++) swim.step(st, it({ x: 0, y: 1 }));
  assert.equal(st.you.zone, "loop");
  let n = 0;
  while (st.you.zone === "loop" && n < 600) { swim.step(st, makeIntents()); n++; assert.equal(st.moment, "fork"); }
  assert.ok(n * DT <= 6, `${(n * DT).toFixed(2)} s`);
  assert.equal(st.you.p, TUNE.FORK);
});

await check("the waves lift only a sperm that swims with them (stick ≥ 0.3 within 45° of forward)", () => {
  const st = swim.create(12, DEFAULT_CARRY, OPTS);
  let lifted = 0;
  for (let i = 0; i < 400; i++) { swim.step(st, makeIntents()); if (st.you.lifted) lifted++; }
  assert.equal(lifted, 0, "idle is never lifted");
  const r = RACES.ref[0];
  assert.ok(r.res.metrics.waves > 0, "the ref rides waves");
});

await check("glow walls: letting go inside one attaches; ready on her 4th beat; a stick ≥ 0.25 detaches; ready ×1.6", () => {
  const st = lone(13, { p: 1690, speed: 10 });
  const g = { x: st.xc - TUNE.TUBE_HALF + 6, p: 1700 };
  st.you.x = g.x; st.you.p = g.p;
  swim.step(st, makeIntents());
  assert.equal(st.you.attached, "glow");
  let n = 0;
  while (!st.you.ready && n < 600) { swim.step(st, makeIntents()); n++; }
  assert.equal(st.you.ready, true);
  assert.equal(st.you.readyHow, "glow");
  assert.ok(n * DT <= 4 * 60 / 72 * 1.1 + 0.1, `${(n * DT).toFixed(2)} s`);
  swim.step(st, it(stickAlong(st, 0, 0.5)));
  assert.equal(st.you.attached, null, "detached");
  for (let i = 0; i < 120; i++) swim.step(st, it(stickAlong(st, 0)));
  assert.ok(st.you.speed > TUNE.SWIM * 1.3, `ready speed ${st.you.speed.toFixed(1)}`);
});

await check("among the rivals only the two front-runners rest on a glow wall", () => {
  for (const r of RACES.ref) for (const sp of r.st.rivals) if (sp.readyHow === "glow") assert.ok(sp.id < TUNE.FRONT, `rival ${sp.id}`);
});

await check("botSteer keeps its memory only in r.mem, returns { steer, dir, hold, dash } with a world stick", () => {
  const st = swim.create(14, DEFAULT_CARRY, OPTS);
  const r = stream(14, "t");
  r.mem = {};
  for (let i = 0; i < 60 * 25; i++) {
    const before = JSON.stringify(swim.probe(st));
    const a = swim.botSteer(st, 0.8, r);
    assert.equal(JSON.stringify(swim.probe(st)), before, "botSteer never changes the state");
    assert.deepEqual(Object.keys(a).sort(), ["dash", "dir", "hold", "steer"]);
    assert.ok(Math.hypot(a.steer.x, a.steer.y) <= 1);
    swim.step(st, makeIntents({ steer: a.steer, touching: true }));
    st.events.length = 0;
  }
  assert.ok(Object.keys(r.mem).length > 0);
  assert.deepEqual(swim.botSteer(null, 1, r).steer, { x: 0, y: 0 });
});

await check("probe gives the race shape: place, racing, gates, tide, tags, you and the rivals in world units", () => {
  const p = swim.probe(RACES.mid[0].st);
  for (const k of ["place", "placeNow", "of", "racing", "gates", "tide", "you", "rivals", "camera"]) assert.ok(k in p, k);
  assert.equal(p.rivals.length, 19);
  assert.ok(["arrived", "out", "rest", "swim"].includes(p.rivals[0].state));
});

await check("the carry: your tint in, your place and glow out; Assist still lets the ref bot place 1st", () => {
  const carry = mergeCarry(DEFAULT_CARRY, { sperm: { hue: 0.11 } });
  const r = play(3, { skill: 1, carry });
  assert.equal(r.res.carryOut.sperm.hue, carry.sperm.hue);
  assert.equal(r.res.carryOut.sperm.place, r.res.metrics.place);
  assert.ok([0.5, 1].includes(r.res.carryOut.sperm.glow));
  const a = play(3, { skill: 1, opts: { ...OPTS, assist: true } });
  assert.equal(a.res.metrics.place, 1);
  assert.deepEqual(a.st.gates.map((g) => g.quota), [...TUNE.ASSIST_QUOTAS], "Assist quotas");
});

await check("her beats start at motherPhase at 72 bpm; gaDay stays 14, before fertilization", () => {
  const st = swim.create(1, DEFAULT_CARRY, { ...OPTS, motherPhase: 0.37 });
  near(st.beats.mother[0], 0.37, 1e-12, "her first beat");
  assert.equal(st.gaDay, 14);
  assert.equal(st.fertilized, false);
});

// ---------------------------------------------------------------- facts, strings and tone

const RACE_TEXT = /\b(fastest|winner|win|wins|won|eliminated)\b|\bbeats? the\b/i;
const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter(Boolean);
const words = (t) => t.split(/\s+/).filter(Boolean).length;

await check("the facts: allow-listed sources, access R or A, Week 2, the new swim.acid, swim.cells and swim.mucus", () => {
  const ids = FACTS.map((f) => f.id);
  for (const id of ["swim.acid", "swim.cells", "swim.mucus"]) assert.ok(ids.includes(id), id);
  for (const f of FACTS) {
    assert.equal(f.stage, "swim");
    assert.equal(f.gaDay, 14);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.ok(f.src.length > 0 && f.src.every((k) => SOURCES[k]), `${f.id}: ${f.src.join(", ")}`);
    assert.ok(["card", "caption", "overlay", "end", "result"].includes(f.where));
    for (const s of sentences(f.text)) assert.ok(words(s) <= 16, `${f.id}: "${s}"`);
  }
  assert.equal(FACTS.find((f) => f.id === "swim.wait").where, "overlay");
  assert.equal(FACTS.find((f) => f.id === "swim.frame").where, "result");
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
      if (e.name === "prompt" && e.text) { used.add(e.text); if (/^swim\.prompt/.test(e.text)) { used.add(e.text + ".keys"); used.add(e.text + ".one"); } }
      if (e.name === "subgoal" || e.name === "caption") used.add(e.text || e.id);
      if (e.name === "race" && e.item) used.add("swim.item." + e.item);
    }
    for (const p of r.res.parts) used.add(p.label);
  }
  for (const id of ["swim.carried", "swim.tag.racing", "swim.tag.gate", "swim.tag.rolling", "swim.promptDrift", "swim.promptItem"]) used.add(id);
  for (const id of used) assert.notEqual(say(id), id, `${id} is registered`);
  for (const text of [...Object.values(TEXT), ...FACTS.map((f) => f.text)]) {
    for (const carer of ["mother", "parent"]) {
      const t = text.replace(/\{carer\}/g, "your " + carer).replace(/\{Carer\}/g, "Your " + carer);
      assert.ok(!BANNED.test(t), `banned word in "${t}"`);
      assert.ok(!PRONOUNS.test(t), `pronoun in "${t}"`);
      assert.ok(!RACE_TEXT.test(t), `race boast in "${t}"`);
      assert.ok(!t.includes("—"), `an em dash in "${t}"`);
    }
    for (const s of sentences(text)) assert.ok(words(s) <= 16, `"${s}"`);
  }
  for (const r of [...RACES.ref, ...RACES.idle]) for (const e of r.evs) {
    assert.ok(!BANNED.test(e.name), e.name);
    for (const v of Object.values(e)) if (typeof v === "string") assert.ok(!BANNED.test(v), `${e.name}: ${v}`);
  }
});

await check("the points events add up to the score, and the parts add up to the total", () => {
  for (const r of [...RACES.ref.slice(0, 4), ...RACES.mid.slice(0, 4), ...RACES.idle.slice(0, 2)]) {
    const sum = { goal: 0, skill: 0, flourish: 0 };
    for (const e of r.evs.filter((x) => x.name === "points")) { assert.ok(e.add > 0); sum[e.part] += e.add; }
    assert.deepEqual(sum, { goal: r.res.score.goal, skill: r.res.score.skill, flourish: r.res.score.flourish }, `seed ${r.seed}`);
    const parts = r.res.parts.reduce((a, p) => a + p.value, 0);
    assert.ok(Math.abs(parts - r.res.score.total) <= 4, `parts ${parts} vs total ${r.res.score.total}`);
  }
  const ref = RACES.ref[0].res;
  assert.equal(ref.score.goal, 3000);
  assert.equal(ref.score.flourish, 1000, "1st place");
  assert.deepEqual(ref.parts.map((p) => p.max), [3000, 2000, 1500, 1000, 750, 750, 1000]);
});

await check("no step throws and no fault is kept, also for odd input", () => {
  const st = swim.create(8, DEFAULT_CARRY, OPTS);
  const odd = [null, undefined, {}, makeIntents({ steer: { x: NaN, y: 1 } }), { steer: { x: 5, y: -9 } }, { steer: null },
    { presses: [{ t: NaN }, null], releases: "x" }, makeIntents({ steer: { x: 1, y: 0 }, presses: [{ t: 0.2, raw: 0.2 }] })];
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
  console.log(`PASS ${FILE}: ${passed} checks (${SEEDS.length} seeds for the race gates)`);
}
