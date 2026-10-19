// First Breath: stage 5, First Trimester (`grow`), rebuilt as a twin-stick-style shooter on the shared action layer
// (core/lib/action.js; openspec/changes/first-breath-action-genres/contract.md, where this stage is the worked
// example). Plays the stage in node with no DOM (16.11): idle, the shared bot at skills 1, 0.7 and 0.5, and seeded
// random input. Asserts the meta and the moments (a wave a week, weeks 7 to 12, then the big germ); determinism; the
// ref bot clearing the big germ at Great or better and skill 0.5 completing; idle knocked out (never a game over: the
// stage ends with its goal unmet and the Almost line) or lasting; one live gesture ("move") with its prompts; every
// sub-goal shown and settled; each wave's spawns, telegraphs before every foe pattern, the big germ's three phases in
// order (each change clears the foe shots); growth from food in order; the cord's heal in each rest; the week clock
// (never back, in each moment's span, 97 when met) with the fetus milestone and the caption facts on their weeks;
// valid views with the action part; botSteer (its dash, memory only in r.mem, the state untouched); Assist; the fair
// resume; jump; the carry in; the points events adding up to the score; garbage input never throwing; the facts and
// strings.
// node qa/first-breath/stage-grow.test.mjs
import assert from "node:assert/strict";
import * as grow from "../../public/first-breath/core/stages/grow.js";
import { TUNE } from "../../public/first-breath/core/stages/grow.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/grow.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/grow.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { DT, label as clockLabel, bpmYou } from "../../public/first-breath/core/clock.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { CARERS, fill, say } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/stage-grow.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const MAX_STEPS = Math.ceil((grow.meta.capS + 5) / DT);
const named = (evs, name) => evs.filter((e) => e.name === name);
const IDS = ["wave7", "wave8", "wave9", "wave10", "wave11", "wave12", "boss"];

// Play one attempt and record what a test needs: every event (with the gaDay and world time after its step), the
// prompt at each step, every view's problems, the gaDay after each step, the tells and the foe patterns fired.
function play({ seed = 1, carry = DEFAULT_CARRY, opts = {}, input = null, bot = null, every = 1, before = null } = {}) {
  const st = grow.create(seed, carry, { assist: false, oneButton: false, motherPhase: 0, ...opts });
  const evs = st.events.map((e) => ({ ...e, ga: st.gaDay, at: st.A.t }));
  st.events.length = 0;
  const seen = [], bad = [], ga = [], fires = [], tells = [], phases = [];
  let n = 0;
  for (; n < MAX_STEPS && !grow.result(st).done; n++) {
    if (n % every === 0) {
      const out = validate(grow.view(st));
      if (out.length) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${out.join("; ")}`);
    }
    if (before) before(st);
    seen.push({ moment: st.moment, prompt: grow.prompt(st), t: st.t });
    const it = bot ? bot.intents(grow, st) : input ? input(st) : makeIntents();
    grow.step(st, it);
    for (const o of st.A.out) {
      if (o.type === "fire") fires.push({ x: o.x, y: o.y, t: st.A.t, n: o.n, moment: st.moment });
      if (o.type === "tell") tells.push({ x: o.x, y: o.y, t: st.A.t, kind: o.kind });
    }
    for (const e of st.events) {
      evs.push({ ...e, ga: st.gaDay, at: st.A.t });
      if (e.name === "sfx" && e.id === "act.phase") {
        let foeShots = 0;
        for (let i = 0; i < st.A.b.n; i++) if (st.A.b.side[i] === 2) foeShots++;
        phases.push({ phase: e.pitch, t: st.t, bullets: foeShots });
      }
    }
    st.events.length = 0;
    ga.push({ t: st.t, gaDay: st.gaDay, moment: st.moment, done: st.done });
  }
  const last = validate(grow.view(st));
  if (last.length) bad.push(`last view: ${last.join("; ")}`);
  return { st, evs, seen, bad, ga, fires, tells, phases, res: grow.result(st), steps: n };
}

const IDLE = [1, 2, 3].map((seed) => play({ seed }));
const BOTS = {};
for (const skill of [1, 0.7, 0.5]) BOTS[skill] = Array.from({ length: 10 }, (_, i) => play({ seed: i + 1, bot: createBot(skill, i + 1), every: 6 }));
const REF = BOTS[1];

// ---- meta and moments ----

await check("meta: stage 5, fit, steer and tap, gaDay 49 to 97, 30 to 150 mm, her 72 bpm, cap 120 s, an action stage that can fail", () => {
  const m = grow.meta;
  assert.deepEqual([m.id, m.index, m.name, m.verb, m.orient, m.motherBpm, m.capS, m.canFail, m.scored, m.fertilized, m.action],
    ["grow", 4, "First Trimester", "Grow", "fit", 72, 120, true, true, true, true]);
  assert.deepEqual([...m.families], ["steer", "tap"]);
  assert.deepEqual({ ...m.ga }, { start: 49, end: 97 });
  assert.deepEqual({ ...m.mm }, { start: 30, end: 150 });
  assert.deepEqual(m.moments.map((x) => x.id), IDS);
  m.moments.forEach((x, i) => {
    if (i < 6) { assert.deepEqual([...x.ga], [49 + 7 * i, 56 + 7 * i]); near(x.lenS, TUNE.waveS + TUNE.restS, 1e-9, x.id); }
    else { assert.deepEqual([...x.ga], [91, 97]); near(x.lenS, TUNE.bossInS + TUNE.bossS, 1e-9, x.id); }
  });
  assert.ok(m.parS > 0 && m.parS <= m.capS);
});

await check("determinism: the same seed and input give the same events and result, for two seeds", () => {
  for (const seed of [3, 9]) {
    const a = play({ seed, bot: createBot(0.7, seed), every: 30 }), b = play({ seed, bot: createBot(0.7, seed), every: 30 });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}`);
    assert.deepEqual(a.res, b.res);
  }
  assert.notEqual(JSON.stringify(play({ seed: 3, bot: createBot(0.7, 3), every: 60 }).res.metrics), JSON.stringify(play({ seed: 4, bot: createBot(0.7, 3), every: 60 }).res.metrics));
});

// ---- the bots ----

await check("the shared bot: skill 1 clears the big germ in every seed, Great or better in at least 8 of 10 (sim.test.mjs holds the 18 of 20 gate); 0.7 a mean of Great; 0.5 completes, rarely Glowing", () => {
  const mean = (rs) => rs.reduce((a, r) => a + r.res.score.total, 0) / rs.length;
  for (const r of REF) {
    assert.deepEqual(r.bad, []);
    assert.equal(r.st.how, "boss", `seed ${r.st.seed}: ${r.st.how} at ${r.st.t.toFixed(1)} s`);
    assert.equal(r.res.goalMet, true);
  }
  const good1 = REF.filter((r) => gradeOf(r.res.score.total, true) === "Good").map((r) => `seed ${r.st.seed} ${r.res.score.total}`);
  assert.ok(good1.length <= 2, `ref Good in ${good1.join(", ")}`);
  assert.ok(mean(REF) >= 7500, `ref mean ${mean(REF)}`);
  assert.ok(mean(BOTS[0.7]) >= 6500, `0.7 mean ${mean(BOTS[0.7])}`);
  // the peak of the run (design.md 3.2, 4.5): the hits decide the grade, so a weaker player rarely glows
  const glow5 = BOTS[0.5].filter((r) => r.res.goalMet && gradeOf(r.res.score.total, true) === "Glowing").length;
  assert.ok(glow5 <= 3, `0.5 Glowing in ${glow5} of 10`);
  assert.ok(BOTS[0.7].filter((r) => r.res.goalMet).length >= 9, "0.7 completes");
  assert.ok(BOTS[0.5].filter((r) => r.res.goalMet).length >= 9, `0.5 completes: ${BOTS[0.5].map((r) => r.st.how).join(", ")}`);
  // the hits decide the grade, and the shared bot dodges about as well at 0.7 as at 1 here (over 100 seeds about 0.8
  // hits each, 0.5 about 3), so 1 and 0.7 each outscore 0.5; the run's totals keep 1 over 0.7 (sim.test.mjs)
  assert.ok(Math.min(mean(REF), mean(BOTS[0.7])) > mean(BOTS[0.5]), `more skill scores more: ${[1, 0.7, 0.5].map((k) => Math.round(mean(BOTS[k])))}`);
  // the stage runs 70 to 110 s for the ref bot
  for (const r of REF) assert.ok(r.st.t > 70 && r.st.t < 110, `ref ${r.st.t.toFixed(1)} s`);
});

await check("idle: knocked out (never a game over: goal unmet, the Almost line) or it lasts; the points events add up", () => {
  for (const r of IDLE) {
    assert.ok(r.st.t <= grow.meta.capS + 1e-9);
    if (r.st.how === "ko") {
      assert.equal(r.res.goalMet, false);
      assert.equal(r.res.score.goal, 0);
      assert.equal(r.res.metrics.ko, true);
      assert.equal(r.res.metrics.almost, "almost.ko");
      assert.notEqual(say("almost.ko"), "almost.ko");
      assert.ok(Number.isFinite(r.res.metrics.koAt));
      assert.equal(r.st.gaDay, 97, "development goes on: the clock reaches the stage's end");
      assert.deepEqual(named(r.evs, "milestone").map((e) => e.id), ["fetus"], "its milestone fires once either way");
      assert.equal(gradeOf(r.res.score.total, r.res.goalMet), null, "no grade word");
      assert.ok(named(r.evs, "sfx").some((e) => e.id === "act.ko"));
    } else assert.equal(r.res.goalMet, true);
    assert.equal(named(r.evs, "done").length, 1);
    const sum = named(r.evs, "points").reduce((a, e) => a + e.add, 0);
    assert.equal(sum, r.res.score.total, `seed ${r.st.seed}: points ${sum} vs total ${r.res.score.total}`);
  }
  assert.ok(IDLE.some((r) => r.st.how === "ko"), "standing still is knocked out");
  for (const r of [...REF, ...BOTS[0.5]]) {
    const sum = named(r.evs, "points").reduce((a, e) => a + e.add, 0);
    assert.equal(sum, r.res.score.total, `points add up: ${sum} vs ${r.res.score.total}`);
  }
});

// ---- the live gesture and the prompts ----

await check("one live gesture: move in every moment, its prompt by phase (move, dash, rest, the big germ, no words in the victory beat), none once done", () => {
  const r = REF[0];
  const texts = new Set();
  for (const s of r.seen) { assert.equal(s.prompt.gesture, "move", `${s.moment} at ${s.t.toFixed(2)}`); if (s.prompt.text) texts.add(s.prompt.text); }
  assert.deepEqual([...texts].sort(), ["grow.prompt.boss", "grow.prompt.dash", "grow.prompt.move", "grow.prompt.rest"]);
  assert.equal(grow.prompt(r.st).gesture, "none");
  for (const p of named(r.evs, "prompt")) if (p.text) assert.notEqual(say(p.text), p.text, `${p.text} is registered`);
  assert.deepEqual(named(r.evs, "moment").map((e) => e.id), IDS);
  assert.deepEqual(grow.targets(r.st, 5), [], "no timed targets");
});

await check("every sub-goal is shown, then ends done or auto, with its events (clear, food, dash, the big germ)", () => {
  for (const r of [REF[0], IDLE[0], BOTS[0.5][0]]) {
    const subs = named(r.evs, "subgoal");
    const ids = [...new Set(subs.map((e) => e.id))];
    for (const id of ids) {
      const states = subs.filter((e) => e.id === id).map((e) => e.state);
      assert.equal(states[0], "shown", id);
      assert.ok(states.length === 2 && ["done", "auto"].includes(states[1]), `${id}: ${states}`);
    }
    for (const e of subs) assert.notEqual(say(e.text), e.text, `${e.text} is registered`);
  }
  const ref = named(REF[0].evs, "subgoal");
  for (const id of ["clear", "food", "boss"]) assert.ok(ref.some((e) => e.id === id && e.state === "done"), `ref: ${id} done by you`);
  // the ref bot dashes only when a shot is about to land (it dodges most of them by moving): in most seeds it has
  const dashed = REF.filter((r) => named(r.evs, "subgoal").some((e) => e.id === "dash" && e.state === "done")).length;
  assert.ok(dashed >= 5, `ref: dash done by you in ${dashed} of ${REF.length}`);
});

// ---- waves, telegraphs, the big germ ----

await check("waves: each wave's rows spawn, kept clear of the placenta; a wave ends cleared or at 11 s, then a 2.2 s rest", () => {
  const r = REF[1];
  const starts = named(r.evs, "moment").map((e) => e.at);
  for (let i = 0; i < 6; i++) {
    const len = starts[i + 1] - starts[i];
    assert.ok(len <= TUNE.waveMaxS + TUNE.restS + 0.05 && len >= TUNE.restS + 1, `wave ${i + 7}: ${len.toFixed(2)} s`);
  }
  const want = TUNE.waves.reduce((a, rows) => a + rows.reduce((b, x) => b + x[2], 0), 0);
  assert.ok(r.st.A.spawned >= want + 1, `spawned ${r.st.A.spawned} of ${want} and the big germ`);
  // a spawn tell ("spot") never lands within keepOut of the placenta's angle (the boss's buds come from the boss)
  const k = TUNE.keepOut * 2 * Math.PI;
  for (const t of r.tells) {
    if (t.kind !== "spot" || Math.hypot(t.x, t.y) < TUNE.arena.r - 10) continue;
    const d = Math.abs(Math.atan2(Math.sin(Math.atan2(t.y, t.x) - r.st.pcAng), Math.cos(Math.atan2(t.y, t.x) - r.st.pcAng)));
    assert.ok(d >= k - 1e-6, `a spawn at ${d.toFixed(2)} rad from the placenta`);
  }
});

await check("telegraphs: every foe pattern fires from a place that showed a tell at least 0.5 s before", () => {
  for (const r of [REF[0], BOTS[0.5][2]]) {
    assert.ok(r.fires.length > 30, `${r.fires.length} patterns`);
    for (const f of r.fires) {
      const ok = r.tells.some((t) => t.kind !== "spot" && f.t - t.t >= 0.45 - 1e-9 && f.t - t.t <= 3);
      assert.ok(ok, `${f.moment} at ${f.t.toFixed(2)}: no tell before`);
    }
  }
});

await check("the big germ: three phases in order, each change clearing the foe shots; clearing it ends the stage at gaDay 97", () => {
  for (const r of REF.slice(0, 5)) {
    assert.deepEqual(r.phases.map((p) => p.phase), [1, 2], `seed ${r.st.seed}`);
    for (const p of r.phases) assert.equal(p.bullets, 0, "the change clears the foe shots");
    assert.ok(named(r.evs, "sfx").some((e) => e.id === "act.clear" && e.gain === 1), "the big germ's clear");
    assert.equal(r.st.gaDay, 97);
    assert.equal(r.st.A.foes.length, 0);
  }
});

await check("the victory beat: the big germ's clear plays act.win, pops what is left, says it is gone, and the stage ends outroS later", () => {
  for (const r of REF.slice(0, 5)) {
    const clear = named(r.evs, "sfx").find((e) => e.id === "act.clear" && e.gain === 1);
    const win = named(r.evs, "sfx").find((e) => e.id === "act.win");
    assert.ok(clear && win && Math.abs(win.at - clear.at) < 0.05, `seed ${r.st.seed}: act.win as the big germ clears`);
    const gone = named(r.evs, "subgoal").find((e) => e.id === "boss" && e.state === "done");
    assert.ok(gone && Math.abs(gone.at - win.at) < 0.05, "the big germ is gone, at once");
    const done = named(r.evs, "done")[0];
    assert.ok(done && Math.abs(done.at - win.at - TUNE.outroS) < 0.1, `done ${done && done.at} after the win at ${win.at}`);
    // in the beat: you can still move (the move gesture, no words), no foe shot is left, the thumb pose
    const beat = r.seen.filter((x) => x.t > r.st.oT0 + 0.05 && x.t < r.st.doneT - 0.05);
    assert.ok(beat.length > 30 && beat.every((x) => x.prompt.gesture === "move" && x.prompt.text === null), "the move gesture, no words");
  }
});

await check("growth: food passes its totals and each step changes the sparks in order; the cord heals in each rest", () => {
  const r = REF[0];
  assert.equal(r.st.grow, TUNE.growAt.length);
  const F = r.st.A.fire;
  const full = Object.assign({ rate: TUNE.fire.rate, spread: TUNE.fire.spread, pierce: TUNE.fire.pierce, dmg: TUNE.fire.dmg }, ...TUNE.grows);
  assert.deepEqual([r.st.rate, F.spread, F.pierce, F.dmg], [full.rate, full.spread, full.pierce, full.dmg]);
  near(F.rate, full.rate * bpmYou(r.st.gaDay) / TUNE.heartBpm, 0.1, "your heart powers your sparks (set at the last step's start)");
  assert.equal(named(r.evs, "sfx").filter((e) => e.id === "act.up").length, TUNE.growAt.length);
  // the cord's heal: in a rest with hp below full it heals 1
  const st = grow.create(5, DEFAULT_CARRY, { motherPhase: 0 });
  st.A.p.hp = 2;
  st.A.foes.length = 0;
  grow.jump(st, "wave7");
  st.W.i = st.W.rows.length;                         // nothing more spawns: the wave ends cleared
  for (let i = 0; i < 60 * 5 && st.phase !== "wave" || i < 90; i++) { grow.step(st, makeIntents()); st.events.length = 0; if (st.moment === "wave8") break; }
  assert.equal(st.A.p.hp, 3, "the cord brought a heal");
});

// ---- the clock ----

await check("the clock: gaDay never runs back, stays in each moment's span, reaches 97 when met; fetus at week 10; captions", () => {
  for (const r of [REF[0], BOTS[0.5][0], IDLE[0]]) {
    let prev = 49;
    for (const g of r.ga) {
      assert.ok(g.gaDay >= prev - 1e-9, `back at ${g.t.toFixed(2)}`);
      prev = g.gaDay;
      if (g.done) { assert.equal(g.gaDay, 97, "the end sets the clock to 97"); continue; }
      const m = grow.meta.moments.find((x) => x.id === g.moment);
      assert.ok(g.gaDay >= m.ga[0] - 1e-9 && g.gaDay <= m.ga[1] + 1e-9, `${g.moment} ${g.gaDay}`);
    }
    assert.equal(r.st.gaDay, 97);
  }
  const ms = named(REF[0].evs, "milestone");
  assert.deepEqual(ms.map((e) => e.id), ["fetus"]);
  assert.equal(clockLabel(ms[0].ga), "Week 10");
  const caps = named(REF[0].evs, "fact").map((e) => [e.id, clockLabel(e.ga)]);
  assert.deepEqual(caps, [["grow.w8", "Week 8"], ["grow.arms", "Week 8"], ["grow.peak", "Week 9"], ["grow.fetus", "Week 10"],
    ["grow.w11", "Week 11"], ["grow.w12", "Week 12"]]);
  for (const [id] of caps) assert.equal(FACTS.find((f) => f.id === id).where, "caption");
});

// ---- the picture ----

await check("every view is valid: a fit camera on the sac, the anchor and cue on you, the action part with hp", () => {
  for (const r of [REF[0], IDLE[0]]) assert.deepEqual(r.bad, []);
  const st = grow.create(2, DEFAULT_CARRY, { motherPhase: 0 });
  for (let i = 0; i < 240; i++) { grow.step(st, makeIntents({ steer: { x: 0.6, y: 0.2 }, touching: true })); st.events.length = 0; }
  const v = grow.view(st);
  assert.deepEqual(validate(v), []);
  assert.equal(v.camera.orient, "fit"); assert.equal(v.camera.x, 0); assert.equal(v.camera.y, 0); assert.equal(v.camera.span, TUNE.view.span);
  near(v.camera.mmPerU * v.camera.span, 30 * Math.pow(5, (st.gaDay - 49) / 48), 1e-6, "the sac to scale");
  assert.deepEqual(v.anchor, { x: st.A.p.x, y: st.A.p.y });
  assert.deepEqual(v.cue, v.anchor);
  assert.ok(v.action && v.action.player && v.action.arena && v.action.hp);
  assert.deepEqual(v.action.hp, { n: st.A.p.hp, max: TUNE.player.hp, shield: 0 });
  const sparked = grow.create(2, mergeCarry(DEFAULT_CARRY, { sparks: 5 }), { motherPhase: 0 });
  assert.equal(grow.view(sparked).action.hp.shield, 2, "each Glowing grade so far is a shield pip, up to 2");
  assert.ok(v.splats.length <= 14 && v.splats.length >= 8, "the figure");
  assert.ok(v.strips.some((s) => s.kind === "cord") && v.strips.some((s) => s.kind === "tree"));
});

// ---- botSteer, Assist, resume, jump, carry ----

await check("botSteer: dodging steer under 1, a dash flag, memory only in r.mem, the state untouched; zero when done", () => {
  const st = grow.create(4, DEFAULT_CARRY, { motherPhase: 0 });
  for (let i = 0; i < 300; i++) { grow.step(st, makeIntents()); st.events.length = 0; }
  const before = JSON.stringify(st, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : typeof v === "function" ? "[fn]" : v));
  const r = stream(1, "b");
  r.mem = {};
  const a = grow.botSteer(st, 0.6, r);
  assert.ok(Math.hypot(a.steer.x, a.steer.y) < 1);
  assert.equal(typeof a.dash, "boolean");
  assert.equal(a.hold, false);
  assert.equal(JSON.stringify(st, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : typeof v === "function" ? "[fn]" : v)), before);
  assert.ok(Object.keys(r.mem).length > 0, "its memory is in r.mem");
  assert.deepEqual(grow.botSteer(st, 1, null), grow.botSteer(st, 1, null), "skill 1 needs no memory");
  const done = REF[0].st;
  assert.deepEqual(grow.botSteer(done, 1, null), { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false });
});

await check("Assist (the shared rule): hp +3, foe shots 0.75× as fast, the dash back 0.7× as soon, 0.75× the foes", () => {
  const st = grow.create(1, DEFAULT_CARRY, { motherPhase: 0, assist: true });
  const plain = grow.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  assert.equal(st.A.p.hp, 8); assert.equal(st.A.p.hpMax, 8);
  assert.equal(st.A.bulletK, 0.75);
  near(st.A.dash.cdS, plain.A.dash.cdS * 0.7, 1e-9, "dash cooldown");
  assert.deepEqual(grow.view(st).action.hp, { n: 8, max: 8, shield: 0 });
  assert.equal(st.W.rows.length, TUNE.waves[0].reduce((a, r) => a + Math.ceil(r[2] * 0.75), 0));
  assert.equal(plain.W.rows.length, TUNE.waves[0].reduce((a, r) => a + r[2], 0));
});

await check("resume: 1.2 s of i-frames, so a pause never ends in a hit", () => {
  const st = grow.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  grow.resume(st);
  near(st.A.p.inv, 1.2, 1e-9, "i-frames");
});

await check("jump: each moment starts now, with the sac cleared; the clock moves on", () => {
  const st = grow.create(6, DEFAULT_CARRY, { motherPhase: 0 });
  for (let i = 0; i < 200; i++) { grow.step(st, makeIntents()); st.events.length = 0; }
  for (const id of IDS.slice(1)) {
    const g0 = st.gaDay;
    assert.equal(grow.jump(st, id), true);
    assert.equal(st.moment, id);
    assert.equal(st.A.b.n, 0);
    assert.ok(st.gaDay >= g0);
    for (let i = 0; i < 30; i++) { grow.step(st, makeIntents()); st.events.length = 0; }
  }
  assert.equal(grow.jump(st, "nowhere"), false);
  assert.ok(st.boss && st.A.foes.some((f) => f.boss), "the big germ came");
});

await check("carry in: the placenta sits on the side you nestled, its villi grow from treeSeed; carry out is empty", () => {
  const right = grow.create(1, mergeCarry(DEFAULT_CARRY, { nestleX: 0.8, treeSeed: 77 }), { motherPhase: 0 });
  const left = grow.create(1, mergeCarry(DEFAULT_CARRY, { nestleX: -0.8, treeSeed: 77 }), { motherPhase: 0 });
  assert.ok(right.pc.x > 0 && left.pc.x < 0 && right.pc.y > 0);
  near(Math.hypot(right.pc.x, right.pc.y), TUNE.arena.r + TUNE.view.placenta.out, 1e-9, "on the wall");
  const again = grow.create(1, mergeCarry(DEFAULT_CARRY, { nestleX: 0.8, treeSeed: 77 }), { motherPhase: 0 });
  assert.deepEqual(Array.from(right.tree.view), Array.from(again.tree.view));
  assert.deepEqual(grow.result(right).carryOut, {});
});

await check("garbage input never throws, and the stage still ends by its cap", () => {
  for (const seed of [1, 2]) {
    const st = grow.create(seed, DEFAULT_CARRY, { motherPhase: 0 });
    const r = stream(seed, "junk");
    assert.doesNotThrow(() => {
      for (let n = 0; n < MAX_STEPS && !grow.result(st).done; n++) {
        const it = makeIntents({ steer: { x: 4 * r() - 2, y: 4 * r() - 2 }, touching: r() < 0.5,
          presses: r() < 0.3 ? [{ t: st.t + DT * r(), raw: st.t }] : [], releases: r() < 0.2 ? [{ t: st.t }] : [], dir: "up" });
        grow.step(st, it);
        st.events.length = 0;
        if (n % 37 === 0) { assert.deepEqual(validate(grow.view(st)), []); grow.botSteer(st, r(), r); }
      }
    });
    assert.equal(grow.result(st).done, true);
    assert.ok(st.t <= grow.meta.capS + 1e-9);
  }
});

// ---- facts and strings ----

function sentences(text) { return text.split(/(?<=[.!?])\s+/).filter(Boolean); }
function words(text) { return text.split(/\s+/).filter((w) => /[\w{]/.test(w)).length; }
const BANNED = /\b(die|dies|died|dying|dead|death|lose|loses|losing|lost|loser|nicu)\b|\b(kill|fail|miscarr|abort|sex|pain|hurt|danger|sick|viab|prematur|invad|invas|attack|destroy|defeat|conquer|enem|fight|battle)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;

await check("facts: the 15.2 rows, allow-listed sources, access R or A, checked, short, no Week or Day start, sizes say the NHS", () => {
  assert.deepEqual(FACTS.map((f) => f.id), ["grow.w7", "grow.tri", "grow.w8", "grow.arms", "grow.peak", "grow.fetus", "grow.w11",
    "grow.w11kick", "grow.w12", "grow.flow", "grow.never", "grow.w13", "grow.frame"]);
  for (const f of FACTS) {
    assert.equal(f.stage, "grow");
    assert.ok(f.gaDay >= 49 && f.gaDay <= 97, f.id);
    assert.ok(f.src.length && f.src.every((k) => SOURCES[k]), `${f.id}: ${f.src}`);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.equal(f.checked, true, `${f.id} checked`);
    assert.equal(f.where, ["grow.w11kick", "grow.flow", "grow.never", "grow.frame"].includes(f.id) ? "result"
      : ["card", "caption", "overlay"].includes(f.where) ? f.where : "card, caption or overlay", f.id);
    assert.ok(!/^(Week|Day)\b/.test(f.text), f.id);
    for (const c of Object.keys(CARERS)) {
      const text = fill(f.text, {}, { carer: c });
      assert.ok(words(text) <= 20, `${f.id}: ${words(text)} words`);
      for (const s of sentences(text)) assert.ok(words(s) <= 16, `${f.id}: "${s}"`);
      assert.ok(!BANNED.test(text) && !PRONOUNS.test(text), `${f.id} (${c})`);
    }
    if (/\d+(\.\d+)?\s?(mm|cm)/.test(f.text)) assert.ok(/the NHS says/.test(f.text), `${f.id} names the NHS`);
  }
  assert.deepEqual(FACTS.filter((f) => f.where === "card").map((f) => f.id), ["grow.w7", "grow.tri"]);
  assert.deepEqual(FACTS.filter((f) => f.where === "overlay").map((f) => f.id), ["grow.w13"]);
});

await check("strings: every id the stage emits is a string; no banned word, no pronoun, no em dash, short sentences, every carer", () => {
  const ids = new Set();
  for (const r of [REF[0], IDLE[0]]) {
    for (const e of r.evs) {
      if (e.name === "prompt" && e.text) ids.add(e.text);
      if (e.name === "subgoal") ids.add(e.text);
    }
    for (const p of r.res.parts) ids.add(p.label);
    if (r.res.metrics.almost) ids.add(r.res.metrics.almost);
  }
  for (const id of ids) assert.notEqual(say(id), id, `${id} is registered`);
  for (const [id, s] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("grow."), id);
    assert.ok(!s.includes("—"), `${id} has an em dash`);
    for (const c of Object.keys(CARERS)) {
      const text = fill(s, {}, { carer: c });
      assert.ok(!BANNED.test(text), `banned word in "${text}"`);
      assert.ok(!PRONOUNS.test(text), `pronoun in "${text}"`);
      for (const x of sentences(text)) assert.ok(words(x) <= 16, `"${x}"`);
    }
  }
  // every string is used: its own id, its desktop (".keys") or one-button (".one") form, a sub-goal, a part, the Almost line
  for (const id of Object.keys(TEXT)) {
    if (/^grow\.(part|sub)\./.test(id) || id === "grow.almost") continue;
    assert.ok(ids.has(id) || ids.has(id.replace(/\.(keys|one)$/, "")), `${id} is used`);
  }
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const mean = (rs) => Math.round(rs.reduce((a, r) => a + r.res.score.total, 0) / rs.length);
  const len = (rs) => (rs.reduce((a, r) => a + r.st.t, 0) / rs.length).toFixed(1);
  const kos = (rs) => rs.filter((r) => r.st.how === "ko").length;
  console.log(`PASS ${FILE}: ${passed} checks (ref mean ${mean(REF)} in ${len(REF)} s; 0.7 mean ${mean(BOTS[0.7])} in ${len(BOTS[0.7])} s; `
    + `0.5 mean ${mean(BOTS[0.5])}, ${kos(BOTS[0.5])} knocked out; idle ${IDLE.map((r) => `${r.st.how} at ${r.st.t.toFixed(1)} s`).join(", ")})`);
}
