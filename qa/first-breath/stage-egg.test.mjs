// First Breath: stage 2, The Egg (`egg`) (design.md 6.2, 4.1, 5.2 to 5.4, 7, 15, 16.4, 18; tasks 2.6 to 2.10). The
// same seed and input give the same run; the scripted ideal input reaches Glowing; idle ends by the cap with the goal
// met; the shared bot at 0.7 completes (and at 1.0 glows); one live gesture per moment; every sub-goal ends done or
// auto; every target carries P and is drawn its preview before; the moments match 4.1; every view is valid. Guard
// checks: the surge before any target, the first payoff by 4.5 s, the opening by 8.9 s for any input; the arc over
// each kind of sperm (bounce, pop loose, nudge, left alone), also when it sweeps onto one; held rivals never enter;
// exactly one enter for every input; the gold's time for places 1, 3 and 20; a gold angle always found; at most 3
// nudges and entry by 52 s; the seal's fresh press, grades, Flourish and auto seal; the drift after the seal; the
// guard credit rules; the ref bot with 0 nudges; the turn-keys bot reaching Great; botSteer's memory in r.mem; probe;
// the facts, sources and strings.
// node qa/first-breath/stage-egg.test.mjs
import assert from "node:assert/strict";
import * as egg from "../../public/first-breath/core/stages/egg.js";
import { TUNE } from "../../public/first-breath/core/stages/egg.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/egg.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/egg.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate, LIMITS } from "../../public/first-breath/core/draw.js";
import { DT, label } from "../../public/first-breath/core/clock.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { check as checkTargets, previewS } from "../../public/first-breath/core/lib/track.js";
import { wrapAngle } from "../../public/first-breath/core/lib/goals.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { say } from "../../public/first-breath/core/text.js";
import { label as factLabel, byId } from "../../public/first-breath/core/facts.js";
import { stream } from "../../public/first-breath/core/rng.js";

const FILE = "qa/first-breath/stage-egg.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 10).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const PB = 60 / 72;
const RAD = Math.PI / 180;
const PHASES = [0, 0.19, 0.2, 0.5, 0.83];
const MAX_STEPS = Math.ceil((egg.meta.capS + 2) / DT);
const angDist = (a, b) => Math.abs(wrapAngle(a - b));
const carryAt = (place) => mergeCarry(DEFAULT_CARRY, { sperm: { place } });
const named = (evs, n) => evs.filter((e) => e.name === n);
const aimAt = (a, extra = {}) => makeIntents({ aim: { x: 50 * Math.cos(a), y: 50 * Math.sin(a) }, ...extra });

// ---- drivers: each returns the intents for the step [st.t, st.t + DT) ----

const idle = () => () => makeIntents();

// Every tap exactly on its time; the arc from botSteer at skill 1 (or by the turn keys only); the seal pressed on the
// first step after its prompt and released exactly on its target.
function ideal({ turnOnly = false, sealErr = 0 } = {}) {
  const mem = { tapped: {}, pressed: false, released: false, lift: [] };
  const r = stream(99, "ideal");
  r.mem = {};
  return (st) => {
    const t0 = st.t, t1 = t0 + DT;
    const presses = [], releases = [];
    for (const x of egg.targets(st, 3)) {
      if (x.kind === "tap" && !mem.tapped[x.id] && x.t < t1) {
        mem.tapped[x.id] = true;
        const at = Math.max(x.t, t0);
        presses.push({ t: at, raw: at });
        mem.lift.push(at + 0.08);
      }
      if (x.kind === "release" && egg.prompt(st).gesture === "hold") {
        if (!mem.pressed) { mem.pressed = true; presses.push({ t: t0, raw: t0 }); }
        const at = x.t + sealErr;
        if (!mem.released && at < t1) { mem.released = true; releases.push({ t: Math.max(at, t0), raw: Math.max(at, t0) }); }
      }
    }
    mem.lift = mem.lift.filter((l) => { if (l < t1) { releases.push({ t: l, raw: l }); return false; } return true; });
    let steer = { x: 0, y: 0 }, turn = 0;
    if (st.moment === "guard") {
      const s = egg.botSteer(st, 1, r).steer;
      if (!turnOnly) steer = s;
      else if (Math.hypot(s.x, s.y) > 0.5) {
        const d = wrapAngle(Math.atan2(s.y, s.x) - egg.probe(st).arc.angle);
        turn = Math.abs(d) < 5 * RAD ? 0 : d > 0 ? -1 : 1;
      }
    }
    return makeIntents({ presses, releases, steer, turn, touching: presses.length > 0 || Math.hypot(steer.x, steer.y) > 0 || turn !== 0 });
  };
}

function botDriver(skill, seed) {
  const bot = createBot(skill, seed);
  return (st) => bot.intents(egg, st);
}

// The shared bot at skill 1 for the taps and the seal, but the arc only through turn ±1 at 540°/s.
function turnBot(seed) {
  const bot = createBot(1, seed);
  const r = stream(seed, "turnBot");
  r.mem = {};
  return (st) => {
    const it = bot.intents(egg, st);
    if (st.moment !== "guard") return it;
    const s = egg.botSteer(st, 1, r).steer;
    let turn = 0;
    if (Math.hypot(s.x, s.y) > 0.5) {
      const d = wrapAngle(Math.atan2(s.y, s.x) - egg.probe(st).arc.angle);
      turn = Math.abs(d) < 5 * RAD ? 0 : d > 0 ? -1 : 1;
    }
    return makeIntents({ ...it, steer: { x: 0, y: 0 }, aim: null, turn });
  };
}

// Random drags, turns, taps and holds (seeded): a stress input.
function randomDriver(seed) {
  const r = stream(seed, "test-random");
  let down = false, ang = 0, turn = 0;
  return (st) => {
    const presses = [], releases = [];
    if (r() < 0.06) { const t = st.t + r() * DT; if (down) releases.push({ t, raw: t }); else presses.push({ t, raw: t }); down = !down; }
    if (r() < 0.04) ang = r() * 2 * Math.PI;
    if (r() < 0.03) turn = Math.floor(r() * 3) - 1;
    return makeIntents({ presses, releases, touching: down, steer: { x: Math.cos(ang), y: Math.sin(ang) }, turn });
  };
}

// The arc held on your sperm the whole time it is out (through the mouse aim).
function holdOnGold() {
  return (st) => {
    const g = egg.probe(st).gold;
    return g && g.state !== "entered" ? aimAt(g.angle) : makeIntents();
  };
}

// A scripted list of { t, up } events (stage seconds), each delivered in its step.
function script(list, base = () => makeIntents()) {
  const evs = list.slice().sort((a, b) => a.t - b.t);
  return (st) => {
    const t0 = st.t, t1 = t0 + DT;
    const it = base(st);
    for (const e of evs) if (e.t >= t0 && e.t < t1) (e.up ? it.releases : it.presses).push({ t: e.t, raw: e.t });
    return it;
  };
}

// Play one stage to its end. `each(st, i)` sees the state after each step.
function play({ seed = 1, phase = 0, place = 3, drive = idle(), assist = false, opts = {}, each = null, viewsEvery = 0, jumpTo = null } = {}) {
  const st = egg.create(seed, carryAt(place), { assist, oneButton: false, motherPhase: phase, ...opts });
  if (jumpTo) egg.jump(st, jumpTo);
  const evs = st.events.splice(0);
  const gestures = {};
  const note = () => { (gestures[st.moment] = gestures[st.moment] || new Set()).add(egg.prompt(st).gesture); };
  note();
  const views = [];
  let i = 0;
  for (; i < MAX_STEPS && !egg.result(st).done; i++) {
    if (viewsEvery && i % viewsEvery === 0) views.push({ t: st.t, moment: st.moment, v: egg.view(st) });
    egg.step(st, drive(st));
    for (const e of st.events) evs.push(e);
    st.events.length = 0;
    if (!egg.result(st).done) note();
    if (each) each(st, i);
  }
  return { st, evs, gestures, views, res: egg.result(st), steps: i };
}

const momentAt = (evs, id) => { const e = evs.find((x) => x.name === "moment" && x.id === id); return e ? e.t : null; };

// A guard with nothing in it: no waves, no gold (white-box set-up for the arc checks).
function quietGuard(seed = 1, opts = {}) {
  const st = egg.create(seed, DEFAULT_CARRY, { motherPhase: 0, ...opts });
  egg.jump(st, "guard");
  st.guard.si = st.guard.plan.length;
  st.guard.goldAt = Infinity;
  st.events.length = 0;
  return st;
}
function addRival(st, { theta, r, state = "in", p = 0, v = 10 }) {
  const G = st.guard;
  const rv = { id: "r" + G.nextId++, wave: 1, state, theta, r, v, born: st.t, p, hk: state === "held" ? 1 : 0,
    near: r <= 22 ? st.t : null, settle: null, credit: null, x: r * Math.cos(theta), y: r * Math.sin(theta), vx: 0, vy: 0, gone: false };
  if (state === "bounce" || state === "loose") { rv.vx = 10 * Math.cos(theta); rv.vy = 10 * Math.sin(theta); rv.near = st.t; }
  if (state === "bounce") { rv.settle = st.t; rv.credit = 1; }
  if (state === "loose") { rv.settle = st.t; rv.credit = 0.5; }
  if (state === "held") { rv.settle = st.t; rv.credit = 0; rv.near = st.t; }
  G.rivals.push(rv);
  return rv;
}
function stepN(st, n, it) {
  const evs = [];
  for (let k = 0; k < n && !egg.result(st).done; k++) {
    egg.step(st, typeof it === "function" ? it(st) : it || makeIntents());
    evs.push(...st.events);
    st.events.length = 0;
  }
  return evs;
}

// ---- meta and the clock ----

await check("meta: the 4.1 moments (all at gaDay 14), the 3.1 row, three families and the Stage interface", () => {
  const m = egg.meta;
  assert.deepEqual(m.moments.map((x) => x.id), ["surge", "open", "sweep", "guard", "enter", "seal", "fusion", "outro"]);
  for (const x of m.moments) { assert.deepEqual([...x.ga], [14, 14], x.id); assert.equal(x.lenS, null, x.id); }
  assert.deepEqual([...m.families], ["tap", "rotate", "hold"]);
  assert.deepEqual([m.id, m.index, m.name, m.verb, m.orient, m.motherBpm, m.capS, m.parS, m.canFail, m.scored, m.fertilized],
    ["egg", 1, "The Egg", "Guard", "long", 72, 80, 53, false, true, false]);
  assert.deepEqual({ ...m.ga }, { start: 14, end: 14 });
  assert.deepEqual({ ...m.mm }, { start: 0.4, end: 0.4 });
  for (const f of ["create", "step", "view", "prompt", "targets", "botSteer", "probe", "result", "jump"]) assert.equal(typeof egg[f], "function", f);
});

await check("the clock: gaDay 14 throughout; Week 2 until the nuclei touch at the end of fusion, then Day 0", () => {
  const { st, evs } = play({ drive: ideal(), each: (s) => {
    assert.equal(s.gaDay, 14);
    if (s.moment !== "outro" && !egg.result(s).done) assert.equal(s.fertilized, s.moment === "outro", `${s.moment} at ${s.t.toFixed(2)}`);
  } });
  const fusionEnd = momentAt(evs, "outro");
  const ms = named(evs, "milestone");
  assert.deepEqual(ms.map((e) => e.id), ["fertilized"]);
  near(ms[0].t, fusionEnd, 1e-9, "fertilized as fusion ends");
  near(fusionEnd - momentAt(evs, "fusion"), TUNE.fusion.s, 1e-9, "fusion lasts 5 s");
  assert.equal(st.fertilized, true);
  assert.equal(label(st.gaDay, { fertilized: false }), "Week 2");
  assert.equal(label(st.gaDay, { fertilized: true }), "Day 0 after fertilization (week 2)");
});

await check("lengths: ref about 51 to 54 s, idle about 56 to 64 s, all well under the 80 s cap", () => {
  for (const phase of [0, 0.5]) {
    const ref1 = play({ phase, place: 1, drive: ideal() }).st.t;
    const mid3 = play({ phase, place: 3, drive: botDriver(0.7, 3) }).st.t;
    const idle3 = play({ phase, place: 3 }).st.t;
    const idle20 = play({ phase, place: 20 }).st.t;
    assert.ok(ref1 >= 50 && ref1 <= 54, `ref ${ref1.toFixed(2)}`);
    assert.ok(mid3 >= 50 && mid3 <= 56, `mid ${mid3.toFixed(2)}`);
    assert.ok(idle3 >= 55 && idle3 <= 60, `idle place 3 ${idle3.toFixed(2)}`);
    assert.ok(idle20 >= 60 && idle20 <= 65, `idle place 20 ${idle20.toFixed(2)}`);
  }
});

// ---- the opening ----

await check("the opening: beat 1 between 0.2 and 1.03 s, the surge on beats 1 and 2 before any target, taps on beats 3 to 8", () => {
  for (const phase of PHASES) {
    const st = egg.create(5, DEFAULT_CARRY, { motherPhase: phase });
    const all = egg.targets(st, 99);
    assert.deepEqual(checkTargets(all), [], "sorted, P ≥ 0.5 s, spaced ≥ 0.5 s");
    assert.equal(all.length, 6);
    assert.ok(st.ob[0] >= 0.2 - 1e-9 && st.ob[0] < 0.2 + PB, `beat 1 at ${st.ob[0]}`);
    assert.deepEqual(all.map((x) => x.t), st.ob.slice(2, 8), "on her laid beats 3 to 8");
    for (let k = 1; k < 8; k++) near(st.ob[k] - st.ob[k - 1], PB, 1e-9, "72 bpm, no jitter");
    for (const x of all) { near(x.P, PB, 1e-9, "P"); assert.equal(x.kind, "tap"); assert.equal(x.heart, "mother"); assert.equal(x.group, "open"); }
    const { evs } = play({ phase });
    const openAt = momentAt(evs, "open");
    near(openAt, st.ob[1], 1e-9, "the surge is beats 1 and 2");
    assert.ok(all[0].t > openAt, "the surge comes before any target");
    assert.equal(named(evs, "sfx").filter((e) => e.id === "egg.surge").length, 2, "a gold wash on each surge beat");
    assert.ok(all[0].t <= 2.7 + 1e-9, "the first target by 2.7 s");
  }
});

await check("the first payoff by 4.5 s: three good taps burst the follicle on beat 5, and the open beats after it carry no targets", () => {
  for (const phase of PHASES) {
    const { st, evs, res } = play({ phase, drive: ideal() });
    const bursts = named(evs, "sfx").filter((e) => e.id === "egg.burst");
    assert.equal(bursts.length, 1);
    near(res.metrics.burstAt, st.ob[4], 1e-9, "on beat 5");
    assert.ok(res.metrics.burstAt <= 4.5, `burst at ${res.metrics.burstAt}`);
    assert.equal(res.metrics.burst, "you");
    assert.equal(res.metrics.openTargets, 3, "only the three taps were presented");
    assert.equal(res.metrics.openAcc, 1);
    assert.equal(named(evs, "judge").filter((e) => e.target.startsWith("open.")).length, 3);
    assert.equal(st.subgoals.open, "done");
  }
});

await check("the opening ends by 8.9 s for any input; with fewer than 3 good taps it opens anyway on beat 8", () => {
  const drives = [() => idle(), () => ideal(), () => randomDriver(4), () => botDriver(0.4, 2), () => botDriver(0.7, 9)];
  for (const phase of PHASES) {
    for (const mk of drives) {
      const { evs } = play({ phase, drive: mk() });
      const g = momentAt(evs, "guard");
      assert.ok(g !== null && g <= 8.9, `guard prompt at ${g}`);
      near(g - momentAt(evs, "sweep"), TUNE.opening.sweepS, 1e-9, "the sweep lasts 2 s");
    }
    // two good taps (beats 3 and 4), then nothing: it opens by itself on beat 8, "It opens anyway."
    const st0 = egg.create(1, DEFAULT_CARRY, { motherPhase: phase });
    const { st, evs, res } = play({ phase, drive: script([{ t: st0.ob[2] }, { t: st0.ob[3] }]) });
    near(res.metrics.burstAt, st.ob[7], 1e-9, "on beat 8");
    assert.equal(res.metrics.burst, "auto");
    assert.equal(st.subgoals.open, "auto");
    assert.ok(named(evs, "subgoal").some((e) => e.id === "open" && e.state === "auto" && e.text === "egg.openAuto"));
    assert.equal(res.metrics.openTargets, 6);
    near(res.metrics.openAcc, 2 / 6, 1e-9, "accuracy over the six presented");
    // a miss, then three good taps: it bursts on beat 6, accuracy 3 of 4
    const late = play({ phase, drive: script([4, 5, 6].map((k) => ({ t: st0.ob[k - 1] }))) });
    near(late.res.metrics.burstAt, st0.ob[5], 1e-9, "on beat 6");
    near(late.res.metrics.openAcc, 3 / 4, 1e-9, "3 of 4");
  }
});

await check("every target is drawn at least max(2 beats, 1.2 s) before its time, and carries P", () => {
  for (const phase of [0, 0.5]) {
    for (const mk of [() => idle(), () => ideal()]) {
      const seen = {}, all = {};
      play({ phase, drive: mk(), each: (s) => {
        for (const x of egg.targets(s, 99)) all[x.id] = x;
        for (const g of egg.view(s).rings) if (g.id.startsWith("t:") && !(g.id.slice(2) in seen)) seen[g.id.slice(2)] = s.t;
      } });
      const st0 = egg.create(1, DEFAULT_CARRY, { motherPhase: phase });
      for (const x of egg.targets(st0, 99)) { all[x.id] = x; for (const g of egg.view(st0).rings) if (g.id === "t:" + x.id) seen[x.id] = 0; }
      for (const x of Object.values(all)) {
        assert.ok(Number.isFinite(x.P) && x.P >= 0.5, `${x.id} P`);
        if (!(x.id in seen)) continue;          // a target taken away at the burst is never drawn
        assert.ok(seen[x.id] <= x.t - previewS(PB) + DT + 1e-9, `${x.id} first drawn at ${seen[x.id].toFixed(3)}, due ${x.t.toFixed(3)}`);
      }
      assert.ok("seal" in seen, "the seal target is drawn");
    }
  }
});

// ---- determinism, the ideal, idle, the bots ----

await check("the same seed and input give the same run (two seeds; idle, the bot, random input, the ideal script)", () => {
  for (const seed of [1, 77]) {
    for (const mk of [() => idle(), () => botDriver(0.7, seed), () => randomDriver(seed), () => ideal()]) {
      const a = play({ seed, phase: 0.3, drive: mk() }), b = play({ seed, phase: 0.3, drive: mk() });
      assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}: the same events`);
      assert.deepEqual(a.res, b.res);
      assert.equal(JSON.stringify(egg.probe(a.st)), JSON.stringify(egg.probe(b.st)));
    }
  }
  const p1 = egg.create(1, DEFAULT_CARRY, {}).guard.plan, p2 = egg.create(2, DEFAULT_CARRY, {}).guard.plan;
  assert.notDeepEqual(p1.map((x) => x.angle), p2.map((x) => x.angle), "another seed, other waves");
});

await check("the scripted ideal input reaches Glowing at every phase and place; every sub-goal is done by you", () => {
  for (const phase of [0, 0.4, 0.8]) {
    for (const place of [1, 3, 20]) {
      const { st, res } = play({ phase, place, drive: ideal() });
      assert.equal(res.done, true);
      assert.equal(res.goalMet, true);
      assert.ok(res.score.total >= 8500, `phase ${phase} place ${place}: ${res.score.total}`);
      assert.equal(gradeOf(res.score.total, true), "Glowing");
      assert.equal(res.score.flourish, 1000);
      assert.equal(res.metrics.sealGrade, "in");
      assert.equal(res.metrics.nudges, 0);
      for (const id of ["open", "guard", "letIn", "seal"]) assert.equal(st.subgoals[id], "done", `${id}`);
    }
  }
});

await check("idle ends by the cap with the goal met: the follicle opens, your sperm enters and the shell seals by themselves", () => {
  for (const place of [1, 3, 20]) {
    const { st, evs, res } = play({ place });
    assert.equal(res.done, true);
    assert.equal(res.goalMet, true);
    assert.ok(st.t <= egg.meta.capS, `${st.t}`);
    assert.equal(st.how, "end");
    assert.deepEqual(res.score, { goal: 3000, skill: 0, flourish: 0, total: 3000 });
    assert.equal(named(evs, "enter").length, 1);
    assert.deepEqual(named(evs, "seal").map((e) => [e.grade, e.auto]), [[null, true]]);
    assert.equal(named(evs, "done").length, 1);
    for (const v of Object.values(st.subgoals)) assert.equal(v, "auto");
    assert.equal(res.metrics.guardCredit, 0);
    assert.ok(res.metrics.held > 10, `${res.metrics.held} held`);
    assert.equal(st.error, null);
  }
});

await check("the shared bot: skill 0.7 completes every one of 20 seeds (Great or better); skill 1.0 glows in every seed", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const mid = play({ seed, phase: (seed * 0.137) % PB, drive: botDriver(0.7, seed) }).res;
    assert.equal(mid.done, true);
    assert.ok(mid.score.total >= 6500, `seed ${seed}: ${mid.score.total}`);
    const ref = play({ seed, phase: (seed * 0.137) % PB, place: 1 + (seed % 3), drive: botDriver(1, seed) }).res;
    assert.ok(ref.score.total >= 8500, `ref seed ${seed}: ${ref.score.total}`);
    assert.equal(ref.metrics.nudges, 0, "the ref bot never nudges your sperm");
  }
});

await check("the ref bot makes 0 nudges over 20 seeds at places 1, 3 and 20; at most 3 nudges for any input", () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const place of [1, 3, 20]) assert.equal(play({ seed, place, drive: botDriver(1, seed) }).res.metrics.nudges, 0, `seed ${seed} place ${place}`);
    for (const mk of [() => randomDriver(seed), () => botDriver(0.4, seed), () => holdOnGold()]) {
      const { evs, res } = play({ seed, drive: mk() });
      assert.ok(res.metrics.nudges <= 3);
      assert.equal(named(evs, "nudge").length, res.metrics.nudges);
    }
  }
});

await check("a bot that aims only through turn ±1 at 540°/s reaches Great in ≥ 18 of 20 seeds, its guard credit within 0.15 of the ref bot's", () => {
  let great = 0, sumT = 0, sumR = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const t = play({ seed, phase: 0.25, drive: turnBot(seed) }).res;
    const r = play({ seed, phase: 0.25, drive: botDriver(1, seed) }).res;
    if (t.score.total >= 6500) great++;
    sumT += t.metrics.guardCredit;
    sumR += r.metrics.guardCredit;
  }
  assert.ok(great >= 18, `${great} of 20 Great`);
  assert.ok(Math.abs(sumT - sumR) / 20 <= 0.15, `turn bot ${(sumT / 20).toFixed(3)} vs ref ${(sumR / 20).toFixed(3)}`);
});

// ---- gestures, sub-goals, views ----

await check("one live gesture per moment (none, tap, none, drag with keys turn, none, hold, none, none), one prompt event each", () => {
  const want = { surge: "none", open: "tap", sweep: "none", guard: "drag", enter: "none", seal: "hold", fusion: "none", outro: "none" };
  for (const mk of [() => idle(), () => ideal(), () => randomDriver(3), () => botDriver(0.7, 3)]) {
    const { gestures, evs } = play({ drive: mk() });
    for (const [m, set] of Object.entries(gestures)) assert.deepEqual([...set], [want[m]], m);
    assert.deepEqual(Object.keys(gestures), Object.keys(want));
    const prompts = named(evs, "prompt");
    assert.deepEqual(prompts.slice(0, 8).map((p) => p.gesture), Object.values(want));
    assert.deepEqual(prompts.slice(0, 8).map((p) => p.keys), ["steer", "steer", "steer", "turn", "steer", "steer", "steer", "steer"]);
    assert.deepEqual(prompts.slice(0, 8).map((p) => p.text), [null, "egg.tap", null, "egg.guard", null, "egg.seal", null, null]);
    const moments = named(evs, "moment");
    for (let k = 0; k < 8; k++) near(prompts[k].t, moments[k].t, 1e-12, "each prompt at its moment's start");
  }
  const st = egg.create(1, DEFAULT_CARRY, {});
  egg.jump(st, "guard");
  assert.deepEqual(egg.prompt(st), { gesture: "drag", text: "egg.guard", keys: "turn" });
});

await check("every sub-goal is shown, then ends done or auto, for every input", () => {
  for (const mk of [() => idle(), () => ideal(), () => randomDriver(8), () => botDriver(0.4, 8), () => holdOnGold()]) {
    const { st, evs } = play({ drive: mk() });
    assert.deepEqual(Object.keys(st.subgoals).sort(), ["guard", "letIn", "open", "seal"]);
    for (const [id, v] of Object.entries(st.subgoals)) {
      assert.ok(v === "done" || v === "auto", `${id}: ${v}`);
      const seq = named(evs, "subgoal").filter((e) => e.id === id).map((e) => e.state);
      assert.deepEqual(seq, ["shown", v], id);
    }
  }
  const nudged = play({ drive: holdOnGold() });
  assert.equal(nudged.st.subgoals.letIn, "auto", "nudged in: it slips in anyway");
});

await check("every view is valid (every step of idle, ideal, bot and random runs), with an anchor, a cue and the limits", () => {
  for (const mk of [() => idle(), () => ideal(), () => botDriver(0.4, 5), () => randomDriver(5), () => holdOnGold()]) {
    const { views } = play({ drive: mk(), viewsEvery: 1 });
    let guardCue = 0;
    for (const { t, moment, v } of views) {
      assert.deepEqual(validate(v), [], `${moment} at ${t.toFixed(2)}`);
      assert.deepEqual(v.anchor, { x: 0, y: 0 });
      assert.equal(v.stage, "egg");
      assert.equal(v.camera.span, 140);
      assert.deepEqual(v.scale, { you: "0.1 mm" });
      assert.ok(v.strips.length <= LIMITS.strips && v.rings.length <= LIMITS.rings && v.marks.length <= LIMITS.marks);
      if (moment === "guard") {
        assert.ok(v.cue, "a cue in the guard");
        near(Math.hypot(v.cue.x, v.cue.y), TUNE.arc.r, 1e-9, "the cue is the arc");
        assert.ok(v.strips.some((s) => s.kind === "arc"), "the arc is drawn");
        guardCue++;
      }
      if (moment === "open") assert.deepEqual(v.cue, { x: 0, y: 0 });
    }
    assert.ok(guardCue > 100);
  }
});

// ---- the guard ----

await check("the arc over a sperm: a swimming rival bounces once its head is within 22 u under the arc, not before", () => {
  const st = quietGuard();
  stepN(st, 20, aimAt(0));
  near(st.guard.arc.a, 0, 1e-9, "the arc faces the aim");
  assert.equal(st.guard.arc.live, true);
  const a = addRival(st, { theta: 20 * RAD, r: 30, v: 10 });
  const b = addRival(st, { theta: 40 * RAD, r: 30, v: 10 });   // outside the 35° half-width
  let evs = [];
  while (a.state === "in") { const r0 = a.r; evs.push(...stepN(st, 1, aimAt(0))); if (a.state === "in") assert.ok(a.r > 22 - 1e-9 || r0 > 22, "no bounce outside 22 u"); }
  assert.equal(a.state, "bounce");
  assert.ok(a.r <= 22 && a.r > 21.5, `bounced at ${a.r}`);
  assert.deepEqual(named(evs, "bounce").map((e) => e.id), [a.id]);
  assert.equal(b.state, "in", "a sperm outside the half-width swims on");
  evs = stepN(st, 420, aimAt(0));
  assert.equal(b.state, "held", "it stuck and was held");
  assert.ok(named(evs, "stick").some((e) => e.id === b.id && e.gold === false && e.wave === 1));
  assert.ok(a.gone || a.r > 22, "the bounced one drifts off");
});

await check("the arc sweeping onto a sperm: a swimming rival bounces, a stuck rival pops loose (0.5)", () => {
  const st = quietGuard();
  stepN(st, 40, aimAt(Math.PI));
  const swim = addRival(st, { theta: 0, r: 18, v: 0.5 });
  const stuck = addRival(st, { theta: Math.PI / 2, r: 11.5, state: "stuck", p: 0.3 });
  let evs = stepN(st, 3, aimAt(Math.PI));
  assert.equal(swim.state, "in");
  assert.equal(stuck.state, "stuck");
  evs = stepN(st, 30, aimAt(Math.PI / 2));
  assert.equal(stuck.state, "loose", "the arc swept onto the stuck one and popped it loose");
  assert.equal(swim.state, "in");
  evs.push(...stepN(st, 30, aimAt(0)));
  assert.equal(swim.state, "bounce", "the arc swept onto the swimming one");
  assert.equal(stuck.credit, 0.5);
  assert.ok(named(evs, "loose").some((e) => e.id === stuck.id));
  assert.ok(named(evs, "bounce").some((e) => e.id === swim.id));
});

await check("held and drifting sperm ignore the arc; a sleeping arc (no input yet) leaves every sperm alone", () => {
  const st = quietGuard();
  stepN(st, 20, aimAt(0));
  const held = addRival(st, { theta: 0, r: 18, state: "held" });
  const drift = addRival(st, { theta: 0.1, r: 15, state: "bounce" });
  const loose = addRival(st, { theta: -0.1, r: 14, state: "loose" });
  const evs = stepN(st, 60, aimAt(0.05));
  assert.equal(held.state, "held");
  assert.equal(drift.state, "bounce");
  assert.equal(loose.state, "loose");
  assert.equal(named(evs, "bounce").length + named(evs, "loose").length + named(evs, "held").length, 0);
  const s2 = quietGuard();
  const a0 = s2.guard.arc.a;
  const under = addRival(s2, { theta: a0, r: 20, v: 10 });
  stepN(s2, 90, makeIntents({ steer: { x: 0.2, y: 0 }, touching: true }));   // a stick under 0.25 leaves it still
  assert.equal(s2.guard.arc.live, false);
  assert.equal(s2.guard.arc.a, a0);
  assert.equal(under.state, "stuck", "asleep, the arc lets it stick");
});

await check("a rival that finishes burrowing is held in the cloud at 18 u and never enters; exactly one enter, for your sperm", () => {
  const st = quietGuard();
  const rv = addRival(st, { theta: 1, r: 11.5, state: "stuck", p: 0.95 });
  const evs = stepN(st, 60);
  assert.equal(rv.state, "held");
  assert.ok(named(evs, "held").some((e) => e.id === rv.id));
  near(rv.r, 18, 1e-9, "out in the cloud");
  for (const mk of [() => idle(), () => botDriver(1, 3), () => randomDriver(3), () => holdOnGold(), () => ideal()]) {
    const { evs: all, st: s } = play({ seed: 3, drive: mk() });
    const enters = named(all, "enter");
    assert.equal(enters.length, 1, "exactly one sperm enters");
    assert.equal(enters[0].angle, named(all, "goldIn")[0].angle, "and it is yours");
    for (const p of egg.probe(s).sperm) assert.ok(p.r >= 11.5 - 1e-9, "no rival ever gets in");
  }
});

await check("goldIn at 27.0, 27.6 and 32.7 s into the guard for places 1, 3 and 20; egg.fuse and Let it in. as it comes", () => {
  for (const [place, at] of [[1, 27], [3, 27.6], [20, 32.7]]) {
    for (const mk of [() => idle(), () => botDriver(1, 4)]) {
      const { evs, res } = play({ seed: 4, place, drive: mk() });
      const gold = named(evs, "goldIn");
      assert.equal(gold.length, 1);
      near(gold[0].t - momentAt(evs, "guard"), at, 1e-9, `place ${place}`);
      near(res.metrics.goldIn, at, 1e-9, "metrics");
      assert.ok(named(evs, "fact").some((e) => e.id === "egg.fuse" && Math.abs(e.t - gold[0].t) < 1e-9));
      assert.ok(named(evs, "subgoal").some((e) => e.id === "letIn" && e.state === "shown" && e.text === "egg.letIn"));
    }
  }
  // idle: it swims in at 14 u/s (4.5 s), sticks, burrows 3.0 s and enters about 7.5 s after it came in
  const { evs } = play({ seed: 4, place: 1 });
  const g = named(evs, "goldIn")[0].t, s = named(evs, "stick").find((e) => e.gold).t, e = named(evs, "enter")[0].t;
  near(s - g, 63.5 / 14, 2 * DT, "sticks after 4.5 s");
  near(e - s, 3.0, 2 * DT, "burrows for 3.0 s");
  // egg.stick has no room to show whole while egg.fuse reads (design.md 6.2, 12): a "What was real" fact
  assert.ok(!named(evs, "fact").some((f) => f.id === "egg.stick"), "no egg.stick caption");
});

await check("a gold angle is always found: never within 45° of world −y or 40° of world +y, never closer than 65° (80° Assist) to the arc", () => {
  let runs = 0;
  for (let seed = 1; seed <= 20; seed++) {
    // no input
    const { evs } = play({ seed });
    const a = named(evs, "goldIn")[0].angle;
    assert.ok(angDist(a, -Math.PI / 2) > 45 * RAD && angDist(a, Math.PI / 2) > 40 * RAD, `seed ${seed}: ${a / RAD}°`);
    // the arc parked at every 5° (awake, so it bounces what comes under it)
    for (let deg = 0; deg < 360; deg += 5) {
      const park = wrapAngle(deg * RAD);
      for (const assist of seed <= 2 ? [false, true] : [false]) {
        const st = egg.create(seed, DEFAULT_CARRY, { motherPhase: 0, assist });
        egg.jump(st, "guard");
        st.guard.arc.a = park;
        st.events.length = 0;
        let got = null;
        for (let i = 0; i < 40 * 60 && got === null; i++) {
          egg.step(st, aimAt(park));
          const e = st.events.find((x) => x.name === "goldIn");
          if (e) got = e.angle;
          st.events.length = 0;
        }
        assert.ok(got !== null, "your sperm came in");
        assert.ok(angDist(got, -Math.PI / 2) > 45 * RAD, `seed ${seed} park ${deg}: ${got / RAD}° is under the thumb`);
        assert.ok(angDist(got, Math.PI / 2) > 40 * RAD, `seed ${seed} park ${deg}: ${got / RAD}° is under the captions`);
        assert.ok(angDist(got, park) >= (assist ? 80 : 65) * RAD - 1e-9, `seed ${seed} park ${deg}: ${got / RAD}° is near the arc`);
        runs++;
      }
    }
  }
  assert.ok(runs >= 1440);
});

await check("the gold takes the candidate farthest from every stuck rival (held ones ignored), the first in seeded order on a tie", () => {
  const st = quietGuard(6);
  const order = st.guard.order;
  // no stuck rivals: the first allowed candidate in seeded order (arc parked away from it)
  const allowed = (deg) => { const c = wrapAngle(deg * RAD); return angDist(c, -Math.PI / 2) > 45 * RAD && angDist(c, Math.PI / 2) > 40 * RAD; };
  const first = order.find(allowed);
  st.guard.arc.a = wrapAngle(first * RAD + Math.PI);
  addRival(st, { theta: wrapAngle(first * RAD), r: 18, state: "held" });
  st.guard.goldAt = st.t;
  const evs = stepN(st, 1);
  near(wrapAngle(named(evs, "goldIn")[0].angle - first * RAD), 0, 1e-9, "the first in seeded order (a held rival is ignored)");
  // one stuck rival at 0°: the candidate farthest from it, round the allowed sides
  const s2 = quietGuard(6);
  s2.guard.arc.a = Math.PI / 2;
  addRival(s2, { theta: 0, r: 11.5, state: "stuck", p: 0.1 });
  s2.guard.goldAt = s2.t;
  const e2 = stepN(s2, 1, makeIntents());
  const got = named(e2, "goldIn")[0].angle;
  assert.ok(angDist(got, 0) >= 175 * RAD - 1e-9, `${got / RAD}° should be about 180° from the stuck rival`);
});

await check("nudges: the arc over your sperm pushes it out 6 u over 0.3 s, its burrow pauses, it comes back; after 3 it slips under", () => {
  const { st, evs, res } = play({ seed: 2, drive: holdOnGold() });
  const nudges = named(evs, "nudge");
  assert.deepEqual(nudges.map((e) => e.n), [1, 2, 3]);
  assert.equal(res.metrics.nudges, 3);
  assert.equal(named(evs, "enter").length, 1);
  assert.equal(st.subgoals.letIn, "auto");
  for (let k = 1; k < 3; k++) assert.ok(nudges[k].t - nudges[k - 1].t >= 0.3 + 6 / 8 - 2 * DT, "each nudge costs about 1.05 s");
  assert.ok(res.metrics.enterIn <= 52, `entered at ${res.metrics.enterIn}`);
  near(res.parts.find((p) => p.id === "clean").value, 0, 1e-9, "no clean-entry bonus after 3 nudges");
  // white-box: the burrow pauses (not reset) while it is nudged
  const s = quietGuard(2);
  stepN(s, 10, aimAt(Math.PI));
  s.guard.goldAt = s.t;
  stepN(s, 1, aimAt(Math.PI));
  const g = s.guard.gold;
  const away = wrapAngle(g.theta + Math.PI);
  stepN(s, 2 * 60, aimAt(away));
  while (g.state === "in") stepN(s, 1, aimAt(away));
  stepN(s, 60, aimAt(away));
  assert.ok(g.p > 0.2 && g.state === "stuck", `burrowing (${g.p})`);
  const ne = [];
  while (g.state === "stuck") ne.push(...stepN(s, 1, aimAt(g.theta)));
  assert.equal(named(ne, "nudge").length, 1);
  const p0 = g.p;
  let rMax = 0, steps = 0;
  while (g.state === "nudge") { stepN(s, 1, aimAt(away)); rMax = Math.max(rMax, g.r); steps++; near(g.p, p0, 1e-12, "the burrow pauses"); }
  near(rMax, 11.5 + 6, 1e-9, "pushed out 6 u");
  near(steps * DT, 0.3 + 6 / 8, 3 * DT, "about 1.05 s");
  stepN(s, 30, aimAt(away));
  assert.equal(g.state, "stuck", "back at the shell");
  near(g.r, 11.5, 1e-9, "head at the shell again");
  assert.ok(g.p > p0, "the burrow goes on from where it was");
});

await check("your sperm enters by 52 s into the guard at the latest", () => {
  const st = egg.create(3, carryAt(20), { motherPhase: 0 });
  egg.jump(st, "guard");
  const t0 = st.t;
  let evs = [];
  while (!egg.result(st).done && st.moment === "guard") {
    if (st.guard.gold) st.guard.gold.p = 0;                 // hold its burrow back
    evs.push(...stepN(st, 1));
  }
  const e = named(evs, "enter");
  assert.equal(e.length, 1);
  near(e[0].t - t0, 52, 1e-9, "at 52 s");
});

await check("the guard credit: bounced 1, popped 0.5, held 0; rivals still swimming in or burrowing at entry are left out", () => {
  const st = quietGuard();
  addRival(st, { theta: 0.5, r: 15, v: 10 });                  // swimming in, within 22 u: left out
  addRival(st, { theta: 1.5, r: 11.5, state: "stuck", p: 0.2 }); // burrowing: left out
  addRival(st, { theta: 2.5, r: 20, state: "bounce" });
  addRival(st, { theta: -2.5, r: 18, state: "held" });
  addRival(st, { theta: -1.5, r: 15, state: "loose" });
  egg.jump(st, "enter");
  const res = egg.result(st);
  assert.equal(res.metrics.counted, 3);
  near(res.metrics.guardCredit, 0.5, 1e-12, "(1 + 0 + 0.5) / 3");
  near(st.parts.guard, 3500 * 0.5, 1e-9, "3,500 × the credit");
  // a natural run: the credit is the mean over the rivals settled before entry that came within 22 u
  let atEntry = null;
  const { res: r2 } = play({ seed: 5, drive: botDriver(0.4, 5), each: (s) => {
    if (atEntry === null && s.guard.enterAt !== null) {
      const tE = s.guard.enterAt;
      const counted = s.guard.rivals.filter((rv) => rv.near !== null && rv.near <= tE && rv.settle !== null && rv.settle <= tE);
      atEntry = { n: counted.length, credit: counted.reduce((a, rv) => a + rv.credit, 0) / Math.max(1, counted.length),
        left: s.guard.rivals.filter((rv) => rv.state === "in" || rv.state === "stuck").length };
    }
  } });
  assert.equal(r2.metrics.counted, atEntry.n);
  near(r2.metrics.guardCredit, atEntry.credit, 1e-12, "the mean");
  // an idle guard has no credit and earns no clean-entry bonus
  const idleRes = play({ seed: 5 }).res;
  assert.equal(idleRes.metrics.guardCredit, 0);
  assert.equal(idleRes.parts.find((p) => p.id === "clean").value, 0);
  assert.equal(idleRes.parts.find((p) => p.id === "guard").value, 0);
});

await check("the arc: turn +1 turns it clockwise (the angle falls) at 540°/s (720° Assist); turn beats aim, aim beats the stick; Assist widens it to 50°", () => {
  const st = quietGuard();
  const a0 = st.guard.arc.a;
  stepN(st, 30, makeIntents({ turn: 1, aim: { x: 0, y: 50 }, steer: { x: 1, y: 0 } }));
  near(wrapAngle(st.guard.arc.a - (a0 - 270 * RAD)), 0, 1e-9, "−270° in 0.5 s");
  const s2 = quietGuard(1, { assist: true });
  const b0 = s2.guard.arc.a;
  stepN(s2, 15, makeIntents({ turn: -1 }));
  near(wrapAngle(s2.guard.arc.a - (b0 + 180 * RAD)), 0, 1e-9, "+180° in 0.25 s with Assist");
  near(s2.guard.half, 50 * RAD, 1e-12, "half-width 50° with Assist");
  near(st.guard.half, 35 * RAD, 1e-12, "35° without");
  stepN(st, 60, makeIntents({ aim: { x: 0, y: 50 }, steer: { x: 1, y: 0 } }));
  near(wrapAngle(st.guard.arc.a - Math.PI / 2), 0, 1e-9, "the aim beats the stick");
  stepN(st, 60, makeIntents({ steer: { x: -1, y: 0 } }));
  near(wrapAngle(st.guard.arc.a - Math.PI), 0, 1e-9, "the stick angle");
  const a1 = st.guard.arc.a;
  stepN(st, 30, makeIntents());
  assert.equal(st.guard.arc.a, a1, "lifting the finger leaves it where it is");
  // rivals burrow for 5.0 s with Assist
  const rv = addRival(s2, { theta: 0, r: 11.5, state: "stuck", p: 0 });
  s2.guard.arc.a = Math.PI;
  stepN(s2, Math.round(4.5 / DT));
  assert.equal(rv.state, "stuck", "still burrowing at 4.5 s");
  stepN(s2, Math.round(0.6 / DT));
  assert.equal(rv.state, "held", "held after 5.0 s");
});

await check("the waves: 8 waves at 2, 8, … 44 s; counts 3 to 8; speeds 9 to 15; 0.3 s apart; ≥ 25° apart within a wave; wave 1 from one 90° sector", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const plan = egg.create(seed, DEFAULT_CARRY, {}).guard.plan;
    assert.equal(plan.length, 47);
    for (let k = 1; k <= 8; k++) {
      const w = plan.filter((x) => x.wave === k);
      assert.equal(w.length, TUNE.waves.count[k - 1]);
      w.forEach((x, i) => { near(x.t, TUNE.waves.at[k - 1] + 0.3 * i, 1e-9, "0.3 s apart"); assert.equal(x.speed, TUNE.waves.speed[k - 1]); });
      for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) assert.ok(angDist(w[i].angle, w[j].angle) >= 25 * RAD - 1e-9, `seed ${seed} wave ${k}`);
      if (k === 1) {
        let spread = 0;
        for (const x of w) for (const y of w) spread = Math.max(spread, angDist(x.angle, y.angle));
        assert.ok(spread <= 90 * RAD, "one 90° sector");
      }
    }
  }
  // no wave after your sperm enters
  const { evs } = play({ seed: 1, place: 1, drive: botDriver(1, 1) });
  const e = named(evs, "enter")[0].t;
  assert.ok(named(evs, "stick").filter((x) => !x.gold).every((x) => x.t < e + 10), "only rivals already out swim on");
  assert.equal(egg.result(play({ seed: 1, place: 1 }).st).metrics.rivals < 47, true, "the late waves never come");
});

// ---- the seal ----

function toSeal(seed = 1, phase = 0) {
  const st = egg.create(seed, DEFAULT_CARRY, { motherPhase: phase });
  egg.jump(st, "seal");
  st.events.length = 0;
  return st;
}
function playOn(st, drive) {
  const evs = [];
  for (let i = 0; i < MAX_STEPS && !egg.result(st).done; i++) { egg.step(st, drive(st)); evs.push(...st.events); st.events.length = 0; }
  return evs;
}

await check("the seal: her beats counted from the first ≥ 0.6 s after the prompt; the release target on the 3rd (P 0.833 s)", () => {
  for (const phase of PHASES) {
    const st = toSeal(1, phase);
    const S = st.seal;
    assert.ok(S.c[0] >= S.prompt + 0.6 - 1e-9 && S.c[0] < S.prompt + 0.6 + PB, "the first counted beat");
    for (let k = 1; k < 6; k++) near(S.c[k] - S.c[k - 1], PB, 1e-9, "her beats");
    const x = egg.targets(st, 9);
    assert.equal(x.length, 1);
    assert.deepEqual([x[0].kind, x[0].t, x[0].group, x[0].heart], ["release", S.c[2], "seal", "mother"]);
    near(x[0].P, PB, 1e-9, "P");
    assert.deepEqual(egg.prompt(st), { gesture: "hold", text: "egg.seal", keys: "steer" });
  }
});

await check("the seal grades: In time 1,000, Close 500, a late release 0; an Off release does not seal, a fresh press then does", () => {
  for (const [err, grade, fl] of [[0, "in", 1000], [0.1, "close", 500], [-0.12, "close", 500], [0.5, "miss", 0]]) {
    const st = toSeal(2, 0.3);
    const c3 = st.seal.c[2];
    const evs = playOn(st, script([{ t: st.t + 0.1 }, { t: c3 + err, up: true }]));
    assert.deepEqual(named(evs, "seal").map((e) => [e.grade, e.auto]), [[grade, false]], `err ${err}`);
    near(named(evs, "seal")[0].t, c3 + err, 1e-9, "sealed at the release");
    assert.equal(egg.result(st).score.flourish, fl);
    assert.equal(st.subgoals.seal, "done");
  }
  const st = toSeal(2, 0.3);
  const c3 = st.seal.c[2];
  const evs = playOn(st, script([{ t: st.t + 0.1 }, { t: c3 - 0.3, up: true }, { t: c3 - 0.2 }, { t: c3, up: true }]));
  assert.ok(named(evs, "judge").some((e) => e.grade === "off"), "the early release is Off");
  assert.deepEqual(named(evs, "seal").map((e) => e.grade), ["in"], "the fresh press and an In-time release seal it");
});

await check("the seal counts only a press after its prompt: a hold from the guard and its release are ignored; it seals by itself on the 6th beat", () => {
  // a press in the guard, still down through enter, lifted on the target: ignored, then the auto seal on the 6th beat
  const st = egg.create(3, DEFAULT_CARRY, { motherPhase: 0 });
  egg.jump(st, "guard");
  stepN(st, 10, makeIntents({ presses: [{ t: st.t + 0.001 }], touching: true }));
  egg.jump(st, "seal");
  st.events.length = 0;
  const c = st.seal.c;
  const evs = playOn(st, script([{ t: c[2], up: true }]));
  assert.deepEqual(named(evs, "seal").map((e) => [e.grade, e.auto]), [[null, true]]);
  near(named(evs, "seal")[0].t, c[5], 1e-9, "on her 6th counted beat");
  assert.equal(egg.result(st).score.flourish, 0);
  assert.equal(st.subgoals.seal, "auto");
  // a fresh press after the prompt and a hold still down at the 6th beat: it seals by itself
  const s2 = toSeal(3, 0);
  const e2 = playOn(s2, script([{ t: s2.t + 0.2 }]));
  assert.deepEqual(named(e2, "seal").map((e) => [e.grade, e.auto]), [[null, true]]);
  near(named(e2, "seal")[0].t, s2.seal.c[5], 1e-9, "on her 6th counted beat, with the hold still down");
  // the bot presses only after the prompt, a fresh press
  const { evs: be, res } = play({ seed: 3, drive: botDriver(1, 3) });
  assert.equal(res.metrics.sealAuto, false);
  assert.ok(named(be, "seal")[0].t > momentAt(be, "seal"));
});

await check("after the seal the wave runs round the shell both ways in 1.2 s, then every other sperm drifts off", () => {
  for (const mk of [() => idle(), () => botDriver(1, 6), () => randomDriver(6)]) {
    let sealAt = null, checked = false, waveSeen = false;
    play({ seed: 6, drive: mk(), each: (s) => {
      if (s.seal && s.seal.sealAt !== null && sealAt === null) sealAt = s.seal.sealAt;
      if (sealAt !== null && s.t > sealAt + 0.6 && s.t < sealAt + 1.1 && !waveSeen) {
        const w = egg.view(s).strips.filter((x) => x.kind === "arc" && x.r === TUNE.sizes.shell);
        assert.equal(w.length, 1, "the seal wave");
        assert.ok(w[0].a1 - w[0].a0 > 0 && w[0].a1 - w[0].a0 < 2 * Math.PI, "running round both ways");
        waveSeen = true;
      }
      if (sealAt !== null && s.t >= sealAt + 1.25 && !checked) {
        for (const p of egg.probe(s).sperm) assert.equal(p.state, "loose", "drifting off");
        assert.ok(s.guard.rivals.every((rv) => rv.gone || rv.state === "off"));
        checked = true;
      }
    } });
    assert.ok(checked && waveSeen);
  }
});

// ---- botSteer and probe ----

await check("botSteer keeps its memory only in r.mem; at skill 1 its answer depends on the state alone; still outside the guard", () => {
  const s0 = egg.create(4, DEFAULT_CARRY, { motherPhase: 0 });
  const r0 = stream(1, "a");
  r0.mem = {};
  assert.deepEqual(egg.botSteer(s0, 1, r0), { steer: { x: 0, y: 0 }, dir: null, hold: false }, "still in the surge");
  const st = quietGuard(4);
  for (const th of [0.3, 2.0, -2.4]) addRival(st, { theta: th, r: 40, v: 12 });
  addRival(st, { theta: 1.2, r: 11.5, state: "stuck", p: 0.5 });
  st.guard.goldAt = st.t;
  stepN(st, 20, makeIntents());
  const snap = JSON.stringify(egg.probe(st)) + JSON.stringify(st.guard.arc) + st.t;
  const fresh = stream(2, "b");
  fresh.mem = {};
  const used = stream(3, "c");
  used.mem = { cur: "r999", curAng: 1, next: null, errFor: "r999", err: 0.5 };
  const a = egg.botSteer(st, 1, fresh), b = egg.botSteer(st, 1, used), c = egg.botSteer(st, 1, null);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.ok(Math.hypot(a.steer.x, a.steer.y) <= 1 && Math.hypot(a.steer.x, a.steer.y) > 0.999, "a unit steer");
  assert.equal(JSON.stringify(egg.probe(st)) + JSON.stringify(st.guard.arc) + st.t, snap, "the state is unchanged");
  const m = stream(5, "d");
  m.mem = {};
  egg.botSteer(st, 0.5, m);
  assert.ok("cur" in m.mem, "skill < 1 keeps its lag and error in r.mem");
});

await check("probe returns the guard shape in world units", () => {
  const { st } = play({ seed: 1, drive: botDriver(0.7, 1), each: (s) => {
    if (s.moment !== "guard" || Math.round(s.t * 60) % 120) return;
    const p = egg.probe(s);
    assert.deepEqual(Object.keys(p).sort(), ["arc", "egg", "entered", "gold", "sperm"]);
    near(p.arc.angle, s.guard.arc.a, 0, "arc angle");
    near(p.arc.half, 35 * RAD, 1e-12, "half-width");
    assert.deepEqual([p.egg.x, p.egg.y, p.egg.r], [0, 0, 9]);
    for (const x of p.sperm) {
      assert.ok(["in", "stuck", "bounce", "loose", "held"].includes(x.state), x.state);
      near(Math.hypot(x.x, x.y), x.r, 1e-6, "r is the head's distance");
      near(wrapAngle(Math.atan2(x.y, x.x) - x.angle), 0, 1e-6, "angle in world radians");
      assert.ok(x.progress >= 0 && x.progress <= 1);
    }
    if (p.gold) { near(Math.hypot(p.gold.x, p.gold.y), p.gold.r, 1e-6); assert.ok(p.gold.nudges >= 0 && p.gold.nudges <= 3); }
  } });
  assert.equal(egg.probe(st).entered, true);
});

// ---- facts and strings ----

const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|NICU|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUN = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const RACE = /\b(fastest|winner|win|wins|won)\b|\bbeats? the\b/i;
const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

await check("facts (15.2): ids, where, (f) only once the nuclei touch, allow-listed sources read (R or A), ≤ 20 words", () => {
  // six captions with room to show whole in real time; the rest are "What was real" facts (design.md 6.2, 12)
  const want = { "egg.surge": "card", "egg.fimbriae": "caption", "egg.cilia": "result", "egg.zona": "caption", "egg.corona": "caption",
    "egg.choice": "caption", "egg.signal": "result", "egg.size": "result", "egg.day": "result", "egg.stick": "result",
    "egg.fuse": "caption", "egg.wave": "result", "egg.seal": "result", "egg.block": "caption", "egg.pronuclei": "result",
    "egg.place": "result", "egg.weeks": "overlay", "egg.frame": "result" };
  assert.deepEqual(FACTS.map((f) => f.id), Object.keys(want));
  for (const f of FACTS) {
    assert.equal(f.where, want[f.id], f.id);
    assert.equal(f.stage, "egg");
    assert.equal(f.gaDay, 14);
    assert.equal(f.checked, true);
    assert.equal(f.fertilized, ["egg.pronuclei", "egg.place", "egg.weeks"].includes(f.id), `${f.id} fertilized`);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.ok(f.src.length > 0 && f.src.every((k) => SOURCES[k]), `${f.id} sources ${f.src}`);
    assert.ok(!/^(Week|Day)/.test(f.text), f.id);
    assert.ok(words(f.text).length <= 20, f.id);
    for (const s of sentences(f.text)) assert.ok(words(s).length <= 16, `${f.id}: ${s}`);
    assert.ok(!BANNED.test(f.text) && !PRONOUN.test(f.text) && !RACE.test(f.text), f.id);
    assert.ok(byId(f.id), `${f.id} is gathered by core/facts.js`);
  }
  assert.equal(factLabel(byId("egg.block")), "Week 2");
  assert.equal(factLabel(byId("egg.pronuclei")), "Day 0 after fertilization (week 2)");
});

await check("caption facts show once each, in order, each label matching the HUD's clock at that moment", () => {
  const order = ["egg.fimbriae", "egg.zona", "egg.corona", "egg.choice", "egg.fuse", "egg.block"];
  for (const mk of [() => idle(), () => botDriver(1, 2)]) {
    const st = egg.create(2, DEFAULT_CARRY, { motherPhase: 0.1 });
    const got = [];
    while (!egg.result(st).done) {
      egg.step(st, mk === undefined ? makeIntents() : makeIntents());
      for (const e of st.events) if (e.name === "fact") got.push({ id: e.id, where: e.where, clock: label(st.gaDay, { fertilized: st.fertilized }), fact: factLabel(byId(e.id)) });
      st.events.length = 0;
    }
    assert.deepEqual(got.map((g) => g.id), order);
    for (const g of got) { assert.equal(g.where, "caption"); assert.equal(g.clock, g.fact, `${g.id} at ${g.clock}`); }
  }
  // the first caption is "Now you are the egg." with no card; a card (opts.card) leaves it out
  const a = egg.create(1, DEFAULT_CARRY, {});
  assert.deepEqual(named(a.events, "caption").map((e) => e.id), ["egg.now"]);
  const b = egg.create(1, DEFAULT_CARRY, { card: true });
  assert.equal(named(b.events, "caption").length, 0);
});

await check("strings: every id the stage shows exists; no banned words, carer pronouns or race words; sentences ≤ 16 words", () => {
  for (const [id, text] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("egg."), id);
    assert.ok(!BANNED.test(text), `${id}: ${text}`);
    assert.ok(!PRONOUN.test(text), `${id}: ${text}`);
    assert.ok(!RACE.test(text), `${id}: ${text}`);
    for (const s of sentences(text)) assert.ok(words(s).length <= 16, `${id}: ${s}`);
    for (const carer of ["mother", "mum", "mom", "parent"]) assert.ok(!PRONOUN.test(say(id, {}, { carer })));
  }
  const { evs, res } = play({ drive: botDriver(0.7, 1) });
  const ids = new Set();
  for (const e of evs) {
    if (e.name === "prompt" && e.text) ids.add(e.text);
    if (e.name === "subgoal") ids.add(e.text);
    if (e.name === "caption") ids.add(e.id);
  }
  for (const p of res.parts) ids.add(p.label);
  for (const id of ids) assert.notEqual(say(id), id, `${id} is a registered string`);
  for (const id of ["egg.openAuto", "egg.guardAuto", "egg.letInAuto", "egg.sealAuto", "egg.now"]) assert.ok(TEXT[id], id);
  assert.equal(TEXT["egg.guardGoal"], "Guard your shell. Only one may enter.");
  assert.equal(TEXT["egg.letIn"], "Let it in.");
  assert.equal(TEXT["egg.openAuto"], "It opens anyway.");
  assert.equal(TEXT["egg.sealAuto"], "Your shell seals itself.");
});

await check("no event names harm: the guard's events are bounce, stick, loose, held, goldIn, nudge, enter and seal", () => {
  const names = new Set([...play({ drive: randomDriver(2) }).evs, ...play({ drive: idle() }).evs, ...play({ drive: holdOnGold() }).evs].map((e) => e.name));
  for (const n of names) assert.ok(!BANNED.test(n), n);
  for (const n of ["bounce", "stick", "held", "loose", "goldIn", "nudge", "enter", "seal", "milestone", "done"]) assert.ok(names.has(n), n);
});

// ---- robustness, jump, the score ----

await check("never throws: garbage intents, odd times and no intents at all; it still ends by the cap", () => {
  const junk = [null, undefined, 5, {}, { presses: 5 }, { presses: [null, { t: NaN }, { t: Infinity }] }, { releases: [{ t: -50 }, {}] },
    { presses: [{ t: 1e9 }], releases: [{ t: -1e9 }] }, makeIntents({ touching: true }), { steer: { x: NaN, y: 1 }, turn: 7, aim: { x: Infinity, y: 0 } },
    { aim: { x: 0, y: 0 }, steer: null }];
  const st = egg.create(1, null, { motherPhase: NaN });
  let i = 0;
  assert.doesNotThrow(() => { for (; i < MAX_STEPS && !egg.result(st).done; i++) egg.step(st, junk[i % junk.length]); });
  assert.equal(egg.result(st).done, true);
  assert.equal(egg.result(st).goalMet, true);
  assert.equal(st.error, null);
  assert.deepEqual(validate(egg.view(st)), []);
  const s2 = egg.create(2, undefined, undefined);
  assert.doesNotThrow(() => { for (let k = 0; k < 600; k++) egg.step(s2); });
  assert.deepEqual(validate(egg.view(s2)), []);
  assert.doesNotThrow(() => egg.step(null, makeIntents()));
});

await check("jump(moment) skips ahead (the moments between end by themselves), never back, and plays on to the end", () => {
  for (const m of ["surge", "open", "sweep", "guard", "enter", "seal", "fusion", "outro"]) {
    const st = egg.create(1, DEFAULT_CARRY, { motherPhase: 0.2 });
    for (let k = 0; k < 30; k++) egg.step(st, makeIntents());
    st.events.length = 0;
    const t = st.t;
    assert.equal(egg.jump(st, m), true, m);
    assert.equal(st.moment, m);
    assert.equal(st.t, t, "stage time does not move");
    if (m !== "surge") assert.ok(named(st.events, "moment").some((e) => e.id === m));
    const evs = [...st.events];
    st.events.length = 0;
    for (let n = 0; n < MAX_STEPS && !egg.result(st).done; n++) {
      egg.step(st, makeIntents());
      evs.push(...st.events);
      st.events.length = 0;
      assert.deepEqual(validate(egg.view(st)), []);
    }
    assert.equal(egg.result(st).done, true, m);
    assert.equal(named(evs, "enter").length, ["fusion", "outro", "seal"].includes(m) ? 1 : 1, `${m}: one enter`);
    assert.equal(st.fertilized, true);
    for (const v of Object.values(st.subgoals)) assert.ok(v === "done" || v === "auto", `${m}: ${v}`);
    assert.equal(egg.jump(st, "guard"), false, "nothing after the end");
  }
  const st = egg.create(1, DEFAULT_CARRY, {});
  egg.jump(st, "seal");
  assert.equal(egg.jump(st, "guard"), false, "never back");
  assert.equal(egg.jump(egg.create(1, DEFAULT_CARRY, {}), "nowhere"), false);
  // ?moment=guard stepped to 33 s: your sperm burrows at the shell, with stuck rivals round it
  const g = egg.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  egg.jump(g, "guard");
  stepN(g, Math.round(33 / DT));
  const p = egg.probe(g);
  assert.equal(p.gold.state, "stuck");
  assert.ok(p.sperm.some((x) => x.state === "stuck" || x.state === "held"));
});

await check("the score: Goal 3,000; Skill 1,500 × open accuracy + 3,500 × guard credit + 1,000 × (1 − nudges/3); Flourish the seal", () => {
  for (const mk of [() => ideal(), () => botDriver(0.4, 7), () => holdOnGold(), () => ideal({ sealErr: 0.1 })]) {
    const { res, evs } = play({ seed: 7, drive: mk() });
    const m = res.metrics;
    const clean = m.guardCredit > 0 ? 1000 * (1 - m.nudges / 3) : 0;
    const skill = 1500 * m.openAcc + 3500 * m.guardCredit + clean;
    assert.equal(res.score.skill, Math.round(skill));
    assert.equal(res.score.goal, 3000);
    assert.equal(res.score.flourish, m.sealGrade === "in" ? 1000 : m.sealGrade === "close" ? 500 : 0);
    assert.equal(res.score.total, res.score.goal + res.score.skill + res.score.flourish);
    const ticks = named(evs, "points").reduce((a, e) => a + e.add, 0);
    assert.ok(Math.abs(ticks - res.score.total) <= 3, `points events ${ticks} vs ${res.score.total}`);
    assert.deepEqual(res.parts.map((p) => p.id), ["goal", "open", "guard", "clean", "seal"]);
    assert.deepEqual(res.carryOut, {});
  }
  const close = play({ seed: 7, drive: ideal({ sealErr: 0.1 }) }).res;
  assert.equal(close.score.flourish, 500);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const ideal1 = play({ place: 1, drive: ideal() });
  const mid = [1, 2, 3, 4, 5].map((s) => play({ seed: s, drive: botDriver(0.7, s) }).res.score.total);
  const idleR = play({ place: 3 });
  console.log(`PASS ${FILE}: ${passed} checks (ideal ${ideal1.res.score.total} in ${ideal1.st.t.toFixed(1)} s; mid mean ${Math.round(mid.reduce((a, b) => a + b, 0) / mid.length)}; idle ${idleR.res.score.total} in ${idleR.st.t.toFixed(1)} s)`);
}
