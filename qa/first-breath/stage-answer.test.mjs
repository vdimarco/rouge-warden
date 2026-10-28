// First Breath: stage 6, Second Trimester (`answer`): the rhythm stage (openspec change first-breath-action-genres,
// design.md 5.6 and its checks; the v1 judge, beats and facts, archive design.md 5.1, 5.2, 6.6, 15). The meta and
// moments match 5.6; the same seed and input play the same stage; perfect play reaches Glowing (10,000) whether it
// kicks by lane taps, by arrows (two quick arrows across two lanes) or as the bot does; Space alone in the middle lane
// earns Close for every note in another lane; idle completes by itself at about 74 s with its goal met; the bots
// (ref Great or better, 0.7 and 0.5 complete) and one-button mode through core/run.js (Great, every press in the
// note's lane); one live gesture per moment and the keys "lanes" in the kick moments; every sub-goal ends done or auto;
// the notes: patterns and lanes as listed, on her beats, spaced >= 0.5 s, each shown and ringed at least
// max(2 beats, 1.2 s) ahead; no phrase before gaDay 133; the call note rides down and is answered 4 beats later; the
// voice never stops (16 hums in the phrases and 16 in the sing-along at the same times for every input); the lanes:
// a press in the wrong lane is Close at best, an arrow moves one lane and kicks there, a tap kicks in the lane tapped,
// a touch flick or drag into the lane within 0.12 s counts (later is Close), a drag past 24 px slides one lane and
// stays after the lift, lanes do not matter in `beat`, for the jump note or with Assist; the fever lights after 8
// In time notes, multiplies only the song part, never passes its max and goes out on a miss; the match rule and the
// hand glow; the eyes open by themselves at week 26; the score parts add up; the carry out `song` and its lit mask;
// the juice (each kick plays her note back, the streak meter of 8 pips, the fever's word, the jump note's small
// shake); Off and free presses change nothing; jump; junk input never throws; botSteer; every view validates within LIMITS;
// the facts and the strings.
// node qa/first-breath/stage-answer.test.mjs
import assert from "node:assert/strict";
import * as answer from "../../public/first-breath/core/stages/answer.js";
import { TUNE } from "../../public/first-breath/core/stages/answer.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/answer.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/answer.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { createRun } from "../../public/first-breath/core/run.js";
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
const GESTURES = { hear: "none", beat: "tap", phrases: "tap", song: "tap", eyes: "none", outro: "none" };
const LANE_DIR = ["left", "up", "right"];
const LANES = "M L R L M R R L M L M R R M L M".split(" ").map((c) => ({ L: 0, M: 1, R: 2 })[c]);
const parse = (id) => {
  const p = id.split(".");
  if (p[0] === "answer") return { group: "answer", phrase: +p[2], slot: +p[3] };
  if (p[0] === "song") return { group: "song", k: +p[2] };
  return { group: "beat", k: +p[2] };
};
const ALL = (st) => answer.targets(st, 1e6);

// Inputs: each is (st) → intents for the step [st.t, st.t + DT), made fresh per play.
const idle = () => () => makeIntents();
// Press each note on time (shifted by errMs; skip(x) leaves one out), in its lane by `how`:
//   "dir"   the lane to be in, as intents.dir (the bot's and one-button's way), and a plain press
//   "tap"   a touch-down at the note's lane on your ring (tap the lane)
//   "keys"  arrows: one per lane moved (two quick ones, 40 ms apart, across two lanes), up to kick in place
//   "space" Space only: you stay in the middle lane
function scripted({ how = "dir", skip = () => false, errMs = 0, lane = null } = {}) {
  const planned = new Set(), queue = [];
  return (st) => {
    const xs = answer.targets(st, 1);
    for (const x of xs) {
      if (planned.has(x.id)) continue;
      planned.add(x.id);
      if (skip(x)) continue;
      const at = x.t + errMs / 1000;
      const want = lane !== null ? lane : x.lane < 0 ? st.lane : x.lane;
      if (how === "tap") queue.push({ t: at, x: answer.laneX(want, 1), y: answer.laneY(1) });
      else if (how === "keys") {
        // from the lane you will be in when this note comes (the one before it may move you)
        const from = queue.length && Number.isFinite(queue[queue.length - 1].to) ? queue[queue.length - 1].to : st.lane;
        const d = x.group === "beat" || x.lane < 0 ? 0 : want - from;
        if (Math.abs(d) === 2) queue.push({ t: at - 0.04, dir: d > 0 ? "right" : "left" });
        queue.push({ t: at, dir: d > 0 ? "right" : d < 0 ? "left" : "up", to: x.group === "beat" || x.lane < 0 ? from : want });
      } else queue.push({ t: at });
    }
    const presses = [];
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      if (q.t < st.t + DT) {
        const p = { t: Math.max(q.t, st.t), raw: Math.max(q.t, st.t) };
        if (q.dir) p.dir = q.dir;
        if (Number.isFinite(q.x)) { p.x = q.x; p.y = q.y; }
        presses.push(p);
        queue.splice(i--, 1);
      }
    }
    let dir = null;
    if (how === "dir") {
      const next = answer.targets(st, answer.TRAVEL)[0];
      if (next && next.lane >= 0 && st.moment !== "beat") dir = LANE_DIR[lane !== null ? lane : next.lane];
    }
    return makeIntents({ presses, dir, touching: presses.length > 0 });
  };
}
const botInput = (skill, seed) => { const bot = createBot(skill, seed); return (st) => bot.intents(answer, st); };
// A seeded mash: a press in about one step in eight, at a random time inside the step, now and then with a lane.
function mash(seed) {
  const r = stream(seed, "mash");
  return (st) => {
    if (!(r() < 0.125)) return makeIntents({});
    const p = { t: st.t + r() * DT, raw: st.t };
    const k = r();
    if (k < 0.3) p.dir = LANE_DIR[Math.floor(r() * 3)];
    else if (k < 0.6) { p.x = (r() - 0.5) * 80; p.y = -10; }
    return makeIntents({ presses: [p], touching: true });
  };
}

// Play a stage to its end, recording events (with the gaDay at each), gestures and keys per moment, and every
// view's problems; `each(st)` runs before every step.
function play(seed, input, { opts = OPTS, carry = DEFAULT_CARRY, each = null, views = true, maxS = 120 } = {}) {
  const st = answer.create(seed, carry, opts);
  const evs = st.events.splice(0).map((e) => ({ ...e, gaDay: st.gaDay }));
  const gestures = {}, keys = {};
  const bad = [];
  const note = () => {
    const p = answer.prompt(st);
    if (!answer.result(st).done) {
      (gestures[st.moment] = gestures[st.moment] || new Set()).add(p.gesture);
      (keys[st.moment] = keys[st.moment] || new Set()).add(p.keys);
    }
  };
  note();
  while (!answer.result(st).done && st.t < maxS) {
    if (each) each(st);
    if (views) { const v = validate(answer.view(st)); if (v.length && bad.length < 5) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${v.join("; ")}`); }
    answer.step(st, input(st));
    for (const e of st.events) evs.push({ ...e, gaDay: st.gaDay });
    st.events.length = 0;
    note();
  }
  return { st, evs, gestures, keys, bad, res: answer.result(st) };
}
const named = (evs, name, id) => evs.filter((e) => e.name === name && (id === undefined || e.id === id));
const grades = (run) => named(run.evs, "judge").filter((e) => e.grade !== "off").map((e) => e.grade);

const IDEAL = play(1, scripted());
const IDLE = play(1, idle());
const MID = [];
for (let seed = 1; seed <= 10; seed++) MID.push(play(seed, botInput(0.7, seed), { views: seed <= 2 }));
const MASH = play(3, mash(3));

await check("meta: the 5.6 row (rhythm, tap and steer, no hp), and its moments", () => {
  const m = answer.meta;
  assert.equal(m.id, "answer"); assert.equal(m.index, 5); assert.equal(m.name, "Second Trimester"); assert.equal(m.verb, "Answer");
  assert.equal(m.orient, "fit");
  assert.deepEqual([...m.families], ["tap", "steer"]);
  assert.deepEqual({ ...m.ga }, { start: 98, end: 195 });
  assert.deepEqual({ ...m.mm }, { start: 150, end: 600 });
  assert.equal(m.fertilized, true); assert.equal(m.motherBpm, 78);
  assert.equal(m.parS, 74); assert.equal(m.capS, 90); assert.equal(m.canFail, false); assert.equal(m.scored, true);
  assert.ok(!m.action, "no action layer: no hp, no knock-out");
  assert.deepEqual(m.moments.map((x) => [x.id, [...x.ga]]),
    [["hear", [105, 105]], ["beat", [105, 126]], ["phrases", [133, 168]], ["song", [168, 175]], ["eyes", [175, 182]], ["outro", [189, 195]]]);
  near(m.moments[1].lenS, 12 * BEAT, 1e-9, "beat: 12 beats, 6 kicks every 2nd beat");
  near(m.moments[2].lenS, 54 * BEAT, 1e-9, "phrases: 6 phrases of 9 beats");
  near(m.moments[3].lenS, 17 * BEAT, 1e-9, "song: 16 notes and the jump note");
  assert.equal(m.moments[4].lenS, 4); assert.equal(m.moments[5].lenS, 3);
  assert.deepEqual([...TUNE.patterns], ["M...", "L.R.", "LM.R", "R.LM", "LMR.", "RMLM"]);
  assert.deepEqual([...answer.LANES], LANES, "the 16 call notes' lanes, in order");
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

await check("perfect play reaches Glowing (10,000) by lane, by tap and by arrows; every note In time", () => {
  for (const [how, run] of [["dir", IDEAL], ["tap", play(2, scripted({ how: "tap" }), { views: false })], ["keys", play(3, scripted({ how: "keys" }), { views: false })]]) {
    const { res, st } = run;
    assert.equal(res.done, true, how); assert.equal(res.goalMet, true, how);
    assert.deepEqual(res.score, { goal: 3000, skill: 6000, flourish: 1000, total: 10000 }, how);
    assert.equal(gradeOf(res.score.total, res.goalMet), "Glowing");
    const g = grades(run);
    assert.equal(g.length, 39, `${how}: 6 + 16 + 17 notes`);
    assert.ok(g.every((x) => x === "in"), `${how}: all In time (${g.join(" ")})`);
    assert.equal(res.metrics.best, 39, `${how}: one streak`);
    assert.equal(res.metrics.matches, 6);
    assert.equal(res.carryOut.song.lit, 0xffff);
    assert.deepEqual(st.subgoals, { beat: "done", answer: "done" });
  }
});

await check("Space alone stays in the middle lane: notes in another lane are Close at best", () => {
  const run = play(1, scripted({ how: "space" }), { views: false });
  const by = (group) => named(run.evs, "judge").filter((e) => e.target.startsWith(group + ".") && e.grade !== "off");
  assert.ok(by("beat").every((e) => e.grade === "in"), "the heartbeat is one lane");
  for (const e of [...by("answer"), ...by("song")]) {
    const want = e.lane === 1 || e.lane === -1 ? "in" : "close";
    assert.equal(e.grade, want, `${e.target} in lane ${e.lane}`);
  }
  // the parts follow: 6 of 16 answers In time, 10 Close; the song 6 + the jump In time, 10 Close, no fever
  const m = run.res.metrics;
  near(m.answerAccuracy, 11 / 16, 1e-9, "answers");
  near(m.songAccuracy, 12 / 17, 1e-9, "song");
  assert.equal(m.feverNotes, 0, "no 8 In time in a row: no fever");
  assert.equal(run.res.score.skill, 1000 + Math.round(3000 * 11 / 16) + Math.round(2000 * 12 / 17));
});

await check("idle completes by itself at about 74 s for every phase of her beat, with its goal met", () => {
  for (const motherPhase of [0, 0.4, 0.76]) {
    const { res, st, evs } = play(1, idle(), { opts: { ...OPTS, motherPhase }, views: false });
    assert.equal(res.done, true); assert.equal(res.goalMet, true);
    assert.ok(st.t <= answer.meta.capS, `ended at ${st.t}`);
    assert.ok(st.t >= 73.7 && st.t <= 74.7, `length ${st.t.toFixed(2)} s`);
    assert.deepEqual(res.score, { goal: 3000, skill: 0, flourish: 0, total: 3000 });
    assert.equal(gradeOf(res.score.total, true), "Good");
    assert.ok(named(evs, "judge").every((e) => e.grade === "miss"));
    assert.equal(st.gaDay, 195, "the clock ends at week 27");
  }
});

await check("the bots: ref Great or better in every seed; 0.7 and 0.5 complete, mostly Great; more skill scores more", () => {
  const ref = [1, 2, 3, 4, 5, 6].map((s) => play(s, botInput(1, s), { views: false }).res);
  assert.ok(ref.every((r) => r.done && r.score.total >= 6500), `ref ${ref.map((r) => r.score.total)}`);
  for (const { res, st } of MID) {
    assert.equal(res.done, true); assert.equal(res.goalMet, true);
    assert.ok(st.t <= answer.meta.capS);
  }
  const mid = MID.map((r) => r.res.score.total);
  const half = [1, 2, 3, 4, 5, 6].map((s) => play(s, botInput(0.5, s), { views: false }).res);
  assert.ok(half.every((r) => r.done && r.goalMet), "skill 0.5 completes");
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(mean(mid) >= 6500, `skill 0.7 mean ${mean(mid)}`);
  assert.ok(mean(ref.map((r) => r.score.total)) > mean(mid) && mean(mid) > mean(half.map((r) => r.score.total)), "more skill scores more");
  // below skill 1 the bot sometimes stands in the wrong lane
  const wrong = MID.reduce((a, r) => a + named(r.evs, "judge").filter((e) => e.grade === "close").length, 0);
  assert.ok(wrong > 0);
});

await check("one-button mode through core/run.js: the run picks the lane, presses on the beats reach Great", () => {
  for (const seed of [1, 2, 3]) {
    const run = createRun({ seed, settings: { oneButton: true }, start: { practice: "answer" } });
    const pressed = new Set();
    const judged = [];
    for (let n = 0; run.screen !== "result" && n < 60 * 120; n++) {
      if (run.screen === "card") run.act("skip");
      let presses = [];
      if (run.screen === "stage" && run.state) {
        for (const x of run.mod.targets(run.state, 1)) {
          if (pressed.has(x.id) || x.t >= run.state.t + DT) continue;
          pressed.add(x.id);
          const t = run.stageStart + Math.max(x.t, run.state.t);
          presses.push({ t, raw: t });
        }
      }
      run.step(makeIntents({ presses, touching: presses.length > 0 }));
      for (const e of run.events.splice(0)) if (e.name === "judge" && e.grade !== "off") judged.push(e);
    }
    assert.equal(run.screen, "result", `seed ${seed}: the practice reaches its result`);
    const s = run.summary().stages[0];
    assert.ok(s.score.total >= 6500, `seed ${seed}: ${s.score.total}`);
    assert.ok(["Great", "Glowing"].includes(s.grade), `seed ${seed}: ${s.grade}`);
    assert.equal(judged.filter((e) => e.grade === "in").length, 39, `seed ${seed}: every press In time in the note's lane`);
  }
});

await check("one live gesture per moment (tap in the kick moments, with keys \"lanes\"); prompts name a string", () => {
  for (const run of [IDEAL, IDLE, MASH, ...MID.slice(0, 3)]) {
    assert.deepEqual(Object.keys(run.gestures), Object.keys(GESTURES));
    for (const [m, set] of Object.entries(run.gestures)) assert.deepEqual([...set], [GESTURES[m]], m);
    for (const [m, set] of Object.entries(run.keys)) assert.deepEqual([...set], [GESTURES[m] === "tap" ? "lanes" : "steer"], m);
    for (const e of named(run.evs, "prompt")) if (e.text) assert.notEqual(say(e.text), e.text, `${e.text} has a string`);
  }
  // one-button mode words: the run picks the lane, so the prompt asks only for presses
  const one = answer.create(1, DEFAULT_CARRY, { ...OPTS, oneButton: true });
  answer.jump(one, "phrases");
  assert.equal(answer.prompt(one).text, "answer.prompt.phrases.one");
  assert.ok(!/tap|lane|arrow/i.test(say(answer.prompt(one).text)), say(answer.prompt(one).text));
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

await check("the notes: P, her beats, spacing >= 0.5 s, patterns and lanes, the call answered 4 beats later", () => {
  for (const motherPhase of [0, 0.37]) {
    const st = answer.create(5, DEFAULT_CARRY, { ...OPTS, motherPhase });
    const all = ALL(st);
    assert.equal(all.length, 39);
    assert.deepEqual(checkTargets(all), []);
    all.forEach((x, i) => {
      assert.ok(Number.isFinite(x.P) && x.P >= 0.5, `${x.id} P ${x.P}`);
      near(x.P, Math.max(0.5, i ? x.t - all[i - 1].t : 2 * BEAT), 1e-9, `${x.id} P is its spacing (the first heartbeat kick: 2 beats)`);
      assert.equal(x.kind, "tap"); assert.equal(x.heart, "mother");
      near(st.beats.next("mother", x.t - 1e-6), x.t, 1e-9, `${x.id} on her beat`);
    });
    const beats = all.filter((x) => x.group === "beat"), notes = all.filter((x) => x.group === "answer"), song = all.filter((x) => x.group === "song");
    assert.equal(beats.length, 6); assert.equal(notes.length, 16); assert.equal(song.length, 17);
    for (let i = 1; i < 6; i++) near(beats[i].t - beats[i - 1].t, 2 * BEAT, 1e-9, "the heartbeat kicks every 2nd beat");
    assert.ok(beats.every((x) => x.lane === 1), "all in the middle lane");
    // the phrases: slot k of phrase p lies 4 + k beats after the phrase's start, phrases 9 beats apart
    const ph0 = notes[0].t - 4 * BEAT;
    near(ph0 - beats[5].t, BEAT, 1e-9, "the phrases start on the beat after the heartbeat's last kick (its 12th beat)");
    for (const x of notes) {
      const { phrase, slot } = parse(x.id);
      const c = TUNE.patterns[phrase][slot];
      assert.notEqual(c, ".");
      assert.equal(x.lane, { L: 0, M: 1, R: 2 }[c], `${x.id} lane`);
      near(x.t, ph0 + (9 * phrase + 4 + slot) * BEAT, 1e-6, x.id);
    }
    // the sing-along: the 16 call notes one a beat, in their lanes, then the jump note across all three
    near(song[0].t - (ph0 + 54 * BEAT), 0, 1e-6, "the song starts as the phrases end");
    song.slice(0, 16).forEach((x, k) => { assert.equal(x.lane, LANES[k], `${x.id} lane`); near(x.t, song[0].t + k * BEAT, 1e-6, x.id); });
    assert.equal(song[16].lane, -1, "the jump note is in every lane");
    near(song[16].t, song[0].t + 16 * BEAT, 1e-6, "the jump note");
  }
  // a hummed call note is the note you answer: it shows at the wall as it is hummed, 4 beats before its answer
  const hums = named(IDLE.evs, "sfx", "answer.hum").filter((e) => !e.sing);
  const ans = ALL(answer.create(1, DEFAULT_CARRY, OPTS)).filter((x) => x.group === "answer");
  hums.forEach((h, i) => { near(ans[i].t - h.at, 4 * BEAT, 1e-6, `call ${i}`); assert.equal(h.lane, ans[i].lane); });
});

await check("every note rides its lane in view, ringed, at least max(2 beats, 1.2 s) before its time (also muted)", () => {
  const seenRing = new Map(), seenNote = new Map();
  const st0 = answer.create(1, DEFAULT_CARRY, OPTS);
  const all = ALL(st0);
  play(1, scripted(), {
    views: false,
    each: (st) => {
      const d = answer.view(st);
      for (const g of d.rings) if (g.id.startsWith("t:") && !seenRing.has(g.id.slice(2))) seenRing.set(g.id.slice(2), st.t);
      const lanes = d.strips.find((s) => s.kind === "lanes");
      for (const x of answer.targets(st, 10)) if (!seenNote.has(x.id) && lanes.notes.length) seenNote.set(x.id, true);
    },
  });
  const pre = previewS(BEAT);
  for (const x of all) {
    assert.ok(seenRing.has(x.id), `${x.id} never had a ring`);
    assert.ok(x.t - seenRing.get(x.id) >= pre - DT - 1e-9, `${x.id}: ring ${(x.t - seenRing.get(x.id)).toFixed(3)} s ahead`);
    assert.ok(x.t - seenRing.get(x.id) >= answer.TRAVEL - DT - 1e-9, `${x.id}: shown at the wall 4 beats ahead`);
  }
});

await check("every view validates (ideal, idle, mash, bot), within LIMITS, with a camera, an anchor and a cue", () => {
  for (const run of [IDEAL, IDLE, MASH, MID[0], MID[1]]) assert.deepEqual(run.bad, []);
  const st = answer.create(2, { ...DEFAULT_CARRY, sparks: 5, nestleX: 0.8 }, OPTS);
  const input = scripted({ how: "tap" });
  let cues = 0, strips = 0, marks = 0, rings = 0, notes = 0, pops = 0;
  while (!answer.result(st).done) {
    const d = answer.view(st);
    assert.deepEqual(validate(d), []);
    assert.equal(d.camera.orient, "fit"); assert.equal(d.stage, "answer");
    assert.ok(d.splats.length <= 14);
    const lanes = d.strips.find((s) => s.kind === "lanes");
    assert.ok(lanes, "the lanes strip");
    near(d.anchor.x, answer.laneX(lanes.you, 1), 1e-9, "the anchor is your ring");
    if (d.cue) cues++;
    strips = Math.max(strips, d.strips.length); marks = Math.max(marks, d.marks.length); rings = Math.max(rings, d.rings.length);
    notes = Math.max(notes, lanes.notes.length); pops = Math.max(pops, d.action.pops.length);
    if (st.moment === "phrases" || st.moment === "beat" || st.moment === "song") assert.ok(d.cue, `a cue in ${st.moment}`);
    answer.step(st, input(st)); st.events.length = 0;
  }
  assert.ok(cues > 0 && strips === 4 && marks >= 8 && rings <= LIMITS.rings, `strips ${strips}, marks ${marks}, rings ${rings}`);
  assert.ok(notes >= 4 && notes <= 6, `at most ${notes} notes on the lanes at once`);
  assert.ok(pops >= 1);
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
    for (const j of named(run.evs, "judge")) if (!j.target.startsWith("beat.")) assert.ok(j.gaDay >= 133);
  }
});

await check("the voice never stops: 16 calls and 16 sing-along hums on her beats at the same times for every input", () => {
  const times = (run, notes = true) => named(run.evs, "sfx", "answer.hum").map((e) => e.at.toFixed(6) + (notes ? ":" + e.note : ""));
  const want = times(IDEAL);
  assert.equal(want.length, 32);
  for (const run of [IDLE, MID[0]]) assert.deepEqual(times(run), want, "seed 1: the same notes at the same times");
  assert.deepEqual(times(MASH, false), times(IDEAL, false), "another seed and a mash: the same times");
  const hums = named(IDLE.evs, "sfx", "answer.hum");
  for (const h of hums) {
    near(IDLE.st.beats.next("mother", h.at - 1e-6), h.at, 1e-9, "on her beat");
    assert.ok(h.pitch >= 160 && h.pitch <= 300, `pitch ${h.pitch}`);
    assert.ok(h.t <= h.at + DT + 1e-9 && h.at - h.t <= TUNE.humLeadS + DT, "sent by the step that holds its time, or just ahead");
  }
  const sung = hums.filter((h) => h.sing).map((h) => h.note), called = hums.filter((h) => !h.sing).map((h) => h.note);
  assert.deepEqual(sung, called, "the sing-along hums the call notes again, in order");
  assert.deepEqual(named(IDLE.evs, "caption").filter((e) => /^answer\.cap\.hum/.test(e.id)).map((e) => e.id),
    ["answer.cap.hum.M", "answer.cap.hum.LR", "answer.cap.hum.LMR", "answer.cap.hum.RLM", "answer.cap.hum.LMR", "answer.cap.hum.RMLM"]);
  assert.equal(named(IDLE.evs, "sfx", "answer.boom").length, 1, "the jump note's boom comes for every input");
});

// Step a stage to just before time t, then one step with these presses (and steer, touching); → the judge events.
function stepTo(s, t, intents = {}) {
  while (s.t + DT <= t) { answer.step(s, makeIntents()); s.events.length = 0; }
  answer.step(s, makeIntents(intents));
  const j = s.events.filter((e) => e.name === "judge");
  s.events.length = 0;
  return j;
}
const after = (s, n, intents = {}) => {
  const out = [];
  for (let i = 0; i < n; i++) { answer.step(s, makeIntents(intents)); out.push(...s.events.filter((e) => e.name === "judge")); s.events.length = 0; }
  return out;
};
const firstIn = (st, lane, group = "answer") => ALL(st).find((x) => x.group === group && x.lane === lane);

await check("lanes: a wrong-lane kick is Close at best; an arrow moves one lane and kicks there; up kicks in place", () => {
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  const r = firstIn(st, 2);
  assert.equal(st.lane, 1);
  // a press in the middle lane on time for a right-lane note: it waits 0.12 s for a flick, then is Close
  const j = [...stepTo(st, r.t, { presses: [{ t: r.t, raw: r.t }] }), ...after(st, 10)];
  assert.deepEqual(j.map((e) => [e.target, e.grade]), [[r.id, "close"]]);
  // an arrow: left moves one lane and kicks in the new lane
  const s2 = answer.create(1, DEFAULT_CARRY, OPTS);
  const l = firstIn(s2, 0);
  assert.deepEqual(stepTo(s2, l.t, { presses: [{ t: l.t, raw: l.t, dir: "left" }] }).map((e) => [e.target, e.grade]), [[l.id, "in"]]);
  assert.equal(s2.lane, 0);
  // two quick arrows across two lanes: the second puts you in the lane, with the better timing
  const r2 = ALL(s2).find((x) => x.group === "answer" && x.lane === 2 && x.t > l.t);
  const g2 = [...stepTo(s2, r2.t - 0.05, { presses: [{ t: r2.t - 0.05, raw: r2.t - 0.05, dir: "right" }] }),
    ...stepTo(s2, r2.t, { presses: [{ t: r2.t, raw: r2.t, dir: "right" }] }), ...after(s2, 10)];
  assert.deepEqual(g2.map((e) => [e.target, e.grade, Math.round(e.errMs)]), [[r2.id, "in", 0]]);
  assert.equal(s2.lane, 2);
  // up kicks where you are; a right arrow at the right wall stays right and kicks
  const r3 = ALL(s2).find((x) => x.group === "answer" && x.lane === 2 && x.t > r2.t);
  assert.deepEqual(stepTo(s2, r3.t, { presses: [{ t: r3.t, raw: r3.t, dir: "up" }] }).map((e) => e.grade), ["in"]);
  assert.equal(s2.lane, 2);
});

await check("lanes: a tap kicks in the lane tapped; a flick or drag into the lane within 0.12 s counts, later is Close", () => {
  const P = (x, t) => ({ t, raw: t, x, y: answer.laneY(1) });
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  const l = firstIn(st, 0);
  // tap the left lane, anywhere down its column (here far below your ring, where a thumb rests)
  assert.deepEqual(stepTo(st, l.t, { presses: [{ t: l.t, raw: l.t, x: -30, y: -60 }], touching: true }).map((e) => e.grade), ["in"]);
  assert.equal(st.lane, 0);
  assert.equal(answer.laneAt(-30, -60), 0); assert.equal(answer.laneAt(0, -60), 1); assert.equal(answer.laneAt(5, 30), 2, "the fan's lines above your ring");
  // a touch-down in the middle, then a flick right past 24 px within 0.12 s: it counts in the right lane, In time
  const s2 = answer.create(1, DEFAULT_CARRY, OPTS);
  const r = firstIn(s2, 2);
  const a = stepTo(s2, r.t, { presses: [P(0, r.t)], touching: true });
  assert.deepEqual(a, [], "it waits for the lane");
  const b = after(s2, 3, { touching: true, steer: { x: 0.45, y: 0 } });
  assert.deepEqual(b.map((e) => [e.target, e.grade]), [[r.id, "in"]]);
  assert.equal(s2.lane, 2, "the drag slid one lane");
  after(s2, 2, {});
  assert.equal(s2.lane, 2, "and you stay there after the lift");
  // too late: a flick after 0.12 s leaves it Close
  const s3 = answer.create(1, DEFAULT_CARRY, OPTS);
  const r3 = firstIn(s3, 2);
  stepTo(s3, r3.t, { presses: [P(0, r3.t)], touching: true });
  const c = [...after(s3, 9, { touching: true, steer: { x: 0, y: 0 } }), ...after(s3, 3, { touching: true, steer: { x: 0.45, y: 0 } })];
  assert.deepEqual(c.map((e) => e.grade), ["close"]);
  // a long drag slides two lanes; a second touch-down starts from its own lane
  const s4 = answer.create(1, DEFAULT_CARRY, OPTS);
  answer.jump(s4, "phrases"); s4.events.length = 0;
  answer.step(s4, makeIntents({ presses: [P(-20, s4.t)], touching: true }));
  assert.equal(s4.lane, 0);
  after(s4, 2, { touching: true, steer: { x: 0.9, y: 0 } });
  assert.equal(s4.lane, 2);
  after(s4, 2, { touching: true, steer: { x: 0.2, y: 0 } });
  assert.equal(s4.lane, 0, "back to where it touched down while still down");
});

await check("lanes do not matter in `beat`, for the jump note, or with Assist; they open in the phrases", () => {
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  const b = ALL(st)[0];
  assert.deepEqual(stepTo(st, b.t, { presses: [{ t: b.t, raw: b.t, dir: "left" }] }).map((e) => e.grade), ["in"]);
  assert.equal(st.lane, 1, "the heartbeat keeps you in the middle");
  for (const lane of [0, 1, 2]) {
    const s = answer.create(1, DEFAULT_CARRY, OPTS);
    answer.jump(s, "song"); s.events.length = 0;
    const jumpNote = ALL(s).find((x) => x.lane === -1);
    const ideal = scripted({ lane });
    while (s.t + DT <= jumpNote.t - 0.2) { answer.step(s, ideal(s)); s.events.length = 0; }
    assert.equal(s.lane, lane);
    assert.deepEqual(stepTo(s, jumpNote.t, { presses: [{ t: jumpNote.t, raw: jumpNote.t }] }).map((e) => e.grade), ["in"], `the jump note from lane ${lane}`);
  }
  const a = answer.create(1, DEFAULT_CARRY, { ...OPTS, assist: true });
  const r = firstIn(a, 2);
  assert.deepEqual(stepTo(a, r.t + 0.1, { presses: [{ t: r.t + 0.1, raw: r.t + 0.1 }] }).map((e) => e.grade), ["in"], "Assist: 100 ms late in the wrong lane is In time");
});

await check("the fever: 8 In time in a row light it, it multiplies only the song part, never past its max, and a miss ends it", () => {
  // perfect: lit from the sing-along's start (the streak runs on from the phrases), every song note with it
  const ideal = IDEAL.res;
  assert.equal(ideal.metrics.feverNotes, 17);
  assert.equal(ideal.parts.find((p) => p.id === "song").value, 2000, "capped at the part's max");
  assert.equal(named(IDEAL.evs, "caption", "answer.cap.fever").length, 1);
  // In time to song note 7, then Close: the fever stays lit (only a miss ends it) and lifts the song part to its max
  const late = play(1, scripted({ errMs: 0 }), { views: false });
  const closeAfter = play(1, (() => {
    const a = scripted(), b = scripted({ errMs: 120 });
    return (st) => (st.moment === "song" && ALL(st).filter((x) => x.group === "song").length < 9 ? b(st) : a(st));
  })(), { views: false });
  const m = closeAfter.res.metrics;
  assert.ok(m.feverNotes === 17, `fever notes ${m.feverNotes}`);
  assert.equal(closeAfter.res.parts.find((p) => p.id === "song").value, 2000);
  assert.equal(closeAfter.res.parts.find((p) => p.id === "answer").value, late.res.parts.find((p) => p.id === "answer").value, "the answers are not multiplied");
  // without the fever the same Close notes would score less
  near(m.songAccuracy, 1, 1e-9);
  // a missed song note puts it out: 3 notes with it, then 8 In time to light it again, then 5 more
  const miss = play(1, scripted({ skip: (x) => x.group === "song" && parse(x.id).k === 3 }), { views: false });
  assert.equal(miss.res.metrics.feverNotes, 3 + 5);
  assert.ok(miss.res.parts.find((p) => p.id === "song").value <= 2000);
  // no fever before the sing-along, however long the streak
  const noSong = play(1, scripted({ skip: (x) => x.group === "song" }), { views: false });
  assert.equal(noSong.res.metrics.feverNotes, 0);
  assert.equal(noSong.res.parts.find((p) => p.id === "song").value, 0);
});

await check("the match rule: >= 75% Close or better is a match; \"{Carer} feels you.\"; the hand glow from phrase 2", () => {
  const feels = (run) => named(run.evs, "caption", "answer.feels").length;
  const hands = (run) => named(run.evs, "sfx", "answer.hand").filter((e) => e.gain === 0.8).length;
  assert.equal(feels(IDEAL), 6); assert.equal(hands(IDEAL), 5, "no hand glow on phrase 1");
  assert.equal(feels(IDLE), 0); assert.equal(hands(IDLE), 0);
  const skip = (pred) => scripted({ skip: (x) => { const p = parse(x.id); return p.group === "answer" && pred(p); } });
  assert.equal(play(1, skip((p) => p.phrase === 5 && p.slot === 0), { views: false }).res.metrics.matches, 6, "3 of 4");
  assert.equal(play(1, skip((p) => p.phrase === 5 && p.slot < 2), { views: false }).res.metrics.matches, 5, "2 of 4");
  assert.equal(play(1, skip((p) => p.phrase === 4 && p.slot === 0), { views: false }).res.metrics.matches, 5, "2 of 3");
  let handSeen = 0;
  const two = play(1, skip((p) => p.phrase !== 1), { views: false, each: (st) => { if (answer.view(st).marks.some((m) => m.kind === "hand")) handSeen++; } });
  assert.equal(feels(two), 1); assert.equal(hands(two), 1);
  assert.ok(handSeen * DT >= 2 && handSeen * DT <= 3, `the hand glow shows ${(handSeen * DT).toFixed(2)} s`);
  const close = play(1, scripted({ errMs: 120 }), { views: false });
  assert.equal(close.res.metrics.matches, 6, "Close counts toward a match");
});

await check("the eyes open by themselves at week 26 and the vignette lifts over 2 s; hearing at the start", () => {
  const { evs } = IDLE;
  assert.equal(named(evs, "milestone", "hearing")[0].t, 0);
  assert.equal(named(evs, "milestone", "eyes").length, 1);
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
  assert.equal(named(evs, "fact", "answer.jump").length, 1);
});

await check("score parts: 1,000 beat + 3,000 answer + 2,000 song; Flourish by the best streak; points add up", () => {
  for (const run of [IDEAL, IDLE, MASH, ...MID]) {
    const { res, evs } = run;
    const m = res.metrics;
    assert.equal(res.score.skill, Math.round(1000 * m.beatAccuracy) + Math.round(3000 * m.answerAccuracy) + Math.round(2000 * m.songAccuracy));
    assert.equal(res.score.flourish, Math.round(1000 * Math.min(1, m.best / 24)));
    assert.equal(res.parts.reduce((a, p) => a + p.value, 0), res.score.total, "the parts add up to the total");
    for (const p of res.parts) assert.notEqual(say(p.label), p.label, `${p.label} has a string`);
    assert.equal(named(evs, "points").reduce((a, e) => a + e.add, 0), res.score.total, "the points events add up to the total");
  }
  const beatOnly = play(1, scripted({ skip: (x) => x.group !== "beat" }), { views: false });
  assert.deepEqual(beatOnly.res.score, { goal: 3000, skill: 1000, flourish: 250, total: 4250 });
});

await check("juice: your kick plays her note back, the streak meter fills to 8, the fever's word, the jump note's small shake", () => {
  // each answer and sing-along note kicked plays its own pitch back (32 notes; not the heartbeat, not the jump note)
  const echo = named(IDEAL.evs, "sfx", "answer.echo");
  assert.equal(echo.length, 32);
  assert.ok(echo.every((e) => Number.isFinite(e.pitch) && e.pitch > 200 && e.gain > 0), "a pitch an octave over her hum");
  assert.equal(named(IDLE.evs, "sfx", "answer.echo").length, 0, "no kick, no echo");
  // the meter, the fever's word and the shake, read off the views of a perfect play
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  const input = scripted();
  const meters = {}, words = new Set();
  let shakeBefore = 0, shakeAfter = 0, maxN = 0;
  while (!answer.result(st).done && st.t < 120) {
    const v = answer.view(st);
    const lanes = v.strips.find((s) => s.kind === "lanes");
    (meters[st.moment] = meters[st.moment] || new Set()).add(lanes && lanes.meter ? "on" : "off");
    if (lanes && lanes.meter) {
      assert.ok(lanes.meter.n >= 0 && lanes.meter.n <= lanes.meter.of && lanes.meter.of === 8, JSON.stringify(lanes.meter));
      maxN = Math.max(maxN, lanes.meter.n);
    }
    for (const p of v.action.pops) words.add(p.word);
    const sh = v.action.shake || 0;
    assert.ok(sh >= 0 && sh <= 1);
    if (st.jumpT !== null && st.t >= st.jumpT) shakeAfter = Math.max(shakeAfter, sh); else shakeBefore = Math.max(shakeBefore, sh);
    answer.step(st, input(st));
    st.events.length = 0;
  }
  assert.deepEqual([...meters.beat], ["off"]); assert.deepEqual([...meters.phrases], ["on"]); assert.deepEqual([...meters.song], ["on"]);
  assert.equal(maxN, 8);
  assert.ok(words.has("answer.pop.fever") && words.has("answer.pop.in"), [...words].join(" "));
  assert.equal(shakeBefore, 0, "no shake before the jump note");
  assert.ok(shakeAfter > 0.3 && shakeAfter <= TUNE.view.shake, `the jump note's shake ${shakeAfter}`);
});

await check("carry out: song = the 16 call notes and a mask of the notes kicked Close or better, phrases or song", () => {
  const notes = IDEAL.res.carryOut.song.notes;
  assert.equal(notes.length, 16);
  assert.deepEqual(notes, named(IDEAL.evs, "sfx", "answer.hum").filter((e) => !e.sing).map((e) => e.note));
  for (const n of notes) assert.ok(TUNE.song.set.includes(n));
  assert.equal(IDLE.res.carryOut.song.lit, 0);
  // answer only phrases 1 and 6, and no sing-along: note 0 and notes 12 to 15
  const sel = play(1, scripted({ skip: (x) => { const p = parse(x.id); return p.group === "song" || (p.group === "answer" && p.phrase !== 0 && p.phrase !== 5); } }), { views: false });
  assert.equal(sel.res.carryOut.song.lit, 0b1111000000000001);
  // the sing-along alone lights the notes too
  const sing = play(1, scripted({ skip: (x) => x.group === "answer" || (x.group === "song" && parse(x.id).k >= 8) }), { views: false });
  assert.equal(sing.res.carryOut.song.lit, 0b0000000011111111);
  const merged = mergeCarry(DEFAULT_CARRY, sel.res.carryOut);
  assert.deepEqual(merged.song, { notes: sel.res.carryOut.song.notes, lit: 0b1111000000000001 }, "mergeCarry keeps it");
  for (const run of MID) assert.deepEqual(Object.keys(run.res.carryOut), ["song"]);
});

await check("judging: Off and free presses change nothing, only tap moments read presses, Assist widens the windows", () => {
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  const first = ALL(st)[0];
  assert.deepEqual(stepTo(st, 1.0, { presses: [{ t: 1.0, raw: 1.0 }] }), [], "presses during `hear` are ignored");
  const off = stepTo(st, first.t - 0.4, { presses: [{ t: first.t - 0.4, raw: first.t - 0.4 }] });
  assert.deepEqual(off.map((e) => e.grade), ["off"]);
  assert.ok(answer.targets(st, 1).some((x) => x.id === first.id), "Off leaves the note open");
  assert.equal(answer.result(st).score.skill, 0);
  assert.deepEqual(stepTo(st, first.t, { presses: [{ t: first.t, raw: first.t }] }).map((e) => e.grade), ["in"]);
  // a free press half way between two heartbeat kicks does nothing
  const second = ALL(st)[0];
  assert.deepEqual(stepTo(st, second.t - BEAT, { presses: [{ t: second.t - BEAT, raw: second.t - BEAT }] }), []);
  const late = (assist) => { const s = answer.create(1, DEFAULT_CARRY, { ...OPTS, assist }); const x = ALL(s)[0]; return stepTo(s, x.t + 0.1, { presses: [{ t: x.t + 0.1, raw: x.t + 0.1 }] })[0].grade; };
  assert.equal(late(false), "close"); assert.equal(late(true), "in");
  const e = answer.create(1, DEFAULT_CARRY, OPTS);
  answer.jump(e, "eyes"); e.events.length = 0;
  for (let i = 0; i < 8 / DT && !answer.result(e).done; i++) {
    answer.step(e, makeIntents({ presses: [{ t: e.t, raw: e.t, dir: "left" }] }));
    assert.equal(e.events.filter((x) => x.name === "judge").length, 0);
    assert.equal(e.lane, 1);
    e.events.length = 0;
  }
});

await check("jump: every moment starts now and the stage still ends with its goal met; unknown ids are refused", () => {
  for (const id of ["hear", "beat", "phrases", "song", "eyes", "outro"]) {
    const st = answer.create(4, DEFAULT_CARRY, OPTS);
    for (let i = 0; i < 30; i++) { answer.step(st, makeIntents()); st.events.length = 0; }
    assert.equal(answer.jump(st, id), true);
    assert.equal(st.moment, id);
    assert.equal(answer.prompt(st).gesture, GESTURES[id]);
    let steps = 0;
    while (!answer.result(st).done && steps++ < 90 / DT) { answer.step(st, makeIntents()); st.events.length = 0; }
    const res = answer.result(st);
    assert.equal(res.done, true, id); assert.equal(res.goalMet, true);
    for (const s of Object.values(st.subgoals)) assert.ok(s === "done" || s === "auto", `${id}: ${s}`);
    assert.equal(res.metrics.eyesOpen, true);
  }
  const st = answer.create(4, DEFAULT_CARRY, OPTS);
  assert.equal(answer.jump(st, "carried"), false);
  answer.jump(st, "phrases");
  assert.equal(st.gaDay, 133);
  const x = ALL(st);
  assert.equal(x.length, 33, "a phrases jump lays the 16 answers and the 17 song notes");
  near(x[0].t - 4 * BEAT, st.beats.next("mother", 0), 1e-9, "from her next beat");
});

await check("junk input never throws; botSteer gives the next note's lane, idle outside the lanes, late below skill 1", () => {
  const junk = [null, undefined, 5, {}, { presses: 5 }, { presses: [null, { t: NaN }, { t: "x" }, { t: Infinity }] },
    { presses: [{ t: -1e9 }, { t: 1e9, x: NaN, dir: 7 }] }, { dir: "sideways", steer: { x: NaN } },
    makeIntents({ presses: Array.from({ length: 50 }, (_, i) => ({ t: i * 0.01, x: i - 25, y: 0 })), touching: true, steer: { x: 1, y: 0 } })];
  const st = answer.create(9, null, null);
  let i = 0;
  assert.doesNotThrow(() => { while (!answer.result(st).done && i < 100 / DT) { answer.step(st, junk[i++ % junk.length]); st.events.length = 0; } });
  assert.equal(answer.result(st).done, true);
  assert.deepEqual(validate(answer.view(st)), []);
  assert.doesNotThrow(() => answer.step(st, null));
  const r = Object.assign(stream(1, "x"), { mem: {} });
  assert.deepEqual(answer.botSteer(st, 1, r), { steer: { x: 0, y: 0 }, dir: null, hold: false });
  assert.equal(answer.probe(st), null);
  assert.deepEqual(answer.targets(st, 5), []);
  const s2 = answer.create(1, DEFAULT_CARRY, OPTS);
  assert.equal(answer.botSteer(s2, 1, r).dir, null, "no lanes in `hear`");
  answer.jump(s2, "phrases");
  const next = answer.targets(s2, answer.TRAVEL)[0];
  assert.equal(answer.botSteer(s2, 1, r).dir, LANE_DIR[next.lane]);
  const r2 = Object.assign(stream(2, "y"), { mem: {} });
  assert.equal(answer.botSteer(s2, 0.5, r2).dir, null, "skill 0.5 turns 0.3 s late");
  assert.ok(r2.mem.id === next.id);
});

// The tone rules, for every string the stage shows (its TEXT and its facts) with every carer word.
const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|nicu|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const words = (s) => s.replace(/[♪♥~·]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

await check("facts: the 5.6 ids with sources from the allow-list, R or A, checked, short, labels that match the clock", () => {
  assert.deepEqual(FACTS.map((f) => f.id), ["answer.card", "answer.tri", "answer.hear", "answer.respond", "answer.w20",
    "answer.feel", "answer.outside", "answer.low", "answer.hic", "answer.jump", "answer.eyes"]);
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
  for (const run of [IDLE, IDEAL]) {
    const sent = named(run.evs, "fact");
    assert.deepEqual(sent.map((e) => e.id).sort(), FACTS.filter((f) => f.where === "caption").map((f) => f.id).sort());
    for (const e of sent) {
      const f = FACTS.find((x) => x.id === e.id);
      assert.equal(week(e.gaDay), week(f.gaDay), `${e.id} at gaDay ${e.gaDay}`);
      assert.equal(e.where, "caption");
    }
  }
  // the jump fact follows the jump note
  const jumpNote = named(IDEAL.evs, "judge").find((e) => e.lane === -1);
  const fact = named(IDEAL.evs, "fact", "answer.jump")[0];
  assert.ok(fact.t >= jumpNote.t && fact.t - jumpNote.t <= 1.0, "answer.jump comes right after the jump note");
});

await check("strings: every id the stage sends has text; no banned words, no pronouns, no em dash, sentences <= 16 words", () => {
  for (const [id, text] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("answer."), id);
    assert.ok(!/—/.test(text), `${id}: an em dash`);
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
  const st = answer.create(1, DEFAULT_CARRY, OPTS);
  const input = scripted({ skip: (x) => x.group === "song" && parse(x.id).k === 2, errMs: 0 });
  while (!answer.result(st).done) {
    for (const q of answer.view(st).action.pops) ids.add(q.word);
    answer.step(st, input(st)); st.events.length = 0;
  }
  for (const id of ids) assert.ok(TEXT[id], `${id} is not in answer.text.js`);
  for (const w of ["answer.pop.in", "answer.pop.miss"]) assert.ok(ids.has(w), `the ${w} pop shows`);
  assert.equal(say("answer.feels", {}, { carer: "mum" }), "Your mum feels you.");
  assert.equal(say("answer.pop.in"), "Perfect"); assert.equal(say("answer.pop.close"), "Good"); assert.equal(say("answer.pop.miss"), "Miss");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const mean = Math.round(MID.reduce((a, r) => a + r.res.score.total, 0) / MID.length);
  console.log(`PASS ${FILE}: ${passed} checks (ideal ${IDEAL.res.score.total}, idle ${IDLE.res.score.total} in ${IDLE.st.t.toFixed(1)} s, skill 0.7 mean ${mean} over ${MID.length} seeds)`);
}
