// First Breath: stage 2, The Egg (`egg`), a radial brick breaker with bullet-hell patterns
// (openspec/changes/first-breath-action-genres/design.md 5.2, 4.3 to 4.5, contract.md; tasks 2.1 to 2.13). Kept from
// v1: the moments and the clock, one live gesture per moment, the arc's controls and the arc over a sperm both ways,
// sticking, popping loose and held rivals that never enter, exactly one enter (yours) for every input, now with a
// knock-out and Go on, the gold angle always found, at most 3 nudges and entry by 60 s into the guard, the seal's
// fresh press, the ref bot's 0 nudges, the turn-keys bot near the ref's score share. New: no target, the opening by
// 4.7 s; the glow off the arc at k × 55° and back from the rim; a lost last glow; 1, 2 and 3 hits; a re-forming ring;
// the waves on time or sooner; sparks from W2 on, each pattern after its tell, blocked and returned, a pip and the
// mercy clear, the cap; the gifts; the seal charge; the swarm's phases and drift-off; the rush; the seal by itself; the
// gates of design.md 4.5; every view valid; the facts and strings.
//
// Measured (20 seeds, place 3, Assist off; sim of this file's gates): skill 1 about 9,600 (Glowing in most seeds),
// skill 0.7 about 9,700, skill 0.5 about 9,600 with no knock-out; idle is knocked out about 18 s into the guard. A
// stage takes about 55 s (skill 1) to 60 s (skill 0.5); idle about 30 s, then Go on about 13 s more.
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
import { wrapAngle } from "../../public/first-breath/core/lib/goals.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { say } from "../../public/first-breath/core/text.js";
import { isEvent } from "../../public/first-breath/core/events.js";
import { stream } from "../../public/first-breath/core/rng.js";
import * as X from "../../public/first-breath/core/lib/action.js";

const FILE = "qa/first-breath/stage-egg.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 10).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const RAD = Math.PI / 180;
const MAX_STEPS = Math.ceil((egg.meta.capS + 2) / DT);
const angDist = (a, b) => Math.abs(wrapAngle(a - b));
const carryAt = (place, extra = {}) => mergeCarry(DEFAULT_CARRY, { sperm: { place }, ...extra });
const named = (evs, n) => evs.filter((e) => e.name === n);
const AR = TUNE.arc, FL = TUNE.field, BL = TUNE.ball;
const RC = AR.r + AR.w / 2 + BL.r;

// ---- drivers: each returns the intents for the step [st.t, st.t + DT)
const idle = () => () => makeIntents();
function bot(skill, seed) {
  const b = createBot(skill, seed);
  return (st) => b.intents(egg, st);
}
// garbage and random input
function noise(seed) {
  const r = stream(seed, "noise");
  return (st) => {
    const x = r();
    if (x < 0.1) return { steer: { x: NaN, y: 2 }, presses: [{ t: "x" }], turn: 7 };
    if (x < 0.2) return null;
    return makeIntents({ steer: { x: 2 * r() - 1, y: 2 * r() - 1 }, turn: r() < 0.1 ? 1 : 0,
      presses: r() < 0.05 ? [{ t: st.t + DT * r(), raw: st.t }] : [] });
  };
}
// One-button mode: the bot at skill 1 while held (the run does this; here the stage alone, always held)
function oneButton(seed) {
  const r = stream(seed, "one");
  r.mem = {};
  return (st) => {
    const a = egg.botSteer(st, 1, r);
    return makeIntents({ steer: a.steer, presses: a.dash ? [{ t: st.t, raw: st.t }] : [] });
  };
}
// The ref bot's target, reached only through the turn keys (±1 at 540°/s)
function turnKeys(seed) {
  const r = stream(seed, "keys");
  r.mem = {};
  return (st) => {
    const a = egg.botSteer(st, 1, r);
    const s = a.steer;
    let turn = 0;
    if (Math.hypot(s.x, s.y) > 0.25 && st.guard) {
      const d = wrapAngle(Math.atan2(s.y, s.x) - st.guard.arc.a);
      if (Math.abs(d) > 2.5 * RAD) turn = d > 0 ? -1 : 1;                  // +1 is clockwise (the angle falls)
    }
    return makeIntents({ turn, presses: a.dash ? [{ t: st.t, raw: st.t }] : [] });
  };
}

// Play one stage; goOn: after a knock-out, Go on (jump to meta.goOn) and play it out.
function play(drive, { seed = 1, place = 3, assist = false, phase = 0, carry = null, goOn = true, each = null, card = false } = {}) {
  const st = egg.create(seed, carry || carryAt(place), { motherPhase: phase, assist, card });
  const evs = [];
  let n = 0;
  const run = () => {
    while (!egg.result(st).done && n < MAX_STEPS * 2) {
      const it = drive(st);
      egg.step(st, it);
      if (each) each(st, it);
      evs.push(...st.events);
      st.events.length = 0;
      n++;
    }
  };
  run();
  const first = egg.result(st);
  let wentOn = false;
  if (first.metrics.ko && goOn) {
    assert.equal(egg.jump(st, egg.meta.goOn), true, "Go on jumps to the rush");
    wentOn = true;
    run();
  }
  return { st, evs, res: egg.result(st), first, wentOn };
}

const REF = Array.from({ length: 20 }, (_, i) => play(bot(1, i + 1), { seed: i + 1 }));
const MID = Array.from({ length: 20 }, (_, i) => play(bot(0.7, i + 1), { seed: i + 1 }));
const LOW = Array.from({ length: 20 }, (_, i) => play(bot(0.5, i + 1), { seed: i + 1 }));
const IDLE = [1, 2, 3].map((seed) => play(idle(), { seed }));

await check("meta: the moments (all at gaDay 14), rotate and tap, an action stage that can fail, Go on to the guard", () => {
  assert.deepEqual(egg.meta.moments.map((m) => m.id), ["surge", "open", "sweep", "guard", "enter", "seal", "fusion", "outro"]);
  for (const m of egg.meta.moments) assert.deepEqual([...m.ga], [14, 14]);
  assert.deepEqual([...egg.meta.families], ["rotate", "tap"]);
  assert.equal(egg.meta.action, true);
  assert.equal(egg.meta.canFail, true);
  assert.equal(egg.meta.goOn, "guard");
  assert.equal(egg.meta.capS, 80);
  for (const f of ["create", "step", "view", "prompt", "targets", "botSteer", "probe", "result", "resume", "jump"]) assert.equal(typeof egg[f], "function", f);
});

await check("no target in the stage, and the opening ends by 4.7 s at every phase of her heart (it opens by itself)", () => {
  for (const phase of [0, 0.19, 0.5, 0.83]) {
    const st = egg.create(1, carryAt(3), { motherPhase: phase });
    let guardAt = null;
    for (let i = 0; i < 6 / DT; i++) {
      assert.deepEqual(egg.targets(st, 5), []);
      egg.step(st, makeIntents());
      for (const e of st.events) if (e.name === "moment" && e.id === "guard") guardAt = e.t;
      st.events.length = 0;
    }
    assert.ok(guardAt !== null && guardAt <= 4.7 + 1e-9, `phase ${phase}: the guard at ${guardAt}`);
  }
  for (const p of REF.slice(0, 3)) {
    const open = p.evs.find((e) => e.name === "caption" && e.id === "egg.opens");
    assert.ok(open && open.t <= 2.71, "It opens. on her 3rd beat");
  }
});

await check("the clock: gaDay 14 throughout; fertilized exactly once, at the end of fusion, also after a knock-out and Go on", () => {
  for (const p of [...REF.slice(0, 3), ...IDLE]) {
    const ms = named(p.evs, "milestone").filter((e) => e.id === "fertilized");
    assert.equal(ms.length, 1);
    const fusion = p.evs.find((e) => e.name === "moment" && e.id === "fusion");
    near(ms[0].t, fusion.t + TUNE.fusion.s, DT + 1e-9, "at the end of fusion");
    assert.equal(p.st.gaDay, 14);
  }
  assert.equal(label(14, { fertilized: false }), "Week 2");
});

await check("lengths: ref about 55 s, skill 0.5 at most 66 s, idle knocked out about 18 to 22 s into the guard; all under the cap", () => {
  const len = (ps) => ps.map((p) => p.res.metrics.length);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const ref = mean(len(REF)), low = mean(len(LOW));
  assert.ok(ref >= 45 && ref <= 62, `ref mean ${ref.toFixed(1)} s`);
  assert.ok(low >= ref - 3 && low <= 66, `skill 0.5 mean ${low.toFixed(1)} s`);
  for (const p of [...REF, ...MID, ...LOW, ...IDLE]) assert.ok(p.res.metrics.length <= egg.meta.capS + 1e-9);
  for (const p of IDLE) {
    const guard = p.evs.find((e) => e.name === "moment" && e.id === "guard");
    const ko = p.first.metrics.koAt - guard.t;
    assert.ok(ko >= 12 && ko <= 26, `idle out ${ko.toFixed(1)} s into the guard`);
  }
});

await check("the same seed and input give the same run (idle, the bot, random input)", () => {
  for (const seed of [1, 2]) {
    for (const mk of [() => idle(), () => bot(0.7, seed), () => noise(seed)]) {
      const a = play(mk(), { seed }), b = play(mk(), { seed });
      assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs));
      assert.deepEqual(a.res, b.res);
    }
  }
});

await check("one live gesture per moment: none, none, none, move (keys turn), none, tap, none, none; none in the rest", () => {
  const want = { surge: "none", open: "none", sweep: "none", guard: "move", enter: "none", seal: "tap", fusion: "none", outro: "none" };
  for (const p of REF.slice(0, 3)) {
    const st = egg.create(p.st.seed, carryAt(3), { motherPhase: 0 });
    const drive = bot(1, p.st.seed);
    const seen = {};
    while (!egg.result(st).done) {
      egg.step(st, drive(st));
      const pr = egg.prompt(st);
      if (!st.done && st.phase !== "ko") {
        (seen[st.moment] = seen[st.moment] || new Set()).add(pr.gesture);
        if (st.moment === "guard") assert.equal(pr.keys, "turn");
      }
      st.events.length = 0;
    }
    for (const [m, g] of Object.entries(seen)) assert.deepEqual([...g], [want[m]], m);
  }
  const ko = IDLE[0];
  const after = ko.evs.filter((e) => e.name === "prompt" && e.t >= ko.first.metrics.koAt - 1e-9);
  for (const e of after) assert.equal(e.gesture, "none", "no input after a knock-out");
});

await check("every sub-goal is shown, then ends done or auto, for every input; the rest line after a knock-out", () => {
  for (const p of [...REF.slice(0, 4), ...LOW.slice(0, 4), ...IDLE]) {
    const st = {};
    for (const e of named(p.evs, "subgoal")) {
      if (e.state === "shown") { assert.ok(!st[e.id], `${e.id} shown twice`); st[e.id] = "shown"; }
      else { assert.equal(st[e.id], "shown", `${e.id} ended before it showed`); st[e.id] = e.state; }
      assert.ok(TEXT[e.text], `${e.text} is a stage string`);
    }
    for (const [id, s] of Object.entries(st)) assert.ok(s === "done" || s === "auto", `${id} ${s}`);
  }
  const rest = named(IDLE[0].evs, "subgoal").find((e) => e.text === "egg.rest");
  assert.ok(rest, "Your shell needs a rest.");
  assert.equal(say("egg.rest"), "Your shell needs a rest.");
});

await check("every view is valid (every 10th step of the bots, idle with Go on, random and one-button runs, Assist), with an anchor", () => {
  const bad = [];
  const look = (st, tag) => {
    const d = egg.view(st);
    const v = validate(d);
    if (v.length) bad.push(`${tag} at ${st.t.toFixed(2)}: ${v.slice(0, 3).join("; ")}`);
    assert.ok(d.anchor && Number.isFinite(d.anchor.x));
    assert.ok(d.strips.length <= LIMITS.strips && d.rings.length <= LIMITS.rings && d.marks.length <= LIMITS.marks);
  };
  const each = (tag) => (st) => { if (Math.round(st.t / DT) % 10 === 0) look(st, tag); };
  for (const seed of [1, 2, 3]) {
    play(bot(1, seed), { seed, each: each(`ref ${seed}`) });
    play(bot(0.5, seed), { seed, assist: true, each: each(`0.5 assist ${seed}`) });
    play(idle(), { seed, each: each(`idle ${seed}`) });
    play(noise(seed), { seed, each: each(`noise ${seed}`) });
    play(oneButton(seed), { seed, each: each(`one ${seed}`) });
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

await check("the arc: turn +1 turns it clockwise at 540°/s (720° Assist); turn beats aim, aim beats the stick; Assist widens it to 50°", () => {
  for (const assist of [false, true]) {
    const st = egg.create(1, carryAt(3), { motherPhase: 0, assist });
    egg.jump(st, "guard");
    const a0 = st.guard.arc.a;
    egg.step(st, makeIntents({ turn: 1 }));
    near(wrapAngle(st.guard.arc.a - a0), -(assist ? 720 : 540) * RAD * DT, 1e-9, "turn +1");
    assert.equal(st.guard.arc.live, true, "it wakes on the first input");
    const a1 = st.guard.arc.a;
    egg.step(st, makeIntents({ turn: -1, aim: { x: 0, y: -40 }, steer: { x: 1, y: 0 } }));
    near(wrapAngle(st.guard.arc.a - a1), (assist ? 720 : 540) * RAD * DT, 1e-9, "turn beats aim and steer");
    for (let i = 0; i < 40; i++) egg.step(st, makeIntents({ aim: { x: 0, y: -40 }, steer: { x: 1, y: 0 } }));
    near(angDist(st.guard.arc.a, -Math.PI / 2), 0, 1e-6, "aim beats the stick");
    for (let i = 0; i < 40; i++) egg.step(st, makeIntents({ steer: { x: 0.2, y: 0 } }));
    near(angDist(st.guard.arc.a, -Math.PI / 2), 0, 1e-6, "a stick under 0.25 leaves it still");
    for (let i = 0; i < 40; i++) egg.step(st, makeIntents({ steer: { x: 1, y: 0 } }));
    near(angDist(st.guard.arc.a, 0), 0, 1e-6, "the stick turns it at 720°/s");
    near(egg.probe(st).arc.half, (assist ? 50 : 35) * RAD, 1e-12, "half-width");
  }
});

// A guard with nothing in it: the waves, the glows and the rush held back (for the hand-made checks below).
function bare(seed = 1, opts = {}) {
  const st = egg.create(seed, carryAt(3), { motherPhase: 0, ...opts });
  egg.jump(st, "guard");
  const G = st.guard;
  G.wi = 99; G.swarm = { off: true }; G.calm = true; G.serveAt = null; G.first = false; G.queue = []; G.bricks = [];
  return st;
}
function addRival(st, { theta, r, state = "dive", hits = 1, kind = "plain", v = 12, rush = false }) {
  const G = st.guard;
  const b = { id: "r" + G.nextId, n: G.nextId++, kind, hits, hitsMax: hits, form: null, off: 0, offFrom: 0, offTo: 0, offT0: null,
    state, x: r * Math.cos(theta), y: r * Math.sin(theta), theta, r, born: st.A.t, gx0: 0, gy0: 0, gt0: null, gs: 0, gun: null,
    wind: 0, flash: 0, kick: 0, swarm: false, rush, crack: false, p: 0, hk: 0, vx: 0, vy: 0, v, dir: 1, credit: null,
    settle: null, near: null, tellT0: null, idx: 0 };
  G.bricks.push(b);
  G.came += hits;
  return b;
}
const stepN = (st, n, it = makeIntents()) => { for (let i = 0; i < n; i++) { egg.step(st, typeof it === "function" ? it(st) : it); st.events.length = 0; } };

await check("the arc over a sperm: a diver bounces once its head is within 22 u under the arc, not before; a stuck one pops loose", () => {
  const st = bare();
  st.guard.arc.live = true;
  st.guard.arc.a = 0;
  const b = addRival(st, { theta: 0.1, r: 30, v: 12 });
  let at = null;
  for (let i = 0; i < 120 && at === null; i++) { egg.step(st, makeIntents()); if (b.state === "off") at = b.r; st.events.length = 0; }
  assert.ok(at !== null && at <= AR.reach + 0.5 && at > AR.reach - 0.5, `bounced at ${at}`);
  const st2 = bare();
  const s = addRival(st2, { theta: 2, r: FL.shell, state: "stuck" });
  stepN(st2, 30);
  assert.equal(s.state, "stuck", "a sleeping arc leaves it alone");
  st2.guard.arc.live = true;
  st2.guard.arc.a = 2;
  stepN(st2, 1);
  assert.equal(s.state, "loose", "the arc over a stuck one pops it loose");
});

await check("a rival that finishes burrowing is held at 18 u (a pip) and never enters; exactly one enter, yours, for every input", () => {
  const st = bare();
  const hp = st.A.p.hp;
  const s = addRival(st, { theta: 1, r: FL.shell, state: "stuck" });
  stepN(st, Math.ceil(TUNE.stick.burrowS / DT) + 60);
  assert.equal(s.state, "held");
  near(s.r, TUNE.held.r, 1e-6, "held in the cloud");
  assert.equal(st.A.p.hp, hp - 1, "a held rival costs a pip");
  for (const p of [...REF, ...MID, ...LOW, ...IDLE]) {
    const en = named(p.evs, "enter");
    assert.equal(en.length, 1, `seed ${p.st.seed}: one enter`);
    assert.equal(p.st.guard.gold.state, "entered");
  }
  for (const seed of [1, 2, 3]) {
    const p = play(noise(seed), { seed });
    assert.equal(named(p.evs, "enter").length, 1, "random input");
  }
});

await check("the gold angle: never within 55° of world −y (its path stays above 60% in portrait), 40° of world +y, or the arc's half-width + 30°; always found", () => {
  for (const p of [...REF, ...MID, ...LOW, ...IDLE]) {
    const g = named(p.evs, "goldIn")[0];
    assert.ok(g, "goldIn");
    assert.ok(angDist(g.angle, -Math.PI / 2) > 55 * RAD - 1e-9, `${g.angle} under the thumb`);
    assert.ok(angDist(g.angle, Math.PI / 2) > 40 * RAD - 1e-9, `${g.angle} under the caption band`);
  }
});

await check("nudges: at most 3, then it slips under; the ref bot makes 0 nudges in 20 seeds; entry by 60 s into the guard", () => {
  for (const p of REF) assert.equal(p.res.metrics.nudges, 0, `seed ${p.st.seed}`);
  // an arc parked over your sperm's path the whole time
  for (const seed of [1, 2, 3]) {
    let parked = null;
    const p = play((st) => {
      const g = st.guard && st.guard.gold;
      if (g && g.state !== "entered") parked = g.theta;
      return parked === null ? bot(1, seed)(st) : makeIntents({ aim: { x: 40 * Math.cos(parked), y: 40 * Math.sin(parked) } });
    }, { seed });
    assert.ok(p.res.metrics.nudges <= 3, `${p.res.metrics.nudges} nudges`);
    assert.equal(named(p.evs, "enter").length, 1);
  }
  for (const p of [...REF, ...LOW]) assert.ok(p.res.metrics.enterIn <= TUNE.gold.latestS + 0.1, `enter at ${p.res.metrics.enterIn}`);
});

await check("the glow leaves the arc at k × 55° for k = −1, 0 and 1", () => {
  for (const k of [-1, 0, 1]) {
    const st = bare();
    const G = st.guard;
    G.arc.live = true;
    G.arc.a = 0.4;
    const half = egg.probe(st).arc.half;
    const phi = G.arc.a + k * half * 0.999;
    const r0 = RC + 0.3;
    G.glows.push({ x: r0 * Math.cos(phi), y: r0 * Math.sin(phi), vx: -34 * Math.cos(phi), vy: -34 * Math.sin(phi), s: 34, met: st.A.t, lost: false, stale: false, fadeAt: null, in: null });
    stepN(st, 1);
    const g = G.glows[0];
    const out = Math.atan2(g.vy, g.vx);
    near(wrapAngle(out - phi), k * 0.999 * 55 * RAD, 1e-3, `k ${k}`);
    near(g.s, 35, 1e-9, "1 u/s faster");
  }
});

await check("the rim always sends a glow back to the arc's radius: from 400 random starts, each reaches 18.7 u within 7 s", () => {
  const r = stream(5, "rim");
  for (let i = 0; i < 400; i++) {
    const st = bare();
    const G = st.guard;
    const th = r() * Math.PI * 2, rr = 22 + 24 * r(), dir = r() * Math.PI * 2;
    G.glows.push({ x: rr * Math.cos(th), y: rr * Math.sin(th), vx: 40 * Math.cos(dir), vy: 40 * Math.sin(dir), s: 40, met: st.A.t, lost: false, stale: false, fadeAt: null, in: null });
    let got = false;
    for (let s = 0; s < 7 / DT && !got; s++) { egg.step(st, makeIntents()); st.events.length = 0; got = G.lost > 0; }
    assert.ok(got, `start ${i}: never came back`);
  }
  for (const p of [...REF, ...MID, ...LOW]) assert.equal(p.res.metrics.stale, 0, `seed ${p.st.seed}: a glow went 10 s without the arc`);
});

await check("a lost last glow costs one pip, ends the chain, and a new glow serves 1.0 s later; one of two lost costs nothing", () => {
  const st = bare();
  const G = st.guard;
  G.arc.live = true;
  G.arc.a = Math.PI;
  G.combo = 5; G.comboT = 1;
  const hp = st.A.p.hp;
  G.glows.push({ x: 20, y: 0, vx: -34, vy: 0, s: 34, met: st.A.t, lost: false, stale: false, fadeAt: null, in: null });
  let lostAt = null, servedAt = null;
  for (let i = 0; i < 200; i++) {
    egg.step(st, makeIntents());
    st.events.length = 0;
    if (lostAt === null && G.lost) lostAt = st.A.t;
    if (lostAt !== null && servedAt === null && G.glows.some((g) => !g.lost)) servedAt = st.A.t;
  }
  assert.equal(st.A.p.hp, hp - 1, "one pip");
  assert.equal(G.combo, 0);
  near(servedAt - lostAt, BL.serveS, 2 * DT, "served again");
  const st2 = bare();
  st2.guard.glows.push({ x: 20, y: 0, vx: -34, vy: 0, s: 34, met: st2.A.t, lost: false, stale: false, fadeAt: null, in: null },
    { x: 0, y: 40, vx: 0, vy: 30, s: 30, met: st2.A.t, lost: false, stale: false, fadeAt: null, in: null });
  const hp2 = st2.A.p.hp;
  stepN(st2, 30);
  assert.equal(st2.guard.lost, 1);
  assert.equal(st2.A.p.hp, hp2, "another glow still in play");
});

await check("rivals take 1, 2 and 3 hits and drift off; a capped one cracks on its first hit; nothing is cleared at once", () => {
  for (const [kind, hits] of [["plain", 1], ["tough", 2], ["capped", 3]]) {
    const st = bare();
    const b = addRival(st, { theta: 0, r: 34, state: "form", hits, kind });
    for (let h = 1; h <= hits; h++) {
      st.guard.mine.push({ x: 26, y: 0, vx: 40, vy: 0, age: 0 });
      stepN(st, 20);
      if (h < hits) { assert.equal(b.hits, hits - h); assert.equal(b.state, "form"); if (kind === "capped") assert.equal(b.crack, true); }
    }
    assert.equal(b.state, "off", `${kind} drifts off after ${hits}`);
    stepN(st, 6 / DT);
    assert.ok(!st.guard.bricks.includes(b), "gone past 80 u");
  }
});

await check("a re-forming ring closes its gap within 2 s; one that does not keeps it", () => {
  for (const reform of [true, false]) {
    const st = bare();
    const G = st.guard;
    G.wi = 0;
    // W1's ring, made re-forming here
    const F = { kind: "ring", R: 30, w: 0, ang: 0, reform, swarm: false, members: [] };
    G.forms.push(F);
    for (let i = 0; i < 10; i++) {
      const b = addRival(st, { theta: 0, r: 30, state: "form" });
      b.form = F; b.off = (2 * Math.PI * i) / 10; F.members.push(b);
    }
    G.wi = 99;
    stepN(st, 1);
    st.guard.mine.push({ x: 24, y: 0, vx: 40, vy: 0, age: 0 });
    stepN(st, 10);
    assert.equal(F.members.length, 9);
    stepN(st, Math.ceil(TUNE.brick.reformS / DT) + 1);
    const offs = F.members.map((b) => ((b.off % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
    const gaps = offs.map((o, i) => ((i + 1 < offs.length ? offs[i + 1] : offs[0] + 2 * Math.PI) - o));
    const spread = Math.max(...gaps) - Math.min(...gaps);
    if (reform) near(spread, 0, 1e-6, "evenly spread"); else near(Math.max(...gaps), (4 * Math.PI) / 10, 1e-6, "the gap stays");
  }
});

await check("the waves come on time or sooner (3 or fewer left, never within 4 s of the last); the swarm at 28 s at the latest", () => {
  for (const p of [...REF, ...LOW]) {
    const w = p.res.metrics.waves;
    assert.equal(w.length, 4);
    TUNE.waves.forEach((x, k) => assert.ok(w[k] <= x.at + 2 * DT, `W${k + 1} at ${w[k]}`));
    for (let k = 1; k < w.length; k++) assert.ok(w[k] - w[k - 1] >= TUNE.brick.gapS - 2 * DT || Math.abs(w[k] - TUNE.waves[k].at) <= 2 * DT, `W${k + 1} ${w[k] - w[k - 1]} s after`);
    assert.ok(p.res.metrics.swarmAt <= TUNE.swarm.at + 2 * DT);
  }
  // idle: each wave on time
  for (const p of IDLE) p.res.metrics.waves.forEach((x, k) => near(x, TUNE.waves[k].at, 2 * DT, `idle W${k + 1}`));
});

await check("sparks: none before W2; each pattern after its tell (at least 0.35 s); never over 24 u/s; the cap never passed", () => {
  const bad = [];
  for (const [seed, assist] of [[1, false], [2, false], [3, true]]) {
    const tells = [];
    let first = null;
    play(bot(0.7, seed), { seed, assist, each: (st) => {
      const A = st.A;
      for (const t of A.tells) if (!tells.includes(t)) tells.push(t);
      const n = X.foeBullets(A);
      if (n > (assist ? TUNE.fire.capAssist : TUNE.fire.cap)) bad.push(`${n} sparks`);
      for (let i = 0; i < A.b.n; i++) if (A.b.side[i] === 2 && Math.hypot(A.b.vx[i], A.b.vy[i]) > TUNE.fire.maxSpeed + 1e-6) bad.push("too fast");
      if (n && first === null) first = A.t - st.guard.w0;
      for (const o of A.out) {
        if (o.type !== "fire") continue;
        const ok = tells.some((t) => A.t - t.t0 >= TUNE.fire.tellS - DT - 1e-9 && A.t - t.t0 <= 5 && (Math.hypot(t.x - o.x, t.y - o.y) < 8 || Math.hypot(t.x, t.y) < 1e-6));
        if (!ok) bad.push(`a ${o.kind} at ${A.t.toFixed(2)} with no tell before`);
      }
    } });
    assert.ok(first !== null && first >= TUNE.waves[1].at - 7.5, `the first spark ${first} s into the guard`);
  }
  assert.deepEqual(bad.slice(0, 5), []);
});

await check("the arc blocks a spark and turns it back at 1.3 times its speed; it takes a hit off the rival it meets", () => {
  const st = bare();
  const G = st.guard;
  G.arc.live = true;
  G.arc.a = 0;
  const b = addRival(st, { theta: 0, r: 34, state: "form", hits: 2, kind: "tough" });
  X.addBullet(st.A, 2, 24, 0, -20, 0, { r: 1.4, tone: "foe", life: 5 });
  stepN(st, 18);
  assert.equal(G.blocked, 1);
  near(Math.hypot(G.mine[0].vx, G.mine[0].vy), 20 * TUNE.fire.blockK, 1e-6, "1.3 times its speed");
  assert.ok(G.mine[0].vx > 0, "back outward");
  stepN(st, 60);
  assert.equal(b.hits, 1, "your spark took a hit off it");
  assert.ok(G.charge >= TUNE.charge.perBlock);
  for (const p of REF) assert.ok(p.res.metrics.mineHits > 0, `seed ${p.st.seed}: blocked sparks hit rivals`);
});

await check("a spark on the shell costs one pip, 1.0 s of i-frames, and clears the sparks within 20 u (mercy)", () => {
  const st = bare();
  const hp = st.A.p.hp;
  X.addBullet(st.A, 2, 14, 0, -20, 0, { r: 1.4, tone: "foe", life: 5 });
  X.addBullet(st.A, 2, 0, 19, 0, -1, { r: 1.4, tone: "foe", life: 5 });
  X.addBullet(st.A, 2, 0, -30, 0, -1, { r: 1.4, tone: "foe", life: 5 });
  let hitAt = null;
  for (let i = 0; i < 30 && hitAt === null; i++) { egg.step(st, makeIntents()); st.events.length = 0; if (st.A.p.hp < hp) hitAt = i; }
  assert.equal(st.A.p.hp, hp - 1);
  near(st.A.p.inv, TUNE.shell.invS, 0.1, "i-frames");
  assert.equal(X.foeBullets(st.A), 1, "the one 30 u out is kept");
  assert.ok(st.guard.cracks.length === 1, "a crack shows");
});

await check("each gift is caught only by the arc and does what it says (Multi, Wide, Pierce, Slow, Mend); a missed one does nothing", () => {
  const mk = (kind, onArc) => {
    const st = bare();
    const G = st.guard;
    G.arc.live = true;
    G.arc.a = 1;
    G.glows.push({ x: 30, y: -30, vx: 0, vy: 30, s: 30, met: st.A.t, lost: false, stale: false, fadeAt: null, in: null });
    G.ups.push({ kind, theta: onArc ? 1 : -2, r: 24, t0: st.A.t, done: false, doneAt: null, caught: false });
    return st;
  };
  for (const kind of TUNE.ups.kinds) {
    const miss = mk(kind, false);
    stepN(miss, 90);
    assert.equal(miss.guard.caught, 0, `${kind} missed`);
    const st = mk(kind, true);
    if (kind === "mend") st.A.p.hp -= 1;
    const hp = st.A.p.hp;
    X.addBullet(st.A, 2, -60, 0, 0, 20, { r: 1.4, tone: "foe", life: 20 });
    stepN(st, 40);
    assert.equal(st.guard.caught, 1, `${kind} caught`);
    const A = st.A;
    switch (kind) {
      case "multi": assert.equal(st.guard.glows.filter((g) => !g.lost).length, 3); break;
      case "wide": near(egg.probe(st).arc.half, TUNE.ups.wideDeg * RAD, 1e-12, "wide"); break;
      case "pierce": assert.ok(st.guard.fx.pierce > A.t + TUNE.ups.pierceS - 1.2); break;
      case "slow": {
        let sp = 0;
        for (let i = 0; i < A.b.n; i++) if (A.b.side[i] === 2) sp = Math.hypot(A.b.vx[i], A.b.vy[i]);
        near(sp, 20 * TUNE.ups.slowK, 1e-4, "sparks at 0.6");
        stepN(st, Math.ceil(TUNE.ups.slowS / DT));
        for (let i = 0; i < A.b.n; i++) if (A.b.side[i] === 2) sp = Math.hypot(A.b.vx[i], A.b.vy[i]);
        near(sp, 20, 1e-3, "back to speed");
        break;
      }
      case "mend": assert.equal(A.p.hp, hp + 1); break;
    }
  }
  for (const p of REF) assert.ok(p.res.metrics.caught >= 0);
});

await check("the seal charge: full at 12, keeps 2; a press releases one: every spark turns to gold, rivals inside lose a hit", () => {
  const st = bare();
  const G = st.guard;
  st.subgoals = {};
  G.charge = 11.5;
  G.blocked = 0;
  G.arc.live = true;
  G.arc.a = 0;
  X.addBullet(st.A, 2, 24, 0, -20, 0, { r: 1.4, tone: "foe", life: 5 });
  stepN(st, 30);
  assert.equal(G.charge, 12);
  assert.equal(st.subgoals.charge, "shown", "the first full charge says how");
  G.charge = 30;
  stepN(st, 1);
  for (let i = 0; i < 12; i++) X.addBullet(st.A, 2, 30 * Math.cos(i), 30 * Math.sin(i), 0, 0, { r: 1.4, tone: "foe", life: 9 });
  G.charge = 24;
  const b = addRival(st, { theta: 2, r: 34, state: "form", hits: 2, kind: "tough" });
  egg.step(st, makeIntents({ presses: [{ t: st.t, raw: st.t }] }));
  st.events.length = 0;
  near(G.charge, 12, 1e-9, "one used, one kept");
  stepN(st, Math.ceil(TUNE.charge.waveS / DT) + 2);
  assert.equal(X.foeBullets(st.A), 0, "every spark turned to gold");
  assert.equal(b.hits, 1, "the rival inside lost a hit");
  assert.equal(st.subgoals.charge, "done");
});

await check("the swarm: a bar from 1 down, phases at a third and two thirds of its hits, gone at 4 members or 14 s, taking all with it", () => {
  for (const p of [...REF.slice(0, 8), ...LOW.slice(0, 4)]) {
    const m = p.res.metrics;
    assert.ok(m.swarmAt !== null && m.swarmOffAt !== null);
    assert.ok(m.swarmOffAt - m.swarmAt <= TUNE.swarm.maxS + 2 * DT, `${m.swarmOffAt - m.swarmAt} s`);
  }
  for (const seed of [1, 2, 4]) {
    const phases = [];
    let lastHp = 1, offMembers = null;
    play(bot(1, seed), { seed, each: (st) => {
      const bb = st.A.bossBar;
      if (bb) {
        // the bar at the step its phase changed (a seal wave can take many hits in one step)
        if (!phases.length || phases[phases.length - 1].phase !== bb.phase) phases.push({ phase: bb.phase, hp: bb.hp, before: lastHp, t: st.A.t });
        lastHp = bb.hp;
      }
      if (st.guard.swarm && st.guard.swarm.off && offMembers === null) offMembers = st.guard.bricks.filter((b) => b.swarm && ["form", "dive", "tell", "in"].includes(b.state)).length;
    } });
    assert.deepEqual(phases.map((x) => x.phase), [0, 1, 2], `seed ${seed}: three phases`);
    assert.ok(phases[1].hp <= 2 / 3 + 0.05, `phase 2 at ${phases[1].hp}`);
    assert.ok(phases[2].hp <= 1 / 3 + 0.05, `phase 3 at ${phases[2].hp}`);
    assert.equal(offMembers, 0, "every rival drifts off with it");
  }
});

await check("the rush: your sperm from 75 u, 4 rivals at least 60° from it and each other, at the shell within 1.5 s of yours", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let seen = null;
    play(bot(1, seed), { seed, each: (st) => {
      const G = st.guard;
      if (seen || !G.gold || G.gold.state !== "in" || st.wentOn) return;
      seen = { gold: { theta: G.gold.theta, r: G.gold.r }, rivals: G.bricks.filter((b) => b.rush).map((b) => ({ theta: b.theta, r: b.r })) };
    } });
    assert.ok(seen, "the rush came");
    assert.equal(seen.rivals.length, 4);
    const at = (r) => (r - FL.shell) / TUNE.rush.speed;
    const tg = at(seen.gold.r);
    const all = [seen.gold.theta, ...seen.rivals.map((x) => x.theta)];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(angDist(all[i], all[j]) >= 60 * RAD - 1e-9);
    for (const x of seen.rivals) assert.ok(Math.abs(at(x.r) - tg) <= 1.5 + 1e-9, `${at(x.r) - tg} s`);
  }
  assert.equal(say("egg.letIn"), "Only one may enter. Let yours in.");
});

await check("the seal: only a press after its prompt counts; with none it seals by itself 2.0 s later; Flourish 250 a charge kept", () => {
  const st = egg.create(1, carryAt(3), { motherPhase: 0 });
  egg.jump(st, "seal");
  const prompt = st.seal.prompt;
  egg.step(st, makeIntents({ presses: [{ t: prompt - 0.5, raw: prompt - 0.5 }] }));
  assert.equal(st.seal.sealAt, null, "a press from before the prompt");
  egg.step(st, makeIntents({ presses: [{ t: st.t + 0.004, raw: st.t }] }));
  assert.ok(st.seal.sealAt !== null && !st.seal.auto, "a fresh press seals");
  const p = IDLE[0];
  const s = named(p.evs, "seal")[0];
  const m = p.evs.find((e) => e.name === "moment" && e.id === "seal");
  assert.ok(s.auto && s.t - m.t <= TUNE.seal.autoS + 1e-9, "by itself");
  for (const r of REF) {
    const pts = named(r.evs, "seal")[0];
    assert.ok(!pts.auto, "the ref bot presses");
  }
});

await check("the gates (design.md 4.5): skill 1 Great or better in 18 of 20 and knocked out in at most 1; 0.5 not knocked out in 16 of 20; idle knocked out", () => {
  const great = REF.filter((p) => ["Great", "Glowing"].includes(gradeOf(p.res.score.total, p.res.goalMet))).length;
  assert.ok(great >= 18, `skill 1 Great or better in ${great}`);
  assert.ok(REF.filter((p) => p.first.metrics.ko).length <= 1);
  const lowKo = LOW.filter((p) => p.first.metrics.ko).length;
  assert.ok(lowKo <= 4, `skill 0.5 knocked out in ${lowKo}`);
  assert.ok(MID.filter((p) => p.first.metrics.ko).length <= 2, "skill 0.7");
  for (const p of IDLE) { assert.ok(p.first.metrics.ko, "idle is knocked out"); assert.equal(p.res.goalMet, false); assert.equal(p.res.score.goal, 0); }
  const mean = (ps) => ps.reduce((a, p) => a + p.res.score.total, 0) / ps.length;
  assert.ok(mean(LOW) > mean(IDLE), "skill 0.5 outscores idle");
});

await check("one-button (held): completes with no knock-out in 18 of 20; the turn-keys bot within 0.15 of the ref's score share", () => {
  let ok = 0, keys = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const p = play(oneButton(seed), { seed });
    if (!p.first.metrics.ko && p.res.goalMet) ok++;
    if (seed <= 8) {
      const k = play(turnKeys(seed), { seed });
      keys += Math.abs(k.res.score.total - REF[seed - 1].res.score.total) / 10000;
    }
  }
  assert.ok(ok >= 18, `one-button completes ${ok} of 20`);
  assert.ok(keys / 8 <= 0.15, `the turn-keys bot ${(keys / 8).toFixed(3)} from the ref`);
});

await check("a knock-out: Goal 0, the Skill and Flourish it had; Go on plays your sperm in alone (no rival), seals by itself, adds nothing", () => {
  for (const p of IDLE) {
    assert.ok(p.wentOn);
    const ko = p.first;
    assert.equal(ko.done, true);
    assert.equal(ko.goalMet, false);
    assert.equal(ko.metrics.almost, "almost.ko");
    assert.deepEqual(p.res.score, ko.score, "Go on adds nothing");
    const after = p.evs.filter((e) => e.t > ko.metrics.koAt + 0.01);
    assert.equal(named(after.filter((e) => e.t > ko.metrics.length + 1e-9), "points").length, 0, "no points after the knock-out's end");
    assert.equal(p.st.guard.bricks.filter((b) => b.rush).length, 0, "no rival in the rush");
    const gin = named(after, "goldIn")[0], st = named(after, "stick").find((e) => e.id === "gold");
    assert.ok(st.t - gin.t <= 2 + DT, `it swims in in ${st.t - gin.t} s`);
    assert.ok(named(after, "seal")[0].auto);
  }
});

await check("the score: the points events add up to the result; Goal 3,000; the parts as design.md 5.2 sets them", () => {
  for (const p of [...REF, ...LOW.slice(0, 6), ...IDLE]) {
    const sum = named(p.evs, "points").reduce((a, e) => a + e.add, 0);
    assert.equal(sum, p.res.score.total, `seed ${p.st.seed}`);
    const parts = p.res.parts;
    assert.equal(parts.reduce((a, x) => a + x.max, 0), 10000);
    assert.equal(parts.slice(1, 5).reduce((a, x) => a + x.value, 0), p.res.score.skill, "the Skill parts");
    const m = p.res.metrics;
    if (!m.ko) {
      assert.equal(p.res.score.goal, 3000);
      near(parts[1].value, Math.round(2500 * Math.min(1, m.hits / (0.75 * m.hitsCame))), 1, "rivals' hits");
      near(parts[2].value, Math.round(1500 * m.pipsAtEnter / m.pipsMax), 1, "shell");
      near(parts[3].value, Math.round(1000 * Math.min(1, m.bestCombo / 15)), 1, "chain");
      near(parts[4].value, Math.round(1000 * m.rushCredit), 1, "rush");
    }
  }
  assert.equal(egg.TOTALS.planned, 116);
});

await check("botSteer keeps its memory only in r.mem; at skill 1 its answer depends on the state alone; still outside the guard", () => {
  const st = egg.create(3, carryAt(3), { motherPhase: 0 });
  const r1 = stream(1, "a"); r1.mem = {};
  assert.deepEqual(egg.botSteer(st, 1, r1).steer, { x: 0, y: 0 }, "still in the surge");
  egg.jump(st, "guard");
  stepN(st, 400, bot(1, 3));
  const before = JSON.stringify(egg.result(st));
  const a = stream(9, "b"); a.mem = {};
  const b = stream(10, "c"); b.mem = {};
  assert.deepEqual(egg.botSteer(st, 1, a), egg.botSteer(st, 1, b));
  assert.deepEqual(a.mem, {});
  egg.botSteer(st, 0.4, a);
  assert.equal(JSON.stringify(egg.result(st)), before, "botSteer leaves the state alone");
});

await check("probe gives the guard shape in world units", () => {
  const st = REF[0].st;
  const p = egg.probe(st);
  assert.equal(p.arc.r, 16);
  assert.equal(p.egg.r, 9);
  assert.equal(p.rim, FL.rim);
  assert.equal(p.entered, true);
  assert.ok(Array.isArray(p.sperm));
});

await check("facts: ids, where, allow-listed sources read (R or A), at most 20 words; egg.caps new and checked; 6 captions", () => {
  const ids = new Set();
  for (const f of FACTS) {
    assert.ok(!ids.has(f.id)); ids.add(f.id);
    assert.equal(f.stage, "egg");
    for (const s of f.src) assert.ok(SOURCES[s] || Object.keys(SOURCES).some((k) => k === s), `${f.id}: ${s}`);
    assert.ok(["R", "A"].includes(f.access));
    assert.ok(f.text.split(/\s+/).length <= 20, f.id);
    assert.ok(["caption", "result", "card", "overlay"].includes(f.where));
  }
  assert.ok(FACTS.find((f) => f.id === "egg.caps" && f.checked && f.where === "caption"));
  assert.deepEqual(FACTS.filter((f) => f.where === "caption").map((f) => f.id), ["egg.fimbriae", "egg.zona", "egg.caps", "egg.corona", "egg.fuse", "egg.block"]);
  for (const p of [...REF.slice(0, 3), ...MID.slice(0, 3)]) {
    const sent = named(p.evs, "fact").map((e) => e.id);
    assert.deepEqual(sent, ["egg.fimbriae", "egg.zona", "egg.caps", "egg.corona", "egg.fuse", "egg.block"], "each caption once, in order");
  }
});

await check("strings: every id the stage shows exists; no banned words, no carer pronouns, no race words, and never brick or break", () => {
  const shown = new Set();
  for (const p of [...REF.slice(0, 3), ...IDLE]) for (const e of p.evs) {
    if (e.name === "caption" || (e.name === "prompt" && e.text)) shown.add(e.id || e.text);
    if (e.name === "subgoal") shown.add(e.text);
  }
  for (const id of shown) assert.ok(say(id) !== id, `${id} is a string`);
  const BANNED = /\b(kill|enemy|enemies|attack|fight|battle|hurt|danger|lose|lost|sick|brick|bricks|break|breaks|broke|win|wins|won|winner|fastest|she|her|he|him|his|they|their)\b/i;
  for (const [id, text] of Object.entries(TEXT)) {
    assert.ok(!BANNED.test(text), `${id}: "${text}"`);
    assert.ok(!text.includes("—"), `${id}: an em dash`);
    for (const s of text.split(/[.!?]/)) assert.ok(s.trim().split(/\s+/).length <= 16, `${id}: a long sentence`);
  }
});

await check("no event names harm, and every event is a known name", () => {
  for (const p of [...REF.slice(0, 2), ...IDLE.slice(0, 1)]) for (const e of p.evs) assert.ok(isEvent(e.name), e.name);
});

await check("never throws: garbage intents, odd times, no intents at all; it still ends by the cap", () => {
  for (const seed of [1, 2, 3]) {
    const p = play(noise(seed), { seed });
    assert.equal(p.st.error, null, p.st.error);
    assert.ok(p.res.done);
  }
  const st = egg.create(4, null, {});
  for (let i = 0; i < MAX_STEPS && !st.done; i++) egg.step(st, undefined);
  assert.equal(st.error, null);
  assert.ok(st.done);
});

await check("jump(moment) skips ahead (the moments between end by themselves), never back, and plays on to the end", () => {
  for (const id of ["open", "sweep", "guard", "enter", "seal", "fusion", "outro"]) {
    const st = egg.create(1, carryAt(3), { motherPhase: 0 });
    assert.equal(egg.jump(st, id), true, id);
    assert.equal(st.moment, id);
    assert.equal(egg.jump(st, "surge"), false, "never back");
    stepN(st, MAX_STEPS);
    assert.ok(st.done, `${id}: it ends`);
    assert.equal(st.error, null);
  }
});

await check("resume: 1.2 s in which the shell cannot be hit", () => {
  const st = bare();
  egg.resume(st);
  assert.ok(st.A.p.inv >= 1.2 - 1e-9);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
