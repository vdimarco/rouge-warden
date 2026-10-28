// First Breath: stage 5, First Trimester (`grow`): "Grow." A twin-stick-style shooter on the shared action layer
// (core/lib/action.js; openspec/changes/first-breath-action-genres/contract.md is the worked example). You are the
// embryo in the round sac, tied to the placenta on its wall by the cord. Weeks 7 to 12 (gaDay 49 to 91) bring one
// wave of germs and toxin blobs each, through the sac's wall: chasers, wandering spores, blobs that aim a shot or a
// fan, rings that circle you and send out a ring. You drag anywhere (or WASD / the arrows) to move, your sparks fly
// by themselves at the nearest germ, and a second finger (or Space) dashes, with a moment of i-frames. Every pattern
// is telegraphed first. Cleared germs drop food; food grows your sparks (rate, spread, pierce, strength). Each wave
// ends with a rest: the food is drawn in and the cord brings a heal. Week 13 is the big germ, in three phases (a
// spiral with buds, aimed fans and rings, a rush with a ring as it stops). At 0 hp you are knocked out: never a game
// over; the stage ends with its goal unmet and the run's Almost card offers Try again or Go on. The week clock and
// the growth milestones stay (week 10 brings the word fetus), and so do the facts. Pure: every draw is seeded.
//
// Contract choices:
// - Moments: wave7 to wave12 (gaDay 7N to 7N + 7: 7N + 6 over the wave's nominal 7.5 s, the last day over its
//   rest), then boss (gaDay 91 to 97). A wave ends when its rows have all spawned and no germ is left, or at 11 s;
//   germs left then drift away (no score). Clearing the boss plays a 1.4 s victory beat (outroS: the shots turn to
//   sparkles, act.win, the thumb; you can still move), then the stage ends; at the 120 s cap the stage
//   ends with the goal met (you lasted); a knock-out ends it with the goal unmet (canFail), after a short rest
//   (at least koS, and until the captions already sent are read).
// - Wave times run on the world clock (A.t), which holds still under a hit-stop; the cap on the stage clock.
// - The score (7): Goal 3,000; Skill: 1,200 × min(1, your combo score / (the whole value × 1.6)) for germs cleared,
//   ticked to the HUD at each clear (each clear's pop shows those points), and 4,800 less 1,600 a hit for shots
//   dodged (none from 3 hits), at the end; Flourish 1,000 × min(1, best combo / 25), at the end. So a stage with no
//   hit is Glowing, 1 or 2 hits Great, 3 or more Good (design.md 4.5: the peak of the run).
// - The camera holds the sac still (fit, span 112). The sac is to scale (meta.mm 30 to 150 mm across the short axis:
//   about 25 mm across at week 7, 12 cm by week 13), and so is the scale bar; you are drawn smaller than your true
//   length (9.5 to 15 u, growing with the NHS lengths), so there is room to play.
// - The HUD's boss bar follows the big germ (core/lib/action.js actionView); its phase colours its core and the bar.
// - meta.action marks a stage built on the action layer: no timed targets; a press is a dash.
import { DT, mmPerShortAxis, bpmYou } from "../clock.js";
import { makeBeats } from "../beat.js";
import { stream } from "../rng.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { figure } from "../lib/figure.js";
import { rimSparks } from "../lib/sparks.js";
import { createTree, growTree } from "../lib/colonize.js";
import * as X from "../lib/action.js";
import { noteCaptions as note, readBy } from "../lib/rest.js";
import { actionSteer } from "../lib/actionbot.js";
import { TUNE } from "./grow.tune.js";
import { FACTS } from "./grow.facts.js";
import { TEXT } from "./grow.text.js";

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const smooth = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// ---- the moments
const mo = (id, from, to, lenS) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });
const MOMENTS = [];
for (let n = 7; n <= 12; n++) MOMENTS.push(mo(`wave${n}`, 7 * n, 7 * n + 7, TUNE.waveS + TUNE.restS));
MOMENTS.push(mo("boss", 91, 97, TUNE.bossInS + TUNE.bossS));
const IDS = MOMENTS.map((m) => m.id);
const BOSS = IDS.length - 1;
const NOMINAL_S = MOMENTS.reduce((a, m) => a + m.lenS, 0);

// The whole value on the schedule (the boss's buds are worth nothing): the clear part's yardstick.
const TOTAL_VALUE = TUNE.waves.reduce((a, rows) => a + rows.reduce((b, r) => b + TUNE.foes[r[1]].value * r[2], 0), 0) + TUNE.boss.spec.value;
const REF_SCORE = TOTAL_VALUE * TUNE.score.refMult;

export const meta = Object.freeze({
  id: "grow", index: 4, name: "First Trimester", verb: "Grow",
  orient: "fit",
  families: Object.freeze(["steer", "tap"]),
  ga: Object.freeze({ start: 49, end: 97 }), fertilized: true,
  mm: Object.freeze({ start: 30, end: 150 }),
  action: true,
  motherBpm: TUNE.motherBpm,
  parS: Math.round(NOMINAL_S), capS: TUNE.capS, canFail: true, scored: true,
  moments: Object.freeze(MOMENTS),
});

const END_S = meta.capS + 30;
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const P_MOVE = Object.freeze({ gesture: "move", text: "grow.prompt.move", keys: "steer" });
const P_DASH = Object.freeze({ gesture: "move", text: "grow.prompt.dash", keys: "steer" });
const P_REST = Object.freeze({ gesture: "move", text: "grow.prompt.rest", keys: "steer" });
const P_BOSS = Object.freeze({ gesture: "move", text: "grow.prompt.boss", keys: "steer" });
const P_FREE = Object.freeze({ gesture: "move", text: null, keys: "steer" });         // the victory beat: no words

// Captions on the clock: [seconds into the wave, fact id] (each fact shows at the gaDay its label names).
const CAPTIONS = Object.freeze({
  wave8: [[0, "grow.w8"], [3.5, "grow.arms"]],
  wave9: [[0, "grow.peak"]],
  wave10: [[0, "grow.fetus"]],
  wave11: [[0, "grow.w11"]],
  wave12: [[0, "grow.w12"]],
  // grow.w11kick, grow.flow and grow.never: "What was real" facts on the result (design.md 6.5, 12)
});
const MILESTONES = Object.freeze({ wave10: "fetus" });

// ---- the score

function clearPart(st) { return Math.round(TUNE.score.clear * Math.min(1, st.A.score / REF_SCORE)); }
function dodgePart(st) { return Math.max(0, TUNE.score.dodge - TUNE.score.perHit * st.A.hits); }
function flourishPart(st) { return Math.round(TUNE.score.flourish * Math.min(1, st.A.bestCombo / TUNE.score.comboFull)); }

// ---- small helpers

function caption(st, id) {
  emit(st, "fact", { id, where: "caption" });
  emit(st, "caption", { id, dir: null });
}

function setPrompt(st, p) {
  if (st.prompt === p) return;
  st.prompt = p;
  emit(st, "prompt", { ...p });
}

// The angle (turns) of the placenta on the wall, and a spawn angle kept clear of it.
function awayFromPlacenta(st, a) {
  const k = TUNE.keepOut * TAU;
  let d = Math.atan2(Math.sin(a - st.pcAng), Math.cos(a - st.pcAng));
  if (Math.abs(d) < k) d = d < 0 ? -k : k;
  return st.pcAng + d;
}

// ---- waves and rests

function enterMoment(st, i) {
  st.mi = i;
  st.moment = IDS[i];
  st.gaDay = Math.max(st.gaDay, MOMENTS[i].ga[0]);
  emit(st, "moment", { id: st.moment });
  if (MILESTONES[st.moment] && !st.fired[MILESTONES[st.moment]]) { st.fired[MILESTONES[st.moment]] = true; emit(st, "milestone", { id: MILESTONES[st.moment] }); }
  for (const [after, id] of CAPTIONS[st.moment] || []) {
    if (after <= 0) caption(st, id);
    else st.capQ.push({ at: st.A.t + after, id });
  }
}

function startWave(st, i) {
  const A = st.A;
  enterMoment(st, i);
  st.phase = "wave";
  st.w0 = A.t;
  const base = st.rWave() * TAU;
  const rows = [];
  for (const [at, foe, n0, turns, spread] of TUNE.waves[i]) {
    // each member of a group on its own angle along the wall, every one kept clear of the placenta (Assist: fewer)
    const n = Math.ceil(n0 * st.assistK);
    for (let k = 0; k < n; k++) rows.push({ ...TUNE.foes[foe], at: A.t + at, n: 1, ang: awayFromPlacenta(st, base + turns * TAU + (k - (n - 1) / 2) * spread), inset: 4 });
  }
  st.W = X.makeWaves(rows);
  setPrompt(st, i === 0 ? P_MOVE : P_DASH);
  if (i === 0) { subgoal(st, "clear", "grow.sub.clear"); st.capQ.push({ at: A.t + 3, sub: "food" }); }
  if (i === 1) subgoal(st, "dash", "grow.sub.dash");
}

function startRest(st) {
  const A = st.A;
  st.phase = "rest";
  st.r0 = A.t;
  for (const f of A.foes.slice()) X.removeFoe(A, f.id);    // what is left drifts away (no score)
  X.clearBullets(A, 2);
  A.tells.length = 0;
  X.vacuum(A, TUNE.restS);
  st.cordLights.push(A.t);                                 // a heal rides the cord to you
  setPrompt(st, P_REST);
}

function startBoss(st) {
  const A = st.A, B = TUNE.boss;
  enterMoment(st, BOSS);
  st.phase = "boss";
  st.b0 = A.t;
  for (const f of A.foes.slice()) X.removeFoe(A, f.id);
  X.clearBullets(A, 2);
  A.tells.length = 0;
  const share = A.value > 0 ? A.cleared / A.value : 0;
  doneBy(st, "clear", share >= 0.6 ? "you" : "auto", share >= 0.6 ? "grow.sub.clearDone" : "grow.sub.clearAuto");
  subgoal(st, "boss", "grow.sub.boss");
  // the big germ comes in across the sac from you
  const p = A.p, d = Math.hypot(p.x, p.y);
  const bx = d > 6 ? (-p.x / d) * 16 : 0, by = d > 6 ? (-p.y / d) * 16 : 14;
  const f = X.spawnFoe(A, { ...B.spec, x: bx, y: by, spawnS: TUNE.bossInS });
  st.boss = { id: f ? f.id : 0, phase: 0, mode: "tell", t: 0, spin: 0, n: 0, addT: B.p1.addEvery, hop: { x: bx, y: by }, hopT: 0,
    aim: 0, rush: null };
  setPrompt(st, P_BOSS);
}

// The big germ's phases, on the layer's primitives (its foe has ai "still": its velocity is set here).
function bossStep(st) {
  const A = st.A, b = st.boss, B = TUNE.boss;
  const f = A.foes.find((g) => g.id === b.id);
  if (!f || f.in > 0) return;
  const share = f.hp / f.hpMax;
  const phase = share > B.phaseAt[0] ? 0 : share > B.phaseAt[1] ? 1 : 2;
  if (phase !== b.phase) {
    b.phase = phase; b.mode = "tell"; b.t = 0; b.n = 0; b.rush = null;
    f.phase = phase;
    X.clearBullets(A, 2);
    A.tells.length = 0;
    X.hitStop(A, A.juiceK.stopPhase);
    A.juice.shake = Math.min(1, A.juice.shake + 0.8);
    emit(st, "sfx", { id: "act.phase", x: f.x, y: f.y, pitch: phase });
  }
  b.t += DT;
  const p = A.p;
  const toward = (x, y, k) => { f.vx += ((x - f.x) * k - f.vx) * Math.min(1, 4 * DT); f.vy += ((y - f.y) * k - f.vy) * Math.min(1, 4 * DT); };
  const aimP = () => Math.atan2(p.y - f.y, p.x - f.x);
  if (phase === 0) {
    const P1 = B.p1, w = A.t * P1.orbitW;
    toward(Math.cos(w) * P1.orbitR, Math.sin(w) * P1.orbitR + 4, P1.glide);
    b.addT -= DT;
    if (b.addT <= 0) {
      b.addT += P1.addEvery;
      for (let k = 0; k < P1.adds; k++) {
        const a = A.rnd() * TAU;
        X.spawnFoe(A, { ...TUNE.foes.add, x: f.x + Math.cos(a) * (f.r + 3), y: f.y + Math.sin(a) * (f.r + 3) });
      }
    }
    if (b.mode === "tell" && b.t === DT) X.addTell(A, { kind: "ring", x: f.x, y: f.y, r: f.r + 6, dur: P1.tellS, foe: f.id });
    if (b.mode === "tell" && b.t >= P1.tellS) { b.mode = "spin"; b.t = 0; b.n = 0; b.spin = A.rnd() * TAU; }
    if (b.mode === "spin") {
      while (b.n < P1.burst && b.t >= b.n * P1.gap) { X.shoot(A, f.x, f.y, P1.spiral, b.spin); b.spin += P1.spin; b.n++; }
      if (b.n >= P1.burst) { b.mode = "rest"; b.t = 0; }
    }
    if (b.mode === "rest" && b.t >= P1.restS) { b.mode = "tell"; b.t = 0; }
  } else if (phase === 1) {
    const P2 = B.p2;
    b.hopT -= DT;
    if (b.hopT <= 0) {
      b.hopT = P2.hopS;
      const a = A.rnd() * TAU, r = P2.hopR * Math.sqrt(A.rnd());
      b.hop = { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
    toward(b.hop.x, b.hop.y, P2.glide);
    // fan (aimed, telegraphed), then a ring, each after its tell
    if (b.mode === "tell" && b.t === DT) { b.aim = aimP(); X.addTell(A, { kind: "fan", x: f.x, y: f.y, ang: b.aim, r: 30, w: 3 * P2.fan.arc + 0.08, dur: P2.tellS, foe: f.id }); }
    if (b.mode === "tell" && b.t >= P2.tellS) { X.shoot(A, f.x, f.y, P2.fan, b.aim); b.mode = "gap1"; b.t = 0; }
    if (b.mode === "gap1" && b.t >= P2.gapS - P2.tellS) { b.mode = "tell2"; b.t = 0; X.addTell(A, { kind: "ring", x: f.x, y: f.y, r: f.r + 6, dur: P2.tellS, foe: f.id }); }
    if (b.mode === "tell2" && b.t >= P2.tellS) { X.shoot(A, f.x, f.y, P2.ring, A.rnd() * TAU); b.mode = "gap2"; b.t = 0; }
    if (b.mode === "gap2" && b.t >= P2.gapS) { b.mode = "tell"; b.t = 0; }
  } else {
    const P3 = B.p3;
    if (b.mode === "tell") {
      if (b.t === DT) {
        b.aim = aimP();
        X.addTell(A, { kind: "charge", x: f.x, y: f.y, ang: b.aim, len: P3.rushSpeed * P3.rushS + f.r, w: f.r, dur: P3.tellS, foe: f.id });
      }
      f.vx *= 0.9; f.vy *= 0.9;
      if (b.t >= P3.tellS) { b.mode = "rush"; b.t = 0; }
    } else if (b.mode === "rush") {
      if (b.t === DT) X.addTell(A, { kind: "ring", x: f.x, y: f.y, r: f.r + 6, dur: P3.rushS, foe: f.id });   // its ring as it stops
      f.vx = Math.cos(b.aim) * P3.rushSpeed; f.vy = Math.sin(b.aim) * P3.rushSpeed;
      const ar = A.arena, ex = f.x - ar.x, ey = f.y - ar.y, e = Math.hypot(ex, ey);
      const out = ex * f.vx + ey * f.vy > 0;                 // a rush stops at the wall, never on its way in
      if (b.t >= P3.rushS || (out && e > ar.r - f.r - 2)) {
        f.vx = 0; f.vy = 0;
        X.shoot(A, f.x, f.y, P3.ring, A.rnd() * TAU);
        A.juice.shake = Math.min(1, A.juice.shake + 0.35);
        b.mode = "after"; b.t = 0;
      }
    } else if (b.mode === "after") {
      toward(0, 0, 0.6);                                      // it drifts back toward the middle
      f.vx *= 0.96; f.vy *= 0.96;
      if (b.t === DT) { b.aim = aimP(); X.addTell(A, { kind: "line", x: f.x, y: f.y, ang: b.aim, len: 40, w: 3, dur: 0.45, foe: f.id }); }
      if (b.t >= 0.45 && b.n === 0) { X.shoot(A, f.x, f.y, P3.wave, b.aim); b.n = 1; }
      if (b.t >= 0.45 + P3.restS) { b.mode = "tell"; b.t = 0; b.n = 0; }
    }
  }
}

// The big germ is cleared: a short victory beat before the stage ends. The germs left pop, the shots on screen turn to
// sparkles, the food is drawn in, the big germ bursts again and again where it was, and you suck your thumb; then the
// stage ends (finish "boss"). You can still move about.
function startOutro(st) {
  const A = st.A, at = st.bossXY || { x: 0, y: 0, r: 11 };
  st.phase = "outro";
  st.o0 = A.t;
  st.oT0 = st.t;
  st.booms = 0;
  for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 0); X.removeFoe(A, f.id); }
  const B = A.b, step = Math.max(1, Math.ceil(B.n / 8));
  for (let i = 0; i < B.n; i += step) if (B.side[i] === 2) X.burst(A, B.x[i], B.y[i], 2, 2);    // shots to sparkles
  X.clearBullets(A, 2);
  A.tells.length = 0;
  X.vacuum(A, TUNE.outroS);
  A.juice.shake = Math.min(1, A.juice.shake + 0.6);
  if (st.subgoals.boss === "shown") doneBy(st, "boss", "you", "grow.sub.bossDone");
  setPrompt(st, P_FREE);
  emit(st, "sfx", { id: "act.win", x: at.x, y: at.y });
}

function outroStep(st) {
  const A = st.A, at = st.bossXY || { x: 0, y: 0, r: 11 }, k = A.t - st.o0;
  // four more bursts round where it was, 0.12 s apart, each a little further out
  while (st.booms < 4 && k >= 0.12 * (st.booms + 1)) {
    const a = A.rnd() * TAU, d = at.r * (0.3 + 0.2 * st.booms);
    X.burst(A, at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, at.r * (0.7 - 0.1 * st.booms), st.booms % 2 ? 2 : 0);
    A.juice.shake = Math.min(1, A.juice.shake + 0.25);
    st.booms++;
  }
}

// ---- growth: food grows your sparks

function growCheck(st) {
  const A = st.A;
  while (st.grow < TUNE.growAt.length && A.food >= TUNE.growAt[st.grow]) {
    for (const [k, v] of Object.entries(TUNE.grows[st.grow])) { if (k === "rate") st.rate = v; else A.fire[k] = v; }
    st.grow++;
    st.grewAt = A.t;
    emit(st, "sfx", { id: "act.up", x: A.p.x, y: A.p.y, pitch: st.grow });
    if (st.grow === 1 && st.subgoals.food === "shown") doneBy(st, "food", "you", "grow.sub.foodDone");
  }
}

// ---- the outcomes of a world step

function outcomes(st) {
  const A = st.A;
  for (const o of A.out) {
    if (o.type === "clear") {
      const room = TUNE.score.clear - st.ticked;
      const add = Math.max(0, Math.min(room, Math.floor((TUNE.score.clear * o.gain) / REF_SCORE)));
      if (add > 0) { st.ticked += add; emit(st, "points", { part: "skill", add }); }
      X.pop(A, o.x, o.y, add, o.combo);
      if (o.boss) { st.bossCleared = true; st.bossXY = { x: o.x, y: o.y, r: TUNE.boss.spec.r }; }
    } else if (o.type === "pick") {
      if (o.kind === "food") growCheck(st);
    } else if (o.type === "dash") {
      if (st.subgoals.dash === "shown") doneBy(st, "dash", "you", "grow.sub.dashDone");
    }
  }
  X.emitOut(A, st);
}

// The cord's heal beads: each rides the cord for cordS, then heals 1 (or, at full hp, brings 3 food).
function cordStep(st) {
  const A = st.A;
  for (let i = st.cordLights.length - 1; i >= 0; i--) {
    if (A.t - st.cordLights[i] < TUNE.view.cordS) continue;
    st.cordLights.splice(i, 1);
    if (A.ko) continue;
    if (X.heal(A, 1) > 0) emit(st, "sfx", { id: "act.heal", x: A.p.x, y: A.p.y });
    else { A.food += 3; growCheck(st); }
  }
}

// ---- the end

// Every sub-goal shown and not settled settles now.
function settle(st, how) {
  if (st.subgoals.clear === "shown") doneBy(st, "clear", "auto", "grow.sub.clearAuto");
  if (st.subgoals.food === "shown") doneBy(st, "food", "auto", "grow.sub.foodAuto");
  if (st.subgoals.dash === "shown") doneBy(st, "dash", "auto", "grow.sub.dashAuto");
  if (st.subgoals.boss === "shown") {
    if (how === "boss") doneBy(st, "boss", "you", "grow.sub.bossDone");
    else doneBy(st, "boss", "auto", how === "ko" ? "grow.sub.rest" : "grow.sub.bossAuto");
  }
}

// A knock-out: you rest. The germs drift away and the stage holds still until what was said has been read, then
// it ends with its goal unmet (finish "ko"; core/run.js shows the Almost card).
function knockOut(st) {
  const A = st.A;
  st.phase = "ko";
  st.koAt = st.t;
  for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 0); X.removeFoe(A, f.id); }
  X.clearBullets(A, 0);
  A.tells.length = 0;
  st.capQ = [];
  settle(st, "ko");
  setPrompt(st, NONE);
}

function finish(st, how) {
  if (st.done) return;
  const A = st.A;
  st.done = true;
  st.doneT = st.t;
  st.how = how;
  const met = how !== "ko";
  st.goalMet = met;
  // development goes on either way: the clock reaches the stage's end and its milestones fire (a knock-out too)
  st.gaDay = meta.ga.end;
  for (const [mid, ms] of Object.entries(MILESTONES)) if (!st.fired[ms]) { st.fired[ms] = true; emit(st, "milestone", { id: ms, from: mid }); }
  X.clearBullets(A, 0);
  A.tells.length = 0;
  settle(st, how);
  const rest = clearPart(st) + (met ? dodgePart(st) : 0) - st.ticked;
  if (rest > 0) emit(st, "points", { part: "skill", add: rest });
  if (met) emit(st, "points", { part: "goal", add: TUNE.score.goal });
  const fl = flourishPart(st);
  if (fl > 0) emit(st, "points", { part: "flourish", add: fl });
  setPrompt(st, NONE);
  emit(st, "done", {});
}

// ---- the Stage interface

// The placenta's angle on the sac's wall: up, and toward the side you nestled (carry nestleX).
function placentaAng(carry) {
  const P = TUNE.view.placenta, nx = Number.isFinite(carry.nestleX) ? carry.nestleX : 0, sx = nx >= 0 ? 1 : -1;
  return Math.PI / 2 - sx * (P.ang + P.angK * Math.min(1, Math.abs(nx)));
}

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const carry = mergeCarry(carryIn, null);
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const s = seed >>> 0;
  const assist = !!o.assist;
  const As = TUNE.assist;
  // Assist (the shared rule): hp +3, foe bullets 0.75× as fast, the dash back 0.7× as soon, 0.75× the foes (rounded up)
  const A = X.createWorld(s, {
    arena: TUNE.arena,
    player: { ...TUNE.player, x: 0, y: -8, body: 3, shield: Math.min(2, Math.max(0, carry.sparks | 0)),
      ...(assist ? { hp: TUNE.player.hp + As.hpPlus } : {}) },
    dash: assist ? { ...TUNE.dash, cdS: TUNE.dash.cdS * As.dashCdK } : TUNE.dash,
    fire: TUNE.fire, bulletK: assist ? As.bulletK : 1, bulletCap: TUNE.bulletCap,
    keepOut: [{ ang: placentaAng(carry), half: TUNE.keepOut * TAU }],          // no germ comes through the placenta
  });

  // the placenta on the wall, up and to the side you nestled (carry nestleX), and its villi from your tree's seed
  const V = TUNE.view;
  const pcAng = placentaAng(carry);
  const R = TUNE.arena.r + V.placenta.out;
  const pc = { x: Math.cos(pcAng) * R, y: Math.sin(pcAng) * R, r: V.placenta.r };
  const attach = { x: Math.cos(pcAng) * (TUNE.arena.r - 4), y: Math.sin(pcAng) * (TUNE.arena.r - 4) };
  const T = V.tree;
  const tree = createTree({ seed: carry.treeSeed === null ? s : carry.treeSeed, root: attach,
    region: { x: pc.x, y: pc.y, r: pc.r * 0.92 }, N: T.N, D: T.D, di: T.di, dk: T.dk, maxNodes: T.maxNodes, leafW: T.leafW });
  for (let i = 0, idle = 0; i < T.grow && idle < 3; i++) idle = growTree(tree) ? 0 : idle + 1;

  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.ga.start, fertilized: true,
    events: [], beats: null, subgoals: {}, moment: IDS[0],
    assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry,
    A, mi: 0, phase: "wave", w0: 0, r0: 0, b0: 0, W: null, boss: null, bossCleared: false,
    rWave: stream(s, "waves"), pcAng, pc, attach, tree, cordLights: [], grow: 0, grewAt: -Infinity,
    capQ: [], prompt: null, ticked: 0, done: false, doneT: 0, how: null, goalMet: false, capBusy: 0, evSeen: 0, koAt: null, koEnd: null,
    fired: {}, assistK: assist ? As.foesK : 1, rate: TUNE.fire.rate, bossXY: null, o0: 0, oT0: null, booms: 0,
  };
  st.beats = makeBeats(s, [
    { heart: "mother", from: 0, to: END_S, bpm: meta.motherBpm, jitter: 0, first: phase },
    { heart: "you", from: 0, to: NOMINAL_S, gaFrom: meta.ga.start, gaTo: meta.ga.end, jitter: 0 },
    { heart: "you", from: NOMINAL_S, to: END_S, bpm: 150, jitter: 0 },
  ]);
  startWave(st, 0);
  note(st, FACTS, TEXT);
  return st;
}

export function step(st, intents) {
  const it = intents || EMPTY_INTENTS;
  if (st.done) { st.t += DT; return; }
  const A = st.A;
  // your new heart powers your sparks: the fire rate follows its curve (130 bpm at week 7, 170 at weeks 9 and 10)
  A.fire.rate = st.rate * bpmYou(st.gaDay) / TUNE.heartBpm;
  const moved = X.stepWorld(A, it);
  outcomes(st);
  cordStep(st);
  if (A.ko && st.phase !== "ko") knockOut(st);
  if (!moved || st.phase === "ko") { /* a hit-stop holds the world and its timers; a knock-out rests */ }
  else if (st.phase === "wave") {
    X.spawnDue(A, st.W);
    const tIn = A.t - st.w0;
    if ((X.wavesDone(st.W) && X.foesLeft(A) === 0 && tIn > 1) || tIn >= TUNE.waveMaxS) startRest(st);
  } else if (st.phase === "rest") {
    if (A.t - st.r0 >= TUNE.restS) {
      st.gaDay = Math.max(st.gaDay, MOMENTS[st.mi].ga[1]);
      if (st.mi + 1 < BOSS) startWave(st, st.mi + 1);
      else startBoss(st);
    }
  } else if (st.phase === "boss") {
    bossStep(st);
  } else if (st.phase === "outro") {
    outroStep(st);
  }
  st.t += DT;
  while (st.capQ.length && st.capQ[0].at <= A.t + 1e-9) {
    const q = st.capQ.shift();
    if (q.sub) { if (q.sub === "food" && st.grow === 0) subgoal(st, "food", "grow.sub.food"); }
    else caption(st, q.id);
  }
  // the clock: 7N to 7N + 6 over a wave's nominal length, the last day over its rest; the boss 91 to 96
  const m = MOMENTS[st.mi];
  let g;
  if (st.phase === "wave") g = m.ga[0] + 6 * clamp01((A.t - st.w0) / TUNE.waveS);
  else if (st.phase === "rest") g = m.ga[0] + 6 + clamp01((A.t - st.r0) / TUNE.restS);
  else g = m.ga[0] + 5 * clamp01((A.t - st.b0) / (TUNE.bossInS + TUNE.bossS));
  if (st.phase !== "ko") st.gaDay = Math.max(st.gaDay, Math.min(m.ga[1], g));
  note(st, FACTS, TEXT);                                    // what was said, for a knock-out's rest (core/lib/rest.js)
  if (st.phase === "ko") {
    if (st.koEnd === null) st.koEnd = readBy(st, st.koAt + TUNE.koS);
    if (st.t >= st.koEnd - 1e-9 || st.t >= meta.capS - 1e-9) finish(st, "ko");
    return;
  }
  if (st.bossCleared && st.phase !== "outro") startOutro(st);
  if (st.phase === "outro") { if (A.t - st.o0 >= TUNE.outroS - 1e-9 || st.t >= meta.capS - 1e-9) finish(st, "boss"); return; }
  if (st.t >= meta.capS - 1e-9) finish(st, "cap");
}

// ---- the picture

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

// Your length in mm at gaDay: a log-lerp through the NHS lengths.
function lengthMm(g) {
  const L = TUNE.view.lengthMm;
  if (g <= L[0][0]) return L[0][1];
  for (let i = 1; i < L.length; i++) {
    if (g <= L[i][0]) {
      const [g0, a] = L[i - 1], [g1, b] = L[i];
      return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * ((g - g0) / (g1 - g0)));
    }
  }
  return L[L.length - 1][1];
}

const swell = (phase) => { const u = Math.max(0, 1 - phase / 0.35); return u * u; };

// The pose: a kick while you dash, a startle when you are hit, the thumb once the big germ is gone, else the curl.
function poseOf(st) {
  const p = st.A.p;
  if (st.phase === "outro" || (st.done && st.how === "boss")) return { name: "thumb", p: smooth((st.t - (st.oT0 ?? st.doneT)) / 0.6) };
  if (p.dashT > 0) return { name: "kick", p: 1 };
  if (p.inv > 0 && p.inv > p.invS - 0.35) return { name: "startle", p: smooth((p.invS - p.inv) / 0.15) };
  return "curl";
}

// The cord: a sagging ribbon from the placenta to your belly.
function cordPts(st, root) {
  const a = st.attach;
  const w = 1.5 * Math.sin(0.6 * st.t);
  const mx = (a.x + root.x) / 2, my = (a.y + root.y) / 2;
  const sag = 0.25 * Math.hypot(root.x - a.x, root.y - a.y);
  const p1 = { x: a.x + (mx - a.x) * 0.5 + w, y: a.y + (my - a.y) * 0.5 - sag * 0.6 };
  const p2 = { x: root.x + (mx - root.x) * 0.5 - w, y: root.y + (my - root.y) * 0.5 - sag * 0.4 };
  const out = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), v = 1 - u;
    out.push(v * v * v * a.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * root.x,
      v * v * v * a.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * root.y);
  }
  return out;
}

export function view(st) {
  const V = TUNE.view, A = st.A, p = A.p;
  const d = emptyDraw(meta.id);
  const g = st.gaDay, t = st.t;
  const mm = mmPerShortAxis(meta, g);
  d.camera = { x: 0, y: 0, span: V.span, rot: 0, orient: meta.orient, mmPerU: mm / V.span };
  d.scale = { mm: bar(mm) };
  const k = clamp01((g - meta.ga.start) / (meta.ga.end - meta.ga.start));
  d.light = { level: V.light.level0 + (V.light.level1 - V.light.level0) * k, warm: V.light.warm, exposure: 1, white: 0,
    vignette: V.light.vignette, tint: 0 };
  d.warp = V.warp;
  d.caustics = 0;

  // you: smaller than to scale (room to play), growing with your true length; leaning a little into your move
  const S = V.size0 * Math.pow(lengthMm(g) / V.lengthMm[0][1], V.sizeK);
  const lean = -0.3 * p.mx;
  const splats = figure(poseOf(st), S, g, { x: p.x, y: p.y, rot: lean });
  const youPulse = swell(st.beats.phase("you", t));
  for (const s of splats) if (s.v === 1) s.r *= 1 + 0.3 * youPulse;
  d.splats = splats;
  const c = Math.cos(lean), sn = Math.sin(lean);
  const root = { x: p.x + S * (0.06 * c + 0.16 * sn), y: p.y + S * (0.06 * sn - 0.16 * c) };

  // her heart: the placenta and its villi swell with it
  const her = swell(st.beats.phase("mother", t));
  const pc = st.pc;
  d.strips.push({ kind: "tree", nodes: st.tree.view, version: st.tree.version, pulse: her });
  const lights = st.cordLights.map((t0) => clamp01((A.t - t0) / V.cordS));
  d.strips.push({ kind: "cord", pts: cordPts(st, root), lights });
  rimSparks(d, st.carry.sparks, p.x, p.y, 0.5 * S, { t, span: V.span });
  if (A.t - st.grewAt >= 0 && A.t - st.grewAt < 0.6) {               // you grow: a ring of light (its own strip)
    const age = A.t - st.grewAt;
    d.strips.push({ kind: "ripples", items: [{ x: p.x, y: p.y, r: 3 + 22 * age, a: 0.8 * (1 - age / 0.6), dashed: false }] });
  }

  d.marks.push({ kind: "lake", x: pc.x, y: pc.y, r: pc.r, rim: "solid", on: false, pulse: 0.3 * her });
  d.marks.push({ kind: "glow", x: p.x, y: p.y, r: 0.85 * S, on: A.ko ? 0 : 0.75, pulse: youPulse });   // your soft light
  for (const [ox, oy, rr] of V.pools) {
    d.marks.push({ kind: "pool", x: pc.x + ox * pc.r, y: pc.y + oy * pc.r, r: rr * pc.r, rim: g >= 84 ? "wavy" : "dotted", on: g >= 84, pulse: g >= 84 ? her : 0 });
  }

  // the action layer: the sac's wall, germs, shots, food, telegraphs, pops, your hp
  d.action = { ...X.actionView(A), arena: { ...TUNE.arena } };
  d.rings.push({ id: "mother", kind: "mother", x: pc.x, y: pc.y, r: pc.r + V.motherPad, progress: clamp01(st.beats.phase("mother", t)) });
  d.anchor = { x: p.x, y: p.y };
  d.cue = { x: p.x, y: p.y };
  return d;
}

export function prompt(st) {
  if (st.done || !st.prompt) return { ...NONE };
  return { ...st.prompt };
}

export function targets() {
  return [];
}

// The action bot (core/lib/actionbot.js) at this skill: dodge, keep range, fetch food, dash when a shot is close.
export function botSteer(st, skill, r) {
  const zero = { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  if (!st || st.done) return zero;
  const a = actionSteer(st.A, skill, r);
  return { steer: a.steer, dir: null, hold: false, dash: a.dash };
}

export function probe() {
  return null;
}

// The score's mood (openspec/changes/first-breath-score/contract.md, "Mood"): a wave is 1, and 2 from week 10 on (the
// fourth moment, mi 3) or with 12 or more germs or 24 or more of their shots about; the big germ is 2 and the boss
// while it lives; a rest and a knock-out are 0, the victory beat 1. These thresholds (mi 3, 12 germs, 24 shots) stay
// here as literals on purpose: they set only the music, so they sit beside the state they read and not in
// grow.tune.js (first-breath-score design 4). Pure and cheap (main.js reads it every 100 ms); it changes nothing.
export function mood(st) {
  const A = st && st.A;
  if (!A || st.done || st.phase === "ko" || A.ko) return { level: 0 };
  if (st.phase === "boss") return { level: 2, boss: !st.bossCleared };
  if (st.phase === "outro") return { level: 1 };
  if (st.phase !== "wave") return { level: 0 };
  return { level: st.mi >= 3 || A.foes.length >= 12 || X.foeBullets(A) >= 24 ? 2 : 1 };
}

export function result(st) {
  const A = st.A;
  const goalMet = st.done && st.goalMet;
  const clear = st.done ? clearPart(st) : st.ticked;
  const dodge = st.done && goalMet ? dodgePart(st) : 0;
  const flourish = st.done ? flourishPart(st) : 0;                       // a knock-out keeps its Skill and Flourish
  const score = clampScore({ goal: goalMet ? TUNE.score.goal : 0, skill: clear + dodge, flourish });
  return {
    done: st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "clear", label: "grow.part.clear", value: Math.min(clear, TUNE.score.clear), max: TUNE.score.clear },
      { id: "dodge", label: "grow.part.dodge", value: dodge, max: TUNE.score.dodge },
      { id: "combo", label: "grow.part.combo", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: { kills: A.kills, hits: A.hits, hp: A.p.hp, hpMax: A.p.hpMax, bestCombo: A.bestCombo, score: A.score,
      cleared: A.cleared, value: A.value, total: TOTAL_VALUE, food: A.food, grow: st.grow, dashes: A.dashes,
      moment: st.moment, how: st.how, gaDay: st.gaDay, ko: A.ko, koAt: st.koAt, almost: A.ko ? "almost.ko" : null,
      shieldHits: A.shieldHits || 0 },
    carryOut: {},
  };
}

// Fair resume (5.2): 1.2 s of i-frames after Resume, so a pause never ends in a hit.
export function resume(st) {
  if (!st || st.done) return 0;
  st.A.p.inv = Math.max(st.A.p.inv, 1.2);
  return 0;
}

// Skip to a named moment, starting now (for tests and the test hook): the germs and shots in the sac go, the clock
// moves on to that moment's start (never back).
export function jump(st, id) {
  const i = IDS.indexOf(id);
  if (i < 0) return false;
  const A = st.A;
  for (const f of A.foes.slice()) X.removeFoe(A, f.id);
  X.clearBullets(A, 0);
  A.tells.length = 0;
  st.capQ = [];
  st.done = false;
  st.how = null;
  st.bossCleared = false;
  st.bossXY = null;
  st.oT0 = null;
  if (i === BOSS) startBoss(st);
  else startWave(st, i);
  return true;
}

export const TOTALS = Object.freeze({ value: TOTAL_VALUE, ref: REF_SCORE });
