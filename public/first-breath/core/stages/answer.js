// First Breath: stage 6, Second Trimester (`answer`): the rhythm stage. "Listen. Then answer." (openspec change
// first-breath-action-genres, design.md 5.6; the v1 judge, beats and facts, archive design.md 5.1, 5.2, 6.6). Pure: no
// DOM, no clocks, no storage, no Math.random; every draw comes from seeded streams (core/rng.js). Deterministic, and
// step() never throws.
//
// A note highway on her 78 bpm beats (laid once in create from opts.motherPhase, no jitter while targets run). Three
// lanes fan from the warm patch on the wall down to your ring. Every note shows at the wall 4 of her beats before its
// time and rides its lane down; be in its lane and press as it reaches your ring: a kick. No hp, no foes: a miss only
// adds less, and the voice never stops.
// - `hear` (week 15, 3 s, no input): her heartbeat turns from felt to heard (milestone `hearing`, fact answer.hear).
//   The first heartbeat notes already ride down the middle lane.
// - `beat` (weeks 15 to 18, 12 of her beats from her first beat at or after 3.0 s): 6 kicks on every 2nd beat (beats
//   1, 3, ... 11), all in the middle lane. One lane: any tap or key kicks. Sub-goal `beat`.
// - `phrases` (weeks 19 to 24, 6 phrases of 9 beats): 4 beats of call, 4 of answer, 1 of gap. As she hums a call note
//   it shows as a gold ripple at the top of its lane; the same note rides down and reaches your ring 4 beats later, on
//   its answer slot. Patterns M..., L.R., LM.R, R.LM, LMR., RMLM (16 notes). Lanes open here. An answer with at least
//   75% of its notes Close or better is a match: "{Carer} feels you." and, from phrase 2, the hand glow on the wall.
//   Sub-goal `answer`.
// - `song` (weeks 24 to 25, 17 beats): the sing-along. The 16 call notes back to back, one a beat, in their lanes, with
//   {carer} humming each one with you; then the jump note, a wide band across all three lanes (a press in any lane
//   counts) with a soft boom from outside and a startle. The fever: 8 In time notes in a row light the glow round your
//   ring, warm the lanes and add a soft chord under the hum; while it is lit each sing-along note counts x1.5 toward
//   the song part (capped at the part's max). A miss puts it out.
// - `eyes` (weeks 25 to 26, 4 s, no input): fact answer.jump; at its end (gaDay 182) the eyes open by themselves
//   (milestone `eyes`) and the vignette lifts over 2 s. `outro` (week 27, 3 s, no input), then the stage ends.
// Length ≈ 3 + 9.2 + 41.5 + 13.1 + 4 + 3 ≈ 74 s for every input (plus under one beat of her phase); cap 90 s.
//
// Lanes (design.md 5.6, 4.2): touch kicks in the lane you tap (its world x at the touch-down, ui/input.js) and a drag
// slides one lane per 24 px from the touch-down (the stick's x past 0.33, two lanes past 0.83) and stays when you lift;
// with keys "lanes" an arrow keydown is a press with its dir: left and right move one lane and kick in the new lane
// (Crypt of the NecroDancer), up and down kick where you are, as Space, Enter and Z do. A kick in the wrong lane waits
// 0.12 s: if a flick, a drag or a second arrow puts you in the note's lane by then, it counts there (with the better
// timing of the two presses); else it is Close at best. Lanes do not matter in `beat`, for the jump note, or with
// Assist. intents.dir is the lane to be in (left, up or down for the middle, right): only core/bots.js and one-button
// mode (core/run.js from botSteer) set it in a "lanes" moment, and then presses never move the lane.
//
// Score (design.md 5.6): Goal 3,000; Skill 1,000 x beat accuracy (6) + 3,000 x answer accuracy (16) + 2,000 x song
// accuracy (17, with the fever); Flourish 1,000 x min(1, best In time streak / 24). Carry in: nestleX and treeSeed
// (the placenta disc on the wall and its tree), sparks (rim sparks). Carry out: song = { notes: the 16 call notes
// (MIDI), lit: bit k set when call note k was kicked Close or better, in the phrases or the sing-along }.
//
// Events beyond the shared ones: sfx answer.hum { at, pitch, note, lane } for each hummed note (sent up to 0.2 s ahead
// of `at`: in the phrases at the call, in the sing-along on the note), answer.thump at each kick that lands Close or
// better, answer.hand (a warm low chord) with each hand glow, as the fever lights and under each hum while it is lit,
// answer.boom with the jump note; caption answer.cap.hum.<lanes> at each call, answer.feels on each match,
// answer.cap.fever as the fever first lights; judge events carry the note's lane; fact { id, where: "caption" } for
// each caption fact once the clock shows its week.
//
// Contract choices: one track holds every group ("beat", "answer", "song"); P is the seconds since the previous
// target (the beat period for the first), floored at 0.5 s (v1 5.2). Presses count only while the live gesture is
// `tap`. jump(state, id) starts that moment now (a `beat`, `phrases` or `song` jump lays its notes from her next
// beat), drops the notes and scoring of that moment and the ones after it, keeps what came before, and opens the eyes
// when it skips past `eyes`.
import { DT, gaAt, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { stream, pick } from "../rng.js";
import { emit } from "../events.js";
import { CREDIT, GRACE_S, grade as gradeOf } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { createTrack, upcoming, freeUntil, RESUME_FREE_S } from "../lib/track.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { figure } from "../lib/figure.js";
import { createTree, growTree } from "../lib/colonize.js";
import { TUNE } from "./answer.tune.js";
import { FACTS } from "./answer.facts.js";

const BEAT_S = 60 / TUNE.bpm;
const TRAVEL_S = TUNE.travelBeats * BEAT_S;
const BT = TUNE.beat;
const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "answer", index: 5, name: "Second Trimester", verb: "Answer",
  orient: "fit",
  families: Object.freeze(["tap", "steer"]),
  ga: Object.freeze({ start: 98, end: 195 }), fertilized: true,
  mm: Object.freeze({ start: 150, end: 600 }),
  motherBpm: TUNE.bpm, parS: 74, capS: 90, canFail: false, scored: true,
  moments: Object.freeze([
    mo("hear", 105, 105),
    mo("beat", 105, 126, BT.beats * BEAT_S),
    mo("phrases", 133, 168, TUNE.patterns.length * TUNE.phraseBeats * BEAT_S),
    mo("song", 168, 175, TUNE.songBeats * BEAT_S),
    mo("eyes", 175, 182, TUNE.eyesS),
    mo("outro", 189, 195, TUNE.outroS),
  ]),
});

const IDS = meta.moments.map((m) => m.id);
const HEAR = 0, BEAT = 1, PHRASES = 2, SONG = 3, EYES = 4, OUTRO = 5, LAST = OUTRO;
const GESTURE = Object.freeze({ hear: "none", beat: "tap", phrases: "tap", song: "tap", eyes: "none", outro: "none" });
const GROUP_MOMENT = Object.freeze({ beat: BEAT, answer: PHRASES, song: SONG });
const LANE_OF = Object.freeze({ L: 0, M: 1, R: 2 });
const LANE_DIR = Object.freeze(["left", "up", "right"]);
const DIR_LANE = Object.freeze({ left: 0, up: 1, down: 1, right: 2 });
// the 16 call notes' lanes, in order (the sing-along plays them back to back)
const SONG_LANES = Object.freeze(TUNE.patterns.join("").split("").filter((c) => c !== ".").map((c) => LANE_OF[c]));
const NOTES = SONG_LANES.length;                                       // 16
const TOTAL = Object.freeze({ beat: BT.notes, answer: NOTES, song: NOTES + 1 });
// The caption facts (design.md 5.6): answer.hear as `hear` starts; answer.feel in the quiet `beat` as the clock
// reaches its week 16; answer.respond with phrase 1, answer.w20 and answer.low as the clock reaches their days (in
// phrases 2 and 4, after each one's hum line); answer.jump right after the jump note (the clock's week 25).
// answer.outside and answer.hic have no room: they are "What was real" facts on the result.
const FACT_AT = Object.freeze({ "answer.respond": 133, "answer.w20": 140, "answer.low": 154 });
const FEEL = FACTS.find((f) => f.id === "answer.feel");
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const S = TUNE.score;
const V = TUNE.view;
const LN = V.lanes;
const FEVER = TUNE.fever;
const PENDING = Object.freeze({ grade: "pending", errMs: null, rawMs: null });

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const lerp = (a, b, p) => a + (b - a) * p;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clampLane = (j) => Math.max(0, Math.min(2, Math.round(j)));

// ---- the highway's geometry (world u): u is 0 at the wall and 1 at your ring
export const laneX = (j, u) => (j - 1) * lerp(LN.gap0, LN.gap1, u);
export const laneY = (u) => lerp(LN.y0, LN.y1, u);
const laneW = (u) => lerp(LN.w0, LN.w1, u);
const noteR = (u) => lerp(LN.r0, LN.r1, Math.max(0, Math.min(1.2, u)));
const uOf = (x, t) => 1 - (x.t - t) / TRAVEL_S;
// The lane under a world point: by the fan's own lines above your ring, by the lines at your ring below it.
export function laneAt(x, y) {
  const u = Math.max(0, Math.min(1, (LN.y0 - y) / (LN.y0 - LN.y1)));
  const half = lerp(LN.gap0, LN.gap1, u) / 2;
  return x < -half ? 0 : x > half ? 2 : 1;
}

// ---- her beats

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

// The song: a seeded walk on the pentatonic set, one note per call note (16).
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
const humLanes = (pat) => pat.split("").filter((c) => c !== ".").join("");

// ---- the plan: moment starts, notes, phrases and timed cues from moment `from` at time t0

function resetFrom(st, from) {
  if (from <= BEAT) { st.credit.beat = 0; st.judged.beat = 0; st.free.beat = { n: 0, credit: 0 }; }
  if (from <= PHRASES) {
    st.credit.answer = 0; st.judged.answer = 0; st.free.answer = { n: 0, credit: 0 }; st.phrases = []; st.calls = [];
    st.matches = 0; st.handT = -Infinity;
  }
  if (from <= SONG) {
    st.credit.song = 0; st.judged.song = 0; st.free.song = { n: 0, credit: 0 }; st.sings = [];
    st.fever = false; st.feverT = -Infinity; st.feverOffT = -Infinity; st.feverNotes = 0; st.jumpT = null; st.jumpHit = null;
  }
  if (from <= BEAT) { st.streak = 0; st.best = 0; st.combo = 0; st.flourish = 0; st.lit = 0; }
  else if (from <= PHRASES) {
    // the song mask keeps only what came before
    st.lit = 0;
  }
}

function plan(st, from, t0) {
  // keep the judged notes (and results) of the moments before `from`; drop the open ones and the rest
  const keep = [], kept = new Map();
  if (st.track) {
    st.track.targets.forEach((x, i) => {
      const r = st.track.results[i];
      if (GROUP_MOMENT[x.group] < from && r && r !== PENDING) { keep.push(x); kept.set(x.id, r); }
    });
  }
  st.pend = [];
  st.gen++;
  resetFrom(st, from);
  const add = [];
  let cur = t0;
  for (let j = from; j <= LAST; j++) {
    st.starts[j] = j === from ? t0 : cur;
    if (j === HEAR) cur = st.starts[j] + TUNE.hearS;
    else if (j === BEAT) {
      const n0 = beatIdx(st, st.starts[j]);
      if (j !== from) st.starts[j] = beatTime(st, n0);
      for (let k = 0; k < BT.notes; k++) {
        add.push({ id: `beat.${st.gen}.${k}`, t: beatTime(st, n0 + BT.first + k * BT.every), kind: "tap", heart: "mother",
          group: "beat", lane: 1 });
      }
      cur = beatTime(st, n0 + BT.beats);
    } else if (j === PHRASES) {
      const n0 = beatIdx(st, st.starts[j]);
      if (j !== from) st.starts[j] = beatTime(st, n0);
      let note = 0;
      TUNE.patterns.forEach((pat, p) => {
        const base = n0 + p * TUNE.phraseBeats;
        const ph = {
          p, pat, lanes: humLanes(pat), t0: beatTime(st, base), tAnswer: beatTime(st, base + TUNE.callBeats),
          t1: beatTime(st, base + TUNE.phraseBeats), notes: [], good: 0, inTime: 0, judged: 0, matched: null,
          freeN: 0, freeGood: 0, freeIn: 0,
        };
        for (let k = 0; k < pat.length; k++) {
          if (pat[k] === ".") continue;
          const lane = LANE_OF[pat[k]];
          const id = `answer.${st.gen}.${p}.${k}`;
          const tCall = beatTime(st, base + k), tAns = beatTime(st, base + TUNE.callBeats + k);
          ph.notes.push({ k, lane, song: note, tCall, tAns, id });
          st.calls.push({ t: tCall, lane, k, p, song: note, midi: st.song[note] });
          add.push({ id, t: tAns, kind: "tap", heart: "mother", group: "answer", lane, slot: k, phrase: p, song: note });
          note++;
        }
        st.phrases.push(ph);
      });
      cur = beatTime(st, n0 + TUNE.patterns.length * TUNE.phraseBeats);
    } else if (j === SONG) {
      const n0 = beatIdx(st, st.starts[j]);
      if (j !== from) st.starts[j] = beatTime(st, n0);
      for (let k = 0; k < NOTES; k++) {
        const t = beatTime(st, n0 + k);
        add.push({ id: `song.${st.gen}.${k}`, t, kind: "tap", heart: "mother", group: "song", lane: SONG_LANES[k], song: k });
        st.sings.push({ t, lane: SONG_LANES[k], song: k, midi: st.song[k] });
      }
      st.jumpT = beatTime(st, n0 + NOTES);
      add.push({ id: `song.${st.gen}.${NOTES}`, t: st.jumpT, kind: "tap", heart: "mother", group: "song", lane: -1, jump: true });
      cur = beatTime(st, n0 + TUNE.songBeats);
    } else if (j === EYES) cur = st.starts[j] + TUNE.eyesS;
    else cur = st.starts[j] + TUNE.outroS;
  }
  st.end = cur;

  // P: the seconds since the previous target, or for the first its own group's spacing (the heartbeat kicks every
  // 2nd beat, P 1.54 s; the others one beat); floored at 0.5 s (v1 5.2)
  const all = [...keep, ...add].sort((a, b) => a.t - b.t);
  all.forEach((x, i) => {
    if (!Number.isFinite(x.P)) x.P = Math.max(0.5, i ? x.t - all[i - 1].t : x.group === "beat" ? BT.every * BEAT_S : BEAT_S);
  });
  st.track = createTrack(all, { assist: st.assist, lag: st.lag });
  st.track.targets.forEach((x, i) => { if (kept.has(x.id)) st.track.results[i] = kept.get(x.id); });

  // timed cues, sorted by when they go out
  const cues = [];
  const cue = (at, name, data) => cues.push({ at, name, data });
  // a fact goes out a moment after the clock reaches its day, so the label it shows is the fact's own week
  const dayAt = (j, g) => { const m = meta.moments[j]; return st.starts[j] + (m.lenS * (g - m.ga[0])) / (m.ga[1] - m.ga[0]) + 0.02; };
  if (from <= HEAR) cue(st.starts[HEAR], "fact", { id: "answer.hear", where: "caption" });
  if (from <= BEAT && FEEL) cue(dayAt(BEAT, FEEL.gaDay), "fact", { id: "answer.feel", where: "caption" });
  if (from <= PHRASES) {
    for (const ph of st.phrases) cue(ph.t0, "caption", { id: "answer.cap.hum." + ph.lanes, dir: null });
    for (const [id, g] of Object.entries(FACT_AT)) cue(g === meta.moments[PHRASES].ga[0] ? st.starts[PHRASES] : dayAt(PHRASES, g), "fact", { id, where: "caption" });
    for (const c of st.calls) {
      cue(Math.max(st.starts[PHRASES], c.t - TUNE.humLeadS), "sfx",
        { id: "answer.hum", at: c.t, pitch: hz(c.midi), gain: 1, note: c.midi, lane: c.lane, phrase: c.p });
    }
  }
  if (from <= SONG) {
    for (const s of st.sings) cue(Math.max(st.starts[SONG], s.t - TUNE.humLeadS), "sing", s);
    cue(Math.max(st.starts[SONG], st.jumpT - TUNE.humLeadS), "sfx", { id: "answer.boom", at: st.jumpT, pitch: 49, gain: 1 });
  }
  if (from <= EYES) cue(st.starts[EYES], "fact", { id: "answer.jump", where: "caption" });
  st.cues = cues.sort((a, b) => a.at - b.at);
  st.ci = 0;
}

// ---- moments

const laned = (st) => st.mi === PHRASES || st.mi === SONG;

function promptOf(st, i) {
  const id = IDS[i];
  const g = GESTURE[id];
  let text = "answer.prompt." + id;
  if (st.oneButton && (id === "phrases" || id === "song")) text += ".one";
  return { gesture: g, text, keys: g === "tap" ? "lanes" : "steer" };
}

function openEyes(st) {
  if (st.eyesT !== null) return;
  st.eyesT = st.t;
  emit(st, "milestone", { id: "eyes" });
}

// Moment i ends: gaDay jumps to its end (v1 4.1); the eyes open at the end of `eyes`.
function leave(st, i) {
  st.gaDay = Math.max(st.gaDay, meta.moments[i].ga[1]);
  if (i === EYES) openEyes(st);
}

function enter(st, i) {
  st.mi = i;
  st.moment = IDS[i];
  st.gaDay = meta.moments[i].ga[0];
  emit(st, "moment", { id: st.moment });
  emit(st, "prompt", promptOf(st, i));
  if (i === HEAR) emit(st, "milestone", { id: "hearing" });
  if (i === BEAT) subgoal(st, "beat", "answer.sub.beat");
  if (i === PHRASES) subgoal(st, "answer", "answer.sub.answer");
  if (i === SONG && st.streak >= FEVER.need) feverOn(st, st.t);
  if (i >= EYES) { setLane(st, 1, st.t); st.drag = null; if (st.fever) feverOff(st, st.t); }
}

// ---- lanes

function setLane(st, j, t) {
  const to = clampLane(j);
  if (to === st.lane) return;
  st.laneFrom = laneShown(st, t);
  st.laneAt = t;
  st.lane = to;
}
// Your ring's lane as drawn: sliding from where it was to the new lane over slideS.
function laneShown(st, t) {
  const p = clamp01((t - st.laneAt) / V.slideS);
  return lerp(st.laneFrom, st.lane, p);
}
const laneOk = (st, x) => x.lane < 0 || x.group === "beat" || st.assist || st.lane === x.lane;

// A press moves the lane: by where it touched, or by its arrow. Nothing moves in a one-lane moment, in one-button mode,
// or while the bot or the run sets the lane this step.
function laneByPress(st, p) {
  if (!laned(st) || st.oneButton || st.goalStep) return;
  if (fin(p.x) && fin(p.y)) {
    setLane(st, laneAt(p.x, p.y), p.t);
    st.drag = { lane0: st.lane };
    return;
  }
  st.drag = null;
  if (p.dir === "left") setLane(st, st.lane - 1, p.t);
  else if (p.dir === "right") setLane(st, st.lane + 1, p.t);
}

// ---- judging

// A group's accuracy: Σ credit / its notes. A free note (after a resume, v1 5.2) is left out of both, unless every
// note of the group is free. The song's credit carries the fever's x1.5 and is capped at 1.
function accOf(st, group) {
  const total = TOTAL[group];
  const f = st.free[group];
  const n = total - f.n;
  const a = n > 0 ? st.credit[group] / n : total > 0 ? (st.credit[group] + f.credit) / total : 0;
  return Math.min(1, a);
}
const partOf = (st, group) => Math.round(S[group] * accOf(st, group));
const skillOf = (st) => partOf(st, "beat") + partOf(st, "answer") + partOf(st, "song");
const flourishOf = (st) => Math.round(S.flourishMax * Math.min(1, st.best / S.streak));

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

// A phrase's last note is judged: the match and the hand glow from phrase 2.
function settlePhrase(st, ph, t) {
  // the notes that count: a free one (after a resume, v1 5.2) is left out, unless every note of the phrase is free
  const n = ph.notes.length, all = (ph.freeN || 0) >= n;
  const den = all ? n : n - ph.freeN;
  const good = all ? ph.good + (ph.freeGood || 0) : ph.good;
  ph.matched = den > 0 && good / den >= TUNE.matchK - 1e-9;
  if (ph.matched) {
    st.matches++;
    emit(st, "caption", { id: "answer.feels", dir: null, t });
    if (ph.p >= TUNE.handFrom) {
      st.handT = t;
      emit(st, "sfx", { id: "answer.hand", at: t, pitch: hz(st.song[ph.notes[0].song] - 24), gain: 0.8, t });
    }
  }
  if (st.phrases.every((q) => q.matched !== null)) settleAnswer(st);
}

function feverOn(st, t) {
  if (st.fever) return;
  st.fever = true;
  st.feverT = t;
  if (!st.feverSeen) { st.feverSeen = true; emit(st, "caption", { id: "answer.cap.fever", dir: null, t }); }
  emit(st, "sfx", { id: "answer.hand", at: t, pitch: hz(st.song[0] - 12), gain: 0.9, t });
  // a word over your ring as it lights (Guitar Hero's star power call-out, in plain words)
  st.pops.push({ x: laneX(st.lane, 1), y: LN.y1 + V.ringR + 4, word: "answer.pop.fever", combo: 0, t });
}
function feverOff(st, t) {
  if (!st.fever) return;
  st.fever = false;
  st.feverOffT = t;
}

// Where a note's effects show: its lane at your ring (the jump note across the middle).
const hitX = (st, x) => (x.lane < 0 ? 0 : laneX(x.lane, 1));

function judged(st, r) {
  const x = r.target;
  const at = Number.isFinite(r.errMs) ? x.t + r.errMs / 1000 : st.t;          // a miss: the step that saw it
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart, lane: x.lane, t: at });
  st.fb = { t: at, id: x.id, grade: r.grade, lane: x.lane };
  if (r.grade === "off") return;                          // Off changes nothing; the note stays open (v1 5.2)
  const c = CREDIT[r.grade] || 0;
  const skill0 = skillOf(st), flo0 = st.flourish;
  // a streak carried in from the phrases lights the fever on the sing-along's first note (that note can land a moment
  // before the step that starts the song)
  if (x.group === "song" && c > 0 && st.streak >= FEVER.need) feverOn(st, at);
  // streaks: In time in a row (the Flourish and the fever), and the combo (Close or better in a row)
  if (r.grade === "in") { st.streak++; if (st.streak > st.best) st.best = st.streak; } else st.streak = 0;
  st.combo = c > 0 ? st.combo + 1 : 0;
  let add = c;
  if (x.group === "song" && st.fever && c > 0) { add = c * FEVER.k; st.feverNotes++; }
  const f = x.free ? st.free[x.group] : null;                 // a free note's credit is kept apart
  if (f) f.credit += add; else st.credit[x.group] += add;
  st.judged[x.group]++;
  if (r.grade === "miss") feverOff(st, at);
  else if (x.group === "song" && r.grade === "in" && st.streak >= FEVER.need) feverOn(st, at);
  st.flourish = flourishOf(st);
  const dSkill = skillOf(st) - skill0, dFlo = st.flourish - flo0;
  if (dSkill > 0) emit(st, "points", { part: "skill", add: dSkill, t: at });
  if (dFlo > 0) emit(st, "points", { part: "flourish", add: dFlo, t: at });
  // what you see and hear
  const hx = hitX(st, x);
  st.pops.push({ x: hx, y: LN.y1 - V.ringR - 5, word: "answer.pop." + r.grade, combo: c > 0 ? st.combo : 0, t: at });
  if (c > 0) {
    emit(st, "sfx", { id: "answer.thump", at, pitch: st.fever ? 82 : 70, gain: c, t: at });
    // your kick plays her note back (Rhythm Heaven: your answer makes the sound), softer when only Close
    const midi = Number.isInteger(x.song) && x.song < NOTES ? st.song[x.song] : null;
    if (midi !== null) emit(st, "sfx", { id: "answer.echo", at, pitch: hz(midi + 12), gain: c * (st.fever ? 1 : 0.8), t: at });
    const big = r.grade === "in";
    if (x.jump) for (let j = 0; j < 3; j++) st.bursts.push({ x: laneX(j, 1), y: LN.y1, r: 5, kind: 2, t: at, rot: j * 0.7 });
    else st.bursts.push({ x: hx, y: LN.y1, r: big ? 4 : 2.6, kind: big ? 2 : 1, t: at, rot: (st.gen * 0.37 + x.t * 1.7) % 6.283 });
    st.hits.push({ x: hx, lane: x.lane, t: at, big: big || !!x.jump });
    st.litAt[x.id] = at;
  }
  if (x.jump) st.jumpHit = c > 0 ? at : null;
  if (c >= CREDIT.close && Number.isInteger(x.song) && x.song < NOTES) st.lit |= 1 << x.song;
  if (x.group === "beat") {
    if (st.judged.beat >= TOTAL.beat) settleBeat(st);
    return;
  }
  if (x.group !== "answer") return;
  const ph = st.phrases[x.phrase];
  if (!ph) return;
  if (c >= CREDIT.close) { if (x.free) ph.freeGood++; else ph.good++; }
  ph.judged++;
  if (ph.judged >= ph.notes.length && ph.matched === null) settlePhrase(st, ph, at);
}

const deadline = (tr, i) => tr.targets[i].t + tr.wins[i].close + GRACE_S + (tr.lag || 0);

// Every open note whose miss time is before t is missed.
function missBefore(st, t) {
  const tr = st.track;
  for (let i = 0; i < tr.targets.length; i++) {
    if (tr.results[i] === null && deadline(tr, i) < t) {
      tr.results[i] = { grade: "miss", errMs: null, rawMs: null };
      judged(st, { target: tr.targets[i], grade: "miss", errMs: null, rawMs: null });
    }
  }
}

// The open note nearest a press within its Off window, with its grade: → { i, err, grade } or null (a free press).
function nearest(st, t) {
  const tr = st.track;
  let best = null;
  for (let i = 0; i < tr.targets.length; i++) {
    if (tr.results[i] !== null) continue;
    const x = tr.targets[i];
    const err = t - x.t;
    const g = gradeOf(err, x.P, tr.assist);
    if (g !== null && (!best || Math.abs(err) < Math.abs(best.err))) best = { i, err, grade: g };
  }
  return best;
}

const RANK = { in: 2, close: 1 };
function close(st, i, grade, err, raw) {
  const tr = st.track, x = tr.targets[i];
  const r = { grade, errMs: err * 1000, rawMs: (raw - x.t) * 1000 };
  tr.results[i] = r;
  judged(st, { target: x, ...r });
}
// A kick that waited for its lane: it counts there (with the better of its timings), or Close at best.
function settlePend(st, pd, ok) {
  st.pend.splice(st.pend.indexOf(pd), 1);
  const grade = ok ? pd.grade : "close";
  close(st, pd.i, grade, pd.err, pd.raw);
}

function press(st, p) {
  missBefore(st, p.t);
  for (const pd of st.pend.slice()) if (pd.until < p.t) settlePend(st, pd, false);
  laneByPress(st, p);
  st.kickT = p.t;
  st.kickLane = st.lane;
  const tr = st.track;
  // a kick waiting for its lane that this press puts right: the better timing of the two
  for (const pd of st.pend) {
    const x = tr.targets[pd.i];
    if (!laneOk(st, x)) continue;
    const g = gradeOf(p.t - x.t, x.P, tr.assist), e = p.t - x.t;
    const better = (RANK[g] || 0) - (RANK[pd.grade] || 0);
    if (better > 0 || (better === 0 && RANK[g] && Math.abs(e) < Math.abs(pd.err))) { pd.grade = g; pd.err = e; pd.raw = p.raw; }
    settlePend(st, pd, true);
    return;
  }
  const hit = nearest(st, p.t);
  if (!hit) return;                                             // a free press: nothing happens
  const x = tr.targets[hit.i];
  if (hit.grade === "off") {
    judged(st, { target: x, grade: "off", errMs: hit.err * 1000, rawMs: (p.raw - x.t) * 1000 });
    return;
  }
  if (laneOk(st, x)) { close(st, hit.i, hit.grade, hit.err, p.raw); return; }
  tr.results[hit.i] = PENDING;
  st.pend.push({ i: hit.i, grade: hit.grade, err: hit.err, raw: p.raw, until: p.t + TUNE.flickS });
}

// One step's kicks, lanes, waiting kicks and misses, up to tEnd.
function feed(st, presses, it, tEnd) {
  for (const p of presses) press(st, p);
  // a drag slides the lane from where it touched down; it ends when the finger lifts
  if (!it.touching || (Array.isArray(it.releases) && it.releases.length)) st.drag = null;
  else if (st.drag && laned(st) && !st.oneButton && !st.goalStep && it.steer && fin(it.steer.x)) {
    const a = Math.abs(it.steer.x);
    const o = a >= TUNE.slide.two ? 2 : a >= TUNE.slide.one ? 1 : 0;
    setLane(st, st.drag.lane0 + Math.sign(it.steer.x) * o, tEnd);
  }
  for (const pd of st.pend.slice()) {
    if (laneOk(st, st.track.targets[pd.i])) settlePend(st, pd, true);
    else if (pd.until <= tEnd) settlePend(st, pd, false);
  }
  missBefore(st, tEnd);
}

function finish(st, how) {
  if (st.done) return;
  for (const pd of st.pend.slice()) settlePend(st, pd, laneOk(st, st.track.targets[pd.i]));
  missBefore(st, Infinity);
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

// ---- the Stage interface

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const carry = mergeCarry(carryIn, null);
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const sd = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 1;
  const st = {
    id: meta.id, seed: sd, t: 0, gaDay: meta.moments[0].ga[0], fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: IDS[0],
    mi: 0, starts: [0, 0, 0, 0, 0, 0], end: 0, gen: 0, track: null, cues: [], ci: 0,
    song: makeSong(sd), calls: [], sings: [], phrases: [], pend: [],
    credit: { beat: 0, answer: 0, song: 0 }, judged: { beat: 0, answer: 0, song: 0 },
    free: { beat: { n: 0, credit: 0 }, answer: { n: 0, credit: 0 }, song: { n: 0, credit: 0 } },
    lane: 1, laneFrom: 1, laneAt: -Infinity, drag: null, goalStep: false, kickT: -Infinity, kickLane: 1,
    streak: 0, best: 0, combo: 0, flourish: 0, matches: 0, lit: 0, litAt: {}, handT: -Infinity,
    fever: false, feverT: -Infinity, feverOffT: -Infinity, feverNotes: 0, feverSeen: false, jumpT: null, jumpHit: null,
    pops: [], bursts: [], hits: [], eyesT: null, fb: null,
    done: false, how: null, assist: !!o.assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry, tree: null,
  };
  st.beats = makeBeats(sd, [
    { heart: "mother", from: 0, to: TUNE.layAheadS, bpm: TUNE.bpm, jitter: 0, first: phase },
    { heart: "you", from: 0, to: 74, gaFrom: 105, gaTo: 195, jitter: 0 },
    { heart: "you", from: 74, to: TUNE.layAheadS, gaFrom: 195, jitter: 0 },
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

// Send every cue that is due by now. A sing-along note is {carer}'s hum, with the fever's chord under it while lit.
function cues(st) {
  while (st.ci < st.cues.length && st.cues[st.ci].at <= st.t + 1e-9) {
    const c = st.cues[st.ci++];
    if (c.name === "sing") {
      const s = c.data;
      emit(st, "sfx", { id: "answer.hum", at: s.t, pitch: hz(s.midi), gain: 1, note: s.midi, lane: s.lane, sing: true });
      if (st.fever) emit(st, "sfx", { id: "answer.hand", at: s.t, pitch: hz(s.midi - 12), gain: 0.45 });
      continue;
    }
    emit(st, c.name, { ...c.data });                    // stamped with the step that sends it
  }
}

// The step's presses, clean and in time order: { t, raw, x?, y?, dir? }.
function pressesOf(it) {
  if (!Array.isArray(it.presses)) return [];
  const out = [];
  for (const p of it.presses) {
    if (!p || !Number.isFinite(p.t)) continue;
    const q = { t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t };
    if (fin(p.x) && fin(p.y)) { q.x = p.x; q.y = p.y; }
    if (typeof p.dir === "string") q.dir = p.dir;
    out.push(q);
  }
  return out.sort((a, b) => a.t - b.t);
}

export function step(st, intents) {
  if (!st || typeof st !== "object" || !st.track) return;
  if (st.done) { st.t += DT; return; }
  const it = intents && typeof intents === "object" ? intents : {};
  const live = GESTURE[st.moment] === "tap";
  // the lane the bot or the run asks for (core/bots.js, one-button mode)
  const goal = laned(st) && typeof it.dir === "string" ? DIR_LANE[it.dir] : undefined;
  st.goalStep = goal !== undefined;
  if (st.goalStep) setLane(st, goal, st.t);
  feed(st, live ? pressesOf(it) : [], it, st.t + DT);
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
  // effects age out
  const t = st.t;
  if (st.pops.length) st.pops = st.pops.filter((q) => t - q.t < V.popS).slice(-12);
  if (st.bursts.length) st.bursts = st.bursts.filter((q) => t - q.t < V.burstS).slice(-16);
  if (st.hits.length) st.hits = st.hits.filter((q) => t - q.t < V.hitS).slice(-8);
  if (st.t >= meta.capS - 1e-9) finish(st, "cap");
}

// ---- the picture

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

function handLevel(st) {
  const u = st.t - st.handT;
  if (!(u >= 0)) return 0;
  if (u < TUNE.handRiseS) return u / TUNE.handRiseS;
  if (u < TUNE.handRiseS + TUNE.handHoldS) return 1;
  return clamp01(1 - (u - TUNE.handRiseS - TUNE.handHoldS) / TUNE.handFadeS);
}
// The fever's look, 0..1: it eases in as the fever lights and out as it goes.
function feverLevel(st) {
  const t = st.t;
  if (st.fever) return clamp01((t - st.feverT) / V.feverRiseS);
  return clamp01(1 - (t - st.feverOffT) / V.feverRiseS) * (st.feverOffT > st.feverT ? 1 : 0);
}
// The lanes' paper, per lane, 0..1: they rise in `hear`; the side lanes stay faint until the phrases open them; all
// three fold away as the eyes moment starts.
function laneAlpha(st) {
  const t = st.t;
  const rise = clamp01(t / 1.2);
  const out = st.mi >= EYES ? clamp01(1 - (t - st.starts[EYES]) / 1.2) : 1;
  const side = st.mi >= PHRASES ? lerp(0.3, 1, clamp01((t - st.starts[PHRASES]) / 0.8)) : 0.3;
  return [rise * out * side, rise * out, rise * out * side];
}

function poseOf(st) {
  const t = st.t;
  if (st.jumpT !== null && t >= st.jumpT && t < st.jumpT + V.startleS) return { name: "startle", p: 1 - (t - st.jumpT) / V.startleS };
  const k = t - st.kickT;
  if (k >= 0 && k < V.kickS && GESTURE[st.moment] === "tap") {
    const name = !laned(st) ? "kick" : st.kickLane === 0 ? "stretchL" : st.kickLane === 2 ? "stretchR" : "kick";
    return { name, p: 1 - k / V.kickS };
  }
  // at rest in the tap moments you curl, ready to kick (the thumb comes out over 0.6 s); else you suck your thumb (v1)
  if (GESTURE[st.moment] === "tap") {
    const u = (t - st.starts[BEAT]) / 0.6;
    return u < 1 ? { name: "thumb", p: 1 - clamp01(u) } : "curl";
  }
  return st.mi >= EYES ? { name: "thumb", p: clamp01((t - st.starts[EYES]) / 1) } : "thumb";
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const t = st.t;
  const mm = mmPerShortAxis(meta, st.gaDay);
  const gp = clamp01((st.gaDay - 105) / (195 - 105));
  const lift = st.eyesT === null ? 0 : clamp01((t - st.eyesT) / TUNE.liftS);
  const fv = feverLevel(st);
  d.camera = { x: 0, y: V.camY, span: V.span, rot: 0, orient: meta.orient, mmPerU: mm / V.span };
  d.scale = { mm: bar(mm) };
  d.light = { level: lerp(V.level0, V.level1, Math.max(gp, lift)) + V.levelFever * fv, warm: V.warm, exposure: 1, white: 0,
    vignette: lerp(V.vignette0, V.vignette1, lift), tint: V.tint + V.tintFever * fv };
  d.warp = V.warp;
  d.caustics = Math.min(1, V.caustics + V.causticsFever * fv);

  const herPh = clamp01(st.beats.phase("mother", t));
  const youLane = laneShown(st, t);
  const youX = (youLane - 1) * LN.gap1, youY = LN.y1;
  const Bb = V.baby, size = lerp(Bb.size0, Bb.size1, gp);
  const bx = youX, by = youY + Bb.dy;
  d.splats = figure(poseOf(st), size, st.gaDay, { x: bx, y: by });

  // ripples: the hummed notes at the top of their lanes and at the warm patch, and each kick at your ring
  const rip = [];
  let hum = 0;
  const humAt = (when, lane) => {
    if (!(t >= when && t < when + V.rippleS)) return;
    const u = (t - when) / V.rippleS;
    hum = Math.max(hum, 1 - u);
    rip.push({ x: laneX(lane, 0), y: LN.y0, r: 2 + 7 * u, a: 0.9 * (1 - u), dashed: false });
    rip.push({ x: V.voice.x, y: V.voice.y, r: V.voice.r + 8 * u, a: 0.5 * (1 - u), dashed: false });
  };
  for (const c of st.calls) humAt(c.t, c.lane);
  for (const s of st.sings) if (t >= s.t && t < s.t + V.rippleS) hum = Math.max(hum, 1 - (t - s.t) / V.rippleS);
  for (const h of st.hits) {
    const u = clamp01((t - h.t) / V.hitS);
    rip.push({ x: h.x, y: LN.y1, r: V.ringR + (h.big ? 9 : 6) * u, a: 0.9 * (1 - u), dashed: false });
  }
  d.strips.push({ kind: "ripples", items: rip });

  // the placenta disc's tree and the cord, bowing round the lanes to your belly, a light running down it on her beat
  const dx = st.carry.nestleX * V.disc.spread, dy = V.disc.y;
  if (st.tree && st.tree.n > 1) d.strips.push({ kind: "tree", nodes: st.tree.view, version: st.tree.version, pulse: herPh });
  const belly = { x: bx + 0.06 * size, y: by - 0.16 * size };
  const p0 = { x: dx, y: dy - V.disc.r * 0.7 }, pc = { x: V.cordBend.x, y: V.cordBend.y };
  const pts = [];
  const sway = Math.sin(t * 0.8) * 2;
  for (let i = 0; i < 10; i++) {
    const s = i / 9, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    pts.push(a * p0.x + b * (pc.x + sway) + c * belly.x, a * p0.y + b * pc.y + c * belly.y);
  }
  d.strips.push({ kind: "cord", pts, lights: [herPh] });

  // the highway: three lanes, the notes riding them, your lane's slot
  const notes = [], slots = [0, 0, 0];
  const tr = st.track;
  for (let i = 0; i < tr.targets.length; i++) {
    const x = tr.targets[i], res = tr.results[i];
    const u = uOf(x, t);
    if (u < 0 || u > LN.tail) continue;
    let state = 0, a = clamp01(u / 0.08);
    if (res && res !== PENDING) {
      if (res.grade !== "miss") continue;                     // a kicked note is gone: its ripple and burst show
      state = 1;
      a *= clamp01((LN.tail - u) / (LN.tail - 1)) * 0.7;
    } else if (res === PENDING) state = 2;
    else if (u > 1) a *= clamp01((LN.tail - u) / (LN.tail - 1));
    if (!(a > 0.01)) continue;
    const kind = x.jump ? 2 : x.group === "beat" ? 0 : x.group === "song" ? 3 : 1;
    notes.push({ lane: x.lane, u, r: noteR(u), kind, state, a, hot: x.group === "song" ? fv : 0 });
    if (state === 0 && x.lane >= 0 && u <= 1.05) slots[x.lane] = Math.max(slots[x.lane], clamp01(1 - (x.t - t) / BEAT_S));
  }
  // the streak meter under your ring (the phrases and the sing-along): one pip per In time note in a row, up to 8;
  // full in the sing-along, it lights the fever, and then every pip glows on her beat
  const meterA = st.mi === PHRASES || st.mi === SONG ? laneAlpha(st)[1] : 0;
  const meter = meterA > 0.02 ? { n: st.fever ? FEVER.need : Math.min(FEVER.need, st.streak), of: FEVER.need, lit: fv, a: meterA } : null;
  d.strips.push({ kind: "lanes", y0: LN.y0, y1: LN.y1, gap0: LN.gap0, gap1: LN.gap1, w0: LN.w0, w1: LN.w1, tail: LN.tail,
    a: laneAlpha(st), you: youLane, ring: V.ringR, fever: fv, beat: herPh, notes, slots, meter });

  // marks: the disc, the voice's warm patch, the hand glow, the fever's glow round your ring, sparks
  d.marks.push({ kind: "glowwall", x: dx, y: dy, r: V.disc.r, rim: "wavy", on: true, pulse: herPh });
  d.marks.push({ kind: "warm", x: V.voice.x, y: V.voice.y, r: V.voice.r, rim: "solid", on: st.mi >= PHRASES ? 0.35 + 0.65 * hum : 0.2, pulse: hum });
  const hand = handLevel(st);
  if (hand > 0) d.marks.push({ kind: "hand", x: V.hand.x, y: V.hand.y, r: V.hand.r, rim: "solid", on: hand, pulse: hand });
  if (fv > 0.01) d.marks.push({ kind: "glow", x: youX, y: youY, r: 2 * V.ringR, on: fv, pulse: 1 - herPh });
  const sparks = Math.max(0, Math.min(8, st.carry.sparks | 0));
  for (let i = 0; i < sparks; i++) {
    const a = Math.PI / 2 + (i - (sparks - 1) / 2) * 0.45;
    d.marks.push({ kind: "light", x: youX + (V.ringR + 3) * Math.cos(a), y: youY + (V.ringR + 3) * Math.sin(a), r: 1.2, on: true, pulse: herPh });
  }

  // rings (DOM SVG): her heartbeat round you (your ring), each coming note, feedback
  d.rings.push({ id: "mother", kind: "mother", x: youX, y: youY, r: V.ringR, progress: herPh });
  const next = upcoming(tr, t, TRAVEL_S).slice(0, 5);
  for (const x of next) {
    const u = clamp01(uOf(x, t));
    const r = x.lane < 0 ? laneX(2, u) + laneW(u) / 2 + 1 : noteR(u) + 1.6;
    d.rings.push({ id: "t:" + x.id, kind: "approach", x: x.lane < 0 ? 0 : laneX(x.lane, u), y: laneY(u), r, progress: u });
  }
  if (st.fb && t >= st.fb.t && t < st.fb.t + V.fbS) {
    const fx = st.fb.lane < 0 ? 0 : laneX(st.fb.lane, 1);
    d.rings.push({ id: "fb", kind: "approach", x: fx, y: LN.y1, r: st.fb.lane < 0 ? LN.gap1 + LN.w1 / 2 : V.ringR + 1.5, progress: 1,
      grade: st.fb.grade, dotted: st.fb.grade === "off" });
  }

  // the action part: word pops over your ring and paper confetti from each kick
  d.action = {
    pops: st.pops.map((q) => {
      const u = clamp01((t - q.t) / V.popS);
      return { x: q.x, y: q.y + V.popRise * u, v: 0, a: 1 - u, combo: q.combo, word: q.word };
    }),
    bursts: st.bursts.map((q) => ({ x: q.x, y: q.y, r: q.r, age: clamp01((t - q.t) / V.burstS), kind: q.kind, rot: q.rot })),
  };
  // the jump note's loud sound outside: a small shake (at most 3 px; none with reduced motion, render/action.js)
  if (st.jumpT !== null && t >= st.jumpT && t < st.jumpT + V.shakeS) d.action.shake = V.shake * (1 - (t - st.jumpT) / V.shakeS);

  d.anchor = { x: youX, y: youY };
  if (next.length) { const u = clamp01(uOf(next[0], t)); d.cue = { x: next[0].lane < 0 ? 0 : laneX(next[0].lane, u), y: laneY(u) }; }
  else if (st.mi === PHRASES) d.cue = { x: V.voice.x, y: V.voice.y };
  else if (st.mi < EYES) d.cue = { x: youX, y: youY };
  else d.cue = null;
  return d;
}

export function prompt(st) {
  return st.done ? { ...NONE } : promptOf(st, st.mi);
}

export function targets(st, horizonS) {
  if (!st || st.done || !st.track) return [];
  const h = Number.isFinite(horizonS) ? horizonS : 3;
  return upcoming(st.track, st.t, h).map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group, lane: x.lane }));
}

// The lanes: dir is the next note's lane (left, up for the middle, right), so the shared bot's presses land in it,
// and one-button mode puts you there. Below skill 1 the bot turns late (lagK x (1 - skill) s after a note becomes the
// next one) and now and then picks a wrong lane (wrongK x (1 - skill)), kept in r.mem.
export function botSteer(st, skill, r) {
  const out = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  if (!st || st.done || !st.track || !laned(st)) return out;
  const next = upcoming(st.track, st.t, TRAVEL_S)[0];
  if (!next) return out;
  let lane = next.lane < 0 ? st.lane : next.lane;
  const s = clamp01(skill);
  if (s < 1 && r && typeof r === "function") {
    const m = r.mem || (r.mem = {});
    if (m.id !== next.id) {
      m.id = next.id;
      m.since = st.t;
      m.lane = lane;
      if (next.lane >= 0 && r() < TUNE.bot.wrongK * (1 - s)) m.lane = next.lane === 1 ? (r() < 0.5 ? 0 : 2) : 1;
    }
    if (st.t - m.since < TUNE.bot.lagK * (1 - s)) return out;
    lane = m.lane;
  }
  out.dir = LANE_DIR[lane];
  return out;
}

export function probe(st) {
  return null;
}

// The score's mood (openspec/changes/first-breath-score/contract.md, "Mood"), by combo while notes ride the lanes: 0
// under 4 kicks in a row, 1 from 4, 2 (the shout chorus) from 12 or while the fever is lit; the hearing, the eyes and
// the outro are 0. Pure and cheap (main.js reads it every 100 ms); it changes nothing.
export function mood(st) {
  if (!st || st.done) return { level: 0 };
  const i = IDS.indexOf(st.moment);
  if (i < BEAT || i > SONG) return { level: 0 };
  const c = Number.isFinite(st.combo) ? st.combo : 0;
  return { level: st.fever || c >= 12 ? 2 : c >= 4 ? 1 : 0 };
}

export function result(st) {
  const beatAcc = accOf(st, "beat"), answerAcc = accOf(st, "answer"), songAcc = accOf(st, "song");
  const beatPts = partOf(st, "beat"), answerPts = partOf(st, "answer"), songPts = partOf(st, "song");
  const goalMet = !!st.done;
  const score = clampScore({ goal: goalMet ? PARTS.goal : 0, skill: beatPts + answerPts + songPts, flourish: st.flourish });
  return {
    done: !!st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "beat", label: "answer.part.beat", value: beatPts, max: S.beat },
      { id: "answer", label: "answer.part.answer", value: answerPts, max: S.answer },
      { id: "song", label: "answer.part.song", value: songPts, max: S.song },
      { id: "flourish", label: "answer.part.flourish", value: score.flourish, max: S.flourishMax },
    ],
    metrics: {
      beatAccuracy: beatAcc, answerAccuracy: answerAcc, songAccuracy: songAcc, matches: st.matches,
      phrases: st.phrases.length, notes: NOTES, best: st.best, feverNotes: st.feverNotes, jump: st.jumpHit !== null,
      lit: st.lit, eyesOpen: st.eyesT !== null, moment: st.moment, how: st.how,
    },
    carryOut: { song: { notes: st.song.slice(), lit: st.lit } },
  };
}

// Fair resume (v1 5.2): the open notes of the first 1.2 s after Resume are free: left out of their part's accuracy
// and of their phrase's match.
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

// For tests and tools: the 16 call notes' lanes in order, and the travel time.
export const LANES = SONG_LANES;
export const TRAVEL = TRAVEL_S;
