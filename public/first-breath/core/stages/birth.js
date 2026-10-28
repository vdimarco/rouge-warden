// First Breath: stage 8, Birth (`birth`): "Ride the waves." An endless-runner escape (openspec change
// first-breath-action-genres, design.md 5.8): the waves of birth push you down a soft three-lane channel toward the
// light. Each contraction is a surge of speed; between them you slow and rest. Slide between the lanes to pass the
// soft folds (plum flaps from the side walls), tuck to slip through the tight gaps, hit the four gates of the birth
// moves (Tuck, Turn, Lift and Turn back) and collect calm bubbles. After the 8th wave, the light. No hp, no foes and
// no knock-out: a bump only slows you, and every input takes 65.5 s. Pure: no DOM, no clocks, no storage, no
// Math.random (the course comes from the stage seed, and the bot's draws from its own stream, kept in r.mem).
//
// The clock (stage seconds from `base`; numbers in birth.tune.js): wave k (k = 0..7) warns at 2.0 + 7.5 k, surges
// from 3.0 + 7.5 k for 5.0 s at 50 + 4 k u/s (ramping over 0.6 s), and rests at 22 u/s for 1.5 s; the last surge's
// speed carries you through the last rest and into the light, which runs 62.0 to 65.5 s. Her rate glides 76 → 92 bpm.
//
// Contract choices (design.md 5.8 and contract.md; see the tune file's header for the changed numbers):
// - Moments `waves` (gesture "move", keys "lanes": a drag steers the lanes, a press tucks; arrows move one lane a
//   keydown) and `light` (gesture none). meta.action: no timed targets, and in one-button mode core/run.js steers
//   from botSteer while the button is held and presses for its tuck. The stage reads intents.taps too (a single quick
//   tap tucks; contract.md's quick second tap and second finger still do), except in one-button mode.
// - The course is planned at the start from the seed (folds, gates and bubbles, each with the time it should meet
//   you) and laid ahead of you as that time comes near, in a chain that keeps the planned spacing after a bump
//   (birth.tune.js). Every fold leaves an open lane or a tight gap, and folds close in time leave a lane within one
//   lane of the last one's.
// - A bump (touching a flap or a post untucked, or tucked but off a tight gap's middle) slows you to 22 u/s for
//   0.6 s, ends the flow streak, shakes the view a little and plays a soft boop. Nothing else: no hp.
// - Gates: a sub-goal from the wave's warning, settled when you pass the gate (done by you, or auto with "The wave
//   moves you on anyway."). Each move plays at the gate, or at its surge's end if you have not reached it yet, so
//   every move plays on its wave. The Turn gate's side is seeded; it writes turnDir, and Turn back is the other side.
// - Score (never shown at the end of this stage): Goal 3,000; Skill 3,500 for the folds less 400 a bump, 400 a gate
//   hit, 100 a bubble up to 900; Flourish 1,000 × min(1, best flow / 30). Points events carry the gates and bubbles
//   as they come and the rest at the end, so they add up to the total. While you ride, result() counts live for the
//   HUD (each clean fold against the folds planned, less each bump so far, and the best flow so far); the end's share
//   is never less.
// - Captions: fact events { id, where: "caption" } at the times in TUNE.captions.
// - Sound: sfx birth.warn, birth.swell (a surge, with dur, cutoffHz and rumbleHz), birth.breath (each surge's end),
//   birth.tuck, birth.bump, birth.bubble, birth.gate, birth.flow (pitch: the streak's step) and birth.open.
// - The view: the camera rides 32 u below you (you sit high on screen; the way ahead fills the screen below you); the
//   channel, its folds, gates and bubbles are one "runner" strip (render/runner.js); you are the baby figure, head
//   down, curling small as you tuck, leaning into lane moves; word and number tags and paper flecks are d.action's
//   pops and bursts; the opening is the `light` mark along the whole bottom edge.
import { DT, mmPerShortAxis } from "../clock.js";
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
import { TUNE as T } from "./birth.tune.js";

const mo = (id) => Object.freeze({ id, ga: Object.freeze([280, 280]), lenS: null });

export const meta = Object.freeze({
  id: "birth", index: 7, name: "Birth", verb: "Ride",
  orient: "fit",
  families: Object.freeze(["steer", "tap"]),
  ga: Object.freeze({ start: 280, end: 280 }), fertilized: true,
  mm: Object.freeze({ start: 700, end: 700 }),
  action: true,
  motherBpm: T.motherBpm[0], parS: T.parS, capS: T.capS, canFail: false, scored: true,
  moments: Object.freeze([mo("waves"), mo("light")]),
});

const EPS = 1e-9;
const LANES = T.lanes;
const H = T.flapW / 2;                       // a flap's half thickness along the channel
const WALL = T.wallX + 12;                   // a flap's rect runs this far out (into the wall)
const LIGHT_S = T.exposureS + T.whiteS + T.holdS;
const WAVES_END_S = T.leadS + T.periodS * T.waves;   // 62.0 s after base
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const MOVE = (text) => Object.freeze({ gesture: "move", text, keys: "lanes" });
const P_MOVE = MOVE("birth.prompt.move"), P_REST = MOVE("birth.again"), P_GO = MOVE("birth.go");
// the patterns: lanes each one blocks (the open lanes are the rest)
const P1 = Object.freeze([[0], [2]]);        // one outer lane
const P2 = Object.freeze([[0, 1], [1, 2]]);  // two lanes from one side
const PB = Object.freeze([[0, 2]]);          // both sides, the middle open

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
const ease = (p) => { const x = clamp01(p); return x * x * (3 - 2 * x); };
const lerp = (a, b, p) => a + (b - a) * p;
const fin = (v) => typeof v === "number" && Number.isFinite(v);

// ---- the waves and the speed

function makeWaves(base, assist) {
  const out = [];
  for (let k = 0; k < T.waves; k++) {
    const warn = base + T.leadS + T.periodS * k, s = warn + T.warnS, e = s + T.surgeS;
    const v = (T.surgeV[0] + T.surgeV[1] * k) * (assist ? T.assist.surgeK : 1);
    out.push({ k, warn, s, e, next: warn + T.periodS, v, warned: false, surged: false, ended: false });
  }
  return out;
}

// The planned speed at stage time t (no bumps): rest, a 0.6 s ramp up into each surge and down out of it; after the
// last surge its speed holds.
function vNom(st, t) {
  const W = st.waves, R = T.restV, ramp = T.rampS;
  for (let i = 0; i < W.length; i++) {
    const w = W[i];
    if (t < w.s) return R;
    if (t < w.s + ramp) return lerp(R, w.v, ease((t - w.s) / ramp));
    if (t < w.e || i === W.length - 1) return w.v;
    if (t < w.e + ramp) return lerp(w.v, R, ease((t - w.e) / ramp));
  }
  return R;
}

// The planned distance from base, one value a step (the course is laid by it).
function makeDn(st) {
  const n = Math.ceil((meta.capS + 10) / DT) + 2;
  const dn = new Float64Array(n);
  for (let i = 1; i < n; i++) dn[i] = dn[i - 1] + vNom(st, st.base + (i - 1) * DT) * DT;   // as step() moves you
  return dn;
}
function dnAt(st, t) {
  const u = (t - st.base) / DT, dn = st.dn;
  if (!(u > 0)) return 0;
  const i = Math.floor(u);
  if (i >= dn.length - 1) return dn[dn.length - 1] + (u - (dn.length - 1)) * DT * vNom(st, t);
  return dn[i] + (dn[i + 1] - dn[i]) * (u - i);
}

// ---- the course plan (from the stage seed)

const openOf = (block) => [0, 1, 2].filter((j) => !block.includes(j));
const reach = (a, b, maxShift) => a.some((x) => b.some((y) => Math.abs(x - y) <= maxShift));

function planCourse(st) {
  const r = stream(st.seed, "birth.course." + st.gen);
  const A = st.assist ? T.assist : null;
  const foldK = A ? A.foldK : 1;
  st.turnSide = r() < 0.5 ? -1 : 1;
  // every obstacle's time first (folds in the surges, a gate in each even wave), then the patterns in order
  const obs = [];
  for (const w of st.waves) {
    const k = w.k;
    const gi = T.gates.findIndex((g) => g.wave === k);
    const tg = gi >= 0 ? w.s + T.gateAt : null;
    const late = k >= T.lateFrom;
    const every = (late ? lerp(T.foldEveryLate[0], T.foldEveryLate[1], (k - T.lateFrom) / Math.max(1, T.waves - 1 - T.lateFrom))
      : lerp(T.foldEvery[0], T.foldEvery[1], k / (T.waves - 1))) * foldK;
    const minGap = (late ? T.minGapLateS : T.minGapS) * foldK;
    const segs = tg === null ? [[w.s + T.foldLead, w.e - T.foldTail]]
      : [[w.s + T.foldLead, tg - T.gateGapS], [tg + T.gateGapS, w.e - T.foldTail]];
    const times = [];
    for (const [a, b] of segs) {
      const len = b - a;
      if (len < -EPS) continue;
      let n = 1 + Math.max(0, Math.round(len / every));
      while (n > 1 && len / (n - 1) < minGap - EPS) n--;
      // the jitter never brings two folds closer than minGap
      const jit = n > 1 ? Math.min(T.foldJitS, Math.max(0, (len / (n - 1) - minGap) / 2)) : 0;
      for (let q = 0; q < n; q++) {
        let tq = n > 1 ? a + (len * q) / (n - 1) : (a + b) / 2;
        if (q > 0 && q < n - 1) tq += (r() * 2 - 1) * jit;
        times.push(tq);
      }
    }
    for (const tq of times) obs.push({ tm: tq, wave: k, gate: -1 });
    if (gi >= 0) obs.push({ tm: tg, wave: k, gate: gi });
  }
  obs.sort((a, b) => a.tm - b.tm);

  // the gates' fixed patterns
  const gateOpen = (gi) => {
    const kind = T.gates[gi].kind;
    if (kind === "tuck") return { open: [0, 1, 2], tight: true };
    if (kind === "lift") return { open: [1], tight: true };
    const side = kind === "turn" ? st.turnSide : -st.turnSide;
    return { open: [side > 0 ? 2 : 0], tight: false };
  };
  let prev = null, lastTight = -Infinity;
  const tightAt = obs.filter((o) => o.gate >= 0 && gateOpen(o.gate).tight).map((o) => o.tm);
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.gate >= 0) {
      const g = gateOpen(o.gate);
      o.open = g.open; o.tight = g.tight;
      if (g.tight) lastTight = o.tm;
      prev = o;
      continue;
    }
    const next = obs[i + 1] && obs[i + 1].gate >= 0 ? obs[i + 1] : null;
    const shift = (dt) => (dt < T.quickS * foldK - EPS ? 1 : 2);
    const ok = (open) => (!prev || reach(prev.open, open, shift(o.tm - prev.tm)))
      && (!next || reach(open, gateOpen(next.gate).open, shift(next.tm - o.tm)));
    const wts = T.weights[o.wave];
    // a tight gap: from wave 3, one fold in five, never too near another tight gap or a tuck or lift gate
    const tightOk = o.wave >= T.tightFrom && o.tm - lastTight >= T.tightGapS - EPS
      && tightAt.every((tt) => Math.abs(tt - o.tm) >= T.tightGapS - EPS);
    const u = r(), pick = r(), side = r();
    let choice = null;
    if (tightOk && u < (o.wave >= T.lateFrom ? T.tightOddsLate : T.tightOdds)) {
      const lanes = [0, 1, 2].filter((j) => ok([j]));
      if (lanes.length) choice = { block: [0, 1, 2], open: [lanes[Math.min(lanes.length - 1, Math.floor(pick * lanes.length))]], tight: true };
    }
    if (!choice) {
      const sum = wts[0] + wts[1] + wts[2];
      const x = pick * sum;
      const order = x < wts[0] ? [P1, P2, PB] : x < wts[0] + wts[1] ? [P2, P1, PB] : [PB, P1, P2];
      for (const fam of order) {
        const cands = fam.filter((b) => ok(openOf(b)));
        if (cands.length) { const b = cands[Math.min(cands.length - 1, Math.floor(side * cands.length))]; choice = { block: b, open: openOf(b), tight: false }; break; }
      }
    }
    if (!choice) choice = { block: [0, 2], open: [1], tight: false };   // the middle is within a lane of anything
    o.block = choice.block; o.open = choice.open; o.tight = choice.tight;
    if (o.tight) lastTight = o.tm;
    prev = o;
  }

  // calm bubbles: two in each surge, between obstacles, in a lane open at the next one and within a lane of the last
  // one's; one in the rest after each surge but the last
  const items = obs.map((o) => ({ ...o, kind: o.gate >= 0 ? "gate" : "fold" }));
  for (const w of st.waves) {
    const mine = items.filter((o) => o.wave === w.k);
    const slots = [];
    for (let i = 1; i < mine.length; i++) if (mine[i].tm - mine[i - 1].tm >= Math.min(0.6, T.minGapLateS) - EPS) slots.push([mine[i - 1], mine[i]]);
    for (let n = 0; n < T.bubblesSurge && slots.length; n++) {
      const [a, b] = slots.splice(Math.min(slots.length - 1, Math.floor(r() * slots.length)), 1)[0];
      const both = b.open.filter((j) => a.open.includes(j));
      const near = b.open.filter((j) => a.open.some((x) => Math.abs(x - j) <= 1));
      const pool = both.length ? both : near.length ? near : b.open;
      const lane = pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))];
      items.push({ kind: "bubble", tm: (a.tm + b.tm) / 2, wave: w.k, lane });
    }
    if (w.k < T.waves - 1) {
      const last = mine[mine.length - 1];
      const pool = last ? [0, 1, 2].filter((j) => last.open.some((x) => Math.abs(x - j) <= 1)) : [0, 1, 2];
      items.push({ kind: "bubble", tm: w.e + T.bubbleRestS, wave: w.k, lane: pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))] });
    }
  }
  items.sort((a, b) => a.tm - b.tm || (a.kind === "bubble" ? 1 : 0) - (b.kind === "bubble" ? 1 : 0));
  items.forEach((it, i) => { it.id = i + 1; });
  return items;
}

// ---- laying the course ahead of you

// The x spans an obstacle blocks (each as far out as the wall), and how it is drawn.
function shapeOf(st, it) {
  const wide = st.assist ? T.assist.wideK : 1;
  const half = Math.min(T.hitR - 0.25, (T.tightW / 2) * wide);
  const flaps = [], posts = [];
  const flap = (side, tip, tone = 0) => flaps.push({ side, tip, tone });
  if (it.kind === "fold") {
    if (it.tight) {
      const gx = LANES[it.open[0]];
      flap(-1, gx - half); flap(1, gx + half);
    } else {
      const b = it.block;
      if (b.length === 2 && b[0] === 0 && b[1] === 1) flap(-1, T.tip1);
      else if (b.length === 2 && b[0] === 1 && b[1] === 2) flap(1, -T.tip1);
      else {
        if (b.includes(0)) flap(-1, -T.tip1);
        if (b.includes(2)) flap(1, T.tip1);
      }
    }
  } else {
    const kind = T.gates[it.gate].kind;
    if (kind === "tuck") {
      flap(-1, LANES[0] - half, 1); flap(1, LANES[2] + half, 1);
      posts.push([LANES[0] + half, LANES[1] - half], [LANES[1] + half, LANES[2] - half]);
    } else if (kind === "lift") {
      flap(-1, -half, 1); flap(1, half, 1);
    } else {
      const g = it.open[0];
      if (g === 2) flap(-1, -T.tip1); else flap(1, T.tip1);   // the far outer lane
    }
  }
  const rects = flaps.map((f) => (f.side < 0 ? [-WALL, f.tip] : [f.tip, WALL])).concat(posts.map((p) => [p[0], p[1]]));
  return { flaps, posts, rects, half };
}

function lay(st, it, s) {
  if (it.kind === "bubble") {
    st.bubbles.push({ id: it.id, s, x: LANES[it.lane], lane: it.lane, wave: it.wave, taken: false, gone: false, at: null });
    st.offered++;
    return;
  }
  const sh = shapeOf(st, it);
  st.obs.push({ id: it.id, kind: it.kind, gate: it.gate, s, wave: it.wave, tm: it.tm, open: it.open.slice(), tight: !!it.tight,
    block: it.block ? it.block.slice() : null, ...sh, bumped: false, done: false, x0: null, bentAt: null, retract: null });
}

// Lay each planned item once its planned meeting is within aheadU of planned travel: aheadU in front of you, or the
// planned spacing behind the last item laid, whichever is further (so a bump never closes the spacing up). Across a
// rest the spacing may close to 1.0 s of the new wave's surge, so the chain catches up with you there.
function spawn(st) {
  const P = st.plan;
  const now = dnAt(st, st.t);
  while (st.pi < P.length) {
    const it = P[st.pi];
    const dIt = dnAt(st, it.tm);
    if (dIt - now > T.aheadU) break;
    st.pi++;
    if (st.moment !== "waves") continue;
    let s = st.d + (dIt - now);
    const L = st.lastLaid;
    if (L) {
      let gap = dIt - dnAt(st, L.tm);
      if (L.wave !== it.wave) gap = Math.min(gap, 1.0 * st.waves[it.wave].v);
      s = Math.max(s, L.s + gap);
    }
    lay(st, it, s);
    st.lastLaid = { s, tm: it.tm, wave: it.wave };
  }
}

// ---- input

function sane(intents) {
  const it = intents && typeof intents === "object" ? intents : EMPTY_INTENTS;
  const s = it.steer && fin(it.steer.x) && fin(it.steer.y) ? it.steer : { x: 0, y: 0 };
  const m = Math.hypot(s.x, s.y), k = m > 1 ? 1 / m : 1;
  const list = (l) => (Array.isArray(l) ? l.filter((e) => e && fin(e.t)) : []);
  return { steer: { x: s.x * k, y: s.y * k }, presses: list(it.presses), taps: list(it.taps) };
}

// The tuck's length now: 0.5 s, shorter in the late waves (TUNE.tuckLate), plus Assist's slack.
function tuckLen(st) {
  let k = -1;
  if (Array.isArray(st.waves)) for (let i = 0; i < st.waves.length; i++) if (st.t >= st.waves[i].warn - EPS) k = i;
  const base = k >= T.lateFrom ? lerp(T.tuckLate[0], T.tuckLate[1], (k - T.lateFrom) / Math.max(1, T.waves - 1 - T.lateFrom)) : T.tuckS;
  return base + (st.assist ? T.assist.tuckSlackS : 0);
}

function wantTuck(st) {
  const ready = st.tuckAt + T.tuckCdS;
  if (st.t >= ready - EPS) startTuck(st);
  else if (ready - st.t <= T.tuckBufS + EPS) st.tuckQ = true;
}

function startTuck(st) {
  st.tuckQ = false;
  st.tuckAt = st.t;
  st.tuckT = tuckLen(st);
  st.tucks++;
  addRing(st, st.x, st.d, 11, 4, 0.6);
  emit(st, "sfx", { id: "birth.tuck", pitch: 1, gain: 0.7 });
}

// The next lane from where you are, the way d points (or the lane you have, at the edge).
function nextLane(st, d) {
  if (d > 0) { for (let j = 0; j < 3; j++) if (LANES[j] > st.x + 1) return j; return 2; }
  for (let j = 2; j >= 0; j--) if (LANES[j] < st.x - 1) return j;
  return 0;
}

function readInput(st, it) {
  for (const p of it.presses) {
    if (!st.oneButton && (p.dir === "left" || p.dir === "right")) {
      st.lane = Math.max(0, Math.min(2, st.lane + (p.dir === "left" ? -1 : 1)));
      st.engaged = 0;
      continue;
    }
    wantTuck(st);
  }
  if (!st.oneButton && it.taps.length) wantTuck(st);
  const sx = it.steer.x, down = -it.steer.y;
  // a quick drag down tucks (once; the stick must come back up before the next)
  if (st.swipe && down > T.swipeDown && down > Math.abs(sx)) { st.swipe = false; wantTuck(st); }
  else if (down < T.swipeRearm) st.swipe = true;
  // the stick: past the engage point (and more sideways than down) you take the next lane that way
  const d = Math.abs(sx) > T.engage && Math.abs(sx) >= 0.75 * Math.max(0, down) ? Math.sign(sx) : 0;
  if (d !== 0 && d !== st.engaged) st.lane = nextLane(st, d);
  st.engaged = d;
  st.stick = sx;
}

// ---- moving

function moveSide(st) {
  const x0 = st.x;
  if (st.engaged) {
    const d = st.engaged;
    st.x += d * T.laneV * Math.max(T.laneMin, Math.abs(st.stick)) * DT;
    const nx = LANES[st.lane + d];
    if (nx !== undefined && (st.x - LANES[st.lane]) * d >= T.passOn) st.lane += d;
    st.x = Math.max(LANES[0], Math.min(LANES[2], st.x));
  } else {
    const dx = LANES[st.lane] - st.x;
    let step = Math.sign(dx) * Math.min(T.laneV, Math.max(T.settleMin, Math.abs(dx) * T.settleK)) * DT;
    if (Math.abs(step) > Math.abs(dx)) step = dx;
    st.x += step;
    if (Math.abs(LANES[st.lane] - st.x) < 1e-6) st.x = LANES[st.lane];
  }
  st.vx = (st.x - x0) / DT;
}

// How late the course is: how much further the nearest thing ahead of you is than planned (a bump makes you late; the
// chain keeps the spacing, so everything after it is late too).
function lateU(st) {
  let o = null;
  for (const x of st.obs) if (!x.done && x.retract === null && x.s > st.d && (!o || x.s < o.s)) o = x;
  if (!o) return 0;
  return Math.max(0, o.s - st.d - (dnAt(st, o.tm) - dnAt(st, st.t)));
}

function moveOn(st) {
  let vt = vNom(st, st.t);
  // in a rest the waves carry you on: a little faster while the course is late, so the folds stay with their surges
  if (st.moment === "waves" && vt < T.restV + 0.5 && st.t >= st.base + T.leadS) {
    const late = lateU(st);
    if (late > 1) vt += Math.min(T.catchV, T.catchK * late);
  }
  if (st.bumpT > 0) { st.v = Math.min(vt, T.bumpV); st.bumpT = Math.max(0, st.bumpT - DT); st.recover = true; }
  else if (st.recover && st.v < vt) st.v = Math.min(vt, st.v + T.recoverA * DT);   // back up to speed after a bump
  else { st.v = vt; st.recover = false; }
  st.d += st.v * DT;
}

// ---- passing things

// A tag rides with you (you carry it down the channel): beside you, toward the middle of the channel, rising a little;
// a second tag within 0.3 s sits higher, so two never cover each other. Nothing goes above you, where the HUD is.
function addPop(st, v, word = null, combo = 0) {
  const side = st.x > 1 ? -1 : 1;
  const stack = st.pops.filter((q) => st.t - q.t < 0.3).length;
  st.pops.push({ x: st.x + side * T.popSide, rel: 4 - 4.5 * stack, v, word, combo, t: st.t });
  while (st.pops.length > 12) st.pops.shift();
}
function addBurst(st, x, s, r, kind) {
  st.bursts.push({ x, s, r, kind, t: st.t, rot: (st.bursts.length * 1.7 + st.t * 3.1) % (Math.PI * 2) });
  while (st.bursts.length > 16) st.bursts.shift();
}
function addRing(st, x, s, r0, r1, a, dashed = false) {
  st.rings.push({ x, rel: s - st.d, r0, r1, a, dashed, t: st.t });
  while (st.rings.length > 6) st.rings.shift();
}
function points(st, part, add) {
  if (add > 0) emit(st, "points", { part, add: Math.round(add) });
}

function flowUp(st, x, s) {
  st.flow++;
  if (st.flow > st.bestFlow) st.bestFlow = st.flow;
  if (st.flow % T.flowEvery === 0) {
    addPop(st, 0, "birth.pop.flow", st.flow);
    emit(st, "sfx", { id: "birth.flow", pitch: Math.min(5, st.flow / T.flowEvery), gain: 0.6 });
  }
}

function bump(st, o) {
  o.bumped = true;
  o.bentAt = st.t;
  st.bumps++;
  st.bumpT = st.assist ? T.assist.bumpS : T.bumpS;
  st.v = Math.min(st.v, T.bumpV);
  st.blinkT = T.blinkS;
  st.flow = 0;
  st.shake = Math.min(1, st.shake + T.shakeBump);
  addBurst(st, st.x, st.d - 3, 3, 1);
  addRing(st, st.x, st.d, 4, 16, 0.55);
  emit(st, "sfx", { id: "birth.bump", pitch: 1, gain: 0.8 });
}

function passFold(st, o) {
  o.done = true;
  st.folds++;
  if (o.bumped) return;
  st.clean++;
  flowUp(st, st.x, st.d);
  if (o.tight) {
    addPop(st, 0, "birth.pop.tight");
    addBurst(st, st.x, st.d, 2.5, 2);
  }
}

// A gate: hit or missed as you pass it; its move plays now if its surge's end has not played it yet.
function passGate(st, o) {
  o.done = true;
  const g = st.gateSt[o.gate];
  if (g.done) return;
  const kind = T.gates[o.gate].kind;
  let hit;
  if (kind === "turn" || kind === "back") {
    const gx = LANES[o.open[0]], wide = st.assist ? T.assist.wideK : 1;
    hit = !o.bumped && fin(o.x0) && Math.abs(o.x0 - gx) <= T.gateHalf * wide + EPS;
  } else hit = !o.bumped;
  settleGate(st, o.gate, hit, st.x, o.s);
}

function settleGate(st, gi, hit, x, s) {
  const g = st.gateSt[gi];
  if (g.done) return;
  g.done = true;
  g.hit = hit;
  g.at = st.t;
  const def = T.gates[gi];
  if (hit) {
    st.gatesHit++;
    flowUp(st, x, s);
    points(st, "skill", T.gatePts);
    addPop(st, T.gatePts);
    addBurst(st, x, s, 6, 2);
    addBurst(st, x, s, 4, 0);
    addRing(st, x, s, 6, 30, 0.7);
    st.shake = Math.min(1, st.shake + T.shakeGate);
    emit(st, "sfx", { id: "birth.gate", pitch: 1 + 0.12 * gi, gain: 0.8 });
    doneBy(st, "gate" + gi, "you", def.done);
  } else {
    st.flow = 0;
    doneBy(st, "gate" + gi, "auto", "birth.anyway");
  }
  playMove(st, gi);
}

function playMove(st, gi) {
  if (st.moveAt[gi] !== null) return;
  st.moveAt[gi] = st.t;
  if (T.gates[gi].kind === "turn") st.turnDir = st.turnSide;
}

function take(st, b) {
  b.taken = true;
  b.at = st.t;
  st.got++;
  const room = T.score.bubbles - st.bubblePts;
  const add = Math.max(0, Math.min(room, T.bubblePts));
  st.bubblePts += add;
  points(st, "skill", add);
  if (add > 0) addPop(st, add);
  addBurst(st, b.x, b.s, T.bubbleR, 2);
  emit(st, "sfx", { id: "birth.bubble", pitch: 1 + 0.06 * (st.got % 6), gain: 0.6 });
}

function collide(st) {
  const r = st.tuckT > 0 ? T.tuckR : T.hitR;
  const free = st.t < st.graceUntil - EPS;
  for (const o of st.obs) {
    if (o.done || o.retract !== null) continue;
    const rel = o.s - st.d;                      // > 0 ahead of you
    if (rel > H + T.hitR) continue;
    if (o.x0 === null && rel <= 0) o.x0 = st.x;  // where you crossed its line
    if (rel < -(H + T.hitR)) { if (o.kind === "fold") passFold(st, o); else passGate(st, o); continue; }
    if (o.bumped || free) continue;
    const dy = Math.max(0, Math.abs(rel) - H);
    for (const [x0, x1] of o.rects) {
      const dx = Math.max(x0 - st.x, 0, st.x - x1);
      if (dx * dx + dy * dy < r * r) { bump(st, o); break; }
    }
  }
  const grab = T.bodyR + T.bubbleR;
  for (const b of st.bubbles) {
    if (b.taken || b.gone) continue;
    const rel = b.s - st.d;
    if (rel < -grab) { b.gone = true; continue; }
    if (rel < grab && Math.hypot(st.x - b.x, rel) < grab) take(st, b);
  }
  // what is far behind goes
  st.obs = st.obs.filter((o) => !(o.done && st.d - o.s > T.behindU) && !(o.retract !== null && st.t - o.retract > T.retractS));
  st.bubbles = st.bubbles.filter((b) => !((b.taken || b.gone) && (st.d - b.s > T.behindU || (b.taken && st.t - b.at > 0.5))));
}

// ---- the timeline

function warnWave(st, w) {
  emit(st, "sfx", { id: "birth.warn", at: w.warn, pitch: 1 + 0.03 * w.k, gain: 0.6 });
  const gi = T.gates.findIndex((g) => g.wave === w.k);
  if (gi >= 0) subgoal(st, "gate" + gi, T.gates[gi].text);
}

function surgeWave(st, w) {
  emit(st, "sfx", { id: "birth.swell", at: w.s, pitch: 1, gain: 0.7 + 0.04 * w.k, dur: T.surgeS, cutoffHz: T.filterHz,
    rumbleHz: T.rumbleHz.slice() });
  const last = w.k === T.waves - 1;              // the last wave pushes hardest
  st.shake = Math.min(1, st.shake + T.shakeSurge * (last ? 1.8 : 1));
  addRing(st, st.x, st.d, 10, last ? 60 : 44, last ? 0.55 : 0.35, true);
}

function endSurge(st, w) {
  emit(st, "sfx", { id: "birth.breath", at: w.e, pitch: 1, gain: 0.5 });
  const gi = T.gates.findIndex((g) => g.wave === w.k);
  if (gi >= 0) playMove(st, gi);                // each move plays on its wave, at the gate or by its end
}

function startLight(st) {
  st.moment = "light";
  st.lightAt = st.t;
  T.gates.forEach((g, gi) => { if (!st.gateSt[gi].done) settleGate(st, gi, false, st.x, st.d); });
  for (const o of st.obs) if (o.retract === null) o.retract = st.t;   // the folds fold back into the walls
  for (const b of st.bubbles) if (!b.taken) b.gone = true;
  addBurst(st, st.x, st.d - 4, 7, 2);
  addBurst(st, st.x, st.d - 4, 5, 0);
  addRing(st, st.x, st.d, 8, 70, 0.6);
  emit(st, "moment", { id: "light" });
  emit(st, "sfx", { id: "birth.open", at: st.t, pitch: 1, gain: 1, fromHz: T.filterHz, toHz: T.openHz, seconds: T.openS });
}

function captions(st) {
  T.captions.forEach((c, i) => {
    if (st.capDone[i]) return;
    let at = Infinity;
    if (Number.isInteger(c.wave)) at = st.waves[c.wave].s + c.after;
    else if (Number.isInteger(c.rest)) at = st.waves[c.rest].e + c.after;
    else if (Number.isInteger(c.gate)) {
      const g = st.gateSt[c.gate], gw = st.waves[T.gates[c.gate].wave];
      at = g.done ? g.at + c.after : gw.e + 1.0;             // the gate's crossing, or a second after its surge
    }
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
      if (!w.surged && t >= w.s - EPS) { w.surged = true; surgeWave(st, w); }
      if (!w.ended && t >= w.e - EPS) { w.ended = true; endSurge(st, w); }
    }
    captions(st);
    if (t >= st.wavesEnd - EPS) startLight(st);
  }
  if (st.moment === "light" && t >= st.lightAt + LIGHT_S - EPS) finish(st, "end");
}

// ---- the score

const foldPart = (st) => (st.folds > 0 ? Math.max(0, T.score.folds - T.score.perBump * st.bumps) : 0);
// while you ride, the HUD counts each clean fold against the folds planned, less each bump so far (never more than
// the end's share)
const liveFoldPart = (st) => Math.max(0, Math.round((T.score.folds * st.clean) / Math.max(1, st.planFolds, st.folds)) - T.score.perBump * st.bumps);
const flourishPart = (st) => Math.round(T.score.flourish * Math.min(1, st.bestFlow / T.score.flowFull));

function finish(st, how) {
  if (st.done) return;
  T.gates.forEach((g, gi) => { if (!st.gateSt[gi].done) settleGate(st, gi, false, st.x, st.d); });
  for (const id of Object.keys(st.subgoals)) if (st.subgoals[id] === "shown") doneBy(st, id, "auto", "birth.anyway");
  st.done = true;
  st.how = how;
  points(st, "skill", foldPart(st));
  points(st, "flourish", flourishPart(st));
  points(st, "goal", T.score.goal);
  emit(st, "milestone", { id: "born" });
  syncPrompt(st);
  emit(st, "done", {});
}

// ---- the prompt

function promptOf(st) {
  if (!st || st.done || st.moment !== "waves") return NONE;
  const t = st.t;
  let k = -1;
  for (let i = 0; i < st.waves.length; i++) if (t >= st.waves[i].warn - EPS) k = i;
  if (k < 0) return P_MOVE;
  const w = st.waves[k];
  const gi = T.gates.findIndex((g) => g.wave === k);
  if (gi >= 0 && !st.gateSt[gi].done) return st.gatePrompt[gi];
  if (t < w.e - EPS) return P_MOVE;
  return k === st.waves.length - 1 ? P_GO : P_REST;
}

function syncPrompt(st, force = false) {
  const p = promptOf(st);
  const q = st.lastPrompt;
  if (force || !q || q.gesture !== p.gesture || q.text !== p.text || q.keys !== p.keys) {
    st.lastPrompt = p;
    emit(st, "prompt", { gesture: p.gesture, text: p.text, keys: p.keys });
  }
}

// ---- the Stage interface

// (Re)start the waves at stage time `base`.
function init(st, base) {
  st.base = base;
  st.gen++;
  st.waves = makeWaves(base, st.assist);
  st.wavesEnd = base + WAVES_END_S;
  st.dn = makeDn(st);
  st.plan = planCourse(st);
  st.planFolds = st.plan.filter((it) => it.kind === "fold").length;
  st.pi = 0;
  st.lastLaid = null;
  st.obs = [];
  st.bubbles = [];
  st.moment = "waves";
  st.lightAt = null;
  st.capDone = T.captions.map(() => false);
  st.gateSt = T.gates.map(() => ({ done: false, hit: false, at: null }));
  st.moveAt = T.gates.map(() => null);
  st.gatePrompt = T.gates.map((g) => MOVE(g.text));
  st.turnDir = st.turnSide;
  st.v = vNom(st, st.t);
  st.folds = 0; st.clean = 0; st.gatesHit = 0; st.offered = 0; st.got = 0; st.bubblePts = 0;
  st.flow = 0; st.bestFlow = 0; st.bumps = 0; st.tucks = 0;
  spawn(st);
}

export function create(seed, carryIn, opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  const carry = mergeCarry(carryIn, null);
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const st = {
    id: meta.id, seed: seed >>> 0, t: 0, gaDay: meta.ga.start, fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: "waves",
    assist: !!o.assist, lag: fin(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry,
    base: 0, gen: 0, waves: [], wavesEnd: 0, dn: null, plan: [], planFolds: 0, pi: 0, lastLaid: null, obs: [], bubbles: [],
    lightAt: null, capDone: [], gateSt: [], moveAt: [], gatePrompt: [], turnSide: 1, turnDir: 1,
    // you
    x: 0, lane: 1, d: 0, v: T.restV, vx: 0, engaged: 0, stick: 0, swipe: true, recover: false,
    tuckT: 0, tuckAt: -Infinity, tuckQ: false, bumpT: 0, blinkT: 0, graceUntil: -Infinity,
    // the score
    folds: 0, clean: 0, gatesHit: 0, offered: 0, got: 0, bubblePts: 0, flow: 0, bestFlow: 0, bumps: 0, tucks: 0,
    // juice
    pops: [], bursts: [], rings: [], shake: 0,
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
  if (!st || typeof st !== "object" || !Array.isArray(st.waves) || !st.dn) return;
  if (!Array.isArray(st.events)) st.events = [];
  if (st.done) { st.t += DT; return; }
  const it = sane(intents);
  if (st.moment === "waves") {
    readInput(st, it);
    if (st.tuckQ && st.t >= st.tuckAt + T.tuckCdS - EPS) startTuck(st);
  }
  if (st.moment === "waves") moveSide(st);
  moveOn(st);
  st.t += DT;
  st.tuckT = Math.max(0, st.tuckT - DT);
  st.blinkT = Math.max(0, st.blinkT - DT);
  st.shake = Math.max(0, st.shake - 2.5 * DT);
  spawn(st);
  if (st.moment === "waves") collide(st);
  else st.obs = st.obs.filter((o) => !(o.retract !== null && st.t - o.retract > T.retractS));
  timeline(st);
  if (!st.done && st.t >= meta.capS - EPS) finish(st, "cap");
  if (!st.done) syncPrompt(st);
  const old = st.t - 1;
  if (st.pops.length && st.pops[0].t < old) st.pops = st.pops.filter((q) => st.t - q.t < T.popS);
  if (st.bursts.length && st.bursts[0].t < old) st.bursts = st.bursts.filter((q) => st.t - q.t < T.burstS);
  if (st.rings.length && st.rings[0].t < old) st.rings = st.rings.filter((q) => st.t - q.t < 0.8);
}

export function prompt(st) {
  return { ...promptOf(st) };
}

export function targets() {
  return [];
}

// ---- the view

// How far into a surge's push the speed is now (0 at rest, 1 at the surge's full speed).
function surgeShare(st, t) {
  const v = vNom(st, t);
  let top = T.restV;
  for (const w of st.waves) if (t >= w.warn - EPS) top = w.v;
  return top > T.restV ? clamp01((v - T.restV) / (top - T.restV)) : 0;
}
function progress(st, t) {
  if (st.moment !== "waves") return 1;
  return clamp01((t - st.base - T.leadS) / (WAVES_END_S - T.leadS));
}

function lerpSplats(a, b, q) {
  if (!(q > 0) || a.length !== b.length) return q > 0 ? b : a;
  return a.map((s, i) => {
    const u = b[i];
    return { ...s, x: lerp(s.x, u.x, q), y: lerp(s.y, u.y, q), x2: lerp(s.x2, u.x2, q), y2: lerp(s.y2, u.y2, q), r: lerp(s.r, u.r, q) };
  });
}

const moveQ = (st, gi, t) => (st.moveAt[gi] === null ? 0 : ease((t - st.moveAt[gi]) / T.moveS));

// You: head down toward the light. The Tuck gate tucks your chin, the Lift gate lifts your head, the Turn gate tips
// you toward its side and Turn back brings you round; a tuck curls you small for its time; you lean into lane moves.
function you(st, t) {
  const tuckG = moveQ(st, 0, t), turn = moveQ(st, 1, t), lift = moveQ(st, 2, t), back = moveQ(st, 3, t);
  let a = "headDown", b = "headDown", q = 0;
  if (lift > 0) { a = "tuck"; b = "lift"; q = lift; } else if (tuckG > 0) { b = "tuck"; q = tuckG; }
  // a tuck: in over 0.08 s, out over its last 0.12 s
  const tq = st.tuckT > 0 ? Math.min(clamp01((t - st.tuckAt) / 0.08), clamp01(st.tuckT / 0.12)) : 0;
  const size = T.figureU * (1 - (1 - T.tuckSize) * tq) * (st.blinkT > 0 ? 1 - 0.08 * Math.sin(Math.PI * st.blinkT / T.blinkS) : 1);
  const rot = st.turnSide * T.turnRad * turn * (1 - back) + T.lean * clamp01(Math.abs(st.vx) / T.laneV) * Math.sign(st.vx);
  const at = { x: st.x, y: -st.d, rot };
  const fig = (p) => figure(p, size, T.youGa, at);
  let splats = q >= 1 ? fig(b) : q > 0 ? lerpSplats(fig(a), fig(b), q) : fig(a);
  if (tq > 0) splats = lerpSplats(splats, fig("tuck"), tq);
  return { size, splats };
}

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

// The channel and everything in it, as one strip for render/runner.js (world units; y is −distance).
function runner(st, t, sv, inLight) {
  const wide = st.assist ? T.assist.wideK : 1;
  const flaps = [], posts = [], hoops = [], gaps = [], bubbles = [];
  for (const o of st.obs) {
    const y = -o.s;
    const rel = o.s - st.d;
    if (rel > T.aheadU + 10 || rel < -T.behindU) continue;
    const a = o.retract !== null ? 1 - clamp01((t - o.retract) / T.retractS) : 1;
    if (!(a > 0.01)) continue;
    const bend = o.bentAt !== null ? ease((t - o.bentAt) / 0.25) : 0;
    const gate = o.kind === "gate" ? T.gates[o.gate].kind : null;
    const g = o.kind === "gate" ? st.gateSt[o.gate] : null;
    const hit = g ? (g.done ? (g.hit ? 1 : 0) : -1) : -1;
    for (const f of o.flaps) {
      if (flaps.length >= 24) break;
      flaps.push({ y, side: f.side, tip: f.tip, h: H, a, bend, tone: f.tone, seed: (o.id * 7 + (f.side > 0 ? 3 : 0)) % 97 });
    }
    for (const p of o.posts) if (posts.length < 8) posts.push({ x0: p[0], x1: p[1], y, h: H, a, bend, seed: (o.id * 5 + posts.length) % 97 });
    if (o.tight && !o.done) {
      // how near it is (1 as you reach it, 0 from 1.2 s of travel out): its ring closes in and brightens
      const near = clamp01(1 - rel / (T.gapNearS * Math.max(st.v, T.restV)));
      const tucked = st.tuckT > 0 && Math.abs(rel) < H + T.hitR ? 1 : 0;
      if (gate === "tuck") for (const j of [0, 1, 2]) { if (gaps.length < 8) gaps.push({ x: LANES[j], y, w: 2 * o.half, a, near, tucked }); }
      else if (gaps.length < 8) gaps.push({ x: LANES[o.open[0]], y, w: 2 * o.half, a, near, tucked });
    }
    if (gate && hoops.length < 6) {
      const x = gate === "tuck" ? 0 : LANES[o.open[0]];
      const w = gate === "tuck" ? 2 * T.wallX : gate === "lift" ? 2 * o.half + 6 : 2 * T.gateHalf * wide + 6;
      hoops.push({ x, y, w, h: H, a, hit, kind: gate, on: hit === 1 ? ease((t - g.at) / 0.3) : 0 });
    }
  }
  for (const b of st.bubbles) {
    if (b.gone && !b.taken) continue;
    const rel = b.s - st.d;
    if (rel > T.aheadU + 10 || rel < -T.behindU) continue;
    const a = b.taken ? 1 - clamp01((t - b.at) / 0.25) : 1;
    if (!(a > 0.01) || bubbles.length >= 12) continue;
    bubbles.push({ x: b.x, y: -b.s + 0.6 * Math.sin(t * 3 + b.id), r: T.bubbleR * (b.taken ? 1 + 0.6 * (1 - a) : 1), a });
  }
  const press = inLight ? 0 : sv;
  return {
    kind: "runner", wallX: T.wallX, press, wallPress: T.wallPress, lanes: LANES.slice(), you: -st.d, v: st.v,
    speed: inLight ? 1 : clamp01((st.v - T.restV) / (T.surgeV[0] + T.surgeV[1] * (T.waves - 1) - T.restV)), flaps, posts, hoops, gaps, bubbles,
  };
}

export function view(st) {
  const d = emptyDraw(meta.id);
  if (!st || !Array.isArray(st.waves) || !st.waves.length || !st.beats || !st.dn) return d;
  const t = st.t;
  const youY = -st.d;
  const mm = mmPerShortAxis(meta, st.gaDay);
  // the camera pulls back a little with the waves' speed (a planned speed, so a bump never pumps it): more of the
  // way ahead in a fast surge, and you keep your place on screen
  const vTop = T.surgeV[0] + T.surgeV[1] * (T.waves - 1);
  const zk = 1 + T.zoomK * clamp01((vNom(st, t) - T.restV) / (vTop - T.restV));
  const span = T.span * zk;
  const camY = youY - T.camOff * zk;
  // (the short axis still reads as the stage's real scale, so the scale bar keeps its length as the camera pulls back)
  d.camera = { x: 0, y: camY, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = { mm: bar(mm) };

  const inLight = st.moment === "light" || (st.done && st.lightAt !== null);
  const lp = inLight && fin(st.lightAt) ? Math.max(0, t - st.lightAt) : 0;
  const sv = st.moment === "waves" ? surgeShare(st, t) : 0;
  const prog = progress(st, t);
  const me = you(st, t);
  // your heart beats in you (its splat swells on each beat)
  const pulse = Math.max(0, 1 - st.beats.phase("you", t) / 0.35) ** 2;
  for (const s of me.splats) if (s.v === 1) s.r *= 1 + 0.3 * pulse;
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

  d.strips.push(runner(st, t, sv, inLight));

  // the opening: a glow along the whole bottom edge that grows with each wave, then fills the screen
  const [r0, r1, rFull] = T.lightR;
  d.marks.push({ kind: "light", x: 0, y: camY - 70 * zk, r: zk * (inLight ? lerp(r1, rFull, ease(e)) : lerp(r0, r1, prog)),
    on: inLight ? 1 : lerp(T.lightOn0, 1, prog), pulse: inLight ? 0 : sv });
  // your soft light (it dims a little while a bump blinks you)
  if (!inLight) d.marks.push({ kind: "glow", x: st.x, y: youY, r: 11, on: st.blinkT > 0 ? 0.25 : 0.55 });

  // the gold arrows over the turn gates ahead
  let cue = inLight ? { x: 0, y: camY - 70 * zk } : { x: st.x, y: youY };
  if (!inLight) {
    for (const o of st.obs) {
      if (o.kind !== "gate" || o.done || o.retract !== null) continue;
      const kind = T.gates[o.gate].kind;
      if (kind !== "turn" && kind !== "back") continue;
      const rel = o.s - st.d;
      if (rel > T.aheadU || rel < 0) continue;
      const side = o.open[0] === 2 ? 1 : -1;
      const ax = LANES[o.open[0]], ay = -o.s + T.arrowAhead;
      d.marks.push({ kind: "arrow", x: ax, y: ay, r: 6, ang: side > 0 ? 0 : Math.PI, on: 1 });
      if (rel < 150) cue = { x: ax, y: ay };
    }
  }

  // the rings: her heart and yours on you; the coming surge's warning closing on you
  const R = T.ringR;
  d.rings.push({ id: "mother", kind: "mother", x: st.x, y: youY, r: R.mother, progress: clamp01(st.beats.phase("mother", t)) });
  if (!inLight && !st.done) {
    const next = st.waves.find((w) => t >= w.warn - EPS && t < w.s);
    if (next) {
      const a = clamp01((t - next.warn) / T.warnS);
      d.rings.push({ id: "wave", kind: "wave", x: st.x, y: youY, r: lerp(R.wave[0], R.wave[1], a), progress: a });
    }
  }

  // feedback rings (a bump's soft ring, a gate's, a surge's) and the rim sparks
  const items = [];
  for (const q of st.rings) {
    const u = clamp01((t - q.t) / 0.6);
    if (u >= 1) continue;
    items.push({ x: q.x, y: -(st.d + q.rel), r: lerp(q.r0, q.r1, ease(u)), a: q.a * (1 - u), dashed: q.dashed });
  }
  if (items.length) d.strips.push({ kind: "ripples", items });
  rimSparks(d, st.carry.sparks, st.x, youY, 0.45 * me.size, { t, span });

  // tags and paper flecks (DOM tags, never canvas text)
  d.action = {
    pops: st.pops.map((q) => {
      const u = clamp01((t - q.t) / T.popS);
      return { x: q.x, y: -(st.d + q.rel) + T.popRise * ease(u), v: q.v, a: 1 - u * u, combo: q.combo, word: q.word };
    }),
    bursts: st.bursts.map((q) => ({ x: q.x, y: -q.s, r: q.r, age: clamp01((t - q.t) / T.burstS), kind: q.kind, rot: q.rot })),
    shake: clamp01(st.shake),
  };

  d.anchor = { x: st.x, y: youY };
  d.cue = cue;
  return d;
}

// ---- the bot

// The lanes that pass an obstacle (the turn gates: their own lane), and whether it needs a tuck.
function passLanes(o) {
  if (o.kind === "gate") {
    const kind = T.gates[o.gate].kind;
    if (kind === "tuck") return { lanes: [0, 1, 2], tuck: true };
    if (kind === "lift") return { lanes: [1], tuck: true };
    return { lanes: o.open.slice(), tuck: false, also: [1] };
  }
  return { lanes: o.open.slice(), tuck: o.tight };
}

// design.md 5.8: the open lane of the next fold within 1.2 s of travel, its lane at a turn gate, a bubble when it is on
// the way; a tuck 0.15 s before a tight gap or a tuck or lift gate. Below skill 1 it sees each thing 0.4 s × (1 −
// skill) late, takes a wrong lane with chance 0.3 × (1 − skill) at each fold and gate, and its tuck wanders by
// 0.12 s × (1 − skill): draws per item, kept in r.mem. At skill 1 it keeps no memory and makes no draws.
export function botSteer(st, skill, r) {
  const zero = { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  if (!st || st.done || st.moment !== "waves" || !Array.isArray(st.obs)) return zero;
  const s = clamp01(fin(skill) ? skill : 0);
  if (s <= 0) return zero;
  const B = T.bot;
  let mem = null;
  if (s < 1 && typeof r === "function") {
    if (!r.mem || typeof r.mem !== "object") r.mem = {};
    mem = r.mem;
    if (mem.gen !== st.gen || mem.seed !== st.seed) { mem.gen = st.gen; mem.seed = st.seed; mem.seen = {}; mem.u = {}; }
  }
  const lag = B.lagS * (1 - s);
  const v = Math.max(st.v, 1);
  const look = B.lookS * v + H + T.hitR;
  const seen = (id, rel) => {
    if (!mem) return true;
    if (!(id in mem.seen)) mem.seen[id] = st.t;
    return st.t - mem.seen[id] >= lag - EPS;
  };
  const draws = (id) => {
    if (!mem) return [1, 0];
    if (!mem.u[id]) mem.u[id] = [r(), r()];
    return mem.u[id];
  };
  const ahead = st.obs.filter((o) => !o.done && o.retract === null && o.s - st.d > -(H + T.hitR) && o.s - st.d <= look)
    .sort((a, b) => a.s - b.s).filter((o) => seen(o.id));
  const cur = st.lane;
  let goal = cur, tuck = false;
  const o1 = ahead[0] || null, o2 = ahead[1] || null;
  if (o1) {
    const p1 = passLanes(o1), p2 = o2 ? passLanes(o2) : null;
    let lanes = p1.lanes;
    const [u, ju] = draws(o1.id);
    const wrong = u < B.wrong * (1 - s);
    if (wrong) {
      // a wrong lane: the blocked lane nearest you (or, at a turn gate, the middle; at a tuck gate, no tuck)
      const blocked = [0, 1, 2].filter((j) => !lanes.includes(j));
      if (o1.kind === "gate" && !p1.tuck) lanes = [1];
      else if (blocked.length) lanes = [blocked.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur))[0]];
    }
    // a bubble on the way: before o1 in a lane you can reach and leave in time, or after it in one of its lanes
    const rel1 = o1.s - st.d;
    let best = null, bestCost = Infinity;
    for (const j of lanes) {
      let cost = Math.abs(j - cur) * 1.0 + (p2 ? Math.min(...p2.lanes.map((x) => Math.abs(x - j))) * 0.6 : 0);
      for (const b of st.bubbles) {
        if (b.taken || b.gone) continue;
        const rb = b.s - st.d;
        if (rb > o1.s - st.d && (!o2 || rb < o2.s - st.d) && rb < look && b.lane === j && seen(-b.id)) cost -= 0.8;
      }
      if (cost < bestCost - EPS) { bestCost = cost; best = j; }
    }
    goal = best === null ? cur : best;
    if (!wrong) {
      for (const b of st.bubbles) {
        if (b.taken || b.gone || !seen(-b.id)) continue;
        const rb = b.s - st.d;
        if (rb <= 0 || rb >= rel1 - H - T.hitR) continue;
        const tb = rb / v, shift = Math.abs(LANES[b.lane] - st.x) / T.laneV + 0.08;
        const after = (rel1 - rb) / v, back = Math.min(...lanes.map((j) => Math.abs(j - b.lane))) * (18 / T.laneV) + 0.12;
        if (shift <= tb && back <= after) { goal = b.lane; break; }
      }
    }
    // the tuck, just before a tight gap or a tuck or lift gate (and while in its band)
    if (p1.tuck && !(wrong && o1.kind === "gate" && T.gates[o1.gate].kind === "tuck")) {
      const zone = 2 * (H + Math.sqrt(Math.max(0, T.hitR * T.hitR - (o1.half || 2.5) ** 2)));
      const tuckS = tuckLen(st);
      const lead = Math.max(0, Math.min(B.tuckLeadS, tuckS - zone / v - 0.04)) + (ju * 2 - 1) * B.tuckJitS * (1 - s);
      const tc = (rel1 - zone / 2) / v;
      if (tc <= lead && st.tuckT <= 0 && st.t >= st.tuckAt + T.tuckCdS - T.tuckBufS) tuck = true;
    }
  } else {
    // nothing in sight: a bubble, else the middle
    let bb = null;
    for (const b of st.bubbles) if (!b.taken && !b.gone && b.s > st.d && b.s - st.d < look && seen(-b.id) && (!bb || b.s < bb.s)) bb = b;
    goal = bb ? bb.lane : cur;
  }
  const dx = LANES[goal] - st.x;
  const sx = Math.abs(dx) < B.near ? 0 : Math.max(-1, Math.min(1, dx / B.k));
  return { steer: { x: sx, y: 0 }, dir: null, hold: false, dash: tuck };
}

export function probe() {
  return null;
}

// The score's mood (openspec/changes/first-breath-score/contract.md, "Mood"), by wave from its warning: 0 for waves 1
// and 2, 1 for waves 3 to 5, 2 for waves 6 to 8, and the tempo rises from 1 to 1.12 over the 8 waves (the engine moves
// it at a bar line); the light is 0 at the last tempo, under the light stinger's choir. These thresholds (waves 3 and
// 6, the top tempo 1.12) stay here as literals on purpose: they set only the music, so they sit beside the state they
// read and not in birth.tune.js (first-breath-score design 4). Pure and cheap (main.js reads it every 100 ms); it
// changes nothing.
export function mood(st) {
  if (!st || !Array.isArray(st.waves) || !st.waves.length) return { level: 0 };
  const n = st.waves.length;
  if (st.moment === "light" || st.done) return { level: 0, tempo: 1.12 };
  let k = -1;
  for (let i = 0; i < n; i++) if (st.t >= st.waves[i].warn - EPS) k = i;
  const tempo = 1 + 0.12 * Math.max(0, k) / Math.max(1, n - 1);
  return { level: k >= 5 ? 2 : k >= 2 ? 1 : 0, tempo: Math.round(tempo * 1000) / 1000 };
}

export function result(st) {
  const ok = !!(st && Array.isArray(st.waves));
  const done = !!(ok && st.done);
  const folds = ok ? (done ? foldPart(st) : liveFoldPart(st)) : 0;
  const gates = ok ? T.gatePts * st.gatesHit : 0;
  const bubbles = ok ? st.bubblePts : 0;
  const flourish = ok ? flourishPart(st) : 0;
  const score = clampScore({ goal: done ? T.score.goal : 0, skill: folds + gates + bubbles, flourish });
  return {
    done,
    goalMet: done,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "folds", label: "birth.part.folds", value: folds, max: T.score.folds },
      { id: "gates", label: "birth.part.gates", value: gates, max: T.score.gates },
      { id: "bubbles", label: "birth.part.bubbles", value: bubbles, max: T.score.bubbles },
      { id: "flourish", label: "birth.part.flow", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: ok ? {
      folds: st.folds, clean: st.clean, bumps: st.bumps, gates: st.gateSt.map((g) => (g.done ? g.hit : null)), gatesHit: st.gatesHit,
      bubbles: st.got, offered: st.offered, bestFlow: st.bestFlow, tucks: st.tucks, turnDir: st.turnDir, turnSide: st.turnSide,
      distance: st.d, moment: st.moment, how: st.how, ko: false, koAt: null, almost: null,
    } : { ko: false },
    carryOut: { turnDir: ok && st.turnDir === -1 ? -1 : 1 },
  };
}

// Fair resume (design.md 4.3): nothing bumps you for 1.2 s after Resume.
export function resume(st) {
  if (!st || st.done) return 0;
  st.graceUntil = st.t + T.graceS;
  return 0;
}

// jump("waves") starts the 8 waves and a fresh course from now (a test hook); jump("light") settles the gates and
// starts the light now, with nothing left in the channel.
export function jump(st, id) {
  if (!st || typeof st !== "object" || !Array.isArray(st.waves)) return false;
  if (id === "waves") {
    st.done = false;
    st.how = null;
    st.subgoals = {};
    st.pops = []; st.bursts = []; st.rings = [];
    init(st, st.t);
    emit(st, "moment", { id: "waves" });
    syncPrompt(st, true);
    return true;
  }
  if (id === "light") {
    st.done = false;
    st.how = null;
    startLight(st);
    st.obs = [];
    st.bubbles = [];
    syncPrompt(st, true);
    return true;
  }
  return false;
}
