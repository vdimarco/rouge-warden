// Reel It In. The phone is the rod and the reel.
// This file runs the game: the title and the places, the cast and the reel (the phone stays upright for both), the catch,
// and the derby.
// The modules do the parts: motion.js reads the phone, reel.js is the reel you touch, cast.js flies the lure,
// fish.js runs the fish and the fight, world.js draws the place, audio.js and haptics.js make the feel.
// places.js holds the maps, fishing.js who lives where, journey.js the trail and its words, save.js the save file.
import { normalizeStyle } from "./art-style.js";
import { PullStrength } from "./pull.js";
import { Motion } from "./motion.js";
import { createGuide } from "./guide.js";
import { createRodCues } from "./rod-cues.js";
import { Haptics } from "./haptics.js";
import { Sound } from "./audio.js";
import { createWorld } from "./world.js";
import { HangingLure } from "./line-motion.js";
import { CAST, castParams, Flight } from "./cast.js";
import { Rises, LakeSim, rodTip, sizeRank } from "./fish.js";
import { ReelPanel, Crank, RodPad, Gauge, REEL_UI } from "./reel.js";
import * as LAKE from "./lake.js";
import { PLACES, getPlace } from "./places.js";
import { byId } from "./species.js";
import { fishingOf, ecology, placeSpecies } from "./fishing.js";
import { ORDER, JOURNEY, journeyOf, nextPlace, prevPlace, isOpen, fmtKg, startHour, stepHour, rankFor, goalText, openedText, isBigFish, LEGEND_STEPS, legendHint, legendsLanded, topFish, foundHere, foundAll, newPlaces, untoldOpens, TROPHY_RANK, sizeLine, revealText } from "./journey.js";
import { SAVE_KEY, loadSave, placeRec, recordCatch, legendStep, recordDerby } from "./save.js";
import { Native } from "./native.js";

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

/* ---------------- saving ---------------- */
// save.js reads and cleans the file; this is only the storage. In the app the save also goes to native storage
// (Preferences), because the phone can clear the web view's storage. mirror is off while native storage may hold a
// save the game has not read yet, so a new save never covers it
let mirror = true;
const store = {
  raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { const json = JSON.stringify(v); try { localStorage.setItem(k, json); } catch (e) { /* storage off */ } if (mirror) Native.prefs.set(k, json); },
};
// the switches that live outside the save (haptics.js, audio.js and guide.js keep them): mirrored when the app goes away
const SWITCHES = ["fish.haptics", "arcade.sound", "reel-it-in-guide-v1"];
const mirrorSwitches = () => { if (mirror) for (const k of SWITCHES) { const v = store.raw(k); if (v != null) Native.prefs.set(k, v); } };
// in web storage while a read of native storage has not come back: the next start reads it again
const UNREAD = "fish.native-unread";
// how far a save got: fish landed, then casts
const progress = (s) => s.caught * 1e6 + s.casts;
// the switches from native storage, where web storage has none
function putSwitches([, hx, sound, guideOn]) {
  if (hx != null && store.raw("fish.haptics") == null) Haptics.setEnabled(hx !== "false");
  if (sound != null && store.raw("arcade.sound") == null && (sound !== "false") !== Sound.isOn()) Sound.toggle();
  if (guideOn != null && store.raw("reel-it-in-guide-v1") == null) { try { localStorage.setItem("reel-it-in-guide-v1", guideOn); } catch (e) { /* storage off */ } }
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
const persist = () => store.set(SAVE_KEY, save);
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
const guide = createGuide(game, $("#guideToggle"));
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
let cardT = 0, countT = 0;   // the catch card: the timer of the photo beat, the timer of the count-up

/* ---------------- icons for the prompts and the help ---------------- */
const PHONE = "<rect x='14' y='5' width='12' height='22' rx='2.5' fill='none' stroke='currentColor' stroke-width='2.4'/>";
const ICON = {
  bail: "<svg viewBox='0 0 40 40'><circle cx='20' cy='22' r='9' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M8 16 Q20 4 32 16' fill='none' stroke='#e8b64a' stroke-width='3' stroke-linecap='round'/><path d='M20 31 v6 m-3 -3 l3 3 l3 -3' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>",
  thumb: "<svg viewBox='0 0 40 40'><g transform='translate(0 4)'>" + PHONE + "</g><circle cx='20' cy='20' r='5' fill='#e0453a'/></svg>",
  back: "<svg viewBox='0 0 40 40'><g transform='rotate(35 20 30)'>" + PHONE + "</g><path d='M10 12 Q14 4 22 4' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M10 12 l-1 -5 m1 5 l5 -1' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/></svg>",
  flick: "<svg viewBox='0 0 40 40'><g transform='rotate(-30 20 30)'>" + PHONE + "</g><path d='M28 6 Q36 12 36 22' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M36 22 l-4 -3 m4 3 l2 -4' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M4 10 h6 M3 16 h5 M5 22 h4' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg>",
  turn: "<svg viewBox='0 0 40 40'><rect x='5' y='13' width='30' height='16' rx='3' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M12 8 Q20 2 28 8' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M28 8 l-4 0 m4 0 l0 -4' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/></svg>",
  crank: "<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='12' fill='none' stroke='currentColor' stroke-width='2' stroke-dasharray='3 3'/><circle cx='20' cy='20' r='3' fill='currentColor'/><path d='M20 20 L29 12' stroke='currentColor' stroke-width='3' stroke-linecap='round'/><circle cx='29' cy='12' r='4' fill='#e0453a'/></svg>",
  pull: "<svg viewBox='0 0 40 40'><g transform='rotate(-20 20 26)'><rect x='5' y='18' width='30' height='14' rx='3' fill='none' stroke='currentColor' stroke-width='2.4'/></g><path d='M20 14 V3 m-5 5 l5 -5 l5 5' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  low: "<svg viewBox='0 0 40 40'><g transform='rotate(20 20 14)'><rect x='5' y='8' width='30' height='14' rx='3' fill='none' stroke='currentColor' stroke-width='2.4'/></g><path d='M20 26 V37 m-5 -5 l5 5 l5 -5' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  stop: "<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='14' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M13 13 L27 27' stroke='#ff5a4a' stroke-width='3' stroke-linecap='round'/></svg>",
  fish: "<svg viewBox='0 0 40 40'><path d='M5 20 Q16 8 28 20 Q16 32 5 20 Z M28 20 L36 13 L36 27 Z' fill='#e8b64a'/><circle cx='11' cy='18' r='1.8' fill='#0d2f38'/></svg>",
  swipe: "<svg viewBox='0 0 40 40'><rect x='8' y='6' width='24' height='28' rx='3' fill='none' stroke='currentColor' stroke-width='2.2'/><path d='M20 12 V28 m-5 -5 l5 5 l5 -5' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
};

/* ---------------- screens and messages ---------------- */
const SCREENS = ["title", "setup", "help", "journal", "settings", "pause", "catch", "results", "places", "travel", "arrive", "unlock"];
let returnTo = null;
let shownAt = 0, tapAt = -1e9, tapShown = false;
function show(id) {
  if (id !== "help") setPullDemo(false);
  shownAt = now();
  tapShown = shownAt - tapAt < 250;
  for (const s of SCREENS) $("#" + s).hidden = s !== id;
  document.body.dataset.screen = id || "";
  if (id === "title") { $("#title").scrollTop = 0; $("#title .title-menu").scrollTop = 0; }
  const focus = id && ($("#" + id + " .btn.go") || $("#" + id + " button"));
  if (focus && !touchDevice) focus.focus({ preventScroll: true });
}
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

let toastT = 0;
function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), ms);
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
  p.className = tone;
  p.querySelector(".p1").innerHTML = (ICON[icon] || "") + "<span></span>";
  p.querySelector(".p1 span").textContent = text;
  p.querySelector(".p2").textContent = sub;
}
// kind "photo" is the white camera flash of a trophy; the strike and the loss flash red
function flash(kind = "") { const f = $("#flash"); f.classList.remove("go"); f.classList.toggle("photo", kind === "photo"); void f.offsetWidth; f.classList.add("go"); }
let reportT = 0;
function report(dist, verdict, zoneName, sweet) {
  const r = $("#report");
  r.hidden = false;
  r.querySelector(".dist").innerHTML = dist == null ? "" : dist.toFixed(1) + "<small> m</small>";
  const v = r.querySelector(".verdict");
  v.textContent = verdict;
  v.className = "verdict" + (sweet ? " sweet" : "");
  r.querySelector(".zone").textContent = zoneName || "";
  r.classList.remove("show"); void r.offsetWidth; r.classList.add("show");
  clearTimeout(reportT);
  reportT = setTimeout(() => { r.hidden = true; }, 2600);
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
  // the app: no browser steps to follow. Say where to turn it on, and play with touch now
  if (st === "denied" && Native.isStore) {
    note.hidden = true;
    G.input = "touch"; save.input = "touch"; persist();
    show(null);
    const f = setupThen; setupThen = null; if (f) f();
    // after the start, so the goal reminder does not cover it
    toast("Motion is off for Reel It In. You can turn it on in Settings. You can play with touch now.", 5200);
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
  clearTimeout(cardT); clearInterval(countT);
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
  $("#tkick").textContent = (Native.isStore ? "" : "GET PLUNGER'D · ") + journeyOf(G.place.id).kick;
  $("#placesNew").hidden = !newPlaces(save).length;
  show("title");
  titleBest();
  relayout(true);
  // a native save that came late, with more in it: the game starts again with it now
  takeComeback();
}
// "Here: best derby 18.4 kg · biggest Channel Catfish 7.2 kg", then what to do next
function titleBest() {
  const id = G.place.id, e = placeRec(save, id);
  const bits = [];
  if (e && e.d > 0) bits.push("best derby " + fmtKg(e.d));
  const sp = e && e.id && byId(e.id);
  if (sp && e.kg > 0) bits.push("biggest " + sp.name + " " + fmtKg(e.kg));
  const lines = [];
  if (bits.length) lines.push("Here: " + bits.join(" · "));
  // the goal of this place; when the next place is open already, the goal of the first place still locked
  const lock = ORDER.find((p) => !openNow(p)), from = lock && prevPlace(lock);
  if (lock) lines.push(from === id ? goalText(id, "title") : goalText(from, "next"));
  else lines.push(legendsLanded(save) >= ORDER.length ? "You landed every legend." : save.longest > 0 ? "Longest cast " + save.longest.toFixed(1) + " m" : "");
  $("#tbest").textContent = lines.filter(Boolean).join("\n");
}
function begin(mode) {
  Sound.init(); Haptics.unlock(); keepAwake();
  Sound.sfx("ui");
  chooseInput(() => startMode(mode));
}
$("#derbyBtn").addEventListener("click", () => begin("derby"));
$("#freeBtn").addEventListener("click", () => begin("free"));
$("#journalBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); renderJournal(); overlay("journal"); });
$("#helpBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); overlay("help"); });
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
      for (const t of ["Line: " + fishingOf(id).gear.line, "Top fish: " + topFish(id).name, f.n + " of " + f.m + " found · Best derby " + (rec.d > 0 ? fmtKg(rec.d) : "none yet"), "Legend: " + LEGEND_STEPS[legendStepOf(id)]]) {
        const d = document.createElement("div"); d.textContent = t; facts.appendChild(d);
      }
      body.appendChild(facts);
      const b = document.createElement("button");
      b.type = "button"; b.className = here ? "btn alt" : "btn go"; b.disabled = here;
      b.textContent = here ? "You are here" : "Fish here";
      b.addEventListener("click", () => { Sound.sfx("ui"); travelTo(id); });
      body.appendChild(b);
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
    return null;
  }
  // the dimmed screens over the lake draw it once: draw the new place
  G.stillDrawn = false;
  return p;
}
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
  if (id !== "loon" && !save.seen["at." + id]) arrival(id);
  else toTitle();
}
// the first visit: where you are, what is new, and one tip
function arrival(id) {
  const J = JOURNEY[id];
  seen("at." + id);
  $("#akick").textContent = J.kick;
  $("#aname").textContent = J.name;
  $("#ablurb").textContent = J.blurb;
  $("#agear").textContent = "New gear: " + J.gear.charAt(0).toLowerCase() + J.gear.slice(1);
  $("#atip").textContent = J.tip;
  $("#atip").hidden = !J.tip;
  G.phase = "title";
  show("arrive");
}
$("#aStart").addEventListener("click", () => { Sound.sfx("ui"); toTitle(); });

/* ---------------- a fish opens the next place ---------------- */
function unlockCard(id) {
  seen("opened." + id);
  G.unlockId = id;
  $("#uname").textContent = JOURNEY[id].name + " is open!";
  $("#ublurb").textContent = JOURNEY[id].blurb;
  show("unlock");
}
$("#uGo").addEventListener("click", () => { Sound.sfx("ui"); travelTo(G.unlockId); });
$("#uStay").addEventListener("click", () => { Sound.sfx("uiBack"); show(null); nextAfterOutcome(); });

/* ---------------- the cast ---------------- */
function newCast(first) {
  if (G.mode === "derby" && G.castsLeft <= 0) { endDerby(); return; }
  G.sim = null; G.flight = null; G.cast = null; G.landing = null; G.ring = null;
  G.step = "ready"; G.bail = "closed"; G.pin = null; G.drop = 0; G.backMax = 90;
  G.aimYaw = 0; G.tension = 0;
  if (world) { world.hideCatch(); world.setFish(null); world.setFollower(null); }
  hideReport();
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
// the line came off the thumb with no cast: the bail snaps shut and the lure hangs ready again
function resetCast(msg) {
  G.pin = null; G.step = "ready"; G.drop = 0; G.strokeAt = 0;
  if (G.bail === "open") { G.bail = "closed"; Sound.sfx("bailClose"); Haptics.bail(false); }
  if (msg) toast(msg, 3000);
}
function pinLine(e) {
  if (G.phase !== "cast") return;
  if (G.step === "flight") { G.pin = { id: e.id, y0: e.y, theta: 90, feather: true }; return; }
  if (G.pin || (G.step !== "ready" && G.step !== "open")) return;
  // one press does both: the thumb flips the bail open and holds the line
  if (G.bail !== "open") openBail("pin");
  // 80: the rod angle pinmove gives a finger that has not moved, so a small wobble is no flick
  G.pin = { id: e.id, y0: e.y, theta: 80 };
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
  const wasFeather = G.pin.feather;
  G.pin = null;
  if (wasFeather || G.phase !== "cast") return;
  Haptics.mute(0);
  if (G.step !== "pinned" && G.step !== "loaded") return;
  // the browser took the touch away (often the page turning mid-swing): a fumble, not a cast
  if (e.cancel) { Sound.sfx("slip"); resetCast(touchDevice ? "The screen turned. Turn on the rotation lock." : "The line slipped."); return; }
  // with sensors, the exact input time of the lift matters; with a finger, the finger's own clock is the rod's clock
  release(sensing() ? e.t || now() : now());
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
// the finger comes off the line: was it a cast, or did the line just slip?
// late: the rod swung through with the thumb still down. It still casts, low, so the throw is never lost
function release(t, late = false) {
  Haptics.mute(0);
  const s = Motion.at(t);
  const pk = Motion.peak(t - 450, t);
  // the swing square to the rod: a thumb grip rolls the screen, and the pitch rate alone reads it short
  const fwd = Math.max(0, -(pk.minSwing != null ? pk.minSwing : pk.minOmega), -s.omega);
  G.lastRelease = { t, theta: s.theta, omega: s.omega, minOmega: pk.minOmega, maxTheta: pk.maxTheta, fwd };
  // hand tremor alone reaches 20 to 40 deg/s: a motion release needs a real swing
  const minSpeed = sensing() ? Math.max(150, CAST.MIN_STROKE_SPEED || 0) : (CAST.MIN_STROKE_SPEED || 150);
  const forwardTravel = Math.max(G.backMax, pk.maxTheta) - s.theta;
  if (fwd < minSpeed || (sensing() && (forwardTravel < 8 || s.omega > 60))) {
    // no swing: nothing flies. Start again with no fuss
    resetCast(G.input === "motion" ? "Swing the phone forward. Lift your thumb as it tips." : "Drag down. Then flick up and let go.");
    return;
  }
  // grade the release by time, not angle: a fast whip sweeps the sweet band in 30 ms, so measure how far
  // the lift was from the moment the rod crossed the ideal angle, and map ±90 ms onto that band
  let thRel = s.theta;
  if (sensing() && s.theta < 110 && fwd > 0) {
    const I = CAST.IDEAL_RELEASE || 68;
    let tc = null;
    for (let q = t; q >= t - 450; q -= 2) if (Motion.at(q - 2).theta >= I && Motion.at(q).theta < I) { tc = q; break; }
    const errMs = tc != null ? t - tc : -((s.theta - I) / fwd) * 1000;
    thRel = I - clamp(errMs, -400, 400) * 0.22;
  }
  // the thumb never lifted: always the same low line drive (the time grade would call it a slam)
  if (late) thRel = 40;
  const params = castParams({ thetaRelease: thRel, omegaPeak: fwd, thetaBack: Math.max(G.backMax, pk.maxTheta), yaw: G.input === "motion" ? clamp(s.yaw, -75, 75) : G.aimYaw, assist: save.assist });
  G.cast = params;
  G.cast.late = late;
  // physics uses the real rod geometry; world.tip() is the drawn, camera-held rod
  G.flight = new Flight(rodTip(clamp(s.theta, 0, 85), params.yaw, 0, G.place.stand.rod), params);
  G.step = "flight";
  G.casts++;
  if (G.mode === "derby") G.castsLeft--;
  save.casts++;
  Sound.sfx("release");
  seen("cast");
  updateHud();
  relayout();
}
// the cast landed on the place where you stand
const STAND_HIT = { dock: "You hooked the dock.", road: "You hit the road.", bar: "You hit the gravel bar.", wall: "You hit the wall." };
const VERDICT = {
  sweet: "Sweet cast!", high: "Too high. Let go a little later.", low: "Too low. Let go a little sooner.",
  slam: "Too late. Let go sooner.", behind: "Far too early. It went behind you.", weak: "Flick it faster.",
  late: "You held on. Let go during the flick.",
};
const VERDICT_M = {
  sweet: "Sweet cast!", high: "Too high. Lift your thumb a little later.", low: "Too low. Lift your thumb a little sooner.",
  slam: "Too late. Lift your thumb sooner.", behind: "Far too early. It went behind you.", weak: "Too slow. Whip it faster.",
  late: "You kept your thumb down. Lift it as the phone tips.",
};
function landed(r) {
  const dist = Math.hypot(r.x, r.z);
  G.step = r.land === "water" ? "landed" : "ashore";
  const zone = G.place.zone(r.x, r.z);
  const v = G.cast ? (G.cast.late ? "late" : G.cast.verdict) : "";
  const VV = G.input === "motion" ? VERDICT_M : VERDICT;
  if (r.land === "water") {
    world.splash(r.x, r.z, 0.5);
    Sound.sfx("splash", 0.5); Haptics.splash(0.5);
    G.landing = { x: r.x, z: r.z, dist };
    G.ring = rises ? rises.near(r.x, r.z) : null;
    // G.force lets a test pick the fish: { species, kg, bite }
    G.sim = new LakeSim(Object.assign({ place: G.place, lure: { x: r.x, z: r.z }, tip: rodTip(45, G.cast ? G.cast.yaw : 0, 0, G.place.stand.rod), lineOut: r.lineOut, hour: G.hour, ring: G.ring, rng: LAKE.rng(G.seed + G.casts * 7919), easy: save.assist }, G.force || {}));
    G.big = null; G.walk = false;
    G.settle = 0;
    if (G.sim.plan && world.prepareFish) world.prepareFish(G.sim.plan.id);
    const best = dist > save.longest && dist > 12;
    if (dist > save.longest) save.longest = dist;
    persist();
    // at Loon the big fish live farther out; a new player with short casts is told so
    const hint = G.place.id === "loon" && dist < 15 && save.casts <= 12 ? "Farther out, the fish are bigger." : "";
    report(dist, VV[v] || "", G.ring ? (G.ring.gold ? "Right in the gold ring!" : "Right on the rising fish!") : hint || (best ? "Your longest cast yet!" : G.place.zoneNames[zone] || ""), v === "sweet");
    if (G.ring) Sound.sfx("ui");
    // straight to the reel: the first turn of the crank closes the bail, like a real reel
    enterReel();
    return;
  } else {
    Sound.sfx("plop");
    const msg = r.land === "tree" ? (G.place.id === "loon" ? "You caught a pine tree." : "You caught a tree.") : r.land === "dock" ? STAND_HIT[G.place.stand.kind] || "You hooked the dock." : "You cast onto the shore.";
    report(r.land === "dock" ? null : dist, VV[v] || "", msg, false);
    G.outcomeAt = now();
  }
  relayout();
}
/* ---------------- the reel ---------------- */
function enterReel() {
  G.phase = "reel";
  // the phone stays upright: its top edge is still the rod. The cast report stays up a moment, below the prompt
  Motion.mode = G.input === "motion" ? "portrait" : "landscape";
  relayout(true);
  updateHud();
}
function outcome(kind, msg, sub = "") {
  if (Array.isArray(msg)) { sub = msg[1]; msg = msg[0]; }
  G.phase = "lost";
  G.outcomeAt = now();
  prompt(msg, sub, kind === "home" ? "crank" : "stop", "");
  relayout();
}
function nextAfterOutcome() {
  if (G.mode === "derby" && G.castsLeft <= 0) { endDerby(); return; }
  newCast();
}

/* ---------------- the catch ---------------- */
// the photo beat of a trophy, a legend or a fish that opens a place: the fish shows alone (world.js pushes the camera
// in), the flash and the shutter come, then the card slides up. Seconds
const PHOTO = { flash: 1.2, card: 1.5 };
function caught(c) {
  const sp = byId(c.id), at = G.place.id;
  const r = recordCatch(save, at, c);
  const junk = r.junk;
  if (!junk) G.bag.push({ id: c.id, kg: c.kg });
  persist();
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
  Sound.sfx(junk ? "junk" : "landed");
  if (r.record || (r.isNew && !junk) || trophy || legend) setTimeout(() => Sound.sfx("record"), 500);
  if (legend && at === "loon") setTimeout(() => Sound.sfx("loonWail"), 1700);
  Haptics.land(legend ? 2 : trophy ? 1 : 0);
  // at most two badges, in this order
  const badges = $("#cbadges");
  badges.innerHTML = "";
  const marks = [];
  if (legend) marks.push(["LEGEND", ""]);
  if (r.isNew) marks.push([junk ? "NEW FIND" : "NEW SPECIES", "new"]);
  if (r.record) marks.push(["NEW RECORD", ""]);
  if (trophy) marks.push(["TROPHY", ""]);
  for (const [t, cls] of marks.slice(0, 2)) { const b = document.createElement("span"); b.className = "badge " + cls; b.textContent = t; badges.appendChild(b); }
  $("#cname").textContent = sp ? sp.name : c.name || "A fish";
  $("#csize").textContent = junk ? "" : sizeLine(rank);
  $("#cold").textContent = r.record ? "Your old record: " + fmtKg(r.oldKg) + "." : "";
  $("#cblurb").textContent = sp ? sp.blurb : "";
  $("#ccap").textContent = photo ? journeyOf(at).name + " · " + fmtClock(G.hour) : "";
  $("#catch .card").classList.toggle("photo", photo);
  $("#catchGo").textContent = G.mode === "derby" && G.castsLeft <= 0 ? "See the results" : G.pendingUnlock ? "Next" : "Cast again";
  clearTimeout(cardT); clearInterval(countT);
  G.cardWait = photo;
  $("#catch").classList.toggle("wait", photo);
  relayout(true);
  // after the new layout, so the fish is fitted to the view it will be seen in
  world.showCatch(c.id, c.kg, { photo });
  show("catch");
  updateHud();
  if (!photo) { countUp(c, junk, rank); return; }
  cardT = setTimeout(() => {
    flash("photo"); Sound.sfx("shutter"); Haptics.thump();
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
// The weight counts up from 0, over 0.4 + 1.2 × rank² seconds, with up to 10 ticks. A trophy ends with a thump.
function countUp(c, junk, rank) {
  clearInterval(countT);
  if (junk || matchMedia("(prefers-reduced-motion: reduce)").matches) { catchKg(c, junk, c.kg); return; }
  const dur = 0.4 + 1.2 * rank * rank, ticks = clamp(Math.round(dur * 8), 3, 10), t0 = now();
  let done = 0;
  catchKg(c, junk, 0);
  countT = setInterval(() => {
    const k = clamp((now() - t0) / 1000 / dur, 0, 1);
    catchKg(c, junk, c.kg * (1 - Math.pow(1 - k, 2)));
    while (done < ticks && k >= (done + 1) / ticks) { done++; Sound.sfx("tick"); Haptics.tick(); }
    if (k >= 1) {
      clearInterval(countT);
      catchKg(c, junk, c.kg);
      if (rank >= TROPHY_RANK) Haptics.thump();
    }
  }, 40);
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
  $("#rbest").textContent = d.best && total > 0 ? "A new best derby here!" : rec && rec.d > 0 ? "Your best derby here: " + fmtKg(rec.d) : "";
  // a fish of this derby opened the next place
  const up = G.unlocked[G.unlocked.length - 1];
  $("#runlock").hidden = $("#rGo").hidden = !up;
  if (up) { $("#runlock").textContent = openedText(up.id, up.kg, up.name, "results"); seen("opened." + up.id); G.unlockId = up.id; }
  if (d.best && total > 0) Sound.sfx("record");
  relayout(true);
  show("results");
}
$("#rAgain").addEventListener("click", () => { Sound.sfx("ui"); startMode("derby"); });
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
    b.addEventListener("click", () => { Sound.sfx("ui"); renderJournal(id); });
    tabs.appendChild(b);
  }
  const list = $("#jlist");
  list.innerHTML = "";
  const all = foundAll(save), tail = all.n + " of " + all.m + " in all · " + save.caught + " fish landed · " + save.casts + " casts";
  if (!openNow(pid)) {
    const d = document.createElement("div");
    d.className = "jnote"; d.textContent = "Open " + JOURNEY[pid].name + " to see its fish.";
    list.appendChild(d);
    $("#jsum").textContent = tail;
    return;
  }
  const F = fishingOf(pid), here = placeSpecies(pid).map(byId);
  const rows = [...here.filter((sp) => !sp.legend && !F.junk.includes(sp.id)).sort((a, b) => a.kg[1] - b.kg[1]), ...here.filter((sp) => sp.legend), ...here.filter((sp) => F.junk.includes(sp.id))];
  for (const sp of rows) {
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
      sm.textContent = sp.legend ? legendHint(pid, legendStepOf(pid)) : junk ? "It is on the bottom somewhere." : (zoneHint(sp, pid) || "");
    }
    d.append(b, sw, sm);
    list.appendChild(d);
  }
  const f = foundHere(save, pid);
  $("#jsum").textContent = f.n + " of " + f.m + " found here · " + tail;
}
// where and when a fish bites, from this place's own table
function zoneHint(sp, pid) {
  const eco = ecology(pid).find(([s]) => s.id === sp.id), E = eco && eco[1];
  if (!E) return "";
  const z = Object.entries(E.zones || {}).sort((a, b) => b[1] - a[1])[0];
  // the hour it bites best, if it has one and the place's clock runs through it (Stump Bay only runs 19:00 to 24:00)
  const c = journeyOf(pid).clock, lo = Math.min(c.free, c.derby, c.wrap);
  const best = (E.hours || []).filter((h) => h[1] > lo && h[0] < c.end).reduce((a, h) => (h[2] > (a ? a[2] : 1) ? h : a), null);
  const when = !best ? "" : best[0] >= 20.5 ? " at night" : best[1] <= 10 ? " in the morning" : best[0] >= 17 ? " at dusk" : " at midday";
  return z ? "Try " + (getPlace(pid).zoneNames[z[0]] || z[0]).toLowerCase() + when + "." : "";
}

/* ---------------- help ---------------- */
const HELP_M = [
  ["turn", "Hold the phone <b>upright</b>, like the handle of a rod. Keep it upright the whole time. Its top edge is the rod."],
  ["turn", "Turn your body to <b>aim</b>. The dotted line shows where the lure goes."],
  ["thumb", "<b>Press and hold</b> your thumb on the rod. This opens the bail, and your thumb holds the line."],
  ["back", "Tip the phone <b>back</b> over your shoulder."],
  ["flick", "<b>Whip it forward.</b> Lift your thumb as the phone tips forward. Keep a tight grip."],
  ["thumb", "To stop the lure short, touch the rod while it flies."],
  ["crank", "Turn the <b>crank</b> with your thumb. The first turn closes the bail. Reel <b>slowly</b>. Stop now and then."],
  ["pull", "When a fish <b>strikes</b>, snap the phone up. This sets the hook."],
  ["pull", "<b>Pump and reel.</b> Tip the phone back toward you as you reel. Ease forward to relax."],
  ["stop", "When the drag <b>slips</b>, stop reeling."],
  ["turn", "Tilt the phone left or right to <b>steer</b> a running fish. Keep it away from weeds, rocks, stumps and logs."],
  ["low", "When it <b>shakes its head</b>, hold the rod up. When it <b>jumps</b>, lower it."],
  ["crank", "When it <b>swims at you</b>, reel fast."],
  ["pull", "When it <b>holds on the bottom</b>, pump it up."],
  ["fish", "When the fish is <b>tired</b> and close, tip the phone up and hold it there."],
  ["fish", "Land a big fish to open a new place. Each place has its own derby and its own legend."],
];
const HELP_T = [
  ["turn", "Drag the lake left or right to <b>aim</b>."],
  ["thumb", "<b>Press and hold</b> on the rod. This opens the bail. <b>Drag down</b> to tip the rod back."],
  ["flick", "<b>Flick up</b>. Let go during the flick."],
  ["crank", "Turn the <b>crank</b> in circles, or use the mouse wheel, or hold <b>R</b>. The first turn closes the bail. Reel slowly."],
  ["pull", "The <b>rod</b> on the right: drag up to raise the rod. A fast swipe up sets the hook. Keys: <b>W S A D</b> and <b>Space</b>."],
  ["stop", "When the drag <b>slips</b>, stop reeling."],
  ["turn", "Drag the rod left or right to <b>steer</b> a running fish. Keep it away from weeds, rocks, stumps and logs."],
  ["low", "When it <b>shakes its head</b>, hold the rod up. When it <b>jumps</b>, lower it."],
  ["crank", "When it <b>swims at you</b>, reel fast."],
  ["pull", "When it <b>holds on the bottom</b>, pump it up."],
  ["fish", "When the fish is <b>tired</b> and close, drag the rod up and hold it."],
  ["fish", "Land a big fish to open a new place. Each place has its own derby and its own legend."],
];
for (const [id, list] of [["#helpM", HELP_M], ["#helpT", HELP_T]]) $(id).innerHTML = list.map(([ic, t]) => "<li>" + ICON[ic] + "<span>" + t + "</span></li>").join("");
function setPullDemo(open) {
  const motionTab = $("#help [data-tab='m']").getAttribute("aria-selected") === "true";
  $("#pullDemo").hidden = !open;
  $("#helpM").hidden = open || !motionTab;
  $("#helpT").hidden = open || motionTab;
  $("#watchPullDemo").hidden = !motionTab;
  $("#watchPullDemo").textContent = open ? "Back to steps" : "Watch pull-back demo";
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
for (const tab of $$("#help [data-tab]")) tab.addEventListener("click", () => {
  for (const t of $$("#help [data-tab]")) t.setAttribute("aria-selected", String(t === tab));
  setPullDemo(false);
});
function seen(k) { if (!save.seen[k]) { save.seen[k] = 1; persist(); } }

/* ---------------- art style ---------------- */
function syncArtStyle() {
  document.body.dataset.artStyle = save.artStyle;
  for (const button of $$("[data-art]")) button.setAttribute("aria-pressed", String(button.dataset.art === save.artStyle));
  $("#optArtStyle").value = save.artStyle;
  $("#artNote").textContent = save.artStyle === "ghibli" ? "Cartoon models and painted skies" : "Classic lake scenery";
}
function setArtStyle(style) {
  save.artStyle = normalizeStyle(style);
  persist();
  syncArtStyle();
  if (world) world.setArtStyle(save.artStyle);
  G.stillDrawn = false;
}
for (const button of $$("[data-art]")) button.addEventListener("click", () => setArtStyle(button.dataset.art));
$("#optArtStyle").addEventListener("change", (event) => setArtStyle(event.target.value));
syncArtStyle();

/* ---------------- settings ---------------- */
function syncSettings() {
  $("#optSound").checked = Sound.isOn();
  $("#optHaptics").checked = Haptics.enabled;
  $("#optHaptics").disabled = Haptics.kind === "none";
  $("#hapticNote").textContent = Haptics.kind === "none" ? (Native.isStore ? "This phone cannot buzz." : "This browser cannot buzz.") : Haptics.kind === "ios" ? "Light taps on iPhone." : "Buzz for bites, strikes, and line pull.";
  $("#optAssist").checked = !!save.assist;
  $("#optInput").value = G.input === "motion" || save.input === "motion" ? "motion" : "touch";
  $("#optInput").disabled = !touchDevice || !Motion.available;
  $("#inputNote").textContent = !touchDevice || !Motion.available ? "Motion needs a phone." : G.input === "motion" ? "The phone is the rod." : "Drag and flick on the screen.";
  $("#optQuality").value = save.quality;
  $("#optReelSide").value = save.reelSide;
  syncArtStyle();
}
$("#optSound").addEventListener("change", (e) => { if (e.target.checked !== Sound.isOn()) Sound.toggle(); });
$("#optHaptics").addEventListener("change", (e) => { Haptics.unlock(); Haptics.setEnabled(e.target.checked); if (e.target.checked) Haptics.bump(0.6); });
$("#optAssist").addEventListener("change", (e) => { save.assist = e.target.checked; persist(); });
$("#optQuality").addEventListener("change", (e) => { save.quality = e.target.value; persist(); applyQuality(); });
$("#optReelSide").addEventListener("change", (e) => {
  save.reelSide = e.target.value === "left" ? "left" : "right";
  game.dataset.reelSide = save.reelSide;
  persist();
});
$("#optInput").addEventListener("change", async (e) => {
  if (e.target.value === "motion") {
    const st = await Motion.request();
    if (st === "granted") { G.input = "motion"; save.input = "motion"; lockPortrait(); }
    else if (st === "idle") { e.target.value = "touch"; toast("Tap Use motion on the start screen to allow the sensors."); }
    else { e.target.value = "touch"; G.input = "touch"; save.input = "touch"; toast(st === "denied" ? (Native.isStore ? "Motion is off for Reel It In." : "Motion is blocked for this page.") : "No motion data from this phone."); }
  } else { G.input = "touch"; save.input = "touch"; }
  persist(); syncSettings(); relayout(true);
});
function quality() { return save.quality === "auto" ? (touchDevice ? "low" : "high") : save.quality; }
function applyQuality() {
  // the reel canvases follow the quality too: fewer pixels to paint on a phone
  REEL_UI.maxDpr = quality() === "low" ? 1.5 : 2;
  if (world) world.setQuality(quality());
  G.stillDrawn = false;
  for (const w of [reelPanel, crank, rodPad, gauge]) if (w && w.resize) w.resize();
}

/* ---------------- pause ---------------- */
function pause() {
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
  $("#pauseSum").textContent = [G.ctxLost && "The lake is coming back.", hudText(), goalLine("remind")].filter(Boolean).join("\n");
  $("#resumeBtn").disabled = !!G.ctxLost;
}
function resume() { if (G.ctxLost) return; G.paused = false; show(null); Sound.sfx("ui"); keepAwake(); }
$("#pauseBtn").addEventListener("click", (e) => { e.stopPropagation(); Sound.sfx("ui"); pause(); });
$("#resumeBtn").addEventListener("click", resume);
$("#quitBtn").addEventListener("click", () => { G.paused = false; Sound.sfx("uiBack"); toTitle(); });
$("#pHelp").addEventListener("click", () => overlay("help"));
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
  const open = (s) => !$("#" + s).hidden;
  if (traveling) return;
  if (window.GameSwitch && GameSwitch.isOpen) { GameSwitch.close(); return; }
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
// short: the HUD chip, which must fit beside the pause button and the clock on a narrow phone
function hudText(short) {
  const kg = G.bag.reduce((a, b) => a + b.kg, 0);
  // the next cast is still to come: before the release
  const next = G.phase === "cast" && ["ready", "open", "pinned", "loaded"].includes(G.step);
  const n = Math.min(10, G.casts + (next ? 1 : 0));
  // 100 kg or more (Big Blue) in whole kg, so the chip fits a 360 px phone
  const w = short && kg >= 100 ? Math.round(kg) + " kg" : fmtKg(kg);
  if (G.mode === "derby") return short ? "Derby " + n + "/10 · " + w : "Derby · cast " + n + " of 10 · " + w;
  return (short ? "Free · " : "Free fishing · ") + G.bag.length + " fish · " + w;
}
function updateHud() {
  $("#modeChip").textContent = hudText(true);
  $("#clock").textContent = fmtHour(G.hour);
}

/* ---------------- controls ---------------- */
const keys = {};
addEventListener("keydown", (e) => {
  if (e.repeat && !["KeyR", "KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) return;
  if (window.GameSwitch && GameSwitch.isOpen) return;
  keys[e.code] = true;
  if (e.code === "Escape" && ["help", "journal", "settings", "places"].some((s) => !$("#" + s).hidden)) { Sound.sfx("uiBack"); closeOverlay(); return; }
  if (e.code === "Escape" || e.code === "KeyP") { if (G.paused) resume(); else pause(); return; }
  if (G.paused) return;
  if (e.code === "KeyE" && G.phase === "cast") { if (G.bail === "closed" && G.step === "ready") openBail("key"); else if (G.bail === "open" && G.step === "open") closeBail(); }
  if (e.code === "Space" && (G.phase === "reel")) { G.hookReq = true; e.preventDefault(); }
  if (e.code === "BracketLeft") setDrag(G.drag - 1);
  if (e.code === "BracketRight") setDrag(G.drag + 1);
  // the unlock card shows while the phase is still "catch": there Enter must press the button that has the focus
  if (e.code === "Enter" && G.phase === "catch" && !$("#catch").hidden) { e.preventDefault(); $("#catchGo").click(); }
  syncPadKeys();
});
addEventListener("keyup", (e) => { keys[e.code] = false; syncPadKeys(); });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; syncPadKeys(); });
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
// the mouse wheel turns the crank
addEventListener("wheel", (e) => { if (G.phase === "reel" && crank && !G.paused) { crank.wheel(e.deltaY); e.preventDefault(); } }, { passive: false });
// aim with touch or mouse: drag the lake left or right before you open the bail
{
  let drag = null;
  const view = $("#view");
  view.addEventListener("pointerdown", (e) => {
    if (G.phase !== "cast" || G.input === "motion" || G.bail !== "closed") return;
    drag = { id: e.pointerId, x: toLocal(e.clientX, e.clientY).x, yaw: G.aimYaw };
  });
  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const x = toLocal(e.clientX, e.clientY).x;
    G.aimYaw = clamp(drag.yaw + (x - drag.x) * 0.2, -60, 60);
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  addEventListener("pointerup", end);
  addEventListener("pointercancel", end);
}

/* ---------------- per-frame: the cast ---------------- */
const hangingLure = new HangingLure();
let castFlex = 0, castFlexVelocity = 0;
function castUpdate(dt) {
  const t = now();
  const p = Motion.pose;
  // touch mode: the finger on the rod is the rod. Drag down = rod back; flick up = forward
  if (!sensing()) {
    let th = 75;
    if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) th = G.pin.theta;
    else if (G.step === "flight" || G.step === "landed" || G.step === "ashore") th = lerp(p.theta || 60, 60, 1 - Math.exp(-dt * 4));
    Motion.virtual({ t, theta: th, yaw: G.aimYaw, roll: 0 });
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
    if (G.step === "pinned" && theta >= (CAST.LOAD_THETA || 100)) { G.step = "loaded"; Sound.sfx("load"); loadTap(); }
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
    // feathering: a finger on the rod slows the line, so the lure drops short onto a target
    if (G.pin && G.pin.feather) prompt("Your thumb slows the line.", "", "thumb");
    else prompt(save.casts >= 3 && save.casts < 9 ? "To stop the lure short, touch the rod." : "", "", "thumb");
    if (r.done) { Sound.setSpool(0); prompt(""); landed(r); }
    return;
  }
  // a landing in the water goes straight to the reel (see landed); on the shore, the next cast comes by itself
  if (G.step === "landed" && G.sim) { enterReel(); return; }
  if (G.step === "ashore") {
    tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, bend: 0.05, visible: true });
    world.setView({ mode: "cast", yaw, portrait: G.layout === "tall-cast" });
    if (t - G.outcomeAt > 2300) { if (G.bail === "open") { G.bail = "closed"; Sound.sfx("bailClose"); } if (G.mode === "derby" && G.castsLeft <= 0) endDerby(); else newCast(); }
    castPrompt();
    return;
  }
  // ready, open, pinned, loaded: the lure hangs under the tip
  tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, bend: Math.max(0, castFlex), visible: true });
  const hanging = hangingLure.step(tip, 0.28 + G.drop, dt);
  world.setLure({ ...hanging, visible: true, spin: 0 });
  world.setLine({ from: tip, to: hanging, slack: 0, visible: true });
  world.setView({ mode: "cast", yaw, portrait: G.layout === "tall-cast" });
  world.setAim({ yaw, visible: G.step === "ready" || G.step === "open" || G.step === "pinned" || G.step === "loaded" });
  castPrompt();
}
function castPrompt() {
  const m = G.input === "motion";
  // held sideways: say so here, without a card in the way (the picture already stays upright on the phone)
  if (m && sensing() && G.step === "ready" && Motion.pose.orient === "landscape") return prompt("Hold the phone upright.", "Like the handle of a rod.", "turn");
  switch (G.step) {
    case "ready": prompt(m ? "Hold your thumb on the rod." : "Press and hold on the rod.", m ? "Turn to aim." : "Drag the lake to aim.", "thumb"); break;
    case "open": prompt(m ? "Hold your thumb on the rod." : "Press and hold on the rod.", G.drop > 0.3 ? "The line is slipping! Hold it." : "Your thumb holds the line.", "thumb"); break;
    case "pinned": prompt(m ? "Tip the phone back over your shoulder." : "Drag down to tip the rod back.", m ? "Keep your thumb down." : "", "back"); break;
    case "loaded": prompt(m ? "Whip it forward. Lift your thumb!" : "Flick up and let go!", m ? "Lift it as the phone tips forward." : "", "flick", "hot"); break;
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
  Haptics.thump();
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
  pullMeter.hidden = G.input !== "motion" || !Motion.live || s.phase !== "fight" || !pullActive || (s.tfrac || 0) > 0.85;
  pullMeter.querySelector("span").textContent = pull > 0.03 ? "Pull strength +" + Math.round(pull * 35) + "%" : "Tip back as you reel";
  pullMeter.querySelector("i").style.transform = "scaleX(" + pull.toFixed(3) + ")";
  const pullTo = s.fish ? { x: s.fish.x, y: Math.max(s.fish.y, -0.3), z: s.fish.z } : s.lure;
  const tip = world.setRod({ theta, yaw: 0, steer, bend: clamp(s.bend != null ? s.bend : G.tension * 1.3, 0, 1), pull: pullTo, visible: true });
  // the sim bends its own rod: give it the straight rod's tip, not the drawn one
  sim.step(dt, { crank: crankRate, pull, tip: rodTip(theta, 0, steer, G.place.stand.rod), theta, omega: p.omega, steer, drag: G.drag, hookset, lift: theta > 70 });
  G.tension = lerp(G.tension, s.tfrac || 0, 1 - Math.exp(-dt * 12));
  for (const e of sim.events.splice(0)) handleEvent(e);
  // the outcome comes from the sim's phase; events only drive sound, buzz and pictures
  if (s.phase === "caught" && s.catch) { caught(s.catch); return; }
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
function reelPrompt(s, crankRate, theta) {
  const m = sensing();
  const t = now();
  const recent = (k, ms) => t - (G.lastEvent[k] || -1e9) < ms;
  // the drag slips in short bursts: the slip prompts stay 0.7 s after the last slip, so they do not flicker
  if ((s.slip || 0) > 0.15) G.slipAt = t;
  const slipRecent = t - (G.slipAt || -1e9) < 700;
  // the way to steer: side +1 is right
  const dirWord = (side) => (side > 0 ? "right" : side < 0 ? "left" : "");
  const steerSub = (side) => { const d = dirWord(side); return m ? (d ? "Tilt the phone " + d + "." : "Tilt the phone left or right.") : (d ? "Drag the rod " + d + "." : "Drag the rod sideways."); };
  // the bail is still open: say how to start, but let a follower, a nibble or a strike speak for themselves
  if (G.bail === "open" && (s.phase === "sink" || s.phase === "retrieve") && !s.follower && !recent("nibble", 900)) return prompt("Turn the crank to reel.", "The first turn closes the bail.", "crank");
  switch (s.phase) {
    case "sink": case "retrieve": {
      if (s.empty) return prompt("Nothing is biting here.", "Reel in and cast again.", "crank");
      if (recent("nibble", 900)) return nightAt(G.hour) >= 0.5 ? prompt("It is dark. Feel for the bite.", "Wait for the strike.", "fish") : prompt("A fish is nibbling.", "Wait for the strike.", "fish");
      if (s.follower) return s.tooFast ? prompt("Too fast! Reel slower.", "The fish cannot keep up.", "crank", "hot") : prompt("A fish is following.", "Stop for a moment. It may bite.", "crank");
      // the river: the current swings the lure. Said once
      if (G.place.flow && !save.seen["river.swing"] && $("#report").hidden) { seen("river.swing"); G.swingUntil = t + 4500; }
      if (t < (G.swingUntil || 0)) return prompt("The current takes your lure.", "Reel slowly. Fish take it at the end of the swing.", "crank");
      return prompt("Turn the crank to reel.", save.seen.bite ? "" : "Stop now and then. Fish like a pause.", "crank");
    }
    case "strike":
      return prompt(m ? "PULL UP! Set the hook!" : touchDevice ? "SWIPE UP! Set the hook!" : "PRESS SPACE! Set the hook!", "", "pull", "hot");
    case "fight": {
      const f = s.fish || {};
      if (G.walk && f.move !== "jump" && !recent("jump", 1500)) G.walk = false;
      // 2. a jump, or a tail walk: keep the rod low
      if (f.move === "jump" || recent("jump", 900)) return G.walk ? prompt("It jumps again and again!", "Keep the rod low.", "low", "hot") : prompt("It jumped! Lower the rod!", "", "low", "hot");
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
        return prompt(K === "stump" ? "The line is on a stump!" + steer : K === "logs" ? "The line is on the logs!" + steer : K === "rocks" ? "The line is on the rocks! Hold the rod up." : "It is in the weeds!" + steer, steerSub(R.shown), K === "rocks" ? "pull" : "turn", "hot");
      }
      // 4. its last run. A fish of the wall swims at you and the line goes slack: then reel
      if (recent("lastrun", 2000)) return s.slack ? prompt("Slack line! Reel it in.", "Keep the line tight.", "crank", "hot") : prompt("It sees you! Let it run.", "Reel only if the line goes slack. Hold the rod up.", "stop", "hot");
      // the tuna's first run: the banner says to let it go, and so does the prompt
      if (s.boss && s.boss.n === 1 && /let it go/i.test(s.boss.name || "") && f.move === "run" && (s.fightT || 0) < 2.5) return prompt("It runs! Let it go.", "Hold the rod up. Reel only if the line goes slack.", "pull", "hot");
      if (f.move === "thrash" || f.move === "shake" || recent("shake", 700)) return prompt("It shakes its head!", "Hold the rod up. Reel in any slack.", "pull", "hot");
      if (f.move === "turn" || recent("turn", 1200)) return prompt("It turned. Stop reeling!", "", "stop", "hot");
      if (f.move === "charge") return prompt("It swims at you! Reel fast.", "Reel until the line is tight.", "crank", "hot");
      if (slipRecent && crankRate > 0.3) return prompt("The drag is slipping. Stop reeling.", "Hold the rod up. Let it run.", "stop", "hot");
      if ((s.tfrac || 0) > 0.85) return prompt("Too tight! Stop reeling.", "Lower the rod a little.", "low", "hot");
      // only while the drag slips: a full spool warning that stays up would hide the rest and the sulk
      if ((s.spoolFrac || 0) > 0.75 && slipRecent) return G.drag < 2 ? prompt("The spool is almost empty!", "Tighten the drag.", "stop", "hot") : prompt("The spool is almost empty!", "Hold on. Keep the rod up.", "pull", "hot");
      if (f.move === "hold") return prompt("It rests. Rest your arm.", "Keep the line tight.", "fish", "good");
      if (f.move === "sulk") return prompt("It holds on the bottom.", "Lift the rod slowly. Then reel as you lower it.", "pull");
      if (s.cover) return prompt("It swims to the " + (COVER_NAME[s.cover.kind] || s.cover.kind) + "!", steerSub(s.cover.steer != null ? s.cover.steer : -s.cover.side), "turn", "hot");
      if (slipRecent) return prompt("It is running. Let it go.", "Keep the rod up. Reel when it stops.", "pull");
      if (s.slack) return prompt("Slack line! Reel it in.", "", "crank", "hot");
      if (s.beaten) return prompt("It is tired. Reel steadily.", "Slow down if the gauge turns red.", "crank", "good");
      if (theta < 28) return prompt("Keep your rod up.", m ? "Tip the phone up toward you." : "Drag the rod up.", "pull");
      return prompt("Pump and reel.", m ? "Tip the phone back toward you as you reel. Ease forward to relax." : "Drag the rod up. Then reel as it comes down.", "pull");
    }
    case "land": return prompt(G.place.id === "sea" ? "Bring it to the wall! Raise the rod and hold." : "Lift it out! Raise the rod and hold.", "", "pull", "good");
    default: return prompt("");
  }
}
function handleEvent(e) {
  const type = typeof e === "string" ? e : e.type;
  G.lastEvent[type] = now();
  const s = G.sim && G.sim.state;
  const fx = e.x != null ? e.x : s && s.fish ? s.fish.x : s ? s.lure.x : 0;
  const fz = e.z != null ? e.z : s && s.fish ? s.fish.z : s ? s.lure.z : 0;
  switch (type) {
    case "nibble": Sound.sfx("nibble", e.s); Haptics.bump(e.s == null ? 0.5 : e.s); if (crankPad) crankPad.forceTick(); if (s) world.ripple(s.lure.x, s.lure.z, 0.3); seen("bite"); break;
    case "strike": Sound.sfx("strike"); Haptics.thump(); flash(); if (crankPad) crankPad.forceTick(); if (s) world.splash(s.lure.x, s.lure.z, 0.35); break;
    case "hooked": {
      if (e.junk) { Sound.sfx("junk"); toast("Something heavy is on the line. Reel it in.", 2200); }
      else { Sound.sfx("hookset"); Haptics.hookset(); toast(e.self ? "It hooked itself! Fish on!" : "Fish on!", 1400); }
      // the ring's fish is on the line: its ring goes quiet
      if (G.ring && rises && rises.take) { rises.take(G.ring); G.ring = null; }
      // a big one gets a warning at the first run of the drag, or 4 s from now
      const hs = !e.junk && byId(e.id || (s && s.fish && s.fish.id)), kg = s && s.fish ? s.fish.kg : 0;
      G.big = hs && kg > 0 && isBigFish(G.place.id, kg, sizeRank(hs, kg)) ? { at: now(), said: false } : null;
      G.walk = false;
      // the legend of this place is on the line
      if (hs && hs.legend && legendStep(save, G.place.id, 2)) persist();
      break;
    }
    case "drag": sayBig(); break;
    case "missed": case "spooked": Sound.sfx("miss"); break;
    case "refuse": Sound.sfx("miss"); toast("Too fast. It turned away. Reel slower.", 2600); break;
    case "slack": Sound.sfx("slip"); Haptics.bump(0.3); break;
    case "jump": Sound.sfx("jump", e.size); Haptics.splash(0.8); world.splash(fx, fz, e.size || 0.8); break;
    case "splash": world.splash(fx, fz, e.size || 0.5); Sound.sfx("splash", e.size || 0.5); break;
    case "run": case "surge": if (!save.seen.run) { toast("It is running! Let the drag work.", 2400); seen("run"); } break;
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
    case "turn": Haptics.thump(); break;
    case "sulk": Sound.sfx("creak"); Haptics.throb(); break;
    case "pump": Haptics.bump(0.4); break;
    case "unstuck": Sound.sfx("splash", 0.3); world.splash(fx, fz, 0.3); break;
    case "walk": G.walk = true; break;
    case "walkEnd": G.walk = false; break;
    case "thrash": Haptics.thrash(); Sound.sfx("splash", 0.4); world.splash(fx, fz, 0.4); break;
    case "turned": toast("You turned it!", 1800); break;
    // its own warning: the snap buzz would say the line broke, and its silence would hide the drag
    case "lastrun": Haptics.surge(); break;
    case "phase": toast(e.name, 2200); Sound.sfx("record"); Haptics.phase(); break;
    case "spool": Sound.sfx("slip"); Haptics.bump(0.8); break;
    case "snap":
      // a line that rubbed through, or ran out: the loss line says which
      Sound.sfx(e.reason === "weeds" || e.reason === "rocks" || e.reason === "stump" || e.reason === "logs" ? "thrown" : "snap"); Haptics.jolt(); flash(); break;
    case "thrown": G.thrownBy = e.jump ? "jump" : e.thrash ? "thrash" : e.charge ? "charge" : "slack"; Sound.sfx("thrown"); Haptics.jolt(); break;
    case "home": Sound.sfx("plop"); break;
  }
}
// what went wrong, and what to do next time
function reasonText(r) {
  const steer = sensing() ? "Tilt the phone left or right to steer it away." : "Drag the rod sideways to steer it.";
  const thrown = { jump: ["It threw the hook.", "Lower the rod when it jumps."], thrash: ["It shook the hook out.", "Hold the rod up when it shakes its head."], charge: ["It threw the hook.", "Reel fast when it swims at you."] };
  return ({
    snap: ["SNAP! The line broke.", "Stop reeling when the drag slips."],
    thrown: thrown[G.thrownBy] || ["It threw the hook.", "Keep the line tight."],
    spat: ["It spat the lure.", sensing() ? "Pull up as soon as it strikes." : "Swipe up as soon as it strikes."],
    spooked: ["You spooked it.", "Wait for the strike."],
    weeds: ["It wrapped the line in the weeds.", steer],
    stump: ["The line broke on a stump.", "Steer the fish away from the stumps."],
    logs: ["The line broke on the logs.", "Keep the fish away from the logjam."],
    rocks: ["The line broke on the rocks.", "Hold the rod up near the rocks, and steer away."],
    spooled: ["It took all your line.", "Tighten the drag on a long run."],
  })[r] || ["It got away.", ""];
}

/* ---------------- the loop ---------------- */
let last = now(), fpsAcc = 0, fpsN = 0, drew = false, drawAt = 0, menuDt = 0;
// the title over the live lake (the Original style) is a menu: the lake draws there at 15 frames a second at most
const MENU_MS = 66;
// An opaque screen covers the lake: a dimmed card, or the title with its painted picture. Read again only when the
// screen or the art style changes
let coverKey = "", coverTitle = false;
function covered() {
  if (document.querySelector(".screen.dim:not([hidden])")) return true;
  const key = (document.body.dataset.screen || "") + "|" + (document.body.dataset.artStyle || "");
  if (key !== coverKey) { coverKey = key; const t = $("#title"); coverTitle = !t.hidden && /url\(/.test(getComputedStyle(t).backgroundImage); }
  return coverTitle;
}
function frame() {
  requestAnimationFrame(frame);
  const t = now();
  let dt = (t - last) / 1000;
  // the render scale reads only the frames that drew the lake: a frame under a still screen costs nothing. A new pixel
  // ratio clears the canvas, so a still lake is drawn again
  if (world && world.frameTime && drew && world.frameTime(t - last)) G.stillDrawn = false;
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
  guide.update({ phase: G.phase, step: G.step, motion: sensing(), touch: touchDevice,
    pullAvailable: !pullMeter.hidden && (G.sim?.state.tfrac || 0) < 0.65,
    fishPhase: G.sim && G.sim.state.phase, paused: G.paused, cue: guideCue }, t / 1000);
  dt = Math.min(dt, 0.05);
  // under the pause menu, the dimmed screens and the painted title the lake stands still: draw it once, then let the
  // GPU rest. A lost GL context draws nothing until it is back. The title over the live lake draws it less often
  const still = G.paused || G.ctxLost || covered(), menu = !still && G.phase === "title";
  menuDt = menu ? menuDt + dt : 0;
  drew = still ? !G.stillDrawn : !menu || t - drawAt >= MENU_MS;
  if (drew) { world.update(menu ? menuDt : dt); world.render(); drawAt = t; menuDt = 0; }
  G.stillDrawn = still;
  rodCues.update({ world, phase: G.phase, step: G.step, motion: sensing(),
    paused: still, cue: guideCue, fish: G.sim?.state, nibble: t - (G.lastEvent.nibble || -1e9) < 900,
    held: !!G.pin || !!rodPad?.drag });
  if (!$("#reelUI").hidden) { crank.draw(dt); gauge.draw(dt); if (!rodPad.hidden) rodPad.draw && rodPad.draw(dt); }
  if (DEBUG) debug();
}
function step(dt) {
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
          if (G.phase !== "reel" && !(G.goldAt && Math.hypot(e.x - G.goldAt.x, e.z - G.goldAt.z) < 1)) { G.goldAt = { x: e.x, z: e.z }; toast("A gold ring! Something big is rising.", 2600); }
          if (legendStep(save, G.place.id, 1)) persist();
        }
      }
      // the rings only change when one rises or goes quiet
      if (ev.length || rises.list.length !== G.ringN) { G.ringN = rises.list.length; world.setRings(rises.list); }
    }
  } else if (G.phase === "title") {
    world.setView({ mode: "title" });
  }
  switch (G.phase) {
    case "cast": {
      castUpdate(dt);
      if (G.phase !== "cast") break;
      // before the cast, a press takes the line at once: anywhere with the sensors, on the rod face with touch
      // (the lake is for aiming then). The press itself opens the bail
      const waiting = G.step === "ready" || G.step === "open";
      reelPanel.set({ bail: G.bail, pinned: !!G.pin, line: 0.85, hint: "", glow: waiting ? "pin" : "", touchCast: !sensing(), grab: waiting ? (sensing() ? "all" : "panel") : "" });
      // a thumb that stayed down from the last cast (it never lifted) holds the line now
      if (waiting && !G.pin && reelPanel.pinId != null && reelPanel.thumb) pinLine({ id: reelPanel.pinId, x: reelPanel.thumb.x, y: reelPanel.thumb.y, t: now() });
      if (G.step !== "flight") reelPanel.set({ spool: G.drop > 0 && G.drop < 1.2 && G.bail === "open" && !G.pin ? 1.2 : 0 });
      break;
    }
    case "reel": reelUpdate(dt); break;
    case "lost":
      Sound.setReel(0); Sound.setDrag(0); Sound.setTension(0); Haptics.setCrank(0); Haptics.setTension(0, 0, false);
      world.setFish(null); world.setFollower(null); world.setLine({ visible: false }); world.setLure({ x: 0, y: -5, z: 0, visible: false });
      if (now() - G.outcomeAt > 2400) { prompt(""); nextAfterOutcome(); }
      break;
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
    REEL_UI.maxDpr = quality() === "low" ? 1.5 : 2;
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
  reelPanel.on("pin", (e) => { if (!G.paused) pinLine(e); });
  reelPanel.on("pinmove", (e) => {
    if (!G.pin || G.pin.feather || e.id !== G.pin.id) return;
    // touch casting: finger height is the rod angle. Drag down to tip it back, flick up to cast
    const h = Math.max(160, Math.min(240, game.clientHeight * 0.3));
    G.pin.theta = clamp(80 + ((e.y - G.pin.y0) / h) * 150, 5, 170);
    // one clock for the finger: pointer times are input times and can run behind the frame's own samples
    if (!sensing()) Motion.virtual({ t: now(), theta: G.pin.theta, yaw: G.aimYaw, roll: 0 });
  });
  reelPanel.on("unpin", (e) => unpinLine(e));
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
    // the rod loads the moment it passes back over the shoulder, even between two frames
    if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) {
      G.backMax = Math.max(G.backMax, pose.theta);
      if (G.step === "pinned" && pose.theta >= (CAST.LOAD_THETA || 100)) { G.step = "loaded"; Sound.sfx("load"); loadTap(); }
      if (strokeEnded(pose, t)) { Sound.setSwish(0); G.pin = null; release(t, true); }  // release() lifts the buzz mute
    }
  });
  crank = new Crank($("#crankBox"), { toLocal, hand: "right" });
  rodPad = new RodPad($("#padBox"), { toLocal, direct: true });
  rodPad.on("yank", () => { if (G.phase === "reel") G.hookReq = true; });
  gauge = new Gauge($("#gaugeBox"));
  $("#view").addEventListener("transitionend", (e) => { if (e.target.id === "view") resizeView(); });
  // iPhone: only a real finger on a switch control can tick. The reel face and the crank carry hidden switches
  Haptics.attachPad($("#reelBox"));
  crankPad = Haptics.attachCrank($("#crankBox"), { toLocal });
  setDrag(1);
  window.FISH = {
    G, Motion, get world() { return world; }, get crank() { return crank; }, get sim() { return G.sim; }, get save() { return save; },
    startMode, newCast, toTitle, release, openBail, closeBail, enterReel, relayout, toLocal, pinLine, unpinLine, get rises() { return rises; },
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

