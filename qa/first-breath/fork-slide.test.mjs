// First Breath: stage 1 fork, LIVE-FB-1. Walls slide. A push into the mouth where the warm lane opens keeps the
// part along the wall, including the corner, so holding toward the warm lane reaches the orange lane within 5 s,
// and holding toward the goal clears the race within 60 s on 10 of 10 seeds.
// node qa/first-breath/fork-slide.test.mjs
import assert from "node:assert/strict";
import * as swim from "../../public/first-breath/core/stages/swim.js";
import { TUNE as T } from "../../public/first-breath/core/stages/swim.tune.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { worldOf, insideAt } from "../../public/first-breath/core/stages/swim.track.js";
import { DT } from "../../public/first-breath/core/clock.js";

const FILE = "qa/first-breath/fork-slide.test.mjs";
const OPTS = { assist: false, oneButton: false, motherPhase: 0 };
let passed = 0;
const failed = [];
function check(name, fn) {
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); console.log(`FAIL ${name}`); }
}
const dir = (x, y) => { const h = Math.hypot(x, y) || 1; return { x: x / h, y: y / h }; };

function halfAt(p) {
  if (p < T.WOMB_END) return T.WOMB_HALF;
  if (p < T.GATE_END) return T.WOMB_HALF + (T.GATE_HALF - T.WOMB_HALF) * ((p - T.WOMB_END) / (T.GATE_END - T.WOMB_END));
  if (p < T.FORK) return T.GATE_HALF;
  return T.GATE_HALF + (T.MOUTH - T.GATE_HALF) * Math.max(0, Math.min(1, (p - T.FORK) / (T.SPLIT - T.FORK)));
}
function quiet(seed) {
  const st = swim.create(seed, DEFAULT_CARRY, OPTS);
  for (const r of st.rivals) { r.out = true; r.outT = -1; r.rest = -10; r.attached = "rest"; r.p = 0; r.zone = "path"; }
  st.t = 5;
  return st;
}
function inLane(st) {
  const y = st.you;
  return y.zone === "tube" && y.p >= T.TUBE_START && Math.abs(y.x - st.xc) < T.TUBE_HALF;
}
// World stick toward the orange lane (the warm tube at its start). Before the first bend, world is track.
function towardLane(st) {
  const y = st.you;
  const pos = swim.probe(st).you;
  return dir(st.xc - pos.x, T.TUBE_START - (y.zone === "loop" ? T.FORK : pos.y));
}

check("the opening corner slides: a push into the warm wall at the fork moves along it", () => {
  for (const seed of [1, 2]) {
    const st = quiet(seed);
    const you = st.you;
    const x = st.warm * (T.GATE_HALF - T.HEAD_R);
    you.zone = "path"; you.p = T.FORK; you.x = x; you.speed = T.SWIM; you.touch = true;
    you.ang = you.vang = st.warm > 0 ? 0 : Math.PI;
    const p0 = you.p;
    const steer = { x: st.warm, y: 0 };
    for (let i = 0; i < 0.5 / DT; i++) swim.step(st, makeIntents({ steer, touching: true }));
    assert.ok(you.p - p0 > 8, `seed ${seed} slid ${(you.p - p0).toFixed(1)} u along the opening (warm ${st.warm})`);
    assert.equal(you.zone === "loop", false, `seed ${seed} stayed out of the cool loop`);
  }
});

check("holding toward the warm lane from the fork reaches the orange lane within 5 s", () => {
  const ps = [T.FORK - 12, T.FORK, T.FORK + 8, T.FORK + 18, T.SPLIT - 1];
  let worst = 0, worstAt = "";
  for (const seed of [1, 2]) for (const p of ps) {
    const h = halfAt(p) - T.HEAD_R;
    for (const x of [-h, -h * 0.5, 0, h * 0.5, h]) for (const ang of [Math.PI / 2, 0, Math.PI]) {
      const st = quiet(seed);
      const you = st.you;
      you.zone = "path"; you.p = p; you.x = x; you.speed = T.SWIM; you.ang = you.vang = ang;
      let lane = null;
      for (let i = 0; i < 5 / DT; i++) {
        swim.step(st, makeIntents({ steer: towardLane(st), touching: true }));
        if (inLane(st)) { lane = st.t - 5; break; }
      }
      const tag = `seed ${seed} p ${p.toFixed(0)} x ${x.toFixed(1)} ang ${(ang * 180 / Math.PI).toFixed(0)}`;
      assert.ok(lane !== null && lane <= 5, `${tag} ${lane === null ? "missed the lane" : lane.toFixed(2) + " s"}`);
      if (lane > worst) { worst = lane; worstAt = tag; }
    }
  }
  console.log(`     worst lane ${worst.toFixed(2)} s at ${worstAt}`);
});

// The goal is the marker while it still leads (a wave, then the warm mouth). Once you are level with it, hold
// on up the warm lane, on the racing line through the bends.
function laneX(st, p) {
  const w = insideAt(st.trk, p, T.LANE_RAMP);
  return st.xc + T.LANE_DRIFT * Math.sin(2 * Math.PI * T.LANE_HZ * st.t) * (1 - Math.abs(w)) + w * T.LANE_IN;
}
function holdGoal(st) {
  const you = st.you;
  const pos = swim.probe(st).you;
  if (you.zone === "loop") return dir(-pos.x, T.FORK - pos.y);
  if (you.out || you.arrived) return dir(0, 1);
  if (you.p < T.WOMB_END) {
    const cue = swim.view(st).cue;
    return dir(cue.x - pos.x, Math.max(cue.y, pos.y + 28) - pos.y);
  }
  if (you.p < T.TUBE_START) return dir(st.xc - pos.x, T.TUBE_START - pos.y);
  const p = Math.min(T.TUBE_END, you.p + 60);
  const x = laneX(st, p);
  const g = p < st.bend0 ? { x, y: p } : worldOf(st.trk, st.xc, x, p);
  return dir(g.x - pos.x, g.y - pos.y);
}

check("holding toward the goal clears stage 1 in under 60 s on 10 of 10 runs", () => {
  const times = [];
  for (let seed = 1; seed <= 10; seed++) {
    const st = swim.create(seed, DEFAULT_CARRY, OPTS);
    for (let i = 0; i < 75 / DT && !swim.result(st).done; i++) {
      swim.step(st, makeIntents({ steer: holdGoal(st), touching: true }));
    }
    const res = swim.result(st);
    const arrive = st.you.arriveT;
    times.push(arrive);
    assert.equal(st.you.out, false, `seed ${seed} went out by ${st.you.outBy}`);
    assert.ok(Number.isFinite(arrive) && arrive < 60, `seed ${seed} arrived at ${arrive} (stage ${res.how} at ${st.t.toFixed(2)} s)`);
  }
  console.log("     arrival s: " + times.map((t) => t.toFixed(2)).join(" "));
});

if (failed.length) {
  console.log(`\nFAIL ${FILE}: ${passed} passed, ${failed.length} failed`);
  for (const f of failed) console.log("  " + f);
  process.exit(1);
}
console.log(`\npass ${FILE}: ${passed} checks`);
