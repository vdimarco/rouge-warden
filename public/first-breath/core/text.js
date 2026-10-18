// First Breath: every shown string goes through here (design.md 1.3, 15.4, 16.2). Strings are registered by id; say()
// fills {carer} ("your mother"), {Carer} ("Your mother") and named vars such as {place}. No string names the carer
// with a pronoun, and every string keeps the tone rules (section 2, 15.4); text.test.mjs scans allStrings(). Pure.
//
// The shared strings (title, settings, the Almost card, pause, the run result and the HUD) live in BASE below. Each
// stage's strings arrive from core/stages/<id>.text.js (`export const TEXT = { id: "text" }`) through
// core/stages/index.js, as TEXT_TABLES (stage order, then the ending's). Stage and ending files must not import this
// file (it would be an import cycle).
//
// Contract choices: say() of an unknown id returns the id itself, so a missing string shows up in tests and on
// screen rather than as a blank; an unknown {var} is left as written; a carer setting that is not one of the four
// words reads as "mother"; a later table never replaces an earlier id (registerConflicts() lists any clash).
// Extra exports: has(id), fill(template, vars, settings), ordinal(n) ("3rd") and minSec(ms) ("9 min 48 s").
import { TEXT_TABLES } from "./stages/index.js";

export const CARERS = { mother: "your mother", mum: "your mum", mom: "your mom", parent: "your parent" };

const BASE = {
  "title.name": "First Breath",
  "title.tagline": "Nine months. Eight small stages. One first breath.",
  "title.note": "A gentle story of growing before birth. Cells, the womb and birth are shown simply.",
  "title.play": "Play",
  "title.stages": "Stages",
  "title.settings": "Settings",
  "title.sources": "Sources",
  "title.arcade": "‹ Arcade",
  "title.switch": "Switch game",
  "title.best": "Best run: {score}",

  "settings.title": "Settings",
  "settings.carer": "Word for the one who carries you",
  "settings.carer.mother": "mother",
  "settings.carer.mum": "mum",
  "settings.carer.mom": "mom",
  "settings.carer.parent": "parent",
  "settings.assist": "Assist",
  "settings.oneButton": "One-button mode",
  "settings.motion": "Motion",
  "settings.motion.auto": "Auto",
  "settings.motion.full": "Full",
  "settings.motion.reduced": "Reduced",
  "settings.captions": "Captions",
  "settings.largeText": "Large text",
  "settings.tapTest": "Tap test",
  "settings.offset": "Timing offset",
  "settings.offsetValue": "{ms} ms",
  "settings.sound": "Sound",
  "settings.weeks": "Weeks count from the first day of the last period. Midwives and doctors count this way.",

  "tap.title": "Tap test",
  "tap.how": "Tap with each click and flash. Eight taps in all.",
  "tap.done": "Your timing offset is now {ms} ms.",
  "tap.start": "Start",

  "ui.on": "On",
  "ui.off": "Off",
  "ui.back": "Back",
  "ui.next": "Next",
  "ui.close": "Close",

  "card.stage": "Stage {n}",

  "overlay.hint": "Tap to stay.",
  "overlay.again": "Tap again to go on.",

  "almost.title": "Almost. Try again?",
  "almost.came": "You came {place} of {of}.",
  "almost.were": "You were {place} of {of}.",
  "almost.kept": "Your run and points are kept.",
  "almost.retry": "Try again",
  "almost.goOn": "Go on",
  "almost.carried": "The waves carry you on.",

  "pause.title": "Paused",
  "pause.resume": "Resume",
  "pause.retry": "Try this stage again",
  "pause.settings": "Settings",
  "pause.sound": "Sound",
  "pause.switch": "Switch game",
  "pause.arcade": "‹ Arcade",

  "hud.place": "{place} of {of}",
  "hud.you": "You: about {size}",
  "hud.pause": "Pause",

  "cue.mother": "♥ {carer}'s heartbeat",
  "cue.you": "♥ your heartbeat",
  "cue.pack": "~ the pack swims around you",
  "cue.bounce": "· sperm bounce off the arc",
  "cue.goldIn": "♪ your sperm comes in",
  "cue.seal": "♪ a shimmer runs round your shell",
  "cue.wave": "~ wave",
  "cue.link": "♪ a soft note as a pool links",
  "cue.bell": "♪ a soft bell on each good tap",
  "cue.move": "~ a soft whoosh as you move",
  "cue.open": "~ the sound opens",

  "grade.Good": "Good",
  "grade.Great": "Great",
  "grade.Glowing": "Glowing",
  "part.goal": "Goal",
  "part.skill": "Skill",
  "part.flourish": "Flourish",
  "mark.assist": "Assist",
  "mark.oneButton": "One-button",

  "result.hello": "Hello.",
  "result.total": "Run total",
  "result.time": "Run time",
  "result.best": "Best",
  "result.marks": "Marks",
  "result.sparks": "Sparks",
  "result.same": "In this game, every baby is born well. The ending is the same for every score.",
  "result.real": "What was real",
  "result.again": "Play again",
  "result.stages": "Stages",
  "result.arcade": "‹ Arcade",

  "stages.title": "Stages",
  "stages.best": "Best {score}",
  "stages.none": "Play a run to open the stages.",

  "sources.title": "Sources",
  "sources.note": "Every fact in the game, with where it comes from.",
  "sources.list": "Where they come from",
};

// Each stage's TEXT table, in stage order, then the ending's.
const STAGE_TABLES = TEXT_TABLES;

const REGISTRY = new Map();
const CONFLICTS = [];
for (const table of [BASE, ...STAGE_TABLES]) {
  for (const [id, text] of Object.entries(table || {})) {
    if (typeof text !== "string") continue;
    if (REGISTRY.has(id)) { if (REGISTRY.get(id) !== text) CONFLICTS.push(id); continue; }
    REGISTRY.set(id, text);
  }
}

// Ids that two tables both tried to register with different text (an empty list when all is well).
export const registerConflicts = () => CONFLICTS.slice();

const carerOf = (settings) => CARERS[settings && settings.carer] || CARERS.mother;

// Fill a template: {carer}, {Carer} and named vars.
export function fill(template, vars = {}, settings = {}) {
  const word = carerOf(settings);
  return String(template).replace(/\{(\w+)\}/g, (all, name) => {
    if (name === "carer") return word;
    if (name === "Carer") return word.charAt(0).toUpperCase() + word.slice(1);
    if (vars && Object.prototype.hasOwnProperty.call(vars, name) && vars[name] !== undefined && vars[name] !== null) return String(vars[name]);
    return all;
  });
}

// Is this string id registered? (The host shows nothing for an unknown id, never the id itself.)
export function has(id) {
  return typeof id === "string" && REGISTRY.has(id);
}

export function say(id, vars = {}, settings = {}) {
  const t = REGISTRY.get(id);
  return t === undefined ? String(id) : fill(t, vars, settings);
}

// Every registered string as { id, text } (the template, before any substitution), for tests.
export function allStrings() {
  return [...REGISTRY].map(([id, text]) => ({ id, text }));
}

// 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 22 → "22nd".
export function ordinal(n) {
  const k = Math.round(n), t = Math.abs(k) % 100, u = Math.abs(k) % 10;
  const suf = t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th";
  return k + suf;
}

// 588,000 ms → "9 min 48 s"; under a minute → "48 s".
export function minSec(ms) {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  return m ? m + " min " + (s % 60) + " s" : s + " s";
}
