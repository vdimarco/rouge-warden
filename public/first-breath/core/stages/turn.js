// First Breath: stage 7, Third Trimester (`turn`): "Turn and breathe." (design.md 6.7, 4.1, 5, 7, 16.4). The v1 form.
// Pure: no DOM, no clocks, no storage, no Math.random; every draw comes from seeded streams. step() never throws.
//
// 1. breathe (gaDay 196 → 231): 4 practice breaths of 8 of her beats (72 bpm); beat 1 is her first beat at or after
//    1.0 s. A breath ring grows over beats 1 to 4 and shrinks over 5 to 8 by itself. Targets: a press on beat 1 and a
//    release on beat 5 (8 targets, judged by core/lib/track.js). Live gesture: hold.
// 2. turn (231 → 252, up to 30 s): the stick's sideways offset turns you, 60°/s × stick x in a roomy moment (her
//    out-breath: the last 2.5 s of every 6.0 s, so the first comes 3.5 s in) and 15°/s outside one. Stick right turns
//    you clockwise as seen. Head-down = within 20° of straight down; the last degrees settle by themselves, and gaDay
//    jumps to 252. At 30 s you turn by yourself over 3 s (the shorter way). Live gesture: drag.
// 3. rest (259 → 280, 16 s, not scored): your song is hummed, muffled (a `song` event, noteS = the note period of
//    the ripples, 0.95 s); holding warms your heart ring a
//    little. Nothing is judged. Live gesture: hold (a fresh press: a hold still down from before does not count).
// 4. outro (280, 3 s): "You are ready." Live gesture: none.
//
// Score (7): Goal 3,000 (always met by the end); Skill 3,000 × breath accuracy + 3,000 × min(1, degrees turned in
// roomy moments / 180); Flourish 1,000 if you finish the turn yourself before the 30 s limit.
//
// Choices where 6.7 leaves room (noted for the contract owner):
// - "Degrees turned in roomy moments" counts progress toward head-down (|angle from head-up|) made while roomy, never
//   more than the progress you hold now, so turning back and forth earns nothing. When you reach head-down yourself in
//   a roomy moment, the last ≤ 20° that settle by themselves count as roomy too, so a turn made only in roomy moments
//   scores the full 180.
// - The turn moment lingers 1.2 s after you reach head-down (the figure settles), and ends as soon as the 3 s turn by
//   itself ends. The headDown milestone comes at head-down, either way, once.
// - Sub-goals: "breaths" (done by you at breath accuracy ≥ 0.5, else by itself) and "turn" (done by you at head-down,
//   by itself at the 30 s limit). The rest and the outro have no sub-goal: nothing there can be done or missed.
// - Captions: the fact captions of 6.7 in gaDay order, each once gaDay reaches it and 4.5 s after the last caption.
// - jump(state, id) moves only forward (or stays): the moments skipped settle by themselves (open breaths missed, the
//   turn done at once). An earlier moment returns false, so gaDay never goes back.
import { DT, gaAt, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS, makeIntents } from "../intent.js";
import { CREDIT } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { stream } from "../rng.js";
import { createTrack, feed, upcoming, accuracy, streak, freeUntil, RESUME_FREE_S } from "../lib/track.js";
import { subgoal, doneBy, wrapAngle } from "../lib/goals.js";
import { figure } from "../lib/figure.js";
import { rimSparks } from "../lib/sparks.js";
import { TUNE } from "./turn.tune.js";

const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "turn", index: 6, name: "Third Trimester", verb: "Turn",
  orient: "fit",
  families: Object.freeze(["hold", "rotate"]),
  ga: Object.freeze({ start: 196, end: 280 }), fertilized: true,
  mm: Object.freeze({ start: 600, end: 700 }),
  motherBpm: 72, parS: 60, capS: 100, canFail: false, scored: true,
  moments: Object.freeze([
    mo("breathe", 196, 231, (32 * 60) / 72),
    mo("turn", 231, 252, 30),
    mo("rest", 259, 280, 16),
    mo("outro", 280, 280),
  ]),
});

const IDS = meta.moments.map((m) => m.id);
const GESTURE = Object.freeze({ breathe: "hold", turn: "drag", rest: "hold", outro: "none" });
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const D2R = Math.PI / 180;
const HEAD_DOWN_GA = 252;
const EPS = 1e-9;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const smooth = (p) => { const x = clamp01(p); return x * x * (3 - 2 * x); };
const frac = (v) => v - Math.floor(v);

// ---- the clock of the turn: her slow breath, with a roomy moment at the end of each cycle ----

const roomyLen = (st) => (st.assist ? TUNE.turn.roomyAssistS : TUNE.turn.roomyS);

// Is the turn `el` seconds in a roomy moment? (the last roomyLen of each cycleS, from the turn's start)
function roomyAt(st, el) {
  if (!(el >= 0)) return false;
  const c = TUNE.turn.cycleS;
  const ph = el - c * Math.floor(el / c);
  return ph >= c - roomyLen(st) - EPS;
}

// The wall's glow, 0..1: it builds before a roomy moment, is full inside it and eases out after it.
function glowAt(st, el) {
  if (!(el >= 0)) return 0;
  const c = TUNE.turn.cycleS, ramp = TUNE.turn.glowRampS, a = c - roomyLen(st), edge = 0.3;
  const ph = el - c * Math.floor(el / c);
  if (ph >= a - EPS) {
    if (ph < a + edge) return 0.5 + 0.5 * clamp01((ph - a) / edge);
    if (ph > c - edge) return 1 - 0.5 * clamp01((ph - (c - edge)) / edge);
    return 1;
  }
  if (ph >= a - ramp) return 0.5 * clamp01((ph - (a - ramp)) / ramp);
  if (el >= c && ph < ramp) return 0.5 * (1 - ph / ramp);
  return 0;
}

// +1: the stick goes right (clockwise as seen) to turn the shorter way to head-down; −1: left.
function shortSign(ang) {
  return wrapAngle(ang) > EPS ? -1 : 1;
}

// The head-down angle the shorter way from `ang` (unwrapped, so the figure never spins through a full turn).
function headDownFrom(ang) {
  const w = wrapAngle(ang);
  return w > EPS ? ang + (Math.PI - w) : ang - (Math.PI + w);
}

// ---- the breath ring ----

// Where the stage is in the breaths: { j, p } with p 0..1 (0 on beat 1, 1 on beat 5, 0 again by the next beat 1).
function breathPhase(st, t) {
  const b = st.breath;
  if (!(t >= b.b1[0])) return { j: -1, p: 0 };
  for (let j = b.b1.length - 1; j >= 0; j--) {
    if (t >= b.b1[j]) {
      const end = j + 1 < b.b1.length ? b.b1[j + 1] : b.end;
      const mid = b.out[j];
      if (t < mid) return { j, p: (t - b.b1[j]) / (mid - b.b1[j]) };
      if (t < end) return { j, p: 1 - (t - mid) / (end - mid) };
      return { j, p: 0 };
    }
  }
  return { j: -1, p: 0 };
}

const ringR = (p) => TUNE.ring.r0 + (TUNE.ring.r1 - TUNE.ring.r0) * smooth(p);

// ---- create ----

function lowerBound(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < t) lo = mid + 1; else hi = mid; }
  return lo;
}

export function create(seed, carryIn, opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const carry = mergeCarry(carryIn, null);
  const s = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 0;
  const per = 60 / TUNE.motherBpm;
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;

  // her first beat at or after leadS, then 32 beats with no jitter (a target track runs); free time after that
  const n = TUNE.breaths * TUNE.beatsPerBreath;
  const b0 = phase >= TUNE.leadS ? phase : phase + Math.ceil((TUNE.leadS - phase) / per - EPS) * per;
  const trackEnd = b0 + n * per + per / 2;
  const v = TUNE.view;
  const beats = makeBeats(s, [
    { heart: "mother", from: 0, to: trackEnd, bpm: TUNE.motherBpm, jitter: 0, first: phase },
    { heart: "mother", from: trackEnd, to: meta.capS + 40, bpm: TUNE.motherBpm, jitter: 0.03 },
    { heart: "you", from: 0, to: 85, bpm: [v.youBpm[0], v.youBpm[1]], jitter: 0 },
    { heart: "you", from: 85, to: meta.capS + 40, bpm: v.youBpm[1], jitter: 0 },
  ]);
  const m = beats.mother;
  const i0 = lowerBound(m, TUNE.leadS - EPS);
  const at = (k) => (i0 + k < m.length ? m[i0 + k] : b0 + k * per);
  const b1 = [], out = [], targets = [];
  for (let j = 0; j < TUNE.breaths; j++) {
    const k = j * TUNE.beatsPerBreath;
    b1.push(at(k + TUNE.pressBeat - 1));
    out.push(at(k + TUNE.releaseBeat - 1));
  }
  let last = null;
  for (let j = 0; j < TUNE.breaths; j++) {
    targets.push({ id: "b" + (j + 1) + ".in", t: b1[j], P: Math.max(0.5, last === null ? per : b1[j] - last),
      kind: "press", heart: "mother", group: "breath" });
    targets.push({ id: "b" + (j + 1) + ".out", t: out[j], P: Math.max(0.5, out[j] - b1[j]),
      kind: "release", heart: "mother", group: "breath" });
    last = out[j];
  }

  // the placenta disc on the wall where you nestled; its lobes echo your root tree (treeSeed, else the stage seed)
  const nx = carry.nestleX;
  const th = Math.PI / 2 - 0.6 * nx;
  const disc = { x: v.discDist * Math.cos(th), y: v.discDist * Math.sin(th), r: v.discR, ang: th, lobes: [] };
  const rl = stream(carry.treeSeed === null ? s : carry.treeSeed, "turn:disc");
  for (let k = 0; k < 3; k++) {
    const a = th + Math.PI + (k - 1) * 0.9 + (rl() - 0.5) * 0.5;      // round the side of the disc that faces you
    const d = v.discR * (0.55 + 0.25 * rl());
    disc.lobes.push({ x: disc.x + d * Math.cos(a), y: disc.y + d * Math.sin(a), r: v.discR * (0.42 + 0.2 * rl()) });
  }
  // her voice comes from the wall on the side away from the disc
  const va = Math.PI / 2 + (nx >= 0 ? 1.0 : -1.0);
  const voice = { x: (v.wallR - 4) * Math.cos(va), y: (v.wallR - 4) * Math.sin(va) };

  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.moments[0].ga[0], fertilized: true,
    events: [], beats, subgoals: {}, moment: IDS[0],
    mi: 0, start: 0, assist: !!o.assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry,
    breath: { b1, out, end: at(n), per },
    track: createTrack(targets, { assist: !!o.assist, lag: o.lag }),
    held: false, flash: null, ripple: null,
    turn: { t0: null, phase: "wait", ang: 0, prog: 0, roomy: 0, wasRoomy: false, roomyN: 0, by: null, doneAt: null,
      to: null, auto: null, turnS: null, milestone: false },
    rest: { t0: null, warm: 0 },
    outroT0: null,
    caps: { next: 0, lastT: -Infinity, shown: [] },
    disc, voice,
    parts: { breaths: 0, turn: 0, flourish: 0 },
    done: false, how: null, faults: 0,
  };
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", promptOf(st.moment));
  subgoal(st, "breaths", "turn.goal.breaths");
  return st;
}

function promptOf(id) {
  return { gesture: GESTURE[id], text: "turn." + id, keys: "steer" };
}

// ---- events and scoring ----

function judged(st, r) {
  const x = r.target;
  const at = fin(r.errMs) ? x.t + r.errMs / 1000 : st.t;
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart, t: at });
  st.flash = { grade: r.grade, t: at, kind: x.kind };
  const c = CREDIT[r.grade] || 0;
  if (c > 0) {
    emit(st, "points", { part: "skill", add: Math.round((TUNE.score.breaths * c) / st.track.targets.length), t: at });
    if (r.grade === "in") st.ripple = { t: at, j: x.id };
  }
  st.parts.breaths = Math.round(TUNE.score.breaths * accuracy(st.track));
}

function settleBreaths(st) {
  for (const r of feed(st.track, EMPTY_INTENTS, Infinity)) judged(st, r);
  const you = accuracy(st.track) >= 0.5;
  doneBy(st, "breaths", you ? "you" : "auto", you ? "turn.goal.breathsDone" : "turn.goal.breathsAuto");
}

function turnPart(st) {
  return Math.round(TUNE.score.turn * Math.min(1, st.turn.roomy / (TUNE.turn.fullDeg * D2R)));
}

// You are head-down: `by` is "you" (the figure settles) or "auto" (the 3 s turn by itself has ended).
function headDown(st, by) {
  const T = st.turn;
  if (T.by) return;
  T.by = by;
  T.doneAt = st.t;
  T.turnS = st.t - T.t0;
  T.to = headDownFrom(T.ang);
  if (by === "you") {
    if (roomyAt(st, st.t - T.t0)) T.roomy += Math.PI - T.prog;      // the settle counts when it comes in a roomy moment
    T.phase = "settle";
    st.parts.flourish = T.turnS < TUNE.turn.maxS - EPS ? TUNE.score.flourish : 0;
    doneBy(st, "turn", "you", "turn.goal.turnDone");
  } else {
    T.ang = T.to;
    T.phase = "done";
  }
  T.prog = Math.PI;
  T.roomy = clamp(T.roomy, 0, Math.PI);
  st.parts.turn = turnPart(st);
  if (st.parts.turn > 0) emit(st, "points", { part: "skill", add: st.parts.turn });
  if (st.parts.flourish > 0) emit(st, "points", { part: "flourish", add: st.parts.flourish });
  if (st.moment === "turn") st.gaDay = Math.max(st.gaDay, HEAD_DOWN_GA);
  if (!T.milestone) { T.milestone = true; emit(st, "milestone", { id: "headDown" }); }
  emit(st, "sfx", { id: "headDown", at: st.t, pitch: 1, gain: 0.7 });
}

// The 3 s turn by itself starts (at the 30 s limit).
function startAuto(st) {
  const T = st.turn;
  if (T.phase !== "turning") return;
  T.phase = "auto";
  T.auto = { t0: st.t, from: T.ang, to: headDownFrom(T.ang) };
  doneBy(st, "turn", "auto", "turn.goal.turnAuto");
}

// The turn ends at once (a jump, or the cap): whatever is left settles.
function finishTurnNow(st) {
  const T = st.turn;
  if (T.phase === "wait") { T.t0 = st.t; subgoal(st, "turn", "turn.goal.turn"); T.phase = "turning"; }
  if (T.phase === "turning") startAuto(st);
  if (T.phase === "auto") headDown(st, "auto");
  if (T.phase === "settle") T.ang = T.to;
  T.phase = "done";
}

// ---- moments ----

function enter(st, i) {
  st.mi = i;
  st.moment = IDS[i];
  st.start = st.t;
  st.gaDay = Math.max(st.gaDay, meta.moments[i].ga[0]);
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", promptOf(st.moment));
  if (st.moment === "turn") {
    const T = st.turn;
    T.t0 = st.t;
    T.phase = "turning";
    subgoal(st, "turn", "turn.goal.turn");
  } else if (st.moment === "rest") {
    st.rest.t0 = st.t;
    st.held = false;                     // a hold needs a fresh press (5.3)
    const song = st.carry.song;
    // noteS: the note period, start to start, the same one the ripples are drawn on (sound.hum spaces notes by it)
    emit(st, "song", { notes: song.notes.slice(), lit: song.lit, at: st.t + TUNE.rest.noteLeadS, noteS: TUNE.rest.noteGapS,
      muffled: true });
    emit(st, "caption", { id: "turn.hum", dir: null });
    st.caps.lastT = st.t;
  } else if (st.moment === "outro") {
    st.outroT0 = st.t;
    st.held = false;
  }
}

// The current moment ends: settle what it leaves open, and gaDay jumps to its end (4.1).
function leave(st) {
  const id = st.moment;
  if (id === "breathe") settleBreaths(st);
  else if (id === "turn") finishTurnNow(st);
  st.gaDay = Math.max(st.gaDay, meta.moments[st.mi].ga[1]);
}

function momentOver(st) {
  const t = st.t + EPS;
  switch (st.moment) {
    case "breathe": return t >= st.breath.end;
    case "turn": {
      const T = st.turn;
      return T.phase === "done" || (T.phase === "settle" && t >= T.doneAt + TUNE.turn.holdS);
    }
    case "rest": return t >= st.rest.t0 + TUNE.rest.s;
    case "outro": return t >= st.outroT0 + TUNE.outroS;
    default: return true;
  }
}

function finish(st, how) {
  if (st.done) return;
  if (st.mi === 0) settleBreaths(st);
  if (st.turn.phase !== "done") finishTurnNow(st);
  st.gaDay = meta.ga.end;
  st.done = true;
  st.how = how;
  st.held = false;
  emit(st, "points", { part: "goal", add: PARTS.goal });
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

function captions(st) {
  const c = st.caps, list = TUNE.captions;
  if (c.next >= list.length) return;
  const [id, ga] = list[c.next];
  if (st.gaDay + EPS >= ga && st.t - c.lastT >= TUNE.captionGapS - EPS) {
    emit(st, "fact", { id, where: "caption" });
    c.lastT = st.t;
    c.shown.push(id);
    c.next++;
  }
}

// Presses and releases in time order: a press starts a hold, a release ends it.
function holds(st, it) {
  const evs = [];
  for (const p of Array.isArray(it.presses) ? it.presses : []) if (p && fin(p.t)) evs.push([p.t, 1]);
  for (const r of Array.isArray(it.releases) ? it.releases : []) if (r && fin(r.t)) evs.push([r.t, 0]);
  evs.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  for (const [, down] of evs) st.held = !!down;
}

function stickX(it) {
  const s = it && it.steer;
  return s && fin(s.x) ? clamp(s.x, -1, 1) : 0;
}

function turnStep(st, it, t0) {
  const T = st.turn, tt = TUNE.turn;
  if (T.phase === "turning") {
    const el = t0 - T.t0;
    const roomy = roomyAt(st, el);
    if (roomy && !T.wasRoomy) {
      T.roomyN++;
      emit(st, "sfx", { id: "roomy", at: t0, pitch: 1, gain: 0.5 });
      if (T.roomyN === 1) { emit(st, "caption", { id: "turn.roomy", dir: null }); st.caps.lastT = t0; }
    }
    T.wasRoomy = roomy;
    const sx = stickX(it);
    if (sx !== 0) {
      const degS = roomy ? tt.roomyDegS : st.assist ? tt.outsideAssistDegS : tt.outsideDegS;
      T.ang -= degS * D2R * sx * DT;                  // stick right: clockwise as seen (the world angle falls)
      const prog = Math.abs(wrapAngle(T.ang));
      if (roomy) T.roomy += prog - T.prog;
      T.prog = prog;
      T.roomy = clamp(T.roomy, 0, T.prog);            // never more than the progress you hold now
      if (T.prog >= Math.PI - tt.headDownDeg * D2R - EPS) headDown(st, "you");
    }
  } else if (T.phase === "settle") {
    const d = T.to - T.ang, max = tt.settleDegS * D2R * DT;
    T.ang += clamp(d, -max, max);
  } else if (T.phase === "auto") {
    const a = T.auto;
    T.ang = a.from + (a.to - a.from) * smooth((t0 + DT - a.t0) / tt.autoS);
  }
}

// ---- the Stage interface ----

export function step(st, intents) {
  if (!st || typeof st !== "object") return;
  if (st.done) { st.t += DT; return; }
  const t0 = fin(st.t) ? st.t : 0, t1 = t0 + DT;
  // a clean copy: finite times, lists that are lists, |steer| ≤ 1 (the shared judge trusts its input)
  const it = intents && typeof intents === "object" ? makeIntents(intents) : EMPTY_INTENTS;
  try {
    switch (st.moment) {
      case "breathe":
        holds(st, it);
        for (const r of feed(st.track, it, t1)) judged(st, r);
        break;
      case "turn":
        turnStep(st, it, t0);
        break;
      case "rest": {
        holds(st, it);
        const w = st.rest.warm;
        st.rest.warm = st.held ? Math.min(1, w + DT / TUNE.rest.warmUpS) : Math.max(0, w - DT / TUNE.rest.warmDownS);
        break;
      }
      default:
        break;
    }
    st.t = t1;

    // the turn's clock: the limit, and the end of the turn by itself
    const T = st.turn;
    if (st.moment === "turn") {
      if (T.phase === "turning" && st.t - T.t0 >= TUNE.turn.maxS - EPS) startAuto(st);
      if (T.phase === "auto" && st.t - T.auto.t0 >= TUNE.turn.autoS - EPS) { T.ang = T.auto.to; headDown(st, "auto"); }
    }

    while (!st.done && momentOver(st)) {
      leave(st);
      if (st.mi >= IDS.length - 1) finish(st, "end");
      else enter(st, st.mi + 1);
    }
    if (st.done) return;

    // gaDay follows the moment (4.1)
    const el = st.t - st.start;
    if (st.moment === "breathe") st.gaDay = gaAt({ ga: meta.moments[0].ga, lenS: st.breath.end - st.start }, el);
    else if (st.moment === "turn") st.gaDay = T.by ? HEAD_DOWN_GA : gaAt(meta.moments[1], el);
    else if (st.moment === "rest") st.gaDay = gaAt(meta.moments[2], el);
    else st.gaDay = meta.moments[3].ga[0];

    captions(st);
    if (st.t >= meta.capS - EPS) finish(st, "cap");
  } catch (e) {
    // never throw (16.4): count it, keep time moving, and end at the cap as usual
    st.faults = (st.faults || 0) + 1;
    if (!(st.t >= t1)) st.t = t1;
    if (st.t >= meta.capS - EPS && !st.done) { st.done = true; st.how = "cap"; emit(st, "done", {}); }
  }
}

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

// The figure's length head to bottom, in u, at this gaDay.
function sizeU(st, mm) {
  const [a, b] = TUNE.view.crMm;
  const cr = a + (b - a) * clamp01((st.gaDay - 196) / 84);
  return cr / (mm / TUNE.view.span);
}

function figureAngle(st) {
  return st.moment === "breathe" ? 0 : st.turn.ang;
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const v = TUNE.view, span = v.span;
  const mm = mmPerShortAxis(meta, st.gaDay);
  const t = st.t, T = st.turn;
  d.camera = { x: 0, y: 0, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = { mm: bar(mm) };

  const inTurn = st.moment === "turn" && T.phase === "turning";
  const glow = st.moment === "turn" && T.t0 !== null && T.phase !== "done" ? glowAt(st, t - T.t0) : 0;
  const bp = st.moment === "breathe" ? breathPhase(st, t) : { j: -1, p: 0 };
  const warm = st.rest.warm;
  let vignette = 0.45;
  if (st.moment === "breathe") vignette = 0.5 - 0.12 * smooth(bp.p);
  else if (st.moment === "turn") vignette = 0.6 - 0.3 * glow;
  else if (st.moment === "outro") vignette = 0.38;
  d.light = { level: clamp(0.82 + 0.08 * glow + 0.05 * warm, 0, 1), warm: clamp01(0.65 + 0.25 * warm), exposure: 1, white: 0,
    vignette: clamp01(vignette), tint: 0.03 };
  d.warp = 0.35;
  d.caustics = 1;

  // the placenta disc (behind you), then you
  const disc = st.disc;
  d.splats.push({ k: "c", x: disc.x, y: disc.y, r: disc.r, x2: disc.x, y2: disc.y, m: 0.8, n: 0, v: 0.35, hue: 0.0 });
  for (const l of disc.lobes) d.splats.push({ k: "c", x: l.x, y: l.y, r: l.r, x2: l.x, y2: l.y, m: 0.7, n: 0, v: 0.3, hue: 0.01 });
  const size = sizeU(st, mm) * (1 + 0.03 * smooth(bp.p));
  const ang = figureAngle(st);
  const fig = figure("curl", size, st.gaDay, { x: 0, y: 0, rot: ang });
  d.splats.push(...fig);
  const heart = fig.find((p) => p.v === 1) || { x: 0, y: 0 };
  const root = fig[fig.length - 1];

  // the cord: from the disc to your cord root, lights riding toward you
  const p0x = disc.x + (root.x - disc.x) * (disc.r * 0.6) / Math.max(1e-6, Math.hypot(root.x - disc.x, root.y - disc.y));
  const p0y = disc.y + (root.y - disc.y) * (disc.r * 0.6) / Math.max(1e-6, Math.hypot(root.x - disc.x, root.y - disc.y));
  const mx = (p0x + root.x) / 2, my = (p0y + root.y) / 2;
  const len = Math.max(1e-6, Math.hypot(root.x - p0x, root.y - p0y));
  const bow = 10 + 2 * Math.sin(0.7 * t);
  const cx = mx + (-(root.y - p0y) / len) * bow, cy = my + ((root.x - p0x) / len) * bow;
  const pts = [];
  for (let k = 0; k < 12; k++) {
    const u = k / 11, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    pts.push(a * p0x + b * cx + c * root.x, a * p0y + b * cy + c * root.y);
  }
  d.strips.push({ kind: "cord", pts, lights: [0, 1, 2].map((k) => frac(k / 3 + 0.22 * t)) });

  // marks: the amber light through the wall, the snug wall that glows (roomy), her voice patch in the rest
  d.marks.push({ kind: "glow", x: -32, y: 58, r: 46, on: 0.35, pulse: 0 });
  const wallOn = st.moment === "breathe" ? 0.25 + 0.2 * smooth(bp.p) : st.moment === "turn" ? 0.2 + 0.7 * glow : 0.3;
  for (let k = 0; k < 6; k++) {
    const a = (k * 60 + 30) * D2R;
    d.marks.push({ kind: "glowwall", x: v.wallR * Math.cos(a), y: v.wallR * Math.sin(a), r: 14, on: clamp01(wallOn), pulse: glow, ang: a });
  }
  let cue = null;
  if (st.moment === "turn" && T.phase !== "done") {
    d.marks.push({ kind: "glow", x: 0, y: 0, r: 44, on: glow, pulse: glow });      // the roomy moment: the brightest
    if (inTurn) {
      // the wall just ahead of your head the shorter way, and where your head goes
      const sgn = shortSign(T.ang);
      const ha = Math.PI / 2 + T.ang - sgn * 0.7;
      const ax = (v.wallR - 6) * Math.cos(ha), ay = (v.wallR - 6) * Math.sin(ha);
      d.marks.push({ kind: "glowwall", x: ax, y: ay, r: 12, on: clamp01(0.45 + 0.55 * glow), pulse: glow, ang: ha });
      d.marks.push({ kind: "spot", x: 0, y: -size * 0.62, r: 5, on: clamp01(0.4 + 0.6 * glow), pulse: glow });
      cue = { x: ax, y: ay };
      const a0 = Math.PI / 2, a1 = Math.PI / 2 + T.ang;
      d.strips.push({ kind: "arc", x: 0, y: 0, r: size * 0.62, a0: Math.min(a0, a1), a1: Math.max(a0, a1), w: 2.5, glow });
    }
  }
  if (st.moment === "rest" || st.moment === "outro") {
    const noteT = st.rest.t0 === null ? -1 : t - st.rest.t0 - TUNE.rest.noteLeadS;
    const k = noteT >= 0 ? Math.floor(noteT / TUNE.rest.noteGapS) : -1;
    const pulse = k >= 0 && k < 16 ? 1 - clamp01((noteT - k * TUNE.rest.noteGapS) / 0.6) : 0;
    d.marks.push({ kind: "glow", x: st.voice.x, y: st.voice.y, r: 10, on: clamp01(0.5 + 0.5 * pulse), pulse });
    const items = [];
    for (let q = Math.max(0, k - 2); q <= k && q < 16; q++) {
      const age = noteT - q * TUNE.rest.noteGapS;
      if (age < 0 || age > 2.2) continue;
      const lit = (st.carry.song.lit >> q) & 1;
      items.push({ x: st.voice.x, y: st.voice.y, r: 3 + 14 * age, a: clamp01((lit ? 0.6 : 0.4) * (1 - age / 2.2)), dashed: false });
    }
    if (items.length) d.strips.push({ kind: "ripples", items });
  }
  if (st.moment === "breathe" && st.ripple && t - st.ripple.t >= 0 && t - st.ripple.t < 0.8) {
    const age = t - st.ripple.t;
    d.strips.push({ kind: "ripples", items: [{ x: 0, y: 0, r: ringR(bp.p) + 4 + 14 * age, a: clamp01(0.5 * (1 - age / 0.8)), dashed: false }] });
  }
  rimSparks(d, st.carry.sparks, 0, 0, 0.55 * size, { t, span: v.span });       // rim sparks (5.5) round you

  // rings (DOM): her beat, your heart, then the breath ring and the next target, or the rest ring
  // her ring rounds you, just inside the breath ring (it stays off your body); yours sits on your heart
  d.rings.push({ id: "mother", kind: "mother", x: 0, y: 0, r: TUNE.ring.r0 - 6, progress: clamp01(st.beats.phase("mother", t)) });
  d.rings.push({ id: "you", kind: "you", x: heart.x, y: heart.y, r: 5 * (1 + 0.25 * warm), progress: clamp01(st.beats.phase("you", t)), dashed: true });
  if (st.moment === "breathe") {
    const rr = ringR(bp.p);
    const f = st.flash && t - st.flash.t >= 0 && t - st.flash.t < TUNE.ring.flashS ? st.flash : null;
    d.rings.push({ id: "breath", kind: "breath", x: 0, y: 0, r: rr, progress: clamp01(bp.p),
      grade: f && f.grade !== "off" ? f.grade : null });
    const next = upcoming(st.track, t, TUNE.ring.showS)[0];
    if (next) {
      const lead = clamp01((next.t - t) / TUNE.ring.showS);
      const r = next.kind === "press" ? TUNE.ring.r0 + (TUNE.ring.approachR - TUNE.ring.r0) * lead : TUNE.ring.r1;
      d.rings.push({ id: "t:" + next.id, kind: "approach", x: 0, y: 0, r, progress: clamp01(1 - lead) });
    }
    if (st.held) d.rings.push({ id: "held", kind: "hold", x: 0, y: 0, r: Math.max(1, rr - 3), progress: clamp01(bp.p) });
    if (f && f.grade === "off") d.rings.push({ id: "off", kind: "approach", x: 0, y: 0, r: rr + 5, progress: 0, dotted: true });
    cue = { x: rr, y: 0 };
  } else if (st.moment === "rest") {
    const rr = 22 + 4 * warm;
    d.rings.push({ id: "rest", kind: "rest", x: 0, y: 0, r: rr, progress: clamp01(warm) });
    if (st.held) d.rings.push({ id: "held", kind: "hold", x: 0, y: 0, r: rr - 3, progress: clamp01(warm) });
    cue = { x: rr, y: 0 };
  }

  d.anchor = { x: 0, y: 0 };
  d.cue = cue;
  return d;
}

export function prompt(st) {
  if (!st || st.done) return { ...NONE };
  return promptOf(st.moment);
}

export function targets(st, horizonS) {
  if (!st || st.done || st.moment !== "breathe") return [];
  const h = fin(horizonS) ? horizonS : 0;
  return upcoming(st.track, st.t, h).map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group }));
}

// Full stick toward the shorter way to head-down, only in roomy moments (6.7). Below skill 1 the bot comes into and
// out of each roomy moment late (a lag drawn once per cycle from r, kept in r.mem) and pushes the stick less far. In
// the rest it holds its thumb down. The breaths are timed targets: the shared bot plays those.
export function botSteer(st, skill, r) {
  const none = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  if (!st || st.done) return none;
  const s = clamp01(fin(skill) ? skill : 0);
  if (st.moment === "rest") return { ...none, hold: s > 0 };
  const T = st.turn;
  if (st.moment !== "turn" || T.phase !== "turning") return none;
  const el = st.t - T.t0;
  let lag = 0;
  if (s < 1) {
    const base = TUNE.bot.lagS * (1 - s);
    const mem = r && typeof r === "function" && r.mem && typeof r.mem === "object" ? r.mem : null;
    if (mem) {
      const k = Math.floor(el / TUNE.turn.cycleS);
      if (mem.k !== k) { mem.k = k; mem.lag = base * (0.5 + r()); }
      lag = fin(mem.lag) ? mem.lag : base;
    } else lag = base;
  }
  if (!roomyAt(st, el - lag)) return none;
  const sign = shortSign(T.ang);
  const m = s >= 1 ? 1 : TUNE.bot.minStick + (1 - TUNE.bot.minStick) * s;
  return { steer: { x: sign * m, y: 0 }, dir: sign > 0 ? "right" : "left", hold: false };
}

export function probe(st) {
  return null;
}

export function result(st) {
  const done = !!st.done;
  const acc = accuracy(st.track);
  const p = st.parts;
  const score = clampScore({ goal: done ? PARTS.goal : 0, skill: p.breaths + p.turn, flourish: p.flourish });
  return {
    done,
    goalMet: done,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "breaths", label: "turn.part.breaths", value: p.breaths, max: TUNE.score.breaths },
      { id: "turn", label: "turn.part.turn", value: p.turn, max: TUNE.score.turn },
      { id: "flourish", label: "turn.part.flourish", value: score.flourish, max: TUNE.score.flourish },
    ],
    metrics: {
      breathAccuracy: acc,
      breathTargets: st.track.targets.length,
      streak: streak(st.track).best,
      roomyDeg: st.turn.roomy / D2R,
      turnedBy: st.turn.by,
      turnS: st.turn.turnS,
      roomyMoments: st.turn.roomyN,
      moment: st.moment,
      how: st.how,
      faults: st.faults,
    },
    carryOut: {},
  };
}

// Fair resume (5.2): the open breath targets of the first 1.2 s after Resume are free (left out of accuracy).
export function resume(st) {
  if (!st || st.done || !st.track) return 0;
  const n = freeUntil(st.track, st.t + RESUME_FREE_S);
  if (n) st.parts.breaths = Math.round(TUNE.score.breaths * accuracy(st.track));
  return n;
}

export function jump(st, id) {
  const i = IDS.indexOf(id);
  if (!st || i < 0 || st.done || i < st.mi) return false;
  while (st.mi < i) {
    leave(st);
    enter(st, st.mi + 1);
  }
  return true;
}
