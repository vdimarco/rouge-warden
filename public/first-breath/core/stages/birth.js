// First Breath: stage 8, Birth (`birth`, design.md 6.8): "Ride the waves." The v1 form: 8 waves with their warning
// rings, the four plain hold waves and the four drag-and-hold prompt waves (Tuck, Turn, Lift, Turn back) on screen
// axes, `turnDir` from the Turn wave setting the way of Turn back, rested gaps, the squeeze, and the light (the full-
// width bottom glow, exposure, white, the sound opening), then the `born` milestone. Every wave moves you 1/8 of the
// way by itself, and each move plays on its wave either way (a gentle miss: you only score less). Pure: no DOM, no
// clocks, no storage, no randomness (the bot's own stream drives botSteer). It follows the Stage interface of 16.4.
//
// The clock (stage seconds from `base`; numbers in birth.tune.js): wave k (k = 0..7) warns at 2.0 + 8 k, swells
// 3.0 + 8 k to 8.0 + 8 k, rests 3.0 s; the light runs 67.0 to 70.5 s; the cap is 80 s. Her rate glides 76 → 92 bpm
// over the waves (no jitter: a target track runs), then holds at 92; your heart beats at 130 bpm.
//
// Contract notes (gaps in design.md 16 and 6.8, handled here; see the builder's report):
// - Live gestures. 6.8 gives plain waves `hold` and prompt waves `dragHold` inside the one 4.1 moment `waves`, so the
//   gesture is constant per wave (from its warning to the next warning, rests included, so a late release is still
//   read), not per 4.1 moment. The lead-in uses wave 1's `hold`; `light` is `none`.
// - Targets. 6.8 scores overlap, not timing, but the run's judge needs timed targets: each wave lays a `press` at its
//   swell start and a `release` at its swell end (16 targets, P from 5.2's spacing rule). They give the rings their
//   grades and are not scored. A hold already down when the swell starts, pressed at or after its warning, is on time
//   for the press (judged "in" with errMs 0 and held: true once its Close window has passed with no other press), and
//   such an early press is not judged Off on the way.
// - Rested gaps. A rest is judged over its first 2.0 s, before the next warning, so a hold from the warning (6.8's
//   bot) still rests; and only after a wave you held, so an idle stage earns no rest points.
// - The squeeze has no draw-list field of its own: the stage sends it as `light.vignette` (0.15 at rest, 0.35 at a
//   swell's peak) and `warp` (the sway); the renderer presses its stage 8 side flats by that swell share (6% at the
//   peak, none in reduced motion). The opening is the `light` mark along the whole bottom edge.
// - Captions: a fact caption is a fact event { id, where: "caption" } (the ending's convention). Sub-goal lines
//   (done or auto) carry the miss line "Rest. Another wave will come." Points events tick the HUD during the waves
//   only; the Goal is never ticked, and the stage shows no score at its end (the run shows no overlay after Birth).
// - Sound: sfx { id, at, pitch, gain } "birth.warn", "birth.swell" (with dur, cutoffHz and rumbleHz), "birth.breath"
//   in each rest, and "birth.open" at the light (with fromHz, toHz and seconds).
import { DT, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { GRACE_S } from "../judge.js";
import { createTrack, feed, upcoming, accuracy, previewS } from "../lib/track.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { figure } from "../lib/figure.js";
import { TUNE as T } from "./birth.tune.js";

const mo = (id) => Object.freeze({ id, ga: Object.freeze([280, 280]), lenS: null });

export const meta = Object.freeze({
  id: "birth", index: 7, name: "Birth", verb: "Ride",
  orient: "fit",
  families: Object.freeze(["hold"]),
  ga: Object.freeze({ start: 280, end: 280 }), fertilized: true,
  mm: Object.freeze({ start: 700, end: 700 }),
  motherBpm: T.motherBpm[0], parS: T.parS, capS: T.capS, canFail: false, scored: true,
  moments: Object.freeze([mo("waves"), mo("light")]),
});

const EPS = 1e-9;
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const DIRS = Object.freeze(["up", "down", "left", "right"]);
const ANG = Object.freeze({ right: 0, up: Math.PI / 2, left: Math.PI, down: -Math.PI / 2 });
const STEER = Object.freeze({ right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: 1 }, down: { x: 0, y: -1 } });
const OPPOSITE = Object.freeze({ up: "down", down: "up", left: "right", right: "left" });
const DONE_TEXT = Object.freeze({ plain: "birth.rode", tuck: "birth.tucked", turn: "birth.turned", lift: "birth.lifted", back: "birth.turnedBack" });
const LIGHT_S = T.exposureS + T.whiteS + T.holdS;
const WAVES_END_S = T.leadS + T.periodS * (T.waves - 1) + T.warnS + T.swellS + T.restS;   // 67.0 s after base

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
const ease = (p) => { const x = clamp01(p); return x * x * (3 - 2 * x); };
const lerp = (a, b, p) => a + (b - a) * p;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const span = (a, b, lo, hi) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));

// ---- the waves ----

function makeWaves(base) {
  return T.plan.map((p, k) => {
    const warn = base + T.leadS + T.periodS * k;
    const s = warn + T.warnS, e = s + T.swellS;
    return {
      k, n: p.n, move: p.move, gesture: p.gesture, want: p.want, text: p.text,
      warn, s, e, judgeEnd: e + T.restJudgeS, restEnd: e + T.restS,
      heldS: 0, dirS: { up: 0, down: 0, left: 0, right: 0 }, restHeldS: 0,
      warned: false, swelled: false, ended: false, restDone: false,
      overlap: null, right: null, rested: null,
    };
  });
}

// The direction a prompt wave wants now: "side" is left or right; "back" is the other way from the Turn wave.
function wantOf(st, w) {
  if (w.want === "back") return st.turnDir === 1 ? "left" : "right";
  return w.want;
}
const matches = (st, w, dir) => !!dir && (w.want === "side" ? dir === "left" || dir === "right" : dir === wantOf(st, w));
function rightS(st, w) {
  if (!w.move) return 0;
  if (w.want === "side") return w.dirS.left + w.dirS.right;
  return w.dirS[wantOf(st, w)] || 0;
}
// The way you lean on the Turn wave: your sideways hold so far, else the carry's turnDir.
function lean(st) {
  const w = st.waves[3];
  if (w && !w.ended) {
    if (w.dirS.right > w.dirS.left) return 1;
    if (w.dirS.left > w.dirS.right) return -1;
  }
  return st.turnDir;
}

// Targets: a press at each swell start and a release at its end; P from the spacing rule (5.2).
function lay(st) {
  const out = [];
  let last = null;
  for (const w of st.waves) {
    const bpm = st.beats.bpm("mother", w.s);
    const p0 = last === null ? (fin(bpm) && bpm > 0 ? 60 / bpm : 0.5) : w.s - last;
    out.push({ id: `wave${w.n}.press.${st.gen}`, t: w.s, P: Math.max(0.5, p0), kind: "press", heart: "mother", group: "waves" });
    out.push({ id: `wave${w.n}.release.${st.gen}`, t: w.e, P: Math.max(0.5, w.e - w.s), kind: "release", heart: "mother", group: "waves" });
    last = w.e;
  }
  return out;
}

// (Re)start the waves at stage time `base`.
function init(st, base) {
  st.base = base;
  st.gen++;
  st.waves = makeWaves(base);
  st.wavesEnd = base + WAVES_END_S;
  st.lightAt = null;
  st.moment = "waves";
  st.capDone = T.captions.map(() => false);
  st.turnDir = st.turnIn;
  st.held = false;
  st.holdStart = null;
  st.dir = null;
  st.track = createTrack(lay(st), { assist: st.assist });
}

// ---- input and the judge ----

function sane(intents) {
  const it = intents && typeof intents === "object" ? intents : EMPTY_INTENTS;
  const times = (list) => (Array.isArray(list) ? list : [])
    .filter((e) => e && fin(e.t))
    .map((e) => ({ t: e.t, raw: fin(e.raw) ? e.raw : e.t }));
  return { presses: times(it.presses), releases: times(it.releases), dir: DIRS.includes(it.dir) ? it.dir : null };
}

function judged(st, r, tNow) {
  const x = r.target;
  const t = r.held || !fin(r.errMs) ? (r.held ? x.t : tNow) : x.t + r.errMs / 1000;
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart, t, ...(r.held ? { held: true } : {}) });
}

// An early press: inside an open press target's warning, before its Close window. It starts the hold now and is
// judged once the target's Close window has passed (resolveEarly), never as Off on the way.
function isEarly(st, tp) {
  const tr = st.track;
  for (let i = 0; i < tr.targets.length; i++) {
    const x = tr.targets[i];
    if (x.kind !== "press" || tr.results[i] !== null) continue;
    if (tp >= x.t - T.warnS - T.earlySlackS && tp < x.t - tr.wins[i].close) return true;
  }
  return false;
}

// An early hold resolves its press target as on time once the target's Close window and grace have passed, when the
// hold (started inside the warning) was still down then and no press of this step is judged against the target.
function resolveEarly(st, start, firstRelease, fed, t1) {
  const tr = st.track;
  for (let i = 0; i < tr.targets.length; i++) {
    const x = tr.targets[i];
    if (x.kind !== "press" || tr.results[i] !== null) continue;
    const dl = x.t + tr.wins[i].close + GRACE_S;
    if (!(t1 > dl) || !(firstRelease > dl)) continue;
    if (!(start >= x.t - T.warnS - T.earlySlackS && start < x.t)) continue;
    if (fed.presses.some((p) => p.t <= dl)) continue;
    tr.results[i] = { grade: "in", errMs: 0, rawMs: 0 };
    judged(st, { target: x, grade: "in", errMs: 0, rawMs: 0, held: true }, x.t);
  }
}

// Held time from a to b goes to each wave's swell (by direction) and rest window.
function account(st, a, b) {
  if (!(b > a)) return;
  for (const w of st.waves) {
    const ov = span(a, b, w.s, w.e);
    if (ov > 0) {
      w.heldS += ov;
      if (st.dir) w.dirS[st.dir] += ov;
    }
    const or = span(a, b, w.e, w.judgeEnd);
    if (or > 0) w.restHeldS += or;
  }
}

function readInput(st, it, t0, t1) {
  const evs = [];
  for (const p of it.presses) evs.push({ t: p.t, raw: p.raw, press: true });
  for (const p of it.releases) evs.push({ t: p.t, raw: p.raw, press: false });
  evs.sort((a, b) => a.t - b.t || (a.press === b.press ? 0 : a.press ? -1 : 1));
  if (st.held && it.dir) st.dir = it.dir;
  const heldAt0 = st.held, start0 = st.holdStart;
  const fed = { presses: [], releases: [] };
  let cur = t0, firstRelease = Infinity;
  for (const ev of evs) {
    const te = Math.max(cur, Math.min(t1, ev.t));
    if (st.held) account(st, cur, te);
    cur = te;
    if (ev.press) {
      if (!st.held) { st.held = true; st.holdStart = ev.t; st.dir = it.dir; }
      else if (it.dir) st.dir = it.dir;
      if (isEarly(st, ev.t)) continue;
      fed.presses.push({ t: ev.t, raw: ev.raw });
    } else {
      if (ev.t < firstRelease) firstRelease = ev.t;
      st.held = false;
      st.holdStart = null;
      st.dir = null;
      fed.releases.push({ t: ev.t, raw: ev.raw });
    }
  }
  if (st.held) account(st, cur, t1);
  if (heldAt0 && fin(start0)) resolveEarly(st, start0, firstRelease, fed, t1);
  for (const r of feed(st.track, fed, t1)) judged(st, r, t1);
}

// ---- the timeline ----

function points(st, part, add) {
  if (add > 0) emit(st, "points", { part, add: Math.round(add) });
}

function warnWave(st, w) {
  subgoal(st, "wave" + w.n, w.text);
  emit(st, "sfx", { id: "birth.warn", at: w.warn, pitch: 1 + 0.03 * w.k, gain: 0.6 });
}

function endWave(st, w) {
  if (w.ended && w.overlap !== null) return;
  w.ended = true;
  w.overlap = clamp01(w.heldS / T.swellS);
  if (w.move) w.right = clamp01(rightS(st, w) / T.swellS);
  if (w.move === "turn" && w.dirS.left !== w.dirS.right) st.turnDir = w.dirS.right > w.dirS.left ? 1 : -1;
  const measure = w.move ? w.right : w.overlap;
  const you = measure >= T.doneAt - EPS;
  const id = "wave" + w.n;
  if (st.subgoals[id] === "shown") doneBy(st, id, you ? "you" : "auto", you ? DONE_TEXT[w.move || "plain"] : w.move ? "birth.anyway" : "birth.again");
  points(st, "skill", (T.overlapPts / T.waves) * w.overlap + movePts(w));
  if (w.overlap >= T.smoothAt - EPS) points(st, "flourish", T.flourishPts / T.waves);
  emit(st, "sfx", { id: "birth.breath", at: w.e, pitch: 1, gain: 0.5 });
}

function endRest(st, w) {
  w.restDone = true;
  w.rested = w.heldS > 0 && (T.restJudgeS - w.restHeldS) / T.restJudgeS >= T.restOk - EPS;
  if (w.rested) points(st, "skill", T.restPts / T.waves);
}

function movePts(w) {
  if (!w.move || w.right === null) return 0;
  if (w.right >= T.moveFull - EPS) return T.movePts[0];
  if (w.right >= T.moveHalf - EPS) return T.movePts[1];
  return 0;
}

// Drop the open targets (after a jump into the light); the judged ones keep their grades.
function dropOpen(st) {
  const tr = st.track;
  const keep = [], res = new Map();
  tr.targets.forEach((x, i) => { if (tr.results[i] !== null) { keep.push(x); res.set(x.id, tr.results[i]); } });
  if (keep.length === tr.targets.length) return;
  const next = createTrack(keep, { assist: st.assist });
  next.targets.forEach((x, i) => { next.results[i] = res.get(x.id); });
  st.track = next;
}

function startLight(st) {
  for (const w of st.waves) {
    if (w.warned && !w.ended) endWave(st, w);
    if (w.ended && !w.restDone) endRest(st, w);
  }
  dropOpen(st);
  st.moment = "light";
  st.lightAt = st.t;
  st.held = false;
  st.holdStart = null;
  st.dir = null;
  emit(st, "moment", { id: "light" });
  emit(st, "sfx", { id: "birth.open", at: st.t, pitch: 1, gain: 1, fromHz: T.filterHz, toHz: T.openHz, seconds: T.openS });
}

function captions(st) {
  T.captions.forEach((c, i) => {
    if (st.capDone[i]) return;
    const at = Number.isInteger(c.wave) ? st.waves[c.wave].s + c.after : st.base + c.at;
    if (st.t >= at - EPS) {
      st.capDone[i] = true;
      emit(st, "fact", { id: c.id, where: "caption" });
    }
  });
}

function timeline(st) {
  const t = st.t;
  if (st.moment === "waves") {
    for (const w of st.waves) {
      if (!w.warned && t >= w.warn - EPS) { w.warned = true; warnWave(st, w); }
      if (!w.swelled && t >= w.s - EPS) {
        w.swelled = true;
        emit(st, "sfx", { id: "birth.swell", at: w.s, pitch: 1, gain: 0.7 + 0.04 * w.k, dur: T.swellS, cutoffHz: T.filterHz,
          rumbleHz: T.rumbleHz.slice() });
      }
      if (!w.ended && t >= w.e - EPS) endWave(st, w);
      if (w.ended && !w.restDone && t >= w.judgeEnd - EPS) endRest(st, w);
    }
    captions(st);
    if (t >= st.wavesEnd - EPS) startLight(st);
  }
  if (st.moment === "light" && t >= st.lightAt + LIGHT_S - EPS) finish(st, "end");
}

function finish(st, how) {
  if (st.done) return;
  for (const r of feed(st.track, EMPTY_INTENTS, st.t + 3600)) judged(st, r, st.t);
  for (const w of st.waves) {
    if (w.warned && !w.ended) endWave(st, w);
    if (w.ended && !w.restDone) endRest(st, w);
  }
  for (const id of Object.keys(st.subgoals)) if (st.subgoals[id] === "shown") doneBy(st, id, "auto", "birth.anyway");
  st.done = true;
  st.how = how;
  st.held = false;
  emit(st, "milestone", { id: "born" });
  syncPrompt(st);
  emit(st, "done", {});
}

function syncPrompt(st, force = false) {
  const p = prompt(st);
  const q = st.lastPrompt;
  if (force || !q || q.gesture !== p.gesture || q.text !== p.text || q.keys !== p.keys) {
    st.lastPrompt = p;
    emit(st, "prompt", { gesture: p.gesture, text: p.text, keys: p.keys });
  }
}

// ---- the Stage interface ----

export function create(seed, carryIn, opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  const carry = mergeCarry(carryIn, null);
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const st = {
    id: meta.id, seed: seed >>> 0, t: 0, gaDay: meta.ga.start, fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: "waves",
    assist: !!o.assist, oneButton: !!o.oneButton, carry,
    turnIn: carry.turnDir === -1 ? -1 : 1, turnDir: 1,
    base: 0, gen: 0, waves: [], wavesEnd: 0, lightAt: null, capDone: [],
    held: false, holdStart: null, dir: null, track: null,
    done: false, how: null, lastPrompt: null,
  };
  st.beats = makeBeats(st.seed, [
    { heart: "mother", from: 0, to: WAVES_END_S, bpm: [T.motherBpm[0], T.motherBpm[1]], jitter: 0, first: phase },
    { heart: "mother", from: WAVES_END_S, to: meta.capS + 30, bpm: T.motherBpm[1], jitter: 0 },
    { heart: "you", from: 0, to: meta.capS + 30, gaFrom: T.youGa, jitter: 0 },
  ]);
  init(st, 0);
  emit(st, "moment", { id: "waves" });
  syncPrompt(st, true);
  return st;
}

export function step(st, intents) {
  if (!st || typeof st !== "object" || !Array.isArray(st.waves)) return;
  if (!Array.isArray(st.events)) st.events = [];
  if (st.done) { st.t += DT; return; }
  const it = sane(intents);
  const t0 = st.t, t1 = t0 + DT;
  if (st.moment === "waves") readInput(st, it, t0, t1);
  st.t = t1;
  timeline(st);
  if (!st.done && st.t >= meta.capS - EPS) finish(st, "cap");
  if (!st.done) syncPrompt(st);
}

export function prompt(st) {
  if (!st || st.done || st.moment !== "waves" || !Array.isArray(st.waves) || !st.waves.length) return { ...NONE };
  const t = st.t;
  let k = -1;
  for (let i = 0; i < st.waves.length; i++) if (t >= st.waves[i].warn - EPS) k = i;
  if (k < 0) return { gesture: st.waves[0].gesture, text: "birth.ride", keys: "steer" };
  const w = st.waves[k];
  if (t < w.e - EPS) return { gesture: w.gesture, text: w.text, keys: "steer" };
  const last = k === st.waves.length - 1;
  return { gesture: w.gesture, text: st.subgoals["wave" + w.n] === "done" || last ? "birth.rest" : "birth.again", keys: "steer" };
}

export function targets(st, horizonS) {
  if (!st || st.done || !st.track) return [];
  const h = fin(horizonS) ? horizonS : 0;
  return upcoming(st.track, st.t, h).map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group }));
}

// ---- the view ----

// The swell now: { w, p (0..1 through it), v (0 → 1 → 0) } or null.
function swellAt(st, t) {
  if (st.moment !== "waves") return null;
  for (const w of st.waves) if (t >= w.s && t < w.e) { const p = (t - w.s) / T.swellS; return { w, p, v: Math.sin(Math.PI * p) }; }
  return null;
}
const moveQ = (st, w, t) => (st.moment !== "waves" || t >= w.e ? 1 : t >= w.s ? ease((t - w.s) / T.swellS) : 0);
function progress(st, t) {
  if (st.moment !== "waves") return 1;
  let sum = 0;
  for (const w of st.waves) sum += moveQ(st, w, t);
  return sum / st.waves.length;
}

function lerpSplats(a, b, q) {
  if (!(q > 0) || a.length !== b.length) return q > 0 ? b : a;
  return a.map((s, i) => {
    const u = b[i];
    return { ...s, x: lerp(s.x, u.x, q), y: lerp(s.y, u.y, q), x2: lerp(s.x2, u.x2, q), y2: lerp(s.y2, u.y2, q), r: lerp(s.r, u.r, q) };
  });
}

// You: head down; Tuck blends into the tuck pose, Lift into the lift pose; Turn tips you toward your side and Turn
// back brings you round again. Each move plays on its wave whatever the input.
function you(st, t, swell, prog) {
  const [, w2, , w4, , w6, , w8] = st.waves;
  const tuck = moveQ(st, w2, t), turn = moveQ(st, w4, t), lift = moveQ(st, w6, t), back = moveQ(st, w8, t);
  const x = 0, y = lerp(T.figureY0, T.figureY1, prog);
  const size = T.figureU * (1 - T.squeezeFig * (swell ? swell.v : 0));
  const at = { x, y, rot: -lean(st) * T.turnRad * turn * (1 - back) };
  let a = "headDown", b = "headDown", q = 0;
  if (lift > 0) { a = "tuck"; b = "lift"; q = lift; } else if (tuck > 0) { a = "headDown"; b = "tuck"; q = tuck; }
  const splats = q > 0 ? lerpSplats(figure(a, size, T.youGa, at), figure(b, size, T.youGa, at), q) : figure(a, size, T.youGa, at);
  return { x, y, splats };
}

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

export function view(st) {
  const d = emptyDraw(meta.id);
  if (!st || !Array.isArray(st.waves) || !st.waves.length || !st.beats) return d;
  const t = st.t;
  const mm = mmPerShortAxis(meta, st.gaDay);
  d.camera = { x: 0, y: 0, span: T.span, rot: 0, orient: meta.orient, mmPerU: mm / T.span };
  d.scale = { mm: bar(mm) };

  const inLight = st.moment === "light" || (st.done && st.lightAt !== null);
  const lp = inLight && fin(st.lightAt) ? Math.max(0, t - st.lightAt) : 0;
  const swell = swellAt(st, t);
  const sv = swell ? swell.v : 0;
  const prog = progress(st, t);
  const me = you(st, t, swell, prog);
  d.splats = me.splats;

  // light, squeeze and sway
  const e = clamp01(lp / T.exposureS);
  d.light = {
    level: inLight ? lerp(T.level[1], 1, ease(e)) : lerp(T.level[0], T.level[1], prog),
    warm: 0.5,
    exposure: inLight ? 1 + 5 * e : 1,
    white: inLight ? clamp01((lp - T.exposureS) / T.whiteS) : 0,
    vignette: inLight ? T.vignetteRest * (1 - clamp01(lp)) : lerp(T.vignetteRest, T.vignettePeak, sv),
    tint: 0,
  };
  d.warp = inLight ? T.warpRest * (1 - clamp01(lp)) : lerp(T.warpRest, T.warpPeak, sv);
  d.caustics = 0;

  // the opening: a glow along the whole bottom edge that grows with each wave, then fills the screen
  const [r0, r1, rFull] = T.lightR;
  d.marks.push({
    kind: "light", x: 0, y: T.lightY,
    r: inLight ? lerp(r1, rFull, ease(e)) : lerp(r0, r1, prog),
    on: inLight ? 1 : lerp(T.lightOn0, 1, prog),
    pulse: inLight ? 0 : sv,
  });
  if (!inLight && st.held) d.marks.push({ kind: "glow", x: me.x, y: me.y, r: 26, on: 0.5 });

  // the rings: her heart and yours on you; the wave's approach, the hold through the swell, the rest after it
  const R = T.ringR;
  d.rings.push({ id: "mother", kind: "mother", x: me.x, y: me.y, r: R.mother, progress: clamp01(st.beats.phase("mother", t)) });
  if (st.beats.you && st.beats.you.length) {
    d.rings.push({ id: "you", kind: "you", x: me.x, y: me.y, r: R.you, progress: clamp01(st.beats.phase("you", t)), dashed: true });
  }
  let cue = inLight ? { x: 0, y: T.lightY } : { x: me.x, y: me.y };
  if (!inLight && !st.done) {
    const next = st.waves.find((w) => t < w.s);
    if (next) {
      const pre = Math.max(T.warnS, previewS(60 / st.beats.bpm("mother", next.s)));
      if (t >= next.s - pre) {
        const a = clamp01(1 - (next.s - t) / pre);
        d.rings.push({ id: "wave", kind: "wave", x: me.x, y: me.y, r: lerp(R.wave[0], R.wave[1], a), progress: a });
      }
    }
    if (swell) d.rings.push({ id: "hold", kind: "hold", x: me.x, y: me.y, r: R.hold, progress: clamp01(swell.p), dashed: !st.held });
    const rest = st.waves.find((w) => t >= w.e && t < (st.waves[w.k + 1] ? st.waves[w.k + 1].warn : st.wavesEnd));
    if (rest) {
      const end = st.waves[rest.k + 1] ? st.waves[rest.k + 1].warn : st.wavesEnd;
      d.rings.push({ id: "rest", kind: "rest", x: me.x, y: me.y, r: R.rest, progress: clamp01((t - rest.e) / (end - rest.e)) });
    }

    // the direction stickers on a prompt wave, from its warning to the end of its swell
    const pw = st.waves.find((w) => w.move && t >= w.warn && t < w.e);
    if (pw) {
      const dirs = pw.want === "side" ? ["left", "right"] : [wantOf(st, pw)];
      const sofar = clamp01(rightS(st, pw) / T.swellS);
      dirs.forEach((dir, i) => {
        const ax = me.x + T.arrowU * Math.cos(ANG[dir]), ay = me.y + T.arrowU * Math.sin(ANG[dir]);
        const on = st.held && st.dir === dir ? 1 : 0.6;
        d.marks.push({ kind: "arrow", x: ax, y: ay, r: 6, ang: ANG[dir], on });
        d.rings.push({ id: "prompt:" + dir, kind: "prompt", x: ax, y: ay, r: R.prompt, progress: sofar });
        if (i === 0) cue = { x: ax, y: ay };
      });
    }
  }

  // the pressure of a swell: soft rings closing on you
  if (swell) {
    const items = [];
    for (let i = 0; i < 3; i++) {
      const ph = (swell.p * 1.5 + i / 3) % 1;
      items.push({ x: me.x, y: me.y, r: 46 - 22 * ph, a: 0.22 * sv * (1 - ph), dashed: false });
    }
    d.strips.push({ kind: "ripples", items });
  }

  d.anchor = { x: me.x, y: me.y };
  d.cue = cue;
  return d;
}

// ---- the bot, probe, result and jump ----

// Hold from the warning; on a prompt wave drag the prompted way (Turn: the carry's side); let go in the rest. Below
// skill 1 the hold starts and ends a little late and a prompt wave is sometimes dragged the wrong way: three draws per
// wave from r, kept in r.mem with the wave they belong to.
export function botSteer(st, skill, r) {
  const none = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  if (!st || st.done || st.moment !== "waves" || !Array.isArray(st.waves)) return none;
  const s = clamp01(fin(skill) ? skill : 0);
  const t = st.t;
  const i = st.waves.findIndex((w) => t < w.e + T.bot.lagOutS);
  if (i < 0) return none;
  const w = st.waves[i];
  let lagIn = 0, lagOut = 0, wrong = false;
  if (typeof r === "function") {
    if (!r.mem || typeof r.mem !== "object") r.mem = {};
    const m = r.mem;
    if (m.wave !== i || m.gen !== st.gen) {
      m.wave = i;
      m.gen = st.gen;
      m.u = [r(), r(), r()];
    }
    lagIn = (1 - s) * T.bot.lagInS * m.u[0];
    lagOut = (1 - s) * T.bot.lagOutS * m.u[1];
    wrong = m.u[2] < T.bot.wrong * (1 - s);
  }
  const hold = t >= w.warn + lagIn && t < w.e + lagOut;
  let dir = null;
  if (w.move && t >= w.warn) {
    dir = w.want === "side" ? (st.turnDir === -1 ? "left" : "right") : wantOf(st, w);
    if (wrong) dir = w.want === "side" ? "down" : OPPOSITE[dir];
  }
  return { steer: dir ? { ...STEER[dir] } : { x: 0, y: 0 }, dir, hold };
}

export function probe(st) {
  return null;
}

export function result(st) {
  const ws = st && Array.isArray(st.waves) ? st.waves : [];
  const n = T.waves;
  let overlap = 0, moves = 0, rests = 0, smooth = 0;
  for (const w of ws) {
    if (!w.ended || w.overlap === null) continue;
    overlap += w.overlap;
    moves += movePts(w);
    if (w.overlap >= T.smoothAt - EPS) smooth++;
  }
  for (const w of ws) if (w.rested) rests++;
  const done = !!(st && st.done);
  const overlapPts = Math.round((T.overlapPts * overlap) / n);
  const restPts = Math.round((T.restPts * rests) / n);
  const score = clampScore({ goal: done ? PARTS.goal : 0, skill: overlapPts + moves + restPts, flourish: (T.flourishPts * smooth) / n });
  return {
    done,
    goalMet: done,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "overlap", label: "birth.part.overlap", value: overlapPts, max: T.overlapPts },
      { id: "moves", label: "birth.part.moves", value: moves, max: T.movePts[0] * 4 },
      { id: "rests", label: "birth.part.rests", value: restPts, max: T.restPts },
      { id: "flourish", label: "part.flourish", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: {
      waves: ws.map((w) => ({ n: w.n, move: w.move, overlap: w.overlap, right: w.right, rested: w.rested })),
      meanOverlap: overlap / n, moves, rests, smooth,
      turnDir: st ? st.turnDir : 1,
      accuracy: st && st.track ? accuracy(st.track) : 0,
      moment: st ? st.moment : null, how: st ? st.how : null,
    },
    carryOut: { turnDir: st && st.turnDir === -1 ? -1 : 1 },
  };
}

// jump("waves") starts the 8 waves again from now (a test hook: fresh waves, sub-goals and targets); jump("light")
// settles the waves so far and starts the light now.
export function jump(st, id) {
  if (!st || typeof st !== "object" || !Array.isArray(st.waves)) return false;
  if (id === "waves") {
    st.done = false;
    st.how = null;
    st.subgoals = {};
    init(st, st.t);
    emit(st, "moment", { id: "waves" });
    syncPrompt(st, true);
    return true;
  }
  if (id === "light") {
    st.done = false;
    st.how = null;
    startLight(st);
    syncPrompt(st, true);
    return true;
  }
  return false;
}
