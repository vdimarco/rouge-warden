// First Breath: stage 3, The Embryo: first cells (`split`), rebuilt as a roguelike on the shared action layer
// (core/lib/action.js; openspec/changes/first-breath-action-genres/design.md 5.3, contract.md). Plays the stage in node
// with no DOM (16.11): idle, the shared bot at skills 1, 0.7 and 0.5, and seeded random input. Asserts the meta and
// the moments (four day rooms, the Knot, the hatch, the outro); determinism; the splits at each room's end for any
// input with the ball's drawn size unchanged; shots per volley by the cell count; three distinct seeded gifts per
// pick, never one at its top level; a check per gift; a pick by swimming and a pick left alone; the room timer always
// opening the exit; the Knot's phases at 60% and 24% of its hp (each with a tell, a swell and the foe spores
// cleared) and its drift-off at 18 s; the hatch and the clock to Day 6; a knock-out with Go on reaching the hatch;
// one live gesture with its prompts; every sub-goal shown and settled; the points events adding up to the score;
// valid views; botSteer (its memory only in r.mem, the state untouched); Assist; the fair resume; the carry in;
// garbage input never throwing; the facts and strings; and the bot gates (design.md 4.5).
// node qa/first-breath/stage-split.test.mjs
import assert from "node:assert/strict";
import * as split from "../../public/first-breath/core/stages/split.js";
import { TUNE } from "../../public/first-breath/core/stages/split.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/split.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/split.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { DT, label as clockLabel } from "../../public/first-breath/core/clock.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import * as X from "../../public/first-breath/core/lib/action.js";

const FILE = "qa/first-breath/stage-split.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const MAX_STEPS = Math.ceil((split.meta.capS + 5) / DT);
const named = (evs, name) => evs.filter((e) => e.name === name);
const IDS = ["day1", "day2", "day3", "day4", "bloom", "hatch", "outro"];
const total = (r) => r.score.goal + r.score.skill + r.score.flourish;
const OPTS = { assist: false, oneButton: false, motherPhase: 0 };

// Play one attempt and record what a test needs: every event (with the gaDay, phase and world time after its step),
// the prompt at each step, every view's problems, the drawn shell, the splits by phase and the gaDay after each step.
function play({ seed = 1, carry = DEFAULT_CARRY, opts = {}, input = null, bot = null, every = 1, before = null, until = null } = {}) {
  const st = split.create(seed, carry, { ...OPTS, ...opts });
  const evs = st.events.map((e) => ({ ...e, ga: st.gaDay, at: st.A.t, phase: st.phase }));
  st.events.length = 0;
  const seen = [], bad = [], ga = [], shells = [], phases = [];
  let n = 0;
  for (; n < MAX_STEPS && !split.result(st).done && !(until && until(st)); n++) {
    if (n % every === 0) {
      const d = split.view(st);
      const out = validate(d);
      if (out.length) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${out.join("; ")}`);
      const arc = d.strips.find((s) => s.kind === "arc");
      if (arc && !st.cracked) shells.push(arc.r);
    }
    if (before) before(st);
    seen.push({ moment: st.moment, phase: st.phase, prompt: split.prompt(st), t: st.t });
    const it = bot ? bot.intents(split, st) : input ? input(st) : makeIntents();
    split.step(st, it);
    for (const e of st.events) {
      evs.push({ ...e, ga: st.gaDay, at: st.A.t, phase: st.phase });
      if (e.name === "sfx" && e.id === "act.phase") {
        let foeShots = 0;
        for (let i = 0; i < st.A.b.n; i++) if (st.A.b.side[i] === 2) foeShots++;
        const f = st.A.foes.find((g) => g.boss);
        phases.push({ phase: e.pitch, t: st.t, bullets: foeShots, share: f ? f.hp / f.hpMax : null, tells: st.A.tells.map((x) => x.kind) });
      }
    }
    st.events.length = 0;
    ga.push({ t: st.t, gaDay: st.gaDay, moment: st.moment, phase: st.phase, done: st.done });
  }
  const last = validate(split.view(st));
  if (last.length) bad.push(`last view: ${last.join("; ")}`);
  return { st, evs, seen, bad, ga, shells, phases, res: split.result(st), steps: n };
}

// Step a state with idle input until a test says stop (or the stage ends).
function run(st, until, input = () => makeIntents(), max = MAX_STEPS) {
  for (let i = 0; i < max && !st.done && !until(st); i++) { split.step(st, input(st)); st.events.length = 0; }
  return st;
}

const IDLE = [1, 2, 3, 4, 5, 6].map((seed) => play({ seed, every: 3 }));
const BOTS = {};
for (const skill of [1, 0.7, 0.5]) BOTS[skill] = Array.from({ length: 10 }, (_, i) => play({ seed: i + 1, bot: createBot(skill, i + 1), every: 6 }));
const REF = BOTS[1];

await check("meta: stage 3, long, steer and tap, gaDay 15 to 20, 0.45 mm, her 72 bpm, cap 100 s, an action stage that can fail, Go on to the hatch", () => {
  const m = split.meta;
  assert.equal(m.id, "split");
  assert.equal(m.index, 2);
  assert.equal(m.name, "The Embryo: first cells");
  assert.equal(m.orient, "long");
  assert.deepEqual([...m.families], ["steer", "tap"]);
  assert.deepEqual({ ...m.ga }, { start: 15, end: 20 });
  assert.deepEqual({ ...m.mm }, { start: 0.45, end: 0.45 });
  assert.equal(m.motherBpm, 72);
  assert.equal(m.capS, 100);
  assert.equal(m.canFail, true);
  assert.equal(m.action, true);
  assert.equal(m.goOn, "hatch");
  assert.deepEqual(m.moments.map((x) => x.id), IDS);
  assert.deepEqual(m.moments.map((x) => [...x.ga]), [[15, 16], [16, 17], [17, 18], [18, 19], [19, 20], [20, 20], [20, 20]]);
  assert.deepEqual(split.targets(split.create(1, DEFAULT_CARRY, OPTS)), [], "no timed targets");
});

await check("determinism: the same seed and input give the same events and result, for two seeds", () => {
  for (const seed of [3, 8]) {
    const a = play({ seed, bot: createBot(0.7, seed), every: 30 }), b = play({ seed, bot: createBot(0.7, seed), every: 30 });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}`);
    assert.deepEqual(a.res, b.res);
  }
  const c = play({ seed: 4, bot: createBot(0.7, 4), every: 30 });
  assert.notEqual(JSON.stringify(c.evs), JSON.stringify(play({ seed: 5, bot: createBot(0.7, 5), every: 30 }).evs), "another seed plays another run");
});

await check("views: every view of every run is a valid draw list, with the action part and no arena", () => {
  const all = [...IDLE, ...REF, ...BOTS[0.5]];
  const bad = all.flatMap((p) => p.bad);
  assert.deepEqual(bad.slice(0, 5), []);
  const d = split.view(split.create(1, DEFAULT_CARRY, OPTS));
  assert.ok(d.action && d.action.arena === null && Array.isArray(d.action.gifts));
  assert.ok(d.strips.some((s) => s.kind === "course"), "the tube's course");
});

await check("the splits: at the end of rooms 1 to 3 for any input (2, 4, 8, then 16 cells; Day 4 packs), and the ball's drawn size never changes", () => {
  const rnd = stream(77, "input");
  const random = play({ seed: 2, input: () => makeIntents({ steer: { x: rnd() * 2 - 1, y: rnd() * 2 - 1 }, presses: rnd() < 0.05 ? [{ t: 0 }] : [] }), every: 2 });
  for (const p of [...IDLE.slice(0, 3), REF[0], random]) {
    const at = (moment) => p.ga.find((g) => g.moment === moment);
    if (p.res.metrics.ko) continue;
    const plings = named(p.evs, "sfx").filter((e) => e.id === "pling");
    assert.ok(plings.length >= 3, `${plings.length} splits`);
    assert.equal(p.res.metrics.splits, 3, "three splits");
    assert.equal(p.res.metrics.cells, 16);
    assert.deepEqual(plings.slice(0, 4).map((e) => e.pitch), [1, 2, 3, 4], "a pling a day, one step higher");
    assert.ok(at("bloom"), "it reaches the Knot");
    const sizes = new Set(p.shells.map((r) => r.toFixed(3)));
    assert.deepEqual([...sizes], [TUNE.ballR.toFixed(3)], "the shell ring keeps its size");
  }
  // the cells always fit inside the ball, whatever their number
  const st = split.create(1, DEFAULT_CARRY, OPTS);
  for (const k of [0, 1, 2, 3]) {
    st.splits = k;
    const d = split.view(st);
    const cells = d.splats.filter((s) => s.hue === 0.02);
    assert.equal(cells.length, 2 ** (k + 1), `${2 ** (k + 1)} cells`);
    for (const c of cells) assert.ok(Math.hypot(c.x - st.A.p.x, c.y - st.A.p.y) + c.r <= TUNE.ballR + 0.01, "inside the shell");
  }
});

await check("shots per volley follow the cells: 1, 2, 3 and 4 at 2, 4, 8 and 16 cells (no gifts), 10° apart", () => {
  for (let day = 0; day < 4; day++) {
    const st = split.create(1, DEFAULT_CARRY, OPTS);
    split.jump(st, IDS[day]);
    st.gifts = {};
    let made = null;
    run(st, (s) => {
      const shot = s.A.out.some((o) => o.type === "shot");
      if (shot) { made = 0; for (let i = 0; i < s.A.b.n; i++) if (s.A.b.side[i] === 1 && s.A.b.age[i] <= DT + 1e-9) made++; }
      return shot || s.phase !== "room";
    });
    assert.equal(made, TUNE.shots[day], `day ${day + 1}`);
    assert.equal(st.A.fire.spread, TUNE.shots[day]);
    near(st.A.fire.arc, (10 * Math.PI) / 180, 1e-9, "10° apart");
  }
});

await check("gifts: three distinct a pick, never one at its top level, seeded by the stage seed", () => {
  const offers = (seed, maxed = {}) => {
    const st = split.create(seed, DEFAULT_CARRY, OPTS);
    st.gifts = { ...maxed };
    run(st, (s) => s.phase === "pick");
    return st.offer.map((b) => b.id);
  };
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const o = offers(seed);
    assert.equal(o.length, 3);
    assert.equal(new Set(o).size, 3, `seed ${seed}: distinct ${o}`);
    assert.deepEqual(offers(seed), o, "the same seed offers the same");
  }
  const all = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => offers(s).join()));
  assert.ok(all.size >= 4, "seeds differ");
  const maxed = { quick: 2, spread: 2, bounce: 2, sticky: 1, shell: 3, dash: 2 };
  for (const seed of [1, 2, 3]) assert.deepEqual(offers(seed, maxed).slice().sort(), ["chain", "magnet", "orbit"], "never a gift at its top level");
  // the bubbles: up-left, up and up-right of you, 22 u away
  const st = split.create(1, DEFAULT_CARRY, OPTS);
  run(st, (s) => s.phase === "pick");
  const p = st.A.p;
  st.offer.forEach((b, k) => {
    near(Math.hypot(b.x - p.x, b.y - p.y), 22, 1e-6, "22 u away");
    assert.ok(b.y > p.y, "above you (world forward)");
    assert.ok(k === 1 ? Math.abs(b.x - p.x) < 1e-6 : (k === 0) === (b.x < p.x), "left, middle, right");
  });
});

await check("a pick by swimming takes that bubble; a pick left alone takes the middle one after 3.0 s with its line", () => {
  // swim toward the left bubble
  const st = split.create(2, DEFAULT_CARRY, OPTS);
  run(st, (s) => s.phase === "pick");
  const want = st.offer[0].id, t0 = st.t;
  const evs = [];
  for (let i = 0; i < 600 && st.phase === "pick"; i++) {
    const b = st.offer[0], p = st.A.p;
    split.step(st, makeIntents({ steer: { x: b.x - p.x, y: b.y - p.y } }));
    evs.push(...st.events); st.events.length = 0;
  }
  assert.equal(st.taken[0].id, want);
  assert.equal(st.taken[0].how, "you");
  assert.ok(st.t - t0 < 1.5, `taken in ${(st.t - t0).toFixed(2)} s`);
  assert.equal(st.gifts[want], 1);
  assert.ok(evs.some((e) => e.name === "subgoal" && e.id === "gift" && e.state === "done"));
  assert.ok(evs.some((e) => e.name === "sfx" && e.id === "act.up"), "a warm chime");
  // left alone
  const p = IDLE[0];
  const picks = named(p.evs, "subgoal").filter((e) => e.text === "split.sub.giftAuto");
  assert.ok(picks.length >= 3, `${picks.length} lines`);
  assert.ok(p.st.taken.every((x) => x.how === "auto"), "every pick by itself");
  const pickT = p.seen.filter((x) => x.phase === "pick");
  const spans = [];
  for (let i = 0; i < pickT.length; i++) if (i === 0 || pickT[i].t - pickT[i - 1].t > DT * 1.5) spans.push([pickT[i].t, pickT[i].t]); else spans[spans.length - 1][1] = pickT[i].t;
  for (const [a, b] of spans) near(b - a + DT, TUNE.pickS, 2 * DT, "3.0 s");
  const st2 = split.create(1, DEFAULT_CARRY, OPTS);
  run(st2, (s) => s.phase === "pick");
  const mid = st2.offer[1].id;
  run(st2, (s) => s.phase !== "pick");
  assert.equal(st2.taken[0].id, mid, "the middle one");
});

// Give a gift through the stage's own path: a pick with every bubble on top of you (one step).
function give(st, id, lv = 1) {
  for (let k = 0; k < lv; k++) {
    const day = st.day;
    st.phase = "pick";
    st.A.p.x = TUNE.pickTo.x; st.A.p.y = st.roomY + TUNE.pickTo.y;
    st.offer = [0, 1, 2].map(() => ({ id, x: st.A.p.x, y: st.A.p.y, t0: st.t }));
    split.step(st, makeIntents());
    st.events.length = 0;
    if (k < lv - 1) { st.day = day; }
  }
  return st;
}
const fresh = (day = 1, seed = 1) => { const st = split.create(seed, DEFAULT_CARRY, OPTS); split.jump(st, IDS[day]); st.events.length = 0; return st; };

await check("gift Quick: volleys +30% a second a level (2 levels)", () => {
  const st = give(fresh(0), "quick");
  near(st.A.fire.rate, TUNE.fire.rate * 1.3, 1e-9, "level 1");
  give(st, "quick");
  near(st.A.fire.rate, TUNE.fire.rate * 1.6, 1e-9, "level 2");
});

await check("gift Spread: +2 shots in the fan a level", () => {
  const st = give(fresh(0), "spread");
  assert.equal(st.A.fire.spread, TUNE.shots[Math.min(3, st.splits)] + 2);
  give(st, "spread");
  assert.equal(st.A.fire.spread, TUNE.shots[Math.min(3, st.splits)] + 4);
});

await check("gift Bounce: your sparks bounce off a wall once (twice at level 2); without it they are spent there", () => {
  // through the stage's own step: a spark fired at the right wall with Bounce 1 comes back once
  const st = fresh(1);
  give(st, "bounce", 1);
  for (const f of st.A.foes.slice()) X.removeFoe(st.A, f.id);
  st.rows = [];
  const A = st.A;
  A.fire.rate = 0.001; A.fire.cool = 99;
  X.addBullet(A, 1, TUNE.room.x1 - 2, st.roomY + 10, 110, 0, { r: 1, life: 5 });
  const vx = [];
  for (let i = 0; i < 120; i++) {
    split.step(st, makeIntents());
    st.events.length = 0;
    const k = [...Array(A.b.n).keys()].find((j) => A.b.side[j] === 1);
    vx.push(k === undefined ? null : Math.sign(A.b.vx[k]));
  }
  const firstBack = vx.indexOf(-1);
  assert.ok(firstBack > 0, "it comes back off the wall");
  assert.ok(vx.slice(firstBack).every((v) => v !== 1), "never forward again after its one bounce");
  assert.ok(vx.includes(null), "spent at the far wall");
  // and without the gift: spent at the first wall
  const st0 = fresh(1);
  for (const f of st0.A.foes.slice()) X.removeFoe(st0.A, f.id);
  st0.rows = [];
  st0.A.fire.cool = 99;
  X.addBullet(st0.A, 1, TUNE.room.x1 - 2, st0.roomY + 10, 110, 0, { r: 1, life: 5 });
  const back = [];
  for (let i = 0; i < 30; i++) { split.step(st0, makeIntents()); st0.events.length = 0; for (let j = 0; j < st0.A.b.n; j++) if (st0.A.b.side[j] === 1) back.push(Math.sign(st0.A.b.vx[j])); }
  assert.ok(!back.includes(-1), "no bounce without the gift");
});

await check("gift Sticky: a hit slows a germ to ×0.6 for 1 s", () => {
  const st = give(fresh(0), "sticky");
  const A = st.A;
  run(st, (s) => s.A.foes.some((f) => f.in <= 0 && f.key === "drifter"));
  const f = A.foes.find((g) => g.in <= 0 && g.key === "drifter");
  // drive it directly: a strike in A.out marks it slowed for 1 s and its speed is 0.6 of its own
  f.slowT = A.t + TUNE.gift.stickyS;
  split.step(st, makeIntents()); st.events.length = 0;
  near(f.speed, f.base * TUNE.gift.stickyK, 1e-9, "slowed");
  run(st, (s) => s.A.t > f.slowT + 0.05 || !s.A.foes.includes(f));
  if (A.foes.includes(f)) { split.step(st, makeIntents()); near(f.speed, f.base, 1e-9, "back to its speed"); }
  // and a real hit marks it
  const st2 = give(fresh(0, 3), "sticky");
  let marked = false;
  run(st2, (s) => { marked = s.A.foes.some((g) => g.slowT > s.A.t); return marked || s.phase !== "room"; });
  assert.ok(marked, "a spark's hit slows a germ");
});

await check("gift Shell: +1 pip and heal 1 (3 levels)", () => {
  const st = fresh(1);
  st.A.p.hp = 2;
  give(st, "shell");
  assert.equal(st.A.p.hpMax, TUNE.player.hp + 1);
  assert.equal(st.A.p.hp, 3);
});

await check("gift Dash: +40% far and the cooldown 0.25 s shorter a level", () => {
  const st = give(fresh(0), "dash");
  near(st.A.dash.s, TUNE.dash.s * 1.4, 1e-9, "farther");
  near(st.A.dash.cdS, TUNE.dash.cdS - 0.25, 1e-9, "back sooner");
  give(st, "dash");
  near(st.A.dash.s, TUNE.dash.s * 1.8, 1e-9, "level 2");
  near(st.A.dash.cdS, TUNE.dash.cdS - 0.5, 1e-9, "level 2");
});

await check("gift Orbit: 2 cells (4 at level 2) circle you at 12 u and pop what they touch, 1 a hit, once per 0.4 s a germ", () => {
  const st = give(fresh(1), "orbit");
  const A = st.A;
  for (const f of A.foes.slice()) X.removeFoe(A, f.id);
  st.rows = [];
  A.fire.rate = 0.001; A.fire.cool = 99;
  const f = X.spawnFoe(A, { kind: "germ", ai: "still", r: 3, hp: 50, x: A.p.x + 12, y: A.p.y, spawnS: 0, anywhere: true });
  f.base = 0; f.key = "test";
  const hits = [];
  for (let i = 0; i < 120; i++) {
    A.p.x = 0; A.p.y = st.roomY;
    f.x = 12; f.y = st.roomY; f.vx = 0; f.vy = 0;
    const hp = f.hp;
    split.step(st, makeIntents()); st.events.length = 0;
    if (f.hp < hp) hits.push(A.t);
  }
  assert.ok(hits.length >= 2, `${hits.length} hits in 2 s`);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i] - hits[i - 1] >= TUNE.gift.orbitEvery - 1e-6, "at most once per 0.4 s");
  const d = split.view(st);
  assert.equal(d.splats.filter((s) => s.r === TUNE.gift.orbitCellR).length, 2, "2 orbit cells drawn");
  give(st, "orbit");
  assert.equal(split.view(st).splats.filter((s) => s.r === TUNE.gift.orbitCellR).length, 4, "4 at level 2");
});

await check("gift Chain: a popped germ bursts into 4 sparks (8 at level 2) that hit others", () => {
  for (const lv of [1, 2]) {
    const st = give(fresh(1), "chain", lv);
    const A = st.A;
    for (const f of A.foes.slice()) X.removeFoe(A, f.id);
    st.rows = [];
    A.fire.cool = 99;
    const f = X.spawnFoe(A, { kind: "germ", ai: "still", r: 3, hp: 1, x: 20, y: st.roomY + 30, spawnS: 0, anywhere: true });
    f.base = 0;
    let made = 0;
    // one spark of yours pops it; the stage turns that clear into chain sparks after the world step
    X.addBullet(A, 1, f.x - 2, f.y, 60, 0, { r: 1, life: 1 });
    for (let i = 0; i < 6 && A.foes.includes(f); i++) { split.step(st, makeIntents()); st.events.length = 0; }
    for (let i = 0; i < A.b.n; i++) if (A.b.side[i] === 1) made++;
    assert.ok(made >= 4 * lv, `level ${lv}: ${made} sparks`);
  }
});

await check("gift Magnet: sparkles drift to you from 30 u (60 u at level 2)", () => {
  const st = give(fresh(1), "magnet");
  assert.equal(st.A.pick.magnet, 30);
  give(st, "magnet");
  assert.equal(st.A.pick.magnet, 60);
});

await check("rooms: each day's rows spawn at least 30 u from you; a room ends cleared (\"Clear!\", +300) or at its 10 s timer, which always opens the exit", () => {
  // the timer: no sparks, so nothing is popped, and the exit opens at 10 s with the germs left drifting off
  const st = split.create(4, DEFAULT_CARRY, OPTS);
  st.A.fire = null;
  st.A.p.hp = st.A.p.hpMax = 99;
  const t0 = st.A.t;
  const evs = [];
  for (let i = 0; i < 2000 && st.phase === "room"; i++) {
    split.step(st, makeIntents());
    evs.push(...st.events); st.events.length = 0;
    for (const f of st.A.foes) if (f.age < DT * 1.5 && f.key !== "kid") assert.ok(Math.hypot(f.x - st.A.p.x, f.y - st.A.p.y) >= 24, "no spawn near you");
  }
  assert.equal(st.phase, "clear");
  near(st.A.t - t0, TUNE.roomS, 2 * DT, "at the timer");
  assert.equal(st.carried, true);
  assert.equal(st.A.foes.length, 0, "what was left drifts off");
  run(st, (s) => s.phase !== "clear");
  assert.equal(split.prompt(st).text, "split.prompt.carried");
  assert.equal(st.exitOpen, 1, "the exit is open");
  // a clear: the ref bot clears its rooms before their timers, each with +300 and "Clear!"
  for (const p of REF.slice(0, 3)) {
    assert.ok(p.res.metrics.roomsClear >= 4, `seed ${p.st.seed}: ${p.res.metrics.roomsClear} rooms cleared`);
    const words = p.evs.filter((e) => e.name === "points" && e.add === 300);
    assert.ok(words.length >= 4);
  }
  // each room's spawns, Assist with fewer
  const sta = split.create(1, DEFAULT_CARRY, { ...OPTS, assist: true });
  for (let d = 0; d < 4; d++) {
    split.jump(sta, IDS[d]);
    assert.equal(sta.rows.reduce((a, r) => a + r.n, 0), TUNE.rooms[d].reduce((a, r) => a + Math.ceil(r[2] * 0.75), 0), `Assist day ${d + 1}`);
  }
});

await check("chasers wobble with a line tell, then lunge along it; splitters pop into two small chasers; puffers fire sticky spores", () => {
  const st = split.create(3, DEFAULT_CARRY, OPTS);
  split.jump(st, "day3");
  st.A.fire = null;
  const A = st.A;
  A.p.hp = A.p.hpMax = 99;
  let lineTells = 0, lunged = false, spores = 0, slowing = false;
  for (let i = 0; i < 600; i++) {
    split.step(st, makeIntents());
    st.events.length = 0;
    for (const o of A.out) if (o.type === "tell" && o.kind === "line") lineTells++;
    if (A.foes.some((f) => f.lunge && f.lp === 2 && Math.hypot(f.vx, f.vy) > 30)) lunged = true;
    for (let j = 0; j < A.b.n; j++) if (A.b.side[j] === 2 && A.b.tone[j] === 3) { spores++; if (A.b.acc[j] < 0) slowing = true; }
    if (st.phase !== "room") break;
  }
  assert.ok(lineTells > 0, "a line tell before a lunge");
  assert.ok(lunged, "a lunge");
  assert.ok(spores > 0 && slowing, "sticky spores that slow");
  // a splitter pops into two kids
  const s2 = fresh(2);
  run(s2, (s) => s.A.foes.some((f) => f.key === "splitter" && f.in <= 0));
  const f = s2.A.foes.find((g) => g.key === "splitter" && g.in <= 0);
  const came = s2.came;
  f.hp = 0.5;
  X.addBullet(s2.A, 1, f.x - 2, f.y, 60, 0, { r: 1, life: 1 });
  for (let i = 0; i < 6 && s2.A.foes.includes(f); i++) { split.step(s2, makeIntents()); s2.events.length = 0; }
  assert.equal(s2.A.foes.filter((g) => g.key === "kid").length, 2);
  assert.equal(s2.came, came + 2, "the kids came too");
});

await check("the Knot: phases at 60% and 24% of its hp, each with a tell, a swell, a hit-stop and the spores cleared; the boss bar; the hollow fills", () => {
  const st = split.create(1, DEFAULT_CARRY, OPTS);
  split.jump(st, "bloom");
  const A = st.A;
  A.fire = null;
  run(st, (s) => { const f = s.A.foes.find((g) => g.boss); return f && f.in <= 0 && s.A.t - s.k0 > 3; });
  const f = A.foes.find((g) => g.boss);
  assert.equal(f.hpMax, TUNE.knot.spec.hp);
  near(f.y, st.roomY + TUNE.knot.at.y, 3, "at the tube's end");
  assert.ok(split.view(st).action.boss, "the boss bar shows");
  assert.ok(foeShots(A) > 0, "phase 1 fires its rings");
  const evs = [];
  const hit = (share) => { X.damageFoe(A, f, f.hp - share * f.hpMax + 0.01, 0, 0); for (let i = 0; i < 30; i++) { split.step(st, makeIntents()); evs.push(...st.events.map((e) => ({ ...e, at: A.t }))); st.events.length = 0; } };
  hit(0.6);
  assert.equal(st.knot.phase, 1, "phase 2 below 60%");
  assert.equal(f.phase, 1);
  hit(0.24);
  assert.equal(st.knot.phase, 2, "phase 3 below 24%");
  const sw = evs.filter((e) => e.name === "sfx" && e.id === "act.phase");
  assert.deepEqual(sw.map((e) => e.pitch), [1, 2], "a low swell at each change");
  assert.ok(st.fill > 0, "the hollow fills as you play");
  // the ref bot: the phases come in order, each with a tell and no foe spores left over
  for (const p of REF.slice(0, 5)) {
    assert.deepEqual(p.phases.map((x) => x.phase), [1, 2], `seed ${p.st.seed}`);
    for (const x of p.phases) {
      assert.equal(x.bullets, 0, "the spores cleared");
      assert.ok(x.tells.includes(x.phase === 1 ? "ring" : "charge"), "a tell");
    }
    assert.ok(p.phases[0].share <= 0.6 && p.phases[1].share <= 0.24);
    assert.equal(p.res.metrics.knot, "popped", `seed ${p.st.seed}: the ref bot pops it`);
  }
});
const srcKnown = (s) => Object.prototype.hasOwnProperty.call(SOURCES, s);
function foeShots(A) { let n = 0; for (let i = 0; i < A.b.n; i++) if (A.b.side[i] === 2) n++; return n; }

await check("the Knot drifts off at 18 s by itself (\"The tube carries you past.\"), and the stage goes on to the hatch", () => {
  const st = split.create(2, DEFAULT_CARRY, OPTS);
  split.jump(st, "bloom");
  st.A.fire = null;
  st.A.p.hp = 99; st.A.p.hpMax = 99;
  const evs = [];
  const k0 = st.A.t;
  for (let i = 0; i < 3000 && st.phase !== "hatch"; i++) { split.step(st, makeIntents()); evs.push(...st.events.map((e) => ({ ...e, at: st.A.t }))); st.events.length = 0; }
  assert.equal(st.knotLeft, true);
  const line = evs.find((e) => e.name === "subgoal" && e.text === "split.sub.knotAuto");
  assert.ok(line, "its line");
  near(line.at - k0, TUNE.knot.leaveS, 2 * DT, "at 18 s");
  assert.equal(st.phase, "hatch");
});

await check("the hatch: the shell cracks into paper pieces, \"You hatch.\", the clock reads Day 6, then the outro, and the stage ends with its goal", () => {
  for (const p of [REF[0], REF[1], BOTS[0.5][0]]) {
    assert.equal(p.res.done, true);
    assert.equal(p.res.goalMet, true);
    assert.equal(p.st.how, "hatch");
    const hatch = p.evs.find((e) => e.name === "moment" && e.id === "hatch");
    assert.ok(hatch);
    assert.ok(p.evs.some((e) => e.name === "subgoal" && e.text === "split.sub.hatched"), "You hatch.");
    assert.ok(p.evs.some((e) => e.name === "sfx" && e.id === "slip"), "a soft crack");
    assert.ok(p.evs.some((e) => e.name === "sfx" && e.id === "tone"), "a rising tone");
    const h = p.ga.find((g) => g.moment === "hatch");
    assert.equal(Math.floor(h.gaDay), 20);
    assert.equal(clockLabel(20), "Day 6 after fertilization (week 2)");
    assert.ok(p.evs.some((e) => e.name === "moment" && e.id === "outro"));
  }
  const st = split.create(1, DEFAULT_CARRY, OPTS);
  split.jump(st, "hatch");
  run(st, (s) => s.cracked);
  const d = split.view(st);
  assert.ok(d.action.bursts.length >= 6, "paper pieces fall away");
  run(st, (s) => s.A.t - s.crackT > 0.4);
  const arc = split.view(st).strips.find((s) => s.kind === "arc");
  assert.ok(arc && arc.a1 - arc.a0 < 2 * Math.PI, "the shell opens");
});

await check("the clock: never back, inside each moment's span, Day 1 to Day 6; each pick's caption fact on its day", () => {
  for (const p of [...REF.slice(0, 3), ...IDLE.slice(0, 3)]) {
    let prev = 0;
    for (const g of p.ga) {
      assert.ok(g.gaDay >= prev - 1e-12, `back at ${g.t.toFixed(2)}`);
      prev = g.gaDay;
      const m = split.meta.moments.find((x) => x.id === g.moment);
      if (!g.done) assert.ok(g.gaDay >= m.ga[0] - 1e-9 && g.gaDay <= m.ga[1] + 1e-9, `${g.moment} ${g.gaDay}`);
    }
    assert.equal(p.st.gaDay, 20);
    for (const e of named(p.evs, "fact")) {
      const f = FACTS.find((x) => x.id === e.id);
      assert.ok(f && f.where === "caption", e.id);
      assert.ok(e.ga >= f.gaDay - 1e-9, `${e.id} at ${e.ga}`);
    }
  }
  const order = named(REF[0].evs, "fact").map((e) => e.id);
  assert.deepEqual(order, ["split.small", "split.carried", "split.morula", "split.inner"]);
});

await check("the shared bot: skill 1 is Great or better in at least 9 of 10 and knocked out in at most 1; 0.7 and 0.5 are not knocked out in at least 8 of 10; more skill scores more", () => {
  const great = REF.filter((p) => ["Great", "Glowing"].includes(gradeOf(total(p.res), p.res.goalMet))).length;
  assert.ok(great >= 9, `Great or better in ${great} of 10`);
  assert.ok(REF.filter((p) => p.res.metrics.ko).length <= 1);
  for (const s of [0.7, 0.5]) assert.ok(BOTS[s].filter((p) => !p.res.metrics.ko).length >= 8, `skill ${s}: knocked out in ${BOTS[s].filter((p) => p.res.metrics.ko).length}`);
  const mean = (ps) => ps.reduce((a, p) => a + total(p.res), 0) / ps.length;
  assert.ok(mean(REF) >= mean(BOTS[0.5]) && mean(BOTS[0.5]) > mean(IDLE), `${mean(REF)} ${mean(BOTS[0.5])} ${mean(IDLE)}`);
  const t = REF.map((p) => p.st.t);
  assert.ok(Math.max(...t) < split.meta.capS && Math.min(...t) > 40, `ref lengths ${t.map((x) => x.toFixed(0))}`);
});

await check("idle: knocked out (the rest line, goal unmet, the Almost line) or it lasts; never stuck; the points events add up", () => {
  let kos = 0;
  for (const p of IDLE) {
    assert.equal(p.res.done, true);
    const sum = named(p.evs, "points").reduce((a, e) => a + e.add, 0);
    assert.equal(sum, total(p.res), `seed ${p.st.seed}: points ${sum} vs ${total(p.res)}`);
    if (!p.res.metrics.ko) { assert.equal(p.res.goalMet, true); continue; }
    kos++;
    assert.equal(p.res.goalMet, false);
    assert.equal(p.res.score.goal, 0);
    assert.equal(p.res.metrics.almost, "almost.ko");
    assert.ok(Number.isFinite(p.res.metrics.koAt));
    assert.ok(p.evs.some((e) => e.name === "subgoal" && e.text === "split.sub.rest"), "Your cells need a rest.");
    assert.equal(p.st.gaDay, 20, "the clock at the stage's end");
  }
  assert.ok(kos >= 2, `idle knocked out in ${kos} of ${IDLE.length}`);
  for (const p of [...REF, ...BOTS[0.5]]) assert.equal(named(p.evs, "points").reduce((a, e) => a + e.add, 0), total(p.res), "the points add up");
});

await check("a knock-out with Go on: the splits left play, the hollow fills, you hatch, and it ends with no goal (input none)", () => {
  const ko = IDLE.find((p) => p.res.metrics.ko);
  assert.ok(ko, "an idle knock-out");
  const st = split.create(ko.st.seed, DEFAULT_CARRY, OPTS);
  run(st, () => false);
  assert.equal(split.result(st).metrics.ko, true);
  const before = total(split.result(st)), splits = st.splits;
  assert.equal(split.jump(st, split.meta.goOn), true);
  assert.equal(st.done, false);
  assert.equal(split.prompt(st).gesture, "none");
  const evs = [];
  const rnd = stream(5, "garbage");
  for (let i = 0; i < 1200 && !st.done; i++) { split.step(st, makeIntents({ steer: { x: rnd() - 0.5, y: rnd() - 0.5 }, presses: [{ t: 0 }] })); evs.push(...st.events); st.events.length = 0; }
  const r = split.result(st);
  assert.equal(r.done, true);
  assert.equal(r.goalMet, false);
  assert.equal(r.metrics.ko, true);
  assert.equal(st.splits, 3, "every split played");
  assert.equal(evs.filter((e) => e.name === "sfx" && e.id === "pling").length, 3 - splits);
  assert.ok(evs.some((e) => e.name === "moment" && e.id === "hatch"));
  assert.ok(evs.some((e) => e.name === "subgoal" && e.text === "split.sub.hatched"));
  assert.equal(named(evs, "points").length, 0, "no more points");
  assert.equal(total(r), before);
  assert.equal(st.how, "goOn");
});

await check("one live gesture: move in rooms, picks and the Knot (with their prompts), none in a split, the hatch and the outro, none once done", () => {
  const p = REF[0];
  const by = {};
  for (const x of p.seen) (by[x.phase] = by[x.phase] || new Set()).add(`${x.prompt.gesture}|${x.prompt.text}`);
  assert.deepEqual([...by.room], ["move|split.prompt.move"]);
  assert.deepEqual([...by.pick], ["move|split.prompt.gift"]);
  assert.deepEqual([...by.knot], ["move|split.prompt.knot"]);
  for (const ph of ["split", "hatch", "outro"]) for (const s of by[ph]) assert.equal(s.split("|")[0], "none", ph);
  assert.equal(split.prompt(p.st).gesture, "none");
  for (const e of named(p.evs, "prompt")) if (e.text) assert.ok(TEXT[e.text], e.text);
});

await check("every sub-goal is shown, then ends done or auto (rooms, gift, the Knot, the hatch)", () => {
  for (const p of [REF[0], IDLE[0], IDLE[1]]) {
    const subs = named(p.evs, "subgoal");
    const ids = [...new Set(subs.map((e) => e.id))];
    for (const id of ids) {
      const states = subs.filter((e) => e.id === id).map((e) => e.state);
      assert.equal(states[0], "shown", id);
      assert.ok(states.length === 2 && ["done", "auto"].includes(states[1]), `${id}: ${states}`);
    }
    for (const id of ["rooms", "gift"]) assert.ok(ids.includes(id), id);
    if (!p.res.metrics.ko) for (const id of ["knot", "hatch"]) assert.ok(ids.includes(id), id);
    for (const e of subs) assert.ok(TEXT[e.text], e.text);
  }
});

await check("botSteer: dodges with a dash, takes its first preferred gift (the middle one below skill 0.5), keeps memory only in r.mem and never changes the state", () => {
  const st = split.create(1, DEFAULT_CARRY, OPTS);
  run(st, (s) => s.phase === "pick");
  const snap = JSON.stringify(split.view(st));
  const r = stream(1, "x"); r.mem = {};
  const a = split.botSteer(st, 1, r), b = split.botSteer(st, 1, r);
  assert.deepEqual(a, b, "skill 1 is the same each call");
  assert.deepEqual(Object.keys(r.mem), [], "no memory at skill 1");
  assert.equal(JSON.stringify(split.view(st)), snap, "the state is untouched");
  assert.ok(Math.hypot(a.steer.x, a.steer.y) < 1);
  const pref = TUNE.prefer.find((id) => st.offer.some((o) => o.id === id));
  const want = st.offer.find((o) => o.id === pref), p = st.A.p;
  assert.ok(a.steer.x * (want.x - p.x) + a.steer.y * (want.y - p.y) > 0, "toward its preferred gift");
  const low = split.botSteer(st, 0.3, Object.assign(stream(2, "y"), { mem: {} }));
  const mid = st.offer[1];
  assert.ok(low.steer.x * (mid.x - p.x) + low.steer.y * (mid.y - p.y) >= 0, "the middle one below 0.5");
  // the ref bot's picks follow its preference
  for (const q of REF.slice(0, 4)) for (const x of q.st.taken) assert.equal(x.how, "you");
  assert.ok(REF.some((q) => q.res.metrics.dashes > 0), "it dashes");
  const done = split.create(1, DEFAULT_CARRY, OPTS); done.done = true;
  assert.deepEqual(split.botSteer(done, 1, r).steer, { x: 0, y: 0 });
});

await check("Assist: 7 pips, spores 0.75 as fast, 0.75 of the germs, the Knot 114 hp, the dash back 0.7 as soon", () => {
  const st = split.create(1, DEFAULT_CARRY, { ...OPTS, assist: true });
  assert.equal(st.A.p.hp, 7);
  assert.equal(st.A.bulletK, 0.75);
  near(st.A.dash.cdS, TUNE.dash.cdS * 0.7, 1e-9, "dash");
  split.jump(st, "bloom");
  run(st, (s) => s.A.foes.some((f) => f.boss));
  assert.equal(st.A.foes.find((f) => f.boss).hpMax, Math.round(TUNE.knot.spec.hp * 0.76));
  const p = play({ seed: 1, opts: { assist: true }, every: 30 });
  assert.equal(p.res.done, true);
});

await check("carry in: Glowing sparks are shield pips (at most 2) that take the first hits; nothing carries out", () => {
  const st = split.create(1, mergeCarry(DEFAULT_CARRY, { sparks: 3 }), OPTS);
  assert.equal(st.A.p.shield, 2);
  const d = split.view(st);
  assert.equal(d.action.hp.shield, 2);
  X.hitPlayer(st.A, 1, "test", 0, 0);
  assert.equal(st.A.p.hp, TUNE.player.hp, "the shield took it");
  assert.deepEqual(split.result(REF[0].st).carryOut, {});
});

await check("the fair resume: 1.2 s you cannot be hit; garbage input never throws", () => {
  const st = split.create(1, DEFAULT_CARRY, OPTS);
  run(st, (s) => s.A.t > 3);
  split.resume(st);
  assert.ok(st.A.p.inv >= 1.2);
  const rnd = stream(9, "junk");
  const junk = [null, undefined, {}, { steer: null }, { steer: { x: NaN, y: Infinity } }, { presses: "x" }, makeIntents({ steer: { x: 9, y: -9 } })];
  const s2 = split.create(5, DEFAULT_CARRY, OPTS);
  assert.doesNotThrow(() => { for (let i = 0; i < 4000 && !s2.done; i++) { split.step(s2, junk[Math.floor(rnd() * junk.length)]); s2.events.length = 0; } });
  assert.doesNotThrow(() => { for (const id of [...IDS, "nope"]) split.jump(split.create(1, DEFAULT_CARRY, OPTS), id); });
  assert.equal(split.jump(split.create(1, DEFAULT_CARRY, OPTS), "nope"), false);
});

await check("facts: shown ones checked with sources on the allow-list; split.frame on the result; the captions fit the run", () => {
  for (const f of FACTS) {
    assert.equal(f.stage, "split");
    for (const s of f.src) assert.ok(srcKnown(s), s);
    assert.ok(["card", "caption", "overlay", "result"].includes(f.where));
    assert.ok(!/—/.test(f.text), "no em dash");
  }
  const frame = FACTS.find((f) => f.id === "split.frame");
  assert.ok(frame && frame.where === "result");
  assert.deepEqual(FACTS.filter((f) => f.where === "caption").map((f) => f.id), ["split.small", "split.carried", "split.morula", "split.inner"]);
});

await check("strings: every text id the stage names exists, short plain sentences, no em dash, no banned words", () => {
  const BANNED = /\b(enemy|enemies|attack|fight|battle|kill|hurt|danger|lose|sick|brick|break|boss)\b/i;
  for (const [id, s] of Object.entries(TEXT)) {
    assert.ok(!/—/.test(s), `${id}: em dash`);
    assert.ok(!BANNED.test(s), `${id}: ${s}`);
    for (const sent of s.split(/[.!?]/)) assert.ok(sent.trim().split(/\s+/).length <= 12, `${id}: a long sentence`);
  }
  for (const g of TUNE.gifts) assert.ok(TEXT["split.gift." + g.id], g.id);
  for (const k of ["split.prompt.move", "split.prompt.move.keys", "split.prompt.move.one"]) assert.ok(TEXT[k], k);
  assert.ok(/Space/.test(TEXT["split.prompt.move.keys"]));
  assert.ok(/Hold/.test(TEXT["split.prompt.move.one"]) && !/drag/i.test(TEXT["split.prompt.move.one"]));
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${FILE}: ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const m = (ps) => Math.round(ps.reduce((a, p) => a + total(p.res), 0) / ps.length);
  const ko = (ps) => ps.filter((p) => p.res.metrics.ko).length;
  console.log(`PASS ${FILE}: ${passed} checks (10 seeds: skill 1 mean ${m(REF)}, ${ko(REF)} out; 0.7 mean ${m(BOTS[0.7])}, ${ko(BOTS[0.7])} out; 0.5 mean ${m(BOTS[0.5])}, ${ko(BOTS[0.5])} out; idle ${ko(IDLE)} of ${IDLE.length} out)`);
}
