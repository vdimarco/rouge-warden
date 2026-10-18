// First Breath: stage 1, The Race (`swim`), design.md 6.1, behind the Stage interface of 16.4. You are one sperm cell
// in a pack of 20: ride the waves through the womb, squeeze through the gate, take the warm tube at the fork (the cool
// one loops back), swim up the tube against its current in the warm lane, rest on a glow wall to get ready, and reach
// the meeting place in the first three. Nobody is harmed: a bump only slows you, the cool loop only costs time.
//
// The race model is a port of qa/first-breath/race-sim.mjs (the wave-0 sim that checked the 6.1 numbers), with the
// same numbers (swim.tune.js) and the same readings of 6.1 (see that file's header, items 1 to 11). In short: the
// course is straight, world +y is progress along its centre line and world x is across it; the warm tube keeps the
// warm mouth's centre line (x = ±30) to the finish; the cool loop is its own 160 u track that counts as 1,300 u for the
// place and comes back in at the gate's cool edge; a wave's p is its front edge; every bot rides wave k when the
// wave's shared threshold < 0.3 + 0.7 skill. Steering goes through core/lib/steer.js (Reynolds 1999) and the tube's
// current profile through core/lib/flow.js.
//
// Stage choices where 6.1 and 16 leave a gap (noted for tasks.md):
// - The first `prompt` event goes out at t = 0 with gesture "drag" and no text, so the host can set the input live at
//   once (run.test checks a first prompt at the stage start); the text "Drag to swim." follows at 0.3 s and the stage
//   reads the stick from 0.5 s. One live gesture per moment: drag in womb, gate, fork and tube; none in meet, carried.
// - Moments never go back: a bump that pushes you behind 1,100 u leaves the moment at `gate`.
// - The cool loop is drawn as three quarters of a circle of radius 30 on its own side, then a straight back along
//   1,300 u to the gate; a sperm's loop distance maps onto it by share of its length.
// - Each sperm head is also sent as a splat (a plain disc), so the race reads with plain shapes; the tails strip
//   carries the 22 u bodies.
// - The `ready` sub-goal settles `auto` at the cap as "You get ready on the way." (6.1 gives only the `meet` line).
//   Your sperm's carried glow is 1 if it became ready on a glow or by the `meet` rest, else 0.5; the Skill's 1,000
//   for being ready counts only a glow.
// - Assist changes only your own current, lane width and bumps, and the rivals' catch-up (6.1); the rivals' rules
//   stay the same.
// - The tube's upstream and lane bonuses go to a sperm that swims (stick ≥ 0.25). The race sim gives them to any
//   sperm heading upstream, so a sperm that let go in the tube crept on at about 19 u/s and never drifted back to a
//   checkpoint as 6.1 says it does. Bots never steer below 0.42 in the tube, so their races are unchanged.
// Pure: no DOM, no clocks, no storage, no Math.random; every draw comes from stream(seed, name). step() never
// throws: a fault is caught, kept in state.fault, and the stage still ends by its cap.
import { DT, mmPerShortAxis } from "../clock.js";
import { stream, gauss } from "../rng.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { subgoal, doneBy, wrapAngle } from "../lib/goals.js";
import { steerBody } from "../lib/steer.js";
import { tubeFlow } from "../lib/flow.js";
import { TUNE } from "./swim.tune.js";

const T = TUNE;
const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "swim", index: 0, name: "The Race", verb: "Race",
  orient: "long",
  families: Object.freeze(["steer"]),
  ga: Object.freeze({ start: 14, end: 14 }), fertilized: false,
  mm: Object.freeze({ start: 0.3, end: 0.3 }),
  motherBpm: 72, parS: 52, capS: T.CAP_S, canFail: true, scored: true,
  moments: Object.freeze([
    mo("womb", 14, 14),
    mo("gate", 14, 14),
    mo("fork", 14, 14),
    mo("tube", 14, 14),
    mo("meet", 14, 14),
    mo("carried", 14, 14),
  ]),
});

const IDS = meta.moments.map((m) => m.id);
const MI = Object.fromEntries(IDS.map((id, i) => [id, i]));
const DEG = Math.PI / 180;
const ZERO = Object.freeze({ x: 0, y: 0 });
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(Number.isFinite(v) ? v : 0, 0, 1);
const lerp = (a, b, f) => a + (b - a) * f;
const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };
const OF = T.RACERS;

// ---------------------------------------------------------------- the course

// Half the passage width at progress p, before the split.
function halfAt(p) {
  if (p < T.WOMB_END) return T.WOMB_HALF;
  if (p < T.GATE_END) return lerp(T.WOMB_HALF, T.GATE_HALF, (p - T.WOMB_END) / (T.GATE_END - T.WOMB_END));
  if (p < T.FORK) return T.GATE_HALF;
  return lerp(T.GATE_HALF, T.MOUTH, clamp((p - T.FORK) / (T.SPLIT - T.FORK), 0, 1));
}
const laneAt = (t) => T.LANE_DRIFT * Math.sin(2 * Math.PI * T.LANE_HZ * t);      // lane centre from the tube centre
const glowSide = (i) => (i % 2 === 0 ? -1 : 1);                                   // the tube's left wall, right, left
const glowAt = (st, i) => ({ x: st.warm * T.TUBE_HALF + glowSide(i) * T.TUBE_HALF, y: T.GLOWS[i] });
const waveStart = (k) => T.WAVE_T0 + T.WAVE_GAP * k;
const waveFront = (k, t) => T.WAVE_FROM + T.WAVE_SPEED * (t - waveStart(k));
// the wave whose front passed p most recently (−1 for none yet)
const waveBehind = (t, p) => Math.floor((t - (p - T.WAVE_FROM) / T.WAVE_SPEED - T.WAVE_T0) / T.WAVE_GAP);
// the wave whose band holds p, or −1
function waveOver(t, p) {
  const k = waveBehind(t, p);
  return k >= 0 && waveFront(k, t) - T.WAVE_THICK <= p ? k : -1;
}
// the wave over p, else the next one to come from behind
function waveNear(t, p) {
  const k = waveOver(t, p);
  return k >= 0 ? k : Math.max(0, waveBehind(t, p) + 1);
}
function spanAt(y) {
  if (y < T.WOMB_END) return T.SPAN_WOMB;
  return lerp(T.SPAN_WOMB, T.SPAN_TUBE, smooth((y - T.WOMB_END) / (T.GATE_END - T.WOMB_END)));
}

// The cool loop as drawn: the cool mouth's centre line curls round on its own side (three quarters of a circle of
// radius LOOP_R about C), then runs back along 1,300 u to the gate's cool edge. A sperm's loop distance s (0..160)
// maps onto it by share of length; w is its offset across the loop (± 17).
function loopGeom(st) {
  const s = -st.warm;
  const cx = s * (T.TUBE_HALF + T.LOOP_R), cy = T.SPLIT;
  const arc = 1.5 * Math.PI * T.LOOP_R;
  const back = T.TUBE_HALF + T.LOOP_R - T.LOOP_BACK_X;
  return { s, cx, cy, arc, back, total: arc + back, th0: s > 0 ? Math.PI : 0 };
}
function loopPoint(st, loopS, loopW = 0) {
  const g = loopGeom(st);
  const d = clamp(loopS / T.LOOP_LEN, 0, 1) * g.total;
  const q = -g.s * loopW;
  if (d <= g.arc) {
    const th = g.th0 - g.s * (d / T.LOOP_R);
    const c = Math.cos(th), sn = Math.sin(th);
    return { x: g.cx + (T.LOOP_R + q) * c, y: g.cy + (T.LOOP_R + q) * sn, ang: Math.atan2(-g.s * c, g.s * sn) };
  }
  const e = d - g.arc;
  return { x: g.s * (T.TUBE_HALF + T.LOOP_R - e), y: T.FORK + g.s * loopW, ang: g.s > 0 ? Math.PI : 0 };
}

// ---------------------------------------------------------------- the field

function makeSperm(id, skill, slot, r) {
  const you = id === "you";
  return {
    id, you, skill, m: you ? null : T.M0 + T.M1 * skill, r,
    x: slot.x, p: slot.p, ang: Math.PI / 2, speed: 0, stick: ZERO, mag: 0, catchF: 1,
    zone: "path", loopS: 0, loopW: 0, lastCheck: -1e9, touch: false,
    attached: null, glow: -1, beatIx: 0, beats: 0, ready: false, readyAt: null, readyHow: null,
    bumpAt: -1e9, bumps: 0, rest: null, plan: null, loops: 0, out: false, lifted: false,
    arrived: false, arriveT: null, place: null, maxP: slot.p,
    waves: [], rideS: 0, laneS: 0, tubeS: 0, phase: 0,
  };
}

const progOf = (sp) => (sp.arrived ? T.TUBE_END : sp.zone === "loop" ? T.FORK : sp.p);
const swimming = (sp) => !sp.out && !sp.arrived && !sp.attached && (sp.mag >= T.SWIM_STICK || sp.speed >= T.SWIM_SPEED);
const thOf = (sp) => wrapAngle(Math.PI / 2 - sp.ang);          // heading from forward (+y), clockwise toward +x
const idOf = (sp) => (sp.you ? "you" : sp.id);

// ---------------------------------------------------------------- steering (botSteer, also the rivals' policy)

// Reynolds separation: a lateral shift away from the nearest swimming sperm within 12 u ahead.
function separation(st, sp) {
  let best = null, bd = T.SEP;
  for (const o of st.all) {
    if (o === sp || o.zone === "loop" || !swimming(o)) continue;
    const dp = o.p - sp.p;
    if (dp <= 0) continue;
    const d = Math.hypot(o.x - sp.x, dp);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return 0;
  const odd = sp.you ? false : sp.id & 1;
  const sgn = best.x === sp.x ? (odd ? 1 : -1) : Math.sign(sp.x - best.x);
  return sgn * (T.SEP - bd);
}

// The stick this step, before the lag. pick = { side: the mouth it takes (±1), wall: the glow it rests on, or −1 }.
// Sticks are world vectors: x across, y forward.
function aimNow(st, sp, skill, pick, mem) {
  const m = T.M0 + T.M1 * skill;
  if (sp.attached === "glow" && !sp.ready) return ZERO;
  if (sp.zone === "loop") return { x: 0, y: m };
  let tx, look, lim;
  if (sp.zone === "path" && sp.p < T.WOMB_END) {
    const k = waveNear(st.t, sp.p), c = st.cen[k] ?? 0, h = T.WAVE_HALF;
    if ((st.thr[k] ?? 1) < T.RIDE0 + T.RIDE1 * skill) tx = clamp(sp.x, c - h + T.RIDE_IN, c + h - T.RIDE_IN);
    else if (waveFront(k, st.t) >= sp.p - T.MISS_AHEAD) return ZERO;   // a wave it does not ride: let go as it passes
    else tx = sp.x;
    look = 40; lim = 40 * DEG;
  } else if (sp.zone === "path") {
    tx = pick.side * clamp(halfAt(sp.p + 30) - 8, 0, T.TUBE_HALF);
    look = 30; lim = 60 * DEG;
  } else {
    const xc = st.warm * T.TUBE_HALF;
    if (pick.wall >= 0 && !sp.ready && !mem.passed) {
      const gp = T.GLOWS[pick.wall];
      if (sp.p > gp + T.GLOW_R) mem.passed = true;
      else if (sp.p >= gp - T.GLOW_LOOK) {
        const dx = xc + glowSide(pick.wall) * T.TUBE_HALF - sp.x, dp = gp - sp.p;
        if (Math.hypot(dx, dp) <= T.LET_GO) return ZERO;
        const a = Math.atan2(dx, dp) + mem.noise;
        return { x: Math.sin(a) * m, y: Math.cos(a) * m };
      }
    }
    tx = xc + laneAt(st.t) + mem.aim;
    look = 40; lim = 20 * DEG;
  }
  tx += separation(st, sp);
  const a = clamp(Math.atan2(tx - sp.x, look), -lim, lim) + mem.noise;
  return { x: Math.sin(a) * m, y: Math.cos(a) * m };
}

const HALF_RAND = () => 0.5;

// Heading noise and aim error are drawn every 0.5 s from r; the lag is a queue in r.mem. Nothing else is kept.
function steerFor(st, sp, skill, r, pick) {
  const rr = typeof r === "function" ? r : HALF_RAND;
  const mem = r && typeof r.mem === "object" && r.mem !== null ? r.mem : {};
  if (mem.next === undefined) Object.assign(mem, { next: 0, noise: 0, aim: 0, q: [], passed: false });
  const t = st.t;
  if (t >= mem.next - 1e-9) {
    mem.next = t + T.NOISE_EVERY_S;
    mem.noise = gauss(rr) * T.NOISE_DEG * DEG * (1 - skill);
    mem.aim = gauss(rr) * T.AIM_SD * (1 - skill);
  }
  const out = t < T.START_S - 1e-9 ? ZERO : aimNow(st, sp, skill, pick, mem);
  const lag = T.LAG_S * (1 - skill);
  if (lag <= 1e-9) return out;
  mem.q.push({ t, out });
  while (mem.q.length > 1 && mem.q[1].t <= t - lag + 1e-9) mem.q.shift();
  return mem.q[0].t <= t - lag + 1e-9 ? mem.q[0].out : ZERO;
}

const wallFor = (skill) => (skill >= T.REST_1 ? 0 : skill >= T.REST_2 ? 1 : -1);

// The rival policy: botSteer at its skill, with the three rival choices of 6.1.
function rivalSteer(st, sp) {
  if (sp.plan === null && sp.p >= T.WOMB_END) sp.plan = sp.r() < T.COOL * (1 - sp.skill) ? "cool" : "warm";
  if (sp.rest !== null) {
    const f = Math.max(0, 1 - (st.t - sp.rest) / T.REST_SLOW_S);
    const dir = sp.x >= st.warm * T.TUBE_HALF ? 1 : -1;
    return { x: dir * 0.9 * sp.m * f, y: 0.44 * sp.m * f };
  }
  const side = sp.plan === "cool" && sp.loops === 0 ? -st.warm : st.warm;
  return steerFor(st, sp, sp.skill, sp.r, { side, wall: sp.id < T.FRONT ? 0 : -1 });
}

// ---------------------------------------------------------------- moving

function walls(st, sp) {
  const R = T.HEAD_R;
  let lo, hi;
  if (sp.zone === "tube") { lo = st.warm > 0 ? R : -2 * T.TUBE_HALF + R; hi = lo + 2 * T.TUBE_HALF - 2 * R; }
  else { hi = halfAt(sp.p) - R; lo = -hi; }
  let touch = false;
  if (sp.x < lo) { sp.x = lo; touch = true; } else if (sp.x > hi) { sp.x = hi; touch = true; }
  if (touch && !sp.touch) sp.speed *= T.WALL_KEEP;
  sp.touch = touch;
  if (sp.p < T.WAVE_FROM + R) sp.p = T.WAVE_FROM + R;
  if (sp.zone === "tube" && sp.p < sp.lastCheck) sp.p = sp.lastCheck;
}

function attach(st, sp, kind, glow = -1) {
  if (sp.rest !== null) kind = "rest";
  sp.attached = kind;
  sp.speed = 0;
  sp.glow = kind === "glow" ? glow : -1;
  if (kind === "glow") {
    const b = st.beats.mother;
    sp.beats = 0;
    sp.beatIx = 0;
    while (sp.beatIx < b.length && b[sp.beatIx] <= st.t + DT) sp.beatIx++;
  }
}

function move(st, sp) {
  const t = st.t, stick = sp.stick, mag = Math.min(1, Math.hypot(stick.x, stick.y));
  const mine = sp.you && st.assist;
  sp.mag = mag;
  if (sp.attached) {
    if (sp.attached !== "rest" && mag >= T.ATTACH_STICK) { sp.attached = null; sp.glow = -1; }
    else {
      // her beats while on a glow: ready on the 4th
      if (sp.attached === "glow") {
        const b = st.beats.mother;
        while (sp.beatIx < b.length && b[sp.beatIx] <= t + DT) {
          sp.beats++;
          if (sp.beats === T.READY_BEAT && !sp.ready) { sp.ready = true; sp.readyAt = b[sp.beatIx]; sp.readyHow = "glow"; }
          sp.beatIx++;
        }
      }
      return;
    }
  }
  const topMin = mine ? T.ASSIST_BUMP_TOP : T.BUMP_TOP;
  const top = topMin + (1 - topMin) * clamp((t - sp.bumpAt) / T.BUMP_EASE_S, 0, 1);
  const term = sp.catchF > 1 ? Math.min(1, mag * sp.catchF) : mag * sp.catchF;
  const mult = (mag > 1e-9 ? term / mag : 0) * (sp.ready ? T.READY_X : 1) * top;
  const s0 = sp.speed;
  steerBody(sp, stick, DT, { top: T.SWIM, accel: T.ACCEL, drag: T.DRAG, turn: T.TURN, mult });
  sp.ang = wrapAngle(sp.ang);
  const th = thOf(sp);
  if (sp.zone === "loop") {
    sp.loopS += (T.LOOP_FLOW + sp.speed) * DT;
    if (sp.loopS >= T.LOOP_LEN) {
      // back at the fork, coming in from the cool side, heading across toward the warm side
      sp.zone = "path";
      sp.p = T.FORK;
      sp.x = -st.warm * (T.GATE_HALF - T.HEAD_R);
      sp.ang = st.warm > 0 ? 0 : Math.PI;
      sp.touch = true;
      sp.loops++;
    }
    return;
  }
  // a wave lifts a sperm that swims with it
  let lifted = false;
  if (sp.zone === "path" && sp.p < T.WOMB_END && mag >= T.WAVE_STICK && Math.abs(th) <= T.WAVE_DEG * DEG) {
    const k = waveOver(t, sp.p);
    if (k >= 0 && Math.abs(sp.x - st.cen[k]) <= T.WAVE_HALF) {
      lifted = true;
      if (!sp.waves.includes(k)) sp.waves.push(k);
    }
  }
  sp.lifted = lifted;
  if (lifted) {
    const L = T.WAVE_SPEED * top;
    sp.speed = s0 < L ? Math.min(L, s0 + (T.WAVE_SPEED / T.WAVE_BLEND_S) * DT) : L;
    sp.rideS += DT;
  }
  let along = sp.speed, cur = 0;
  if (sp.zone === "tube" && sp.p >= T.TUBE_START) {
    const u = sp.x - st.warm * T.TUBE_HALF, rr = Math.min(1, Math.abs(u) / T.TUBE_HALF);
    const laneW = T.LANE_W * (mine ? T.ASSIST_LANE : 1);
    const lane = Math.abs(u - laneAt(t)) <= laneW / 2;
    cur = tubeFlow(rr, T.CURRENT) * (lane ? 0.5 : 1) * (mine ? T.ASSIST_CURRENT : 1);
    // the bonuses are for a sperm that swims (stick ≥ 0.25): one that lets go drifts back with the current
    const swims = mag >= T.SWIM_STICK;
    if (swims && Math.abs(th) <= T.UP_DEG * DEG) along += T.UP_BONUS;
    if (lane) { if (swims) along += T.LANE_BONUS; sp.laneS += DT; }
    sp.tubeS += DT;
  }
  const p0 = sp.p;
  sp.x += along * Math.sin(th) * DT;
  sp.p += (along * Math.cos(th) - cur) * DT;
  // the split: the side of the head picks the tube
  if (sp.zone === "path" && sp.p >= T.SPLIT) {
    if (sp.x * st.warm > 0) { sp.zone = "tube"; sp.lastCheck = T.SPLIT; }
    else {
      sp.zone = "loop";
      sp.loopS = sp.p - T.SPLIT;
      sp.loopW = clamp(sp.x + st.warm * T.TUBE_HALF, -(T.LOOP_HALF - T.HEAD_R), T.LOOP_HALF - T.HEAD_R);
      sp.p = T.FORK;
      return;
    }
  }
  if (sp.zone === "tube") {
    for (const c of T.CHECKS) if (sp.p >= c && c > sp.lastCheck) sp.lastCheck = c;
    if (sp.p < sp.lastCheck) { sp.p = sp.lastCheck; if (mag < T.ATTACH_STICK) attach(st, sp, "check"); }
  }
  walls(st, sp);
  if (sp.zone === "tube" && !sp.attached && mag < T.ATTACH_STICK) {
    for (let i = 0; i < T.GLOWS.length && !sp.attached; i++) {
      const g = glowAt(st, i);
      if (Math.hypot(sp.x - g.x, sp.p - g.y) < T.GLOW_R) attach(st, sp, "glow", i);
    }
  }
  if (sp.zone === "tube" && sp.p >= T.TUBE_END) {
    sp.arrived = true;
    sp.arriveT = t + DT * clamp((T.TUBE_END - p0) / Math.max(1e-9, sp.p - p0), 0, 1);
  }
  sp.maxP = Math.max(sp.maxP, sp.p);
}

// The drawn world point of a sperm (the loop is drawn round its curve).
function posOf(st, sp) {
  if (sp.you && st.carried && st.moment === "carried") return carriedPos(st);
  if (sp.you && st.meet) return meetPos(st);
  if (sp.zone === "loop") return loopPoint(st, sp.loopS, sp.loopW);
  return { x: sp.x, y: sp.p, ang: sp.ang };
}

// Soft bumps: circle against circle, pushed apart every step; the speed loss at most once per sperm per 0.4 s.
function bumps(st) {
  const D = 2 * T.HEAD_R, list = st.all.filter(swimming);
  const hit = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], L = a.zone === "loop";
      if (L !== (b.zone === "loop")) continue;
      let dx = L ? b.loopW - a.loopW : b.x - a.x, dp = L ? b.loopS - a.loopS : b.p - a.p;
      const d = Math.hypot(dx, dp);
      if (d >= D) continue;
      if (d < 1e-9) { dx = (a.you ? -1 : a.id) < (b.you ? -1 : b.id) ? 1 : -1; dp = 0; } else { dx /= d; dp /= d; }
      const push = (D - d) / 2;
      if (L) { a.loopW -= dx * push; a.loopS -= dp * push; b.loopW += dx * push; b.loopS += dp * push; }
      else { a.x -= dx * push; a.p -= dp * push; b.x += dx * push; b.p += dp * push; }
      let felt = false;
      for (const s of [a, b]) {
        if (!hit.includes(s)) hit.push(s);
        if (st.t - s.bumpAt >= T.BUMP_GAP_S - 1e-9) {
          s.speed *= s.you && st.assist ? T.ASSIST_BUMP_KEEP : T.BUMP_KEEP;
          s.bumpAt = st.t;
          s.bumps++;
          felt = true;
        }
      }
      if (felt) {
        const pa = posOf(st, a), pb = posOf(st, b);
        const x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2;
        emit(st, "bump", { a: idOf(a), b: idOf(b), x, y });
        st.contacts.push({ x, y, t: st.t, you: a.you || b.you });
        if (st.contacts.length > T.RINGS_MAX) st.contacts.shift();
      }
    }
  }
  for (const s of hit) {
    if (s.zone === "loop") s.loopW = clamp(s.loopW, -(T.LOOP_HALF - T.HEAD_R), T.LOOP_HALF - T.HEAD_R);
    else walls(st, s);
  }
}

// One step of the race at st.t: catch-up and resting, steering, moving, bumps. You take part while you race.
function raceStep(st) {
  const you = st.you, yp = progOf(you);
  const ahead = st.assist ? T.ASSIST_CATCH_AHEAD : T.CATCH_AHEAD, behind = st.assist ? T.ASSIST_CATCH_BEHIND : T.CATCH_BEHIND;
  for (const sp of st.rivals) {
    if (sp.arrived) continue;
    if (!st.racing) { sp.catchF = 1; continue; }
    const g = progOf(sp) - yp;
    sp.catchF = g > 0 ? 1 - ahead * clamp(g / T.CATCH_SPAN, 0, 1)
      : swimming(sp) ? 1 + behind * clamp(-g / T.CATCH_SPAN, 0, 1) : 1;
    if (sp.rest === null && !you.arrived && sp.zone === "tube" && -g >= T.REST_BEHIND) {
      sp.rest = st.t;
      if (!st.flags.othersRest) { st.flags.othersRest = true; say(st, "caption", "swim.othersRest"); }
    }
  }
  for (const sp of st.rivals) if (!sp.arrived) sp.stick = rivalSteer(st, sp);
  for (const sp of st.all) if (!sp.arrived && !sp.out) move(st, sp);
  bumps(st);
}

// ---------------------------------------------------------------- captions, sub-goals, points

// Queue a caption or fact once; `now` puts it at the front (a line about what you just did).
function say(st, kind, id, now = false) {
  if (st.said.includes(id)) return;
  st.said.push(id);
  if (now) st.queue.unshift({ kind, id }); else st.queue.push({ kind, id });
}
function flushSay(st) {
  if (!st.queue.length || !st.subgoals.goal || st.t - st.sayLast < T.SAY_GAP_S - 1e-9) return;
  const { kind, id } = st.queue.shift();
  emit(st, kind === "fact" ? "fact" : "caption", kind === "fact" ? { id } : { id, dir: null });
  st.sayLast = st.t;
}
function show(st, id, text) {
  if (subgoal(st, id, text)) st.sayLast = st.t;
}
function settle(st, id, how, text) {
  if (doneBy(st, id, how, text)) st.sayLast = st.t;
}
function pay(st, part, add) {
  const a = Math.round(add);
  if (!(a > 0)) return;
  st.paid[part] += a;
  emit(st, "points", { part, add: a });
}

// The score parts now (place by arrival, else by progress).
function parts(st) {
  const you = st.you;
  const place = st.finalPlace ?? st.placeNow;
  const lane = you.tubeS > 0 ? you.laneS / you.tubeS : 0;
  return {
    place,
    goal: st.goalMet ? PARTS.goal : 0,
    placePts: 2500 * (OF - place) / (OF - 1),
    wavePts: 1500 * Math.min(1, you.rideS / 5),
    lanePts: 1000 * clamp01(lane),
    readyPts: you.readyHow === "glow" ? 1000 : 0,
    first: you.arrived && place === 1 && st.goalMet ? 1000 : 0,
    lane,
  };
}
function scoreOf(st) {
  const p = parts(st);
  return clampScore({ goal: p.goal, skill: p.placePts + p.wavePts + p.lanePts + p.readyPts, flourish: p.first });
}

// ---------------------------------------------------------------- the moments

function promptOf(st) {
  if (st.done) return { ...NONE };
  if (st.moment === "meet") return { gesture: "none", text: "swim.meetLine", keys: "steer" };
  if (st.moment === "carried") return { gesture: "none", text: "swim.carried", keys: "steer" };
  return { gesture: "drag", text: st.t >= T.PROMPT_S - 1e-9 ? "swim.prompt" : null, keys: "steer" };
}
function syncPrompt(st) {
  const p = promptOf(st);
  if (!st.lastPrompt || st.lastPrompt.gesture !== p.gesture || st.lastPrompt.text !== p.text) {
    st.lastPrompt = p;
    emit(st, "prompt", { ...p });
  }
}
function enter(st, id) {
  st.mi = MI[id];
  st.moment = id;
  emit(st, "moment", { id });
  syncPrompt(st);
  if (id === "gate") say(st, "fact", "swim.few");
  if (id === "fork") { show(st, "warm", "swim.warmWay"); say(st, "fact", "swim.side"); }
  if (id === "tube") st.flags.tubeT = st.t;
}

// The moment your place on the course is in: it never goes back, and the cool loop is `fork` all the while.
function raceMoment(you) {
  if (you.zone === "loop") return MI.fork;
  if (you.zone === "tube" && you.p >= T.TUBE_START) return MI.tube;
  if (you.p >= T.FORK || you.zone === "tube") return MI.fork;
  if (you.p >= T.WOMB_END) return MI.gate;
  return MI.womb;
}

function meetPos(st) {
  const m = st.meet, u = smooth((st.t - m.t0) / T.MEET_S);
  return { x: lerp(m.x0, m.x1, u), y: lerp(m.y0, m.y1, u), ang: lerp(m.a0, Math.PI / 2, u) };
}
function centreAt(st, y) {
  if (y <= T.FORK) return 0;
  return st.warm * T.TUBE_HALF * clamp((y - T.FORK) / (T.SPLIT - T.FORK), 0, 1);
}
function carriedPos(st) {
  const c = st.carried, u = smooth((st.t - c.t0) / T.CARRIED_S);
  const y = lerp(c.y0, T.TUBE_END + T.MEET_GLIDE, u);
  const x = centreAt(st, y) + (c.x0 - centreAt(st, c.y0)) * (1 - u);
  return { x, y, ang: Math.PI / 2 };
}

// Your arrival: the place is fixed as your head crosses the band; then the 2.5 s `meet`.
function arrive(st) {
  const you = st.you;
  st.finalPlace = you.place;
  st.goalMet = you.place <= 3;
  const side = you.x >= st.warm * T.TUBE_HALF ? 1 : -1;
  st.meet = { t0: st.t, x0: you.x, y0: you.p, a0: you.ang,
    x1: st.warm * T.TUBE_HALF + side * (T.TUBE_HALF - 2 * T.HEAD_R), y1: T.TUBE_END + T.MEET_GLIDE };
  if (st.goalMet) settle(st, "goal", "you", "swim.goalDone");
  else settle(st, "goal", "auto", "swim.goalNear");
  emit(st, "sfx", { id: "swell", at: st.t, pitch: 1, gain: 0.8 });
  const sc = scoreOf(st);
  for (const part of ["goal", "skill", "flourish"]) pay(st, part, sc[part] - st.paid[part]);
  enter(st, "meet");
}

// The stage ends: every open sub-goal settles, the rest of the points are paid, the shown place catches up.
function finish(st, how) {
  if (st.done) return;
  st.how = how;
  if (how === "cap") {
    st.capped = true;
    st.racing = false;
    st.finalPlace = st.placeNow;
    st.goalMet = false;
  }
  if (how === "carried") st.goalMet = false;
  const capLike = how === "cap" || how === "carried";
  const text = {
    goal: capLike ? "swim.goalCap" : "swim.goalNear",
    warm: "swim.warmAuto",
    ready: capLike ? "swim.readyLater" : "swim.readyAuto",
  };
  for (const [id, s] of Object.entries(st.subgoals)) if (s === "shown") settle(st, id, "auto", text[id] || "swim.goalNear");
  const sc = scoreOf(st);
  for (const part of ["goal", "skill", "flourish"]) pay(st, part, sc[part] - st.paid[part]);
  const place = st.finalPlace ?? st.placeNow;
  if (st.place !== place) { st.place = place; emit(st, "place", { place, of: OF }); }
  st.queue.length = 0;
  st.done = true;
  st.lastPrompt = { ...NONE };
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

// Captions, sub-goals and one-off sounds that follow what you do.
function story(st) {
  const you = st.you, f = st.flags;
  if (st.t >= T.GOAL_S - 1e-9 && !st.subgoals.goal) show(st, "goal", "swim.goal");
  if (you.lifted && !f.lift) f.lift = true;
  if (you.lifted && !f.liftedNow) emit(st, "sfx", { id: "whoom", at: st.t, pitch: 1, gain: 0.7 });
  if (!you.lifted && f.liftedNow) {
    // a ride ends: pay its share of the wave points (the rest settles at the end)
    pay(st, "skill", Math.floor(1500 * Math.min(1, you.rideS / 5)) - st.paidWaves);
    st.paidWaves = Math.floor(1500 * Math.min(1, you.rideS / 5));
  }
  f.liftedNow = you.lifted;
  if (f.lift || (st.moment === "womb" && st.t >= T.WAVES_LATE_S)) say(st, "fact", "swim.waves");
  if (you.zone !== st.lastZone) {
    if (you.zone === "tube") {
      emit(st, "fork", { tube: "warm" });
      settle(st, "warm", "you", "swim.warmDone");
      say(st, "fact", "swim.warm");
    } else if (you.zone === "loop") {
      emit(st, "fork", { tube: "cool" });
      say(st, "caption", "swim.cool");
    } else if (st.lastZone === "loop") say(st, "caption", "swim.coolBack");
    st.lastZone = you.zone;
  }
  if (Number.isFinite(f.tubeT) && st.t >= f.tubeT + T.FLOW_AFTER_S) say(st, "fact", "swim.flow");
  if (you.zone === "tube" && you.touch) say(st, "fact", "swim.walls");
  if (you.zone === "tube" && you.p >= T.GLOWS[0] - T.REST_SHOW && !st.subgoals.ready) {
    show(st, "ready", "swim.restGoal");
    say(st, "fact", "swim.rest", true);
  }
  for (let i = 0; i < T.GLOWS.length - 1; i++) {
    if (you.zone === "tube" && !you.ready && !you.attached && you.p > T.GLOWS[i] + T.GLOW_R + 5 && !f["passed" + i]) {
      f["passed" + i] = true;
      st.queue.push({ kind: "caption", id: "swim.restNext" });
    }
  }
  if (you.ready && !f.ready) {
    f.ready = true;
    emit(st, "milestone", { id: "ready" });
    if (you.readyHow === "glow") {
      settle(st, "ready", "you", "swim.readyDone");
      pay(st, "skill", 1000);
      say(st, "fact", "swim.ready", true);
      f.hyperT = st.t + T.HYPER_AFTER_S;
    }
  }
  if (Number.isFinite(f.hyperT) && st.t >= f.hyperT) say(st, "fact", "swim.hyper", true);
  // a swish on a sharp turn
  if (!you.out && !you.arrived) {
    const d = Math.abs(wrapAngle(you.ang - st.swish.ang));
    st.swish.acc = st.swish.acc * Math.exp(-DT / T.SWISH_TAU_S) + d;
    st.swish.ang = you.ang;
    if (st.swish.acc >= T.SWISH_ACC && st.t - st.swish.last >= T.SWISH_GAP_S) {
      st.swish.last = st.t;
      st.swish.acc = 0;
      emit(st, "sfx", { id: "swish", at: st.t, pitch: 1, gain: 0.4 });
    }
  }
  flushSay(st);
}

// placeNow every step; the shown place after a new value has held for 0.25 s.
function places(st) {
  const you = st.you;
  let now;
  if (st.finalPlace !== null) now = st.finalPlace;
  else if (you.arrived) now = you.place;
  else {
    const yp = progOf(you);
    let n = 0;
    for (const o of st.rivals) if (o.arrived || progOf(o) > yp) n++;
    now = 1 + n;
  }
  if (now !== st.placeNow) { st.placeNow = now; st.placeSince = st.t; }
  if (st.placeNow !== st.place && st.t - st.placeSince >= T.PLACE_HOLD_S - 1e-9) {
    st.place = st.placeNow;
    emit(st, "place", { place: st.place, of: OF });
  }
}

// Each sperm that reached the meeting place this step, in arrival order.
function arrivals(st) {
  const fresh = st.all.filter((sp) => sp.arrived && sp.place === null)
    .sort((a, b) => a.arriveT - b.arriveT || st.all.indexOf(a) - st.all.indexOf(b));
  for (const sp of fresh) {
    st.arrived++;
    sp.place = st.arrived;
    emit(st, "arrive", { id: idOf(sp), place: sp.place });
  }
  return fresh.includes(st.you);
}

function stepOnce(st, it) {
  const you = st.you;
  if (st.moment !== "carried" && st.moment !== "meet") {
    const live = st.t >= T.START_S - 1e-9;
    const s = it && it.steer;
    const sx = s && Number.isFinite(s.x) ? s.x : 0, sy = s && Number.isFinite(s.y) ? s.y : 0;
    const k = Math.hypot(sx, sy) > 1 ? 1 / Math.hypot(sx, sy) : 1;
    you.stick = live ? { x: sx * k, y: sy * k } : ZERO;
  }
  raceStep(st);
  st.t += DT;
  for (const sp of st.rivals) {
    if (sp.rest !== null && !sp.arrived && sp.attached !== "rest" && st.t - sp.rest >= T.REST_SLOW_S - 1e-9) attach(st, sp, "rest");
  }
  for (const sp of st.all) sp.phase = (sp.phase + DT * (T.TAIL_HZ + sp.speed * T.TAIL_PER_U)) % 1;
  const youIn = arrivals(st);
  places(st);
  if (youIn && st.moment !== "meet" && st.moment !== "carried") arrive(st);
  else if (st.moment !== "meet" && st.moment !== "carried") {
    const mi = Math.max(st.mi, raceMoment(you));
    if (mi !== st.mi) for (let i = st.mi + 1; i <= mi; i++) enter(st, IDS[i]);
  }
  syncPrompt(st);
  story(st);
  // the camera: your progress, and you sideways with a 0.4 s ease
  const pos = posOf(st, you);
  st.cam.x += (pos.x - st.cam.x) * (1 - Math.exp(-DT / T.CAM_EASE_S));
  st.cam.y = pos.y;
  if (st.moment === "meet") {
    if (!you.ready && st.t - st.meet.t0 >= T.MEET_READY_S - 1e-9) {
      you.ready = true;
      you.readyHow = "meet";
      settle(st, "ready", "auto", "swim.readyAuto");
    }
    if (st.t - st.meet.t0 >= T.MEET_S - 1e-9) finish(st, "meet");
  } else if (st.moment === "carried") {
    if (st.t - st.carried.t0 >= T.CARRIED_S - 1e-9) finish(st, "carried");
  } else if (st.t >= T.CAP_S - 1e-9) finish(st, "cap");
}

// ---------------------------------------------------------------- the Stage interface

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const sd = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 1;
  const carry = mergeCarry(carryIn, null);
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  // the start grid: row 1 at the front (48 u), you in row 3, slot 2 (x = −5); the 19 skills shuffled onto the rest
  const slots = [];
  for (let row = 0; row < T.GRID_ROWS; row++) {
    for (let col = 0; col < T.GRID_COLS; col++) {
      slots.push({ x: -T.GRID_COL_GAP * (T.GRID_COLS - 1) / 2 + T.GRID_COL_GAP * col, p: T.GRID_FRONT - T.GRID_ROW_GAP * row });
    }
  }
  const free = slots.filter((_, i) => i !== T.YOU_SLOT);
  const order = T.SKILLS.map((_, i) => i);
  const g = stream(sd, "grid");
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(g() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const rivals = order.map((rung, k) => {
    const r = stream(sd, "rival:" + rung);
    r.mem = {};
    return makeSperm(rung, T.SKILLS[rung], free[k], r);
  }).sort((a, b) => a.id - b.id);
  const you = makeSperm("you", null, slots[T.YOU_SLOT], null);
  // the waves' shared thresholds and window centres
  const nWaves = Math.ceil((T.CAP_S + 5) / T.WAVE_GAP) + 4;
  const thr = [], cen = [];
  for (let k = 0; k < nWaves; k++) {
    const r = stream(sd, "wave:" + k);
    thr.push(r());
    cen.push((2 * r() - 1) * T.WAVE_SPREAD);
  }
  const warm = stream(sd, "fork")() < 0.5 ? -1 : 1;
  const st = {
    id: meta.id, seed: sd, t: 0, gaDay: meta.ga.start, fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: IDS[0], mi: 0,
    done: false, how: null, fault: null, assist: !!o.assist, oneButton: !!o.oneButton, carry, hue: carry.sperm.hue,
    warm, thr, cen, you, rivals, all: [you, ...rivals],
    placeNow: 0, place: 0, placeSince: 0, finalPlace: null, arrived: 0,
    racing: true, capped: false, goalMet: false, meet: null, carried: null,
    cam: { x: you.x, y: you.p }, contacts: [],
    queue: [], said: [], sayLast: -1e9, flags: {}, lastZone: "path", lastPrompt: null,
    paid: { goal: 0, skill: 0, flourish: 0 }, paidWaves: 0, swish: { acc: 0, ang: you.ang, last: -1e9 },
  };
  st.beats = makeBeats(sd, [{ heart: "mother", from: 0, to: T.CAP_S + T.CARRIED_S + 10, bpm: meta.motherBpm, jitter: T.JITTER, first: phase }]);
  // the place you start in
  let n = 0;
  for (const r of rivals) if (r.p > you.p) n++;
  st.placeNow = st.place = 1 + n;
  emit(st, "moment", { id: st.moment });
  syncPrompt(st);
  emit(st, "place", { place: st.place, of: OF });
  say(st, "fact", "swim.half");                       // the first caption (6.1), after the goal line
  return st;
}

export function step(st, intents) {
  if (!st || typeof st !== "object") return;
  if (st.done) { st.t += DT; return; }
  try {
    stepOnce(st, intents || EMPTY_INTENTS);
  } catch (e) {
    // never throw: keep the fault, keep the clock going, end by the cap
    if (!st.fault) st.fault = String(e && e.stack ? e.stack : e);
    if (!st.done) {
      if (!(st.t >= 0)) st.t = 0;
      if (st.t < T.CAP_S) st.t += DT;
      try { if (st.t >= T.CAP_S - 1e-9 || st.moment === "meet" || st.moment === "carried") finish(st, "cap"); } catch (e2) { st.done = true; }
    }
  }
}

// ---------------------------------------------------------------- view (16.5)

// World-fixed sample points of [lo, hi]: the step grid plus the course's break points, one step past each end.
function samples(lo, hi, from, to, extra) {
  if (!(hi > lo)) return [];
  const a = Math.max(from, Math.floor(lo / T.VIEW_STEP) * T.VIEW_STEP - T.VIEW_STEP);
  const b = Math.min(to, Math.ceil(hi / T.VIEW_STEP) * T.VIEW_STEP + T.VIEW_STEP);
  if (!(b > a)) return [];
  const ys = [a, b];
  for (let y = Math.ceil(a / T.VIEW_STEP) * T.VIEW_STEP; y < b; y += T.VIEW_STEP) if (y > a) ys.push(y);
  for (const y of extra) if (y > a && y < b) ys.push(y);
  const out = [...new Set(ys)].sort((u, v) => u - v);
  while (out.length > 32) out.splice(out.length - 2, 1);
  return out;
}

function courseStrips(st, d, lo, hi) {
  // the womb, the gate and the fork, to the split
  const ys = samples(lo, hi, T.WAVE_FROM - 20, T.SPLIT, [T.WOMB_END, T.GATE_END, T.FORK]);
  if (ys.length >= 2) {
    d.strips.push({ kind: "course", pts: ys.flatMap((y) => [0, y]), w: ys.map((y) => 2 * halfAt(y)), tone: "womb" });
  }
  // the cool loop
  if (hi >= T.FORK - T.LOOP_HALF && lo <= T.SPLIT + 2 * T.LOOP_R + T.LOOP_HALF) {
    const pts = [], w = [];
    for (let i = 0; i <= 18; i++) { const q = loopPoint(st, (T.LOOP_LEN * i) / 18, 0); pts.push(q.x, q.y); w.push(2 * T.LOOP_HALF); }
    d.strips.push({ kind: "course", pts, w, tone: "cool" });
  }
  // the warm tube, to a little past the meeting place
  const end = T.TUBE_END + 2 * T.VIEW_STEP;
  const ts = samples(lo, hi, T.SPLIT, end, []);
  if (ts.length >= 2) {
    const xc = st.warm * T.TUBE_HALF;
    d.strips.push({ kind: "course", pts: ts.flatMap((y) => [xc, y]), w: ts.map(() => 2 * T.TUBE_HALF), tone: "warm" });
    // the warm lane's chevrons
    const ls = ts.filter((y) => y >= T.TUBE_START && y <= T.TUBE_END);
    if (ls.length >= 2) {
      const lx = xc + laneAt(st.t);
      d.strips.push({ kind: "chevrons", pts: ls.flatMap((y) => [lx, y]), w: T.LANE_W * (st.assist ? T.ASSIST_LANE : 1), phase: (st.t * 0.6) % 1 });
    }
  }
}

function cueOf(st, cy) {
  const you = st.you, pos = posOf(st, you);
  const meet = { x: st.warm * T.TUBE_HALF, y: T.TUBE_END };
  if (st.moment === "meet" || st.moment === "carried" || st.done) return meet;
  if (st.moment === "womb") {
    const k = waveNear(st.t, you.p), yc = waveFront(k, st.t) - T.WAVE_THICK / 2;
    if (Math.abs(yc - cy) < 160 && yc < T.WOMB_END) return { x: st.cen[k], y: yc };
    return { x: 0, y: Math.min(you.p + 120, T.GATE_END) };
  }
  if (st.moment === "gate" || (st.moment === "fork" && you.zone !== "loop")) return { x: st.warm * T.TUBE_HALF, y: T.SPLIT + 10 };
  if (you.zone === "loop") return { x: 0, y: T.FORK };
  if (T.TUBE_END - you.p < 200) return meet;
  if (!you.ready) {
    for (let i = 0; i < T.GLOWS.length; i++) {
      if (T.GLOWS[i] + T.GLOW_R >= you.p && T.GLOWS[i] - you.p < 220) return glowAt(st, i);
    }
  }
  return { x: st.warm * T.TUBE_HALF + laneAt(st.t), y: Math.min(pos.y + 60, T.TUBE_END) };
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const you = st.you, pos = posOf(st, you);
  const span = spanAt(pos.y);
  const mm = mmPerShortAxis(meta, st.gaDay);
  const cx = st.cam.x, cy = st.cam.y;
  d.camera = { x: cx, y: cy, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = { you: "0.05 mm" };
  const inTube = you.zone === "tube" || st.moment === "tube" || st.moment === "meet";
  d.light = { level: inTube ? 0.36 : 0.32, warm: inTube ? 0.75 : 0.6, exposure: 1, white: 0, vignette: 0.45, tint: 0 };
  d.warp = 0.15;
  d.caustics = 0;
  const lo = cy - T.VIEW_BACK, hi = cy + T.VIEW_AHEAD;
  courseStrips(st, d, lo, hi);

  // the sperm: tails for every one in range, a head disc each; you last, on the highest sheet
  const items = [];
  const seen = (q) => Math.abs(q.y - cy) <= T.DRAW_RANGE && Math.abs(q.x - cx) <= T.DRAW_RANGE;
  for (const sp of st.rivals) {
    const q = posOf(st, sp);
    if (!seen(q) || items.length >= 24) continue;
    items.push({ x: q.x, y: q.y, ang: q.ang, len: T.LEN, phase: sp.phase, hue: T.RIVAL_HUE, ring: null });
    d.splats.push({ k: "c", x: q.x, y: q.y, r: T.HEAD_R, m: 0.8, n: 0, v: 0, hue: T.RIVAL_HUE });
  }
  items.push({ x: pos.x, y: pos.y, ang: pos.ang, len: T.LEN, phase: you.phase, hue: st.hue, ring: "halo" });
  d.splats.push({ k: "c", x: pos.x, y: pos.y, r: T.HEAD_R, m: 1.5, n: 0, v: 0, hue: st.hue });
  d.strips.push({ kind: "tails", items });

  // contact rings for the bumps
  const rings = st.contacts.filter((c) => st.t - c.t < T.RING_S && seen(c)).map((c) => {
    const u = clamp01((st.t - c.t) / T.RING_S);
    return { x: c.x, y: c.y, r: 2 + 4 * u, a: (c.you ? 0.9 : 0.6) * (1 - u), dashed: false };
  });
  if (rings.length && d.strips.length < 6) d.strips.push({ kind: "ripples", items: rings });

  // marks: the waves, the fork mouths, the glow walls, the meeting place, resting sperm
  const pulse = Math.pow(1 - clamp01(st.beats.phase("mother", st.t)), 3);
  const mark = (m) => { if (d.marks.length < 24) d.marks.push(m); };
  if (lo < T.WOMB_END) {
    const k0 = Math.max(0, waveBehind(st.t, hi + T.WAVE_THICK));
    for (let k = k0; k < st.thr.length && d.marks.length < 4; k++) {
      const yc = waveFront(k, st.t) - T.WAVE_THICK / 2;
      if (waveStart(k) > st.t) break;
      if (yc - T.WAVE_THICK / 2 > hi || yc >= T.WOMB_END) continue;
      if (yc + T.WAVE_THICK / 2 < lo) break;
      mark({ kind: "band", x: st.cen[k], y: yc, r: T.WAVE_HALF, w: T.WAVE_THICK, rim: "wavy",
        on: clamp01((T.WOMB_END - yc) / T.WAVE_THICK), pulse: 0, ang: Math.PI / 2 });
    }
  }
  if (hi >= T.FORK && lo <= T.SPLIT + 40) {
    mark({ kind: "warm", x: st.warm * T.TUBE_HALF, y: T.SPLIT + 15, r: T.TUBE_HALF, on: true, pulse });
    mark({ kind: "cool", x: -st.warm * T.TUBE_HALF, y: T.SPLIT + 15, r: T.TUBE_HALF, on: true, pulse: 0 });
    if (st.mi <= MI.fork && you.zone !== "tube") {
      mark({ kind: "arrow", x: st.warm * 8, y: T.FORK - 12, r: 6, on: true, pulse, ang: Math.atan2(T.SPLIT + 15 - (T.FORK - 12), st.warm * (T.TUBE_HALF - 8)) });
    }
  }
  for (let i = 0; i < T.GLOWS.length; i++) {
    const g = glowAt(st, i);
    if (g.y < lo - T.GLOW_R || g.y > hi + T.GLOW_R) continue;
    const mine = you.attached === "glow" && you.glow === i;
    mark({ kind: "glowwall", x: g.x, y: g.y, r: T.GLOW_R, rim: "solid", on: mine ? 1 : 0.7, pulse });
  }
  if (hi >= T.TUBE_END - T.MEET_W) {
    mark({ kind: "meet", x: st.warm * T.TUBE_HALF, y: T.TUBE_END, r: T.TUBE_HALF, w: T.MEET_W, rim: "solid", on: true, pulse, ang: Math.PI / 2 });
  }
  if (you.ready) mark({ kind: "glow", x: pos.x, y: pos.y, r: 8, on: 0.6, pulse });
  for (const sp of st.rivals) {
    if (!(sp.attached || sp.rest !== null) || d.marks.length >= 24) continue;
    const q = posOf(st, sp);
    if (seen(q)) mark({ kind: "glow", x: q.x, y: q.y, r: 6, on: sp.ready ? 0.6 : 0.35, pulse: 0 });
  }

  // DOM rings: her beat at you; the rest ring while you count her beats on a glow
  d.rings.push({ id: "mother", kind: "mother", x: pos.x, y: pos.y, r: span * 0.12, progress: clamp01(st.beats.phase("mother", st.t)) });
  if (you.attached === "glow" && !you.ready) {
    d.rings.push({ id: "rest", kind: "rest", x: pos.x, y: pos.y, r: 9, progress: clamp01(you.beats / T.READY_BEAT) });
  }
  d.anchor = { x: pos.x, y: pos.y };
  d.cue = cueOf(st, cy);
  return d;
}

export function prompt(st) {
  return promptOf(st);
}

// The race has no timed targets.
export function targets(st, horizonS) {
  return [];
}

// Your steering at `skill` (also the one-button rule at skill 1): ride the waves you take, take the warm tube, steer
// to the lane centre heading upstream, rest on glow 1 from skill 0.75 (glow 2 from 0.4), keep clear of a sperm just
// ahead. Its noise and lag live only in r.mem.
export function botSteer(st, skill, r) {
  const still = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  try {
    if (!st || st.done || st.moment === "meet" || st.moment === "carried" || st.you.arrived || st.you.out) return still;
    const sk = clamp01(skill);
    const s = steerFor(st, st.you, sk, r, { side: st.warm, wall: wallFor(sk) });
    return { steer: { x: s.x, y: s.y }, dir: null, hold: false };
  } catch (e) {
    return still;
  }
}

// The race shape (16.9), in world units.
export function probe(st) {
  const you = st.you, yp = posOf(st, you);
  return {
    place: st.place, placeNow: st.placeNow, of: OF,
    you: { progress: progOf(you), x: yp.x, y: yp.y, ready: you.ready },
    rivals: st.rivals.map((sp) => {
      const q = posOf(st, sp);
      return {
        id: sp.id, skill: sp.skill, progress: progOf(sp), x: q.x, y: q.y,
        state: sp.arrived ? "arrived" : sp.attached || sp.rest !== null ? "rest" : "swim",
        tube: sp.zone === "tube" ? "warm" : sp.zone === "loop" ? "cool" : null, ready: sp.ready,
      };
    }),
  };
}

export function result(st) {
  const you = st.you, p = parts(st), score = scoreOf(st);
  const goalMet = st.done && st.goalMet && st.how !== "carried" && st.how !== "cap";
  return {
    done: st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "place", label: "swim.part.place", value: Math.round(p.placePts), max: 2500 },
      { id: "waves", label: "swim.part.waves", value: Math.round(p.wavePts), max: 1500 },
      { id: "lane", label: "swim.part.lane", value: Math.round(p.lanePts), max: 1000 },
      { id: "ready", label: "swim.part.ready", value: p.readyPts, max: 1000 },
      { id: "first", label: "swim.part.first", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: {
      place: p.place, of: OF, capped: st.capped, arrived: you.arrived, arriveT: you.arriveT, how: st.how,
      rideS: you.rideS, waves: you.waves.length, lane: p.lane, ready: you.ready, readyHow: you.readyHow,
      bumps: you.bumps, loops: you.loops, warm: st.warm > 0 ? "right" : "left", moment: st.moment, fault: st.fault,
    },
    carryOut: { sperm: { hue: st.hue, place: p.place, glow: you.ready ? 1 : 0.5 } },
  };
}

// Skip to a moment (for tests, and for "carried" after Go on at the cap). The race moments put you at that part of
// the course; `meet` makes you arrive now; `carried` plays the 3 s carry to the meeting place with input `none`.
export function jump(st, id) {
  if (!st || !(id in MI)) return false;
  const you = st.you;
  if (id === "carried") {
    const pos = posOf(st, you);
    st.done = false;
    st.how = null;
    st.racing = false;
    st.carried = { t0: st.t, x0: pos.x, y0: pos.y };
    st.meet = null;
    you.out = true;
    you.attached = null;
    enter(st, "carried");
    return true;
  }
  if (you.arrived || you.out) return false;
  st.done = false;
  st.how = null;
  if (id === "meet") {
    you.zone = "tube"; you.p = T.TUBE_END; you.x = st.warm * T.TUBE_HALF;
    you.arrived = true; you.arriveT = st.t;
    arrivals(st);
    places(st);
    arrive(st);
    return true;
  }
  const at = { womb: [-T.GRID_COL_GAP / 2, T.GRID_FRONT - 2 * T.GRID_ROW_GAP, "path"], gate: [0, T.WOMB_END, "path"],
    fork: [0, T.FORK, "path"], tube: [st.warm * T.TUBE_HALF, T.TUBE_START, "tube"] }[id];
  you.x = at[0]; you.p = at[1]; you.zone = at[2]; you.attached = null; you.loopS = 0;
  you.lastCheck = at[2] === "tube" ? T.TUBE_START : -1e9;
  st.lastZone = you.zone;
  st.mi = Math.min(st.mi, MI[id]);
  enter(st, id);
  st.cam.x = you.x; st.cam.y = you.p;
  return true;
}
