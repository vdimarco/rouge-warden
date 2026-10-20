// First Breath: stage 1, The Race (`swim`): kart racing with battle royale knockouts on the v1 race (openspec change
// first-breath-action-genres, design.md 5.1; the v1 race is the archived v1 design 6.1), behind the Stage interface
// of v1 16.4. You are one sperm cell in a pack of 20: ride the waves through the womb, grab item boxes, dodge the white
// cells, squeeze through the gate, take the warm tube at the fork, drift through its six bends for boosts, draft behind
// rivals and slingshot past, rest on a glow wall to get ready, and stay ahead of the gates that close behind the pack
// (14, then 8, then 5 go on) and of the cool tide. The first three reach the meeting place. Nobody is harmed: a bump,
// a spark or goo only slows you, and a sperm that is out rests by the wall.
//
// The v1 race stays as built (its model was a port of the v1 race sim): the pack and its grid, steerBody with the v1
// numbers, the waves, the gate, the fork and cool loop, the tube's current, upstream bonus, warm lane and checkpoints,
// the glow walls, the bumps, the catch-up, the place slot. Its rules are measured in track coordinates: progress p
// along the centre line and x across it. swim.track.js lays that centre line in the world as lines and arcs, so the
// tube bends: a sperm moves along the line at v cos(θ) / (1 + k u) (the inside of a bend is shorter) and its heading,
// kept against the track, turns by −k per u of progress (a still heading drifts to the outside of a bend). The
// stick you give is a world vector (the camera turns with the track), turned into the track's frame at your place.
// Steering goes through core/lib/steer.js (Reynolds 1999) and the tube's current profile through core/lib/flow.js.
//
// The kart parts (design.md 5.1, swim.tune.js for the numbers):
// - Drift (Mario Kart): a press while you turn starts it; it charges blue, orange and pink while you keep turning to
//   its side; straightening, lifting or a press lets it go as a boost. While it lasts your path slides (it follows
//   your heading at 5 /s). The turn rate stays v1's 3.0 rad/s.
// - Items (Mario Kart): rows of 4 boxes; a box rolls an item by your place (the back of the pack gets the strong ones):
//   Spark (homes on the sperm ahead and spins it out), Shield, Rush, Warm glow (ready at once) and Goo (a slip blob).
//   A press while you swim straight uses it (desktop: E or Shift, or Space while straight).
// - Slipstream and slingshot (racing games): tuck in behind a rival to draft, then pull out for a boost.
// - Knockout gates (Mario Kart World's Knockout Tour, F-Zero 99): 14, then 8, then 5 go on; a gate closes at its
//   quota or its time, and every sperm behind it rests; the cool tide creeps up behind the pack and floods each gate.
// - White cells drift across the womb and spin you out.
// - The camera turns with the track (0.5 s ease) and looks further ahead in a bend.
//
// Stage choices where design.md 5.1 leaves a gap (noted for tasks.md):
// - The first `prompt` event goes out at t = 0 with gesture "move" and no text; the text follows at 0.3 s and the
//   stage reads the stick from 0.5 s. One live gesture per moment: move in womb, gate, fork and tube (a touch-down is
//   no press; a second finger, a quick second tap, Space, Enter, Z, E or Shift press); none in meet and carried, and
//   none once you are out.
// - A press carrying `item: true` (E or Shift) always uses the item. Any other press lets a drift go if one is on,
//   else starts a drift when you turn, else uses the item. A release lets a drift go (Space's keyup; a touch's lift
//   gives no release, but the stick falls under 0.15 and that lets it go too). In one-button mode the stage ignores
//   presses and releases and, while the button is held, drifts and uses items as botSteer at skill 1 would.
// - "Turning" is the stick 25° or more off your heading, or your heading turning at 0.45 rad/s or more in the world:
//   with the camera turning in a bend, your heading keeps up with a held stick, so the turn itself counts.
// - Moments never go back. When the third sperm reaches the meeting place, every sperm still racing rests, you too:
//   then you are out ("You were 4th of 20."), as at a gate. Out ends the stage OUT_S later, once the captions sent
//   are read (core/lib/rest.js), with metrics.capped, so Go on plays `carried` (as at the cap).
// - The tags under the place slot come as `race` events: { racing, of, gate: { n, first } | null, item, rolling }.
// - The Skill counts a Warm glow's ready for nothing (750 is for a glow wall); `sperm.glow` is 1 after either.
// - Your sperm's drawn heading is your heading, and while you drift you move along your sliding path, so the body
//   points into the bend as it slides.
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
import { noteCaptions, readBy } from "../lib/rest.js";
import { layTrack, curveAt, headingAt, worldOf, insideAt, bendNear } from "./swim.track.js";
import { TUNE } from "./swim.tune.js";
import { FACTS } from "./swim.facts.js";
import { TEXT } from "./swim.text.js";

const T = TUNE;
const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "swim", index: 0, name: "The Race", verb: "Race",
  orient: "long",
  families: Object.freeze(["steer", "tap"]),
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
const HALF_PI = Math.PI / 2;
const ZERO = Object.freeze({ x: 0, y: 0 });
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(Number.isFinite(v) ? v : 0, 0, 1);
const lerp = (a, b, f) => a + (b - a) * f;
const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };
const OF = T.RACERS;
const ITEM_IDS = Object.freeze(["spark", "shield", "rush", "glow", "goo"]);
// the sound a used item makes (ui/sound.js ids): a whoosh for a boost, the ready chime for a shield
const ITEM_SFX = Object.freeze({ spark: "swish", shield: "ready", rush: "whoom", glow: "whoom", goo: "swish" });

// ---------------------------------------------------------------- the course

// Half the passage width at progress p, before the split.
function halfAt(p) {
  if (p < T.WOMB_END) return T.WOMB_HALF;
  if (p < T.GATE_END) return lerp(T.WOMB_HALF, T.GATE_HALF, (p - T.WOMB_END) / (T.GATE_END - T.WOMB_END));
  if (p < T.FORK) return T.GATE_HALF;
  return lerp(T.GATE_HALF, T.MOUTH, clamp((p - T.FORK) / (T.SPLIT - T.FORK), 0, 1));
}
// The warm lane's centre from the tube's centre at progress p: v1's drift on the straights, eased to the inside of
// each bend (the racing line).
function laneAt(st, p, t) {
  const w = insideAt(st.trk, p, T.LANE_RAMP);
  return T.LANE_DRIFT * Math.sin(2 * Math.PI * T.LANE_HZ * t) * (1 - Math.abs(w)) + w * T.LANE_IN;
}
const glowSide = (i) => (i % 2 === 0 ? -1 : 1);                                   // the tube's left wall, right, left
const glowAt = (st, i) => ({ x: st.xc + glowSide(i) * T.TUBE_HALF, p: T.GLOWS[i] });
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
function spanAt(p) {
  if (p < T.WOMB_END) return T.SPAN_WOMB;
  return lerp(T.SPAN_WOMB, T.SPAN_TUBE, smooth((p - T.WOMB_END) / (T.GATE_END - T.WOMB_END)));
}
// The course's centre across (x) at progress p: the womb and gate at 0, easing to the warm tube's centre at the split.
function centreAt(st, p) {
  if (p <= T.FORK) return 0;
  return st.xc * clamp((p - T.FORK) / (T.SPLIT - T.FORK), 0, 1);
}

// Track and world. The track's heading phi at p (π/2, world +y, before the first bend), its curvature, a track point
// in the world, and a vector turned between the world and the track's frame at p.
const phiOf = (st, p) => (p < st.bend0 ? HALF_PI : headingAt(st.trk, p));
const kOf = (st, sp) => (sp.zone === "tube" && sp.p >= st.bend0 ? curveAt(st.trk, sp.p) : 0);
function W(st, x, p) {
  return p < st.bend0 ? { x, y: p, phi: HALF_PI } : worldOf(st.trk, st.xc, x, p);
}
function turnVec(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y };
}
const toTrack = (st, v, p) => turnVec(v, HALF_PI - phiOf(st, p));
const toWorldVec = (st, v, p) => turnVec(v, phiOf(st, p) - HALF_PI);

// The cool loop as drawn: the cool mouth's centre line curls round on its own side (three quarters of a circle of
// radius LOOP_R about C), then runs back along 1,300 u to the gate's cool edge. A sperm's loop distance s (0..160)
// maps onto it by share of length; w is its offset across the loop (± 17). The loop is before the first bend, so its
// points are world points.
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

function makeSperm(id, skill, slot, r, items) {
  const you = id === "you";
  return {
    id, you, skill, m: you ? null : T.M0 + T.M1 * skill, r, items,
    x: slot.x, p: slot.p, ang: HALF_PI, vang: HALF_PI, wang: HALF_PI, wrate: 0,
    speed: 0, stick: ZERO, mag: 0, catchF: 1,
    zone: "path", loopS: 0, loopW: 0, lastCheck: -1e9, touch: false,
    attached: null, glow: -1, beatIx: 0, beats: 0, ready: false, readyAt: null, readyHow: null,
    bumpAt: -1e9, bumps: 0, rest: null, plan: null, loops: 0, out: false, outT: null, outBy: null, lifted: false,
    arrived: false, arriveT: null, place: null, maxP: slot.p, rank: 0,
    waves: [], rideS: 0, laneS: 0, tubeS: 0, phase: 0,
    // the kart parts
    drift: null, bendDrift: -1, boosts: [], boostN: 0, drifts: [0, 0, 0],
    slipS: 0, slipOn: false, slipLead: null, slings: 0,
    slowK: 1, slowUntil: -1e9, spinAt: -1e9, spins: 0, cellSafe: -1e9,
    item: null, roll: null, shieldUntil: -1e9, used: 0, hits: 0, gooHits: 0,
    passed: [false, false, false],
  };
}

const progOf = (sp) => (sp.arrived ? T.TUBE_END : sp.zone === "loop" ? T.FORK : sp.p);
const racing = (sp) => !sp.out && !sp.arrived;
const swimming = (sp) => !sp.out && !sp.arrived && !sp.attached && (sp.mag >= T.SWIM_STICK || sp.speed >= T.SWIM_SPEED);
const thOf = (sp) => wrapAngle(HALF_PI - sp.ang);          // heading from forward (+p), clockwise toward +x
const idOf = (sp) => (sp.you ? "you" : sp.id);
const shielded = (st, sp) => st.t < sp.shieldUntil;

// ---------------------------------------------------------------- steering (botSteer, also the rivals' policy)

// Reynolds separation: a lateral shift away from the nearest swimming sperm within 12 u ahead.
function separation(st, sp) {
  let best = null, bd = T.SEP;
  for (const o of st.all) {
    if (o === sp || o.zone === "loop" || o.zone !== sp.zone || !swimming(o)) continue;
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

// An open item box near the row ahead, for a sperm with no item: its x, or null.
function boxAim(st, sp) {
  if (sp.item || sp.roll) return null;
  let best = null, bd = Infinity;
  for (const b of st.boxes) {
    const dp = b.p - sp.p;
    if (dp < 2 || dp > T.BOT_BOX_LOOK || b.back > st.t + dp / 80) continue;
    const d = Math.abs(b.x - sp.x);
    if (d < bd) { bd = d; best = b; }
  }
  return best ? best.x : null;
}

// A shift of the aim away from a white cell in the way (womb only), by skill.
function cellDodge(st, sp, tx, skill) {
  if (skill < T.BOT_CELL || sp.zone !== "path" || sp.p > T.WOMB_END) return tx;
  for (const c of st.cells) {
    const dp = c.p - sp.p;
    if (dp < -T.CELL_R || dp > T.BOT_CELL_LOOK) continue;
    const cx = c.x + c.dir * T.CELL_SPEED * Math.max(0, dp) / 70;      // where it will be as you pass
    const room = T.CELL_R + T.HEAD_R + 5;
    if (Math.abs(tx - cx) < room) tx = cx + (tx >= cx ? 1 : -1) * room * Math.min(1, skill + 0.3);
  }
  return clamp(tx, -halfAt(sp.p) + 6, halfAt(sp.p) - 6);
}

// Drafting on a straight in the tube: tuck in behind the nearest sperm ahead, then pull out once the slingshot is on.
function draftAim(st, sp, tx, skill) {
  if (skill < T.BOT_DRAFT || sp.zone !== "tube" || bendNear(st.trk, sp.p, 40)) return tx;
  let lead = null, bd = T.SLIP_LEN;
  for (const o of st.all) {
    if (o === sp || o.zone !== "tube" || !swimming(o)) continue;
    const dp = o.p - sp.p;
    if (dp <= 2 * T.HEAD_R + 4 || dp > bd || Math.abs(o.x - sp.x) > 12) continue;
    bd = dp; lead = o;
  }
  if (!lead) return tx;
  if (sp.slipS >= T.SLING_AFTER_S) return lead.x + (lead.x >= st.xc ? -1 : 1) * (T.SLIP_W + 4);
  return lead.x;
}

// The stick this step, before the lag. pick = { side: the mouth it takes (±1), wall: the glow it rests on, or −1 }.
// Sticks are track vectors: x across, y forward.
function aimNow(st, sp, skill, pick, mem) {
  const m = T.M0 + T.M1 * skill;
  if (sp.attached === "glow" && !sp.ready) return ZERO;
  if (sp.zone === "loop") return { x: 0, y: m };
  let tx, look, lim, sep = true;
  if (sp.zone === "path" && sp.p < T.WOMB_END) {
    const k = waveNear(st.t, sp.p), c = st.cen[k] ?? 0, h = T.WAVE_HALF;
    if ((st.thr[k] ?? 1) < T.RIDE0 + T.RIDE1 * skill) tx = clamp(sp.x, c - h + T.RIDE_IN, c + h - T.RIDE_IN);
    else if (waveFront(k, st.t) >= sp.p - T.MISS_AHEAD) return ZERO;   // a wave it does not ride: let go as it passes
    else tx = sp.x;
    const bx = boxAim(st, sp);
    if (bx !== null && Math.abs(bx - tx) < 30) tx = bx;
    tx = cellDodge(st, sp, tx, skill);
    look = 40; lim = 40 * DEG;
  } else if (sp.zone === "path") {
    tx = pick.side * clamp(halfAt(sp.p + 30) - 8, 0, T.TUBE_HALF);
    look = 30; lim = 60 * DEG;
  } else {
    if (pick.wall >= 0 && !sp.ready && !mem.passed) {
      const gp = T.GLOWS[pick.wall];
      if (sp.p > gp + T.GLOW_R) mem.passed = true;
      else if (sp.p >= gp - T.GLOW_LOOK) {
        const dx = st.xc + glowSide(pick.wall) * T.TUBE_HALF - sp.x, dp = gp - sp.p;
        if (Math.hypot(dx, dp) <= T.LET_GO) return ZERO;
        const a = Math.atan2(dx, dp) + mem.noise;
        return { x: Math.sin(a) * m, y: Math.cos(a) * m };
      }
    }
    tx = st.xc + laneAt(st, sp.p + 20, st.t) + mem.aim;
    const bx = boxAim(st, sp);
    if (bx !== null) { tx = bx; sep = false; }
    else {
      const d = draftAim(st, sp, tx, skill);
      if (d !== tx) { tx = d; sep = false; }
    }
    look = 40; lim = 20 * DEG;
  }
  if (sep) tx += separation(st, sp);
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

// The kart choices at `skill` (the rivals', botSteer's and one-button's): hold a drift through a bend's entry until
// orange (pink at B3 and B6 from skill 0.9), and use the item you hold: a Shield or a Warm glow at once, a Spark when
// a sperm is within 100 u ahead, a Rush on a straight, Goo when a sperm is within 40 u behind. Items wait for a
// straight, so the press is not read as a drift.
function kartPlan(st, sp, skill) {
  const out = { hold: false, item: false };
  if (!racing(sp) || sp.attached || sp.zone === "loop" || st.t < T.START_S) return out;
  if (skill >= T.BOT_DRIFT && sp.zone === "tube") {
    const b = bendNear(st.trk, sp.p, 0);
    if (b && sp.drift) {
      const want = skill >= T.BOT_PINK && T.BOT_PINK_BENDS.includes(b.i) ? 3 : 2;
      out.hold = sp.drift.level < want && sp.p < b.p1 - 4;
    } else if (b && sp.bendDrift !== b.i && sp.p < b.p0 + 0.45 * (b.p1 - b.p0)) {
      out.hold = Math.abs(sp.wrate) >= T.DRIFT_RATE + 0.05 && sp.speed >= T.DRIFT_SPEED + 5 && !(st.t < sp.slowUntil);
    }
  }
  if (sp.item && !sp.roll && !sp.drift && !out.hold && Math.abs(sp.wrate) < T.DRIFT_KEEP_RATE && driftSide(st, sp) === 0) {
    const pa = progOf(sp);
    const near = (lo, hi) => st.all.some((o) => o !== sp && racing(o) && o.zone !== "loop" && progOf(o) - pa > lo && progOf(o) - pa <= hi);
    switch (sp.item) {
      case "shield": case "glow": out.item = true; break;
      case "spark": out.item = near(2, T.BOT_SPARK_AHEAD); break;
      case "rush": out.item = !bendNear(st.trk, sp.p, 60) || sp.zone === "path"; break;
      case "goo": out.item = near(-T.BOT_GOO_BEHIND, -2); break;
      default: break;
    }
  }
  return out;
}

// A sperm that is out: its stick eases to 0 toward the nearest wall over REST_SLOW_S (v1's slow-down).
function restStick(st, sp) {
  const m = sp.m || T.M0 + T.M1 * 0.5;
  const f = Math.max(0, 1 - (st.t - sp.rest) / T.REST_SLOW_S);
  const c = sp.zone === "tube" ? st.xc : 0;
  const dir = sp.x >= c ? 1 : -1;
  return { x: dir * 0.9 * m * f, y: 0.44 * m * f };
}

// The rival policy: botSteer at its skill, with the three rival choices of v1, and the kart choices.
function rivalTurn(st, sp) {
  if (sp.out) { sp.stick = restStick(st, sp); return; }
  if (sp.plan === null && sp.p >= T.WOMB_END) sp.plan = sp.r() < T.COOL * (1 - sp.skill) ? "cool" : "warm";
  const side = sp.plan === "cool" && sp.loops === 0 ? -st.warm : st.warm;
  sp.stick = steerFor(st, sp, sp.skill, sp.r, { side, wall: sp.id < T.FRONT ? 0 : -1 });
  sp.mag = Math.min(1, Math.hypot(sp.stick.x, sp.stick.y));
  const a = kartPlan(st, sp, sp.skill);
  if (a.hold && !sp.drift) { const s = driftSide(st, sp); if (s) startDrift(st, sp, s); }
  else if (!a.hold && sp.drift && sp.skill >= T.BOT_DRIFT) endDrift(st, sp, true);
  if (a.item) useItem(st, sp);
}

// ---------------------------------------------------------------- drift, boosts, slipstream

// The way you turn now: the stick's angle off your heading, and your heading's turn in the world (rad/s).
function turnOf(sp) {
  const off = sp.mag >= T.SWIM_STICK ? wrapAngle(Math.atan2(sp.stick.y, sp.stick.x) - sp.ang) : 0;
  return { off, rate: sp.wrate };
}
const canSlide = (st, sp) => racing(sp) && !sp.attached && sp.zone !== "loop" && sp.speed >= T.DRIFT_SPEED && !(st.t < sp.slowUntil);
// The side a press would drift to now (+1 left, −1 right), or 0 when you are not turning.
function driftSide(st, sp) {
  if (!canSlide(st, sp)) return 0;
  const { off, rate } = turnOf(sp);
  if (Math.abs(off) >= T.DRIFT_START_DEG * DEG) return Math.sign(off);
  if (Math.abs(rate) >= T.DRIFT_RATE) return Math.sign(rate);
  return 0;
}
function startDrift(st, sp, side) {
  sp.drift = { side, t0: st.t, charge: 0, level: 0, straight: 0, puff: st.t };
  sp.vang = sp.ang;
  if (sp.zone === "tube") { const b = bendNear(st.trk, sp.p, 30); if (b) sp.bendDrift = b.i; }
  if (sp.you) {
    st.flags.drifting = true;
    emit(st, "sfx", { id: "swish", at: st.t, pitch: 1.2, gain: 0.5 });
  }
}
function driftStep(st, sp) {
  const d = sp.drift;
  if (!d) return;
  if (!racing(sp) || sp.attached || sp.zone === "loop" || st.t < sp.slowUntil) { endDrift(st, sp, false); return; }
  const { off, rate } = turnOf(sp);
  if (off * d.side >= T.DRIFT_KEEP_DEG * DEG || rate * d.side >= T.DRIFT_KEEP_RATE) d.charge += DT;
  let lv = 0;
  for (const s of T.DRIFT_LEVELS) if (d.charge >= s - 1e-9) lv++;
  if (lv > d.level) {
    d.level = lv;
    puff(st, sp, lv, true);
    if (sp.you) emit(st, "sfx", { id: "pling", at: st.t, pitch: [1, 1.26, 1.5][lv - 1], gain: 0.5 });
  } else if (lv > 0 && st.t - d.puff >= T.PUFF_S - 1e-9) puff(st, sp, lv, false);
  if (sp.mag < T.DRIFT_LIFT) { endDrift(st, sp, true); return; }
  if (Math.abs(off) <= T.DRIFT_STRAIGHT_DEG * DEG && Math.abs(rate) < T.DRIFT_STRAIGHT_RATE) d.straight += DT;
  else d.straight = 0;
  if (d.straight >= T.DRIFT_STRAIGHT_S - 1e-9) endDrift(st, sp, true);
}
function endDrift(st, sp, boost) {
  const d = sp.drift;
  sp.drift = null;
  if (!d || !boost || d.level < 1) return;
  const [v, dur] = T.DRIFT_BOOST[d.level - 1];
  addBoost(st, sp, v, dur, d.level);
  sp.boostN += T.DRIFT_COUNT[d.level - 1];
  sp.drifts[d.level - 1]++;
  if (sp.you) {
    st.flags.drifted = true;
    emit(st, "sfx", { id: "whoom", at: st.t, pitch: [1, 1.12, 1.25][d.level - 1], gain: 0.75 });
    emit(st, "boost", { kind: "drift", level: d.level });
    fx(st, sp, "boost", d.level);
    payKart(st);
  }
}
// Drift confetti at the tail: 1, 2 or 3 pieces a puff for blue, orange and pink (sperm near you only).
function puff(st, sp, level, big) {
  if (sp.drift) sp.drift.puff = st.t;
  const yp = st.you;
  if (!sp.you && (Math.abs(sp.p - yp.p) > T.DRAW_RANGE || sp.zone !== yp.zone)) return;
  fx(st, sp, big ? "level" : "puff", level);
}
// A visual effect at a sperm (its tail for puffs): kept for 0.7 s in st.fx for the view.
function fx(st, sp, kind, n = 1) {
  const q = posOf(st, sp);
  const back = kind === "puff" || kind === "level" ? T.LEN * 0.55 : 0;
  st.fx.push({ kind, n, t: st.t, x: q.x - Math.cos(q.ang) * back, y: q.y - Math.sin(q.ang) * back, ang: q.ang,
    seed: (st.fxN = (st.fxN + 1) % 997), you: sp.you });
  if (st.fx.length > T.FX_MAX) st.fx.shift();
}
function addBoost(st, sp, v, dur, kind) {
  sp.boosts.push({ v, t0: st.t, dur, kind });
  if (sp.boosts.length > 4) sp.boosts.shift();
}
function boostNow(st, sp) {
  let s = 0;
  for (const b of sp.boosts) {
    const u = (st.t - b.t0) / b.dur;
    if (u >= 0 && u < 1) s += b.v * (1 - u * u);
  }
  return s;
}

// Slipstream: within 30 u behind a swimming sperm, in its 6 u wake, headings within 15°, both at 40 u/s or more.
function slipstream(st) {
  for (const sp of st.all) {
    if (!swimming(sp) || sp.zone === "loop" || sp.speed < T.SLIP_SPEED) { endSlip(st, sp); continue; }
    let lead = null, best = T.SLIP_LEN;
    for (const o of st.all) {
      if (o === sp || o.zone !== sp.zone || !swimming(o) || o.speed < T.SLIP_SPEED) continue;
      const dp = o.p - sp.p;
      if (dp <= 2 * T.HEAD_R || dp > best || Math.abs(o.x - sp.x) > T.SLIP_W) continue;
      if (Math.abs(wrapAngle(o.ang - sp.ang)) > T.SLIP_DEG * DEG) continue;
      best = dp; lead = o;
    }
    if (lead) {
      sp.slipS += DT;
      sp.slipLead = lead;
      const on = sp.slipS >= T.SLIP_AFTER_S - 1e-9;
      if (on && !sp.slipOn && sp.you) emit(st, "sfx", { id: "swish", at: st.t, pitch: 0.8, gain: 0.3 });
      sp.slipOn = on;
    } else endSlip(st, sp);
  }
}
function endSlip(st, sp) {
  const L = sp.slipLead;
  if (sp.slipS >= T.SLING_AFTER_S - 1e-9 && L && racing(sp) && Math.abs(L.p - sp.p) < 45) {
    addBoost(st, sp, T.SLING[0], T.SLING[1], "sling");
    sp.slings++;
    if (sp.you) {
      emit(st, "sfx", { id: "whoom", at: st.t, pitch: 1.35, gain: 0.6 });
      emit(st, "boost", { kind: "sling" });
      fx(st, sp, "boost", 1);
      payKart(st);
    }
  }
  sp.slipS = 0; sp.slipOn = false; sp.slipLead = null;
}

// ---------------------------------------------------------------- items, white cells, hits

// Roll an item by place (the band of the place at the roll), from the sperm's own item stream.
function rollItem(st, sp) {
  let place = sp.rank || OF;
  if (sp.you && st.assist) place = Math.min(OF, place + T.ASSIST_ROLL);
  const row = T.ITEMS.find((b) => place <= b[0]) || T.ITEMS[T.ITEMS.length - 1];
  const table = row[1];
  let sum = 0;
  for (const id of ITEM_IDS) sum += table[id] || 0;
  let v = sp.items() * sum;
  for (const id of ITEM_IDS) { v -= table[id] || 0; if (v < 0) return id; }
  return ITEM_IDS.find((id) => table[id]) || "rush";
}
function boxes(st) {
  for (const b of st.boxes) {
    if (b.back > st.t) continue;
    for (const sp of st.all) {
      if (!racing(sp) || sp.zone === "loop" || sp.item || sp.roll || sp.attached) continue;
      if (Math.abs(sp.p - b.p) > T.BOX_R + T.HEAD_R || Math.hypot(sp.x - b.x, sp.p - b.p) > T.BOX_R + T.HEAD_R) continue;
      b.back = st.t + T.BOX_BACK_S;
      b.takenAt = st.t;
      sp.roll = { until: st.t + T.ROLL_S, item: rollItem(st, sp) };
      if (sp.you) {
        emit(st, "sfx", { id: "sparkle", at: st.t, pitch: 1, gain: 0.6 });
        emit(st, "item", { kind: "roll" });
      }
      break;
    }
  }
  for (const sp of st.all) {
    if (sp.roll && st.t >= sp.roll.until - 1e-9) {
      sp.item = sp.roll.item;
      sp.roll = null;
      if (sp.you) {
        emit(st, "sfx", { id: "pling", at: st.t, pitch: 1.5, gain: 0.45 });
        emit(st, "item", { kind: "got", item: sp.item });
        if (!st.flags.firstItemT) st.flags.firstItemT = st.t;
      }
    }
  }
}
// The sperm a spark homes on: the nearest racer ahead within 150 u along the track (not in the cool loop).
function sparkTarget(st, sp, from) {
  let best = null, bd = T.SPARK_RANGE;
  for (const o of st.all) {
    if (o === sp || !racing(o) || o.zone === "loop" || (sp.zone === "tube" && o.zone !== "tube")) continue;
    const dp = o.p - from;
    if (dp <= 0 || dp > bd) continue;
    bd = dp; best = o;
  }
  return best;
}
function useItem(st, sp) {
  if (!sp.item || sp.roll || !racing(sp) || sp.zone === "loop") return false;
  const it = sp.item;
  sp.item = null;
  sp.used++;
  if (it === "spark") {
    if (st.sparks.length >= T.SPARKS_MAX) st.sparks.shift();
    const x = sp.x + Math.cos(sp.ang) * 4, p = sp.p + Math.sin(sp.ang) * 4;
    st.sparks.push({ x, p, a: sp.ang, owner: sp, target: sparkTarget(st, sp, sp.p), t0: st.t, zone: sp.zone });
  } else if (it === "shield") sp.shieldUntil = st.t + T.SHIELD_S;
  else if (it === "rush" || (it === "glow" && sp.ready)) addBoost(st, sp, T.RUSH[0], T.RUSH[1], "rush");
  else if (it === "glow") { sp.ready = true; sp.readyAt = st.t; sp.readyHow = "item"; }
  else if (it === "goo") {
    if (st.goos.length >= T.GOO_MAX) st.goos.shift();
    const x = sp.x - Math.cos(sp.ang) * T.GOO_BACK, p = sp.p - Math.sin(sp.ang) * T.GOO_BACK;
    st.goos.push({ x, p, owner: sp, t0: st.t, zone: sp.zone });
  }
  if (sp.you) {
    st.flags.usedItem = true;
    emit(st, "item", { kind: "use", item: it });
    emit(st, "sfx", { id: ITEM_SFX[it] || "swish", at: st.t, pitch: 1.1, gain: 0.6 });
    if (it === "rush" || it === "glow") fx(st, sp, "boost", 2);
  }
  return true;
}
// A hit on a sperm: a shield takes it; else a spin-out (sparks, white cells) or a slip (goo). Returns true when it
// took the hit itself.
function hitSperm(st, sp, kind) {
  if (!racing(sp)) return false;
  if (shielded(st, sp)) {
    sp.shieldUntil = -1e9;
    fx(st, sp, "shield", 1);
    if (sp.you) emit(st, "sfx", { id: "bounce", at: st.t, pitch: 1.2, gain: 0.5 });
    return false;
  }
  const spin = kind !== "goo";
  const dur = spin ? (sp.you && st.assist ? T.ASSIST_SPIN_S : T.SPIN_S) : T.GOO_SLIP_S;
  sp.slowK = spin ? T.SPIN_K : T.GOO_K;
  sp.slowUntil = st.t + dur;
  sp.spinAt = spin ? st.t : -1e9;
  sp.spins++;
  sp.speed *= sp.slowK;
  if (sp.drift) endDrift(st, sp, false);
  fx(st, sp, spin ? "spin" : "slip", 1);
  if (sp.you) {
    emit(st, "sfx", { id: "slip", at: st.t, pitch: 1, gain: 0.6 });
    emit(st, "spin", { kind });
  }
  return true;
}
function sparksStep(st) {
  for (let i = st.sparks.length - 1; i >= 0; i--) {
    const s = st.sparks[i];
    if (st.t - s.t0 >= T.SPARK_LIFE_S || !(Number.isFinite(s.x) && Number.isFinite(s.p))) { st.sparks.splice(i, 1); continue; }
    if (s.target && !racing(s.target)) s.target = sparkTarget(st, s.owner, s.p);
    const tg = s.target;
    if (tg && tg.zone !== "loop") s.a = turnTo(s.a, Math.atan2(tg.p - s.p, tg.x - s.x), T.SPARK_TURN * DT);
    const k = s.zone === "tube" && s.p >= st.bend0 ? curveAt(st.trk, s.p) : 0;
    const g = k ? 1 / Math.max(0.3, 1 + k * (s.x - st.xc)) : 1;
    s.x += T.SPARK_SPEED * Math.cos(s.a) * DT;
    const dp = T.SPARK_SPEED * Math.sin(s.a) * DT * g;
    s.p += dp;
    if (k) s.a = wrapAngle(s.a - k * dp);
    if (s.zone === "path" && s.p >= T.SPLIT) s.zone = s.x * st.warm > 0 ? "tube" : "gone";
    const lo = s.zone === "tube" ? st.xc - T.TUBE_HALF : -halfAt(s.p), hi = s.zone === "tube" ? st.xc + T.TUBE_HALF : halfAt(s.p);
    if (s.x < lo || s.x > hi || s.zone === "gone") { st.sparks.splice(i, 1); continue; }
    if (tg && racing(tg) && Math.hypot(tg.x - s.x, tg.p - s.p) <= T.HEAD_R + T.SPARK_R + 0.6) {
      st.sparks.splice(i, 1);
      if (hitSperm(st, tg, "spark") && s.owner.you && !tg.you) {
        s.owner.hits++;
        emit(st, "sfx", { id: "bounce", at: st.t, pitch: 0.9, gain: 0.7 });
        payKart(st);
      }
    }
  }
}
const turnTo = (a, b, max) => { const d = wrapAngle(b - a); return wrapAngle(a + clamp(d, -max, max)); };
function goosStep(st) {
  for (let i = st.goos.length - 1; i >= 0; i--) {
    const g = st.goos[i];
    if (st.t - g.t0 >= T.GOO_S) { st.goos.splice(i, 1); continue; }
    for (const sp of st.all) {
      if (!racing(sp) || sp.zone !== g.zone || sp.attached) continue;
      if (sp === g.owner && st.t - g.t0 < T.GOO_SAFE_S) continue;
      if (Math.abs(sp.p - g.p) > T.GOO_R + T.HEAD_R || Math.hypot(sp.x - g.x, sp.p - g.p) > T.GOO_R + T.HEAD_R) continue;
      st.goos.splice(i, 1);
      if (hitSperm(st, sp, "goo") && g.owner.you && !sp.you) { g.owner.gooHits++; payKart(st); }
      break;
    }
  }
}
// White cells: slow drifts across the womb, bouncing off its walls; touching one spins you out.
function cellAt(st, c) {
  const span = 2 * (T.WOMB_HALF - T.CELL_R - 2);
  let u = ((c.x0 + T.WOMB_HALF - T.CELL_R - 2) + c.dir * T.CELL_SPEED * st.t) % (2 * span);
  if (u < 0) u += 2 * span;
  const x = (u <= span ? u : 2 * span - u) - (T.WOMB_HALF - T.CELL_R - 2);
  const dir = (u <= span ? 1 : -1) * c.dir;
  return { x, p: c.p0 + 14 * Math.sin(0.35 * st.t + c.ph), dir };
}
function cellsStep(st) {
  for (const c of st.cells) {
    const q = cellAt(st, c);
    c.x = q.x; c.p = q.p; c.dir = q.dir;
    for (const sp of st.all) {
      if (!racing(sp) || sp.zone !== "path" || sp.attached || st.t < sp.cellSafe) continue;
      if (Math.abs(sp.p - c.p) > T.CELL_R + T.HEAD_R || Math.hypot(sp.x - c.x, sp.p - c.p) > T.CELL_R + T.HEAD_R) continue;
      sp.cellSafe = st.t + T.CELL_SAFE_S;
      hitSperm(st, sp, "cell");
    }
  }
}

// ---------------------------------------------------------------- moving

function walls(st, sp) {
  const R = T.HEAD_R;
  let lo, hi;
  if (sp.zone === "tube") { lo = st.xc - T.TUBE_HALF + R; hi = st.xc + T.TUBE_HALF - R; }
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
  sp.drift = null;
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
      sp.wrate = 0;
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
  // the slide: while drifting your path follows your heading at 5 /s; after a drift it catches up quickly
  sp.vang = wrapAngle(sp.vang + wrapAngle(sp.ang - sp.vang) * (1 - Math.exp(-(sp.drift ? T.DRIFT_SLIDE : 14) * DT)));
  const th = thOf(sp);
  const slow = t < sp.slowUntil ? sp.slowK : 1;
  if (sp.zone === "loop") {
    sp.loopS += (T.LOOP_FLOW + sp.speed * slow) * DT;
    if (sp.loopS >= T.LOOP_LEN) {
      // back at the fork, coming in from the cool side, heading across toward the warm side
      sp.zone = "path";
      sp.p = T.FORK;
      sp.x = -st.warm * (T.GATE_HALF - T.HEAD_R);
      sp.ang = sp.vang = st.warm > 0 ? 0 : Math.PI;
      sp.touch = true;
      sp.loops++;
    }
    turnRate(st, sp);
    return;
  }
  // a wave lifts a sperm that swims with it
  let lifted = false;
  if (sp.zone === "path" && sp.p < T.WOMB_END && mag >= T.WAVE_STICK && Math.abs(th) <= T.WAVE_DEG * DEG && slow === 1) {
    const k = waveOver(t, sp.p);
    if (k >= 0 && Math.abs(sp.x - st.cen[k]) <= T.WAVE_HALF) {
      lifted = true;
      if (!sp.waves.includes(k)) { sp.waves.push(k); sp.boostN += T.WAVE_COUNT; }
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
    const u = sp.x - st.xc, rr = Math.min(1, Math.abs(u) / T.TUBE_HALF);
    const laneW = T.LANE_W * (mine ? T.ASSIST_LANE : 1);
    const lane = Math.abs(u - laneAt(st, sp.p, t)) <= laneW / 2;
    cur = tubeFlow(rr, T.CURRENT) * (lane ? 0.5 : 1) * (mine ? T.ASSIST_CURRENT : 1);
    // the bonuses are for a sperm that swims (stick ≥ 0.25): one that lets go drifts back with the current
    const swims = mag >= T.SWIM_STICK;
    if (swims && Math.abs(th) <= T.UP_DEG * DEG) along += T.UP_BONUS;
    if (lane) { if (swims) along += T.LANE_BONUS; sp.laneS += DT; }
    sp.tubeS += DT;
  }
  along += boostNow(st, sp) + (sp.slipOn ? T.SLIP_BONUS : 0);
  along *= slow;
  const mth = wrapAngle(HALF_PI - sp.vang);
  const p0 = sp.p, k = kOf(st, sp);
  const g = k ? 1 / Math.max(0.3, 1 + k * (sp.x - st.xc)) : 1;
  sp.x += along * Math.sin(mth) * DT;
  const dp = (along * Math.cos(mth) - cur) * DT * g;
  sp.p += dp;
  if (k) { sp.ang = wrapAngle(sp.ang - k * dp); sp.vang = wrapAngle(sp.vang - k * dp); }
  // the split: the side of the head picks the tube
  if (sp.zone === "path" && sp.p >= T.SPLIT) {
    if (sp.x * st.warm > 0) { sp.zone = "tube"; sp.lastCheck = T.SPLIT; }
    else {
      sp.zone = "loop";
      sp.loopS = sp.p - T.SPLIT;
      sp.loopW = clamp(sp.x + st.warm * T.TUBE_HALF, -(T.LOOP_HALF - T.HEAD_R), T.LOOP_HALF - T.HEAD_R);
      sp.p = T.FORK;
      sp.drift = null;
      turnRate(st, sp);
      return;
    }
  }
  if (sp.zone === "tube") {
    for (const c of T.CHECKS) if (sp.p >= c && c > sp.lastCheck) sp.lastCheck = c;
    if (sp.p < sp.lastCheck) { sp.p = sp.lastCheck; if (mag < T.ATTACH_STICK) attach(st, sp, "check"); }
  }
  walls(st, sp);
  if (sp.zone === "tube" && !sp.attached && mag < T.ATTACH_STICK && !sp.out) {
    for (let i = 0; i < T.GLOWS.length && !sp.attached; i++) {
      const gl = glowAt(st, i);
      if (Math.hypot(sp.x - gl.x, sp.p - gl.p) < T.GLOW_R) attach(st, sp, "glow", i);
    }
  }
  if (sp.zone === "tube" && sp.p >= T.TUBE_END && !sp.out) {
    sp.arrived = true;
    sp.drift = null;
    sp.arriveT = t + DT * clamp((T.TUBE_END - p0) / Math.max(1e-9, sp.p - p0), 0, 1);
  }
  sp.maxP = Math.max(sp.maxP, sp.p);
  turnRate(st, sp);
}
// Your heading's turn in the world (rad/s), smoothed: the track's own turn under you does not count.
function turnRate(st, sp) {
  const wa = sp.zone === "loop" ? sp.ang : sp.ang + phiOf(st, sp.p) - HALF_PI;
  const d = wrapAngle(wa - sp.wang);
  sp.wang = wa;
  sp.wrate += (d / DT - sp.wrate) * (1 - Math.exp(-DT / T.RATE_TAU_S));
}

// The drawn world point and heading of a sperm (the loop is drawn round its curve; a spin-out turns the body).
function posOf(st, sp) {
  let q;
  if (sp.you && st.carried && st.moment === "carried") q = carriedPos(st);
  else if (sp.you && st.meet) q = meetPos(st);
  else if (sp.zone === "loop") q = loopPoint(st, sp.loopS, sp.loopW);
  else {
    const w = W(st, sp.x, sp.p);
    q = { x: w.x, y: w.y, ang: sp.ang + w.phi - HALF_PI };
  }
  const u = (st.t - sp.spinAt) / T.SPIN_S;
  if (u >= 0 && u < 1) q.ang += 2 * Math.PI * smooth(u);
  return q;
}

// Soft bumps: circle against circle, pushed apart every step; the speed loss at most once per sperm per 0.4 s. A
// shield takes a bump (and is gone).
function bumps(st) {
  const D = 2 * T.HEAD_R, list = st.all.filter(swimming);
  const hit = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], L = a.zone === "loop";
      if (L !== (b.zone === "loop")) continue;
      let dx = L ? b.loopW - a.loopW : b.x - a.x, dp = L ? b.loopS - a.loopS : b.p - a.p;
      if (Math.abs(dx) >= D || Math.abs(dp) >= D) continue;
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
          if (shielded(st, s)) { s.shieldUntil = -1e9; s.bumpAt = st.t; fx(st, s, "shield", 1); continue; }
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

// Your stick and presses this step (the press rules are in the header).
function yourInput(st, it) {
  const you = st.you;
  const live = st.t >= T.START_S - 1e-9 && st.moment !== "carried" && st.moment !== "meet" && !you.out;
  const s = it && it.steer;
  const sx = s && Number.isFinite(s.x) ? s.x : 0, sy = s && Number.isFinite(s.y) ? s.y : 0;
  const k = Math.hypot(sx, sy) > 1 ? 1 / Math.hypot(sx, sy) : 1;
  if (you.out) { you.stick = restStick(st, you); return; }
  you.stick = live ? toTrack(st, { x: sx * k, y: sy * k }, you.zone === "loop" ? T.FORK : you.p) : ZERO;
  if (!live || you.arrived) return;
  you.mag = Math.min(1, Math.hypot(you.stick.x, you.stick.y));
  if (st.oneButton) {
    if (!(it && it.touching)) { if (you.drift) endDrift(st, you, true); return; }
    const a = kartPlan(st, you, 1);
    if (a.hold && !you.drift) { const sd = driftSide(st, you); if (sd) startDrift(st, you, sd); }
    else if (!a.hold && you.drift) endDrift(st, you, true);
    if (a.item) useItem(st, you);
    return;
  }
  const evs = [];
  const list = (v) => (Array.isArray(v) ? v.filter((e) => e && typeof e === "object") : []);
  for (const e of list(it && it.presses)) evs.push({ t: Number.isFinite(e.t) ? e.t : st.t, press: true, item: e.item === true });
  for (const e of list(it && it.releases)) evs.push({ t: Number.isFinite(e.t) ? e.t : st.t, press: false });
  evs.sort((a, b) => a.t - b.t || (a.press ? -1 : 1));
  for (const e of evs) {
    if (!e.press) { if (you.drift) endDrift(st, you, true); continue; }
    if (e.item) { useItem(st, you); continue; }
    if (you.drift) { endDrift(st, you, true); continue; }
    const side = driftSide(st, you);
    if (side) startDrift(st, you, side);
    else useItem(st, you);
  }
}

// One step of the race at st.t: catch-up, slipstream, steering and the kart choices, drifts, moving, bumps, items.
function raceStep(st) {
  const you = st.you, yp = progOf(you);
  const ahead = st.assist ? T.ASSIST_CATCH_AHEAD : T.CATCH_AHEAD, behind = st.assist ? T.ASSIST_CATCH_BEHIND : T.CATCH_BEHIND;
  for (const sp of st.rivals) {
    if (sp.arrived) continue;
    if (!st.racing || you.out) { sp.catchF = 1; continue; }
    const g = progOf(sp) - yp;
    sp.catchF = g > 0 ? 1 - ahead * clamp(g / T.CATCH_SPAN, 0, 1)
      : swimming(sp) ? 1 + behind * clamp(-g / T.CATCH_SPAN, 0, 1) : 1;
  }
  slipstream(st);
  for (const sp of st.rivals) if (!sp.arrived) rivalTurn(st, sp);
  for (const sp of st.all) if (!sp.arrived) driftStep(st, sp);
  for (const sp of st.all) {
    if (sp.arrived) continue;
    move(st, sp);
    if (sp.boosts.length && st.t - sp.boosts[0].t0 >= sp.boosts[0].dur) sp.boosts = sp.boosts.filter((b) => st.t - b.t0 < b.dur);
  }
  bumps(st);
  boxes(st);
  sparksStep(st);
  goosStep(st);
  cellsStep(st);
}

// ---------------------------------------------------------------- gates, the tide, out

function knockOut(st, sp, by) {
  if (sp.out || sp.arrived) return;
  sp.out = true;
  sp.outT = st.t;
  sp.outBy = by;
  sp.rest = st.t;
  sp.drift = null;
  sp.roll = null;
  sp.slipOn = false;
  if (sp.you) {
    st.youOutT = st.t;
    st.racing = false;
    emit(st, "out", { by });
    emit(st, "sfx", { id: "slip", at: st.t, pitch: 0.8, gain: 0.5 });
    // the line at once, and nothing more is queued: the tide's own line, or the way closing (a fact on screen waits
    // for it, so the stage rests until that fact is read too)
    st.queue.length = 0;
    emit(st, "caption", { id: by === "tide" ? "swim.tideYou" : "swim.closes", dir: null });
    st.said.push("swim.closes");
    lineSaid(st);
  } else if (!st.flags.othersRest && !st.you.out && Math.abs(progOf(sp) - progOf(st.you)) < 150) {
    st.flags.othersRest = true;
    say(st, "caption", "swim.othersRest");
  }
}
function gatesStep(st) {
  for (let i = 0; i < st.gates.length; i++) {
    const g = st.gates[i];
    if (g.closed) continue;
    const order = st.all.filter((sp) => !sp.out && !sp.passed[i]).sort((a, b) => progOf(b) - progOf(a));
    for (const sp of order) {
      if (!(sp.arrived || progOf(sp) >= g.p)) break;
      sp.passed[i] = true;
      g.n++;
      if (sp.you) emit(st, "sfx", { id: "place", at: st.t, pitch: 1.2, gain: 0.5 });
    }
    if (g.n >= g.quota || st.t >= g.at - 1e-9) closeGate(st, i);
  }
}
function closeGate(st, i) {
  const g = st.gates[i];
  g.closed = true;
  g.closedAt = st.t;
  let n = 0;
  for (const sp of st.all) if (!sp.out && !sp.arrived && !sp.passed[i]) { knockOut(st, sp, "gate"); n++; }
  st.tide.flood = Math.max(st.tide.flood, g.p - T.TIDE_BACK);
  emit(st, "gate", { n: i + 1, closed: true, out: n });
  emit(st, "sfx", { id: "egg.fifth", at: st.t, pitch: 0.85, gain: 0.7 });
  // the line only when the cut is near you (out, or within 500 u); the racing tag and the chord tell the rest
  if (!st.you.out && Math.abs(progOf(st.you) - g.p) < 500 && !st.queue.some((q) => q.id === "swim.closes")) st.queue.unshift({ kind: "caption", id: "swim.closes" });
}
function tideStep(st) {
  const td = st.tide, t = st.t;
  if (t < T.TIDE_T0 - 1e-9) return;
  const k = st.assist ? T.ASSIST_TIDE : 1;
  const v = (T.TIDE_V0 + (T.TIDE_V1 - T.TIDE_V0) * clamp((t - T.TIDE_T0) / (T.TIDE_T1 - T.TIDE_T0), 0, 1)) * k;
  td.front += v * DT;
  if (td.front < td.flood) td.front = Math.min(td.flood, td.front + (T.TIDE_FLOOD - v) * DT);
  if (!st.flags.tide) {
    st.flags.tide = true;
    say(st, "fact", "swim.acid");
    emit(st, "sfx", { id: "move", at: t, pitch: 1, gain: 0.4 });
  }
  for (const sp of st.all) if (racing(sp) && progOf(sp) < td.front) knockOut(st, sp, "tide");
}

// ---------------------------------------------------------------- captions, sub-goals, points

// Queue a caption or fact once; `now` puts it at the front (a line about what you just did).
function say(st, kind, id, now = false) {
  if (st.said.includes(id)) return;
  st.said.push(id);
  if (now) st.queue.unshift({ kind, id }); else st.queue.push({ kind, id });
}
// The next queued line goes out once the last has had its time: SAY_GAP_S after a line, and after a fact its reading
// time on screen (ui/captions.js: 1.5 s + 55 ms a letter, "Week 2: " included), so facts never pile up behind each
// other and each shows whole (v1 design 12).
// In portrait stage 1 shows one line at a time, 2.4 s a page of about 34 letters, so a fact's time is the longer of the
// two. A sub-goal line keeps the next one SAY_GAP_S off, and a line that comes while a fact shows holds that fact
// back by its own time (ui/captions.js sets the fact aside and resumes it).
const FACT_READ_S = Object.fromEntries(FACTS.map((f) => {
  const n = "Week 2: ".length + f.text.length;
  return [f.id, Math.max(1.5 + 0.055 * n, 2.4 * Math.ceil(n / 34))];
}));
function flushSay(st) {
  if (!st.queue.length || !st.subgoals.goal || st.t < st.sayNext - 1e-9) return;
  const { kind, id } = st.queue.shift();
  emit(st, kind === "fact" ? "fact" : "caption", kind === "fact" ? { id, where: "caption" } : { id, dir: null });
  st.sayNext = st.t + (kind === "fact" ? Math.max(T.SAY_GAP_S, FACT_READ_S[id] || 0) : T.SAY_GAP_S);
}
const lineSaid = (st) => { st.sayNext = st.sayNext > st.t ? st.sayNext + T.SAY_GAP_S : st.t + T.SAY_GAP_S; };
function show(st, id, text) {
  if (subgoal(st, id, text)) lineSaid(st);
}
function settle(st, id, how, text) {
  if (doneBy(st, id, how, text)) lineSaid(st);
}
function pay(st, part, add) {
  const a = Math.round(add);
  if (!(a > 0)) return;
  st.paid[part] += a;
  emit(st, "points", { part, add: a });
}

// The score parts now (place by arrival, else by rank).
function parts(st) {
  const you = st.you;
  const place = st.finalPlace ?? st.placeNow;
  const lane = you.tubeS > 0 ? you.laneS / you.tubeS : 0;
  const tricks = you.hits + you.slings + you.gooHits;
  return {
    place,
    goal: st.goalMet ? PARTS.goal : 0,
    placePts: 2000 * (OF - place) / (OF - 1),
    boostPts: 1500 * Math.min(1, you.boostN / T.BOOSTS_FULL),
    lanePts: 1000 * clamp01(lane),
    readyPts: you.readyHow === "glow" ? 750 : 0,
    trickPts: 750 * Math.min(1, tricks / 4),
    first: you.arrived && place === 1 && st.goalMet ? 1000 : 0,
    lane, tricks,
  };
}
function scoreOf(st) {
  const p = parts(st);
  return clampScore({ goal: p.goal, skill: p.placePts + p.boostPts + p.lanePts + p.readyPts + p.trickPts, flourish: p.first });
}
// Pay the kart parts as they come (boosts, ready, tricks); the place and the lane settle at the end.
function payKart(st) {
  const p = parts(st);
  const now = Math.floor(p.boostPts + p.readyPts + p.trickPts);
  if (now > st.paidKart) { pay(st, "skill", now - st.paidKart); st.paidKart = now; }
}

// ---------------------------------------------------------------- the moments

function promptOf(st) {
  if (st.done || st.you.out) return { ...NONE };
  if (st.moment === "meet") return { gesture: "none", text: "swim.meetLine", keys: "steer" };
  if (st.moment === "carried") return { gesture: "none", text: "swim.carried", keys: "steer" };
  return { gesture: "move", text: st.t >= T.PROMPT_S - 1e-9 ? st.promptId : null, keys: "steer" };
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
  if (id === "fork") show(st, "warm", "swim.warmWay");
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
  const w = W(st, lerp(m.x0, m.x1, u), lerp(m.p0, m.p1, u));
  return { x: w.x, y: w.y, ang: lerp(m.a0, HALF_PI, u) + w.phi - HALF_PI };
}
function carriedPos(st) {
  const c = st.carried, u = smooth((st.t - c.t0) / T.CARRIED_S);
  const p = lerp(c.p0, T.TUBE_END + T.MEET_GLIDE, u);
  const x = centreAt(st, p) + (c.x0 - centreAt(st, c.p0)) * (1 - u);
  const w = W(st, x, p);
  return { x: w.x, y: w.y, ang: w.phi };
}

// Your arrival: the place is fixed as your head crosses the band; then the 2.5 s `meet`.
function arrive(st) {
  const you = st.you;
  st.finalPlace = you.place;
  st.goalMet = you.place <= T.TOP;
  st.racing = false;
  const side = you.x >= st.xc ? 1 : -1;
  st.meet = { t0: st.t, x0: you.x, p0: Math.min(you.p, T.TUBE_END + T.MEET_GLIDE), a0: you.ang,
    x1: st.xc + side * (T.TUBE_HALF - 2 * T.HEAD_R), p1: T.TUBE_END + T.MEET_GLIDE };
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
  if (how === "cap" || how === "out") {
    st.capped = true;
    st.racing = false;
    st.finalPlace = st.you.rank || st.placeNow;
    st.goalMet = false;
  }
  if (how === "carried") st.goalMet = false;
  const capLike = how === "cap" || how === "carried" || how === "out";
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

// The prompt line's text: the item line once you hold your first item (until you use one, 6 s at most), the drift
// line from just before each bend until your first drift boost, else "Drag to swim."
function promptText(st) {
  const you = st.you, f = st.flags;
  if (you.item && !f.usedItem && f.firstItemT && st.t - f.firstItemT < 6) return "swim.promptItem";
  if (!f.drifted && you.zone === "tube" && bendNear(st.trk, you.p, 90)) return "swim.promptDrift";
  return "swim.prompt";
}

// Captions, sub-goals, prompts, HUD tags and one-off sounds that follow what you do.
function story(st) {
  const you = st.you, f = st.flags;
  if (st.t >= T.GOAL_S - 1e-9 && !st.subgoals.goal) show(st, "goal", "swim.goal");
  if (!you.out && st.moment !== "meet" && st.moment !== "carried") st.promptId = promptText(st);
  if (you.lifted && !f.lift) f.lift = true;
  if (you.lifted && !f.liftedNow) emit(st, "sfx", { id: "whoom", at: st.t, pitch: 1, gain: 0.7 });
  if (!you.lifted && f.liftedNow) payKart(st);
  f.liftedNow = you.lifted;
  if (f.lift || (st.moment === "womb" && st.t >= T.WAVES_LATE_S)) say(st, "fact", "swim.waves");
  if (!f.cellSeen && st.cells.some((c) => Math.abs(c.p - you.p) < 110 && you.zone === "path")) { f.cellSeen = true; say(st, "fact", "swim.cells"); }
  if (you.zone !== st.lastZone) {
    if (you.zone === "tube") {
      emit(st, "fork", { tube: "warm" });
      settle(st, "warm", "you", "swim.warmDone");
    } else if (you.zone === "loop") {
      emit(st, "fork", { tube: "cool" });
      say(st, "caption", "swim.cool");
    } else if (st.lastZone === "loop") say(st, "caption", "swim.coolBack");
    st.lastZone = you.zone;
  }
  if (you.zone === "tube" && you.p >= T.GLOWS[0] - T.REST_SHOW && !st.subgoals.ready && !you.out) show(st, "ready", "swim.restGoal");
  for (let i = 0; i < T.GLOWS.length - 1; i++) {
    if (you.zone === "tube" && !you.ready && !you.attached && !you.out && you.p > T.GLOWS[i] + T.GLOW_R + 5 && !f["passed" + i]) {
      f["passed" + i] = true;
      st.queue.push({ kind: "caption", id: "swim.restNext" });
    }
  }
  if (you.ready && !f.ready) {
    f.ready = true;
    emit(st, "milestone", { id: "ready" });
    if (st.subgoals.ready === "shown" || !st.subgoals.ready) settle(st, "ready", "you", "swim.readyDone");
    payKart(st);
  }
  // a swish on a sharp turn
  if (!you.out && !you.arrived && !you.drift) {
    const d = Math.abs(wrapAngle(you.ang - st.swish.ang));
    st.swish.acc = st.swish.acc * Math.exp(-DT / T.SWISH_TAU_S) + d;
    st.swish.ang = you.ang;
    if (st.swish.acc >= T.SWISH_ACC && st.t - st.swish.last >= T.SWISH_GAP_S) {
      st.swish.last = st.t;
      st.swish.acc = 0;
      emit(st, "sfx", { id: "swish", at: st.t, pitch: 1, gain: 0.4 });
    }
  } else st.swish.ang = you.ang;
  raceTags(st);
  flushSay(st);
}

// The tags under the place slot: how many still race, the next gate's call 3 s before it can close, your item.
function gateCall(st) {
  for (let i = 0; i < st.gates.length; i++) {
    const g = st.gates[i];
    if (g.closed) continue;
    if (st.t >= g.at - T.GATE_WARN_S - 1e-9 || g.n >= g.quota - T.GATE_WARN_N) return { n: i + 1, first: g.quota };
    return null;
  }
  return null;
}
function raceTags(st) {
  const you = st.you;
  const racingN = st.all.filter((sp) => !sp.out).length;
  const gate = st.done || st.moment === "meet" || st.moment === "carried" ? null : gateCall(st);
  const tag = { racing: racingN, of: OF, gate, item: you.out ? null : you.item, rolling: !!you.roll && !you.out };
  const key = `${tag.racing}|${gate ? gate.n + ":" + gate.first : ""}|${tag.item}|${tag.rolling}`;
  if (key !== st.tagKey) { st.tagKey = key; st.tags = tag; emit(st, "race", { ...tag }); }
}

// Every sperm's rank: arrivals by time, then racers by progress, then the out ones (the later out ahead).
function rankAll(st) {
  const grp = (sp) => (sp.arrived && sp.place !== null ? 0 : sp.out ? 2 : 1);
  const list = st.all.slice().sort((a, b) => {
    const ga = grp(a), gb = grp(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return a.place - b.place;
    if (ga === 2 && a.outT !== b.outT) return b.outT - a.outT;
    return progOf(b) - progOf(a) || st.all.indexOf(a) - st.all.indexOf(b);
  });
  list.forEach((sp, i) => { sp.rank = i + 1; });
}

// placeNow every step; the shown place after a new value has held for 0.25 s.
function places(st) {
  const you = st.you;
  rankAll(st);
  const now = st.finalPlace !== null ? st.finalPlace : you.arrived && you.place !== null ? you.place : you.rank;
  if (now !== st.placeNow) { st.placeNow = now; st.placeSince = st.t; }
  if (st.placeNow !== st.place && st.t - st.placeSince >= T.PLACE_HOLD_S - 1e-9) {
    st.place = st.placeNow;
    emit(st, "place", { place: st.place, of: OF });
  }
}

// Each sperm that reached the meeting place this step, in arrival order; once the third is in, the rest rest.
function arrivals(st) {
  const fresh = st.all.filter((sp) => sp.arrived && sp.place === null)
    .sort((a, b) => a.arriveT - b.arriveT || st.all.indexOf(a) - st.all.indexOf(b));
  for (const sp of fresh) {
    st.arrived++;
    sp.place = st.arrived;
    for (let i = 0; i < sp.passed.length; i++) if (!sp.passed[i]) { sp.passed[i] = true; st.gates[i].n++; }
    emit(st, "arrive", { id: idOf(sp), place: sp.place });
  }
  if (st.arrived >= T.TOP && !st.topIn) {
    st.topIn = true;
    for (const sp of st.all) if (racing(sp)) knockOut(st, sp, "end");
  }
  return fresh.includes(st.you);
}

// The camera: your progress, you sideways with a 0.4 s ease, the track's heading with a 0.5 s ease, a little further
// ahead in a bend.
function camStep(st, snap = false) {
  const you = st.you, c = st.cam;
  let p, x;
  if (st.moment === "carried" && st.carried) {
    const u = smooth((st.t - st.carried.t0) / T.CARRIED_S);
    p = lerp(st.carried.p0, T.TUBE_END + T.MEET_GLIDE, u); x = centreAt(st, p);
    snap = true;
  } else if (st.meet) {
    const m = st.meet, u = smooth((st.t - m.t0) / T.MEET_S);
    p = lerp(m.p0, m.p1, u); x = lerp(m.x0, m.x1, u);
  } else if (you.zone === "loop") {
    const q = loopPoint(st, you.loopS, you.loopW);
    p = q.y; x = q.x;
  } else { p = you.p; x = you.x; }
  const bend = Math.abs(insideAt(st.trk, p + T.CAM_LOOK, T.LANE_RAMP));
  const ahead = T.CAM_AHEAD * spanAt(p) * 0.5 * bend;
  const phi = phiOf(st, p + T.CAM_LOOK * 0.5);
  const e = (tau) => (snap ? 1 : 1 - Math.exp(-DT / tau));
  c.x += (x - c.x) * e(T.CAM_EASE_S);
  c.p = p;
  c.ahead += (ahead - c.ahead) * e(T.CAM_TURN_S);
  c.phi = wrapAngle(c.phi + wrapAngle(phi - c.phi) * e(T.CAM_TURN_S));
}
// The camera's world point: the eased track point, moved ahead along the eased heading.
function camWorld(st) {
  const c = st.cam;
  const w = W(st, c.x, c.p);
  return { x: w.x + Math.cos(c.phi) * c.ahead, y: w.y + Math.sin(c.phi) * c.ahead };
}

function stepOnce(st, it) {
  const you = st.you;
  noteCaptions(st, FACTS, TEXT);
  yourInput(st, it);
  raceStep(st);
  st.t += DT;
  for (const sp of st.all) {
    if (sp.rest !== null && !sp.arrived && sp.attached !== "rest" && st.t - sp.rest >= T.REST_SLOW_S - 1e-9) attach(st, sp, "rest");
  }
  for (const sp of st.all) sp.phase = (sp.phase + DT * (T.TAIL_HZ + sp.speed * T.TAIL_PER_U)) % 1;
  while (st.fx.length && st.t - st.fx[0].t > 0.8) st.fx.shift();
  const youIn = arrivals(st);
  if (st.moment !== "meet" && st.moment !== "carried") { gatesStep(st); tideStep(st); }
  places(st);
  if (youIn && st.moment !== "meet" && st.moment !== "carried") arrive(st);
  else if (st.moment !== "meet" && st.moment !== "carried" && !you.out) {
    const mi = Math.max(st.mi, raceMoment(you));
    if (mi !== st.mi) for (let i = st.mi + 1; i <= mi; i++) enter(st, IDS[i]);
  }
  story(st);
  syncPrompt(st);
  camStep(st);
  if (st.moment === "meet") {
    if (!you.ready && st.t - st.meet.t0 >= T.MEET_READY_S - 1e-9) {
      you.ready = true;
      you.readyHow = "meet";
      settle(st, "ready", "auto", "swim.readyAuto");
    }
    if (st.t - st.meet.t0 >= T.MEET_S - 1e-9) finish(st, "meet");
  } else if (st.moment === "carried") {
    if (st.t - st.carried.t0 >= T.CARRIED_S - 1e-9) finish(st, "carried");
  } else if (you.out && st.youOutT !== null) {
    const restUntil = Math.max(readBy(st, st.youOutT + T.OUT_S), st.sayNext + 0.4);
    if (st.t >= restUntil - 1e-9 || st.t >= T.CAP_S - 1e-9) finish(st, "out");
  } else if (st.t >= T.CAP_S - 1e-9) finish(st, "cap");
  noteCaptions(st, FACTS, TEXT);
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
    return makeSperm(rung, T.SKILLS[rung], free[k], r, stream(sd, "items:" + rung));
  }).sort((a, b) => a.id - b.id);
  const you = makeSperm("you", null, slots[T.YOU_SLOT], null, stream(sd, "items:you"));
  // the waves' shared thresholds and window centres
  const nWaves = Math.ceil((T.CAP_S + 5) / T.WAVE_GAP) + 4;
  const thr = [], cen = [];
  for (let k = 0; k < nWaves; k++) {
    const r = stream(sd, "wave:" + k);
    thr.push(r());
    cen.push((2 * r() - 1) * T.WAVE_SPREAD);
  }
  const warm = stream(sd, "fork")() < 0.5 ? -1 : 1;
  const trk = layTrack(T.BENDS);
  const xc = warm * T.TUBE_HALF;
  // item boxes: rows of 4 across the womb and the tube
  const boxList = [];
  T.BOX_ROWS.forEach((p, row) => {
    const xs = p < T.WOMB_END ? T.BOX_X_WOMB : T.BOX_U_TUBE.map((u) => xc + u);
    xs.forEach((x, i) => boxList.push({ row, i, x, p, back: 0, takenAt: -1e9 }));
  });
  // white cells, seeded across the womb
  const rc = stream(sd, "cells");
  const cells = [];
  for (let i = 0; i < T.CELL_N; i++) {
    const p0 = T.CELL_FROM + T.CELL_GAP * i + (rc() - 0.5) * 40;
    cells.push({ x0: (2 * rc() - 1) * (T.WOMB_HALF - T.CELL_R - 2), dir: rc() < 0.5 ? -1 : 1, p0, ph: rc() * 6.28, x: 0, p: p0 });
  }
  const quotas = o.assist ? T.ASSIST_QUOTAS : T.GATES.map((q) => q[1]);
  const gates = T.GATES.map((q, i) => ({ p: q[0], quota: quotas[i], at: q[2], n: 0, closed: false, closedAt: null }));
  const st = {
    id: meta.id, seed: sd, t: 0, gaDay: meta.ga.start, fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: IDS[0], mi: 0,
    done: false, how: null, fault: null, assist: !!o.assist, oneButton: !!o.oneButton, carry, hue: carry.sperm.hue,
    warm, xc, trk, bend0: trk.bends.length ? trk.bends[0].p0 : Infinity, thr, cen, you, rivals, all: [you, ...rivals],
    boxes: boxList, sparks: [], goos: [], cells, gates, tide: { front: T.TIDE_FROM, flood: -1e9 },
    placeNow: 0, place: 0, placeSince: 0, finalPlace: null, arrived: 0, topIn: false, youOutT: null,
    racing: true, capped: false, goalMet: false, meet: null, carried: null,
    cam: { x: you.x, p: you.p, phi: HALF_PI, ahead: 0 }, contacts: [], fx: [], fxN: 0,
    queue: [], said: [], sayNext: 0, flags: {}, lastZone: "path", lastPrompt: null,
    promptId: "swim.prompt", tagKey: "", tags: null,
    paid: { goal: 0, skill: 0, flourish: 0 }, paidKart: 0, swish: { acc: 0, ang: you.ang, last: -1e9 },
    capBusy: 0, evSeen: 0,
  };
  st.beats = makeBeats(sd, [{ heart: "mother", from: 0, to: T.CAP_S + T.CARRIED_S + 10, bpm: meta.motherBpm, jitter: T.JITTER, first: phase }]);
  rankAll(st);
  st.placeNow = st.place = you.rank;
  emit(st, "moment", { id: st.moment });
  syncPrompt(st);
  emit(st, "place", { place: st.place, of: OF });
  raceTags(st);
  say(st, "fact", "swim.half");                       // the first caption, after the goal line
  noteCaptions(st, FACTS, TEXT);
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
      try { if (st.t >= T.CAP_S - 1e-9 || st.moment === "meet" || st.moment === "carried" || st.you.out) finish(st, "cap"); } catch (e2) { st.done = true; }
    }
  }
}

// ---------------------------------------------------------------- view (v1 16.5)

const VIEW_R = 300;          // course within this of the camera (world u) is sent
const TUBE_STEP = 10;        // the tube's centre line is sampled every 10 u of progress (world-fixed)

// The runs of tube progress [a, b] whose centre line comes within VIEW_R of the world point (cx, cy).
function tubeRuns(st, cx, cy, from, to) {
  const runs = [];
  let a = null;
  const step = 25;
  for (let p = Math.floor(from / step) * step; p <= to + step; p += step) {
    const q = W(st, st.xc, Math.min(p, to));
    const near = Math.hypot(q.x - cx, q.y - cy) <= VIEW_R;
    if (near && a === null) a = Math.max(from, p - step);
    if (!near && a !== null) { runs.push([a, Math.min(to, p)]); a = null; }
  }
  if (a !== null) runs.push([a, to]);
  return runs;
}
// World-fixed sample progresses over [a, b] every `step`, with both ends.
function steps(a, b, step, extra = []) {
  const out = [a];
  for (let p = Math.ceil(a / step) * step; p < b; p += step) if (p > a + 1e-6) out.push(p);
  for (const p of extra) if (p > a && p < b) out.push(p);
  out.push(b);
  return [...new Set(out)].sort((u, v) => u - v);
}

// The race strip (render/race.js): the course's lumens, the warm lane, the gates, the tide, boxes, goo, white cells,
// sparks, shields, drift confetti, speed lines, slipstream streaks and the sperm that rest.
function raceStrip(st, cx, cy) {
  const parts = [];
  // the womb, the gate and the fork, to the split (straight: world = track)
  if (cy - VIEW_R < T.SPLIT + 10) {
    const ps = steps(Math.max(T.WAVE_FROM - 20, cy - VIEW_R - 25), T.SPLIT, 25, [T.WOMB_END, T.GATE_END, T.FORK]);
    if (ps.length >= 2 && ps[ps.length - 1] > ps[0]) parts.push({ tone: "womb", pts: ps.flatMap((p) => [0, p]), w: ps.map((p) => 2 * halfAt(p)) });
  }
  // the cool loop
  if (Math.hypot(cx - (-st.warm * 60), cy - T.SPLIT) < VIEW_R + 60) {
    const pts = [], w = [];
    for (let i = 0; i <= 18; i++) { const q = loopPoint(st, (T.LOOP_LEN * i) / 18, 0); pts.push(q.x, q.y); w.push(2 * T.LOOP_HALF); }
    parts.push({ tone: "cool", pts, w });
  }
  // the warm tube, from the split to a little past the meeting place
  const end = T.TUBE_END + 50;
  const runs = tubeRuns(st, cx, cy, T.SPLIT, end);
  const lanes = [];
  for (const [a, b] of runs) {
    // long runs go out in chunks of at most 81 samples that overlap by two, so each part stays within 96 points
    const all = steps(a, b, TUBE_STEP);
    for (let i0 = 0; i0 < all.length - 1 && parts.length < 7; i0 += 78) {
      const ps = all.slice(i0, i0 + 81);
      if (ps.length < 2) break;
      parts.push({ tone: "warm", pts: ps.flatMap((p) => { const q = W(st, st.xc, p); return [q.x, q.y]; }), w: ps.map(() => 2 * T.TUBE_HALF) });
    }
    const la = Math.max(a, T.TUBE_START), lb = Math.min(b, T.TUBE_END);
    if (lb - la > 5) {
      const ls = steps(la, lb, TUBE_STEP);
      lanes.push({ ps: ls, pts: ls.flatMap((p) => { const q = W(st, st.xc + laneAt(st, p, st.t), p); return [q.x, q.y]; }) });
    }
  }
  const near = (x, y, r = 0) => Math.hypot(x - cx, y - cy) <= VIEW_R + r;
  // gates: a band across the passage, open (cut dashes) or closing to solid
  const gates = [];
  st.gates.forEach((g, i) => {
    const hw = g.p < T.SPLIT ? halfAt(g.p) : T.TUBE_HALF, c = g.p < T.SPLIT ? 0 : st.xc;
    const a = W(st, c - hw, g.p), b = W(st, c + hw, g.p);
    if (!near((a.x + b.x) / 2, (a.y + b.y) / 2, 40)) return;
    const shut = g.closed ? clamp01((st.t - g.closedAt) / 0.35) : 0;
    const call = !g.closed && (st.t >= g.at - T.GATE_WARN_S || g.n >= g.quota - T.GATE_WARN_N);
    gates.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, shut, call: call ? 1 : 0, pulse: call ? Math.pow(1 - clamp01(st.beats.phase("mother", st.t)), 2) : 0, n: i + 1 });
  });
  // the cool tide over the course behind the pack
  let tide = null;
  const front = st.tide.front;
  if (front > T.WAVE_FROM && cy - VIEW_R - 40 < front) {
    const segs = [];
    const lo = Math.max(T.WAVE_FROM - 30, cy - VIEW_R - 40);
    if (lo < Math.min(front, T.SPLIT)) {
      const ps = steps(lo, Math.min(front, T.SPLIT), 25, [T.WOMB_END, T.GATE_END, T.FORK]);
      segs.push({ pts: ps.flatMap((p) => [0, p]), w: ps.map((p) => 2 * halfAt(p) + 16) });
    }
    if (front > T.SPLIT) {
      for (const [a, b] of runs) {
        const bb = Math.min(b, front);
        if (bb - a < 2) continue;
        const ps = steps(a, bb, TUBE_STEP);
        segs.push({ pts: ps.flatMap((p) => { const q = W(st, st.xc, p); return [q.x, q.y]; }), w: ps.map(() => 2 * T.TUBE_HALF + 16) });
      }
      if (Math.hypot(cx - (-st.warm * 60), cy - T.SPLIT) < VIEW_R + 60) {
        const pts = [], w = [];
        for (let i = 0; i <= 18; i++) { const q = loopPoint(st, (T.LOOP_LEN * i) / 18, 0); pts.push(q.x, q.y); w.push(2 * T.LOOP_HALF + 16); }
        segs.push({ pts, w });
      }
    }
    const fp = Math.max(T.WAVE_FROM, front);
    const fc = fp < T.SPLIT ? 0 : st.xc, fw = fp < T.SPLIT ? halfAt(fp) : T.TUBE_HALF;
    const f = W(st, fc, fp);
    const flood = st.tide.flood > front + 1;
    if (segs.length) tide = { segs, front: { x: f.x, y: f.y, ang: f.phi, w: 2 * fw + 16 }, flood: flood ? 1 : 0 };
  }
  // boxes, goo, cells, sparks
  const boxes = [];
  for (const b of st.boxes) {
    const q = W(st, b.x, b.p);
    if (!near(q.x, q.y)) continue;
    const back = b.back <= st.t ? clamp01((st.t - b.back) / 0.3 + (b.takenAt < 0 ? 1 : 0)) : 0;
    const taken = clamp01((st.t - b.takenAt) / 0.3);
    boxes.push({ x: q.x, y: q.y, ang: q.phi + 0.6 * Math.sin(st.t * 1.3 + b.i * 1.7 + b.row), bob: Math.sin(st.t * 3 + b.i), a: b.back > st.t ? 0 : Math.max(back, b.takenAt < 0 ? 1 : 0), pop: b.back > st.t ? taken : 0 });
  }
  const goo = st.goos.map((g) => { const q = W(st, g.x, g.p); return { x: q.x, y: q.y, r: T.GOO_R, a: clamp01((T.GOO_S - (st.t - g.t0)) / 0.6) * clamp01((st.t - g.t0) / 0.2) }; }).filter((g) => near(g.x, g.y));
  const cells = st.cells.map((c, i) => ({ x: c.x, y: c.p, r: T.CELL_R, ph: st.t * 0.9 + c.ph, i })).filter((c) => near(c.x, c.y, 20));
  const sparks = st.sparks.map((s) => { const q = W(st, s.x, s.p); return { x: q.x, y: q.y, ang: s.a + q.phi - HALF_PI }; }).filter((s) => near(s.x, s.y));
  // shields, the sperm that rest, slipstream streaks
  const shields = [], rest = [], streaks = [];
  for (const sp of st.all) {
    const q = posOf(st, sp);
    if (!near(q.x, q.y)) continue;
    if (shielded(st, sp) && racing(sp)) {
      const left = sp.shieldUntil - st.t;
      shields.push({ x: q.x, y: q.y, r: 6.5, a: left < 1.5 ? 0.5 + 0.5 * Math.cos(left * 12) : 1, you: sp.you });
    }
    if (sp.out && !(sp.you && st.moment === "carried")) rest.push({ x: q.x, y: q.y, ang: q.ang, a: 1 - 0.5 * clamp01((st.t - sp.outT) / T.REST_SLOW_S), you: sp.you, hue: sp.you ? st.hue : T.RIVAL_HUE });
    if (sp.slipOn && sp.slipLead && racing(sp)) {
      const L = posOf(st, sp.slipLead);
      streaks.push({ x: L.x, y: L.y, ang: L.ang, you: sp.you, a: clamp01((sp.slipS - T.SLIP_AFTER_S) / 0.3) });
    }
  }
  // drift glow and speed lines at you
  const you = st.you, yp = posOf(st, you);
  const drift = you.drift && you.drift.level > 0 ? { x: yp.x, y: yp.y, ang: yp.ang, level: you.drift.level, side: you.drift.side } : null;
  const bst = racing(you) ? boostNow(st, you) + (you.lifted ? 20 : 0) : 0;
  const lines = bst > 4 ? { x: yp.x, y: yp.y, ang: posOf(st, you).ang, a: clamp01(bst / 40), seed: Math.floor(st.t * 20) } : null;
  const rivalsDrift = st.rivals.filter((sp) => sp.drift && sp.drift.level > 0).slice(0, 6).map((sp) => { const q = posOf(st, sp); return { x: q.x, y: q.y, level: sp.drift.level }; }).filter((q) => near(q.x, q.y));
  const fxl = st.fx.map((e) => ({ kind: e.kind, n: e.n, x: e.x, y: e.y, ang: e.ang, age: clamp01((st.t - e.t) / 0.7), seed: e.seed, you: e.you })).filter((e) => near(e.x, e.y));
  return {
    kind: "race", parts, lanes, laneW: T.LANE_W * (st.assist ? T.ASSIST_LANE : 1), phase: (st.t * 0.6) % 1,
    gates, tide, boxes, goo, cells, sparks, shields, rest, streaks, drift, rivalsDrift, lines, fx: fxl,
  };
}

function cueOf(st) {
  const you = st.you, pos = posOf(st, you);
  const wp = (x, p) => { const q = W(st, x, p); return { x: q.x, y: q.y }; };
  const meet = wp(st.xc, T.TUBE_END);
  if (st.moment === "meet" || st.moment === "carried" || st.done) return meet;
  if (you.out) return { x: pos.x, y: pos.y };
  if (st.moment === "womb") {
    const k = waveNear(st.t, you.p), yc = waveFront(k, st.t) - T.WAVE_THICK / 2;
    if (Math.abs(yc - you.p) < 160 && yc < T.WOMB_END) return { x: st.cen[k], y: yc };
    return { x: 0, y: Math.min(you.p + 120, T.GATE_END) };
  }
  if (st.moment === "gate" || (st.moment === "fork" && you.zone !== "loop")) return { x: st.xc, y: T.SPLIT + 10 };
  if (you.zone === "loop") return { x: 0, y: T.FORK };
  if (T.TUBE_END - you.p < 200) return meet;
  if (!you.ready) {
    for (let i = 0; i < T.GLOWS.length; i++) {
      if (T.GLOWS[i] + T.GLOW_R >= you.p && T.GLOWS[i] - you.p < 220) { const g = glowAt(st, i); return wp(g.x, g.p); }
    }
  }
  const p = Math.min(you.p + 60, T.TUBE_END);
  return wp(st.xc + laneAt(st, p, st.t), p);
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const you = st.you, pos = posOf(st, you);
  const span = spanAt(st.cam.p);
  const mm = mmPerShortAxis(meta, st.gaDay);
  const cw = camWorld(st);
  const cx = cw.x, cy = cw.y;
  d.camera = { x: cx, y: cy, span, rot: wrapAngle(st.cam.phi - HALF_PI), orient: meta.orient, mmPerU: mm / span };
  d.scale = { you: "0.05 mm" };
  const inTube = you.zone === "tube" || st.moment === "tube" || st.moment === "meet";
  d.light = { level: inTube ? 0.36 : 0.32, warm: inTube ? 0.75 : 0.6, exposure: 1, white: 0, vignette: 0.45, tint: 0 };
  d.warp = 0.15;
  d.caustics = 0;
  d.strips.push(raceStrip(st, cx, cy));

  // the sperm: tails for every one in range that races, a head disc each; you last, on the highest sheet
  const items = [];
  const seen = (q) => Math.abs(q.y - cy) <= T.DRAW_RANGE && Math.abs(q.x - cx) <= T.DRAW_RANGE;
  for (const sp of st.rivals) {
    if (sp.out) continue;
    const q = posOf(st, sp);
    if (!seen(q) || items.length >= 24) continue;
    items.push({ x: q.x, y: q.y, ang: q.ang, len: T.LEN, phase: sp.phase, hue: T.RIVAL_HUE, ring: null });
    d.splats.push({ k: "c", x: q.x, y: q.y, r: T.HEAD_R, m: 0.8, n: 0, v: 0, hue: T.RIVAL_HUE });
  }
  if (!you.out || st.moment === "carried") {
    items.push({ x: pos.x, y: pos.y, ang: pos.ang, len: T.LEN, phase: you.phase, hue: st.hue, ring: "halo" });
    d.splats.push({ k: "c", x: pos.x, y: pos.y, r: T.HEAD_R, m: 1.5, n: 0, v: 0, hue: st.hue });
  }
  d.strips.push({ kind: "tails", items });

  // contact rings for the bumps
  const rings = st.contacts.filter((c) => st.t - c.t < T.RING_S && seen(c)).map((c) => {
    const u = clamp01((st.t - c.t) / T.RING_S);
    return { x: c.x, y: c.y, r: 2 + 4 * u, a: (c.you ? 0.9 : 0.6) * (1 - u), dashed: false };
  });
  if (rings.length && d.strips.length < 6) d.strips.push({ kind: "ripples", items: rings });

  // marks: the waves, the fork mouths, the glow walls, the meeting place, glows on ready and resting sperm
  const lo = st.cam.p - T.VIEW_BACK, hi = st.cam.p + T.VIEW_AHEAD;
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
        on: clamp01((T.WOMB_END - yc) / T.WAVE_THICK), pulse: 0, ang: HALF_PI });
    }
  }
  if (Math.hypot(cx, cy - T.SPLIT) < VIEW_R + 40) {
    mark({ kind: "warm", x: st.xc, y: T.SPLIT + 15, r: T.TUBE_HALF, on: true, pulse });
    mark({ kind: "cool", x: -st.xc, y: T.SPLIT + 15, r: T.TUBE_HALF, on: true, pulse: 0 });
    if (st.mi <= MI.fork && you.zone !== "tube" && !you.out) {
      mark({ kind: "arrow", x: st.warm * 8, y: T.FORK - 12, r: 6, on: true, pulse, ang: Math.atan2(T.SPLIT + 15 - (T.FORK - 12), st.warm * (T.TUBE_HALF - 8)) });
    }
  }
  for (let i = 0; i < T.GLOWS.length; i++) {
    const g = glowAt(st, i), q = W(st, g.x, g.p);
    if (Math.hypot(q.x - cx, q.y - cy) > VIEW_R + T.GLOW_R) continue;
    const mine = you.attached === "glow" && you.glow === i;
    mark({ kind: "glowwall", x: q.x, y: q.y, r: T.GLOW_R, rim: "solid", on: mine ? 1 : 0.7, pulse });
  }
  const mq = W(st, st.xc, T.TUBE_END);
  if (Math.hypot(mq.x - cx, mq.y - cy) < VIEW_R + 40) {
    mark({ kind: "meet", x: mq.x, y: mq.y, r: T.TUBE_HALF, w: T.MEET_W, rim: "solid", on: true, pulse, ang: mq.phi });
  }
  if (you.ready && !you.out) mark({ kind: "glow", x: pos.x, y: pos.y, r: 8, on: 0.6, pulse });
  for (const sp of st.rivals) {
    if (!(sp.attached === "glow" || sp.attached === "check") || sp.out || d.marks.length >= 24) continue;
    const q = posOf(st, sp);
    if (seen(q)) mark({ kind: "glow", x: q.x, y: q.y, r: 6, on: sp.ready ? 0.6 : 0.35, pulse: 0 });
  }

  // DOM rings: her beat at you; the rest ring while you count her beats on a glow
  d.rings.push({ id: "mother", kind: "mother", x: pos.x, y: pos.y, r: span * 0.12, progress: clamp01(st.beats.phase("mother", st.t)) });
  if (you.attached === "glow" && !you.ready) {
    d.rings.push({ id: "rest", kind: "rest", x: pos.x, y: pos.y, r: 9, progress: clamp01(you.beats / T.READY_BEAT) });
  }
  d.anchor = { x: pos.x, y: pos.y };
  d.cue = cueOf(st);
  return d;
}

export function prompt(st) {
  return promptOf(st);
}

// The race has no timed targets.
export function targets(st, horizonS) {
  return [];
}

// Your steering at `skill` (also the one-button rule at skill 1): ride the waves you take, grab a box, dodge the
// white cells, take the warm tube, follow the lane round the bends, draft and pull out, rest on glow 1 from skill 0.75
// (glow 2 from 0.4); hold a drift through each bend's entry (hold: true is the press, letting go the release) and use
// the item (dash: true, a tap) as the rivals do. Its noise and lag live only in r.mem. The stick is a world vector.
export function botSteer(st, skill, r) {
  const still = { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  try {
    if (!st || st.done || st.moment === "meet" || st.moment === "carried" || st.you.arrived || st.you.out) return still;
    const sk = clamp01(skill);
    const you = st.you;
    const s = steerFor(st, you, sk, r, { side: st.warm, wall: wallFor(sk) });
    const w = toWorldVec(st, s, you.zone === "loop" ? T.FORK : you.p);
    // at skill 1 the stick is 1 long, and sin² + cos² can round above 1: keep it just inside, so a caller that
    // clamps |steer| ≤ 1 (makeIntents, the one-button rule) passes it on unchanged
    const h = Math.hypot(w.x, w.y), k = h > 1 - 1e-9 ? (1 - 1e-9) / h : 1;
    const a = sk > 0 ? kartPlan(st, you, sk) : { hold: false, item: false };
    return { steer: { x: w.x * k, y: w.y * k }, dir: null, hold: a.hold, dash: a.item };
  } catch (e) {
    return still;
  }
}

// The race shape (v1 16.9), in world units, with the kart parts.
export function probe(st) {
  const you = st.you, yp = posOf(st, you);
  return {
    place: st.place, placeNow: st.placeNow, of: OF,
    racing: st.all.filter((sp) => !sp.out).length,
    gates: st.gates.map((g) => ({ p: g.p, quota: g.quota, n: g.n, closed: g.closed, closedAt: g.closedAt })),
    tide: st.tide.front,
    tags: st.tags,
    you: { progress: progOf(you), x: yp.x, y: yp.y, ready: you.ready, out: you.out, item: you.item,
      drift: you.drift ? { side: you.drift.side, level: you.drift.level, charge: you.drift.charge } : null,
      boost: boostNow(st, you), speed: you.speed, slip: you.slipOn, shield: shielded(st, you) },
    rivals: st.rivals.map((sp) => {
      const q = posOf(st, sp);
      return {
        id: sp.id, skill: sp.skill, progress: progOf(sp), x: q.x, y: q.y,
        state: sp.arrived ? "arrived" : sp.out ? "out" : sp.attached ? "rest" : "swim",
        tube: sp.zone === "tube" ? "warm" : sp.zone === "loop" ? "cool" : null, ready: sp.ready,
      };
    }),
    camera: { rot: wrapAngle(st.cam.phi - HALF_PI) },
  };
}

// The score's mood (openspec/changes/first-breath-score/contract.md, "Mood"): level 2 while the next gate you have
// not passed closes within 6 s (its time, or 2 places left in its quota) or, from the tide's start (T.TIDE_T0, 12 s),
// the tide is within 120 u behind you; 1 while 3 or more racers swim within 25 u of you (the pack); else 0, and 0 once
// you rest or arrive. These thresholds (6 s, 2 places, 120 u, 3 racers, 25 u) stay here as literals on purpose: they
// set only the music, so they sit beside the state they read and not in swim.tune.js (first-breath-score design 4).
// Pure and cheap (main.js reads it every 100 ms); it changes nothing in the race.
export function mood(st) {
  const you = st && st.you;
  if (!you || st.done || you.out || you.arrived || !st.racing) return { level: 0 };
  const p = progOf(you);
  for (let i = 0; i < st.gates.length; i++) {
    const g = st.gates[i];
    if (g.closed || you.passed[i]) continue;
    if (g.at - st.t <= 6 || g.quota - g.n <= 2) return { level: 2 };
    break;
  }
  if (st.t >= T.TIDE_T0 && p - st.tide.front < 120) return { level: 2 };
  let n = 0;
  for (const sp of st.rivals) if (!sp.out && !sp.arrived && Math.abs(progOf(sp) - p) < 25 && Math.abs(sp.x - you.x) < 25) n++;
  return { level: n >= 3 ? 1 : 0 };
}

export function result(st) {
  const you = st.you, p = parts(st), score = scoreOf(st);
  const goalMet = st.done && st.goalMet && st.how !== "carried" && st.how !== "cap" && st.how !== "out";
  return {
    done: st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "place", label: "swim.part.place", value: Math.round(p.placePts), max: 2000 },
      { id: "boosts", label: "swim.part.boosts", value: Math.round(p.boostPts), max: 1500 },
      { id: "lane", label: "swim.part.lane", value: Math.round(p.lanePts), max: 1000 },
      { id: "ready", label: "swim.part.ready", value: p.readyPts, max: 750 },
      { id: "tricks", label: "swim.part.tricks", value: Math.round(p.trickPts), max: 750 },
      { id: "first", label: "swim.part.first", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: {
      place: p.place, of: OF, capped: st.capped, arrived: you.arrived, arriveT: you.arriveT, how: st.how,
      out: you.out ? you.outBy : null, outAt: you.outT,
      rideS: you.rideS, waves: you.waves.length, lane: p.lane, ready: you.ready, readyHow: you.readyHow,
      boosts: you.boostN, drifts: you.drifts.slice(), slings: you.slings, hits: you.hits, gooHits: you.gooHits,
      items: you.used, spins: you.spins,
      gates: st.gates.map((g) => g.closedAt),
      bumps: you.bumps, loops: you.loops, warm: st.warm > 0 ? "right" : "left", moment: st.moment, fault: st.fault,
    },
    carryOut: { sperm: { hue: st.hue, place: p.place, glow: you.readyHow === "glow" || you.readyHow === "item" ? 1 : 0.5 } },
  };
}

// Skip to a moment (for tests, and for "carried" after Go on at the cap or once out). The race moments put you at
// that part of the course; `meet` makes you arrive now; `carried` plays the 3 s carry to the meeting place with
// input `none`.
export function jump(st, id) {
  if (!st || !(id in MI)) return false;
  const you = st.you;
  if (id === "carried") {
    st.done = false;
    st.how = null;
    st.racing = false;
    const p0 = you.zone === "loop" ? T.FORK : you.arrived ? T.TUBE_END : you.p;
    st.carried = { t0: st.t, x0: you.zone === "loop" ? 0 : you.x, p0 };
    st.meet = null;
    if (!you.out) { you.out = true; you.outT = st.t; you.outBy = "cap"; you.rest = st.t; }
    you.attached = null;
    you.drift = null;
    enter(st, "carried");
    return true;
  }
  if (you.arrived || you.out) return false;
  st.done = false;
  st.how = null;
  if (id === "meet") {
    you.zone = "tube"; you.p = T.TUBE_END; you.x = st.xc;
    you.arrived = true; you.arriveT = st.t;
    arrivals(st);
    places(st);
    arrive(st);
    return true;
  }
  const at = { womb: [-T.GRID_COL_GAP / 2, T.GRID_FRONT - 2 * T.GRID_ROW_GAP, "path"], gate: [0, T.WOMB_END, "path"],
    fork: [0, T.FORK, "path"], tube: [st.xc, T.TUBE_START, "tube"] }[id];
  you.x = at[0]; you.p = at[1]; you.zone = at[2]; you.attached = null; you.loopS = 0; you.ang = you.vang = HALF_PI;
  you.lastCheck = at[2] === "tube" ? T.TUBE_START : -1e9;
  you.wang = HALF_PI + phiOf(st, you.p) - HALF_PI;
  st.lastZone = you.zone;
  st.mi = Math.min(st.mi, MI[id]);
  enter(st, id);
  st.cam.x = you.x; st.cam.p = you.p; st.cam.phi = phiOf(st, you.p);
  return true;
}

