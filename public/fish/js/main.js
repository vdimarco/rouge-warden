// Reel It In. The phone is the rod and the reel.
// This file runs the game: the title and the places, the cast and the reel (the phone stays upright for both), the catch,
// and the derby.
// The modules do the parts: motion.js reads the phone, reel.js is the reel you touch, cast.js flies the lure,
// fish.js runs the fish and the fight, world.js draws the place, audio.js and haptics.js make the feel.
// places.js holds the maps, fishing.js who lives where, journey.js the trail and its words, save.js the save file.
import { normalizeStyle } from "./art-style.js";
import { PullStrength } from "./pull.js";
import { Motion } from "./motion.js";
import { createGuide, moveWords, inputOf } from "./guide.js";
import { createRodCues } from "./rod-cues.js";
import { Haptics } from "./haptics.js";
import { Sound } from "./audio.js";
import { createWorld } from "./world.js";
import { createCutscenes, opening as openingCut, arrival as arrivalCut, reveal as revealCut, landed as landedCut, finale as finaleCut, ringSpot, arriveId, revealId, landedId } from "./cutscenes.js";
import { HangingLure } from "./line-motion.js";
import { CAST, castParams, Flight, castLanding, touchTheta, touchSpan, touchSpanAt, gradeRelease, liftError, RELEASE, TOUCH } from "./cast.js";
import { createCastRail } from "./cast-rail.js";
import { Rises, LakeSim, rodTip, sizeRank, firstBite } from "./fish.js";
import { ReelPanel, Crank, RodPad, Gauge, REEL_UI, blocked } from "./reel.js";
import * as LAKE from "./lake.js";
import { PLACES, getPlace } from "./places.js";
import { byId } from "./species.js";
import { fishingOf, placeSpecies } from "./fishing.js";
import { ORDER, JOURNEY, journeyOf, nextPlace, prevPlace, isOpen, fmtKg, startHour, stepHour, rankFor, nextRank, goalText, openedText, isBigFish, LEGEND_STEPS, legendHint, legendsLanded, topFish, foundHere, foundAll, zoneHint, newPlaces, untoldOpens, TROPHY_RANK, sizeLine, revealText, lossText } from "./journey.js";
import { PLACE_GOALS, goalsMet, goalCount, nextGoal, dailyGoal, dayHit, dayDoneText, todayLine, isDay, dayOf, STREAK, ASSIST, SHORT_M, assistFish, progressNote } from "./goals.js";
import { SAVE_KEY, loadSave, placeRec, recordCatch, recordGoal, recordDay, legendStep, recordDerby } from "./save.js";
import { Native } from "./native.js";
import { isCalm } from "./calm.js";
import { VERSION } from "./version.js";
// the menus and the easier-play settings: the pixel ratio for ?shot, the gauge words for Larger text
import { WORLD } from "./world.js";
import { GAUGE } from "./reel.js";

// every module is in: the bar on the boot screen moves on (index.html shows that screen until the title is ready)
if (window.fishBoot) fishBoot.step(0.4);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const now = () => performance.now();
const pullStrength = new PullStrength();
const pullMeter = document.querySelector("#pullStrength");
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has("debug");
// ?open opens every place for this page load. It is never saved.
const OPEN_ALL = QS.has("open");
// ?day=YYYY-MM-DD is the day of today's goal for this page load. It is never saved: today's goal and the run of days
// move on in this page load only, and the save keeps the ones it had (see persist). Without it the phone's date is the day
const QA_DAY = isDay(QS.get("day")) ? QS.get("day") : null;
const today = () => QA_DAY || dayOf();
// ?shot is for the store pictures (qa/fish/shots.mjs): Graphics High, the lake drawn at up to 3 times the CSS pixels, and
// no automatic render scale. It is never saved
const SHOT = QS.has("shot");
if (SHOT) WORLD.DPR.high = 3;

/* ---------------- saving ---------------- */
// save.js reads and cleans the file; this is only the storage. In the app the save also goes to native storage
// (Preferences), because the phone can clear the web view's storage. mirror is off while native storage may hold a
// save the game has not read yet, so a new save never covers it
let mirror = true;
const store = {
  raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { const json = JSON.stringify(v); try { localStorage.setItem(k, json); } catch (e) { /* storage off */ } if (mirror) Native.prefs.set(k, json); },
};
// the switches that live outside the save (haptics.js, audio.js and guide.js keep them, and Settings keeps Larger text and
// Calm effects): mirrored when the app goes away
const SWITCHES = ["fish.haptics", "arcade.sound", "reel-it-in-guide-v1", "fish.text", "fish.calm"];
const mirrorSwitches = () => { if (mirror) for (const k of SWITCHES) { const v = store.raw(k); if (v != null) Native.prefs.set(k, v); } };
// in web storage while a read of native storage has not come back: the next start reads it again
const UNREAD = "fish.native-unread";
// how far a save got: fish landed, then casts
const progress = (s) => s.caught * 1e6 + s.casts;
// the switches from native storage, where web storage has none
function putSwitches([, hx, sound, ...kept]) {
  if (hx != null && store.raw("fish.haptics") == null) Haptics.setEnabled(hx !== "false");
  if (sound != null && store.raw("arcade.sound") == null && (sound !== "false") !== Sound.isOn()) Sound.toggle();
  // the guide, Larger text and Calm effects are read from web storage
  SWITCHES.slice(2).forEach((k, i) => { if (kept[i] != null && store.raw(k) == null) { try { localStorage.setItem(k, kept[i]); } catch (e) { /* storage off */ } } });
}
// The app with no save in web storage (or with a native read that never came back): ask native storage, and keep the
// save with more in it. The answer has 400 ms, so a slow phone does not hold up the boot. A later answer is read when
// it comes (below), and until then nothing goes to native storage
const webRaw = store.raw(SAVE_KEY);
let restored = null, late = null;
if (Native.isNative && (webRaw == null || store.raw(UNREAD) != null)) {
  const read = Promise.all([SAVE_KEY, ...SWITCHES].map((k) => Native.prefs.get(k)));
  const got = await Promise.race([read, new Promise((r) => setTimeout(() => r(null), 400))]);
  if (got) {
    putSwitches(got);
    if (got[0] && (webRaw == null || progress(loadSave(got[0])) > progress(loadSave(webRaw)))) restored = got[0];
    try { localStorage.removeItem(UNREAD); } catch (e) { /* storage off */ }
  } else {
    late = read; mirror = false;
    try { localStorage.setItem(UNREAD, "1"); } catch (e) { /* storage off */ }
  }
}
const save = loadSave(restored || webRaw);
// under ?day: today's goal and the run of days as they were loaded, which is what the save keeps
const dayKept = QA_DAY && JSON.parse(JSON.stringify({ today: save.today, days: save.days }));
const persist = () => store.set(SAVE_KEY, dayKept ? { ...save, ...dayKept } : save);
if (restored) persist();
// The native answer came late. A native save with more in it than the game has now wins: it goes into web storage and
// the game starts again with it, on the boot screen or the title (never in play), once a session. Otherwise the game's
// save goes to native storage, and the mirror is on again
const startJson = JSON.stringify(save);
let comeback = null;
function takeComeback() {
  if (!comeback || traveling || (G.phase !== "boot" && G.phase !== "title")) return;
  try {
    if (sessionStorage.getItem("fish.comeback")) return;
    sessionStorage.setItem("fish.comeback", "1");
    localStorage.setItem(SAVE_KEY, comeback);
    localStorage.removeItem(UNREAD);
  } catch (e) { return; }
  location.reload();
}
if (late) late.then((got) => {
  putSwitches(got);
  applyAccess();
  const theirs = got[0] && loadSave(got[0]), json = theirs && JSON.stringify(theirs);
  const fresh = webRaw == null && JSON.stringify(save) === startJson;
  if (theirs && (progress(theirs) > progress(save) || (fresh && json !== startJson))) { comeback = json; takeComeback(); return; }
  mirror = true; persist(); mirrorSwitches();
  try { localStorage.removeItem(UNREAD); } catch (e) { /* storage off */ }
});
const openNow = (id) => isOpen(save, id, OPEN_ALL);

/* ---------------- state ---------------- */
const game = $("#game");
game.dataset.reelSide = save.reelSide;
const guide = createGuide(game, $("#guideToggle"), { caught: () => save.caught });
let guideCue = { text: "", sub: "", icon: "", tone: "" };
const touchDevice = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
const G = {
  phase: "boot",    // boot | title | cast | reel | catch | lost | results
  mode: "free",     // free | derby
  place: getPlace(save.place), // the place the player is at (a places.js map); the whole game reads it. The save holds an open one
  unlocked: [],     // places this derby opened: { id, kg, name }
  unlockId: null,   // the place the last catch opened
  pendingUnlock: null, closeCall: "", cardWait: false,   // the catch card: a place to announce next, a close-call toast, the photo beat is running
  big: null,        // the fish on the line is a big one: { at, said }
  walk: false,      // the fish is in a tail walk (jump after jump)
  input: "touch",   // motion | touch
  desk: "mouse",    // a computer: the input the player used last, mouse | keys (the fight words name it)
  paused: false,
  hour: 6.2,
  casts: 0, castsLeft: 10, bag: [],
  step: "ready",    // the cast: ready | open | pinned | loaded | flight | landed | ashore (open: bail opened with no thumb on the line)
  bail: "closed",
  pin: null,        // the finger that holds the line: { id, y0, theta }
  drop: 0,          // meters the lure slipped while the bail was open and nothing held the line
  openAt: 0, backMax: 90, strokeAt: 0,
  flight: null, cast: null, landing: null,
  sim: null, ring: null, drag: 1,
  aimYaw: 0,
  layout: "", rot: 0, vw: 0, vh: 0,
  hookReq: false, lastHook: 0,
  tension: 0, lastEvent: {}, outcomeAt: 0,
  frame: 0, fps: 60, seed: 1, force: null,   // force lets a test pick the fish: { species, kg, bite }
  wide: false,
};
let world = null, rises = null, reelPanel = null, crank = null, rodPad = null, gauge = null, crankPad = null;
const rodCues = createRodCues(game);
const castRail = createCastRail(game);
let cardT = 0, countT = 0;   // the catch card: the timer of the photo beat, the timer of the count-up
let cuts = null;             // the cutscene player (cutscenes.js, made in boot); heldToasts wait for the one playing
const heldToasts = [];

/* ---------------- icons for the prompts and the help ---------------- */
const PHONE = "<rect x='14' y='5' width='12' height='22' rx='2.5' fill='none' stroke='currentColor' stroke-width='2.4'/>";
const ICON = {
  bail: "<svg viewBox='0 0 40 40'><circle cx='20' cy='22' r='9' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M8 16 Q20 4 32 16' fill='none' stroke='#e8b64a' stroke-width='3' stroke-linecap='round'/><path d='M20 31 v6 m-3 -3 l3 3 l3 -3' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>",
  thumb: "<svg viewBox='0 0 40 40'><g transform='translate(0 4)'>" + PHONE + "</g><circle cx='20' cy='20' r='5' fill='#e0453a'/></svg>",
  back: "<svg viewBox='0 0 40 40'><g transform='rotate(35 20 30)'>" + PHONE + "</g><path d='M10 12 Q14 4 22 4' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M10 12 l-1 -5 m1 5 l5 -1' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/></svg>",
  flick: "<svg viewBox='0 0 40 40'><g transform='rotate(-30 20 30)'>" + PHONE + "</g><path d='M28 6 Q36 12 36 22' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M36 22 l-4 -3 m4 3 l2 -4' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M4 10 h6 M3 16 h5 M5 22 h4' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg>",
  // the phone stays upright in every picture, as in play: tilted for a steer, tipped back for a pull, forward to lower
  turn: "<svg viewBox='0 0 40 40'><g transform='translate(0 3)'>" + PHONE + "</g><path d='M10 21 H3 m3 -3 l-3 3 l3 3 M30 21 H37 m-3 -3 l3 3 l-3 3' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  upright: "<svg viewBox='0 0 40 40'><g transform='translate(0 3)'>" + PHONE + "</g><path d='M33 6 V34 m-3 -25 l3 -3 l3 3 m-6 22 l3 3 l3 -3' fill='none' stroke='#e8b64a' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  crank: "<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='12' fill='none' stroke='currentColor' stroke-width='2' stroke-dasharray='3 3'/><circle cx='20' cy='20' r='3' fill='currentColor'/><path d='M20 20 L29 12' stroke='currentColor' stroke-width='3' stroke-linecap='round'/><circle cx='29' cy='12' r='4' fill='#e0453a'/></svg>",
  pull: "<svg viewBox='0 0 40 40'><g transform='translate(3 4) rotate(18 20 30)'>" + PHONE + "</g><path d='M8 24 V6 m-4 4 l4 -4 l4 4' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  low: "<svg viewBox='0 0 40 40'><g transform='translate(-3 4) rotate(-18 20 30)'>" + PHONE + "</g><path d='M32 10 V30 m-4 -4 l4 4 l4 -4' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  ring: "<svg viewBox='0 0 40 40'><ellipse cx='20' cy='24' rx='5' ry='2.2' fill='none' stroke='#e8b64a' stroke-width='2.4'/><ellipse cx='20' cy='24' rx='11' ry='5' fill='none' stroke='#e8b64a' stroke-width='2' opacity='0.7'/><ellipse cx='20' cy='24' rx='17' ry='8' fill='none' stroke='currentColor' stroke-width='1.6' opacity='0.45'/><path d='M20 21 V10 m-3 3 l3 -3 l3 3' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  stop: "<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='14' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M13 13 L27 27' stroke='#ff5a4a' stroke-width='3' stroke-linecap='round'/></svg>",
  fish: "<svg viewBox='0 0 40 40'><path d='M5 20 Q16 8 28 20 Q16 32 5 20 Z M28 20 L36 13 L36 27 Z' fill='#e8b64a'/><circle cx='11' cy='18' r='1.8' fill='#0d2f38'/></svg>",
  swipe: "<svg viewBox='0 0 40 40'><rect x='8' y='6' width='24' height='28' rx='3' fill='none' stroke='currentColor' stroke-width='2.2'/><path d='M20 28 V12 m-5 5 l5 -5 l5 5' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
};

/* ---------------- screens and messages ---------------- */
const SCREENS = ["title", "setup", "help", "journal", "settings", "pause", "catch", "results", "places", "travel", "arrive", "unlock", "about", "privacy"];
let returnTo = null;
let shownAt = 0, tapAt = -1e9, tapShown = false;
function show(id) {
  if (id !== "help") setPullDemo(false);
  shownAt = now();
  tapShown = shownAt - tapAt < 250;
  for (const s of SCREENS) $("#" + s).hidden = s !== id;
  document.body.dataset.screen = id || "";
  // each screen is a dialog: the play controls behind it take no focus and no taps
  for (const s of ["#hud", "#castUI", "#reelUI"]) $(s).inert = !!id;
  if (id === "title") { $("#title").scrollTop = 0; $("#title .title-menu").scrollTop = 0; }
  // a computer: the main button has the focus, for Enter. A phone: the heading, where a screen reader starts to read
  const focus = id && (touchDevice ? $("#" + id + " h1, #" + id + " h2") : $("#" + id + " .btn.go") || $("#" + id + " button"));
  if (focus) { if (touchDevice) focus.tabIndex = -1; focus.focus({ preventScroll: true }); }
  requestAnimationFrame(fades);
}
// A list that scrolls in its card fades at the bottom while more of it is below
const FADES = ["#helpM", "#helpT", "#plist", "#jlist", "#rlist", "#settings .set"];
function fades() { for (const s of FADES) { const el = $(s); el.classList.toggle("more", el.scrollHeight - el.scrollTop > el.clientHeight + 4); } }
for (const s of FADES) $(s).addEventListener("scroll", fades, { passive: true });
addEventListener("resize", () => requestAnimationFrame(fades));
function overlay(id) { returnTo = SCREENS.find((s) => !$("#" + s).hidden) || null; show(id); }
function closeOverlay() { show(returnTo); returnTo = null; }
// the second tap of a double tap must not press the button that the first tap's new screen puts under the finger
// (pointer clicks only: Enter and Space stay instant)
game.addEventListener("click", (e) => {
  if (!(e.detail > 0)) return;
  if (tapShown && now() - shownAt < 300 && e.target.closest && e.target.closest(".screen button, .screen a")) { e.preventDefault(); e.stopPropagation(); return; }
  tapAt = now();
}, true);
for (const b of $$("[data-close]")) b.addEventListener("click", () => { Sound.sfx("uiBack"); closeOverlay(); });

// A toast stays up at least TOAST_MIN ms before the next one takes its place. The next ones wait in a short queue: when it
// is full the oldest waiting toast is dropped (the newest wins), and one that waited TOAST_STALE ms is no news any more.
// The toast that shows, asked for again, shows again from the start.
// onShow runs when the toast is on screen (a one-time tip is marked seen then, not when it was asked for)
// keep: news that must show (a catch's news). The queue never drops it, and slow frames that hold the queue up do not
// make it stale
const TOAST_MIN = 1200, TOAST_QUEUE = 2, TOAST_STALE = 3000;
let toastT = 0, toastNextT = 0, toastAt = -1e9;
const toastQ = [];
function toast(msg, ms = 2200, onShow = null, keep = false) {
  if (cuts && cuts.playing) { heldToasts.push([msg, ms, onShow, keep]); return; }
  const t = $("#toast"), up = now() - toastAt;
  if (t.classList.contains("on") && up < TOAST_MIN) {
    // the same news again (a second gold ring) keeps the shown toast up for its full time; it is not news to queue
    if (t.textContent === msg) { showToast(msg, ms, onShow); return; }
    if (toastQ.some((q) => q.msg === msg)) return;
    toastQ.push({ msg, ms, onShow, keep, at: now() });
    if (toastQ.length > TOAST_QUEUE) { const i = toastQ.findIndex((q) => !q.keep); if (i >= 0) toastQ.splice(i, 1); }
    if (!toastNextT) toastNextT = setTimeout(nextToast, TOAST_MIN - up);
    return;
  }
  showToast(msg, ms, onShow);
}
function showToast(msg, ms, onShow) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  toastAt = now();
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), ms);
  if (onShow) onShow();
}
function nextToast() {
  toastNextT = 0;
  // the shown toast was asked for again: it keeps its full TOAST_MIN
  const up = now() - toastAt;
  if (up < TOAST_MIN - 5) { toastNextT = setTimeout(nextToast, TOAST_MIN - up); return; }
  while (toastQ.length && !toastQ[0].keep && now() - toastQ[0].at > TOAST_STALE) toastQ.shift();
  const q = toastQ.shift();
  if (!q) return;
  showToast(q.msg, q.ms, q.onShow);
  if (toastQ.length) toastNextT = setTimeout(nextToast, TOAST_MIN);
}
let promptKey = "";
function prompt(text, sub = "", icon = "", tone = "") {
  guideCue = { text, sub, icon, tone };
  const p = $("#prompt");
  if (!text) { p.hidden = true; promptKey = ""; return; }
  const key = text + "|" + sub + "|" + icon + "|" + tone;
  p.hidden = false;
  if (key === promptKey) return;
  promptKey = key;
  // a hot prompt glows once when it changes: start its animation again
  if (tone === "hot" && p.classList.contains("hot")) { p.className = ""; void p.querySelector(".p1").offsetWidth; }
  p.className = tone;
  p.querySelector(".p1").innerHTML = (ICON[icon] || "") + "<span></span>";
  p.querySelector(".p1 span").textContent = text;
  p.querySelector(".p2").textContent = sub;
  say(text);
}
// The prompt's headline for screen readers (#say, a polite live region): each new one, at most every 1.5 s. One that
// comes sooner waits its turn, and a newer one takes its place
let sayAt = -1e9, sayT = 0;
function say(text) {
  clearTimeout(sayT);
  const el = $("#say"), wait = sayAt + 1500 - now();
  if (!text || text === el.textContent) return;
  if (wait > 0) { sayT = setTimeout(() => say(text), wait); return; }
  sayAt = now();
  el.textContent = text;
}
// The big words of the hook set in the prompt's place: "Fish on!", and sub under it ("Quick set!"), for ms. The prompt
// shows again after it
let bannerT = 0;
function banner(text, sub = "", ms = 900) {
  const b = $("#banner");
  clearTimeout(bannerT);
  b.hidden = true; void b.offsetWidth;
  b.querySelector("b").textContent = text;
  b.querySelector("span").textContent = sub;
  b.hidden = !text;
  if (text) bannerT = setTimeout(() => { b.hidden = true; }, ms);
}
// kind "photo" is the white camera flash of a trophy; the strike and the loss flash red. Calm effects: no flash
function flash(kind = "") { if (isCalm()) return; const f = $("#flash"); f.classList.remove("go"); f.classList.toggle("photo", kind === "photo"); void f.offsetWidth; f.classList.add("go"); }
let reportT = 0;
// cue: the short word at the release itself ("Sweet!"), before the lure lands; ms: how long it stays
function report(dist, verdict, zoneName, sweet, cue = false, ms = 2600) {
  const r = $("#report");
  r.hidden = false;
  r.querySelector(".dist").innerHTML = dist == null ? "" : dist.toFixed(1) + "<small> m</small>";
  const v = r.querySelector(".verdict");
  v.textContent = verdict;
  v.className = "verdict" + (sweet ? " sweet" : "");
  r.querySelector(".zone").textContent = zoneName || "";
  r.classList.toggle("cue", cue);
  r.classList.remove("show"); void r.offsetWidth; r.classList.add("show");
  clearTimeout(reportT);
  reportT = setTimeout(() => { r.hidden = true; }, ms);
}
// The report's second line: the first that has something to say. ctx: { dist, verdict, ring, nearMiss (its line), zone
// (its name), best (the longest cast yet), farther (a short cast by a new player), stroke (castParams), motion, key (Space) }
function reportNote(c) {
  if (c.streak) return c.streak;
  if (c.ring) return c.ring.gold ? "Right in the gold ring!" : "Right on the rising fish!";
  if (c.nearMiss) return c.nearMiss;
  // the goal hint (goals.js progressNote): big fish live far out
  if (c.progress) return c.progress;
  // a good release with a short back cast: the distance was in the back cast
  if (c.verdict === "sweet" && c.stroke < 0.85) return c.motion ? "Tip back farther for more distance." : "Drag down farther for more distance.";
  // at Loon the big fish live farther out; a new player with short casts is told so
  if (c.farther) return "Farther out, the fish are bigger.";
  if (c.best) return "Your longest cast yet!";
  return c.zone || "";
}
// a ring missed by up to 12 m: how far, and which way, along the cast's own heading
function nearMissText(g, x, z, yaw) {
  const a = yaw * Math.PI / 180, dx = g.x - x, dz = g.z - z;
  const along = dx * Math.sin(a) - dz * Math.cos(a), side = dx * Math.cos(a) + dz * Math.sin(a);
  const ring = g.gold ? "the gold ring" : "the ring", n = (v) => Math.max(1, Math.round(Math.abs(v))) + " m ";
  if (Math.abs(along) >= Math.abs(side)) return n(along) + (along > 0 ? "short of " : "past ") + ring + ".";
  return n(side) + (side > 0 ? "left of " : "right of ") + ring + ".";
}
const hideReport = () => { $("#report").hidden = true; };
const fmtHour = (h) => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return ((hh + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0") + (hh < 12 ? " AM" : " PM"); };
// the time on the catch photo: 21:14
const fmtClock = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };

/* ---------------- layout and orientation ---------------- */
// With the sensors on, the phone stays upright from the cast to the catch: its top edge is the rod. If the browser
// turns the page anyway (rotation lock off, a steering tilt), we turn #game back, so the picture never flips.
// the sensors drive the rod once the player chose motion and the phone sends data. A short gap in the samples
// (a slow frame) must not hand the rod to the touch fallback, or the pose would jump
const sensing = () => G.input === "motion" && (Motion.live || Motion.status === "granted");
function screenAngle() {
  let a = 0;
  if (screen.orientation && typeof screen.orientation.angle === "number") a = screen.orientation.angle;
  else if (typeof window.orientation === "number") a = window.orientation;
  a = ((a % 360) + 360) % 360;
  return a === 90 ? 90 : a === 270 ? -90 : a === 180 ? 180 : 0;
}
function wantedRotation() {
  if (!sensing() || !touchDevice) return 0;
  let r = -screenAngle();
  r = ((r + 540) % 360) - 180;
  return r === 90 || r === -90 ? r : 0;
}
function applyRotation(rot) {
  const W = innerWidth, H = innerHeight;
  // the same angle still needs a new size when the viewport changed (a toolbar, leaving full screen)
  if (rot === G.rot && (!rot || (G.rotW === W && G.rotH === H))) return;
  G.rot = rot; G.rotW = W; G.rotH = H;
  if (rot) Object.assign(game.style, { width: H + "px", height: W + "px", left: (W - H) / 2 + "px", top: (H - W) / 2 + "px", transform: "rotate(" + rot + "deg)" });
  else Object.assign(game.style, { width: "", height: "", left: "", top: "", transform: "" });
  // the notch and the home bar turn with the picture: swap the safe-area insets to match
  const st = game.style, E = (k) => "env(safe-area-inset-" + k + ", 0px)";
  if (rot === 90) { st.setProperty("--sat", E("right")); st.setProperty("--sar", E("bottom")); st.setProperty("--sab", E("left")); st.setProperty("--sal", E("top")); }
  else if (rot === -90) { st.setProperty("--sat", E("left")); st.setProperty("--sar", E("top")); st.setProperty("--sab", E("right")); st.setProperty("--sal", E("bottom")); }
  else for (const k of ["--sat", "--sar", "--sab", "--sal"]) st.removeProperty(k);
  G.layout = "";
}
// client (screen) coordinates to the unrotated CSS pixels of el (or of #game)
function toLocal(cx, cy, el) {
  let x = cx, y = cy;
  if (G.rot) {
    const W = innerWidth, H = innerHeight, Lw = H, Lh = W, dx = cx - W / 2, dy = cy - H / 2;
    if (G.rot === 90) { x = dy + Lw / 2; y = Lh / 2 - dx; } else { x = Lw / 2 - dy; y = dx + Lh / 2; }
  }
  for (let e = el; e && e !== game && e !== document.body; e = e.offsetParent) { x -= e.offsetLeft; y -= e.offsetTop; }
  return { x, y };
}
function layoutFor(phase) {
  const Lw = game.clientWidth, Lh = game.clientHeight;
  G.wide = Lw > Lh * 1.15;
  if (phase === "cast") return G.wide ? "wide-cast" : "tall-cast";
  if (phase === "reel" || phase === "lost") return G.wide ? "reel" : "tall-reel";
  if (phase === "catch") return G.wide ? "reel" : "full";
  return "full";
}
function relayout(force) {
  applyRotation(wantedRotation());
  const L = layoutFor(G.phase);
  const flying = G.phase === "cast" && G.step === "flight";
  if (!force && L === G.layout && game.classList.contains("flying") === flying && G.vw === innerWidth && G.vh === innerHeight) return;
  G.vw = innerWidth; G.vh = innerHeight;
  G.layout = L;
  game.className = "l-" + L + (flying ? " flying" : "") + (G.input === "motion" ? " motion" : " touch");
  const inCast = L === "tall-cast" || L === "wide-cast";
  $("#castUI").hidden = !(inCast && G.phase === "cast");
  $("#reelUI").hidden = !((G.phase === "reel" || G.phase === "lost") && (L === "reel" || L === "tall-reel"));
  // the view animates its size: resize the drawing once it settles (transitionend), not at every step on the way
  if (!$("#view").getAnimations().length) resizeView();
  setTimeout(resizeView, 380);
  if (reelPanel) reelPanel.resize();
  // a hidden box is 0 by 0: leave the reel controls as they are until they show
  if (!$("#reelUI").hidden) for (const w of [crank, rodPad, gauge]) if (w && w.resize) w.resize();
}
function resizeView() {
  if (!world) return;
  const v = $("#view");
  world.resize(Math.max(1, v.clientWidth), Math.max(1, v.clientHeight));
  // a resize clears the canvas: a still lake must be drawn again
  G.stillDrawn = false;
}
addEventListener("resize", () => { G.layout = ""; relayout(true); });
if (screen.orientation) screen.orientation.addEventListener("change", () => { G.layout = ""; setTimeout(() => relayout(true), 60); });

/* ---------------- setup: motion or touch ---------------- */
function inputReady() { return G.input === "touch" || (G.input === "motion" && (Motion.status === "granted" || Motion.live)); }
async function chooseInput(then) {
  // desktop, or a browser with no motion sensors: touch and mouse
  if (!touchDevice || !Motion.available) { G.input = "touch"; then(); return; }
  if (save.input === "touch") { G.input = "touch"; then(); return; }
  if (save.input === "motion") {
    // a returning player: ask again inside this tap (iOS forgets between visits)
    const req = Motion.request();
    const st = await req;
    if (st === "granted") { G.input = "motion"; lockPortrait(); then(); return; }
  }
  $("#setupNote").hidden = true;
  $("#useMotion").hidden = false;
  overlay("setup");
  setupThen = then;
}
let setupThen = null;
$("#useMotion").addEventListener("click", async () => {
  Sound.init(); Haptics.unlock();
  Sound.sfx("ui");
  const req = Motion.request();
  const st = await req;
  if (st === "granted") {
    G.input = "motion"; save.input = "motion"; persist();
    lockPortrait();
    show(null);
    const f = setupThen; setupThen = null; if (f) f();
    return;
  }
  const note = $("#setupNote");
  note.hidden = false;
  // "idle": the browser wants the question asked from a tap. Let them tap again
  if (st === "idle") { note.textContent = "Tap Use motion again."; return; }
  // the app: the web view grants motion itself, so a refusal has no setting to point to. Play with touch now
  if (st === "denied" && Native.isStore) {
    note.hidden = true;
    G.input = "touch"; save.input = "touch"; persist();
    show(null);
    const f = setupThen; setupThen = null; if (f) f();
    // after the start, so the goal reminder does not cover it
    toast("Motion is off. You can play with touch.", 5200);
    return;
  }
  note.textContent = st === "denied"
    ? "The motion sensors are off for this page. On an iPhone, close Safari fully (swipe it away), then open this page again and tap Allow. On Android, allow Motion sensors in the site settings. You can play with touch now."
    : "This phone sends no motion data. You can play with touch.";
  $("#useMotion").hidden = true;
});
$("#useTouch").addEventListener("click", () => {
  Sound.init(); Haptics.unlock(); Sound.sfx("ui");
  G.input = "touch"; save.input = "touch"; persist();
  show(null);
  const f = setupThen; setupThen = null; if (f) f();
});

// Fullscreen is an explicit choice for this visit. Motion play in a browser window
// stays upright through wantedRotation(), without triggering Android's fullscreen notice.
function lockPortrait() {
  if (!touchDevice || G.input !== "motion" || !document.fullscreenElement || !screen.orientation?.lock) return;
  try { screen.orientation.lock("portrait").catch(() => {}); } catch (e) { /* use the layout fallback */ }
}
const fullscreenButtons = $$("[data-fullscreen]");
let fullscreenBusy = false;
function syncFullscreen() {
  const active = !!document.fullscreenElement;
  for (const b of fullscreenButtons) {
    b.hidden = !active && !(document.fullscreenEnabled && document.documentElement.requestFullscreen);
    b.disabled = fullscreenBusy;
    b.textContent = active ? "Exit fullscreen" : "Fullscreen";
  }
}
for (const b of fullscreenButtons) b.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (fullscreenBusy) return;
  fullscreenBusy = true;
  syncFullscreen();
  const exiting = !!document.fullscreenElement;
  try {
    if (exiting) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      lockPortrait();
    }
  } catch (e) {
    toast(exiting ? "Use your browser's fullscreen control to exit." : "Fullscreen is unavailable. Keep playing in this window.");
  } finally {
    fullscreenBusy = false;
    syncFullscreen();
    relayout(true);
  }
});
document.addEventListener("fullscreenchange", () => { syncFullscreen(); relayout(true); });
syncFullscreen();

/* ---------------- wake lock: the screen must not sleep while you wait for a bite ---------------- */
// wakeBusy: a request is on its way. begin() and startMode() both ask in the same tick, and the second must not start a lock that nothing releases
let wake = null, wakeBusy = false;
async function keepAwake() {
  // the app keeps the screen on with its own plugin (a web view may have no wake lock)
  if (document.visibilityState === "visible") Native.keepAwake(true);
  if (!("wakeLock" in navigator) || wake || wakeBusy || document.visibilityState !== "visible") return;
  wakeBusy = true;
  try { const lock = await navigator.wakeLock.request("screen"); wake = lock; lock.addEventListener("release", () => { if (wake === lock) wake = null; }); } catch (e) { wake = null; } finally { wakeBusy = false; }
}
// a phone left paused on the table must be free to sleep
function releaseAwake() { Native.keepAwake(false); if (wake) { wake.release().catch(() => {}); wake = null; } }

/* ---------------- title ---------------- */
// leave the play screens: the state of the session is gone, the lake is empty
function stopPlay() {
  releaseAwake();
  G.phase = "title";
  G.sim = null; G.flight = null; G.big = null; G.walk = false; G.pendingUnlock = null;
  $("#hud").hidden = true;
  prompt("");
  hideReport();
  clearTimeout(cardT); clearInterval(countT); clearInterval(resT); banner("");
  if (world) { world.hideCatch(); world.setLure({ x: 0, y: -5, z: 0, visible: false }); world.setLine({ visible: false }); world.setFish(null); world.setFollower(null); world.setAim({ visible: false }); world.setRod({ theta: 70, yaw: 0, visible: false }); }
  Sound.stopLoops(); Haptics.stop();
}
function toTitle() {
  stopPlay();
  // the title shows the place at its free-fishing hour: the postcard of the place
  G.hour = startHour(G.place.id, "free");
  if (world) world.setHour(G.hour);
  Sound.setAmbience(true, G.hour);
  // the arcade's name is for the web arcade only: the app shows the place alone
  $("#tkick").textContent = (Native.isStore ? "" : "GET PLUNGER'D · ") + journeyOf(G.place.id).kick;   // web only
  $("#placesNew").hidden = !newPlaces(save).length;
  show("title");
  titleBest();
  relayout(true);
  // a native save that came late, with more in it: the game starts again with it now
  takeComeback();
}
// "Here: best derby 18.4 kg · biggest Channel Catfish 7.2 kg", then what to do next, then today's goal
function titleBest() {
  const id = G.place.id, e = placeRec(save, id);
  const bits = [];
  if (e && e.d > 0) bits.push("best derby " + fmtKg(e.d));
  const sp = e && e.id && byId(e.id);
  if (sp && e.kg > 0) bits.push("biggest " + sp.name + " " + fmtKg(e.kg));
  const lines = [];
  if (bits.length) lines.push("Here: " + bits.join(" · "));
  // the goal that opens the next place, a legend, a goal here, the next rank, the journal (goals.js nextGoal)
  lines.push(nextGoal(save, id, OPEN_ALL) || (legendsLanded(save) >= ORDER.length ? "You landed every legend." : save.longest > 0 ? "Longest cast " + save.longest.toFixed(1) + " m" : ""));
  $("#tbest").textContent = lines.filter(Boolean).join("\n");
  $("#tday").textContent = todayLine(save, today());
}
function begin(mode) {
  Sound.init(); Haptics.unlock(); keepAwake();
  Sound.sfx("ui");
  // the first "Go fishing" on a fresh save: the opening at Loon Lake, then the cast
  chooseInput(() => (mode === "free" && openingDue() ? (show(null), playCut(openingCut(G.place), () => startMode(mode))) : startMode(mode)));
}
$("#derbyBtn").addEventListener("click", () => begin("derby"));
$("#freeBtn").addEventListener("click", () => begin("free"));
$("#journalBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); renderJournal(); overlay("journal"); });
$("#helpBtn").addEventListener("click", openHelp);
$("#setBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); syncSettings(); overlay("settings"); });
$("#placesBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); renderPlaces(); overlay("places"); });

// the goal of the place you are at, while the next place is still locked ("" when there is nothing to say)
function goalLine(kind) {
  const nx = nextPlace(G.place.id);
  return nx && !openNow(nx) ? goalText(G.place.id, kind) : "";
}
function startMode(mode) {
  keepAwake();
  G.mode = mode;
  G.casts = 0; G.castsLeft = mode === "derby" ? 10 : Infinity; G.bag = []; G.unlocked = [];
  G.hour = startHour(G.place.id, mode);
  if (world) world.setHour(G.hour);
  G.seed = (Math.random() * 1e9) | 0;
  rises = new Rises(LAKE.rng(G.seed), G.place);
  G.goldAt = null;
  G.paused = false;
  show(null);
  $("#hud").hidden = false;
  Sound.setAmbience(true, G.hour);
  const goal = goalLine("remind");
  if (goal) toast(goal, 3600);
  newCast(true);
}

/* ---------------- the places ---------------- */
// one small picture for each place: the dock, the stumps, the river and the rock with a gull
const PLACE_ICON = {
  loon: "<svg viewBox='0 0 48 48'><circle cx='36' cy='12' r='4.5' fill='#f0c060'/><path d='M3 29 H45 V45 H3Z' fill='#2f7f92'/><path d='M7 35 q4 -3 8 0 t8 0 t8 0 t8 0' fill='none' stroke='#9fd2dc' stroke-width='1.6'/><rect x='3' y='24' width='27' height='4.5' rx='1' fill='#b98346'/><rect x='7' y='28' width='3' height='12' fill='#7a5228'/><rect x='22' y='28' width='3' height='12' fill='#7a5228'/><ellipse cx='38' cy='33' rx='5' ry='2.6' fill='#20272b'/><circle cx='42' cy='30' r='1.8' fill='#20272b'/></svg>",
  stumps: "<svg viewBox='0 0 48 48'><rect width='48' height='48' fill='#1a2a4a'/><circle cx='34' cy='12' r='5.5' fill='#dfe6ff'/><circle cx='37' cy='10.5' r='5' fill='#1a2a4a'/><path d='M3 30 H45 V45 H3Z' fill='#16180e'/><path d='M9 42 V22 l4 -3 l4 3 V42Z' fill='#6a5230'/><path d='M27 42 V17 l3 -2 l4 2 V42Z' fill='#6a5230'/><path d='M19 42 V31 h5 V42Z' fill='#5a4326'/><path d='M5 39 q4 -2 8 0 t8 0 t8 0 t8 0' fill='none' stroke='#5c6a44' stroke-width='1.4'/></svg>",
  river: "<svg viewBox='0 0 48 48'><rect width='48' height='48' fill='#3a5a5a'/><path d='M3 15 q6 -6 12 0 t12 0 t12 0' fill='none' stroke='#9fd2cc' stroke-width='2.2' stroke-linecap='round'/><path d='M3 26 q6 -6 12 0 t12 0 t12 0' fill='none' stroke='#7cc2cc' stroke-width='2.2' stroke-linecap='round'/><path d='M3 37 q6 -6 12 0 t12 0 t12 0' fill='none' stroke='#9fd2cc' stroke-width='2.2' stroke-linecap='round'/><path d='M30 5 q11 0 11 11 q-11 0 -11 -11Z' fill='#d8742a'/></svg>",
  sea: "<svg viewBox='0 0 48 48'><rect width='48' height='48' fill='#2a5a68'/><path d='M6 44 L14 27 L26 23 L38 29 L44 44Z' fill='#9096a0'/><path d='M14 27 L26 23 L38 29 L30 32Z' fill='#b8bec6'/><path d='M3 41 q5 -4 10 0 t10 0 t10 0 t10 0' fill='none' stroke='#8fd0dc' stroke-width='1.8'/><path d='M14 11 q4 -5 8 0 q4 -5 8 0' fill='none' stroke='#f6efd9' stroke-width='2.4' stroke-linecap='round'/></svg>",
};
// how far the player got with a place's legend: 0 not seen, 1 its gold ring seen, 2 hooked, 3 landed
function legendStepOf(id) {
  const e = save.places[id], j = save.journal[fishingOf(id).legend.id];
  return j && j.n > 0 ? 3 : e ? e.lg : 0;
}
function renderPlaces() {
  const list = $("#plist");
  list.innerHTML = "";
  const lock = ORDER.find((id) => !openNow(id));
  for (const id of ORDER) {
    const J = JOURNEY[id], open = openNow(id), here = id === G.place.id, rec = save.places[id] || { d: 0, kg: 0 };
    const li = document.createElement("li");
    li.className = "pcard" + (here ? " here" : "") + (open ? "" : " locked");
    li.dataset.place = id;
    li.dataset.state = !open ? (id === lock ? "next" : "locked") : here ? "here" : "open";
    const ic = document.createElement("div"), body = document.createElement("div");
    ic.className = "ic"; ic.innerHTML = PLACE_ICON[id];
    const h = document.createElement("h3"), lvl = document.createElement("span");
    lvl.className = "lvl"; lvl.textContent = J.level;
    h.append(J.name + " ", lvl);
    body.appendChild(h);
    const para = (t, cls) => { const p = document.createElement("p"); if (cls) p.className = cls; p.textContent = t; body.appendChild(p); return p; };
    if (open) {
      para(J.blurb);
      const facts = document.createElement("div"), f = foundHere(save, id);
      facts.className = "facts";
      for (const t of ["Line: " + fishingOf(id).gear.line, "Top fish: " + topFish(id).name, f.n + " of " + f.m + " found", "Best derby " + (rec.d > 0 ? fmtKg(rec.d) + " · " + rankFor(id, rec.d) : "none yet"), "Legend: " + LEGEND_STEPS[legendStepOf(id)]]) {
        const d = document.createElement("div"); d.textContent = t; facts.appendChild(d);
      }
      body.appendChild(facts);
      // the six goals of the place, with the ones done checked (open at the place you are at)
      const gl = PLACE_GOALS[id], gb = rec.g || 0, det = document.createElement("details"), sum = document.createElement("summary"), ul = document.createElement("ul");
      det.className = "goals"; det.open = here;
      sum.textContent = "Goals: " + goalCount(gb) + " of " + gl.length;
      gl.forEach((g, i) => { const li = document.createElement("li"); li.textContent = g.text; if ((gb >> i) & 1) li.className = "done"; ul.appendChild(li); });
      det.append(sum, ul);
      body.appendChild(det);
      const b = document.createElement("button");
      b.type = "button"; b.className = here ? "btn alt" : "btn go"; b.disabled = here;
      b.textContent = here ? "You are here" : "Fish here";
      b.addEventListener("click", () => { Sound.sfx("ui"); travelTo(id); });
      body.appendChild(b);
      // the place's arrival and its legend's reveal, again, once seen
      if ([arriveId(id), revealId(id)].some(cutSeen)) {
        const w = document.createElement("button");
        w.type = "button"; w.className = "btn alt watch"; w.textContent = "Watch";
        w.setAttribute("aria-label", "Watch " + J.name + " again");
        w.addEventListener("click", () => { Sound.sfx("ui"); watch(id); });
        body.appendChild(w);
      }
    } else if (id === lock) {
      const from = prevPlace(id), best = (save.places[from] || {}).kg || 0;
      para(goalText(from, "card"));
      para("Your best there: " + (best > 0 ? fmtKg(best) : "none yet") + ".");
    } else para("Open " + JOURNEY[prevPlace(id)].name + " first.");
    li.append(ic, body);
    list.appendChild(li);
  }
  $("#pfoot").textContent = "Legends landed: " + legendsLanded(save) + " of " + ORDER.length;
}

/* ---------------- travel ---------------- */
// The core of a trip: the map, the drawing and the sound move to place id. Resolves to the place, or to null when it
// did not load (then Loon Lake is back).
async function switchPlace(id) {
  const p = getPlace(id);
  try {
    LAKE.setPlace(p);
    G.place = p;
    // a failure here (or in the world build) is the same as a load error: back to Loon Lake
    await world.setPlace(p);
    Sound.setPlace(p.id);
  } catch (err) {
    console.error(err);
    LAKE.setPlace(PLACES.loon);
    G.place = PLACES.loon;
    try { await world.setPlace(PLACES.loon); } catch (err2) { console.error(err2); }
    Sound.setPlace("loon");
    G.stillDrawn = false;
    markPlace();
    return null;
  }
  // the dimmed screens over the lake draw it once: draw the new place
  G.stillDrawn = false;
  markPlace();
  return p;
}
// the painted title's picture is of Loon Lake, so the title shows it only there (style.css). At another place the live
// lake shows behind the title, as in the Original style
const markPlace = () => { document.body.dataset.place = G.place.id; };
let traveling = false;
// A trip from the places screen, the unlock card or the results. A card covers the load, and it stays up for 1.2 s at
// least, so the wait reads as a trip and not as a glitch.
async function travelTo(id) {
  if (traveling || !openNow(id)) return;
  if (id === G.place.id) { toTitle(); return; }
  traveling = true;
  stopPlay();
  $("#travelTxt").textContent = "On the way to " + JOURNEY[id].name + ".";
  show("travel");
  const t0 = now();
  const p = await switchPlace(id);
  const left = 1200 - (now() - t0);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  traveling = false;
  if (!p) {
    save.place = "loon"; persist();
    toTitle();
    toast(JOURNEY[id].name + " did not load. Back to Loon Lake.", 3600);
    return;
  }
  // ?open must never save a place the player has not earned
  if (isOpen(save, id)) { save.place = id; persist(); }
  if (id !== "loon" && !save.seen["at." + id]) flyIn(id, () => arrival(id));
  else toTitle();
}
// the first visit: where you are, what is new, and one tip
function arrival(id) {
  const J = JOURNEY[id];
  seen("at." + id);
  $("#akick").textContent = "NEW PLACE · " + J.level.toUpperCase();
  $("#aname").textContent = J.name;
  $("#ablurb").textContent = J.blurb;
  $("#agear").textContent = "New gear: " + J.gear.charAt(0).toLowerCase() + J.gear.slice(1);
  $("#atip").textContent = J.tip;
  $("#atip").hidden = !J.tip;
  G.phase = "title";
  show("arrive");
}
// Start goes to the water: free fishing at the new place (it asks for motion or touch first when it needs to)
$("#aStart").addEventListener("click", () => begin("free"));

/* ---------------- a fish opens the next place ---------------- */
function unlockCard(id) {
  seen("opened." + id);
  G.unlockId = id;
  $("#uname").textContent = JOURNEY[id].name + " is open!";
  $("#ublurb").textContent = JOURNEY[id].blurb;
  show("unlock");
  // a horn call and the new place's own sound, and a buzz; the card rises in and its badge stamps on (index.html)
  Sound.sfx("newPlace", ORDER.indexOf(id)); Haptics.land(1);
}
$("#uGo").addEventListener("click", () => { Sound.sfx("ui"); travelTo(G.unlockId); });
$("#uStay").addEventListener("click", () => { Sound.sfx("uiBack"); show(null); nextAfterOutcome(); });

/* ---------------- the cast ---------------- */
function newCast(first) {
  if (G.mode === "derby" && G.castsLeft <= 0) { endDerby(); return; }
  // the cast before landed on the shore: its report (what to fix in the release) stays up its own time, over the new cast
  const ashore = !first && G.phase === "cast" && G.step === "ashore";
  G.sim = null; G.flight = null; G.cast = null; G.landing = null; G.ring = null;
  G.step = "ready"; G.bail = "closed"; G.pin = null; G.drop = 0; G.backMax = 90;
  G.aimYaw = 0; G.tension = 0;
  if (world) { world.hideCatch(); world.setFish(null); world.setFollower(null); }
  if (!ashore) hideReport();
  enterCast();
}
function enterCast() {
  G.phase = "cast";
  Motion.mode = "portrait";
  // the heading counts from where you face now: turn to aim from here
  Motion.recenter();
  show(null);
  relayout(true);
  updateHud();
}
function openBail(how) {
  if (G.bail === "open") return;
  G.bail = "open";
  G.openAt = now();
  Sound.sfx("bailOpen"); Haptics.bail(true);
  if (G.phase === "cast" && G.step === "ready") G.step = "open";
  seen("bail");
}
function closeBail() {
  if (G.bail === "closed") return;
  G.bail = "closed";
  Sound.sfx("bailClose"); Haptics.bail(false);
  if (G.phase === "cast" && (G.step === "open" || G.step === "pinned" || G.step === "loaded")) { G.step = "ready"; G.pin = null; }
}
// the line came off the thumb with no cast: the bail snaps shut and the lure hangs ready again. The press that ended the
// beat before this cast (G.pinSkip) may have been only that: it gets no tip
function resetCast(msg) {
  G.pin = null; G.lift = null; G.step = "ready"; G.drop = 0; G.strokeAt = 0;
  if (G.bail === "open") { G.bail = "closed"; Sound.sfx("bailClose"); Haptics.bail(false); }
  if (msg && !G.pinSkip) toast(msg, 3000);
}
function pinLine(e) {
  if (G.phase !== "cast") return;
  if (G.step === "flight") { G.pin = { id: e.id, y0: e.y, theta: 90, feather: true }; return; }
  if (G.pin || (G.step !== "ready" && G.step !== "open")) return;
  // one press does both: the thumb flips the bail open and holds the line
  if (G.bail !== "open") openBail("pin");
  // 80: the rod angle pinmove gives a finger that has not moved, so a small wobble is no flick.
  // x0: where the finger came down (the touch rail stands beside it); turn: which way the screen faced; span: the drag
  // that turns the rod, shorter for a finger low on the screen (touchSpanAt), so a press anywhere can load the rod. A hold
  // cast (the mouse, Space) keeps the full span: the clock moves its rod
  G.pin = { id: e.id, x0: e.x, y0: e.y, theta: 80, turn: screenAngle(), span: e.hold || e.id === "key" ? touchSpan(game.clientHeight) : touchSpanAt(game.clientHeight, e.y) };
  // a mouse button held still: the hold cast, timed from now like Space (keyTheta)
  if (e.hold) G.pin.key = e.t || now();
  // the press that ended the beat before this cast, gone on to take the line
  G.pinSkip = G.skip != null && e.id === G.skip;
  G.step = "pinned";
  G.strokeAt = 0;
  G.backMax = Motion.pose.theta;
  G.drop = Math.min(G.drop, 1.2);
  Sound.sfx("pin"); Haptics.tick();
  // the motor shakes the gyro: keep still until the line is released
  if (G.input === "motion") Haptics.mute(4000);
}
function unpinLine(e) {
  if (!G.pin || (e.id != null && G.pin.id != null && e.id !== G.pin.id)) return;
  // a held mouse button comes up: graded like Space, at the rod angle now. A cancel (the page lost the focus) casts nothing
  if (G.pin.key && !G.pin.feather) { if (e.cancel) resetCast(); else keyCast(); return; }
  const pin = G.pin;
  G.pin = null;
  if (pin.feather || G.phase !== "cast") return;
  Haptics.mute(0);
  if (G.step !== "pinned" && G.step !== "loaded") return;
  // the browser took the touch away: a fumble, not a cast. The page turning is one cause; a system gesture is another
  if (e.cancel) { Sound.sfx("slip"); resetCast(touchDevice && pin.turn !== screenAngle() ? "The screen turned. Turn on the rotation lock." : "The line slipped. Try again."); return; }
  // with sensors, the exact input time of the lift matters
  if (sensing()) { release(e.t || now()); return; }
  // a press that only went up (a stray swipe) never tipped the rod back: nothing flies, and no derby cast is used up
  if (!(pin.back >= TOUCH.REST + 4)) { resetCast("Drag down first."); return; }
  // with a finger, the cast is graded where the finger lifts: its rod angle, however long it rested before the lift
  const theta = e.y != null ? touchTheta(e.y - pin.y0, pin.span) : pin.theta, t = now();
  Motion.virtual({ t, theta, yaw: G.aimYaw, roll: 0 });
  release(t, false, { theta });
}
// A forward stroke that ends with the thumb still down: the rod swung past the water, or stopped at 10 o'clock
// and stayed there. It casts anyway, late and low, so a throw is never lost to a thumb that forgot to lift
// Only a loaded rod counts (a quick dip to read the screen is no cast), and only once the swing has slowed for a
// while: a lift up to about 90 ms after 11 o'clock still grades as a good cast, so the game must not beat it
function strokeEnded(pose, t) {
  if (!G.pin || G.pin.feather || (G.step !== "pinned" && G.step !== "loaded")) return false;
  const fwd = -pose.omega;
  if (fwd > 250) G.strokeAt = t;
  if (!G.strokeAt || G.step !== "loaded" || G.backMax - pose.theta < 30) return false;
  return t - G.strokeAt > (sensing() ? 120 : 400) && (pose.theta < 35 || fwd < 60);
}
// the rod loads over the shoulder, where the player cannot see the screen: a short tap gets through the mute
function loadTap() { if (sensing()) { Haptics.mute(0); Haptics.load(); Haptics.mute(3000); } else Haptics.load(); }
// The rod tips back: past LOAD_THETA it loads (a creak and a tap), and when it is back far enough for full power (BACK_FULL
// past the ideal release) it creaks and taps again
function loadCheck(theta) {
  if (G.step === "pinned" && theta >= CAST.LOAD_THETA) { G.step = "loaded"; Sound.sfx("load"); loadTap(); }
  if (G.step === "loaded" && G.pin && !G.pin.full && theta >= CAST.IDEAL_RELEASE + CAST.BACK_FULL) { G.pin.full = true; Sound.sfx("load"); loadTap(); }
}
// the finger comes off the line: was it a cast, or did the line just slip?
// held: the rod swung through with the thumb still down. It still casts, low, so the throw is never lost.
// finger: touch, mouse and keys grade the release at the finger: { theta } (the rod angle there), and fwd for the keys
function release(t, held = false, finger = null) {
  Haptics.mute(0);
  // a motion lift before the rod reached 11 o'clock: the launch waits for the samples that show when it got there
  // (up to RELEASE.WAIT_MS; frameLift() finishes it). The line still leaves the thumb now
  if (sensing() && !held && Motion.at(t).theta >= CAST.IDEAL_RELEASE) { G.lift = { t }; Sound.sfx("release"); return; }
  launch(t, t, held, finger);
}
// a lift that is waiting for the crossing: launch on the first sample past it, or when the wait is over
function frameLift(sampleT) {
  const L = G.lift;
  if (!L) return;
  if (G.phase !== "cast" || now() - L.t > 400) { G.lift = null; resetCast(); return; }   // stale: a pause came between
  const end = L.t + RELEASE.WAIT_MS;
  if (sampleT != null && Motion.at(sampleT).theta < CAST.IDEAL_RELEASE) launch(L.t, Math.min(sampleT, end), false, null, true);
  else if (now() >= end) launch(L.t, end, false, null, true);
}
function launch(t, tEnd, held, finger, sounded = false) {
  G.lift = null;
  const m = sensing();
  const s = Motion.at(tEnd);
  const pk = Motion.peak(t - RELEASE.LOOK_MS, tEnd);
  // the swing square to the rod: a thumb grip rolls the screen, and the pitch rate alone reads it short
  const fwd = finger && finger.fwd ? finger.fwd : Math.max(0, -(pk.minSwing != null ? pk.minSwing : pk.minOmega), -s.omega);
  const back = Math.max(G.backMax, pk.maxTheta);
  // hand tremor alone reaches 20 to 40 deg/s: a motion release needs a real swing
  const minSpeed = m ? Math.max(150, CAST.MIN_STROKE_SPEED || 0) : (CAST.MIN_STROKE_SPEED || 150);
  if (fwd < minSpeed || (m && (back - s.theta < 8 || s.omega > 60))) {
    // no swing: nothing flies. Start again with no fuss
    resetCast(G.input === "motion" ? "Swing the phone forward. Lift your thumb as it tips." : "Drag down. Then flick up and let go.");
    return;
  }
  // motion: graded by the time of the lift against the moment the rod crossed 11 o'clock (cast.js); a finger: by its angle
  const errMs = m && !held ? liftError((q) => Motion.at(q).theta, t, fwd, tEnd) : null;
  const g = held ? gradeRelease({ held }) : m ? gradeRelease({ errMs }) : { thetaRelease: finger ? finger.theta : s.theta, assist: true };
  const rod = finger ? finger.theta : s.theta;
  G.lastRelease = { t, theta: rod, thetaRelease: g.thetaRelease, errMs, omega: s.omega, minOmega: pk.minOmega, maxTheta: pk.maxTheta, fwd };
  const params = castParams({ thetaRelease: g.thetaRelease, omegaPeak: fwd, thetaBack: back, yaw: m ? clamp(s.yaw, -75, 75) : G.aimYaw, assist: save.assist && g.assist });
  G.cast = params;
  G.cast.late = held;
  G.cast.key = !!(finger && finger.fwd);
  // physics uses the real rod geometry; world.tip() is the drawn, camera-held rod
  G.flight = new Flight(rodTip(clamp(rod, 0, 85), params.yaw, 0, G.place.stand.rod), params);
  // what the aim line shows next time: where a cast like this one lands
  G.lastCast = { v0: params.v0, pitch: params.pitch, theta: clamp(rod, 0, 85) };
  G.aimTo = null;
  G.step = "flight";
  G.casts++;
  if (G.mode === "derby") G.castsLeft--;
  save.casts++;
  if (!sounded) Sound.sfx("release");
  // a sweet release says so at once, before the lure lands (the grade is fixed, so the buzz cannot spoil it)
  if (params.verdict === "sweet" && !held) { report(null, "Sweet!", "", true, true, 900); Sound.sfx("zing"); Haptics.bump(0.6); }
  seen("cast");
  updateHud();
  relayout();
}
// the cast landed on the place where you stand
const STAND_HIT = { dock: "You hooked the dock.", road: "You hit the road.", bar: "You hit the gravel bar.", wall: "You hit the wall." };
const VERDICT = {
  sweet: "Sweet cast!", high: "Too high. Let go a little later.", low: "Too low. Let go a little sooner.",
  slam: "Too late. Let go sooner.", behind: "Far too early. It went behind you.", weak: "Flick it faster.",
  late: "You held on. Let go during the flick.", short: "Drag down first.",
};
const VERDICT_M = {
  sweet: "Sweet cast!", high: "Too high. Lift your thumb a little later.", low: "Too low. Lift your thumb a little sooner.",
  slam: "Too late. Lift your thumb sooner.", behind: "Far too early. It went behind you.", weak: "Too slow. Whip it faster.",
  late: "You kept your thumb down. Lift it as the phone tips.", short: "Tip the phone back first.",
};
function landed(r) {
  const dist = Math.hypot(r.x, r.z);
  G.step = r.land === "water" ? "landed" : "ashore";
  const zone = G.place.zone(r.x, r.z);
  const v = G.cast ? (G.cast.late ? "late" : G.cast.verdict) : "";
  const VV = G.input === "motion" ? VERDICT_M : VERDICT;
  // the goals: was this cast stopped short, and the sweet casts in a row in the water (free fishing only: the derby ranks
  // stay put; a cast onto land ends the run). The third sweet cast in a row makes the next cast in the water bring a
  // bigger fish: this one, if an earlier run armed it
  const feather = !!G.feathered;
  G.feathered = false;
  const streakBoost = G.mode === "free" && r.land === "water" && !!G.boostNext;
  if (streakBoost || G.mode !== "free") G.boostNext = false;
  if (G.mode !== "free") G.streak = 0;
  else if (G.cast) {
    G.streak = v === "sweet" && r.land === "water" ? (G.streak || 0) + 1 : 0;
    if (G.streak > save.bestRun) save.bestRun = G.streak;
    if (G.streak && G.streak % STREAK.n === 0) G.boostNext = true;
  }
  const goalOpen = !!goalLine("remind");
  if (r.land === "water") {
    world.splash(r.x, r.z, 0.5);
    Sound.sfx("splash", 0.5); Haptics.splash(0.5);
    G.landing = { x: r.x, z: r.z, dist, feather };
    G.ring = rises ? rises.near(r.x, r.z) : null;
    G.landing.ring = !!G.ring; G.landing.big = !!(G.ring && G.ring.big);
    G.fight = null;
    // a bigger fish: the cast after three sweet casts, or a big ring (the help for a short caster, see ringNews)
    const boost = (streakBoost ? STREAK.boost : 0) + (G.ring && G.ring.big ? ASSIST.boost : 0);
    // casts in the water here while the goal that opens the next place is not met: short ones, and all of them in free fishing
    if (goalOpen && dist < SHORT_M) G.shortN = (G.shortN || 0) + 1;
    if (goalOpen && G.mode === "free") { if (!G.dry || G.dry.at !== G.place.id) G.dry = { at: G.place.id, n: 0 }; G.dry.n++; }
    for (const t of noteGoals({ kind: "cast", dist })) toast(t, 3000, () => Sound.sfx("record"));
    // G.force lets a test pick the fish: { species, kg, bite }. A brand-new player's first cast in the water gets a sure bite
    // from a small, easy fish (firstBite in fish.js). It is used up when that fish strikes (handleEvent), so a cast that ends
    // before the strike keeps it for the next one; the casts after the strike have the normal odds
    const gift = !G.force && !G.gifted && save.caught === 0 && G.place.id === "loon" ? firstBite(zone, LAKE.rng(G.seed + 911)) : null;
    G.gift = !!gift;
    G.sim = new LakeSim(Object.assign({ place: G.place, lure: { x: r.x, z: r.z }, tip: rodTip(45, G.cast ? G.cast.yaw : 0, 0, G.place.stand.rod), lineOut: r.lineOut, hour: G.hour, ring: G.ring, rng: LAKE.rng(G.seed + G.casts * 7919), easy: save.assist, boost }, G.force || gift || {}));
    G.big = null; G.walk = false;
    G.settle = 0;
    if (G.sim.plan && world.prepareFish) world.prepareFish(G.sim.plan.id);
    const best = dist > save.longest && dist > 12;
    if (dist > save.longest) save.longest = dist;
    persist();
    const miss = !G.ring && rises ? rises.near(r.x, r.z, 12) : null;
    // three sweet casts in a row; or, while the goal that opens the next place is open, a short cast now and then hears
    // that the big fish live far out (goals.js progressNote). The run of sweet casts goes first, even before a ring: the
    // boost it arms is news the ring does not show
    const hint = progressNote({ streak: G.streak, dist, goalOpen, castN: G.shortN }), lit = hint === STREAK.text;
    report(dist, VV[v] || "", reportNote({ streak: lit ? hint : "", progress: lit ? "" : hint, dist, verdict: v, ring: G.ring, nearMiss: miss ? nearMissText(miss, r.x, r.z, G.cast ? G.cast.yaw : 0) : "", zone: G.place.zoneNames[zone] || "", best,
      farther: G.place.id === "loon" && dist < 15 && save.casts <= 12, stroke: G.cast ? G.cast.stroke : 1, motion: G.input === "motion", key: !!(G.cast && G.cast.key) }), v === "sweet");
    $("#report").classList.toggle("streak", lit);
    // right into a ring: its own chime (the gold ring rings brighter), a tap, and gold sparks on the water
    if (G.ring) { Sound.sfx("ringHit", G.ring.gold ? 1 : 0); Haptics.bump(0.5); world.sparkle(r.x, r.z, 8); }
    // straight to the reel: the first turn of the crank closes the bail, like a real reel
    enterReel();
    return;
  } else {
    Sound.sfx("plop");
    const msg = r.land === "tree" ? (G.place.id === "loon" ? "You caught a pine tree." : "You caught a tree.") : r.land === "dock" ? STAND_HIT[G.place.stand.kind] || "You hooked the dock." : "You cast onto the shore.";
    // a derby gives back a cast that did not reach the water: a fumble is not a cast at a fish
    const back = G.mode === "derby";
    if (back) { G.castsLeft++; G.casts--; updateHud(); }
    report(r.land === "dock" ? null : dist, VV[v] || "", msg + (back ? " You get that cast back." : ""), false);
    $("#report").classList.remove("streak");
    G.outcomeAt = now();
  }
  relayout();
}
/* ---------------- the reel ---------------- */
function enterReel() {
  G.phase = "reel";
  G.hold = null;
  // touch, the mouse and the keys: each reel starts with the rod at the same angle (a rod lifted out stays high otherwise)
  if (rodPad) rodPad.reset();
  // the phone stays upright: its top edge is still the rod. The cast report stays up a moment, below the prompt
  Motion.mode = G.input === "motion" ? "portrait" : "landscape";
  relayout(true);
  updateHud();
}
// The beat after a cast. The loss line stays LOSS_MS (a legend LOSS_LEGEND_MS) so it can be read, while the fish swims off
// (GONE_MS) and a thrown hook leaves the line limp on the water. "Nothing this time" (HOME_MS) and a cast onto the shore
// (ASHORE_MS) are short. A cast input once the words have been up SKIP_MS ends the beat at once (skipBeat)
const LOSS_MS = 3400, LOSS_LEGEND_MS = 4500, HOME_MS = 1000, ASHORE_MS = 900, GONE_MS = 1400;
const SKIP_MS = { home: 350, ashore: 350, lost: 800 };
function outcome(kind, msg, sub = "") {
  if (Array.isArray(msg)) { sub = msg[1]; msg = msg[0]; }
  const s = G.sim && G.sim.state, f = kind === "lost" && s && s.fish, sp = f && byId(f.id);
  G.lossMs = kind !== "lost" ? HOME_MS : sp && sp.legend ? LOSS_LEGEND_MS : LOSS_MS;
  G.beat = kind;
  const d = f ? Math.hypot(f.x, f.z) || 1 : 1;
  G.gone = f && !s.junk ? { fish: { id: f.id, x: f.x, y: Math.min(f.y, -0.1), z: f.z, len: f.len || 0.4 }, dx: f.x / d, dz: f.z / d, limp: s.reason === "thrown" } : null;
  G.phase = "lost";
  G.outcomeAt = now();
  prompt(msg, sub, kind === "home" ? "crank" : "stop", "");
  relayout();
}
function nextAfterOutcome() {
  if (G.mode === "derby" && G.castsLeft <= 0) { endDerby(); return; }
  newCast();
}
// the beat is over: the next cast (the bail a cast onto the shore left open snaps shut), or the derby results
function beatDone() {
  if (G.phase === "lost") prompt("");
  else if (G.bail === "open") { G.bail = "closed"; Sound.sfx("bailClose"); }
  nextAfterOutcome();
}
// A cast input in the beat after a cast: a press on the lake or the reel, a mouse click, Space, a thumb in motion play.
// Once the words have been up SKIP_MS it ends the beat now, and the same press goes on into the new cast (G.skip: its
// pointer id, or "key"; null for a press that goes no further). A legend's first reveal that is due in the new cast plays
// now instead, and the press goes no further. True when it ended the beat
function skipBeat(id) {
  const kind = G.phase === "lost" ? G.beat : G.phase === "cast" && G.step === "ashore" ? "ashore" : "";
  if (!kind || G.paused || now() - G.outcomeAt < SKIP_MS[kind]) return false;
  G.skip = id;
  beatDone();
  if (revealDue()) playReveal();
  return true;
}

/* ---------------- the goals ---------------- */
// what the fish did in this fight, for the goals (handleEvent tells; a new one starts at the hook set)
const blankFight = () => ({ turned: [], cover: "", jumps: 0, walk: false, unstuck: false, lastrun: false });
function noteFight(type, e) {
  if (type === "hooked") { G.fight = blankFight(); return; }
  const F = G.fight || (G.fight = blankFight());
  if (type === "cover") F.cover = (e && e.kind) || "";
  else if (type === "turned") F.turned.push(F.cover);
  else if (type === "jump") F.jumps++;
  else if (type === "walk") F.walk = true;
  else if (type === "unstuck") F.unstuck = true;
  else if (type === "lastrun") F.lastrun = true;
}
// the goals of this place that ctx did (goals.js): each new one is saved. Returns what to say: "Goal done: Cast 40 m."
function noteGoals(ctx) {
  const id = G.place.id, done = goalsMet(id, ctx).filter((i) => recordGoal(save, id, i));
  if (done.length) persist();
  return done.map((i) => "Goal done: " + PLACE_GOALS[id][i].text);
}
// A plain ring rose. The first one within reach in the cast gets the tip, once, when no other news is up or waiting (a
// ring rises again in a few seconds, so the tip never pushes other news out of the queue). And the help for a short
// caster: after ASSIST.casts casts in the water here in free fishing with the goal that opens the next place still open,
// the next ring within reach carries a feeding big fish (a sure bite: fish.js LakeSim.choose), said once for that ring.
// It stays up at least ASSIST.ttl s. One big ring at a time, and the help goes on until a big ring's fish is landed: after
// a fish lost from it, or a big ring left to go quiet, the next ring within reach is a big one
function ringNews(e) {
  if (G.phase !== "cast" || Math.hypot(e.x, e.z) > ASSIST.reach) return;
  if (!save.seen["ring.tip"] && !$("#toast").classList.contains("on") && !toastQ.length) toast("A fish is rising. Cast into the ring. Feeding fish bite more often.", 3200, () => seen("ring.tip"));
  const big = G.mode === "free" && G.dry && G.dry.at === G.place.id && G.dry.n >= ASSIST.casts && goalLine("remind") ? assistFish(G.place.id) : null;
  const g = big && rises && !rises.list.some((q) => q.big) && rises.near(e.x, e.z);
  if (!g || g.gold) return;
  g.big = true; g.species = big; g.ttl = Math.max(g.ttl, ASSIST.ttl);
  toast("A big fish is rising close in.", 3200);
}

/* ---------------- the catch ---------------- */
// the photo beat of a trophy, a legend or a fish that opens a place: the fish shows alone (world.js pushes the camera
// in), the flash and the shutter come, then the card slides up. Seconds
const PHOTO = { flash: 1.2, card: 1.5 };
// the call of each place, after a legend's fanfare
const PLACE_CALL = { loon: "loonWail", stumps: "frogs", river: "rapids", sea: "gulls" };
function caught(c) {
  const sp = byId(c.id), at = G.place.id;
  // today's goal, taken before this fish can open a place (the goal of the day stays the same all day)
  const day = today(), dg = dailyGoal(day, save);
  const r = recordCatch(save, at, c);
  const junk = r.junk;
  if (!junk) G.bag.push({ id: c.id, kg: c.kg });
  // the goals: what this catch, its cast and its fight did
  const L = G.landing, F = G.fight || blankFight();
  const ctx = { kind: "catch", at, id: c.id, kg: c.kg, junk, hour: G.hour, dist: L ? L.dist : 0, ring: !!(L && L.ring), feather: !!(L && L.feather), turned: F.turned, jumps: F.jumps, walk: F.walk, unstuck: F.unstuck, lastrun: F.lastrun };
  G.fight = null;
  // a big ring's fish is landed: the help for a short caster starts its count again
  if (L && L.big && G.dry) G.dry.n = 0;
  const day1 = junk ? null : recordDay(save, day, dg, dayHit(dg, ctx));
  // a legend landed: its reveal never plays after this
  if (sp && sp.legend) save.cuts[revealId(at)] = 1;
  persist();
  // The news comes over the card in one toast, a line each, and the queue keeps it, so none of it is lost: the first fish
  // of the day ("Your first fish!" in its place for a new player's first fish), the goals done, today's goal done. A goal
  // done brings the record sting
  const goals = noteGoals(ctx), news = [!junk && save.caught === 1 ? "Your first fish!" : day1 && day1.first ? "Your first fish today." : "", ...goals, day1 && day1.done ? dayDoneText(day1.run) : ""].filter(Boolean);
  if (news.length) toast(news.join("\n"), 1800 + 1200 * news.length, goals.length || (day1 && day1.done) ? () => Sound.sfx("record") : null, true);
  G.phase = "catch";
  prompt("");
  G.big = null; G.walk = false;
  world.setFish(null); world.setFollower(null);
  world.setLine({ visible: false });
  world.setLure({ x: 0, y: -5, z: 0, visible: false });
  // how big it is for its kind: the size line, TROPHY, and how loud the party is
  const rank = !junk && sp ? sizeRank(sp, c.kg) : 0;
  const legend = !!(sp && sp.legend), trophy = rank >= TROPHY_RANK;
  const photo = !junk && (trophy || legend || !!r.opened);
  if (r.opened) {
    G.unlockId = r.opened;
    if (G.mode === "derby") G.unlocked.push({ id: r.opened, kg: c.kg, name: sp.name });
    else G.pendingUnlock = r.opened;
  }
  G.closeCall = r.close ? goalText(at, "close") : "";
  // a derby catch that opens a place: after the card, where to go (the last cast's results card says it instead)
  if (r.opened && G.mode === "derby" && G.castsLeft > 0) G.closeCall = JOURNEY[r.opened].name + " is open. Go there after the derby.";
  // the stinger says how big the news is: a fish has the landing alone; a new species a short rise, a new record a brass
  // call, a trophy or a legend the whole fanfare, and a legend the call of its place after it
  Sound.sfx(junk ? "junk" : "landed");
  const sting = junk ? "" : legend || trophy ? "record" : r.record ? "recordCall" : r.isNew ? "newSpecies" : "";
  if (sting) setTimeout(() => Sound.sfx(sting), sting === "newSpecies" ? 900 : 500);
  if (legend) setTimeout(() => Sound.sfx(PLACE_CALL[at] || "loonWail"), 1700);
  Haptics.land(legend ? 2 : trophy ? 1 : 0);
  // at most two badges, in this order (a new place is the rarest news). They wait for the weight to count up (countUp)
  const badges = $("#cbadges");
  badges.innerHTML = "";
  badges.className = "badges held";
  const marks = [];
  if (r.opened) marks.push(["NEW PLACE", "new"]);
  if (legend) marks.push(["LEGEND", ""]);
  if (r.isNew) marks.push([junk ? "NEW FIND" : "NEW SPECIES", "new"]);
  if (r.record) marks.push(["NEW RECORD", ""]);
  if (trophy) marks.push(["TROPHY", ""]);
  for (const [t, cls] of marks.slice(0, 2)) { const b = document.createElement("span"); b.className = "badge " + cls; b.textContent = t; badges.appendChild(b); }
  $("#cname").textContent = sp ? sp.name : c.name || "A fish";
  $("#csize").textContent = junk ? "" : sizeLine(rank);
  // a new find: how much of this place's journal is found now (the same count as the journal and Places)
  const f = r.isNew ? foundHere(save, at) : null;
  $("#cfound").textContent = !f ? "" : f.n >= f.m ? "You found everything here." : f.n + " of " + f.m + " found here.";
  $("#cold").textContent = [r.record ? "Your old record: " + fmtKg(r.oldKg) + "." : "", r.opened ? "It opens " + JOURNEY[r.opened].name + "." : ""].filter(Boolean).join(" ");
  $("#cblurb").textContent = sp ? sp.blurb : "";
  $("#ccap").textContent = photo ? journeyOf(at).name + " · " + fmtClock(G.hour) : "";
  $("#catch .card").classList.toggle("photo", photo);
  $("#catchGo").textContent = G.mode === "derby" && G.castsLeft <= 0 ? "See the results" : G.pendingUnlock ? "Next" : "Cast again";
  clearTimeout(cardT); clearInterval(countT);
  G.cardWait = photo;
  $("#catch").classList.toggle("wait", photo);
  relayout(true);
  // after the new layout, so the fish is fitted to the view it will be seen in
  world.showCatch(c.id, c.kg, { photo, sparkle: trophy || legend });
  show("catch");
  updateHud();
  if (!photo) { countUp(c, junk, rank); return; }
  cardT = setTimeout(() => {
    flash("photo"); Sound.sfx("shutter"); Haptics.shutter();
    cardT = setTimeout(() => { G.cardWait = false; $("#catch").classList.remove("wait"); countUp(c, junk, rank); }, (PHOTO.card - PHOTO.flash) * 1000);
  }, PHOTO.flash * 1000);
}
// the weight and the length on the card
function catchKg(c, junk, kg) {
  // the length grows with the cube root of the weight, like the fish itself
  const cm = c.cm && c.kg > 0 ? Math.round(c.cm * Math.cbrt(clamp(kg / c.kg, 0, 1))) : 0;
  $("#ckg").innerHTML = junk ? "<small>Junk</small>" : fmtKg(kg) + (cm ? " <small>· " + cm + " cm</small>" : "");
  // data-kg is set when the count-up is done, so a test can wait for it
  $("#ckg").dataset.kg = junk || kg < c.kg ? "" : String(c.kg);
}
// The weight counts up from 0, over 0.4 + 1.2 × rank² seconds, with up to 10 ticks that climb in pitch. Then the weight
// pops, the badges stamp on with a thunk, and a trophy buzzes. Calm effects: the card at once (the thunk and the buzz stay)
function countUp(c, junk, rank) {
  clearInterval(countT);
  if (junk || isCalm()) { catchKg(c, junk, c.kg); countDone(rank, false); return; }
  const dur = 0.4 + 1.2 * rank * rank, ticks = clamp(Math.round(dur * 8), 3, 10), t0 = now();
  let done = 0;
  catchKg(c, junk, 0);
  countT = setInterval(() => {
    const k = clamp((now() - t0) / 1000 / dur, 0, 1);
    catchKg(c, junk, c.kg * (1 - Math.pow(1 - k, 2)));
    while (done < ticks && k >= (done + 1) / ticks) { done++; Sound.sfx("tick", done / ticks); Haptics.tick(); }
    if (k >= 1) {
      clearInterval(countT);
      catchKg(c, junk, c.kg);
      countDone(rank, true);
    }
  }, 40);
}
function countDone(rank, pop) {
  const b = $("#cbadges"), kg = $("#ckg");
  b.classList.remove("held");
  if (b.children.length) { b.classList.add("stamp"); Sound.sfx("stamp"); }
  if (pop) { kg.classList.remove("pop"); void kg.offsetWidth; kg.classList.add("pop"); }
  if (rank >= TROPHY_RANK) Haptics.land(1);
}
$("#catchGo").addEventListener("click", () => {
  if (G.cardWait) return;
  Sound.sfx("ui");
  clearTimeout(cardT); clearInterval(countT);
  // the fish opened a place in free fishing: the card of the new place comes next
  if (G.pendingUnlock) { const id = G.pendingUnlock; G.pendingUnlock = null; unlockCard(id); return; }
  show(null); world.hideCatch();
  if (G.closeCall) { toast(G.closeCall, 3600); G.closeCall = ""; }
  nextAfterOutcome();
});

/* ---------------- the derby ---------------- */
function endDerby() {
  releaseAwake();
  G.phase = "results";
  Sound.stopLoops(); Haptics.stop();
  prompt("");
  const id = G.place.id, J = journeyOf(id);
  const total = G.bag.reduce((a, b) => a + b.kg, 0);
  const d = recordDerby(save, id, total);
  persist();
  $("#rkick").textContent = J.kick;
  $("#rtotal").textContent = fmtKg(total);
  $("#rrank").textContent = rankFor(id, total);
  // the next rank up the ladder (none at the top)
  const nr = nextRank(id, total);
  $("#rnext").textContent = nr ? "Next rank: " + nr.name + " at " + nr.kg + " kg." : "";
  const ul = $("#rlist");
  ul.innerHTML = "";
  if (!G.bag.length) { const li = document.createElement("li"); li.textContent = "No fish this time."; ul.appendChild(li); }
  for (const f of [...G.bag].sort((a, b) => b.kg - a.kg)) {
    const li = document.createElement("li");
    const a = document.createElement("span"), b = document.createElement("b");
    a.textContent = (byId(f.id) || {}).name || f.id; b.textContent = fmtKg(f.kg);
    li.append(a, b); ul.appendChild(li);
  }
  const rec = placeRec(save, id);
  $("#rbest").textContent = d.best && total > 0 ? "A new best derby here!" + (d.old > 0 ? " Your old best: " + fmtKg(d.old) + "." : "") : rec && rec.d > 0 ? "Your best derby here: " + fmtKg(rec.d) : "";
  // a fish of this derby opened the next place
  const up = G.unlocked[G.unlocked.length - 1];
  $("#runlock").hidden = $("#rGo").hidden = !up;
  if (up) { $("#runlock").textContent = openedText(up.id, up.kg, up.name, "results"); seen("opened." + up.id); G.unlockId = up.id; }
  relayout(true);
  show("results");
  derbyCount(total, d.best && total > 0, up ? up.id : null);
}
// The derby total counts up from zero over about 1 s with ticks that climb. Then the rank stamps on and the lines under it
// show, with the close of the derby: the fanfare for a new best, a soft close for any other. A place this derby opened
// sounds its horn call after that. Calm effects: all at once (the sounds stay). Fish again, Title and Go there stop it
let resT = 0;
function derbyCount(total, best, opened) {
  clearInterval(resT);
  const held = ["#rrank", "#rnext", "#rbest", "#runlock"].map((s) => $(s)), calm = isCalm(), DUR = calm ? 0 : 1000, ticks = 8, t0 = now();
  let done = 0, closed = false;
  const close = () => {
    closed = true;
    $("#rtotal").textContent = fmtKg(total);
    for (const el of held) el.classList.remove("held");
    if (!calm) $("#rrank").classList.add("stamp");
    Sound.sfx(best ? "record" : "derbyClose"); Haptics.land(best ? 1 : 0);
  };
  $("#rrank").classList.remove("stamp");
  if (calm) close();
  else { for (const el of held) el.classList.add("held"); $("#rtotal").textContent = fmtKg(0); }
  if (closed && !opened) return;
  resT = setInterval(() => {
    const ms = now() - t0, k = DUR ? clamp(ms / DUR, 0, 1) : 1;
    if (!closed) {
      $("#rtotal").textContent = fmtKg(total * (1 - Math.pow(1 - k, 2)));
      while (done < ticks && k >= (done + 1) / ticks) { done++; Sound.sfx("tick", done / ticks); }
      if (k >= 1) close();
    }
    if (closed && !opened) clearInterval(resT);
    else if (closed && ms >= DUR + (best ? 2600 : 900)) { clearInterval(resT); Sound.sfx("newPlace", ORDER.indexOf(opened)); Haptics.land(1); }
  }, 40);
}
$("#rAgain").addEventListener("click", () => { Sound.sfx("ui"); clearInterval(resT); startMode("derby"); });
$("#rMenu").addEventListener("click", () => { Sound.sfx("uiBack"); toTitle(); });
$("#rGo").addEventListener("click", () => { Sound.sfx("ui"); travelTo(G.unlockId); });

/* ---------------- journal ---------------- */
// one chip for each place; the rows are the fish of the chosen place, small to big, then its legend, then its junk
function renderJournal(pid) {
  pid = pid || G.place.id;
  const tabs = $("#jtabs");
  tabs.innerHTML = "";
  for (const id of ORDER) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "tab"); b.dataset.place = id;
    b.setAttribute("aria-selected", String(id === pid));
    b.className = openNow(id) ? "" : "lock";
    b.textContent = JOURNEY[id].short;
    b.addEventListener("click", () => { Sound.sfx("ui"); renderJournal(id); requestAnimationFrame(fades); });
    tabs.appendChild(b);
  }
  const list = $("#jlist");
  list.innerHTML = "";
  // the counts; then the best sweet run and the days whose goal was done, once there are any
  const all = foundAll(save), D = save.days;
  const more = [save.bestRun > 0 ? "Best sweet run: " + save.bestRun : "", D.n > 0 ? "Goal days: " + D.n + (D.best >= 2 ? " (best " + D.best + " in a row)" : "") : ""].filter(Boolean).join(" · ");
  const tail = all.n + " of " + all.m + " in all · " + save.caught + " fish landed · " + save.casts + (save.casts === 1 ? " cast" : " casts") + (more ? "\n" + more : "");
  if (!openNow(pid)) {
    const d = document.createElement("div");
    d.className = "jnote"; d.textContent = "Open " + JOURNEY[pid].name + " to see its fish.";
    list.appendChild(d);
    $("#jsum").textContent = tail;
    return;
  }
  const F = fishingOf(pid), here = placeSpecies(pid).map(byId);
  const rows = [...here.filter((sp) => !sp.legend && !F.junk.includes(sp.id)).sort((a, b) => a.kg[1] - b.kg[1]), ...here.filter((sp) => sp.legend), ...here.filter((sp) => F.junk.includes(sp.id))];
  // a short list: the fish caught, then the next 3 to find with their hints, then how many more there are
  const got = (sp) => !!(save.journal[sp.id] && save.journal[sp.id].n), left = rows.filter((sp) => !got(sp));
  for (const sp of [...rows.filter(got), ...left.slice(0, 3)]) {
    const j = save.journal[sp.id], junk = F.junk.includes(sp.id);
    const d = document.createElement("div");
    d.className = "jfish" + (j && j.n ? "" : " none") + (sp.legend ? " legend" : "");
    const b = document.createElement("b"), sw = document.createElement("i"), sm = document.createElement("small");
    sw.className = "sw";
    if (j && j.n) {
      b.textContent = sp.name;
      sw.style.background = "linear-gradient(90deg," + sp.look.back + "," + sp.look.body + "," + (sp.look.belly || sp.look.accent || sp.look.body) + ")";
      sm.textContent = junk ? "Found " + j.n + "×" : "Best " + fmtKg(j.kg) + (j.cm ? " · " + j.cm + " cm" : "") + " · caught " + j.n;
    } else {
      b.textContent = sp.legend ? "The legend" : junk ? "Something odd" : "Not caught yet";
      sw.style.background = "rgba(255,255,255,0.12)";
      // the plunger and the frisbee sit by the cottage dock (fish.js junkR)
      sm.textContent = sp.legend ? legendHint(pid, legendStepOf(pid)) : junk ? (pid === "loon" ? "Something odd lies near the dock." : "It is on the bottom somewhere.") : (zoneHint(sp, pid) || "");
    }
    d.append(b, sw, sm);
    list.appendChild(d);
  }
  if (left.length > 3) { const d = document.createElement("div"); d.className = "jnote"; d.textContent = left.length - 3 + " more to find here."; list.appendChild(d); }
  const f = foundHere(save, pid);
  $("#jsum").textContent = f.n + " of " + f.m + " found here · " + tail;
}

/* ---------------- help ---------------- */
// How to play: a short tab for each input, in the words the game uses in play (moveWords in guide.js), with the rising
// rings, and the fish moves behind a row that opens. input: "motion", "touch", or "keys" (a computer with no touch screen)
function helpRows(input) {
  // (a computer: the moves in the mouse's words, which are the drag words, and the strike with the mouse or Space)
  const m = input === "motion", keys = input === "keys", w = (k, pace) => moveWords(k, keys ? "mouse" : input, 0, pace);
  const steps = m ? [
    ["upright", "Hold the phone <b>upright</b>. Grip it tight. Keep 2 m clear around you."],
    ["thumb", "<b>Hold your thumb</b> on the screen. Turn your body to aim."],
    ["back", "Tip the phone <b>back</b>."],
    ["flick", "<b>Whip it forward.</b> Lift your thumb."],
  ] : [
    ["turn", keys ? "Move the mouse sideways as you hold to <b>aim</b>, or use the arrow keys." : "Drag the lake sideways to <b>aim</b>."],
    ["thumb", keys ? "<b>Hold the mouse button</b> or <b>Space</b>. The rod tips back, then swings forward." : "<b>Press anywhere</b> and drag down."],
    ["flick", keys ? "<b>Let go in the green.</b> You can also drag down and flick up." : "<b>Flick up</b> and let go in the green."],
  ];
  // a computer: the next cast comes at once with a click or Space (the phone tabs keep their room)
  if (keys) steps.push(["thumb", "No fish? <b>Click or press Space</b> to cast again at once."]);
  steps.push(
    ["crank", m ? "Turn the <b>crank</b> with your thumb. Reel slowly." : keys ? "Turn the <b>crank</b>, or use the mouse wheel, or hold <b>R</b>. Reel slowly." : "Turn the <b>crank</b> on the left with your left thumb. Reel slowly."],
    [m ? "pull" : "swipe", "A fish <b>strikes</b>? " + (keys ? moveWords("hook", "mouse").replace(/!$/, "") + ", or press <b>Space</b>." : moveWords("hook", input))],
  );
  if (!m) steps.push(["pull", keys ? "Drag the <b>rod</b> up, down and sideways, or use <b>W&nbsp;A&nbsp;S&nbsp;D</b>." : "Your right thumb works the <b>rod</b>: drag it up, down and sideways."]);
  steps.push(
    ["fish", "In a fight, <b>follow the big words</b> at the top. They tell you each move."],
    ["ring", "<b>Rings</b> on the water are rising fish. Cast into one for a near-sure bite."],
  );
  const moves = [
    ["stop", "<b>The drag slips.</b> " + w("stop")],
    ["turn", "<b>It runs to cover.</b> " + w("turn")],
    ["pull", "<b>It shakes its head.</b> " + w("raise")],
    ["low", "<b>It jumps.</b> " + w("low")],
    ["crank", "<b>It swims at you.</b> " + w("reel", "fast")],
    ["pull", "<b>It holds on the bottom.</b> " + w("pump")],
    ["fish", "<b>It is tired and close.</b> " + w("land")],
  ];
  const list = (rows) => "<ol class='steps'>" + rows.map(([ic, t]) => "<li>" + ICON[ic] + "<span>" + t + "</span></li>").join("") + "</ol>";
  return list(steps) + "<details class='moves'><summary>Fish moves</summary>" + list(moves) + "</details>";
}
$("#helpM").innerHTML = helpRows("motion");
$("#helpT").innerHTML = helpRows(inputOf(false, touchDevice));
// the app and a phone have no mouse: the tab says Touch
if (Native.isStore || touchDevice) $("#tabT").textContent = "Touch";
// an opened list comes into view: on a small phone it opens below the part of the list that shows
for (const d of $$("#help .moves")) d.addEventListener("toggle", () => {
  fades();
  if (d.open) d.lastElementChild?.scrollIntoView({ block: "nearest", behavior: isCalm() ? "auto" : "smooth" });
});
// the tab for the input the player uses: motion play, or a phone that can play with motion and has not chosen yet; else
// touch (a computer opens on Touch and mouse)
function helpInput() {
  if (G.input === "motion" || G.stallTouch) return G.input;
  return save.input || (touchDevice && Motion.available ? "motion" : "touch");
}
function openHelp() {
  Sound.init(); Sound.sfx("ui");
  for (const d of $$("#help .moves")) d.open = false;
  helpTab(helpInput() === "motion" ? "m" : "t");
  overlay("help");
}
function helpTab(t) {
  for (const b of $$("#help [data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === t));
  setPullDemo(false);
  for (const p of $$("#help [role=tabpanel]")) p.scrollTop = 0;
  requestAnimationFrame(fades);
}
function setPullDemo(open) {
  const motionTab = $("#help [data-tab='m']").getAttribute("aria-selected") === "true";
  $("#pullDemo").hidden = !open;
  $("#helpM").hidden = open || !motionTab;
  $("#helpT").hidden = open || motionTab;
  $("#watchPullDemo").hidden = !motionTab;
  $("#watchPullDemo").textContent = open ? "Back to steps" : "Watch: tip back to reel";
  if (!open) $("#pullDemoVideo").pause();
}
$("#watchPullDemo").addEventListener("click", () => {
  const open = $("#pullDemo").hidden;
  setPullDemo(open);
  if (open) {
    const video = $("#pullDemoVideo");
    video.currentTime = 0;
    video.play().catch(() => { /* Native playback controls remain available. */ });
  }
});
for (const tab of $$("#help [data-tab]")) tab.addEventListener("click", () => helpTab(tab.dataset.tab));
function seen(k) { if (!save.seen[k]) { save.seen[k] = 1; persist(); } }

/* ---------------- art style ---------------- */
// Settings > Art style: Painted (the default) or Original
function syncArtStyle() {
  document.body.dataset.artStyle = save.artStyle;
  $("#optArtStyle").value = save.artStyle;
  $("#artNote").textContent = save.artStyle === "painted" ? "Cartoon models and painted skies." : "Classic lake scenery.";
}
function setArtStyle(style) {
  save.artStyle = normalizeStyle(style);
  persist();
  syncArtStyle();
  if (world) world.setArtStyle(save.artStyle);
  G.stillDrawn = false;
}
$("#optArtStyle").addEventListener("change", (event) => setArtStyle(event.target.value));
syncArtStyle();
markPlace();

/* ---------------- settings ---------------- */
function syncSettings() {
  $("#optSound").checked = Sound.isOn();
  $("#optHaptics").checked = Haptics.enabled;
  $("#optHaptics").disabled = Haptics.kind === "none";
  $("#hapticNote").textContent = Haptics.kind === "none" ? (Native.isStore ? "This phone cannot buzz." : "This browser cannot buzz.") : Haptics.kind === "ios" ? "Light taps on iPhone." : "Buzz for bites, strikes, and line pull.";
  $("#optAssist").checked = !!save.assist;
  // after stalled sensors switched this visit to touch (G.stallTouch), the saved choice is still motion: show touch, so
  // picking Motion turns the sensors back on
  // a player who has not chosen yet is asked at the first cast: the row says so, and shows the suggested motion
  const ask = touchDevice && Motion.available && !save.input && G.input !== "motion";
  $("#optInput").value = ask || G.input === "motion" || (save.input === "motion" && !G.stallTouch) ? "motion" : "touch";
  $("#optInput").disabled = !touchDevice || !Motion.available;
  $("#inputNote").textContent = !touchDevice || !Motion.available ? "Motion needs a phone." : G.input === "motion" ? "The phone is the rod." : G.stallTouch ? "The sensors stopped. Pick Motion to try again." : ask ? "You choose when you start." : "Drag and flick on the screen.";
  $("#optQuality").value = save.quality;
  $("#optReelSide").value = save.reelSide;
  $("#aboutVer").textContent = VERSION;
  syncArtStyle();
  syncAccess();
}
$("#optSound").addEventListener("change", (e) => { if (e.target.checked !== Sound.isOn()) Sound.toggle(); });
$("#optHaptics").addEventListener("change", (e) => { Haptics.unlock(); Haptics.setEnabled(e.target.checked); if (e.target.checked) Haptics.bump(0.6); });
$("#optAssist").addEventListener("change", (e) => { save.assist = e.target.checked; persist(); });
$("#optQuality").addEventListener("change", (e) => { save.quality = e.target.value; persist(); applyQuality(); });
// the reel side mirrors the reel controls in motion play: the crank, the drag and the gauge (index.html)
$("#optReelSide").addEventListener("change", (e) => {
  save.reelSide = e.target.value === "left" ? "left" : "right";
  game.dataset.reelSide = save.reelSide;
  persist();
  relayout(true);
});
// a tap anywhere on a row with a list opens the list (where the browser can)
for (const row of $$(".set label")) row.addEventListener("click", (e) => {
  const sel = row.querySelector("select");
  if (!sel || sel.disabled || e.target === sel) return;
  try { sel.showPicker(); } catch (err) { sel.focus(); }
});
$("#optInput").addEventListener("change", async (e) => {
  if (e.target.value === "motion") {
    const st = await Motion.request();
    if (st === "granted") { G.input = "motion"; save.input = "motion"; G.stallTouch = false; lockPortrait(); }
    else if (st === "idle") { e.target.value = "touch"; toast("Tap Use motion on the start screen to allow the sensors."); }
    else { e.target.value = "touch"; G.input = "touch"; save.input = "touch"; toast(st === "denied" ? (Native.isStore ? "Motion is off. You can play with touch." : "Motion is blocked for this page.") : "No motion data from this phone."); }
  } else { G.input = "touch"; save.input = "touch"; G.stallTouch = false; }
  persist(); syncSettings(); relayout(true);
});
function quality() { return SHOT ? "high" : save.quality === "auto" ? (touchDevice ? "low" : "high") : save.quality; }
function applyQuality() {
  // the reel canvases follow the quality too: fewer pixels to paint on a phone
  REEL_UI.maxDpr = quality() === "low" ? 1.5 : SHOT ? 3 : 2;
  if (world) world.setQuality(quality());
  G.stillDrawn = false;
  for (const w of [reelPanel, crank, rodPad, gauge]) if (w && w.resize) w.resize();
}

/* ---------------- easier play: Larger text and Calm effects ---------------- */
// Both live outside the save, like the sound switch, and go to native storage in the app (SWITCHES).
// Larger text ("fish.text" = "large"): #game data-text="large" sets --ui-scale (style.css), and the gauge's words grow.
// Calm effects ("fish.calm" = "1"): html data-calm="1". With the phone's reduced motion it is on anyway (calm.js)
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const GAUGE_PX = { WORD_PX: GAUGE.WORD_PX, LABEL_PX: GAUGE.LABEL_PX };
function setSwitch(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage off */ } if (mirror) Native.prefs.set(k, v); }
function applyAccess() {
  const large = store.raw("fish.text") === "large";
  if (large) game.dataset.text = "large"; else delete game.dataset.text;
  GAUGE.WORD_PX = Math.round(GAUGE_PX.WORD_PX * (large ? 1.25 : 1));
  GAUGE.LABEL_PX = Math.round(GAUGE_PX.LABEL_PX * (large ? 1.25 : 1));
  if (store.raw("fish.calm") === "1") document.documentElement.dataset.calm = "1"; else delete document.documentElement.dataset.calm;
}
function syncAccess() {
  const sys = reducedMotion.matches;
  $("#optText").checked = store.raw("fish.text") === "large";
  $("#optCalm").checked = sys || store.raw("fish.calm") === "1";
  $("#optCalm").disabled = sys;
  $("#calmNote").textContent = sys ? "On: your phone asks for less motion." : "Fewer flashes and less motion.";
}
$("#optText").addEventListener("change", (e) => { setSwitch("fish.text", e.target.checked ? "large" : "normal"); applyAccess(); relayout(true); requestAnimationFrame(fades); });
$("#optCalm").addEventListener("change", (e) => { setSwitch("fish.calm", e.target.checked ? "1" : "0"); applyAccess(); });
reducedMotion.addEventListener("change", syncAccess);
applyAccess();

/* ---------------- about and the privacy policy ---------------- */
// About and the policy open over Settings, and go back to it (or the policy back to About). The policy is privacy.html in
// a frame: a page of the game, so it shows with no network. Its Back button posts a message to close it here
let privacyFrom = "settings";
$("#aboutVersion").textContent = "Version " + VERSION;
function openPrivacy(from) {
  privacyFrom = from;
  const f = $("#privacyFrame");
  if (!f.getAttribute("src")) f.src = "privacy.html";
  show("privacy");
}
function closeSub() {
  Sound.sfx("uiBack");
  show(!$("#privacy").hidden ? privacyFrom : "settings");
}
$("#aboutBtn").addEventListener("click", () => { Sound.sfx("ui"); show("about"); });
$("#privacyRow").addEventListener("click", () => { Sound.sfx("ui"); openPrivacy("settings"); });
$("#privacyBtn").addEventListener("click", () => { Sound.sfx("ui"); openPrivacy("about"); });
for (const b of $$("[data-back]")) b.addEventListener("click", closeSub);
addEventListener("message", (e) => {
  const d = e.data;
  if (e.source === $("#privacyFrame").contentWindow && d && d.source === "reel-it-in-privacy" && d.action === "close" && !$("#privacy").hidden) closeSub();
});

/* ---------------- pause ---------------- */
function pause() {
  // a cutscene ends first: the pause comes in where it would have ended
  if (cuts && cuts.playing) cuts.skip();
  if (G.paused || !(G.phase === "cast" || G.phase === "reel" || G.phase === "lost")) return;
  G.paused = true;
  pullStrength.reset();
  releaseAwake();
  Sound.stopLoops(); Haptics.stop();
  // a thumb on the line when the game stops: the line goes back, and the next press starts the cast again
  if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) { G.pin = null; G.step = "ready"; G.bail = "closed"; G.drop = 0; }
  reelPanel?._cancelAll();
  if (rodPad) rodPad.drag = null;
  pauseSum();
  show("pause");
}
// the pause card's lines. While the GL context is lost there is no lake to play on: Resume waits until it is back
function pauseSum() {
  $("#pauseSum").textContent = [G.ctxLost && "The lake is coming back.", hudText(), goalLine("remind") || nextGoal(save, G.place.id, OPEN_ALL)].filter(Boolean).join("\n");
  $("#resumeBtn").disabled = !!G.ctxLost;
}
function resume() { if (G.ctxLost) return; G.paused = false; show(null); Sound.sfx("ui"); keepAwake(); }
$("#pauseBtn").addEventListener("click", (e) => { e.stopPropagation(); Sound.sfx("ui"); pause(); });
$("#resumeBtn").addEventListener("click", resume);
$("#quitBtn").addEventListener("click", () => { G.paused = false; Sound.sfx("uiBack"); toTitle(); });
$("#pHelp").addEventListener("click", openHelp);
$("#pJournal").addEventListener("click", () => { renderJournal(); overlay("journal"); });
$("#pSet").addEventListener("click", () => { syncSettings(); overlay("settings"); });
// the page or the app goes away: play pauses, the loops and the buzz stop
function away() { $("#pullDemoVideo").pause(); pause(); Sound.stopLoops(); Haptics.stop(); mirrorSwitches(); }
document.addEventListener("visibilitychange", () => {
  if (document.hidden) away();
  else if (!G.paused && G.phase !== "title" && G.phase !== "results") keepAwake();
});
// The app has its own pause and resume (Android may not hide the page). The lake goes quiet in the background and
// sounds again when the app comes back; play stays paused until Resume
Native.onPause(() => { away(); Sound.setAmbience(false); });
Native.onResume(() => {
  Sound.init(); Sound.setAmbience(true, G.hour);
  if (!G.paused && G.phase !== "title" && G.phase !== "results" && G.phase !== "boot") keepAwake();
});

/* ---------------- Android back ---------------- */
// Like Escape, and more: back closes the top screen, or pauses play and resumes it. On the catch card, the results and
// the arrival card it presses the main button; on the card of a new place it stays here. It never closes the app during
// play: on the title the app goes to the background. While a place loads it does nothing
function back() {
  if (cuts && cuts.playing) { cuts.skip(); return; }
  const open = (s) => !$("#" + s).hidden;
  if (traveling) return;
  if (window.GameSwitch && GameSwitch.isOpen) { GameSwitch.close(); return; }
  if (open("about") || open("privacy")) { closeSub(); return; }
  if (["help", "journal", "settings", "places"].some(open)) { Sound.sfx("uiBack"); closeOverlay(); return; }
  if (open("setup")) { Sound.sfx("uiBack"); setupThen = null; closeOverlay(); return; }
  if (G.paused) { resume(); return; }
  if (G.phase === "cast" || G.phase === "reel" || G.phase === "lost") { Sound.sfx("ui"); pause(); return; }
  if (open("unlock")) { $("#uStay").click(); return; }
  const top = SCREENS.find((s) => s !== "title" && s !== "travel" && open(s));
  const go = top && $("#" + top + " .btn.go:not([hidden])");
  if (go) { go.click(); return; }
  if (G.phase === "title" || G.phase === "boot") Native.minimize();
}
Native.onBack(back);
// Safari: no pinch zoom
document.addEventListener("gesturestart", (e) => e.preventDefault());

/* ---------------- HUD ---------------- */
// short: the HUD chip, which must fit beside the pause button and the clock on a narrow phone: "3/10 · 4.20 kg" in a
// derby, "2 fish · 1.35 kg" in free fishing
function hudText(short) {
  const kg = G.bag.reduce((a, b) => a + b.kg, 0);
  // the next cast is still to come: before the release
  const next = G.phase === "cast" && ["ready", "open", "pinned", "loaded"].includes(G.step);
  const n = Math.min(10, G.casts + (next ? 1 : 0));
  // 100 kg or more (Big Blue) in whole kg, so the chip fits a 360 px phone
  const w = short && kg >= 100 ? Math.round(kg) + " kg" : fmtKg(kg);
  if (G.mode === "derby") return short ? n + "/10 · " + w : "Derby · cast " + n + " of 10 · " + w;
  return (short ? "" : "Free fishing · ") + G.bag.length + " fish · " + w;
}
// the chip cuts the count on a narrow phone, never the weight (its own part); the clock drops AM and PM there (CSS)
function updateHud() {
  const t = hudText(true), i = t.lastIndexOf(" · ") + 3, ct = document.createElement("span"), kg = document.createElement("b");
  ct.className = "ct"; ct.textContent = t.slice(0, i); kg.textContent = t.slice(i);
  $("#modeChip").replaceChildren(ct, kg);
  const h = fmtHour(G.hour), sp = h.indexOf(" "), ampm = document.createElement("span");
  ampm.className = "ampm"; ampm.textContent = h.slice(sp);
  $("#clock").replaceChildren(h.slice(0, sp), ampm);
}

/* ---------------- controls ---------------- */
const keys = {};
addEventListener("keydown", (e) => {
  if (e.repeat && !["KeyR", "KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) return;
  if (window.GameSwitch && GameSwitch.isOpen) return;
  keys[e.code] = true;
  // only a rod input picks the fight words on a computer: a new press of W, A, S, D or an arrow key (or a Space cast,
  // below) names the keys. A key that repeats, Space in the reel, R, E, the brackets and the wheel keep the words
  if (!e.repeat && /^(Key[WASD]|Arrow)/.test(e.code)) G.desk = "keys";
  if (e.code === "Escape" && (!$("#about").hidden || !$("#privacy").hidden)) { closeSub(); return; }
  if (e.code === "Escape" && ["help", "journal", "settings", "places"].some((s) => !$("#" + s).hidden)) { Sound.sfx("uiBack"); closeOverlay(); return; }
  if (e.code === "Escape" || e.code === "KeyP") { if (G.paused) resume(); else pause(); return; }
  if (G.paused) return;
  if (e.code === "KeyE" && G.phase === "cast") { if (G.bail === "closed" && G.step === "ready") openBail("key"); else if (G.bail === "open" && G.step === "open") closeBail(); }
  if (e.code === "Space" && (G.phase === "reel")) { G.hookReq = true; e.preventDefault(); }
  // Space on the catch card presses its button once the photo beat is done (and not in the card's first moment, like the
  // double-tap guard). In the beat after a cast it ends the beat (skipBeat). Either way it goes on into the Space cast
  if (e.code === "Space" && G.phase === "catch" && !$("#catch").hidden) {
    e.preventDefault();
    if (!G.cardWait && now() - shownAt >= CARD_KEY_MS) { G.skip = "key"; $("#catchGo").click(); }
  } else if (e.code === "Space" && skipBeat("key")) e.preventDefault();
  // (a cast that started in this keydown, or in the frame before it, has had no frame to play a legend's first reveal: it
  // plays now, in place of the Space cast)
  if (e.code === "Space" && revealDue()) { e.preventDefault(); playReveal(); }
  // a cast from the keys: hold Space and the rod tips back, then swings forward; let go as it comes through. The arrow
  // keys aim. The rail stands beside the reel box (where a finger would press)
  if (e.code === "Space" && G.phase === "cast" && !cuts.playing && !sensing() && !G.pin && (G.step === "ready" || G.step === "open")) {
    e.preventDefault();
    const rb = $("#reelBox");
    pinLine({ id: "key", x: rb.offsetLeft + rb.offsetWidth / 2, y: rb.offsetTop + rb.offsetHeight / 2, t: now() });
    if (G.pin) { G.pin.key = now(); G.desk = "keys"; }
  }
  if (e.code === "BracketLeft") setDrag(G.drag - 1);
  if (e.code === "BracketRight") setDrag(G.drag + 1);
  // the unlock card shows while the phase is still "catch": there Enter must press the button that has the focus
  if (e.code === "Enter" && G.phase === "catch" && !$("#catch").hidden) { e.preventDefault(); $("#catchGo").click(); }
  syncPadKeys();
});
addEventListener("keyup", (e) => {
  keys[e.code] = false; syncPadKeys();
  if (e.code === "Space" && G.pin && G.pin.id === "key") keyCast();
  if (e.code === "Space" && G.skip === "key") G.skip = null;
});
addEventListener("blur", () => { for (const k in keys) keys[k] = false; syncPadKeys(); if (G.pin && G.pin.id === "key") resetCast(); });
// the catch card takes Space this long after it shows
const CARD_KEY_MS = 300;
// Space held, or a mouse button held still (the hold cast): the rod tips back for BACK_MS, then swings forward at SWING °/s,
// down to END. Letting go casts, graded at the rod angle then, like a finger's: the green band takes about 170 ms to cross.
// The swing is slower than a real stroke so the timing can be seen; FWD is the stroke speed the launch gets
const KEY_CAST = { BACK_MS: 500, BACK_TO: 135, SWING: 240, END: 5, FWD: 600 };
// the rod angle at time t
function keyTheta(t) {
  const K = KEY_CAST, ms = t - G.pin.key;
  return ms < K.BACK_MS ? 80 + (ms / K.BACK_MS) * (K.BACK_TO - 80) : Math.max(K.END, K.BACK_TO - ((ms - K.BACK_MS) * K.SWING) / 1000);
}
function keyCast() {
  const t = now(), space = G.pin.id === "key", early = t - G.pin.key < KEY_CAST.BACK_MS, theta = keyTheta(t);
  G.pin = null;
  if (G.phase !== "cast" || (G.step !== "pinned" && G.step !== "loaded")) return;
  // let go while the rod still goes back: nothing flies, and no derby cast is used up
  if (early) { resetCast(space ? "Hold Space until the rod comes forward." : "Keep holding until the rod comes forward."); return; }
  // the back swing counts in full, even when no frame drew it
  G.backMax = Math.max(G.backMax, KEY_CAST.BACK_TO);
  Motion.virtual({ t, theta, yaw: G.aimYaw, roll: 0 });
  release(t, false, { theta, fwd: KEY_CAST.FWD });
}
function syncPadKeys() {
  if (crank) crank.keyHold(!!keys.KeyR);
  if (rodPad) rodPad.keys({ up: keys.KeyW || keys.ArrowUp, down: keys.KeyS || keys.ArrowDown, left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight });
}
const DRAGS = ["DRAG: LIGHT", "DRAG: MED", "DRAG: HEAVY"];
function setDrag(d) {
  G.drag = clamp(d, 0, 2);
  $("#dragName").textContent = DRAGS[G.drag];
  Sound.sfx("tick"); Haptics.tick();
}
$("#dragDown").addEventListener("click", () => setDrag(G.drag - 1));
$("#dragUp").addEventListener("click", () => setDrag(G.drag + 1));
// the mouse wheel turns the crank (like R, it keeps the fight words: a keys player may reel with it)
addEventListener("wheel", (e) => { if (G.phase === "reel" && crank && !G.paused) { crank.wheel(e.deltaY); e.preventDefault(); } }, { passive: false });
// a mouse press: the fight words on a computer name the mouse moves (a rod key names the keys, see keydown)
addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") G.desk = "mouse"; }, true);
// (aiming with touch or the mouse: a sideways drag before the cast, which the reel panel tells apart from a cast; see boot)
// What a press takes in the cast (the reel panel's grab). Before the cast, with the sensors a press anywhere takes the line
// at once. With touch and the mouse the press waits for the drag: up and down takes the line where it pressed, sideways
// aims, and a mouse button held still is the hold cast. The thumb on the line opens the bail. In the flight a mouse click
// anywhere feathers the line (a finger, on the rod). Stalled sensors: a tap switches to touch, so a press takes nothing.
// True while the cast waits for the line to be taken
function castGrab() {
  const waiting = G.step === "ready" || G.step === "open";
  reelPanel.set({ bail: G.bail, pinned: !!G.pin, line: 0.85, hint: "", glow: waiting ? "pin" : "", touchCast: !sensing(), grab: waiting && !stalled() ? (sensing() ? "all" : "lock") : G.step === "flight" && !sensing() ? "feather" : "" });
  return waiting;
}

/* ---------------- per-frame: the cast ---------------- */
const hangingLure = new HangingLure();
let castFlex = 0, castFlexVelocity = 0;
function castUpdate(dt) {
  const t = now();
  const p = Motion.pose;
  // the sensors went quiet after the player chose motion (a call, a system sheet): after STALL_S the game offers touch.
  // Counted by the clock from the last sample (pose.t; Motion.live turns false LIVE_MS after it), so slow frames count in
  // full; a pause or another phase counts a second at most
  const quiet = G.input === "motion" && !Motion.live, gap = G.quietT ? Math.min(1, (t - G.quietT) / 1000) : 0;
  const since = (t - Motion.pose.t) / 1000, live = Motion.tune.LIVE_MS / 1000;
  G.quietT = t;
  G.quiet = quiet ? (G.quiet ? G.quiet + gap : Number.isFinite(since) ? clamp(since, live, 1) : live) : 0;
  // a motion lift that waits for the rod to reach 11 o'clock, and no sample came: the wait ends here
  if (G.lift) frameLift();
  // touch mode: the finger on the rod is the rod. Drag down = rod back; flick up = forward
  if (!sensing()) {
    let th = 75;
    // the keys: Space held tips the rod back and swings it forward. Held all the way down, it lets go there (late)
    if (G.pin && G.pin.key && (G.pin.theta = keyTheta(t)) <= KEY_CAST.END) { keyCast(); return; }
    if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) th = G.pin.theta;
    else if (G.step === "flight" || G.step === "landed" || G.step === "ashore") th = lerp(p.theta || 60, 60, 1 - Math.exp(-dt * 4));
    Motion.virtual({ t, theta: th, yaw: G.aimYaw, roll: 0 });
    // the arrow keys (or A and D) aim before the cast
    const k = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    if (k && (G.step === "ready" || G.step === "open")) G.aimYaw = clamp(G.aimYaw + k * 40 * dt, -60, 60);
  }
  const yaw = sensing() ? clamp(p.yaw, -75, 75) : G.aimYaw;
  const theta = p.theta;

  // the lure slips down when the bail is open and nothing holds the line
  if (G.bail === "open" && !G.pin && (G.step === "open") && t - G.openAt > 700) {
    const was = G.drop;
    G.drop = Math.min(1.2, G.drop + dt * 0.6);
    Sound.setSpool(G.drop > was ? 1.5 : 0);
  } else if (G.step !== "flight") Sound.setSpool(0);

  if (G.step === "pinned" || G.step === "loaded") {
    G.backMax = Math.max(G.backMax, theta);
    Sound.setSwish(clamp(Math.abs(p.omega) / 900, 0, 1));
    loadCheck(theta);
    // touch: the finger's own stroke (with the sensors on, the sensor callback watches every sample instead)
    if (!sensing() && strokeEnded(p, t)) { Sound.setSwish(0); G.pin = null; release(t, true); return; }
  } else Sound.setSwish(0);

  const flexTarget = G.step === "flight" ? 0 : clamp(Math.abs(p.omega || 0) / 1600, 0, 0.38);
  const flexDt = Math.min(dt, 0.05), flexSteps = Math.max(1, Math.ceil(flexDt * 120));
  for (let i = 0; i < flexSteps; i++) {
    const h = flexDt / flexSteps;
    castFlexVelocity += ((flexTarget - castFlex) * 150 - castFlexVelocity * 14) * h;
    castFlex += castFlexVelocity * h;
  }
  let tip;
  if (G.step === "flight" && G.flight) {
    hangingLure.reset();
    tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, bend: Math.max(0, castFlex), visible: true });
    const r = G.flight.step(dt, !!(G.pin && G.pin.feather));
    Sound.setSpool(r.spool || 0);
    reelPanel.set({ spool: (r.spool || 0) / 0.6 });
    world.setLure({ x: r.x, y: r.y, z: r.z, visible: true, spin: 1 });
    world.setLine({ from: tip, to: { x: r.x, y: r.y, z: r.z }, slack: 0.15, visible: true, flying: true });
    world.setView({ mode: "flight", look: { x: r.x, y: Math.max(r.y, 0), z: r.z }, portrait: G.layout === "tall-cast" });
    // feathering: a finger on the rod (on a computer, the mouse button) slows the line, so the lure drops short onto a target
    if (G.pin && G.pin.feather) { G.feathered = true; prompt(touchDevice ? "Your thumb slows the line." : "The mouse button slows the line.", "", "thumb"); }
    else prompt(save.casts >= 3 && save.casts < 9 ? (touchDevice ? "To stop the lure short, touch the rod." : "To stop the lure short, click the lake.") : "", "", "thumb");
    if (r.done) { Sound.setSpool(0); prompt(""); landed(r); }
    return;
  }
  // a landing in the water goes straight to the reel (see landed); on the shore, the next cast comes by itself (or with a
  // press, skipBeat)
  if (G.step === "landed" && G.sim) { enterReel(); return; }
  if (G.step === "ashore") {
    tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, bend: 0.05, visible: true });
    world.setView({ mode: "cast", yaw, portrait: G.layout === "tall-cast" });
    if (t - G.outcomeAt > ASHORE_MS) beatDone();
    castPrompt();
    return;
  }
  // ready, open, pinned, loaded: the lure hangs under the tip
  tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, bend: Math.max(0, castFlex), visible: true });
  const hanging = hangingLure.step(tip, 0.28 + G.drop, dt);
  world.setLure({ ...hanging, visible: true, spin: 0 });
  world.setLine({ from: tip, to: hanging, slack: 0, visible: true });
  world.setView({ mode: "cast", yaw, portrait: G.layout === "tall-cast" });
  const aiming = G.step === "ready" || G.step === "open" || G.step === "pinned" || G.step === "loaded";
  world.setAim({ yaw, visible: aiming, to: aiming ? aimPreview(yaw) : null });
  castPrompt();
}
// The aim line runs out to where a cast like the last one would land at this heading, and turns amber when that is not
// the water. Before the first cast it is the short line. Worked out again only when the heading moves a degree
function aimPreview(yaw) {
  const c = G.lastCast, key = Math.round(yaw) + ":" + G.place.id;
  if (!c) return null;
  if (G.aimTo && G.aimTo.key === key) return G.aimTo;
  const r = castLanding(rodTip(c.theta, yaw, 0, G.place.stand.rod), { v0: c.v0, pitch: c.pitch, yaw });
  return (G.aimTo = { key, x: r.x, z: r.z, warn: r.land !== "water" });
}
// the sensors stopped: STALL_S without a sample after the player chose motion
const STALL_S = 3;
const stalled = () => G.phase === "cast" && !G.paused && G.input === "motion" && G.quiet >= STALL_S;
function castPrompt() {
  const m = G.input === "motion", key = !!(G.pin && G.pin.key), space = key && G.pin.id === "key";
  if (stalled()) return prompt("The motion sensors stopped. Play with touch?", "Tap the screen to switch.", "stop");
  // held sideways: say so here, without a card in the way (the picture already stays upright on the phone)
  if (m && sensing() && G.step === "ready" && Motion.pose.orient === "landscape") return prompt("Hold the phone upright.", "Like the handle of a rod.", "upright");
  switch (G.step) {
    // touch: a drag down from the press takes the line, a drag sideways aims. A computer: the mouse button held (the hold
    // cast), or Space; a drag sideways or the arrows aim
    case "ready": prompt(m ? "Hold your thumb on the rod." : touchDevice ? "Press anywhere and drag down." : "Hold the mouse button. Let go in the green.", m ? "Turn to aim." : touchDevice ? "Drag sideways to aim." : "Drag sideways to aim. Or hold Space.", "thumb"); break;
    case "open": prompt(m ? "Hold your thumb on the rod." : touchDevice ? "Press and hold anywhere." : "Hold the mouse button. Let go in the green.", G.drop > 0.3 ? "The line is slipping! Hold it." : "Your thumb holds the line.", "thumb"); break;
    case "pinned": prompt(m ? "Tip the phone back over your shoulder." : space ? "Keep holding Space." : key ? "Keep holding." : "Drag down to tip the rod back.", m ? "Keep your thumb down." : "", "back"); break;
    case "loaded": prompt(m ? "Whip it forward. Lift your thumb!" : space ? "Let go of Space in the green." : key ? "Let go in the green." : "Flick up and let go!", m ? "Lift it as the phone tips forward." : "", "flick", "hot"); break;
    default: prompt("");
  }
}

/* ---------------- per-frame: the reel ---------------- */
const HOOK_OMEGA = 300;
// the fish is big for this place, or big for its kind: the warning during the fight
function sayBig() {
  if (!G.big || G.big.said) return;
  G.big.said = true;
  toast("It is a big one!", 2200);
  Haptics.big();
}
function reelUpdate(dt) {
  const sim = G.sim;
  if (!sim) return;
  const t = now();
  // Touch gestures drive the rod directly.
  if (!sensing()) Motion.virtual({ t, theta: rodPad.theta, roll: rodPad.steer, yaw: 0 });
  const p = Motion.pose;
  const theta = clamp(p.theta, -20, 150);
  const steer = clamp(p.roll || 0, -1, 1);
  let crankRate = crank.rate;
  // the first turn of the crank snaps the bail shut, like a real reel
  if (G.bail === "open") { if (crankRate > 0.25) closeBail(); crankRate = 0; }
  let hookset = false;
  if (G.hookReq) { hookset = true; G.hookReq = false; }
  const s = sim.state;
  const pullActive = s.phase === "fight" && s.fish?.move !== "jump" && s.fish?.move !== "sulk" && (s.slip || 0) < 0.15;
  const pull = pullStrength.step(dt, { theta, enabled: G.input === "motion" && Motion.live,
    active: pullActive, crank: crankRate, tension: s.tfrac || 0, session: sim });
  // (no "Tip back as you reel" while the prompt says to stop reeling)
  pullMeter.hidden = G.input !== "motion" || !Motion.live || s.phase !== "fight" || !pullActive || (s.tfrac || 0) > 0.85 || guideCue.icon === "stop";
  pullMeter.querySelector("span").textContent = pull > 0.03 ? "Pull strength +" + Math.round(pull * 35) + "%" : "Tip back as you reel";
  pullMeter.querySelector("i").style.transform = "scaleX(" + pull.toFixed(3) + ")";
  const pullTo = s.fish ? { x: s.fish.x, y: Math.max(s.fish.y, -0.3), z: s.fish.z } : s.lure;
  const tip = world.setRod({ theta, yaw: 0, steer, bend: clamp(s.bend != null ? s.bend : G.tension * 1.3, 0, 1), pull: pullTo, visible: true });
  // the sim bends its own rod: give it the straight rod's tip, not the drawn one
  sim.step(dt, { crank: crankRate, pull, tip: rodTip(theta, 0, steer, G.place.stand.rod), theta, omega: p.omega, steer, drag: G.drag, hookset, lift: theta > 70 });
  G.tension = lerp(G.tension, s.tfrac || 0, 1 - Math.exp(-dt * 12));
  for (const e of sim.events.splice(0)) handleEvent(e);
  // the outcome comes from the sim's phase; events only drive sound, buzz and pictures
  if (s.phase === "caught" && s.catch) { caught(s.catch); heroShot(s.catch); return; }
  if (s.phase === "lost") { outcome("lost", reasonText(s.reason)); return; }
  if (s.phase === "home") { outcome("home", "Nothing this time.", "Cast again. Try a rising ring."); return; }
  if (G.big && t - G.big.at > 4000) sayBig();

  // draw
  const L = s.lure;
  // a beaten fish lies over on its side
  G.roll = lerp(G.roll || 0, s.beaten ? 1.1 : 0, 1 - Math.exp(-dt * 4));
  if (s.fish) {
    const f = s.fish;
    // roll: the body turned about its length, in radians
    world.setFish({ id: f.id, x: f.x, y: f.y, z: f.z, heading: f.heading, len: f.len || 0.4, jump: f.jump || 0, thrash: f.thrash != null ? f.thrash : f.move === "shake" || f.move === "thrash" ? 1 : 0, roll: G.roll, near: f.near == null ? 0.5 : f.near });
    world.setLure({ x: L.x, y: L.y, z: L.z, visible: false });
    world.setLine({ from: tip, to: { x: f.x, y: f.jump ? f.y : Math.max(f.y, -0.25), z: f.z }, slack: s.slack ? 1 : clamp(0.5 - s.tfrac * 2, 0, 0.5), visible: true });
  } else {
    world.setFish(null);
    world.setLure({ x: L.x, y: L.y, z: L.z, visible: true, spin: clamp((L.speed || 0) * 2, 0, 1) });
    world.setLine({ from: tip, to: L, slack: s.slack ? 0.8 : clamp(0.4 - (L.speed || 0) * 0.3, 0.05, 0.4), visible: true });
  }
  world.setFollower(s.follower || null);
  const look = s.fish ? { x: s.fish.x, y: 0, z: s.fish.z } : { x: L.x, y: 0, z: L.z };
  world.setView({ mode: "reel", look, portrait: G.layout === "tall-reel" });
  const sp = s.fish ? byId(s.fish.id) : null;
  // Keep the optional guide in sync with jumping fish.
  rodPad.jump = !!(s.fish && (s.fish.move === "jump" || G.walk || t - (G.lastEvent.jump || -1e9) < 900));
  const known = !!(s.fish && s.fish.known && sp);
  gauge.set({
    tfrac: s.tfrac || 0, dragFrac: (s.dragN || 18) / (s.breakN || 45), slip: s.slip || 0, lineOut: s.lineOut || 0, depth: Math.max(0, -(s.fish ? s.fish.y : L.y)),
    stamina: s.fish ? s.fish.stamina : null, name: s.fish ? (known ? sp.name : "Fish on!") : "",
    rub: s.rub || 0, spool: s.spoolFrac || 0, phases: s.boss ? s.boss.at : null, label: G.big && G.big.said && !known ? "Big fish on!" : "",
    // SLACK after 0.3 s of slack line; TIRED when the fish is beaten (the prompt says "It is tired." then too)
    slack: s.slackT != null ? s.slackT : s.slack ? 1 : 0, tired: s.fish ? !!s.beaten : null,
  });

  // feel
  Sound.setReel(crankRate);
  Sound.setDrag(s.slip || 0);
  Sound.setTension(s.phase === "fight" || s.phase === "land" ? G.tension : 0);
  Sound.setGrind((s.rub || 0) > 0.03 ? s.rub : 0);
  Haptics.setCrank(crankRate);
  Haptics.setTension(G.tension, s.slip || 0, s.phase === "fight" || s.phase === "land");
  Haptics.rub((s.rub || 0) > 0.03 ? s.rub : 0);
  if (s.fish && s.fish.move === "sulk") Haptics.throb();
  reelPrompt(s, crankRate, theta);
}
// how dark it is: 0 by day, 1 at night. Stump Bay is the place where it matters
const nightAt = (h) => (h >= 12 ? smooth(20.5, 22, h) : 1 - smooth(4.6, 5.8, h));
function smooth(a, b, v) { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
// what the cover is called in the prompt
const COVER_NAME = { weeds: "weeds", pads: "lily pads", stumps: "stumps", logs: "logs", rocks: "rocks", wall: "wall", ledge: "ledge" };
// A fight prompt stays up PROMPT_HOLD ms before another takes its place, so it can be read, unless the new one is urgent:
// the strike, a jump, or a risk to the line (too tight, a crank into a slipping drag, a rub, the spool running out)
const PROMPT_HOLD = 350;
function reelPrompt(s, crankRate, theta) {
  const w = fightCue(s, crankRate, theta), t = now(), H = G.hold;
  const key = w.text + "|" + w.sub + "|" + w.icon + "|" + w.tone;
  if (H && key !== H.key && !w.urgent && t - H.at < PROMPT_HOLD) return;
  if (!H || key !== H.key) G.hold = { key, at: t };
  // a jump at the hook set: the "Fish on!" banner gives way, so the words to lower the rod show at once
  if (w.icon === "low" && !$("#banner").hidden) banner("");
  prompt(w.text, w.sub, w.icon, w.tone);
  // the guide and the rod cue say the crank's pace the prompt asks for ("Reel fast."), never their own
  guideCue.pace = w.pace;
}
// what the reel prompt should say now: { text, sub, icon, tone, urgent, pace }. The subs that teach a move use the one set
// of words that the guide and the rod cue use (MOVE_WORDS in guide.js). pace: how fast to crank when the prompt says so
// ("slow", "fast", "faster" or "steady", REEL_PACE in guide.js), "" for a plain turn of the crank
function fightCue(s, crankRate, theta) {
  const m = sensing();
  const t = now();
  const say = (text, sub = "", icon = "", tone = "", urgent = false, pace = "") => ({ text, sub, icon, tone, urgent, pace });
  const words = (kind, side = 0) => moveWords(kind, inputOf(m, touchDevice, G.desk), side);
  const recent = (k, ms) => t - (G.lastEvent[k] || -1e9) < ms;
  // the drag slips in short bursts: the slip prompts stay 0.7 s after the last slip, so they do not flicker
  if ((s.slip || 0) > 0.15) G.slipAt = t;
  const slipRecent = t - (G.slipAt || -1e9) < 700;
  // slack line, said once it has been slack 0.35 s (a flicker of slack is no news)
  const slack = s.slackT != null ? s.slackT >= 0.35 : !!s.slack;
  // the way to steer: side +1 is right
  const dirWord = (side) => (side > 0 ? "right" : side < 0 ? "left" : "");
  const steerSub = (side) => words("turn", side);
  // the bail is still open: say how to start, but let a follower, a nibble or a strike speak for themselves
  if (G.bail === "open" && (s.phase === "sink" || s.phase === "retrieve") && !s.follower && !recent("nibble", 900)) return say(words("reel"), "The first turn closes the bail.", "crank");
  switch (s.phase) {
    case "sink": case "retrieve": {
      if (s.empty) return say("Nothing is biting here.", "Reel in and cast again.", "crank");
      if (recent("nibble", 900)) return nightAt(G.hour) >= 0.5 ? say("It is dark. Feel for the bite.", "Wait for the strike.", "fish") : say("A fish is nibbling.", "Wait for the strike.", "fish");
      if (s.follower) return s.tooFast ? say("Too fast! Reel slower.", "The fish cannot keep up.", "crank", "hot", false, "slow") : say("A fish is following.", "Stop for a moment. It may bite.", "crank");
      // the river: the current swings the lure. Said once
      if (G.place.flow && !save.seen["river.swing"] && $("#report").hidden) { seen("river.swing"); G.swingUntil = t + 4500; }
      if (t < (G.swingUntil || 0)) return say("The current takes your lure.", "Reel slowly. Fish take it at the end of the swing.", "crank", "", false, "slow");
      return say(words("reel"), save.seen.bite ? "" : "Stop now and then. Fish like a pause.", "crank");
    }
    case "strike":
      // the hook-set words, louder: "SNAP IT UP! Set the hook!"
      return say(words("hook").toUpperCase() + " Set the hook!", "", "pull", "hot", true);
    case "fight": {
      const f = s.fish || {};
      // a tail walk goes from its first leap to walkEnd, with the dash on the surface between two leaps. Any other move
      // ends it too (a new stage of a legend)
      if (G.walk && f.move !== "jump" && f.move !== "swim") G.walk = false;
      // 2. a jump, or a tail walk: keep the rod low
      if (G.walk || f.move === "jump" || recent("jump", 900)) return G.walk ? say("It jumps again and again!", words("low"), "low", "hot", true) : say("It jumped! Lower the rod!", words("low"), "low", "hot", true);
      // 3. the line rubs on something: steer it off
      if ((s.rub || 0) <= 0.15) G.rubDir = null;
      else {
        // the side to steer can flip many times a second while the line lies on a post: a new side must hold for 300 ms
        // before the words change (display only). A new kind of rub starts again
        const R = G.rubDir && G.rubDir.kind === s.rubKind ? G.rubDir : (G.rubDir = { kind: s.rubKind, shown: 0, want: 0, since: t }), side = s.rubSide || 0;
        if (!R.shown) R.shown = R.want = side;
        else if (side && side !== R.shown) {
          if (side !== R.want) { R.want = side; R.since = t; }
          if (t - R.since >= 300) R.shown = side;
        } else if (side) R.want = side;
        const d = dirWord(R.shown), steer = " Steer " + (d || "away") + ".", K = s.rubKind;
        return say(K === "stump" ? "The line is on a stump!" + steer : K === "logs" ? "The line is on the logs!" + steer : K === "rocks" ? "The line is on the rocks! Hold the rod up." : "It is in the weeds!" + steer, steerSub(R.shown), K === "rocks" ? "pull" : "turn", "hot", true);
      }
      // 4. its last run. A fish of the wall swims at you and the line goes slack: then reel
      if (recent("lastrun", 2000)) return slack ? say("Slack line! Reel it in.", "Keep the line tight.", "crank", "hot", false, "fast") : say("It sees you! Let it run.", "Reel only if the line goes slack. Hold the rod up.", "stop", "hot");
      // the tuna's first run: the banner says to let it go, and so does the prompt
      if (s.boss && s.boss.n === 1 && /let it go/i.test(s.boss.name || "") && f.move === "run" && (s.fightT || 0) < 2.5) return say("It runs! Let it go.", "Hold the rod up. Reel only if the line goes slack.", "pull", "hot");
      // a head shake: the fish swims in as it shakes, so a slack line is the danger, and the prompt says so
      if (f.move === "thrash" || f.move === "shake" || recent("shake", 700)) return slack ? say("Slack line! Reel it in.", "It shakes its head. Keep the rod up.", "crank", "hot", false, "fast") : say("It shakes its head!", words("raise") + " Keep reeling slowly.", "pull", "hot");
      if (f.move === "turn" || recent("turn", 1200)) return say("It turned. Stop reeling!", "", "stop", "hot");
      if (f.move === "charge") return say("It swims at you! Reel fast.", "Reel until the line is tight.", "crank", "hot", false, "fast");
      if (slipRecent && crankRate > 0.3) return say("The drag is slipping. Stop reeling.", "Hold the rod up. Let it run.", "stop", "hot", true);
      if ((s.tfrac || 0) > 0.85) return say("Too tight! Stop reeling.", "Hold the rod up. Let the drag work.", "stop", "hot", true);
      // only while the drag slips: a full spool warning that stays up would hide the rest and the sulk
      if ((s.spoolFrac || 0) > 0.75 && slipRecent) return G.drag < 2 ? say("The spool is almost empty!", words("drag"), "stop", "hot", true) : say("The spool is almost empty!", "Hold on. Keep the rod up.", "pull", "hot", true);
      if (f.move === "hold") return say("It rests. Rest your arm.", "Keep the line tight.", "fish", "good");
      // a fish on the bottom comes up with the pump, the same move as the pump and reel
      if (f.move === "sulk") return say("It holds on the bottom.", words("pump"), "pull");
      if (s.cover) return say("It swims to the " + (COVER_NAME[s.cover.kind] || s.cover.kind) + "!", steerSub(s.cover.steer != null ? s.cover.steer : -s.cover.side), "turn", "hot");
      if (slipRecent) return say("It is running. Let it go.", "Keep the rod up. Reel when it stops.", "pull");
      // a tired fish swims in faster than a steady crank: the line goes slack, and the words stay green
      if (slack && s.beaten) return say("It is tired. Reel a little faster.", "Keep the line tight.", "crank", "good", false, "faster");
      if (slack) return say("Slack line! Reel it in.", "", "crank", "hot", false, "fast");
      if (s.beaten) return say("It is tired. Reel steadily.", "Slow down if the gauge says TOO TIGHT.", "crank", "good", false, "steady");
      if (theta < 28) return say("Your rod is too low.", words("raise"), "pull");
      return say("Pump and reel.", words("pump"), "pull");
    }
    case "land": return say(G.place.id === "sea" ? "Bring it to the wall!" : "Lift it out!", words("land"), "pull", "good");
    default: return say("");
  }
}
function handleEvent(e) {
  const type = typeof e === "string" ? e : e.type;
  G.lastEvent[type] = now();
  noteFight(type, e);
  const s = G.sim && G.sim.state;
  const fx = e.x != null ? e.x : s && s.fish ? s.fish.x : s ? s.lure.x : 0;
  const fz = e.z != null ? e.z : s && s.fish ? s.fish.z : s ? s.lure.z : 0;
  switch (type) {
    // a nibble taps the rod tip; the strike pulls it down hard, with its own buzz and sound as hard as it hit
    case "nibble": Sound.sfx("nibble", e.s); Haptics.bump(e.s == null ? 0.5 : e.s); world.twitch(0.12 + 0.15 * (e.s == null ? 0.5 : e.s)); if (crankPad) crankPad.forceTick(); if (s) world.ripple(s.lure.x, s.lure.z, 0.3); seen("bite"); break;
    case "strike": Sound.sfx("strike", e.s); Haptics.thump(e.s); flash(); world.twitch(0.7, 60); if (crankPad) crankPad.forceTick(); if (s) world.splash(s.lure.x, s.lure.z, 0.35); if (G.gift) G.gifted = true; break;
    case "hooked": {
      if (e.junk) { Sound.sfx("junk"); toast("Something heavy is on the line. Reel it in.", 2200); }
      else {
        // the hook set, the biggest hit of the fight: the lake freezes for a moment, the view punches in, the rod whips,
        // "Fish on!" fills the prompt's place, a deep thump and the longest buzz yet. A set within 250 ms of the strike
        // says so. Calm effects keep the words, the sound and the buzz, and skip the freeze and the punch (world.js)
        Sound.sfx("hookset"); Haptics.hookset();
        world.freeze(70); world.punch(); world.twitch(0.9, 150);
        if (s && s.fish) world.splash(s.fish.x, s.fish.z, 0.4);
        banner(e.self ? "It hooked itself! Fish on!" : "Fish on!", !e.self && now() - (G.lastEvent.strike || -1e9) < 250 ? "Quick set!" : "");
      }
      // the ring's fish is on the line: its ring goes quiet
      if (G.ring && rises && rises.take) { rises.take(G.ring); G.ring = null; }
      // a big one gets a warning at the first run of the drag, or 4 s from now
      const hs = !e.junk && byId(e.id || (s && s.fish && s.fish.id)), kg = s && s.fish ? s.fish.kg : 0;
      G.big = hs && kg > 0 && isBigFish(G.place.id, kg, sizeRank(hs, kg)) ? { at: now(), said: false } : null;
      G.walk = false;
      // the legend of this place is on the line: its reveal is past, and never plays after this
      if (hs && hs.legend) {
        const rid = revealId(G.place.id), mark = !save.cuts[rid];
        save.cuts[rid] = 1;
        if (legendStep(save, G.place.id, 2) || mark) persist();
      }
      break;
    }
    case "drag": sayBig(); break;
    case "missed": case "spooked": Sound.sfx("miss"); break;
    case "refuse": Sound.sfx("miss"); toast("Too fast. It turned away. Reel slower.", 2600); break;
    case "slack": Sound.sfx("slip"); Haptics.bump(0.3); break;
    // a leap: the view zooms in on the fish as it comes up, and eases back after it lands (world.js)
    case "jump": Sound.sfx("jump", e.size); Haptics.splash(0.8); world.splash(fx, fz, e.size || 0.8); world.jumpZoom(); break;
    case "splash": world.splash(fx, fz, e.size || 0.5); Sound.sfx("splash", e.size || 0.5); break;
    // a run starts with a click of the drag and a buzz, so a thumb on the crank has time to stop. The tip is said once,
    // and marked seen only when it has shown
    case "run": case "surge":
      Sound.sfx("ratchet"); Haptics.bump(0.5);
      if (!save.seen.run) toast("It is running! Let the drag work.", 2400, () => seen("run"));
      break;
    case "shake": Haptics.bump(0.7); break;
    case "reveal": {
      const sp = byId(e.id || (s && s.fish && s.fish.id));
      if (sp) toast(revealText(sp, !!G.big), 2000);
      if (G.big) G.big.said = true;
      break;
    }
    case "near": Sound.sfx("splash", 0.3); world.splash(fx, fz, 0.3); Haptics.bump(0.8); break;
    // the fight moves. Each has a warning: a sound and a buzz
    case "charge": Sound.sfx("slip"); Haptics.charge(); break;
    case "turn": Haptics.turn(); break;
    case "sulk": Sound.sfx("creak"); Haptics.throb(); break;
    case "pump": Haptics.bump(0.4); break;
    case "unstuck": Sound.sfx("splash", 0.3); world.splash(fx, fz, 0.3); break;
    case "walk": G.walk = true; break;
    case "walkEnd": G.walk = false; break;
    case "thrash": Haptics.thrash(); Sound.sfx("splash", 0.4); world.splash(fx, fz, 0.4); break;
    case "turned": toast("You turned it!", 1800); break;
    // its own warning: the snap buzz would say the line broke, and its silence would hide the drag
    case "lastrun": Haptics.surge(); break;
    // a legend's next stage: a drum roll and a horn that does not resolve (no victory yet). Its first stage comes with the
    // hook set, whose banner, sound and buzz say it
    case "phase": toast(e.name, 2200); if (e.n > 1) { Sound.sfx("stage"); Haptics.phase(); } break;
    case "spool": Sound.sfx("slip"); Haptics.bump(0.8); break;
    case "snap":
      // a line that rubbed through, or ran out: the loss line says which
      Sound.sfx(e.reason === "weeds" || e.reason === "rocks" || e.reason === "stump" || e.reason === "logs" ? "thrown" : "snap"); Haptics.jolt(); flash(); break;
    // (a slack line in a head shake has its own tip: keep reeling slowly)
    case "thrown": G.thrownBy = e.jump ? "jump" : e.thrash ? "thrash" : e.charge ? "charge" : s && s.fish && /shake|thrash/.test(s.fish.move) ? "shake" : "slack"; Sound.sfx("thrown"); Haptics.jolt(); break;
    case "home": Sound.sfx("plop"); break;
  }
}
// what went wrong, and the one move that would have saved it (journey.js has the lines)
function reasonText(r) {
  const s = G.sim && G.sim.state, sp = s && s.fish && byId(s.fish.id), input = inputOf(sensing(), touchDevice, G.desk);
  return lossText(r, { input, by: G.thrownBy, cause: s && s.cause, hook: moveWords("hook", input), turn: moveWords("turn", input), legend: sp && sp.legend ? G.place.id : null });
}

/* ---------------- the cutscenes ---------------- */
// cutscenes.js draws them over the live lake; here is when they play, and what comes after. Each plays once (save.cuts,
// marked as it starts), never in a fight or while the lure flies. While one plays, step() holds the fish, the clock and
// the derby, the toasts wait, and a press, Space, Escape or back skips it (cutscenes.js and back())
const cutSeen = (id) => !!save.cuts[id];
// then(skipped) runs when it ends. mark: false for a replay
function playCut(script, then, mark = true) {
  if (mark && script.id && !save.cuts[script.id]) { save.cuts[script.id] = 1; persist(); }
  prompt(""); hideReport();
  // a press in progress (a mouse button held, a finger that has not dragged yet) is dropped: it never casts under the
  // cutscene, and the player presses again after it. step() sets no grab while one plays, so the grab goes off here, and
  // comes back as it ends (below)
  if (reelPanel) { reelPanel._cancelAll(); reelPanel.set({ grab: "" }); }
  // a toast that is up (a catch's news, over the hero shot) waits too, and shows again after, and so do the ones in line.
  // The cutscene cut it short, so it is kept: no newer toast or slow frame drops it
  const T = $("#toast");
  if (T.classList.contains("on")) { heldToasts.push([T.textContent, 1800 + 1200 * T.textContent.split("\n").length, null, true]); T.classList.remove("on"); }
  for (const q of toastQ.splice(0)) heldToasts.push([q.msg, q.ms, q.onShow, q.keep]);
  clearTimeout(toastNextT); toastNextT = 0;
  cuts.play(script, (skipped) => {
    then(skipped);
    // the cast grab at once, not on the next frame: a press that comes before a slow frame takes the line (none while
    // another cutscene plays, one that then() started)
    if (G.phase === "cast" && !cuts.playing) castGrab();
    for (const a of heldToasts.splice(0)) toast(...a);
  });
}
// the opening: the first "Go fishing" on a fresh save (one that has never cast)
const openingDue = () => !cutSeen(arriveId("loon")) && G.place.id === "loon" && save.casts === 0 && save.caught === 0;
// the first visit to a place: its fly-in at its own hour, then the arrival card (straight to the card once seen)
function flyIn(id, then) {
  if (cutSeen(arriveId(id))) { then(); return; }
  G.hour = startHour(id, "free"); world.setHour(G.hour); Sound.setAmbience(true, G.hour);
  show(null);
  playCut(arrivalCut(G.place), () => then());
}
// The first gold ring of this place's legend: its reveal, in the cast before the line is held (never in a fight or while
// the lure flies; a ring that rose then waits on the water for the cast). From the first fish landed on, so a new player's
// first casts go to the first fish. Play goes on from the same cast state
function revealDue() {
  return G.phase === "cast" && (G.step === "ready" || G.step === "open") && !(cuts && cuts.playing) && !G.pin && !G.lift && save.caught > 0 && !cutSeen(revealId(G.place.id)) && !!rises && rises.list.some((g) => g.gold);
}
function playReveal() {
  const g = rises.list.find((q) => q.gold);
  // the ring is said: no toast for it after
  G.goldAt = { x: g.x, z: g.z };
  playCut(revealCut(G.place, g), () => {});
}
// A legend landed for the first time: the hero shot before its card (the photo beat waits for it, then the flash and the
// card come as they would). The fourth legend: the finale comes after its card (see below)
function heroShot(c) {
  const sp = byId(c.id);
  if (!sp || !sp.legend) return;
  if (legendsLanded(save) >= ORDER.length && !cutSeen("finale")) G.finale = true;
  if (cutSeen(landedId(G.place.id)) || !G.cardWait) return;
  clearTimeout(cardT);
  // the fish alone in the whole view: the card is not up yet
  world.setView({ mode: "catch" });
  playCut(landedCut(G.place, c), () => {
    flash("photo"); Sound.sfx("shutter"); Haptics.shutter();
    cardT = setTimeout(() => { G.cardWait = false; $("#catch").classList.remove("wait"); countUp(c, false, sizeRank(sp, c.kg)); }, (PHOTO.card - PHOTO.flash) * 1000);
  });
}
// the finale: the card's button (or Enter, or back) plays it first, then does what it does
$("#catch").addEventListener("click", (e) => {
  if (!G.finale || G.cardWait || !e.target.closest || !e.target.closest("#catchGo")) return;
  e.stopPropagation();
  G.finale = false;
  Sound.sfx("ui");
  clearTimeout(cardT); clearInterval(countT);
  show(null); world.hideCatch(); world.setView({ mode: "title" });
  playCut(finaleCut(G.place), () => $("#catchGo").click());
}, true);
// "Watch" on a Places card: that place's arrival and its legend's reveal, the ones seen, one after the other (a skip ends
// the replay). Another place loads behind the travel card, and the place you are at comes back after. Then the Places card
async function watch(id) {
  if (traveling || cuts.playing || !openNow(id)) return;
  const home = G.place.id, list = [arriveId(id), revealId(id)].filter(cutSeen);
  if (!list.length) return;
  const trip = async (to) => {
    $("#travelTxt").textContent = "On the way to " + JOURNEY[to].name + ".";
    show("travel");
    traveling = true;
    const p = await switchPlace(to);
    traveling = false;
    return p;
  };
  const done = async () => {
    world.setRings([]); world.setFish(null);
    if (G.place.id !== home) await trip(home);
    G.hour = startHour(G.place.id, "free"); world.setHour(G.hour); Sound.setAmbience(true, G.hour);
    renderPlaces();
    show("places");
  };
  if (id !== home && !(await trip(id))) { await done(); toast(JOURNEY[id].name + " did not load.", 3600); return; }
  G.hour = startHour(id, "free"); world.setHour(G.hour); Sound.setAmbience(true, G.hour);
  show(null);
  const ring = ringSpot(G.place);
  const next = (i) => {
    const reveal = list[i] === revealId(id);
    // the legend's ring on the water, seen from the cast view (its glow shows there)
    if (reveal) { world.setRings([{ x: ring.x, z: ring.z, gold: true }]); world.setView({ mode: "cast" }); }
    playCut(reveal ? revealCut(G.place, ring) : arrivalCut(G.place), (skipped) => { if (!skipped && i + 1 < list.length) next(i + 1); else done(); }, false);
  };
  next(0);
}

/* ---------------- the loop ---------------- */
let last = now(), fpsAcc = 0, fpsN = 0, drew = false, drawAt = 0, menuDt = 0;
// the title over the live lake (the Original style, and the Painted one away from Loon Lake) is a menu: the lake draws
// there at 15 frames a second at most
const MENU_MS = 66;
// An opaque screen covers the lake: a dimmed card, or the title with its painted picture. Read again only when the
// screen, the art style or the place changes
let coverKey = "", coverTitle = false;
function covered() {
  if (document.querySelector(".screen.dim:not([hidden])")) return true;
  const key = (document.body.dataset.screen || "") + "|" + (document.body.dataset.artStyle || "") + "|" + (document.body.dataset.place || "");
  if (key !== coverKey) { coverKey = key; const t = $("#title"); coverTitle = !t.hidden && /url\(/.test(getComputedStyle(t).backgroundImage); }
  return coverTitle;
}
function frame() {
  requestAnimationFrame(frame);
  const t = now();
  let dt = (t - last) / 1000;
  // the render scale reads only the frames that drew the lake: a frame under a still screen costs nothing. A new pixel
  // ratio clears the canvas, so a still lake is drawn again
  if (!SHOT && world && world.frameTime && drew && world.frameTime(t - last)) G.stillDrawn = false;
  last = t;
  if (!(dt > 0)) dt = 0.016;
  G.frame++;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  // a slow frame still moves the game on in real time, in steps of at most 50 ms; a long stall is not caught up
  dt = Math.min(dt, 0.25);
  relayout();
  if (!world) return;
  // no play while the GL context is lost (the lake would not show): play that starts or goes on then is paused
  if (G.ctxLost && !G.paused) pause();
  if (!G.paused) for (let left = dt; left > 1e-4; left -= 0.05) step(Math.min(left, 0.05));
  // (touch: false is a computer, and desk its last input, the mouse or the keys. hold: the hold cast, as the rod cue has it)
  guide.update({ phase: G.phase, step: G.step, motion: sensing(), touch: touchDevice, desk: G.desk, hold: !!(G.pin && G.pin.key),
    pullAvailable: !pullMeter.hidden && (G.sim?.state.tfrac || 0) < 0.65,
    fishPhase: G.sim && G.sim.state.phase, paused: G.paused, cue: guideCue }, t / 1000);
  dt = Math.min(dt, 0.05);
  // under the pause menu, the dimmed screens and the painted title the lake stands still: draw it once, then let the
  // GPU rest. A lost GL context draws nothing until it is back. The title over the live lake draws it less often
  const still = G.paused || G.ctxLost || covered(), menu = !still && G.phase === "title" && !(cuts && cuts.playing);
  menuDt = menu ? menuDt + dt : 0;
  drew = still ? !G.stillDrawn : !menu || t - drawAt >= MENU_MS;
  if (drew) { world.update(menu ? menuDt : dt); world.render(); drawAt = t; menuDt = 0; }
  G.stillDrawn = still;
  // (the rod cue hides while stalled sensors offer touch: the tap is the only move then)
  rodCues.update({ world, phase: G.phase, step: G.step, motion: sensing(), desk: G.desk,
    paused: still || stalled(), cue: guideCue, fish: G.sim?.state, nibble: t - (G.lastEvent.nibble || -1e9) < 900,
    held: !!G.pin || !!rodPad?.drag, hold: !!(G.pin && G.pin.key) });
  // the touch rail beside the finger while it holds the line (for the keys, beside the reel box: it times the release). A
  // hold cast (Space, the mouse button) moves the rod by the clock: its rail stands where all of it shows
  const railPin = !still && G.phase === "cast" && !sensing() && G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded") ? G.pin : null;
  castRail.update(railPin && { x: railPin.x0, y0: railPin.y0, theta: railPin.theta, span: railPin.span, fit: !!railPin.key });
  if (!$("#reelUI").hidden) { crank.draw(dt); gauge.draw(dt); if (!rodPad.hidden) rodPad.draw && rodPad.draw(dt); }
  if (DEBUG) debug();
}
function step(dt) {
  // a cutscene holds the fish, the clock, the derby and the cast, and moves itself on
  if (cuts && cuts.playing) { cuts.update(dt); return; }
  const inPlay = G.phase === "cast" || G.phase === "reel" || G.phase === "lost";
  if (inPlay) {
    // the day goes by: an hour every 75 s in free fishing; the derby stays at golden hour (journey.js has the clock)
    const was = G.hour, day = stepHour(G.place.id, G.hour, dt, G.mode);
    G.hour = day.hour;
    if (day.wrapped) toast(journeyOf(G.place.id).newDay);
    if (Math.floor(was * 6) !== Math.floor(G.hour * 6)) { world.setHour(G.hour); Sound.setAmbience(true, G.hour); updateHud(); }
    if (rises) {
      const ev = rises.step(dt, G.hour) || [];
      for (const e of ev) if (e.type === "rise") {
        world.rise(e.x, e.z);
        if (e.gold) {
          // said once for each ring (it pulses every few seconds), and not in the middle of a fight
          // (the first ring of the legend here plays its reveal instead, see revealDue)
          if (G.phase !== "reel" && !(G.goldAt && Math.hypot(e.x - G.goldAt.x, e.z - G.goldAt.z) < 1)) { G.goldAt = { x: e.x, z: e.z }; if (!revealDue()) toast("A gold ring! Something big is rising.", 2600); }
          if (legendStep(save, G.place.id, 1)) persist();
        } else ringNews(e);
      }
      // the rings only change when one rises or goes quiet
      if (ev.length || rises.list.length !== G.ringN) { G.ringN = rises.list.length; world.setRings(rises.list); }
      if (revealDue()) { playReveal(); return; }
    }
  } else if (G.phase === "title") {
    world.setView({ mode: "title" });
  }
  switch (G.phase) {
    case "cast": {
      castUpdate(dt);
      if (G.phase !== "cast") break;
      const waiting = castGrab();
      // a thumb that stayed down from the last cast (it never lifted) holds the line now
      if (waiting && !G.pin && reelPanel.pinId != null && reelPanel.thumb) pinLine({ id: reelPanel.pinId, x: reelPanel.thumb.x, y: reelPanel.thumb.y, t: now(), hold: reelPanel.holding });
      if (G.step !== "flight") reelPanel.set({ spool: G.drop > 0 && G.drop < 1.2 && G.bail === "open" && !G.pin ? 1.2 : 0 });
      break;
    }
    case "reel": reelUpdate(dt); break;
    case "lost": {
      Sound.setReel(0); Sound.setDrag(0); Sound.setTension(0); Haptics.setCrank(0); Haptics.setTension(0, 0, false);
      // the fish swims off and sinks out of sight; a thrown hook leaves the line limp, a broken one leaves nothing
      const g = G.gone, k = g ? (now() - G.outcomeAt) / GONE_MS : 1;
      world.setFollower(null);
      if (g && k < 1) {
        const F = g.fish, m = 3 * k;
        world.setFish({ ...F, x: F.x + g.dx * m, z: F.z + g.dz * m, y: F.y - 0.9 * k, heading: Math.atan2(g.dx, -g.dz), jump: 0, thrash: 0.4 * (1 - k), roll: 0, near: 0.6 * (1 - k) });
        world.setLine({ from: world.tip(), to: { x: F.x, y: -0.05, z: F.z }, slack: 1, visible: g.limp });
        world.setLure({ x: F.x, y: -0.05, z: F.z, visible: g.limp, spin: 0 });
      } else { world.setFish(null); world.setLine({ visible: false }); world.setLure({ x: 0, y: -5, z: 0, visible: false }); }
      if (now() - G.outcomeAt > (G.lossMs || LOSS_MS)) beatDone();
      break;
    }
    // wide: the card sits on the right, so frame the fish in the part of the lake left free.
    // tall: the card covers the bottom of the view (bottom: its share of the height), so frame the fish above it
    case "catch": {
      const wide = G.layout === "reel", card = $("#catch .card");
      world.setView({ mode: "catch", inset: wide ? Math.min(0.6, (card.offsetWidth + 32) / Math.max(1, game.clientWidth)) : 0, bottom: wide ? 0 : Math.min(0.62, (card.offsetHeight + 24) / Math.max(1, game.clientHeight)) });
      break;
    }
    case "results": world.setView({ mode: "title" }); break;
  }
}
function debug() {
  const p = Motion.pose, s = G.sim && G.sim.state;
  $("#dbg").hidden = false;
  $("#dbg").textContent = [
    "input " + G.input + " · " + Motion.status + (Motion.live ? " live" : ""),
    "θ " + (p.theta || 0).toFixed(1) + "  ω " + (p.omega || 0).toFixed(0) + "  yaw " + (p.yaw || 0).toFixed(1),
    "roll " + (p.roll || 0).toFixed(2) + "  twist " + (p.twist || 0).toFixed(0) + "  " + p.orient + " side " + p.side,
    "phase " + G.phase + " · " + G.step + " · bail " + G.bail + " · rot " + G.rot + " · " + G.layout,
    G.cast ? "cast v0 " + G.cast.v0.toFixed(1) + " pitch " + G.cast.pitch.toFixed(0) + " " + G.cast.verdict + " " + G.cast.clock : "",
    // for the calibration on a real phone: the last lift against the 11 o'clock crossing, and the swing it read
    G.lastRelease && G.lastRelease.errMs != null ? "lift " + G.lastRelease.errMs.toFixed(0) + " ms  swing " + G.lastRelease.fwd.toFixed(0) + " °/s" : "",
    s ? "sim " + s.phase + " T " + (s.tension || 0).toFixed(1) + "N slip " + (s.slip || 0).toFixed(2) + " line " + (s.lineOut || 0).toFixed(1) : "",
    "fps " + G.fps.toFixed(0) + (world && world.info ? " · " + JSON.stringify(world.info()) : ""),
  ].filter(Boolean).join("\n");
}

/* ---------------- the GL context ---------------- */
// The context went away (the app was in the background, the GPU reset): play pauses, Resume waits, and nothing draws
// until it is back. Then the lake draws again, also under the pause screen, and Resume works. A context still lost 4 s
// after the page shows gets the boot card, with Try again
let ctxT = 0;
function onContext(kind) {
  clearTimeout(ctxT);
  if (kind === "lost") {
    G.ctxLost = true;
    pause();
    if (G.paused) pauseSum();
    const check = () => { if (!G.ctxLost) return; if (document.hidden) ctxT = setTimeout(check, 4000); else { pause(); if (window.fishBoot) fishBoot.fail("gpu"); } };
    ctxT = setTimeout(check, 4000);
    return;
  }
  G.ctxLost = false;
  G.stillDrawn = false;
  if (G.paused) pauseSum();
  if (window.fishBoot && $("#boot").dataset.kind === "gpu" && !$("#boot").hidden) fishBoot.done();
}
const hasGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } };

/* ---------------- boot ---------------- */
async function boot() {
  // the app: the whole screen is the lake
  Native.hideStatusBar();
  try {
    REEL_UI.maxDpr = quality() === "low" ? 1.5 : SHOT ? 3 : 2;
    // the map first: the world builds the place the map is set to
    LAKE.setPlace(G.place);
    world = await createWorld($("#view"), { quality: quality(), place: G.place, style: save.artStyle });
  } catch (err) {
    console.error(err);
    // the boot screen says what went wrong (no WebGL, or something else), with Try again
    if (window.fishBoot) fishBoot.fail(hasGL() ? "load" : "webgl");
    return;
  }
  if (window.fishBoot) fishBoot.step(0.9);
  world.onContext(onContext);
  world.setHour(G.hour);
  Sound.setPlace(G.place.id);
  reelPanel = new ReelPanel($("#reelBox"), { toLocal, hand: "right", area: game, direct: true });
  reelPanel.on("bail", (e) => {
    if (G.paused || G.phase !== "cast") return;
    if (e.open && G.step === "ready") openBail("swipe");
    else if (!e.open && G.bail === "open" && G.step === "open") closeBail();
  });
  // (a press that takes the line while a cutscene plays is dropped, so none waits to take it after the cutscene)
  reelPanel.on("pin", (e) => { if (cuts && cuts.playing) reelPanel._cancelAll(); else if (!G.paused) pinLine(e); });
  reelPanel.on("pinmove", (e) => {
    if (!G.pin || G.pin.feather || e.id !== G.pin.id) return;
    // touch casting: finger height is the rod angle. Drag down to tip it back, flick up to cast (touchTheta in cast.js)
    G.pin.theta = touchTheta(e.y - G.pin.y0, G.pin.span);
    G.pin.back = Math.max(G.pin.back || 0, G.pin.theta);
    // one clock for the finger: pointer times are input times and can run behind the frame's own samples
    if (!sensing()) Motion.virtual({ t: now(), theta: G.pin.theta, yaw: G.aimYaw, roll: 0 });
  });
  reelPanel.on("unpin", (e) => unpinLine(e));
  // a sideways drag before the cast aims, and so does the mouse while it holds the line (the hold cast): a fifth of a degree
  // for each pixel
  let aimFrom = 0;
  reelPanel.on("aim", (e) => {
    if (G.paused || (cuts && cuts.playing) || G.phase !== "cast" || sensing() || !["ready", "open", "pinned", "loaded"].includes(G.step)) return;
    if (e.start) aimFrom = G.aimYaw;
    G.aimYaw = clamp(aimFrom + e.dx * 0.2, -60, 60);
  });
  // stalled sensors: a tap on the lake switches this session to touch (the saved choice stays motion)
  game.addEventListener("pointerdown", (e) => {
    if (!stalled() || (e.target.closest && e.target.closest("button, a, input, select, label, .screen, #hud, #cut"))) return;
    e.stopPropagation();
    G.input = "touch"; G.quiet = 0; G.stallTouch = true;
    resetCast();
    relayout(true);
    Sound.sfx("ui");
    toast("Touch play is on.", 2200);
  }, true);
  // the beat after a cast: a press on the lake ends it (skipBeat), and the reel panel, which hears the press after this,
  // takes it into the new cast. A press on the crank, the rod pad or the gauge ends it too, but goes no further: a player
  // still cranking or pumping the rod never meant to cast. "Nothing this time." had no fish on, so nobody pumps: there a
  // press on the rod pad (over the drawn rod) casts like a press on the lake. A press on a button, a screen or the drag
  // bar does nothing
  game.addEventListener("pointerdown", (e) => {
    if ((e.pointerType === "mouse" && e.button !== 0) || blocked(e.target, game) || (e.target.closest && e.target.closest("#dragBar"))) return;
    const rod = G.phase === "lost" && G.beat === "home" && !!(e.target.closest && e.target.closest("#padBox"));
    const fight = !rod && !!(e.target.closest && e.target.closest("#reelUI"));
    if (!skipBeat(fight ? null : e.pointerId)) return;
    if (fight) e.stopPropagation();
    else if (G.phase === "cast" && !cuts.playing) castGrab();
  }, true);
  const skipUp = (e) => { if (e.pointerId === G.skip) G.skip = null; };
  addEventListener("pointerup", skipUp, true);
  addEventListener("pointercancel", skipUp, true);
  // every sensor sample: catch quick moves that a slow frame could miss
  Motion.on((pose) => {
    if (G.input !== "motion" || G.paused) return;
    const t = pose.t || now();
    // the hook set: a real snap up, fast for a moment, and the rod rose more than 10° in the last 150 ms
    if (G.phase === "reel" && t - G.lastHook > 450 && pose.omega > HOOK_OMEGA && pose.theta - Motion.at(t - 150).theta > 10) {
      G.hookReq = true; G.lastHook = t;
      return;
    }
    if (G.phase !== "cast") return;
    // an early lift waits for this: the first sample past 11 o'clock launches the lure
    if (G.lift) { frameLift(t); return; }
    // the rod loads the moment it passes back over the shoulder, even between two frames
    if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) {
      G.backMax = Math.max(G.backMax, pose.theta);
      loadCheck(pose.theta);
      if (strokeEnded(pose, t)) { Sound.setSwish(0); G.pin = null; release(t, true); }  // release() lifts the buzz mute
    }
  });
  crank = new Crank($("#crankBox"), { toLocal, hand: "right" });
  // touch play: the crank sits on the left, so a fast fling up on the open lake (not on the crank) sets the hook in a
  // strike. The rod's own swipe up works as before, at any time
  rodPad = new RodPad($("#padBox"), { toLocal, direct: true, area: game, skip: [$("#crankBox"), $("#dragBar")] });
  rodPad.on("yank", () => { if (G.phase === "reel") G.hookReq = true; });
  rodPad.on("fling", () => { if (G.phase === "reel" && !sensing() && G.sim && G.sim.state.phase === "strike") G.hookReq = true; });
  gauge = new Gauge($("#gaugeBox"));
  $("#view").addEventListener("transitionend", (e) => { if (e.target.id === "view") resizeView(); });
  // iPhone: only a real finger on a switch control can tick. The reel face and the crank carry hidden switches
  Haptics.attachPad($("#reelBox"));
  crankPad = Haptics.attachCrank($("#crankBox"), { toLocal });
  setDrag(1);
  cuts = createCutscenes({ world, root: game, sound: Sound, touch: touchDevice });
  window.FISH = {
    G, Motion, get world() { return world; }, get crank() { return crank; }, get sim() { return G.sim; }, get save() { return save; },
    startMode, newCast, toTitle, release, openBail, closeBail, enterReel, relayout, toLocal, pinLine, unpinLine, get rises() { return rises; },
    get reelPanel() { return reelPanel; }, get rodPad() { return rodPad; },
    // go to an open place, with no cards (a Promise: true when it loaded). The player's way is the Places screen
    async setPlace(id) {
      if (!openNow(id) || traveling) return false;
      stopPlay();
      const p = await switchPlace(id);
      if (p && isOpen(save, id)) { save.place = id; persist(); }
      toTitle();
      return !!p;
    },
    get place() { return G.place; }, PLACES, JOURNEY,
    // for the tests: the parts a test watches or listens to
    get gauge() { return gauge; }, Sound, Haptics,
    // the cutscene player (playing, id, state, skip()), and the replay of a Places card
    get cuts() { return cuts; }, watch,
  };
  toTitle();
  // the title is ready: the boot screen and the app's splash screen go
  if (window.fishBoot) fishBoot.done();
  Native.hideSplash();
  // an old save that already holds a big fish: tell the player which place it opened, once
  const told = untoldOpens(save);
  if (told.length) {
    for (const id of told) seen("opened." + id);
    const from = prevPlace(told[0]), e = save.places[from], sp = e && byId(e.id);
    if (sp && e.kg > 0) toast(openedText(told[0], e.kg, sp.name), 4200);
  }
  // the lake starts to sound with the first touch on the title (browsers keep audio off until then)
  addEventListener("pointerup", () => { Sound.init(); if (G.phase === "title") Sound.setAmbience(true, G.hour); }, { once: true });
  requestAnimationFrame(frame);
}
boot().catch((err) => { console.error(err); if (window.fishBoot) fishBoot.fail("load"); });

