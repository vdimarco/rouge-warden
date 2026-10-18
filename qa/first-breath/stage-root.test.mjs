// First Breath: stage 4, The Placenta (`root`, design.md 6.4, 4.1, 5.2 to 5.5, 7, 15, 16.4 to 16.7, 18; tasks 2.15 to
// 2.18). The meta and moments match the 4.1 table; the same seed and input play the same stage (two seeds); the
// scripted ideal input and the ref bot reach Glowing; idle ends by the cap with its goal met, all 8 pools linked by
// 40 s into roots and the clock at week 7; the skill 0.7 bot completes; one live gesture per moment; at most 2
// families; every sub-goal ends done or auto; the heart targets carry P, sit on your beats at 110 bpm and get their
// preview; every view validates, with an anchor and a cue; no red pools; nestle (a touch sinks you in over 2 s, idle
// is drawn in from 8 s), the firm edge, the swell, on-beat links, the auto reach from 12 s (8 s with Assist), the
// score parts and their points events, the carry out; botSteer keeps its memory in r.mem and is the same at skill 1
// for any r (one-button); jump; junk input never throws; the facts and the strings.
// node qa/first-breath/stage-root.test.mjs
import assert from "node:assert/strict";
import * as root from "../../public/first-breath/core/stages/root.js";
import { TUNE } from "../../public/first-breath/core/stages/root.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/root.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/root.text.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { DT, label, range, mmPerShortAxis } from "../../public/first-breath/core/clock.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate, LIMITS } from "../../public/first-breath/core/draw.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { windows } from "../../public/first-breath/core/judge.js";
import { check as checkTargets, previewS } from "../../public/first-breath/core/lib/track.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { CARERS, fill } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/stage-root.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

const OPTS = { assist: false, oneButton: false, motherPhase: 0 };
const HER = 60 / 72, YOU = 60 / 110;
const GESTURES = { nestle: "drag", roots: "drag", heart: "tap", grow: "none" };
const MAX_STEPS = Math.ceil((root.meta.capS + 5) / DT);
const PERF = { p99: NaN };

// Inputs: each is (st) → intents for the step [st.t, st.t + DT), made fresh per play.
const idle = () => () => makeIntents();
const botInput = (skill, seed) => { const bot = createBot(skill, seed); return (st) => bot.intents(root, st); };
// The ideal player: steers with botSteer at skill 1 (its own r) and presses every heart target exactly on time.
function ideal(seed) {
  const r = stream(seed, "ideal");
  r.mem = {};
  const done = new Set();
  return (st) => {
    const a = root.botSteer(st, 1, r);
    const presses = [];
    for (const x of root.targets(st, 1)) {
      if (done.has(x.id) || x.t >= st.t + DT || x.t < st.t - 0.3) continue;
      done.add(x.id);
      presses.push({ t: Math.max(x.t, st.t), raw: Math.max(x.t, st.t) });
    }
    const s = a.steer;
    return makeIntents({ steer: s, touching: presses.length > 0 || Math.hypot(s.x, s.y) > 0.01, presses });
  };
}
// A seeded mash of junk: random steer (some NaN), random presses and releases, sometimes no intents at all.
function junk(seed) {
  const r = stream(seed, "junk");
  return (st) => {
    const k = r();
    if (k < 0.05) return undefined;
    if (k < 0.1) return { steer: { x: NaN, y: 1 }, presses: [{ t: NaN }], releases: null };
    if (k < 0.15) return { steer: { x: 5, y: -7 }, touching: true, presses: [{ t: st.t + DT * r(), raw: st.t }] };
    return makeIntents({
      steer: { x: 2 * r() - 1, y: 2 * r() - 1 }, touching: r() < 0.5,
      presses: r() < 0.1 ? [{ t: st.t + DT * r(), raw: st.t + DT * r() }] : [],
      releases: r() < 0.1 ? [{ t: st.t + DT * r(), raw: st.t + DT * r() }] : [],
    });
  };
}

// Play one stage to its end. `every(st, i)` sees the state before each step; `after(st, evs)` sees the step's events.
function play(seed, input, { opts = OPTS, every = null, after = null, viewsEvery = 0 } = {}) {
  const st = root.create(seed, DEFAULT_CARRY, opts);
  const evs = [...st.events];
  st.events.length = 0;
  const views = [];
  let i = 0;
  for (; i < MAX_STEPS && !root.result(st).done; i++) {
    if (viewsEvery && i % viewsEvery === 0) views.push({ t: st.t, moment: st.moment, v: root.view(st) });
    if (every) every(st, i);
    root.step(st, input(st));
    if (after) after(st, st.events);
    evs.push(...st.events);
    st.events.length = 0;
  }
  if (viewsEvery) views.push({ t: st.t, moment: st.moment, v: root.view(st) });
  return { st, evs, views, res: root.result(st), steps: i };
}
const named = (evs, name) => evs.filter((e) => e.name === name);

// Shared plays.
const IDLE = [1, 2, 3, 4, 5].map((seed) => play(seed, idle(), { viewsEvery: 15 }));
const REF = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => play(seed, botInput(1, seed), { viewsEvery: 15 }));
const MID = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => play(seed, botInput(0.7, seed), { viewsEvery: 30 }));
const IDEAL = [1, 2, 3].map((seed) => play(seed, ideal(seed)));

await check("meta and moments match the Stage interface and the 4.1 and 3.1 tables", () => {
  const m = root.meta;
  assert.deepEqual([m.id, m.index, m.name, m.verb, m.orient], ["root", 3, "The Placenta", "Root", "long"]);
  assert.deepEqual([...m.families], ["steer", "tap"]);
  assert.ok(m.families.length <= 2, "at most 2 families");
  assert.deepEqual({ ...m.ga }, { start: 20, end: 49 });
  assert.deepEqual({ ...m.mm }, { start: 0.6, end: 30 });
  assert.equal(m.fertilized, true);
  assert.deepEqual([m.motherBpm, m.parS, m.capS, m.canFail, m.scored], [72, 45, 75, false, true]);
  assert.deepEqual(m.moments.map((x) => [x.id, [...x.ga], x.lenS]),
    [["nestle", [20, 23], 12], ["roots", [25, 35], 40], ["heart", [36, 36], null], ["grow", [36, 49], 7]]);
  for (const name of ["create", "step", "view", "prompt", "targets", "botSteer", "probe", "result", "jump"]) assert.equal(typeof root[name], "function", name);
});

await check("the same seed and input play the same stage (seeds 1 and 2, bot and junk input)", () => {
  for (const seed of [1, 2]) {
    for (const make of [() => botInput(0.7, seed), () => junk(seed)]) {
      const a = play(seed, make(), { viewsEvery: 20 }), b = play(seed, make(), { viewsEvery: 20 });
      assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}: the same events`);
      assert.deepEqual(a.res, b.res, `seed ${seed}: the same result`);
      assert.equal(JSON.stringify(a.views.map((v) => ({ ...v.v, strips: v.v.strips.map((s) => ({ ...s, nodes: s.nodes ? Array.from(s.nodes) : undefined })) }))),
        JSON.stringify(b.views.map((v) => ({ ...v.v, strips: v.v.strips.map((s) => ({ ...s, nodes: s.nodes ? Array.from(s.nodes) : undefined })) }))), `seed ${seed}: the same views`);
    }
  }
  const c = play(3, botInput(0.7, 3));
  assert.notEqual(JSON.stringify(c.res.metrics), JSON.stringify(play(4, botInput(0.7, 3)).res.metrics), "another seed lays another stage");
});

await check("the scripted ideal input reaches Glowing; the ref bot is Glowing on every seed", () => {
  for (const { res, st } of IDEAL) {
    assert.equal(res.done, true);
    assert.equal(st.err, null);
    assert.equal(res.metrics.heartAccuracy, 1, "every heart tap In time");
    assert.equal(res.metrics.onBeat, res.metrics.you, "every pool you reach is on the beat");
    assert.equal(gradeOf(res.score.total, res.goalMet), "Glowing", `ideal ${res.score.total}`);
  }
  for (const { res } of REF) assert.equal(gradeOf(res.score.total, res.goalMet), "Glowing", `ref ${res.score.total} (${JSON.stringify(res.metrics)})`);
  const mean = REF.reduce((a, p) => a + p.res.score.total, 0) / REF.length;
  assert.ok(mean >= 8500, `ref mean ${mean}`);
});

await check("idle ends by the cap with its goal met: drawn in at 8 s, all 8 pools by 40 s, the clock at week 7", () => {
  for (const { st, res, evs } of IDLE) {
    assert.equal(res.done, true);
    assert.equal(res.goalMet, true);
    assert.equal(res.score.goal, 3000);
    assert.ok(st.t <= root.meta.capS + 1e-9, `ended at ${st.t}`);
    assert.equal(res.metrics.nestled, "auto");
    near(res.metrics.times.roots, TUNE.nestle.idleS + TUNE.nestle.drawS, 2 * DT, "idle: drawn in from 8 s over 3 s");
    assert.equal(res.metrics.you, 0);
    assert.equal(res.metrics.auto, 8);
    const rootsLen = res.metrics.times.heart - res.metrics.times.roots;
    assert.ok(rootsLen <= TUNE.roots.lenS + DT, `all 8 linked by 40 s (${rootsLen.toFixed(2)} s)`);
    const autos = named(evs, "caption").filter((e) => e.id === "root.anyway");
    assert.equal(autos.length, 8, "\"The roots reach it anyway.\" for each");
    assert.ok(autos[0].t - res.metrics.times.roots >= TUNE.roots.autoFromS - 1e-9, "no auto link before 12 s");
    assert.equal(st.gaDay, 49);
    assert.equal(label(st.gaDay), "Week 7");
    assert.equal(res.score.total, 3000, "idle earns the Goal only");
    assert.ok(st.t >= 60 && st.t <= 70, `idle stage time ${st.t.toFixed(1)} s (6.4: about 67 s)`);
  }
});

await check("the skill 0.7 bot completes every seed with its goal met", () => {
  for (const { st, res } of MID) {
    assert.equal(res.done, true);
    assert.equal(res.goalMet, true);
    assert.equal(st.err, null);
    assert.ok(st.t <= root.meta.capS);
    assert.ok(res.metrics.you >= 3, `mid reached ${res.metrics.you}`);
  }
  const mean = MID.reduce((a, p) => a + p.res.score.total, 0) / MID.length;
  assert.ok(mean >= 7000, `mid mean ${mean}`);
});

await check("one live gesture per moment, named by its prompt; prompt() agrees", () => {
  for (const { evs, st } of [...IDLE.slice(0, 2), ...REF.slice(0, 2), ...MID.slice(0, 2)]) {
    let moment = null;
    const seen = {};
    for (const e of evs) {
      if (e.name === "moment") moment = e.id;
      if (e.name !== "prompt" || !moment) continue;
      (seen[moment] ||= new Set()).add(e.gesture);
      assert.equal(e.keys, "steer");
    }
    for (const [m, set] of Object.entries(seen)) assert.deepEqual([...set], [GESTURES[m]], m);
    assert.deepEqual(Object.keys(seen), ["nestle", "roots", "heart", "grow"]);
    assert.equal(root.prompt(st).gesture, "none", "none once done");
  }
  const st = root.create(1, DEFAULT_CARRY, OPTS);
  const input = botInput(1, 1);
  while (!root.result(st).done) {
    assert.equal(root.prompt(st).gesture, GESTURES[st.moment], st.moment);
    root.step(st, input(st));
    st.events.length = 0;
  }
});

await check("every sub-goal is shown, then ends done or auto (idle, ref, mid, junk, jump)", () => {
  const plays = [...IDLE, ...REF, ...MID, play(1, junk(1)), play(2, junk(2))];
  const j = root.create(1, DEFAULT_CARRY, OPTS);
  root.jump(j, "grow");
  while (!root.result(j).done) root.step(j, makeIntents());
  plays.push({ st: j, evs: j.events });
  for (const { st, evs } of plays) {
    assert.deepEqual(Object.keys(st.subgoals).sort(), ["heart", "nestle", "pools"]);
    for (const [id, s] of Object.entries(st.subgoals)) assert.ok(s === "done" || s === "auto", `${id}: ${s}`);
    for (const id of Object.keys(st.subgoals)) {
      const list = named(evs, "subgoal").filter((e) => e.id === id).map((e) => e.state);
      assert.equal(list[0], "shown", `${id} shown first`);
      assert.equal(list.length, 2, `${id}: shown once, settled once`);
    }
  }
  const ref = REF[0].st.subgoals, idleGoals = IDLE[0].st.subgoals;
  assert.deepEqual(ref, { nestle: "done", pools: "done", heart: "done" });
  assert.deepEqual(idleGoals, { nestle: "auto", pools: "auto", heart: "auto" });
});

await check("heart targets: 8 taps on your beats at 110 bpm, each with P, spaced ≥ 0.5 s, previewed ≥ max(2 beats, 1.2 s)", () => {
  for (const seed of [1, 2]) {
    const first = new Map();
    const { st, evs } = play(seed, botInput(1, seed), { every: (s) => { for (const x of root.targets(s, 60)) if (!first.has(x.id)) first.set(x.id, { ...x, seen: s.t }); } });
    const list = [...first.values()].sort((a, b) => a.t - b.t);
    assert.equal(list.length, TUNE.heart.targets);
    assert.deepEqual(checkTargets(list), []);
    const you = Array.from(st.beats.you);
    list.forEach((x, k) => {
      assert.equal(x.kind, "tap"); assert.equal(x.heart, "you"); assert.equal(x.group, "heart");
      near(x.P, YOU, 1e-6, `${x.id} P`);
      assert.ok(you.some((b) => Math.abs(b - x.t) < 1e-9), `${x.id} sits on one of your beats`);
      assert.ok(x.t - x.seen >= previewS(YOU) - 1e-9, `${x.id} previewed ${(x.t - x.seen).toFixed(2)} s`);
      if (k) near(x.t - list[k - 1].t, YOU, 1e-6, "on consecutive beats");
    });
    const yours = named(evs, "subgoal").find((e) => e.id === "heart");
    assert.ok(list[0].t - yours.t >= 1.2 - 1e-9, "the first target comes ≥ 1.2 s after \"This beat is yours.\"");
    const ms = named(evs, "milestone");
    assert.deepEqual(ms.map((e) => e.id), ["implanted", "heart"]);
    near(ms[1].t, you[0], 1e-9, "milestone heart on your first beat");
    near(you[0] - st.times.heart, TUNE.heart.hushS, 1e-9, "your heart starts after the 1.5 s hush");
    for (let i = 1; i < you.length && you[i] < st.times.grow; i++) near(you[i] - you[i - 1], YOU, 1e-9, "110 bpm");
    assert.ok(named(evs, "judge").every((e) => e.heart === "you"));
  }
});

await check("every view validates, with an anchor and a cue in play, the camera long, and no red pools", () => {
  const all = [...IDLE, ...REF, ...MID.slice(0, 3)];
  const assist = play(1, botInput(1, 1), { opts: { ...OPTS, assist: true }, viewsEvery: 15 });
  const one = play(2, botInput(0.7, 2), { opts: { ...OPTS, oneButton: true }, viewsEvery: 15 });
  for (const { views } of [...all, assist, one]) {
    assert.ok(views.length > 50);
    for (const { t, moment, v } of views) {
      assert.deepEqual(validate(v), [], `t ${t.toFixed(2)} (${moment})`);
      assert.equal(v.stage, "root");
      assert.equal(v.camera.orient, "long");
      assert.ok(v.cue, `a cue at ${t.toFixed(2)} (${moment})`);
      assert.ok(v.splats.length <= LIMITS.splats && v.marks.length <= LIMITS.marks && v.rings.length <= LIMITS.rings);
      for (const m of v.marks) assert.notEqual(m.rim, "wavy", "pools turn red (wavy rims) only from gaDay 84");
      for (const m of v.marks.filter((x) => x.kind === "pool")) assert.equal(m.rim, "dotted");
      const tree = v.strips.find((s) => s.kind === "tree");
      if (moment !== "nestle") assert.ok(tree && tree.nodes.length / 4 <= TUNE.tree.maxNodes, "the tree, within its cap");
      if (moment === "roots") assert.equal(v.marks.filter((x) => x.kind === "pool").length, 8);
    }
  }
  // the stage reads with plain shapes: lining spots, pools, the tree, you, rings for both hearts
  const ref = REF[0].views;
  const kinds = (m) => new Set(ref.filter((x) => x.moment === m).flatMap((x) => [...x.v.marks.map((k) => k.kind), ...x.v.strips.map((k) => k.kind), ...x.v.rings.map((k) => k.kind)]));
  for (const k of ["spot", "glow", "mother"]) assert.ok(kinds("nestle").has(k), `nestle shows ${k}`);
  for (const k of ["pool", "tree", "ripples", "mother"]) assert.ok(kinds("roots").has(k), `roots shows ${k}`);
  for (const k of ["you", "approach", "mother"]) assert.ok(kinds("heart").has(k), `heart shows ${k}`);
  assert.ok(kinds("grow").has("lake"), "grow shows the disc");
});

await check("gaDay follows 4.1 and never falls; the real scale never shrinks; labels from Day 6 to week 7", () => {
  for (const play_ of [IDLE[0], REF[0], MID[0]]) {
    const st = root.create(play_.st.seed, DEFAULT_CARRY, OPTS);
    const input = play_ === IDLE[0] ? idle() : botInput(play_ === REF[0] ? 1 : 0.7, play_.st.seed);
    let g = st.gaDay, mm = mmPerShortAxis(root.meta, g);
    const span = { nestle: [20, 23], roots: [25, 35], heart: [36, 36], grow: [36, 49] };
    assert.equal(label(st.gaDay), "Day 6 after fertilization (week 2)");
    while (!root.result(st).done) {
      root.step(st, input(st));
      st.events.length = 0;
      assert.ok(st.gaDay >= g - 1e-12, `gaDay ${g} → ${st.gaDay}`);
      const m2 = mmPerShortAxis(root.meta, st.gaDay);
      assert.ok(m2 >= mm - 1e-12);
      if (!root.result(st).done) {
        const [a, b] = span[st.moment];
        assert.ok(st.gaDay >= a - 1e-9 && st.gaDay <= b + 1e-9, `${st.moment} gaDay ${st.gaDay}`);
      }
      g = st.gaDay; mm = m2;
    }
    assert.equal(st.gaDay, 49);
    near(mmPerShortAxis(root.meta, st.gaDay), 30, 1e-9, "30 mm at the end");
  }
});

await check("nestle: a touch sinks you in over 2 s by itself; nestleX follows the spot", () => {
  for (const seed of [1, 2, 3, 4]) {
    const st = root.create(seed, DEFAULT_CARRY, OPTS);
    const target = st.spots.reduce((a, s) => (Math.hypot(s.x, s.y) < Math.hypot(a.x, a.y) ? s : a));
    let sinkAt = null;
    while (st.moment === "nestle") {
      const dx = target.x - st.nest.x, dy = target.y - st.nest.y, d = Math.hypot(dx, dy) || 1;
      root.step(st, makeIntents({ steer: { x: dx / d, y: dy / d - 0.25 }, touching: true }));
      if (sinkAt === null && st.nest.state === "sink") sinkAt = st.t;
    }
    assert.equal(st.nest.by, "you");
    assert.equal(st.spots[st.nest.spot], target, "the spot you touched");
    near(st.times.roots - sinkAt, TUNE.nestle.sinkS, 2 * DT, "sinks in over 2 s");
    assert.ok(st.times.roots < TUNE.nestle.lenS);
    assert.deepEqual(st.root, { x: target.x, y: target.y });
    assert.equal(st.subgoals.nestle, "done");
    assert.ok(named(st.events, "subgoal").some((e) => e.id === "nestle" && e.text === "root.nestled"));
    const nx = root.result(st).carryOut.nestleX;
    assert.ok(nx >= -1 && nx <= 1 && Math.sign(nx) === Math.sign(target.x), `nestleX ${nx} for x ${target.x}`);
  }
  // spots are never on the idle line, so an idle drift is drawn in, not touched
  for (let seed = 1; seed <= 40; seed++) {
    const st = root.create(seed, DEFAULT_CARRY, OPTS);
    assert.equal(st.spots.length, 3);
    for (const s of st.spots) assert.ok(Math.abs(s.x) >= TUNE.nestle.spotR + TUNE.nestle.youR + 4, `spot x ${s.x}`);
  }
  // still drifting at 9 s: the nearest spot draws you in, so nestle ends by 12 s
  const st = root.create(5, DEFAULT_CARRY, OPTS);
  let k = 0;
  while (st.moment === "nestle") { root.step(st, makeIntents({ steer: { x: (k++ % 120) < 60 ? 0.05 : -0.05, y: -0.27 }, touching: true })); }
  assert.equal(st.nest.by, "auto");
  assert.ok(st.times.roots <= TUNE.nestle.lenS + DT, `nestle ended at ${st.times.roots}`);
});

await check("roots: pools 60 to 150 u out, 40 u apart; the firm edge holds the tip; the swell; the tree within its caps", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const st = root.create(seed, DEFAULT_CARRY, OPTS);
    root.jump(st, "roots");
    assert.equal(st.pools.length, 8);
    st.pools.forEach((p, i) => {
      const d = Math.hypot(p.x - st.root.x, p.y - st.root.y);
      assert.ok(d >= 60 - 1e-9 && d <= 150 + 1e-9, `pool ${i} at ${d.toFixed(1)} u`);
      for (let j = 0; j < i; j++) assert.ok(Math.hypot(p.x - st.pools[j].x, p.y - st.pools[j].y) >= 40 - 1e-9, `pools ${i}, ${j}`);
      assert.ok(Math.abs(p.x - st.root.x) <= 130, "inside the free screen sideways");
    });
  }
  // steer hard sideways, then back into the wall: the tip slides along the firm edge
  const st = root.create(2, DEFAULT_CARRY, OPTS);
  root.jump(st, "roots");
  let maxD = 0, minY = Infinity, nodesMax = 0;
  for (let i = 0; i < 60 * 14 && st.moment === "roots"; i++) {
    const s = i < 300 ? { x: 1, y: 0.1 } : i < 600 ? { x: -0.2, y: -1 } : { x: -1, y: 0 };
    root.step(st, makeIntents({ steer: s, touching: true }));
    if (st.moment !== "roots") break;
    maxD = Math.max(maxD, Math.hypot(st.tip.x - st.root.x, st.tip.y - st.root.y));
    minY = Math.min(minY, st.tip.y - st.root.y);
    nodesMax = Math.max(nodesMax, st.tree.n);
  }
  assert.ok(maxD <= TUNE.roots.firmR + 1e-6, `tip ${maxD} from the root`);
  assert.ok(minY >= -TUNE.roots.backU - 1e-6, `tip ${minY} behind the root`);
  assert.ok(nodesMax <= 260);
  // pools swell 1 + 0.12 × pulse on her beat
  const s2 = root.create(3, DEFAULT_CARRY, OPTS);
  root.jump(s2, "roots");
  const b = s2.beats.next("mother", s2.t + 0.1);
  while (s2.t + DT < b) root.step(s2, makeIntents());
  const before = root.view(s2).marks.find((m) => m.kind === "pool").r;
  root.step(s2, makeIntents());
  root.step(s2, makeIntents());
  const onBeat = root.view(s2).marks.find((m) => m.kind === "pool").r;
  near(before, TUNE.roots.poolR, 0.2, "between beats, radius 16");
  assert.ok(onBeat > 1.08 * TUNE.roots.poolR && onBeat <= 1.12 * TUNE.roots.poolR + 1e-9, `on the beat ${onBeat}`);
});

await check("on-beat links: arriving on her beat counts, arriving 0.4 s late still links but not on the beat", () => {
  const close = windows(HER, false).close;
  for (const seed of [1, 2, 3]) {
    const late = stream(seed, "late");
    late.mem = { aims: Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, 0.4])) };
    const st = root.create(seed, DEFAULT_CARRY, OPTS);
    root.jump(st, "roots");
    const t0 = st.t;
    while (st.moment === "roots") {
      const a = root.botSteer(st, 0.999, late);
      root.step(st, makeIntents({ steer: a.steer, touching: true }));
    }
    const mine = st.pools.filter((p) => p.by === "you");
    assert.ok(mine.length >= 4, `late player reached ${mine.length}`);
    assert.ok(st.counts.onBeat <= 1, `late: ${st.counts.onBeat} on the beat`);
    const ref = root.create(seed, DEFAULT_CARRY, OPTS);
    root.jump(ref, "roots");
    const r1 = stream(1, "x");
    while (ref.moment === "roots") root.step(ref, makeIntents({ steer: root.botSteer(ref, 1, r1).steer, touching: true }));
    for (const p of ref.pools.filter((q) => q.by === "you")) {
      const b = ref.beats.next("mother", p.at - close - 1e-9);
      assert.ok(Math.abs(b - p.at) <= close + 1e-9 && p.onBeat, `ref entry ${p.at - t0} vs beat ${b - t0}`);
    }
  }
});

await check("auto reach: from 12 s (8 s with Assist), one pool every 3.5 s; Assist pools ×1.3", () => {
  for (const assist of [false, true]) {
    const { evs, st } = play(4, idle(), { opts: { ...OPTS, assist } });
    const start = st.times.roots;
    const links = named(evs, "sfx").filter((e) => e.id === "root.link").map((e) => e.t - start);
    assert.equal(links.length, 8);
    const from = assist ? TUNE.roots.assistAutoFromS : TUNE.roots.autoFromS;
    links.forEach((t, k) => {
      assert.ok(t >= from + TUNE.roots.autoEveryS * k - 1e-9, `link ${k} at ${t.toFixed(2)} s`);
      assert.ok(t <= from + TUNE.roots.autoEveryS * k + 3.2, `link ${k} at ${t.toFixed(2)} s, within its reach`);
    });
    assert.ok(links[7] <= TUNE.roots.lenS);
  }
  const a = root.create(1, DEFAULT_CARRY, { ...OPTS, assist: true });
  root.jump(a, "roots");
  const r = root.view(a).marks.find((m) => m.kind === "pool").r;
  assert.ok(r >= 16 * 1.3 - 1e-9 && r <= 16 * 1.3 * 1.12 + 1e-9, `assist pool ${r}`);
});

await check("score: Goal 3,000; Skill 3,000 × yours / 8 + 1,000 × on-beat / 8 + 2,000 × heart; Flourish 1,000 × In time / 8", () => {
  for (const { res, evs } of [...REF.slice(0, 3), ...MID.slice(0, 3), IDLE[0]]) {
    const m = res.metrics;
    const skill = 3000 * m.you / 8 + 1000 * m.onBeat / 8 + 2000 * m.heartAccuracy;
    assert.equal(res.score.goal, 3000);
    assert.equal(res.score.skill, Math.round(skill));
    assert.equal(res.score.flourish, Math.round(1000 * m.heartInTime / 8));
    assert.equal(res.score.total, res.score.goal + res.score.skill + res.score.flourish);
    assert.deepEqual(res.parts.map((p) => [p.id, p.max]), [["goal", 3000], ["pools", 3000], ["onBeat", 1000], ["heart", 2000], ["inTime", 1000]]);
    for (const p of res.parts) assert.ok(TEXT[p.label] || p.label === "part.goal", `part label ${p.label}`);
    const sum = (part) => named(evs, "points").filter((e) => e.part === part).reduce((a, e) => a + e.add, 0);
    assert.equal(sum("skill"), res.score.skill, "points events add up to Skill");
    assert.equal(sum("flourish"), res.score.flourish, "points events add up to the Flourish");
  }
  // a miss adds less, never takes away: the score never falls during a play
  const st = root.create(2, DEFAULT_CARRY, OPTS);
  const input = botInput(0.5, 2);
  let last = 0;
  while (!root.result(st).done) {
    root.step(st, input(st));
    st.events.length = 0;
    const s = root.result(st).score;
    assert.ok(s.skill + s.flourish >= last);
    last = s.skill + s.flourish;
  }
});

await check("carry: in from DEFAULT_CARRY or junk; out nestleX in −1..1 and treeSeed a deterministic uint32", () => {
  for (const { res } of [...REF.slice(0, 3), IDLE[0]]) {
    const c = res.carryOut;
    assert.deepEqual(Object.keys(c).sort(), ["nestleX", "treeSeed"]);
    assert.ok(c.nestleX >= -1 && c.nestleX <= 1);
    assert.ok(Number.isInteger(c.treeSeed) && c.treeSeed >= 0 && c.treeSeed < 2 ** 32);
  }
  assert.deepEqual(play(6, botInput(1, 6)).res.carryOut, play(6, botInput(1, 6)).res.carryOut);
  for (const carry of [undefined, null, {}, { nestleX: "x", treeSeed: -4, sperm: 7 }]) {
    const st = root.create(1, carry, OPTS);
    while (!root.result(st).done) { root.step(st, makeIntents()); st.events.length = 0; }
    assert.equal(st.err, null);
  }
});

await check("botSteer: memory only in r.mem, no state change, |steer| ≤ 1, the same at skill 1 for any r (one-button)", () => {
  const st = root.create(7, DEFAULT_CARRY, OPTS);
  const used = stream(7, "oneButton");
  used.mem = {};
  const bot = botInput(0.7, 7);
  let n = 0;
  const snap = (s) => JSON.stringify(s, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : typeof v === "function" ? "fn" : v));
  while (!root.result(st).done) {
    if (n++ % 7 === 0) {
      const before = snap(st);
      const fresh = stream(n, "fresh");                     // no mem at all
      const a = root.botSteer(st, 1, used), b = root.botSteer(st, 1, fresh);
      assert.deepEqual(a, b, `skill 1 at ${st.t.toFixed(2)} s`);
      assert.ok(Math.hypot(a.steer.x, a.steer.y) <= 1, "never rescaled by the run");
      assert.equal(snap(st), before, "botSteer leaves the state alone");
      const c = root.botSteer(st, 0.4, used);
      assert.ok(Math.hypot(c.steer.x, c.steer.y) <= 1);
      assert.deepEqual(Object.keys(c).sort(), ["dir", "hold", "steer"]);
    }
    root.step(st, bot(st));
    st.events.length = 0;
  }
  assert.ok(used.mem.aims && Object.keys(used.mem.aims).length > 0, "aim noise kept in r.mem below skill 1");
  // at the start of nestle the bot heads for a spot (16.11: a stick off centre is touching)
  const s0 = root.create(1, DEFAULT_CARRY, OPTS);
  const a = root.botSteer(s0, 0.5, stream(0, "x"));
  assert.ok(Math.hypot(a.steer.x, a.steer.y) > 0.5);
  assert.deepEqual(createBot(0.5, 1).intents(root, s0).steer, a.steer);
  // one-button through a whole stage: hold all the time, steer from botSteer at skill 1
  const one = root.create(8, DEFAULT_CARRY, { ...OPTS, oneButton: true });
  const r1 = stream(8, "oneButton");
  r1.mem = {};
  while (!root.result(one).done) {
    const p = root.botSteer(one, 1, r1);
    const presses = root.targets(one, 1).filter((x) => x.t >= one.t && x.t < one.t + DT).map((x) => ({ t: x.t, raw: x.t }));
    root.step(one, makeIntents({ steer: p.steer, touching: true, presses }));
  }
  const res = root.result(one);
  assert.equal(res.metrics.nestled, "you");
  assert.ok(res.metrics.you >= 5, `one-button reached ${res.metrics.you}`);
  assert.equal(gradeOf(res.score.total, true), "Glowing");
});

await check("jump: forward only, settling what it skips; probe is null", () => {
  for (const to of ["roots", "heart", "grow"]) {
    const st = root.create(1, DEFAULT_CARRY, OPTS);
    assert.equal(root.jump(st, to), true);
    assert.equal(st.moment, to);
    assert.equal(root.jump(st, "nestle"), false, "never back");
    assert.equal(root.jump(st, to), false);
    assert.equal(root.jump(st, "moon"), false);
    assert.ok(named(st.events, "moment").some((e) => e.id === to));
    if (to !== "roots") assert.equal(st.pools.filter((p) => p.linked).length, 8);
    while (!root.result(st).done) root.step(st, makeIntents());
    assert.equal(st.gaDay, 49);
    assert.equal(st.err, null);
    assert.equal(root.probe(st), null);
  }
  const st = root.create(1, DEFAULT_CARRY, OPTS);
  root.jump(st, "grow");
  const g0 = st.t;
  while (!root.result(st).done) root.step(st, makeIntents());
  near(st.t - g0, TUNE.grow.lenS, DT + 1e-9, "grow lasts 7 s");
  assert.equal(root.result(st).metrics.heartAccuracy, 0, "skipped heart targets count as misses");
});

await check("junk input never throws, and the stage still ends by its cap with its goal", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { st, res } = play(seed, junk(seed), { viewsEvery: 25 });
    assert.equal(st.err, null, st.err);
    assert.equal(res.done, true);
    assert.equal(res.goalMet, true);
    assert.ok(st.t <= root.meta.capS + 1e-9);
  }
  // the longest a player can make it: drift past every spot, never reach a pool, still ends well under the cap
  const st = root.create(3, DEFAULT_CARRY, OPTS);
  while (!root.result(st).done) {
    const s = st.moment === "nestle" ? { x: 0, y: -0.27 } : st.moment === "roots" ? { x: 0, y: -1 } : { x: 0, y: 0 };
    root.step(st, makeIntents({ steer: s, touching: true }));
  }
  assert.ok(st.t <= 12 + 40 + 11 + 7 + 0.5 && st.t < root.meta.capS, `ended at ${st.t.toFixed(1)} s`);
  assert.doesNotThrow(() => root.step(null, null));
  const done = root.create(1, DEFAULT_CARRY, OPTS);
  root.jump(done, "grow");
  while (!root.result(done).done) root.step(done, makeIntents());
  const t = done.t;
  root.step(done, makeIntents());
  near(done.t, t + DT, 1e-12, "a done stage only moves its clock");
  assert.deepEqual(root.targets(done, 10), []);
});

await check("facts: 6.4's ids with 15.2's text, allow-listed sources, R or A, labels from the clock", () => {
  assert.deepEqual(FACTS.map((f) => f.id), ["root.bury", "root.hcg", "root.grows", "root.glands", "root.heart", "root.tube", "root.size", "root.buds", "root.w7"]);
  const where = Object.fromEntries(FACTS.map((f) => [f.id, f.where]));
  assert.equal(where["root.bury"], "card");
  assert.equal(where["root.w7"], "overlay");
  for (const f of FACTS) {
    assert.equal(f.stage, "root");
    assert.equal(f.checked, true);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.ok(f.src.length > 0 && f.src.every((k) => SOURCES[k]), `${f.id} sources ${f.src}`);
    assert.ok(!/^(Week|Day)/.test(f.text), `${f.id} starts with a label`);
    assert.ok(f.text.split(/\s+/).length <= 20, `${f.id} ≤ 20 words`);
    for (const s of f.text.split(/(?<=[.!?])\s+/)) assert.ok(s.split(/\s+/).length <= 16, `${f.id}: "${s}"`);
    if (f.gaEnd !== undefined) assert.ok(f.gaEnd < 42 || f.gaDay >= 42, "a span never crosses gaDay 42");
  }
  assert.equal(range(20, 23), "Days 6 to 9 after fertilization (weeks 2 to 3)");
  assert.equal(label(36), "Day 22 after fertilization (week 5)");
  assert.ok(/the NHS compares this to/i.test(FACTS.find((f) => f.id === "root.size").text));
  // every caption fact is shown in a full play, each once, after the clock reaches it (or at its moment's end)
  for (const { evs } of [REF[0], IDLE[0], MID[0]]) {
    const shown = named(evs, "fact").map((e) => e.id);
    assert.deepEqual([...shown].sort(), FACTS.filter((f) => f.where === "caption").map((f) => f.id).sort());
    assert.equal(new Set(shown).size, shown.length, "each once");
  }
});

await check("strings: every id the stage emits exists; no banned words, no pronouns, short sentences", () => {
  const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
  const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
  const texts = [...Object.values(TEXT), ...FACTS.map((f) => f.text)];
  for (const carer of Object.keys(CARERS)) {
    for (const t of texts) {
      const s = fill(t, {}, { carer });
      assert.ok(!BANNED.test(s), `banned word in "${s}"`);
      assert.ok(!PRONOUNS.test(s), `pronoun in "${s}"`);
      for (const sentence of s.split(/(?<=[.!?])\s+/)) assert.ok(sentence.split(/\s+/).length <= 16, `"${sentence}"`);
    }
  }
  for (const id of Object.keys(TEXT)) assert.ok(id.startsWith("root."), id);
  const ids = new Set();
  for (const { evs } of [...REF.slice(0, 2), ...IDLE.slice(0, 2), ...MID.slice(0, 2)]) {
    for (const e of evs) {
      if (e.name === "prompt" && e.text) ids.add(e.text);
      if (e.name === "subgoal") ids.add(e.text);
      if (e.name === "caption") ids.add(e.id);
    }
  }
  for (const id of ids) assert.ok(TEXT[id], `the stage emits ${id}, which has no string`);
  for (const id of named(REF[0].evs, "fact").map((e) => e.id)) assert.ok(FACTS.some((f) => f.id === id), id);
});

await check("events: moments in order, one done, milestones implanted then heart, stage times", () => {
  for (const { evs, st } of [REF[0], IDLE[0], MID[0]]) {
    assert.deepEqual(named(evs, "moment").map((e) => e.id), ["nestle", "roots", "heart", "grow"]);
    assert.equal(named(evs, "done").length, 1);
    assert.deepEqual(named(evs, "milestone").map((e) => e.id), ["implanted", "heart"]);
    for (const e of evs) assert.ok(Number.isFinite(e.t) && e.t >= 0 && e.t <= st.t + 1e-9, `${e.name} at ${e.t}`);
    assert.equal(named(evs, "moment")[0].t, 0, "the first moment at the start");
    assert.ok(named(evs, "prompt")[0].t === 0, "the prompt by 0.5 s");
  }
});

await check("view and probe are pure; p99 step stays small", () => {
  const st = root.create(4, DEFAULT_CARRY, OPTS);
  const input = botInput(1, 4);
  const times = [];
  while (!root.result(st).done) {
    const a = process.hrtime.bigint();
    root.step(st, input(st));
    times.push(Number(process.hrtime.bigint() - a) / 1e6);
    st.events.length = 0;
    if (times.length % 97 === 0) {
      const v1 = JSON.stringify(root.view(st), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
      const v2 = JSON.stringify(root.view(st), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
      assert.equal(v1, v2);
      assert.equal(root.probe(st), null);
    }
  }
  times.sort((x, y) => x - y);
  const p99 = times[Math.floor(times.length * 0.99)];
  assert.ok(p99 <= 2, `p99 step ${p99.toFixed(3)} ms`);
  PERF.p99 = p99;
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const mean = (list) => Math.round(list.reduce((a, p) => a + p.res.score.total, 0) / list.length);
  const meanT = (list) => (list.reduce((a, p) => a + p.st.t, 0) / list.length).toFixed(1);
  console.log(`PASS ${FILE}: ${passed} checks (ideal ${mean(IDEAL)}, ref ${mean(REF)} in ${meanT(REF)} s, mid ${mean(MID)} in ${meanT(MID)} s, idle ${mean(IDLE)} in ${meanT(IDLE)} s; p99 step ${PERF.p99.toFixed(3)} ms)`);
}
