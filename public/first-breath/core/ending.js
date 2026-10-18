// First Breath: the ending (`ending`, design.md 6.9): "Breathe." Not scored (meta.scored is false): no points, no
// grade, no score line, and nothing here can fail. It follows the Stage interface of design.md 16.4. Pure: no DOM, no
// clocks, no storage; its only randomness is stream(seed, "breaths") for the two uneven breaths after the first.
//
// The timeline (stage seconds; the numbers are in ending.tune.js):
//   0.0  white       White. The warm room fades in from the white over 1.5 s. Her heart is silent (the one gap, 5.1).
//   1.5  breathe     "Breathe." (live hold, optional). Her heart comes back soft and far. A fresh press starts the
//                    inhale (your glow fills); its release, at least 0.4 s in (it lets go by itself at 2.5 s), gives
//                    a soft first cry. With no press the breath comes by itself 3.0 s after the prompt (4.5 s), with
//                    the caption end.seconds.
//   cry  breaths     Two more breaths come by themselves at about 6 to 9 s, a little uneven. Your glow warms.
//   ~9   skin        Skin-to-skin: a big warm oval rises under you in a circle of cream light. Her heart comes close
//                    and clear: "[{Carer}'s heartbeat, clear now]", "You know this heartbeat."
//   ~12  thumb       "Rest your thumb here." (live hold, optional). The thumb ring breathes slowly; while a fresh
//                    press rests on it, it pulses with her heart ring.
//   ~16  song        Your song (carry.song) is hummed, clear and full band; notes you answered shimmer.
//   ~29  time        "Your nine months took 9 min 48 s."
//   ~33  done        The run result (the run also takes a tap from 29 s).
// The moments from skin on follow skin-to-skin, which comes at 9.0 s, or 0.1 s after the third breath if that is
// later (only after a late first breath; at most about 10.6 s, so the ending ends by about 34.6 s, cap 40 s).
//
// Contract notes (gaps in design.md 16, handled here; see the builder's report):
// - No timed targets: 6.9 judges nothing, so targets() is always [] and the bot plays through botSteer's hold.
// - The thumb ring is a `rest` ring with the extra field dock: "thumb" (validate() allows extra fields); its x, y is
//   the 390 × 844 portrait spot (78% of the height), and the rings layer moves it by layout (landscape: low in the
//   corner of the last touch). The thumb prompt carries textKeys: "ending.thumbKeys" for desktop.
// - The run time line is a caption event { id: "ending.time", ms, vars }: ms is opts.runMs when the host passes it,
//   else null, and then the host fills {time} from run.ms (which stops counting when the ending starts).
// - Sound: sfx events heartFar (gain 0.25, −12 dB) at 1.5 s and heartClose (gain 1) at skin-to-skin; inhale, cry and
//   breath one-shots; one song event { notes, lit, clear: true, noteS } at the song.
// - end.apgar is a "result" fact: the run result shows it; the ending emits no event for it.
import { DT } from "./clock.js";
import { makeBeats } from "./beat.js";
import { emit } from "./events.js";
import { EMPTY_INTENTS } from "./intent.js";
import { mergeCarry } from "./carry.js";
import { emptyDraw } from "./draw.js";
import { stream } from "./rng.js";
import { subgoal, doneBy } from "./lib/goals.js";
import { TUNE } from "./ending.tune.js";

// One moment: gaDay 280 → 280 throughout, with no lenS (4.1: "ending | all | 280 → 280 | – | none shown").
const mo = (id) => Object.freeze({ id, ga: Object.freeze([280, 280]), lenS: null });

export const meta = Object.freeze({
  id: "ending", index: 8, name: "First Breath", verb: "Breathe",
  orient: "fit",
  families: Object.freeze(["hold"]),
  ga: Object.freeze({ start: 280, end: 280 }), fertilized: true,
  mm: Object.freeze({ start: 2000, end: 2000 }),
  motherBpm: TUNE.motherBpm, parS: 33, capS: TUNE.capS, canFail: false, scored: false,
  moments: Object.freeze(["white", "breathe", "breaths", "skin", "thumb", "song", "time"].map(mo)),
});

// The live gesture and prompt text of each moment (one gesture per moment, 5.3).
const GESTURE = Object.freeze({ white: "none", breathe: "hold", breaths: "none", skin: "none", thumb: "hold", song: "hold", time: "hold" });
const PROMPT_TEXT = Object.freeze({ breathe: "ending.breathe", thumb: "ending.thumb", song: "ending.thumb", time: "ending.thumb" });
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const RESTING = new Set(["thumb", "song", "time"]);

// What follows skin-to-skin, as offsets from its start.
const SKIN_PLAN = Object.freeze([
  [0, "moment", "skin"],
  [TUNE.knowAfterS, "caption", "ending.know"],
  [TUNE.thumbAfterS, "moment", "thumb"],
  [TUNE.skinFactAfterS, "fact", "end.skin"],
  [TUNE.songAfterS, "moment", "song"],
  [TUNE.voiceFactAfterS, "fact", "end.voice"],
  [TUNE.restSettleAfterS, "settleRest", null],
  [TUNE.timeAfterS, "moment", "time"],
  [TUNE.endAfterS, "end", null],
]);
const SKIN_AT = Object.freeze({ skin: 0, thumb: TUNE.thumbAfterS, song: TUNE.songAfterS, time: TUNE.timeAfterS });

const MM = meta.mm.start;
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const smooth = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const lerp = (a, b, p) => a + (b - a) * p;

// "9 min 48 s" (the same form as core/text.js minSec, which a stage file may not import).
function minSec(ms) {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  return m ? m + " min " + (s % 60) + " s" : s + " s";
}

function promptOf(id) {
  const out = { gesture: GESTURE[id] || "none", text: PROMPT_TEXT[id] || null, keys: "steer" };
  if (id === "thumb" || id === "song" || id === "time") out.textKeys = "ending.thumbKeys";
  return out;
}

// ---- the agenda: timeline items in time order (ties keep the order they were added) ----

function schedule(st, t, what, id = null) {
  const item = { t, seq: st.seq++, what, id };
  let i = st.agenda.length;
  while (i > 0 && (st.agenda[i - 1].t > t || (st.agenda[i - 1].t === t && st.agenda[i - 1].seq > item.seq))) i--;
  st.agenda.splice(i, 0, item);
}
const unschedule = (st, what) => { st.agenda = st.agenda.filter((a) => a.what !== what); };

function enterMoment(st, id) {
  st.moment = id;
  emit(st, "moment", { id });
  emit(st, "prompt", promptOf(id));
  const t = st.t;
  if (id === "white") {
    st.whiteT = t;
    schedule(st, t + TUNE.whiteS, "moment", "breathe");
  } else if (id === "breathe") {
    st.breatheT = t;
    subgoal(st, "breath", "ending.breathe");
    emit(st, "sfx", { id: "heartFar", at: t, pitch: 1, gain: TUNE.heartFarGain });
    if (!st.first) schedule(st, t + TUNE.autoAfterS, "auto");
  } else if (id === "skin") {
    emit(st, "sfx", { id: "heartClose", at: t, pitch: 1, gain: TUNE.heartCloseGain });
    emit(st, "caption", { id: "ending.capHeart", dir: null });
  } else if (id === "thumb") {
    subgoal(st, "rest", "ending.thumb");
  } else if (id === "song") {
    const song = st.carry.song;
    emit(st, "song", { notes: song.notes.slice(), lit: song.lit, clear: true, noteS: TUNE.noteS, at: t });
    emit(st, "caption", { id: "ending.capSong", dir: null });
  } else if (id === "time") {
    const ms = Number.isFinite(st.runMs) && st.runMs > 0 ? st.runMs : null;
    emit(st, "caption", { id: "ending.time", dir: null, ms, vars: ms === null ? null : { time: minSec(ms) } });
  }
}

// Skin-to-skin starts at S: lay every item from `from` (an offset into SKIN_PLAN) on.
function planSkin(st, S, from = 0) {
  st.skinT = S;
  for (const [off, what, id] of SKIN_PLAN) if (off >= from) schedule(st, S + off, what, id);
}

// The first breath starts (by your press, or by itself).
function inhale(st, by) {
  const t = st.t;
  st.first = by;
  st.inhale = { t0: t, by, released: false };
  st.breaths.push({ t0: t, t1: null, by });
  unschedule(st, "auto");
  emit(st, "milestone", { id: "breath" });
  emit(st, "sfx", { id: "inhale", at: t, pitch: 1, gain: 1 });
  if (by === "you") {
    doneBy(st, "breath", "you", "ending.capBreath");
    schedule(st, t + TUNE.maxHoldS, "letGo");
  } else {
    doneBy(st, "breath", "auto", "ending.capBreath");
    emit(st, "fact", { id: "end.seconds", where: "caption" });
    schedule(st, t + TUNE.autoInhaleS, "letGo");
  }
}

// The first breath goes out with a soft cry; two more breaths and skin-to-skin are laid from it.
function cry(st) {
  const t = st.t, r = st.r;
  st.inhale = null;
  st.cryT = t;
  const b = st.breaths[0];
  if (b && b.t1 === null) b.t1 = t;
  unschedule(st, "letGo");
  emit(st, "sfx", { id: "cry", at: t, pitch: 1, gain: 1 });
  emit(st, "caption", { id: "ending.capCry", dir: null });
  enterMoment(st, "breaths");
  schedule(st, t + TUNE.breathFactS, "fact", "end.breath");
  // four draws, always, so the same seed lays the same breaths
  const u = [r(), r(), r(), r()];
  const b2 = Math.max(TUNE.breath2At + TUNE.breath2JitterS * u[0], t + TUNE.afterCryS);
  const e2 = b2 + TUNE.inhaleS + TUNE.inhaleJitterS * u[1];
  const b3 = e2 + TUNE.breathGapS + TUNE.breathGapJitterS * u[2];
  const e3 = b3 + TUNE.inhaleS + TUNE.inhaleJitterS * u[3];
  schedule(st, b2, "breath");
  schedule(st, b2, "caption", "ending.capBreathing");
  schedule(st, e2, "exhale");
  schedule(st, b3, "breath");
  schedule(st, b3, "fact", "end.fluid");
  schedule(st, e3, "exhale");
  schedule(st, Math.max(TUNE.skinAt, e3 + TUNE.skinAfterBreathS), "skinStart");
}

function settleRest(st, how) {
  subgoal(st, "rest", "ending.thumb");
  doneBy(st, "rest", how, how === "you" ? "ending.together" : "ending.restAuto");
}

function fire(st, a) {
  switch (a.what) {
    case "moment": enterMoment(st, a.id); break;
    case "auto": if (!st.first) inhale(st, "auto"); break;
    case "letGo": if (st.inhale) cry(st); break;
    case "breath":
      st.breaths.push({ t0: st.t, t1: null, by: "auto" });
      emit(st, "sfx", { id: "breath", at: st.t, pitch: 1 + 0.04 * (st.breaths.length - 2), gain: 0.8 });
      break;
    case "exhale": { const b = st.breaths[st.breaths.length - 1]; if (b && b.t1 === null) b.t1 = st.t; break; }
    case "skinStart": planSkin(st, st.t, 0); break;
    case "caption": emit(st, "caption", { id: a.id, dir: null }); break;
    case "fact": emit(st, "fact", { id: a.id, where: "caption" }); break;
    case "settleRest": settleRest(st, "auto"); break;
    case "end": finish(st, "end"); break;
    default: break;
  }
}

function press(st) {
  if (st.moment === "breathe" && !st.first) { inhale(st, "you"); return; }
  if (RESTING.has(st.moment) && !st.rest) {
    st.rest = { t0: st.t };
    st.restN++;
    if (st.subgoals.rest === "shown") settleRest(st, "you");
  }
}

function release(st) {
  const h = st.inhale;
  if (h && h.by === "you" && !h.released) {
    h.released = true;
    unschedule(st, "letGo");
    const at = h.t0 + TUNE.minHoldS;
    if (st.t >= at - 1e-9) cry(st);
    else schedule(st, at, "letGo");          // a quick tap still draws a full small breath
    return;
  }
  if (st.rest) { st.restS += st.t - st.rest.t0; st.rest = null; }
}

// Every sub-goal ends done or auto (5.4), also at the cap or after a jump.
function finish(st, how) {
  if (st.done) return;
  if (!st.first) { subgoal(st, "breath", "ending.breathe"); doneBy(st, "breath", "auto", "ending.capBreath"); st.first = "auto"; }
  settleRest(st, "auto");
  if (st.rest) { st.restS += st.t - st.rest.t0; st.rest = { t0: st.t }; }
  st.agenda = [];
  st.done = true;
  st.how = how;
  st.endT = st.t;
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const end = TUNE.capS + 30;
  const st = {
    id: meta.id, seed: seed >>> 0, t: 0, gaDay: 280, fertilized: true,
    events: [], beats: null, subgoals: {}, moment: "white",
    done: false, how: null, endT: null,
    assist: !!o.assist, oneButton: !!o.oneButton, carry: mergeCarry(carryIn, null),
    runMs: Number.isFinite(o.runMs) ? o.runMs : null,
    r: stream(seed >>> 0, "breaths"),
    agenda: [], seq: 0,
    whiteT: 0, breatheT: null, cryT: null, skinT: null,
    first: null, inhale: null, breaths: [],
    rest: null, restS: 0, restN: 0,
  };
  // Her beats at 76 bpm on the grid opts.motherPhase sets, silent before 1.5 s; yours (130 bpm at gaDay 280) from
  // 1.5 s too, so the first 1.5 s are quiet.
  st.beats = makeBeats(st.seed, [
    { heart: "mother", from: TUNE.whiteS, to: end, bpm: TUNE.motherBpm, jitter: 0, first: phase },
    { heart: "you", from: TUNE.whiteS, to: end, gaFrom: 280, jitter: 0 },
  ]);
  enterMoment(st, "white");
  return st;
}

export function step(st, intents) {
  if (st.done) { st.t += DT; return; }
  const it = intents || EMPTY_INTENTS;
  const t0 = st.t, t1 = t0 + DT;
  const into = (t) => Math.min(Math.max(t, t0), t1 - 1e-9);
  const inputs = [];
  for (const p of it.presses || []) if (p && Number.isFinite(p.t)) inputs.push({ t: into(p.t), kind: 0 });
  for (const p of it.releases || []) if (p && Number.isFinite(p.t)) inputs.push({ t: into(p.t), kind: 1 });
  inputs.sort((a, b) => a.t - b.t || a.kind - b.kind);
  let i = 0;
  for (let guard = 0; guard < 512 && !st.done; guard++) {
    const a = st.agenda[0];
    const ta = a ? a.t : Infinity, ti = i < inputs.length ? inputs[i].t : Infinity;
    if (!(Math.min(ta, ti) < t1)) break;
    if (ta <= ti) { st.agenda.shift(); st.t = Math.max(t0, ta); fire(st, a); }
    else { const x = inputs[i++]; st.t = x.t; if (x.kind === 0) press(st); else release(st); }
  }
  st.t = t1;
  if (!st.done && st.t >= TUNE.capS - 1e-9) finish(st, "cap");
}

// ---- the view ----

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

// How full the breath is now (0..1): rising through an inhale, falling over 0.6 s after it.
function swellOf(st) {
  const b = st.breaths[st.breaths.length - 1];
  if (!b) return 0;
  const inS = b.by === "you" ? 1.2 : TUNE.inhaleS + 0.15;
  if (b.t1 === null) return clamp01((st.t - b.t0) / inS);
  const top = clamp01((b.t1 - b.t0) / inS);
  return top * (1 - clamp01((st.t - b.t1) / 0.6));
}

// Your warmth (0..1): it grows with each breath and at skin-to-skin (warm tones only).
function warmthOf(st) {
  const done = st.breaths.filter((b) => b.t1 !== null).length;
  const skin = st.skinT === null ? 0 : smooth((st.t - st.skinT) / TUNE.bigRiseS);
  return clamp01(0.25 * Math.min(3, done) + 0.25 * skin);
}

export function view(st) {
  const T = TUNE, t = st.t;
  const d = emptyDraw(meta.id);
  const you = T.you;
  d.camera = { x: you.x, y: you.y, span: T.span, rot: 0, orient: meta.orient, mmPerU: MM / T.span };
  d.scale = { mm: bar(MM) };
  const fade = smooth((t - st.whiteT) / T.whiteS);
  const warmth = warmthOf(st), swell = swellOf(st);
  const her = clamp01(st.beats.phase("mother", t));
  const herPulse = t >= T.whiteS ? 1 - her : 0;
  d.light = { level: 0.7 + 0.3 * fade, warm: 0.8 + 0.2 * warmth, exposure: 1 + 2 * (1 - fade), white: 1 - fade,
    vignette: 0.12, tint: 0 };
  d.warp = 0.12;
  d.caustics = 0;

  // the warm room: two soft sheets of light behind everything
  d.marks.push({ kind: "glow", x: -38, y: 34, r: 70, on: 0.35 * fade });
  d.marks.push({ kind: "glow", x: 40, y: -30, r: 64, on: 0.3 * fade });

  // skin-to-skin: the big warm oval rises under you, in a circle of cream light
  const skinP = st.skinT === null ? 0 : smooth((t - st.skinT) / T.bigRiseS);
  const lightP = st.skinT === null ? 0 : smooth((t - st.skinT) / T.light.riseS);
  const bigY = lerp(T.big.fromY, T.big.y, skinP);
  if (st.skinT !== null) {
    d.marks.push({ kind: "glow", x: you.x, y: T.light.y, r: T.light.r, on: lightP, pulse: herPulse * lightP });
    d.splats.push({ k: "s", x: -T.big.half, y: bigY, x2: T.big.half, y2: bigY, r: T.big.r, m: 1, n: 0, v: 0, hue: T.big.hue });
  }

  // you: one small plain oval, its glow filling with each breath
  const r = you.r * (1 + 0.08 * swell);
  d.marks.push({ kind: "glow", x: you.x, y: you.y, r: 10 + 8 * swell + 4 * warmth,
    on: clamp01((0.35 + 0.65 * Math.max(swell, 0.7 * warmth)) * fade), pulse: swell });
  d.splats.push({ k: "s", x: you.x - you.half, y: you.y, x2: you.x + you.half, y2: you.y, r, m: 1, n: 0, v: 0,
    hue: you.hue + 0.01 * warmth });
  const sparks = Math.min(T.sparks.max, st.carry.sparks | 0);
  for (let k = 0; k < sparks; k++) {
    const a = (2 * Math.PI * k) / sparks + Math.PI / 2;
    d.marks.push({ kind: "spot", x: you.x + T.sparks.ringR * 1.5 * Math.cos(a), y: you.y + T.sparks.ringR * Math.sin(a),
      r: T.sparks.r, on: fade });
  }

  // ripples: one per breath, out from you; one per hummed note, out from the big oval (lit notes solid, others dashed)
  const items = [];
  for (const b of st.breaths) {
    const age = t - b.t0;
    if (age < 0 || age >= T.ripple.life) continue;
    const p = age / T.ripple.life;
    items.push({ x: you.x, y: you.y, r: T.ripple.r0 + T.ripple.grow * p, a: 0.55 * (1 - p), dashed: false });
  }
  const songT = st.skinT === null ? null : st.skinT + T.songAfterS;
  const notes = st.carry.song.notes, lit = st.carry.song.lit;
  let shown = 0;
  if (songT !== null && t >= songT) {
    for (let k = 0; k < notes.length; k++) {
      const age = t - (songT + k * T.noteS);
      if (age < 0) break;
      shown = k + 1;
      if (age >= T.noteRipple.life) continue;
      const p = age / T.noteRipple.life;
      items.push({ x: you.x, y: T.big.y, r: T.noteRipple.r0 + T.noteRipple.grow * p, a: 0.4 * (1 - p),
        dashed: !((lit >> k) & 1) });
    }
  }
  if (items.length) d.strips.push({ kind: "ripples", items });

  // the song's notes as dots in a low arc above you: they come in as they are hummed and fade after the song
  if (shown > 0) {
    const songEnd = songT + notes.length * T.noteS;
    const after = clamp01(1 - (t - songEnd) / 3);
    if (after > 0) {
      const xy = new Float32Array(2 * shown), a = new Float32Array(shown);
      for (let k = 0; k < shown; k++) {
        const s = notes.length > 1 ? k / (notes.length - 1) : 0.5;
        xy[2 * k] = -30 + 60 * s;
        xy[2 * k + 1] = 22 + 6 * Math.sin(Math.PI * s) + 0.5 * (notes[k] - 57);
        const inP = clamp01((t - (songT + k * T.noteS)) / 0.4);
        const shimmer = (lit >> k) & 1 ? 0.75 + 0.25 * Math.sin(6 * t + k) : 0.45;
        a[k] = inP * shimmer * after;
      }
      d.points = { n: shown, xy, a, hue: 0.1 };
    }
  }

  // rings: her heart (far, then close round the big oval), yours, the slow breath ring, the thumb ring
  if (t >= T.whiteS) {
    d.rings.push({ id: "mother", kind: "mother", x: you.x, y: lerp(you.y, bigY + 4, skinP), r: lerp(30, 18, skinP),
      progress: her });
    d.rings.push({ id: "you", kind: "you", x: you.x, y: you.y, r: 12, progress: clamp01(st.beats.phase("you", t)), dashed: true });
  }
  if (st.moment === "breathe" && st.breatheT !== null) {
    const h = st.inhale;
    const p = h ? clamp01((t - h.t0) / 1.2) : 0;
    const slow = ((t - st.breatheT) / 3) % 1;
    d.rings.push({ id: "breath", kind: "breath", x: you.x, y: you.y, r: 18 + 10 * p + (h ? 0 : 2 * Math.sin(2 * Math.PI * slow)),
      progress: h ? p : clamp01(slow) });
  }
  if (st.skinT !== null && t >= st.skinT + T.thumbAfterS) {
    const slow = clamp01(((t - st.skinT - T.thumbAfterS) / T.restPulseS) % 1);
    d.rings.push({ id: "thumb", kind: "rest", x: T.thumbRing.x, y: T.thumbRing.y, r: T.thumbRing.r,
      progress: st.rest ? her : slow, dock: "thumb" });
  }

  d.anchor = { x: you.x, y: you.y };
  d.cue = { x: you.x, y: you.y };
  return d;
}

export function prompt(st) {
  return st.done ? { ...NONE } : promptOf(st.moment);
}

// The ending judges nothing (6.9), so it lays no timed targets.
export function targets(st, horizonS) {
  return [];
}

// The bot breathes once after a short wait, holds for about a second, and rests its thumb from the thumb prompt.
// Its waits and the hold come from r, kept in r.mem; it never steers.
export function botSteer(st, skill, r) {
  const out = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  if (!st || st.done) return out;
  const k = clamp01(skill);
  let mem = r && r.mem;
  if (!mem) { mem = {}; if (r) r.mem = mem; }
  if (!mem.ending) {
    const u = () => (typeof r === "function" ? r() : 0.5);
    mem.ending = { breathDelay: 0.25 + (1 - k) * u(), breathHold: 0.9 + 0.8 * u(), restDelay: 0.3 + 1.5 * (1 - k) * u() };
  }
  const p = mem.ending;
  if (st.moment === "breathe" && st.breatheT !== null) {
    if (!st.first) out.hold = st.t - st.breatheT >= p.breathDelay;
    else if (st.inhale && st.inhale.by === "you" && !st.inhale.released) out.hold = st.t - st.inhale.t0 < p.breathHold;
  } else if (RESTING.has(st.moment) && st.skinT !== null) {
    out.hold = st.t - (st.skinT + TUNE.thumbAfterS) >= p.restDelay;
  }
  return out;
}

export function probe(st) {
  return null;
}

export function result(st) {
  const first = st.breaths[0] || null;
  const restS = st.restS + (st.rest ? (st.done ? 0 : st.t - st.rest.t0) : 0);
  return {
    done: st.done,
    goalMet: st.done,
    score: null,
    parts: [],
    metrics: {
      moment: st.moment, how: st.how, firstBreath: st.first, firstT: first ? first.t0 : null, cryT: st.cryT,
      heldS: first && first.by === "you" && st.cryT !== null ? st.cryT - first.t0 : null,
      breaths: st.breaths.length, skinT: st.skinT, restS, restPresses: st.restN, endT: st.endT, runMs: st.runMs,
    },
    carryOut: {},
  };
}

// Skip to a named moment now (tests and the host's ?moment=). The breath and the rest settle by themselves when a jump
// passes them; skin-to-skin and what follows are laid from the moment jumped to.
export function jump(st, id) {
  if (!meta.moments.some((m) => m.id === id)) return false;
  st.done = false;
  st.how = null;
  st.endT = null;
  st.agenda = [];
  if (id === "white" || id === "breathe") {
    st.first = null; st.inhale = null; st.breaths = []; st.cryT = null; st.skinT = null; st.rest = null;
    st.subgoals = {};
    enterMoment(st, id);
    return true;
  }
  if (!st.first) {
    subgoal(st, "breath", "ending.breathe");
    doneBy(st, "breath", "auto", "ending.capBreath");
    st.first = "auto";
    st.breaths.push({ t0: st.t, t1: st.t, by: "auto" });
  }
  if (st.inhale) { const b = st.breaths[0]; if (b && b.t1 === null) b.t1 = st.t; st.inhale = null; }
  if (st.cryT === null) st.cryT = st.t;
  if (id === "breaths") {
    st.skinT = null;
    st.inhale = { t0: st.t, by: "auto", released: true };
    cry(st);
    return true;
  }
  const off = SKIN_AT[id];
  const S = st.t - off;
  if (off > 0) emit(st, "sfx", { id: "heartClose", at: st.t, pitch: 1, gain: TUNE.heartCloseGain });
  if (off >= TUNE.thumbAfterS) subgoal(st, "rest", "ending.thumb");
  if (off > TUNE.restSettleAfterS) settleRest(st, "auto");
  planSkin(st, S, off);
  // the moment jumped to is the first item now: start it at once
  const a = st.agenda[0];
  if (a && a.what === "moment" && a.id === id) { st.agenda.shift(); enterMoment(st, id); }
  return true;
}
