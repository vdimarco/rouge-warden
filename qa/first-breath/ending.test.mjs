// First Breath: the ending (design.md 6.9, 18; tasks.md 2.35 and 2.36). The breath comes by itself 3.0 s after the
// "Breathe." prompt; no points (and no judge) event, ever; results only after skin-to-skin; her beats are silent only
// in the first 1.5 s. Also: the same seed and input give the same ending, for two seeds; a scripted ideal input
// (breathe, then rest the thumb) settles both sub-goals by you; idle input ends by the cap with both settled by
// themselves; the shared bot at skill 0.7 completes it; one live gesture per moment, from the hold family only;
// every sub-goal ends done or auto (idle, bots, scripted, random, held, cap, jumps); targets() carries P (the ending
// lays none); the moments match the 4.1 row (all at gaDay 280); every view validates and reads as two plain ovals
// in a warm room; the hold needs a fresh press; the inhale lasts 0.4 to 2.5 s; the thumb ring and its pulse; the
// song from the carry; the run time line; facts and strings; botSteer memory only in r.mem; probe is null; and a
// practice run of the ending through createRun reaches the result.
// node qa/first-breath/ending.test.mjs
import assert from "node:assert/strict";
import * as E from "../../public/first-breath/core/ending.js";
import { TUNE } from "../../public/first-breath/core/ending.tune.js";
import { FACTS } from "../../public/first-breath/core/ending.facts.js";
import { TEXT } from "../../public/first-breath/core/ending.text.js";
import { DEFAULT_CARRY, DEFAULT_SONG, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";
import { createRun } from "../../public/first-breath/core/run.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { DT, gaAt } from "../../public/first-breath/core/clock.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { say, allStrings, CARERS } from "../../public/first-breath/core/text.js";
import { byId } from "../../public/first-breath/core/facts.js";

const FILE = "qa/first-breath/ending.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const named = (evs, name) => evs.filter((e) => e.name === name);
const PERIOD = 60 / 76;
const MAX = Math.ceil((TUNE.capS + 5) / DT);
const MOMENTS = ["white", "breathe", "breaths", "skin", "thumb", "song", "time"];
const GESTURES = { white: "none", breathe: "hold", breaths: "none", skin: "none", thumb: "hold", song: "hold", time: "hold" };

// Play the ending to its end. `input(st)` gives the step's intents (stage seconds); `each(st, evs)` sees each step.
function play({ seed = 1, carry = DEFAULT_CARRY, opts = {}, input = null, each = null, max = MAX } = {}) {
  const st = E.create(seed, carry, { assist: false, oneButton: false, motherPhase: 0, ...opts });
  const evs = st.events.splice(0);
  let n = 0;
  for (; !E.result(st).done && n < max; n++) {
    const it = input ? input(st) : makeIntents();
    E.step(st, it);
    const out = st.events.splice(0);
    evs.push(...out);
    if (each) each(st, out);
  }
  return { st, evs, steps: n };
}

// Scripted input: a press and release at given stage times (each lands in the step whose range holds it).
function script(list) {
  return (st) => {
    const t0 = st.t, t1 = t0 + DT;
    const presses = [], releases = [];
    for (const [kind, t] of list) if (t >= t0 && t < t1) (kind === "press" ? presses : releases).push({ t, raw: t });
    return makeIntents({ presses, releases, touching: presses.length > 0 });
  };
}
const botInput = (skill, seed) => { const bot = createBot(skill, seed); return (st) => bot.intents(E, st); };
function randomInput(seed) {
  const r = stream(seed, "test:random");
  return (st) => {
    const presses = [], releases = [];
    if (r() < 0.04) presses.push({ t: st.t + r() * DT, raw: st.t });
    if (r() < 0.04) releases.push({ t: st.t + r() * DT, raw: st.t });
    return makeIntents({ presses, releases });
  };
}
const held = (from) => {
  let down = false;
  return (st) => { if (!down && st.t >= from) { down = true; return makeIntents({ presses: [{ t: st.t, raw: st.t }], touching: true }); } return makeIntents({ touching: down }); };
};
// The ideal script: breathe at 1.6 s for 1.2 s, then rest the thumb from just after its prompt to the end.
const IDEAL = script([["press", 1.6], ["release", 2.8], ["press", 12.2]]);

const KINDS = {
  idle: () => null,
  ideal: () => IDEAL,
  bot07: (seed) => botInput(0.7, seed),
  bot1: (seed) => botInput(1, seed),
  random: (seed) => randomInput(seed),
  heldFromStart: () => held(0),
  heldFromBreathe: () => held(1.6),
};

await check("meta: the ending is unscored, cannot fail, one family (hold), 76 bpm, cap 40 s, a 2 m room", () => {
  const m = E.meta;
  assert.equal(m.id, "ending");
  assert.equal(m.scored, false);
  assert.equal(m.canFail, false);
  assert.deepEqual([...m.families], ["hold"]);
  assert.equal(m.orient, "fit");
  assert.equal(m.motherBpm, 76);
  assert.equal(m.capS, 40);
  assert.equal(m.parS, 33);
  assert.deepEqual({ ...m.ga }, { start: 280, end: 280 });
  assert.deepEqual({ ...m.mm }, { start: 2000, end: 2000 });
  assert.equal(m.fertilized, true);
  assert.equal(m.verb, "Breathe");
});

await check("the moments match the 4.1 row: every moment at gaDay 280 → 280 with no lenS, and gaDay stays 280", () => {
  assert.deepEqual(E.meta.moments.map((x) => x.id), MOMENTS);
  for (const x of E.meta.moments) {
    assert.deepEqual([...x.ga], [280, 280], x.id);
    assert.equal(x.lenS, null, x.id);
    assert.equal(gaAt(x, 5), 280);
  }
  for (const [kind, mk] of Object.entries(KINDS)) {
    const seen = new Set();
    play({ input: mk(3), each: (st) => { assert.equal(st.gaDay, 280, kind); assert.equal(st.fertilized, true); seen.add(st.moment); } });
    if (kind === "idle" || kind === "ideal") assert.deepEqual([...seen].sort(), [...MOMENTS].sort(), `${kind} plays every moment`);
  }
});

await check("determinism: the same seed and input give the same ending, for seeds 1 and 2", () => {
  for (const seed of [1, 2]) {
    for (const kind of ["idle", "ideal", "bot07", "random"]) {
      const a = play({ seed, input: KINDS[kind](seed) }), b = play({ seed, input: KINDS[kind](seed) });
      assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed} ${kind}: events`);
      assert.deepEqual(E.result(a.st), E.result(b.st), `seed ${seed} ${kind}: result`);
      assert.equal(JSON.stringify(E.view(a.st)), JSON.stringify(E.view(b.st)), `seed ${seed} ${kind}: last view`);
    }
  }
  const one = play({ seed: 1 }), two = play({ seed: 2 });
  assert.notEqual(JSON.stringify(one.evs), JSON.stringify(two.evs), "the seed moves the uneven breaths");
  assert.notDeepEqual(one.st.breaths, two.st.breaths);
});

await check("the breath comes by itself 3.0 s after the prompt, with no end.seconds caption (a result fact)", () => {
  for (const motherPhase of [0, 0.31, 0.78]) {
    for (let seed = 1; seed <= 5; seed++) {
      const { evs } = play({ seed, opts: { motherPhase } });
      const p = named(evs, "prompt").find((e) => e.text === "ending.breathe");
      assert.ok(p, "the Breathe. prompt");
      near(p.t, TUNE.whiteS, 1e-9, "Breathe. at 1.5 s");
      assert.equal(p.gesture, "hold");
      const m = named(evs, "milestone").filter((e) => e.id === "breath");
      assert.equal(m.length, 1, "one first breath");
      near(m[0].t, p.t + 3.0, 1e-9, "the breath by itself");
      // end.seconds is a "What was real" fact: as a caption it cut end.voice short for a still player
      assert.ok(!named(evs, "fact").some((e) => e.id === "end.seconds"), "end.seconds is not sent as a caption");
      const sg = named(evs, "subgoal").find((e) => e.id === "breath" && e.state === "auto");
      near(sg.t, p.t + 3.0, 1e-9, "the breath sub-goal settles by itself");
      const cry = named(evs, "caption").find((e) => e.id === "ending.capCry");
      near(cry.t, p.t + 3.0 + TUNE.autoInhaleS, 1e-9, "a soft cry after the inhale");
    }
  }
  // a press before 3.0 s breathes at once, and end.seconds never shows
  const { evs } = play({ input: script([["press", 3.0], ["release", 4.0]]) });
  near(named(evs, "milestone").find((e) => e.id === "breath").t, 3.0, 1e-9, "your breath at your press");
  assert.ok(!named(evs, "fact").some((e) => e.id === "end.seconds"));
  assert.equal(named(evs, "subgoal").find((e) => e.id === "breath" && e.state !== "shown").state, "done");
});

await check("no points event and no judge event, ever; no score, no parts", () => {
  for (const [kind, mk] of Object.entries(KINDS)) {
    for (const seed of [1, 2, 3]) {
      const { st, evs } = play({ seed, input: mk(seed) });
      assert.equal(named(evs, "points").length, 0, `${kind}: points`);
      assert.equal(named(evs, "judge").length, 0, `${kind}: judge`);
      const res = E.result(st);
      assert.equal(res.score, null);
      assert.deepEqual(res.parts, []);
      assert.equal(res.done, true);
      assert.equal(res.goalMet, true);
      assert.deepEqual(res.carryOut, {});
    }
  }
});

await check("results only after skin-to-skin", () => {
  for (const [kind, mk] of Object.entries(KINDS)) {
    let skin = null;
    const { st, evs } = play({
      seed: 4, input: mk(4),
      each: (s, out) => {
        if (out.some((e) => e.name === "moment" && e.id === "skin")) skin = s.t;
        if (skin === null) assert.equal(E.result(s).done, false, `${kind}: done before skin-to-skin at ${s.t.toFixed(2)} s`);
      },
    });
    assert.ok(skin !== null, `${kind}: skin-to-skin happens`);
    const done = named(evs, "done");
    assert.equal(done.length, 1, `${kind}: one done`);
    assert.ok(done[0].t >= skin + TUNE.timeAfterS - 1e-9, `${kind}: the result comes after the time line`);
    assert.ok(E.result(st).metrics.skinT <= done[0].t);
  }
});

await check("her beats are silent only in the first 1.5 s, then even at 76 bpm to the end", () => {
  for (const motherPhase of [0, 0.2, 0.5, 0.78, 1.9 % PERIOD]) {
    const st = E.create(9, DEFAULT_CARRY, { motherPhase });
    const b = st.beats.mother;
    assert.ok(b.length > 40, "beats laid");
    assert.ok(b[0] >= TUNE.whiteS - 1e-9, `the first beat ${b[0]} is at or after 1.5 s`);
    assert.ok(b[0] < TUNE.whiteS + PERIOD + 1e-9, `the first beat ${b[0]} is within one period of 1.5 s`);
    const k = (b[0] - motherPhase) / PERIOD;
    near(k, Math.round(k), 1e-6, "on the grid motherPhase sets");
    for (let i = 1; i < b.length; i++) near(b[i] - b[i - 1], PERIOD, 1e-9, `gap ${i}`);
    assert.ok(b[b.length - 1] > TUNE.capS, "they run past the cap");
    assert.deepEqual(st.beats.between("mother", 0, TUNE.whiteS), [], "silence in the first 1.5 s");
    const you = st.beats.you;
    assert.ok(you && you[0] >= TUNE.whiteS - 1e-9, "your heart is quiet in the white too");
    near(you[1] - you[0], 60 / 130, 1e-9, "your heart at 130 bpm");
  }
  // the heart comes back soft and far at 1.5 s, close and clear at skin-to-skin
  const { evs } = play();
  const far = named(evs, "sfx").find((e) => e.id === "heartFar"), close = named(evs, "sfx").find((e) => e.id === "heartClose");
  near(far.t, TUNE.whiteS, 1e-9, "far at 1.5 s");
  near(far.gain, 0.25, 1e-9, "−12 dB");
  assert.equal(close.t, named(evs, "moment").find((e) => e.id === "skin").t);
});

await check("idle ends by the cap, near 33 s, with every sub-goal settled by itself", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { st, evs } = play({ seed });
    const res = E.result(st);
    assert.equal(res.done, true);
    assert.ok(st.t <= TUNE.capS + DT, `seed ${seed}: ${st.t}`);
    const end = named(evs, "done")[0].t;
    assert.ok(end >= 33 - 1e-9 && end <= 33.2, `seed ${seed}: the end at ${end.toFixed(3)} s`);
    assert.deepEqual(st.subgoals, { breath: "auto", rest: "auto" });
    assert.equal(res.metrics.firstBreath, "auto");
    assert.equal(res.metrics.breaths, 3, "three breaths");
    assert.equal(res.metrics.how, "end");
  }
});

await check("the scripted ideal input settles both sub-goals by you and ends at 33 s", () => {
  for (const seed of [1, 2]) {
    const { st, evs } = play({ seed, input: IDEAL });
    assert.deepEqual(st.subgoals, { breath: "done", rest: "done" });
    const m = E.result(st).metrics;
    assert.equal(m.firstBreath, "you");
    near(m.firstT, 1.6, 1e-9, "the inhale at the press");
    near(m.cryT, 2.8, 1e-9, "the cry at the release");
    near(named(evs, "done")[0].t, 33, 1e-9, "33 s");
    near(m.skinT, 9, 1e-9, "skin-to-skin at 9 s");
    assert.ok(m.restS > 20, `the thumb rested ${m.restS.toFixed(1)} s`);
    near(named(evs, "fact").find((e) => e.id === "end.breath").t, 2.8 + TUNE.breathFactS, 1e-9, "end.breath after the cry");
  }
});

await check("the bot at skill 0.7 completes the ending (and at 1.0, over 20 seeds)", () => {
  for (const skill of [0.7, 1]) {
    for (let seed = 1; seed <= 20; seed++) {
      const { st, evs } = play({ seed, input: botInput(skill, seed) });
      assert.equal(E.result(st).done, true);
      assert.deepEqual(st.subgoals, { breath: "done", rest: "done" }, `skill ${skill} seed ${seed}`);
      const end = named(evs, "done")[0].t;
      assert.ok(end >= 33 - 1e-9 && end <= 33.2, `skill ${skill} seed ${seed}: the end at ${end.toFixed(3)} s`);
    }
  }
});

await check("one live gesture per moment, from the hold family only", () => {
  for (const [kind, mk] of Object.entries(KINDS)) {
    const st = E.create(2, DEFAULT_CARRY, { motherPhase: 0 });
    const evs = st.events.splice(0);
    const byMoment = {};
    for (let n = 0; !E.result(st).done && n < MAX; n++) {
      const g = E.prompt(st).gesture;
      (byMoment[st.moment] ||= new Set()).add(g);
      E.step(st, (mk(2) || (() => makeIntents()))(st));
      evs.push(...st.events.splice(0));
    }
    for (const [id, set] of Object.entries(byMoment)) {
      assert.equal(set.size, 1, `${kind}: ${id} has ${[...set]}`);
      assert.equal([...set][0], GESTURES[id], `${kind}: ${id}`);
    }
    const list = evs.filter((e) => e.name === "moment" || e.name === "prompt");
    for (let i = 0; i < list.length; i++) {
      if (list[i].name !== "moment") continue;
      const p = list[i + 1];
      assert.ok(p && p.name === "prompt" && p.t === list[i].t, `${kind}: ${list[i].id} has its prompt at once`);
      assert.equal(p.gesture, GESTURES[list[i].id]);
      assert.equal(p.keys, "steer");
      if (p.gesture === "hold") assert.ok(TEXT[p.text], `${kind}: ${list[i].id} names its gesture`);
    }
    const last = list[list.length - 1];
    assert.equal(last.name, "prompt");
    assert.equal(last.gesture, "none", "input off at the end");
  }
  const st = E.create(1, DEFAULT_CARRY, {});
  E.jump(st, "thumb");
  assert.equal(E.prompt(st).textKeys, "ending.thumbKeys", "the desktop line rides on the thumb prompt");
});

await check("every sub-goal ends done or auto (idle, bots, scripted, random, held, the cap, jumps)", () => {
  for (const [kind, mk] of Object.entries(KINDS)) {
    for (const seed of [1, 5]) {
      const { st, evs } = play({ seed, input: mk(seed) });
      assert.deepEqual(Object.keys(st.subgoals).sort(), ["breath", "rest"], kind);
      for (const [id, s] of Object.entries(st.subgoals)) assert.ok(s === "done" || s === "auto", `${kind}: ${id} is ${s}`);
      for (const id of ["breath", "rest"]) {
        const seq = named(evs, "subgoal").filter((e) => e.id === id).map((e) => e.state);
        assert.equal(seq[0], "shown", `${kind}: ${id} is shown first`);
        assert.equal(seq.length, 2, `${kind}: ${id} shown once, settled once`);
        for (const e of named(evs, "subgoal").filter((x) => x.id === id)) assert.ok(TEXT[e.text], `${kind}: ${e.text} is a string`);
      }
    }
  }
  // the cap: a jump back to the start at 30 s leaves the timeline short, so the cap ends it, settled
  const st = E.create(1, DEFAULT_CARRY, {});
  for (let i = 0; i < 30 / DT; i++) E.step(st, makeIntents());
  E.jump(st, "breathe");
  let n = 0;
  while (!E.result(st).done && n++ < MAX) E.step(st, makeIntents());
  assert.equal(E.result(st).metrics.how, "cap");
  assert.ok(st.t <= TUNE.capS + DT);
  for (const s of Object.values(st.subgoals)) assert.ok(s === "done" || s === "auto");
  // every jump reaches the end with every sub-goal settled
  for (const id of MOMENTS) {
    const j = E.create(3, DEFAULT_CARRY, {});
    for (let i = 0; i < 60; i++) E.step(j, makeIntents());
    assert.equal(E.jump(j, id), true, id);
    assert.equal(j.moment, id, `jump to ${id}`);
    let k = 0;
    while (!E.result(j).done && k++ < MAX) E.step(j, makeIntents());
    assert.equal(E.result(j).done, true, `${id}: ends`);
    for (const s of Object.values(j.subgoals)) assert.ok(s === "done" || s === "auto", `${id}: ${JSON.stringify(j.subgoals)}`);
  }
  assert.equal(E.jump(E.create(1, DEFAULT_CARRY, {}), "nowhere"), false);
});

await check("targets carry P (the ending lays none: 6.9 judges nothing)", () => {
  for (const [kind, mk] of Object.entries(KINDS)) {
    play({
      input: mk(1),
      each: (st) => {
        const list = E.targets(st, 3);
        assert.ok(Array.isArray(list), kind);
        for (const x of list) assert.ok(Number.isFinite(x.P) && x.P >= 0.5, `${kind}: ${x.id} P`);
        assert.equal(list.length, 0, `${kind}: no timed targets`);
      },
    });
  }
});

await check("every view validates and reads clearly: two plain ovals in a warm room, a camera, an anchor and a cue", () => {
  for (const [kind, mk] of Object.entries(KINDS)) {
    let sawPair = false, sawRipple = false, sawSong = false, sawThumb = false, sawBreathRing = false;
    const check1 = (st) => {
      const d = E.view(st);
      assert.deepEqual(validate(d), [], `${kind} at ${st.t.toFixed(2)} s (${st.moment})`);
      assert.equal(d.stage, "ending");
      assert.equal(d.camera.orient, "fit");
      near(d.camera.mmPerU * d.camera.span, 2000, 1e-9, "2 m across the short axis");
      assert.deepEqual(d.anchor, { x: 0, y: 0 }, "you are the subject");
      assert.ok(d.cue && Number.isFinite(d.cue.x), "a cue");
      assert.ok(d.splats.length >= 1 && d.splats.length <= 2, "one or two ovals");
      for (const s of d.splats) {
        assert.equal(s.k, "s", "each oval is one capsule");
        assert.equal(s.y, s.y2, "lying flat: no limbs, no head-and-shoulders outline");
        assert.ok(s.hue >= 0 && s.hue <= 0.14, `warm hue ${s.hue}`);
      }
      assert.ok(d.marks.length >= 3, "the room and your glow");
      if (d.splats.length === 2) sawPair = true;
      if (d.strips.some((x) => x.kind === "ripples" && x.items.length)) sawRipple = true;
      if (d.points && d.points.n > 0) sawSong = true;
      if (d.rings.some((g) => g.id === "thumb" && g.kind === "rest" && g.dock === "thumb")) sawThumb = true;
      if (d.rings.some((g) => g.kind === "breath")) sawBreathRing = true;
      if (st.t < TUNE.whiteS - 1e-9) assert.ok(!d.rings.some((g) => g.kind === "mother"), "no heart ring in the silence");
    };
    const { st } = play({ input: mk(2), each: check1 });
    check1(st);
    assert.ok(sawPair && sawRipple && sawSong && sawThumb && sawBreathRing, `${kind}: pair ${sawPair}, ripples ${sawRipple}, song ${sawSong}, thumb ${sawThumb}, breath ring ${sawBreathRing}`);
  }
  const first = E.view(E.create(1, DEFAULT_CARRY, {}));
  assert.equal(first.light.white, 1, "it starts white, where birth's light left off");
  assert.ok(first.light.exposure > 1);
});

await check("the hold needs a fresh press: a press from the white, still down, starts nothing", () => {
  const { st, evs } = play({ input: held(0.5) });
  near(named(evs, "milestone").find((e) => e.id === "breath").t, 4.5, 1e-9, "the breath still comes by itself");
  assert.equal(st.subgoals.breath, "auto");
  assert.equal(st.subgoals.rest, "auto", "the same press does not rest the thumb either");
  // a release with no press is ignored
  const r = play({ input: script([["release", 2.0], ["release", 13.0]]) });
  assert.deepEqual(r.st.subgoals, { breath: "auto", rest: "auto" });
  // a press held from skin-to-skin does not count; a new press in the thumb moment does
  const t = play({ input: script([["press", 10.0], ["release", 14.0], ["press", 15.0]]) });
  const done = named(t.evs, "subgoal").find((e) => e.id === "rest" && e.state === "done");
  near(done.t, 15.0, 1e-9, "the rest by your fresh press");
});

await check("the inhale lasts at least 0.4 s and lets go by itself at 2.5 s", () => {
  const quick = play({ input: script([["press", 2.0], ["release", 2.1]]) });
  near(E.result(quick.st).metrics.cryT, 2.4, 1e-9, "a quick tap still draws 0.4 s");
  const long = play({ input: script([["press", 2.0], ["release", 9.0]]) });
  near(E.result(long.st).metrics.cryT, 4.5, 1e-9, "it lets go by itself at 2.5 s");
  assert.ok(!named(long.evs, "fact").some((e) => e.id === "end.seconds"), "a press before 4.5 s keeps the auto breath away");
  const mid = play({ input: script([["press", 2.0], ["release", 3.3]]) });
  near(E.result(mid.st).metrics.cryT, 3.3, 1e-9, "the cry at the release");
  // a late breath shifts skin-to-skin a little, and the ending still ends by the cap
  const late = play({ input: script([["press", 4.49], ["release", 9]]) });
  const m = E.result(late.st).metrics;
  assert.ok(m.skinT > 9 && m.skinT < 11, `skin-to-skin at ${m.skinT}`);
  assert.ok(m.endT <= TUNE.capS, `the end at ${m.endT}`);
  // two more breaths by themselves, a little uneven, before skin-to-skin
  for (let seed = 1; seed <= 20; seed++) {
    const { st } = play({ seed });
    const bs = st.breaths;
    assert.equal(bs.length, 3);
    assert.ok(bs[1].t0 >= 5.9 && bs[2].t1 <= 9.0 + 1e-9, `seed ${seed}: breaths at ${bs.map((b) => b.t0.toFixed(2))}`);
    assert.ok(bs[1].t0 > bs[0].t1 && bs[2].t0 > bs[1].t1, "one after the other");
  }
});

await check("the thumb ring: placed for portrait and docked by layout; it pulses with her ring while you rest", () => {
  const st = E.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  for (let i = 0; i < 2 / DT; i++) E.step(st, makeIntents());
  E.jump(st, "thumb");
  for (let i = 0; i < 30; i++) E.step(st, makeIntents());
  let ring = E.view(st).rings.find((g) => g.id === "thumb");
  assert.ok(ring, "the thumb ring shows from its prompt");
  assert.equal(ring.dock, "thumb");
  assert.ok(ring.y < -60, "low on a portrait screen (78% of the height at 390 × 844)");
  const her = () => E.view(st).rings.find((g) => g.id === "mother").progress;
  assert.notEqual(ring.progress, her(), "untouched, it breathes slowly on its own");
  E.step(st, makeIntents({ presses: [{ t: st.t, raw: st.t }], touching: true }));
  for (let i = 0; i < 20; i++) {
    E.step(st, makeIntents({ touching: true }));
    ring = E.view(st).rings.find((g) => g.id === "thumb");
    assert.equal(ring.progress, her(), "resting: both rings pulse together");
  }
  assert.equal(st.subgoals.rest, "done");
});

await check("the song comes from the carry, clear; answered notes shimmer; sparks show on your rim", () => {
  const notes = DEFAULT_SONG.map((n, i) => n + (i % 3));
  const carry = mergeCarry(DEFAULT_CARRY, { song: { notes, lit: 0b1010101010101010 }, sparks: 5 });
  const st = E.create(1, carry, {});
  E.jump(st, "song");
  const ev = named(st.events, "song")[0];
  assert.deepEqual(ev.notes, notes);
  assert.equal(ev.lit, 0b1010101010101010);
  assert.equal(ev.clear, true);
  near(ev.noteS * notes.length, 12, 1e-9, "16 notes over 12 s");
  assert.ok(!ev.gapS, "noteS is the whole note period (sound.hum: noteS + gapS), the dots' 0.75 s");
  for (let i = 0; i < 12.5 / DT; i++) E.step(st, makeIntents());
  const d = E.view(st);
  assert.equal(d.points.n, 16, "every hummed note is a dot");
  const ripples = d.strips.find((x) => x.kind === "ripples");
  assert.ok(ripples, "and a ripple");
  assert.equal(d.marks.filter((m) => m.kind === "spot").length, 5, "5 sparks");
  const plain = E.create(1, DEFAULT_CARRY, {});
  assert.equal(E.view(plain).marks.filter((m) => m.kind === "spot").length, 0, "no sparks by default");
});

await check("the run time line: a caption at about 29 s, with {time} from opts.runMs when given", () => {
  const a = play({ opts: { runMs: 588000 } });
  const c = named(a.evs, "caption").find((e) => e.id === "ending.time");
  near(c.t, 29, 1e-9, "at 29 s");
  assert.equal(c.ms, 588000);
  assert.deepEqual(c.vars, { time: "9 min 48 s" });
  assert.equal(say("ending.time", c.vars), "Your nine months took 9 min 48 s.");
  const b = play();
  const d = named(b.evs, "caption").find((e) => e.id === "ending.time");
  assert.equal(d.ms, null, "the host fills {time} from run.ms");
});

await check("facts: each shown fact is the ending's, allow-listed, R or A, short; end.apgar only on the result", () => {
  const ids = new Set(FACTS.map((f) => f.id));
  assert.deepEqual([...ids], ["end.seconds", "end.breath", "end.fluid", "end.skin", "end.voice", "end.apgar"]);
  for (const f of FACTS) {
    assert.equal(f.stage, "ending");
    assert.equal(f.gaDay, 280);
    assert.equal(f.checked, true);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.ok(f.src.length && f.src.every((k) => SOURCES[k]), `${f.id} sources ${f.src}`);
    assert.ok(!/^(Week|Day)\b/.test(f.text), f.id);
    assert.ok(f.text.split(/\s+/).length <= 20, `${f.id} ≤ 20 words`);
    for (const s of f.text.split(/(?<=\.)\s+/)) assert.ok(s.split(/\s+/).length <= 16, `${f.id}: a sentence ≤ 16 words`);
    assert.ok(byId(f.id), `${f.id} reaches core/facts.js`);
  }
  assert.equal(FACTS.find((f) => f.id === "end.apgar").where, "result");
  // end.fluid and end.seconds have no room to show whole in the ending (design.md 12): "What was real" facts
  assert.equal(FACTS.find((f) => f.id === "end.fluid").where, "result");
  assert.equal(FACTS.find((f) => f.id === "end.seconds").where, "result");
  for (const f of FACTS.filter((x) => !["end.apgar", "end.fluid", "end.seconds"].includes(x.id))) assert.equal(f.where, "caption", f.id);
  const shown = new Set();
  for (const [, mk] of Object.entries(KINDS)) for (const e of named(play({ input: mk(1) }).evs, "fact")) shown.add(e.id);
  for (const id of shown) assert.ok(ids.has(id) && id !== "end.apgar" && id !== "end.fluid", `${id} shown`);
  for (const id of ["end.breath", "end.skin", "end.voice"]) assert.ok(shown.has(id), `${id} shows in every ending`);
  assert.ok(!FACTS.filter((f) => f.id !== "end.apgar").some((f) => /apgar/i.test(f.text)), "Apgar only in end.apgar");
});

await check("strings: every id used is registered; plain, short and gentle; no pronoun for the carer", () => {
  const used = new Set();
  for (const [, mk] of Object.entries(KINDS)) {
    for (const e of play({ input: mk(1) }).evs) {
      if (e.name === "prompt" && e.text) used.add(e.text);
      if (e.name === "prompt" && e.textKeys) used.add(e.textKeys);
      if (e.name === "caption") used.add(e.id);
      if (e.name === "subgoal") used.add(e.text);
    }
  }
  for (const id of used) assert.ok(TEXT[id], `${id} is in ending.text.js`);
  // a desktop (".keys") or one-button (".one") form is used when its prompt is: main.js picks it (promptText)
  for (const id of Object.keys(TEXT)) assert.ok(used.has(id) || used.has(id.replace(/\.(keys|one)$/, "")), `${id} is used`);
  const mine = new Set(Object.keys(TEXT));
  assert.ok(allStrings().filter((s) => mine.has(s.id)).length === mine.size, "registered through core/text.js");
  const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*|apgar)\b/i;
  const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
  for (const carer of Object.keys(CARERS)) {
    for (const id of mine) {
      const s = say(id, { time: "9 min 48 s" }, { carer });
      assert.ok(!BANNED.test(s), `${id}: ${s}`);
      assert.ok(!PRONOUNS.test(s), `${id}: ${s}`);
      for (const sentence of s.split(/(?<=\.)\s+/)) assert.ok(sentence.split(/\s+/).length <= 16, `${id}: ${s}`);
    }
    for (const f of FACTS) {
      const s = f.text.replace(/\{carer\}/g, CARERS[carer]);
      assert.ok(!BANNED.test(s) || f.id === "end.apgar", `${f.id}: ${s}`);
      assert.ok(!PRONOUNS.test(s), `${f.id}: ${s}`);
    }
  }
  assert.equal(say("ending.capHeart", {}, { carer: "mum" }), "[Your mum's heartbeat, clear now]");
});

await check("botSteer never steers, keeps its memory only in r.mem, and leaves the state alone", () => {
  const st = E.create(1, DEFAULT_CARRY, {});
  const r = stream(1, "probe");
  r.mem = {};
  for (let i = 0; i < 40 / DT && !E.result(st).done; i++) {
    const before = JSON.stringify({ t: st.t, moment: st.moment, subgoals: st.subgoals, breaths: st.breaths, rest: st.rest, agenda: st.agenda });
    const a = E.botSteer(st, 0.7, r);
    assert.deepEqual(a.steer, { x: 0, y: 0 });
    assert.equal(a.dir, null);
    assert.equal(typeof a.hold, "boolean");
    assert.equal(JSON.stringify({ t: st.t, moment: st.moment, subgoals: st.subgoals, breaths: st.breaths, rest: st.rest, agenda: st.agenda }), before);
    E.step(st, makeIntents());
  }
  assert.deepEqual(Object.keys(r.mem), ["ending"], "its plan sits in r.mem");
  assert.equal(E.probe(st), null);
});

await check("a practice run of the ending through createRun reaches the result, silent for 1.5 s, with no points", () => {
  const run = createRun({ seed: 3, start: { practice: "ending" } });
  const bot = createBot(0.7, 3);
  const evs = [];
  const beats = [];
  for (let n = 0; run.screen !== "result" && n < MAX + 600; n++) {
    beats.push(...run.beats(run.t, run.t + DT));
    playStep(run, bot);
    evs.push(...run.events.splice(0));
  }
  assert.equal(run.screen, "result");
  const start = named(evs, "stageStart")[0];
  assert.equal(start.id, "ending");
  assert.ok(beats.length && beats[0] >= start.t + 1.5 - 1e-9, "her first beat after the silence");
  assert.equal(named(evs, "points").length, 0);
  assert.equal(run.summary().stages.length, 0, "no stage score");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
