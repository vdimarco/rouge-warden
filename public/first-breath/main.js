// First Breath: the page (design.md 5.3, 8, 11, 16.1, 16.3, 16.8 to 16.10; tasks.md 1.11). It boots the game, reads
// the URL flags, runs the 60 Hz fixed step with an accumulator, maps input times to core time, drives core/run.js,
// draws its view through render/renderer.js and render/rings.js, feeds the HUD, the captions, the screens and the
// sound (her beats from run.beats(), one-shots from the events), pauses on Esc, P, the pause button,
// visibilitychange and pagehide (never on blur), keeps the save through ui/store.js, and hangs the test hook
// window.__fb (16.9) on the page. It is wired to every module through the frozen signatures of 16.2, so the wave-1
// files drop in behind them.
//
// Core time (16.3): raw = (wallMs − wallStart − pausedMs) / 1000 and t = raw − offsetMs / 1000 (ui/input.js applies
// the offset). Here wallBase = wallStart + pausedMs: it moves on while the run is paused, while realtime is off and
// when a long frame drops time (more than 0.5 s behind), so core time always equals run.t at a step boundary. Each
// fixed step covers [run.t, run.t + DT); the loop steps while the step's end is in the past, so every event of the
// step has arrived. A new run restarts run.t at 0, and the base moves with it.
//
// Contract choices (16.9 and 16.10 give the members and flags; these fill the gaps):
// - goto(stage, { seed, carry, assist, oneButton }) starts a practice run of that stage (core/run.js start:
//   { practice, carry }): no card, and after its overlay (none after Birth or the ending) the run result. seed is
//   the run seed (else the current run's); assist and oneButton set the live settings. ?stage= does the same at boot,
//   and ?moment= then jumps to that moment (also after Play when no ?stage is given).
// - state().stage is the stage number 1 to 8, "ending" for the ending, or null on the title. score is the current
//   stage's total so far, runScore the run summary's total, grade the stage's grade word once it is done. prompt is
//   the stage's prompt plus `line`, its text through core/text.js. Extras: frames, realtime, practice, done, live
//   (the input's live gesture and keys), judges (the last 8 judge events, core seconds) and stageStart (the stage's
//   start in core seconds, the clock of sound.beats).
// - step(n, intents) takes intents in stage seconds: its presses, releases and taps are queued once (at
//   stageStart + t), its other fields hold for the n steps. Without intents the held ones (input()) apply over the
//   live input. step and the other hook calls present the frame at once, so the DOM matches the state they return.
// - tap() presses at the next tap or press target's t + errMs and lifts 80 ms later; press() presses there;
//   release() lets go at the next release target's t + errMs. With no such target they act now. Each returns
//   { t, target } (stage seconds) or null off the stage. raw = t + offsetMs / 1000, as live input would give.
// - bot(skill) drives with core/bots.js (createBot(skill, run seed)), its run-level choices included; bot(false)
//   stops it. Live input is dropped while it drives.
// - targets() → { boxes: [{ id, act, text, x, y, w, h }] (every visible button, link and control), anchor, cue }.
// - race() and guard() add `screen` ({ x, y } px) beside every world point of the stage's probe, and guard() adds
//   arc.screenAngle (atan2 in screen px, y down, render/camera.js). Both are null in other stages and in the stubs.
// - perf, sound and motion are getters that return plain copies. sound adds hearing (the hearing milestone) and
//   beats ({ mother, you }: the last 8 beat times scheduled, core seconds) to the sound stats.
// - The seed of a new run is ?seed when given, else random (main.js is not core; Math.random is allowed here).
// - Sound: run.js hands on every stage time in core seconds (t and an sfx's or a song's `at`), so a sound plays at
//   `at` when the event has one, else at its t: sound.sfx(id, ctxTime, event), sound.hum(notes, ctxTime, { clear,
//   lit, noteS, gapS, muffled }), and the ending's inhale, cry and breath through sound.breath(id, ctxTime, event).
// - Captions: one path. A `caption` event's id is a string (core/text.js) or, failing that, a fact; a `fact` event
//   whose where (its own, else the fact's) is "caption" is a fact caption. Every caption is one call,
//   captions.say(id, text, { dir, ms, kind }) with its final text; kind is "say", "fact" (once per stage, text
//   "<clock label>: <fact text>", no label in the ending, with fact, label and body beside it) or "cue" (a sound's
//   caption, design.md 12: a stage's own "<stage>.sfx.<id>" string, else the shared cue.* string, once per stage). A
//   stage 1 caption lasts 2.5 s. An unknown id shows nothing, never the id.
// - The prompt line names keys on a desktop (a fine pointer, or a mouse or key used last): the prompt's textKeys,
//   else "<text>.keys" or "<text>Keys" when registered. In Birth the HUD score stays at the earlier stages' total
//   (6.8: Birth's points show only on the run result). The ending's run time line takes run.ms (none in practice).
// - ?q=low|full pins the tier and ?gl=0 is its alias (14.5): FLAGS.gl is false for the low tier.
// - Settings changed through the URL (?assist, ?one, ?carer, ?rm) hold for the visit and are not saved; a key
//   toggle (C) saves only its own field. M toggles and writes arcade.sound; ?mute=1 mutes the visit.
import { DT, label as gaLabel } from "./core/clock.js";
import { makeIntents, shiftIntents } from "./core/intent.js";
import { createRun } from "./core/run.js";
import { createBot } from "./core/bots.js";
import { SAVE_KEY, parse, recordStage, recordRun, recordCarryIn } from "./core/save.js";
import { say, has, ordinal, minSec, CARERS } from "./core/text.js";
import { byId as factById, line as factLine } from "./core/facts.js";
import { grade as gradeOf, runTotal } from "./core/score.js";
import { ENDING } from "./core/stages/index.js";
import * as store from "./ui/store.js";
import { createInput } from "./ui/input.js";
import { createHud } from "./ui/hud.js";
import { createCaptions } from "./ui/captions.js";
import { createScreens } from "./ui/screens.js";
import { createSound } from "./ui/sound.js";
import { createRenderer } from "./render/renderer.js";
import { makeCamera } from "./render/camera.js";
import { createRings } from "./render/rings.js";

const LOOKAHEAD_S = 0.1;      // the sound scheduler looks this far ahead (11, "A tale of two clocks")
const SOUND_TICK_MS = 25;
const MAX_BEHIND_S = 0.5;     // a longer stall drops time instead of running steps to catch up (core time stays
                              //   on the wall clock, and so on the audio clock, through any shorter hitch)
const MAX_STEPS = 32;
const START_LEAD_S = 0.01;    // a run's clock starts this much (plus the output latency) after its first frame is up
const MAX_LEAD_S = 0.1;
const STARTS = new Set(["play", "again", "practice"]);   // the actions that start a run from a menu
const TAP_LIFT_S = 0.08;
const HELD = ["steer", "touching", "dir", "turn", "aim"];
const PLAYING = new Set(["stage", "ending"]);
const PAUSABLE = new Set(["stage", "ending", "overlay", "almost", "card"]);
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const $ = (id) => document.getElementById(id);

// ---- URL flags (16.10)
const Q = new URLSearchParams(location.search);
const flagOn = (k) => Q.get(k) === "1";
function parseInset(s) {
  if (!s) return null;
  const v = s.split(",").map((x) => Number(x));
  if (v.length !== 4 || !v.every((x) => Number.isFinite(x) && x >= 0)) return null;
  return v;
}
const FLAGS = Object.freeze({
  seed: Q.has("seed") && Q.get("seed") !== "" && Number.isFinite(Number(Q.get("seed"))) ? Number(Q.get("seed")) >>> 0 : null,
  stage: Q.get("stage") || null,
  moment: Q.get("moment") || null,
  // ?q=low|full pins the paper tier; ?gl=0 is an alias for ?q=low (14.3, 14.5). gl: true is the full tier.
  q: Q.get("q") === "low" || Q.get("q") === "full" ? Q.get("q") : Q.get("gl") === "0" ? "low" : null,
  gl: Q.get("q") === "full" ? true : Q.get("q") === "low" ? false : Q.get("gl") !== "0",
  res: Q.has("res") && Number(Q.get("res")) > 0 ? Number(Q.get("res")) : null,
  freeze: flagOn("freeze"),
  test: flagOn("test"),
  assist: flagOn("assist"),
  one: flagOn("one"),
  rm: flagOn("rm"),
  mute: flagOn("mute"),
  probe: flagOn("probe"),
  inset: parseInset(Q.get("inset")),
  carer: Q.get("carer"),
});

// ---- the save and the settings
let save = parse(store.get(SAVE_KEY, null));
const settings = { ...save.settings };
if (FLAGS.assist) settings.assist = true;
if (FLAGS.one) settings.oneButton = true;
if (FLAGS.carer && Object.prototype.hasOwnProperty.call(CARERS, FLAGS.carer)) settings.carer = FLAGS.carer;
if (FLAGS.rm) settings.motion = "reduced";

const persist = () => store.set(SAVE_KEY, save);
function saveSetting(key) {
  save = parse(save);
  save.settings = { ...save.settings, [key]: settings[key] };
  save = parse(save);
  persist();
}

// ---- motion, insets, large text
const motion = { reduced: false, warpAmp: 1, bounce: 1 };
function updateMotion() {
  let prefers = false;
  try { prefers = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { /* none */ }
  const reduced = FLAGS.rm || settings.motion === "reduced" || (settings.motion !== "full" && prefers);
  motion.reduced = reduced;
  motion.warpAmp = reduced ? 0.5 : 1;
  motion.bounce = reduced ? 0 : 1;
}
updateMotion();
const root = document.documentElement;
if (FLAGS.inset) {
  const [t, r, b, l] = FLAGS.inset;
  root.style.setProperty("--inset-t", t + "px");
  root.style.setProperty("--inset-r", r + "px");
  root.style.setProperty("--inset-b", b + "px");
  root.style.setProperty("--inset-l", l + "px");
}
root.classList.toggle("large", !!settings.largeText);
root.classList.toggle("reduced", motion.reduced);

// The safe area in CSS px, from the same --safe-* the HUD and the captions use (style.css: env(safe-area-inset-*)
// plus ?inset), read through a hidden probe, since a custom property with env() does not compute to px by itself.
const safeProbe = document.createElement("div");
safeProbe.setAttribute("aria-hidden", "true");
safeProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;"
  + "padding:var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l)";
document.body.appendChild(safeProbe);
const safe = { t: 0, r: 0, b: 0, l: 0 };
function readSafe() {
  try {
    const cs = getComputedStyle(safeProbe);
    for (const [k, p] of [["t", "paddingTop"], ["r", "paddingRight"], ["b", "paddingBottom"], ["l", "paddingLeft"]]) {
      const v = parseFloat(cs[p]);
      safe[k] = Number.isFinite(v) && v > 0 ? v : 0;
    }
  } catch (e) { /* keep the last */ }
}
readSafe();

// ---- the modules
const area = $("area"), canvas = $("view"), svg = $("rings"), stickEl = $("stick");
const hudRoot = $("hud"), pauseBtn = $("pause");
let vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);

const renderer = createRenderer(canvas, { gl: FLAGS.gl, q: Q.get("q"), res: FLAGS.res, probe: FLAGS.probe, motion });
renderer.resize(vw, vh);
const rings = createRings(svg);
const hud = createHud(hudRoot);
const captions = createCaptions($("captions"), { on: () => settings.captions !== false });
const screens = createScreens($("screens"), { act: (name, arg) => { uiAct(name, arg); }, settings: () => settings });

let run = null;
let realtime = !FLAGS.test && !FLAGS.freeze;
let wallBase = performance.now();
let camera = makeCamera(vw, vh, null);
let lastView = null;
let lastScreen = { name: "title", data: null };
let menu = null;                  // a menu opened over the title, the result or pause: { name }
let botDriver = null;
let held = {};
let placeText = null, placeNum = null;
let momentPending = FLAGS.moment;
let frames = 0, stopped = false;
let audioCtx = null, sound = null, hearing = false;
let muted = FLAGS.mute || !store.soundOn();
const lastBeat = { mother: -Infinity, you: -Infinity };
const recent = { mother: [], you: [] };
const judges = [];

const coreTime = (wallMs) => (realtime && run && !run.paused ? (wallMs - wallBase) / 1000 : run ? run.t : 0);
const coreNow = () => coreTime(performance.now());
const anchor = () => { wallBase = performance.now() - (run ? run.t : 0) * 1000; };

const input = createInput(area, { coreTime, camera: () => camera, settings: () => settings });

// ---- runs
const newSeed = () => (FLAGS.seed !== null ? FLAGS.seed : (Math.random() * 4294967296) >>> 0);

function newRun(start = "new", seed = newSeed()) {
  run = createRun({ seed, settings, save, start });
  anchor();
  lastBeat.mother = lastBeat.you = -Infinity;
  placeText = null;
  placeNum = null;
  menu = null;
  judges.length = 0;
  input.flush();
  processEvents();
}

function goto(stage, { seed = null, carry = null, assist, oneButton } = {}) {
  let id = stage;
  if (typeof id === "string" && /^\d+$/.test(id)) id = Number(id);
  if (typeof assist === "boolean") settings.assist = assist;
  if (typeof oneButton === "boolean") settings.oneButton = oneButton;
  const sd = seed !== null && seed !== undefined && Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : run ? run.seed : newSeed();
  const start = { practice: id };
  if (carry) start.carry = carry;
  newRun(start, sd);
  if (!run.practice) return false;
  applyMoment();
  return true;
}

function applyMoment() {
  if (!momentPending || !run.state || !PLAYING.has(run.screen)) return;
  const m = momentPending;
  momentPending = null;
  run.jump(m);
  processEvents();
}

// ---- sound (built on the Play tap, 11)
function ensureAudio() {
  if (sound) { sound.resume(); return; }
  let ctx = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  } catch (e) { ctx = null; }
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* not there */ }
  audioCtx = ctx;
  sound = createSound(ctx, { seed: run ? run.seed : 1, latencyS: null });
  sound.setMuted(muted);
  sound.start();
}

// core seconds → the audio clock (wall seconds when there is no context)
const toCtx = (tc) => (audioCtx ? audioCtx.currentTime : performance.now() / 1000) + (tc - coreNow());

// The womb bus cutoff over the run (11).
function cutoffFor(id, ga) {
  if (id === "answer") return 250 + 200 * clamp01((ga - 105) / (189 - 105));
  if (id === "turn") return 450 + 150 * clamp01((ga - 196) / (280 - 196));
  if (id === "birth") return 300;
  return 150;
}

// Her beats (and yours) for the next 100 ms plus the output latency, from run.beats(), each one once.
function scheduleSound() {
  if (!sound || !run || run.paused || run.screen === "title") return;
  const now = coreNow();
  const s = sound.stats();
  if (run.stageId && run.stageId !== "ending") {
    const c = cutoffFor(run.stageId, run.gaDay);
    if (Math.abs(c - s.cutoffHz) > 0.5) sound.setScene({ cutoffHz: c });
  }
  const until = now + LOOKAHEAD_S + (fin(s.latencyS) ? s.latencyS : 0);
  for (const heart of ["mother", "you"]) {
    const from = Math.max(now - 0.02, lastBeat[heart] + 1e-4);
    if (!(until > from)) continue;
    const times = run.beats(from, until, heart).filter((t) => t > lastBeat[heart] + 1e-4);
    if (!times.length) continue;
    sound.schedule(heart, times, toCtx);
    lastBeat[heart] = times[times.length - 1];
    recent[heart].push(...times);
    if (recent[heart].length > 8) recent[heart].splice(0, recent[heart].length - 8);
  }
}

function setMuted(m) {
  muted = !!m;
  if (sound) sound.setMuted(muted);
}
function toggleMute() {
  const on = muted;                 // muted now → sound goes on
  store.setSoundOn(on);
  setMuted(!on);
  if (screens.current === "pause") screens.show("pause", { soundOn: !muted });
  else if (screens.current === "title") screens.show("title", titleData());
}

// ---- events from the run (16.6, 16.8)
const CUES = new Set(["bump", "bounce", "stick", "loose", "goldIn", "enter", "seal"]);

function processEvents() {
  const evs = run.events;
  while (evs.length) {
    const list = evs.splice(0, evs.length);
    for (const ev of list) onEvent(ev);
  }
}

// ---- the one caption path (12, 15.1). Nothing raw reaches the screen: a string id goes through core/text.js, a
// fact id through core/facts.js with its clock label in front, and an id that is neither shows nothing.
const capSeen = new Set();            // this stage's fact captions and once-per-stage sound captions
const textOf = (id, vars = {}) => (has(id) ? say(id, vars || {}, settings) : null);
const capMs = () => (run && run.stageId === "swim" ? 2500 : 4000);   // stage 1: one line for 2.5 s (8, 9)

// Every caption goes out as captions.say(id, text, { dir, ms, kind }), the text final. kind is "say" (a stage's
// caption or sub-goal line), "fact" (with label and body beside it) or "cue" (a sound's caption, design.md 12), so
// the captions can rank them: a fact waits behind a line, a cue shows only when nothing else does.
function sayCaption(id, text, extra = {}) {
  if (!text) return false;
  return captions.say(id, text, { kind: "say", ms: capMs(), ...extra, dir: extra.dir || null });
}

// A fact as a caption, once per stage: "Week 10: From about now you are called a fetus. …" (no label in the ending).
function factCaption(id, dir = null) {
  const key = "fact:" + id;
  if (capSeen.has(key)) return false;
  const ln = factLine(id, settings);
  if (!ln) return false;
  capSeen.add(key);
  return sayCaption(id, ln.label ? ln.label + ": " + ln.text : ln.text, { dir, kind: "fact", fact: id, label: ln.label, body: ln.text });
}

// A caption event: a registered string first (an id can be both, such as egg.seal), else a fact.
function caption(id, vars = {}, dir = null, kind = "say") {
  if (!id) return false;
  const text = textOf(id, vars);
  if (text) return sayCaption(id, text, { dir, kind });
  if (factById(id)) return factCaption(id, dir);
  return false;
}

// A sound cue's caption, once per stage.
function cueCaption(id) {
  if (capSeen.has("cue:" + id)) return false;
  capSeen.add("cue:" + id);
  return caption(id, {}, null, "cue");
}

// The sound captions (design.md 12): a stage's own "<stage>.sfx.<id>" string (split.sfx.pling), else the shared one
// for that sound, each once per stage. The other one-shots go uncaptioned: their stage already says what happens.
const CUE_OF = {
  bump: "cue.pack", bounce: "cue.bounce", goldIn: "cue.goldIn", seal: "cue.seal",
  "swim:swell": "cue.wave", "birth:birth.swell": "cue.wave", "root:root.link": "cue.link", "root:root.linkBeat": "cue.link",
  "grow:bell": "cue.bell", "grow:move": "cue.move", "birth:birth.open": "cue.open",
};
function cueOf(ev) {
  if (ev.name === "sfx") {
    const id = String(ev.id || "");
    const own = id.includes(".") ? id.replace(/^([^.]+)\./, "$1.sfx.") : `${ev.stage}.sfx.${id}`;
    if (has(own)) return own;
    return CUE_OF[`${ev.stage}:${id}`] || null;
  }
  if (ev.name === "bump" && !(ev.a === "you" || ev.b === "you")) return null;    // only the bumps you are in
  return CUE_OF[ev.name] || null;
}

// The ending's run time line: {time} from the ending's own vars, else run.ms; none in practice (run.ms 0).
function endingTime(ev) {
  if (ev.vars && ev.vars.time) return caption(ev.id, ev.vars, ev.dir);
  if (!(run.ms > 0)) return false;
  return caption(ev.id, { time: minSec(run.ms) }, ev.dir);
}

// Sound times: every stage time reaches the host in core seconds (run.js moves t and at); a sound plays at `at`
// when the event has one (a beat-locked cue laid ahead), else at its t.
const soundAt = (ev) => toCtx(fin(ev.at) ? ev.at : ev.t);
const BREATHS = new Set(["inhale", "cry", "breath"]);

function onEvent(ev) {
  switch (ev.name) {
    case "screen": onScreen(ev.screen, ev.data); break;
    case "stageStart":
      placeText = null;
      placeNum = null;
      hearing = false;
      capSeen.clear();
      captions.clear();
      if (ev.index === 0 && ev.attempt === 1 && !ev.practice) cueCaption("cue.mother");   // at Play: her heartbeat
      if (sound) sound.setScene({ stage: ev.id, cutoffHz: ev.id === "ending" ? 300 : cutoffFor(ev.id, run.gaDay), hearing: false });
      break;
    case "carryIn":
      if (!run.practice) { save = recordCarryIn(save, ev.id, ev.carry); persist(); }
      break;
    case "crossfade": renderer.crossfade(ev.seconds); break;
    case "stageEnd": save = recordStage(save, ev.id, ev.result, ev.marks); persist(); break;
    case "runEnd": save = recordRun(save, ev.summary); persist(); break;
    case "prompt": input.setLive(ev.gesture || "none", ev.keys || "steer", ev.t); break;   // from its core time (5.3)
    case "caption":
      if (ev.id === "ending.time") endingTime(ev);
      else caption(ev.id, ev.vars || {}, ev.dir || null);
      break;
    case "fact": {
      // card and overlay facts show on their screens (run.js puts them in the screen data); a caption fact here
      const f = factById(ev.id);
      if ((ev.where || (f && f.where)) === "caption") factCaption(ev.id, ev.dir || null);
      break;
    }
    case "subgoal":
      // a sub-goal line that the prompt line already shows (birth's waves, stage 6's beat) is not said again as a
      // caption
      if (ev.text && !(ev.state === "shown" && promptShows(ev.text))) caption(ev.text);
      break;
    case "place": {
      // the place slot; the pluck only when you gain a place (11)
      const gained = fin(ev.place) && fin(placeNum) && ev.place < placeNum;
      if (fin(ev.place)) { placeText = say("hud.place", { place: ordinal(ev.place), of: fin(ev.of) ? ev.of : 20 }); placeNum = ev.place; }
      if (sound && gained) sound.sfx("place", soundAt(ev), ev);
      break;
    }
    case "judge":
      judges.push({ target: ev.target, grade: ev.grade, errMs: ev.errMs, rawMs: ev.rawMs, heart: ev.heart, t: ev.t, stage: ev.stage });
      if (judges.length > 32) judges.splice(0, judges.length - 32);
      break;
    case "sfx":
      { const c = cueOf(ev); if (c) cueCaption(c); }
      if (!sound) break;
      if (ev.stage === "ending" && BREATHS.has(ev.id)) sound.breath(ev.id, soundAt(ev), ev);   // the birth bus
      else sound.sfx(ev.id, soundAt(ev), ev);
      break;
    case "milestone":
      if (ev.id === "hearing") hearing = true;
      if (sound) {
        sound.setScene({ hearing });
        if (ev.id === "ready") sound.sfx("ready", soundAt(ev), ev);
      }
      break;
    case "song":
      if (sound) sound.hum(ev.notes, soundAt(ev), { clear: !!ev.clear, lit: ev.lit, noteS: ev.noteS, gapS: ev.gapS,
        muffled: !!ev.muffled, stage: ev.stage });
      break;
    default:
      { const c = cueOf(ev); if (c) cueCaption(c); }
      if (CUES.has(ev.name) && sound) {
        // a bump between two rivals plays 10 dB softer within 40 u of you (11); the sound needs to be told which
        if (ev.name === "bump" && ev.a !== "you" && ev.b !== "you") {
          const a = lastView && lastView.anchor;
          ev.near = !!(a && fin(ev.x) && fin(ev.y) && Math.hypot(ev.x - a.x, ev.y - a.y) <= 40);
        }
        sound.sfx(ev.name, soundAt(ev), ev);
      }
      break;
  }
}

function titleData() {
  return { best: save.best && save.best.done ? save.best.score : null, soundOn: !muted };
}

// The screen the run is on, shown again (after a menu, pause or a new run).
function showRunScreen() {
  const { name, data } = lastScreen;
  hudRoot.hidden = !(PLAYING.has(name) || name === "overlay" || name === "almost");
  if (name === "title") screens.show("title", titleData());
  else if (PLAYING.has(name)) screens.hide();
  else screens.show(name, data);
}

function syncLive() {
  if (PLAYING.has(run.screen) && run.state && !run.paused) {
    const p = run.mod.prompt(run.state) || {};
    input.setLive(p.gesture || "none", p.keys || "steer");
  } else input.setLive("none");
}

function onScreen(name, data) {
  lastScreen = { name, data };
  if (run.paused) return;
  menu = null;
  showRunScreen();
  if (PLAYING.has(name)) input.flush();
  syncLive();
  if (name === "ending" && sound) sound.open(1.5);
}

// ---- pause
function pauseGame() {
  if (!run || run.paused || !PAUSABLE.has(run.screen)) return false;
  if (!run.act("pause")) return false;
  menu = null;
  screens.show("pause", { soundOn: !muted });
  if (sound) sound.suspend();
  processEvents();
  return true;
}

function resumeGame() {
  if (!run.act("resume")) return false;
  menu = null;
  input.flush();
  anchor();
  showRunScreen();
  syncLive();
  if (sound) sound.resume();
  processEvents();
  return true;
}

// ---- actions from the screens, the keys, the bot and the hook
function act(name, arg = null) {
  let ok = false;
  switch (name) {
    case "play":
      ensureAudio();
      if (run.screen !== "title") newRun("new");
      ok = run.act("play");
      processEvents();                       // stageStart names her heartbeat first (onEvent), then the stage speaks
      applyMoment();
      break;
    case "again":
      ensureAudio();
      newRun("new");
      ok = run.act("play");
      break;
    case "pause": ok = pauseGame(); break;
    case "resume": ok = resumeGame(); break;
    case "retry":
      ok = run.act("retry");
      if (ok) { menu = null; input.flush(); anchor(); if (sound) sound.resume(); }
      break;
    case "settings": case "stages": case "sources": case "tapTest":
      menu = { name };
      ok = screens.show(name, { save, settings });
      break;
    case "back":
      menu = null;
      if (run.paused) screens.show("pause", { soundOn: !muted });
      else showRunScreen();
      ok = true;
      break;
    case "mute": toggleMute(); ok = true; break;
    case "setting": {
      // ui/screens.js has set the live settings and written the save; the page follows what it owns
      const key = arg && arg.key;
      if (key === "motion") { updateMotion(); root.classList.toggle("reduced", motion.reduced); }
      if (key === "largeText") root.classList.toggle("large", !!settings.largeText);
      if (key === "captions" && settings.captions === false) captions.clear();
      if (key === "offsetMs") input.flush();
      ok = true;
      break;
    }
    case "practice": ensureAudio(); ok = goto(arg); break;
    default: ok = run.act(name); break;
  }
  processEvents();
  return ok;
}

function uiAct(name, arg) {
  const ok = act(name, arg);
  present();
  if (ok && STARTS.has(name)) startClock();
  return ok;
}

// A run started from a menu (Play, Play again, a practice stage) starts its clock once its first frame is up. That
// frame bakes the stage's paper, which can stall the page for most of a second, so the stall is dropped as a long
// frame drops time: core time goes on from run.t when the frame is up. It goes on the output latency (at most
// 0.1 s) plus 10 ms after now, and her beats are scheduled at once, so the beat on the stage's first instant (her
// heartbeat at Play) is scheduled on time, latency-early, and heard with its drawn beat. The scheduler's rule stays:
// a beat already more than 20 ms late is dropped, never played late (ui/sound.js).
function startClock() {
  if (!realtime || !run || run.paused || !PLAYING.has(run.screen)) return;
  const lat = sound ? Number(sound.stats().latencyS) : 0;
  const lead = Math.max(0, Math.min(MAX_LEAD_S, fin(lat) ? lat : 0)) + START_LEAD_S;
  wallBase = performance.now() - (run.t - lead) * 1000;
  scheduleSound();
}

// ---- one fixed step
function stepOnce(extra = null) {
  const tEnd = run.t + DT;
  let it;
  if (botDriver) {
    const c = botDriver.choose(run.screen);
    if (c) act(c);
    input.intents(tEnd);                       // live input is dropped while the bot drives
    const live = PLAYING.has(run.screen) && run.state && !run.paused;
    it = live ? shiftIntents(botDriver.intents(run.mod, run.state), -run.stageStart) : makeIntents();
  } else {
    it = input.intents(tEnd);
    for (const k of HELD) if (held[k] !== undefined) it[k] = held[k];
    if (extra) for (const k of HELD) if (extra[k] !== undefined) it[k] = extra[k];
  }
  run.step(it);
  processEvents();
}

// ---- the picture, the rings, the HUD
const MM_TEXT = [[1000, "1 m"], [100, "10 cm"], [10, "1 cm"], [1, "1 mm"], [0.1, "0.1 mm"]];
function scaleText(scale) {
  if (!scale) return "";
  if (typeof scale.you === "string") return say("hud.you", { size: scale.you }, settings);
  if (fin(scale.mm)) {
    for (const [v, t] of MM_TEXT) if (Math.abs(scale.mm - v) < 1e-9) return t;
    return scale.mm >= 10 ? scale.mm / 10 + " cm" : scale.mm + " mm";
  }
  return "";
}

// The scale bar for the HUD: { text, px } with px the bar's round length drawn at the camera's px per mm (the size
// line of stages 1 and 2 is text only).
function scaleBar(view) {
  const text = scaleText(view.scale);
  if (!text || !view.scale || !fin(view.scale.mm)) return text;
  const c = view.camera || {};
  const px = fin(c.mmPerU) && c.mmPerU > 0 && fin(camera.pxPerU) ? (view.scale.mm / c.mmPerU) * camera.pxPerU : null;
  return fin(px) ? { text, px: Math.round(px) } : text;
}

function liveScore() {
  const sum = run.summary();
  const id = run.stageId;
  let total = runTotal(sum.stages.filter((s) => s.id !== id));
  const mine = sum.stages.find((s) => s.id === id);
  if (id === "birth") return total;          // Birth's points show only on the run result (6.8)
  if (run.screen === "stage" && run.mod && run.mod.meta.scored && run.state) {
    const r = run.result();
    const live = r && r.score && fin(r.score.total) ? r.score.total : 0;
    total += Math.max(live, mine ? mine.score.total : 0);
  } else if (mine) total += mine.score.total;
  return total;
}

// Keys or touch: the prompt names keys on a desktop (a fine pointer, a mouse or a key used last) and gestures on
// touch (a touch or pen used last). A prompt's textKeys, else its text id + ".keys" or + "Keys" when registered
// (turn.breathe.keys, egg.guardKeys), is the desktop form.
let device = (() => {
  try { return window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches ? "keys" : "touch"; }
  catch (e) { return "touch"; }
})();
let lastTouch = null;                 // { x, y } CSS px of the last touch-down in the play area (the ending's thumb ring)
window.addEventListener("pointerdown", (e) => {
  device = e.pointerType === "mouse" ? "keys" : "touch";
  if (e.pointerType !== "mouse") lastTouch = { x: e.clientX, y: e.clientY };
}, true);
window.addEventListener("keydown", () => { device = "keys"; }, true);

function promptText(p) {
  if (!p || !p.text) return null;
  if (device === "keys") {
    const k = [p.textKeys, p.text + ".keys", p.text + "Keys"].find((id) => has(id));
    if (k) return textOf(k);
  }
  return textOf(p.text);
}

// Does the prompt line show this line now: the same string id (in its touch or desktop form), or the same words?
function promptShows(id) {
  if (!PLAYING.has(run.screen) || !run.state) return false;
  const p = run.mod.prompt(run.state) || {};
  if (!p.text || p.gesture === "none") return false;
  if (p.text === id || p.textKeys === id) return true;
  const line = promptText(p), said = textOf(id);
  return !!line && line === said;
}

function promptLine() {
  if (!PLAYING.has(run.screen) || !run.state) return null;
  const p = run.mod.prompt(run.state) || {};
  if (!p.text || p.gesture === "none") return null;
  const text = promptText(p);
  return text ? { text, gesture: p.gesture, keys: device === "keys" } : null;
}

let hudPromptKey = null;
const fmtLen = (n) => (fin(n) ? Math.round(n).toLocaleString("en-US").length : String(n ?? "").length);
function updateHud(view) {
  const st = run.state, mod = run.mod;
  const v = {
    stageName: mod ? mod.meta.name : "",
    clock: st && mod !== ENDING ? gaLabel(st.gaDay, { fertilized: !!st.fertilized }) : "",
    score: mod && mod.meta.scored ? liveScore() : "",
    place: run.stageId === "swim" ? placeText : null,
    scale: mod && mod !== ENDING ? scaleBar(view) : "",
    prompt: promptLine(),
  };
  hud.set(v);
  // the words set the HUD's height: measure its bottom again when a line changes, or the score gets a digit (a wider
  // score narrows the left block, and the clock may wrap); the ResizeObserver also does, at the next frame, and this
  // keeps the caption band right in the same frame
  const sc = v.scale && typeof v.scale === "object" ? v.scale.text : v.scale;
  const key = [run.stageId, hudRoot.hidden, v.stageName, v.clock, fmtLen(v.score), v.place, sc,
    v.prompt ? v.prompt.text : ""].join("|");
  if (key !== hudPromptKey) { hudPromptKey = key; trackHud(); }
}

function updateStick() {
  const s = input.stick;
  const g = input.live().gesture;
  const show = s.on && run.screen === "stage" && !run.paused && (g === "drag" || g === "dragHold");
  if (stickEl.hidden !== !show) stickEl.hidden = !show;
  if (show) stickEl.style.transform = `translate(${s.ox.toFixed(1)}px, ${s.oy.toFixed(1)}px)`;
}

// The HUD's bottom (CSS px) as --hud-b, for the portrait caption band under the prompt line (style.css). Within a
// stage it only moves down, so a caption never jumps up when the prompt line hides between moments.
let hudB = 0, hudBStage = null;
function trackHud() {
  if (hudRoot.hidden) return;
  const b = Math.ceil(hudRoot.getBoundingClientRect().bottom);
  const stage = run ? run.stageId : null;
  const next = stage === hudBStage ? Math.max(hudB, b) : b;
  hudBStage = stage;
  if (next !== hudB || !root.style.getPropertyValue("--hud-b")) { hudB = next; root.style.setProperty("--hud-b", hudB + "px"); }
}
if (typeof ResizeObserver === "function") new ResizeObserver(trackHud).observe(hudRoot);

let stageAttr = null;
function present(frameStart) {
  const view = run.view();
  lastView = view;
  camera = makeCamera(vw, vh, view.camera);
  renderer.draw(view, fin(frameStart) ? { frameStart } : {});
  rings.draw(view.rings, camera, motion, view.stage, { lastTouch, device, safe });
  updateHud(view);
  updateStick();
  const sa = run.stageId || "title";
  if (sa !== stageAttr) { root.dataset.stage = sa; stageAttr = sa; }
}

// ---- the loop: fixed steps with an accumulator, then one draw
function frame() {
  if (stopped) return;
  requestAnimationFrame(frame);
  const t0 = performance.now();
  if (realtime && !run.paused) {
    let target = (t0 - wallBase) / 1000;
    if (target - run.t > MAX_BEHIND_S) { wallBase += (target - run.t - MAX_BEHIND_S) * 1000; target = run.t + MAX_BEHIND_S; }
    let n = 0;
    while (run.t + DT <= target + 1e-9 && n < MAX_STEPS) { stepOnce(); n++; }
  } else anchor();
  present(t0);
  frames++;
  if (FLAGS.freeze) stopped = true;
}

// ---- the page's own keys (menus, pause, mute, captions); ui/input.js reads the game keys
window.addEventListener("keydown", (e) => {
  if (e.repeat || !run) return;
  if (e.target && e.target.closest && e.target.closest("input, select, textarea")) return;
  if (e.code === "Escape" || e.code === "KeyP") {
    if (menu) uiAct("back");
    else if (run.paused) uiAct("resume");
    else if (pauseGame()) present();
    if (e.code === "Escape") e.preventDefault();
    return;
  }
  if (e.code === "KeyM") { toggleMute(); return; }
  if (e.code === "KeyC") {
    settings.captions = settings.captions === false;
    if (!settings.captions) captions.clear();
    saveSetting("captions");
  }
});
pauseBtn.addEventListener("click", (e) => { e.stopPropagation(); if (pauseGame()) present(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && pauseGame()) present(); });
window.addEventListener("pagehide", () => { if (pauseGame()) present(); });
window.addEventListener("resize", () => {
  vw = Math.max(1, window.innerWidth);
  vh = Math.max(1, window.innerHeight);
  readSafe();
  hudBStage = null;                  // the HUD's bottom is measured again for the new size
  renderer.resize(vw, vh);
  present();
  trackHud();
});

// ---- the test hook (16.9); every time it takes or returns is in stage seconds
function screenOf(cam, p) {
  return p && fin(p.x) && fin(p.y) ? cam.toScreen(p.x, p.y) : null;
}

// A copy of a probe with `screen` px beside every world point.
function mapProbe(obj, cam) {
  if (Array.isArray(obj)) return obj.map((v) => mapProbe(v, cam));
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = mapProbe(v, cam);
  if (fin(obj.x) && fin(obj.y)) out.screen = cam.toScreen(obj.x, obj.y);
  return out;
}

function probeOf(id) {
  if (run.stageId !== id || !run.state || !PLAYING.has(run.screen)) return null;
  const p = run.mod.probe(run.state);
  if (!p) return null;
  const cam = makeCamera(vw, vh, run.view().camera);
  const out = mapProbe(p, cam);
  if (id === "egg" && out.arc && fin(out.arc.angle)) out.arc.screenAngle = cam.screenAngle(out.arc.angle);
  return out;
}

function fbState() {
  const st = run.state, mod = run.mod;
  const view = run.view();
  const cam = makeCamera(vw, vh, view.camera);
  const res = st ? run.result() : null;
  const total = res && res.score && fin(res.score.total) ? res.score.total : null;
  const playing = PLAYING.has(run.screen) && st;
  const pr = playing ? mod.prompt(st) || null : null;
  return {
    screen: run.screen,
    stage: mod ? (mod === ENDING ? "ending" : mod.meta.index + 1) : null,
    stageId: run.stageId,
    moment: st ? st.moment : null,
    t: st ? st.t : null,
    gaDay: run.gaDay,
    label: st && mod !== ENDING ? gaLabel(st.gaDay, { fertilized: !!st.fertilized }) : null,
    fertilized: st ? !!st.fertilized : false,
    score: total,
    runScore: run.summary().total,
    grade: res && res.done && mod.meta.scored ? gradeOf(total || 0, !!res.goalMet) : null,
    prompt: pr ? { ...pr, line: promptText(pr) } : null,
    subgoals: st && st.subgoals ? { ...st.subgoals } : {},
    paused: run.paused,
    seed: run.seed,
    settings: { ...settings },
    anchor: screenOf(cam, view.anchor),
    cue: screenOf(cam, view.cue),
    ms: run.ms,
    place: run.stageId === "swim" ? placeText : null,
    frames,
    realtime,
    practice: run.practice,
    done: run.done,
    live: input.live(),
    judges: judges.slice(-8),
    stageStart: run.state ? run.stageStart : null,
    device,
    tier: FLAGS.q,
  };
}

// Queue a timed press or release at the next target of these kinds (stage time), else now.
function injectAt(kinds, errMs, events) {
  if (!run.state || !PLAYING.has(run.screen)) return null;
  const list = (run.mod.targets(run.state, 60) || []).filter((x) => kinds.includes(x.kind)).sort((a, b) => a.t - b.t);
  const tgt = list[0] || null;
  const tS = tgt ? tgt.t + (fin(errMs) ? errMs : 0) / 1000 : run.state.t;
  const off = (fin(settings.offsetMs) ? settings.offsetMs : 0) / 1000;
  const ss = run.stageStart;
  input.inject(events.map(([type, dt]) => ({ type, t: tS + dt + ss, raw: tS + dt + ss + off })));
  return { t: tS, target: tgt ? tgt.id : null };
}

function visible(e) {
  if (!e.getClientRects().length) return false;
  const cs = getComputedStyle(e);
  return cs.visibility !== "hidden" && cs.display !== "none";
}

window.__fb = {
  state: fbState,
  goto(stage, opts = {}) { const ok = goto(stage, opts || {}); present(); return ok; },
  jump(moment) { const ok = run.jump(moment); processEvents(); present(); return ok; },
  realtime(on) { realtime = !!on && !FLAGS.freeze; anchor(); return realtime; },
  step(n = 1, intents = null) {
    const k = Math.max(0, Math.floor(Number(n) || 0));
    let extra = null;
    if (intents && typeof intents === "object") {
      const ss = run.stageStart;
      const ev = [];
      for (const p of intents.presses || []) if (p && fin(p.t)) ev.push({ type: "press", t: p.t + ss, raw: fin(p.raw) ? p.raw + ss : undefined });
      for (const p of intents.releases || []) if (p && fin(p.t)) ev.push({ type: "release", t: p.t + ss, raw: fin(p.raw) ? p.raw + ss : undefined });
      for (const p of intents.taps || []) if (p && fin(p.t)) ev.push({ type: "tap", t: p.t + ss });
      input.inject(ev);
      extra = {};
      for (const key of HELD) if (key in intents) extra[key] = intents[key];
    }
    for (let i = 0; i < k && !run.paused; i++) stepOnce(extra);
    anchor();
    present();
    return fbState();
  },
  input(partial) {
    if (!partial) held = {};
    else for (const k of HELD) if (k in partial) { if (partial[k] === undefined) delete held[k]; else held[k] = partial[k]; }
    return { ...held };
  },
  tap({ errMs = 0 } = {}) { return injectAt(["tap", "press"], errMs, [["press", 0], ["release", TAP_LIFT_S]]); },
  press({ errMs = 0 } = {}) { return injectAt(["tap", "press"], errMs, [["press", 0]]); },
  release({ errMs = 0 } = {}) { return injectAt(["release"], errMs, [["release", 0]]); },
  nextTarget() {
    if (!run.state || !PLAYING.has(run.screen)) return null;
    const x = (run.mod.targets(run.state, 60) || []).slice().sort((a, b) => a.t - b.t)[0];
    return x ? { t: x.t, P: x.P, kind: x.kind, heart: x.heart, id: x.id } : null;
  },
  bot(skill) {
    botDriver = skill === false || skill === null || skill === undefined ? null : createBot(Number(skill), run.seed);
    return !!botDriver;
  },
  finish() { const ok = run.finish(); processEvents(); present(); return ok; },
  retry() { return uiAct("retry"); },
  skip() { return uiAct("skip"); },
  act(name, arg = null) { return uiAct(name, arg); },
  result() { return run.screen === "result" ? run.summary() : run.result(); },
  targets() {
    const boxes = [];
    for (const e of document.querySelectorAll("button, a[href], input, select, textarea, [data-act], [tabindex]")) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      boxes.push({ id: e.id || null, act: e.dataset.act || null, text: (e.textContent || "").trim().slice(0, 48),
        x: r.left, y: r.top, w: r.width, h: r.height });
    }
    const s = fbState();
    return { boxes, anchor: s.anchor, cue: s.cue };
  },
  facts() { return run.summary().facts; },
  race() { return probeOf("swim"); },
  guard() { return probeOf("egg"); },
  get perf() { return { ...renderer.perf }; },
  get sound() {
    const s = sound ? sound.stats() : { state: "none", cutoffHz: null, scheduled: { mother: 0, you: 0 }, muted, voices: 0, latencyS: 0 };
    return { state: s.state, cutoffHz: s.cutoffHz, hearing, beats: { mother: recent.mother.slice(), you: recent.you.slice() },
      scheduled: { ...s.scheduled }, muted: s.muted, voices: s.voices, latencyS: s.latencyS };
  },
  get motion() { return { ...motion }; },
  lum() { return renderer.lum(); },
  save() { return parse(save); },
};

// ---- boot
newRun("new");
if (FLAGS.stage) goto(FLAGS.stage);
present();
requestAnimationFrame(frame);
setInterval(scheduleSound, SOUND_TICK_MS);
