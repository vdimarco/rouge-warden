// First Breath: stage 6, Second Trimester (`answer`, design.md 6.6, 4.1, 5.2, 7, 15, 16.4, 18; tasks 2.23 to 2.26).
// The meta and moments match the 4.1 table; the same seed and input play the same stage (two seeds); the scripted
// ideal input reaches Glowing (10,000); idle ends by the cap with its goal met; the skill 0.7 bot completes; one
// live gesture per moment; at most 2 families; every sub-goal ends done or auto; every target carries P, sits on
// one of her beats and has its ring in view for its preview; every view validates; no phrase before gaDay 133; the
// voice never stops (16 hummed notes on time for every input); the 75% match rule, "{Carer} feels you." and the hand
// glow from phrase 2; the eyes open by themselves at week 26 and the vignette lifts; the score parts; the carry out
// `song`; Off and free presses change nothing, presses count only in tap moments, Assist widens the windows; jump;
// junk input never throws; the facts (allow-listed sources, R or A, labels that match the clock) and the strings (no
// banned words, no pronouns, short sentences).
// node qa/first-breath/stage-answer.test.mjs
import assert from "node:assert/strict";
import * as answer from "../../public/first-breath/core/stages/answer.js";
import { TUNE } from "../../public/first-breath/core/stages/answer.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/answer.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/answer.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { DT, label, week } from "../../public/first-breath/core/clock.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate, LIMITS } from "../../public/first-breath/core/draw.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { check as checkTargets, previewS } from "../../public/first-breath/core/lib/track.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { say, CARERS, fill } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/stage-answer.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

const BEAT = 60 / 78;
const OPTS = { assist: false, oneButton: false, motherPhase: 0 };
const GESTURES = { hear: "none", beat: "tap", phrases: "tap", eyes: "none", outro: "none" };
const parse = (id) => { const p = id.split("."); return p[0] === "answer" ? { group: "answer", phrase: +p[2], slot: +p[3] } : { group: "beat", k: +p[2] }; };

// Inputs: each is (st) → intents for the step [st.t, st.t + DT), made fresh per play.
const idle = () => () => makeIntents();
// Press each target exactly on time, except those `skip` names; `errMs` shifts every press.
function scripted({ skip = () => false, errMs = 0 } = {}) {
  const done = new Set();
  return (st) => {
    const presses = [];
    for (const x of answer.targets(st, 1)) {
      const at = x.t + errMs / 1000;
      if (done.has(x.id) || at >= st.t + DT || at < st.t - 0.3) continue;
      done.add(x.id);
      if (!skip(x)) presses.push({ t: Math.max(at, st.t), raw: Math.max(at, st.t) });
    }
    return makeIntents({ presses, touching: presses.length > 0 });
  };
}
const botInput = (skill, seed) => { const bot = createBot(skill, seed); return (st) => bot.intents(answer, st); };
// A seeded mash: a press in about one step in eight, at a random time inside the step.
function mash(seed) {
  const r = stream(seed, "mash");
  return (st) => makeIntents(r() < 0.125 ? { presses: [{ t: st.t + r() * DT, raw: st.t }], touching: true } : {});
}

// Play a stage to its end, recording events (with the gaDay at each), gestures per moment, and every view's
// problems; `each(st)` runs before every step.
function play(seed, input, { opts = OPTS, carry = DEFAULT_CARRY, each = null, views = true, maxS = 120 } = {}) {
  const st = answer.create(seed, carry, opts);
  const evs = st.events.splice(0).map((e) => ({ ...e, gaDay: st.gaDay }));
  const gestures = {};
  const bad = [];
  let steps = 0;
  const note = () => {
    const g = answer.prompt(st).gesture;
    if (!answer.result(st).done) (gestures[st.moment] = gestures[st.moment] || new Set()).add(g);
  };
  note();
  while (!answer.result(st).done && st.t < maxS) {
    if (each) each(st);
    if (views) { const v = validate(answer.view(st)); if (v.length && bad.length < 5) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${v.join("; ")}`); }
    answer.step(st, input(st));
    for (const e of st.events) evs.push({ ...e, gaDay: st.gaDay });
    st.events.length = 0;
    note();
    steps++;
  }
  return { st, evs, gestures, bad, res: answer.result(st), steps };
}
const named = (evs, name, id) => evs.filter((e) => e.name === name && (id === undefined || e.id === id));

const IDEAL = play(1, scripted());
const IDLE = play(1, idle());
const MID = [];
for (let seed = 1; seed <= 10; seed++) MID.push(play(seed, botInput(0.7, seed), { views: seed <= 2 }));
const MASH = play(3, mash(3));

await check("meta: the 3.1 row, at most 2 families, and the 4.1 moments", () => {
  const m = answer.meta;
  assert.equal(m.id, "answer"); assert.equal(m.index, 5); assert.equal(m.name, "Second Trimester"); assert.equal(m.verb, "Answer");
  assert.equal(m.orient, "fit");
  assert.deepEqual([...m.families], ["tap"]);
  assert.ok(m.families.length <= 2);
  assert.deepEqual({ ...m.ga }, { start: 98, end: 195 });
  assert.deepEqual({ ...m.mm }, { start: 150, end: 600 });
  assert.equal(m.fertilized, true); assert.equal(m.motherBpm, 78);
  assert.equal(m.parS, 64); assert.equal(m.capS, 80); assert.equal(m.canFail, false); assert.equal(m.scored, true);
  assert.deepEqual(m.moments.map((x) => [x.id, [...x.ga]]), [["hear", [105, 105]], ["beat", [105, 126]], ["phrases", [133, 175]], ["eyes", [175, 182]], ["outro", [189, 195]]]);
  assert.equal(m.moments[0].lenS, null);
  near(m.moments[1].lenS, 8 * BEAT, 1e-9, "beat: its 8 targets");
  near(m.moments[2].lenS, 60 * BEAT, 1e-9, "phrases: 6 phrases of 10 beats");
  assert.equal(m.moments[3].lenS, 4); assert.equal(m.moments[4].lenS, 3);
  assert.equal(TUNE.patterns.join(""), "x...x.x.xx.xx.xxxxx.xxxx");
  assert.equal(TUNE.patterns.join("").split("x").length - 1, 16, "16 notes");
});

await check("the same seed and input play the same stage (seeds 1 and 2); seeds differ in the song", () => {
  for (const seed of [1, 2]) {
    const a = play(seed, botInput(0.7, seed), { views: false }), b = play(seed, botInput(0.7, seed), { views: false });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}: events`);
    assert.deepEqual(a.res, b.res, `seed ${seed}: result`);
    assert.equal(JSON.stringify(answer.view(a.st)), JSON.stringify(answer.view(b.st)), `seed ${seed}: the last view`);
  }
  const songs = new Set([1, 2, 3, 4, 5].map((s) => play(s, idle(), { views: false }).res.carryOut.song.notes.join(",")));
  assert.ok(songs.size >= 4, `${songs.size} different songs over 5 seeds`);
});

await check("the scripted ideal input reaches Glowing: every target In time, 10,000", () => {
  const { res, evs, st } = IDEAL;
  assert.equal(res.done, true); assert.equal(res.goalMet, true);
  assert.deepEqual(res.score, { goal: 3000, skill: 6000, flourish: 1000, total: 10000 });
  assert.equal(gradeOf(res.score.total, res.goalMet), "Glowing");
  const judges = named(evs, "judge");
  assert.equal(judges.length, 24);
  assert.ok(judges.every((e) => e.grade === "in"), "all In time");
  assert.equal(res.metrics.matches, 6); assert.equal(res.metrics.perfect, 4, "the Flourish caps at 4 perfect phrases");
  assert.equal(res.carryOut.song.lit, 0xffff);
  assert.deepEqual(st.subgoals, { beat: "done", answer: "done" });
});

await check("idle ends by the cap with its goal met, at about 64 s for every phase of her beat", () => {
  for (const motherPhase of [0, 0.4, 0.76]) {
    const { res, st, evs } = play(1, idle(), { opts: { ...OPTS, motherPhase }, views: false });
    assert.equal(res.done, true); assert.equal(res.goalMet, true);
    assert.ok(st.t <= answer.meta.capS, `ended at ${st.t}`);
    assert.ok(st.t >= 63.8 && st.t <= 64.7, `length ${st.t.toFixed(2)} s`);
    assert.deepEqual(res.score, { goal: 3000, skill: 0, flourish: 0, total: 3000 });
    assert.equal(gradeOf(res.score.total, true), "Good");
    assert.ok(named(evs, "judge").every((e) => e.grade === "miss"));
    assert.equal(st.gaDay, 195, "the clock ends at week 27");
  }
});

await check("the skill 0.7 bot completes every stage it plays (10 seeds), mostly Great or better", () => {
  for (const { res, st } of MID) {
    assert.equal(res.done, true); assert.equal(res.goalMet, true);
    assert.ok(st.t <= answer.meta.capS);
    assert.ok(res.score.total >= 3000);
  }
  const mean = MID.reduce((a, r) => a + r.res.score.total, 0) / MID.length;
  assert.ok(mean >= 6500, `mean ${mean}`);
  const ref = [1, 2, 3, 4, 5].map((s) => play(s, botInput(1, s), { views: false }).res.score.total);
  assert.ok(ref.every((t) => t >= 8500), `ref ${ref}`);
});

await check("one live gesture per moment, as 6.6 gives it, for every input; prompts name a string", () => {
  for (const run of [IDEAL, IDLE, MASH, ...MID.slice(0, 3)]) {
    assert.deepEqual(Object.keys(run.gestures), Object.keys(GESTURES));
    for (const [m, set] of Object.entries(run.gestures)) assert.deepEqual([...set], [GESTURES[m]], m);
    for (const e of named(run.evs, "prompt")) if (e.text) assert.notEqual(say(e.text), e.text, `${e.text} has a string`);
  }
});

await check("every sub-goal is shown, then ends done or auto (none passes silently)", () => {
  for (const run of [IDEAL, IDLE, MASH, ...MID]) {
    const ids = Object.keys(run.st.subgoals);
    assert.deepEqual(ids.sort(), ["answer", "beat"]);
    for (const id of ids) {
      assert.ok(["done", "auto"].includes(run.st.subgoals[id]), `${id} ${run.st.subgoals[id]}`);
      const states = named(run.evs, "subgoal", id).map((e) => e.state);
      assert.equal(states[0], "shown"); assert.equal(states.length, 2);
      for (const e of named(run.evs, "subgoal", id)) assert.notEqual(say(e.text), e.text, `${e.text} has a string`);
    }
  }
  assert.deepEqual(IDLE.st.subgoals, { beat: "auto", answer: "auto" });
});

await check("targets carry P, sit on her beats, are spaced ≥ 0.5 s, and match the patterns", () => {
  for (const motherPhase of [0, 0.37]) {
    const st = answer.create(5, DEFAULT_CARRY, { ...OPTS, motherPhase });
    const all = answer.targets(st, 1e6);
    assert.equal(all.length, 24);
    assert.deepEqual(checkTargets(all), []);
    all.forEach((x, i) => {
      assert.ok(Number.isFinite(x.P) && x.P >= 0.5, `${x.id} P ${x.P}`);
      near(x.P, Math.max(0.5, i ? x.t - all[i - 1].t : BEAT), 1e-9, `${x.id} P is its spacing`);
      assert.equal(x.kind, "tap"); assert.equal(x.heart, "mother");
      const b = st.beats.next("mother", x.t - 1e-6);
      near(b, x.t, 1e-9, `${x.id} on her beat`);
    });
    const beats = all.filter((x) => x.group === "beat"), notes = all.filter((x) => x.group === "answer");
    assert.equal(beats.length, 8); assert.equal(notes.length, 16);
    for (let i = 1; i < 8; i++) near(beats[i].t - beats[i - 1].t, BEAT, 1e-9, "the 8 heartbeat taps on 8 beats in a row");
    // answers: slot k of phrase p lies 4 + k beats after the phrase start, phrases 10 beats apart
    const ph0 = notes[0].t - 4 * BEAT;
    near(ph0 - beats[7].t, BEAT, 1e-9, "the phrases start the beat after the last heartbeat tap");
    for (const x of notes) {
      const { phrase, slot } = parse(x.id);
      assert.equal(TUNE.patterns[phrase][slot], "x");
      near(x.t, ph0 + (10 * phrase + 4 + slot) * BEAT, 1e-6, x.id);
    }
  }
});

await check("every target's ring is in view for its preview, max(2 beats, 1.2 s) before its time (also muted)", () => {
  const seen = new Map();
  const st0 = answer.create(1, DEFAULT_CARRY, OPTS);
  const all = answer.targets(st0, 1e6);
  play(1, scripted(), {
    views: false,
    each: (st) => { for (const g of answer.view(st).rings) if (g.id.startsWith("t:") && !seen.has(g.id.slice(2))) seen.set(g.id.slice(2), st.t); },
  });
  const pre = previewS(BEAT);
  for (const x of all) {
    assert.ok(seen.has(x.id), `${x.id} never had a ring`);
    assert.ok(x.t - seen.get(x.id) >= pre - DT - 1e-9, `${x.id}: ring ${(x.t - seen.get(x.id)).toFixed(3)} s ahead`);
  }
});

await check("every view validates (ideal, idle, mash, bot), within LIMITS, with a camera, an anchor and a cue", () => {
  for (const run of [IDEAL, IDLE, MASH, MID[0], MID[1]]) assert.deepEqual(run.bad, []);
  const st = answer.create(2, { ...DEFAULT_CARRY, sparks: 5, nestleX: 0.8 }, OPTS);
  let cues = 0, strips = 0, marks = 0;
  for (let i = 0; i < 65 / DT; i++) {
    const d = answer.view(st);
    assert.deepEqual(validate(d), []);
    assert.equal(d.camera.orient, "fit"); assert.equal(d.stage, "answer");
    assert.ok(d.splats.length <= 14 && d.rings.length <= LIMITS.rings && d.marks.length <= LIMITS.marks);
    assert.deepEqual(d.anchor, { x: TUNE.view.baby.x, y: TUNE.view.baby.y });
    if (d.cue) cues++;
    strips = Math.max(strips, d.strips.length); marks = Math.max(marks, d.marks.length);
    if (st.moment === "phrases" || st.moment === "beat") assert.ok(d.cue, `a cue in ${st.moment}`);
    answer.step(st, makeIntents()); st.events.length = 0;
  }
  assert.ok(cues > 0 && strips >= 3 && marks >= 8, `strips ${strips}, marks ${marks}`);
  const d = answer.view(answer.create(2, { ...DEFAULT_CARRY, nestleX: 0.8 }, OPTS));
  near(d.marks.find((m) => m.kind === "glowwall").x, 0.8 * TUNE.view.disc.spread, 1e-9, "the disc sits where you nestled");
  assert.ok(d.strips.some((s) => s.kind === "tree") && d.strips.some((s) => s.kind === "cord") && d.strips.some((s) => s.kind === "ripples"));
});

await check("no phrase before gaDay 133: the first hummed note and every answer come in `phrases`", () => {
  for (const run of [IDEAL, IDLE, MASH]) {
    const hums = named(run.evs, "sfx", "answer.hum");
    const start = named(run.evs, "moment", "phrases")[0];
    assert.ok(start && start.gaDay >= 133);
    for (const h of hums) {
      assert.ok(h.gaDay >= 133, `a hum sent at gaDay ${h.gaDay}`);
      assert.ok(h.at >= start.t - DT - 1e-9 && h.t >= start.t - DT - 1e-9, `a hum at ${h.at} before the phrases at ${start.t}`);
    }
    for (const j of named(run.evs, "judge")) if (j.target.startsWith("answer.")) assert.ok(j.gaDay >= 133);
  }
});

await check("the voice never stops: 16 hummed notes on her beats at the same times for every input", () => {
  const times = (run, notes = true) => named(run.evs, "sfx", "answer.hum").map((e) => e.at.toFixed(6) + (notes ? ":" + e.note : ""));
  const want = times(IDEAL);
  assert.equal(want.length, 16);
  for (const run of [IDLE, MID[0]]) assert.deepEqual(times(run), want, "seed 1: the same notes at the same times");
  assert.deepEqual(times(MASH, false), times(IDEAL, false), "another seed and a mash: the same times");
  const hums = named(IDLE.evs, "sfx", "answer.hum");
  for (const h of hums) {
    near(IDLE.st.beats.next("mother", h.at - 1e-6), h.at, 1e-9, "on her beat");
    assert.ok(h.pitch >= 160 && h.pitch <= 300, `pitch ${h.pitch}`);
    assert.ok(h.t <= h.at + DT + 1e-9 && h.at - h.t <= TUNE.humLeadS + DT, "sent by the step that holds its time, or just ahead");
  }
  assert.deepEqual(named(IDLE.evs, "caption").filter((e) => /^answer\.cap\.hum/.test(e.id)).map((e) => e.id),
    ["answer.cap.hum1", "answer.cap.hum2", "answer.cap.hum3", "answer.cap.hum3", "answer.cap.hum3", "answer.cap.hum4"]);
  assert.equal(IDLE.res.metrics.phrases, 6);
});

await check("the match rule: ≥ 75% Close or better is a match; \"{Carer} feels you.\"; the hand glow from phrase 2", () => {
  const feels = (run) => named(run.evs, "caption", "answer.feels").length;
  const hands = (run) => named(run.evs, "sfx", "answer.hand").length;
  assert.equal(feels(IDEAL), 6); assert.equal(hands(IDEAL), 5, "no hand glow on phrase 1");
  assert.equal(feels(IDLE), 0); assert.equal(hands(IDLE), 0);
  // phrase 6 (xxxx): 3 of 4 is a match, 2 of 4 is not; phrase 5 (xxx.): 2 of 3 is not
  const skip = (pred) => scripted({ skip: (x) => { const p = parse(x.id); return p.group === "answer" && pred(p); } });
  const a = play(1, skip((p) => p.phrase === 5 && p.slot === 0), { views: false });
  assert.equal(a.res.metrics.matches, 6); assert.equal(a.res.metrics.perfect, 4);
  const b = play(1, skip((p) => p.phrase === 5 && p.slot < 2), { views: false });
  assert.equal(b.res.metrics.matches, 5);
  const c = play(1, skip((p) => p.phrase === 4 && p.slot === 0), { views: false });
  assert.equal(c.res.metrics.matches, 5);
  // only phrase 1 answered: a match with no hand glow; only phrase 2: the hand glow shows in view
  const only = (n) => skip((p) => p.phrase !== n);
  const one = play(1, only(0), { views: false });
  assert.equal(feels(one), 1); assert.equal(hands(one), 0);
  let handSeen = 0;
  const two = play(1, only(1), { views: false, each: (st) => { if (answer.view(st).marks.some((m) => m.kind === "hand")) handSeen++; } });
  assert.equal(feels(two), 1); assert.equal(hands(two), 1);
  assert.ok(handSeen * DT >= 2 && handSeen * DT <= 3, `the hand glow shows ${(handSeen * DT).toFixed(2)} s`);
  // Close counts toward a match but not toward the Flourish
  const close = play(1, scripted({ errMs: 120 }), { views: false });
  assert.equal(close.res.metrics.matches, 6); assert.equal(close.res.score.flourish, 0);
  assert.deepEqual(close.res.score, { goal: 3000, skill: 3000, flourish: 0, total: 6000 });
});

await check("the eyes open by themselves at week 26 and the vignette lifts over 2 s; hearing at the start", () => {
  const { evs } = IDLE;
  assert.equal(named(evs, "milestone", "hearing")[0].t, 0);
  const eyes = named(evs, "milestone", "eyes");
  assert.equal(eyes.length, 1);
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  let at = null, gaAtEyes = null, v0 = null;
  while (!answer.result(st).done) {
    const before = st.gaDay;
    answer.step(st, makeIntents());
    if (st.events.some((e) => e.name === "milestone" && e.id === "eyes")) { at = st.t; gaAtEyes = before; v0 = answer.view(st).light.vignette; }
    st.events.length = 0;
    if (at !== null && st.t >= at + 2.05) break;
  }
  assert.ok(at !== null);
  near(gaAtEyes, 182, 0.05, "the eyes open as the clock reaches gaDay 182");
  assert.equal(label(182), "Week 26");
  near(v0, TUNE.view.vignette0, 0.02, "the vignette starts closed");
  near(answer.view(st).light.vignette, TUNE.view.vignette1, 1e-9, "and has lifted 2 s later");
  assert.ok(named(evs, "fact", "answer.jump").length === 1);
});

await check("score parts: Skill 1,500 × beat + 4,500 × answer accuracy; Flourish 250 a perfect phrase; points add up", () => {
  for (const run of [IDEAL, IDLE, MASH, ...MID]) {
    const { res, evs } = run;
    const m = res.metrics;
    assert.equal(res.score.skill, Math.round(1500 * m.beatAccuracy) + Math.round(4500 * m.answerAccuracy));
    assert.equal(res.score.flourish, Math.min(1000, 250 * m.perfect));
    assert.equal(res.parts.reduce((a, p) => a + p.value, 0), res.score.total, "the parts add up to the total");
    for (const p of res.parts) assert.notEqual(say(p.label), p.label, `${p.label} has a string`);
    const pts = named(evs, "points").reduce((a, e) => a + e.add, 0);
    assert.equal(pts, res.score.total, "the points events add up to the total");
  }
  // only the heartbeat taps: 1,500 of skill
  const beatOnly = play(1, scripted({ skip: (x) => parse(x.id).group === "answer" }), { views: false });
  assert.deepEqual(beatOnly.res.score, { goal: 3000, skill: 1500, flourish: 0, total: 4500 });
});

await check("carry out: song = the 16 hummed notes and a mask of the notes answered Close or better", () => {
  const notes = IDEAL.res.carryOut.song.notes;
  assert.equal(notes.length, 16);
  assert.deepEqual(notes, named(IDEAL.evs, "sfx", "answer.hum").map((e) => e.note));
  for (const n of notes) assert.ok(TUNE.song.set.includes(n));
  assert.equal(IDLE.res.carryOut.song.lit, 0);
  // answer only phrases 1 and 6: note 0 and notes 12 to 15
  const sel = play(1, scripted({ skip: (x) => { const p = parse(x.id); return p.group === "answer" && p.phrase !== 0 && p.phrase !== 5; } }), { views: false });
  assert.equal(sel.res.carryOut.song.lit, 0b1111000000000001);
  const merged = mergeCarry(DEFAULT_CARRY, sel.res.carryOut);
  assert.deepEqual(merged.song, { notes: sel.res.carryOut.song.notes, lit: 0b1111000000000001 }, "mergeCarry keeps it");
  for (const run of MID) assert.deepEqual(Object.keys(run.res.carryOut), ["song"]);
});

await check("judging: Off and free presses change nothing, only tap moments read presses, Assist widens the windows", () => {
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  const first = answer.targets(st, 1e6)[0];
  const pressAt = (s, t) => {
    while (s.t + DT <= t) { answer.step(s, makeIntents()); s.events.length = 0; }
    answer.step(s, makeIntents({ presses: [{ t, raw: t }] }));
    const j = s.events.filter((e) => e.name === "judge");
    s.events.length = 0;
    return j;
  };
  // presses during `hear` (gesture none) are ignored
  assert.deepEqual(pressAt(st, 1.0), []);
  // 300 ms early is Off: a judge event, then the target stays open and an on-time press is In time
  const off = pressAt(st, first.t - 0.3);
  assert.deepEqual(off.map((e) => e.grade), ["off"]);
  assert.ok(answer.targets(st, 1).some((x) => x.id === first.id), "Off leaves the target open");
  assert.equal(answer.result(st).score.skill, 0);
  assert.deepEqual(pressAt(st, first.t).map((e) => e.grade), ["in"]);
  // a free press half way between two heartbeat taps' Off windows does nothing
  const second = answer.targets(st, 1e6)[0];
  assert.deepEqual(pressAt(st, second.t - 0.5 * BEAT + 0.001).filter((e) => e.target === second.id && e.grade !== "off"), []);
  // 100 ms late: Close without Assist, In time with it
  const late = (assist) => { const s = answer.create(1, DEFAULT_CARRY, { ...OPTS, assist }); const x = answer.targets(s, 1e6)[0]; return pressAt(s, x.t + 0.1)[0].grade; };
  assert.equal(late(false), "close"); assert.equal(late(true), "in");
  // presses during eyes and outro are ignored
  const e = answer.create(1, DEFAULT_CARRY, OPTS);
  answer.jump(e, "eyes"); e.events.length = 0;
  for (let i = 0; i < 8 / DT && !answer.result(e).done; i++) {
    answer.step(e, makeIntents({ presses: [{ t: e.t, raw: e.t }] }));
    assert.equal(e.events.filter((x) => x.name === "judge").length, 0);
    e.events.length = 0;
  }
});

await check("jump: every moment starts now and the stage still ends with its goal met; unknown ids are refused", () => {
  for (const id of ["hear", "beat", "phrases", "eyes", "outro"]) {
    const st = answer.create(4, DEFAULT_CARRY, OPTS);
    for (let i = 0; i < 30; i++) { answer.step(st, makeIntents()); st.events.length = 0; }
    assert.equal(answer.jump(st, id), true);
    assert.equal(st.moment, id);
    assert.equal(answer.prompt(st).gesture, GESTURES[id]);
    let steps = 0;
    while (!answer.result(st).done && steps++ < 90 / DT) { answer.step(st, makeIntents()); st.events.length = 0; }
    const res = answer.result(st);
    assert.equal(res.done, true, id); assert.equal(res.goalMet, true);
    assert.ok(st.t <= answer.meta.capS + 1e-9);
    for (const s of Object.values(st.subgoals)) assert.ok(s === "done" || s === "auto", `${id}: ${s}`);
    assert.equal(res.metrics.eyesOpen, true);
  }
  const st = answer.create(4, DEFAULT_CARRY, OPTS);
  assert.equal(answer.jump(st, "carried"), false);
  answer.jump(st, "phrases");
  assert.equal(st.gaDay, 133);
  const x = answer.targets(st, 1e6);
  assert.equal(x.length, 16, "a phrases jump lays the 16 answers");
  near(x[0].t - 4 * BEAT, st.beats.next("mother", 0), 1e-9, "from her next beat");
});

await check("junk input never throws, and botSteer and probe are the tap-only defaults", () => {
  const junk = [null, undefined, 5, {}, { presses: 5 }, { presses: [null, { t: NaN }, { t: "x" }, { t: Infinity }] },
    { presses: [{ t: -1e9 }, { t: 1e9 }] }, makeIntents({ presses: Array.from({ length: 50 }, (_, i) => ({ t: i * 0.01 })) })];
  const st = answer.create(9, null, null);
  let i = 0;
  assert.doesNotThrow(() => { while (!answer.result(st).done && i < 100 / DT) { answer.step(st, junk[i++ % junk.length]); st.events.length = 0; } });
  assert.equal(answer.result(st).done, true);
  assert.deepEqual(validate(answer.view(st)), []);
  assert.doesNotThrow(() => answer.step(st, null));
  assert.deepEqual(answer.botSteer(st, 1, Object.assign(stream(1, "x"), { mem: {} })), { steer: { x: 0, y: 0 }, dir: null, hold: false });
  assert.equal(answer.probe(st), null);
  assert.deepEqual(answer.targets(st, 5), []);
});

// The 15.4 word rules, for every string the stage shows (its TEXT and its facts) with every carer word.
const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const words = (s) => s.replace(/[♪♥~·]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

await check("facts: the 6.6 ids with 15.2 sources from the allow-list, R or A, checked, short, labels that match the clock", () => {
  assert.deepEqual(FACTS.map((f) => f.id), ["answer.card", "answer.tri", "answer.hear", "answer.respond", "answer.w20",
    "answer.feel", "answer.outside", "answer.low", "answer.hic", "answer.jump", "answer.eyes"]);
  // answer.outside and answer.hic have no room to show whole in the stage (design.md 6.6, 12): "What was real" facts
  const where = { card: ["answer.card", "answer.tri"], overlay: ["answer.eyes"], result: ["answer.outside", "answer.hic"] };
  for (const f of FACTS) {
    assert.equal(f.stage, "answer");
    assert.equal(f.checked, true);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.ok(f.src.length > 0 && f.src.every((k) => SOURCES[k]), `${f.id}: ${f.src}`);
    assert.equal(f.where, Object.keys(where).find((w) => where[w].includes(f.id)) || "caption", f.id);
    assert.ok(!/^(Week|Day)/.test(f.text), f.id);
    assert.ok(f.gaDay >= 98 && f.gaDay <= 195);
    for (const carer of Object.keys(CARERS)) {
      const text = fill(f.text, {}, { carer });
      assert.ok(words(text).length <= 20, `${f.id}: ${words(text).length} words`);
      for (const s of sentences(text)) assert.ok(words(s).length <= 16, `${f.id}: "${s}"`);
      assert.ok(!BANNED.test(text) && !PRONOUNS.test(text), `${f.id}: ${text}`);
    }
    if (/\bcm\b/.test(f.text)) assert.match(f.text, /the NHS says/);
  }
  assert.ok(FACTS.find((f) => f.id === "answer.tri").text.includes("about"), "the trimester card says about");
  // the stage sends each caption fact once, while the clock shows the fact's own week; the card and overlay facts are the run's
  for (const run of [IDLE, IDEAL]) {
    const sent = named(run.evs, "fact");
    assert.deepEqual(sent.map((e) => e.id).sort(), FACTS.filter((f) => f.where === "caption").map((f) => f.id).sort());
    for (const e of sent) {
      const f = FACTS.find((x) => x.id === e.id);
      assert.equal(week(e.gaDay), week(f.gaDay), `${e.id} at gaDay ${e.gaDay}`);
      assert.equal(e.where, "caption");
    }
  }
});

await check("strings: every id the stage sends has text; no banned words, no pronouns, sentences ≤ 16 words", () => {
  for (const [id, text] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("answer."), id);
    for (const carer of Object.keys(CARERS)) {
      const s = fill(text, {}, { carer });
      assert.ok(!BANNED.test(s), `${id}: ${s}`);
      assert.ok(!PRONOUNS.test(s), `${id}: ${s}`);
      for (const x of sentences(s)) assert.ok(words(x).length <= 16, `${id}: "${x}"`);
      assert.ok(!/[{}]/.test(s), `${id}: an unfilled var`);
    }
  }
  const ids = new Set();
  for (const run of [IDEAL, IDLE, MASH]) {
    for (const e of run.evs) {
      if (e.name === "caption") ids.add(e.id);
      if (e.name === "prompt" && e.text) ids.add(e.text);
      if (e.name === "subgoal") ids.add(e.text);
    }
  }
  for (const id of ids) assert.ok(TEXT[id], `${id} is not in answer.text.js`);
  assert.equal(say("answer.feels", {}, { carer: "mum" }), "Your mum feels you.");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const mean = Math.round(MID.reduce((a, r) => a + r.res.score.total, 0) / MID.length);
  console.log(`PASS ${FILE}: ${passed} checks (ideal ${IDEAL.res.score.total}, idle ${IDLE.res.score.total} in ${IDLE.st.t.toFixed(1)} s, skill 0.7 mean ${mean} over ${MID.length} seeds)`);
}
