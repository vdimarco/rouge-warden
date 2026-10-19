// First Breath: stage 5, First Trimester (`grow`): "Grow with your heart." (design.md 6.5, 4.1, 5.1 to 5.4, 7, 16.4).
// One phrase of your own heart per week, weeks 7 to 13 (gaDay 49 to 97). In each phrase gold lights ride the cord
// from the placenta to your heart, one per target, and you tap as each one reaches you ("Tap when the light reaches
// your heart."). Targets fall on your beats, 2 beats apart in weeks 7 and 8, 2 or 3 in weeks 9 and 10 and 2 to 4 in
// weeks 11 to 13 (seeded); your heart's rate follows clock.bpmYou along the clock (130 bpm at week 7, 170 at weeks
// 9 and 10, about 155 at week 13). Between phrases, from week 8, a glow appears 40 u away and you drag toward it
// ("Drag to stretch."): the stick within 35 degrees (50 with Assist) at half deflection or more for 0.5 s plays
// the week's reflex move; at 3 s it plays by itself. Week 10 brings the word fetus (milestone fetus); from week 12
// the pools round your roots turn red with wavy rims and pulse with her heart. Nothing fails: a miss lets the light
// in dimly, and every move plays anyway. Pure: no DOM, no clocks, no storage; every draw is a seeded stream.
//
// How the clock and the beats fit together (contract choices inside 16.4 and 4.1):
// - Moments run in the 4.1 order. A beat moment lasts 16 of your beats at the week's mean rate (its meta lenS;
//   beat7 adds a 2 s lead first, with no target in it). A move moment lasts up to 3 s: a move you make plays for
//   0.8 s and then the moment ends ("jumps to the end when done"); at 3 s the move plays by itself and the moment
//   ends. So the stage runs about 54 s for the reference bot and about 62.5 s with no input (cap 90 s).
// - Your beats are laid with makeBeats from the plan of moments: a beat moment glides from bpmYou(from) to
//   bpmYou(to), a move moment holds bpmYou(from). A move's end is known 0.8 s before it at the latest (when you make
//   the move, or 2.2 s in); then the beats are laid again (the ones already past do not change) and the next
//   phrase's targets are laid, the first one at least 1.6 s later, so its light rides the full cord (5.2 preview).
// - Each target's light enters the cord 1.6 s before it, or earlier when the target two before it passes, so the
//   cord always carries the next two lights. Her beats are laid once, at 72 bpm from opts.motherPhase, no jitter.
// - The baby is drawn to the clock's scale: its NHS length in mm over mmPerShortAxis (10 mm at week 7 is a third
//   of the short axis; 7.4 cm at week 13 is about 60%). The placenta disc sits up and to the side you nestled on
//   (carry nestleX), and its villi are a small colonized tree grown once from carry treeSeed.
import { DT, gaAt, mmPerShortAxis, bpmYou } from "../clock.js";
import { makeBeats } from "../beat.js";
import { stream, gauss } from "../rng.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { CREDIT } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { createTrack, feed, upcoming, accuracy, streak, freeUntil, RESUME_FREE_S } from "../lib/track.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { figure } from "../lib/figure.js";
import { rimSparks } from "../lib/sparks.js";
import { createTree, growTree } from "../lib/colonize.js";
import { TUNE } from "./grow.tune.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const smooth = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// The mean of bpmYou over [g0, g1] (trapezoids at an eighth of a day; the curve is piecewise linear).
function meanBpm(g0, g1) {
  const n = 48;
  let s = 0;
  for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 0.5 : 1) * bpmYou(g0 + ((g1 - g0) * i) / n);
  return s / n;
}
const phraseS = (n) => (TUNE.phraseBeats * 60) / meanBpm(7 * n, 7 * n + 6);

// One 4.1 moment, plus what kind it is (kept beside meta, which holds only the 4.1 fields).
const mo = (id, from, to, lenS) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });
const MOMENTS = [], KIND = [];
for (let n = 7; n <= 13; n++) {
  MOMENTS.push(mo(`beat${n}`, 7 * n, 7 * n + 6, (n === 7 ? TUNE.leadS : 0) + phraseS(n)));
  KIND.push(Object.freeze({ beat: true, week: n }));
  if (n >= 8) {
    MOMENTS.push(mo(`move${n}`, 7 * n + 6, Math.min(7 * n + 7, 97), TUNE.moveS));
    KIND.push(Object.freeze({ beat: false, week: n }));
  }
}
const M = MOMENTS.length;
const IDS = MOMENTS.map((m) => m.id);
const BEATS_S = MOMENTS.filter((m, i) => KIND[i].beat).reduce((a, m) => a + m.lenS, 0);
const REF_MOVE_S = TUNE.bot.reactS + TUNE.move.holdS + TUNE.playS;

export const meta = Object.freeze({
  id: "grow", index: 4, name: "First Trimester", verb: "Grow",
  orient: "fit",
  families: Object.freeze(["tap", "steer"]),
  ga: Object.freeze({ start: 49, end: 97 }), fertilized: true,
  mm: Object.freeze({ start: 30, end: 150 }),
  motherBpm: TUNE.motherBpm,
  parS: Math.round(BEATS_S + 6 * REF_MOVE_S), capS: 90, canFail: false, scored: true,
  moments: Object.freeze(MOMENTS),
});

const END_S = meta.capS + 30;                   // beats are laid this far, for the sound past the stage's end
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const TAP = Object.freeze({ gesture: "tap", text: "grow.prompt.tap", keys: "steer" });
const DRAG = Object.freeze({ gesture: "drag", text: "grow.prompt.drag", keys: "steer" });
const NO_PRESS = Object.freeze({ presses: Object.freeze([]), releases: Object.freeze([]) });
const DIRS = Object.freeze({ up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] });

// Captions on the clock: [seconds into the moment, fact id]; each fact is shown at the gaDay its label names.
const CAPTIONS = Object.freeze({
  beat8: [[0, "grow.w8"], [3, "grow.arms"]],
  beat9: [[0, "grow.peak"]],
  beat10: [[0, "grow.fetus"]],
  beat11: [[0, "grow.w11"]],
  move11: [[0, "grow.w11kick"]],
  beat12: [[0, "grow.w12"], [3, "grow.flow"]],
  move12: [[0, "grow.never"]],
});
const MILESTONES = Object.freeze({ beat10: "fetus" });

// ---- the plan: when each moment starts and ends ----

const nominal = (i) => MOMENTS[i].lenS;

// Moment i starts at t; the moments after it follow on at their nominal lengths (moves at their full 3 s).
function planFrom(st, i, t) {
  st.starts[i] = t;
  st.ends[i] = t + nominal(i);
  for (let j = i + 1; j < M; j++) { st.starts[j] = st.ends[j - 1]; st.ends[j] = st.starts[j] + nominal(j); }
}

// Your heart along the plan; her heart at 72 bpm from motherPhase.
function segments(st) {
  const segs = [{ heart: "mother", from: 0, to: END_S, bpm: meta.motherBpm, jitter: 0, first: st.phase }];
  for (let i = 0; i < M; i++) {
    const s = st.starts[i], e = st.ends[i];
    if (!(e > s)) continue;
    const g = MOMENTS[i].ga;
    if (KIND[i].beat) segs.push({ heart: "you", from: s, to: e, gaFrom: g[0], gaTo: g[1], jitter: 0 });
    else segs.push({ heart: "you", from: s, to: e, bpm: bpmYou(g[0]), jitter: 0 });
  }
  segs.push({ heart: "you", from: st.ends[M - 1], to: Math.max(END_S, st.ends[M - 1] + 1), bpm: bpmYou(97), jitter: 0 });
  return segs;
}

const relayBeats = (st) => { st.beats = makeBeats(st.seed, segments(st)); };

// ---- targets ----

function lowerBound(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < t) lo = mid + 1; else hi = mid; }
  return lo;
}

function gapOf(st, week) {
  const [lo, hi] = TUNE.gaps[week] || [2, 2];
  return lo + Math.min(hi - lo, Math.floor(st.rGap() * (hi - lo + 1)));
}

// Add targets to the track, keeping every result so far.
function addTargets(st, list, keepOpen = true) {
  const res = new Map();
  const keep = [];
  st.track.targets.forEach((x, i) => {
    const r = st.track.results[i];
    if (r) res.set(x.id, r);
    if (r || keepOpen) keep.push(x);
  });
  const track = createTrack([...keep, ...list], { assist: st.assist, lag: st.lag });
  track.targets.forEach((x, i) => { if (res.has(x.id)) track.results[i] = res.get(x.id); });
  if (Number.isFinite(st.freeUntil)) freeUntil(track, st.freeUntil);   // laid inside a resume's 1.2 s: free too
  st.track = track;
}

// Lay phrase i's targets on your beats, from the first beat at or after notBefore, or (notBefore null) carrying on
// the pattern of the phrase before it with no move between (beat7 into beat8). `laid` is when they became known.
function layPhrase(st, i, notBefore, laid) {
  if (!KIND[i] || !KIND[i].beat) return;
  const B = st.beats.you;
  if (!B || !B.length) return;
  const s = st.starts[i], e = st.ends[i];
  const nextBeat = i + 1 < M && KIND[i + 1].beat;
  const limit = e - (nextBeat ? 0 : TUNE.tailS);
  let j = notBefore === null && st.nextIdx >= 0 ? st.nextIdx : lowerBound(B, Math.max(s, notBefore === null ? s : notBefore));
  while (j < B.length && B[j] < s - 1e-9) j++;
  const out = [];
  let k = 0;
  while (j < B.length && B[j] < limit - 1e-9) {
    const t = B[j];
    const P = Math.max(0.5, Number.isFinite(st.lastT) ? t - st.lastT : 60 / st.beats.bpm("you", t));
    const n = st.prevTs.length;
    const two = n >= 2 ? st.prevTs[n - 2] : -Infinity;
    const enter = Math.max(laid, Math.min(t - TUNE.lightS, two));
    out.push({ id: `${MOMENTS[i].id}.${st.gen}.${k++}`, t, P, kind: "tap", heart: "you", group: MOMENTS[i].id, laid, enter });
    st.lastT = t;
    st.prevTs.push(t);
    j += gapOf(st, KIND[i].week);
  }
  st.nextIdx = j;
  if (out.length) addTargets(st, out);
}

// A move's end is now fixed: plan the moments after it, lay the beats again and the next phrase's targets.
function finalize(st, i, end, known) {
  if (st.final[i]) return;
  st.final[i] = true;
  st.ends[i] = end;
  if (i + 1 < M) planFrom(st, i + 1, end);
  relayBeats(st);
  if (i + 1 < M) layPhrase(st, i + 1, known + TUNE.lightS, known);
}

// ---- events ----

function judged(st, r, tStep) {
  const x = r.target;
  const at = Number.isFinite(r.errMs) ? x.t + r.errMs / 1000 : tStep;
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: "you", t: at });
  st.lastJudge = { grade: r.grade, t: at, x: x.t };
  const c = CREDIT[r.grade] || 0;
  if (c > 0) {
    const add = Math.floor((TUNE.score.heart * c) / TUNE.tickTargets);
    st.ticked += add;
    emit(st, "points", { part: "skill", add, t: at });
  }
  if (r.grade === "in") {
    const k = st.bells++ % TUNE.bell.length;
    emit(st, "sfx", { id: "bell", at: x.t, pitch: TUNE.bell[k], gain: 0.5, t: at });
  }
}

function caption(st, id) {
  emit(st, "fact", { id, where: "caption" });
  emit(st, "caption", { id, dir: null });
}

function enter(st, i) {
  st.mi = i;
  st.moment = IDS[i];
  st.gaDay = Math.max(st.gaDay, MOMENTS[i].ga[0]);
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", { ...(KIND[i].beat ? TAP : DRAG) });
  if (MILESTONES[st.moment]) emit(st, "milestone", { id: MILESTONES[st.moment] });
  for (const [after, id] of CAPTIONS[st.moment] || []) {
    if (after <= 0) caption(st, id);
    else st.capQ.push({ at: st.starts[i] + after, id });
  }
  if (!KIND[i].beat) subgoal(st, "move" + KIND[i].week, "grow.sub.move" + KIND[i].week);
}

function play(st, i, how, at) {
  const mv = st.moves[i];
  if (!mv || mv.played) return;
  mv.played = { how, t0: at };
  const w = KIND[i].week;
  doneBy(st, "move" + w, how, how === "you" ? "grow.sub.done" + w : "grow.sub.auto");
  emit(st, "sfx", { id: "move", at, pitch: 0, gain: how === "you" ? 0.6 : 0.4 });
  if (how === "you") {
    const add = TUNE.score.moves / 6;
    st.ticked += add;
    emit(st, "points", { part: "skill", add });
  }
  if (!st.final[i]) finalize(st, i, Math.min(at + TUNE.playS, st.starts[i] + TUNE.moveS), at);
}

// The scores so far (Goal only once done).
function parts(st) {
  const n = st.track.targets.length;
  const acc = n ? accuracy(st.track) : 0;
  const best = streak(st.track).best;
  let you = 0, auto = 0;
  for (const mv of Object.values(st.moves)) if (mv.played) { if (mv.played.how === "you") you++; else auto++; }
  const heart = Math.round(TUNE.score.heart * acc);
  const moves = Math.round((TUNE.score.moves * you) / 6);
  const flourish = Math.round(TUNE.score.flourish * Math.min(1, best / TUNE.score.streakFull));
  return { n, acc, best, you, auto, heart, moves, flourish };
}

function finish(st, how) {
  if (st.done) return;
  // a move shown and not yet made plays by itself; nothing new is laid now
  for (let i = 0; i < M; i++) {
    const mv = st.moves[i];
    if (!mv || mv.played || st.subgoals["move" + KIND[i].week] !== "shown") continue;
    mv.played = { how: "auto", t0: st.t };
    st.final[i] = true;
    doneBy(st, "move" + KIND[i].week, "auto", "grow.sub.auto");
  }
  for (const r of feed(st.track, NO_PRESS, st.t + 3600)) judged(st, r, st.t);
  st.done = true;
  st.how = how;
  st.gaDay = Math.max(st.gaDay, meta.ga.end);
  const p = parts(st);
  doneBy(st, "heart", p.n && p.acc >= TUNE.doneHeartK ? "you" : "auto", p.n && p.acc >= TUNE.doneHeartK ? "grow.sub.heartDone" : "grow.sub.heartAuto");
  const rest = p.heart + p.moves - st.ticked;
  if (rest > 0) emit(st, "points", { part: "skill", add: rest });
  emit(st, "points", { part: "goal", add: TUNE.score.goal });
  if (p.flourish > 0) emit(st, "points", { part: "flourish", add: p.flourish });
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

// A moment ends: gaDay jumps to its end (4.1), then the next moment, or the end of the stage.
function advance(st) {
  const i = st.mi;
  st.gaDay = Math.max(st.gaDay, MOMENTS[i].ga[1]);
  if (i >= M - 1) return finish(st, "end");
  enter(st, i + 1);
}

// The moment a time falls in: the current one, or one before it for a time before the current one began.
function momentAt(st, t) {
  let i = st.mi;
  while (i > 0 && t < st.starts[i] - 1e-9) i--;
  return i;
}

// ---- the Stage interface ----

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const carry = mergeCarry(carryIn, null);
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const s = seed >>> 0;
  const rMoves = stream(s, "moves");
  const side = rMoves() < 0.5 ? "left" : "right", other = side === "left" ? "right" : "left";
  const MOVES = { 8: ["up", "uncurl"], 9: [side, side === "left" ? "stretchL" : "stretchR"], 10: [other, "startle"],
    11: ["down", "kick"], 12: ["down", "kick"], 13: ["up", "thumb"] };

  // the placenta disc where you nestled, and its villi grown from your root tree's seed
  const V = TUNE.view, nx = carry.nestleX, sx = nx >= 0 ? 1 : -1;
  const pc = { x: sx * (V.placenta.x + V.placenta.xK * Math.abs(nx)), y: V.placenta.y, r: V.placenta.r };
  const toYou = Math.hypot(pc.x, pc.y) || 1;
  const attach = { x: pc.x - (0.85 * pc.r * pc.x) / toYou, y: pc.y - (0.85 * pc.r * pc.y) / toYou };
  const T = V.tree;
  const tree = createTree({ seed: carry.treeSeed === null ? s : carry.treeSeed, root: attach,
    region: { x: pc.x, y: pc.y, r: pc.r * 0.92 }, N: T.N, D: T.D, di: T.di, dk: T.dk, maxNodes: T.maxNodes, leafW: T.leafW });
  for (let i = 0, idle = 0; i < T.grow && idle < 3; i++) idle = growTree(tree) ? 0 : idle + 1;

  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.ga.start, fertilized: true,
    events: [], beats: null, subgoals: {}, moment: IDS[0],
    mi: 0, starts: [], ends: [], final: MOMENTS.map((m, i) => KIND[i].beat),
    phase, assist: !!o.assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry,
    track: createTrack([], { assist: !!o.assist, lag: o.lag }), gen: 0, lastT: -Infinity, nextIdx: -1, prevTs: [],
    rGap: stream(s, "gaps"),
    moves: {}, pc, attach, tree, side,
    capQ: [], lastJudge: null, ticked: 0, bells: 0,
    done: false, how: null,
  };
  for (let i = 0; i < M; i++) {
    if (KIND[i].beat) continue;
    const [dir, pose] = MOVES[KIND[i].week];
    st.moves[i] = { week: KIND[i].week, dir, pose, hold: 0, played: null };
  }
  planFrom(st, 0, 0);
  relayBeats(st);
  layPhrase(st, 0, TUNE.leadS, 0);
  layPhrase(st, 1, null, 0);
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", { ...TAP });
  subgoal(st, "heart", "grow.sub.heart");
  return st;
}

// Aim the stick at the glow: within the cone at half deflection or more adds up; anything else takes it back.
function aimStep(st, it, t1) {
  const i = st.mi, mv = st.moves[i];
  if (!mv) return;
  const start = st.starts[i];
  if (!mv.played) {
    const s = it.steer || EMPTY_INTENTS.steer;
    const m = Math.hypot(s.x || 0, s.y || 0);
    const [dx, dy] = DIRS[mv.dir];
    const cone = (st.assist ? TUNE.move.coneAssistDeg : TUNE.move.coneDeg) * D2R;
    const cos = m > 1e-9 ? (s.x * dx + s.y * dy) / m : -1;
    const aimed = m >= TUNE.move.minStick - 1e-9 && cos >= Math.cos(cone) - 1e-9;
    mv.hold = aimed ? mv.hold + DT : Math.max(0, mv.hold - DT);
    if (mv.hold >= TUNE.move.holdS - 1e-9) play(st, i, "you", t1);
    else if (t1 >= start + TUNE.moveS - 1e-9) play(st, i, "auto", start + TUNE.moveS);
  }
  if (!st.final[i] && t1 >= start + TUNE.moveS - TUNE.playS - 1e-9) finalize(st, i, start + TUNE.moveS, t1);
}

export function step(st, intents) {
  const it = intents || EMPTY_INTENTS;
  if (st.done) { st.t += DT; return; }
  const t1 = st.t + DT;
  const beat = KIND[st.mi].beat;
  // the live gesture: taps read presses only in a beat moment, the moment the press was made in (with a timing
  // offset a press reaches the page up to 150 ms after its time, 5.2, so after a move has begun); a move reads only
  // the stick
  const presses = (Array.isArray(it.presses) ? it.presses : []).filter((p) => p && KIND[momentAt(st, p.t)].beat);
  for (const r of feed(st.track, presses.length ? { presses, releases: [] } : NO_PRESS, t1)) judged(st, r, t1);
  if (!beat) aimStep(st, it, t1);
  st.t = t1;
  while (st.capQ.length && st.capQ[0].at <= st.t + 1e-9) caption(st, st.capQ.shift().id);
  while (!st.done && st.t >= st.ends[st.mi] - 1e-9) advance(st);
  if (st.done) return;
  st.gaDay = Math.max(st.gaDay, gaAt(MOMENTS[st.mi], st.t - st.starts[st.mi]));
  if (st.t >= meta.capS - 1e-9) finish(st, "cap");
}

// ---- the picture ----

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

// A swell on each of her beats (0 between beats, 1 on the beat).
const swell = (phase) => { const u = Math.max(0, 1 - phase / 0.35); return u * u; };

// The pose now: a move playing (blend in, hold, ease back; the thumb stays), a lean toward the glow while you aim,
// the fists opening and closing in week 11, else the curl.
function poseOf(st, mvNow) {
  const Mv = TUNE.move;
  let last = null;
  for (const mv of Object.values(st.moves)) if (mv.played && mv.played.t0 <= st.t + 1e-9 && (!last || mv.played.t0 >= last.played.t0)) last = mv;
  if (last) {
    const age = st.t - last.played.t0;
    let p;
    if (last.pose === "thumb" || age < Mv.rise) p = smooth(age / Mv.rise);
    else if (age < Mv.rise + Mv.hold) p = 1;
    else p = 1 - smooth((age - Mv.rise - Mv.hold) / Mv.fall);
    if (p > 0.001) return { name: last.pose, p };
  }
  if (mvNow && !mvNow.played && mvNow.hold > 0) return { name: mvNow.pose, p: 0.3 * clamp01(mvNow.hold / Mv.holdS) };
  if (st.gaDay >= 77 && st.gaDay < 84) return { name: "fist", p: 0.5 - 0.5 * Math.cos((TAU * st.t) / TUNE.fistS) };
  return "curl";
}

// The cord: a looping ribbon from the placenta to your belly, swaying a little.
function cordPts(st, root) {
  const a = st.attach, sx = st.pc.x >= 0 ? 1 : -1;
  const w = 1.5 * Math.sin(0.6 * st.t);
  const p1 = { x: a.x + sx * 14, y: a.y - 16 + w }, p2 = { x: root.x + sx * (22 + w), y: root.y - 16 };
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
  const V = TUNE.view, Mv = TUNE.move;
  const d = emptyDraw(meta.id);
  const g = st.gaDay, t = st.t;
  const mm = mmPerShortAxis(meta, g);
  d.camera = { x: 0, y: 0, span: V.span, rot: 0, orient: meta.orient, mmPerU: mm / V.span };
  d.scale = { mm: bar(mm) };
  const p = clamp01((g - meta.ga.start) / (meta.ga.end - meta.ga.start));
  d.light = { level: V.light.level0 + (V.light.level1 - V.light.level0) * p, warm: V.light.warm, exposure: 1, white: 0,
    vignette: V.light.vignette, tint: 0 };
  d.warp = V.warp;
  d.caustics = 0;

  // you: drawn to the clock's scale
  const S = (lengthMm(g) * V.span) / mm;
  const bx = 0, by = V.bob * Math.sin(TAU * V.bobHz * t);
  const heart = { x: bx + 0.02 * S, y: by - 0.02 * S }, root = { x: bx + 0.06 * S, y: by - 0.16 * S };
  const beat = !st.done && KIND[st.mi].beat;
  const mvNow = !st.done && !beat ? st.moves[st.mi] : null;
  const splats = figure(poseOf(st, mvNow), S, g, { x: bx, y: by, rot: 0 });
  const youPulse = swell(st.beats.phase("you", t));
  for (const s of splats) if (s.v === 1) s.r *= 1 + 0.3 * youPulse;
  d.splats = splats;

  // her heart: the placenta and its villi swell with it; from week 12 the pools turn red and pulse with it
  const her = swell(st.beats.phase("mother", t));
  const red = g >= 84;
  const pc = st.pc;
  d.strips.push({ kind: "tree", nodes: st.tree.view, version: st.tree.version, pulse: her });

  // the cord and its lights: each light rides from the placenta (0) to your belly (1), reaching you on its target
  const lights = [];
  const tg = st.track.targets;
  for (let i = 0; i < tg.length; i++) {
    const x = tg[i];
    if (x.enter <= t && t <= x.t && x.t > x.enter) lights.push(clamp01((t - x.enter) / (x.t - x.enter)));
  }
  d.strips.push({ kind: "cord", pts: cordPts(st, root), lights });

  const ripples = [];
  if (red) for (const [ox, oy, rr] of V.pools) ripples.push({ x: pc.x + ox * pc.r, y: pc.y + oy * pc.r, r: rr * pc.r * (1 + 0.12 * her) + V.layer, a: 0.55, dashed: false });
  const lj = st.lastJudge;
  if (lj && lj.grade === "in" && t - lj.t >= 0 && t - lj.t < 0.5) {
    const age = t - lj.t;
    ripples.push({ x: heart.x, y: heart.y, r: 4 + 14 * age, a: 0.7 * (1 - age / 0.5), dashed: false });
  }
  if (ripples.length) d.strips.push({ kind: "ripples", items: ripples });
  rimSparks(d, st.carry.sparks, bx, by, 0.55 * S, { t, span: V.span });       // rim sparks (5.5) round you

  // marks: the placenta disc, its pools, the move's glow and arrow, the light entering your heart
  d.marks.push({ kind: "lake", x: pc.x, y: pc.y, r: pc.r, rim: "solid", on: false, pulse: 0.3 * her });
  for (const [ox, oy, rr] of V.pools) {
    d.marks.push({ kind: "pool", x: pc.x + ox * pc.r, y: pc.y + oy * pc.r, r: rr * pc.r, rim: red ? "wavy" : "dotted", on: red, pulse: red ? her : 0 });
  }
  let cue = { x: heart.x, y: heart.y };
  const shownMove = mvNow;
  if (shownMove) {
    const [dx, dy] = DIRS[shownMove.dir];
    const gx = bx + dx * Mv.dist, gy = by + dy * Mv.dist;
    const age = shownMove.played ? t - shownMove.played.t0 : 0;
    const on = shownMove.played ? Math.max(0, 1 - age / 0.5) : 0.7 + 0.3 * clamp01(shownMove.hold / Mv.holdS);
    if (on > 0) d.marks.push({ kind: "glow", x: gx, y: gy, r: Mv.glowR, on });
    if (!shownMove.played) {
      const ax = bx + dx * Mv.arrowAt, ay = by + dy * Mv.arrowAt;
      d.marks.push({ kind: "arrow", x: ax, y: ay, r: Mv.arrowR, on: true, ang: Math.atan2(dy, dx) });
      cue = { x: ax, y: ay };
      d.rings.push({ id: "move", kind: "prompt", x: gx, y: gy, r: Mv.glowR + 2, progress: clamp01(shownMove.hold / Mv.holdS) });
    }
  }
  // the light that last reached your heart: bright when in time, dim on a miss
  let lastX = null, lastI = -1;
  for (let i = 0; i < tg.length; i++) { if (tg[i].t <= t) { lastX = tg[i]; lastI = i; } else break; }
  if (lastX && t - lastX.t < V.flashS) {
    const r = st.track.results[lastI];
    const k = r && r.grade === "in" ? 1 : r && r.grade === "close" ? 0.7 : 0.3;
    d.marks.push({ kind: "glow", x: heart.x, y: heart.y, r: 8, on: k * (1 - (t - lastX.t) / V.flashS) });
  }

  // rings: hers round the placenta, yours at your heart, one approach ring per light on the cord
  d.rings.unshift(
    { id: "mother", kind: "mother", x: pc.x, y: pc.y, r: pc.r + V.motherPad, progress: clamp01(st.beats.phase("mother", t)) },
    { id: "you", kind: "you", x: heart.x, y: heart.y, r: V.youR, progress: clamp01(st.beats.phase("you", t)), dashed: true,
      ...(lj && t - lj.t >= 0 && t - lj.t < V.gradeS ? { grade: lj.grade } : {}) },
  );
  let n = 0;
  for (let i = 0; i < tg.length && n < 3; i++) {
    const x = tg[i];
    if (st.track.results[i] || x.t < t || x.enter > t) continue;
    const q = clamp01((t - x.enter) / Math.max(1e-6, x.t - x.enter));
    d.rings.push({ id: "t:" + x.id, kind: "approach", x: heart.x, y: heart.y, r: V.youR + (V.approachR - V.youR) * (1 - q), progress: q });
    n++;
  }
  d.anchor = { x: bx, y: by };
  d.cue = cue;
  return d;
}

export function prompt(st) {
  if (st.done) return { ...NONE };
  return { ...(KIND[st.mi].beat ? TAP : DRAG) };
}

export function targets(st, horizonS) {
  if (st.done) return [];
  return upcoming(st.track, st.t, horizonS).map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group }));
}

// Point the stick at the move's glow (6.5), after a reaction time that grows as skill falls, with an aim error drawn
// once per move into r.mem. At skill 1 it uses no memory and no draws, so one-button mode is the same every call.
export function botSteer(st, skill, r) {
  const zero = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  if (!st || st.done || !KIND[st.mi] || KIND[st.mi].beat) return zero;
  const mv = st.moves[st.mi];
  if (!mv || mv.played) return zero;
  const s = clamp01(skill), B = TUNE.bot;
  if (st.t - st.starts[st.mi] < B.reactS + B.reactSlowS * (1 - s) - 1e-9) return zero;
  const [dx, dy] = DIRS[mv.dir];
  let ang = Math.atan2(dy, dx);
  if (s < 1 && typeof r === "function") {
    if (!r.mem || typeof r.mem !== "object") r.mem = {};
    const key = "grow:" + st.mi + ":" + st.starts[st.mi];
    if (!Number.isFinite(r.mem[key])) r.mem[key] = gauss(r) * B.aimErr * (1 - s);
    ang += r.mem[key];
  }
  const m = B.stick0 + B.stickK * s;
  const x = m * Math.cos(ang), y = m * Math.sin(ang);
  const dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : (y > 0 ? "up" : "down");
  return { steer: { x, y }, dir, hold: false };
}

export function probe(st) {
  return null;
}

export function result(st) {
  const p = parts(st);
  const goalMet = st.done;
  const score = clampScore({ goal: goalMet ? TUNE.score.goal : 0, skill: p.heart + p.moves, flourish: p.flourish });
  let inTime = 0, close = 0, miss = 0;
  for (const r of st.track.results) if (r) { if (r.grade === "in") inTime++; else if (r.grade === "close") close++; else if (r.grade === "miss") miss++; }
  return {
    done: st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "heart", label: "grow.part.heart", value: p.heart, max: TUNE.score.heart },
      { id: "moves", label: "grow.part.moves", value: p.moves, max: TUNE.score.moves },
      { id: "streak", label: "grow.part.streak", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: { targets: p.n, accuracy: p.acc, inTime, close, miss, streak: p.best, moves: 6, movesYou: p.you,
      movesAuto: p.auto, moment: st.moment, how: st.how, gaDay: st.gaDay },
    carryOut: {},
  };
}

// Fair resume (5.2): the open targets of the first 1.2 s after Resume are free, and so is any laid there later.
export function resume(st) {
  if (!st || st.done || !st.track) return 0;
  st.freeUntil = st.t + RESUME_FREE_S;
  return freeUntil(st.track, st.freeUntil);
}

// Skip to a named moment, starting now (for tests and the test hook): a move shown and not yet made plays by
// itself; judged targets stay, open ones go, and the targets from that moment on are laid afresh.
export function jump(st, id) {
  const i = IDS.indexOf(id);
  if (i < 0) return false;
  st.done = false;
  st.how = null;
  for (let j = 0; j < M; j++) {
    const mv = st.moves[j];
    if (mv && !mv.played && st.subgoals["move" + KIND[j].week] === "shown") play(st, j, "auto", st.t);
  }
  for (let j = 0; j < M; j++) {
    if (j < i) { if (!(st.starts[j] <= st.t)) st.starts[j] = st.t; st.ends[j] = Math.min(st.ends[j], st.t); st.final[j] = true; }
  }
  planFrom(st, i, st.t);
  for (let j = i; j < M; j++) st.final[j] = KIND[j].beat;
  for (let j = i; j < M; j++) if (st.moves[j]) { st.moves[j].played = null; st.moves[j].hold = 0; }
  st.capQ = [];
  relayBeats(st);
  st.gen++;
  addTargets(st, [], false);
  const kept = st.track.targets;
  st.lastT = kept.length ? kept[kept.length - 1].t : -Infinity;
  st.prevTs = kept.map((x) => x.t);
  st.nextIdx = -1;
  layPhrase(st, i, st.t + TUNE.lightS, st.t);
  if (i + 1 < M && KIND[i].beat && KIND[i + 1].beat) layPhrase(st, i + 1, null, st.t);
  enter(st, i);
  return true;
}
