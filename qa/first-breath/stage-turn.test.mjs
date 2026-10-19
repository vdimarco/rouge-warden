// First Breath: stage 7, Third Trimester (`turn`), rebuilt as a survivor-style auto-shooter on the shared action layer
// (openspec/changes/first-breath-action-genres design.md 5.7, contract.md). Plays the stage in node with no DOM (16.11):
// idle, the shared bot at skills 1, 0.7 and 0.5, one-button (botSteer at skill 1 every step) and seeded random input.
// Asserts the meta and the moments; determinism; the gates (skill 1 Great or better, 0.5 completes without a
// knock-out in most seeds, idle knocked out or lasting); the wave table and its calms; the arena easing from 54 to 38
// u; the grow meter's levels with 3 distinct gifts each; each gift's effect; the kick; the Big Germ; the clear at 60 s
// popping every germ; the turn by you and by itself at 6 s with its line; the rest unjudged with the song; a
// knock-out with Go on reaching the rest; the week clock (28 to 40, never back, facts on their days); valid views;
// botSteer; Assist; resume; jump; the carry in; the points adding up; garbage input; the facts and strings.
// node qa/first-breath/stage-turn.test.mjs
import assert from "node:assert/strict";
import * as turn from "../../public/first-breath/core/stages/turn.js";
import { TUNE } from "../../public/first-breath/core/stages/turn.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/turn.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/turn.text.js";
import * as X from "../../public/first-breath/core/lib/action.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { DT, label as clockLabel } from "../../public/first-breath/core/clock.js";
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
const MAX_STEPS = Math.ceil((turn.meta.capS + 5) / DT);
const named = (evs, name) => evs.filter((e) => e.name === name);
const IDS = ["waves", "turn", "rest", "outro"];
const sum = (evs) => named(evs, "points").reduce((a, e) => a + e.add, 0);
const C0 = DEFAULT_CARRY;

// Play one attempt and record what a test needs: every event (with the gaDay, the phase and the world time after its
// step), the prompt at each step, every view's problems, the gaDay after each step and the arena's radius.
function play({ seed = 1, carry = C0, opts = {}, input = null, bot = null, every = 1, before = null, steps = MAX_STEPS } = {}) {
  const st = turn.create(seed, carry, { assist: false, oneButton: false, motherPhase: 0, ...opts });
  const evs = st.events.map((e) => ({ ...e, ga: st.gaDay, phase: st.phase, at: st.A.t, t: st.t }));
  st.events.length = 0;
  const seen = [], bad = [], ga = [], arena = [], foes = [];
  let n = 0;
  for (; n < steps && !turn.result(st).done; n++) {
    if (n % every === 0) {
      const out = validate(turn.view(st));
      if (out.length) bad.push(`t ${st.t.toFixed(2)} ${st.phase}: ${out.join("; ")}`);
    }
    if (before) before(st);
    seen.push({ moment: st.moment, phase: st.phase, prompt: turn.prompt(st), t: st.t });
    const it = bot ? bot.intents(turn, st) : input ? input(st) : makeIntents();
    turn.step(st, it);
    for (const e of st.events) evs.push({ ...e, ga: st.gaDay, phase: st.phase, at: st.A.t, t: st.t });
    st.events.length = 0;
    ga.push({ t: st.t, gaDay: st.gaDay, moment: st.moment, phase: st.phase });
    if (n % 30 === 0 && st.phase === "waves") arena.push({ tw: st.A.t - st.w0, r: st.A.arena.r });
    foes.push(st.A.foes.length);
  }
  const last = validate(turn.view(st));
  if (last.length) bad.push(`last view: ${last.join("; ")}`);
  return { st, evs, seen, bad, ga, arena, foes, res: turn.result(st), steps: n };
}

// The one-button host (core/run.js): botSteer at skill 1 every step, its steer and its dash as a press.
function oneButton(st) {
  const a = turn.botSteer(st, 1, null);
  return makeIntents({ steer: a.steer, touching: true, presses: a.dash ? [{ t: st.t, raw: st.t }] : [] });
}

const IDLE = [1, 2, 3].map((seed) => play({ seed }));
const BOTS = {};
for (const skill of [1, 0.7, 0.5]) BOTS[skill] = Array.from({ length: 10 }, (_, i) => play({ seed: i + 1, bot: createBot(skill, i + 1), every: 6 }));
const REF = BOTS[1];
const ONE = [1, 2, 3].map((seed) => play({ seed, input: oneButton, every: 12 }));
const mean = (rs) => rs.reduce((a, r) => a + r.res.score.total, 0) / rs.length;

await check("meta: stage 7, fit, steer and tap, gaDay 196 to 280, 600 to 700 mm, her 72 bpm, cap 100 s, an action stage that can fail, Go on to the turn", () => {
  const m = turn.meta;
  assert.deepEqual([m.id, m.index, m.name, m.verb, m.orient, m.motherBpm, m.capS, m.canFail, m.scored, m.fertilized, m.action, m.goOn],
    ["turn", 6, "Third Trimester", "Turn", "fit", 72, 100, true, true, true, true, "turn"]);
  assert.deepEqual([...m.families], ["steer", "tap"]);
  assert.deepEqual({ ...m.ga }, { start: 196, end: 280 });
  assert.deepEqual({ ...m.mm }, { start: 600, end: 700 });
  assert.deepEqual(m.moments.map((x) => x.id), IDS);
  assert.deepEqual(m.moments.map((x) => [...x.ga]), [[196, 245], [245, 252], [259, 280], [280, 280]]);
  assert.deepEqual(m.moments.map((x) => x.lenS), [60, 6, 10, 3]);
  assert.ok(m.parS >= 75 && m.parS <= 80 && m.parS <= m.capS, `par ${m.parS}`);
  assert.deepEqual(turn.targets(), []);
});

await check("determinism: the same seed and input give the same events and result, for two seeds", () => {
  for (const seed of [3, 9]) {
    const a = play({ seed, bot: createBot(0.7, seed), every: 60 }), b = play({ seed, bot: createBot(0.7, seed), every: 60 });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}`);
    assert.deepEqual(a.res, b.res);
  }
  assert.notEqual(JSON.stringify(play({ seed: 3, bot: createBot(0.7, 3), every: 60 }).res.metrics),
    JSON.stringify(play({ seed: 4, bot: createBot(0.7, 3), every: 60 }).res.metrics));
});

// ---- the bots ----

await check("the gates: skill 1 Great or better in most seeds (mean at least 8,500); 0.5 completes without a knock-out in most; one-button completes", () => {
  for (const r of REF) assert.deepEqual(r.bad, []);
  const great = REF.filter((r) => r.res.goalMet && gradeOf(r.res.score.total, true) !== "Good").length;
  assert.ok(great >= 9, `skill 1 Great or better in ${great} of 10`);
  assert.ok(REF.filter((r) => r.st.how === "ko").length === 0, "skill 1 is never knocked out");
  assert.ok(mean(REF) >= 8500, `ref mean ${mean(REF)}`);
  assert.ok(BOTS[0.7].filter((r) => r.res.goalMet).length >= 9, "0.7 completes");
  assert.ok(BOTS[0.5].filter((r) => r.st.how !== "ko").length >= 8, `0.5 knocked out: ${BOTS[0.5].map((r) => r.st.how).join(", ")}`);
  assert.ok(mean(REF) >= mean(BOTS[0.5]), `more skill scores more: ${[1, 0.7, 0.5].map((k) => Math.round(mean(BOTS[k])))}`);
  for (const r of ONE) assert.ok(r.res.goalMet && r.st.how === "end", `one-button seed ${r.st.seed}: ${r.st.how}`);
  for (const r of REF) {
    assert.ok(r.st.t > 70 && r.st.t < 90, `ref ${r.st.t.toFixed(1)} s`);
    assert.equal(r.res.metrics.turnedBy, "you", "the ref bot turns itself");
    assert.ok(r.res.metrics.levels >= 3, `levels ${r.res.metrics.levels}`);
  }
  assert.ok(REF.filter((r) => r.res.metrics.bigPopped).length >= 7, "the ref bot pops the Big Germ in most seeds");
});

await check("idle: knocked out at about 30 s (never a game over: goal unmet, the Almost line, Week 40, headDown fired); the points events add up", () => {
  for (const r of IDLE) {
    assert.equal(r.st.how, "ko", `seed ${r.st.seed}: ${r.st.how}`);
    assert.ok(r.res.metrics.koAt > 18 && r.res.metrics.koAt < 45, `knocked out at ${r.res.metrics.koAt}`);
    assert.equal(r.res.goalMet, false);
    assert.equal(r.res.score.goal, 0);
    assert.equal(r.res.metrics.almost, "almost.ko");
    assert.notEqual(say("almost.ko"), "almost.ko");
    assert.equal(r.st.gaDay, 280, "development goes on: the clock reaches the stage's end");
    assert.deepEqual(named(r.evs, "milestone").map((e) => e.id), ["headDown"]);
    assert.equal(gradeOf(r.res.score.total, false), null, "no grade word");
    assert.ok(named(r.evs, "sfx").some((e) => e.id === "act.ko"));
    assert.ok(r.evs.some((e) => (e.name === "caption" && e.id === "turn.sub.rest") || (e.name === "subgoal" && e.text === "turn.sub.rest")), "the rest line");
    assert.equal(named(r.evs, "done").length, 1);
    // it rests until what was said is read, at least koS
    assert.ok(r.st.t - r.res.metrics.koAt >= TUNE.koS - 1e-9);
  }
  for (const r of [...IDLE, ...REF, ...BOTS[0.5], ...ONE]) assert.equal(sum(r.evs), r.res.score.total, `seed ${r.st.seed}: points add up`);
});

// ---- the gesture and the prompts ----

await check("prompts: move in the waves (move, gift, none in the clear), move at the turn, a fresh hold in the rest, words in the outro, none once done", () => {
  const r = REF[0];
  const by = {};
  for (const s of r.seen) (by[s.phase] = by[s.phase] || new Set()).add(`${s.prompt.gesture}:${s.prompt.text}`);
  assert.deepEqual([...by.waves].sort(), ["move:turn.prompt.gift", "move:turn.prompt.move"]);
  assert.deepEqual([...by.clear], ["move:null"]);
  assert.ok(by.turn.has("move:turn.turn") && [...by.turn].every((x) => x === "move:turn.turn" || x === "none:null"), [...by.turn].join());
  assert.deepEqual([...by.rest], ["hold:turn.rest"]);
  assert.deepEqual([...by.outro], ["none:turn.outro"]);
  assert.equal(turn.prompt(r.st).gesture, "none");
  for (const id of ["turn.prompt.move", "turn.turn", "turn.prompt.gift"]) {
    assert.ok(say(id + ".keys") !== id + ".keys" && say(id + ".one") !== id + ".one", `${id} has its forms`);
  }
  assert.equal(say("turn.rest"), "Rest. Touch and hold if you like.");
});

await check("sub-goals: grow (gather sparkles) and the Big Germ, each shown then settled by you or by itself", () => {
  for (const r of [REF[0], REF[1], IDLE[0]]) {
    const shown = named(r.evs, "subgoal").filter((e) => e.state === "shown").map((e) => e.id);
    const settled = named(r.evs, "subgoal").filter((e) => e.state !== "shown").map((e) => e.id);
    assert.deepEqual([...shown].sort(), [...settled].sort(), `seed ${r.st.seed}: every shown sub-goal settles`);
    assert.ok(shown.includes("grow"));
  }
  assert.ok(named(REF[0].evs, "subgoal").some((e) => e.id === "big" && e.state === "shown"));
});

// ---- the waves ----

await check("the wave table: drifters, puffers, swarmer rings at 26, 34 and 40 s, the Big Germ at 48 s; no spawn in each 1 s calm", () => {
  const st = turn.create(1, C0, { motherPhase: 0 });
  const rows = st.rows;
  const count = (kind, a, b) => rows.filter((r) => r.kind === kind && r.at >= a && r.at < b).length;
  assert.equal(count("drifter", 0, 12), 10);
  assert.equal(count("drifter", 12, 24), 13);
  assert.equal(count("puffer", 12, 24), 2);
  assert.equal(count("puffer", 24, 36), 2);
  assert.equal(count("drifter", 36, 48), 19);
  assert.equal(count("puffer", 36, 48), 3);
  assert.equal(count("drifter", 48, 60), 14);
  assert.deepEqual(rows.filter((r) => r.kind === "ring").map((r) => r.at), [26, 34, 40]);
  assert.deepEqual(rows.filter((r) => r.kind === "big").map((r) => r.at), [48]);
  for (const k of TUNE.calms) assert.deepEqual(rows.filter((r) => r.kind !== "big" && r.at >= k && r.at < k + 1), [], `the calm at ${k} s`);
  assert.ok(rows.every((r) => r.at < 60));
  // in play: the foe cap of 40 (with a swarmer ring's few extra) and the foe spark cap of 50
  for (const r of [...REF, ...BOTS[0.5]]) assert.ok(Math.max(...r.foes) <= TUNE.foeCap + 4 + TUNE.big.adds, `foes ${Math.max(...r.foes)}`);
  const swells = named(REF[0].evs, "sfx").filter((e) => e.id === "swell").map((e) => Math.round(e.at));
  assert.deepEqual(swells, TUNE.calms, "a soft swell opens each calm");
});

await check("the arena eases from 54 to 38 u between 20 and 55 s (It gets snug in here.)", () => {
  const a = REF[0].arena;
  for (const q of a) {
    if (q.tw <= 20) near(q.r, 54, 1e-6, `at ${q.tw.toFixed(1)} s`);
    if (q.tw >= 55) near(q.r, 38, 1e-6, `at ${q.tw.toFixed(1)} s`);
  }
  for (let i = 1; i < a.length; i++) assert.ok(a[i].r <= a[i - 1].r + 1e-9, "it never grows back");
  const mid = a.find((q) => q.tw > 36 && q.tw < 39);
  assert.ok(mid && mid.r < 50 && mid.r > 42, `mid ${mid && mid.r}`);
  assert.ok(REF[0].evs.some((e) => e.name === "caption" && e.id === "turn.snug" && e.at >= 19.9 && e.at < 21));
  // you stay inside it
  for (const r of REF) assert.ok(Math.hypot(r.st.A.p.x, r.st.A.p.y) <= TUNE.arena.r1 + 1e-6);
});

await check("the grow meter: levels at 8, 20, 36, 56, 80 and 108 sparkles; each offers 3 distinct gifts, none at its top level; the middle one picks itself after 3 s", () => {
  assert.deepEqual([...TUNE.levels], [8, 20, 36, 56, 80, 108]);
  let offers = 0;
  for (const r of [...REF.slice(0, 4), IDLE[0], ...BOTS[0.5].slice(0, 3)]) {
    const st = turn.create(r.st.seed, C0, { motherPhase: 0 });
    let last = null;
    const bot = r === IDLE[0] ? null : createBot(r.st.seed === IDLE[0].st.seed && r === IDLE[0] ? 0 : 1, r.st.seed);
    for (let n = 0; n < MAX_STEPS && !turn.result(st).done; n++) {
      if (st.offer && st.offer !== last) {
        last = st.offer;
        offers++;
        const ids = st.offer.map((b) => b.id);
        assert.equal(new Set(ids).size, ids.length, "distinct");
        assert.equal(ids.length, 3);
        for (const id of ids) assert.ok((st.gifts[id] || 0) < 3, `${id} is not at its top level`);
        for (const b of st.offer) assert.ok(Math.hypot(b.x, b.y) <= st.A.arena.r - TUNE.gift.bubbleR, "inside the wall");
        assert.ok(st.levelsDue >= 1);
      }
      turn.step(st, bot ? bot.intents(turn, st) : makeIntents());
      st.events.length = 0;
    }
    const M = turn.result(st).metrics;
    const want = TUNE.levels.filter((x) => M.sparkles >= x).length;
    assert.equal(M.levels, want, `levels for ${M.sparkles} sparkles`);
  }
  assert.ok(offers >= 20, `${offers} offers`);
  // idle: the middle one picks itself after 3 s of stage time
  const auto = REF.concat(IDLE).flatMap((r) => r.res.metrics.taken).filter((x) => x.how === "auto");
  assert.ok(IDLE.some((r) => r.res.metrics.taken.length > 0), "idle reaches a level and its gift picks itself");
  assert.ok(auto.length > 0);
  // the level part: 250 a level
  for (const r of REF) assert.equal(r.res.parts.find((p) => p.id === "levels").value, Math.round((1500 * r.res.metrics.levels) / 6));
});

// A fresh state in the waves with one gift offered at your feet; one step takes it.
function withGift(id, seed = 5, opts = {}) {
  const st = turn.create(seed, C0, { motherPhase: 0, ...opts });
  st.rows = [];                          // no germs but the test's own
  st.levelsDue = 1;
  st.offer = [{ id, x: st.A.p.x, y: st.A.p.y, t0: st.t }];
  turn.step(st, makeIntents());
  st.events.length = 0;
  assert.equal(st.gifts[id], (id === "darts" ? 1 : 0) + 1, `${id} taken`);
  assert.equal(st.offer, null);
  return st;
}
const germ = (st, x, y, hp = 3, extra = {}) => X.spawnFoe(st.A, { kind: "germ", ai: "still", x, y, r: 2.8, hp, speed: 0, touch: 0, spawnS: 0, anywhere: true, ...extra });
function run(st, s, it = makeIntents()) { for (let i = 0; i < Math.round(s / DT); i++) { turn.step(st, it); st.events.length = 0; } }

await check("each gift's effect: Darts, Ring, Clump, Beat, Snug, Kick and Grow", () => {
  // Darts: +1 dart a volley, volleys 15% faster
  let st = withGift("darts");
  assert.equal(st.A.fire.spread, 2);
  near(st.A.fire.rate, TUNE.fire.rate * 1.15, 1e-9, "rate");
  // Ring: 2 antibodies orbit at 16 u and pop what they touch (1 a touch, once a germ each 0.4 s)
  st = withGift("ring");
  st.A.fire = null;
  const f = germ(st, st.A.p.x + 16, st.A.p.y, 5);
  run(st, 2.1);
  assert.ok(f.hp < 5 && f.hp >= 5 - Math.ceil(2.1 / TUNE.ring.perS), `ring hits ${5 - f.hp}`);
  // Clump: every 3 s the densest group within 50 u is pulled together and pops for 3 in 12 u
  st = withGift("clump");
  st.A.fire = null;
  const g = [germ(st, 30, 20), germ(st, 34, 22), germ(st, 32, 26), germ(st, -40, -30)];
  run(st, 1.6);
  assert.equal(st.A.foes.filter((x) => g.slice(0, 3).includes(x)).length, 0, "the group popped");
  assert.ok(st.A.foes.includes(g[3]), "the lone germ far off stays");
  assert.equal(st.clumps, 1);
  // Beat: every 4 of her beats, a 30 u pulse: 1 damage and a push back
  st = withGift("beat");
  st.A.fire = null;
  const b = germ(st, st.A.p.x + 20, st.A.p.y, 5, { ai: "chase", speed: 0.001 });
  run(st, (4 * 60) / 72 + 0.2);
  assert.ok(b.hp === 4 && st.pulses === 1, `beat ${b.hp}, pulses ${st.pulses}`);
  assert.ok(b.x > st.A.p.x + 24, `pushed back to ${b.x - st.A.p.x}`);
  // Snug: +1 pip and heal to full
  st = turn.create(5, C0, { motherPhase: 0 });
  st.A.p.hp = 2;
  st.levelsDue = 1;
  st.offer = [{ id: "snug", x: st.A.p.x, y: st.A.p.y, t0: 0 }];
  turn.step(st, makeIntents());
  assert.deepEqual([st.A.p.hp, st.A.p.hpMax], [7, 7]);
  // Kick: the knock-back grows, the cooldown falls by 0.3 s
  st = withGift("kick");
  near(st.A.dash.cdS, 1.1, 1e-9, "kick cooldown");
  // Grow: the sparkle magnet +50%
  st = withGift("grow");
  near(st.A.pick.magnet, 27, 1e-9, "magnet");
  // a gift gives 0.5 s of i-frames as the world comes back to full speed
  assert.ok(st.A.p.inv > 0.3);
});

await check("the bubbles slow the world to a quarter while you move at full speed, and you cannot kick then", () => {
  const st = turn.create(5, C0, { motherPhase: 0 });
  st.rows = [];
  st.levelsDue = 1;
  st.offer = [{ id: "grow", x: 40, y: 0, t0: 0 }, { id: "snug", x: 40, y: 10, t0: 0 }, { id: "beat", x: 40, y: 20, t0: 0 }];
  const A = st.A, t0 = A.t, x0 = A.p.x;
  for (let i = 0; i < 40; i++) { turn.step(st, makeIntents({ steer: { x: -1, y: 0 }, presses: i === 5 ? [{ t: st.t, raw: st.t }] : [] })); st.events.length = 0; }
  near(A.t - t0, 10 * DT, 1e-9, "the world clock at a quarter");
  assert.ok(x0 - A.p.x > 15, `you moved ${x0 - A.p.x} u`);
  assert.equal(st.kicks, 0, "no kick while choosing");
  run(st, 3.1);
  assert.equal(st.offer, null, "it picked itself");
  assert.equal(st.taken[0].id, "snug");
  assert.equal(st.taken[0].how, "auto");
});

await check("the kick: 80 u/s for 0.2 s, back in 1.4 s; germs within 14 u take 1 and are knocked back", () => {
  const st = turn.create(5, C0, { motherPhase: 0 });
  st.rows = [];
  st.A.fire = null;
  const p = st.A.p;
  const a = germ(st, p.x + 9, p.y, 3, { ai: "chase", speed: 0.001 }), far = germ(st, p.x - 30, p.y, 3);
  turn.step(st, makeIntents({ steer: { x: 0, y: 1 }, presses: [{ t: st.t, raw: st.t }] }));
  st.events.length = 0;
  assert.equal(st.kicks, 1);
  assert.equal(a.hp, 2);
  assert.equal(far.hp, 3);
  run(st, 0.6);
  assert.ok(Math.hypot(a.x - p.x, a.y - p.y) > 20, "knocked back");
  near(st.A.dash.cdS, 1.4, 1e-9, "cooldown");
  near(st.A.dash.speed, 80, 1e-9, "speed");
});

await check("the Big Germ: from the far edge at 48 s with a 1.2 s tell; its ring, its swarmers, a second phase at half hp; popping it before 60 s is the Flourish", () => {
  for (const r of REF.slice(0, 5)) {
    const tw = named(r.evs, "subgoal").find((e) => e.id === "big" && e.state === "shown");
    assert.ok(tw && Math.abs(tw.at - 48) < 0.05, "it comes at 48 s");
    if (r.res.metrics.bigPopped) {
      assert.equal(r.res.score.flourish, 1000);
      assert.ok(r.res.metrics.bigAt < 60);
      assert.ok(named(r.evs, "sfx").some((e) => e.id === "act.win" && e.at < 60));
      assert.ok(named(r.evs, "sfx").filter((e) => e.id === "act.phase").length >= 2, "its arrival and its second phase");
    } else assert.equal(r.res.score.flourish, 0);
  }
  const st = turn.create(2, C0, { motherPhase: 0 });
  st.A.p.inv = 1e9;
  st.rows = st.rows.filter((r) => r.kind === "big").map((r) => ({ ...r, at: 0 }));
  st.A.fire = null;
  run(st, 0.1);
  const f = st.A.foes.find((x) => x.boss);
  assert.ok(f && f.hp === 60 && Math.hypot(f.x - st.A.p.x, f.y - st.A.p.y) > 40, "far from you");
  run(st, 5.6);
  assert.ok(st.A.foes.filter((x) => x.kind === "spore").length >= 2, "its swarmers, 4 s after its tell");
  assert.ok(st.A.b.n > 0, "its ring");
  X.damageFoe(st.A, f, 31, 0, 0);
  run(st, 0.3);
  assert.equal(f.phase, 1);
  assert.equal(f.gun.burst, 2);
  assert.equal(turn.view(st).action.boss.phase, 1);
});

await check("the clear at 60 s: every germ left pops, every sparkle is pulled in, the pips and the popped share are scored, and nothing after counts", () => {
  for (const r of REF.slice(0, 4)) {
    const c = r.evs.find((e) => e.phase === "clear");
    assert.ok(c && Math.abs(c.at - 60) < 0.05, "at 60 s of the world clock");
    assert.ok(r.evs.some((e) => (e.name === "caption" && e.id === "turn.clear") || (e.name === "subgoal" && e.text === "turn.clear")));
    const after = r.evs.filter((e) => e.phase !== "waves" && e.name === "points" && e.part === "skill");
    // the clear adds the pips and the popped share at once; then only the turn's 1,000
    const pips = r.res.parts.find((p) => p.id === "pips").value;
    assert.equal(pips, Math.round((1000 * r.res.metrics.hp) / r.res.metrics.hpMax));
    assert.ok(after.every((e) => e.phase === "clear" || e.add === 1000), JSON.stringify(after.map((e) => [e.phase, e.add])));
    const i = r.ga.findIndex((g) => g.phase === "turn");
    assert.ok(i > 0);
  }
  const st = turn.create(4, C0, { motherPhase: 0 });
  st.A.p.inv = 1e9;
  run(st, 1);
  for (let k = 0; k < 6; k++) germ(st, -20 + 8 * k, 20, 50);
  const popped = st.popped;
  st.w0 = st.A.t - 59.99;
  run(st, TUNE.clearS + 0.2);
  assert.equal(st.A.foes.length, 0, "every germ left pops");
  assert.equal(st.popped, popped, "the clear's pops are not yours");
  assert.equal(st.phase, "turn");
});

// ---- the turn, the rest, the outro ----

await check("the turn: drag down 1 s in all and you turn yourself (+1,000); else at 6 s you turn by yourself, with its line", () => {
  const you = turn.create(1, C0, { motherPhase: 0 });
  turn.jump(you, "turn");
  you.events.length = 0;
  const evs = [];
  for (let i = 0; i < 30; i++) { turn.step(you, makeIntents({ steer: { x: 0, y: -1 }, touching: true })); evs.push(...you.events); you.events.length = 0; }
  for (let i = 0; i < 40; i++) { turn.step(you, makeIntents({ steer: { x: 0, y: 0.4 } })); evs.push(...you.events); you.events.length = 0; }
  assert.equal(you.T.by, null, "half a second is not enough");
  for (let i = 0; i < 31; i++) { turn.step(you, makeIntents({ steer: { x: 0.2, y: -0.8 }, touching: true })); evs.push(...you.events); you.events.length = 0; }
  assert.equal(you.T.by, "you");
  assert.ok(evs.some((e) => e.name === "points" && e.add === 1000));
  assert.ok(evs.some((e) => e.name === "fact" && e.id === "turn.head"));
  assert.deepEqual(named(evs, "milestone").map((e) => e.id), ["headDown"]);
  assert.equal(you.gaDay, 252);
  const self = turn.create(1, C0, { motherPhase: 0 });
  turn.jump(self, "turn");
  self.events.length = 0;
  const t0 = self.t, ev2 = [];
  for (let i = 0; i < 9 / DT && self.phase === "turn"; i++) { turn.step(self, makeIntents()); for (const e of self.events) ev2.push({ ...e, t: self.t }); self.events.length = 0; }
  assert.equal(self.T.by, "auto");
  const line = ev2.find((e) => e.name === "caption" && e.id === "turn.auto");
  assert.ok(line && Math.abs(line.t - t0 - 6) < 0.05, "at 6 s, You turn now.");
  assert.ok(ev2.some((e) => e.name === "fact" && e.id === "turn.head"));
  assert.ok(!ev2.some((e) => e.name === "points"), "no points for the turn by itself");
  near(self.T.ang, Math.PI, 0.05, "head-down");
  assert.equal(self.phase, "rest");
  assert.equal(turn.view(self).splats.length > 6, true);
});

await check("the rest: 10 s, not judged (the score does not change), your song hummed; then the outro, Week 40", () => {
  for (const r of [REF[0], BOTS[0.5][0]]) {
    const inRest = r.evs.filter((e) => e.phase === "rest" || e.phase === "outro");
    assert.equal(named(inRest, "points").filter((e) => e.part !== "goal").length, 0, "no points in the rest");
    const song = r.evs.find((e) => e.name === "song");
    assert.ok(song && song.notes.length === 16 && song.noteS === TUNE.rest.noteGapS && song.muffled === true);
    const rs = r.ga.find((g) => g.phase === "rest"), os = r.ga.find((g) => g.phase === "outro");
    near(os.t - rs.t, 10, 0.05, "the rest's length");
    assert.equal(r.st.gaDay, 280);
    assert.equal(clockLabel(r.st.gaDay), "Week 40");
  }
});

await check("a knock-out, then Go on: the turn by itself, the rest and the outro with input ignored; no more points; done with the goal unmet", () => {
  const r = play({ seed: 2 });
  assert.equal(r.st.how, "ko");
  const st = r.st, total = r.res.score.total;
  assert.equal(turn.jump(st, turn.meta.goOn), true);
  assert.equal(st.done, false);
  const evs = [], prompts = new Set();
  for (let i = 0; i < 30 / DT && !turn.result(st).done; i++) {
    turn.step(st, makeIntents({ steer: { x: 0, y: -1 }, touching: true, presses: i % 50 === 0 ? [{ t: st.t, raw: st.t }] : [] }));
    prompts.add(turn.prompt(st).gesture);
    evs.push(...st.events);
    st.events.length = 0;
  }
  const res = turn.result(st);
  assert.equal(res.done, true);
  assert.equal(res.goalMet, false);
  assert.equal(res.metrics.ko, true);
  assert.equal(res.metrics.wentOn, true);
  assert.equal(res.score.total, total, "no points after the knock-out");
  assert.equal(named(evs, "points").length, 0);
  assert.deepEqual([...prompts], ["none"]);
  assert.deepEqual(named(evs, "moment").map((e) => e.id), ["turn", "rest", "outro"]);
  assert.equal(res.metrics.turnedBy, "auto");
  assert.ok(evs.some((e) => e.name === "fact" && e.id === "turn.head") && evs.some((e) => e.name === "fact" && e.id === "turn.curl"));
  assert.ok(evs.some((e) => e.name === "song"));
  assert.equal(named(evs, "milestone").length, 0, "headDown fired once, at the knock-out");
});

// ---- the clock and the captions ----

await check("the clock reads weeks 28 to 40, never runs back, stays in each moment's span; each caption fact comes on or after its day", () => {
  assert.equal(clockLabel(196), "Week 28");
  assert.equal(clockLabel(245), "Week 35");
  assert.equal(clockLabel(280), "Week 40");
  for (const r of [...REF.slice(0, 3), BOTS[0.5][0], IDLE[0]]) {
    for (let i = 1; i < r.ga.length; i++) assert.ok(r.ga[i].gaDay >= r.ga[i - 1].gaDay - 1e-9, `back at ${r.ga[i].t}`);
    for (const g of r.ga) {
      if (g.phase === "ko" || r.st.how === "ko") continue;
      const m = turn.meta.moments.find((x) => x.id === g.moment);
      assert.ok(g.gaDay >= m.ga[0] - 1e-9 && g.gaDay <= m.ga[1] + 1e-9, `${g.moment} ${g.gaDay}`);
    }
    for (const e of named(r.evs, "fact")) {
      const f = FACTS.find((x) => x.id === e.id);
      assert.ok(f && f.where === "caption", e.id);
      assert.ok(e.ga >= f.gaDay - 1e-9, `${e.id} at gaDay ${e.ga}, its day ${f.gaDay}`);
    }
  }
  const sent = named(REF[0].evs, "fact").map((e) => e.id);
  assert.deepEqual(sent, ["turn.antibody", "turn.lungs", "turn.focus", "turn.months", "turn.practice", "turn.head", "turn.curl"]);
  const at = (id) => REF[0].evs.find((e) => e.name === "fact" && e.id === id).at;
  near(at("turn.antibody"), 1, 0.05, "the first darts");
  for (const [id, k] of [["turn.lungs", 12], ["turn.focus", 24], ["turn.months", 36], ["turn.practice", 48]]) assert.ok(at(id) >= k && at(id) < k + 1, `${id} in the ${k} s calm`);
});

// ---- the picture ----

await check("every view is valid: a fit camera on the womb, the anchor and cue on you, the action part (the wall, Ys, hp), the disc and its cord", () => {
  for (const r of [REF[0], IDLE[0], ...ONE]) assert.deepEqual(r.bad, []);
  const st = turn.create(2, C0, { motherPhase: 0 });
  for (let i = 0; i < 240; i++) { turn.step(st, makeIntents({ steer: { x: 0.6, y: 0.2 }, touching: true })); st.events.length = 0; }
  const before = JSON.stringify(st, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : typeof v === "function" ? "[fn]" : v));
  const v = turn.view(st);
  assert.equal(JSON.stringify(st, (k, v2) => (ArrayBuffer.isView(v2) ? Array.from(v2) : typeof v2 === "function" ? "[fn]" : v2)), before, "view is pure");
  assert.deepEqual(validate(v), []);
  assert.equal(v.camera.orient, "fit"); assert.equal(v.camera.span, 140);
  assert.deepEqual(v.anchor, { x: st.A.p.x, y: st.A.p.y });
  assert.ok(v.action && v.action.player && v.action.arena && v.action.hp && v.action.ys === true);
  near(v.action.arena.r, 54, 1e-9, "the wall");
  assert.deepEqual(v.action.hp, { n: st.A.p.hp, max: 6, shield: 0 });
  assert.equal(turn.view(turn.create(2, mergeCarry(C0, { sparks: 5 }), { motherPhase: 0 })).action.hp.shield, 2, "shield pips, up to 2");
  assert.ok(v.strips.some((s) => s.kind === "cord" && s.lights.length > 0), "her antibodies ride the cord");
  // the Tag ring's antibodies are drawn with your darts
  const g = withGift("ring");
  const w = turn.view(g);
  assert.ok(w.action.bullets.n >= 2);
  assert.deepEqual(validate(w), []);
  // the gift bubbles with their tags
  const o = turn.create(3, C0, { motherPhase: 0 });
  o.offer = [{ id: "ring", x: 0, y: 18, t0: 0 }, { id: "clump", x: -15, y: 10, t0: 0 }, { id: "beat", x: 15, y: 10, t0: 0 }];
  o.levelsDue = 1;
  const vo = turn.view(o);
  assert.equal(vo.action.gifts.length, 3);
  assert.deepEqual(vo.action.gifts.map((x) => x.icon), ["orbit", "chain", "bounce"]);
  assert.ok(vo.action.pops.filter((x) => x.word).map((x) => x.word).includes("turn.gift.clump"));
});

// ---- botSteer, Assist, resume, jump, carry ----

await check("botSteer: steer under 1, a dash flag, memory only in r.mem, the state untouched; down at the turn; a hold in the rest; zero when done", () => {
  const st = turn.create(4, C0, { motherPhase: 0 });
  for (let i = 0; i < 600; i++) { turn.step(st, makeIntents()); st.events.length = 0; }
  const ser = () => JSON.stringify(st, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : typeof v === "function" ? "[fn]" : v));
  const before = ser();
  const r = stream(1, "b");
  r.mem = {};
  const a = turn.botSteer(st, 0.6, r);
  assert.ok(Math.hypot(a.steer.x, a.steer.y) < 1);
  assert.equal(typeof a.dash, "boolean");
  assert.equal(ser(), before);
  assert.ok(Object.keys(r.mem).length > 0, "its memory is in r.mem");
  assert.deepEqual(turn.botSteer(st, 1, null), turn.botSteer(st, 1, null), "skill 1 needs no memory");
  const t = turn.create(4, C0, { motherPhase: 0 });
  turn.jump(t, "turn");
  assert.ok(turn.botSteer(t, 1, null).steer.y < -0.9);
  turn.jump(t, "rest");
  assert.equal(turn.botSteer(t, 0.7, stream(2, "b")).hold, true);
  assert.deepEqual(turn.botSteer(REF[0].st, 1, null), { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false });
});

await check("Assist: hp +3, foes 0.75×, foe sparks 0.75× as fast, the kick back 0.7× as soon, the Big Germ 45 hp, levels at 0.8×", () => {
  const st = turn.create(1, C0, { motherPhase: 0, assist: true });
  const plain = turn.create(1, C0, { motherPhase: 0 });
  assert.deepEqual([st.A.p.hp, st.A.p.hpMax], [9, 9]);
  assert.equal(st.A.bulletK, 0.75);
  near(st.A.dash.cdS, 1.4 * 0.7, 1e-9, "kick cooldown");
  assert.ok(st.plan < plain.plan * 0.8, `${st.plan} vs ${plain.plan}`);
  st.rows = st.rows.filter((r) => r.kind === "big").map((r) => ({ ...r, at: 0 }));
  st.A.p.inv = 1e9;
  run(st, 0.1);
  assert.equal(st.A.foes.find((f) => f.boss).hp, 45);
  st.sparkles = 7;
  X.drop(st.A, "up", st.A.p.x, st.A.p.y, 1, 1);
  run(st, 0.5);
  assert.equal(st.level, 1, "level 1 at ceil(8 × 0.8) = 7 sparkles");
  const a = play({ seed: 1, opts: { assist: true }, bot: createBot(0.5, 1), every: 30 });
  assert.equal(a.res.goalMet, true);
});

await check("resume: 1.2 s of i-frames, so a pause never ends in a hit", () => {
  const st = turn.create(1, C0, { motherPhase: 0 });
  turn.resume(st);
  near(st.A.p.inv, 1.2, 1e-9, "i-frames");
});

await check("jump: forward only; each moment starts now with the womb cleared; the clock moves on", () => {
  const st = turn.create(6, C0, { motherPhase: 0 });
  for (let i = 0; i < 300; i++) { turn.step(st, makeIntents()); st.events.length = 0; }
  for (const id of IDS.slice(1)) {
    const g0 = st.gaDay;
    assert.equal(turn.jump(st, id), true);
    assert.equal(st.moment, id);
    assert.equal(st.A.b.n, 0);
    assert.equal(st.A.foes.length, 0);
    assert.ok(st.gaDay >= g0);
    for (let i = 0; i < 30; i++) { turn.step(st, makeIntents()); st.events.length = 0; }
  }
  assert.equal(turn.jump(st, "waves"), false);
  assert.equal(turn.jump(st, "nowhere"), false);
  run(st, 4);
  assert.equal(turn.result(st).done, true);
  assert.equal(turn.result(st).goalMet, true);
});

await check("carry in: the placenta disc sits on the side you nestled, its lobes from treeSeed; shield pips from the sparks; carry out is empty", () => {
  const right = turn.create(1, mergeCarry(C0, { nestleX: 0.8, treeSeed: 77 }), { motherPhase: 0 });
  const left = turn.create(1, mergeCarry(C0, { nestleX: -0.8, treeSeed: 77 }), { motherPhase: 0 });
  const disc = (st) => turn.view(st).splats[0];
  assert.ok(disc(right).x > 0 && disc(left).x < 0 && disc(right).y > 0);
  near(Math.hypot(disc(right).x, disc(right).y), 54 + TUNE.view.disc.out, 1e-9, "on the wall");
  const again = turn.create(1, mergeCarry(C0, { nestleX: 0.8, treeSeed: 77 }), { motherPhase: 0 });
  assert.deepEqual(right.disc.lobes, again.disc.lobes);
  assert.notDeepEqual(right.disc.lobes, turn.create(1, mergeCarry(C0, { nestleX: 0.8, treeSeed: 78 }), { motherPhase: 0 }).disc.lobes);
  assert.deepEqual(turn.result(right).carryOut, {});
  // no germ comes through the placenta
  for (const r of REF.slice(0, 3)) assert.equal(r.st.A.keepOut.length, 1);
});

await check("garbage input never throws, and the stage still ends by its cap", () => {
  for (const seed of [1, 2]) {
    const st = turn.create(seed, C0, { motherPhase: 0 });
    const r = stream(seed, "junk");
    assert.doesNotThrow(() => {
      for (let n = 0; n < MAX_STEPS && !turn.result(st).done; n++) {
        const it = r() < 0.05 ? { steer: { x: NaN, y: "x" }, presses: "no" } : makeIntents({ steer: { x: 4 * r() - 2, y: 4 * r() - 2 }, touching: r() < 0.5,
          presses: r() < 0.3 ? [{ t: st.t + DT * r(), raw: st.t }] : [], releases: r() < 0.2 ? [{ t: st.t }] : [], dir: "up" });
        turn.step(st, it);
        st.events.length = 0;
        if (n % 37 === 0) { assert.deepEqual(validate(turn.view(st)), []); turn.botSteer(st, r(), r); }
      }
    });
    assert.equal(turn.result(st).done, true);
    assert.ok(st.t <= turn.meta.capS + 1e-9);
    assert.equal(st.faults, 0);
  }
});

// ---- facts and strings ----

function sentences(text) { return text.split(/(?<=[.!?])\s+/).filter(Boolean); }
function words(text) { return text.split(/\s+/).filter((w) => /[\w{]/.test(w)).length; }
const BANNED = /\b(die|dies|died|dying|dead|death|lose|loses|losing|lost|loser|nicu)\b|\b(kill|fail|miscarr|abort|sex|pain|hurt|danger|sick|viab|prematur|invad|invas|attack|destroy|defeat|conquer|enem|fight|battle)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;

await check("facts: the card, the captions in priority order, the result and overlay facts; allow-listed sources, access R or A, checked, short", () => {
  assert.deepEqual(FACTS.map((f) => f.id), ["turn.card", "turn.antibody", "turn.lungs", "turn.focus", "turn.months", "turn.practice",
    "turn.curl", "turn.head", "turn.voices", "turn.frame", "turn.voice"]);
  for (const f of FACTS) {
    assert.equal(f.stage, "turn");
    assert.ok(f.gaDay >= 196 && f.gaDay <= 280, f.id);
    assert.ok(f.src.length && f.src.every((k) => SOURCES[k]), `${f.id}: ${f.src}`);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.equal(f.checked, true, f.id);
    assert.ok(!/^(Week|Day)\b/.test(f.text), f.id);
    for (const c of Object.keys(CARERS)) {
      const text = fill(f.text, {}, { carer: c });
      assert.ok(words(text) <= 20, `${f.id}: ${words(text)} words`);
      for (const s of sentences(text)) assert.ok(words(s) <= 16, `${f.id}: "${s}"`);
      assert.ok(!BANNED.test(text) && !PRONOUNS.test(text), `${f.id} (${c})`);
    }
  }
  assert.deepEqual(FACTS.filter((f) => f.where === "card").map((f) => f.id), ["turn.card"]);
  assert.deepEqual(FACTS.filter((f) => f.where === "overlay").map((f) => f.id), ["turn.voice"]);
  assert.deepEqual(FACTS.filter((f) => f.where === "result").map((f) => f.id), ["turn.voices", "turn.frame"]);
});

await check("strings: every id the stage emits is a string; no banned word, no pronoun, no em dash, short sentences, every carer", () => {
  const ids = new Set();
  for (const r of [REF[0], IDLE[0], BOTS[0.5][0]]) {
    for (const e of r.evs) {
      if (e.name === "prompt" && e.text) ids.add(e.text);
      if (e.name === "subgoal") ids.add(e.text);
      if (e.name === "caption" && !FACTS.some((f) => f.id === e.id)) ids.add(e.id);
    }
    for (const p of r.res.parts) ids.add(p.label);
    if (r.res.metrics.almost) ids.add(r.res.metrics.almost);
  }
  for (const id of ids) assert.notEqual(say(id), id, `${id} is registered`);
  for (const [id, s] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("turn."), id);
    assert.ok(!s.includes("—"), `${id} has an em dash`);
    for (const c of Object.keys(CARERS)) {
      const text = fill(s, {}, { carer: c });
      assert.ok(!BANNED.test(text), `banned word in "${text}"`);
      assert.ok(!PRONOUNS.test(text), `pronoun in "${text}"`);
      for (const x of sentences(text)) assert.ok(words(x) <= 16, `"${x}"`);
    }
  }
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const len = (rs) => (rs.reduce((a, r) => a + r.st.t, 0) / rs.length).toFixed(1);
  const kos = (rs) => rs.filter((r) => r.st.how === "ko").length;
  console.log(`PASS ${FILE}: ${passed} checks (ref mean ${Math.round(mean(REF))} in ${len(REF)} s; 0.7 mean ${Math.round(mean(BOTS[0.7]))}; `
    + `0.5 mean ${Math.round(mean(BOTS[0.5]))}, ${kos(BOTS[0.5])} knocked out; one-button ${Math.round(mean(ONE))}; `
    + `idle ${IDLE.map((r) => `${r.st.how} at ${r.res.metrics.koAt.toFixed(1)} s`).join(", ")})`);
}
