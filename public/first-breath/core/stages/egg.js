// First Breath: stage 2, The Egg (`egg`): "Guard your shell." (design.md 6.2, 4.1, 5, 7, 16). Now you are the egg.
// A gold surge washes over your follicle (beats 1 and 2); you tap with her heartbeat to swell it, and the 3rd tap
// graded Close or better bursts it (or it opens by itself on beat 8). The fimbriae sweep you into the tube. Then
// sperm come in 8 waves from all sides; a glowing arc follows your drag (or the turn keys, or the mouse) round your
// shell, and a sperm it is over bounces away, or pops loose if it had stuck. Rivals that finish burrowing are held,
// still, in the cloud, and never enter. Your own gold sperm comes in at 27 + 0.3 × (place − 1) s into the guard; the
// arc only nudges it, and it always enters. Then you seal your shell with a hold and a release on her beat, a wave
// runs round the shell both ways, the others drift off, and the two nuclei draw close. The clock turns to "Day 0
// after fertilization (week 2)" when they touch, at the end of fusion. Nothing fails; skill only changes the score.
//
// Pure: no DOM, no clocks, no timers, no storage, no Math.random; every draw comes from stream(seed, name). The step
// never throws (a caught error ends the stage gracefully and is kept in state.error for the tests). Each fixed step
// is split at the exact time a moment ends, so a burst, an entry or a seal mid-step starts the next moment there,
// and its events carry that time. Numbers live in egg.tune.js.
//
// Choices where the contract is silent (reported to the contract owner):
// - The arc wakes on the first guard input (turn, aim, or a stick of 0.25 or more). Until then it is drawn dim and
//   leaves every sperm alone, so an idle guard has a guard credit of 0 and earns no clean-entry bonus (6.2, 18).
// - opts.card === true leaves out the "Now you are the egg." caption (the card shows it); with no such flag the
//   stage cannot tell a card from practice, so it always says it.
// - On the auto burst at beat 8, a beat 8 target still open is counted as missed at once, so the opening ends on beat
//   8 for every input (by 8.9 s). A release graded Off, or a free one before the target, does not seal; you press
//   again. A release after the target has passed seals with no Flourish (seal grade "miss").
// - The seal facts are spread out so no two captions land together: egg.wave as the wave starts (fusion start),
//   egg.seal when it meets on the far side (1.2 s), egg.block once the others drift off (2.5 s).
// - probe() reports a rival drifting off after the seal as "loose" (16.9 has no other state for it).
import { DT, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { CREDIT } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { createTrack, feed, upcoming, previewS, freeUntil, RESUME_FREE_S } from "../lib/track.js";
import { subgoal, doneBy, turnToward, wrapAngle } from "../lib/goals.js";
import { rimSparks } from "../lib/sparks.js";
import { stream, gauss } from "../rng.js";
import { TUNE } from "./egg.tune.js";

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const angDist = (a, b) => Math.abs(wrapAngle(a - b));
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const UNIT = 1 - 1e-9;   // botSteer's steer length: under 1 even after rounding

const O = TUNE.opening, A = TUNE.arc, W = TUNE.waves, BO = TUNE.bounce, SK = TUNE.stick, HE = TUNE.held;
const GD = TUNE.gold, SL = TUNE.seal, FU = TUNE.fusion, SC = TUNE.score, SZ = TUNE.sizes, BOT = TUNE.bot;

// One 4.1 moment: the whole stage is at gaDay 14 (Week 2), so no moment moves the clock.
const mo = (id) => Object.freeze({ id, ga: Object.freeze([14, 14]), lenS: null });

export const meta = Object.freeze({
  id: "egg", index: 1, name: "The Egg", verb: "Guard",
  orient: "long",
  families: Object.freeze(["tap", "rotate", "hold"]),
  ga: Object.freeze({ start: 14, end: 14 }), fertilized: false,
  mm: Object.freeze({ start: 0.4, end: 0.4 }),
  motherBpm: 72, parS: 53, capS: TUNE.capS, canFail: false, scored: true,
  moments: Object.freeze(["surge", "open", "sweep", "guard", "enter", "seal", "fusion", "outro"].map(mo)),
});

const ORDER = meta.moments.map((m) => m.id);
const PERIOD = 60 / meta.motherBpm;
const GESTURE = Object.freeze({ surge: "none", open: "tap", sweep: "none", guard: "drag", enter: "none", seal: "hold",
  fusion: "none", outro: "none" });
const PROMPT_TEXT = Object.freeze({ open: "egg.tap", guard: "egg.guard", seal: "egg.seal" });
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const I_GUARD = ORDER.indexOf("guard"), I_ENTER = ORDER.indexOf("enter"), I_SEAL = ORDER.indexOf("seal");

function promptOf(id) {
  return { gesture: GESTURE[id] || "none", text: PROMPT_TEXT[id] || null, keys: id === "guard" ? "turn" : "steer" };
}

// ---- seeded set-up (create) ----

// The 8 waves: every rival's arrival (seconds into the guard), wave, angle and inward speed (6.2).
function wavePlan(seed) {
  const r = stream(seed, "waves");
  const jit = (deg) => (2 * r() - 1) * deg * RAD;
  const out = [];
  for (let k = 0; k < W.at.length; k++) {
    const n = W.count[k], c = r() * TAU;
    const angs = [];
    if (k === 0) {                                   // one 90° sector
      const sec = W.sector1Deg * RAD;
      for (let i = 0; i < n; i++) angs.push(c - sec / 2 + (sec * (i + 0.5)) / n + jit(W.sectorJitterDeg));
    } else if (k === 1) {                            // two opposite 60° sectors
      const sec = W.sector2Deg * RAD, per = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const side = i % 2, m = Math.floor(i / 2), cnt = side === 0 ? per : n - per;
        angs.push(c + side * Math.PI - sec / 2 + (sec * (m + 0.5)) / cnt + jit(W.sectorJitterDeg));
      }
    } else {                                         // all round: 360/n apart (≥ 45°), ±10° jitter, so ≥ 25° apart
      for (let i = 0; i < n; i++) angs.push(c + (TAU * i) / n + jit(W.jitterDeg));
    }
    const idx = angs.map((_, i) => i);               // a seeded order of arrival
    for (let i = idx.length - 1; i > 0; i--) { const q = Math.floor(r() * (i + 1)); const s = idx[i]; idx[i] = idx[q]; idx[q] = s; }
    idx.forEach((ai, m) => out.push({ t: W.at[k] + W.gapS * m, wave: k + 1, angle: wrapAngle(angs[ai]), speed: W.speed[k] }));
  }
  out.sort((a, b) => a.t - b.t || a.wave - b.wave);
  return out;
}

// The 72 gold candidates (degrees, one every 5°) in the seeded order of stream(seed, "gold").
function goldOrder(seed) {
  const r = stream(seed, "gold");
  const idx = Array.from({ length: GD.candidates }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const q = Math.floor(r() * (i + 1)); const s = idx[i]; idx[i] = idx[q]; idx[q] = s; }
  return idx.map((i) => i * GD.stepDeg);
}

// The corona: 220 paper dots between 11 and 20 u (radius, angle, alpha per dot).
function coronaOf(seed) {
  const r = stream(seed, "corona");
  const [lo, hi] = SZ.corona;
  const c = new Float32Array(3 * SZ.coronaN);
  for (let i = 0; i < SZ.coronaN; i++) {
    c[3 * i] = lo + (hi - lo) * r();
    c[3 * i + 1] = r() * TAU - Math.PI;
    c[3 * i + 2] = 0.55 + 0.4 * r();
  }
  return c;
}

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const s = (Number(seed) >>> 0) || 0;
  const carry = mergeCarry(carryIn, null);
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const assist = !!o.assist;
  const beats = makeBeats(s, [{ heart: "mother", from: 0, to: meta.capS + 30, bpm: meta.motherBpm, jitter: 0, first: phase }]);
  // beats 1 to 8: beat 1 is her first beat at or after the lead-in (5.1)
  const ob = [];
  let b = beats.next("mother", O.leadS - 1e-9);
  for (let k = 0; k < O.lastTapBeat; k++) { ob.push(b); b = beats.next("mother", b + 1e-6); }
  const open = [];
  for (let k = O.firstTapBeat; k <= O.lastTapBeat; k++) {
    const t = ob[k - 1];
    const P = Math.max(0.5, k === O.firstTapBeat ? PERIOD : t - ob[k - 2]);
    open.push({ id: "open." + k, t, P, kind: "tap", heart: "mother", group: "open" });
  }
  const half = (assist ? A.halfAssistDeg : A.halfDeg) * RAD;
  const st = {
    id: meta.id, seed: s, t: 0, gaDay: 14, fertilized: false, events: [], beats, subgoals: {}, moment: ORDER[0],
    mi: 0, mStart: 0, done: false, doneAt: null, how: null, capped: false, error: null,
    assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry, place: carry.sperm.place, ob,
    open: { track: createTrack(open, { assist, lag: o.lag }), good: 0, burstAt: null, by: null, presented: 0, acc: 0, fx: [] },
    guard: {
      t0: null, half, arc: { a: stream(s, "arc")() * TAU - Math.PI, live: false },
      plan: wavePlan(s), order: goldOrder(s), si: 0, rivals: [], nextId: 0, simT: 0,
      goldAt: null, gold: null, enterAt: null, credit: null, counted: 0, n: { bounce: 0, loose: 0, held: 0 }, fx: [],
    },
    seal: null, fusionAt: null, drifted: false,
    later: [],
    parts: { open: 0, guard: 0, clean: 0, seal: 0 },
    corona: coronaOf(s),
    rB: stream(s, "bounce"),
  };
  emit(st, "moment", { id: st.moment, t: 0 });
  emit(st, "prompt", { ...promptOf(st.moment), t: 0 });
  if (o.card !== true) emit(st, "caption", { id: "egg.now", dir: null, t: 0 });
  for (let k = 0; k < O.surgeBeats; k++) later(st, ob[k], null, "sfx", { id: "egg.surge", at: ob[k], pitch: 1 + 0.12 * k, gain: 0.7 });
  return st;
}

// ---- small helpers ----

function later(st, t, tag, name, data) {
  st.later.push({ t, tag, name, data });
  st.later.sort((a, b) => a.t - b.t);
}

// Emit the queued events due before b (those of the current moment, and the untagged ones).
function due(st, b) {
  if (!st.later.length) return;
  const keep = [];
  for (const x of st.later) {
    if (x.t < b - 1e-12 && (x.tag === null || x.tag === st.moment)) emit(st, x.name, { ...x.data, t: x.t });
    else keep.push(x);
  }
  st.later = keep;
}

// A moment ends at tEnd: its queued events due by then are emitted, the rest dropped.
function flushLater(st, tag, tEnd) {
  const keep = [];
  for (const x of st.later) {
    if (x.tag !== tag) { keep.push(x); continue; }
    if (x.t <= tEnd + 1e-9) emit(st, x.name, { ...x.data, t: x.t });
  }
  st.later = keep;
}

const fact = (st, id, t) => emit(st, "fact", { id, where: "caption", t });

// Sub-goal events at an exact time inside a step (goals.js stamps them with state.t).
function at(st, t, f) {
  const keep = st.t;
  st.t = t;
  try { f(); } finally { st.t = keep; }
}
const sfx = (st, id, t, pitch = 1, gain = 1) => emit(st, "sfx", { id, at: t, pitch, gain, t });

function times(list) {
  const out = [];
  for (const e of Array.isArray(list) ? list : []) if (e && fin(e.t)) out.push({ t: e.t, raw: fin(e.raw) ? e.raw : e.t });
  return out.sort((a, b) => a.t - b.t);
}

function setPos(x) {
  x.x = x.r * Math.cos(x.theta);
  x.y = x.r * Math.sin(x.theta);
}

// Is the arc over a head at angle theta, distance r? (6.2: within the half-width and within 22 u)
function over(st, theta, r) {
  const G = st.guard;
  return r <= A.reach + 1e-9 && angDist(theta, G.arc.a) <= G.half + 1e-9;
}

// ---- the moments ----

function endTime(st) {
  switch (st.moment) {
    case "surge": return st.ob[O.surgeBeats - 1];
    case "open": return st.open.burstAt !== null ? st.open.burstAt : st.ob[O.lastTapBeat - 1];
    case "sweep": return st.mStart + O.sweepS;
    case "guard": return st.guard.enterAt !== null ? st.guard.enterAt : Infinity;
    case "enter": return st.mStart + TUNE.enterS;
    case "seal": return st.seal && st.seal.sealAt !== null ? st.seal.sealAt : st.seal ? st.seal.c[SL.autoBeat - 1] : st.mStart;
    case "fusion": return st.mStart + FU.s;
    case "outro": return st.mStart + TUNE.outroS;
    default: return st.mStart;
  }
}

function startMoment(st, i, t) {
  const id = ORDER[i];
  st.mi = i;
  st.moment = id;
  st.mStart = t;
  st.gaDay = 14;
  emit(st, "moment", { id, t });
  emit(st, "prompt", { ...promptOf(id), t });
  const G = st.guard;
  switch (id) {
    case "open":
      at(st, t, () => subgoal(st, "open", "egg.openGoal"));
      break;
    case "sweep":
      for (const [fid, at] of TUNE.sweepFacts) later(st, t + at, "sweep", "fact", { id: fid, where: "caption" });
      break;
    case "guard":
      G.t0 = t;
      G.simT = t;
      G.goldAt = t + GD.atS + GD.perPlaceS * (st.place - 1);
      at(st, t, () => subgoal(st, "guard", "egg.guardGoal"));
      TUNE.waveFacts.forEach((fid, k) => later(st, t + W.at[k], "guard", "fact", { id: fid, where: "caption" }));
      break;
    case "enter":
      fact(st, "egg.fuse", t);
      break;
    case "seal":
      laySeal(st, t);
      at(st, t, () => subgoal(st, "seal", "egg.sealGoal"));
      break;
    case "fusion":
      st.fusionAt = t;
      fact(st, "egg.wave", t);
      later(st, t + FU.sealFactS, "fusion", "fact", { id: "egg.seal", where: "caption" });
      later(st, t + FU.blockFactS, "fusion", "fact", { id: "egg.block", where: "caption" });
      sfx(st, "egg.fifth", t, 1, 0.8);
      break;
    case "outro":
      fact(st, "egg.place", t);
      break;
  }
}

function endMoment(st, t) {
  flushLater(st, st.moment, t);
  switch (st.moment) {
    case "open": if (st.open.burstAt === null) burst(st, t, "auto"); break;
    case "guard": settleEntry(st, t); break;
    case "seal":
      if (!st.seal) laySeal(st, t);
      if (st.seal.sealAt === null) sealNow(st, t, null, true);
      break;
    case "fusion": fertilize(st, t); break;
  }
}

// The current moment ends at t: the next starts there, or the stage ends after the outro.
function advance(st, t) {
  endMoment(st, t);
  if (st.mi >= ORDER.length - 1) { finish(st, t); return; }
  startMoment(st, st.mi + 1, t);
}

function finish(st, t) {
  if (st.done) return;
  st.done = true;
  st.doneAt = t;
  st.how = st.capped ? "cap" : "end";
  if (!st.fertilized) fertilize(st, t);
  for (const [id, s] of Object.entries(st.subgoals)) if (s === "shown") at(st, t, () => doneBy(st, id, "auto", "egg." + id + "Auto"));
  st.later = [];
  emit(st, "points", { part: "goal", add: PARTS.goal, t });
  emit(st, "prompt", { ...NONE, t });
  emit(st, "done", { t });
}

function fertilize(st, t) {
  if (st.fertilized) return;
  st.fertilized = true;
  emit(st, "milestone", { id: "fertilized", t });
  fact(st, "egg.pronuclei", t);
}

// ---- the opening: the follicle taps and the burst ----

function judgedOpen(st, r, t) {
  const x = r.target;
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart, t });
  if (r.grade === "off") return;
  const O_ = st.open;
  O_.fx.push({ t, grade: r.grade });
  if (O_.fx.length > 8) O_.fx.shift();
  if (r.grade === "in" || r.grade === "close") {
    sfx(st, "egg.pluck", t, r.grade === "in" ? 1 : 0.94, 0.8);
    O_.good++;
    if (O_.good >= O.burstGood && O_.burstAt === null) burst(st, t, "you");
  }
}

function openSeg(st, ps, b) {
  const O_ = st.open;
  for (const p of ps) {
    if (O_.burstAt !== null) break;
    for (const r of feed(O_.track, { presses: [p], releases: [] }, p.t)) judgedOpen(st, r, p.t);
  }
  if (O_.burstAt === null) for (const r of feed(O_.track, EMPTY_INTENTS, b)) judgedOpen(st, r, b);
}

// The follicle bursts at t, by your 3rd good tap or by itself; the open beats after it carry no targets.
function burst(st, t, by) {
  const O_ = st.open;
  if (O_.burstAt !== null) return;
  O_.burstAt = t;
  O_.by = by;
  const tr = O_.track;
  for (let i = 0; i < tr.targets.length; i++) {
    if (tr.results[i] === null && tr.targets[i].t <= t + 1e-9) {
      tr.results[i] = { grade: "miss", errMs: null, rawMs: null };
      emit(st, "judge", { target: tr.targets[i].id, grade: "miss", errMs: null, rawMs: null, heart: tr.targets[i].heart, t });
    }
  }
  const keep = [], res = [];
  tr.targets.forEach((x, i) => { if (tr.results[i] !== null) { keep.push(x); res.push(tr.results[i]); } });
  const next = createTrack(keep, { assist: st.assist, lag: st.lag });
  next.results = res;
  O_.track = next;
  O_.presented = keep.length;
  // a free target (after a resume, 5.2) is left out of the sum and of the count, unless every one is free
  const nFree = keep.filter((x) => x.free).length, all = nFree === keep.length;
  let sum = 0;
  keep.forEach((x, k) => { if (all || !x.free) sum += CREDIT[res[k].grade] || 0; });
  const den = Math.max(SC.openMin, keep.length) - (all ? 0 : nFree);
  O_.acc = den > 0 ? sum / den : 0;
  st.parts.open = SC.open * O_.acc;
  if (st.parts.open > 0) emit(st, "points", { part: "skill", add: Math.round(st.parts.open), t });
  at(st, t, () => doneBy(st, "open", by === "you" ? "you" : "auto", by === "you" ? "egg.openDone" : "egg.openAuto"));
  sfx(st, "egg.burst", t, 1, 1);
}

// ---- the guard ----

function arcStep(st, it, dt) {
  const arc = st.guard.arc;
  const aimRate = A.aimRateDeg * RAD;
  const turnRate = (st.assist ? A.turnRateAssistDeg : A.turnRateDeg) * RAD;
  const turn = it.turn > 0 ? 1 : it.turn < 0 ? -1 : 0;
  const s = it.steer && fin(it.steer.x) && fin(it.steer.y) ? it.steer : { x: 0, y: 0 };
  const aim = it.aim && fin(it.aim.x) && fin(it.aim.y) && Math.hypot(it.aim.x, it.aim.y) > 1e-6 ? it.aim : null;
  if (turn !== 0) {                                    // turn +1 is clockwise as seen: it decreases the angle
    arc.a = wrapAngle(arc.a - turn * turnRate * dt);
    arc.live = true;
  } else if (aim) {
    arc.a = wrapAngle(turnToward(arc.a, Math.atan2(aim.y, aim.x), aimRate, dt));
    arc.live = true;
  } else if (Math.hypot(s.x, s.y) >= A.stickMin) {
    arc.a = wrapAngle(turnToward(arc.a, Math.atan2(s.y, s.x), aimRate, dt));
    arc.live = true;
  }
}

function guardSeg(st, it, a, b) {
  const G = st.guard;
  const from = Math.max(a, G.simT);
  if (b > from) arcStep(st, it, b - from);
  while (G.enterAt === null && G.si < G.plan.length && G.t0 + G.plan[G.si].t < b) {
    const p = G.plan[G.si++];
    const rv = { id: "r" + G.nextId++, wave: p.wave, state: "in", theta: p.angle, r: W.ring, v: p.speed, born: G.t0 + p.t,
      p: 0, hk: 0, near: null, settle: null, credit: null, x: 0, y: 0, vx: 0, vy: 0, gone: false };
    setPos(rv);
    G.rivals.push(rv);
  }
  if (!G.gold && G.enterAt === null && G.goldAt !== null && G.goldAt < b) spawnGold(st, G.goldAt);
  sim(st, b, G.arc.live);
  if (G.enterAt === null && b - G.t0 >= GD.latestS - 1e-9) G.enterAt = Math.max(a, G.t0 + GD.latestS);
}

// Move every sperm from the last simulated time to b; the arc acts only while it is live in the guard.
function sim(st, b, live) {
  const G = st.guard;
  const t0 = G.simT;
  if (!(b > t0)) return;
  for (const rv of G.rivals) {
    if (rv.gone) continue;
    const dt = b - Math.max(t0, rv.born);
    if (dt > 0) moveRival(st, rv, dt, b, live);
  }
  const g = G.gold;
  if (g && g.state !== "entered") {
    const dt = b - Math.max(t0, g.born);
    if (dt > 0) moveGold(st, g, dt, b, live);
  }
  if (G.fx.length) G.fx = G.fx.filter((f) => b - f.t < BO.ringS + 0.1);
  G.simT = b;
}

function settle(st, rv, kind, now) {
  rv.settle = now;
  rv.credit = TUNE.credit[kind];
  st.guard.n[kind]++;
}

function moveRival(st, rv, dt, now, live) {
  switch (rv.state) {
    case "in":
      rv.r -= rv.v * dt;
      if (rv.near === null && rv.r <= A.reach + 1e-9) rv.near = now;
      if (live && over(st, rv.theta, rv.r)) {         // a swimming rival under the arc bounces away
        const h = rv.theta + (2 * st.rB() - 1) * BO.spreadDeg * RAD;
        setPos(rv);
        rv.state = "bounce";
        rv.vx = BO.speed * Math.cos(h);
        rv.vy = BO.speed * Math.sin(h);
        settle(st, rv, "bounce", now);
        st.guard.fx.push({ x: A.r * Math.cos(rv.theta), y: A.r * Math.sin(rv.theta), t: now });
        emit(st, "bounce", { id: rv.id, angle: rv.theta, wave: rv.wave, t: now });
        return;
      }
      if (rv.r <= SK.r) {                              // it reaches an open part of the shell: it sticks, head in
        rv.r = SK.r;
        rv.state = "stuck";
        rv.p = 0;
        emit(st, "stick", { id: rv.id, angle: rv.theta, gold: false, wave: rv.wave, t: now });
      }
      setPos(rv);
      return;
    case "stuck":
      if (live && over(st, rv.theta, rv.r)) {         // the arc over a stuck rival pops it loose
        const h = rv.theta + (2 * st.rB() - 1) * SK.looseSpreadDeg * RAD;
        rv.state = "loose";
        rv.vx = SK.looseSpeed * Math.cos(h);
        rv.vy = SK.looseSpeed * Math.sin(h);
        settle(st, rv, "loose", now);
        emit(st, "loose", { id: rv.id, t: now });
        return;
      }
      rv.p += dt / (st.assist ? SK.burrowAssistS : SK.burrowS);
      if (rv.p >= 1) {                                 // it never gets in: it is held, still, in the cloud
        rv.p = 1;
        rv.state = "held";
        rv.hk = 0;
        settle(st, rv, "held", now);
        emit(st, "held", { id: rv.id, t: now });
      }
      return;
    case "held":
      rv.hk = Math.min(1, rv.hk + dt / HE.moveS);
      rv.r = SK.r + (HE.r - SK.r) * (1 - (1 - rv.hk) * (1 - rv.hk));
      setPos(rv);
      return;
    default:                                           // bounce, loose, off: drift outward and leave past 80 u
      rv.x += rv.vx * dt;
      rv.y += rv.vy * dt;
      rv.r = Math.hypot(rv.x, rv.y);
      rv.theta = Math.atan2(rv.y, rv.x);
      if (rv.r > BO.removeR) rv.gone = true;
  }
}

function moveGold(st, g, dt, now, live) {
  const G = st.guard;
  const canNudge = live && g.nudges < GD.maxNudges;
  const nudge = (from) => {
    g.prev = from;
    g.state = "nudge";
    g.r0 = g.r;
    g.nk = 0;
    g.back = false;
    g.nudges++;
    emit(st, "nudge", { n: g.nudges, t: now });
  };
  switch (g.state) {
    case "in":
      g.r -= GD.speed * dt;
      if (canNudge && over(st, g.theta, g.r)) nudge("in");
      else if (g.r <= SK.r) {
        g.r = SK.r;
        g.state = "stuck";
        emit(st, "stick", { id: "gold", angle: g.theta, gold: true, wave: null, t: now });
        fact(st, "egg.stick", now);
      }
      break;
    case "stuck":
      if (canNudge && over(st, g.theta, g.r)) { nudge("stuck"); break; }
      if (g.p + dt / GD.burrowS >= 1) {
        const tE = now - dt + (1 - g.p) * GD.burrowS;
        g.p = 1;
        if (G.enterAt === null) G.enterAt = Math.min(now, Math.max(now - dt, tE));
      } else g.p += dt / GD.burrowS;
      break;
    case "nudge":                                      // out 6 u over 0.3 s, then back at 8 u/s; the arc is ignored
      if (!g.back) {
        g.nk = Math.min(1, g.nk + dt / GD.nudgeS);
        g.r = g.r0 + GD.nudgeOut * (1 - (1 - g.nk) * (1 - g.nk));
        if (g.nk >= 1) g.back = true;
      } else {
        g.r -= GD.returnSpeed * dt;
        if (g.r <= g.r0) { g.r = g.r0; g.state = g.prev; }
      }
      break;
  }
  setPos(g);
}

// Your sperm's angle (6.2): of the 72 candidates in seeded order, drop those under the thumb (world −y), under the
// portrait caption band (world +y) and near the arc; take the one farthest from every stuck rival, the first on a tie.
function goldAngle(st) {
  const G = st.guard;
  const margin = G.half + GD.arcMarginDeg * RAD;
  const stuck = G.rivals.filter((rv) => !rv.gone && rv.state === "stuck").map((rv) => rv.theta);
  const allowed = (c) => angDist(c, -Math.PI / 2) > GD.thumbDeg * RAD + 1e-9 && angDist(c, Math.PI / 2) > GD.captionDeg * RAD + 1e-9;
  let best = null, bestD = -1, fallback = null;
  for (const deg of G.order) {
    const c = wrapAngle(deg * RAD);
    if (!allowed(c)) continue;
    if (fallback === null) fallback = c;
    if (angDist(c, G.arc.a) < margin - 1e-9) continue;
    let dmin = Infinity;
    for (const s of stuck) dmin = Math.min(dmin, angDist(c, s));
    if (dmin > bestD) { bestD = dmin; best = c; }
  }
  return best !== null ? best : fallback !== null ? fallback : 0;
}

function spawnGold(st, t) {
  const G = st.guard;
  if (G.gold) return;
  const theta = goldAngle(st);
  G.gold = { id: "gold", state: "in", theta, r: W.ring, born: t, p: 0, nudges: 0, prev: "in", r0: 0, nk: 0, back: false, x: 0, y: 0 };
  setPos(G.gold);
  emit(st, "goldIn", { angle: theta, t });
  fact(st, "egg.day", t);
  at(st, t, () => subgoal(st, "letIn", "egg.letIn"));
}

// Your sperm enters at tE (once per stage): the guard credit counts the rivals that came within 22 u before it and
// were settled by then; those still swimming in or burrowing are left out (6.2).
function settleEntry(st, tE) {
  const G = st.guard;
  if (!G.gold) spawnGold(st, tE);
  if (G.enterAt === null) G.enterAt = tE;
  const g = G.gold;
  g.state = "entered";
  g.r = SK.r;
  g.p = 1;
  setPos(g);
  let n = 0, sum = 0;
  for (const rv of G.rivals) {
    if (rv.near !== null && rv.near <= tE + 1e-9 && rv.settle !== null && rv.settle <= tE + 1e-9) { n++; sum += rv.credit; }
  }
  G.counted = n;
  G.credit = n ? sum / n : 0;
  st.parts.guard = SC.guard * G.credit;
  st.parts.clean = G.credit > 0 ? SC.clean * (1 - Math.min(GD.maxNudges, g.nudges) / GD.maxNudges) : 0;
  emit(st, "enter", { angle: g.theta, t: tE });
  const add = Math.round(st.parts.guard + st.parts.clean);
  if (add > 0) emit(st, "points", { part: "skill", add, t: tE });
  sfx(st, "egg.enter", tE, 1, 0.9);
  const clean = G.arc.live && g.nudges === 0;
  at(st, tE, () => {
    doneBy(st, "guard", G.credit > 0 ? "you" : "auto", G.credit > 0 ? "egg.guardDone" : "egg.guardAuto");
    doneBy(st, "letIn", clean ? "you" : "auto", clean ? "egg.letInDone" : "egg.letInAuto");
  });
}

// ---- the seal ----

function laySeal(st, t) {
  const c = [st.beats.next("mother", t + SL.afterS - 1e-9)];
  for (let k = 1; k < SL.autoBeat; k++) c.push(st.beats.next("mother", c[k - 1] + 1e-6));
  const target = { id: "seal", t: c[SL.targetBeat - 1], P: Math.max(0.5, PERIOD), kind: "release", heart: "mother", group: "seal" };
  st.seal = { prompt: t, c, track: createTrack([target], { assist: st.assist, lag: st.lag }), holding: false, pressAt: null,
    sealAt: null, grade: null, auto: false };
  if (Number.isFinite(st.freeUntil)) freeUntil(st.seal.track, st.freeUntil);
}

function judgedSeal(st, r, t) {
  emit(st, "judge", { target: r.target.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: r.target.heart, t });
}

function sealSeg(st, ps, rs, b) {
  const S_ = st.seal;
  const evs = [...ps.map((p) => ({ ...p, k: 0 })), ...rs.map((r) => ({ ...r, k: 1 }))].sort((x, y) => x.t - y.t || x.k - y.k);
  for (const e of evs) {
    if (S_.sealAt !== null) break;
    if (e.k === 0) {                                   // only a press made after the prompt counts (5.3)
      if (e.t >= S_.prompt - 1e-9) { S_.holding = true; S_.pressAt = e.t; }
      continue;
    }
    if (!S_.holding) continue;                         // a release with no such press is ignored
    S_.holding = false;
    const out = feed(S_.track, { presses: [], releases: [e] }, e.t);
    for (const r of out) judgedSeal(st, r, e.t);
    const hit = out.find((r) => r.grade === "in" || r.grade === "close");
    const res = S_.track.results[0];
    if (hit) sealNow(st, e.t, hit.grade, false);
    else if (res && res.grade === "miss") sealNow(st, e.t, "miss", false);
  }
  if (S_.sealAt === null) for (const r of feed(S_.track, EMPTY_INTENTS, b)) judgedSeal(st, r, b);
}

function sealNow(st, t, grade, auto) {
  const S_ = st.seal;
  if (S_.sealAt !== null) return;
  S_.sealAt = t;
  S_.grade = grade;
  S_.auto = !!auto;
  S_.holding = false;
  for (const r of feed(S_.track, EMPTY_INTENTS, t + 3600)) judgedSeal(st, r, t);
  st.parts.seal = grade === "in" ? SC.sealIn : grade === "close" ? SC.sealClose : 0;
  emit(st, "seal", { grade, auto: !!auto, t });
  if (st.parts.seal > 0) emit(st, "points", { part: "flourish", add: st.parts.seal, t });
  at(st, t, () => doneBy(st, "seal", auto ? "auto" : "you", auto ? "egg.sealAuto" : "egg.sealDone"));
}

// The wave has met on the far side: every other sperm, held or swimming, drifts off.
function driftAll(st) {
  st.drifted = true;
  for (const rv of st.guard.rivals) {
    if (rv.gone) continue;
    const h = rv.state === "bounce" || rv.state === "loose" ? Math.atan2(rv.vy, rv.vx) : rv.theta;
    rv.state = "off";
    rv.vx = SL.driftSpeed * Math.cos(h);
    rv.vy = SL.driftSpeed * Math.sin(h);
  }
}

// ---- the step ----

function runSeg(st, it, ps, rs, a, b) {
  due(st, b);
  switch (st.moment) {
    case "open": openSeg(st, ps, b); break;
    case "guard": guardSeg(st, it, a, b); break;
    case "seal": sealSeg(st, ps, rs, b); sim(st, b, false); break;
    case "enter": case "fusion": case "outro": sim(st, b, false); break;
    default: st.guard.simT = Math.max(st.guard.simT, b);
  }
  if (st.fusionAt !== null && !st.drifted && b >= st.fusionAt + SL.waveS - 1e-9) driftAll(st);
}

function stepBody(st, it, b) {
  const presses = times(it.presses), releases = times(it.releases);
  let a = st.t, pi = 0, ri = 0;
  for (let k = 0; k < 24 && !st.done; k++) {
    const end = endTime(st);
    const segEnd = Math.min(b, Math.max(a, end));
    const last = segEnd >= b - 1e-12;
    const ps = [], rs = [];
    while (pi < presses.length && (last || presses[pi].t < segEnd)) ps.push(presses[pi++]);
    while (ri < releases.length && (last || releases[ri].t < segEnd)) rs.push(releases[ri++]);
    runSeg(st, it, ps, rs, a, segEnd);
    const end2 = endTime(st);
    if (end2 <= segEnd + 1e-12) {                      // the moment ends inside this step: the next starts there
      const tx = Math.max(a, end2);
      advance(st, tx);
      a = tx;
      continue;
    }
    break;
  }
}

function forceEnd(st, t) {
  for (let k = 0; k < ORDER.length + 2 && !st.done; k++) advance(st, t);
  st.done = true;
}

export function step(st, intents) {
  if (!st || typeof st !== "object") return;
  const b = st.t + DT;
  if (st.done) { st.t = b; return; }
  try {
    stepBody(st, intents || EMPTY_INTENTS, b);
  } catch (e) {
    st.error = String((e && e.stack) || e);
    try { forceEnd(st, st.t); } catch (e2) { st.done = true; }
  }
  st.t = b;
  if (!st.done && st.t >= meta.capS - 1e-9) {
    st.capped = true;
    try { forceEnd(st, st.t); } catch (e) { st.error = st.error || String(e); st.done = true; }
  }
}

// ---- the interface ----

export function prompt(st) {
  if (!st || st.done) return { ...NONE };
  return promptOf(st.moment);
}

export function targets(st, horizonS) {
  if (!st || st.done) return [];
  const h = fin(horizonS) ? horizonS : 3;
  const out = [];
  const add = (tr) => {
    for (const x of upcoming(tr, st.t, h)) out.push({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group });
  };
  if (st.open.burstAt === null) add(st.open.track);
  if (st.seal && st.seal.sealAt === null) add(st.seal.track);
  return out.sort((x, y) => x.t - y.t);
}

// The arc's bot (6.2): the nearest rival that is not gold (the swimmer that reaches 22 u soonest within 1.5 s, else
// the stuck rival with the most burrow progress, else the next swimmer); targets in the gold zone are skipped, and
// the arc turns the way that does not cross the zone (from inside it, away from the gold first). It returns a unit
// steer at most 90° ahead of the arc, so the arc's short-way turn is the bot's chosen way. Angle error σ = 25° × (1 −
// skill) and a lag of 150 ms × (1 − skill) use only r.mem; at skill 1 the answer depends on the state alone.
export function botSteer(st, skill, r) {
  const still = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  if (!st || st.done || st.moment !== "guard" || st.guard.t0 === null) return still;
  const G = st.guard;
  const sk = clamp01(skill);
  const mem = r && r.mem && typeof r.mem === "object" ? r.mem : null;
  const a = G.arc.a;
  const g = G.gold && G.gold.state !== "entered" ? G.gold : null;
  const Z = G.half + BOT.zoneMarginDeg * RAD;
  const inZone = (x) => g !== null && angDist(x, g.theta) < Z;

  let soon = null, soonT = Infinity;
  for (const rv of G.rivals) {
    if (rv.gone || rv.state !== "in" || inZone(rv.theta)) continue;
    const tt = Math.max(0, (rv.r - A.reach) / rv.v);
    if (tt < soonT || (tt === soonT && soon && rv.r < soon.r)) { soon = rv; soonT = tt; }
  }
  let best = soon && soonT <= BOT.soonS ? soon : null;
  if (!best) {
    for (const rv of G.rivals) {
      if (rv.gone || rv.state !== "stuck" || inZone(rv.theta)) continue;
      if (!best || rv.p > best.p) best = rv;
    }
    if (!best) best = soon;
  }
  let id = best ? best.id : null, ang = best ? best.theta : null;

  if (mem && sk < 1) {
    const lag = BOT.lagS * (1 - sk);
    if (!("cur" in mem)) { mem.cur = id; mem.curAng = ang; mem.next = null; }
    if (id !== mem.cur) {
      if (!mem.next || mem.next.id !== id) mem.next = { id, ang, t: st.t };
      if (st.t - mem.next.t >= lag - 1e-12) { mem.cur = id; mem.curAng = ang; mem.next = null; }
    } else {
      mem.curAng = ang;
      mem.next = null;
    }
    id = mem.cur;
    ang = mem.curAng;
    const sigma = BOT.sigmaDeg * RAD * (1 - sk);
    if (id !== null && ang !== null && sigma > 0 && typeof r === "function") {
      if (mem.errFor !== id) { mem.errFor = id; mem.err = gauss(r) * sigma; }
      ang += mem.err;
    }
  }

  const way = BOT.wayDeg * RAD;
  let w;
  if (g && angDist(a, g.theta) < Z) {
    w = a + (wrapAngle(a - g.theta) >= 0 ? 1 : -1) * way;      // inside the zone: turn away from the gold first
  } else if (ang === null) {
    return still;
  } else {
    let bAng = ang;
    if (g && angDist(bAng, g.theta) < Z) bAng = g.theta + (wrapAngle(bAng - g.theta) >= 0 ? 1 : -1) * Z;
    let d;
    if (g) {                                         // the way round that stays out of the zone
      const base = g.theta + Z;
      const s = (x) => (((x - base) % TAU) + TAU) % TAU;
      d = s(bAng) - s(a);
    } else d = wrapAngle(bAng - a);
    w = Math.abs(d) <= way ? a + d : a + Math.sign(d) * way;
  }
  // a hair under unit length, so cos² + sin² rounding past 1 never makes the run rescale it
  return { steer: { x: UNIT * Math.cos(w), y: UNIT * Math.sin(w) }, dir: null, hold: false };
}

// The guard shape of 16.9, in world units and radians.
export function probe(st) {
  const G = st.guard;
  const g = G.gold;
  return {
    arc: { angle: G.arc.a, half: G.half, r: A.r, live: G.arc.live },
    egg: { x: 0, y: 0, r: SZ.cell, shell: SZ.shell },
    sperm: G.rivals.filter((rv) => !rv.gone).map((rv) => ({
      id: rv.id, state: rv.state === "off" ? "loose" : rv.state, angle: rv.theta, r: rv.r,
      progress: rv.state === "stuck" || rv.state === "held" ? rv.p : 0, x: rv.x, y: rv.y, wave: rv.wave,
    })),
    gold: g ? { state: g.state, angle: g.theta, r: g.r, nudges: g.nudges, progress: g.p, x: g.x, y: g.y } : null,
    entered: !!(g && g.state === "entered"),
  };
}

export function result(st) {
  const G = st.guard, S_ = st.seal;
  const done = !!st.done;
  const score = clampScore({ goal: done ? PARTS.goal : 0, skill: st.parts.open + st.parts.guard + st.parts.clean, flourish: st.parts.seal });
  return {
    done,
    goalMet: done,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "open", label: "egg.part.open", value: Math.round(st.parts.open), max: SC.open },
      { id: "guard", label: "egg.part.guard", value: Math.round(st.parts.guard), max: SC.guard },
      { id: "clean", label: "egg.part.clean", value: Math.round(st.parts.clean), max: SC.clean },
      { id: "seal", label: "egg.part.seal", value: score.flourish, max: SC.sealIn },
    ],
    metrics: {
      moment: st.moment, how: st.how, place: st.place, error: st.error,
      openAcc: st.open.acc, openTargets: st.open.presented, burst: st.open.by, burstAt: st.open.burstAt,
      guardCredit: G.credit === null ? 0 : G.credit, counted: G.counted, rivals: G.rivals.length,
      bounced: G.n.bounce, popped: G.n.loose, held: G.n.held, nudges: G.gold ? G.gold.nudges : 0,
      goldIn: G.goldAt !== null && G.t0 !== null ? G.goldAt - G.t0 : null,
      enterIn: G.enterAt !== null && G.t0 !== null ? G.enterAt - G.t0 : null,
      sealGrade: S_ ? S_.grade : null, sealAuto: S_ ? S_.auto : null, length: st.doneAt,
    },
    carryOut: {},
  };
}

// Fair resume (5.2): the open targets of the first 1.2 s after Resume are free. The opening's taps are left out of
// its accuracy; the seal's grade still sets its Flourish (it is no accuracy).
export function resume(st) {
  if (!st || st.done || !st.open) return 0;
  st.freeUntil = st.t + RESUME_FREE_S;
  let n = st.open.burstAt === null ? freeUntil(st.open.track, st.freeUntil) : 0;
  if (st.seal && st.seal.sealAt === null) n += freeUntil(st.seal.track, st.freeUntil);
  return n;
}

// Skip ahead to a named moment (tests and ?moment=): the moments between end now, by themselves.
export function jump(st, id) {
  const i = ORDER.indexOf(id);
  if (!st || i < 0 || st.done || i < st.mi) return false;
  try {
    for (let k = 0; k < ORDER.length && st.mi < i && !st.done; k++) advance(st, st.t);
  } catch (e) {
    st.error = String((e && e.stack) || e);
    return false;
  }
  return st.mi === i;
}

// ---- the draw list ----

function tailOf(x, y, ang, len, phase, hue, ring) {
  return { x, y, ang, len, phase: ((phase % 1) + 1) % 1, hue, ring };
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const t = st.t, span = TUNE.span, G = st.guard, S_ = st.seal, H = TUNE.hue, L = TUNE.light, R = TUNE.rings;
  const mm = mmPerShortAxis(meta, st.gaDay);
  d.camera = { x: 0, y: 0, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = { you: TUNE.you };
  const herPh = clamp01(st.beats.phase("mother", t));
  const pulse = Math.exp(-6 * herPh);
  const goldHue = fin(st.carry.sperm.hue) ? st.carry.sperm.hue : 0.11;
  const goldGlow = clamp01(st.carry.sperm.glow);
  const mi = st.mi;

  // light: the gold surge washes on beats 1 and 2, a flash at the burst, a little more light through fusion
  let level = L.level, tint = 0, surgeW = 0;
  for (let k = 0; k < O.surgeBeats; k++) {
    const dk = t - st.ob[k];
    if (dk >= 0 && dk < 0.8) surgeW = Math.max(surgeW, 1 - dk / 0.8);
  }
  tint = L.tintMax * surgeW;
  level += 0.12 * surgeW;
  if (st.open.burstAt !== null && t >= st.open.burstAt && t - st.open.burstAt < 0.6) level += 0.15 * (1 - (t - st.open.burstAt) / 0.6);
  if (st.fusionAt !== null) level += 0.08 * clamp01((t - st.fusionAt) / FU.s);
  d.light = { level, warm: L.warm, exposure: 1, white: 0, vignette: L.vignette, tint: Math.min(0.06, tint) };
  d.warp = L.warp;
  d.caustics = 0;

  // the follicle swells with each judged tap (a smaller swell on a miss), then slides away in the sweep
  let swell = 0;
  for (const f of st.open.fx) swell += (f.grade === "in" ? 1 : f.grade === "close" ? 0.7 : 0.35) * clamp01((t - f.t) / 0.3);
  const follR = SZ.follicle + SZ.followSwell * swell + (mi <= 1 ? 0.8 * pulse : 0);
  const splats = d.splats;
  if (mi <= 2) {
    const p = mi === 2 ? clamp01((t - st.mStart) / O.sweepS) : 0;
    const r = follR * (1 + 0.25 * p);
    splats.push({ k: "c", x: 0, y: -70 * p * p, r, m: 0.2, n: 0, v: 0, hue: H.follicle });
  }
  splats.push({ k: "c", x: 0, y: 0, r: SZ.shell, m: 0.6, n: 0, v: 0, hue: H.shell });
  splats.push({ k: "c", x: 0, y: 0, r: SZ.cell, m: 0.8, n: 0, v: 0, hue: H.cell });
  const g = G.gold;
  const e = g ? g.theta : Math.PI / 2;
  const ux = Math.cos(e), uy = Math.sin(e);
  if (st.fusionAt === null) {
    splats.push({ k: "c", x: 0, y: 0, r: SZ.inner, m: 0.9, n: 0.35, v: 0, hue: H.inner });
  } else {
    const ft = t - st.fusionAt;
    splats.push({ k: "c", x: 0, y: 0, r: SZ.inner, m: 0.9, n: 0, v: 0, hue: H.inner });
    // your sperm's contents come in (0 to 1.5 s), then the two nuclei draw close and touch (2.5 to 5 s)
    const pin = clamp01(ft / FU.inS), pclose = clamp01((ft - FU.beadS) / (FU.s - FU.beadS));
    const ease = (q) => q * q * (3 - 2 * q);
    const bR = 9 - 2 * ease(pin), bFinal = 2.5;
    const bAt = bR + (bFinal - bR) * ease(pclose);
    const aAt = -1 - 0.5 * ease(pclose);
    splats.push({ k: "c", x: aAt * ux, y: aAt * uy, r: 2, m: 1, n: 0, v: 0, hue: H.nucleus });
    splats.push({ k: "c", x: bAt * ux, y: bAt * uy, r: 1.6 + 0.4 * pin, m: 1, n: 0, v: 0, hue: goldHue });
    // it finishes its last division: a tiny bead buds at its rim (1.5 to 2.5 s)
    const pb = clamp01((ft - FU.inS) / (FU.beadS - FU.inS));
    if (pb > 0) {
      const ba = e + Math.PI / 2;
      splats.push({ k: "c", x: (SZ.cell + 0.6) * Math.cos(ba), y: (SZ.cell + 0.6) * Math.sin(ba), r: 0.2 + 1.2 * pb, m: 0.7, n: 0, v: 0, hue: H.cell });
    }
  }

  // the corona: a cloud of paper dots, darker along your sperm's path; held rivals rest in it as dim points
  const held = G.rivals.filter((rv) => !rv.gone && rv.state === "held");
  const N = SZ.coronaN, n = N + held.length;
  const xy = new Float32Array(2 * n), al = new Float32Array(n), id = new Float32Array(n);
  const breath = 1 + 0.02 * pulse;
  for (let i = 0; i < N; i++) {
    const r = st.corona[3 * i] * breath, th = st.corona[3 * i + 1];
    xy[2 * i] = r * Math.cos(th);
    xy[2 * i + 1] = r * Math.sin(th);
    al[i] = st.corona[3 * i + 2] * (g && angDist(th, g.theta) < GD.pathDeg * RAD ? 0.5 : 1);
    id[i] = i;                                          // a corona dot keeps its slot
  }
  // a held rival keeps its own key (10000 + its number) as others come and go from the list
  held.forEach((rv, j) => {
    xy[2 * (N + j)] = rv.x; xy[2 * (N + j) + 1] = rv.y; al[N + j] = 0.35;
    id[N + j] = 10000 + (Number(String(rv.id).slice(1)) || 0);
  });
  d.points = { n, xy, a: al, id, hue: H.corona };

  // strips, by priority (at most 6): the sperm, the guard arc, the seal wave, the ripples, the cilia
  const strips = [];
  const items = [];
  if (g && (g.state !== "entered" || mi === I_ENTER)) {
    let r = g.r, len = SZ.spermLen;
    if (g.state === "entered") {
      const q = clamp01((t - G.enterAt) / TUNE.enterS);
      r = SK.r - (SK.r - SZ.cell) * q;
      len = Math.max(1, SZ.spermLen * (1 - q));
    }
    items.push(tailOf(r * ux, r * uy, e + Math.PI, len, t * (2 + goldGlow), goldHue, "dashed"));
  }
  const rank = (rv) => (rv.state === "stuck" ? 0 : rv.state === "in" ? 1 : 2);
  const vis = G.rivals.filter((rv) => !rv.gone && rv.state !== "held").sort((x, y) => rank(x) - rank(y) || x.r - y.r);
  for (const rv of vis) {
    if (items.length >= 25) break;
    const k = Number(rv.id.slice(1)) * 0.618;
    const drifting = rv.state !== "in" && rv.state !== "stuck";
    const ang = drifting ? Math.atan2(rv.vy, rv.vx) : rv.theta + Math.PI;
    const len = SZ.spermLen * Math.max(0.1, clamp01((t - rv.born) / W.fadeS));
    items.push(tailOf(rv.x, rv.y, ang, len, t * (rv.state === "stuck" ? 4 : 2.5) + k, H.rival, null));
  }
  if (items.length) strips.push({ kind: "tails", items });
  if (mi >= I_GUARD && G.t0 !== null) {
    let glow = G.arc.live ? 1 : A.sleepGlow;
    if (G.enterAt !== null && mi > I_GUARD) glow *= 1 - clamp01((t - G.enterAt) / A.fadeS);
    if (glow > 0) strips.push({ kind: "arc", x: 0, y: 0, r: A.r, a0: G.arc.a - G.half, a1: G.arc.a + G.half, w: A.w, glow });
  }
  if (S_ && S_.sealAt !== null) {
    const phi = Math.PI * clamp01((t - S_.sealAt) / SL.waveS);
    const glow = 1 - 0.6 * clamp01((t - S_.sealAt - SL.waveS) / 2);
    strips.push({ kind: "arc", x: 0, y: 0, r: SZ.shell, a0: e - phi, a1: e + phi, w: 2.2, glow });
  }
  const rip = [{ x: 0, y: 0, r: 44, a: 0.18, dashed: false }, { x: 0, y: 0, r: 62, a: 0.12, dashed: false }];
  for (let k = 0; k < O.surgeBeats; k++) {
    const dk = t - st.ob[k];
    if (dk >= 0 && dk < 0.9) rip.push({ x: 0, y: 0, r: 70 - 44 * (dk / 0.9), a: 0.5 * (1 - dk / 0.9), dashed: false });
  }
  for (const f of st.open.fx) {
    const dk = t - f.t;
    if (dk >= 0 && dk < 0.5) rip.push({ x: 0, y: 0, r: follR + 8 * (dk / 0.5), a: 0.45 * (1 - dk / 0.5), dashed: f.grade === "close" });
  }
  if (st.open.burstAt !== null) {
    const dk = t - st.open.burstAt;
    if (dk >= 0 && dk < 0.8) rip.push({ x: 0, y: 0, r: 26 + 38 * (dk / 0.8), a: 0.6 * (1 - dk / 0.8), dashed: false });
  }
  for (const f of G.fx) {
    const dk = t - f.t;
    if (dk >= 0 && dk < BO.ringS) rip.push({ x: f.x, y: f.y, r: 1.5 + 3 * (dk / BO.ringS), a: 0.9 * (1 - dk / BO.ringS), dashed: false });
  }
  strips.push({ kind: "ripples", items: rip });
  rimSparks({ strips }, st.carry.sparks, 0, 0, SZ.shell + 1, { t, span });   // rim sparks (5.5): you are the egg
  if (mi >= 2) {
    const p = mi === 2 ? clamp01((t - st.mStart) / O.sweepS) : 1;
    const x = 70 - 16 * p, amp = mi === 2 ? 1 : 0.4;
    const ph = (t * (mi === 2 ? 2.4 : 1.2)) % 1;
    strips.push({ kind: "cilia", a: [-x, -150], b: [-x, 150], count: 18, phase: ph, amp });
    strips.push({ kind: "cilia", a: [x, -150], b: [x, 150], count: 18, phase: (ph + 0.5) % 1, amp });
  }
  d.strips = strips.slice(0, 6);

  // marks: the follicle's glow, the surge, the two small lights where your sperm meets your membrane, fusion
  const marks = d.marks;
  if (mi <= 1) marks.push({ kind: "glow", x: 0, y: 0, r: 34 + 2 * swell, on: 0.5 + 0.4 * pulse, pulse });
  if (surgeW > 0) marks.push({ kind: "glow", x: 0, y: 0, r: 60, on: surgeW });
  if (mi === I_ENTER && g) {
    const tx = -uy * 1.6, ty = ux * 1.6, rr = SZ.cell + 0.4;
    marks.push({ kind: "glow", x: rr * ux + tx, y: rr * uy + ty, r: 1.8, on: 1 });
    marks.push({ kind: "glow", x: rr * ux - tx, y: rr * uy - ty, r: 1.8, on: 1 });
  }
  if (st.fusionAt !== null) marks.push({ kind: "glow", x: 0, y: 0, r: 8, on: 0.5 + 0.5 * clamp01((t - st.fusionAt) / FU.s) });
  // your sperm's own glow: carry.sperm.glow (1 if it became ready in the race, else 0.5) sets how bright it is
  if (g && g.state !== "entered") marks.push({ kind: "glow", x: g.x, y: g.y, r: 5, on: 0.25 + 0.5 * goldGlow });

  // rings (DOM, at most 8): her beat, the approach of the next targets (up to 3, so each keeps its preview), the seal hold, the burrow rings
  const rings = d.rings;
  rings.push({ id: "mother", kind: "mother", x: 0, y: 0, r: R.mother, progress: herPh });
  const pv = previewS(PERIOD);
  for (const x of targets(st, pv).slice(0, 3)) {
    const p = clamp01(1 - (x.t - t) / pv);
    const r = x.group === "open" ? R.approachTo + (R.approachFrom - R.approachTo) * (1 - p) : SL.ringR + 14 * (1 - p);
    rings.push({ id: "t:" + x.id, kind: "approach", x: 0, y: 0, r, progress: p });
  }
  if (mi === I_SEAL && S_) {
    const tg = S_.track.targets[0];
    const hp = S_.holding ? clamp01((t - S_.pressAt) / Math.max(0.2, tg.t - S_.pressAt)) : 0;
    const res = S_.track.results[0];
    rings.push({ id: "hold", kind: "hold", x: 0, y: 0, r: SL.ringR, progress: hp, grade: res ? res.grade : null });
  }
  if (g && (g.state === "stuck" || (g.state === "nudge" && g.prev === "stuck"))) {
    rings.push({ id: "b:gold", kind: "burrow", x: g.x, y: g.y, r: R.burrow, progress: clamp01(g.p), dashed: true });
  }
  const stuck = G.rivals.filter((rv) => !rv.gone && rv.state === "stuck").sort((x, y) => y.p - x.p);
  for (const rv of stuck) {
    if (rings.length >= 8) break;
    rings.push({ id: "b:" + rv.id, kind: "burrow", x: rv.x, y: rv.y, r: R.burrow, progress: clamp01(rv.p), dotted: true });
  }

  d.anchor = { x: 0, y: 0 };
  if (st.done) d.cue = null;
  else if (st.moment === "open") d.cue = { x: 0, y: 0 };
  else if (st.moment === "guard") d.cue = { x: A.r * Math.cos(G.arc.a), y: A.r * Math.sin(G.arc.a) };
  else if (st.moment === "enter" || st.moment === "seal") d.cue = { x: SZ.shell * ux, y: SZ.shell * uy };
  else d.cue = null;
  return d;
}
