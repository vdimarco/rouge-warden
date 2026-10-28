// First Breath: the save (design.md 10, 16.2). One JSON object under SAVE_KEY; ui/store.js does the storage reads
// and writes (in try/catch), and this file only builds and checks the object, so a broken, old or blocked save gives
// defaults and nothing here ever throws. Pure.
//
//   { v: 1,
//     best: { score, ms, done, assist, oneButton, grades: [8] } | null,   the best finished run
//     reached: 0..8,                                                      stages started at least once
//     stages: { swim: { best, grade, assist, oneButton }, ... },          best per stage (runs and practice)
//     carryIn: { swim: carry, ... },                                      the carry each stage last started with
//     settings: { carer, assist, oneButton, motion, captions, largeText, offsetMs } }
//
// Contract choices (16.2 left these open):
// - parse(raw) takes the stored text, an object, or nothing; any version but 1 gives defaults; bad fields fall back
//   one by one; unknown stage ids are dropped. The records return a new save and leave theirs alone.
// - recordStage(save, id, result, marks) keeps the higher total (a tie keeps the old entry, unless only the new one
//   has a grade); the entry also keeps the marks ({ assist, oneButton }) of the attempt that set it. It counts the
//   stage as reached.
// - recordRun(save, run) takes run.summary() ({ total, ms, stages: [{ id, grade }], marks }); marks may be
//   { assist, oneButton } or a list such as ["Assist", "One-button"]. A summary with done === false is not a
//   finished run and is ignored. Better = a higher total, or the same total in less time.
// - recordCarryIn(save, id, carry) stores mergeCarry(DEFAULT_CARRY, carry) and counts the stage as reached.
// - cabinetLine(save) applies the homepage rule of design.md 10 to the object as stored (or its text), exactly as
//   public/index.html does, so it does not run the save through parse() first.
// - Extra exports: STAGE_IDS and VERSION.
import { DEFAULT_CARRY, mergeCarry } from "./carry.js";
import { grade as gradeOf } from "./score.js";
import { CARERS } from "./text.js";

export const SAVE_KEY = "first-breath.save.v1";
export const VERSION = 1;
export const STAGE_IDS = Object.freeze(["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"]);
const ATTRACT = "RACE · GUARD · CRY";

const GRADES = new Set(["Good", "Great", "Glowing"]);
const MOTIONS = new Set(["auto", "full", "reduced"]);
const num = (v) => typeof v === "number" && Number.isFinite(v);
const bool = (v, d) => (typeof v === "boolean" ? v : d);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function defaults() {
  return {
    v: VERSION,
    best: null,
    reached: 0,
    stages: {},
    carryIn: {},
    settings: { carer: "mother", assist: false, oneButton: false, motion: "auto", captions: true, largeText: false, offsetMs: 0 },
  };
}

function cleanBest(b) {
  if (!isObj(b) || !num(b.score) || b.score < 0 || !num(b.ms) || b.ms < 0) return null;
  const grades = STAGE_IDS.map((_, i) => (Array.isArray(b.grades) && GRADES.has(b.grades[i]) ? b.grades[i] : null));
  return {
    score: Math.round(b.score), ms: Math.round(b.ms), done: b.done === true,
    assist: b.assist === true, oneButton: b.oneButton === true, grades,
  };
}

function cleanStage(e) {
  if (!isObj(e) || !num(e.best) || e.best < 0) return null;
  return {
    best: Math.round(clamp(e.best, 0, 10000)), grade: GRADES.has(e.grade) ? e.grade : null,
    assist: e.assist === true, oneButton: e.oneButton === true,
  };
}

function cleanSettings(s) {
  const d = defaults().settings;
  if (!isObj(s)) return d;
  return {
    carer: own(CARERS, s.carer) ? s.carer : d.carer,
    assist: bool(s.assist, d.assist),
    oneButton: bool(s.oneButton, d.oneButton),
    motion: MOTIONS.has(s.motion) ? s.motion : d.motion,
    captions: bool(s.captions, d.captions),
    largeText: bool(s.largeText, d.largeText),
    offsetMs: num(s.offsetMs) ? Math.round(clamp(s.offsetMs, -150, 150)) : d.offsetMs,
  };
}

// → a full, valid save. Never throws.
export function parse(raw) {
  try {
    let o = raw;
    if (typeof raw === "string") o = JSON.parse(raw);
    if (!isObj(o) || o.v !== VERSION) return defaults();
    const out = defaults();
    out.best = cleanBest(o.best);
    out.reached = num(o.reached) ? Math.round(clamp(o.reached, 0, STAGE_IDS.length)) : 0;
    for (const id of STAGE_IDS) {
      if (own(o.stages, id)) { const e = cleanStage(o.stages[id]); if (e) out.stages[id] = e; }
      if (own(o.carryIn, id) && isObj(o.carryIn[id])) out.carryIn[id] = mergeCarry(DEFAULT_CARRY, o.carryIn[id]);
    }
    out.settings = cleanSettings(o.settings);
    return out;
  } catch (e) {
    return defaults();
  }
}

const reach = (save, id) => {
  const i = STAGE_IDS.indexOf(id);
  if (i >= 0) save.reached = Math.max(save.reached, i + 1);
};

// A stage ended (in a run or in practice): keep its best.
export function recordStage(save, id, result, marks) {
  const out = parse(save);
  if (!STAGE_IDS.includes(id)) return out;
  reach(out, id);
  const total = result && result.score && num(result.score.total) ? Math.round(result.score.total) : null;
  if (total === null) return out;
  const g = gradeOf(total, !!(result && result.goalMet));
  const old = out.stages[id];
  const better = !old || total > old.best || (total === old.best && !old.grade && g);
  if (better) {
    out.stages[id] = { best: clamp(total, 0, 10000), grade: g, assist: !!(marks && marks.assist), oneButton: !!(marks && marks.oneButton) };
  }
  return out;
}

const hasMark = (marks, key, word) => (Array.isArray(marks) ? marks.includes(word) : !!(marks && marks[key]));

// A run reached its result: keep the best finished run.
export function recordRun(save, run) {
  const out = parse(save);
  if (!run || run.done === false || !num(run.total) || !num(run.ms)) return out;
  const stages = Array.isArray(run.stages) ? run.stages : [];
  for (const s of stages) if (s && typeof s.id === "string") reach(out, s.id);
  const total = Math.round(run.total), ms = Math.round(run.ms);
  const old = out.best;
  const better = !old || !old.done || total > old.score || (total === old.score && ms < old.ms);
  if (better) {
    const grades = STAGE_IDS.map((id, i) => {
      const s = stages.find((x) => x && x.id === id) || stages[i];
      return s && GRADES.has(s.grade) ? s.grade : null;
    });
    out.best = {
      score: total, ms, done: true,
      assist: hasMark(run.marks, "assist", "Assist"), oneButton: hasMark(run.marks, "oneButton", "One-button"), grades,
    };
  }
  return out;
}

// A stage started in a run with this carry: keep it for practice.
export function recordCarryIn(save, id, carry) {
  const out = parse(save);
  if (!STAGE_IDS.includes(id)) return out;
  reach(out, id);
  out.carryIn[id] = mergeCarry(DEFAULT_CARRY, carry);
  return out;
}

// The homepage cabinet line: "BEST 61,240" for a finished best run above 0, else the attract line.
export function cabinetLine(save) {
  try {
    const s = typeof save === "string" ? JSON.parse(save) : save;
    const b = s && s.best;
    if (b && b.done === true && typeof b.score === "number" && Number.isFinite(b.score) && b.score > 0) {
      return "BEST " + b.score.toLocaleString("en-US");
    }
  } catch (e) { /* a broken save: the plain line */ }
  return ATTRACT;
}
