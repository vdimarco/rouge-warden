// First Breath: stage 6, Second Trimester (`answer`): "Listen. Then answer." (design.md 6.6, the v1 form). Pure: no
// DOM, no clocks, no storage, no Math.random; every draw comes from seeded streams (core/rng.js). Deterministic, and
// step() never throws.
//
// What happens, all on her 78 bpm beats (laid once in create from opts.motherPhase, no jitter while targets run):
// - `hear` (week 15, 3 s, no input): her heartbeat changes from felt to heard (milestone `hearing`, fact answer.hear).
// - `beat` (weeks 15 to 18, 10 beats from her first beat at or after 3.0 s): 8 tap targets on beats 2 to 9 (a
//   two-beat count-in after the prompt). Sub-goal `beat`.
// - `phrases` (weeks 19 to 24, 6 phrases of 10 beats): each phrase is 4 beats of call (her voice hums one note per
//   `x` slot; a gold ripple at that slot and at the warm patch on the wall), 4 beats of answer (a dashed ghost ripple
//   at each slot to tap; each one is a tap target on that beat) and 2 beats of gap. Patterns x..., x.x., xx.x, x.xx,
//   xxx., xxxx (16 notes). An answer with at least 75% of its notes Close or better is a match: "{Carer} feels
//   you." and, from phrase 2 (week 20), the hand glow on the wall. A miss only adds less: the next phrase comes on
//   time and the voice never stops. Each phrase plays once (repeats are deferred, 19.2). Sub-goal `answer`.
// - `eyes` (weeks 25 to 26, 4 s, no input): fact answer.jump; at its end (gaDay 182, week 26) the eyes open by
//   themselves (milestone `eyes`) and the vignette lifts over 2 s.
// - `outro` (week 27, 3 s, no input), then the stage ends with its goal met (always met from stage 2 on).
// Length ≈ 3 + 7.7 + 46.2 + 4 + 3 ≈ 64 s for every input (plus under one beat of her phase); cap 80 s.
//
// Score (7, 6.6): Goal 3,000; Skill 1,500 × beat accuracy (of 8) + 4,500 × answer accuracy (of 16); Flourish 250 per
// phrase with every note In time, at most 1,000. Carry in: nestleX and treeSeed (the placenta disc on the wall and
// its tree), sparks (rim sparks). Carry out: song = { notes: the 16 call notes (MIDI), lit: bit k set when call note
// k was answered Close or better }.
//
// Events beyond the shared ones: sfx { id: "answer.hum", at, pitch (Hz), gain, note (MIDI) } for each hummed note
// (sent up to 0.2 s ahead of `at`, never before the phrases moment), sfx "answer.thump" at each answer or beat tap
// that lands Close or better (a soft low thump), sfx "answer.hand" with each hand glow (a warm low chord); caption
// ids answer.cap.hum1..4 ("♪ … hums, left: n notes") at each call and answer.feels on each match; fact { id, where:
// "caption" } for each caption fact at the gaDay its label names.
//
// Contract choices: one track holds both groups ("beat", "answer"); P is the seconds since the previous target (the
// beat period for the first), floored at 0.5 s (5.2). Presses count only while the live gesture is `tap`.
// jump(state, id) starts that moment now (a `beat` or `phrases` jump lays its targets from her next beat), drops the
// targets and the scoring of that moment and the ones after it, keeps what came before, and opens the eyes when it
// skips past `eyes`.
import { DT, gaAt, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { stream, pick } from "../rng.js";
import { emit } from "../events.js";
import { CREDIT } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { createTrack, feed, upcoming, freeUntil, RESUME_FREE_S } from "../lib/track.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { figure } from "../lib/figure.js";
import { createTree, growTree } from "../lib/colonize.js";
import { TUNE } from "./answer.tune.js";
import { FACTS } from "./answer.facts.js";

const BEAT_S = 60 / TUNE.bpm;
const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "answer", index: 5, name: "Second Trimester", verb: "Answer",
  orient: "fit",
  families: Object.freeze(["tap"]),
  ga: Object.freeze({ start: 98, end: 195 }), fertilized: true,
  mm: Object.freeze({ start: 150, end: 600 }),
  motherBpm: TUNE.bpm, parS: 64, capS: 80, canFail: false, scored: true,
  moments: Object.freeze([
    mo("hear", 105, 105),
    mo("beat", 105, 126, TUNE.beatTargets * BEAT_S),          // p follows its 8 targets
    mo("phrases", 133, 175, TUNE.patterns.length * TUNE.phraseBeats * BEAT_S),   // 6 phrases of 10 beats
    mo("eyes", 175, 182, TUNE.eyesS),
    mo("outro", 189, 195, TUNE.outroS),
  ]),
});

const IDS = meta.moments.map((m) => m.id);
const HEAR = 0, BEAT = 1, PHRASES = 2, EYES = 3, OUTRO = 4, LAST = OUTRO;
const GESTURE = Object.freeze({ hear: "none", beat: "tap", phrases: "tap", eyes: "none", outro: "none" });
const GROUP_MOMENT = Object.freeze({ beat: BEAT, answer: PHRASES });
const NOTES = TUNE.patterns.join("").split("").filter((c) => c === "x").length;   // 16
// The caption facts (design.md 6.6, 12): each phrase's hum line and "{Carer} feels you." leave about 3 s of each
// 7.7 s phrase free, so a fact opens every other phrase and reads in those gaps (phrases 1, 2 and 4); answer.feel
// goes in the quiet beat moment as the clock reaches its week 16. answer.outside and answer.hic have no room: they
// are "What was real" facts on the result.
const PHRASE_FACT = Object.freeze(["answer.respond", "answer.w20", null, "answer.low", null, null]);
const FEEL = FACTS.find((f) => f.id === "answer.feel");
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const S = TUNE.score;
const V = TUNE.view;

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const lerp = (a, b, p) => a + (b - a) * p;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ---- her beats ----

function lowerBound(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}
// The index of her first beat at or after t, and the time of beat n (past the laid ones it carries on at 78 bpm).
const beatIdx = (st, t) => lowerBound(st.beats.mother, t - 1e-9);
function beatTime(st, n) {
  const a = st.beats.mother;
  if (!a.length) return n * BEAT_S;
  return n < a.length ? a[n] : a[a.length - 1] + (n - a.length + 1) * BEAT_S;
}

// The song: a seeded walk on the pentatonic set, one note per call slot (16).
function makeSong(seed) {
  const r = stream(seed, "song");
  const { set, start, steps } = TUNE.song;
  const out = [];
  let i = start;
  for (let k = 0; k < NOTES; k++) {
    if (k > 0) {
      i += pick(r, steps);
      if (i < 0) i = 1;
      if (i > set.length - 1) i = set.length - 2;
    }
    out.push(set[i]);
  }
  return out;
}

// ---- the plan: moment starts, targets, phrases and timed cues from moment `from` at time t0 ----

function plan(st, from, t0) {
  // keep the judged targets (and results) of the moments before `from`; drop the open ones and the rest
  const keep = [], kept = new Map();
  if (st.track) {
    st.track.targets.forEach((x, i) => {
      const r = st.track.results[i];
      if (GROUP_MOMENT[x.group] < from && r) { keep.push(x); kept.set(x.id, r); }
    });
  }
  st.gen++;
  if (from <= BEAT) { st.credit.beat = 0; st.judged.beat = 0; st.free.beat = { n: 0, credit: 0 }; }
  if (from <= PHRASES) {
    st.credit.answer = 0; st.judged.answer = 0; st.free.answer = { n: 0, credit: 0 }; st.phrases = []; st.calls = [];
    st.flourish = 0; st.matches = 0; st.perfect = 0; st.lit = 0; st.handT = -Infinity; st.litAt = {};
  }
  const add = [];
  let cur = t0;
  for (let j = from; j <= LAST; j++) {
    st.starts[j] = j === from ? t0 : cur;
    if (j === HEAR) cur = st.starts[j] + TUNE.hearS;
    else if (j === BEAT) {
      const n0 = beatIdx(st, st.starts[j]);
      if (j !== from) st.starts[j] = beatTime(st, n0);
      for (let k = 0; k < TUNE.beatTargets; k++) {
        add.push({ id: `beat.${st.gen}.${k}`, t: beatTime(st, n0 + TUNE.beatFirst + k), kind: "tap", heart: "mother", group: "beat" });
      }
      cur = beatTime(st, n0 + TUNE.beatBeats);
    } else if (j === PHRASES) {
      const n0 = beatIdx(st, st.starts[j]);
      if (j !== from) st.starts[j] = beatTime(st, n0);
      let note = 0;
      TUNE.patterns.forEach((pat, p) => {
        const base = n0 + p * TUNE.phraseBeats;
        const ph = {
          p, pat, t0: beatTime(st, base), tAnswer: beatTime(st, base + TUNE.callBeats),
          t1: beatTime(st, base + TUNE.phraseBeats), notes: [], good: 0, inTime: 0, judged: 0, matched: null,
          freeN: 0, freeGood: 0, freeIn: 0,
        };
        for (let k = 0; k < pat.length; k++) {
          if (pat[k] !== "x") continue;
          const id = `answer.${st.gen}.${p}.${k}`;
          const tCall = beatTime(st, base + k), tAns = beatTime(st, base + TUNE.callBeats + k);
          ph.notes.push({ k, song: note, tCall, tAns, id });
          st.calls.push({ t: tCall, k, p, song: note, midi: st.song[note] });
          add.push({ id, t: tAns, kind: "tap", heart: "mother", group: "answer", slot: k, phrase: p, song: note });
          note++;
        }
        st.phrases.push(ph);
      });
      cur = beatTime(st, n0 + TUNE.patterns.length * TUNE.phraseBeats);
    } else if (j === EYES) cur = st.starts[j] + TUNE.eyesS;
    else cur = st.starts[j] + TUNE.outroS;
  }
  st.end = cur;

  // P: the seconds since the previous target, or the beat period for the first; floored at 0.5 s (5.2)
  const all = [...keep, ...add].sort((a, b) => a.t - b.t);
  all.forEach((x, i) => { if (!Number.isFinite(x.P)) x.P = Math.max(0.5, i ? x.t - all[i - 1].t : BEAT_S); });
  st.track = createTrack(all, { assist: st.assist, lag: st.lag });
  st.track.targets.forEach((x, i) => { if (kept.has(x.id)) st.track.results[i] = kept.get(x.id); });
  st.where = {};
  for (const x of st.track.targets) st.where[x.id] = x.group === "answer"
    ? { x: V.slotX[x.slot], y: V.slotY, r0: V.ringSlot.r0, r1: V.ringSlot.r1 }
    : { x: V.baby.x, y: V.baby.y, r0: V.ringBeat.r0, r1: V.ringBeat.r1 };

  // timed cues, sorted by when they go out
  const cues = [];
  const cue = (at, name, data) => cues.push({ at, name, data });
  if (from <= HEAR) cue(st.starts[HEAR], "fact", { id: "answer.hear", where: "caption" });
  if (from <= BEAT && FEEL) {
    const m = meta.moments[BEAT], [g0, g1] = m.ga;
    cue(st.starts[BEAT] + m.lenS * (FEEL.gaDay - g0) / (g1 - g0), "fact", { id: "answer.feel", where: "caption" });
  }
  if (from <= PHRASES) {
    for (const ph of st.phrases) {
      const fact = PHRASE_FACT[ph.p];
      if (fact) cue(ph.t0, "fact", { id: fact, where: "caption" });
      cue(ph.t0, "caption", { id: "answer.cap.hum" + Math.min(4, ph.notes.length), dir: "left" });
    }
    for (const c of st.calls) {
      cue(Math.max(st.starts[PHRASES], c.t - TUNE.humLeadS), "sfx",
        { id: "answer.hum", at: c.t, pitch: hz(c.midi), gain: 1, note: c.midi, slot: c.k, phrase: c.p });
    }
  }
  if (from <= EYES) cue(st.starts[EYES], "fact", { id: "answer.jump", where: "caption" });
  st.cues = cues.sort((a, b) => a.at - b.at);
  st.ci = 0;
}

// ---- moments ----

function promptOf(i) {
  return { gesture: GESTURE[IDS[i]], text: "answer.prompt." + IDS[i], keys: "steer" };
}

function openEyes(st) {
  if (st.eyesT !== null) return;
  st.eyesT = st.t;
  emit(st, "milestone", { id: "eyes" });
}

// Moment i ends: gaDay jumps to its end (4.1); the eyes open at the end of `eyes`.
function leave(st, i) {
  st.gaDay = Math.max(st.gaDay, meta.moments[i].ga[1]);
  if (i === EYES) openEyes(st);
}

function enter(st, i) {
  st.mi = i;
  st.moment = IDS[i];
  st.gaDay = meta.moments[i].ga[0];
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", promptOf(i));
  if (i === HEAR) emit(st, "milestone", { id: "hearing" });
  if (i === BEAT) subgoal(st, "beat", "answer.sub.beat");
  if (i === PHRASES) subgoal(st, "answer", "answer.sub.answer");
}

// ---- judging ----

// A group's accuracy: Σ credit / its targets. A free target (after a resume, 5.2) is left out of both, unless every
// target of the group is free.
function accOf(st, group) {
  const total = group === "beat" ? TUNE.beatTargets : NOTES;
  const f = st.free[group];
  const n = total - f.n;
  if (n > 0) return st.credit[group] / n;
  return total > 0 ? (st.credit[group] + f.credit) / total : 0;
}
const skillOf = (st) => Math.round(S.beat * accOf(st, "beat")) + Math.round(S.answer * accOf(st, "answer"));

function settleBeat(st) {
  if (st.subgoals.beat !== "shown") return;
  const you = accOf(st, "beat") >= TUNE.doneBeatK - 1e-9;
  doneBy(st, "beat", you ? "you" : "auto", you ? "answer.sub.beatDone" : "answer.sub.beatAuto");
}

function settleAnswer(st) {
  if (st.subgoals.answer !== "shown") return;
  const you = st.matches >= TUNE.doneMatches;
  doneBy(st, "answer", you ? "you" : "auto", you ? "answer.sub.answerDone" : "answer.sub.answerAuto");
}

// A phrase's last note is judged: the match, the hand glow from phrase 2, the Flourish.
function settlePhrase(st, ph, t) {
  // the notes that count: a free one (after a resume, 5.2) is left out, unless every note of the phrase is free
  const n = ph.notes.length, all = (ph.freeN || 0) >= n;
  const den = all ? n : n - ph.freeN;
  const good = all ? ph.good + (ph.freeGood || 0) : ph.good, inT = all ? ph.inTime + (ph.freeIn || 0) : ph.inTime;
  ph.matched = den > 0 && good / den >= TUNE.matchK - 1e-9;
  if (ph.matched) {
    st.matches++;
    emit(st, "caption", { id: "answer.feels", dir: null, t });
    if (ph.p >= TUNE.handFrom) {
      st.handT = t;
      emit(st, "sfx", { id: "answer.hand", at: t, pitch: hz(st.song[ph.notes[0].song] - 24), gain: 0.8, t });
    }
  }
  if (den > 0 && inT === den && st.flourish < S.flourishMax) {
    const add = Math.min(S.flourishPer, S.flourishMax - st.flourish);
    st.flourish += add;
    st.perfect++;
    emit(st, "points", { part: "flourish", add, t });
  }
  if (st.phrases.every((q) => q.matched !== null)) settleAnswer(st);
}

function judged(st, r) {
  const x = r.target;
  const at = Number.isFinite(r.errMs) ? x.t + r.errMs / 1000 : st.t;          // a miss: the step that saw it
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart, t: at });
  st.fb = { t: at, id: x.id, grade: r.grade };
  if (r.grade === "off") return;                          // Off changes nothing; the target stays open (5.2)
  const c = CREDIT[r.grade] || 0;
  const before = skillOf(st);
  const f = x.free ? st.free[x.group] : null;                 // a free target's credit is kept apart
  if (x.group === "beat") { if (f) f.credit += c; else st.credit.beat += c; st.judged.beat++; }
  else if (x.group === "answer") { if (f) f.credit += c; else st.credit.answer += c; st.judged.answer++; }
  const add = skillOf(st) - before;
  if (add > 0) emit(st, "points", { part: "skill", add, t: at });
  if (c > 0) emit(st, "sfx", { id: "answer.thump", at, pitch: 70, gain: c, t: at });
  if (x.group === "beat") {
    if (c > 0) st.litAt[x.id] = at;
    if (st.judged.beat >= st.track.targets.filter((y) => y.group === "beat").length) settleBeat(st);
    return;
  }
  const ph = st.phrases[x.phrase];
  if (!ph) return;
  if (c >= CREDIT.close) { st.lit |= 1 << x.song; st.litAt[x.id] = at; if (x.free) ph.freeGood++; else ph.good++; }
  if (r.grade === "in") { if (x.free) ph.freeIn++; else ph.inTime++; }
  ph.judged++;
  if (ph.judged >= ph.notes.length && ph.matched === null) settlePhrase(st, ph, at);
}

function finish(st, how) {
  if (st.done) return;
  for (const r of feed(st.track, { presses: [], releases: [] }, st.t + 3600)) judged(st, r);
  for (const ph of st.phrases) if (ph.matched === null) settlePhrase(st, ph, st.t);
  settleBeat(st);
  settleAnswer(st);
  openEyes(st);
  st.done = true;
  st.how = how;
  emit(st, "points", { part: "goal", add: S.goal });
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

// ---- the Stage interface ----

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const carry = mergeCarry(carryIn, null);
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const sd = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 1;
  const st = {
    id: meta.id, seed: sd, t: 0, gaDay: meta.moments[0].ga[0], fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: IDS[0],
    mi: 0, starts: [0, 0, 0, 0, 0], end: 0, gen: 0, track: null, where: {}, cues: [], ci: 0,
    song: makeSong(sd), calls: [], phrases: [],
    credit: { beat: 0, answer: 0 }, judged: { beat: 0, answer: 0 },
    free: { beat: { n: 0, credit: 0 }, answer: { n: 0, credit: 0 } },
    flourish: 0, matches: 0, perfect: 0, lit: 0, litAt: {}, handT: -Infinity, eyesT: null, fb: null,
    done: false, how: null, assist: !!o.assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry, tree: null,
  };
  st.beats = makeBeats(sd, [
    { heart: "mother", from: 0, to: TUNE.layAheadS, bpm: TUNE.bpm, jitter: 0, first: phase },
    { heart: "you", from: 0, to: 70, gaFrom: 105, gaTo: 195, jitter: 0 },
    { heart: "you", from: 70, to: TUNE.layAheadS, gaFrom: 195, jitter: 0 },
  ]);
  // the placenta disc on the wall where you nestled, its tree from your root tree's seed
  const dx = carry.nestleX * V.disc.spread, dy = V.disc.y;
  st.tree = createTree({
    seed: carry.treeSeed === null ? sd : carry.treeSeed, root: { x: dx, y: dy - V.disc.r * 0.7 },
    region: { x: dx, y: dy + 2, r: V.disc.r * 0.9 }, N: 90, D: 3, di: 12, dk: 3, maxNodes: 70,
  });
  for (let i = 0; i < 20; i++) growTree(st.tree);
  plan(st, HEAR, 0);
  enter(st, HEAR);
  cues(st);
  return st;
}

// Send every cue that is due by now.
function cues(st) {
  while (st.ci < st.cues.length && st.cues[st.ci].at <= st.t + 1e-9) {
    const c = st.cues[st.ci++];
    emit(st, c.name, { ...c.data });                    // stamped with the step that sends it
  }
}

export function step(st, intents) {
  if (!st || typeof st !== "object" || !st.track) return;
  if (st.done) { st.t += DT; return; }
  const it = intents && typeof intents === "object" ? intents : {};
  const live = GESTURE[st.moment] === "tap";
  const presses = live && Array.isArray(it.presses)
    ? it.presses.filter((p) => p && Number.isFinite(p.t)).map((p) => ({ t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t }))
    : [];
  for (const r of feed(st.track, { presses, releases: [] }, st.t + DT)) judged(st, r);
  st.t += DT;
  while (st.mi < LAST && st.t >= st.starts[st.mi + 1] - 1e-9) { leave(st, st.mi); enter(st, st.mi + 1); }
  if (st.mi === LAST && st.t >= st.end - 1e-9) {
    leave(st, LAST);
    cues(st);
    finish(st, "end");
    return;
  }
  const m = meta.moments[st.mi];
  st.gaDay = Math.max(st.gaDay, gaAt(m, st.t - st.starts[st.mi]));
  cues(st);
  if (st.t >= meta.capS - 1e-9) finish(st, "cap");
}

// ---- the picture ----

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

const phraseAt = (st, t) => st.phrases.find((ph) => t >= ph.t0 && t < ph.t1) || null;

function handLevel(st) {
  const u = st.t - st.handT;
  if (!(u >= 0)) return 0;
  if (u < TUNE.handRiseS) return u / TUNE.handRiseS;
  if (u < TUNE.handRiseS + TUNE.handHoldS) return 1;
  return clamp01(1 - (u - TUNE.handRiseS - TUNE.handHoldS) / TUNE.handFadeS);
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const t = st.t;
  const mm = mmPerShortAxis(meta, st.gaDay);
  const gp = clamp01((st.gaDay - 105) / (195 - 105));
  const lift = st.eyesT === null ? 0 : clamp01((t - st.eyesT) / TUNE.liftS);
  d.camera = { x: 0, y: V.camY, span: V.span, rot: 0, orient: meta.orient, mmPerU: mm / V.span };
  d.scale = { mm: bar(mm) };
  d.light = { level: lerp(V.level0, V.level1, Math.max(gp, lift)), warm: V.warm, exposure: 1, white: 0,
    vignette: lerp(V.vignette0, V.vignette1, lift), tint: V.tint };
  d.warp = V.warp;
  d.caustics = V.caustics;

  const B = V.baby, size = lerp(B.size0, B.size1, gp);
  d.splats = figure("thumb", size, st.gaDay, { x: B.x, y: B.y });
  const herPh = clamp01(st.beats.phase("mother", t));

  // ripples: her heard heartbeat, the hummed notes, the ghost slots and your answers
  const rip = [];
  if (st.mi <= BEAT) rip.push({ x: B.x, y: B.y, r: V.motherR + 8 * herPh, a: 0.35 * (1 - herPh), dashed: false });
  for (const x of st.track.targets) {
    const tj = st.litAt[x.id];
    if (x.group !== "beat" || !(t >= tj && t < tj + V.litS)) continue;
    const u = (t - tj) / V.litS;
    rip.push({ x: B.x, y: B.y, r: V.motherR + 8 * u, a: 0.8 * (1 - u), dashed: false });
  }
  let hum = 0;
  for (const c of st.calls) {
    if (!(t >= c.t && t < c.t + V.rippleS)) continue;
    const u = (t - c.t) / V.rippleS;
    hum = Math.max(hum, 1 - u);
    rip.push({ x: V.slotX[c.k], y: V.slotY, r: 3 + 9 * u, a: 0.9 * (1 - u), dashed: false });
    rip.push({ x: V.voice.x, y: V.voice.y, r: V.voice.r + 10 * u, a: 0.6 * (1 - u), dashed: false });
  }
  const ph = st.mi === PHRASES ? phraseAt(st, t) : null;
  if (ph) {
    const answering = t >= ph.tAnswer;
    for (const n of ph.notes) {
      const tj = st.litAt[n.id];
      if (Number.isFinite(tj) && t >= tj) {
        const u = Math.min(1, (t - tj) / V.litS);
        rip.push({ x: V.slotX[n.k], y: V.slotY, r: 6 + 6 * u, a: 1 - 0.5 * u, dashed: false });
      } else {
        const missed = t > n.tAns + 0.25;
        rip.push({ x: V.slotX[n.k], y: V.slotY, r: 6, a: missed ? 0.15 : answering ? 0.5 : 0.3, dashed: true });
      }
    }
  }
  d.strips.push({ kind: "ripples", items: rip });

  // the placenta disc's tree and the cord to your belly, a light running down it on her beat
  const dx = st.carry.nestleX * V.disc.spread, dy = V.disc.y;
  if (st.tree && st.tree.n > 1) d.strips.push({ kind: "tree", nodes: st.tree.view, version: st.tree.version, pulse: herPh });
  const belly = { x: B.x + 0.06 * size, y: B.y - 0.16 * size };
  const p0 = { x: dx, y: dy - V.disc.r * 0.7 }, pc = { x: dx * 0.5 + 44, y: 6 };
  const pts = [];
  const sway = Math.sin(t * 0.8) * 2;
  for (let i = 0; i < 10; i++) {
    const s = i / 9, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    pts.push(a * p0.x + b * (pc.x + sway) + c * belly.x, a * p0.y + b * pc.y + c * belly.y);
  }
  d.strips.push({ kind: "cord", pts, lights: [herPh] });

  // marks: the disc, the voice's warm patch, the hand glow, the four slots and the beat cursor, your glow, sparks
  d.marks.push({ kind: "glowwall", x: dx, y: dy, r: V.disc.r, rim: "wavy", on: true, pulse: herPh });
  d.marks.push({ kind: "warm", x: V.voice.x, y: V.voice.y, r: V.voice.r, rim: "solid", on: st.mi >= PHRASES ? 0.3 + 0.7 * hum : 0.15, pulse: hum });
  const hand = handLevel(st);
  if (hand > 0) d.marks.push({ kind: "hand", x: V.hand.x, y: V.hand.y, r: V.hand.r, rim: "solid", on: hand, pulse: hand });
  if (ph) {
    const cur = Math.floor((t - ph.t0) / BEAT_S + 1e-6);
    const slot = cur < TUNE.callBeats ? cur : cur - TUNE.callBeats;
    for (let k = 0; k < 4; k++) {
      const note = ph.pat[k] === "x";
      d.marks.push({ kind: "spot", x: V.slotX[k], y: V.slotY, r: 4, rim: note ? "solid" : "dotted", on: note, pulse: slot === k && cur < 8 ? 1 : 0 });
    }
    if (cur < TUNE.callBeats + TUNE.answerBeats) {
      d.marks.push({ kind: "light", x: V.slotX[Math.max(0, Math.min(3, slot))], y: V.slotY - 9, r: 2.5, on: true, pulse: 1 - herPh });
    }
    if (t >= ph.tAnswer && cur < TUNE.callBeats + TUNE.answerBeats) d.marks.push({ kind: "glow", x: B.x, y: B.y, r: 20, on: 0.6, pulse: 1 - herPh });
  }
  const sparks = Math.max(0, Math.min(8, st.carry.sparks | 0));
  for (let i = 0; i < sparks; i++) {
    const a = Math.PI / 2 + (i - (sparks - 1) / 2) * 0.45;
    d.marks.push({ kind: "light", x: B.x + 25 * Math.cos(a), y: B.y + 25 * Math.sin(a), r: 1.2, on: true, pulse: herPh });
  }

  // rings (DOM SVG): her heart (the target heart), yours (faint, dashed), every target in its preview, feedback
  d.rings.push({ id: "mother", kind: "mother", x: B.x, y: B.y, r: V.motherR, progress: herPh });
  const you = st.beats.you;
  if (you && you.length) d.rings.push({ id: "you", kind: "you", x: B.x + 1, y: B.y - 1, r: V.youR, progress: clamp01(st.beats.phase("you", t)), dashed: true });
  const next = targets(st, V.approachS).slice(0, 5);
  for (const x of next) {
    const w = st.where[x.id];
    const p = clamp01(1 - (x.t - t) / V.approachS);
    d.rings.push({ id: "t:" + x.id, kind: "approach", x: w.x, y: w.y, r: lerp(w.r0, w.r1, p), progress: p });
  }
  if (st.fb && t >= st.fb.t && t < st.fb.t + V.fbS && st.where[st.fb.id]) {
    const w = st.where[st.fb.id];
    d.rings.push({ id: "fb", kind: "approach", x: w.x, y: w.y, r: w.r1, progress: 1, grade: st.fb.grade, dotted: st.fb.grade === "off" });
  }

  d.anchor = { x: B.x, y: B.y };
  if (next.length) d.cue = { x: st.where[next[0].id].x, y: st.where[next[0].id].y };
  else if (st.mi === PHRASES) d.cue = { x: V.voice.x, y: V.voice.y };
  else if (st.mi <= BEAT) d.cue = { x: B.x, y: B.y };
  else d.cue = null;
  return d;
}

export function prompt(st) {
  return st.done ? { ...NONE } : promptOf(st.mi);
}

export function targets(st, horizonS) {
  if (!st || st.done || !st.track) return [];
  const h = Number.isFinite(horizonS) ? horizonS : 3;
  return upcoming(st.track, st.t, h).map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group }));
}

// A tap-only stage: no steering, no hold. It keeps no memory, so it never touches r or r.mem.
export function botSteer(st, skill, r) {
  return { steer: { x: 0, y: 0 }, dir: null, hold: false };
}

export function probe(st) {
  return null;
}

export function result(st) {
  const beatAcc = accOf(st, "beat"), answerAcc = accOf(st, "answer");
  const beatPts = Math.round(S.beat * beatAcc), answerPts = Math.round(S.answer * answerAcc);
  const goalMet = !!st.done;
  const score = clampScore({ goal: goalMet ? PARTS.goal : 0, skill: beatPts + answerPts, flourish: st.flourish });
  return {
    done: !!st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "beat", label: "answer.part.beat", value: beatPts, max: S.beat },
      { id: "answer", label: "answer.part.answer", value: answerPts, max: S.answer },
      { id: "flourish", label: "answer.part.flourish", value: score.flourish, max: S.flourishMax },
    ],
    metrics: {
      beatAccuracy: beatAcc, answerAccuracy: answerAcc, matches: st.matches, perfect: st.perfect,
      phrases: st.phrases.length, notes: NOTES, lit: st.lit, eyesOpen: st.eyesT !== null, moment: st.moment, how: st.how,
    },
    carryOut: { song: { notes: st.song.slice(), lit: st.lit } },
  };
}

// Fair resume (5.2): the open targets of the first 1.2 s after Resume are free: left out of the beat and answer
// accuracies, and of their phrase's match and Flourish.
export function resume(st) {
  if (!st || st.done || !st.track) return 0;
  const was = st.track.targets.map((x) => !!x.free);
  const n = freeUntil(st.track, st.t + RESUME_FREE_S);
  st.track.targets.forEach((x, i) => {
    if (!x.free || was[i]) return;
    if (st.free[x.group]) st.free[x.group].n++;
    const ph = x.group === "answer" ? st.phrases[x.phrase] : null;
    if (ph) ph.freeN = (ph.freeN || 0) + 1;
  });
  return n;
}

export function jump(st, id) {
  const i = IDS.indexOf(id);
  if (i < 0 || !st || !st.track) return false;
  st.done = false;
  st.how = null;
  if (i > EYES) openEyes(st);
  plan(st, i, st.t);
  // the moments jumped past are over: their sub-goals settle now
  if (i > BEAT) settleBeat(st);
  if (i > PHRASES) {
    for (const ph of st.phrases) if (ph.matched === null) settlePhrase(st, ph, st.t);
    settleAnswer(st);
  }
  enter(st, i);
  cues(st);
  return true;
}
